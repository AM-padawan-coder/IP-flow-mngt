"""Service d'audit centralisé — Logs & Traçabilité (v2.10).

Point d'entrée unique : `record_audit(db, ...)`. Toute action critique de
l'application appelle cette fonction pour produire une entrée immuable dans
`audit_logs`.

Immuabilité / tamper-evidence
-----------------------------
Chaque entrée porte un `integrity_hash` = sha256(champs canoniques + hash de
l'entrée précédente). Toute altération a posteriori d'une entrée casse la chaîne
et devient donc détectable. La signature cryptographique proprement dite est
réservée à la roadmap v3.6 (cf. `SignatureSink`).

Architecture de sinks (extensibilité v3 → v6)
---------------------------------------------
Après persistance locale, l'entrée est diffusée à tous les *sinks* activés.
Aujourd'hui seul le stockage local est actif ; les sinks suivants sont fournis
désactivés et servent de point d'extension :
  - SignatureSink         (v3.6) — signature cryptographique des journaux
  - SyslogSink            (v4)   — envoi Syslog
  - SiemSink              (v5)   — intégration SIEM (Splunk / Elastic / QRadar / Sentinel)
  - AnomalyDetectionSink  (v6)   — détection d'anomalies
"""
import hashlib
import json
import sys
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from models import AuditLog, AppSetting


# ── Catégorisation ──────────────────────────────────────────────────────────
CATEGORY_BY_OBJECT = {
    "FLOW": "Flow",
    "APPLICATION": "Application",
    "EQUIPMENT": "Administration",
    "ROUTE": "Route",
    "ACL": "Security",
    "ZONE": "Administration",
    "PHYSICAL_ZONE": "Administration",
    "NETWORK": "Administration",
    "ENVIRONMENT": "Administration",
    "VRF": "Administration",
    "TEAM": "Administration",
    "LINK": "Administration",
    "INTERFACE": "Administration",
    "BACKUP": "Administration",
    "TOPOLOGY": "Import",
    "SIMULATION": "Simulation",
    "USER": "User Management",
    "LOGS": "Export",
}

ACTIONS = ["CREATE", "UPDATE", "VALIDATE", "DELETE", "IMPORT", "EXPORT"]
CATEGORIES = [
    "Security", "Administration", "Flow", "Route", "Application",
    "Import", "Export", "Simulation", "Validation", "User Management",
]

# Durées de conservation proposées (jours). 0 = illimité.
RETENTION_OPTIONS = [30, 90, 120, 180, 365, 0]
RETENTION_KEY = "audit_retention_days"
DEFAULT_RETENTION = 90


def _resolve_category(action: str, object_type: str, explicit: Optional[str]) -> str:
    if explicit:
        return explicit
    if action == "IMPORT":
        return "Import"
    if action == "EXPORT":
        return "Export"
    if action == "VALIDATE":
        return "Validation"
    return CATEGORY_BY_OBJECT.get(object_type, "Administration")


def _last_hash(db: Session) -> str:
    last = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
    return (last.integrity_hash if last and last.integrity_hash else "") if last else ""


