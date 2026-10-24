let API_BASE_URL = "http://127.0.0.1:8000";

// Dynamically load configured API URL from extension storage
chrome.storage.local.get("secura_api_url", (data) => {
  if (data && data.secura_api_url) {
    API_BASE_URL = data.secura_api_url;
  }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.secura_api_url) {
    API_BASE_URL = changes.secura_api_url.newValue || "http://127.0.0.1:8000";
  }
});

function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "secura_inspect_media",
      title: "Inspect with Secura AI (Forensic Scan)",
      contexts: ["all"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn("Context menu create note:", chrome.runtime.lastError.message);
      }
    });

    chrome.contextMenus.create({
      id: "secura_launch_sentinel",
      title: "🛡️ Launch Live Screen Sentinel (Deepfake Shield)",
      contexts: ["all"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn("Sentinel menu create note:", chrome.runtime.lastError.message);
      }
    });

    chrome.contextMenus.create({
      id: "secura_brahma_prepub",
      title: "⚖️ BRAHMA Pre-Publication Policy Check",
      contexts: ["all"]
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn("BRAHMA menu create note:", chrome.runtime.lastError.message);
      } else {
        console.log("Secura AI & BRAHMA context menus registered.");
      }
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenu();
});

// Always execute setup immediately when service worker starts
setupContextMenu();

// Ensure content script and CSS are present in the tab
async function ensureContentInjected(tabId) {
  try {
    const isAlive = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: "SECURA_PING" }, (resp) => {
        if (chrome.runtime.lastError || !resp || !resp.pong) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });

    if (!isAlive) {
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ["content.css"]
      });
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content.js"]
      });
    }
  } catch (err) {
    console.warn("Script injection note:", err);
  }
}

// Ensure image payload is JPEG or PNG for the forensic pipeline
async function ensureJpegOrPngBlob(inputBlob, url) {
  try {
    let cleanFilename = null;
    if (url) {
      try {
        const u = new URL(url);
        const p = u.pathname.split("/").pop();
        if (p && p.length < 80 && /\.(jpe?g|png|webp|avif)$/i.test(p)) {
          cleanFilename = p;
        }
      } catch {}
    }

    const buf = await inputBlob.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(buf);
    const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;

    if (isJpeg) {
      return { blob: inputBlob, filename: cleanFilename && /\.(jpe?g)$/i.test(cleanFilename) ? cleanFilename : "web_inspected_asset.jpg" };
    }
    if (isPng) {
      return { blob: inputBlob, filename: cleanFilename && /\.png$/i.test(cleanFilename) ? cleanFilename : "web_inspected_asset.png" };
    }

    // Transcode WebP, AVIF, or other image formats into pure PNG via OffscreenCanvas
    const bitmap = await createImageBitmap(inputBlob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const pngBlob = await canvas.convertToBlob({ type: "image/png" });
    return { blob: pngBlob, filename: cleanFilename ? cleanFilename.replace(/\.[^.]+$/, ".png") : "web_inspected_asset.png" };
  } catch (err) {
    console.warn("Blob transcode note:", err);
    return { blob: inputBlob, filename: "web_inspected_asset.png" };
  }
}

// Crop screenshot to element's bounding rect using native OffscreenCanvas
async function cropScreenshotBlob(fullDataUrl, rect) {
  try {
    if (!rect || rect.width <= 10 || rect.height <= 10) {
      const r = await fetch(fullDataUrl);
      return await r.blob();
    }
    const resp = await fetch(fullDataUrl);
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);
    
    // Compute exact physical-to-CSS pixel scaling factor to handle Windows display scaling & browser zoom
    const scaleX = (rect.windowWidth && rect.windowWidth > 0) ? (bitmap.width / rect.windowWidth) : (rect.dpr || 1);
    const scaleY = (rect.windowHeight && rect.windowHeight > 0) ? (bitmap.height / rect.windowHeight) : (rect.dpr || 1);

    const sx = Math.max(0, Math.round(rect.left * scaleX));
    const sy = Math.max(0, Math.round(rect.top * scaleY));
    const sw = Math.min(bitmap.width - sx, Math.round(rect.width * scaleX));
    const sh = Math.min(bitmap.height - sy, Math.round(rect.height * scaleY));

    if (sw <= 10 || sh <= 10) return blob;

    const canvas = new OffscreenCanvas(sw, sh);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
    return await canvas.convertToBlob({ type: "image/png" });
  } catch (e) {
    console.warn("Screenshot crop note:", e);
    const r = await fetch(fullDataUrl);
    return await r.blob();
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "secura_launch_sentinel") {
    if (!tab || !tab.id) return;
    await ensureContentInjected(tab.id);
    chrome.tabs.sendMessage(tab.id, { type: "SECURA_START_INPAGE_SENTINEL" });
    return;
  }

  if ((info.menuItemId !== "secura_inspect_media" && info.menuItemId !== "secura_brahma_prepub") || !tab || !tab.id) return;

  // Don't run on restricted internal browser pages
  if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("edge://") || tab.url?.startsWith("about:")) {
    return;
  }

  await ensureContentInjected(tab.id);

  // Notify tab immediately that forensic analysis has started
  try {
    chrome.tabs.sendMessage(tab.id, { type: "SECURA_SCAN_STARTING" });
  } catch (err) {
    console.warn("Could not send scan start:", err);
  }

  // 1. Resolve media target with overlay penetration
  let targetUrl = info.srcUrl || null;
  let clickedMediaInfo = null;

  // If linkUrl is an explicit image/video file, use it; otherwise ignore web page links (e.g. instagram.com/p/...)
  if (!targetUrl && info.linkUrl && /\.(jpe?g|png|webp|gif|mp4|webm)(\?|$)/i.test(info.linkUrl)) {
    targetUrl = info.linkUrl;
  }

  // Query content script for media under cursor (handles Instagram overlays, video frames, etc.)
  try {
    clickedMediaInfo = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { type: "SECURA_GET_CLICKED_MEDIA" }, (resp) => {
        resolve(resp);
      });
    });
    if (clickedMediaInfo && clickedMediaInfo.mediaUrl) {
      targetUrl = clickedMediaInfo.mediaUrl;
    }
  } catch (e) {
    console.warn("Could not query clicked media from tab:", e);
  }

  // If still no URL, notify user
  if (!targetUrl) {
    chrome.tabs.sendMessage(tab.id, {
      type: "SECURA_SCAN_ERROR",
      message: "No image or video asset was detected under the cursor. Please right-click directly on an image or video."
    });
    return;
  }

  // 2. Perform media inspection
  await performMediaInspection(tab.id, targetUrl, clickedMediaInfo);
});

