"""Router Logs & Traçabilité (v2.10)."""
import csv
import io
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from models import AuditLog
import audit

router = APIRouter()


def _serialize(log: AuditLog, full: bool = False) -> dict:
    base = {
        "id": log.id,
        "log_ref": f"LOG-{log.id:06d}",
        "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        "user_id": log.user_id,
        "username": log.username,
        "action": log.action,
        "object_type": log.object_type,
        "object_id": log.object_id,
        "object_name": log.object_name,
        "category": log.category,
        "status": log.status,
        "source": log.source,
        "environment": log.environment,
        "application": log.application,
    }
    if full:
        base.update({
            "ip_address": log.ip_address,
            "session_id": log.session_id,
            "details": json.loads(log.details) if log.details else None,
            "before": json.loads(log.before_state) if log.before_state else None,
            "after": json.loads(log.after_state) if log.after_state else None,
            "integrity_hash": log.integrity_hash,
            "signature": log.signature,
        })
    return base


def _apply_filters(q, *, search, action, object_type, status, category, user,
                   environment, application, date_from, date_to):
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            AuditLog.object_id.ilike(like),
            AuditLog.object_name.ilike(like),
            AuditLog.username.ilike(like),
            AuditLog.user_id.ilike(like),
            AuditLog.action.ilike(like),
            AuditLog.object_type.ilike(like),
            AuditLog.category.ilike(like),
            AuditLog.application.ilike(like),
        ))
    if action:
        q = q.filter(AuditLog.action == action)
    if object_type:
        q = q.filter(AuditLog.object_type == object_type)
    if status:
        q = q.filter(AuditLog.status == status)
    if category:
        q = q.filter(AuditLog.category == category)
    if user:
        q = q.filter(or_(AuditLog.username == user, AuditLog.user_id == user))
    if environment:
        q = q.filter(AuditLog.environment == environment)
    if application:
        q = q.filter(AuditLog.application == application)
    if date_from:
        try:
            q = q.filter(AuditLog.timestamp >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            q = q.filter(AuditLog.timestamp <= datetime.fromisoformat(date_to))
        except ValueError:
            pass
    return q


@router.get("")
def list_logs(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    search: Optional[str] = None,
    action: Optional[str] = None,
    object_type: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    user: Optional[str] = None,
    environment: Optional[str] = None,
    application: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    q = _apply_filters(
        db.query(AuditLog), search=search, action=action, object_type=object_type,
        status=status, category=category, user=user, environment=environment,
        application=application, date_from=date_from, date_to=date_to,
    )
    total = q.count()
    items = (q.order_by(AuditLog.timestamp.desc(), AuditLog.id.desc())
             .offset((page - 1) * page_size).limit(page_size).all())
    pages = (total + page_size - 1) // page_size if page_size else 1
    return {
        "items": [_serialize(x) for x in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
    }


@router.get("/stats")
def logs_stats(db: Session = Depends(get_db)):
    """Compteurs pour les chips/filtres de l'UI + facettes disponibles."""
    all_logs = db.query(AuditLog).all()
    by_category, by_action, by_status, users, object_types = {}, {}, {}, set(), set()
    for l in all_logs:
        by_category[l.category] = by_category.get(l.category, 0) + 1
        by_action[l.action] = by_action.get(l.action, 0) + 1
        by_status[l.status] = by_status.get(l.status, 0) + 1
        if l.username:
            users.add(l.username)
        if l.object_type:
            object_types.add(l.object_type)
    return {
        "total": len(all_logs),
        "by_category": by_category,
        "by_action": by_action,
        "by_status": by_status,
        "users": sorted(users),
        "object_types": sorted(object_types),
        "actions": audit.ACTIONS,
        "categories": audit.CATEGORIES,
        "retention_days": audit.get_retention_days(db),
        "retention_options": audit.RETENTION_OPTIONS,
    }


@router.get("/sinks")
def list_sinks():
    """Intégrations d'export disponibles (roadmap v3.6 → v6, désactivées)."""
    return {"sinks": audit.sinks_status()}


class RetentionIn(BaseModel):
    days: int


@router.get("/retention")
def get_retention(db: Session = Depends(get_db)):
    return {"days": audit.get_retention_days(db), "options": audit.RETENTION_OPTIONS}


@router.put("/retention")
def update_retention(data: RetentionIn, db: Session = Depends(get_db)):
    days = audit.set_retention_days(db, data.days)
    return {"days": days}


@router.get("/export")
def export_logs(
    db: Session = Depends(get_db),
    format: str = Query("csv", pattern="^(csv|json)$"),
    search: Optional[str] = None,
    action: Optional[str] = None,
    object_type: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    user: Optional[str] = None,
    environment: Optional[str] = None,
    application: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    """Export horodaté des logs (filtres identiques à la liste).

    Renvoie `{filename, mime, content}` : le frontend construit le Blob.
    L'export est lui-même tracé (action EXPORT / objet LOGS)."""
    q = _apply_filters(
        db.query(AuditLog), search=search, action=action, object_type=object_type,
        status=status, category=category, user=user, environment=environment,
        application=application, date_from=date_from, date_to=date_to,
    )
    rows = q.order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).all()
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    if format == "json":
        content = json.dumps([_serialize(r, full=True) for r in rows], ensure_ascii=False, indent=1)
        filename = f"logs_{stamp}.json"
        mime = "application/json"
    else:
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["timestamp", "user", "action", "type", "object", "result", "category", "ip", "source"])
        for r in rows:
            writer.writerow([
                r.timestamp.isoformat() if r.timestamp else "",
                r.username or "", r.action or "", r.object_type or "",
                r.object_id or r.object_name or "", r.status or "",
                r.category or "", r.ip_address or "", r.source or "",
            ])
        content = buf.getvalue()
        filename = f"logs_{stamp}.csv"
        mime = "text/csv"

    audit.record_audit(
        db, action="EXPORT", object_type="LOGS",
        object_id=f"LOGSET-{stamp}", object_name=f"Export {format.upper()} ({len(rows)} entrées)",
        details={"format": format, "count": len(rows)}, source="WEB_UI",
    )
    return {"filename": filename, "mime": mime, "content": content, "count": len(rows)}


@router.get("/{log_id}")
def get_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Entrée de journal introuvable")
    return _serialize(log, full=True)
