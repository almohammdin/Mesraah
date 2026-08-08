const DATA_KEY = 'mesraah_v030';
const RIYADH = 'Asia/Riyadh';
const MODES = ['day', 'month', 'year'];
const MODE_LABELS = { day: 'يومي', month: 'شهري', year: 'سنوي' };
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
let mode = 'day';
let cursor = fromIso(todayIso());
let renderQueued = false;

function readState() {
  try { return JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {}; }
  catch { return {}; }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>\"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[char]));
}

function todayIso() {
  const parts = new Intl.DateTimeFormat('en-u-ca-gregory-nu-latn', {
    timeZone: RIYADH, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).reduce((out, part) => {
    if (part.type !== 'literal') out[part.type] = part.value;
    return out;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function fromIso(iso) { return new Date(`${iso}T12:00:00+03:00`); }
function pad(value) { return String(value).padStart(2, '0'); }
function toIso(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function sameDate(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

function formatDate(date, options) {
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { timeZone: RIYADH, ...options }).format(date).replace(/،/g, '').trim();
}

function taskTime(task) {
  if (task?.time) return String(task.time).slice(0, 5);
  const match = String(task?.notes || '').match(/(?:^|\n)الوقت\s*:\s*([^\n]+)/);
  return match ? match[1].trim() : '';
}

function timeLabel(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 'بدون وقت';
  const hour = Number(match[1]), minute = match[2];
  const suffix = hour < 12 ? 'ص' : 'م';
  const shown = hour % 12 || 12;
  return `${shown}:${minute} ${suffix}`;
}

function tasksForDate(iso) {
  const state = readState();
  return (state.tasks || []).filter(task => {
    if (task.due === iso) return true;
    return iso === todayIso() && !task.due && task.status === 'active';
  }).sort((a, b) => {
    const aTime = taskTime(a), bTime = taskTime(b);
    if (aTime && bTime) return aTime.localeCompare(bTime);
    if (aTime) return -1;
    if (bTime) return 1;
    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  });
}

function taskButton(task, compact = false) {
  const time = taskTime(task);
  const classes = ['calendar-task'];
  if (task.status === 'done') classes.push('is-done');
  if (task.status === 'waiting') classes.push('is-waiting');
  if (['important', 'strategic'].includes(task.priority)) classes.push('is-important');
  return `<button type="button" class="${classes.join(' ')}" data-calendar-task="${escapeHtml(task.id)}" title="تعديل المهمة">
    ${compact ? '' : `<span class="calendar-task-time">${escapeHtml(timeLabel(time))}</span>`}
    <span class="calendar-task-title">${escapeHtml(task.title)}</span>
  </button>`;
}

function headerHtml(title) {
  return `<div class="calendar-toolbar">
    <div class="calendar-modes" role="tablist" aria-label="نوع عرض التقويم">${MODES.map(value => `<button type="button" role="tab" aria-selected="${mode === value}" class="${mode === value ? 'active' : ''}" data-calendar-mode="${value}">${MODE_LABELS[value]}</button>`).join('')}</div>
    <div class="calendar-period"><button type="button" data-calendar-move="prev">السابق</button><strong>${escapeHtml(title)}</strong><button type="button" data-calendar-move="next">التالي</button></div>
    <button type="button" class="calendar-today-button" data-calendar-today>اليوم</button>
  </div>`;
}

function renderDay() {
  const iso = toIso(cursor), tasks = tasksForDate(iso);
  const title = formatDate(cursor, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const scheduled = tasks.filter(task => taskTime(task));
  const unscheduled = tasks.filter(task => !taskTime(task));
  return `${headerHtml(title)}<div class="calendar-day-view">
    ${unscheduled.length ? `<section class="calendar-all-day"><h2>مهام بلا وقت</h2><div>${unscheduled.map(task => taskButton(task, true)).join('')}</div></section>` : ''}
    <section class="calendar-timeline"><h2>جدول اليوم</h2>${scheduled.length ? scheduled.map(task => taskButton(task)).join('') : '<div class="calendar-empty"><strong>لا توجد مهام بوقت محدد</strong><span>أضف وقتا للمهمة حتى تظهر في الخط الزمني.</span></div>'}</section>
  </div>`;
}

function renderMonth() {
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = new Date(year, month, 1, 12), days = new Date(year, month + 1, 0, 12).getDate();
  const title = formatDate(first, { month: 'long', year: 'numeric' });
  const blanks = Array.from({ length: first.getDay() }, () => '<div class="calendar-day is-blank" aria-hidden="true"></div>').join('');
  const cells = Array.from({ length: days }, (_, index) => {
    const date = new Date(year, month, index + 1, 12), iso = toIso(date), tasks = tasksForDate(iso);
    const current = iso === todayIso() ? ' is-today' : '';
    return `<button type="button" class="calendar-day${current}" data-calendar-date="${iso}"><span class="calendar-day-number">${index + 1}</span>${tasks.length ? `<span class="calendar-day-count">${tasks.length} ${tasks.length === 1 ? 'مهمة' : 'مهام'}</span><span class="calendar-day-tasks">${tasks.slice(0, 2).map(task => `<i>${escapeHtml(task.title)}</i>`).join('')}</span>` : '<span class="calendar-day-free">فارغ</span>'}</button>`;
  }).join('');
  return `${headerHtml(title)}<div class="calendar-month-view"><div class="calendar-weekdays">${WEEKDAYS.map(day => `<span>${day}</span>`).join('')}</div><div class="calendar-month-grid">${blanks}${cells}</div></div>`;
}

function renderYear() {
  const year = cursor.getFullYear(), state = readState();
  const activeTasks = (state.tasks || []).filter(task => task.due && String(task.due).startsWith(`${year}-`));
  const months = Array.from({ length: 12 }, (_, month) => {
    const date = new Date(year, month, 1, 12);
    const tasks = activeTasks.filter(task => Number(String(task.due).slice(5, 7)) === month + 1);
    const done = tasks.filter(task => task.status === 'done').length;
    const progress = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    return `<button type="button" class="calendar-year-month" data-calendar-month="${month}"><span>${formatDate(date, { month: 'long' })}</span><strong>${tasks.length}</strong><small>${tasks.length === 1 ? 'مهمة' : 'مهام'}</small><i><b style="width:${progress}%"></b></i></button>`;
  }).join('');
  return `${headerHtml(String(year))}<div class="calendar-year-view">${months}</div>`;
}

function render() {
  const host = document.getElementById('mesraahCalendar');
  if (!host) return;
  host.innerHTML = mode === 'day' ? renderDay() : mode === 'month' ? renderMonth() : renderYear();
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}

function moveCursor(direction) {
  const amount = direction === 'next' ? 1 : -1;
  if (mode === 'day') cursor.setDate(cursor.getDate() + amount);
  if (mode === 'month') cursor.setMonth(cursor.getMonth() + amount, 1);
  if (mode === 'year') cursor.setFullYear(cursor.getFullYear() + amount, 0, 1);
  render();
}

function install() {
  if (window.__MESRAAH_CALENDAR_VIEW__) return;
  window.__MESRAAH_CALENDAR_VIEW__ = true;
  document.addEventListener('click', event => {
    const modeButton = event.target.closest('[data-calendar-mode]');
    if (modeButton) { mode = modeButton.dataset.calendarMode; render(); return; }
    const moveButton = event.target.closest('[data-calendar-move]');
    if (moveButton) { moveCursor(moveButton.dataset.calendarMove); return; }
    if (event.target.closest('[data-calendar-today]')) { cursor = fromIso(todayIso()); render(); return; }
    const dayButton = event.target.closest('[data-calendar-date]');
    if (dayButton) { cursor = fromIso(dayButton.dataset.calendarDate); mode = 'day'; render(); return; }
    const monthButton = event.target.closest('[data-calendar-month]');
    if (monthButton) { cursor = new Date(cursor.getFullYear(), Number(monthButton.dataset.calendarMonth), 1, 12); mode = 'month'; render(); return; }
    if (event.target.closest('[data-view="calendar"]')) queueRender();
  });
  ['todayTaskList', 'inboxList', 'followupList'].forEach(id => {
    const target = document.getElementById(id);
    if (target) new MutationObserver(queueRender).observe(target, { childList: true });
  });
  render();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
