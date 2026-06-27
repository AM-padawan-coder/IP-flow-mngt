import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database import get_db
from models import Equipment, RoutingEntry, AclRule, FlowRequest

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class RouteIn(BaseModel):
    equipment_id: int
    destination: str
    gateway: Optional[str] = None
    interface: Optional[str] = None
    metric: int = 1
    route_type: str = "static"
    comment: Optional[str] = None


class AclIn(BaseModel):
    equipment_id: int
    priority: int = 100
    name: Optional[str] = None
    direction: str = "in"
    action: str = "permit"
    src_ip: str = "any"
    dst_ip: str = "any"
    port: str = "any"
    protocol: str = "any"
    comment: Optional[str] = None
    flow_id: Optional[int] = None


# ── Routing ───────────────────────────────────────────────────────────────────

def _route_out(r: RoutingEntry) -> dict:
    return {
        "id": r.id, "equipment_id": r.equipment_id,
        "destination": r.destination, "gateway": r.gateway,
        "interface": r.interface, "metric": r.metric,
        "route_type": r.route_type, "comment": r.comment,
        "created_at": r.created_at.isoformat(),
    }


@router.get("/routing")
def list_routing(equipment_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(RoutingEntry)
    if equipment_id:
        q = q.filter(RoutingEntry.equipment_id == equipment_id)
    return [_route_out(r) for r in q.order_by(RoutingEntry.equipment_id, RoutingEntry.metric).all()]


@router.post("/routing", status_code=201)
def create_route(data: RouteIn, db: Session = Depends(get_db)):
    eq = db.query(Equipment).filter(Equipment.id == data.equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Équipement non trouvé")
    entry = RoutingEntry(**data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _route_out(entry)


@router.put("/routing/{entry_id}")
def update_route(entry_id: int, data: RouteIn, db: Session = Depends(get_db)):
    entry = db.query(RoutingEntry).filter(RoutingEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entrée non trouvée")
    for k, v in data.model_dump().items():
        setattr(entry, k, v)
    db.commit()
    db.refresh(entry)
    return _route_out(entry)


@router.delete("/routing/{entry_id}", status_code=204)
def delete_route(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(RoutingEntry).filter(RoutingEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entrée non trouvée")
    db.delete(entry)
    db.commit()


# ── ACL ───────────────────────────────────────────────────────────────────────

def _acl_out(r: AclRule) -> dict:
    return {
        "id": r.id, "equipment_id": r.equipment_id, "priority": r.priority,
        "name": r.name, "direction": r.direction, "action": r.action,
        "src_ip": r.src_ip, "dst_ip": r.dst_ip, "port": r.port,
        "protocol": r.protocol, "comment": r.comment, "flow_id": r.flow_id,
        "created_at": r.created_at.isoformat(),
    }


@router.get("/acl")
def list_acl(equipment_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(AclRule)
    if equipment_id:
        q = q.filter(AclRule.equipment_id == equipment_id)
    return [_acl_out(r) for r in q.order_by(AclRule.equipment_id, AclRule.priority).all()]


@router.post("/acl", status_code=201)
def create_acl(data: AclIn, db: Session = Depends(get_db)):
    eq = db.query(Equipment).filter(Equipment.id == data.equipment_id).first()
    if not eq:
        raise HTTPException(status_code=404, detail="Équipement non trouvé")
    rule = AclRule(**data.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _acl_out(rule)


@router.put("/acl/{rule_id}")
def update_acl(rule_id: int, data: AclIn, db: Session = Depends(get_db)):
    rule = db.query(AclRule).filter(AclRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Règle non trouvée")
    for k, v in data.model_dump().items():
        setattr(rule, k, v)
    db.commit()
    db.refresh(rule)
    return _acl_out(rule)


@router.delete("/acl/{rule_id}", status_code=204)
def delete_acl(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(AclRule).filter(AclRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Règle non trouvée")
    db.delete(rule)
    db.commit()


# ── Generate from flow ────────────────────────────────────────────────────────

@router.post("/generate-from-flow/{flow_id}")
def generate_from_flow(flow_id: int, db: Session = Depends(get_db)):
    """Auto-génère des règles ACL pour chaque équipement sur le chemin du flux."""
    flow = db.query(FlowRequest).filter(FlowRequest.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flux non trouvé")

    path = json.loads(flow.path_result or "{}")
    hops = path.get("hops", [])
    if not hops:
        raise HTTPException(status_code=400, detail="Ce flux n'a pas de chemin calculé")

    created = []
    priority_base = 100

    for hop in hops:
        eq_name = hop.get("equipment") or hop.get("name") or str(hop)
        eq = db.query(Equipment).filter(Equipment.name == eq_name).first()
        if not eq:
            continue

        # Check if rule already exists for this flow + equipment
        exists = db.query(AclRule).filter(
            AclRule.equipment_id == eq.id,
            AclRule.flow_id == flow_id
        ).first()
        if exists:
            continue

        rule = AclRule(
            equipment_id=eq.id,
            priority=priority_base,
            name=f"flux-{flow_id}-{eq_name}",
            direction="in",
            action="permit",
            src_ip=flow.src_ip,
            dst_ip=flow.dst_ip,
            port=flow.port,
            protocol=flow.protocol,
            comment=f"Généré depuis flux #{flow_id} — {flow.application or ''}",
            flow_id=flow_id,
        )
        db.add(rule)
        created.append(eq_name)
        priority_base += 10

    db.commit()
    return {
        "generated": len(created),
        "equipment": created,
        "flow_id": flow_id,
        "src_ip": flow.src_ip,
        "dst_ip": flow.dst_ip,
        "port": flow.port,
        "protocol": flow.protocol,
    }


@router.get("/equipment")
def list_equipment_for_policies(db: Session = Depends(get_db)):
    equip = db.query(Equipment).filter(Equipment.active == True).order_by(Equipment.name).all()
    return [{"id": e.id, "name": e.name, "type": e.type, "vendor": e.vendor} for e in equip]
