// Excalidraw Vault - Global Namespace and State Storage

var Vault = {
  // Database store
  drawings: {},
  activeDrawingId: null,
  lastSavedElementsStr: "",
  
  // Search and view filters
  currentFilterTag: "All",
  searchQuery: "",
  
  // Active timers
  thumbnailTimeout: null,
  saveStatusTimeout: null,
  autosaveIntervalId: null,
  
  // DOM references
  cachedCanvas: null,
  triggerBtn: null,
  sidebarEl: null,
  listEl: null,
  searchInput: null,
  tagsContainer: null,
  modalBackdrop: null,
  restoreTransitionEl: null
};
