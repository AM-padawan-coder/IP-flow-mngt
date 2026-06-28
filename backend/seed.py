"""Données de démonstration réalistes pour l'outil de gestion de flux IP."""
import json
from datetime import datetime, timedelta
from models import Zone, Equipment, Network, EquipmentInterface, TopologyLink, ValidationRule, FlowRequest, Team, PhysicalZone, VRF, VRFEquipment, Application, ApplicationIP, Environment, RoutingEntry


def seed_database(db):
    if db.query(Zone).count() > 0:
        return

    # ─── Équipes ──────────────────────────────────────────────────────────────
    teams = {
        "infra":  Team(name="Équipe Infrastructure",  description="Réseau, sécurité et systèmes",       contact="infra@entreprise.fr",  color="#3b82f6"),
        "secu":   Team(name="Équipe Sécurité",        description="SOC, RSSI et pentest",               contact="soc@entreprise.fr",    color="#ef4444"),
        "app":    Team(name="Équipe Applicatif",      description="Développement et déploiement",       contact="apps@entreprise.fr",   color="#22c55e"),
        "ops":    Team(name="Équipe Ops / Cloud",     description="Virtualisation VMware et cloud",     contact="ops@entreprise.fr",    color="#a855f7"),
    }
    for t in teams.values():
        db.add(t)
    db.flush()

    # ─── Zones physiques ──────────────────────────────────────────────────────
    pzones = {
        "dc-paris":  PhysicalZone(name="DC-PARIS-01",      type="datacenter", description="Datacenter principal Paris",   location="75008 Paris"),
        "dc-lyon":   PhysicalZone(name="DC-LYON-DR",       type="datacenter", description="Datacenter DR Lyon",           location="69003 Lyon"),
        "salle-net": PhysicalZone(name="Salle Réseau",     type="salle",      description="Salle équipements réseau",     location="DC-PARIS-01 - Niveau 2"),
        "salle-srv": PhysicalZone(name="Salle Serveurs",   type="salle",      description="Salle serveurs et baies",      location="DC-PARIS-01 - Niveau 1"),
        "baie-fw":   PhysicalZone(name="Baie-FW-A01",     type="baie",       description="Baie firewalls périmètre",     location="Salle Réseau - Rangée A"),
        "baie-core": PhysicalZone(name="Baie-CORE-B01",   type="baie",       description="Baie cœur de réseau",         location="Salle Réseau - Rangée B"),
        "baie-vmw":  PhysicalZone(name="Baie-VMW-C01",    type="baie",       description="Baie VMware / NSX",           location="Salle Serveurs - Rangée C"),
    }
    for pz in pzones.values():
        db.add(pz)
    db.flush()

    # Hiérarchie parent
    pzones["salle-net"].parent_id = pzones["dc-paris"].id
    pzones["salle-srv"].parent_id = pzones["dc-paris"].id
    pzones["baie-fw"].parent_id   = pzones["salle-net"].id
    pzones["baie-core"].parent_id = pzones["salle-net"].id
    pzones["baie-vmw"].parent_id  = pzones["salle-srv"].id
    db.flush()

    # ─── Zones logiques ───────────────────────────────────────────────────────
    zones = {
        "INTERNET":      Zone(name="INTERNET",         color="#ef4444", description="Zone internet non fiable",          trust_level=0,  zone_type="logical"),
        "DMZ":           Zone(name="DMZ",              color="#f97316", description="Zone démilitarisée",                trust_level=25, zone_type="logical"),
        "LAN-USERS":     Zone(name="LAN-UTILISATEURS", color="#22c55e", description="Réseau bureautique utilisateurs",   trust_level=60, zone_type="logical"),
        "ZONE-SERVEURS": Zone(name="ZONE-SERVEURS",    color="#3b82f6", description="Serveurs applicatifs internes",     trust_level=80, zone_type="logical"),
        "ZONE-MGMT":     Zone(name="ZONE-MANAGEMENT",  color="#a855f7", description="Administration réseau (OAM)",       trust_level=95, zone_type="logical"),
        "ZONE-BACKUP":   Zone(name="ZONE-BACKUP",      color="#64748b", description="Sauvegarde et archivage",           trust_level=70, zone_type="logical"),
    }
    for z in zones.values():
        db.add(z)
    db.flush()

    # ─── Réseaux ──────────────────────────────────────────────────────────────
    nets = {
        "DMZ-WEB":    Network(name="DMZ-WEB",        cidr="192.168.100.0/24", zone_id=zones["DMZ"].id,           vlan_id=100, gateway="192.168.100.1",  description="Serveurs web / reverse-proxy"),
        "DMZ-MAIL":   Network(name="DMZ-MAIL",       cidr="192.168.101.0/24", zone_id=zones["DMZ"].id,           vlan_id=101, gateway="192.168.101.1",  description="Relais messagerie"),
        "LAN-BUREAU": Network(name="LAN-BUREAUTIQUE",cidr="10.10.0.0/16",     zone_id=zones["LAN-USERS"].id,     vlan_id=10,  gateway="10.10.0.1",      description="Postes de travail"),
        "LAN-WIFI":   Network(name="LAN-WIFI",       cidr="10.20.0.0/16",     zone_id=zones["LAN-USERS"].id,     vlan_id=20,  gateway="10.20.0.1",      description="Réseau WiFi entreprise"),
        "SERV-APP":   Network(name="SERV-APP",       cidr="172.16.10.0/24",   zone_id=zones["ZONE-SERVEURS"].id, vlan_id=200, gateway="172.16.10.1",    description="Serveurs applicatifs"),
        "SERV-DB":    Network(name="SERV-DB",        cidr="172.16.20.0/24",   zone_id=zones["ZONE-SERVEURS"].id, vlan_id=201, gateway="172.16.20.1",    description="Bases de données"),
        "SERV-FILE":  Network(name="SERV-FILE",      cidr="172.16.30.0/24",   zone_id=zones["ZONE-SERVEURS"].id, vlan_id=202, gateway="172.16.30.1",    description="Serveurs de fichiers"),
        "MGMT":       Network(name="MGMT-OAB",       cidr="192.168.200.0/24", zone_id=zones["ZONE-MGMT"].id,    vlan_id=999, gateway="192.168.200.1",   description="Administration out-of-band"),
        "BACKUP":     Network(name="BACKUP",         cidr="192.168.250.0/24", zone_id=zones["ZONE-BACKUP"].id,  vlan_id=250, gateway="192.168.250.1",   description="Réseau de sauvegarde"),
        "TRANSIT-A":  Network(name="TRANSIT-FW-RTR", cidr="10.0.0.0/30",      zone_id=zones["ZONE-MGMT"].id,    description="Transit FW-INTERNE ↔ RTR-CORE"),
        "TRANSIT-B":  Network(name="TRANSIT-DMZ",    cidr="10.0.0.4/30",      zone_id=zones["ZONE-MGMT"].id,    description="Transit FW-INTERNET ↔ RTR-CORE"),
    }
    for n in nets.values():
        db.add(n)
    db.flush()

    # ─── Équipements ──────────────────────────────────────────────────────────
    eqp = {
        "FW-INT-01":  Equipment(name="FW-INTERNET-01", type="firewall", vendor="stormshield", model="SNS-3100",   management_ip="192.168.200.10", team_id=teams["secu"].id,  physical_zone_id=pzones["baie-fw"].id,   description="Firewall périmétrique Internet — HA Master"),
        "FW-INT-02":  Equipment(name="FW-INTERNET-02", type="firewall", vendor="stormshield", model="SNS-3100",   management_ip="192.168.200.11", team_id=teams["secu"].id,  physical_zone_id=pzones["baie-fw"].id,   description="Firewall périmétrique Internet — HA Slave"),
        "FW-INT-PA":  Equipment(name="FW-INTERNE-01",  type="firewall", vendor="paloalto",    model="PA-3220",    management_ip="192.168.200.20", team_id=teams["secu"].id,  physical_zone_id=pzones["baie-fw"].id,   description="Firewall interne LAN↔Serveurs — HA Master"),
        "FW-INT-PA2": Equipment(name="FW-INTERNE-02",  type="firewall", vendor="paloalto",    model="PA-3220",    management_ip="192.168.200.21", team_id=teams["secu"].id,  physical_zone_id=pzones["baie-fw"].id,   description="Firewall interne LAN↔Serveurs — HA Slave"),
        "NSX-DFW":    Equipment(name="NSX-DFW",        type="nsx",      vendor="nsx",         model="NSX-T 3.2",  management_ip="192.168.200.30", team_id=teams["ops"].id,   physical_zone_id=pzones["baie-vmw"].id,  description="Distributed Firewall VMware NSX-T"),
        "RTR-CORE":   Equipment(name="RTR-CORE-01",    type="router",   vendor="juniper",     model="MX204",      management_ip="192.168.200.40", team_id=teams["infra"].id, physical_zone_id=pzones["baie-core"].id, description="Routeur cœur de réseau"),
        "RTR-DMZ":    Equipment(name="RTR-DMZ-01",     type="router",   vendor="juniper",     model="EX4300-48T", management_ip="192.168.200.41", team_id=teams["infra"].id, physical_zone_id=pzones["baie-core"].id, description="Switch L3 DMZ"),
        "FW-MGMT":    Equipment(name="FW-MGMT-01",     type="firewall", vendor="fortinet",    model="FG-100F",    management_ip="192.168.200.50", team_id=teams["secu"].id,  physical_zone_id=pzones["baie-fw"].id,   description="Firewall zone management"),
        "FW-CP":      Equipment(name="FW-CP-GW-01",    type="firewall", vendor="checkpoint",  model="CP-6200",    management_ip="192.168.200.60", team_id=teams["secu"].id,  physical_zone_id=pzones["baie-fw"].id,   description="Check Point — legacy datacenter est"),
    }
    for e in eqp.values():
        db.add(e)
    db.flush()

    # ─── Interfaces ───────────────────────────────────────────────────────────
    ifaces = [
        EquipmentInterface(equipment_id=eqp["FW-INT-01"].id, network_id=nets["DMZ-WEB"].id,    interface_name="eth0-DMZ",  ip_address="192.168.100.1",  role="downstream"),
        EquipmentInterface(equipment_id=eqp["FW-INT-01"].id, network_id=nets["TRANSIT-B"].id,  interface_name="eth1-WAN",  ip_address="10.0.0.6",       role="upstream"),
        EquipmentInterface(equipment_id=eqp["FW-INT-01"].id, network_id=nets["MGMT"].id,       interface_name="eth2-MGMT", ip_address="192.168.200.10", role="management"),
        EquipmentInterface(equipment_id=eqp["FW-INT-PA"].id, network_id=nets["LAN-BUREAU"].id, interface_name="Trust",     ip_address="10.10.0.1",      role="downstream"),
        EquipmentInterface(equipment_id=eqp["FW-INT-PA"].id, network_id=nets["LAN-WIFI"].id,   interface_name="WiFi",      ip_address="10.20.0.1",      role="downstream"),
        EquipmentInterface(equipment_id=eqp["FW-INT-PA"].id, network_id=nets["TRANSIT-A"].id,  interface_name="Untrust",   ip_address="10.0.0.2",       role="upstream"),
        EquipmentInterface(equipment_id=eqp["FW-INT-PA"].id, network_id=nets["MGMT"].id,       interface_name="MGMT",      ip_address="192.168.200.20", role="management"),
        EquipmentInterface(equipment_id=eqp["NSX-DFW"].id,   network_id=nets["SERV-APP"].id,   interface_name="seg-app",   ip_address="172.16.10.1",    role="downstream"),
        EquipmentInterface(equipment_id=eqp["NSX-DFW"].id,   network_id=nets["SERV-DB"].id,    interface_name="seg-db",    ip_address="172.16.20.1",    role="downstream"),
        EquipmentInterface(equipment_id=eqp["NSX-DFW"].id,   network_id=nets["SERV-FILE"].id,  interface_name="seg-file",  ip_address="172.16.30.1",    role="downstream"),
        EquipmentInterface(equipment_id=eqp["NSX-DFW"].id,   network_id=nets["TRANSIT-A"].id,  interface_name="uplink-T1", ip_address="10.0.0.3",       role="upstream"),
        EquipmentInterface(equipment_id=eqp["RTR-CORE"].id,  network_id=nets["TRANSIT-A"].id,  interface_name="ge-0/0/0",  ip_address="10.0.0.1",       role="downstream"),
        EquipmentInterface(equipment_id=eqp["RTR-CORE"].id,  network_id=nets["TRANSIT-B"].id,  interface_name="ge-0/0/1",  ip_address="10.0.0.5",       role="downstream"),
        EquipmentInterface(equipment_id=eqp["RTR-CORE"].id,  network_id=nets["MGMT"].id,       interface_name="ge-0/0/2",  ip_address="192.168.200.40", role="management"),
        EquipmentInterface(equipment_id=eqp["RTR-DMZ"].id,   network_id=nets["DMZ-WEB"].id,    interface_name="ge-0/0/0",  ip_address="192.168.100.2",  role="downstream"),
        EquipmentInterface(equipment_id=eqp["RTR-DMZ"].id,   network_id=nets["DMZ-MAIL"].id,   interface_name="ge-0/0/1",  ip_address="192.168.101.1",  role="downstream"),
        EquipmentInterface(equipment_id=eqp["RTR-DMZ"].id,   network_id=nets["TRANSIT-B"].id,  interface_name="ge-0/0/2",  ip_address="10.0.0.7",       role="upstream"),
        EquipmentInterface(equipment_id=eqp["FW-MGMT"].id,   network_id=nets["MGMT"].id,       interface_name="port1",     ip_address="192.168.200.50", role="downstream"),
        EquipmentInterface(equipment_id=eqp["FW-MGMT"].id,   network_id=nets["BACKUP"].id,     interface_name="port2",     ip_address="192.168.250.1",  role="downstream"),
        EquipmentInterface(equipment_id=eqp["FW-CP"].id,     network_id=nets["SERV-APP"].id,   interface_name="bond0.200", ip_address="172.16.10.254",  role="downstream"),
        EquipmentInterface(equipment_id=eqp["FW-CP"].id,     network_id=nets["TRANSIT-A"].id,  interface_name="bond0.mgmt",ip_address="10.0.0.4",       role="upstream"),
    ]
    for i in ifaces:
        db.add(i)
    db.flush()

    # ─── Liens de topologie ───────────────────────────────────────────────────
    links = [
        TopologyLink(equipment_a_id=eqp["RTR-CORE"].id,  equipment_b_id=eqp["FW-INT-PA"].id,  link_type="ethernet", description="Core → FW-LAN (10.0.0.0/30)"),
        TopologyLink(equipment_a_id=eqp["RTR-CORE"].id,  equipment_b_id=eqp["FW-INT-01"].id,  link_type="ethernet", description="Core → FW-INTERNET (10.0.0.4/30)"),
        TopologyLink(equipment_a_id=eqp["RTR-CORE"].id,  equipment_b_id=eqp["RTR-DMZ"].id,    link_type="ethernet", description="Core → RTR-DMZ"),
        TopologyLink(equipment_a_id=eqp["RTR-CORE"].id,  equipment_b_id=eqp["FW-MGMT"].id,    link_type="ethernet", description="Core → FW-MGMT"),
        TopologyLink(equipment_a_id=eqp["FW-INT-PA"].id, equipment_b_id=eqp["NSX-DFW"].id,    link_type="logical",  description="FW-LAN → NSX-DFW T1 Router"),
        TopologyLink(equipment_a_id=eqp["NSX-DFW"].id,   equipment_b_id=eqp["FW-CP"].id,      link_type="logical",  description="NSX-DFW → CP-GW (datacenter est)"),
        TopologyLink(equipment_a_id=eqp["FW-MGMT"].id,   equipment_b_id=eqp["NSX-DFW"].id,    link_type="logical",  description="MGMT → NSX management plane"),
    ]
    for lnk in links:
        db.add(lnk)
    db.flush()

    # ─── Règles de validation ─────────────────────────────────────────────────
    rules = [
        ValidationRule(name="Port Telnet interdit",   rule_type="port_restriction", severity="error",   active=True, blocked_ports="[23]",              message="Telnet (port 23) est interdit — utiliser SSH (22)"),
        ValidationRule(name="Port FTP déconseillé",   rule_type="port_restriction", severity="warning", active=True, blocked_ports="[21]",              message="FTP (port 21) est non chiffré — préférer SFTP/FTPS"),
        ValidationRule(name="Protocoles legacy",      rule_type="port_restriction", severity="error",   active=True, blocked_ports="[23,512,513,514]",  message="Protocoles non chiffrés interdits (rsh/rlogin/rexec)"),
        ValidationRule(name="Internet → LAN direct",  rule_type="zone_policy",      severity="error",   active=True, src_zone="INTERNET",        dst_zone="LAN-UTILISATEURS", action="block", message="Flux direct INTERNET → LAN-UTILISATEURS interdit"),
        ValidationRule(name="Internet → Serveurs",    rule_type="zone_policy",      severity="error",   active=True, src_zone="INTERNET",        dst_zone="ZONE-SERVEURS",    action="block", message="Accès direct INTERNET → ZONE-SERVEURS interdit (passer par DMZ)"),
        ValidationRule(name="LAN → BACKUP",           rule_type="zone_policy",      severity="error",   active=True, src_zone="LAN-UTILISATEURS",dst_zone="ZONE-BACKUP",      action="block", message="Accès LAN → ZONE-BACKUP interdit"),
        ValidationRule(name="DMZ → Serveurs",         rule_type="zone_policy",      severity="warning", active=True, src_zone="DMZ",             dst_zone="ZONE-SERVEURS",    action="warn",  message="Flux DMZ → ZONE-SERVEURS : vérifier cloisonnement applicatif"),
    ]
    for r in rules:
        db.add(r)
    db.flush()

    # ─── Historique de flux (démo) ────────────────────────────────────────────
    _p = lambda *hops: json.dumps({"hops": [{"equipment": h} for h in hops], "total_hops": len(hops)})
    demo_flows = [
        FlowRequest(created_at=datetime.utcnow()-timedelta(days=5),  src_ip="10.10.1.50",   dst_ip="172.16.10.100",  port="443",  protocol="tcp", application="SAP",            justification="Accès RH SAP",      status="deployed",  analyst="a.dupont",   team_id=teams["app"].id,   criticality="moyenne", sla="Standard",  bandwidth_max=10.0,  path_result=_p("FW-INTERNE-01","NSX-DFW")),
        FlowRequest(created_at=datetime.utcnow()-timedelta(days=3),  src_ip="10.10.2.100",  dst_ip="172.16.20.50",   port="5432", protocol="tcp", application="PostgreSQL",      justification="App legacy BDD",   status="validated", analyst="m.martin",   team_id=teams["app"].id,   criticality="haute",   sla="DB-SLA",    bandwidth_max=50.0,  path_result=_p("FW-INTERNE-01","NSX-DFW")),
        FlowRequest(created_at=datetime.utcnow()-timedelta(days=2),  src_ip="10.10.5.20",   dst_ip="192.168.100.50", port="80",   protocol="tcp", application="Portail intranet",justification="Accès intranet",   status="deployed",  analyst="a.dupont",   team_id=teams["infra"].id, criticality="basse",   sla="Web-Std",   bandwidth_max=5.0,   path_result=_p("FW-INTERNE-01","RTR-CORE-01","RTR-DMZ-01")),
        FlowRequest(created_at=datetime.utcnow()-timedelta(hours=6), src_ip="10.20.1.30",   dst_ip="10.10.5.0",      port="23",   protocol="tcp", application="Test Telnet",     justification="Test connectivité",status="rejected",  analyst="b.lefebvre", team_id=teams["ops"].id,   criticality="critique"),
        FlowRequest(created_at=datetime.utcnow()-timedelta(hours=2), src_ip="172.16.20.10", dst_ip="192.168.250.100",port="22",   protocol="tcp", application="Sauvegarde Oracle",justification="Backup nightly",  status="validated", analyst="m.martin",   team_id=teams["ops"].id,   criticality="haute",   sla="Backup-SLA",bandwidth_max=100.0, path_result=_p("NSX-DFW","RTR-CORE-01","FW-MGMT-01")),
        FlowRequest(created_at=datetime.utcnow()-timedelta(days=1),  src_ip="10.10.3.15",   dst_ip="172.16.10.200",  port="8080", protocol="tcp", application="API Gateway",     justification="Microservices",    status="deployed",  analyst="a.dupont",   team_id=teams["app"].id,   criticality="haute",   sla="API-SLA",   bandwidth_max=20.0,  path_result=_p("FW-INTERNE-01","NSX-DFW","FW-CP-GW-01")),
        FlowRequest(created_at=datetime.utcnow()-timedelta(hours=4), src_ip="192.168.100.10",dst_ip="172.16.10.50",  port="443",  protocol="tcp", application="Reverse Proxy",   justification="SSL offload",      status="deployed",  analyst="m.martin",   team_id=teams["infra"].id, criticality="moyenne", sla="Web-Std",   bandwidth_max=25.0,  path_result=_p("RTR-DMZ-01","RTR-CORE-01","FW-INTERNE-01","NSX-DFW")),
    ]
    for f in demo_flows:
        db.add(f)
    db.flush()

    # ─── VRF de démo ──────────────────────────────────────────────────────────
    vrfs = {
        "prod":    VRF(name="VRF Production",  rd="65000:1",   rt_import="65000:1",   rt_export="65000:1",   color="#22c55e",  description="VRF production applicatifs"),
        "voix":    VRF(name="VRF Voix",        rd="65000:10",  rt_import="65000:10",  rt_export="65000:10",  color="#8b5cf6",  description="VRF flux voix SIP/RTP"),
        "mgmt":    VRF(name="VRF Management",  rd="65000:99",  rt_import="65000:99",  rt_export="65000:99",  color="#f97316",  description="VRF OAM / management"),
        "backup":  VRF(name="VRF Backup",      rd="65000:50",  rt_import="65000:50",  rt_export="65000:50",  color="#64748b",  description="VRF sauvegardes"),
    }
    for v in vrfs.values():
        db.add(v)
    db.flush()

    # Assignation équipements → VRF
    vrf_members = {
        "prod":   ["FW-INTERNE-01", "NSX-DFW", "RTR-CORE-01", "FW-CP-GW-01"],
        "voix":   ["FW-INTERNE-01", "NSX-DFW", "RTR-DMZ-01"],
        "mgmt":   ["FW-MGMT-01", "RTR-CORE-01", "FW-INTERNET-01"],
        "backup": ["FW-MGMT-01", "RTR-CORE-01"],
    }
    eq_by_name = {e.name: e for e in eqp.values()}
    for vrf_key, members in vrf_members.items():
        for eq_name in members:
            eq = eq_by_name.get(eq_name)
            if eq:
                db.add(VRFEquipment(vrf_id=vrfs[vrf_key].id, equipment_id=eq.id))

    # ─── Applications (v2.9) ──────────────────────────────────────────────────
    apps_data = [
        dict(name="SAP ERP",           code="SAP-ERP",    app_type="ERP",              domain="Production",   criticality="Critique", environment="PROD",    team_id=teams["app"].id,   description="ERP métier RH/Finance/Achats",
             ips=[("172.16.10.100", zones["ZONE-SERVEURS"].id), ("172.16.10.101", zones["ZONE-SERVEURS"].id)]),
        dict(name="Portail Web nginx",  code="WEB-NGINX",  app_type="Web",              domain="Production",   criticality="Haute",    environment="PROD",    team_id=teams["infra"].id, description="Reverse proxy et portail intranet",
             ips=[("192.168.100.50", zones["DMZ"].id), ("192.168.100.51", zones["DMZ"].id)]),
        dict(name="PostgreSQL",         code="PG-MAIN",    app_type="Base de données",  domain="Production",   criticality="Critique", environment="PROD",    team_id=teams["app"].id,   description="Base de données applicatifs principaux",
             ips=[("172.16.20.50", zones["ZONE-SERVEURS"].id)]),
        dict(name="Zabbix Supervision", code="MON-ZABBIX", app_type="Supervision",      domain="Support",      criticality="Moyenne",  environment="PROD",    team_id=teams["ops"].id,   description="Monitoring réseau et serveurs",
             ips=[("192.168.200.100", zones["ZONE-MGMT"].id)]),
        dict(name="API Gateway",        code="API-GW",     app_type="API",              domain="Production",   criticality="Haute",    environment="PROD",    team_id=teams["app"].id,   description="Point d'entrée microservices",
             ips=[("172.16.10.200", zones["ZONE-SERVEURS"].id)]),
        dict(name="Serveur Messagerie", code="MAIL-SRV",   app_type="Télécom",          domain="Communication",criticality="Haute",    environment="PROD",    team_id=teams["infra"].id, description="Relais SMTP interne",
             ips=[("192.168.101.50", zones["DMZ"].id)]),
        dict(name="Veeam Backup",       code="BACKUP-VBR", app_type="Infrastructure",   domain="Support",      criticality="Haute",    environment="PROD",    team_id=teams["ops"].id,   description="Solution de sauvegarde Veeam B&R",
             ips=[("192.168.250.10", zones["ZONE-BACKUP"].id)]),
        dict(name="VMware vCenter",     code="VCENTER",    app_type="Virtualisation",   domain="Production",   criticality="Critique", environment="PROD",    team_id=teams["ops"].id,   description="Gestion infrastructure VMware",
             ips=[("192.168.200.80", zones["ZONE-MGMT"].id)]),
        dict(name="ServiceNow ITSM",    code="SNOW",       app_type="ITSM",             domain="Support",      criticality="Moyenne",  environment="PROD",    team_id=teams["secu"].id,  description="Gestion des incidents et changements",
             ips=[("10.10.5.100", zones["LAN-USERS"].id)]),
        dict(name="App RH (Preprod)",   code="RH-APP-PPD", app_type="Web",              domain="Production",   criticality="Faible",   environment="PREPROD1",team_id=teams["app"].id,   description="Application RH en cours de recette",
             ips=[("172.16.10.150", zones["ZONE-SERVEURS"].id)]),
    ]
    for app_d in apps_data:
        ips_list = app_d.pop("ips", [])
        app = Application(**app_d)
        db.add(app)
        db.flush()
        for ip_addr, zone_id in ips_list:
            db.add(ApplicationIP(application_id=app.id, ip_address=ip_addr, zone_id=zone_id))

    db.commit()

    # Environnements : délégué à seed_default_environments() (indépendant)

    print("[seed] Base initialisée avec données de démo v2.9.1 (overlays: flux, routes, VRF; applications; environnements)")


