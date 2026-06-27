# Changelog — IP Flow Manager

## [2.8.2] — 2026-06-27

### Socle de conformité (OSCAL)
- **Catalogue de contrôles au format OSCAL 1.1.2** (`backend/compliance/catalogs/`) avec 5 contrôles d'exemple : cloisonnement (SEG-001), filtrage deny-all (FLT-001), exposition de services (EXP-001), administration sécurisée (ADM-001), chiffrement en transit (CRY-001)
- **Profils OSCAL = sélection de source** : NIS2, ANSSI Guide d'hygiène, CIS v8 — seuls les contrôles de la source choisie sont chargés et évalués (« ne pas tout charger »)
- **Moteur générique réutilisable** : interface `ComplianceProvider` (remplaçable par un moteur HTTP externe sans impact) + `LocalEngineProvider` de référence ; sujet = simple dict de faits → réutilisable pour d'autres types d'objets que les flux
- **Évaluateur d'expressions sûr** basé sur `ast` (sans `eval`) pour exécuter les `violation-when` du catalogue
- **API REST** : `/compliance/sources`, `/compliance/catalog`, `/compliance/controls`, `/compliance/evaluate` (sujet arbitraire), `/compliance/evaluate/flow/{id}` (résolution de zone par CIDR)
- **Gouvernance** : versionnement catalogue + par contrôle, traçabilité de la version de source, propriétaire et cadence de revue dans les métadonnées OSCAL, traçabilité verdict (control_id + versions + source dans chaque finding) ; documentée dans `backend/compliance/README.md`
- **Page "Conformité"** (section Administration) : sélecteur de source, testeur de flux, verdict détaillé par contrôle avec citation, liste des contrôles chargés

---

## [2.8.0] — 2026-06-27

### Sauvegarde & Restauration
- **Sauvegarde complète hebdomadaire** : copie binaire SQLite (dimanche 03h00 UTC)
- **Sauvegarde incrémentale quotidienne** : export JSON par domaine (02h00 UTC)
- **Domaines séparés** : Métier (flux, zones, équipements), Audits (ACL, routing, événements), Simulation (VRF)
- **Vérification d'intégrité** `PRAGMA integrity_check` après chaque sauvegarde
- **Restauration** avec double confirmation et vérification pré-restauration
- **Déclenchement manuel** : complète ou incrémentale par domaine
- **Vérification quotidienne** à 08h00 UTC + alerte log `CRITICAL` si sauvegarde absente ou corrompue
- **Historique horodaté** avec taille, statut et résultat d'intégrité par sauvegarde
- **Page dédiée "Sauvegardes"** avec tableau de bord du planificateur (section Administration)

---

## [2.7.0] — 2026-06-27

### Import de flux JSON, Modal Builder & Validation
- **Import JSON multi-flux** : format structuré (source, destination, zones, ports, protocoles)
- **Modal Builder** avec palette de champs glisser-déposer
- **Constructeur visuel** avec sections SOURCE / DESTINATION / RÈGLE
- **Aperçu JSON temps réel** synchronisé avec le constructeur
- **Validation 3 niveaux** : syntaxique (bloquant) → règles métier (avertissements) → doublons existants
- **Workflow 4 étapes** : Saisie → Aperçu → Validation → Import
- Affichage des erreurs par champ et par flux ; clic sur erreur → focus du champ

---

## [2.6.0] — 2026-06-27

### Overlays graphe réseau
- **Overlay Flux** : chemins animés sur le graphe (criticité, SLA, VRF)
- **Overlay Routes** : liens BGP / OSPF / IS-IS / Static colorés avec flèches
- **Overlay VRF** : halos colorés + transparence des équipements hors-VRF
- Panneau de filtres Flux (application, protocole, criticité, statut) + autocomplétion sur les 5 champs
- Légende dynamique + compteurs ÉLÉMENTS VISIBLES
- Tooltips au survol sur flux, routes et nœuds VRF ; statut réel du flux (Déployé / Validé / En attente / Refusé)
- Animation de tirets temps réel pour flux et routes actifs ; flèche bézier suivant la tangente du chemin
- Bouton « Voir sur le graphe » depuis Nouveau flux : flux analysé affiché en overlay animé

### Graphe & zones
- Zones physiques sur le graphe : conteneurs à bordure tiretée groupés par zone physique
- Zones logiques sur le graphe : conteneurs à bordure pointillée groupés par zone logique
- Toggle Physique / Logique / Aucune avec animation de fondu
- Drag de zone : déplacement groupé de tous les nœuds d'un conteneur
- Sauvegarde automatique des positions des nœuds (localStorage)
- Légende des types d'équipements (couleurs) sur le graphe
- Propriété Data Center sur les zones ; Zone logique sur les équipements

