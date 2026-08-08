const DATA_KEY = 'mesraah_v030';
const ACTIVE_UID_KEY = 'mesraah_active_uid_v2';
const DIRTY_PREFIX = 'mesraah_dirty_v2_';

function readState() {
  try { return JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {}; }
  catch { return {}; }
}

function writeState(state) {
  localStorage.setItem(DATA_KEY, JSON.stringify(state || {}));
  const uid = localStorage.getItem(ACTIVE_UID_KEY);
  if (uid) localStorage.setItem(DIRTY_PREFIX + uid, '1');
}

function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

function closeDialogSafely(dialog) {
  if (!dialog?.open) return;
  try { dialog.close('cancel'); }
  catch { dialog.removeAttribute('open'); }
}

function installDialogExitControls() {
  if (window.__MESRAAH_DIALOG_EXIT_CONTROLS__) return;
  window.__MESRAAH_DIALOG_EXIT_CONTROLS__ = true;
  const supported = new Set([
    'taskModal',
    'simpleModal',
    'v80PersonContextModal',
    'v11SpaceDialog',
    'v112ClearExamplesDialog'
  ]);

  const normalizeButtons = () => {
    supported.forEach(id => {
      const dialog = document.getElementById(id);
      if (!dialog) return;
      dialog.querySelectorAll('.close-btn,[aria-label="إغلاق"],button[value="cancel"]').forEach(button => {
        button.type = 'button';
        button.dataset.mesraahCloseDialog = '1';
      });
    });
  };

  normalizeButtons();
  const observer = new MutationObserver(normalizeButtons);
  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-mesraah-close-dialog]');
    if (!button) return;
    const dialog = button.closest('dialog');
    if (!dialog || !supported.has(dialog.id)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeDialogSafely(dialog);
  }, true);

  document.addEventListener('cancel', event => {
    const dialog = event.target;
    if (!(dialog instanceof HTMLDialogElement) || !supported.has(dialog.id)) return;
    event.preventDefault();
    closeDialogSafely(dialog);
  }, true);

  document.addEventListener('pointerdown', event => {
    const dialog = event.target;
    if (!(dialog instanceof HTMLDialogElement) || !dialog.open || !supported.has(dialog.id)) return;
    const rect = dialog.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (!outside) return;
    event.preventDefault();
    closeDialogSafely(dialog);
  }, true);
}

function spaceById(id) {
  return (readState().spaces || []).find(space => String(space.id) === String(id));
}

function resetSpaceDeleteState() {
  const button = document.getElementById('v11DeleteSpace');
  const warning = document.getElementById('v111SpaceWarning');
  if (button) {
    button.dataset.confirm = '0';
    button.textContent = 'حذف المساحة';
    button.classList.remove('is-confirming');
  }
  warning?.classList.remove('show');
}

function prepareSpaceDialog() {
  const dialog = document.getElementById('v11SpaceDialog');
  const form = dialog?.querySelector('form');
  if (!dialog || !form || dialog.dataset.v111Ready) return dialog;
  dialog.dataset.v111Ready = '1';

  const title = document.getElementById('v11SpaceTitle');
  const info = document.getElementById('v11SpaceInfo');
  const hiddenId = document.getElementById('v11SpaceId');
  const nameInput = document.getElementById('v11SpaceName');
  const actions = dialog.querySelector('.v11-space-actions');

  const head = document.createElement('div');
  head.className = 'v111-space-head';
  const headCopy = document.createElement('div');
  if (title) headCopy.appendChild(title);
  const helper = document.createElement('small');
  helper.textContent = 'تعديل اسم المساحة أو حذفها';
  headCopy.appendChild(helper);
  const close = document.createElement('button');
  close.type = 'button';
  close.id = 'v111SpaceClose';
  close.setAttribute('aria-label', 'إغلاق');
  close.dataset.mesraahCloseDialog = '1';
  close.textContent = '×';
  head.append(headCopy, close);

  const body = document.createElement('div');
  body.className = 'v111-space-body';
  if (info) body.appendChild(info);
  if (hiddenId) body.appendChild(hiddenId);
  if (nameInput) body.appendChild(nameInput);

  const warning = document.createElement('div');
  warning.id = 'v111SpaceWarning';
  warning.className = 'v111-space-warning';
  warning.textContent = 'اضغط حذف المساحة مرة ثانية للتأكيد. المهام المفتوحة ستنتقل إلى الوارد.';

  form.prepend(body);
  form.prepend(head);
  if (actions) actions.insertAdjacentElement('beforebegin', warning);

  const cancel = actions?.querySelector('button[value="cancel"]');
  if (cancel) {
    cancel.type = 'button';
    cancel.dataset.mesraahCloseDialog = '1';
  }

  dialog.addEventListener('close', resetSpaceDeleteState);
  dialog.addEventListener('cancel', resetSpaceDeleteState);

  return dialog;
}

