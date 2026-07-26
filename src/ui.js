// Excalidraw Vault - User Interface, Renderers, and DOM Bindings

// Helper to change status UI indicator
Vault.showStatusIndicator = function(text, isSaving) {
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
};

// Inject sidebar and trigger button to Page
Vault.injectUI = function() {
  // 1. Floating trigger button
  Vault.triggerBtn = document.createElement("button");
  Vault.triggerBtn.className = "excalidraw-vault-trigger";
  Vault.triggerBtn.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      <path d="M12 11v6"></path>
      <path d="M9 14h6"></path>
    </svg>
  `;
  Vault.triggerBtn.title = "Open Drawing Library";
  Vault.triggerBtn.addEventListener("click", Vault.toggleSidebar);
  document.body.appendChild(Vault.triggerBtn);

  // 2. Sidebar container
  Vault.sidebarEl = document.createElement("div");
  Vault.sidebarEl.className = "excalidraw-vault-sidebar";
  Vault.sidebarEl.innerHTML = `
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

  document.body.appendChild(Vault.sidebarEl);

  // Sidebar selectors
  Vault.listEl = Vault.sidebarEl.querySelector(".excalidraw-vault-list");
  Vault.searchInput = Vault.sidebarEl.querySelector(".excalidraw-vault-search-input");
  Vault.tagsContainer = Vault.sidebarEl.querySelector(".excalidraw-vault-tags");

  // Close button event
  const closeBtn = Vault.sidebarEl.querySelector(".excalidraw-vault-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", Vault.closeSidebar);
  } else {
    console.error("Excalidraw Vault: Close button not found in sidebar HTML.");
  }

  // New sketch event
  const newBtn = Vault.sidebarEl.querySelector(".excalidraw-vault-new-btn");
  if (newBtn) {
    newBtn.addEventListener("click", Vault.createNewSketch);
  } else {
    console.error("Excalidraw Vault: New Sketch button not found in sidebar HTML.");
  }

  // Vault Tools event
  const toolsBtn = Vault.sidebarEl.querySelector(".excalidraw-vault-tools-btn");
  if (toolsBtn) {
    console.log("Excalidraw Vault: Binding click event to Vault Tools button.");
    toolsBtn.addEventListener("click", (e) => {
      console.log("Excalidraw Vault: Vault Tools button clicked.");
      Vault.openVaultTools();
    });
  } else {
    console.error("Excalidraw Vault: Vault Tools button not found in sidebar HTML.");
  }

  // Search query listener
  Vault.searchInput.addEventListener("input", (e) => {
    Vault.searchQuery = e.target.value.toLowerCase().trim();
    Vault.renderDrawingsList();
  });

  // 3. Loader transition overlay
  Vault.restoreTransitionEl = document.createElement("div");
  Vault.restoreTransitionEl.className = "excalidraw-vault-restore-transition";
  Vault.restoreTransitionEl.innerHTML = `
    <div class="excalidraw-vault-spinner"></div>
    <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Loading sketch...</h3>
  `;
  document.body.appendChild(Vault.restoreTransitionEl);

  // 4. Modal Backdrop container for delete / tag modal
  Vault.modalBackdrop = document.createElement("div");
  Vault.modalBackdrop.className = "excalidraw-vault-modal-backdrop";
  document.body.appendChild(Vault.modalBackdrop);

  // Render components initial
  Vault.renderDrawingsList();
  Vault.renderTagsList();
};

// Toggle open/closed state of sidebar
Vault.toggleSidebar = function() {
  Vault.sidebarEl.classList.toggle("open");
  // Move trigger button slightly left when sidebar is open
  if (Vault.sidebarEl.classList.contains("open")) {
    Vault.triggerBtn.style.right = "395px";
    Vault.renderDrawingsList();
    Vault.renderTagsList();
  } else {
    Vault.triggerBtn.style.right = "15px";
  }
};

