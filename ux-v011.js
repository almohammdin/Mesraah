const DATA_KEY = 'mesraah_v030';
const VERSION = '0.11.0';
const EXTENDED_KEYS = ['time', 'location', 'dateSource', 'peopleNames'];
const RIYADH = 'Asia/Riyadh';
const HIJRI_MONTHS = ['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];

const nativeStorageSetItem = Storage.prototype.setItem;
let currentPlace = null;
let currentDateMode = 'gregorian';
let mapsModulePromise = null;
let lastDeletedTask = null;
let undoTimer = null;
const hijriYearCache = new Map();

function readState() {
  try { return JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {}; }
  catch { return {}; }
}

function writeState(state) {
  nativeStorageSetItem.call(localStorage, DATA_KEY, JSON.stringify(state || {}));
}

function mergeExtended(previous, next) {
  if (!previous || !next) return next;
  const prevTasks = new Map((previous.tasks || []).map(task => [String(task.id), task]));
  next.tasks = (next.tasks || []).map(task => {
    const prev = prevTasks.get(String(task.id));
    if (!prev) return task;
    const merged = { ...task };
    for (const key of EXTENDED_KEYS) {
      if (!(key in merged) && key in prev) merged[key] = prev[key];
    }
    return merged;
  });
  return next;
}

function installStorageBridge() {
  if (window.__MESRAAH_V11_STORAGE_BRIDGE__) return;
  window.__MESRAAH_V11_STORAGE_BRIDGE__ = true;
  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage && key === DATA_KEY) {
      try {
        const previous = JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {};
        const next = JSON.parse(String(value || '{}')) || {};
        value = JSON.stringify(mergeExtended(previous, next));
      } catch {}
    }
    return nativeStorageSetItem.call(this, key, value);
  };
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>\"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[char]));
}

function dateFromIso(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null;
  return new Date(`${iso}T12:00:00+03:00`);
}

function formatGregorian(iso) {
  const date = dateFromIso(iso);
  if (!date) return '';
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
    timeZone: RIYADH, day: 'numeric', month: 'long', year: 'numeric'
  }).format(date).replace(/،/g, '').trim();
}

function formatHijri(iso) {
  const date = dateFromIso(iso);
  if (!date) return '';
  return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
    timeZone: RIYADH, day: 'numeric', month: 'long', year: 'numeric'
  }).format(date).replace(/هـ/g, '').replace(/،/g, '').trim() + ' هـ';
}

function hijriPartsFromDate(date) {
  return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
    timeZone: RIYADH, year: 'numeric', month: 'numeric', day: 'numeric'
  }).formatToParts(date).reduce((out, part) => {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
    return out;
  }, {});
}

function isoFromDate(date) {
  return new Intl.DateTimeFormat('en-CA-u-ca-gregory', {
    timeZone: RIYADH, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function currentHijriYear() {
  return hijriPartsFromDate(new Date()).year;
}

function buildHijriYearMap(hijriYear) {
  if (hijriYearCache.has(hijriYear)) return hijriYearCache.get(hijriYear);
  const map = new Map();
  const approximateGregorianYear = Math.round(622 + (Number(hijriYear) * 0.970224));
  const start = new Date(Date.UTC(approximateGregorianYear - 1, 0, 1, 12));
  const end = new Date(Date.UTC(approximateGregorianYear + 1, 11, 31, 12));
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const parts = hijriPartsFromDate(cursor);
    if (parts.year !== Number(hijriYear)) continue;
    map.set(`${parts.month}-${parts.day}`, isoFromDate(cursor));
  }
  hijriYearCache.set(hijriYear, map);
  return map;
}

function hijriToGregorian(year, month, day) {
  const map = buildHijriYearMap(Number(year));
  return map.get(`${Number(month)}-${Number(day)}`) || '';
}

function taskTime(task) {
  if (task?.time) return String(task.time);
  const match = String(task?.notes || '').match(/(?:^|\n)الوقت\s*:\s*([^\n]+)/);
  return match ? match[1].trim() : '';
}

function taskLocation(task) {
  if (task?.location && typeof task.location === 'object') return task.location;
  const match = String(task?.notes || '').match(/(?:^|\n)المكان\s*:\s*([^\n]+)/);
  return match ? { name: match[1].trim(), address: match[1].trim(), placeId: '', lat: null, lng: null } : null;
}

function getTask(id) {
  return (readState().tasks || []).find(task => String(task.id) === String(id));
}

function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2300);
}

