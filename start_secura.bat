@echo off
TITLE Secura AI v2.0 - Unified Startup Sentinel
COLOR 0A

echo ====================================================================
echo                 SECURA AI 2.0 - ENTERPRISE LAUNCHER
echo ====================================================================
echo.
echo [1/3] Starting Backend FastAPI Server (Port 8000)...
start "Secura AI - Backend (Port 8000)" cmd /k "cd /d D:\SecuraAI2\backend && ..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/3] Starting Frontend React + Vite Dashboard (Port 5173)...
start "Secura AI - Frontend (Port 5173)" cmd /k "cd /d D:\SecuraAI2\frontend && npm run dev -- --host 127.0.0.1 --port 5173"

echo [3/3] Ready!
echo.
echo ====================================================================
echo                  SERVICES OPERATING ADDRESSES:
echo ====================================================================
echo  - Frontend Dashboard : http://127.0.0.1:5173
echo  - Backend API Docs   : http://127.0.0.1:8000/docs
echo  - Health Endpoint    : http://127.0.0.1:8000/api/v1/health
echo  - Chrome Extension   : D:\SecuraAI2\extension
echo.
echo To load the Chrome Extension:
echo   1. Open Chrome and go to chrome://extensions
echo   2. Turn ON "Developer mode" (top-right switch)
echo   3. Click "Load unpacked" and choose folder: D:\SecuraAI2\extension
echo ====================================================================
echo.
pause
