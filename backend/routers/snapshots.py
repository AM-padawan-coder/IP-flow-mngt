"""Router versioning — snapshots, diff, branches."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import (
    Snapshot, AppSetting,
    Zone, Equipment, Network, TopologyLink,
    FlowRequest, Application, AclRule, RoutingEntry, VRF,
)
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import json

router = APIRouter()

_SETTING_MAX = "snapshot_max_count"
_DEFAULT_MAX  = 20

# ── Pydantic ─────────────────────────────────────────────────────────────────

class SnapshotCreate(BaseModel):
    label: str
    description: Optional[str] = ""
    environment: Optional[str] = "Production"
    version_tag: Optional[str] = ""
    featured_flow_ids: Optional[List[int]] = []

class BranchCreate(BaseModel):
    branch_name: str
    description: Optional[str] = ""

class SettingsUpdate(BaseModel):
    max_count: int

# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_max(db: Session) -> int:
    s = db.query(AppSetting).filter_by(key=_SETTING_MAX).first()
    return int(s.value) if s else _DEFAULT_MAX

def _set_max(db: Session, v: int):
    s = db.query(AppSetting).filter_by(key=_SETTING_MAX).first()
    if s:
        s.value = str(v)
    else:
        db.add(AppSetting(key=_SETTING_MAX, value=str(v)))
    db.commit()

def _serialize(items, fields: list) -> list:
    result = []
    for item in items:
        row = {}
        for f in fields:
            v = getattr(item, f, None)
            if isinstance(v, datetime):
                v = v.isoformat()
            row[f] = v
        result.append(row)
    return result

def _capture_state(db: Session):
    state = {
        "zones":        _serialize(db.query(Zone).all(),          ["id","name","color","trust_level","zone_type"]),
        "equipment":    _serialize(db.query(Equipment).all(),     ["id","name","type","vendor","management_ip","active"]),
        "networks":     _serialize(db.query(Network).all(),       ["id","name","cidr","zone_id","vlan_id"]),
        "links":        _serialize(db.query(TopologyLink).all(),  ["id","equipment_a_id","equipment_b_id","link_type"]),
        "flows":        _serialize(db.query(FlowRequest).all(),   ["id","src_ip","dst_ip","port","protocol","status","application","analyst"]),
        "vrfs":         _serialize(db.query(VRF).all(),           ["id","name","rd","color"]),
        "applications": _serialize(db.query(Application).all(),   ["id","name","code","app_type","domain","criticality","environment"]),
        "acl_rules":    _serialize(db.query(AclRule).all(),       ["id","equipment_id","action","src_ip","dst_ip","port","protocol"]),
        "routes":       _serialize(db.query(RoutingEntry).all(),  ["id","equipment_id","destination","gateway","route_type"]),
    }
    counts = {
        "applications": db.query(Application).count(),
        "flows":        db.query(FlowRequest).count(),
        "equipment":    db.query(Equipment).count(),
        "policies":     db.query(AclRule).count(),
        "routes":       db.query(RoutingEntry).count(),
    }
    return state, counts

def _live_counts(db: Session) -> dict:
    return {
        "applications": db.query(Application).count(),
        "flows":        db.query(FlowRequest).count(),
        "equipment":    db.query(Equipment).count(),
        "policies":     db.query(AclRule).count(),
        "routes":       db.query(RoutingEntry).count(),
    }

def _diff_states(before: dict, after: dict) -> dict:
    result = {}
    for etype in set(list(before.keys()) + list(after.keys())):
        b = {str(item["id"]): item for item in before.get(etype, [])}
        a = {str(item["id"]): item for item in after.get(etype, [])}
        added    = [a[k] for k in a if k not in b]
        deleted  = [b[k] for k in b if k not in a]
        modified = [{"before": b[k], "after": a[k]} for k in a if k in b and b[k] != a[k]]
        result[etype] = {
            "added": added, "deleted": deleted, "modified": modified,
            "counts": {"added": len(added), "deleted": len(deleted), "modified": len(modified)},
        }
    return result

def _delta(before: dict, after: dict) -> dict:
    keys = set(list(before.keys()) + list(after.keys()))
    return {k: after.get(k, 0) - before.get(k, 0) for k in keys}

def _to_summary(snap: Snapshot, prev_counts: Optional[dict] = None) -> dict:
    counts = json.loads(snap.counts or "{}")
    deltas = _delta(prev_counts, counts) if prev_counts is not None else None
    return {
        "id":               snap.id,
        "label":            snap.label,
        "description":      snap.description or "",
        "created_by":       snap.created_by or "admin",
        "created_at":       snap.created_at.isoformat() if snap.created_at else None,
        "environment":      snap.environment or "Production",
        "version_tag":      snap.version_tag or "",
        "branch_from":      snap.branch_from,
        "branch_name":      snap.branch_name,
        "branch_status":    snap.branch_status or "active",
        "snapshot_type":    snap.snapshot_type or "manual",
        "counts":           counts,
        "deltas":           deltas,
        "featured_flow_ids": json.loads(snap.featured_flow_ids or "[]"),
    }

def _enforce_max(db: Session):
    """Supprime les plus anciens snapshots non-branche si le plafond est atteint."""
    max_count = _get_max(db)
    non_branches = (
        db.query(Snapshot)
        .filter(Snapshot.branch_from == None)
        .order_by(Snapshot.created_at.asc())
        .all()
    )
    while len(non_branches) >= max_count:
        db.delete(non_branches.pop(0))
    db.commit()

# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    return {"max_count": _get_max(db)}

@router.put("/settings")
def put_settings(data: SettingsUpdate, db: Session = Depends(get_db)):
    if not (1 <= data.max_count <= 200):
        raise HTTPException(400, "max_count doit être entre 1 et 200")
    _set_max(db, data.max_count)
    return {"max_count": data.max_count}

@router.get("/live-counts")
def live_counts(db: Session = Depends(get_db)):
    return _live_counts(db)

@router.get("")
def list_snapshots(db: Session = Depends(get_db)):
    snaps = db.query(Snapshot).order_by(Snapshot.created_at.asc()).all()
    result = []
    prev_counts: Optional[dict] = None
    for snap in snaps:
        summary = _to_summary(snap, prev_counts if not snap.branch_from else None)
        result.append(summary)
        if not snap.branch_from:
            prev_counts = json.loads(snap.counts or "{}")
    return result

@router.post("", status_code=201)
def create_snapshot(data: SnapshotCreate, db: Session = Depends(get_db)):
    _enforce_max(db)
    state, counts = _capture_state(db)
    snap = Snapshot(
        label=data.label,
        description=data.description or "",
        environment=data.environment or "Production",
        version_tag=data.version_tag or "",
        snapshot_type="manual",
        data=json.dumps(state),
        counts=json.dumps(counts),
        featured_flow_ids=json.dumps(data.featured_flow_ids or []),
        created_at=datetime.utcnow(),
    )
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return _to_summary(snap)

@router.get("/{snap_id}")
def get_snapshot(snap_id: int, db: Session = Depends(get_db)):
    snap = db.query(Snapshot).filter(Snapshot.id == snap_id).first()
    if not snap:
        raise HTTPException(404, "Snapshot introuvable")
    summary = _to_summary(snap)
    summary["data"] = json.loads(snap.data or "{}")
    return summary

@router.delete("/{snap_id}", status_code=204)
def delete_snapshot(snap_id: int, db: Session = Depends(get_db)):
    snap = db.query(Snapshot).filter(Snapshot.id == snap_id).first()
    if not snap:
        raise HTTPException(404, "Snapshot introuvable")
    db.delete(snap)
    db.commit()

@router.get("/{snap_id}/diff/current")
def diff_with_current(snap_id: int, db: Session = Depends(get_db)):
    snap = db.query(Snapshot).filter(Snapshot.id == snap_id).first()
    if not snap:
        raise HTTPException(404, "Snapshot introuvable")
    before = json.loads(snap.data or "{}")
    after, _ = _capture_state(db)
    return _diff_states(before, after)

@router.get("/{snap_id}/diff/{other_id}")
def diff_two_snapshots(snap_id: int, other_id: int, db: Session = Depends(get_db)):
    a = db.query(Snapshot).filter(Snapshot.id == snap_id).first()
    b = db.query(Snapshot).filter(Snapshot.id == other_id).first()
    if not a or not b:
        raise HTTPException(404, "Snapshot introuvable")
    return _diff_states(json.loads(a.data or "{}"), json.loads(b.data or "{}"))

@router.post("/{snap_id}/branch", status_code=201)
def create_branch(snap_id: int, data: BranchCreate, db: Session = Depends(get_db)):
    parent = db.query(Snapshot).filter(Snapshot.id == snap_id).first()
    if not parent:
        raise HTTPException(404, "Snapshot introuvable")
    branch = Snapshot(
        label=data.branch_name,
        description=data.description or "",
        environment=parent.environment,
        branch_from=snap_id,
        branch_name=data.branch_name,
        branch_status="active",
        snapshot_type="branch",
        data=parent.data,
        counts=parent.counts,
        featured_flow_ids="[]",
        created_at=datetime.utcnow(),
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return _to_summary(branch)

@router.patch("/{snap_id}/branch-status")
def update_branch_status(snap_id: int, body: dict, db: Session = Depends(get_db)):
    snap = db.query(Snapshot).filter(Snapshot.id == snap_id).first()
    if not snap:
        raise HTTPException(404, "Snapshot introuvable")
    status = body.get("status", "active")
    if status not in ("active", "paused", "merged"):
        raise HTTPException(400, "Statut invalide : active | paused | merged")
    snap.branch_status = status
    db.commit()
    return _to_summary(snap)
