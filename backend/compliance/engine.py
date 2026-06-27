"""
Moteur de conformité générique.

Conception :
- `ComplianceProvider` est l'interface (Protocol). Le reste de l'application ne
  dépend que d'elle → on peut remplacer l'implémentation locale par un moteur
  HTTP externe sans rien changer ailleurs.
- `LocalEngineProvider` est l'implémentation de référence : elle évalue les
  `violation-when` du catalogue OSCAL contre un sujet, via l'évaluateur sûr.
- Le sujet est un simple dict de faits → le moteur est réutilisable pour
  d'autres usages que les flux (équipements, configurations, etc.).

Gouvernance / traçabilité : chaque finding embarque l'identifiant ET la version
du contrôle appliqué, la version du catalogue et la source — de quoi rejouer et
auditer un verdict a posteriori.
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Optional, Protocol
import uuid

from .evaluator import evaluate_expression, ExpressionError
from .loader import ComplianceCatalog, Control


@dataclass
class Finding:
    control_id: str
    control_label: str
    control_version: str
    title: str
    group: str
    severity: str
    status: str = "error"             # "satisfied" | "not-satisfied" | "error"
    frameworks: list[str] = field(default_factory=list)
    statement: str = ""
    guidance: str = ""
    citations: list[dict] = field(default_factory=list)
    expression: str = ""
    detail: str = ""


@dataclass
class ComplianceReport:
    uuid: str
    evaluated_at: str
    subject_type: str
    source: Optional[str]
    catalog_version: str
    summary: dict
    findings: list[Finding] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        return d


class ComplianceProvider(Protocol):
    """Interface stable. Implémentée localement ici, ou par un client HTTP
    pointant vers un moteur externe — au choix, sans impact sur les appelants."""

    def evaluate(self, subject: dict, source: Optional[str] = None) -> ComplianceReport: ...


class LocalEngineProvider:
    """Implémentation de référence in-process."""

    def __init__(self, catalog: Optional[ComplianceCatalog] = None):
        self.catalog = catalog or ComplianceCatalog()

    def evaluate(self, subject: dict, source: Optional[str] = None) -> ComplianceReport:
        subject_type = subject.get("subject_type", "flow")
        controls = self.catalog.controls_for(source=source, subject_type=subject_type)
        findings = [self._evaluate_control(c, subject) for c in controls]

        violations = sum(1 for f in findings if f.status == "not-satisfied")
        errors = sum(1 for f in findings if f.status == "error")
        satisfied = sum(1 for f in findings if f.status == "satisfied")
        by_severity: dict[str, int] = {}
        for f in findings:
            if f.status == "not-satisfied":
                by_severity[f.severity] = by_severity.get(f.severity, 0) + 1

        return ComplianceReport(
            uuid=str(uuid.uuid4()),
            evaluated_at=datetime.now(timezone.utc).isoformat(),
            subject_type=subject_type,
            source=source,
            catalog_version=self.catalog.catalog_meta.get("version", ""),
            summary={
                "total": len(findings),
                "satisfied": satisfied,
                "violations": violations,
                "errors": errors,
                "violations_by_severity": by_severity,
                "compliant": violations == 0 and errors == 0,
            },
            findings=findings,
        )

    def _evaluate_control(self, c: Control, subject: dict) -> Finding:
        base = Finding(
            control_id=c.id,
            control_label=c.label,
            control_version=c.version,
            title=c.title,
            group=c.group,
            severity=c.severity,
            frameworks=c.frameworks,
            statement=c.statement,
            guidance=c.guidance,
            citations=[{"title": cit.title, "text": cit.text, "source_version": cit.source_version}
                       for cit in c.citations],
            expression=c.violation_when,
        )
        try:
            violated = evaluate_expression(c.violation_when, subject)
            base.status = "not-satisfied" if violated else "satisfied"
        except ExpressionError as exc:
            base.status = "error"
            base.detail = str(exc)
        return base
