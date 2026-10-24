# ==============================================================================
# SECURA AI 3.0 — AUTOMATED INSTALLATION & SETUP (PowerShell / Windows)
# ==============================================================================
# Usage:
#   .\scripts\install.ps1
# ==============================================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  SECURA AI 3.0 — ONE-COMMAND INSTALLATION & ENVIRONMENT SETUP" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Target Root: $RepoRoot`n"

# 1. Check Python
Write-Host "[1/6] Checking Python installation..." -ForegroundColor Yellow
$PythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $PythonCmd) {
    Write-Host "ERROR: Python is not found in PATH. Please install Python 3.11 or 3.12." -ForegroundColor Red
    exit 1
}
$PyVer = python --version
Write-Host "  Found: $PyVer" -ForegroundColor Green

# 2. Check Node & npm
Write-Host "`n[2/6] Checking Node.js and npm..." -ForegroundColor Yellow
$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
$NpmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $NodeCmd -or -not $NpmCmd) {
    Write-Host "WARNING: Node.js or npm not found. Frontend and extension building will require Node." -ForegroundColor Yellow
} else {
    $NodeVer = node --version
    $NpmVer = npm --version
    Write-Host "  Found Node: $NodeVer, npm: $NpmVer" -ForegroundColor Green
}

# 3. Create & Activate Virtual Environment
Write-Host "`n[3/6] Setting up Python virtual environment..." -ForegroundColor Yellow
$VenvDir = Join-Path $RepoRoot ".venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Host "  Creating new virtual environment at .venv..." -ForegroundColor Gray
    python -m venv $VenvDir
} else {
    Write-Host "  Virtual environment already exists at .venv." -ForegroundColor Green
}

# 4. Install Backend Dependencies
Write-Host "`n[4/6] Installing backend Python dependencies..." -ForegroundColor Yellow
& $VenvPython -m pip install --upgrade pip
$ReqPath = Join-Path $RepoRoot "requirements.txt"
& $VenvPython -m pip install -r $ReqPath

# 5. Install Frontend Dependencies
Write-Host "`n[5/6] Installing frontend Node dependencies..." -ForegroundColor Yellow
$FrontendDir = Join-Path $RepoRoot "frontend"
if (Test-Path $FrontendDir) {
    Push-Location $FrontendDir
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        npm install
    }
    Pop-Location
}

# 6. Environment & Model Verification
Write-Host "`n[6/6] Verifying models and local environment..." -ForegroundColor Yellow
$EnvFile = Join-Path $RepoRoot ".env"
$EnvExample = Join-Path $RepoRoot ".env.example"
if (-not (Test-Path $EnvFile) -and (Test-Path $EnvExample)) {
    Copy-Item $EnvExample $EnvFile
    Write-Host "  Created initial .env from .env.example" -ForegroundColor Green
}

# Download and verify models
$DownloadScript = Join-Path $RepoRoot "scripts\download_models.py"
& $VenvPython $DownloadScript

# Final verification
$VerifyScript = Join-Path $RepoRoot "scripts\verify_setup.py"
& $VenvPython $VerifyScript

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "  SECURA AI 3.0 INSTALLATION COMPLETE!" -ForegroundColor Cyan
Write-Host "  To launch backend & frontend concurrently, run:" -ForegroundColor Green
Write-Host "    .\scripts\start.ps1" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan
