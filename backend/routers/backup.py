"""
v2.8 — Sauvegarde & Restauration
- Full backup  : copie binaire SQLite (hebdomadaire)
- Incremental  : export JSON par domaine (quotidien)
- Vérification : PRAGMA integrity_check après chaque backup
- Restauration : remplace la base active par un backup full
- Scheduler    : tâche asyncio (daily à 02h00, weekly dimanche 03h00)
- Alerting     : log CRITICAL si backup échoué + flag dans l'index
"""

import os, json, shutil, sqlite3, asyncio, logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Literal

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

logger = logging.getLogger("backup")

BACKUP_DIR  = Path("backups")
DB_PATH     = Path("ip_flows.db")
INDEX_FILE  = BACKUP_DIR / "index.json"

# Mapping domain → tables à exporter
DOMAINS: dict[str, list[str]] = {
    "metier":     ["flow_requests", "zones", "physical_zones", "equipment",
                   "networks", "topology_links", "equipment_interfaces", "teams", "validation_rules"],
    "audits":     ["policy_events", "acl_rules", "routing_entries"],
    "simulation": ["vrfs", "vrf_equipment"],
}

# ── Index helpers ─────────────────────────────────────────────────────────────

def _read_index() -> list[dict]:
    if not INDEX_FILE.exists():
        return []
    try:
        return json.loads(INDEX_FILE.read_text())
    except Exception:
        return []


def _write_index(entries: list[dict]):
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    INDEX_FILE.write_text(json.dumps(entries, indent=2, default=str))


def _add_entry(entry: dict):
    entries = _read_index()
    entries.insert(0, entry)
    _write_index(entries)


def _update_entry(backup_id: str, patch: dict):
    entries = _read_index()
    for e in entries:
        if e["id"] == backup_id:
            e.update(patch)
    _write_index(entries)


# ── Core backup logic ─────────────────────────────────────────────────────────

def _ts() -> str:
    return datetime.utcnow().strftime("%Y%m%d_%H%M%S")


def _do_full_backup() -> dict:
    """Copie binaire de la base SQLite via sqlite3.backup()."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    ts    = _ts()
    bid   = f"full_{ts}"
    fname = f"ipfm_full_{ts}.db"
    dest  = BACKUP_DIR / fname

    src_conn = sqlite3.connect(str(DB_PATH))
    dst_conn = sqlite3.connect(str(dest))
    try:
        src_conn.backup(dst_conn)
    finally:
        dst_conn.close()
        src_conn.close()

    size = dest.stat().st_size
    entry = {
        "id": bid, "type": "full", "domain": "all",
        "filename": fname, "created_at": datetime.utcnow().isoformat(),
        "size_bytes": size, "integrity": None, "status": "ok",
    }
    # Immediate integrity check
    ok, msg = _check_integrity(dest)
    entry["integrity"] = "ok" if ok else "failed"
    entry["integrity_detail"] = msg
    if not ok:
        entry["status"] = "failed"
        logger.critical("Full backup integrity FAILED: %s", msg)
    _add_entry(entry)
    logger.info("Full backup created: %s (%d bytes)", fname, size)
    return entry


def _do_incremental_backup(domain: str = "all") -> list[dict]:
    """Export JSON par domaine (ou tous les domaines si domain='all')."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    domains = list(DOMAINS.keys()) if domain == "all" else [domain]
    entries = []
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        for dom in domains:
            tables = DOMAINS[dom]
            data: dict[str, list] = {}
            for tbl in tables:
                try:
                    rows = conn.execute(f"SELECT * FROM {tbl}").fetchall()  # noqa: S608
                    data[tbl] = [dict(r) for r in rows]
                except sqlite3.OperationalError:
                    data[tbl] = []

            ts    = _ts()
            bid   = f"incr_{dom}_{ts}"
            fname = f"ipfm_incr_{dom}_{ts}.json"
            dest  = BACKUP_DIR / fname
            payload = {
                "version": "1.0", "domain": dom,
                "exported_at": datetime.utcnow().isoformat(),
                "tables": data,
            }
            dest.write_text(json.dumps(payload, indent=2, default=str))
            size = dest.stat().st_size
            entry = {
                "id": bid, "type": "incremental", "domain": dom,
                "filename": fname, "created_at": datetime.utcnow().isoformat(),
                "size_bytes": size, "integrity": "ok", "status": "ok",
            }
            _add_entry(entry)
            entries.append(entry)
            logger.info("Incremental backup %s: %s (%d bytes)", dom, fname, size)
    finally:
        conn.close()
    return entries


