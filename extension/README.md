# Secura AI - Google Chrome Extension (Manifest V3)

Instant right-click media authenticity scanner and forensic HUD powered by your local Secura AI engine.

---

## 🚀 How to Install in Google Chrome / Chromium Browsers

1. Open **Google Chrome** (or Edge / Brave / Arc).
2. Navigate to: `chrome://extensions` in your address bar.
3. In the top-right corner of the Extensions page, toggle **Developer mode** to **ON**.
4. Click the button labeled **Load unpacked** in the top-left corner.
5. Select the folder:
   ```
   d:\SecuraAI2\extension
   ```
6. The extension **Secura AI - Media Integrity & Deepfake Inspector** will now be loaded and active.

---

## 🔍 How to Use It

1. Make sure your local Secura AI backend is running on `http://127.0.0.1:8000`.
2. Browse to any website containing images or videos (e.g. news sites, social media, Wikipedia).
3. **Right-click** on any image or video.
4. Select **"Inspect with Secura AI"** from the context menu.
5. A forensic HUD modal will slide onto your screen showing:
   - **Canonical Verdict**: AI-Generated vs Camera Capture / Authentic
   - **Confidence Score & Metric Breakdown**
   - **C2PA Provenance Manifest Validation**
   - **SynthID Watermark Detection**
   - **Direct Link to Full Secura Enterprise Suite**