DEFAULT_ENVIRONMENTS = [
    dict(name='INT',   description="Environnement d'intégration / tests",   color='#64748b'),
    dict(name='PPROD1', description='Préproduction — recette fonctionnelle', color='#f97316'),
    dict(name='PPROD2', description='Préproduction — validation technique',  color='#eab308'),
    dict(name='PROD',  description='Environnement de production',            color='#22c55e'),
]
OLD_ENV_NAMES = {'Intégration', 'Préproduction', 'Production'}


def seed_default_environments(db):
    """
    Injecte les 4 environnements de référence (INT, PPROD1, PPROD2, PROD).
    - Supprime les anciens noms courts (Intégration, Préproduction, Production) s'ils existent
      et qu'aucun environnement INT/PPROD1/PPROD2/PROD n'existe encore.
    - Idempotent : ne fait rien si INT est déjà présent.
    """
    existing_names = {e.name for e in db.query(Environment).all()}
    if 'INT' in existing_names:
        return  # déjà initialisés

    # Supprimer les anciens envs de seed si présents (pas de FK sur Application.environment)
    for old_name in OLD_ENV_NAMES:
        if old_name in existing_names:
            old_env = db.query(Environment).filter(Environment.name == old_name).first()
            if old_env:
                db.delete(old_env)

    for env_data in DEFAULT_ENVIRONMENTS:
        if env_data['name'] not in existing_names:
            db.add(Environment(**env_data))
    db.commit()
    print("[seed] Environnements de référence injectés (INT, PPROD1, PPROD2, PROD)")


