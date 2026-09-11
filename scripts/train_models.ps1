# CASHGUARD-AI - 1-Click ML Model Training Script (PowerShell)
# Automatically detects NVIDIA / AMD GPUs, sets optimal acceleration, and trains models.

$ErrorActionPreference = "Stop"

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "  CASHGUARD-AI - 1-CLICK ML MODEL TRAINING PIPELINE" -ForegroundColor Cyan
Write-Host "  NVIDIA CUDA / AMD GPU Acceleration & Core Auditing" -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host ""

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$PyExe = "python"
if (Test-Path "$RepoRoot\.venv\Scripts\python.exe") {
    $PyExe = "$RepoRoot\.venv\Scripts\python.exe"
} else {
    Write-Host "[*] Creating .venv environment..." -ForegroundColor Yellow
    python -m venv .venv
    & "$RepoRoot\.venv\Scripts\pip.exe" install -r requirements.txt
    $PyExe = "$RepoRoot\.venv\Scripts\python.exe"
}

Write-Host "[*] Executing Hardware Diagnostic and Model Training..." -ForegroundColor Green
& $PyExe scripts/train_synthetic_models.py

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================================================" -ForegroundColor Green
    Write-Host "  [SUCCESS] All ML models trained and artifacts exported to:" -ForegroundColor Green
    Write-Host "  backend/app/ml/model_artifacts/" -ForegroundColor Green
    Write-Host "========================================================================" -ForegroundColor Green
} else {
    Write-Host "[!] Training exited with code $LASTEXITCODE" -ForegroundColor Red
}
