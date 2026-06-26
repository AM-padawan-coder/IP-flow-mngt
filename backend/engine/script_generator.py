"""Génération de scripts de configuration multi-vendor via Jinja2."""
from datetime import datetime
from jinja2 import Template

TEMPLATES = {
    "stormshield": Template("""\
# =============================================================================
# Stormshield Network Security — {{ equipment }}
# Généré le {{ date }}  |  Flux : {{ src_ip }} → {{ dst_ip }}:{{ port }}/{{ protocol|upper }}
# Application : {{ application }}
# =============================================================================

# 1. Créer les objets réseau
config object host
  add name="FLUX-SRC-{{ rule_id }}" ip={{ src_ip }}
  add name="FLUX-DST-{{ rule_id }}" ip={{ dst_ip }}

# 2. Créer le service
config object service
  add name="SVC-{{ protocol|upper }}-{{ port }}" proto={{ proto_num }} dport={{ port }}

# 3. Créer la règle de filtrage
config filter policy
  add rule name="FLUX-{{ rule_id }}"
    src-zone  {{ src_zone }}
    dst-zone  {{ dst_zone }}
    src-host  FLUX-SRC-{{ rule_id }}
    dst-host  FLUX-DST-{{ rule_id }}
    service   SVC-{{ protocol|upper }}-{{ port }}
    action    pass
    log       yes
    comment   "{{ justification }}"
    state     active

# 4. Appliquer la politique
config filter apply
"""),

    "paloalto": Template("""\
# =============================================================================
# Palo Alto PAN-OS — {{ equipment }}
# Généré le {{ date }}  |  Flux : {{ src_ip }} → {{ dst_ip }}:{{ port }}/{{ protocol|upper }}
# Application : {{ application }}
# =============================================================================

# 1. Address objects
set address ADDR-SRC-{{ rule_id }} ip-netmask {{ src_ip }}/32
set address ADDR-DST-{{ rule_id }} ip-netmask {{ dst_ip }}/32

# 2. Service object
set service SVC-{{ protocol|upper }}-{{ port }} protocol {{ protocol }} port {{ port }}

# 3. Security rule (ajouter avant le deny-all)
set rulebase security rules "FLUX-{{ rule_id }}" from {{ src_zone }}
set rulebase security rules "FLUX-{{ rule_id }}" to {{ dst_zone }}
set rulebase security rules "FLUX-{{ rule_id }}" source ADDR-SRC-{{ rule_id }}
set rulebase security rules "FLUX-{{ rule_id }}" destination ADDR-DST-{{ rule_id }}
set rulebase security rules "FLUX-{{ rule_id }}" service SVC-{{ protocol|upper }}-{{ port }}
set rulebase security rules "FLUX-{{ rule_id }}" application any
set rulebase security rules "FLUX-{{ rule_id }}" action allow
set rulebase security rules "FLUX-{{ rule_id }}" log-end yes
set rulebase security rules "FLUX-{{ rule_id }}" description "{{ justification }}"

# 4. Commit
commit description "Ouverture flux {{ rule_id }} - {{ application }}"
"""),

    "juniper": Template("""\
# =============================================================================
# Juniper Networks — {{ equipment }}
# Généré le {{ date }}  |  Flux : {{ src_ip }} → {{ dst_ip }}:{{ port }}/{{ protocol|upper }}
# Application : {{ application }}
# =============================================================================

# 1. Firewall filter (appliquer sur interface ingress)
set firewall filter ALLOW-FLOWS term {{ rule_id }} from source-address {{ src_ip }}/32
set firewall filter ALLOW-FLOWS term {{ rule_id }} from destination-address {{ dst_ip }}/32
set firewall filter ALLOW-FLOWS term {{ rule_id }} from protocol {{ protocol }}
set firewall filter ALLOW-FLOWS term {{ rule_id }} from destination-port {{ port }}
set firewall filter ALLOW-FLOWS term {{ rule_id }} then accept
set firewall filter ALLOW-FLOWS term {{ rule_id }} then count COUNT-{{ rule_id }}
set firewall filter ALLOW-FLOWS term {{ rule_id }} then syslog

# 2. Route statique si nécessaire
# set routing-options static route {{ dst_ip }}/32 next-hop <GW>

# 3. Appliquer le filtre sur l'interface source
# set interfaces <IFACE> unit <UNIT> family inet filter input ALLOW-FLOWS

# 4. Commit
commit comment "Ouverture flux {{ rule_id }}"
"""),

    "nsx": Template("""\
#!/bin/bash
# =============================================================================
# VMware NSX-T — DFW Rule — {{ equipment }}
# Généré le {{ date }}  |  Flux : {{ src_ip }} → {{ dst_ip }}:{{ port }}/{{ protocol|upper }}
# Application : {{ application }}
# =============================================================================

NSX_MGR="https://192.168.200.30"
USER="admin"
# Remplacer par le token ou mot de passe NSX-T

# 1. Créer le groupe source
curl -k -u "${USER}:PASSWORD" -X PATCH \\
  "${NSX_MGR}/policy/api/v1/infra/domains/default/groups/GRP-SRC-{{ rule_id }}" \\
  -H "Content-Type: application/json" -d '{
    "display_name": "GRP-SRC-{{ rule_id }}",
    "expression": [{"resource_type":"IPAddressExpression","ip_addresses":["{{ src_ip }}"]}]
  }'

# 2. Créer le groupe destination
curl -k -u "${USER}:PASSWORD" -X PATCH \\
  "${NSX_MGR}/policy/api/v1/infra/domains/default/groups/GRP-DST-{{ rule_id }}" \\
  -H "Content-Type: application/json" -d '{
    "display_name": "GRP-DST-{{ rule_id }}",
    "expression": [{"resource_type":"IPAddressExpression","ip_addresses":["{{ dst_ip }}"]}]
  }'

# 3. Créer la règle DFW
curl -k -u "${USER}:PASSWORD" -X PATCH \\
  "${NSX_MGR}/policy/api/v1/infra/domains/default/security-policies/APP-POLICY/rules/RULE-{{ rule_id }}" \\
  -H "Content-Type: application/json" -d '{
    "display_name": "FLUX-{{ rule_id }}",
    "source_groups": ["/infra/domains/default/groups/GRP-SRC-{{ rule_id }}"],
    "destination_groups": ["/infra/domains/default/groups/GRP-DST-{{ rule_id }}"],
    "services": ["/infra/services/{{ protocol|upper }}_{{ port }}"],
    "action": "ALLOW",
    "direction": "IN_OUT",
    "logged": true,
    "notes": "{{ justification }}"
  }'

echo "Règle DFW {{ rule_id }} créée."
"""),

    "fortinet": Template("""\
# =============================================================================
# Fortinet FortiGate — {{ equipment }}
# Généré le {{ date }}  |  Flux : {{ src_ip }} → {{ dst_ip }}:{{ port }}/{{ protocol|upper }}
# Application : {{ application }}
# =============================================================================

# 1. Objets adresse
config firewall address
    edit "ADDR-SRC-{{ rule_id }}"
        set subnet {{ src_ip }} 255.255.255.255
        set comment "Source {{ rule_id }}"
    next
    edit "ADDR-DST-{{ rule_id }}"
        set subnet {{ dst_ip }} 255.255.255.255
        set comment "Destination {{ rule_id }}"
    next
end

# 2. Service personnalisé
config firewall service custom
    edit "SVC-{{ protocol|upper }}-{{ port }}"
        set protocol TCP/UDP/SCTP
        set {{ protocol }}-portrange {{ port }}
    next
end

# 3. Politique IPv4
config firewall policy
    edit 0
        set name "FLUX-{{ rule_id }}"
        set srcintf "{{ src_intf }}"
        set dstintf "{{ dst_intf }}"
        set srcaddr "ADDR-SRC-{{ rule_id }}"
        set dstaddr "ADDR-DST-{{ rule_id }}"
        set action accept
        set schedule "always"
        set service "SVC-{{ protocol|upper }}-{{ port }}"
        set logtraffic all
        set comments "{{ justification }}"
    next
end
"""),

    "checkpoint": Template("""\
# =============================================================================
# Check Point — {{ equipment }}
# Généré le {{ date }}  |  Flux : {{ src_ip }} → {{ dst_ip }}:{{ port }}/{{ protocol|upper }}
# Application : {{ application }}
# SmartConsole Management API
# =============================================================================

# 1. Connexion à l'API Management
mgmt_cli login user admin password "PASSWORD" management "192.168.200.60" > /tmp/sid.json
SID=$(cat /tmp/sid.json | python3 -c "import sys,json; print(json.load(sys.stdin)['sid'])")

# 2. Créer les objets hôtes
mgmt_cli add host name "HOST-SRC-{{ rule_id }}" ip-address "{{ src_ip }}" --session-id $SID
mgmt_cli add host name "HOST-DST-{{ rule_id }}" ip-address "{{ dst_ip }}" --session-id $SID

# 3. Créer le service
mgmt_cli add service-{{ protocol }} name "SVC-{{ protocol|upper }}-{{ port }}" port "{{ port }}" --session-id $SID

# 4. Ajouter la règle (en tête de la politique)
mgmt_cli add access-rule layer "Network" position top \\
  name "FLUX-{{ rule_id }}" \\
  source "HOST-SRC-{{ rule_id }}" \\
  destination "HOST-DST-{{ rule_id }}" \\
  service "SVC-{{ protocol|upper }}-{{ port }}" \\
  action "accept" \\
  track "Log" \\
  comments "{{ justification }}" \\
  --session-id $SID

# 5. Publier et installer
mgmt_cli publish --session-id $SID
mgmt_cli install-policy policy-package "Standard" \\
  access true threat-prevention false \\
  targets "{{ equipment }}" \\
  --session-id $SID

mgmt_cli logout --session-id $SID
"""),
}

