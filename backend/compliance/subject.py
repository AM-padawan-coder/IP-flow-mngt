"""
Construction du « sujet » de conformité à partir d'un flux réel.

Le sujet est dérivé des données réelles de l'outil :
- zones source/destination et niveaux de confiance (table Zone)
- zones traversées par le CHEMIN réel calculé (hops → réseaux → zones)

C'est ce qui « branche le moteur réel à l'outil » : la conformité s'évalue sur
le chemin effectivement emprunté, pas sur une approximation.
"""

from typing import Optional


def _is_any(value: str) -> bool:
    return str(value).strip().lower() in ("", "any", "0.0.0.0/0", "::/0", "*")


def build_flow_subject(db, src_ip: str, dst_ip: str, port, protocol: str,
                       src_zone: Optional[str], dst_zone: Optional[str],
                       hops: Optional[list] = None) -> dict:
    """Construit le sujet OSCAL d'un flux.

    `hops` = liste des équipements traversés (format de path_finder), chaque hop
    portant ses `interfaces` avec le `network` (CIDR). On en déduit les zones
    réellement traversées.
    """
    from models import Zone, Network

    trust = {z.name: z.trust_level for z in db.query(Zone).all()}
    zid_name = {z.id: z.name for z in db.query(Zone).all()}
    cidr_zone = {net.cidr: zid_name.get(net.zone_id) for net in db.query(Network).all()}

    path_zones: list[str] = []

    def add(zone: Optional[str]):
        if zone and zone not in path_zones:
            path_zones.append(zone)

    add(src_zone)
    for hop in hops or []:
        for iface in hop.get("interfaces", []):
            add(cidr_zone.get(iface.get("network")))
    add(dst_zone)

    try:
        port_int = int(str(port))
    except (ValueError, TypeError):
        port_int = 0

    return {
        "subject_type": "flow",
        "src_ip": src_ip,
        "dst_ip": dst_ip,
        "src_zone": src_zone or "INCONNUE",
        "dst_zone": dst_zone or "INCONNUE",
        "src_trust": trust.get(src_zone, 50),
        "dst_trust": trust.get(dst_zone, 50),
        "port": port_int,
        "protocol": (protocol or "tcp").lower(),
        "action": "permit",
        "src_any": _is_any(src_ip),
        "dst_any": _is_any(dst_ip),
        "port_any": _is_any(port),
        "path_zones": path_zones,
    }
