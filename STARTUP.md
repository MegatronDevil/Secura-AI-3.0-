# Secura AI 3.0 — Quickstart Guide

This document contains all startup commands, service URLs, and instructions for running the complete Secura AI suite on any machine.

---

## ⚡ Option A: Automated One-Command Installation & Startup

### Windows (PowerShell)
```powershell
# 1. Install dependencies and verify models
.\scripts\install.ps1

# 2. Launch backend and frontend concurrently
.\scripts\start.ps1
```

### Linux / macOS
```bash
# 1. Install dependencies and verify models
chmod +x scripts/install.sh scripts/start.sh
./scripts/install.sh

# 2. Launch backend and frontend concurrently
./scripts/start.sh
```

---

## 🛠️ Option B: Manual Command-Line Startup

### 1. Start the Backend API (FastAPI)
Open a terminal in the `backend/` directory:

```bash
# Windows
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Linux / macOS
../.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
* **API Root:** `http://127.0.0.1:8000`
* **Swagger Interactive Docs:** `http://127.0.0.1:8000/docs`
* **Health Check Endpoint:** `http://127.0.0.1:8000/api/v1/health`

---

### 2. Start the Frontend Dashboard (React + Vite)
Open a second terminal in the `frontend/` directory:

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```
* **Web Workstation UI:** `http://127.0.0.1:5173`

---

### 3. Load the Chrome Extension (Media Inspector)
* **Extension Folder Path:** `<repo-root>/extension`

1. Open Google Chrome and enter `chrome://extensions` in the address bar.
2. Toggle **Developer mode** to **ON** (top-right corner).
3. Click **"Load unpacked"** (top-left button).
4. Navigate to the `extension/` folder inside the repository and click **"Select Folder"**.  
   *(Note: Do not select the `icons` subfolder; select the root `extension` folder containing `manifest.json`).*
5. **How to Test in Chrome:**
   * **Toolbar Icon:** Click the Secura AI badge in the Chrome toolbar -> click **"Test HUD On Current Page"**.
   * **Right-Click Inspection:** Right-click any image or video on any website (e.g. X/Twitter, Instagram, YouTube) and select **"Inspect with Secura AI (Forensic Scan)"**.
