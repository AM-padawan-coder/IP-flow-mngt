"""Moteur de validation : nomenclature, zones, règles métier."""
import ipaddress
import json
from sqlalchemy.orm import Session
from models import Network, ValidationRule, Zone


def _find_network_for_ip(ip_str: str, db: Session):
    """Retourne (Network, Zone) pour une IP, ou (None, None) si non trouvée."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return None, None

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

    if best_net:
        zone = db.query(Zone).filter(Zone.id == best_net.zone_id).first()
        return best_net, zone
    return None, None


def validate_flow(src_ip: str, dst_ip: str, port: str, protocol: str, db: Session) -> dict:
    checks = []

    # ── 1. Format IP source ──────────────────────────────────────────────────
    try:
        ipaddress.ip_address(src_ip)
        checks.append({"name": "Format IP source", "status": "ok", "message": f"{src_ip} — adresse IPv4 valide"})
    except ValueError:
        checks.append({"name": "Format IP source", "status": "error", "message": f"'{src_ip}' n'est pas une adresse IP valide"})
        return _result(False, checks, None, None)

    # ── 2. Format IP destination ─────────────────────────────────────────────
    try:
        ipaddress.ip_address(dst_ip)
        checks.append({"name": "Format IP destination", "status": "ok", "message": f"{dst_ip} — adresse IPv4 valide"})
    except ValueError:
        checks.append({"name": "Format IP destination", "status": "error", "message": f"'{dst_ip}' n'est pas une adresse IP valide"})
        return _result(False, checks, None, None)

    # ── 3. Validation du port ────────────────────────────────────────────────
    try:
        p = int(port)
        if not (1 <= p <= 65535):
            raise ValueError
        checks.append({"name": "Port réseau", "status": "ok", "message": f"Port {port} valide (1-65535)"})
    except (ValueError, TypeError):
        if port.lower() == "any":
            checks.append({"name": "Port réseau", "status": "warning", "message": "Port 'any' — flux large spectre, justification requise"})
        else:
            checks.append({"name": "Port réseau", "status": "error", "message": f"Port '{port}' invalide"})
            return _result(False, checks, None, None)

    # ── 4. Protocole ─────────────────────────────────────────────────────────
    valid_protos = ["tcp", "udp", "icmp", "any", "esp", "ah", "gre"]
    if protocol.lower() in valid_protos:
        checks.append({"name": "Protocole", "status": "ok", "message": f"Protocole {protocol.upper()} reconnu"})
    else:
        checks.append({"name": "Protocole", "status": "warning", "message": f"Protocole '{protocol}' non standard"})

    # ── 5. Adresses privées ───────────────────────────────────────────────────
    src_addr = ipaddress.ip_address(src_ip)
    dst_addr = ipaddress.ip_address(dst_ip)
    if src_addr.is_private:
        checks.append({"name": "RFC 1918 source", "status": "ok", "message": f"{src_ip} — adresse privée RFC 1918"})
    else:
        checks.append({"name": "RFC 1918 source", "status": "info", "message": f"{src_ip} — adresse publique (vérifier si zone INTERNET)"})
    if dst_addr.is_private:
        checks.append({"name": "RFC 1918 destination", "status": "ok", "message": f"{dst_ip} — adresse privée RFC 1918"})
    else:
        checks.append({"name": "RFC 1918 destination", "status": "info", "message": f"{dst_ip} — adresse publique (zone INTERNET ou NAT)"})

    # ── 6. Détection des zones ───────────────────────────────────────────────
    src_net, src_zone = _find_network_for_ip(src_ip, db)
    dst_net, dst_zone = _find_network_for_ip(dst_ip, db)

    if src_zone:
        checks.append({"name": "Zone source", "status": "ok", "message": f"Zone identifiée : {src_zone.name} ({src_net.name} — {src_net.cidr})"})
    else:
        checks.append({"name": "Zone source", "status": "warning", "message": f"IP source {src_ip} non trouvée dans l'architecture — zone inconnue"})

    if dst_zone:
        checks.append({"name": "Zone destination", "status": "ok", "message": f"Zone identifiée : {dst_zone.name} ({dst_net.name} — {dst_net.cidr})"})
    else:
        checks.append({"name": "Zone destination", "status": "warning", "message": f"IP destination {dst_ip} non trouvée dans l'architecture — zone inconnue"})

    # ── 7. Règles de ports restreints ────────────────────────────────────────
    if port.isdigit():
        port_int = int(port)
        for rule in db.query(ValidationRule).filter(
            ValidationRule.rule_type == "port_restriction",
            ValidationRule.active == True
        ).all():
            try:
                blocked = json.loads(rule.blocked_ports or "[]")
                if port_int in blocked:
                    checks.append({"name": rule.name, "status": rule.severity, "message": rule.message})
            except (json.JSONDecodeError, TypeError):
                pass

    # ── 8. Politiques de zone ────────────────────────────────────────────────
    if src_zone and dst_zone:
        for rule in db.query(ValidationRule).filter(
            ValidationRule.rule_type == "zone_policy",
            ValidationRule.active == True
        ).all():
            if rule.src_zone == src_zone.name and rule.dst_zone == dst_zone.name:
                checks.append({"name": rule.name, "status": rule.severity, "message": rule.message})

    # ── Résultat final ────────────────────────────────────────────────────────
    has_error = any(c["status"] == "error" for c in checks)
    return _result(not has_error, checks, src_zone, dst_zone, src_net, dst_net)


def _result(valid, checks, src_zone, dst_zone, src_net=None, dst_net=None):
    return {
        "valid": valid,
        "checks": checks,
        "src_zone": src_zone.name if src_zone else None,
        "dst_zone": dst_zone.name if dst_zone else None,
        "src_network": {"name": src_net.name, "cidr": src_net.cidr} if src_net else None,
        "dst_network": {"name": dst_net.name, "cidr": dst_net.cidr} if dst_net else None,
    }
