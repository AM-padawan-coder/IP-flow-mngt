from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, ForeignKey
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
