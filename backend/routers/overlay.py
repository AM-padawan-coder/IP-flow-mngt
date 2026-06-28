"""Overlay endpoints: flows, routes et VRF pour le graphe réseau (v2.6)."""
import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models import FlowRequest, Equipment, EquipmentInterface, RoutingEntry, VRF, VRFEquipment

router = APIRouter()


# ── Flows overlay ─────────────────────────────────────────────────────────────

@router.get("/flows")
def get_overlay_flows(
    application: Optional[str] = None,
    protocol: Optional[str] = None,
    criticality: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(FlowRequest)
    if application:
        q = q.filter(FlowRequest.application.ilike(f"%{application}%"))
    if protocol:
        q = q.filter(FlowRequest.protocol == protocol)
    if criticality:
        q = q.filter(FlowRequest.criticality == criticality)
    if status:
        q = q.filter(FlowRequest.status == status)

    result = []
    for f in q.all():
        path: list = []
        if f.path_result:
            try:
                parsed = json.loads(f.path_result)
                path = [h["equipment"] for h in parsed.get("hops", []) if "equipment" in h]
            except Exception:
                pass
        result.append({
            "id": f.id,
            "name": f.application or f"Flux-{f.id}",
            "application": f.application or "",
            "protocol": f.protocol or "tcp",
            "src_ip": f.src_ip,
            "dst_ip": f.dst_ip,
            "port": str(f.port),
            "criticality": f.criticality,
            "sla": f.sla,
            "bandwidth_max": f.bandwidth_max,
            "vrf_name": f.vrf_name,
            "status": f.status,
            "path": path,
            "hop_count": len(path),
        })
    return result


# ── Routes overlay ────────────────────────────────────────────────────────────

@router.get("/routes")
def get_overlay_routes(
    prefix: Optional[str] = None,
    route_type: Optional[str] = None,
    equipment_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(RoutingEntry, Equipment).join(
        Equipment, RoutingEntry.equipment_id == Equipment.id
    )
    if prefix:
        q = q.filter(RoutingEntry.destination.ilike(f"%{prefix}%"))
    if route_type:
        q = q.filter(RoutingEntry.route_type == route_type)
    if equipment_id:
        q = q.filter(RoutingEntry.equipment_id == equipment_id)

    all_eq = db.query(Equipment).filter(Equipment.active == True).all()
    ip_to_name = {e.management_ip: e.name for e in all_eq if e.management_ip}
    # Also resolve gateways via equipment interface IPs (transit links, etc.)
    for iface, eq in db.query(EquipmentInterface, Equipment).join(Equipment, EquipmentInterface.equipment_id == Equipment.id).all():
        if iface.ip_address:
            ip_to_name.setdefault(iface.ip_address, eq.name)

    result = []
    for route, equip in q.limit(500).all():
        result.append({
            "id": route.id,
            "destination": route.destination,
            "gateway": route.gateway,
            "interface": route.interface,
            "metric": route.metric,
            "route_type": route.route_type,
            "equipment_name": equip.name,
            "gateway_equipment": ip_to_name.get(route.gateway or ""),
        })
    return result


# ── VRF overlay ───────────────────────────────────────────────────────────────

@router.get("/vrf")
def get_overlay_vrf(db: Session = Depends(get_db)):
    vrfs = db.query(VRF).all()
    result = []
    for v in vrfs:
        members = (
            db.query(VRFEquipment, Equipment)
            .join(Equipment, VRFEquipment.equipment_id == Equipment.id)
            .filter(VRFEquipment.vrf_id == v.id)
            .all()
        )
        result.append({
            "id": v.id,
            "name": v.name,
            "rd": v.rd,
            "rt_import": v.rt_import,
            "rt_export": v.rt_export,
            "description": v.description,
            "color": v.color,
            "equipment_names": [e.name for _, e in members],
            "equipment_count": len(members),
        })
    return result


class VRFCreate(BaseModel):
    name: str
    rd: Optional[str] = None
    rt_import: Optional[str] = None
    rt_export: Optional[str] = None
    description: Optional[str] = None
    color: str = "#3b82f6"


@router.post("/vrf")
def create_vrf(data: VRFCreate, db: Session = Depends(get_db)):
    v = VRF(**data.model_dump())
    db.add(v); db.commit(); db.refresh(v)
    return {"id": v.id, "name": v.name}


@router.put("/vrf/{vrf_id}")
def update_vrf(vrf_id: int, data: VRFCreate, db: Session = Depends(get_db)):
    v = db.query(VRF).filter(VRF.id == vrf_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="VRF non trouvée")
    for k, val in data.model_dump().items():
        setattr(v, k, val)
    db.commit()
    return {"id": v.id}


@router.delete("/vrf/{vrf_id}")
def delete_vrf(vrf_id: int, db: Session = Depends(get_db)):
    db.query(VRFEquipment).filter(VRFEquipment.vrf_id == vrf_id).delete()
    db.query(VRF).filter(VRF.id == vrf_id).delete()
    db.commit()
    return {"deleted": True}


@router.post("/vrf/{vrf_id}/equipment/{equipment_id}")
def add_vrf_equipment(vrf_id: int, equipment_id: int, db: Session = Depends(get_db)):
    exists = db.query(VRFEquipment).filter(
        VRFEquipment.vrf_id == vrf_id, VRFEquipment.equipment_id == equipment_id
    ).first()
    if not exists:
        db.add(VRFEquipment(vrf_id=vrf_id, equipment_id=equipment_id))
        db.commit()
    return {"ok": True}


@router.delete("/vrf/{vrf_id}/equipment/{equipment_id}")
def remove_vrf_equipment(vrf_id: int, equipment_id: int, db: Session = Depends(get_db)):
    db.query(VRFEquipment).filter(
        VRFEquipment.vrf_id == vrf_id, VRFEquipment.equipment_id == equipment_id
    ).delete()
    db.commit()
    return {"ok": True}
