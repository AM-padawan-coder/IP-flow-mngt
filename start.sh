#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo ""
echo "═══════════════════════════════════════════"
echo "  IP Flow Manager — Démarrage"
echo "═══════════════════════════════════════════"
echo ""

# ── Backend ──────────────────────────────────────────────────────────────────
echo "▶ Installation des dépendances Python…"
cd "$BACKEND"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt

echo "▶ Démarrage du backend FastAPI (port 8000)…"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# ── Frontend ──────────────────────────────────────────────────────────────────
echo ""
echo "▶ Installation des dépendances Node.js…"
cd "$FRONTEND"
npm install --silent

echo "▶ Démarrage du frontend React (port 5173)…"
npm run dev &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

echo ""
echo "═══════════════════════════════════════════"
echo "  ✓ Backend  → http://localhost:8000"
echo "  ✓ Frontend → http://localhost:5173"
echo "  ✓ API docs → http://localhost:8000/docs"
echo "═══════════════════════════════════════════"
echo ""
echo "  Ctrl+C pour arrêter"
echo ""

# Attendre et relayer Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
