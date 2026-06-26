# Changelog — IP Flow Manager

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
