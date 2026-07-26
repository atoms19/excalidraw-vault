// Excalidraw Vault - Storage API and Background Syncing

// Load state from local storage
Vault.loadVaultData = function() {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
      console.warn("Excalidraw Vault: Extension context invalidated.");
      resolve();
      return;
    }
    try {
      chrome.storage.local.get(["drawings", "activeDrawingId"], (result) => {
        if (chrome.runtime.lastError) {
          console.warn("Excalidraw Vault load error:", chrome.runtime.lastError.message);
          resolve();
          return;
        }
        Vault.drawings = result.drawings || {};
        Vault.activeDrawingId = result.activeDrawingId || null;
        resolve();
      });
    } catch (e) {
      console.warn("Excalidraw Vault: Failed to load storage due to context invalidation.", e);
      resolve();
    }
  });
};

// Save state to Chrome storage
Vault.saveVaultData = function() {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
      console.warn("Excalidraw Vault: Extension context invalidated. Disabling auto-save.");
      Vault.stopAllIntervals();
      resolve();
      return;
    }
    try {
      chrome.storage.local.set({ drawings: Vault.drawings, activeDrawingId: Vault.activeDrawingId }, () => {
        if (chrome.runtime.lastError) {
          console.warn("Excalidraw Vault save error:", chrome.runtime.lastError.message);
          Vault.stopAllIntervals();
        }
        resolve();
      });
    } catch (e) {
      console.warn("Excalidraw Vault: Failed to save storage due to context invalidation.", e);
      Vault.stopAllIntervals();
      resolve();
    }
  });
};

// Stop auto-saves and clean up timers when the extension context is invalidated
Vault.stopAllIntervals = function() {
  if (Vault.autosaveIntervalId) {
    clearInterval(Vault.autosaveIntervalId);
    Vault.autosaveIntervalId = null;
  }
  if (Vault.thumbnailTimeout) {
    clearTimeout(Vault.thumbnailTimeout);
    Vault.thumbnailTimeout = null;
  }
  if (Vault.triggerBtn) {
    Vault.triggerBtn.style.opacity = "0.5";
    Vault.triggerBtn.style.pointerEvents = "none";
    Vault.triggerBtn.title = "Extension reloaded. Please refresh Excalidraw to reactivate Vault.";
  }
  Vault.showStatusIndicator("Extension reloaded. Please refresh.", false);
};

// Generate thumbnail from main canvas
Vault.captureThumbnail = function() {
  try {
    // Excalidraw renders elements on the canvas. Cache the DOM selection of the drawing canvas.
    let canvas = Vault.cachedCanvas;
    if (!canvas || !canvas.isConnected) {
      const canvases = document.querySelectorAll(".excalidraw canvas");
      if (canvases.length === 0) return null;
      
      for (let c of canvases) {
        if (!c.classList.contains("interactive-canvas")) {
          canvas = c;
          break;
        }
      }
      if (!canvas) canvas = canvases[0];
      Vault.cachedCanvas = canvas;
    }

    // Draw onto temporary small canvas
    const tempCanvas = document.createElement("canvas");
    const ctx = tempCanvas.getContext("2d");
    
    const width = 180;
    const height = 110;
    tempCanvas.width = width;
    tempCanvas.height = height;

    // Fill with canvas background color or theme-appropriate color
    const isDark = document.querySelector(".excalidraw").classList.contains("theme--dark");
    ctx.fillStyle = isDark ? "#121214" : "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Find bounding box or just fit drawing
    // We can just draw the central part of the canvas to fit the aspect ratio
    const sourceWidth = canvas.width;
    const sourceHeight = canvas.height;
    const sourceAspect = sourceWidth / sourceHeight;
    const tempAspect = width / height;

    let drawWidth, drawHeight, offsetX, offsetY;
    if (sourceAspect > tempAspect) {
      drawWidth = width;
      drawHeight = width / sourceAspect;
      offsetX = 0;
      offsetY = (height - drawHeight) / 2;
    } else {
      drawHeight = height;
      drawWidth = height * sourceAspect;
      offsetX = (width - drawWidth) / 2;
      offsetY = 0;
    }

    ctx.drawImage(canvas, 0, 0, sourceWidth, sourceHeight, offsetX, offsetY, drawWidth, drawHeight);
    return tempCanvas.toDataURL("image/jpeg", 0.65);
  } catch (e) {
    console.warn("Failed to generate preview:", e);
    return null;
  }
};

