// Excalidraw Vault - Extension Bootstrap & Theme Observers

// Initialize checking loops
Vault.init = function() {
  const checkExist = setInterval(() => {
    const excalidrawContainer = document.querySelector(".excalidraw");
    if (excalidrawContainer) {
      clearInterval(checkExist);
      Vault.startExtension();
    }
  }, 500);
};

// Main extension start sequence
Vault.startExtension = async function() {
  console.log("Excalidraw Vault: Initializing UI and sync handlers.");
  
  // 1. Fetch vault state from Chrome local storage
  await Vault.loadVaultData();

  // 2. Inject DOM elements (Trigger button, sidebar list, spinners, modals)
  Vault.injectUI();

  // 3. Auto-save check for active drawing import on fresh startup
  await Vault.handleInitialImport();

  // 4. Register background storage modification monitoring loops
  Vault.startAutosaveMonitor();

  // 5. Watch for Excalidraw theme changes to style sidebar dynamically
  Vault.observeTheme();
};

// Theme observer matching Excalidraw dark/light values
Vault.observeTheme = function() {
  const excalidraw = document.querySelector(".excalidraw");
  if (!excalidraw) return;
  
  const applyTheme = () => {
    const isDark = excalidraw.classList.contains("theme--dark");
    if (isDark) {
      Vault.sidebarEl.classList.add("theme--dark");
      Vault.triggerBtn.classList.add("theme--dark");
      if (Vault.modalBackdrop) Vault.modalBackdrop.classList.add("theme--dark");
    } else {
      Vault.sidebarEl.classList.remove("theme--dark");
      Vault.triggerBtn.classList.remove("theme--dark");
      if (Vault.modalBackdrop) Vault.modalBackdrop.classList.remove("theme--dark");
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
};

// Trigger bootloader on document idle
Vault.init();
