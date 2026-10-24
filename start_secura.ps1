# Secura AI 3.0 - Unified PowerShell Launcher
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "                SECURA AI 3.0 - ENTERPRISE LAUNCHER                " -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

$baseDir = $PSScriptRoot
$backendDir = "$baseDir\backend"
$frontendDir = "$baseDir\frontend"
$venvPython = "$baseDir\.venv\Scripts\python.exe"

# 1. Launch Backend
Write-Host "[1/2] Launching Backend FastAPI on port 8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; & '$venvPython' -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

# 2. Launch Frontend
Write-Host "[2/2] Launching Frontend React/Vite on port 5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run dev -- --host 127.0.0.1 --port 5173"

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "                  SERVICES OPERATING ADDRESSES:                     " -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "  * Frontend Dashboard : http://127.0.0.1:5173" -ForegroundColor White
Write-Host "  * Backend API Docs   : http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "  * Health Endpoint    : http://127.0.0.1:8000/api/v1/health" -ForegroundColor White
Write-Host "  * Extension Path     : $baseDir\extension" -ForegroundColor White
Write-Host ""
Write-Host "Chrome Extension Setup:" -ForegroundColor Magenta
Write-Host "  1. In Chrome, navigate to chrome://extensions" -ForegroundColor Gray
Write-Host "  2. Enable Developer mode (top-right)" -ForegroundColor Gray
Write-Host "  3. Click 'Load unpacked' and select: $baseDir\extension" -ForegroundColor Gray
Write-Host "====================================================================" -ForegroundColor Cyan