// Monitor Excalidraw's local storage for changes
Vault.startAutosaveMonitor = function() {
  Vault.autosaveIntervalId = setInterval(() => {
    // Performance Optimization: Skip checks if tab is inactive/hidden in the background
    if (document.hidden) return;

    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
      Vault.stopAllIntervals();
      return;
    }
    const currentDwgStr = window.localStorage.getItem("excalidraw") || "[]";
    const currentStateStr = window.localStorage.getItem("excalidraw-state") || "{}";

    // If elements have changed
    if (currentDwgStr !== Vault.lastSavedElementsStr) {
      Vault.lastSavedElementsStr = currentDwgStr;
      Vault.handleDrawingModified(currentDwgStr, currentStateStr);
    }
  }, 1500);
};

// Handle active drawing modification
Vault.handleDrawingModified = async function(dwgStr, stateStr) {
  const elements = JSON.parse(dwgStr);
  const appState = JSON.parse(stateStr);
  
  // Ignore empty canvases on startup/reset
  if (elements.length === 0 && !Vault.activeDrawingId) {
    return;
  }

  Vault.showStatusIndicator("Saving...", true);

  const dateNow = Date.now();

  // If no active drawing, create one
  if (!Vault.activeDrawingId || !Vault.drawings[Vault.activeDrawingId]) {
    Vault.activeDrawingId = "dwg_" + dateNow;
    Vault.drawings[Vault.activeDrawingId] = {
      id: Vault.activeDrawingId,
      name: `Auto-saved Sketch`,
      elements: elements,
      appState: appState,
      tags: ["Draft"],
      createdAt: dateNow,
      updatedAt: dateNow,
      thumbnail: null
    };
  } else {
    // Update existing drawing
    Vault.drawings[Vault.activeDrawingId].elements = elements;
    Vault.drawings[Vault.activeDrawingId].appState = appState;
    Vault.drawings[Vault.activeDrawingId].updatedAt = dateNow;
  }

  await Vault.saveVaultData();
  Vault.renderDrawingsList();

  // Debounce thumbnail generation so we do it after user stops drawing for 3 seconds
  if (Vault.thumbnailTimeout) clearTimeout(Vault.thumbnailTimeout);
  
  Vault.thumbnailTimeout = setTimeout(async () => {
    if (Vault.activeDrawingId && Vault.drawings[Vault.activeDrawingId]) {
      const thumb = Vault.captureThumbnail();
      if (thumb) {
        Vault.drawings[Vault.activeDrawingId].thumbnail = thumb;
        await Vault.saveVaultData();
        Vault.renderDrawingsList();
      }
    }
    Vault.showStatusIndicator("Backup Active", false);
  }, 3000);
};

// Handle importing whatever is currently open if we don't have an active drawing ID
Vault.handleInitialImport = async function() {
  const localDwg = window.localStorage.getItem("excalidraw");
  const localState = window.localStorage.getItem("excalidraw-state");
  
  if (localDwg && localDwg !== "[]" && !Vault.activeDrawingId) {
    // Create a drawing using localstorage contents
    const elements = JSON.parse(localDwg);
    const appState = localState ? JSON.parse(localState) : {};
    
    const newId = "dwg_" + Date.now();
    const dateNow = Date.now();
    
    Vault.drawings[newId] = {
      id: newId,
      name: "Imported Sketch",
      elements: elements,
      appState: appState,
      tags: ["Draft"],
      createdAt: dateNow,
      updatedAt: dateNow,
      thumbnail: Vault.captureThumbnail()
    };
    
    Vault.activeDrawingId = newId;
    Vault.lastSavedElementsStr = localDwg;
    await Vault.saveVaultData();
    Vault.renderDrawingsList();
    Vault.renderTagsList();
  } else if (Vault.activeDrawingId && Vault.drawings[Vault.activeDrawingId]) {
    // Align lastSavedElementsStr with local storage
    Vault.lastSavedElementsStr = localDwg || "[]";
  }
};
