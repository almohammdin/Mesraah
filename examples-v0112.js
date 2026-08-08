const DATA_KEY = 'mesraah_v030';
const ACTIVE_UID_KEY = 'mesraah_active_uid_v2';
const DIRTY_PREFIX = 'mesraah_dirty_v2_';
const DEMO_VERSION = 2;
const RELOAD_KEY = 'mesraah_examples_upgrade_v2';

function readState() {
  try { return JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {}; }
  catch { return {}; }
}

function writeState(state) {
  localStorage.setItem(DATA_KEY, JSON.stringify(state || {}));
  const uid = localStorage.getItem(ACTIVE_UID_KEY);
  if (uid) localStorage.setItem(DIRTY_PREFIX + uid, '1');
}

function isoDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

function addDays(base, days) {
  const date = new Date(`${base}T12:00:00+03:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function nextHijri(month, day) {
  const now = new Date();
  for (let i = 0; i <= 500; i += 1) {
    const date = new Date(now.getTime() + i * 86400000);
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      timeZone: 'Asia/Riyadh', month: 'numeric', day: 'numeric'
    }).formatToParts(date).reduce((out, part) => {
      if (part.type !== 'literal') out[part.type] = Number(part.value);
      return out;
    }, {});
    if (parts.month === month && parts.day === day) return isoDate(date);
  }
  return '';
}

function hasDemo(state) {
  return (state.tasks || []).some(item => item.demo) ||
    (state.people || []).some(item => item.demo) ||
    (state.spaces || []).some(item => item.demo);
}

function addIfMissing(list, item) {
  if (!list.some(existing => String(existing.id) === String(item.id))) list.push(item);
}

function upgradeExamples() {
  const state = readState();
  const version = Number(state.demoVersion || 0);
  if (version >= DEMO_VERSION) return false;

  state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
  state.spaces = Array.isArray(state.spaces) ? state.spaces : [];
  state.people = Array.isArray(state.people) ? state.people : [];

  if (!hasDemo(state)) {
    state.demoVersion = DEMO_VERSION;
    writeState(state);
    return false;
  }

  const today = isoDate(new Date());
  const now = new Date().toISOString();
  const ramadan10 = nextHijri(9, 10);

  addIfMissing(state.spaces, { id: 'demo-travel-space', name: 'السفر', demo: true });
  addIfMissing(state.spaces, { id: 'demo-errands-space', name: 'المشاوير', demo: true });

  addIfMissing(state.people, { id: 'demo-client', name: 'العميل', relation: 'عميل', demo: true });

  const examples = [
    {
      id: 'demo-v2-inbox', title: 'فكرة: تطوير العرض القادم', notes: 'مثال لمهمة سريعة بلا موعد',
      spaceId: 'work', personId: '', status: 'inbox', priority: 'normal', due: '', follow: '', points: 5,
      createdAt: now, demo: true
    },
    {
      id: 'demo-v2-meeting', title: 'اجتماع مراجعة العرض مع العميل', notes: 'مثال لموعد بوقت وشخص مرتبط',
      spaceId: 'work', personId: 'demo-client', status: 'active', priority: 'important', due: today, follow: '', points: 20,
      time: '11:30', dateSource: 'gregorian', createdAt: now, demo: true
    },
    {
      id: 'demo-v2-trip', title: 'رحلة عمل إلى الرياض', notes: 'مثال لمهمة سفر مرتبطة بمكان ووقت',
      spaceId: 'demo-travel-space', personId: '', status: 'active', priority: 'strategic', due: addDays(today, 14), follow: '', points: 30,
      time: '08:00', dateSource: 'gregorian',
      location: { name: 'مطار الملك عبدالعزيز الدولي', address: 'جدة', placeId: '', lat: null, lng: null },
      createdAt: now, demo: true
    },
    {
      id: 'demo-v2-errand', title: 'استلام طلب أثناء المشوار', notes: 'مثال لمهمة مرتبطة بموقع',
      spaceId: 'demo-errands-space', personId: '', status: 'active', priority: 'normal', due: addDays(today, 1), follow: '', points: 10,
      time: '17:00', dateSource: 'gregorian',
      location: { name: 'رد سي مول', address: 'جدة', placeId: '', lat: null, lng: null },
      createdAt: now, demo: true
    },
    {
      id: 'demo-v2-hijri', title: 'مناسبة عائلية في 10 رمضان', notes: 'مثال لتاريخ أدخل بالهجري ويعرض معه الميلادي',
      spaceId: 'family', personId: '', status: 'active', priority: 'important', due: ramadan10, follow: '', points: 20,
      dateSource: 'hijri', createdAt: now, demo: true
    },
    {
      id: 'demo-v2-waiting', title: 'متابعة عرض السعر بعد إرسال العميل', notes: 'مثال لمتابعة مستقلة عن موعد المهمة',
      spaceId: 'work', personId: 'demo-client', status: 'waiting', priority: 'important', due: addDays(today, -1), follow: addDays(today, 2), points: 20,
      createdAt: now, demo: true
    },
    {
      id: 'demo-v2-done', title: 'إنهاء مهمة سابقة', notes: 'مثال يظهر في سجل الإنجاز',
      spaceId: 'personal', personId: '', status: 'done', priority: 'normal', due: today, follow: '', points: 10,
      completedAt: now, createdAt: now, demo: true
    }
  ];

  examples.forEach(item => addIfMissing(state.tasks, item));
  state.demoVersion = DEMO_VERSION;
  writeState(state);
  return true;
}

function demoCounts() {
  const state = readState();
  return {
    tasks: (state.tasks || []).filter(item => item.demo).length,
    people: (state.people || []).filter(item => item.demo).length,
    spaces: (state.spaces || []).filter(item => item.demo).length
  };
}

function decorateExamplesCard() {
  const card = document.getElementById('v80ExamplesCard');
  const button = document.getElementById('clearExamplesBtn');
  if (!card || !button) return;
  card.classList.add('v112-examples-card');
  const paragraph = card.querySelector('.v80-examples-copy p');
  if (paragraph) paragraph.textContent = 'أمثلة متنوعة تساعدك تعرف طريقة المهام والمواعيد والمتابعات والمساحات قبل ما تبدأ ببياناتك.';
  if (!card.querySelector('.v112-example-types')) {
    const types = document.createElement('div');
    types.className = 'v112-example-types';
    types.innerHTML = '<span>مهمة سريعة</span><span>موعد ووقت</span><span>هجري وميلادي</span><span>متابعة</span><span>شخص</span><span>سفر</span><span>موقع</span><span>إنجاز</span>';
    paragraph?.insertAdjacentElement('afterend', types);
  }
  const counts = demoCounts();
  let note = card.querySelector('.v112-example-count');
  if (!note) {
    note = document.createElement('small');
    note.className = 'v112-example-count';
    card.querySelector('.v80-examples-copy')?.appendChild(note);
  }
  note.textContent = `${counts.tasks} مهمة تجريبية · ${counts.people} أشخاص · ${counts.spaces} مساحات تجريبية`;
  button.textContent = 'حذف الأمثلة الجاهزة';
  button.classList.add('v112-delete-examples');
  button.setAttribute('aria-label', 'حذف جميع الأمثلة الجاهزة فقط');
}

function ensureConfirmDialog() {
  let dialog = document.getElementById('v112ClearExamplesDialog');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'v112ClearExamplesDialog';
  dialog.className = 'v112-confirm-dialog';
  dialog.innerHTML = `
    <form method="dialog">
      <div class="v112-confirm-head"><div><span>الأمثلة الجاهزة</span><h3>حذف الأمثلة؟</h3></div><button value="cancel" aria-label="إغلاق">×</button></div>
      <p id="v112ClearExamplesText"></p>
      <div class="v112-confirm-note">سيتم حذف العناصر التجريبية فقط، وتبقى بياناتك التي أضفتها.</div>
      <div class="v112-confirm-actions"><button value="cancel">إلغاء</button><button type="button" class="danger" id="v112ConfirmClearExamples">حذف الأمثلة</button></div>
    </form>`;
  document.body.appendChild(dialog);
  return dialog;
}

function clearExamples() {
  const state = readState();
  state.tasks = (state.tasks || []).filter(task => !task.demo);
  state.people = (state.people || []).filter(person => !person.demo);
  const used = new Set(state.tasks.map(task => task.spaceId).filter(Boolean));
  state.spaces = (state.spaces || []).filter(space => !space.demo || used.has(space.id));
  state.demoVersion = DEMO_VERSION;
  writeState(state);
  sessionStorage.removeItem(RELOAD_KEY);
  location.reload();
}

function installClearFlow() {
  const button = document.getElementById('clearExamplesBtn');
  if (!button || button.dataset.v112Clear) return;
  button.dataset.v112Clear = '1';
  ensureConfirmDialog();

  document.addEventListener('click', event => {
    const target = event.target.closest('#clearExamplesBtn');
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const counts = demoCounts();
    const text = document.getElementById('v112ClearExamplesText');
    if (text) text.textContent = `سيتم حذف ${counts.tasks} مهمة تجريبية و${counts.people} أشخاص و${counts.spaces} مساحات تجريبية.`;
    const dialog = ensureConfirmDialog();
    if (!dialog.open) dialog.showModal();
  }, true);

  document.getElementById('v112ConfirmClearExamples')?.addEventListener('click', () => clearExamples());
}

function boot() {
  const upgraded = upgradeExamples();
  if (upgraded && sessionStorage.getItem(RELOAD_KEY) !== '1') {
    sessionStorage.setItem(RELOAD_KEY, '1');
    location.reload();
    return;
  }
  sessionStorage.removeItem(RELOAD_KEY);
  decorateExamplesCard();
  installClearFlow();
  setTimeout(() => { decorateExamplesCard(); installClearFlow(); }, 500);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
