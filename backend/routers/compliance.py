"""
Connecteur de conformité (v2.8.2).

Expose le moteur générique via l'interface ComplianceProvider. L'implémentation
locale (LocalEngineProvider) peut être remplacée par un client HTTP vers un
moteur externe sans toucher à ce router.

Endpoints :
- GET  /compliance/sources              → sources de référence (profils OSCAL)
- GET  /compliance/catalog              → métadonnées de gouvernance du catalogue
- GET  /compliance/controls?source=     → contrôles chargés pour une source
- POST /compliance/evaluate             → évalue un sujet arbitraire (réutilisable)
- POST /compliance/evaluate/flow/{id}   → évalue un flux existant (sujet construit)
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
import models
from compliance import ComplianceProvider, default_provider, build_flow_subject
from engine.validator import validate_flow
from engine.path_finder import find_path

router = APIRouter()


def get_provider() -> ComplianceProvider:
    return default_provider


# ── Lecture du catalogue / sources ─────────────────────────────────────────────

@router.get("/sources")
def list_sources(provider: ComplianceProvider = Depends(get_provider)):
    cat = provider.catalog  # type: ignore[attr-defined]
    return [
        {
            "id": s.id,
            "title": s.title,
            "framework": s.framework,
            "version": s.version,
            "source_version": s.source_version,
            "control_count": len(s.control_ids),
        }
        for s in cat.list_sources()
    ]


@router.get("/catalog")
def catalog_meta(provider: ComplianceProvider = Depends(get_provider)):
    cat = provider.catalog  # type: ignore[attr-defined]
    return {
        **cat.catalog_meta,
        "total_controls": len(cat.all_controls()),
        "sources": [s.id for s in cat.list_sources()],
    }


@router.get("/controls")
def list_controls(source: Optional[str] = None,
                  subject_type: Optional[str] = None,
                  provider: ComplianceProvider = Depends(get_provider)):
    cat = provider.catalog  # type: ignore[attr-defined]
    try:
        controls = cat.controls_for(source=source, subject_type=subject_type)
    except KeyError as exc:
        raise HTTPException(404, str(exc))
    return [
        {
            "id": c.id, "label": c.label, "title": c.title, "group": c.group,
            "severity": c.severity, "subject_type": c.subject_type, "version": c.version,
            "frameworks": c.frameworks, "statement": c.statement, "guidance": c.guidance,
            "expression": c.violation_when,
            "citations": [{"title": x.title, "text": x.text, "source_version": x.source_version}
                          for x in c.citations],
        }
        for c in controls
    ]


# ── Évaluation ─────────────────────────────────────────────────────────────────

class SubjectIn(BaseModel):
    subject: dict
    source: Optional[str] = None


@router.post("/evaluate")
def evaluate_subject(body: SubjectIn,
                     provider: ComplianceProvider = Depends(get_provider)):
    """Évalue un sujet arbitraire — point d'entrée générique réutilisable."""
    try:
        report = provider.evaluate(body.subject, source=body.source)
    except KeyError as exc:
        raise HTTPException(404, str(exc))
    return report.to_dict()


@router.post("/evaluate/flow/{flow_id}")
def evaluate_flow(flow_id: int, source: Optional[str] = None,
                  db: Session = Depends(get_db),
                  provider: ComplianceProvider = Depends(get_provider)):
    flow = db.query(models.FlowRequest).filter(models.FlowRequest.id == flow_id).first()
    if flow is None:
        raise HTTPException(404, "Flux introuvable")
    # Sujet construit sur le chemin réel calculé
    validation = validate_flow(flow.src_ip, flow.dst_ip, flow.port, flow.protocol or "tcp", db)
    path = find_path(flow.src_ip, flow.dst_ip, db) if validation.get("valid") else {}
    subject = build_flow_subject(
        db, flow.src_ip, flow.dst_ip, flow.port, flow.protocol or "tcp",
        validation.get("src_zone"), validation.get("dst_zone"), path.get("hops", []),
    )
    try:
        report = provider.evaluate(subject, source=source)
    except KeyError as exc:
        raise HTTPException(404, str(exc))
    result = report.to_dict()
    result["subject"] = subject
    result["flow"] = {"id": flow.id, "src_ip": flow.src_ip, "dst_ip": flow.dst_ip,
                      "port": flow.port, "protocol": flow.protocol}
    return result
