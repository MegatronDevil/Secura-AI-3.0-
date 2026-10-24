# SECURA AI — EXTENSION IMAGE DETECTOR (v1) TRAINING & INTEGRATION REPORT
## ISOLATED WEB-ROBUST CLASSIFIER FOR THE SECURA CHROME EXTENSION

**Model Identifier:** `extension_image_detector_v1`  
**Model Version:** `1.0.0-ext-robust`  
**Operating Threshold:** `0.50` (Calibrated on Validation Set)  
**Execution Environment:** FastAPI daemon running on `http://127.0.0.1:8000`  
**Zero-Modification Guarantee:** 100% SHA-256 byte parity preserved across all main image and video checkpoints.

---

### 1. EXACT MODEL ARCHITECTURE
- **Feature Backbone (Frozen Offline):** CLIP ViT-L/14 (`backend/models/weights/clip-vit-large-patch14`), projecting raw RGB inputs into $768$-dimensional $L_2$-normalized semantic latent embeddings.
- **Classification Head (`ExtensionRobustMLP`):**
  $$\text{Input } (768) \xrightarrow{} \text{Linear}(768, 256) \xrightarrow{} \text{LayerNorm}(256) \xrightarrow{} \text{GELU}() \xrightarrow{} \text{Dropout}(0.25) \xrightarrow{} \text{Linear}(256, 64) \xrightarrow{} \text{GELU}() \xrightarrow{} \text{Dropout}(0.125) \xrightarrow{} \text{Linear}(64, 1)$$
- **Score Semantics:** Single calibrated raw logit $z \in (-\infty, +\infty)$ mapped via logistic sigmoid $\sigma(z) \in [0.0, 1.0]$ representing $P(\text{AI GENERATED})$.
- **Design Rationale:** By training a multi-layer regularized projection on high-dimensional CLIP representations, the head learns to discriminate generator-specific latent artifacts from camera sensor degradations (lossy JPEG compression, downscaling, EXIF stripping, canvas transcoding) without altering the foundational vision encoder.

---

### 2. DATASETS AND LICENSING
1. **Diverse Authentic Photography Corpus (`online_dataset/real`, `ai_detection/images`):**
   - *Provenance:* Real photographic benchmarks (natural landscapes, portrait photography, architectural structures, smartphone captures with flash blowout and specular highlights).
   - *Licensing:* Permitted research/evaluation photography datasets under Creative Commons / Open Access.
2. **Synthetic AI Imagery Corpus (`online_dataset/ai`, `ai_detection/images`, C2PA Sealed DALL-E 3):**
   - *Provenance:* Midjourney, Stable Diffusion (v1.5, XL), DALL-E 3, and GAN generators covering portraits, photorealistic street scenes, and surrealistic digital art.
   - *Licensing:* Open generative benchmarks with declared synthetic provenance.

---

### 3. UNIQUE IMAGE COUNTS AND CLASS DISTRIBUTION
- **Total Unique Source Parent Images:** $133$
  - `REAL_AUTHENTIC` Unique Parents: $72$ ($54.1\%$)
  - `AI_GENERATED` Unique Parents: $61$ ($45.9\%$)
- **Total Multi-Condition Web Variants Generated:** $931$
  - Each parent image produced 7 paired web transformations:
    1. `original`: Unaltered high-quality baseline
    2. `jpeg_q75`: Standard CDN / social-media lossy JPEG encoding
    3. `jpeg_q55`: Aggressive mobile data-saver compression
    4. `downscale_50`: Bilinear 50% spatial downscaling
    5. `thumbnail_320`: 320px bounding-box responsive thumbnail
    6. `canvas_png`: Chrome Extension DOM canvas transcode (complete EXIF/metadata removal)
    7. `crop_80`: 80% viewport center crop

---

### 4. DATA LEAKAGE PREVENTION & SPLIT METHODOLOGY
- **Partitioning Rule:** Grouped strictly by parent source image SHA-256 hash.
- **Zero-Leakage Guarantee:** All 7 transformed variants of any given parent image reside strictly within that parent's assigned split. Never did an original or compressed variant of a test image appear in training or validation sets.
- **Split Distribution:**
  - **Train Split (70%):** 50 Real parents (350 variants) + 42 AI parents (294 variants) = **644 total images**
  - **Validation Split (15%):** 10 Real parents (70 variants) + 9 AI parents (63 variants) = **133 total images**
  - **Held-Out Locked Test Split (15%):** 12 Real parents (84 variants) + 10 AI parents (70 variants) = **154 total images**

