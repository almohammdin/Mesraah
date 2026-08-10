(() => {
  // Legacy runtime retired in 0.15.0.
  // Kept as a tiny compatibility shim because older cached index.html files may still request it.
  document.documentElement.dataset.mesraahLegacyUi = 'retired';
})();
