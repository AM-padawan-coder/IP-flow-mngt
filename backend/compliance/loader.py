"""
Chargement et résolution des catalogues / profils OSCAL.

- Le CATALOGUE contient l'intégralité des contrôles.
- Un PROFIL (= une « source de référence » : NIS2, ANSSI, CIS…) sélectionne un
  sous-ensemble de contrôles via `include-controls`. C'est le mécanisme qui
  permet de « ne pas tout charger » : on évalue uniquement les contrôles de la
  source choisie.

Le loader convertit le JSON OSCAL (verbeux) en objets internes simples
(Control, Source) que le moteur consomme.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

NS = "https://ip-flow-manager/ns/oscal"

_BASE = Path(__file__).parent
_CATALOG_DIR = _BASE / "catalogs"
_PROFILE_DIR = _BASE / "profiles"


@dataclass
class Citation:
    title: str
    text: str
    source_version: Optional[str] = None


@dataclass
class Control:
    id: str
    label: str
    title: str
    group: str
    severity: str
    subject_type: str
    version: str
    violation_when: str
    frameworks: list[str] = field(default_factory=list)
    statement: str = ""
    guidance: str = ""
    citations: list[Citation] = field(default_factory=list)


@dataclass
class Source:
    id: str            # slug dérivé du nom de fichier, ex. "nis2"
    title: str
    framework: str
    version: str
    source_version: str
    control_ids: list[str]


def _prop(props: list[dict], name: str, default: str = "") -> str:
    for p in props or []:
        if p.get("name") == name:
            return p.get("value", default)
    return default


def _props_all(props: list[dict], name: str) -> list[str]:
    return [p.get("value") for p in (props or []) if p.get("name") == name]


def _part(parts: list[dict], name: str) -> str:
    for p in parts or []:
        if p.get("name") == name:
            return p.get("prose", "")
    return ""


class ComplianceCatalog:
    """Catalogue OSCAL chargé en mémoire + profils (sources) disponibles."""

    def __init__(self, catalog_file: str = "catalog-network-flows.oscal.json"):
        self._controls: dict[str, Control] = {}
        self._sources: dict[str, Source] = {}
        self.catalog_meta: dict = {}
        self._resources: dict[str, Citation] = {}
        self._load_catalog(_CATALOG_DIR / catalog_file)
        self._load_profiles()

    # ── Catalogue ────────────────────────────────────────────────────────────
    def _load_catalog(self, path: Path):
        data = json.loads(path.read_text())["catalog"]
        meta = data.get("metadata", {})
        self.catalog_meta = {
            "title": meta.get("title"),
            "version": meta.get("version"),
            "oscal_version": meta.get("oscal-version"),
            "last_modified": meta.get("last-modified"),
            "review_cadence": _prop(meta.get("props", []), "review-cadence"),
            "next_review": _prop(meta.get("props", []), "next-review"),
            "status": _prop(meta.get("props", []), "status"),
            "owner": self._owner(meta),
        }

        # back-matter resources → citations indexées par uuid
        for res in data.get("back-matter", {}).get("resources", []):
            self._resources["#" + res["uuid"]] = Citation(
                title=res.get("title", ""),
                text=res.get("citation", {}).get("text", ""),
                source_version=_prop(res.get("props", []), "source-version"),
            )

        for group in data.get("groups", []):
            for ctrl in group.get("controls", []):
                self._controls[ctrl["id"]] = self._parse_control(ctrl, group)

    def _owner(self, meta: dict) -> str:
        parties = {p["uuid"]: p.get("name") for p in meta.get("parties", [])}
        for rp in meta.get("responsible-parties", []):
            if rp.get("role-id") == "catalog-owner":
                uuids = rp.get("party-uuids", [])
                if uuids:
                    return parties.get(uuids[0], "")
        return ""

    def _parse_control(self, ctrl: dict, group: dict) -> Control:
        props = ctrl.get("props", [])
        citations = []
        for link in ctrl.get("links", []):
            if link.get("rel") == "reference":
                cit = self._resources.get(link.get("href"))
                if cit:
                    citations.append(cit)
                else:
                    citations.append(Citation(title=link.get("text", ""), text=link.get("text", "")))
        return Control(
            id=ctrl["id"],
            label=_prop(props, "label", ctrl["id"].upper()),
            title=ctrl.get("title", ""),
            group=group.get("title", group.get("id", "")),
            severity=_prop(props, "severity", "medium"),
            subject_type=_prop(props, "subject-type", "flow"),
            version=_prop(props, "version", "1.0.0"),
            violation_when=_prop(props, "violation-when"),
            frameworks=_props_all(props, "framework"),
            statement=_part(ctrl.get("parts", []), "statement"),
            guidance=_part(ctrl.get("parts", []), "guidance"),
            citations=citations,
        )

    # ── Profils (sources) ──────────────────────────────────────────────────────
    def _load_profiles(self):
        for path in sorted(_PROFILE_DIR.glob("profile-*.json")):
            data = json.loads(path.read_text())["profile"]
            meta = data.get("metadata", {})
            slug = path.stem.replace("profile-", "").replace(".oscal", "")
            ids: list[str] = []
            for imp in data.get("imports", []):
                for inc in imp.get("include-controls", []):
                    ids.extend(inc.get("with-ids", []))
            self._sources[slug] = Source(
                id=slug,
                title=meta.get("title", slug),
                framework=_prop(meta.get("props", []), "framework", slug.upper()),
                version=meta.get("version", "1.0.0"),
                source_version=_prop(meta.get("props", []), "source-version"),
                control_ids=ids,
            )

    # ── API publique ───────────────────────────────────────────────────────────
    def list_sources(self) -> list[Source]:
        return list(self._sources.values())

    def all_controls(self) -> list[Control]:
        return list(self._controls.values())

    def controls_for(self, source: Optional[str] = None,
                     subject_type: Optional[str] = None) -> list[Control]:
        """Contrôles d'une source donnée (ou tous si source=None),
        filtrés optionnellement par type de sujet (réutilisabilité)."""
        if source:
            src = self._sources.get(source)
            if src is None:
                raise KeyError(f"source inconnue : {source}")
            controls = [self._controls[cid] for cid in src.control_ids if cid in self._controls]
        else:
            controls = self.all_controls()
        if subject_type:
            controls = [c for c in controls if c.subject_type == subject_type]
        return controls
