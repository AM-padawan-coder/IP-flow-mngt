"""Router Applications — v2.9"""
import json, ipaddress
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from database import SessionLocal
from models import Application, ApplicationIP, Team, RoutingEntry, Equipment, Network, EquipmentInterface, FlowRequest

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


@router.get("/{app_id}/context")
def get_app_context(app_id: int):
    """Routes et flux associés à une application, pour le panel bas."""
    db = SessionLocal()
    try:
        app = db.query(Application).filter(Application.id == app_id).first()
        if not app:
            raise HTTPException(status_code=404, detail="Application introuvable")

        # IPs de l'application
        app_ips = [r.ip_address for r in db.query(ApplicationIP).filter(ApplicationIP.application_id == app_id).all()]

        # Réseaux contenant ces IPs
        all_networks = db.query(Network).all()
        cidr_objs: list[tuple[ipaddress.IPv4Network, Network]] = []
        for net in all_networks:
            try:
                cidr_objs.append((ipaddress.ip_network(net.cidr, strict=False), net))
            except Exception:
                pass

        net_ids: list[int] = []
        for ip_str in app_ips:
            try:
                addr = ipaddress.ip_address(ip_str)
            except Exception:
                continue
            for net_obj, net in cidr_objs:
                if addr in net_obj and net.id not in net_ids:
                    net_ids.append(net.id)

        # Équipements de ces réseaux
        eq_ids: list[int] = []
        for iface in db.query(EquipmentInterface).filter(EquipmentInterface.network_id.in_(net_ids)).all():
            if iface.equipment_id not in eq_ids:
                eq_ids.append(iface.equipment_id)

        # Routes sur ces équipements
        routes_result = []
        for entry, eq in (
            db.query(RoutingEntry, Equipment)
            .join(Equipment, RoutingEntry.equipment_id == Equipment.id)
            .filter(RoutingEntry.equipment_id.in_(eq_ids))
            .all()
        ):
            # Résolution du gateway
            gateway_eq = None
            if entry.gateway:
                # Cherche par management_ip
                gw_eq = db.query(Equipment).filter(Equipment.management_ip == entry.gateway).first()
                if not gw_eq:
                    # Cherche via interfaces
                    iface_gw = db.query(EquipmentInterface).filter(EquipmentInterface.ip_address == entry.gateway).first()
                    if iface_gw:
                        gw_eq = db.query(Equipment).filter(Equipment.id == iface_gw.equipment_id).first()
                gateway_eq = gw_eq.name if gw_eq else None

            routes_result.append({
                "equipment_name": eq.name,
                "destination": entry.destination,
                "gateway": entry.gateway or "",
                "gateway_equipment": gateway_eq,
                "route_type": entry.route_type or "static",
                "metric": entry.metric or 1,
            })

        # Flux impliquant les IPs de l'app
        flows_result = []
        if app_ips:
            from sqlalchemy import or_
            flows = db.query(FlowRequest).filter(
                or_(
                    FlowRequest.src_ip.in_(app_ips),
                    FlowRequest.dst_ip.in_(app_ips),
                )
            ).all()
            for f in flows:
                path: list[str] = []
                if f.path_result:
                    try:
                        pr = json.loads(f.path_result)
                        hops = pr.get("hops", [])
                        path = [h.get("equipment", h.get("name", "")) for h in hops if h.get("equipment") or h.get("name")]
                    except Exception:
                        pass
                flows_result.append({
                    "id": f.id,
                    "src_ip": f.src_ip,
                    "dst_ip": f.dst_ip,
                    "port": f.port,
                    "protocol": f.protocol,
                    "application": f.application or "",
                    "status": f.status,
                    "path": path,
                })

        return {
            "routes": routes_result,
            "flows": flows_result,
            "stats": {
                "flow_count": len(flows_result),
                "route_count": len(routes_result),
                "equipment_count": len(eq_ids),
            },
        }
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
