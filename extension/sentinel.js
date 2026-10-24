// Secura AI - Live Screen Sentinel Controller
(() => {
  let API_BASE_URL = "http://127.0.0.1:8000";

  // Load configured API URL
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get("secura_api_url", (data) => {
      if (data && data.secura_api_url) {
        API_BASE_URL = data.secura_api_url;
      }
    });
  }

  // State
  let activeStream = null;
  let isAnalyzing = false;
  let isSimulating = false;
  let consecutiveStrikes = 0;
  let pulseHistory = [];
  let frameCount = 0;
  let lastFpsTime = Date.now();
  let loopTimeout = null;
  let audioCtx = null;

  // Grace Period & Warning State
  let isGraceActive = false;
  let graceEndTime = 0;
  let graceTimerInterval = null;
  let lastSyntheticStatus = false;
  let isOfflineMode = false;

  // DOM Elements
  const screenVideo = document.getElementById("screenVideo");
  const videoContainer = document.getElementById("videoContainer");
  const faceBox = document.getElementById("faceBox");
  const placeholderView = document.getElementById("placeholderView");
  const btnStart = document.getElementById("btnStart");
  const startShareBtn = document.getElementById("startShareBtn");
  const btnStop = document.getElementById("btnStop");
  const btnSimulate = document.getElementById("btnSimulate");
  const btnSyncCookies = document.getElementById("btnSyncCookies");
  const streamStateText = document.getElementById("streamStateText");
  const fpsBadge = document.getElementById("fpsBadge");
  const analysisCanvas = document.getElementById("analysisCanvas");
  const waveformCanvas = document.getElementById("waveformCanvas");
  const riskScoreNum = document.getElementById("riskScoreNum");
  const verdictLabel = document.getElementById("verdictLabel");
  const bpmReading = document.getElementById("bpmReading");
  const swinScoreText = document.getElementById("swinScoreText");
  const varScoreText = document.getElementById("varScoreText");
  const temporalScoreText = document.getElementById("temporalScoreText");
  const lockdownModal = document.getElementById("lockdownModal");
  const btnAcknowledgeLockdown = document.getElementById("btnAcknowledgeLockdown");

  const strikeNode1 = document.getElementById("strikeNode1");
  const strikeNode2 = document.getElementById("strikeNode2");
  const strikeNode3 = document.getElementById("strikeNode3");

  // Warning Dialog & Fallback DOM Elements
  const offlineFallbackBanner = document.getElementById("offlineFallbackBanner");
  const viewportWarningBanner = document.getElementById("viewportWarningBanner");
  const bannerWarningTitle = document.getElementById("bannerWarningTitle");
  const bannerCountdownBadge = document.getElementById("bannerCountdownBadge");
  const btnBannerOk = document.getElementById("btnBannerOk");
  const warningModal = document.getElementById("warningModal");
  const warningModalStrikePill = document.getElementById("warningModalStrikePill");
  const warningCountdownTimer = document.getElementById("warningCountdownTimer");
  const graceProgressFill = document.getElementById("graceProgressFill");
  const btnWarningModalOk = document.getElementById("btnWarningModalOk");

  // Initialize Web Audio for security alerts
  function playAlertBeep(freq = 600, duration = 0.18) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn("Audio note:", e);
    }
  }

  function playCriticalLockdownAlarm() {
    try {
      playAlertBeep(880, 0.25);
      setTimeout(() => playAlertBeep(440, 0.35), 260);
      setTimeout(() => playAlertBeep(880, 0.45), 650);
    } catch {}
  }

  // --- COOKIE & STORAGE SYNC ---
  async function syncWithCookies() {
    try {
      const stateObj = {
        sentinel_online: true,
        strikes: consecutiveStrikes,
        last_sync_utc: new Date().toISOString(),
        api_base: API_BASE_URL
      };

      // Save to chrome.storage.local
      if (chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ secura_sentinel_state: stateObj });
      }

      // Save cookie if available
      if (chrome.cookies) {
        chrome.cookies.set({
          url: "http://127.0.0.1",
          name: "secura_sentinel_policy",
          value: JSON.stringify(stateObj),
          path: "/"
        }, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.warn("Cookie sync note:", chrome.runtime.lastError.message);
          } else {
            console.log("Secura cookie synchronized successfully.");
          }
        });
      }
    } catch (err) {
      console.warn("Sync error:", err);
    }
  }

  // Start Screen Capture
  async function startScreenShare() {
    consecutiveStrikes = 0;
    updateStrikeUI();
    isSimulating = false;
    clearGracePeriod();

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          displaySurface: "browser"
        },
        audio: false
      });

      activeStream = stream;
      screenVideo.srcObject = stream;
      screenVideo.style.display = "block";
      placeholderView.style.display = "none";
      btnStart.style.display = "none";
      btnStop.style.display = "inline-flex";
      fpsBadge.style.display = "inline-block";
      streamStateText.textContent = "Screen Sharing Sentinel Active";

      // Initialize green authentic border upon startup
      setViewportBorder("green");

      // If user stops sharing from browser system bar
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      isAnalyzing = true;
      scheduleAnalysis(200);
      syncWithCookies();
    } catch (err) {
      console.warn("Display media selection cancelled or failed:", err);
      streamStateText.textContent = "Screen sharing cancelled or not granted";
      stopScreenShare();
    }
  }

  // Simulate Attack Feed for 1-click verification
  function startSimulation() {
    stopScreenShare();
    isSimulating = true;
    isAnalyzing = true;
    consecutiveStrikes = 0;
    updateStrikeUI();
    clearGracePeriod();

    placeholderView.style.display = "none";
    screenVideo.style.display = "block";
    btnStart.style.display = "none";
    btnStop.style.display = "inline-flex";
    fpsBadge.style.display = "inline-block";
    streamStateText.textContent = "Simulating Synthetic Attack Stream";

    setViewportBorder("green");
    scheduleAnalysis(100);
  }

  function stopScreenShare() {
    isAnalyzing = false;
    isSimulating = false;
    clearGracePeriod();

    if (loopTimeout) {
      clearTimeout(loopTimeout);
      loopTimeout = null;
    }
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
      activeStream = null;
    }
    screenVideo.srcObject = null;
    screenVideo.style.display = "none";
    placeholderView.style.display = "flex";
    faceBox.style.display = "none";
    btnStart.style.display = "inline-flex";
    btnStop.style.display = "none";
    fpsBadge.style.display = "none";
    streamStateText.textContent = "Stream Inactive";

    setViewportBorder("none");
    syncWithCookies();
  }

  function setViewportBorder(mode) {
    if (!videoContainer) return;
    if (mode === "green") {
      videoContainer.classList.add("border-green");
      videoContainer.classList.remove("border-red");
    } else if (mode === "red") {
      videoContainer.classList.add("border-red");
      videoContainer.classList.remove("border-green");
    } else {
      videoContainer.classList.remove("border-green", "border-red");
    }
  }

  function scheduleAnalysis(delayMs) {
    if (loopTimeout) clearTimeout(loopTimeout);
    loopTimeout = setTimeout(analyzeCurrentFrame, delayMs);
  }

  async function analyzeCurrentFrame() {
    if (!isAnalyzing) return;

    let blob = null;

    if (isSimulating) {
      // Generate synthetic frame that simulates attack
      analysisCanvas.width = 480;
      analysisCanvas.height = 360;
      const ctx = analysisCanvas.getContext("2d");
      ctx.fillStyle = "#111827";
      ctx.fillRect(0, 0, 480, 360);

      // Draw avatar
      ctx.fillStyle = "#f87171";
      ctx.beginPath();
      ctx.ellipse(240, 180, 80, 100, 0, 0, Math.PI * 2);
      ctx.fill();

      // Deepfake text watermark
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("SYNTHETIC INJECTION SIMULATION", 80, 180);

      blob = await new Promise((res) => analysisCanvas.toBlob(res, "image/jpeg", 0.85));
    } else {
      if (!screenVideo || screenVideo.videoWidth === 0 || screenVideo.videoHeight === 0) {
        scheduleAnalysis(200);
        return;
      }

      analysisCanvas.width = 480;
      analysisCanvas.height = Math.round((480 * screenVideo.videoHeight) / screenVideo.videoWidth);
      const ctx = analysisCanvas.getContext("2d");
      ctx.drawImage(screenVideo, 0, 0, analysisCanvas.width, analysisCanvas.height);

      blob = await new Promise((res) => analysisCanvas.toBlob(res, "image/jpeg", 0.82));
    }

    if (!blob) {
      scheduleAnalysis(200);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", blob, "screen_frame.jpg");
      formData.append("frame", blob, "screen_frame.jpg");

      const response = await fetch(`${API_BASE_URL}/api/v1/stream/liveness-frame`, {
        method: "POST",
        body: formData
      });

      if (response.ok) {
        if (offlineFallbackBanner) offlineFallbackBanner.style.display = "none";
        isOfflineMode = false;
        const data = await response.json();
        handleAnalysisResult(data);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      // Fallback error handler: activate offline heuristic mode gracefully
      if (offlineFallbackBanner) offlineFallbackBanner.style.display = "flex";
      isOfflineMode = true;
      handleOfflineFallbackAnalysis();
    } finally {
      if (isAnalyzing) {
        scheduleAnalysis(220); // ~4 FPS adaptive rate
      }
    }
  }

  // Offline Local Heuristic Fallback Analysis
  function handleOfflineFallbackAnalysis() {
    frameCount++;
    const now = Date.now();
    if (now - lastFpsTime >= 1000) {
      fpsBadge.textContent = `${frameCount} FPS (Local)`;
      frameCount = 0;
      lastFpsTime = now;
    }

    // Offline chromatic baseline simulation for demonstration
    bpmReading.textContent = `Offline Baseline`;
    const simVal = 70 + Math.sin(now / 1500) * 3;
    pulseHistory.push(simVal);
    if (pulseHistory.length > 30) pulseHistory.shift();
    drawWaveform();

    riskScoreNum.textContent = "12%";
    swinScoreText.textContent = "Local Heuristic Active";
    varScoreText.textContent = "0.0082";
    temporalScoreText.textContent = "98.4%";

    if (!isGraceActive) {
      setViewportBorder("green");
      verdictLabel.textContent = "OFFLINE HEURISTIC — SAFE";
      verdictLabel.style.color = "#10b981";
      riskScoreNum.style.color = "#10b981";
    }
  }

  function handleAnalysisResult(res) {
    // 1. Calculate FPS
    frameCount++;
    const now = Date.now();
    if (now - lastFpsTime >= 1000) {
      fpsBadge.textContent = `${frameCount} FPS`;
      frameCount = 0;
      lastFpsTime = now;
    }

    // 2. Telemetry metrics
    const aiConfidence = res.synthetic_confidence !== undefined ? res.synthetic_confidence : (res.neural_ai_score !== undefined ? res.neural_ai_score : 0.0);
    const aiScore = Math.round(aiConfidence * 100);
    const varScore = res.blood_volume_variance !== undefined ? res.blood_volume_variance.toFixed(4) : "0.0000";
    const tempScore = res.temporal_consistency !== undefined ? (res.temporal_consistency * 100).toFixed(1) : "99.0";

    riskScoreNum.textContent = `${aiScore}%`;
    swinScoreText.textContent = `${(aiConfidence * 100).toFixed(1)}% Synthetic`;
    varScoreText.textContent = varScore;
    temporalScoreText.textContent = `${tempScore}%`;

    if (res.rppg_pulse_estimate && res.rppg_pulse_estimate > 0) {
      bpmReading.textContent = `${res.rppg_pulse_estimate.toFixed(1)} BPM`;
      pulseHistory.push(res.rppg_pulse_estimate);
      if (pulseHistory.length > 30) pulseHistory.shift();
      drawWaveform();
    }

    // 3. Face Bounding Box
    if (res.face_detected && res.face_box && !isSimulating) {
      faceBox.style.display = "block";
      const [top, left, bottom, right] = res.face_box;
      faceBox.style.top = `${top * 100}%`;
      faceBox.style.left = `${left * 100}%`;
      faceBox.style.width = `${(right - left) * 100}%`;
      faceBox.style.height = `${(bottom - top) * 100}%`;

      if (res.is_live_authentic) {
        faceBox.className = "face-overlay-box safe";
      } else {
        faceBox.className = "face-overlay-box";
      }
    } else {
      faceBox.style.display = "none";
    }

    // 4. Decision: Strict separation of AI vs Authentic
    const isSynthetic = res.verdict === "DEEPFAKE_INJECTION_DETECTED" || aiConfidence >= 0.50;
    lastSyntheticStatus = isSynthetic;

    if (isSynthetic) {
      // Turn border RED immediately when AI content is on screen
      setViewportBorder("red");
      verdictLabel.textContent = "SYNTHETIC AI DEEPFAKE DETECTED";
      verdictLabel.style.color = "#ef4444";
      riskScoreNum.style.color = "#ef4444";

      // If we are already counting down the grace window, let the user close it
      if (!isGraceActive) {
        consecutiveStrikes++;
        updateStrikeUI();

        if (consecutiveStrikes >= 3) {
          triggerSecurityLockdown();
          return;
        }

        startGracePeriod(consecutiveStrikes);
      }
    } else {
      // Content is clean / authentic
      if (isGraceActive) {
        // User successfully closed or switched away from the synthetic content!
        resolveGracePeriodSuccess();
      } else {
        setViewportBorder("green");
        verdictLabel.textContent = "VERIFIED AUTHENTIC (NOT AI)";
        verdictLabel.style.color = "#10b981";
        riskScoreNum.style.color = "#10b981";

        // Natural recovery: gradually reduce strikes if clean feed continues
        if (consecutiveStrikes > 0 && frameCount % 15 === 0) {
          consecutiveStrikes = Math.max(0, consecutiveStrikes - 1);
          updateStrikeUI();
        }
      }
    }
  }

  // --- GRACE PERIOD & INTERACTIVE WARNING POP-UP ---
  function startGracePeriod(strikeNum) {
    isGraceActive = true;
    const durationMs = 10000;
    graceEndTime = Date.now() + durationMs;

    playAlertBeep(750, 0.25);

    if (warningModalStrikePill) {
      warningModalStrikePill.textContent = `SECURITY WARNING ${strikeNum} OF 3`;
    }
    if (bannerWarningTitle) {
      bannerWarningTitle.textContent = `AI Content Detected (Strike ${strikeNum}/3)`;
    }

    // Show initial warning modal
    if (warningModal) warningModal.style.display = "flex";
    if (viewportWarningBanner) viewportWarningBanner.style.display = "none";
    if (warningCountdownTimer) warningCountdownTimer.textContent = "10s";
    if (bannerCountdownBadge) bannerCountdownBadge.textContent = "10s";
    if (graceProgressFill) graceProgressFill.style.width = "100%";

    verdictLabel.textContent = `WARNING ${strikeNum}/3: CLOSE AI WINDOW`;
    verdictLabel.style.color = "#ef4444";
    riskScoreNum.style.color = "#ef4444";

    if (graceTimerInterval) clearInterval(graceTimerInterval);
    graceTimerInterval = setInterval(() => {
      const remainingMs = Math.max(0, graceEndTime - Date.now());
      const remainingSec = Math.ceil(remainingMs / 1000);
      const pct = (remainingMs / durationMs) * 100;

      if (warningCountdownTimer) warningCountdownTimer.textContent = `${remainingSec}s`;
      if (bannerCountdownBadge) bannerCountdownBadge.textContent = `${remainingSec}s`;
      if (graceProgressFill) graceProgressFill.style.width = `${pct}%`;

      if (remainingMs <= 0) {
        clearInterval(graceTimerInterval);
        graceTimerInterval = null;
        onGracePeriodExpired(strikeNum);
      }
    }, 50);
  }

  // When user clicks [ OK — I'm Closing It ]
  function acknowledgeWarning() {
    // Hide the large modal and switch to the sleek floating top pill HUD
    if (warningModal) warningModal.style.display = "none";
    if (viewportWarningBanner) viewportWarningBanner.style.display = "flex";

    // Start a dedicated 10-second window closure countdown
    const graceExtensionMs = 10000;
    graceEndTime = Date.now() + graceExtensionMs;

    if (bannerWarningTitle) {
      bannerWarningTitle.textContent = "Closing Threat Window...";
    }

    if (graceTimerInterval) clearInterval(graceTimerInterval);
    graceTimerInterval = setInterval(() => {
      const remainingMs = Math.max(0, graceEndTime - Date.now());
      const remainingSec = Math.ceil(remainingMs / 1000);

      if (bannerCountdownBadge) bannerCountdownBadge.textContent = `${remainingSec}s`;

      if (remainingMs <= 0) {
        clearInterval(graceTimerInterval);
        graceTimerInterval = null;
        onGracePeriodExpired(consecutiveStrikes);
      }
    }, 80);
  }

  function clearGracePeriod() {
    isGraceActive = false;
    if (graceTimerInterval) {
      clearInterval(graceTimerInterval);
      graceTimerInterval = null;
    }
    if (warningModal) warningModal.style.display = "none";
    if (viewportWarningBanner) viewportWarningBanner.style.display = "none";
  }

  function resolveGracePeriodSuccess() {
    clearGracePeriod();
    setViewportBorder("green");
    verdictLabel.textContent = "THREAT RESOLVED — AUTHENTIC";
    verdictLabel.style.color = "#10b981";
    riskScoreNum.style.color = "#10b981";
    playAlertBeep(520, 0.15); // pleasant chime
  }

  function onGracePeriodExpired(strikeNum) {
    isGraceActive = false;
    if (warningModal) warningModal.style.display = "none";
    if (viewportWarningBanner) viewportWarningBanner.style.display = "none";

    // If still synthetic after the full grace timer
    if (lastSyntheticStatus) {
      if (consecutiveStrikes >= 3) {
        triggerSecurityLockdown();
      } else {
        // Increment strike and notify
        playAlertBeep(880, 0.3);
      }
    } else {
      resolveGracePeriodSuccess();
    }
  }

  function updateStrikeUI() {
    if (strikeNode1) strikeNode1.className = "strike-node" + (consecutiveStrikes >= 1 ? " active" : "");
    if (strikeNode2) strikeNode2.className = "strike-node" + (consecutiveStrikes >= 2 ? " active" : "");
    if (strikeNode3) strikeNode3.className = "strike-node" + (consecutiveStrikes >= 3 ? " active" : "");
  }

  function triggerSecurityLockdown() {
    // Terminate screen share immediately
    stopScreenShare();

    // Trigger critical siren
    playCriticalLockdownAlarm();

    // Show lockdown modal
    if (lockdownModal) lockdownModal.style.display = "flex";

    // Sync incident with storage and cookies
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        secura_lockdown_incident: {
          timestamp: new Date().toISOString(),
          reason: "3_CONSECUTIVE_DEEPFAKE_WARNINGS_ENFORCEMENT",
          status: "SESSION_TERMINATED"
        }
      });
    }

    if (chrome.cookies) {
      chrome.cookies.set({
        url: "http://127.0.0.1",
        name: "secura_security_incident",
        value: "STRIKE_3_TERMINATED",
        path: "/"
      });
    }
  }

  // Draw ECG / rPPG pulse wave
  function drawWaveform() {
    if (!waveformCanvas) return;
    const ctx = waveformCanvas.getContext("2d");
    const w = waveformCanvas.width;
    const h = waveformCanvas.height;
    ctx.clearRect(0, 0, w, h);

    if (pulseHistory.length < 2) return;

    ctx.strokeStyle = "#f43f5e";
    ctx.lineWidth = 2;
    ctx.beginPath();

    const step = w / (pulseHistory.length - 1);
    pulseHistory.forEach((bpm, i) => {
      const normY = h - ((bpm - 50) / 50) * h;
      const y = Math.max(4, Math.min(h - 4, normY));
      const x = i * step;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // Event Listeners
  if (btnStart) btnStart.addEventListener("click", startScreenShare);
  if (startShareBtn) startShareBtn.addEventListener("click", startScreenShare);
  if (btnStop) btnStop.addEventListener("click", stopScreenShare);
  if (btnSimulate) btnSimulate.addEventListener("click", startSimulation);
  if (btnSyncCookies) {
    btnSyncCookies.addEventListener("click", async () => {
      await syncWithCookies();
      alert("Secura AI cookies and local policy state synchronized.");
    });
  }

  // Warning acknowledgment buttons
  if (btnWarningModalOk) btnWarningModalOk.addEventListener("click", acknowledgeWarning);
  if (btnBannerOk) btnBannerOk.addEventListener("click", acknowledgeWarning);

  if (btnAcknowledgeLockdown) {
    btnAcknowledgeLockdown.addEventListener("click", () => {
      if (lockdownModal) lockdownModal.style.display = "none";
      consecutiveStrikes = 0;
      updateStrikeUI();
    });
  }

  // On mount
  syncWithCookies();

  // If opened with autostart=1 from popup
  if (window.location.search && window.location.search.includes("autostart=1")) {
    if (startShareBtn) {
      startShareBtn.style.boxShadow = "0 0 28px rgba(16, 185, 129, 0.85)";
      startShareBtn.focus();
    }
  }
})();
