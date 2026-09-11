#!/usr/bin/env bash
set -e

echo "========================================================================"
echo "  CASHGUARD-AI - 1-CLICK ML MODEL TRAINING PIPELINE"
echo "  NVIDIA CUDA / AMD GPU Acceleration & Core Auditing"
echo "========================================================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

if [ -f "$REPO_ROOT/.venv/bin/python" ]; then
    PY_EXE="$REPO_ROOT/.venv/bin/python"
elif [ -f "/app/app/ml/hardware.py" ]; then
    # Running inside container
    PY_EXE="python"
elif command -v python3 &>/dev/null; then
    if [ ! -d "$REPO_ROOT/.venv" ]; then
        echo "[*] Creating virtual environment (.venv)..."
        python3 -m venv "$REPO_ROOT/.venv"
        "$REPO_ROOT/.venv/bin/pip" install -r requirements.txt
    fi
    PY_EXE="$REPO_ROOT/.venv/bin/python"
else
    echo "[!] python3 not found. Please install Python 3.10+."
    exit 1
fi

echo "[*] Running Hardware Diagnostic and Model Training..."
"$PY_EXE" scripts/train_synthetic_models.py

echo ""
echo "========================================================================"
echo "  [SUCCESS] All ML models trained and artifacts exported to:"
echo "  backend/app/ml/model_artifacts/"
echo "========================================================================"
