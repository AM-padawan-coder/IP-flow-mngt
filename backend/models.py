from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Zone(Base):
    __tablename__ = "zones"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    color = Column(String, default="#64748b")
    description = Column(String)
    trust_level = Column(Integer, default=50)
    zone_type = Column(String, default="logical")   # logical | physical
    datacenter_id = Column(Integer, ForeignKey("physical_zones.id"), nullable=True)
    networks = relationship("Network", back_populates="zone")


class PhysicalZone(Base):
    __tablename__ = "physical_zones"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    type = Column(String, default="datacenter")     # datacenter | salle | baie | local
    parent_id = Column(Integer, ForeignKey("physical_zones.id"), nullable=True)
    description = Column(String)
    location = Column(String)


class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String)
    contact = Column(String)
    color = Column(String, default="#3b82f6")


class Equipment(Base):
    __tablename__ = "equipment"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    type = Column(String)       # firewall, router, switch, nsx
    vendor = Column(String)     # stormshield, paloalto, juniper, nsx, fortinet, checkpoint
    model = Column(String)
    management_ip = Column(String)
    description = Column(String)
    active = Column(Boolean, default=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    physical_zone_id = Column(Integer, ForeignKey("physical_zones.id"), nullable=True)
    logical_zone_id  = Column(Integer, ForeignKey("zones.id"), nullable=True)
    interfaces = relationship("EquipmentInterface", back_populates="equipment", cascade="all, delete-orphan")


class Network(Base):
    __tablename__ = "networks"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    cidr = Column(String, nullable=False)
    zone_id = Column(Integer, ForeignKey("zones.id"))
    vlan_id = Column(Integer, nullable=True)
    gateway = Column(String)
    description = Column(String)
    zone = relationship("Zone", back_populates="networks")
    interfaces = relationship("EquipmentInterface", back_populates="network", cascade="all, delete-orphan")


class EquipmentInterface(Base):
    __tablename__ = "equipment_interfaces"
    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"))
    network_id = Column(Integer, ForeignKey("networks.id"))
    interface_name = Column(String)
    ip_address = Column(String)
    role = Column(String)
    equipment = relationship("Equipment", back_populates="interfaces")
    network = relationship("Network", back_populates="interfaces")


class TopologyLink(Base):
    __tablename__ = "topology_links"
    id = Column(Integer, primary_key=True, index=True)
    equipment_a_id = Column(Integer, ForeignKey("equipment.id"))
    equipment_b_id = Column(Integer, ForeignKey("equipment.id"))
    link_type = Column(String, default="ethernet")
    description = Column(String)


class ValidationRule(Base):
    __tablename__ = "validation_rules"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    rule_type = Column(String)
    severity = Column(String, default="error")
    active = Column(Boolean, default=True)
    blocked_ports = Column(Text)
    src_zone = Column(String)
    dst_zone = Column(String)
    action = Column(String)
    message = Column(String)


class RoutingEntry(Base):
    __tablename__ = "routing_entries"
    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)
    destination = Column(String, nullable=False)
    gateway = Column(String)
    interface = Column(String)
    metric = Column(Integer, default=1)
    route_type = Column(String, default="static")   # static | ospf | bgp | connected
    comment = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class AclRule(Base):
    __tablename__ = "acl_rules"
    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)
    priority = Column(Integer, default=100)
    name = Column(String)
    direction = Column(String, default="in")        # in | out | both
    action = Column(String, default="permit")       # permit | deny
    src_ip = Column(String, default="any")
    dst_ip = Column(String, default="any")
    port = Column(String, default="any")
    protocol = Column(String, default="any")
    comment = Column(String)
    flow_id = Column(Integer, ForeignKey("flow_requests.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class PolicyEvent(Base):
    __tablename__ = "policy_events"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    event_type = Column(String)   # route_created, route_deleted, acl_created, acl_deleted
    equipment_id = Column(Integer, nullable=True)
    equipment_name = Column(String)
    description = Column(String)
    entity_id = Column(Integer, nullable=True)
    analyst = Column(String, default="demo-user")


class FlowRequest(Base):
    __tablename__ = "flow_requests"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    src_ip = Column(String, nullable=False)
    dst_ip = Column(String, nullable=False)
    port = Column(String, nullable=False)
    protocol = Column(String, default="tcp")
    application = Column(String)
    justification = Column(String)
    status = Column(String, default="pending")
    analyst = Column(String, default="demo-user")
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    validation_result = Column(Text)
    path_result = Column(Text)
    scripts_result = Column(Text)
    # v2.6 overlay fields
    criticality = Column(String, nullable=True)   # critique | haute | moyenne | basse
    sla = Column(String, nullable=True)
    bandwidth_max = Column(Float, nullable=True)
    vrf_name = Column(String, nullable=True)


class VRF(Base):
    __tablename__ = "vrfs"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    rd = Column(String)
    rt_import = Column(String)
    rt_export = Column(String)
    description = Column(String)
    color = Column(String, default="#3b82f6")
    created_at = Column(DateTime, default=datetime.utcnow)


class VRFEquipment(Base):
    __tablename__ = "vrf_equipment"
    id = Column(Integer, primary_key=True, index=True)
    vrf_id = Column(Integer, ForeignKey("vrfs.id"), nullable=False)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False)