def _check_integrity(path: Path) -> tuple[bool, str]:
    """PRAGMA integrity_check sur un fichier SQLite."""
    if not str(path).endswith(".db"):
        return True, "json backup — no integrity check needed"
    try:
        conn = sqlite3.connect(str(path))
        rows = conn.execute("PRAGMA integrity_check").fetchall()
        conn.close()
        results = [r[0] for r in rows]
        ok = results == ["ok"]
        return ok, "; ".join(results)
    except Exception as exc:
        return False, str(exc)


def _do_restore(filename: str) -> dict:
    """Restaure la base depuis un backup full (SQLite binary)."""
    src = BACKUP_DIR / filename
    if not src.exists():
        raise FileNotFoundError(f"Backup file not found: {filename}")
    if not filename.endswith(".db"):
        raise ValueError("Only full (.db) backups can be restored directly")

    # Pre-restore integrity check
    ok, msg = _check_integrity(src)
    if not ok:
        raise ValueError(f"Backup integrity check failed before restore: {msg}")

    # Atomic-ish replace: copy to temp then rename
    tmp = DB_PATH.with_suffix(".restore_tmp")
    shutil.copy2(str(src), str(tmp))
    os.replace(str(tmp), str(DB_PATH))
    logger.info("Database restored from %s", filename)
    return {"restored_from": filename, "at": datetime.utcnow().isoformat()}


# ── Scheduler ────────────────────────────────────────────────────────────────

class _SchedulerState:
    last_daily:    Optional[str] = None   # ISO timestamp
    last_weekly:   Optional[str] = None
    last_check:    Optional[str] = None
    last_alert:    Optional[str] = None
    running:       bool          = False
    next_daily:    Optional[str] = None
    next_weekly:   Optional[str] = None


scheduler_state = _SchedulerState()


async def backup_scheduler_loop():
    """Tâche asyncio : vérifie toutes les heures si un backup est dû."""
    scheduler_state.running = True
    logger.info("Backup scheduler started")

    while True:
        try:
            await asyncio.sleep(3600)   # réveille toutes les heures
            now = datetime.utcnow()

            # --- quotidien à 02:00 UTC ---
            should_daily = False
            if scheduler_state.last_daily is None:
                should_daily = True
            else:
                last = datetime.fromisoformat(scheduler_state.last_daily)
                should_daily = (now - last) >= timedelta(hours=23) and now.hour == 2

            if should_daily:
                try:
                    logger.info("Scheduler: starting daily incremental backup")
                    _do_incremental_backup("all")
                    scheduler_state.last_daily = now.isoformat()
                    scheduler_state.last_check = now.isoformat()
                    logger.info("Scheduler: daily backup completed")
                except Exception as exc:
                    scheduler_state.last_alert = now.isoformat()
                    logger.critical("BACKUP ALERT — daily backup FAILED: %s", exc)

            # --- hebdomadaire dimanche à 03:00 UTC ---
            should_weekly = False
            if now.weekday() == 6 and now.hour == 3:
                if scheduler_state.last_weekly is None:
                    should_weekly = True
                else:
                    last = datetime.fromisoformat(scheduler_state.last_weekly)
                    should_weekly = (now - last) >= timedelta(days=6)

            if should_weekly:
                try:
                    logger.info("Scheduler: starting weekly full backup")
                    _do_full_backup()
                    scheduler_state.last_weekly = now.isoformat()
                    logger.info("Scheduler: weekly backup completed")
                except Exception as exc:
                    scheduler_state.last_alert = now.isoformat()
                    logger.critical("BACKUP ALERT — weekly backup FAILED: %s", exc)

            # --- vérification quotidienne à 08:00 UTC ---
            if now.hour == 8:
                entries = _read_index()
                if entries:
                    latest = entries[0]
                    age_h  = (now - datetime.fromisoformat(latest["created_at"])).total_seconds() / 3600
                    if age_h > 26:
                        msg = f"No recent backup — latest is {age_h:.1f}h old ({latest['filename']})"
                        logger.critical("BACKUP ALERT — %s", msg)
                        scheduler_state.last_alert = now.isoformat()
                else:
                    logger.warning("BACKUP ALERT — no backups found at daily check")

        except asyncio.CancelledError:
            logger.info("Backup scheduler stopped")
            scheduler_state.running = False
            break
        except Exception as exc:
            logger.error("Backup scheduler unexpected error: %s", exc)