def _compute_hash(entry: dict, prev_hash: str) -> str:
    canonical = json.dumps(entry, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256((prev_hash + canonical).encode("utf-8")).hexdigest()


# ── Sinks (extensibilité) ───────────────────────────────────────────────────
class AuditSink:
    name = "base"
    label = "Base"
    roadmap = ""
    enabled = False

    def handle(self, entry: dict) -> None:  # pragma: no cover - placeholder
        pass


class SignatureSink(AuditSink):
    name = "crypto_signature"
    label = "Signature cryptographique"
    roadmap = "v3.6"
    enabled = False


class SyslogSink(AuditSink):
    name = "syslog"
    label = "Envoi Syslog"
    roadmap = "v4"
    enabled = False


class SiemSink(AuditSink):
    name = "siem"
    label = "Intégration SIEM (Splunk / Elastic / QRadar / Sentinel)"
    roadmap = "v5"
    enabled = False


class AnomalyDetectionSink(AuditSink):
    name = "anomaly_detection"
    label = "Détection d'anomalies"
    roadmap = "v6"
    enabled = False


AUDIT_SINKS = [SignatureSink(), SyslogSink(), SiemSink(), AnomalyDetectionSink()]


def sinks_status() -> list:
    """Expose l'état des intégrations (pour l'UI « Intégrations à venir »)."""
    return [
        {"name": s.name, "label": s.label, "roadmap": s.roadmap, "enabled": s.enabled}
        for s in AUDIT_SINKS
    ]


# ── Cœur ────────────────────────────────────────────────────────────────────
def record_audit(
    db: Session,
    *,
    action: str,
    object_type: str,
    object_id=None,
    object_name: Optional[str] = None,
    status: str = "SUCCESS",
    details: Optional[dict] = None,
    before: Optional[dict] = None,
    after: Optional[dict] = None,
    user_id: str = "admin",
    username: str = "admin",
    ip_address: Optional[str] = None,
    session_id: Optional[str] = None,
    source: str = "WEB_UI",
    category: Optional[str] = None,
    environment: Optional[str] = None,
    application: Optional[str] = None,
) -> Optional[AuditLog]:
    """Enregistre une entrée d'audit. Défensif : n'interrompt jamais l'appelant.

    À appeler **après** le commit de l'opération métier ; cette fonction réalise
    son propre commit. En cas d'échec, l'opération métier reste persistée."""
    try:
        cat = _resolve_category(action, object_type, category)
        ts = datetime.utcnow()
        core = {
            "timestamp": ts.isoformat(),
            "user_id": user_id,
            "action": action,
            "object_type": object_type,
            "object_id": str(object_id) if object_id is not None else None,
            "object_name": object_name,
            "status": status,
            "details": details,
            "before": before,
            "after": after,
        }
        prev = _last_hash(db)
        integrity = _compute_hash(core, prev)

        log = AuditLog(
            timestamp=ts,
            user_id=user_id,
            username=username,
            action=action,
            object_type=object_type,
            object_id=str(object_id) if object_id is not None else None,
            object_name=object_name,
            category=cat,
            status=status,
            details=json.dumps(details, ensure_ascii=False) if details is not None else None,
            before_state=json.dumps(before, ensure_ascii=False) if before is not None else None,
            after_state=json.dumps(after, ensure_ascii=False) if after is not None else None,
            ip_address=ip_address,
            session_id=session_id,
            source=source,
            environment=environment,
            application=application,
            integrity_hash=integrity,
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        # Diffusion aux sinks externes (tous désactivés à ce jour)
        for sink in AUDIT_SINKS:
            if sink.enabled:
                try:
                    sink.handle(core)
                except Exception as exc:  # pragma: no cover
                    print(f"[audit] sink {sink.name} a échoué: {exc}", file=sys.stderr)

        return log
    except Exception as exc:  # pragma: no cover - l'audit ne doit jamais casser l'appelant
        print(f"[audit] record_audit a échoué: {exc}", file=sys.stderr)
        try:
            db.rollback()
        except Exception:
            pass
        return None


def client_ip(request) -> Optional[str]:
    """Extrait l'IP source d'une requête FastAPI (X-Forwarded-For prioritaire)."""
    if request is None:
        return None
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None


# ── Rétention ───────────────────────────────────────────────────────────────
def get_retention_days(db: Session) -> int:
    s = db.query(AppSetting).filter(AppSetting.key == RETENTION_KEY).first()
    if not s or s.value is None:
        return DEFAULT_RETENTION
    try:
        return int(s.value)
    except (TypeError, ValueError):
        return DEFAULT_RETENTION


def set_retention_days(db: Session, days: int) -> int:
    if days not in RETENTION_OPTIONS:
        days = DEFAULT_RETENTION
    s = db.query(AppSetting).filter(AppSetting.key == RETENTION_KEY).first()
    if s:
        s.value = str(days)
    else:
        db.add(AppSetting(key=RETENTION_KEY, value=str(days)))
    db.commit()
    purge_old_logs(db)
    return days


def purge_old_logs(db: Session) -> int:
    """Supprime les entrées au-delà de la fenêtre de rétention. 0 = illimité."""
    days = get_retention_days(db)
    if days <= 0:
        return 0
    cutoff = datetime.utcnow() - timedelta(days=days)
    deleted = db.query(AuditLog).filter(AuditLog.timestamp < cutoff).delete(synchronize_session=False)
    db.commit()
    return deleted