Vault.closeSidebar = function() {
  Vault.sidebarEl.classList.remove("open");
  Vault.triggerBtn.style.right = "15px";
};

// Create a new fresh sketch
Vault.createNewSketch = function() {
  Vault.showModal({
    title: "New Sketch",
    body: `
      <div>Enter a name for your new sketch:</div>
      <input type="text" class="excalidraw-vault-modal-input" placeholder="My New Sketch" value="Untitled Sketch">
    `,
    confirmText: "Create",
    onConfirm: async () => {
      const inputVal = Vault.modalBackdrop.querySelector(".excalidraw-vault-modal-input").value.trim();
      const sketchName = inputVal || "Untitled Sketch";
      
      Vault.restoreTransitionEl.classList.add("active");
      
      window.localStorage.removeItem("excalidraw");
      window.localStorage.removeItem("excalidraw-state");
      
      const newId = "dwg_" + Date.now();
      const dateNow = Date.now();
      
      Vault.drawings[newId] = {
        id: newId,
        name: sketchName,
        elements: [],
        appState: {},
        tags: ["Draft"],
        createdAt: dateNow,
        updatedAt: dateNow,
        thumbnail: null
      };
      
      Vault.activeDrawingId = newId;
      Vault.lastSavedElementsStr = "[]";
      
      await Vault.saveVaultData();
      
      window.location.reload();
    }
  });
};

// Restore drawing
Vault.restoreSketch = async function(id) {
  if (!Vault.drawings[id]) return;

  Vault.restoreTransitionEl.classList.add("active");

  const sketch = Vault.drawings[id];
  Vault.activeDrawingId = id;
  
  window.localStorage.setItem("excalidraw", JSON.stringify(sketch.elements || []));
  window.localStorage.setItem("excalidraw-state", JSON.stringify(sketch.appState || {}));

  await Vault.saveVaultData();

  setTimeout(() => {
    window.location.reload();
  }, 400);
};

// Delete drawing
Vault.deleteSketch = function(id, e) {
  e.stopPropagation(); // Avoid triggering card click restore
  
  Vault.showModal({
    title: "Delete Sketch",
    body: `Are you sure you want to permanently delete "${Vault.drawings[id].name}"? This action cannot be undone.`,
    confirmText: "Delete",
    confirmClass: "danger",
    onConfirm: async () => {
      const wasActive = Vault.activeDrawingId === id;
      delete Vault.drawings[id];

      if (wasActive) {
        Vault.activeDrawingId = null;
        window.localStorage.removeItem("excalidraw");
        window.localStorage.removeItem("excalidraw-state");
      }

      await Vault.saveVaultData();
      
      if (wasActive) {
        Vault.restoreTransitionEl.classList.add("active");
        window.location.reload();
      } else {
        Vault.renderDrawingsList();
        Vault.renderTagsList();
      }
    }
  });
};

// Export JSON file
Vault.exportSketch = function(id, e) {
  e.stopPropagation();
  const sketch = Vault.drawings[id];
  if (!sketch) return;

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
};

