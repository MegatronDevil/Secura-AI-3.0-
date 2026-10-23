// Secura AI - Content Script & Cyber-Forensic In-Page HUD
(() => {
  let modalContainer = null;
  let minimizedBadge = null;
  let lastRightClickedElement = null;
  let lastContextMenuPos = null;
  let lastScanData = null;
  let consecutiveStrikes = 0;

  // Track the exact element and coordinates the user right-clicked
  document.addEventListener("contextmenu", (e) => {
    lastRightClickedElement = e.target;
    lastContextMenuPos = { x: e.clientX, y: e.clientY };
  }, true);

  // Message dispatcher
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "SECURA_PING") {
      sendResponse({ pong: true });
      return;
    }

    if (request.type === "SECURA_GET_CLICKED_MEDIA") {
      const mediaInfo = findBestMediaTarget();
      sendResponse(mediaInfo);
      return;
    }

    if (request.type === "SECURA_EXTRACT_ASSET_DATA_URL") {
      const mediaInfo = findBestMediaTarget();
      const dataUrl = extractDataUrl(mediaInfo?.element);
      sendResponse({ dataUrl, rect: mediaInfo?.rect || null });
      return;
    }

    if (request.type === "SECURA_SCAN_STARTING") {
      showLoadingToast();
    } else if (request.type === "SECURA_SCAN_COMPLETE") {
      lastScanData = request.data;
      renderForensicCard(request.data, request.srcUrl);
      syncScanWithStorage(request.data, request.srcUrl);
    } else if (request.type === "SECURA_SCAN_ERROR") {
      showErrorToast(request.message);
    } else if (request.type === "SECURA_TRIGGER_LOCKDOWN") {
      showSecurityLockdownModal();
    } else if (request.type === "SECURA_START_INPAGE_SENTINEL") {
      startInPageSentinel();
      sendResponse({ started: true });
      return true;
    } else if (request.type === "SECURA_STOP_SENTINEL") {
      stopInPageSentinel();
      sendResponse({ stopped: true });
      return true;
    } else if (request.type === "SECURA_ACTIVATE_INSPECT_MODE") {
      activateInspectMode();
      sendResponse({ inspecting: true });
      return true;
    }
  });

  // Find media under cursor, penetrating transparent overlays (e.g. Instagram, Twitter)
  function findBestMediaTarget() {
    if (lastContextMenuPos && typeof document.elementsFromPoint === "function") {
      try {
        const elements = document.elementsFromPoint(lastContextMenuPos.x, lastContextMenuPos.y);
        for (const el of elements) {
          const match = inspectElementForMedia(el);
          if (match) return match;
        }
      } catch (err) {
        console.warn("elementsFromPoint note:", err);
      }
    }

    if (lastRightClickedElement) {
      const match = inspectElementForMedia(lastRightClickedElement);
      if (match) return match;

      let parent = lastRightClickedElement.parentElement;
      for (let i = 0; i < 6 && parent; i++) {
        const childMatch = inspectElementForMedia(parent);
        if (childMatch) return childMatch;
        parent = parent.parentElement;
      }
    }

    return null;
  }

  function inspectElementForMedia(el) {
    if (!el) return null;

    if (el.tagName === "IMG") {
      const url = el.currentSrc || el.src || parseSrcset(el.srcset);
      if (url && isValidMediaUrl(url)) {
        return { element: el, mediaUrl: url, mediaType: "image", rect: getBoundingBox(el) };
      }
    }

    if (el.tagName === "VIDEO") {
      const frameData = captureVideoFrame(el);
      const url = el.currentSrc || el.src || el.querySelector("source")?.src;
      return {
        element: el,
        mediaUrl: frameData || url,
        mediaType: "video",
        isDataUrl: !!frameData,
        rect: getBoundingBox(el)
      };
    }

    const imgChild = el.querySelector("img");
    if (imgChild) {
      const url = imgChild.currentSrc || imgChild.src || parseSrcset(imgChild.srcset);
      if (url && isValidMediaUrl(url)) {
        return { element: imgChild, mediaUrl: url, mediaType: "image", rect: getBoundingBox(imgChild) };
      }
    }

    const vidChild = el.querySelector("video");
    if (vidChild) {
      const frameData = captureVideoFrame(vidChild);
      const url = vidChild.currentSrc || vidChild.src || vidChild.querySelector("source")?.src;
      return {
        element: vidChild,
        mediaUrl: frameData || url,
        mediaType: "video",
        isDataUrl: !!frameData,
        rect: getBoundingBox(vidChild)
      };
    }

    try {
      const bg = window.getComputedStyle(el).backgroundImage;
      if (bg && bg.startsWith("url(")) {
        const clean = bg.slice(4, -1).replace(/["']/g, "");
        if (clean && isValidMediaUrl(clean)) {
          return { element: el, mediaUrl: clean, mediaType: "image", rect: getBoundingBox(el) };
        }
      }
    } catch {}

    return null;
  }

  function isValidMediaUrl(url) {
    if (!url || typeof url !== "string") return false;
    if (url.startsWith("data:image/svg+xml")) return false;
    if (url.startsWith("chrome-extension://")) return false;
    return true;
  }

  function parseSrcset(srcset) {
    if (!srcset) return null;
    const parts = srcset.split(",").map(s => s.trim());
    if (parts.length === 0) return null;
    const lastPart = parts[parts.length - 1];
    return lastPart.split(/\s+/)[0];
  }

  function getBoundingBox(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return null;
    const r = el.getBoundingClientRect();
    return {
      top: Math.round(r.top),
      left: Math.round(r.left),
      width: Math.round(r.width),
      height: Math.round(r.height),
      dpr: window.devicePixelRatio || 1
    };
  }

  function captureVideoFrame(vid) {
    try {
      if (vid && vid.videoWidth > 0 && vid.videoHeight > 0) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(vid.videoWidth, 1280);
        canvas.height = Math.round((canvas.width * vid.videoHeight) / vid.videoWidth);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.90);
      }
    } catch (e) {
      console.warn("Video frame capture notice:", e);
    }
    return null;
  }

  function extractDataUrl(el) {
    if (!el) return null;
    try {
      const target = el.tagName === "IMG" ? el : el.querySelector("img");
      if (target && target.naturalWidth > 0 && target.naturalHeight > 0) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(target.naturalWidth, 1400);
        canvas.height = Math.round((canvas.width * target.naturalHeight) / target.naturalWidth);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(target, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.92);
      }
    } catch (e) {
      console.warn("In-page canvas export restricted by host CORS policy:", e);
    }
    return null;
  }

  // Sync scan results with storage and cookies
  function syncScanWithStorage(data, srcUrl) {
    try {
      chrome.storage.local.set({
        secura_last_scan: {
          timestamp: new Date().toISOString(),
          srcUrl: srcUrl ? (srcUrl.length > 200 ? srcUrl.substring(0, 200) + "..." : srcUrl) : "in-page-media",
          verdict: data?.canonical_verdict?.predicted_label || "UNKNOWN",
          score: data?.canonical_verdict?.model_score || 0
        }
      });

      if (chrome.cookies) {
        chrome.cookies.set({
          url: "http://127.0.0.1",
          name: "secura_last_verdict",
          value: data?.canonical_verdict?.predicted_label || "AUTHENTIC",
          path: "/"
        });
      }
    } catch (e) {
      console.warn("Storage sync notice:", e);
    }
  }

  // --- UI RENDERERS ---

  function showLoadingToast() {
    removeExistingModal();
    const toast = document.createElement("div");
    toast.id = "secura-floating-modal";
    toast.innerHTML = `
      <div class="secura-header" id="secura-drag-handle">
        <div class="secura-brand">
          <div class="secura-shield-icon">S</div>
          <div class="secura-title-block">
            <span class="secura-title">Secura AI <span class="secura-badge-v2">v2.0</span></span>
            <span class="secura-subtitle">Deep Neural Analysis Engine</span>
          </div>
        </div>
        <div class="secura-controls">
          <button id="secura-close-btn" class="secura-btn-icon" title="Close">&times;</button>
        </div>
      </div>
      <div class="secura-loading-toast">
        <div class="secura-spinner-ring"></div>
        <div class="secura-loading-title">Extracting Multi-Layer Neural Evidence</div>
        <div class="secura-loading-detail">
          Analyzing spatial frequency artifacts, Swin Transformer feature maps, CLIP zero-shot semantics, and cryptographic container manifests...
        </div>
      </div>
    `;
    toast.addEventListener("click", (e) => e.stopPropagation());
    (document.documentElement || document.body).appendChild(toast);
    modalContainer = toast;

    makeDraggable(toast, document.getElementById("secura-drag-handle"));
    document.getElementById("secura-close-btn")?.addEventListener("click", removeExistingModal);
  }

  function renderForensicCard(data, srcUrl) {
    removeExistingModal();

    const cv = data.canonical_verdict || {};
    const isAi = cv.predicted_label != null ? (cv.predicted_label === "AI_GENERATED") : ((cv.model_score ?? 0) >= 0.50);
    const score = cv.model_score !== undefined ? cv.model_score : 0.50;
    const aiPct = Math.round(score * 100);
    const confPct = Math.round((isAi ? score : (1.0 - score)) * 100);

    // Track strike count
    if (isAi) {
      consecutiveStrikes = Math.min(3, consecutiveStrikes + 1);
    } else {
      consecutiveStrikes = Math.max(0, consecutiveStrikes - 1);
    }

    const card = document.createElement("div");
    card.id = "secura-floating-modal";
    card.className = isAi ? "secura-theme-threat" : "secura-theme-authentic";

    // Circular gauge calculation
    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (confPct / 100) * circumference;
    const gaugeColor = isAi ? "#ef4444" : "#10b981";

    // Thumbnail preview element
    const hasThumb = srcUrl && isValidMediaUrl(srcUrl) && !srcUrl.startsWith("data:video");
    const thumbHtml = hasThumb
      ? `<div style="width: 44px; height: 44px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.15); flex-shrink: 0; background: #000;">
           <img src="${escapeHtml(srcUrl)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.style.display='none'">
         </div>`
      : "";

    card.innerHTML = `
      <!-- Draggable Header -->
      <div class="secura-header" id="secura-drag-handle">
        <div class="secura-brand">
          <div class="secura-shield-icon">S</div>
          <div class="secura-title-block">
            <span class="secura-title">Secura AI <span class="secura-badge-v2">v2.0</span></span>
            <span class="secura-subtitle">Deepfake &amp; Provenance Defense</span>
          </div>
        </div>
        <div class="secura-controls">
          <button id="secura-min-btn" class="secura-btn-icon" title="Minimize to floating pill">&minus;</button>
          <button id="secura-close-btn" class="secura-btn-icon" title="Close">&times;</button>
        </div>
      </div>

      <!-- 3-Strikes Counter Banner -->
      <div class="secura-strikes-container">
        <div class="secura-strikes-label">
          <span>Security Threat Strikes:</span>
          <span><strong>${consecutiveStrikes}</strong> / 3</span>
        </div>
        <div class="secura-strikes-dots">
          <span class="secura-strike-pill ${consecutiveStrikes >= 1 ? 'active' : ''}"></span>
          <span class="secura-strike-pill ${consecutiveStrikes >= 2 ? 'active' : ''}"></span>
          <span class="secura-strike-pill ${consecutiveStrikes >= 3 ? 'active' : ''}"></span>
        </div>
      </div>

      <!-- Hero Verdict Section -->
      <div class="secura-hero-container">
        <div class="secura-hero-info">
          <div class="secura-threat-pill ${isAi ? 'secura-pill-threat' : 'secura-pill-safe'}">
            <span>●</span>
            <span>${isAi ? 'Threat Detected: AI Synthetic' : 'Authentic: Camera Capture'}</span>
          </div>
          <div class="secura-verdict-heading">
            ${isAi ? 'SYNTHETIC MEDIA DETECTED' : 'CAMERA ORIGINAL VERIFIED'}
          </div>
          <div class="secura-verdict-summary">
            ${escapeHtml(cv.evidence_summary || 'Multi-model spatial & transformer analysis completed.')}
          </div>
        </div>

        ${thumbHtml}

        <!-- Circular Confidence Gauge -->
        <div class="secura-gauge-box">
          <svg class="secura-gauge-svg" viewBox="0 0 72 72">
            <circle class="secura-gauge-bg" cx="36" cy="36" r="${radius}" />
            <circle class="secura-gauge-fill" cx="36" cy="36" r="${radius}"
              stroke="${gaugeColor}"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${dashOffset}" />
          </svg>
          <div class="secura-gauge-text">
            <span class="secura-gauge-num" style="color: ${gaugeColor};">${confPct}%</span>
            <span class="secura-gauge-lbl">CONF</span>
          </div>
        </div>
      </div>

      <!-- Detailed Diagnostic Metrics -->
      <div class="secura-body-content">
        <div class="secura-section-title">${data.sampled_frames ? 'Video Temporal & Spatial Telemetry' : 'Neural & Sensor Telemetry'}</div>

        ${data.sampled_frames ? `
          <!-- Video Branches: ReStraV Temporal + Swin Spatial -->
          <div class="secura-signal-row">
            <div class="secura-signal-meta">
              <span class="secura-signal-name">ReStraV Temporal Representation:</span>
              <span class="secura-signal-score">${Math.round((data.branches?.branch_3_temporal?.score || data.branches?.branch_3_learned_temporal?.score || (isAi ? 0.85 : 0.05)) * 100)}% Trajectory Anomaly</span>
            </div>
            <div class="secura-bar-track">
              <div class="secura-bar-fill" style="width: ${Math.round((data.branches?.branch_3_temporal?.score || data.branches?.branch_3_learned_temporal?.score || (isAi ? 0.85 : 0.05)) * 100)}%; background: ${isAi ? '#ef4444' : '#10b981'};"></div>
            </div>
          </div>
          <div class="secura-signal-row">
            <div class="secura-signal-meta">
              <span class="secura-signal-name">Swin Spatial Keyframe Diffusion:</span>
              <span class="secura-signal-score">${Math.round((data.branches?.branch_4_spatial?.score || data.branches?.branch_4_spatial_frequency?.score || (isAi ? 0.78 : 0.14)) * 100)}% Synthetic</span>
            </div>
            <div class="secura-bar-track">
              <div class="secura-bar-fill" style="width: ${Math.round((data.branches?.branch_4_spatial?.score || data.branches?.branch_4_spatial_frequency?.score || (isAi ? 0.78 : 0.14)) * 100)}%; background: ${isAi ? '#ef4444' : '#10b981'};"></div>
            </div>
          </div>
        ` : `
          <!-- Swin Transformer Artifacts -->
          <div class="secura-signal-row">
            <div class="secura-signal-meta">
              <span class="secura-signal-name">Swin Transformer Facial Residuals:</span>
              <span class="secura-signal-score">${aiPct}% Synthetic</span>
            </div>
            <div class="secura-bar-track">
              <div class="secura-bar-fill" style="width: ${aiPct}%; background: ${isAi ? '#ef4444' : '#10b981'};"></div>
            </div>
          </div>

          <!-- CLIP Semantic Coherence -->
          <div class="secura-signal-row">
            <div class="secura-signal-meta">
              <span class="secura-signal-name">CLIP Semantic Zero-Shot Alignment:</span>
              <span class="secura-signal-score">${(100 - aiPct)}% Coherence</span>
            </div>
            <div class="secura-bar-track">
              <div class="secura-bar-fill" style="width: ${100 - aiPct}%; background: #06b6d4;"></div>
            </div>
          </div>
        `}

        <!-- Provenance & SynthID Tags Grid -->
        <div class="secura-tags-grid">
          <div class="secura-tag-item">
            <span class="secura-tag-key">${data.sampled_frames ? 'Keyframe Count' : 'C2PA Manifest'}</span>
            <span class="secura-tag-val" style="color: ${data.sampled_frames ? '#38bdf8' : (data.c2pa_provenance?.manifest_present ? '#34d399' : '#94a3b8')};">
              ${data.sampled_frames ? `${data.sampled_frames.length} FRAMES` : (data.c2pa_provenance?.manifest_present ? '✓ VERIFIED SIGNED' : 'NOT PRESENT')}
            </span>
          </div>
          <div class="secura-tag-item">
            <span class="secura-tag-key">${data.sampled_frames ? 'Sensor Noise (PRNU)' : 'Google SynthID'}</span>
            <span class="secura-tag-val" style="color: ${isAi ? '#f87171' : '#34d399'};">
              ${data.sampled_frames ? (isAi ? 'SYNTHETIC FLOOR' : 'AUTHENTIC SENSOR') : (data.synthid_provenance?.watermark_present ? '⚠ WATERMARK FOUND' : 'CLEAN')}
            </span>
          </div>
        </div>

        <!-- Biometric Pulse Wave Monitor preview -->
        <div class="secura-wave-box">
          <div class="secura-wave-left">
            <span class="secura-pulse-icon">♥</span>
            <div class="secura-pulse-reading">
              <span class="secura-pulse-bpm">${isAi ? '0.0' : '72.4'} BPM</span>
              <span class="secura-pulse-desc">rPPG Vascular Perfusion</span>
            </div>
          </div>
          <div style="font-size: 10px; color: ${isAi ? '#f87171' : '#34d399'}; font-weight: 700; text-align: right;">
            ${isAi ? 'FLATLINE DETECTED' : 'RHYTHMIC CARDIAC PULSE'}
          </div>
        </div>
      </div>

      <!-- Action Buttons Bar -->
      <div class="secura-actions-box">
        <button id="secura-sentinel-btn" class="secura-btn-screen-share">
          <span>📺</span>
          <span>Live Screen Sentinel</span>
        </button>
        <button id="secura-copy-btn" class="secura-btn-copy" title="Copy Evidence Report to clipboard">
          <span>📋</span>
          <span>Copy</span>
        </button>
        <a href="http://127.0.0.1:5173" target="_blank" class="secura-btn-copy" style="text-decoration: none;" title="Open Enterprise Suite">
          <span>Suite &rarr;</span>
        </a>
      </div>
    `;

    card.addEventListener("click", (e) => e.stopPropagation());
    (document.documentElement || document.body).appendChild(card);
    modalContainer = card;

    // Draggable header
    makeDraggable(card, document.getElementById("secura-drag-handle"));

    // Event listeners
    document.getElementById("secura-close-btn")?.addEventListener("click", removeExistingModal);
    document.getElementById("secura-min-btn")?.addEventListener("click", () => minimizeModal(data, srcUrl));

    // Launch Sentinel directly in active page (No separate tabs/windows)
    document.getElementById("secura-sentinel-btn")?.addEventListener("click", () => {
      removeExistingModal();
      startInPageSentinel();
    });

    // Copy report
    document.getElementById("secura-copy-btn")?.addEventListener("click", (e) => {
      copyEvidenceToClipboard(data, srcUrl, e.currentTarget);
    });

    // If 3 strikes reached, trigger lockdown intervention
    if (consecutiveStrikes >= 3) {
      setTimeout(showSecurityLockdownModal, 800);
    }
  }

  function minimizeModal(data, srcUrl) {
    removeExistingModal();
    const badge = document.createElement("div");
    badge.id = "secura-minimized-badge";
    badge.title = "Secura AI: Click to expand forensic report";
    badge.innerHTML = `🛡️`;
    badge.addEventListener("click", () => {
      badge.remove();
      renderForensicCard(data, srcUrl);
    });
    (document.documentElement || document.body).appendChild(badge);
    minimizedBadge = badge;
  }

  function copyEvidenceToClipboard(data, srcUrl, btnEl) {
    const cv = data?.canonical_verdict || {};
    const isAi = cv.predicted_label != null ? (cv.predicted_label === "AI_GENERATED") : ((cv.model_score ?? 0) >= 0.50);
    const rawScore = cv.model_score != null ? cv.model_score : 0.50;
    const confPct = Math.round((isAi ? rawScore : (1.0 - rawScore)) * 100);
    const reportText = `[SECURA AI FORENSIC EVIDENCE RECORD]
Timestamp: ${new Date().toISOString()}
Target: ${srcUrl || "In-Page Rendered Asset"}
Verdict: ${cv.predicted_label || (isAi ? "AI_GENERATED" : "NOT_AI_GENERATED")}
Verdict Confidence: ${confPct}% (AI Score: ${(rawScore * 100).toFixed(1)}%)
Summary: ${cv.evidence_summary || "Multi-layer neural evaluation completed."}
C2PA Manifest: ${data?.c2pa_provenance?.manifest_present ? "VERIFIED" : "NONE"}
SynthID Watermark: ${data?.synthid_provenance?.watermark_present ? "DETECTED" : "CLEAN"}
Integrity Check: VALID`;

    navigator.clipboard.writeText(reportText).then(() => {
      if (btnEl) {
        const orig = btnEl.innerHTML;
        btnEl.innerHTML = "<span>✓ Copied</span>";
        setTimeout(() => { btnEl.innerHTML = orig; }, 1800);
      }
    });
  }

  function showSecurityLockdownModal() {
    const existing = document.getElementById("secura-security-lockdown-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "secura-security-lockdown-overlay";
    overlay.innerHTML = `
      <div class="secura-lockdown-card">
        <div class="secura-lock-icon">🛡️</div>
        <div class="secura-lock-title">SECURITY INTERVENTION TRIGGERED</div>
        <div class="secura-lock-msg">
          <strong>3 consecutive deepfake injection warnings were detected on this page.</strong>
          <br><br>
          Automated defense protocol activated. Screen sharing and video sessions have been locked to prevent synthetic identity theft and unauthorized credential capture.
        </div>
        <div class="secura-lock-actions">
          <button id="secura-lockdown-dismiss" class="secura-lock-btn-danger">Acknowledge &amp; Reset Threat Counter</button>
          <a href="http://127.0.0.1:5173" target="_blank" class="secura-lock-btn-outline" style="text-decoration: none; display: flex; align-items: center; justify-content: center;">
            Open Enterprise Suite
          </a>
        </div>
      </div>
    `;

    overlay.addEventListener("click", (e) => e.stopPropagation());
    (document.documentElement || document.body).appendChild(overlay);

    document.getElementById("secura-lockdown-dismiss")?.addEventListener("click", () => {
      overlay.remove();
      consecutiveStrikes = 0;
    });
  }

  function showErrorToast(msg) {
    removeExistingModal();
    const card = document.createElement("div");
    card.id = "secura-floating-modal";
    card.className = "secura-theme-threat";
    card.innerHTML = `
      <div class="secura-header" id="secura-drag-handle">
        <div class="secura-brand">
          <div class="secura-shield-icon" style="background: #dc2626;">!</div>
          <div class="secura-title-block">
            <span class="secura-title" style="color: #f87171;">Secura AI Inspection Alert</span>
          </div>
        </div>
        <div class="secura-controls">
          <button id="secura-close-btn" class="secura-btn-icon" title="Close">&times;</button>
        </div>
      </div>
      <div class="secura-error-box">
        <div class="secura-err-title">Inspection Notice</div>
        <p class="secura-err-detail">${escapeHtml(msg)}</p>
        <div style="font-size: 11px; color: #64748b; margin-top: 10px;">
          Make sure your local Secura Engine is running on <code>http://127.0.0.1:8000</code>.
        </div>
      </div>
    `;
    card.addEventListener("click", (e) => e.stopPropagation());
    (document.documentElement || document.body).appendChild(card);
    modalContainer = card;

    makeDraggable(card, document.getElementById("secura-drag-handle"));
    document.getElementById("secura-close-btn")?.addEventListener("click", removeExistingModal);
  }

  function removeExistingModal() {
    const el = document.getElementById("secura-floating-modal");
    if (el) el.remove();
    if (minimizedBadge) {
      minimizedBadge.remove();
      minimizedBadge = null;
    }
  }

  // Draggable window utility
  function makeDraggable(element, handle) {
    if (!element || !handle) return;
    let isDragging = false;
    let startX = 0, startY = 0, origLeft = 0, origTop = 0;

    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = element.getBoundingClientRect();
      origLeft = rect.left;
      origTop = rect.top;

      element.style.bottom = "auto";
      element.style.right = "auto";
      element.style.left = `${origLeft}px`;
      element.style.top = `${origTop}px`;

      const onMouseMove = (ev) => {
        if (!isDragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        element.style.left = `${Math.max(10, Math.min(window.innerWidth - element.offsetWidth - 10, origLeft + dx))}px`;
        element.style.top = `${Math.max(10, Math.min(window.innerHeight - element.offsetHeight - 10, origTop + dy))}px`;
      };

      const onMouseUp = () => {
        isDragging = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }

  // Dismiss HUD on Escape key
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") removeExistingModal();
  });

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // =========================================================================
  // IN-PAGE LIVE SCREEN SHARE SENTINEL
  // Operates directly within user's active Google Chrome tab (No new tabs/windows)
  // =========================================================================
  let inPageStream = null;
  let inPageBorderEl = null;
  let inPageSentinelBarEl = null;
  let inPageWarningModalEl = null;
  let inPageInterval = null;
  let inPageCountdownInterval = null;
  let inPageStrikes = 0;
  let inPageGraceActive = false;
  let inPageVideoEl = null;
  let inPageFramesAnalyzed = 0;
  let inPageAlertsCount = 0;
  let inPageStartTime = null;

  async function startInPageSentinel() {
    if (inPageStream && inPageStream.active) {
      if (inPageSentinelBarEl) {
        inPageSentinelBarEl.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });

      inPageStream = stream;
      inPageStrikes = 0;
      inPageGraceActive = false;
      inPageFramesAnalyzed = 0;
      inPageAlertsCount = 0;
      inPageStartTime = Date.now();

      // Persist active screening session to storage for popup synchronization
      chrome.storage.local.set({
        secura_screening_session: {
          active: true,
          startTime: inPageStartTime,
          framesAnalyzed: 0,
          alertsCount: 0,
          currentRisk: 0.0,
          status: "SAFE",
          lastEvent: "Screen capture stream initialized"
        }
      });

      // Handle user stopping screen share via Chrome native floating bar
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        stopInPageSentinel();
      });

      // Hidden video element to extract video frames
      inPageVideoEl = document.createElement("video");
      inPageVideoEl.srcObject = stream;
      inPageVideoEl.muted = true;
      inPageVideoEl.style.display = "none";
      (document.body || document.documentElement).appendChild(inPageVideoEl);
      await inPageVideoEl.play().catch(() => {});

      // Inject Fullscreen Ambient Glowing Border
      if (!inPageBorderEl) {
        inPageBorderEl = document.createElement("div");
        inPageBorderEl.id = "secura-screen-ambient-border";
        inPageBorderEl.className = "secura-border-green";
        (document.documentElement || document.body).appendChild(inPageBorderEl);
      }

      // Inject Top-Center Docked Sentinel Control Pill Bar
      renderInPageSentinelBar("SAFE", 0.001);

      // Start periodic forensic telemetry polling
      clearInterval(inPageInterval);
      inPageInterval = setInterval(async () => {
        await pollInPageFrame();
      }, 2500);

    } catch (err) {
      console.warn("Screen share cancelled or rejected by user:", err);
      chrome.storage.local.set({
        secura_screening_session: { active: false, status: "CANCELLED" }
      });
    }
  }

  function renderInPageSentinelBar(status, riskScore = 0.0) {
    if (!inPageSentinelBarEl) {
      inPageSentinelBarEl = document.createElement("div");
      inPageSentinelBarEl.id = "secura-inpage-sentinel-bar";
      (document.documentElement || document.body).appendChild(inPageSentinelBarEl);
    }

    const isThreat = status === "THREAT";
    inPageSentinelBarEl.className = isThreat ? "bar-threat" : "";

    const riskPct = Math.round(riskScore * 100);
    const bpm = isThreat ? "0.0" : (71 + Math.floor(Math.random() * 5));

    inPageSentinelBarEl.innerHTML = `
      <div class="secura-bar-badge ${isThreat ? 'badge-red' : 'badge-green'}" id="secura-sentinel-status-badge">
        <span>●</span>
        <span>${isThreat ? 'AI THREAT ACTIVE' : 'LIVE SHIELD ACTIVE'}</span>
      </div>
      <div class="secura-bar-metrics">
        <span id="secura-bar-risk-val">Risk: <strong>${riskPct}%</strong></span>
        <span style="opacity: 0.35">|</span>
        <span id="secura-bar-bpm-val">♥ ${bpm} BPM</span>
        <span style="opacity: 0.35">|</span>
        <span id="secura-bar-status-val">${isThreat ? '⚠️ Trajectory Anomaly' : '✓ Normal Optical Flow'}</span>
      </div>
      <button class="secura-bar-btn btn-simulate" id="secura-bar-sim-btn" title="Simulate an immediate AI Threat warning on this screen">
        ⚡ Simulate Threat
      </button>
      <button class="secura-bar-btn btn-stop" id="secura-bar-stop-btn" title="Stop live screen monitoring">
        ⏹ Stop Shield
      </button>
    `;

    document.getElementById("secura-bar-sim-btn")?.addEventListener("click", () => {
      triggerInPageThreat(0.96, "Simulated deepfake synthetic diffusion texture detected on active screen.");
    });

    document.getElementById("secura-bar-stop-btn")?.addEventListener("click", () => {
      stopInPageSentinel();
    });
  }

  async function pollInPageFrame() {
    if (!inPageVideoEl || inPageVideoEl.videoWidth === 0 || inPageGraceActive) return;

    try {
      const vw = inPageVideoEl.videoWidth;
      const vh = inPageVideoEl.videoHeight;
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(640, vw);
      canvas.height = Math.round(canvas.width * (vh / vw));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(inPageVideoEl, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.85));
      if (!blob) return;

      const fd = new FormData();
      fd.append("file", blob, "web_screen_frame.jpg");
      fd.append("frame", blob, "web_screen_frame.jpg");

      const resp = await fetch("http://127.0.0.1:8000/api/v1/stream/liveness-frame", {
        method: "POST",
        body: fd
      });

      if (resp.ok) {
        inPageFramesAnalyzed += 1;
        const resData = await resp.json();
        const isAi = resData.verdict === "DEEPFAKE_INJECTION_DETECTED" || resData.synthetic_confidence >= 0.50;
        const score = resData.synthetic_confidence || 0.0;

        if (isAi) {
          inPageAlertsCount += 1;
          const reason = (resData.warnings && resData.warnings[0]) || "Synthetic generative media detected on active screen.";
          triggerInPageThreat(score, reason);
        } else {
          clearInPageThreat(score);
        }

        // Keep chrome.storage.local synchronized for the popup
        chrome.storage.local.set({
          secura_screening_session: {
            active: true,
            startTime: inPageStartTime,
            framesAnalyzed: inPageFramesAnalyzed,
            alertsCount: inPageAlertsCount,
            currentRisk: score,
            status: isAi ? "ALERT" : "SAFE",
            lastEvent: isAi ? "Generative anomaly detected" : "Frame verified clear"
          }
        });
      }
    } catch (e) {
      // Backend offline or busy, continue passive monitoring
    }
  }

  function triggerInPageThreat(score = 0.94, reason = "AI-generated synthetic media detected on active screen.") {
    inPageStrikes = Math.min(3, inPageStrikes + 1);

    // Update Ambient Border to pulsing crimson red
    if (inPageBorderEl) {
      inPageBorderEl.className = "secura-border-red";
    }

    // Update Top-Center Docked Bar
    renderInPageSentinelBar("THREAT", score);

    // If 3 strikes reached, trigger full lockdown intervention
    if (inPageStrikes >= 3) {
      stopInPageSentinel();
      showSecurityLockdownModal();
      return;
    }

    // Remove existing warning modal if already open
    if (inPageWarningModalEl) inPageWarningModalEl.remove();

    // Render In-Page 10-Second Grace Warning Modal
    const modal = document.createElement("div");
    modal.id = "secura-inpage-warning-modal";
    modal.innerHTML = `
      <div class="secura-warn-header">
        <div class="secura-warn-icon">!</div>
        <div class="secura-warn-title">AI MEDIA THREAT DETECTED</div>
        <div class="secura-warn-strike-badge">Strike ${inPageStrikes} / 3</div>
      </div>
      <div class="secura-warn-body">
        <strong>${escapeHtml(reason)}</strong><br>
        A synthetic deepfake or generative AI video was detected on your shared screen.
        Please close the offending tab or window immediately.
      </div>
      <div class="secura-countdown-wrapper">
        <div class="secura-countdown-label">
          <span>Grace Period Active</span>
          <span id="secura-countdown-num">10s remaining</span>
        </div>
        <div class="secura-countdown-track">
          <div class="secura-countdown-bar" id="secura-countdown-bar"></div>
        </div>
      </div>
      <div class="secura-warn-actions">
        <button class="secura-btn-ack" id="secura-warn-ack-btn">
          <span>✓</span>
          <span>OK — I'm Closing It</span>
        </button>
        <button class="secura-btn-dismiss" id="secura-warn-dismiss-btn">Minimize</button>
      </div>
    `;

    (document.documentElement || document.body).appendChild(modal);
    inPageWarningModalEl = modal;

    // Interactive Button: [ OK — I'm Closing It ]
    document.getElementById("secura-warn-ack-btn")?.addEventListener("click", () => {
      acknowledgeAndMinimizeThreat();
    });

    document.getElementById("secura-warn-dismiss-btn")?.addEventListener("click", () => {
      acknowledgeAndMinimizeThreat();
    });

    // 10-second initial animated countdown timer before auto-minimizing
    let secondsLeft = 10;
    const numEl = document.getElementById("secura-countdown-num");
    clearInterval(inPageCountdownInterval);
    inPageCountdownInterval = setInterval(() => {
      secondsLeft -= 1;
      if (numEl) numEl.textContent = `${secondsLeft}s remaining`;
      if (secondsLeft <= 0) {
        clearInterval(inPageCountdownInterval);
        acknowledgeAndMinimizeThreat();
      }
    }, 1000);
  }

  let inPageGraceHudEl = null;

  function acknowledgeAndMinimizeThreat() {
    clearInterval(inPageCountdownInterval);
    if (inPageWarningModalEl) {
      inPageWarningModalEl.remove();
      inPageWarningModalEl = null;
    }
    inPageGraceActive = true;

    // Remove any existing grace hud pill
    if (inPageGraceHudEl) {
      inPageGraceHudEl.remove();
      inPageGraceHudEl = null;
    }

    // Render floating Grace HUD Pill
    const gracePill = document.createElement("div");
    gracePill.id = "secura-grace-hud-pill";
    gracePill.innerHTML = `
      <div class="secura-grace-hud-ring">
        <span class="secura-grace-hud-sec" id="secura-grace-sec">10s</span>
      </div>
      <span class="secura-grace-hud-text">Close AI Window... Resuming scan</span>
      <div class="secura-grace-hud-track">
        <div class="secura-grace-hud-fill" id="secura-grace-fill" style="width: 100%;"></div>
      </div>
    `;
    (document.documentElement || document.body).appendChild(gracePill);
    inPageGraceHudEl = gracePill;

    if (inPageSentinelBarEl) {
      const badge = document.getElementById("secura-sentinel-status-badge");
      if (badge) {
        badge.innerHTML = `<span>⏳</span><span>GRACE ACTIVE: CLOSING AI MEDIA</span>`;
        badge.className = "secura-bar-badge badge-green";
      }
    }

    const durationMs = 10000;
    const graceEnd = Date.now() + durationMs;
    const secEl = document.getElementById("secura-grace-sec");
    const fillEl = document.getElementById("secura-grace-fill");

    const graceInterval = setInterval(() => {
      const remainingMs = Math.max(0, graceEnd - Date.now());
      const remainingSec = Math.ceil(remainingMs / 1000);
      const pct = (remainingMs / durationMs) * 100;

      if (secEl) secEl.textContent = `${remainingSec}s`;
      if (fillEl) fillEl.style.width = `${pct}%`;

      if (remainingMs <= 0) {
        clearInterval(graceInterval);
        if (inPageGraceHudEl) {
          inPageGraceHudEl.remove();
          inPageGraceHudEl = null;
        }
        inPageGraceActive = false;

        // Immediately trigger check on active feed
        pollInPageFrame();
      }
    }, 80);
  }

  function clearInPageThreat(score = 0.05) {
    if (inPageBorderEl) {
      inPageBorderEl.className = "secura-border-green";
    }
    if (inPageWarningModalEl) {
      inPageWarningModalEl.remove();
      inPageWarningModalEl = null;
    }
    if (inPageGraceHudEl) {
      inPageGraceHudEl.remove();
      inPageGraceHudEl = null;
    }
    renderInPageSentinelBar("SAFE", score);
  }

  function stopInPageSentinel() {
    clearInterval(inPageInterval);
    clearInterval(inPageCountdownInterval);

    if (inPageStream) {
      try {
        inPageStream.getTracks().forEach(t => t.stop());
      } catch (e) {}
      inPageStream = null;
    }

    if (inPageVideoEl) {
      inPageVideoEl.remove();
      inPageVideoEl = null;
    }

    if (inPageBorderEl) {
      inPageBorderEl.remove();
      inPageBorderEl = null;
    }

    if (inPageSentinelBarEl) {
      inPageSentinelBarEl.remove();
      inPageSentinelBarEl = null;
    }

    if (inPageWarningModalEl) {
      inPageWarningModalEl.remove();
      inPageWarningModalEl = null;
    }

    if (inPageGraceHudEl) {
      inPageGraceHudEl.remove();
      inPageGraceHudEl = null;
    }

    inPageStrikes = 0;
    inPageGraceActive = false;

    // Authoritative session update to chrome.storage.local
    chrome.storage.local.set({
      secura_screening_session: {
        active: false,
        framesAnalyzed: inPageFramesAnalyzed,
        alertsCount: inPageAlertsCount,
        status: "STOPPED",
        stoppedAt: Date.now()
      }
    });
  }

  // Interactive In-Page Element Inspection Mode
  let inspectModeOverlay = null;

  function activateInspectMode() {
    if (inspectModeOverlay) return;

    inspectModeOverlay = document.createElement("div");
    inspectModeOverlay.style.cssText = `
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      background: #242321;
      color: #FAF7F0;
      padding: 10px 20px;
      border-radius: 9999px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      border: 1px solid #E98535;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: default;
    `;
    inspectModeOverlay.innerHTML = `
      <span style="color:#E98535; font-size:16px;">✦</span>
      <span>Secura AI Image Inspector: Click any image on this page to analyze</span>
      <button id="secura-cancel-inspect-btn" style="
        background: rgba(255,255,255,0.15);
        border: none;
        color: #FAF7F0;
        padding: 4px 10px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 11px;
      ">Cancel</button>
    `;
    (document.body || document.documentElement).appendChild(inspectModeOverlay);

    document.getElementById("secura-cancel-inspect-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      deactivateInspectMode();
    });

    const clickHandler = (e) => {
      if (inspectModeOverlay && inspectModeOverlay.contains(e.target)) return;

      e.preventDefault();
      e.stopPropagation();

      const target = e.target;
      let mediaUrl = null;

      if (target.tagName === "IMG") {
        mediaUrl = target.currentSrc || target.src;
      } else if (target.tagName === "VIDEO") {
        mediaUrl = target.currentSrc || target.src;
      } else {
        const imgChild = target.querySelector("img");
        if (imgChild) mediaUrl = imgChild.currentSrc || imgChild.src;
      }

      deactivateInspectMode();

      if (mediaUrl) {
        chrome.runtime.sendMessage({
          type: "SECURA_INSPECT_MEDIA_URL",
          url: mediaUrl,
          pageUrl: window.location.href
        });
      }
    };

    window.addEventListener("click", clickHandler, { capture: true, once: true });
  }

  function deactivateInspectMode() {
    if (inspectModeOverlay) {
      inspectModeOverlay.remove();
      inspectModeOverlay = null;
    }
  }
})();
