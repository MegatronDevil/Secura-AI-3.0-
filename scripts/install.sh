#!/usr/bin/env bash
# ==============================================================================
# SECURA AI 3.0 — AUTOMATED INSTALLATION & SETUP (Linux / macOS)
# ==============================================================================
# Usage:
#   chmod +x scripts/install.sh && ./scripts/install.sh
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "======================================================================"
echo "  SECURA AI 3.0 — ONE-COMMAND INSTALLATION & ENVIRONMENT SETUP"
echo "======================================================================"
echo "Target Root: $REPO_ROOT"
echo ""

# 1. Check Python
echo "[1/6] Checking Python installation..."
if command -v python3 &>/dev/null; then
    PY_CMD="python3"
elif command -v python &>/dev/null; then
    PY_CMD="python"
else
    echo "ERROR: Python 3 is not installed or not in PATH."
    exit 1
fi
$PY_CMD --version

# 2. Check Node & npm
echo ""
echo "[2/6] Checking Node.js and npm..."
if command -v node &>/dev/null && command -v npm &>/dev/null; then
    echo "Found Node: $(node --version), npm: $(npm --version)"
else
    echo "WARNING: Node.js/npm not found. Please install Node.js 18+ for frontend and extension."
fi

# 3. Virtual Environment
echo ""
echo "[3/6] Setting up Python virtual environment..."
VENV_DIR="$REPO_ROOT/.venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment at .venv..."
    $PY_CMD -m venv "$VENV_DIR"
fi
VENV_PYTHON="$VENV_DIR/bin/python"
if [ ! -f "$VENV_PYTHON" ]; then
    VENV_PYTHON="$VENV_DIR/Scripts/python.exe" # In case of MSYS/Git Bash on Windows
fi

# 4. Install Backend Dependencies
echo ""
echo "[4/6] Installing backend Python dependencies..."
"$VENV_PYTHON" -m pip install --upgrade pip
"$VENV_PYTHON" -m pip install -r "$REPO_ROOT/requirements.txt"

# 5. Install Frontend Dependencies
echo ""
echo "[5/6] Installing frontend Node dependencies..."
if [ -d "$REPO_ROOT/frontend" ] && command -v npm &>/dev/null; then
    (cd "$REPO_ROOT/frontend" && npm install)
fi

# 6. Model Verification & Environment Setup
echo ""
echo "[6/6] Verifying models and local environment..."
if [ ! -f "$REPO_ROOT/.env" ] && [ -f "$REPO_ROOT/.env.example" ]; then
    cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
    echo "Created initial .env from .env.example"
fi

"$VENV_PYTHON" "$REPO_ROOT/scripts/download_models.py"
"$VENV_PYTHON" "$REPO_ROOT/scripts/verify_setup.py"

echo ""
echo "======================================================================"
echo "  SECURA AI 3.0 INSTALLATION COMPLETE!"
echo "  To launch backend & frontend concurrently, run:"
echo "    ./scripts/start.sh"
echo "======================================================================"
