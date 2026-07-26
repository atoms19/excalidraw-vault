// Excalidraw Vault & Auto-Save Content Script

(function () {
  let drawings = {};
  let activeDrawingId = null;
  let lastSavedElementsStr = "";
  let currentFilterTag = "All";
  let searchQuery = "";
  
  // Throttle/Debounce timers
  let thumbnailTimeout = null;
  let saveStatusTimeout = null;
  let autosaveIntervalId = null;
  let cachedCanvas = null;

  // DOM Elements
  let triggerBtn = null;
  let sidebarEl = null;
  let listEl = null;
  let searchInput = null;
  let tagsContainer = null;
  let modalBackdrop = null;
  let restoreTransitionEl = null;

  // Initialize
  function init() {
    // Excalidraw is a React app. Wait until the container exists.
    const checkExist = setInterval(() => {
      const excalidrawContainer = document.querySelector(".excalidraw");
      if (excalidrawContainer) {
        clearInterval(checkExist);
        startExtension();
      }
    }, 500);
  }

  // Main starting function
  async function startExtension() {
    console.log("Excalidraw Vault: Initializing UI and sync handlers.");
    
    // Load data from Chrome extension storage
    await loadVaultData();

    // Inject UI Elements
    injectUI();

    // Check if we need to import an existing drawing
    await handleInitialImport();

    // Start background polling for modifications
    startAutosaveMonitor();

    // Watch for Excalidraw theme changes to style sidebar dynamically
    observeTheme();
  }

  // Load state from local storage
  function loadVaultData() {
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
          drawings = result.drawings || {};
          activeDrawingId = result.activeDrawingId || null;
          resolve();
        });
      } catch (e) {
        console.warn("Excalidraw Vault: Failed to load storage due to context invalidation.", e);
        resolve();
      }
    });
  }

  // Save state to Chrome storage
  function saveVaultData() {
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
        console.warn("Excalidraw Vault: Extension context invalidated. Disabling auto-save.");
        stopAllIntervals();
        resolve();
        return;
      }
      try {
        chrome.storage.local.set({ drawings, activeDrawingId }, () => {
          if (chrome.runtime.lastError) {
            console.warn("Excalidraw Vault save error:", chrome.runtime.lastError.message);
            stopAllIntervals();
          }
          resolve();
        });
      } catch (e) {
        console.warn("Excalidraw Vault: Failed to save storage due to context invalidation.", e);
        stopAllIntervals();
        resolve();
      }
    });
  }

  // Stop auto-saves and clean up timers when the extension context is invalidated
  function stopAllIntervals() {
    if (autosaveIntervalId) {
      clearInterval(autosaveIntervalId);
      autosaveIntervalId = null;
    }
    if (thumbnailTimeout) {
      clearTimeout(thumbnailTimeout);
      thumbnailTimeout = null;
    }
    if (triggerBtn) {
      triggerBtn.style.opacity = "0.5";
      triggerBtn.style.pointerEvents = "none";
      triggerBtn.title = "Extension reloaded. Please refresh Excalidraw to reactivate Vault.";
    }
    showStatusIndicator("Extension reloaded. Please refresh.", false);
  }

  // Handle importing whatever is currently open if we don't have an active drawing ID
  async function handleInitialImport() {
    const localDwg = window.localStorage.getItem("excalidraw");
    const localState = window.localStorage.getItem("excalidraw-state");
    
    if (localDwg && localDwg !== "[]" && !activeDrawingId) {
      // Create a drawing using localstorage contents
      const elements = JSON.parse(localDwg);
      const appState = localState ? JSON.parse(localState) : {};
      
      const newId = "dwg_" + Date.now();
      const dateNow = Date.now();
      
      drawings[newId] = {
        id: newId,
        name: "Imported Sketch",
        elements: elements,
        appState: appState,
        tags: ["Draft"],
        createdAt: dateNow,
        updatedAt: dateNow,
        thumbnail: captureThumbnail()
      };
      
      activeDrawingId = newId;
      lastSavedElementsStr = localDwg;
      await saveVaultData();
      renderDrawingsList();
      renderTagsList();
    } else if (activeDrawingId && drawings[activeDrawingId]) {
      // Align lastSavedElementsStr with local storage
      lastSavedElementsStr = localDwg || "[]";
    }
  }

  // Monitor Excalidraw's local storage for changes
  function startAutosaveMonitor() {
    autosaveIntervalId = setInterval(() => {
      // Performance Optimization: Skip checks if tab is inactive/hidden in the background
      if (document.hidden) return;

      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
        stopAllIntervals();
        return;
      }
      const currentDwgStr = window.localStorage.getItem("excalidraw") || "[]";
      const currentStateStr = window.localStorage.getItem("excalidraw-state") || "{}";

      // If elements have changed
      if (currentDwgStr !== lastSavedElementsStr) {
        lastSavedElementsStr = currentDwgStr;
        handleDrawingModified(currentDwgStr, currentStateStr);
      }
    }, 1500);
  }

  // Handle active drawing modification
  async function handleDrawingModified(dwgStr, stateStr) {
    const elements = JSON.parse(dwgStr);
    const appState = JSON.parse(stateStr);
    
    // Ignore empty canvases on startup/reset
    if (elements.length === 0 && !activeDrawingId) {
      return;
    }

    showStatusIndicator("Saving...", true);

    const dateNow = Date.now();

    // If no active drawing, create one
    if (!activeDrawingId || !drawings[activeDrawingId]) {
      activeDrawingId = "dwg_" + dateNow;
      drawings[activeDrawingId] = {
        id: activeDrawingId,
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
      drawings[activeDrawingId].elements = elements;
      drawings[activeDrawingId].appState = appState;
      drawings[activeDrawingId].updatedAt = dateNow;
    }

    await saveVaultData();
    renderDrawingsList();

    // Debounce thumbnail generation so we do it after user stops drawing for 3 seconds
    if (thumbnailTimeout) clearTimeout(thumbnailTimeout);
    
    thumbnailTimeout = setTimeout(async () => {
      if (activeDrawingId && drawings[activeDrawingId]) {
        const thumb = captureThumbnail();
        if (thumb) {
          drawings[activeDrawingId].thumbnail = thumb;
          await saveVaultData();
          renderDrawingsList();
        }
      }
      showStatusIndicator("Backup Active", false);
    }, 3000);
  }

  // Generate thumbnail from main canvas
  function captureThumbnail() {
    try {
      // Excalidraw renders elements on the canvas. Cache the DOM selection of the drawing canvas.
      let canvas = cachedCanvas;
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
        cachedCanvas = canvas;
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
  }

  // Helper to change status UI indicator
  function showStatusIndicator(text, isSaving) {
    const textEl = document.querySelector(".excalidraw-vault-status-text");
    const dotEl = document.querySelector(".excalidraw-vault-status-dot");
    
    if (textEl) textEl.textContent = text;
    if (dotEl) {
      if (isSaving) {
        dotEl.classList.add("saving");
      } else {
        dotEl.classList.remove("saving");
      }
    }
  }

  // Observe dark/light theme on Excalidraw element to style sidebar
  function observeTheme() {
    const excalidraw = document.querySelector(".excalidraw");
    
    const applyTheme = () => {
      if (excalidraw.classList.contains("theme--dark")) {
        sidebarEl.classList.add("theme--dark");
        triggerBtn.classList.add("theme--dark");
      } else {
        sidebarEl.classList.remove("theme--dark");
        triggerBtn.classList.remove("theme--dark");
      }
    };
    
    applyTheme();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          applyTheme();
        }
      });
    });

    observer.observe(excalidraw, { attributes: true });
  }

  // Inject sidebar and trigger button to Page
  function injectUI() {
    // 1. Floating trigger button
    triggerBtn = document.createElement("button");
    triggerBtn.className = "excalidraw-vault-trigger";
    triggerBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        <path d="M12 11v6"></path>
        <path d="M9 14h6"></path>
      </svg>
    `;
    triggerBtn.title = "Open Drawing Library";
    triggerBtn.addEventListener("click", toggleSidebar);
    document.body.appendChild(triggerBtn);

    // 2. Sidebar container
    sidebarEl = document.createElement("div");
    sidebarEl.className = "excalidraw-vault-sidebar";
    sidebarEl.innerHTML = `
      <div class="excalidraw-vault-header">
        <div class="excalidraw-vault-title-section">
          <h2>Drawing Library</h2>
          <div class="excalidraw-vault-status">
            <span class="excalidraw-vault-status-dot"></span>
            <span class="excalidraw-vault-status-text">Backup Active</span>
          </div>
        </div>
        <button class="excalidraw-vault-close-btn" title="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="excalidraw-vault-actions">
        <button class="excalidraw-vault-new-btn" title="Create a new blank canvas">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Sketch
        </button>
        <button class="excalidraw-vault-tools-btn" title="Import/Export Vault Drawings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"></path>
            <polyline points="7 9 12 14 17 9"></polyline>
            <line x1="12" y1="14" x2="12" y2="3"></line>
          </svg>
          Vault Tools
        </button>
      </div>

      <div class="excalidraw-vault-search-box">
        <div class="excalidraw-vault-search-wrapper">
          <span class="excalidraw-vault-search-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input type="text" class="excalidraw-vault-search-input" placeholder="Search sketches or tags...">
        </div>
        <div class="excalidraw-vault-tags">
          <!-- Dynamically populated tags -->
        </div>
      </div>

      <div class="excalidraw-vault-list">
        <!-- Dynamically populated cards -->
      </div>
    `;

    document.body.appendChild(sidebarEl);

    // Sidebar selectors
    listEl = sidebarEl.querySelector(".excalidraw-vault-list");
    searchInput = sidebarEl.querySelector(".excalidraw-vault-search-input");
    tagsContainer = sidebarEl.querySelector(".excalidraw-vault-tags");

    // Close button event
    sidebarEl.querySelector(".excalidraw-vault-close-btn").addEventListener("click", closeSidebar);

    // New sketch event
    sidebarEl.querySelector(".excalidraw-vault-new-btn").addEventListener("click", createNewSketch);

    // Vault Tools event
    sidebarEl.querySelector(".excalidraw-vault-tools-btn").addEventListener("click", openVaultTools);

    // Search query listener
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderDrawingsList();
    });

    // 3. Loader transition overlay
    restoreTransitionEl = document.createElement("div");
    restoreTransitionEl.className = "excalidraw-vault-restore-transition";
    restoreTransitionEl.innerHTML = `
      <div class="excalidraw-vault-spinner"></div>
      <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Loading sketch...</h3>
    `;
    document.body.appendChild(restoreTransitionEl);

    // 4. Modal Backgrop container for delete / tag modal
    modalBackdrop = document.createElement("div");
    modalBackdrop.className = "excalidraw-vault-modal-backdrop";
    document.body.appendChild(modalBackdrop);

    // Render components initial
    renderDrawingsList();
    renderTagsList();
  }

  // Toggle open/closed state of sidebar
  function toggleSidebar() {
    sidebarEl.classList.toggle("open");
    // Move trigger button slightly left when sidebar is open, or hide it
    if (sidebarEl.classList.contains("open")) {
      triggerBtn.style.right = "395px";
      renderDrawingsList();
      renderTagsList();
    } else {
      triggerBtn.style.right = "15px";
    }
  }

  function closeSidebar() {
    sidebarEl.classList.remove("open");
    triggerBtn.style.right = "15px";
  }

  // Create a new fresh sketch
  async function createNewSketch() {
    // Prompt the user for a name, or default
    showModal({
      title: "New Sketch",
      body: `
        <div>Enter a name for your new sketch:</div>
        <input type="text" class="excalidraw-vault-modal-input" placeholder="My New Sketch" value="Untitled Sketch">
      `,
      confirmText: "Create",
      onConfirm: async () => {
        const inputVal = modalBackdrop.querySelector(".excalidraw-vault-modal-input").value.trim();
        const sketchName = inputVal || "Untitled Sketch";
        
        // Show loader transition
        restoreTransitionEl.classList.add("active");
        
        // Clear Excalidraw localStorage values
        window.localStorage.removeItem("excalidraw");
        window.localStorage.removeItem("excalidraw-state");
        
        // Create new storage item
        const newId = "dwg_" + Date.now();
        const dateNow = Date.now();
        
        drawings[newId] = {
          id: newId,
          name: sketchName,
          elements: [],
          appState: {},
          tags: ["Draft"],
          createdAt: dateNow,
          updatedAt: dateNow,
          thumbnail: null
        };
        
        activeDrawingId = newId;
        lastSavedElementsStr = "[]";
        
        await saveVaultData();
        
        // Force reload page to initialize blank slate in Excalidraw
        window.location.reload();
      }
    });
  }

  // Restore drawing
  async function restoreSketch(id) {
    if (!drawings[id]) return;

    restoreTransitionEl.classList.add("active");

    const sketch = drawings[id];
    activeDrawingId = id;
    
    // Write elements and app state back to localStorage
    window.localStorage.setItem("excalidraw", JSON.stringify(sketch.elements || []));
    window.localStorage.setItem("excalidraw-state", JSON.stringify(sketch.appState || {}));

    await saveVaultData();

    // Reload page to force Excalidraw to load new state
    setTimeout(() => {
      window.location.reload();
    }, 400);
  }

  // Delete drawing
  function deleteSketch(id, e) {
    e.stopPropagation(); // Avoid triggering card click restore
    
    showModal({
      title: "Delete Sketch",
      body: `Are you sure you want to permanently delete "${drawings[id].name}"? This action cannot be undone.`,
      confirmText: "Delete",
      confirmClass: "danger",
      onConfirm: async () => {
        const wasActive = activeDrawingId === id;
        delete drawings[id];

        if (wasActive) {
          activeDrawingId = null;
          // Clear active localStorage since it was deleted
          window.localStorage.removeItem("excalidraw");
          window.localStorage.removeItem("excalidraw-state");
        }

        await saveVaultData();
        
        if (wasActive) {
          restoreTransitionEl.classList.add("active");
          window.location.reload();
        } else {
          renderDrawingsList();
          renderTagsList();
        }
      }
    });
  }

  // Export JSON file
  function exportSketch(id, e) {
    e.stopPropagation();
    const sketch = drawings[id];
    if (!sketch) return;

    // Package format matching official Excalidraw export
    const exportData = {
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: sketch.elements || [],
      appState: sketch.appState || {},
      files: {}
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sketch.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.excalidraw`;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Manage tags of a drawing
  function openTagsManager(id, e) {
    e.stopPropagation();
    const sketch = drawings[id];
    if (!sketch) return;

    const currentTags = sketch.tags || [];

    showModal({
      title: `Tags for "${sketch.name}"`,
      body: `
        <div style="margin-bottom:12px;">Tags help filter drawings. Currently:</div>
        <div class="excalidraw-vault-modal-tags-list" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px;">
          ${currentTags.map(tag => `
            <span class="excalidraw-vault-tag active" data-tag-val="${tag}">
              ${tag} <span class="tag-remove" style="margin-left:4px; font-weight:bold; cursor:pointer;" onclick="this.parentElement.remove()">×</span>
            </span>
          `).join('')}
        </div>
        <div style="font-size:12px; margin-bottom:4px;">Add tag:</div>
        <input type="text" class="excalidraw-vault-modal-input add-tag-input" placeholder="e.g. Work, Diagram, Idea" style="margin-top:0;">
      `,
      confirmText: "Save Tags",
      onConfirm: async () => {
        // Collect tags from modal list
        const tagSpans = modalBackdrop.querySelectorAll(".excalidraw-vault-modal-tags-list .excalidraw-vault-tag");
        const newTags = [];
        tagSpans.forEach(span => {
          const val = span.getAttribute("data-tag-val");
          if (val) newTags.push(val);
        });

        // Check if user input has a tag to add on confirmation
        const addInput = modalBackdrop.querySelector(".add-tag-input");
        const addedTag = addInput.value.trim();
        if (addedTag && !newTags.includes(addedTag)) {
          newTags.push(addedTag);
        }

        sketch.tags = newTags.length > 0 ? newTags : ["Draft"];
        sketch.updatedAt = Date.now();
        
        await saveVaultData();
        renderDrawingsList();
        renderTagsList();
      }
    });

    // Add inline event listener for the input inside modal to add instantly to UI lists
    const addInput = modalBackdrop.querySelector(".add-tag-input");
    addInput.addEventListener("keypress", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        const tagText = addInput.value.trim();
        if (tagText) {
          const list = modalBackdrop.querySelector(".excalidraw-vault-modal-tags-list");
          // Check duplicate
          const existing = Array.from(list.querySelectorAll(".excalidraw-vault-tag")).map(s => s.getAttribute("data-tag-val"));
          if (!existing.includes(tagText)) {
            const span = document.createElement("span");
            span.className = "excalidraw-vault-tag active";
            span.setAttribute("data-tag-val", tagText);
            span.innerHTML = `${tagText} <span class="tag-remove" style="margin-left:4px; font-weight:bold; cursor:pointer;">×</span>`;
            span.querySelector(".tag-remove").addEventListener("click", () => span.remove());
            list.appendChild(span);
          }
          addInput.value = "";
        }
      }
    });
  }

  // Render the scrollable drawing list
  function renderDrawingsList() {
    // Performance optimization: do not render the list if the sidebar is closed
    if (!listEl || !sidebarEl || !sidebarEl.classList.contains("open")) return;

    const listData = Object.values(drawings || {}).filter(Boolean).sort((a, b) => {
      const tA = a.updatedAt || 0;
      const tB = b.updatedAt || 0;
      return tB - tA;
    });
    
    // Filter
    const filteredList = listData.filter(sketch => {
      if (!sketch) return false;
      const sketchName = sketch.name || "Untitled Sketch";
      const matchSearch = sketchName.toLowerCase().includes(searchQuery) || 
                          (sketch.tags || []).some(t => t.toLowerCase().includes(searchQuery));
      const matchTag = currentFilterTag === "All" || (sketch.tags || []).includes(currentFilterTag);
      return matchSearch && matchTag;
    });

    if (filteredList.length === 0) {
      listEl.innerHTML = `
        <div class="excalidraw-vault-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <div>No drawings found</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = filteredList.map(sketch => {
      const isActive = sketch.id === activeDrawingId;
      const thumbContent = sketch.thumbnail 
        ? `<img src="${sketch.thumbnail}" alt="${sketch.name}">`
        : `<div class="excalidraw-vault-thumb-placeholder">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <path d="M12 20h9"></path>
               <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
             </svg>
           </div>`;

      const tagsHtml = (sketch.tags || []).map(t => `<span class="excalidraw-vault-card-tag">${t}</span>`).join('');

      return `
        <div class="excalidraw-vault-card ${isActive ? 'active-drawing' : ''}" data-id="${sketch.id}">
          <div class="excalidraw-vault-thumb">
            ${thumbContent}
            <div class="excalidraw-vault-thumb-overlay">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
          </div>
          <div class="excalidraw-vault-details">
            <div class="excalidraw-vault-meta">
              <input type="text" class="excalidraw-vault-card-title" value="${sketch.name}" data-id="${sketch.id}" title="Double-click to rename" readonly>
              <div class="excalidraw-vault-card-time">Updated ${getRelativeTime(sketch.updatedAt)}</div>
              <div class="excalidraw-vault-card-tags">
                ${tagsHtml}
              </div>
            </div>
            <div class="excalidraw-vault-card-actions">
              <button class="excalidraw-vault-btn-icon tag-btn" data-id="${sketch.id}" title="Manage Tags">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                  <line x1="7" y1="7" x2="7.01" y2="7"></line>
                </svg>
              </button>
              <button class="excalidraw-vault-btn-icon export-btn" data-id="${sketch.id}" title="Export as .excalidraw">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
              <button class="excalidraw-vault-btn-icon delete-btn" data-id="${sketch.id}" title="Delete Drawing">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach list events
    listEl.querySelectorAll(".excalidraw-vault-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-id");
        // Don't trigger restore if double clicking to edit title
        restoreSketch(id);
      });
    });

    // Stop card restore when clicking interactive card items
    listEl.querySelectorAll(".excalidraw-vault-card-title").forEach(titleInput => {
      titleInput.addEventListener("click", (e) => e.stopPropagation());
      titleInput.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        titleInput.removeAttribute("readonly");
        titleInput.focus();
        titleInput.select();
      });

      titleInput.addEventListener("blur", async (e) => {
        titleInput.setAttribute("readonly", true);
        const id = titleInput.getAttribute("data-id");
        const newName = titleInput.value.trim();
        if (newName && drawings[id] && drawings[id].name !== newName) {
          drawings[id].name = newName;
          drawings[id].updatedAt = Date.now();
          await saveVaultData();
          renderDrawingsList();
        }
      });

      titleInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          titleInput.blur();
        }
      });
    });

    listEl.querySelectorAll(".delete-btn").forEach(btn => {
      btn.addEventListener("click", (e) => deleteSketch(btn.getAttribute("data-id"), e));
    });

    listEl.querySelectorAll(".export-btn").forEach(btn => {
      btn.addEventListener("click", (e) => exportSketch(btn.getAttribute("data-id"), e));
    });

    listEl.querySelectorAll(".tag-btn").forEach(btn => {
      btn.addEventListener("click", (e) => openTagsManager(btn.getAttribute("data-id"), e));
    });
  }

  // Render horizontal tag selection list
  function renderTagsList() {
    // Performance optimization: do not render tag selection elements if sidebar is closed
    if (!tagsContainer || !sidebarEl || !sidebarEl.classList.contains("open")) return;

    // Collect all unique tags
    const allTags = new Set();
    Object.values(drawings).forEach(s => {
      if (s.tags) {
        s.tags.forEach(t => allTags.add(t));
      }
    });

    const tagsArr = Array.from(allTags).sort();
    
    let html = `<span class="excalidraw-vault-tag ${currentFilterTag === 'All' ? 'active' : ''}" data-tag="All">All</span>`;
    html += tagsArr.map(tag => `
      <span class="excalidraw-vault-tag ${currentFilterTag === tag ? 'active' : ''}" data-tag="${tag}">${tag}</span>
    `).join('');

    tagsContainer.innerHTML = html;

    tagsContainer.querySelectorAll(".excalidraw-vault-tag").forEach(tagEl => {
      tagEl.addEventListener("click", () => {
        currentFilterTag = tagEl.getAttribute("data-tag");
        renderTagsList();
        renderDrawingsList();
      });
    });
  }

  // Relative Time format helper
  function getRelativeTime(timestamp) {
    if (!timestamp) return "Unknown";
    const now = Date.now();
    const diff = now - timestamp;
    const mins = Math.floor(diff / 60000);
    
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 3600000);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    return `${days}d ago`;
  }

  // Bulk Export and Import Dashboard
  function openVaultTools() {
    try {
      const listData = Object.values(drawings || {}).filter(Boolean).sort((a, b) => {
        const tA = a.updatedAt || 0;
        const tB = b.updatedAt || 0;
        return tB - tA;
      });
      const hasFilter = currentFilterTag !== "All" || searchQuery !== "";
      
      const filteredList = listData.filter(sketch => {
        if (!sketch) return false;
        const sketchName = sketch.name || "Untitled Sketch";
        const matchSearch = sketchName.toLowerCase().includes(searchQuery) || 
                            (sketch.tags || []).some(t => t.toLowerCase().includes(searchQuery));
        const matchTag = currentFilterTag === "All" || (sketch.tags || []).includes(currentFilterTag);
        return matchSearch && matchTag;
      });

      const totalCount = listData.length;
      const filteredCount = filteredList.length;

      showModal({
        title: "Vault Tools (Backup & Restore)",
        body: `
          <div class="excalidraw-vault-tools-section" style="margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 20px;">
            <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">Bulk Export Drawings</h4>
            
            <div style="margin-bottom: 12px;">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; font-weight: 600;">1. Select Range</div>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 6px; cursor: pointer;">
                <input type="radio" name="export-range" value="all" checked>
                <span>All Sketches (${totalCount} sketches)</span>
              </label>
              ${hasFilter ? `
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
                <input type="radio" name="export-range" value="filtered">
                <span>Current Filtered View (${filteredCount} sketches)</span>
              </label>
              ` : ''}
            </div>

            <div style="margin-bottom: 16px;">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; font-weight: 600;">2. Select Format</div>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 6px; cursor: pointer;">
                <input type="radio" name="export-format" value="combined" checked>
                <span>Combined Vault Backup (.json)</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
                <input type="radio" name="export-format" value="individual">
                <span>Individual Files (.excalidraw)</span>
              </label>
            </div>

            <button class="excalidraw-vault-modal-btn confirm" id="btn-run-export" style="width: 100%;">Export Now</button>
          </div>

          <div class="excalidraw-vault-tools-section">
            <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">Import Vault Backup</h4>
            <div style="margin-bottom: 12px; font-size: 12px; color: var(--text-muted); line-height: 1.4;">
              Import a previously exported combined `.json` backup file.
            </div>
            <input type="file" id="vault-import-file" accept=".json" style="display: none;">
            <button class="excalidraw-vault-modal-btn secondary" id="btn-trigger-file-select" style="width: 100%; margin-bottom: 8px; background: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-main);">Select Backup File</button>
            <div id="import-file-name" style="font-size: 12px; color: var(--success-color); margin-bottom: 12px; font-weight: 600; display: none; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></div>
            
            <div id="import-options" style="display: none; margin-bottom: 16px;">
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; font-weight: 600;">Conflict Resolution</div>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 6px; cursor: pointer;">
                <input type="radio" name="import-mode" value="merge" checked>
                <span>Merge (keep both, copy name)</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
                <input type="radio" name="import-mode" value="overwrite">
                <span>Overwrite (replace matching IDs)</span>
              </label>
            </div>

            <button class="excalidraw-vault-modal-btn confirm" id="btn-run-import" style="width: 100%; display: none; background: var(--primary-color); color: white;">Import & Restore</button>
          </div>
        `,
        confirmText: null // Renders a full width Close button
      });

    const modal = modalBackdrop.querySelector(".excalidraw-vault-modal");
    
    // Wire Export Actions
    const btnRunExport = modal.querySelector("#btn-run-export");
    btnRunExport.addEventListener("click", () => {
      const range = modal.querySelector("input[name='export-range']:checked")?.value || "all";
      const format = modal.querySelector("input[name='export-format']:checked")?.value || "combined";

      const targetList = range === "filtered" ? filteredList : listData;

      if (targetList.length === 0) {
        alert("No drawings to export!");
        return;
      }

      if (format === "combined") {
        // Consolidated backup format
        const backupData = {
          type: "excalidraw-vault-backup",
          version: 1,
          timestamp: Date.now(),
          drawings: targetList
        };

        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = url;
        a.download = `excalidraw_vault_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Individual files
        triggerIndividualDownloads(targetList);
      }
      
      // Close modal
      modalBackdrop.classList.remove("active");
    });

    // Wire Import Actions
    const fileInput = modal.querySelector("#vault-import-file");
    const btnTriggerSelect = modal.querySelector("#btn-trigger-file-select");
    const labelFileName = modal.querySelector("#import-file-name");
    const divOptions = modal.querySelector("#import-options");
    const btnRunImport = modal.querySelector("#btn-run-import");

    btnTriggerSelect.addEventListener("click", () => {
      fileInput.click();
    });

    let importedDrawings = [];

    fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;

      labelFileName.textContent = `Selected: ${file.name}`;
      labelFileName.style.display = "block";

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const parsed = JSON.parse(e.target.result);
          if (parsed && parsed.type === "excalidraw-vault-backup" && Array.isArray(parsed.drawings)) {
            importedDrawings = parsed.drawings;
            divOptions.style.display = "block";
            btnRunImport.style.display = "block";
          } else {
            alert("Invalid backup file format! Must be a valid Excalidraw Vault backup file.");
            labelFileName.style.display = "none";
            divOptions.style.display = "none";
            btnRunImport.style.display = "none";
          }
        } catch (err) {
          alert("Error parsing file as JSON!");
          labelFileName.style.display = "none";
          divOptions.style.display = "none";
          btnRunImport.style.display = "none";
        }
      };
      reader.readAsText(file);
    });

    btnRunImport.addEventListener("click", async () => {
      const mode = modal.querySelector("input[name='import-mode']:checked")?.value || "merge";
      const dateNow = Date.now();

      importedDrawings.forEach(sketch => {
        if (mode === "merge") {
          if (drawings[sketch.id]) {
            const newId = "dwg_" + Date.now() + Math.random().toString(36).substr(2, 5);
            drawings[newId] = {
              ...sketch,
              id: newId,
              name: `${sketch.name} (Copy)`,
              updatedAt: dateNow
            };
          } else {
            drawings[sketch.id] = {
              ...sketch,
              updatedAt: dateNow
            };
          }
        } else {
          drawings[sketch.id] = {
            ...sketch,
            updatedAt: dateNow
          };
        }
      });

      await saveVaultData();
      renderDrawingsList();
      renderTagsList();

      modalBackdrop.classList.remove("active");
      
      // Notify
      alert(`Successfully imported ${importedDrawings.length} sketches!`);
    });
    } catch (err) {
      console.error("Excalidraw Vault: Error in openVaultTools:", err);
    }
  }

  // Trigger downloading list of files sequentially
  async function triggerIndividualDownloads(sketches) {
    for (let i = 0; i < sketches.length; i++) {
      const sketch = sketches[i];
      const exportData = {
        type: "excalidraw",
        version: 2,
        source: "https://excalidraw.com",
        elements: sketch.elements || [],
        appState: sketch.appState || {},
        files: {}
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sketch.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.excalidraw`;
      document.body.appendChild(a);
      a.click();
      
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Brief delay to prevent browser download restrictions/warnings
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  // Custom Modal implementation
  function showModal({ title, body, confirmText, confirmClass = "confirm", onConfirm }) {
    const showFooter = confirmText !== null;
    modalBackdrop.innerHTML = `
      <div class="excalidraw-vault-modal">
        <h3 class="excalidraw-vault-modal-title">${title}</h3>
        <div class="excalidraw-vault-modal-body">${body}</div>
        <div class="excalidraw-vault-modal-buttons">
          ${showFooter ? `
            <button class="excalidraw-vault-modal-btn cancel">Cancel</button>
            <button class="excalidraw-vault-modal-btn ${confirmClass}">${confirmText || 'Confirm'}</button>
          ` : `
            <button class="excalidraw-vault-modal-btn cancel" style="width: 100%;">Close</button>
          `}
        </div>
      </div>
    `;

    modalBackdrop.classList.add("active");

    const modal = modalBackdrop.querySelector(".excalidraw-vault-modal");
    const cancelBtn = modal.querySelector(".cancel");
    const confirmBtn = showFooter ? modal.querySelector(`.${confirmClass}`) : null;

    const closeModal = () => {
      modalBackdrop.classList.remove("active");
    };

    cancelBtn.addEventListener("click", closeModal);
    
    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        closeModal();
        if (onConfirm) onConfirm();
      });
    }

    // Allow confirming with Enter if typing in an input inside the modal
    const textInput = modal.querySelector("input[type='text']");
    if (textInput && confirmBtn) {
      textInput.focus();
      textInput.select();
      textInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          confirmBtn.click();
        }
      });
    }
  }

  // Initialize extension scripts
  init();

})();
