"""Endpoints de simulation : What-if, détection de boucles, analyse d'impact."""
import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import networkx as nx

from database import get_db
from engine.validator import validate_flow
from engine.path_finder import find_path, _build_graph
from models import FlowRequest, Equipment, TopologyLink

router = APIRouter()


class FlowIn(BaseModel):
    src_ip: str
    dst_ip: str
    port: str
    protocol: str = "tcp"
    application: str = ""
    justification: str = ""


@router.post("/whatif")
def whatif_simulation(data: FlowIn, db: Session = Depends(get_db)):
    """Simule un flux et analyse son impact sur les flux existants."""
    validation = validate_flow(data.src_ip, data.dst_ip, data.port, data.protocol, db)
    path: dict = {}
    flows_on_path: list = []

    if validation["valid"]:
        path = find_path(data.src_ip, data.dst_ip, db)

        if path.get("found"):
            path_equipment = {hop["equipment"] for hop in path.get("hops", [])}

            existing = db.query(FlowRequest).filter(
                FlowRequest.status.in_(["validated", "deployed"])
            ).all()

            for f in existing:
                f_path = json.loads(f.path_result or "{}")
                if not f_path.get("found"):
                    continue
                f_equipment = {h["equipment"] for h in f_path.get("hops", [])}
                shared = path_equipment & f_equipment
                if shared:
                    flows_on_path.append({
                        "id": f.id,
                        "src_ip": f.src_ip,
                        "dst_ip": f.dst_ip,
                        "port": f.port,
                        "protocol": f.protocol,
                        "application": f.application or "—",
                        "status": f.status,
                        "shared_equipment": sorted(shared),
                    })

    risk = _risk_level(validation, flows_on_path)

    return {
        "validation": validation,
        "path": path,
        "flows_on_path": flows_on_path,
        "risk_level": risk,
        "risk_label": _risk_label(risk),
    }


def _risk_level(validation: dict, conflicts: list) -> str:
    if not validation["valid"]:
        return "blocked"
    n = len(conflicts)
    if n >= 4:
        return "high"
    if n >= 1:
        return "medium"
    return "low"


def _risk_label(risk: str) -> str:
    return {"blocked": "Flux bloqué", "high": "Risque élevé",
            "medium": "Risque modéré", "low": "Risque faible"}.get(risk, risk)


@router.get("/loops")
def detect_loops(db: Session = Depends(get_db)):
    """Détecte les boucles L2/L3 dans la topologie réseau."""
    G = _build_graph(db)
    eq_map = {eq.id: eq.name for eq in db.query(Equipment).all()}

    cycles = []
    try:
        # nx.simple_cycles works on DiGraph — convert
        DG = G.to_directed()
        for cycle in nx.simple_cycles(DG):
            if len(cycle) >= 3:  # ignore trivial A→B→A back-edges
                named = [eq_map.get(n, str(n)) for n in cycle]
                cycles.append(named)
        # deduplicate (simple_cycles returns each direction)
        seen = set()
        unique = []
        for c in cycles:
            key = frozenset(c)
            if key not in seen:
                seen.add(key)
                unique.append(c)
        cycles = unique
    except Exception:
        cycles = []

    return {
        "has_loops": len(cycles) > 0,
        "cycle_count": len(cycles),
        "cycles": cycles,
        "node_count": G.number_of_nodes(),
        "edge_count": G.number_of_edges(),
    }


@router.get("/impact/{equipment_name}")
def equipment_impact(equipment_name: str, db: Session = Depends(get_db)):
    """Quels flux validés traversent cet équipement ?"""
    eq = db.query(Equipment).filter(Equipment.name == equipment_name).first()
    if not eq:
        return {"error": f"Équipement '{equipment_name}' non trouvé", "flows": []}

    impacted = []
    all_flows = db.query(FlowRequest).filter(
        FlowRequest.status.in_(["validated", "deployed", "pending"])
    ).all()

    for f in all_flows:
        f_path = json.loads(f.path_result or "{}")
        if not f_path.get("found"):
            continue
        for hop in f_path.get("hops", []):
            if hop.get("equipment") == equipment_name:
                impacted.append({
                    "id": f.id,
                    "src_ip": f.src_ip,
                    "dst_ip": f.dst_ip,
                    "port": f.port,
                    "protocol": f.protocol,
                    "application": f.application or "—",
                    "status": f.status,
                    "created_at": f.created_at.isoformat(),
                })
                break

    return {
        "equipment": equipment_name,
        "type": eq.type,
        "vendor": eq.vendor,
        "model": eq.model or "",
        "management_ip": eq.management_ip or "",
        "impacted_count": len(impacted),
        "flows": impacted,
    }


@router.get("/spof")
def detect_spof(db: Session = Depends(get_db)):
    """Détecte les SPOF (Single Points of Failure) par analyse des points d'articulation du graphe."""
    equip = db.query(Equipment).filter(Equipment.active == True).all()
    links = db.query(TopologyLink).all()
    eq_names = {e.id: e.name for e in equip}
    eq_meta  = {e.name: {"type": e.type, "vendor": e.vendor} for e in equip}

    G = nx.Graph()
    for e in equip:
        G.add_node(e.name)
    for link in links:
        a, b = eq_names.get(link.equipment_a_id), eq_names.get(link.equipment_b_id)
        if a and b:
            G.add_edge(a, b)

    if G.number_of_nodes() < 2:
        return {"has_spof": False, "spof_count": 0, "spof_nodes": [], "node_count": G.number_of_nodes(), "edge_count": G.number_of_edges()}

    spof_names = list(nx.articulation_points(G))
    all_flows = db.query(FlowRequest).filter(FlowRequest.status.in_(["validated", "deployed"])).all()

    spof_nodes = []
    for name in spof_names:
        impacted = sum(1 for f in all_flows if name in (f.path_result or ""))
        spof_nodes.append({"name": name, "impacted_flows": impacted, **eq_meta.get(name, {})})
    spof_nodes.sort(key=lambda x: -x["impacted_flows"])

    return {
        "has_spof": len(spof_names) > 0,
        "spof_count": len(spof_names),
        "spof_nodes": spof_nodes,
        "node_count": G.number_of_nodes(),
        "edge_count": G.number_of_edges(),
    }


@router.get("/equipment-list")
def list_equipment(db: Session = Depends(get_db)):
    """Liste des équipements pour le sélecteur d'impact."""
    return [
        {"id": eq.id, "name": eq.name, "type": eq.type, "vendor": eq.vendor}
        for eq in db.query(Equipment).filter(Equipment.active == True).order_by(Equipment.name).all()
    ]
