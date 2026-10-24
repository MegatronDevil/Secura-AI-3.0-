# ==============================================================================
# SECURA AI 3.0 — UNIFIED CONCURRENT LAUNCHER (PowerShell / Windows)
# ==============================================================================
# Usage:
#   .\scripts\start.ps1
# ==============================================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  SECURA AI 3.0 — STARTING MULTIMODAL MEDIA FORENSICS SYSTEM" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Root Directory: $RepoRoot`n"

# Locate Virtual Environment
$VenvPython = Join-Path $RepoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Host "ERROR: Python virtual environment not found at .venv." -ForegroundColor Red
    Write-Host "Please run .\scripts\install.ps1 first." -ForegroundColor Yellow
    exit 1
}

# 1. Start Backend FastAPI Service
Write-Host "[1/2] Launching Backend FastAPI Service on http://127.0.0.1:8000 ..." -ForegroundColor Green
$BackendDir = Join-Path $RepoRoot "backend"
$backendJob = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c cd /d `"$BackendDir`" && `"$VenvPython`" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload" `
    -PassThru

# 2. Start Frontend Vite Service
Write-Host "[2/2] Launching Frontend Vite Workstation on http://127.0.0.1:5173 ..." -ForegroundColor Green
$FrontendDir = Join-Path $RepoRoot "frontend"
$frontendJob = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c cd /d `"$FrontendDir`" && npm run dev -- --host 127.0.0.1 --port 5173" `
    -PassThru

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "  SECURA AI 3.0 SERVICES ARE RUNNING!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  * Web Workstation:       http://127.0.0.1:5173" -ForegroundColor White
Write-Host "  * REST API & Docs:       http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "  * API Health Check:      http://127.0.0.1:8000/api/v1/health" -ForegroundColor White
Write-Host "  * Chrome Extension:      $RepoRoot\extension" -ForegroundColor Yellow
Write-Host ""
Write-Host "  [TO LOAD CHROME EXTENSION]:" -ForegroundColor Cyan
Write-Host "    1. Open Google Chrome and navigate to: chrome://extensions"
Write-Host "    2. Enable 'Developer mode' in the top-right corner."
Write-Host "    3. Click 'Load unpacked' and select folder: $RepoRoot\extension"
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Press Ctrl+C or close the terminal windows to stop services."
