(() => {
  const VERSION = '0.7.1';

  function ensureFreshBuild() {
    const url = new URL(window.location.href);
    if (url.searchParams.get('build') === VERSION) return false;

    const key = `mesraah_build_redirect_${VERSION}`;
    if (sessionStorage.getItem(key) === '1') return false;

    sessionStorage.setItem(key, '1');
    url.searchParams.set('build', VERSION);
    window.location.replace(url.toString());
    return true;
  }

  if (ensureFreshBuild()) return;

  function loadStyles() {
    if (document.querySelector('link[data-mesraah-v071]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `ui-v071.css?v=${VERSION}`;
    link.dataset.mesraahV071 = '';
    document.head.appendChild(link);
  }

  function installStoryIcon() {
    const card = document.querySelector('.mesraah-story-card');
    const icon = card?.querySelector('.story-path');
    if (!card || !icon) return;

    icon.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 18h6"></path>
        <path d="M10 21h4"></path>
        <path d="M8.5 15.5c-1.4-1.1-2.2-2.8-2.2-4.6A5.7 5.7 0 0 1 12 5.2a5.7 5.7 0 0 1 5.7 5.7c0 1.8-.8 3.5-2.2 4.6-.7.6-1 1.1-1.1 1.7H9.6c-.1-.6-.4-1.1-1.1-1.7Z"></path>
        <path d="M12 2.5v1"></path>
        <path d="m4.8 5.2.8.8"></path>
        <path d="m19.2 5.2-.8.8"></path>
      </svg>`;

    const glowKey = `mesraah_story_glow_${VERSION}`;
    if (!sessionStorage.getItem(glowKey)) {
      sessionStorage.setItem(glowKey, '1');
      card.classList.add('v71-glow');
      window.setTimeout(() => card.classList.remove('v71-glow'), 1800);
    }
  }

  function normalizeClock() {
    const clock = document.getElementById('timeToggle');
    if (!clock) return;
    clock.setAttribute('dir', 'ltr');
    clock.style.direction = 'ltr';
    clock.style.unicodeBidi = 'isolate';
  }

  function normalizeVersion() {
    document.documentElement.dataset.mesraahVersion = VERSION;
    document.querySelectorAll('.v7-version').forEach(el => { el.textContent = `v${VERSION}`; });

    const footer = document.querySelector('.mesraah-footer-bottom');
    if (!footer) return;
    const plainVersions = [...footer.querySelectorAll(':scope > span')].filter(el => /^v\d+\.\d+\.\d+$/.test(el.textContent.trim()));
    plainVersions.forEach(el => { el.textContent = `v${VERSION}`; });
  }

  function boot() {
    loadStyles();
    installStoryIcon();
    normalizeClock();
    normalizeVersion();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
