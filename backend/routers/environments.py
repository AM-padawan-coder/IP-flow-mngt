from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import Environment
import audit

router = APIRouter()


class EnvironmentIn(BaseModel):
    name: str
    description: str = ''
    color: str = '#64748b'


@router.get("")
def list_environments(db: Session = Depends(get_db)):
    envs = db.query(Environment).all()
    return [{"id": e.id, "name": e.name, "description": e.description or '', "color": e.color or '#64748b'} for e in envs]


@router.get("/{env_id}")
def get_environment(env_id: int, db: Session = Depends(get_db)):
    e = db.query(Environment).filter(Environment.id == env_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Environnement non trouvé")
    return {"id": e.id, "name": e.name, "description": e.description or '', "color": e.color or '#64748b'}


@router.post("", status_code=201)
def create_environment(data: EnvironmentIn, db: Session = Depends(get_db)):
    e = Environment(**data.model_dump())
    db.add(e); db.commit(); db.refresh(e)
    audit.record_audit(db, action="CREATE", object_type="ENVIRONMENT",
                       object_id=f"ENV-{e.id}", object_name=e.name, environment=e.name,
                       after={"color": e.color, "description": e.description})
    return {"id": e.id, "name": e.name, "description": e.description or '', "color": e.color or '#64748b'}


@router.put("/{env_id}")
def update_environment(env_id: int, data: EnvironmentIn, db: Session = Depends(get_db)):
    e = db.query(Environment).filter(Environment.id == env_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Environnement non trouvé")
    before = {"name": e.name, "color": e.color, "description": e.description}
    for k, v in data.model_dump().items():
        setattr(e, k, v)
    db.commit()
    audit.record_audit(db, action="UPDATE", object_type="ENVIRONMENT",
                       object_id=f"ENV-{e.id}", object_name=e.name, environment=e.name,
                       before=before, after={"name": e.name, "color": e.color, "description": e.description})
    return {"id": e.id, "name": e.name, "description": e.description or '', "color": e.color or '#64748b'}


@router.delete("/{env_id}")
def delete_environment(env_id: int, db: Session = Depends(get_db)):
    e = db.query(Environment).filter(Environment.id == env_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Environnement non trouvé")
    name = e.name
    db.delete(e); db.commit()
    audit.record_audit(db, action="DELETE", object_type="ENVIRONMENT",
                       object_id=f"ENV-{env_id}", object_name=name, environment=name)
    return {"ok": True}