// Manage tags of a drawing
Vault.openTagsManager = function(id, e) {
  e.stopPropagation();
  const sketch = Vault.drawings[id];
  if (!sketch) return;

  const currentTags = sketch.tags || [];

  Vault.showModal({
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
      const tagSpans = Vault.modalBackdrop.querySelectorAll(".excalidraw-vault-modal-tags-list .excalidraw-vault-tag");
      const newTags = [];
      tagSpans.forEach(span => {
        const val = span.getAttribute("data-tag-val");
        if (val) newTags.push(val);
      });

      const addInput = Vault.modalBackdrop.querySelector(".add-tag-input");
      const addedTag = addInput.value.trim();
      if (addedTag && !newTags.includes(addedTag)) {
        newTags.push(addedTag);
      }

      sketch.tags = newTags.length > 0 ? newTags : ["Draft"];
      sketch.updatedAt = Date.now();
      
      await Vault.saveVaultData();
      Vault.renderDrawingsList();
      Vault.renderTagsList();
    }
  });

  const addInput = Vault.modalBackdrop.querySelector(".add-tag-input");
  addInput.addEventListener("keypress", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      const tagText = addInput.value.trim();
      if (tagText) {
        const list = Vault.modalBackdrop.querySelector(".excalidraw-vault-modal-tags-list");
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
};

// Render the scrollable drawing list
Vault.renderDrawingsList = function() {
  if (!Vault.listEl || !Vault.sidebarEl || !Vault.sidebarEl.classList.contains("open")) return;

  const listData = Object.values(Vault.drawings || {}).filter(Boolean).sort((a, b) => {
    const tA = a.updatedAt || 0;
    const tB = b.updatedAt || 0;
    return tB - tA;
  });
  
  const filteredList = listData.filter(sketch => {
    if (!sketch) return false;
    const sketchName = sketch.name || "Untitled Sketch";
    const matchSearch = sketchName.toLowerCase().includes(Vault.searchQuery) || 
                        (sketch.tags || []).some(t => t.toLowerCase().includes(Vault.searchQuery));
    const matchTag = Vault.currentFilterTag === "All" || (sketch.tags || []).includes(Vault.currentFilterTag);
    return matchSearch && matchTag;
  });

  if (filteredList.length === 0) {
    Vault.listEl.innerHTML = `
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

  Vault.listEl.innerHTML = filteredList.map(sketch => {
    const isActive = sketch.id === Vault.activeDrawingId;
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
            <div class="excalidraw-vault-card-time">Updated ${Vault.getRelativeTime(sketch.updatedAt)}</div>
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

  // Attach card click restores
  Vault.listEl.querySelectorAll(".excalidraw-vault-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-id");
      Vault.restoreSketch(id);
    });
  });

  // Inline rename hooks
  Vault.listEl.querySelectorAll(".excalidraw-vault-card-title").forEach(titleInput => {
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
      if (newName && Vault.drawings[id] && Vault.drawings[id].name !== newName) {
        Vault.drawings[id].name = newName;
        Vault.drawings[id].updatedAt = Date.now();
        await Vault.saveVaultData();
        Vault.renderDrawingsList();
      }
    });

    titleInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        titleInput.blur();
      }
    });
  });

  // Action buttons
  Vault.listEl.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", (e) => Vault.deleteSketch(btn.getAttribute("data-id"), e));
  });

  Vault.listEl.querySelectorAll(".export-btn").forEach(btn => {
    btn.addEventListener("click", (e) => Vault.exportSketch(btn.getAttribute("data-id"), e));
  });

  Vault.listEl.querySelectorAll(".tag-btn").forEach(btn => {
    btn.addEventListener("click", (e) => Vault.openTagsManager(btn.getAttribute("data-id"), e));
  });
};

// Render horizontal tag selection list
Vault.renderTagsList = function() {
  if (!Vault.tagsContainer || !Vault.sidebarEl || !Vault.sidebarEl.classList.contains("open")) return;

  const allTags = new Set();
  Object.values(Vault.drawings || {}).forEach(s => {
    if (s && s.tags) {
      s.tags.forEach(t => allTags.add(t));
    }
  });

  const tagsArr = Array.from(allTags).sort();
  
  let html = `<span class="excalidraw-vault-tag ${Vault.currentFilterTag === 'All' ? 'active' : ''}" data-tag="All">All</span>`;
  html += tagsArr.map(tag => `
    <span class="excalidraw-vault-tag ${Vault.currentFilterTag === tag ? 'active' : ''}" data-tag="${tag}">${tag}</span>
  `).join('');

  Vault.tagsContainer.innerHTML = html;

  Vault.tagsContainer.querySelectorAll(".excalidraw-vault-tag").forEach(tagEl => {
    tagEl.addEventListener("click", () => {
      Vault.currentFilterTag = tagEl.getAttribute("data-tag");
      Vault.renderTagsList();
      Vault.renderDrawingsList();
    });
  });
};

// Custom Modal dialogue
Vault.showModal = function({ title, body, confirmText, confirmClass = "confirm", onConfirm }) {
  console.log("Excalidraw Vault: showModal called for title:", title);
  const showFooter = confirmText !== null;
  Vault.modalBackdrop.innerHTML = `
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

  Vault.modalBackdrop.classList.add("active");

  const modal = Vault.modalBackdrop.querySelector(".excalidraw-vault-modal");
  const cancelBtn = modal.querySelector(".cancel");
  const confirmBtn = showFooter ? modal.querySelector(`.${confirmClass}`) : null;

  const closeModal = () => {
    Vault.modalBackdrop.classList.remove("active");
  };

  cancelBtn.addEventListener("click", closeModal);
  
  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      closeModal();
      if (onConfirm) onConfirm();
    });
  }

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
};