def seed_demo_routes(db):
    """
    Injecte des routes de démo utilisant les IPs d'interfaces (transit links) comme gateway.
    La résolution gateway_equipment dans overlay/routes cherche dans les IPs d'interfaces,
    ce qui permet d'afficher les flèches entre équipements sur le graphe.
    Exécuté indépendamment du seed principal — fonctionne sur une base déjà initialisée.
    """
    if db.query(RoutingEntry).count() > 0:
        return

    eq_by_name = {e.name: e for e in db.query(Equipment).all()}
    if not eq_by_name:
        return  # DB vide, le seed principal n'a pas encore tourné

    # IPs transit (voir EquipmentInterface en seed) :
    # TRANSIT-A : RTR-CORE=10.0.0.1, FW-INTERNE-01=10.0.0.2, NSX-DFW=10.0.0.3, FW-CP=10.0.0.4
    # TRANSIT-B : RTR-CORE=10.0.0.5, FW-INTERNET-01=10.0.0.6, RTR-DMZ=10.0.0.7

    def route(eq_name, destination, gateway, route_type="static", metric=1, interface="", comment=""):
        eq = eq_by_name.get(eq_name)
        if not eq:
            return None
        return RoutingEntry(
            equipment_id=eq.id, destination=destination, gateway=gateway,
            route_type=route_type, metric=metric, interface=interface, comment=comment,
        )

    demo_routes = [
        # RTR-CORE-01 : cœur de réseau, voit tout
        route("RTR-CORE-01", "0.0.0.0/0",        "10.0.0.6",          "static", 1,   "ge-0/0/1",  "Default via FW-INTERNET-01 WAN"),
        route("RTR-CORE-01", "10.0.0.0/8",        "10.0.0.2",          "ospf",   10,  "ge-0/0/0",  "LAN utilisateurs via FW-INTERNE-01"),
        route("RTR-CORE-01", "172.16.0.0/12",     "10.0.0.2",          "ospf",   10,  "ge-0/0/0",  "Zone serveurs via FW-INTERNE-01"),
        route("RTR-CORE-01", "192.168.100.0/23",  "10.0.0.7",          "static", 1,   "ge-0/0/1",  "DMZ via RTR-DMZ-01"),
        route("RTR-CORE-01", "192.168.250.0/24",  "192.168.200.50",    "static", 5,   "ge-0/0/2",  "Zone Backup via FW-MGMT-01"),
        # FW-INTERNE-01 : firewall LAN ↔ Serveurs
        route("FW-INTERNE-01", "0.0.0.0/0",       "10.0.0.1",          "static", 1,   "Untrust",   "Default via RTR-CORE-01"),
        route("FW-INTERNE-01", "172.16.10.0/24",   "10.0.0.3",          "ospf",   20,  "Untrust",   "SERV-APP via NSX-DFW"),
        route("FW-INTERNE-01", "172.16.20.0/24",   "10.0.0.3",          "ospf",   20,  "Untrust",   "SERV-DB via NSX-DFW"),
        # NSX-DFW : distributed firewall
        route("NSX-DFW",     "0.0.0.0/0",          "10.0.0.2",          "bgp",    100, "uplink-T1", "Default via FW-INTERNE-01"),
        route("NSX-DFW",     "10.10.0.0/16",       "10.0.0.2",          "bgp",    100, "uplink-T1", "LAN bureautique via FW-INTERNE-01"),
        route("NSX-DFW",     "172.16.30.0/24",     "10.0.0.4",          "bgp",    100, "uplink-T1", "SERV-FILE via FW-CP-GW-01"),
        # FW-INTERNET-01 : firewall périmétrique
        route("FW-INTERNET-01", "0.0.0.0/0",       "80.0.0.254",        "static", 1,   "eth1-WAN",  "Default route Internet"),
        route("FW-INTERNET-01", "10.0.0.0/8",      "10.0.0.5",          "static", 1,   "eth1-WAN",  "LAN interne via RTR-CORE-01"),
        route("FW-INTERNET-01", "172.16.0.0/12",   "10.0.0.5",          "static", 1,   "eth1-WAN",  "Zone serveurs via RTR-CORE-01"),
        # RTR-DMZ-01 : switch L3 DMZ
        route("RTR-DMZ-01",  "0.0.0.0/0",          "10.0.0.5",          "static", 1,   "ge-0/0/2",  "Default via RTR-CORE-01"),
        route("RTR-DMZ-01",  "10.0.0.0/8",         "10.0.0.5",          "static", 5,   "ge-0/0/2",  "LAN interne via RTR-CORE-01"),
        # FW-MGMT-01 : firewall management
        route("FW-MGMT-01",  "0.0.0.0/0",          "192.168.200.40",    "static", 1,   "port1",     "Default via RTR-CORE-01 (management IP)"),
        route("FW-MGMT-01",  "192.168.0.0/16",     "192.168.200.40",    "static", 1,   "port1",     "RFC1918 /16 via RTR-CORE-01"),
        # FW-CP-GW-01 : legacy datacenter
        route("FW-CP-GW-01", "0.0.0.0/0",          "10.0.0.3",          "bgp",    200, "bond0.mgmt","Default via NSX-DFW"),
        route("FW-CP-GW-01", "192.168.200.0/24",   "10.0.0.3",          "bgp",    200, "bond0.mgmt","MGMT via NSX-DFW"),
    ]

    for r in demo_routes:
        if r:
            db.add(r)
    db.commit()
    print("[seed] Routes de démo injectées (static/ospf/bgp entre équipements)")