---

### 5. TRAINING CONFIGURATION & HARDWARE
- **Hardware:** Intel Core CPU execution in `.venv` (PyTorch 2.14.1+cpu).
- **Optimizer:** `AdamW` ($\text{lr} = 1\times 10^{-3}$, $\beta_1=0.9, \beta_2=0.999$, $\text{weight\_decay} = 1\times 10^{-4}$).
- **Scheduler:** `CosineAnnealingLR` over 35 epochs ($\eta_{\min} = 1\times 10^{-5}$).
- **Batch Size:** 32.
- **Loss Function:** `BCEWithLogitsLoss` with class-frequency balancing weight $\text{pos\_weight} = 1.19$.
- **Best Model Criterion:** Maximized validation balanced accuracy and minimized validation loss. Best checkpoint reached at Epoch 6.

---

### 6. TRAINING LOGS & CHECKPOINTS
- **Checkpoint Location:** `backend/models/weights/extension_image_detector_v1/model_weights.pt` ($859\text{ KB}$)
- **Model Metadata & Threshold:** `backend/models/weights/extension_image_detector_v1/config.json`
- **Training Epoch History:** `backend/models/weights/extension_image_detector_v1/training_log.json`
- **Validation Threshold Optimization:**
  - Sweep from $\tau = 0.35$ to $0.75$ confirmed optimal threshold $\tau = 0.50$ (Val Balanced Accuracy: $83.97\%$, Val FPR: $11.43\%$, Val F1: $0.8264$).

---

### 7. HELD-OUT TEST METRICS & CONFUSION MATRIX
Evaluated on locked held-out test split ($N = 154$ unseen web-transformed images):

| Metric | Score |
| :--- | :--- |
| **Total Test Samples** | **154** |
| **Balanced Accuracy** | **79.40%** |
| **F1 Score** | **0.7704** |
| **Precision** | **80.00%** |
| **Recall (Sensitivity)** | **74.29%** |
| **Specificity** | **84.52%** |
| **False Positive Rate (Authentic misclassified as AI)** | **15.48%** |
| **False Negative Rate (AI missed)** | **25.71%** |

#### Confusion Matrix:
```
                      Actual Real (84)     Actual AI (70)
Predicted Real (89)        71 (TN)              18 (FN)
Predicted AI (65)          13 (FP)              52 (TP)
```

---

### 8. PERFORMANCE ACROSS WEB TRANSFORMATIONS

| Web Transformation Type | Balanced Accuracy | False Positive Rate | False Negative Rate | F1 Score |
| :--- | :---: | :---: | :---: | :---: |
| **crop_80** (Viewport Crop) | **85.83%** | **8.33%** | **20.00%** | **0.8421** |
| **jpeg_q75** (Social CDN Compression) | **81.67%** | **16.67%** | **20.00%** | **0.8000** |
| **thumbnail_320** (Responsive Thumbnails) | **81.67%** | **16.67%** | **20.00%** | **0.8000** |
| **canvas_png** (DOM Canvas Transcode) | **76.67%** | **16.67%** | **30.00%** | **0.7368** |
| **jpeg_q55** (Aggressive Compression) | **76.67%** | **16.67%** | **30.00%** | **0.7368** |
| **downscale_50** (50% Downscaled) | **76.67%** | **16.67%** | **30.00%** | **0.7368** |
| **original** (Baseline Full Quality) | **76.67%** | **16.67%** | **30.00%** | **0.7368** |

---

### 9. DIAGNOSTIC CHALLENGE EVALUATION
Tested directly against the problematic authentic phone flash photo (`media_1792740611532.jpg`, SHA-256: `4c4c23933c09f871302cba394c86bc9a0ebcc41a4a9cf47321e06fa59be73c3d`):

- **Main Application Default (`Ensemble`):** Outputted `AI Likelihood: 91.8%`, triggering false positive due to Swin patch attention on flash specular blowout and EXIF absence.
- **New Extension Detector (`ExtensionImageDetectorV1`):**
  - Raw Logit: `-5.3794`
  - Synthetic Probability: $P(\text{AI}) = \mathbf{0.0046}$ ($0.46\%$ AI score $\rightarrow \mathbf{99.54\%}$ **Authentic Real**)
  - Verdict: `NOT_AI_GENERATED` / `LIKELY_REAL`
  - Latency: $331.84\text{ ms}$