// Rapidly capture sequential viewport frames from playing video tab
async function captureTabFrameSequence(tabId, rect, count = 8, intervalMs = 120) {
  const frames = [];
  try {
    const tab = await chrome.tabs.get(tabId);
    for (let i = 0; i < count; i++) {
      const shotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
      if (shotUrl) {
        const cropped = await cropScreenshotBlob(shotUrl, rect);
        if (cropped && cropped.size > 200) {
          frames.push(cropped);
        }
      }
      if (i < count - 1) {
        await new Promise(r => setTimeout(r, intervalMs));
      }
    }
  } catch (err) {
    console.warn("captureTabFrameSequence notice:", err);
  }
  return frames;
}

// Reusable media inspection pipeline for both context menu and in-page click inspect
async function performMediaInspection(tabId, targetUrl, clickedMediaInfo = null) {
  try {
    let blob = null;
    let frameBlobs = [];

    let isVideoTarget = clickedMediaInfo?.mediaType === "video" || 
      (targetUrl && /\.(mp4|webm|mov)(\?|$)/i.test(targetUrl)) || 
      (targetUrl && targetUrl.startsWith("data:video/")) ||
      Boolean(clickedMediaInfo && clickedMediaInfo.videoDataUrl);
    let isFallbackFrameFromVideo = false;
    let targetRect = clickedMediaInfo?.rect || null;

    if (isVideoTarget) {
      // --- VIDEO / REEL ACQUISITION PIPELINE ---
      // A. Data URLs directly
      if (clickedMediaInfo?.videoDataUrl) {
        const resp = await fetch(clickedMediaInfo.videoDataUrl);
        blob = await resp.blob();
      } else if (targetUrl && targetUrl.startsWith("data:video/")) {
        const resp = await fetch(targetUrl);
        blob = await resp.blob();
      } else if (targetUrl && targetUrl.startsWith("http")) {
        // B. Attempt direct video asset download
        try {
          const assetResp = await fetch(targetUrl, {
            headers: {
              "Accept": "video/mp4,video/webm,video/*;q=0.9,*/*;q=0.5"
            }
          });
          if (assetResp.ok) {
            const fetched = await assetResp.blob();
            if (fetched && fetched.size > 2000) {
              blob = fetched;
            }
          }
        } catch (fetchErr) {
          console.warn("Direct video asset fetch failed, trying in-page stream capture:", fetchErr);
        }
      }

      // C. In-page recording via MediaRecorder / Canvas
      if (!blob || blob.size === 0) {
        try {
          const streamCapture = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { type: "SECURA_CAPTURE_VIDEO_STREAM" }, (resp) => {
              resolve(resp);
            });
          });

          if (streamCapture) {
            if (streamCapture.rect) {
              targetRect = streamCapture.rect;
            }
            if (streamCapture.videoDataUrl) {
              const resp = await fetch(streamCapture.videoDataUrl);
              const b = await resp.blob();
              if (b && b.size > 1000) {
                blob = b;
              }
            } else if (streamCapture.frameSequence && streamCapture.frameSequence.length >= 2) {
              for (const fUrl of streamCapture.frameSequence) {
                const r = await fetch(fUrl);
                frameBlobs.push(await r.blob());
              }
            } else if (streamCapture.frameDataUrl) {
              const resp = await fetch(streamCapture.frameDataUrl);
              blob = await resp.blob();
              isFallbackFrameFromVideo = true;
            }
          }
        } catch (streamErr) {
          console.warn("In-page stream capture error:", streamErr);
        }
      }

      // D. Resilient Multi-Frame Tab Viewport Sequence for Reels (e.g. cross-origin MSE on Instagram, TikTok, YouTube Shorts)
      if ((!blob || blob.size === 0) && frameBlobs.length < 2) {
        try {
          const capturedFrames = await captureTabFrameSequence(tabId, targetRect, 8, 120);
          if (capturedFrames && capturedFrames.length >= 2) {
            frameBlobs = capturedFrames;
          } else if (capturedFrames && capturedFrames.length === 1) {
            blob = capturedFrames[0];
            isFallbackFrameFromVideo = true;
          }
        } catch (captureErr) {
          console.warn("Video viewport capture fallback error:", captureErr);
        }
      }
    } else {
      // --- IMAGE ACQUISITION PIPELINE ---
      // A. Handle data: URLs directly
      if (targetUrl && targetUrl.startsWith("data:")) {
        const resp = await fetch(targetUrl);
        blob = await resp.blob();
      } else {
        // B. Attempt direct fetch in extension service worker
        try {
          const assetResp = await fetch(targetUrl, {
            headers: {
              "Accept": "image/jpeg,image/png;q=0.9,*/*;q=0.5"
            }
          });
          if (assetResp.ok) {
            blob = await assetResp.blob();
          }
        } catch (fetchErr) {
          console.warn("Direct fetch failed, trying in-page canvas extraction:", fetchErr);
        }

        // C. Fallback: Request in-page canvas extraction from content script
        if (!blob || blob.size === 0) {
          const pageExtraction = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { type: "SECURA_EXTRACT_ASSET_DATA_URL" }, (resp) => {
              resolve(resp);
            });
          });

          if (pageExtraction && pageExtraction.dataUrl) {
            const resp = await fetch(pageExtraction.dataUrl);
            blob = await resp.blob();
          }
        }

        // D. Ultimate Fallback for restricted CDNs / tainted canvas:
        if (!blob || blob.size === 0) {
          try {
            const tab = await chrome.tabs.get(tabId);
            const screenshotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
            if (screenshotUrl) {
              blob = await cropScreenshotBlob(screenshotUrl, targetRect);
            }
          } catch (captureErr) {
            console.warn("Tab capture fallback error:", captureErr);
          }
        }
      }
    }

    if ((!blob || blob.size === 0) && frameBlobs.length === 0) {
      throw new Error(
        isVideoTarget
          ? "Unable to record or capture video stream bytes for this Reel. Please ensure the video is playing."
          : "Unable to capture media asset bytes. Please try right-clicking directly on the image."
      );
    }

    // 2. Select Forensic Pipeline Endpoint & Format
    let apiEndpoint = `${API_BASE_URL}/api/v1/analyze/image?probe=Ensemble`;
    const formData = new FormData();

    // Use a safe filename — strip obfuscated CDN token filenames (e.g. AQM...Q.mp4 from Instagram)
    // and replace with a stable generic name so the backend uses magic-byte detection.
    function safeVideoFilename(blob, url) {
      if (blob.type.includes("webm")) return "web_inspected_reel.webm";
      if (blob.type.includes("mp4"))  return "web_inspected_reel.mp4";
      // URL-based filename — only use if it looks like a plain filename, not a CDN token
      if (url) {
        const urlFile = url.split("/").pop().split("?")[0];
        if (urlFile && urlFile.length < 60 && /\.(mp4|webm|mov)$/i.test(urlFile)) {
          return urlFile;
        }
      }
      return "web_inspected_reel.webm"; // default — backend will detect from magic bytes
    }

    if (isVideoTarget && !isFallbackFrameFromVideo && blob && blob.type && blob.type.includes("video")) {
      // Direct WebM or MP4 video container
      apiEndpoint = `${API_BASE_URL}/api/v1/analyze/video?preset=fast`;
      formData.append("file", blob, safeVideoFilename(blob, targetUrl));
    } else if (isVideoTarget && frameBlobs.length >= 2) {
      // Multi-Frame Video Stream Sequence
      apiEndpoint = `${API_BASE_URL}/api/v1/analyze/video/frames?preset=fast`;
      frameBlobs.forEach((fBlob, idx) => {
        formData.append("files", fBlob, `reel_frame_${idx}.jpg`);
      });
      formData.append("fps", "8.0");
    } else {
      // Image target OR single video viewport frame fallback
      const { blob: preparedBlob, filename } = await ensureJpegOrPngBlob(blob, targetUrl);
      let uploadFilename = filename;
      if (isVideoTarget || isFallbackFrameFromVideo) {
        uploadFilename = "video_frame_inspected.jpg";
        apiEndpoint = `${API_BASE_URL}/api/v1/analyze/image?probe=ExtensionImageDetectorV1&source_type=video_frame`;
      } else {
        apiEndpoint = `${API_BASE_URL}/api/v1/analyze/image?probe=ExtensionImageDetectorV1`;
      }
      formData.append("file", preparedBlob, uploadFilename);
    }

    if (targetUrl) {
      formData.append("acquisition_url", targetUrl);
    }

    let apiResp = null;
    try {
      apiResp = await fetch(apiEndpoint, {
        method: "POST",
        body: formData
      });
    } catch (netErr) {
      // Attempt localhost <-> 127.0.0.1 failover
      if (apiEndpoint.includes("127.0.0.1:8000")) {
        const altEndpoint = apiEndpoint.replace("127.0.0.1:8000", "localhost:8000");
        apiResp = await fetch(altEndpoint, { method: "POST", body: formData });
      } else if (apiEndpoint.includes("localhost:8000")) {
        const altEndpoint = apiEndpoint.replace("localhost:8000", "127.0.0.1:8000");
        apiResp = await fetch(altEndpoint, { method: "POST", body: formData });
      } else {
        throw netErr;
      }
    }

    // If video upload hit a decode error (e.g. MSE/DRM stream that couldn't be read),
    // automatically retry via the frame-based image pipeline using viewport screenshot.
    if (!apiResp.ok && isVideoTarget) {
      let errJson = null;
      try { errJson = await apiResp.clone().json(); } catch { /* ignore */ }
      const isDecodeError = errJson &&
        (errJson.detail?.error_code === "VIDEO_DECODING_ERROR" ||
         (typeof errJson.detail === "string" && errJson.detail.includes("Could not open video stream")));

      if (isDecodeError) {
        // Build a fallback frame FormData from the best available frame
        const fallbackFd = new FormData();
        let fallbackBlob = null;

        if (frameBlobs.length >= 1) {
          fallbackBlob = frameBlobs[0];
        } else if (blob && !blob.type.includes("video")) {
          fallbackBlob = blob;
        } else {
          // Capture a viewport screenshot as last resort
          try {
            const tab = await chrome.tabs.get(tabId);
            const shotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 90 });
            const shotResp = await fetch(shotUrl);
            fallbackBlob = await shotResp.blob();
          } catch { /* ignore */ }
        }

        if (fallbackBlob) {
          const { blob: fb, filename: fn } = await ensureJpegOrPngBlob(fallbackBlob);
          fallbackFd.append("file", fb, "reel_frame_fallback.jpg");
          if (targetUrl) fallbackFd.append("acquisition_url", targetUrl);
          const fallbackEndpoint = `${API_BASE_URL}/api/v1/analyze/image?probe=Ensemble&source_type=video_frame`;
          apiResp = await fetch(fallbackEndpoint, { method: "POST", body: fallbackFd });
        }
      }
    }

    if (!apiResp.ok) {
      let errDetail = `HTTP ${apiResp.status}`;
      try {
        const rawText = await apiResp.text();
        try {
          const errJson = JSON.parse(rawText);
          if (errJson && errJson.detail) {
            if (typeof errJson.detail === "string") {
              errDetail = errJson.detail;
            } else if (typeof errJson.detail === "object" && errJson.detail.message) {
              errDetail = String(errJson.detail.message);
            } else if (Array.isArray(errJson.detail)) {
              errDetail = errJson.detail.map(d => (d && d.msg) ? d.msg : JSON.stringify(d)).join("; ");
            } else {
              errDetail = JSON.stringify(errJson.detail);
            }
          } else if (errJson && errJson.message) {
            errDetail = String(errJson.message);
          } else {
            errDetail = rawText;
          }
        } catch {
          errDetail = rawText || errDetail;
        }
      } catch {}
      const safeMsg = typeof errDetail === "string" ? errDetail : JSON.stringify(errDetail);
      throw new Error(`Secura Engine Error: ${safeMsg}`);
    }

    const forensicData = await apiResp.json();

    // 4. Send canonical forensic verdict to tab
    chrome.tabs.sendMessage(tabId, {
      type: "SECURA_SCAN_COMPLETE",
      data: forensicData,
      srcUrl: targetUrl
    });

  } catch (error) {
    console.error("Secura Inspection Error:", error);
    const safeErrorMsg = (error && typeof error === "object" && error.message)
      ? String(error.message)
      : (typeof error === "string" ? error : "Failed to connect to local Secura Forensic Engine (" + API_BASE_URL + ").");
    chrome.tabs.sendMessage(tabId, {
      type: "SECURA_SCAN_ERROR",
      message: safeErrorMsg
    });
  }
}

