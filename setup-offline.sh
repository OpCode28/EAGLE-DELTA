#!/usr/bin/env bash
# setup-offline.sh
# -----------------------------------------------------------------------
# Unpacks local dependencies, initializes the SQLite database, verifies
# asset paths, and launches both the eagle-delta backend and the Netra32
# frontend concurrently — all on localhost, with zero internet access
# required at runtime.
#
# Prerequisite: run `npm install` inside backend/ and frontend/ at least
# once while you *do* have connectivity (or from local npm cache /
# vendored tarballs), since this script itself makes no network calls.
# -----------------------------------------------------------------------
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "[eagle-delta] verifying project structure..."

required_paths=(
  "$BACKEND_DIR/server.js"
  "$BACKEND_DIR/models/schema.sql"
  "$FRONTEND_DIR/index.html"
  "$FRONTEND_DIR/public/assets/netra32-logo.png"
  "$ROOT_DIR/firmware/eagle_delta_node.ino"
)

for p in "${required_paths[@]}"; do
  if [[ ! -e "$p" ]]; then
    echo "[eagle-delta] ERROR: expected file missing: $p"
    exit 1
  fi
done
echo "[eagle-delta] structure OK."

echo "[eagle-delta] checking local node_modules..."
if [[ ! -d "$BACKEND_DIR/node_modules" ]]; then
  echo "[eagle-delta] WARNING: backend/node_modules not found."
  echo "  Run 'npm install' in backend/ once with connectivity or a local"
  echo "  npm cache before using this script."
fi
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "[eagle-delta] WARNING: frontend/node_modules not found."
  echo "  Run 'npm install' in frontend/ once with connectivity or a local"
  echo "  npm cache before using this script."
fi

echo "[eagle-delta] initializing local SQLite database..."
mkdir -p "$BACKEND_DIR/data"
node -e "require('$BACKEND_DIR/config/database.js').initSchema();"
echo "[eagle-delta] database ready at $BACKEND_DIR/data/eagle-delta.db"

echo "[eagle-delta] launching backend + Netra32 frontend concurrently..."

( cd "$BACKEND_DIR" && node server.js ) &
BACKEND_PID=$!

( cd "$FRONTEND_DIR" && npx vite --host localhost ) &
FRONTEND_PID=$!

trap 'echo "[eagle-delta] shutting down..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null' EXIT INT TERM

echo "[eagle-delta] backend PID: $BACKEND_PID"
echo "[eagle-delta] frontend PID: $FRONTEND_PID"
echo "[eagle-delta] Netra32 dashboard: http://localhost:5173"
echo "[eagle-delta] backend API:       http://localhost:4032"

wait