function installVoiceCard() {
  if (document.getElementById('v11VoiceCard')) return;
  const welcome = document.querySelector('#view-today .welcome-card');
  if (!welcome) return;
  const card = document.createElement('section');
  card.id = 'v11VoiceCard';
  card.className = 'v11-voice-card';
  card.innerHTML = `
    <div class="v11-voice-copy">
      <span class="v11-voice-kicker">مسراح معك</span>
      <h2>قل اللي في بالك وأنا أرتبه معك</h2>
      <p>اسأل عن يومك، أضف مهمة، عدل موعد أو احذف مهمة بصوتك.</p>
      <div class="v11-voice-examples"><span>وش عندي اليوم؟</span><span>ضيف مهمة</span><span>وش عندي قريب؟</span></div>
    </div>
    <div class="v11-voice-action">
      <div class="v11-voice-orb" aria-hidden="true"><span>🎙</span></div>
      <button type="button" class="v11-voice-start" id="v11VoiceStart">تحدث مع مسراح</button>
    </div>`;
  welcome.insertAdjacentElement('afterend', card);
  document.getElementById('v11VoiceStart').addEventListener('click', () => {
    if (window.MesraahVoice?.start) window.MesraahVoice.start();
    else toast('المساعد الصوتي يجهز الآن');
  });
}

