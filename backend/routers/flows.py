import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import FlowRequest
from engine.validator import validate_flow
from engine.path_finder import find_path
from engine.script_generator import generate_scripts

router = APIRouter()


class StatusUpdate(BaseModel):
    status: str  # pending, validated, deployed, rejected


class FlowIn(BaseModel):
    src_ip: str
    dst_ip: str
    port: str
    protocol: str = "tcp"
    application: str = ""
    justification: str = ""
    analyst: str = "demo-user"


@router.post("/analyze")
def analyze_flow(data: FlowIn, db: Session = Depends(get_db)):
    """Analyse un flux sans le persister — pour l'aperçu temps réel."""
    validation = validate_flow(data.src_ip, data.dst_ip, data.port, data.protocol, db)
    path = {}
    scripts = {}

    if validation["valid"]:
        path = find_path(data.src_ip, data.dst_ip, db)
        if path.get("found"):
            scripts = generate_scripts(
                src_ip=data.src_ip,
                dst_ip=data.dst_ip,
                port=data.port,
                protocol=data.protocol,
                application=data.application,
                justification=data.justification,
                src_zone=validation.get("src_zone"),
                dst_zone=validation.get("dst_zone"),
                path_hops=path.get("hops", []),
            )

    return {"validation": validation, "path": path, "scripts": scripts}


@router.post("", status_code=201)
def submit_flow(data: FlowIn, db: Session = Depends(get_db)):
    """Soumet et persiste une demande de flux."""
    validation = validate_flow(data.src_ip, data.dst_ip, data.port, data.protocol, db)
    path = {}
    scripts = {}

    if validation["valid"]:
        path = find_path(data.src_ip, data.dst_ip, db)
        if path.get("found"):
            scripts = generate_scripts(
                src_ip=data.src_ip,
                dst_ip=data.dst_ip,
                port=data.port,
                protocol=data.protocol,
                application=data.application,
                justification=data.justification,
                src_zone=validation.get("src_zone"),
                dst_zone=validation.get("dst_zone"),
                path_hops=path.get("hops", []),
            )

    status = "pending"
    flow = FlowRequest(
        src_ip=data.src_ip,
        dst_ip=data.dst_ip,
        port=data.port,
        protocol=data.protocol,
        application=data.application,
        justification=data.justification,
        analyst=data.analyst,
        status=status,
        validation_result=json.dumps(validation),
        path_result=json.dumps(path),
        scripts_result=json.dumps(scripts),
    )
    db.add(flow)
    db.commit()
    db.refresh(flow)

    return {
        "id": flow.id,
        "status": status,
        "validation": validation,
        "path": path,
        "scripts": scripts,
    }


@router.get("")
def list_flows(db: Session = Depends(get_db)):
    flows = db.query(FlowRequest).order_by(FlowRequest.created_at.desc()).all()
    result = []
    for f in flows:
        result.append({
            "id": f.id,
            "created_at": f.created_at.isoformat(),
            "src_ip": f.src_ip,
            "dst_ip": f.dst_ip,
            "port": f.port,
            "protocol": f.protocol,
            "application": f.application,
            "status": f.status,
            "analyst": f.analyst,
        })
    return result


@router.get("/{flow_id}")
def get_flow(flow_id: int, db: Session = Depends(get_db)):
    flow = db.query(FlowRequest).filter(FlowRequest.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flux non trouvé")
    return {
        "id": flow.id,
        "created_at": flow.created_at.isoformat(),
        "src_ip": flow.src_ip,
        "dst_ip": flow.dst_ip,
        "port": flow.port,
        "protocol": flow.protocol,
        "application": flow.application,
        "justification": flow.justification,
        "status": flow.status,
        "analyst": flow.analyst,
        "validation": json.loads(flow.validation_result or "{}"),
        "path": json.loads(flow.path_result or "{}"),
        "scripts": json.loads(flow.scripts_result or "{}"),
    }


@router.patch("/{flow_id}/status")
def update_flow_status(flow_id: int, data: StatusUpdate, db: Session = Depends(get_db)):
    flow = db.query(FlowRequest).filter(FlowRequest.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flux non trouvé")
    allowed = {"pending", "validated", "deployed", "rejected"}
    if data.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Statut invalide. Valeurs : {allowed}")
    flow.status = data.status
    db.commit()
    return {"id": flow_id, "status": data.status}


@router.delete("/{flow_id}", status_code=204)
def delete_flow(flow_id: int, db: Session = Depends(get_db)):
    flow = db.query(FlowRequest).filter(FlowRequest.id == flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flux non trouvé")
    db.delete(flow)
    db.commit()


@router.get("/audit/summary")
def audit_summary(db: Session = Depends(get_db)):
    total = db.query(FlowRequest).count()
    validated = db.query(FlowRequest).filter(FlowRequest.status == "validated").count()
    deployed = db.query(FlowRequest).filter(FlowRequest.status == "deployed").count()
    rejected = db.query(FlowRequest).filter(FlowRequest.status == "rejected").count()
    pending = db.query(FlowRequest).filter(FlowRequest.status == "pending").count()

    # Top applications
    all_flows = db.query(FlowRequest).all()
    app_counts = {}
    for f in all_flows:
        app = f.application or "Non spécifiée"
        app_counts[app] = app_counts.get(app, 0) + 1
    top_apps = sorted(app_counts.items(), key=lambda x: -x[1])[:5]

    # Top analysts
    analyst_counts = {}
    for f in all_flows:
        a = f.analyst or "inconnu"
        analyst_counts[a] = analyst_counts.get(a, 0) + 1
    top_analysts = sorted(analyst_counts.items(), key=lambda x: -x[1])[:5]

    return {
        "total": total,
        "validated": validated,
        "deployed": deployed,
        "rejected": rejected,
        "pending": pending,
        "top_applications": [{"name": a, "count": c} for a, c in top_apps],
        "top_analysts": [{"name": a, "count": c} for a, c in top_analysts],
    }
