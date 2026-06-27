# Socle de conformité — Catalogue OSCAL & moteur générique

Version : **1.0.0** · Format : **OSCAL 1.1.2** · Statut : *socle d'exemple à valider par un expert*

## Vue d'ensemble

```
catalogs/catalog-network-flows.oscal.json   ← TOUS les contrôles (catalogue OSCAL)
profiles/profile-<source>.oscal.json        ← sélection par source (profils OSCAL)
loader.py        ← parse OSCAL → objets internes ; résout une source en sous-ensemble
evaluator.py     ← évaluateur d'expressions sûr (ast, sans eval)
engine.py        ← ComplianceProvider (interface) + LocalEngineProvider (réf.)
../routers/compliance.py  ← API REST
```

Le verdict est **déterministe** : le moteur évalue les expressions `violation-when`
du catalogue contre un *sujet*. Aucun LLM n'intervient dans la décision.

## Sélection de la source (« ne pas tout charger »)

Chaque **profil OSCAL** = une source de référence (NIS2, ANSSI, CIS…). Un profil
`include-controls` un sous-ensemble du catalogue. À l'évaluation on passe
`source=<slug>` ; seuls les contrôles de cette source sont chargés et évalués.
`source=None` évalue tout le catalogue.

| Slug | Source | Contrôles |
|---|---|---|
| `nis2` | Directive (UE) 2022/2555 | tous |
| `anssi-hygiene` | ANSSI Guide d'hygiène v2.0 | segmentation, exposition, admin, chiffrement |
| `cis-v8` | CIS Controls v8 | segmentation, filtrage, exposition |

## Réutilisabilité (autres usages que les flux)

Le moteur est **agnostique du domaine** : un sujet est un simple dict de faits, et
chaque contrôle porte une prop `subject-type`. Pour évaluer un autre type d'objet
(équipement, configuration…) il suffit d'ajouter des contrôles avec un autre
`subject-type` et d'appeler `evaluate(subject, source)` avec le sujet correspondant.
`controls_for(subject_type=...)` filtre automatiquement.

## Modèle de sujet « flow »

Variables disponibles dans les expressions `violation-when` :

| Variable | Type | Description |
|---|---|---|
| `src_trust` / `dst_trust` | int | niveau de confiance des zones source/destination |
| `src_zone` / `dst_zone` | str | nom de zone |
| `port` | int | port de destination |
| `protocol` | str | tcp / udp / icmp |
| `action` | str | permit / deny |
| `src_any` / `dst_any` / `port_any` | bool | règle « large » (any) |
| `path_zones` | list[str] | zones traversées par le chemin |

Sémantique : **`violation-when` VRAI ⇒ contrôle en violation** (non conforme).

## Gouvernance

- **Versionnement** : le catalogue ET chaque contrôle portent une `version`
  indépendante. Le tout est sous git.
- **Traçabilité source** : chaque ressource `back-matter` porte une
  `source-version` (ex. « Guide d'hygiène v2.0 »).
- **Propriété & relecture** : `metadata` déclare le propriétaire
  (`responsible-parties` / rôle `catalog-owner`) et la cadence de revue
  (`review-cadence`, `next-review`).
- **Traçabilité verdict** : chaque *finding* embarque `control_id`,
  `control_version`, `catalog_version` et `source` → un verdict est rejouable et
  auditable. (Persistance en base : évolution prévue, cf. ci-dessous.)

## Ajouter un contrôle

1. Ajouter le contrôle dans le bon `group` du catalogue, avec : `label`,
   `version`, `severity`, `subject-type`, `framework` (≥1), `violation-when`,
   les `links` vers les ressources `back-matter`, et les `parts`
   *statement* / *guidance*.
2. Vérifier que `violation-when` n'utilise que des variables du modèle de sujet.
3. Référencer son `id` dans les profils des sources concernées.
4. Bumper la `version` du catalogue et `last-modified`.
5. **Faire relire par un expert sécurité** avant mise en production.

## Évolutions prévues

- Enrichir le sujet « flow » avec le **chemin réel** calculé (NetworkX) plutôt
  que `[src_zone, dst_zone]`.
- **Persister** les rapports (table `ComplianceResult`) pour l'historique d'audit.
- Export des verdicts au format **OSCAL Assessment Results**.
- `HttpEngineProvider` pour brancher un moteur externe sans changer le router.
- Agent LLM (API Claude) pour **expliquer** les findings et citer l'article —
  jamais pour rendre le verdict.