function openSpaceDialog(id) {
  const dialog = prepareSpaceDialog();
  const space = spaceById(id);
  if (!dialog || !space) return;
  const state = readState();
  const count = (state.tasks || []).filter(task => String(task.spaceId) === String(id) && task.status !== 'done').length;
  const title = document.getElementById('v11SpaceTitle');
  const info = document.getElementById('v11SpaceInfo');
  const hiddenId = document.getElementById('v11SpaceId');
  const input = document.getElementById('v11SpaceName');
  if (title) title.textContent = space.name || 'المساحة';
  if (info) info.textContent = count ? `${count} مهمة مفتوحة داخل هذه المساحة` : 'لا توجد مهام مفتوحة داخل هذه المساحة';
  if (hiddenId) hiddenId.value = space.id || '';
  if (input) input.value = space.name || '';
  resetSpaceDeleteState();
  if (!dialog.open) dialog.showModal();
  setTimeout(() => input?.focus(), 40);
}

function resolveSpaceId(card, index) {
  if (card.dataset.v11SpaceId) return card.dataset.v11SpaceId;
  const state = readState();
  const title = card.querySelector('h3')?.textContent?.trim() || '';
  const byName = (state.spaces || []).find(space => space.name === title);
  return byName?.id || state.spaces?.[index]?.id || '';
}

function decorateSpaceCards() {
  prepareSpaceDialog();
  document.querySelectorAll('#spaceGrid .space-card').forEach((card, index) => {
    const id = resolveSpaceId(card, index);
    if (!id) return;
    card.dataset.v11SpaceId = id;
    card.classList.add('v111-manageable');
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    if (card.dataset.v111Bound) return;
    card.dataset.v111Bound = '1';
    card.addEventListener('click', event => {
      if (event.target.closest('button,a,input,select,textarea')) return;
      openSpaceDialog(card.dataset.v11SpaceId);
    });
    card.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openSpaceDialog(card.dataset.v11SpaceId);
    });
  });
}

function installSpaceButtonOverrides() {
  document.addEventListener('click', event => {
    const menu = event.target.closest('.v11-space-menu');
    if (menu) {
      const card = menu.closest('.space-card');
      const id = card?.dataset.v11SpaceId;
      if (id) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openSpaceDialog(id);
      }
      return;
    }

    const save = event.target.closest('#v11RenameSpace');
    if (save) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = document.getElementById('v11SpaceId')?.value || '';
      const name = document.getElementById('v11SpaceName')?.value.trim() || '';
      if (!name) { toast('اكتب اسم المساحة'); return; }
      const state = readState();
      const space = (state.spaces || []).find(item => String(item.id) === String(id));
      if (!space) { toast('تعذر العثور على المساحة'); return; }
      space.name = name;
      writeState(state);
      document.getElementById('v11SpaceDialog')?.close();
      toast('تم تعديل المساحة');
      setTimeout(() => location.reload(), 180);
      return;
    }

    const remove = event.target.closest('#v11DeleteSpace');
    if (remove) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (remove.dataset.confirm !== '1') {
        remove.dataset.confirm = '1';
        remove.textContent = 'تأكيد حذف المساحة';
        remove.classList.add('is-confirming');
        document.getElementById('v111SpaceWarning')?.classList.add('show');
        return;
      }

      const id = document.getElementById('v11SpaceId')?.value || '';
      const state = readState();
      const space = (state.spaces || []).find(item => String(item.id) === String(id));
      if (!space) { toast('تعذر العثور على المساحة'); return; }
      state.tasks = (state.tasks || []).map(task => String(task.spaceId) === String(id)
        ? { ...task, spaceId: '', status: task.status === 'done' ? 'done' : 'inbox' }
        : task);
      state.spaces = (state.spaces || []).filter(item => String(item.id) !== String(id));
      writeState(state);
      document.getElementById('v11SpaceDialog')?.close();
      toast('تم حذف المساحة ونقل مهامها إلى الوارد');
      setTimeout(() => location.reload(), 180);
    }
  }, true);
}

function installMutationWatch() {
  const grid = document.getElementById('spaceGrid');
  if (!grid) return;
  new MutationObserver(decorateSpaceCards).observe(grid, { childList: true, subtree: true });
}

function boot() {
  installDialogExitControls();
  decorateSpaceCards();
  installSpaceButtonOverrides();
  installMutationWatch();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
