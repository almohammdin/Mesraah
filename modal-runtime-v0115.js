(() => {
  const IDS = new Set([
    'taskModal',
    'simpleModal',
    'v80PersonContextModal',
    'v11SpaceDialog',
    'v112ClearExamplesDialog'
  ]);

  let shield = null;
  let topDialog = null;

  function ensureShield() {
    if (shield?.isConnected) return shield;
    shield = document.getElementById('mesraahModalShield');
    if (!shield) {
      shield = document.createElement('div');
      shield.id = 'mesraahModalShield';
      shield.className = 'mesraah-modal-shield';
      shield.hidden = true;
      document.body.appendChild(shield);
    }
    shield.addEventListener('pointerdown', event => {
      if (event.target !== shield) return;
      closeTop('cancel');
    });
    return shield;
  }

  function setBodyState() {
    const anyOpen = [...IDS].some(id => document.getElementById(id)?.hasAttribute('open'));
    document.body.classList.toggle('mesraah-modal-open', anyOpen);
    const layer = ensureShield();
    layer.hidden = !anyOpen;
    if (!anyOpen) topDialog = null;
  }

  function closeRuntime(dialog, value = '') {
    if (!dialog?.hasAttribute('open')) return;
    dialog.returnValue = String(value || '');
    dialog.removeAttribute('open');
    dialog.classList.remove('mesraah-runtime-open');
    dialog.setAttribute('aria-hidden', 'true');
    if (topDialog === dialog) topDialog = null;
    try { dialog.dispatchEvent(new Event('close')); } catch {}
    setBodyState();
  }

  function openRuntime(dialog) {
    if (!dialog) return;
    ensureShield();
    document.querySelectorAll('dialog.mesraah-runtime-dialog[open]').forEach(other => {
      if (other !== dialog) closeRuntime(other, 'switch');
    });
    dialog.setAttribute('open', '');
    dialog.classList.add('mesraah-runtime-open');
    dialog.setAttribute('aria-hidden', 'false');
    topDialog = dialog;
    setBodyState();
    requestAnimationFrame(() => {
      const focus = dialog.querySelector('[autofocus],input:not([type="hidden"]),textarea,select,button');
      try { focus?.focus({ preventScroll: true }); } catch { try { focus?.focus(); } catch {} }
    });
  }

  function patchDialog(dialog) {
    if (!(dialog instanceof HTMLDialogElement) || !IDS.has(dialog.id) || dialog.dataset.mesraahRuntime === '1') return;
    dialog.dataset.mesraahRuntime = '1';
    dialog.classList.add('mesraah-runtime-dialog');
    dialog.setAttribute('aria-hidden', dialog.hasAttribute('open') ? 'false' : 'true');

    try {
      Object.defineProperty(dialog, 'showModal', {
        configurable: true,
        value: () => openRuntime(dialog)
      });
      Object.defineProperty(dialog, 'show', {
        configurable: true,
        value: () => openRuntime(dialog)
      });
      Object.defineProperty(dialog, 'close', {
        configurable: true,
        value: value => closeRuntime(dialog, value)
      });
    } catch {
      dialog.showModal = () => openRuntime(dialog);
      dialog.show = () => openRuntime(dialog);
      dialog.close = value => closeRuntime(dialog, value);
    }

    dialog.querySelectorAll('.close-btn,[aria-label="إغلاق"],button[value="cancel"]').forEach(button => {
      button.type = 'button';
      button.dataset.mesraahRuntimeClose = '1';
    });
  }

  function patchAll() {
    IDS.forEach(id => patchDialog(document.getElementById(id)));
  }

  function closeTop(value = 'cancel') {
    const dialog = topDialog?.hasAttribute('open')
      ? topDialog
      : [...IDS].map(id => document.getElementById(id)).reverse().find(item => item?.hasAttribute('open'));
    if (dialog) closeRuntime(dialog, value);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-mesraah-runtime-close],.close-btn,button[value="cancel"]');
    const dialog = button?.closest('dialog');
    if (!button || !dialog || !IDS.has(dialog.id)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeRuntime(dialog, 'cancel');
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = [...IDS].some(id => document.getElementById(id)?.hasAttribute('open'));
    if (!open) return;
    event.preventDefault();
    closeTop('cancel');
  }, true);

  document.addEventListener('submit', event => {
    const dialog = event.target?.closest?.('dialog');
    if (dialog && IDS.has(dialog.id)) patchDialog(dialog);
  }, true);

  const observer = new MutationObserver(() => patchAll());

  function boot() {
    ensureShield();
    patchAll();
    observer.observe(document.body, { childList: true, subtree: true });
    setBodyState();
  }

  window.MesraahModalRuntime = {
    open: id => openRuntime(document.getElementById(id)),
    close: id => closeRuntime(document.getElementById(id), 'cancel'),
    closeTop
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
