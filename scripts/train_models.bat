@echo off
setlocal enabledelayedexpansion

echo ========================================================================
echo   CASHGUARD-AI - 1-CLICK ML MODEL TRAINING PIPELINE
echo   NVIDIA CUDA / AMD GPU Acceleration ^& Core Auditing
echo ========================================================================
echo.

cd /d "%~dp0\.."

:: Check if Python is available
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Python was not found in PATH. Please install Python 3.10+ from python.org.
    pause
    exit /b 1
)

:: Check for .venv virtual environment
if not exist ".venv\Scripts\python.exe" (
    echo [*] Setting up local Python virtual environment (.venv)...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [!] Failed to create .venv. Falling back to global Python.
        set "PY_EXE=python"
    ) else (
        echo [*] Installing requirements into .venv...
        .venv\Scripts\pip install -r requirements.txt
        set "PY_EXE=.venv\Scripts\python.exe"
    )
) else (
    set "PY_EXE=.venv\Scripts\python.exe"
)

echo [*] Executing Hardware Diagnostic and Model Training via: %PY_EXE%
echo.

"%PY_EXE%" scripts\train_synthetic_models.py

if %errorlevel% equ 0 (
    echo.
    echo ========================================================================
    echo   [SUCCESS] All ML models trained and artifacts exported to:
    echo   backend\app\ml\model_artifacts\
    echo ========================================================================
) else (
    echo.
    echo [!] Training script encountered an issue. Checking container fallback...
    docker exec cpaf_backend python scripts/train_synthetic_models.py 2>nul
)

echo.
pause
