import csv, io, json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import Zone, Equipment, Network, EquipmentInterface, TopologyLink, Team, PhysicalZone

router = APIRouter()


# ── Pydantic schemas ───────────────────────────────────────────────────────

class ZoneIn(BaseModel):
    name: str
    color: str = "#64748b"
    description: str = ""
    trust_level: int = 50
    zone_type: str = "logical"


class EquipmentIn(BaseModel):
    name: str
    type: str
    vendor: str
    model: str = ""
    management_ip: str = ""
    description: str = ""
    active: bool = True
    team_id: Optional[int] = None
    physical_zone_id: Optional[int] = None


class NetworkIn(BaseModel):
    name: str
    cidr: str
    zone_id: int
    vlan_id: Optional[int] = None
    gateway: str = ""
    description: str = ""


class InterfaceIn(BaseModel):
    equipment_id: int
    network_id: int
    interface_name: str
    ip_address: str
    role: str = "downstream"


class LinkIn(BaseModel):
    equipment_a_id: int
    equipment_b_id: int
    link_type: str = "ethernet"
    description: str = ""


# ── Zones ──────────────────────────────────────────────────────────────────

@router.get("/zones")
def list_zones(db: Session = Depends(get_db)):
    zones = db.query(Zone).all()
    result = []
    for z in zones:
        nets = db.query(Network).filter(Network.zone_id == z.id).all()
        result.append({
            "id": z.id, "name": z.name, "color": z.color,
            "description": z.description, "trust_level": z.trust_level,
            "zone_type": z.zone_type,
            "networks": [{"id": n.id, "name": n.name, "cidr": n.cidr, "vlan_id": n.vlan_id} for n in nets],
        })
    return result


@router.post("/zones", status_code=201)
def create_zone(data: ZoneIn, db: Session = Depends(get_db)):
    if db.query(Zone).filter(Zone.name == data.name).first():
        raise HTTPException(status_code=409, detail=f"Zone '{data.name}' existe déjà")
    z = Zone(**data.model_dump())
    db.add(z); db.commit(); db.refresh(z)
    return {"id": z.id, "name": z.name}


@router.put("/zones/{zone_id}")
def update_zone(zone_id: int, data: ZoneIn, db: Session = Depends(get_db)):
    z = db.query(Zone).filter(Zone.id == zone_id).first()
    if not z:
        raise HTTPException(status_code=404, detail="Zone non trouvée")
    for k, v in data.model_dump().items():
        setattr(z, k, v)
    db.commit()
    return {"id": z.id, "name": z.name}


@router.delete("/zones/{zone_id}")
def delete_zone(zone_id: int, db: Session = Depends(get_db)):
    z = db.query(Zone).filter(Zone.id == zone_id).first()
    if not z:
        raise HTTPException(status_code=404, detail="Zone non trouvée")
    db.delete(z); db.commit()
    return {"ok": True}


# ── Equipment ──────────────────────────────────────────────────────────────

@router.get("/equipment")
def list_equipment(db: Session = Depends(get_db)):
    eqps = db.query(Equipment).filter(Equipment.active == True).all()
    result = []
    for e in eqps:
        ifaces = db.query(EquipmentInterface).filter(EquipmentInterface.equipment_id == e.id).all()
        iface_data = []
        for i in ifaces:
            net = db.query(Network).filter(Network.id == i.network_id).first()
            zone = db.query(Zone).filter(Zone.id == net.zone_id).first() if net else None
            iface_data.append({
                "id": i.id, "name": i.interface_name, "ip": i.ip_address,
                "network": net.cidr if net else "", "network_name": net.name if net else "",
                "network_id": net.id if net else None,
                "zone": zone.name if zone else "", "zone_color": zone.color if zone else "#666",
                "role": i.role,
            })
        team = db.query(Team).filter(Team.id == e.team_id).first() if e.team_id else None
        pzone = db.query(PhysicalZone).filter(PhysicalZone.id == e.physical_zone_id).first() if e.physical_zone_id else None
        result.append({
            "id": e.id, "name": e.name, "type": e.type, "vendor": e.vendor,
            "model": e.model or "", "management_ip": e.management_ip or "",
            "description": e.description or "", "interfaces": iface_data,
            "team_id": e.team_id, "team_name": team.name if team else None,
            "physical_zone_id": e.physical_zone_id,
            "physical_zone_name": pzone.name if pzone else None,
        })
    return result


