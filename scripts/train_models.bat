@echo off
setlocal enabledelayedexpansion
title CASHGUARD-AI - ML Model Training Pipeline

echo ========================================================================
echo   CASHGUARD-AI - 1-CLICK ML MODEL TRAINING PIPELINE
echo   NVIDIA CUDA / AMD GPU Acceleration and Core Auditing
echo ========================================================================
echo.

pushd "%~dp0.."
set "REPO_ROOT=%CD%"

set "PY_EXE="

REM Check 1: Existing virtual environment
if exist "%REPO_ROOT%\.venv\Scripts\python.exe" (
    set "PY_EXE=%REPO_ROOT%\.venv\Scripts\python.exe"
    goto :RUN_TRAINING
)

REM Check 2: Python 3.10 in LocalAppData
if exist "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" (
    echo [*] Found Python 3.10 installation. Initializing .venv ...
    "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" -m venv "%REPO_ROOT%\.venv"
    if exist "%REPO_ROOT%\.venv\Scripts\python.exe" (
        echo [*] Installing training dependencies ...
        "%REPO_ROOT%\.venv\Scripts\pip.exe" install -r "%REPO_ROOT%\requirements.txt"
        set "PY_EXE=%REPO_ROOT%\.venv\Scripts\python.exe"
        goto :RUN_TRAINING
    )
)

REM Check 3: Standard Python launcher
py -3.10 --version >nul 2>nul
if %errorlevel% equ 0 (
    echo [*] Initializing .venv using Python 3.10 ...
    py -3.10 -m venv "%REPO_ROOT%\.venv"
    if exist "%REPO_ROOT%\.venv\Scripts\python.exe" (
        echo [*] Installing training dependencies ...
        "%REPO_ROOT%\.venv\Scripts\pip.exe" install -r "%REPO_ROOT%\requirements.txt"
        set "PY_EXE=%REPO_ROOT%\.venv\Scripts\python.exe"
        goto :RUN_TRAINING
    )
)

REM Check 4: Global python
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo [*] Initializing .venv using default python ...
    python -m venv "%REPO_ROOT%\.venv"
    if exist "%REPO_ROOT%\.venv\Scripts\python.exe" (
        echo [*] Installing training dependencies ...
        "%REPO_ROOT%\.venv\Scripts\pip.exe" install -r "%REPO_ROOT%\requirements.txt"
        set "PY_EXE=%REPO_ROOT%\.venv\Scripts\python.exe"
        goto :RUN_TRAINING
    ) else (
        set "PY_EXE=python"
        goto :RUN_TRAINING
    )
)

REM Check 5: Running Docker container fallback
docker ps --format "{{.Names}}" 2>nul | findstr /i "cpaf_backend" >nul
if %errorlevel% equ 0 (
    echo [*] Python not found on host, but cpaf_backend container is running.
    echo [*] Executing training inside Docker container ...
    echo.
    docker exec cpaf_backend python scripts/train_synthetic_models.py
    if %errorlevel% equ 0 (
        echo.
        echo ========================================================================
        echo   [SUCCESS] ML models trained and artifacts exported successfully!
        echo ========================================================================
    ) else (
        echo [!] Container training encountered an error.
    )
    popd
    echo.
    pause
    exit /b %errorlevel%
)

echo [!] No compatible Python 3.10+ found in PATH or .venv.
echo     Please install Python 3.10 from python.org or start Docker containers.
popd
echo.
pause
exit /b 1

:RUN_TRAINING
echo [*] Executing Hardware Diagnostic and Model Training via:
echo     !PY_EXE!
echo.

"!PY_EXE!" "%REPO_ROOT%\scripts\train_synthetic_models.py"

if %errorlevel% equ 0 (
    echo.
    echo ========================================================================
    echo   [SUCCESS] All ML models trained and artifacts exported to:
    echo   backend\app\ml\model_artifacts\
    echo ========================================================================
) else (
    echo.
    echo [!] Training script encountered an issue. Checking container fallback ...
    docker exec cpaf_backend python scripts/train_synthetic_models.py 2>nul
)

popd
echo.
pause
