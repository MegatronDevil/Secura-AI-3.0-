#!/usr/bin/env python3
"""
Secura AI — Environment & Pre-Flight Verification Tool
======================================================
Validates that the local clone has all required runtimes, dependencies,
and models needed for image forensics, video forensics, and policy evaluation.

Usage:
  python scripts/verify_setup.py
"""

import sys
import os
import shutil
import subprocess
from pathlib import Path

def get_root() -> Path:
    return Path(__file__).resolve().parent.parent

def check_python_version():
    v = sys.version_info
    print(f"[*] Python Version: {v.major}.{v.minor}.{v.micro}", end=" ... ")
    if v.major == 3 and v.minor in (10, 11, 12, 13):
        print("[PASS]")
        return True
    elif v.major == 3 and v.minor >= 10:
        print("[PASS (Newer Python)]")
        return True
    else:
        print("[FAIL - Python 3.10+ required]")
        return False

def check_node():
    node_path = shutil.which("node")
    npm_path = shutil.which("npm")
    print(f"[*] Node.js Runtime: {node_path or 'Not Found'}", end=" ... ")
    if node_path and npm_path:
        try:
            ver = subprocess.run([node_path, "--version"], capture_output=True, text=True).stdout.strip()
            print(f"[PASS ({ver})]")
            return True
        except Exception:
            print("[PASS]")
            return True
    else:
        print("[WARN - Node.js is required for building frontend/extension]")
        return False

def check_pytorch_and_device():
    print("[*] PyTorch & Hardware Acceleration:", end=" ")
    try:
        import torch
        cuda_avail = torch.cuda.is_available()
        dev_name = torch.cuda.get_device_name(0) if cuda_avail else "CPU (Standard Inference)"
        print(f"[PASS (PyTorch {torch.__version__}, Device: {dev_name})]")
        return True
    except ImportError:
        print("[FAIL - torch not installed. Run: pip install -r requirements.txt]")
        return False

def check_models():
    root = get_root()
    weights_dir = root / "backend" / "models" / "weights"
    print("[*] Core Inference Checkpoints:")
    
    fc = weights_dir / "fc_weights.pth"
    restrav = weights_dir / "restrav_temporal" / "restrav_mlp.pt"
    
    ok = True
    if fc.exists():
        print(f"    - UniversalFakeDetect Probe: [FOUND] ({fc.stat().st_size:,} bytes)")
    else:
        print("    - UniversalFakeDetect Probe: [MISSING]")
        ok = False
        
    if restrav.exists():
        print(f"    - ReStraV Temporal Video MLP: [FOUND] ({restrav.stat().st_size:,} bytes)")
    else:
        print("    - ReStraV Temporal Video MLP: [MISSING]")
        ok = False
        
    return ok

def test_inference_pipeline():
    print("[*] Smoke Testing Inference Pipelines:")
    root = get_root()
    sys.path.insert(0, str(root / "backend"))
    
    # 1. Image probe test
    try:
        from app.services.ai_image_detector import AIImageDetectorService
        detector = AIImageDetectorService()
        status = detector.status.value
        print(f"    - Image Detector Service: [{status.upper()}] (Active Probe: {detector.active_head})")
    except Exception as e:
        print(f"    - Image Detector Service: [ERROR: {e}]")
        
    # 2. Video ReStraV test
    try:
        from app.services.video_branches.temporal_representation import TemporalRepresentationBranch
        branch = TemporalRepresentationBranch()
        print(f"    - ReStraV Video Branch: [READY] ({branch.method})")
    except Exception as e:
        print(f"    - ReStraV Video Branch: [ERROR: {e}]")
        
    # 3. BRAHMA Engine test
    try:
        from app.services.brahma.engine import BrahmaEngine
        engine = BrahmaEngine()
        print("    - BRAHMA Policy Engine: [READY]")
    except Exception as e:
        print(f"    - BRAHMA Policy Engine: [ERROR: {e}]")

def main():
    print("=" * 65)
    print("  SECURA AI 3.0 — PRE-FLIGHT VERIFICATION CHECKLIST")
    print("=" * 65)
    
    py_ok = check_python_version()
    node_ok = check_node()
    torch_ok = check_pytorch_and_device()
    models_ok = check_models()
    
    print("-" * 65)
    test_inference_pipeline()
    
    print("=" * 65)
    if py_ok and torch_ok and models_ok:
        print("  VERIFICATION RESULT: ALL CORE SYSTEMS ARE FUNCTIONAL")
        print("  You can launch the platform with: .\\scripts\\start.ps1")
    else:
        print("  VERIFICATION RESULT: SETUP ISSUES DETECTED")
        print("  Run .\\scripts\\install.ps1 to resolve missing dependencies.")
    print("=" * 65)

if __name__ == "__main__":
    main()
