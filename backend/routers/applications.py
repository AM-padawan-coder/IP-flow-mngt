"""Router Applications — v2.9"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from database import SessionLocal
from models import Application, ApplicationIP, Team

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────
class IPIn(BaseModel):
    ip_address: str
    zone_id: Optional[int] = None


class ApplicationIn(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    app_type: str = "Web"
    domain: str = "Production"
    criticality: str = "Moyenne"
    environment: str = "PROD"
    team_id: Optional[int] = None
    ips: List[IPIn] = []


# ── Helpers ───────────────────────────────────────────────────────────────────
def _serialize(app: Application, team_name: Optional[str]) -> dict:
    return {
        "id": app.id,
        "name": app.name,
        "code": app.code,
        "description": app.description,
        "app_type": app.app_type,
        "domain": app.domain,
        "criticality": app.criticality,
        "environment": app.environment,
        "team_id": app.team_id,
        "team_name": team_name,
        "created_at": app.created_at.isoformat() if app.created_at else None,
        "ips": [{"id": ip.id, "ip_address": ip.ip_address, "zone_id": ip.zone_id} for ip in app.ips],
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.get("")
def list_applications():
    db = SessionLocal()
    try:
        apps = db.query(Application).order_by(Application.name).all()
        teams = {t.id: t.name for t in db.query(Team).all()}
        return [_serialize(a, teams.get(a.team_id)) for a in apps]
    finally:
        db.close()


@router.get("/{app_id}")
def get_application(app_id: int):
    db = SessionLocal()
    try:
        app = db.query(Application).filter(Application.id == app_id).first()
        if not app:
            raise HTTPException(status_code=404, detail="Application introuvable")
        teams = {t.id: t.name for t in db.query(Team).all()}
        return _serialize(app, teams.get(app.team_id))
    finally:
        db.close()


@router.post("")
def create_application(data: ApplicationIn):
    db = SessionLocal()
    try:
        app = Application(
            name=data.name, code=data.code, description=data.description,
            app_type=data.app_type, domain=data.domain, criticality=data.criticality,
            environment=data.environment, team_id=data.team_id,
        )
        db.add(app)
        db.flush()
        for ip_data in data.ips:
            db.add(ApplicationIP(application_id=app.id, ip_address=ip_data.ip_address, zone_id=ip_data.zone_id))
        db.commit()
        db.refresh(app)
        teams = {t.id: t.name for t in db.query(Team).all()}
        return _serialize(app, teams.get(app.team_id))
    finally:
        db.close()


@router.put("/{app_id}")
def update_application(app_id: int, data: ApplicationIn):
    db = SessionLocal()
    try:
        app = db.query(Application).filter(Application.id == app_id).first()
        if not app:
            raise HTTPException(status_code=404, detail="Application introuvable")
        app.name = data.name
        app.code = data.code
        app.description = data.description
        app.app_type = data.app_type
        app.domain = data.domain
        app.criticality = data.criticality
        app.environment = data.environment
        app.team_id = data.team_id
        # Replace IPs
        for ip in list(app.ips):
            db.delete(ip)
        db.flush()
        for ip_data in data.ips:
            db.add(ApplicationIP(application_id=app.id, ip_address=ip_data.ip_address, zone_id=ip_data.zone_id))
        db.commit()
        db.refresh(app)
        teams = {t.id: t.name for t in db.query(Team).all()}
        return _serialize(app, teams.get(app.team_id))
    finally:
        db.close()


@router.delete("/{app_id}")
def delete_application(app_id: int):
    db = SessionLocal()
    try:
        app = db.query(Application).filter(Application.id == app_id).first()
        if not app:
            raise HTTPException(status_code=404, detail="Application introuvable")
        db.delete(app)
        db.commit()
        return {"deleted": app_id}
    finally:
        db.close()


@router.post("/import")
def import_applications(data: List[ApplicationIn]):
    db = SessionLocal()
    try:
        created = 0
        for item in data:
            app = Application(
                name=item.name, code=item.code, description=item.description,
                app_type=item.app_type, domain=item.domain, criticality=item.criticality,
                environment=item.environment, team_id=item.team_id,
            )
            db.add(app)
            db.flush()
            for ip_data in item.ips:
                db.add(ApplicationIP(application_id=app.id, ip_address=ip_data.ip_address, zone_id=ip_data.zone_id))
            created += 1
        db.commit()
        return {"created": created}
    finally:
        db.close()
