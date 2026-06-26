from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import Team, PhysicalZone, Equipment

router = APIRouter()


class TeamIn(BaseModel):
    name: str
    description: str = ""
    contact: str = ""
    color: str = "#3b82f6"


class PhysicalZoneIn(BaseModel):
    name: str
    type: str = "datacenter"
    parent_id: Optional[int] = None
    description: str = ""
    location: str = ""


# ── Teams ──────────────────────────────────────────────────────────────────

@router.get("/teams")
def list_teams(db: Session = Depends(get_db)):
    teams = db.query(Team).all()
    result = []
    for t in teams:
        count = db.query(Equipment).filter(Equipment.team_id == t.id).count()
        result.append({
            "id": t.id, "name": t.name, "description": t.description,
            "contact": t.contact, "color": t.color, "equipment_count": count,
        })
    return result


@router.post("/teams", status_code=201)
def create_team(data: TeamIn, db: Session = Depends(get_db)):
    if db.query(Team).filter(Team.name == data.name).first():
        raise HTTPException(status_code=409, detail=f"Équipe '{data.name}' existe déjà")
    t = Team(**data.model_dump())
    db.add(t); db.commit(); db.refresh(t)
    return {"id": t.id, "name": t.name}


@router.put("/teams/{team_id}")
def update_team(team_id: int, data: TeamIn, db: Session = Depends(get_db)):
    t = db.query(Team).filter(Team.id == team_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Équipe non trouvée")
    for k, v in data.model_dump().items():
        setattr(t, k, v)
    db.commit()
    return {"id": t.id, "name": t.name}


@router.delete("/teams/{team_id}")
def delete_team(team_id: int, db: Session = Depends(get_db)):
    t = db.query(Team).filter(Team.id == team_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Équipe non trouvée")
    db.query(Equipment).filter(Equipment.team_id == team_id).update({"team_id": None})
    db.delete(t); db.commit()
    return {"ok": True}


# ── Physical Zones ─────────────────────────────────────────────────────────

@router.get("/physical-zones")
def list_physical_zones(db: Session = Depends(get_db)):
    pzones = db.query(PhysicalZone).all()
    result = []
    for pz in pzones:
        parent = db.query(PhysicalZone).filter(PhysicalZone.id == pz.parent_id).first() if pz.parent_id else None
        eqp_count = db.query(Equipment).filter(Equipment.physical_zone_id == pz.id).count()
        result.append({
            "id": pz.id, "name": pz.name, "type": pz.type,
            "parent_id": pz.parent_id, "parent_name": parent.name if parent else None,
            "description": pz.description, "location": pz.location,
            "equipment_count": eqp_count,
        })
    return result


@router.post("/physical-zones", status_code=201)
def create_physical_zone(data: PhysicalZoneIn, db: Session = Depends(get_db)):
    if db.query(PhysicalZone).filter(PhysicalZone.name == data.name).first():
        raise HTTPException(status_code=409, detail=f"Zone physique '{data.name}' existe déjà")
    pz = PhysicalZone(**data.model_dump())
    db.add(pz); db.commit(); db.refresh(pz)
    return {"id": pz.id, "name": pz.name}


@router.put("/physical-zones/{pz_id}")
def update_physical_zone(pz_id: int, data: PhysicalZoneIn, db: Session = Depends(get_db)):
    pz = db.query(PhysicalZone).filter(PhysicalZone.id == pz_id).first()
    if not pz:
        raise HTTPException(status_code=404, detail="Zone physique non trouvée")
    for k, v in data.model_dump().items():
        setattr(pz, k, v)
    db.commit()
    return {"id": pz.id, "name": pz.name}


@router.delete("/physical-zones/{pz_id}")
def delete_physical_zone(pz_id: int, db: Session = Depends(get_db)):
    pz = db.query(PhysicalZone).filter(PhysicalZone.id == pz_id).first()
    if not pz:
        raise HTTPException(status_code=404, detail="Zone physique non trouvée")
    db.query(Equipment).filter(Equipment.physical_zone_id == pz_id).update({"physical_zone_id": None})
    db.delete(pz); db.commit()
    return {"ok": True}
