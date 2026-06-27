"""Socle de conformité — catalogue OSCAL + moteur générique réutilisable."""

from .loader import ComplianceCatalog, Control, Source
from .engine import LocalEngineProvider, ComplianceProvider, ComplianceReport, Finding
from .evaluator import evaluate_expression, ExpressionError
from .subject import build_flow_subject

# Provider partagé (catalogue chargé une seule fois). Peut être remplacé par un
# HttpEngineProvider pour brancher un moteur externe, sans impact sur les routers.
default_provider = LocalEngineProvider()

__all__ = [
    "ComplianceCatalog", "Control", "Source",
    "LocalEngineProvider", "ComplianceProvider", "ComplianceReport", "Finding",
    "evaluate_expression", "ExpressionError",
    "build_flow_subject", "default_provider",
]
