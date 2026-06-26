"""Calcul du chemin réseau entre équipements via NetworkX."""
import ipaddress
import networkx as nx
from sqlalchemy.orm import Session
from models import Equipment, Network, EquipmentInterface, TopologyLink


def _build_graph(db: Session) -> nx.Graph:
    G = nx.Graph()
    for eq in db.query(Equipment).filter(Equipment.active == True).all():
        G.add_node(eq.id, name=eq.name, vendor=eq.vendor, type=eq.type, model=eq.model or "")
    for link in db.query(TopologyLink).all():
        if G.has_node(link.equipment_a_id) and G.has_node(link.equipment_b_id):
            G.add_edge(link.equipment_a_id, link.equipment_b_id, link_type=link.link_type, description=link.description or "")
    return G


def _find_gateway_equipment(ip_str: str, db: Session) -> list:
    """Retourne les IDs des équipements ayant une interface sur le réseau de cette IP."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return []

    best_net = None
    best_prefixlen = -1
    for net in db.query(Network).all():
        try:
            network = ipaddress.ip_network(net.cidr)
            if ip in network and network.prefixlen > best_prefixlen:
                best_net = net
                best_prefixlen = network.prefixlen
        except ValueError:
            continue

    if not best_net:
        return []

    ifaces = db.query(EquipmentInterface).filter(
        EquipmentInterface.network_id == best_net.id
    ).all()
    return [i.equipment_id for i in ifaces]


def find_path(src_ip: str, dst_ip: str, db: Session) -> dict:
    G = _build_graph(db)

    src_eqp_ids = _find_gateway_equipment(src_ip, db)
    dst_eqp_ids = _find_gateway_equipment(dst_ip, db)

    if not src_eqp_ids or not dst_eqp_ids:
        return {
            "found": False,
            "error": "IP source ou destination non trouvée dans l'architecture",
            "hops": [],
        }

    # Cas : même équipement (micro-segmentation sur même segment)
    common = set(src_eqp_ids) & set(dst_eqp_ids)
    if common:
        eq_id = list(common)[0]
        eq = db.query(Equipment).filter(Equipment.id == eq_id).first()
        return {
            "found": True,
            "hops": [_hop(eq, db, "Filtrage local (même segment)")],
            "summary": f"Flux intra-équipement — {eq.name}",
        }

    # Recherche du chemin le plus court entre src_eqp et dst_eqp
    best_path = None
    best_len = 999

    for s in src_eqp_ids:
        for d in dst_eqp_ids:
            if s == d:
                continue
            try:
                path = nx.shortest_path(G, source=s, target=d)
                if len(path) < best_len:
                    best_len = len(path)
                    best_path = path
            except nx.NetworkXNoPath:
                continue

    if not best_path:
        return {
            "found": False,
            "error": "Aucun chemin trouvé dans la topologie entre ces deux points",
            "hops": [],
        }

    hops = []
    for i, eq_id in enumerate(best_path):
        eq = db.query(Equipment).filter(Equipment.id == eq_id).first()
        if not eq:
            continue
        action = _infer_action(eq, i, len(best_path))
        hops.append(_hop(eq, db, action))

    return {
        "found": True,
        "hops": hops,
        "summary": f"{len(hops)} équipement(s) traversé(s)",
    }


def _hop(eq: Equipment, db: Session, action: str) -> dict:
    ifaces = db.query(EquipmentInterface).filter(
        EquipmentInterface.equipment_id == eq.id
    ).all()
    nets = []
    for i in ifaces:
        net = db.query(Network).filter(Network.id == i.network_id).first()
        if net:
            nets.append({"interface": i.interface_name, "ip": i.ip_address, "network": net.cidr, "role": i.role})

    return {
        "equipment": eq.name,
        "vendor": eq.vendor,
        "type": eq.type,
        "model": eq.model or "",
        "management_ip": eq.management_ip or "",
        "action": action,
        "interfaces": nets,
    }


def _infer_action(eq: Equipment, position: int, total: int) -> str:
    if eq.type == "firewall":
        if eq.vendor == "nsx":
            return "Filtrage DFW (micro-segmentation)"
        return "Filtrage stateful + inspection"
    if eq.type == "router":
        return "Routage + filtre ACL"
    if eq.type == "nsx":
        return "Règle DFW NSX-T + routage T1/T0"
    return "Transit"
