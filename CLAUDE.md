# Instructions projet — IP Flow Manager

## Stack

- Backend : FastAPI + SQLAlchemy + SQLite (`backend/`)
- Frontend : React 18 + TypeScript + Vite (`frontend/`)
- Déploiement : Render (backend Python + Static Site)
- **NE JAMAIS modifier `BASE_URL` dans `frontend/src/api/client.ts`** (URL Render de production)

## Règle d'incrément de version

**Ne modifier le numéro de version que si l'utilisateur l'indique explicitement dans son prompt** (ex : "livre la v2.9.10"). Pour tous les autres commits (corrections, ajustements), commiter sans toucher à la version.

Les trois fichiers suivants doivent **toujours afficher le même numéro de version** et être mis à jour ensemble :

1. `CHANGELOG.md`
2. `frontend/src/components/RoadmapModal.tsx`
3. `frontend/src/App.tsx` (chaîne `demo · vX.Y.Z` dans le footer)

## À faire systématiquement à chaque nouvelle version

### 1. CHANGELOG.md

Ajouter une entrée **en tête** du fichier à chaque version livrée.

Format obligatoire :
```
## [x.y.z] — YYYY-MM-DD

### Titre de la version

- **Composant** : description du changement
```

Utiliser la date courante fournie dans le contexte (`currentDate`).

### 2. Roadmap — `frontend/src/components/RoadmapModal.tsx`

- Chaque nouvelle version principale (`vX.Y`) doit être ajoutée dans le tableau `PHASES`.
- Chaque sous-version (`vX.Y.Z`) doit avoir `subOf: 'vX.Y'` pour apparaître en repli sous sa version parente.
- Mettre `status: 'done'` et `label: '✓ Livré'` dès qu'une version est livrée.
- Ne pas oublier de mettre `status: 'inprog'` pour ce qui est en cours.

### 3. Version dans `frontend/src/App.tsx`

Mettre à jour la chaîne `demo · vX.Y.Z` dans le footer de la sidebar **en même temps** que CHANGELOG.md et RoadmapModal.tsx.

### 4. Guide d'utilisation — `frontend/src/components/HelpModal.tsx`

Mettre à jour le guide si :
- Une nouvelle page ou un nouvel onglet est ajouté à la navigation
- Un workflow utilisateur change significativement
- Un nouvel overlay ou filtre majeur est ajouté au graphe réseau

### 5. Vérification TypeScript

Toujours lancer `npx tsc --noEmit` dans `frontend/` avant de commiter. Corriger toutes les erreurs.

### 6. Convention de commit

```
feat: vX.Y.Z — résumé court

- détail 1
- détail 2

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Utiliser `fix:` pour les correctifs, `feat:` pour les nouvelles fonctionnalités.

## Conventions seed / migrations

- Les fonctions de seed indépendantes (`seed_demo_routes`, `seed_default_environments`, etc.)
  doivent être **idempotentes** (vérifier avant d'insérer) et appelées depuis `startup_event()` dans `main.py`.
- Le seed principal (`seed_database`) ne tourne que si `db.query(Zone).count() == 0`.
- Les nouvelles colonnes SQLite se font via `_run_migrations()` avec `ALTER TABLE … ADD COLUMN` dans un try/except.

## Icônes

- Navigation sidebar : utiliser les icônes **Tabler outline** (`ti ti-*`) chargées via CDN dans `index.html`.
- Émojis uniquement si le contenu l'exige (pas dans le code UI).

## Roadmap — rappel structure

- `subOf: 'vX.Y'` → sous-version repliée sous vX.Y par défaut, dépliable via bouton "N patch(s)"
- Statuts disponibles : `'done'` | `'inprog'` | `'soon'` | `'planned'`
