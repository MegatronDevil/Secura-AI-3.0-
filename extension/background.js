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
      } else {
        console.log("Secura AI context menus registered.");
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
async function ensureJpegOrPngBlob(inputBlob) {
  try {
    const buf = await inputBlob.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(buf);
    const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;

    if (isJpeg) {
      return { blob: inputBlob, filename: "web_inspected_asset.jpg" };
    }
    if (isPng) {
      return { blob: inputBlob, filename: "web_inspected_asset.png" };
    }

    // Transcode WebP, AVIF, or other image formats into pure PNG via OffscreenCanvas
    const bitmap = await createImageBitmap(inputBlob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const pngBlob = await canvas.convertToBlob({ type: "image/png" });
    return { blob: pngBlob, filename: "web_inspected_asset.png" };
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
    const dpr = rect.dpr || 1;
    const sx = Math.max(0, Math.round(rect.left * dpr));
    const sy = Math.max(0, Math.round(rect.top * dpr));
    const sw = Math.min(bitmap.width - sx, Math.round(rect.width * dpr));
    const sh = Math.min(bitmap.height - sy, Math.round(rect.height * dpr));

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

  if (info.menuItemId !== "secura_inspect_media" || !tab || !tab.id) return;

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

// Reusable media inspection pipeline for both context menu and in-page click inspect
async function performMediaInspection(tabId, targetUrl, clickedMediaInfo = null) {
  try {
    let blob = null;

    // A. Handle data: URLs directly
    if (targetUrl.startsWith("data:")) {
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
            blob = await cropScreenshotBlob(screenshotUrl, clickedMediaInfo?.rect);
          }
        } catch (captureErr) {
          console.warn("Tab capture fallback error:", captureErr);
        }
      }
    }

    if (!blob || blob.size === 0) {
      throw new Error("Unable to capture media asset bytes. Please try right-clicking directly on the image.");
    }

    // 3. Check if target is a video file or stream
    const isVideoTarget = clickedMediaInfo?.mediaType === "video" || 
      (targetUrl && /\.(mp4|webm|mov)(\?|$)/i.test(targetUrl)) || 
      (blob.type && blob.type.startsWith("video/"));

    let apiEndpoint = `${API_BASE_URL}/api/v1/analyze/image?probe=Ensemble`;
    let uploadBlob = null;
    let uploadFilename = "web_inspected_asset.png";

    if (isVideoTarget && blob.type && blob.type.startsWith("video/")) {
      apiEndpoint = `${API_BASE_URL}/api/v1/analyze/video?preset=fast`;
      uploadBlob = blob;
      uploadFilename = targetUrl.split("/").pop().split("?")[0] || "web_inspected_video.mp4";
    } else {
      const { blob: preparedBlob, filename } = await ensureJpegOrPngBlob(blob);
      uploadBlob = preparedBlob;
      uploadFilename = filename;
    }

    // Send to local Secura Forensic Backend
    const formData = new FormData();
    formData.append("file", uploadBlob, uploadFilename);

    const apiResp = await fetch(apiEndpoint, {
      method: "POST",
      body: formData
    });

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

    // 4. Send forensic verdict to tab
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

  if (request.type === "SECURA_INSPECT_MEDIA_URL") {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId && request.url) {
      ensureContentInjected(tabId).then(() => {
        chrome.tabs.sendMessage(tabId, { type: "SECURA_SCAN_STARTING" });
        performMediaInspection(tabId, request.url, { rect: request.rect });
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