function installTaskSheet() {
  const dialog = document.getElementById('taskModal');
  const form = document.getElementById('taskForm');
  if (!dialog || !form || dialog.dataset.v11Ready) return;
  dialog.dataset.v11Ready = '1';
  dialog.classList.add('v11-sheet');

  const titleField = document.getElementById('taskTitle')?.closest('.field');
  const notesField = document.getElementById('taskNotes')?.closest('.field');
  const formGrid = form.querySelector('.form-grid');
  const actions = form.querySelector('.modal-actions');
  const dueField = document.getElementById('taskDue')?.closest('.field');
  if (dueField) dueField.style.display = 'none';

  const primary = document.createElement('div');
  primary.className = 'v11-primary-grid';
  primary.innerHTML = `
    <section class="v11-date-card">
      <div class="v11-date-tabs"><button type="button" data-v11-date-mode="gregorian" class="active">ميلادي</button><button type="button" data-v11-date-mode="hijri">هجري</button></div>
      <div class="v11-greg-wrap"><input type="date" id="v11DueGregorian" aria-label="التاريخ الميلادي"></div>
      <div class="v11-hijri-wrap" hidden>
        <select id="v11HijriDay" aria-label="اليوم الهجري"></select>
        <select id="v11HijriMonth" aria-label="الشهر الهجري"></select>
        <select id="v11HijriYear" aria-label="السنة الهجرية"></select>
      </div>
      <div class="v11-dual-preview" id="v11DualPreview"></div>
    </section>
    <label class="v11-time-field"><span>الوقت</span><input type="time" id="v11TaskTime"></label>`;
  titleField?.insertAdjacentElement('afterend', primary);

  const locationCard = document.createElement('section');
  locationCard.className = 'v11-location-card';
  locationCard.innerHTML = `
    <div class="v11-location-title">المكان</div>
    <div class="v11-location-row">
      <input type="text" id="v11LocationText" maxlength="220" placeholder="مثال: مطعم أوسكار، شارع حراء، جدة">
      <button type="button" id="v11PickGoogle">اختيار من Google Maps</button>
      <button type="button" id="v11UseMyLocation">موقعي الآن</button>
    </div>
    <div class="v11-location-selected" id="v11LocationSelected" hidden></div>
    <div class="v11-map-host" id="v11MapHost"></div>`;
  primary.insertAdjacentElement('afterend', locationCard);

  const details = document.createElement('details');
  details.className = 'v11-extra-details';
  details.innerHTML = '<summary>تفاصيل أخرى</summary><div class="v11-extra-body"></div>';
  const body = details.querySelector('.v11-extra-body');
  if (notesField) body.appendChild(notesField);
  if (formGrid) body.appendChild(formGrid);
  actions?.insertAdjacentElement('beforebegin', details);

  populateHijriSelectors();
  bindTaskSheetEvents();

  new MutationObserver(() => {
    if (dialog.open) setTimeout(populateTaskSheet, 0);
  }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
}

function populateHijriSelectors() {
  const day = document.getElementById('v11HijriDay');
  const month = document.getElementById('v11HijriMonth');
  const year = document.getElementById('v11HijriYear');
  if (!day || !month || !year) return;
  day.innerHTML = Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
  month.innerHTML = HIJRI_MONTHS.map((name, i) => `<option value="${i + 1}">${name}</option>`).join('');
  const current = currentHijriYear();
  year.innerHTML = Array.from({ length: 8 }, (_, i) => current - 2 + i).map(y => `<option value="${y}">${y}</option>`).join('');
}

function setDateMode(mode) {
  currentDateMode = mode === 'hijri' ? 'hijri' : 'gregorian';
  document.querySelectorAll('[data-v11-date-mode]').forEach(button => button.classList.toggle('active', button.dataset.v11DateMode === currentDateMode));
  const greg = document.querySelector('.v11-greg-wrap');
  const hijri = document.querySelector('.v11-hijri-wrap');
  if (greg) greg.hidden = currentDateMode !== 'gregorian';
  if (hijri) hijri.hidden = currentDateMode !== 'hijri';
}

function setHijriFromGregorian(iso) {
  const date = dateFromIso(iso);
  if (!date) return;
  const parts = hijriPartsFromDate(date);
  const day = document.getElementById('v11HijriDay');
  const month = document.getElementById('v11HijriMonth');
  const year = document.getElementById('v11HijriYear');
  if (year && ![...year.options].some(option => Number(option.value) === parts.year)) {
    const option = document.createElement('option');
    option.value = String(parts.year); option.textContent = String(parts.year); year.appendChild(option);
  }
  if (day) day.value = String(parts.day);
  if (month) month.value = String(parts.month);
  if (year) year.value = String(parts.year);
}

function updateDualPreview(iso) {
  const preview = document.getElementById('v11DualPreview');
  if (!preview) return;
  if (!iso) {
    preview.innerHTML = '<span><b>ميلادي</b>بدون تاريخ</span><span><b>هجري</b>بدون تاريخ</span>';
    return;
  }
  preview.innerHTML = `<span><b>ميلادي</b>${escapeHtml(formatGregorian(iso))}</span><span><b>الموافق هجري</b>${escapeHtml(formatHijri(iso))}</span>`;
}

function syncHijriToGregorian() {
  const day = document.getElementById('v11HijriDay');
  const month = document.getElementById('v11HijriMonth');
  const year = document.getElementById('v11HijriYear');
  const greg = document.getElementById('v11DueGregorian');
  const coreDue = document.getElementById('taskDue');
  if (!day || !month || !year || !greg || !coreDue) return;
  const iso = hijriToGregorian(year.value, month.value, day.value);
  greg.value = iso;
  coreDue.value = iso;
  updateDualPreview(iso);
}

function bindTaskSheetEvents() {
  document.querySelectorAll('[data-v11-date-mode]').forEach(button => button.addEventListener('click', () => {
    setDateMode(button.dataset.v11DateMode);
    if (currentDateMode === 'hijri') {
      const iso = document.getElementById('v11DueGregorian')?.value;
      if (iso) setHijriFromGregorian(iso);
    }
  }));

  document.getElementById('v11DueGregorian')?.addEventListener('change', event => {
    const iso = event.target.value;
    const coreDue = document.getElementById('taskDue');
    if (coreDue) coreDue.value = iso;
    if (iso) setHijriFromGregorian(iso);
    updateDualPreview(iso);
  });

  ['v11HijriDay','v11HijriMonth','v11HijriYear'].forEach(id => document.getElementById(id)?.addEventListener('change', syncHijriToGregorian));

  document.getElementById('v11LocationText')?.addEventListener('input', event => {
    const value = event.target.value.trim();
    if (!currentPlace || (currentPlace.name !== value && currentPlace.address !== value)) {
      currentPlace = value ? { name: value, address: value, placeId: '', lat: null, lng: null } : null;
      renderSelectedLocation();
    }
  });

  document.getElementById('v11PickGoogle')?.addEventListener('click', async () => {
    const host = document.getElementById('v11MapHost');
    try {
      mapsModulePromise ||= import('./mesraah-maps-v011.js?v=0.11.0');
      await mapsModulePromise;
      if (!window.MesraahMaps?.hasKey?.()) {
        const query = document.getElementById('v11LocationText')?.value.trim() || 'جدة';
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank', 'noopener');
        toast('اكتب اسم المكان في المهمة، والاختيار المباشر يتفعل عند ربط خرائط Google');
        return;
      }
      await window.MesraahMaps.mountAutocomplete(host, {
        onSelect: place => {
          currentPlace = place;
          const input = document.getElementById('v11LocationText');
          if (input) input.value = place.name || place.address || '';
          renderSelectedLocation();
          host.replaceChildren();
        }
      });
    } catch (error) {
      console.error('Mesraah maps:', error);
      toast('تعذر فتح اختيار المكان الآن');
    }
  });

  document.getElementById('v11UseMyLocation')?.addEventListener('click', () => {
    if (!navigator.geolocation) { toast('تحديد الموقع غير متاح على هذا الجهاز'); return; }
    navigator.geolocation.getCurrentPosition(position => {
      currentPlace = {
        name: 'موقعي الحالي', address: 'الموقع الحالي', placeId: '',
        lat: position.coords.latitude, lng: position.coords.longitude
      };
      const input = document.getElementById('v11LocationText');
      if (input) input.value = 'موقعي الحالي';
      renderSelectedLocation();
    }, () => toast('تعذر الوصول إلى موقعك'), { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 });
  });
}

function renderSelectedLocation() {
  const el = document.getElementById('v11LocationSelected');
  if (!el) return;
  if (!currentPlace?.name && !currentPlace?.address) { el.hidden = true; el.innerHTML = ''; return; }
  const label = currentPlace.name || currentPlace.address;
  const address = currentPlace.address && currentPlace.address !== label ? currentPlace.address : '';
  let url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([label, address].filter(Boolean).join('، '))}`;
  if (Number.isFinite(currentPlace.lat) && Number.isFinite(currentPlace.lng)) url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${currentPlace.lat},${currentPlace.lng}`)}`;
  el.hidden = false;
  el.innerHTML = `<span><strong>${escapeHtml(label)}</strong>${address ? escapeHtml(address) : ''}</span><a href="${url}" target="_blank" rel="noopener">فتح الخريطة</a>`;
}

function populateTaskSheet() {
  const id = document.getElementById('taskId')?.value || '';
  const task = id ? getTask(id) : null;
  const due = document.getElementById('taskDue')?.value || '';
  const greg = document.getElementById('v11DueGregorian');
  const time = document.getElementById('v11TaskTime');
  const locationInput = document.getElementById('v11LocationText');
  const mapHost = document.getElementById('v11MapHost');
  if (greg) greg.value = due;
  if (time) time.value = taskTime(task);
  currentPlace = taskLocation(task);
  if (locationInput) locationInput.value = currentPlace?.name || currentPlace?.address || '';
  if (mapHost) mapHost.replaceChildren();
  currentDateMode = task?.dateSource === 'hijri' ? 'hijri' : 'gregorian';
  setDateMode(currentDateMode);
  if (due) setHijriFromGregorian(due);
  updateDualPreview(due);
  renderSelectedLocation();
  const details = document.querySelector('.v11-extra-details');
  if (details) details.open = Boolean(task?.notes || task?.spaceId || task?.personId || task?.follow || (task?.priority && task.priority !== 'normal') || (task?.status && task.status !== 'inbox'));
}

function installTaskSubmitBridge() {
  const form = document.getElementById('taskForm');
  if (!form || form.dataset.v11Submit) return;
  form.dataset.v11Submit = '1';
  form.addEventListener('submit', () => {
    const before = readState();
    const beforeIds = new Set((before.tasks || []).map(task => String(task.id)));
    const taskId = document.getElementById('taskId')?.value || '';
    const title = document.getElementById('taskTitle')?.value.trim() || '';
    const time = document.getElementById('v11TaskTime')?.value || '';
    const location = currentPlace ? { ...currentPlace } : null;
    const dateSource = currentDateMode;

    setTimeout(() => {
      const state = readState();
      let task = taskId ? (state.tasks || []).find(item => String(item.id) === String(taskId)) : null;
      if (!task) {
        task = [...(state.tasks || [])].reverse().find(item => !beforeIds.has(String(item.id)) && (!title || item.title === title));
      }
      if (!task) return;
      task.time = time;
      task.dateSource = dateSource;
      if (location?.name || location?.address) task.location = location;
      else delete task.location;
      writeState(state);
      setTimeout(() => { decorateTasks(); renderNearbyGroups(); }, 30);
    }, 70);
  }, true);
}

function decorateTasks() {
  const state = readState();
  const byId = new Map((state.tasks || []).map(task => [String(task.id), task]));
  document.querySelectorAll('.task-item[data-task]').forEach(item => {
    item.classList.add('v11-task');
    const task = byId.get(String(item.dataset.task));
    if (!task) return;
    item.querySelectorAll('.task-meta .chip').forEach(chip => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(chip.textContent.trim())) chip.style.display = 'none';
    });
    let extra = item.querySelector('.v11-task-extra');
    if (!extra) {
      extra = document.createElement('div'); extra.className = 'v11-task-extra';
      item.querySelector('.task-meta')?.insertAdjacentElement('afterend', extra);
    }
    const parts = [];
    if (task.due) parts.push(`<span class="v11-date-chip"><strong>${escapeHtml(formatGregorian(task.due))}</strong><span>· ${escapeHtml(formatHijri(task.due))}</span></span>`);
    const time = taskTime(task);
    if (time) parts.push(`<span class="v11-time-chip">🕐 ${escapeHtml(time)}</span>`);
    const location = taskLocation(task);
    if (location?.name || location?.address) {
      const label = location.name || location.address;
      parts.push(`<span class="v11-location-chip">📍 <span>${escapeHtml(label)}</span></span>`);
    }
    extra.innerHTML = parts.join('');
  });
}

function installTaskCardClicks() {
  document.addEventListener('click', event => {
    const task = event.target.closest('.task-item[data-task]');
    if (!task) return;
    if (event.target.closest('button,a,input,select,textarea,label')) return;
    task.querySelector('[data-edit]')?.click();
  });
}

function showUndoTask(task) {
  clearTimeout(undoTimer);
  document.querySelector('.v11-undo')?.remove();
  const bar = document.createElement('div');
  bar.className = 'v11-undo';
  bar.innerHTML = `<span>حذفت «${escapeHtml(task.title || 'المهمة')}»</span><button type="button">تراجع</button>`;
  document.body.appendChild(bar);
  bar.querySelector('button').onclick = () => {
    const state = readState();
    if (!(state.tasks || []).some(item => String(item.id) === String(task.id))) state.tasks = [...(state.tasks || []), task];
    writeState(state);
    bar.remove();
    location.reload();
  };
  undoTimer = setTimeout(() => bar.remove(), 6500);
}

function installDeleteUndo() {
  document.addEventListener('click', event => {
    if (!event.target.closest('#deleteTaskBtn')) return;
    const id = document.getElementById('taskId')?.value;
    const task = id ? getTask(id) : null;
    if (!task) return;
    lastDeletedTask = JSON.parse(JSON.stringify(task));
    setTimeout(() => {
      const stillExists = getTask(id);
      if (!stillExists && lastDeletedTask) showUndoTask(lastDeletedTask);
      lastDeletedTask = null;
    }, 100);
  }, true);
}

function ensureSpaceDialog() {
  if (document.getElementById('v11SpaceDialog')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'v11SpaceDialog';
  dialog.className = 'v11-space-dialog';
  dialog.innerHTML = `
    <form method="dialog">
      <h3 id="v11SpaceTitle">إدارة المساحة</h3>
      <p id="v11SpaceInfo"></p>
      <input id="v11SpaceId" type="hidden">
      <input id="v11SpaceName" maxlength="80" aria-label="اسم المساحة">
      <div class="v11-space-actions"><button type="button" class="danger" id="v11DeleteSpace">حذف المساحة</button><div><button value="cancel">إلغاء</button><button type="button" id="v11RenameSpace">حفظ الاسم</button></div></div>
    </form>`;
  document.body.appendChild(dialog);

  document.getElementById('v11RenameSpace').onclick = () => {
    const id = document.getElementById('v11SpaceId').value;
    const name = document.getElementById('v11SpaceName').value.trim();
    if (!name) return;
    const state = readState();
    const space = (state.spaces || []).find(item => String(item.id) === String(id));
    if (!space) return;
    space.name = name;
    writeState(state);
    dialog.close();
    location.reload();
  };

  document.getElementById('v11DeleteSpace').onclick = () => {
    const id = document.getElementById('v11SpaceId').value;
    const state = readState();
    const space = (state.spaces || []).find(item => String(item.id) === String(id));
    if (!space) return;
    const count = (state.tasks || []).filter(task => String(task.spaceId) === String(id) && task.status !== 'done').length;
    if (!window.confirm(count ? `حذف مساحة «${space.name}»؟ سيتم نقل ${count} مهمة إلى الوارد.` : `حذف مساحة «${space.name}»؟`)) return;
    state.tasks = (state.tasks || []).map(task => String(task.spaceId) === String(id) ? { ...task, spaceId: '', status: task.status === 'done' ? 'done' : 'inbox' } : task);
    state.spaces = (state.spaces || []).filter(item => String(item.id) !== String(id));
    writeState(state);
    dialog.close();
    location.reload();
  };
}

function decorateSpaces() {
  ensureSpaceDialog();
  const state = readState();
  document.querySelectorAll('#spaceGrid .space-card').forEach((card, index) => {
    const space = (state.spaces || [])[index];
    if (!space) return;
    card.dataset.v11SpaceId = space.id;
    if (card.querySelector('.v11-space-menu')) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'v11-space-menu'; button.textContent = '•••'; button.setAttribute('aria-label', `إدارة مساحة ${space.name}`);
    button.onclick = event => {
      event.stopPropagation();
      const dialog = document.getElementById('v11SpaceDialog');
      const current = (readState().spaces || []).find(item => String(item.id) === String(space.id));
      if (!current) return;
      const count = (readState().tasks || []).filter(task => String(task.spaceId) === String(space.id) && task.status !== 'done').length;
      document.getElementById('v11SpaceId').value = current.id;
      document.getElementById('v11SpaceName').value = current.name;
      document.getElementById('v11SpaceTitle').textContent = current.name;
      document.getElementById('v11SpaceInfo').textContent = count ? `${count} مهمة مفتوحة داخل هذه المساحة` : 'لا توجد مهام مفتوحة داخل هذه المساحة';
      if (!dialog.open) dialog.showModal();
    };
    card.appendChild(button);
  });
}

function haversine(a, b) {
  const toRad = value => value * Math.PI / 180;
  const earth = 6371000;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(h));
}

function nearbyGroups(tasks, threshold = 2000) {
  const located = tasks.filter(task => {
    const location = taskLocation(task);
    return location && Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng));
  });
  const parent = located.map((_, index) => index);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };
  for (let i = 0; i < located.length; i++) for (let j = i + 1; j < located.length; j++) {
    const a = taskLocation(located[i]), b = taskLocation(located[j]);
    if (haversine(a, b) <= threshold) union(i, j);
  }
  const groups = new Map();
  located.forEach((task, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(task);
  });
  return [...groups.values()].filter(group => group.length >= 2);
}

function renderNearbyGroups() {
  const todayView = document.getElementById('view-today');
  const stats = document.getElementById('todayStats');
  if (!todayView || !stats) return;
  let panel = document.getElementById('v11NearbyPanel');
  const tasks = (readState().tasks || []).filter(task => task.status !== 'done');
  const groups = nearbyGroups(tasks);
  if (!groups.length) { panel?.remove(); return; }
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'v11NearbyPanel'; panel.className = 'panel v11-nearby-panel';
    stats.insertAdjacentElement('afterend', panel);
  }
  panel.innerHTML = `<div class="panel-head"><div><span class="eyebrow">مشاويرك</span><h2>مهام قريبة من بعض</h2></div></div><div class="v11-nearby-groups">${groups.map(group => {
    const base = taskLocation(group[0]);
    return `<article class="v11-nearby-card"><header><h3>📍 مشوار واحد · ${group.length} مهام</h3><small>ضمن نحو 2 كم</small></header><ul>${group.map(task => {
      const location = taskLocation(task); const distance = haversine(base, location);
      return `<li><span>${escapeHtml(task.title)}</span><span>${distance < 80 ? 'نفس الموقع' : distance < 1000 ? `${Math.round(distance)} م` : `${(distance / 1000).toFixed(1)} كم`}</span></li>`;
    }).join('')}</ul></article>`;
  }).join('')}</div>`;
}

function installQuickChips() {
  const form = document.getElementById('quickTaskForm');
  const input = document.getElementById('quickTaskInput');
  if (!form || !input || document.getElementById('v11QuickChips')) return;
  const chips = document.createElement('div'); chips.id = 'v11QuickChips'; chips.className = 'v11-quick-chips'; form.insertAdjacentElement('afterend', chips);
  const render = () => {
    const text = input.value.trim();
    const state = readState();
    const found = [];
    if (/\bاليوم\b/.test(text)) found.push('اليوم');
    if (/بكره|بكرة|غد/.test(text)) found.push('بكرة');
    const weekday = text.match(/الأحد|الاحد|الاثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة|السبت/); if (weekday) found.push(weekday[0]);
    const clock = text.match(/(?:الساعة\s*)?(\d{1,2})(?::(\d{2}))\s*(ص|م)?/); if (clock) found.push(`الوقت ${clock[1]}:${clock[2]}${clock[3] ? ' '+clock[3] : ''}`);
    for (const space of state.spaces || []) if (space.name && text.includes(space.name)) { found.push(space.name); break; }
    chips.innerHTML = found.map(value => `<span>${escapeHtml(value)}</span>`).join('');
  };
  input.addEventListener('input', render);
}

function observeRenders() {
  const targets = ['todayTaskList','inboxList','followupList','spaceGrid'];
  targets.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    new MutationObserver(() => {
      if (id === 'spaceGrid') decorateSpaces(); else decorateTasks();
      renderNearbyGroups();
    }).observe(el, { childList: true, subtree: true });
  });
}

function normalizeVersion() {
  document.documentElement.dataset.mesraahVersion = VERSION;
  document.querySelectorAll('.mesraah-footer-bottom > span').forEach(el => {
    if (/^v\d+\.\d+\.\d+$/.test(el.textContent.trim())) el.textContent = `v${VERSION}`;
  });
}

function boot() {
  installStorageBridge();
  normalizeVersion();
  installVoiceCard();
  installTaskSheet();
  installTaskSubmitBridge();
  installTaskCardClicks();
  installDeleteUndo();
  decorateTasks();
  decorateSpaces();
  renderNearbyGroups();
  installQuickChips();
  observeRenders();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