PROTO_NUMS = {"tcp": 6, "udp": 17, "icmp": 1, "esp": 50, "ah": 51, "gre": 47}


def generate_scripts(src_ip, dst_ip, port, protocol, application, justification,
                     src_zone, dst_zone, path_hops, rule_id=None) -> dict:
    if not rule_id:
        import random
        rule_id = f"{datetime.utcnow().strftime('%Y%m%d')}-{random.randint(1000, 9999)}"

    date_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    ctx = {
        "rule_id": rule_id,
        "date": date_str,
        "src_ip": src_ip,
        "dst_ip": dst_ip,
        "port": port,
        "protocol": protocol.lower(),
        "proto_num": PROTO_NUMS.get(protocol.lower(), 6),
        "application": application or "Non spécifiée",
        "justification": justification or "Non renseignée",
        "src_zone": src_zone or "any",
        "dst_zone": dst_zone or "any",
        "src_intf": "port1",
        "dst_intf": "port2",
    }

    scripts = {}
    for hop in path_hops:
        vendor = hop.get("vendor", "").lower()
        equipment = hop.get("equipment", "")
        template = TEMPLATES.get(vendor)
        if template:
            scripts[equipment] = {
                "vendor": vendor,
                "equipment": equipment,
                "action": hop.get("action", ""),
                "script": template.render(**ctx, equipment=equipment),
            }

    return {"rule_id": rule_id, "scripts": scripts}
