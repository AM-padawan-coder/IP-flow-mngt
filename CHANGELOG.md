# Changelog — IP Flow Manager

## [2.9.2] — 2026-06-28

### Corrections et données de démo routes

- **Overlay Routes** : résolution `gateway_equipment` étendue aux IPs d'interfaces (EquipmentInterface) en plus du `management_ip` — les routes avec gateways transit (10.0.0.x, 192.168.x.x) s'affichent maintenant sur le graphe
- **Données de démo** : 20 routes injectées au démarrage si la table est vide (static / ospf / bgp entre tous les équipements via les IPs d'interfaces TRANSIT-A/B)
- **Environnements par défaut** : 4 environnements de référence (INT, PPROD1, PPROD2, PROD) injectés au démarrage si absents ; les environnements "Intégration, Préproduction, Production" sont remplacés par les codes courts
- **CHANGELOG** : format des entrées normalisé en `[x.y.z] — YYYY-MM-DD`
- **Roadmap** : sous-versions v2.9.1 et v2.9.2 ajoutées sous v2.9

---

## [2.9.1] — 2026-06-28

### Topologie apps / environnements dynamiques

- **TopologyPage — Applications** : vue liste verticale (tableau) remplace les cards CSS grid ; colonnes Nom/Code, Type, Criticité, Environnement, Domaine, Équipe, IPs
- **TopologyPage — Filtres pills** : les `<select>` de l'onglet Applications sont remplacés par des pill-buttons toggleables (type, criticité, environnement dynamique)
- **Graphe réseau — Overlay Applications** : nouveau toggle "Applications" dans le panneau Overlays ; badges colorés (10×10 px, lettre du code) affichés au-dessus des nœuds selon la criticité ; endpoint backend `GET /topology/apps-overlay` ; filtre multi-select et compteurs dans les panneaux latéraux
- **AdminPage — Onglet Environnements** : modèle `Environment` (id, name, description, color), CRUD backend `/environments` ; formulaire admin avec color picker + badge aperçu ; dropdown Environnement dans ApplicationAdmin chargé depuis l'API
- **AdminPage — Dropdowns modernisés** : `ModernSelect` pill-group pour les champs à peu d'options (criticité, type), couleurs dynamiques depuis les environnements configurés

## [2.9.0] — 2026-06-28

### Gestion des Applications
- **Onglet Applications** dans Configuration : CRUD complet (Nom, Code, Type, Domaine, Criticité, Environnement, Équipe, IPs multiples avec zone logique)
- **Onglet Applications** dans Topologie : vue cartes avec filtres type/criticité/environnement
- **Import en masse** dans Import/Export : JSON Applications (tableau de définitions)
- **Données de démo** : 10 applications réalistes (SAP, nginx, PostgreSQL, Zabbix, vCenter…)
- Les flux IP sont liés aux applications via les adresses IP

## [2.8.6] — 2026-06-28

### Topologie — VRF et routes
- Anneaux colorés multiples sur les équipements appartenant à plusieurs VRF (un anneau par VRF, concentriques, espacement 6 px)
- Filtre multi-choix VRF dans le panneau gauche : cocher/décocher les VRF à afficher individuellement, bouton tout cocher/décocher
- Filtre multi-choix routes : sélectionner les types de protocoles à afficher (BGP, OSPF, IS-IS, Connecté, Statique), bouton tout cocher/décocher

---

## [2.8.5] — 2026-06-27

### Configuration — VRF, ajout d'équipements à la création
- La section **"Équipements membres"** est désormais visible dès la **création** d'une VRF (et pas seulement en modification)
- Les équipements sélectionnés sont mis en attente localement (`pendingEq`) ; ils sont rattachés à la VRF dès la confirmation de la création
- Les boutons **Créer / Mettre à jour / Annuler** sont maintenant positionnés **sous** la liste des membres

---

## [2.8.4] — 2026-06-27

### Navigation & organisation
- **"Équipes & Sites"** renommé en **"Équipes"** dans la barre latérale
- **"Conformité"** déplacé de la section Administration vers **"Référentiel"** (après Audit)

### Configuration — refonte des zones
- L'onglet **"Zones"** devient **"Zones logiques"** : formulaire épuré (suppression du sélecteur de type), liste ne contenant plus que les zones de segmentation réseau
- Nouvel onglet **"Zones physiques"** : CRUD dédié aux sites / datacenters / salles / baies, présentation uniforme avec l'onglet Zones logiques
- Nouvel onglet **"VRF"** : création, modification, suppression de VRF (nom, couleur, RD, RT Import/Export, description) ; affectation et retrait d'équipements par VRF via un accordéon dépliable

### Topologie — onglets zones
- Onglet **"Zones (6)"** renommé **"Zones logiques (6)"**
- Nouvel onglet **"Zones physiques (7)"** : vue en cartes des sites physiques (type, localisation, description)
- Badge "Confiance X%" forcé sur une seule ligne (plus de retour à la ligne dans les cartes étroites)

### Graphe réseau — panneau VRF
- Suppression du trait horizontal parasite après le dernier élément de la liste VRF active

---

## [2.8.3] — 2026-06-27

### Conformité — branchement du moteur réel
- **Le moteur de conformité s'exécute désormais sur les flux réels** : l'analyse d'un flux (`/flows/analyze`) renvoie son verdict de conformité, évalué sur le **chemin réellement calculé** (zones traversées dérivées des hops → réseaux → zones)
- Conformité évaluée même sur un flux rejeté, dès que les zones source/destination sont résolues
- Panneau **Conformité** ajouté à la page Nouveau flux : verdict + violations détaillées (sévérité, frameworks, citation)
- `/compliance/evaluate/flow/{id}` utilise aussi le chemin réel ; provider partagé (`default_provider`) entre les routers
- Constructeur de sujet partagé `compliance/subject.py`
- Correctif compatibilité Python 3.9 (`Optional[str]` au lieu de `str | None`)

### Configuration — zones physiques
- Les **zones physiques** (Data Centers, salles, baies) sont taguées **« ⬡ Physique »** et apparaissent sous le filtre **Physique** de la page Zones
- **Boutons modifier et supprimer** ajoutés sur chaque zone physique, avec formulaire d'édition dédié (nom, type, zone parente, localisation, description)

### Roadmap
- Suppression de l'entrée **v5.3 Compliance** (désormais branchée dans l'outil) ; **v5.4 Firewall Analyzer** décalé en **v5.3**

---

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