// Vault Tools dashboard modal
Vault.openVaultTools = function() {
  console.log("Excalidraw Vault: Entering openVaultTools()");
  try {
    const listData = Object.values(Vault.drawings || {}).filter(Boolean).sort((a, b) => {
      const tA = a.updatedAt || 0;
      const tB = b.updatedAt || 0;
      return tB - tA;
    });
    const hasFilter = Vault.currentFilterTag !== "All" || Vault.searchQuery !== "";
    
    const filteredList = listData.filter(sketch => {
      if (!sketch) return false;
      const sketchName = sketch.name || "Untitled Sketch";
      const matchSearch = sketchName.toLowerCase().includes(Vault.searchQuery) || 
                          (sketch.tags || []).some(t => t.toLowerCase().includes(Vault.searchQuery));
      const matchTag = Vault.currentFilterTag === "All" || (sketch.tags || []).includes(Vault.currentFilterTag);
      return matchSearch && matchTag;
    });

    const totalCount = listData.length;
    const filteredCount = filteredList.length;

    Vault.showModal({
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
            Import a previously exported combined '.json' backup file.
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
      confirmText: null
    });

    const modal = Vault.modalBackdrop.querySelector(".excalidraw-vault-modal");
    
    // Wire Export Button
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
        Vault.triggerIndividualDownloads(targetList);
      }
      
      Vault.modalBackdrop.classList.remove("active");
    });

    // Wire Import file elements
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
        if (sketch && sketch.id) {
          if (mode === "merge") {
            if (Vault.drawings[sketch.id]) {
              const newId = "dwg_" + Date.now() + Math.random().toString(36).substr(2, 5);
              Vault.drawings[newId] = {
                ...sketch,
                id: newId,
                name: `${sketch.name || "Untitled Sketch"} (Copy)`,
                updatedAt: dateNow
              };
            } else {
              Vault.drawings[sketch.id] = {
                ...sketch,
                updatedAt: dateNow
              };
            }
          } else {
            Vault.drawings[sketch.id] = {
              ...sketch,
              updatedAt: dateNow
            };
          }
        }
      });

      await Vault.saveVaultData();
      Vault.renderDrawingsList();
      Vault.renderTagsList();

      Vault.modalBackdrop.classList.remove("active");
      alert(`Successfully imported ${importedDrawings.length} sketches!`);
    });
  } catch (err) {
    console.error("Excalidraw Vault: Error in openVaultTools:", err);
  }
};

// Sequential trigger download of individual sketches
Vault.triggerIndividualDownloads = async function(sketches) {
  for (let i = 0; i < sketches.length; i++) {
    const sketch = sketches[i];
    if (!sketch) continue;

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
    a.download = `${(sketch.name || "untitled").replace(/[^a-z0-9]/gi, '_').toLowerCase()}.excalidraw`;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // 250ms spacing delay
    await new Promise(resolve => setTimeout(resolve, 250));
  }
};