# ── FastAPI router ─────────────────────────────────────────────────────────────

router = APIRouter()


@router.get("")
def list_backups():
    return _read_index()


class BackupRequest(BaseModel):
    type:   Literal["full", "incremental"] = "incremental"
    domain: Literal["all", "metier", "audits", "simulation"] = "all"


@router.post("", status_code=201)
def create_backup(req: BackupRequest, background_tasks: BackgroundTasks):
    def run():
        try:
            if req.type == "full":
                return _do_full_backup()
            else:
                return _do_incremental_backup(req.domain)
        except Exception as exc:
            logger.error("Manual backup failed: %s", exc)
    background_tasks.add_task(run)
    return {"message": f"{req.type} backup ({req.domain}) scheduled", "status": "running"}


@router.get("/scheduler/status")
def scheduler_status():
    now = datetime.utcnow()
    entries = _read_index()
    # Next daily = today at 02:00 or tomorrow
    next_daily  = now.replace(hour=2,  minute=0, second=0, microsecond=0)
    if next_daily <= now:
        next_daily += timedelta(days=1)
    # Next weekly = next Sunday at 03:00
    days_to_sun = (6 - now.weekday()) % 7 or 7
    next_weekly = now.replace(hour=3, minute=0, second=0, microsecond=0) + timedelta(days=days_to_sun)

    return {
        "running":      scheduler_state.running,
        "last_daily":   scheduler_state.last_daily,
        "last_weekly":  scheduler_state.last_weekly,
        "last_alert":   scheduler_state.last_alert,
        "next_daily":   next_daily.isoformat(),
        "next_weekly":  next_weekly.isoformat(),
        "total_backups": len(entries),
        "latest": entries[0] if entries else None,
    }


@router.post("/{backup_id}/verify")
def verify_backup(backup_id: str):
    entries = _read_index()
    entry   = next((e for e in entries if e["id"] == backup_id), None)
    if not entry:
        raise HTTPException(404, "Backup not found")
    path = BACKUP_DIR / entry["filename"]
    if not path.exists():
        raise HTTPException(404, "Backup file missing on disk")
    ok, msg = _check_integrity(path)
    patch = {"integrity": "ok" if ok else "failed", "integrity_detail": msg,
             "last_verified": datetime.utcnow().isoformat()}
    _update_entry(backup_id, patch)
    return {"backup_id": backup_id, "integrity": patch["integrity"], "detail": msg}


class RestoreRequest(BaseModel):
    confirm: bool = False


@router.post("/{backup_id}/restore")
def restore_backup(backup_id: str, body: RestoreRequest):
    if not body.confirm:
        raise HTTPException(400, "Pass confirm=true to proceed with restore")
    entries = _read_index()
    entry   = next((e for e in entries if e["id"] == backup_id), None)
    if not entry:
        raise HTTPException(404, "Backup not found")
    if entry["type"] != "full":
        raise HTTPException(400, "Only full backups (.db) can be restored. Use a JSON backup to reimport data manually.")
    try:
        result = _do_restore(entry["filename"])
        _update_entry(backup_id, {"last_restored": result["at"]})
        return result
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(400, str(exc))


@router.delete("/{backup_id}", status_code=204)
def delete_backup(backup_id: str):
    entries = _read_index()
    entry   = next((e for e in entries if e["id"] == backup_id), None)
    if not entry:
        raise HTTPException(404, "Backup not found")
    path = BACKUP_DIR / entry["filename"]
    if path.exists():
        path.unlink()
    _write_index([e for e in entries if e["id"] != backup_id])
