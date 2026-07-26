// background.js for Excalidraw Vault & Auto-Save
chrome.runtime.onInstalled.addListener(() => {
  console.log("Excalidraw Vault & Auto-Save extension installed successfully.");
  
  // Initialize storage if needed
  chrome.storage.local.get(["drawings", "activeDrawingId"], (result) => {
    if (!result.drawings) {
      chrome.storage.local.set({ drawings: {} });
    }
    if (!result.activeDrawingId) {
      chrome.storage.local.set({ activeDrawingId: null });
    }
  });
});