// Listener for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SECURA_OPEN_SENTINEL_WINDOW") {
    chrome.tabs.create({ url: chrome.runtime.getURL("sentinel.html?autostart=1") });
    sendResponse({ status: "opened" });
    return true;
  }

  if (request.type === "SECURA_OPEN_SENTINEL_PAGE" || request.type === "SECURA_START_INPAGE_SENTINEL") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs && tabs[0];
      if (activeTab && activeTab.id) {
        await ensureContentInjected(activeTab.id);
        chrome.tabs.sendMessage(activeTab.id, { type: "SECURA_START_INPAGE_SENTINEL" });
      }
    });
    sendResponse({ status: "inpage_sentinel_dispatched" });
    return true;
  }

  if (request.type === "SECURA_INSPECT_MEDIA_TARGET") {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId && request.mediaInfo) {
      ensureContentInjected(tabId).then(() => {
        chrome.tabs.sendMessage(tabId, { type: "SECURA_SCAN_STARTING" });
        performMediaInspection(tabId, request.mediaInfo.mediaUrl, request.mediaInfo);
      });
    }
    sendResponse({ status: "analyzing" });
    return true;
  }

  if (request.type === "SECURA_INSPECT_MEDIA_URL") {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId && request.url) {
      ensureContentInjected(tabId).then(() => {
        chrome.tabs.sendMessage(tabId, { type: "SECURA_SCAN_STARTING" });
        performMediaInspection(tabId, request.url, { rect: request.rect, mediaType: request.mediaType });
      });
    }
    sendResponse({ status: "analyzing" });
    return true;
  }

  if (request.type === "SECURA_TEST_HUD_ON_ACTIVE_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0] && tabs[0].id) {
        await ensureContentInjected(tabs[0].id);
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "SECURA_SCAN_STARTING"
        });
        setTimeout(() => {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "SECURA_SCAN_COMPLETE",
            data: {
              canonical_verdict: {
                predicted_label: "AUTHENTIC",
                display_label: "AUTHENTIC / CAMERA ORIGINAL",
                model_score: 0.08,
                evidence_summary: "HUD Verification Verified. Natural sensor noise distribution, valid high-frequency Bayer array textures, and verified C2PA cryptographic container."
              },
              c2pa_provenance: { manifest_present: true },
              synthid_provenance: { watermark_present: false }
            },
            srcUrl: tabs[0].url
          });
        }, 500);
      }
    });
    sendResponse({ status: "triggered" });
    return true;
  }
});

