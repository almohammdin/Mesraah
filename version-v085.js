(() => {
  const VERSION = '0.8.5';
  document.documentElement.dataset.mesraahVersion = VERSION;
  const footer = document.querySelector('.mesraah-footer-bottom');
  footer?.querySelectorAll(':scope > span').forEach(el => {
    if (/^v\d+\.\d+\.\d+$/.test(el.textContent.trim())) el.textContent = `v${VERSION}`;
  });
  footer?.querySelectorAll('.v7-version').forEach(el => { el.textContent = `v${VERSION}`; });
})();
