#!/usr/bin/env bash
# ==============================================================================
# SECURA AI 3.0 — UNIFIED CONCURRENT LAUNCHER (Linux / macOS)
# ==============================================================================
# Usage:
#   chmod +x scripts/start.sh && ./scripts/start.sh
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "======================================================================"
echo "  SECURA AI 3.0 — STARTING MULTIMODAL MEDIA FORENSICS SYSTEM"
echo "======================================================================"
echo "Root Directory: $REPO_ROOT"
echo ""

VENV_PYTHON="$REPO_ROOT/.venv/bin/python"
if [ ! -f "$VENV_PYTHON" ]; then
    VENV_PYTHON="$REPO_ROOT/.venv/Scripts/python.exe"
fi

if [ ! -f "$VENV_PYTHON" ]; then
    echo "ERROR: Python virtual environment not found at .venv."
    echo "Please run ./scripts/install.sh first."
    exit 1
fi

cleanup() {
    echo ""
    echo "Stopping Secura AI services..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    echo "Services stopped."
    exit 0
}
trap cleanup SIGINT SIGTERM

echo "[1/2] Launching Backend FastAPI Service on http://127.0.0.1:8000 ..."
(cd "$REPO_ROOT/backend" && "$VENV_PYTHON" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload) &
BACKEND_PID=$!

echo "[2/2] Launching Frontend Vite Workstation on http://127.0.0.1:5173 ..."
(cd "$REPO_ROOT/frontend" && npm run dev -- --host 127.0.0.1 --port 5173) &
FRONTEND_PID=$!

echo ""
echo "======================================================================"
echo "  SECURA AI 3.0 SERVICES ARE RUNNING!"
echo "======================================================================"
echo "  * Web Workstation:       http://127.0.0.1:5173"
echo "  * REST API & Docs:       http://127.0.0.1:8000/docs"
echo "  * API Health Check:      http://127.0.0.1:8000/api/v1/health"
echo "  * Chrome Extension:      $REPO_ROOT/extension"
echo ""
echo "  [TO LOAD CHROME EXTENSION]:"
echo "    1. Open Google Chrome and navigate to: chrome://extensions"
echo "    2. Enable 'Developer mode' in the top-right corner."
echo "    3. Click 'Load unpacked' and select folder: $REPO_ROOT/extension"
echo "======================================================================"
echo "Press Ctrl+C to stop both services."

wait