@router.post("/equipment", status_code=201)
def create_equipment(data: EquipmentIn, db: Session = Depends(get_db)):
    if db.query(Equipment).filter(Equipment.name == data.name).first():
        raise HTTPException(status_code=409, detail=f"Équipement '{data.name}' existe déjà")
    e = Equipment(**data.model_dump())
    db.add(e); db.commit(); db.refresh(e)
    return {"id": e.id, "name": e.name}


@router.put("/equipment/{eq_id}")
def update_equipment(eq_id: int, data: EquipmentIn, db: Session = Depends(get_db)):
    e = db.query(Equipment).filter(Equipment.id == eq_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Équipement non trouvé")
    for k, v in data.model_dump().items():
        setattr(e, k, v)
    db.commit()
    return {"id": e.id, "name": e.name}


@router.delete("/equipment/{eq_id}")
def delete_equipment(eq_id: int, db: Session = Depends(get_db)):
    e = db.query(Equipment).filter(Equipment.id == eq_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Équipement non trouvé")
    db.delete(e); db.commit()
    return {"ok": True}


# ── Networks ───────────────────────────────────────────────────────────────

@router.get("/networks")
def list_networks(db: Session = Depends(get_db)):
    nets = db.query(Network).all()
    result = []
    for n in nets:
        zone = db.query(Zone).filter(Zone.id == n.zone_id).first()
        result.append({
            "id": n.id, "name": n.name, "cidr": n.cidr,
            "vlan_id": n.vlan_id, "gateway": n.gateway or "",
            "description": n.description or "",
            "zone_id": n.zone_id,
            "zone": zone.name if zone else "", "zone_color": zone.color if zone else "#666",
        })
    return result


@router.post("/networks", status_code=201)
def create_network(data: NetworkIn, db: Session = Depends(get_db)):
    n = Network(**data.model_dump())
    db.add(n); db.commit(); db.refresh(n)
    return {"id": n.id, "name": n.name}


@router.put("/networks/{net_id}")
def update_network(net_id: int, data: NetworkIn, db: Session = Depends(get_db)):
    n = db.query(Network).filter(Network.id == net_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Réseau non trouvé")
    for k, v in data.model_dump().items():
        setattr(n, k, v)
    db.commit()
    return {"id": n.id, "name": n.name}


@router.delete("/networks/{net_id}")
def delete_network(net_id: int, db: Session = Depends(get_db)):
    n = db.query(Network).filter(Network.id == net_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Réseau non trouvé")
    db.delete(n); db.commit()
    return {"ok": True}


# ── Interfaces ─────────────────────────────────────────────────────────────

@router.post("/interfaces", status_code=201)
def create_interface(data: InterfaceIn, db: Session = Depends(get_db)):
    i = EquipmentInterface(**data.model_dump())
    db.add(i); db.commit(); db.refresh(i)
    return {"id": i.id}


@router.delete("/interfaces/{iface_id}")
def delete_interface(iface_id: int, db: Session = Depends(get_db)):
    i = db.query(EquipmentInterface).filter(EquipmentInterface.id == iface_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Interface non trouvée")
    db.delete(i); db.commit()
    return {"ok": True}


# ── Links ──────────────────────────────────────────────────────────────────

@router.get("/links")
def list_links(db: Session = Depends(get_db)):
    links = db.query(TopologyLink).all()
    result = []
    for lnk in links:
        ea = db.query(Equipment).filter(Equipment.id == lnk.equipment_a_id).first()
        eb = db.query(Equipment).filter(Equipment.id == lnk.equipment_b_id).first()
        result.append({
            "id": lnk.id,
            "equipment_a_id": lnk.equipment_a_id, "equipment_a_name": ea.name if ea else "?",
            "equipment_b_id": lnk.equipment_b_id, "equipment_b_name": eb.name if eb else "?",
            "link_type": lnk.link_type, "description": lnk.description or "",
        })
    return result


@router.post("/links", status_code=201)
def create_link(data: LinkIn, db: Session = Depends(get_db)):
    lnk = TopologyLink(**data.model_dump())
    db.add(lnk); db.commit(); db.refresh(lnk)
    return {"id": lnk.id}


@router.delete("/links/{link_id}")
def delete_link(link_id: int, db: Session = Depends(get_db)):
    lnk = db.query(TopologyLink).filter(TopologyLink.id == link_id).first()
    if not lnk:
        raise HTTPException(status_code=404, detail="Lien non trouvé")
    db.delete(lnk); db.commit()
    return {"ok": True}


# ── Graph ──────────────────────────────────────────────────────────────────

@router.get("/graph")
def topology_graph(db: Session = Depends(get_db)):
    nodes = []
    for e in db.query(Equipment).filter(Equipment.active == True).all():
        team = db.query(Team).filter(Team.id == e.team_id).first() if e.team_id else None
        pzone = db.query(PhysicalZone).filter(PhysicalZone.id == e.physical_zone_id).first() if e.physical_zone_id else None
        nodes.append({
            "id": e.id, "name": e.name, "type": e.type, "vendor": e.vendor,
            "model": e.model or "", "management_ip": e.management_ip or "",
            "team": team.name if team else None,
            "physical_zone": pzone.name if pzone else None,
        })
    edges = []
    for lnk in db.query(TopologyLink).all():
        ea = db.query(Equipment).filter(Equipment.id == lnk.equipment_a_id).first()
        eb = db.query(Equipment).filter(Equipment.id == lnk.equipment_b_id).first()
        if ea and eb:
            edges.append({
                "id": lnk.id, "source": lnk.equipment_a_id, "target": lnk.equipment_b_id,
                "type": lnk.link_type, "description": lnk.description or "",
            })
    return {"nodes": nodes, "edges": edges}


# ── Import ─────────────────────────────────────────────────────────────────

@router.post("/import/json")
def import_json(payload: dict, db: Session = Depends(get_db)):
    created = {"zones": 0, "equipment": 0, "networks": 0, "links": 0}
    skipped = {"zones": 0, "equipment": 0, "networks": 0, "links": 0}

    for z in payload.get("zones", []):
        if not db.query(Zone).filter(Zone.name == z["name"]).first():
            db.add(Zone(
                name=z["name"], color=z.get("color", "#64748b"),
                description=z.get("description", ""),
                trust_level=z.get("trust_level", 50),
                zone_type=z.get("zone_type", "logical"),
            ))
            created["zones"] += 1
        else:
            skipped["zones"] += 1
    db.flush()

    for e in payload.get("equipment", []):
        if not db.query(Equipment).filter(Equipment.name == e["name"]).first():
            db.add(Equipment(
                name=e["name"], type=e.get("type", "firewall"),
                vendor=e.get("vendor", ""), model=e.get("model", ""),
                management_ip=e.get("management_ip", ""),
                description=e.get("description", ""),
            ))
            created["equipment"] += 1
        else:
            skipped["equipment"] += 1
    db.flush()

    for n in payload.get("networks", []):
        zone = db.query(Zone).filter(Zone.name == n.get("zone_name", "")).first()
        if zone:
            db.add(Network(
                name=n["name"], cidr=n["cidr"], zone_id=zone.id,
                vlan_id=n.get("vlan_id"), gateway=n.get("gateway", ""),
                description=n.get("description", ""),
            ))
            created["networks"] += 1
        else:
            skipped["networks"] += 1
    db.flush()

    for lnk in payload.get("links", []):
        ea = db.query(Equipment).filter(Equipment.name == lnk.get("equipment_a")).first()
        eb = db.query(Equipment).filter(Equipment.name == lnk.get("equipment_b")).first()
        if ea and eb:
            db.add(TopologyLink(
                equipment_a_id=ea.id, equipment_b_id=eb.id,
                link_type=lnk.get("link_type", "ethernet"),
                description=lnk.get("description", ""),
            ))
            created["links"] += 1
        else:
            skipped["links"] += 1

    db.commit()
    return {"created": created, "skipped": skipped}


@router.post("/import/csv/equipment")
async def import_csv_equipment(payload: dict, db: Session = Depends(get_db)):
    """payload: { csv: "..." }"""
    content = payload.get("csv", "")
    reader = csv.DictReader(io.StringIO(content))
    created, skipped = 0, 0
    for row in reader:
        name = row.get("name", "").strip()
        if not name:
            continue
        if not db.query(Equipment).filter(Equipment.name == name).first():
            db.add(Equipment(
                name=name, type=row.get("type", "firewall").strip(),
                vendor=row.get("vendor", "").strip(),
                model=row.get("model", "").strip(),
                management_ip=row.get("management_ip", "").strip(),
                description=row.get("description", "").strip(),
            ))
            created += 1
        else:
            skipped += 1
    db.commit()
    return {"created": created, "skipped": skipped}


@router.post("/import/csv/networks")
async def import_csv_networks(payload: dict, db: Session = Depends(get_db)):
    content = payload.get("csv", "")
    reader = csv.DictReader(io.StringIO(content))
    created, skipped = 0, 0
    for row in reader:
        name = row.get("name", "").strip()
        cidr = row.get("cidr", "").strip()
        if not name or not cidr:
            continue
        zone = db.query(Zone).filter(Zone.name == row.get("zone_name", "").strip()).first()
        if zone:
            db.add(Network(
                name=name, cidr=cidr, zone_id=zone.id,
                vlan_id=int(row["vlan_id"]) if row.get("vlan_id", "").strip().isdigit() else None,
                gateway=row.get("gateway", "").strip(),
                description=row.get("description", "").strip(),
            ))
            created += 1
        else:
            skipped += 1
    db.commit()
    return {"created": created, "skipped": skipped}


@router.post("/import/csv/links")
async def import_csv_links(payload: dict, db: Session = Depends(get_db)):
    content = payload.get("csv", "")
    reader = csv.DictReader(io.StringIO(content))
    created, skipped = 0, 0
    for row in reader:
        ea = db.query(Equipment).filter(Equipment.name == row.get("equipment_a", "").strip()).first()
        eb = db.query(Equipment).filter(Equipment.name == row.get("equipment_b", "").strip()).first()
        if ea and eb:
            db.add(TopologyLink(
                equipment_a_id=ea.id, equipment_b_id=eb.id,
                link_type=row.get("link_type", "ethernet").strip(),
                description=row.get("description", "").strip(),
            ))
            created += 1
        else:
            skipped += 1
    db.commit()
    return {"created": created, "skipped": skipped}


# ── Export ─────────────────────────────────────────────────────────────────

@router.get("/export/json")
def export_json(db: Session = Depends(get_db)):
    zones = [{"name": z.name, "color": z.color, "description": z.description,
               "trust_level": z.trust_level, "zone_type": z.zone_type}
             for z in db.query(Zone).all()]
    equipment = [{"name": e.name, "type": e.type, "vendor": e.vendor, "model": e.model or "",
                  "management_ip": e.management_ip or "", "description": e.description or ""}
                 for e in db.query(Equipment).all()]
    networks = []
    for n in db.query(Network).all():
        zone = db.query(Zone).filter(Zone.id == n.zone_id).first()
        networks.append({"name": n.name, "cidr": n.cidr, "zone_name": zone.name if zone else "",
                         "vlan_id": n.vlan_id, "gateway": n.gateway or "", "description": n.description or ""})
    links = []
    for lnk in db.query(TopologyLink).all():
        ea = db.query(Equipment).filter(Equipment.id == lnk.equipment_a_id).first()
        eb = db.query(Equipment).filter(Equipment.id == lnk.equipment_b_id).first()
        if ea and eb:
            links.append({"equipment_a": ea.name, "equipment_b": eb.name,
                          "link_type": lnk.link_type, "description": lnk.description or ""})
    payload = json.dumps({"zones": zones, "equipment": equipment, "networks": networks, "links": links}, indent=2, ensure_ascii=False)
    return StreamingResponse(io.BytesIO(payload.encode()), media_type="application/json",
                             headers={"Content-Disposition": "attachment; filename=topology.json"})