---

### 10. CHROME EXTENSION INTEGRATION CHANGES
1. **Background Route Routing (`extension/background.js`):**
   - Web images inspected via context menu now explicitly pass `?probe=ExtensionImageDetectorV1`.
   - Video frames continue routing to `?probe=Ensemble&source_type=video_frame` to preserve ReStraV temporal modeling.
2. **Verdict & Score Telemetry (`extension/content.js`):**
   - Replaced artificial `100 - aiPct` synthesis with direct model name, calibrated score, and score semantics from `canonical_verdict`.
   - Deduplicated `consecutiveStrikes`: re-inspecting the same media asset no longer erroneously advances security threat strikes.

---

### 11. ZERO-MODIFICATION MODEL WEIGHT VERIFICATION

| Protected Model File | Expected SHA-256 Hash | Post-Training SHA-256 Hash | Status |
| :--- | :--- | :--- | :---: |
| `swin-ai-image-detector/model.safetensors` | `aea31f822cb76aee2ee60950bc602dd4bf5ba5c4a444a27946a7da0017da72be` | `aea31f822cb76aee2ee60950bc602dd4bf5ba5c4a444a27946a7da0017da72be` | **MATCH** |
| `clip-vit-large-patch14/model.safetensors` | `a2bf730a0c7debf160f7a6b50b3aaf3703e7e88ac73de7a314903141db026dcb` | `a2bf730a0c7debf160f7a6b50b3aaf3703e7e88ac73de7a314903141db026dcb` | **MATCH** |
| `all-MiniLM-L6-v2/model.safetensors` | `53aa51172d142c89d9012cce15ae4d6cc0ca6895895114379cacb4fab128d9db` | `53aa51172d142c89d9012cce15ae4d6cc0ca6895895114379cacb4fab128d9db` | **MATCH** |
| `fc_weights.pth` (UniversalFakeDetect) | `477100745713bcc957beb2b40859536859b6483fd6301b3b9293151b194c7847` | `477100745713bcc957beb2b40859536859b6483fd6301b3b9293151b194c7847` | **MATCH** |
| `custom_fc_weights.pth` (SecuraCustom) | `85bd1cf7d6c61ea851a28d5098e8b7d1187aeb8654deb5a183be8e1df7cc8259` | `85bd1cf7d6c61ea851a28d5098e8b7d1187aeb8654deb5a183be8e1df7cc8259` | **MATCH** |
| `restrav_temporal/restrav_mlp.pt` | `3462ad5b9ad47e2e4cd119360097c87e10d2541f3a546d87286c803d4008195f` | `3462ad5b9ad47e2e4cd119360097c87e10d2541f3a546d87286c803d4008195f` | **MATCH** |

---

### 12. RUNTIME STATUS & VERIFICATION
- **Daemon Process:** `uvicorn` running on `http://127.0.0.1:8000`
- **Health Check Endpoint:** `http://127.0.0.1:8000/api/v1/health` $\rightarrow$ `{"status": "healthy"}`
- **Default Main App Route:** `POST /api/v1/analyze/image` $\rightarrow$ Executes `Multi-Architecture Ensemble (Swin + CLIP ViT-L/14) v1.0.0-ensemble`
- **Extension Route:** `POST /api/v1/analyze/image?probe=ExtensionImageDetectorV1` $\rightarrow$ Executes `Secura Extension Image Detector v1 (1.0.0-ext-robust)`

---

### 13. LIMITATIONS, RISKS & ROLLBACK PROCEDURE
- **Limitations:** Focuses on single-frame spatial and representation-level artifacts. Heavily stylized digital artwork (non-photographic) or ultra-low resolution assets (< 64px) may yield indeterminate representation margins.
- **Instant Rollback:** If the extension needs to be restored to the legacy ensemble, change line 427 of `extension/background.js` back to:
  ```javascript
  apiEndpoint = `${API_BASE_URL}/api/v1/analyze/image?probe=Ensemble`;
  ```
  Because all original model files and configurations remain unmodified, rollback requires zero retraining or server downtime.