### Import de flux & Configuration
- Import flux JSON : modal 4 étapes (Saisie → Aperçu → Validation → Import)
- Constructeur visuel glisser-déposer 3 panneaux (Palette / Constructeur SOURCE·DEST·RÈGLE / Aperçu JSON)
- Validation 3 niveaux : syntaxique (bloquant) → règles métier (avertissements) → détection de doublons
- Navigation « Administration » renommée « Configuration »
- Liste de zones unifiée : Zone (logique/physique) + PhysicalZone avec badges de type et filtre

### Correctifs
- Affichage des Scripts dans le détail flux (rule_id + description par équipement)
- Vue Flux : barre de recherche élargie ; barre Appliquer centrée sur le graphe

---

## [2.5.0] — 2026-06-27

### Workflow & Simulation avancée
- **Workflow de soumission** : flux soumis → statut En attente (validation manuelle)
- **Actions de validation** : Valider / Déployer / Refuser depuis l'Historique
- Scénarios rapides = derniers flux créés
- Détail équipement : routing + ACL depuis l'Administration
- **Détection SPOF** (points d'articulation du graphe)
- Analyse d'impact : actions proposées (ACL deny, routes)
- Import / Export de flux, filtres multi-statuts, améliorations UX vue Flux

---

## [2.4.1] — 2026-06-27

### Correctifs & améliorations flux
- Correctif bouton Enregistrer routes + retour d'erreur
- Politiques réseau déplacées dans Topologie
- Journal des événements politiques réseau dans l'Historique
- Vue Flux dans Topologie avec export Excel (CSV)
- Correctif visuel Import/Export (overflow)
- Graphe ⬡ affiché en modal inline (sans quitter le formulaire)

---

## [2.4.0] — 2026-06-27

### Tables de routage & ACL
- **Tables de routage** par équipement (CRUD statique / OSPF / BGP)
- **Règles ACL** par équipement (permit/deny, direction in/out)
- Génération automatique de règles ACL depuis un flux validé
- Traçabilité flux → règles ACL générées

---

## [2.3.0] — 2026-06-27

### Gestion avancée des flux
- Vue détail par flux (validation, chemin, scripts)
- Filtres par statut (Validé / Refusé / En attente / Déployé)
- Suppression de flux avec confirmation
- KPIs statuts en en-tête (compteurs colorés)

---

## [2.2.0] — 2026-06-26

### Vérification avant production
- **Simulation What-if** — impact sur les flux existants
- **Détection de boucles** L2/L3 (cycles NetworkX)
- **Analyse d'impact** — flux interrompus si un équipement tombe
- Page Simulation dédiée dans la navigation

---

## [2.1.0] — 2026-06-25

### Ajouts
- **Guide d'utilisation intégré** : documentation complète en français accessible via le bouton `?` en bas de la barre latérale
- **Navigation par sections** : 10 sections (Introduction, Saisir un flux, Validation, Chemin réseau, Scripts, Administration, Import/Export, Équipes & Sites, Audit, FAQ)
- **FAQ interactive** : 7 questions-réponses couvrant les cas d'usage courants

---

## [2.0.0] — 2026-06-25

### Ajouts
- **Graphe de topologie interactif** : visualisation canvas force-directed des équipements et liens réseau
- **Mise en évidence du chemin** : après analyse d'un flux, le chemin est coloré sur le graphe
- **Page Administration** : CRUD complet pour équipements, zones logiques, réseaux, liens topologie et zones physiques
- **Outil d'import de topologie** : import JSON (topologie complète) et CSV (équipements, réseaux, liens séparément)
- **Export JSON** : export de l'architecture complète pour sauvegarde ou migration
- **Gestion des équipes** : création et édition d'équipes avec contact et couleur
- **Zones physiques** : modélisation hiérarchique datacenter > salle > baie
- **Association équipe ↔ équipement** : chaque équipement peut être rattaché à une équipe
- **Templates d'import CSV** : téléchargement de fichiers modèles pré-remplis

### Améliorations
- Navigation enrichie : 4 sections (Flux IP, Topologie, Organisation, Référentiel)
- Bouton "Voir sur le graphe" depuis l'analyse de flux
- Page Architecture redessinée en onglet de la page Topologie

---

## [1.0.0] — 2026-06-25

### Ajouts initiaux
- Saisie de flux IP (src, dst, port, protocole, application, justification)
- Moteur de validation : nomenclature RFC 1918, ports restreints, politiques de zone
- Moteur de chemin réseau (NetworkX)
- Génération de scripts multi-vendor : Stormshield CLI, PAN-OS set, Junos set, NSX-T REST API, FortiOS CLI, Check Point mgmt API
- Historique des flux avec filtrage
- Page Audit avec KPIs
- Base de données SQLite avec données de démo réalistes (6 zones, 9 équipements, 11 réseaux)
- API REST FastAPI avec documentation Swagger
- Interface React/TypeScript thème sombre
- Scripts de démarrage macOS (`start.sh`) et Windows (`setup.bat` + `start.bat`)
