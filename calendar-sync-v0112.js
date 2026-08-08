const DATA_KEY = 'mesraah_v030';
const ACTIVE_UID_KEY = 'mesraah_active_uid_v2';
const DIRTY_PREFIX = 'mesraah_dirty_v2_';
const SUMMARY_KEY = 'mesraah_calendar_sync_summary_v2';
const AUTO_KEY = 'mesraah_calendar_auto_sync_v2';
const CAL_FIELDS = [
  'calendarEventId','calendarSource','calendarDirty','calendarSyncedAt',
  'calendarEventUpdated','calendarHtmlLink'
];

let syncing = false;
let storageBridgeInstalled = false;

function readState() {
  try { return JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {}; }
  catch { return {}; }
}

function markCloudDirty() {
  const uid = localStorage.getItem(ACTIVE_UID_KEY);
  if (uid) localStorage.setItem(DIRTY_PREFIX + uid, '1');
}

function writeState(state) {
  localStorage.setItem(DATA_KEY, JSON.stringify(state || {}));
  markCloudDirty();
}

function installStorageBridge() {
  if (storageBridgeInstalled || window.__MESRAAH_CALENDAR_STORAGE_BRIDGE__) return;
  storageBridgeInstalled = true;
  window.__MESRAAH_CALENDAR_STORAGE_BRIDGE__ = true;
  const previousSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage && key === DATA_KEY) {
      try {
        const previous = JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {};
        const next = JSON.parse(String(value || '{}')) || {};
        const oldTasks = new Map((previous.tasks || []).map(task => [String(task.id), task]));
        next.tasks = (next.tasks || []).map(task => {
          const old = oldTasks.get(String(task.id));
          if (!old) return task;
          const merged = { ...task };
          CAL_FIELDS.forEach(field => {
            if (!(field in merged) && field in old) merged[field] = old[field];
          });
          return merged;
        });
        if (!('calendarTombstones' in next) && Array.isArray(previous.calendarTombstones)) {
          next.calendarTombstones = previous.calendarTombstones;
        }
        value = JSON.stringify(next);
      } catch {}
    }
    return previousSetItem.call(this, key, value);
  };
}

function connected() {
  return Boolean(window.MesraahCalendar?.status?.().connected);
}

function taskTime(task = {}) {
  if (task.time) return String(task.time);
  const match = String(task.notes || '').match(/(?:^|\n)الوقت\s*:\s*([^\n]+)/);
  const value = match?.[1]?.trim() || '';
  return /^\d{2}:\d{2}$/.test(value) ? value : '';
}

function taskLocation(task = {}) {
  if (task.location && typeof task.location === 'object') {
    return task.location.name || task.location.address || '';
  }
  const match = String(task.notes || '').match(/(?:^|\n)المكان\s*:\s*([^\n]+)/);
  return match?.[1]?.trim() || '';
}

function datePartsFromEvent(start = '') {
  const value = String(start || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { date: value, time: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).reduce((out, part) => {
    if (part.type !== 'literal') out[part.type] = part.value;
    return out;
  }, {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function sameValue(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function taskCalendarPayload(task) {
  return {
    title: task.title || 'مهمة',
    date: task.due || '',
    time: taskTime(task),
    durationMinutes: 60,
    location: taskLocation(task),
    description: task.notes || '',
    mesraahTaskId: String(task.id || '')
  };
}

function taskNeedsCalendar(task) {
  return Boolean(task && !task.demo && task.status !== 'done' && task.due);
}

function updateTaskCalendarMeta(taskId, values = {}) {
  const state = readState();
  const task = (state.tasks || []).find(item => String(item.id) === String(taskId));
  if (!task) return null;
  Object.assign(task, values);
  writeState(state);
  return task;
}

async function pushTask(task) {
  if (!connected() || !taskNeedsCalendar(task)) return { ok: false, skipped: true };
  const api = window.MesraahCalendar;
  const payload = taskCalendarPayload(task);
  let event;

  if (task.calendarEventId) {
    try {
      event = await api.patchEvent({ eventId: task.calendarEventId, ...payload });
    } catch (error) {
      if (Number(error?.status) !== 404) throw error;
      event = await api.createEvent(payload);
    }
  } else {
    event = await api.createEvent(payload);
  }

  updateTaskCalendarMeta(task.id, {
    calendarEventId: event?.id || task.calendarEventId || '',
    calendarSource: task.calendarSource || 'mesraah',
    calendarDirty: false,
    calendarSyncedAt: new Date().toISOString(),
    calendarEventUpdated: event?.updated || '',
    calendarHtmlLink: event?.htmlLink || task.calendarHtmlLink || ''
  });
  return { ok: true, event };
}

function eventToTaskFields(event) {
  const when = datePartsFromEvent(event.start);
  const location = event.location
    ? { name: event.location, address: event.location, placeId: '', lat: null, lng: null }
    : null;
  return {
    title: event.title || 'موعد',
    notes: event.description || '',
    due: when.date,
    time: when.time,
    location,
    calendarEventId: event.id || '',
    calendarSource: event.extendedProperties?.private?.mesraahSource === 'mesraah' ? 'mesraah' : 'google',
    calendarDirty: false,
    calendarSyncedAt: new Date().toISOString(),
    calendarEventUpdated: event.updated || '',
    calendarHtmlLink: event.htmlLink || ''
  };
}

function pullEvents(events, dirtyIds) {
  const state = readState();
  state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const byId = new Map(state.tasks.map(task => [String(task.id), task]));
  const byEvent = new Map(state.tasks.filter(task => task.calendarEventId).map(task => [String(task.calendarEventId), task]));
  let imported = 0;
  let updated = 0;
  let changed = false;

  for (const event of events || []) {
    if (!event?.id || event.status === 'cancelled') continue;
    const privateTaskId = String(event.extendedProperties?.private?.mesraahTaskId || '');
    let task = privateTaskId ? byId.get(privateTaskId) : null;
    if (!task) task = byEvent.get(String(event.id));

    if (task && dirtyIds.has(String(task.id))) {
      if (!task.calendarEventId) {
        task.calendarEventId = event.id;
        changed = true;
      }
      continue;
    }

    const fields = eventToTaskFields(event);
    if (task) {
      const next = {
        ...task,
        ...fields,
        status: task.status === 'done' ? 'done' : (task.status || 'active'),
        spaceId: task.spaceId || '', personId: task.personId || '',
        priority: task.priority || 'normal', points: Number(task.points) || 10
      };
      const relevant = ['title','notes','due','time','location','calendarEventId','calendarSource','calendarEventUpdated','calendarHtmlLink'];
      if (relevant.some(key => !sameValue(task[key], next[key]))) {
        Object.assign(task, next);
        updated += 1;
        changed = true;
      } else {
        task.calendarDirty = false;
        task.calendarSyncedAt = new Date().toISOString();
      }
    } else {
      const id = privateTaskId || `gcal-${String(event.id).slice(0, 90)}`;
      task = {
        id,
        ...fields,
        spaceId: '', personId: '', status: 'active', priority: 'normal',
        follow: '', points: 10, createdAt: new Date().toISOString()
      };
      state.tasks.push(task);
      byId.set(String(id), task);
      byEvent.set(String(event.id), task);
      imported += 1;
      changed = true;
    }
  }

  if (changed) writeState(state);
  return { imported, updated, changed };
}

async function processTombstones() {
  const state = readState();
  const tombstones = Array.isArray(state.calendarTombstones) ? [...new Set(state.calendarTombstones.filter(Boolean))] : [];
  if (!tombstones.length || !connected()) return 0;
  const remaining = [];
  let deleted = 0;
  for (const eventId of tombstones) {
    try {
      await window.MesraahCalendar.deleteEvent(eventId);
      deleted += 1;
    } catch (error) {
      if (Number(error?.status) === 404) deleted += 1;
      else remaining.push(eventId);
    }
  }
  state.calendarTombstones = remaining;
  writeState(state);
  return deleted;
}

function storeSummary(summary) {
  sessionStorage.setItem(SUMMARY_KEY, JSON.stringify({ ...summary, at: Date.now() }));
  window.dispatchEvent(new CustomEvent('mesraah:calendar-sync', { detail: summary }));
}

function getSummary() {
  try { return JSON.parse(sessionStorage.getItem(SUMMARY_KEY) || '{}') || {}; }
  catch { return {}; }
}

async function syncNow({ silent = false } = {}) {
  if (syncing) return { ok: false, busy: true };
  if (!connected()) return { ok: false, notConnected: true };
  syncing = true;
  window.dispatchEvent(new CustomEvent('mesraah:calendar-sync-start'));

  try {
    const deleted = await processTombstones();
    const before = readState();
    const dirtyIds = new Set((before.tasks || []).filter(task => task.calendarDirty).map(task => String(task.id)));
    const events = await window.MesraahCalendar.listUpcoming({ days: 60, pastDays: 7, maxResults: 200 });
    const pulled = pullEvents(events, dirtyIds);

    const current = readState();
    const toPush = (current.tasks || []).filter(task => taskNeedsCalendar(task) && (task.calendarDirty || !task.calendarEventId));
    let pushed = 0;
    for (const task of toPush.slice(0, 100)) {
      try {
        const result = await pushTask(task);
        if (result.ok) pushed += 1;
      } catch (error) {
        console.error('Mesraah calendar task sync:', error);
      }
    }

    await window.MesraahCalendar.listUpcoming({ days: 60, pastDays: 7, maxResults: 200 }).catch(() => {});
    const summary = { ok: true, imported: pulled.imported, updated: pulled.updated, pushed, deleted };
    storeSummary(summary);

    if (pulled.changed && !silent) setTimeout(() => location.reload(), 260);
    return summary;
  } finally {
    syncing = false;
  }
}

function queueDeletion(task) {
  if (!task?.calendarEventId) return;
  setTimeout(async () => {
    const state = readState();
    const stillThere = (state.tasks || []).some(item => String(item.id) === String(task.id));
    if (stillThere) return;
    if (connected()) {
      try { await window.MesraahCalendar.deleteEvent(task.calendarEventId); return; }
      catch (error) { if (Number(error?.status) === 404) return; }
    }
    const fresh = readState();
    fresh.calendarTombstones = [...new Set([...(fresh.calendarTombstones || []), task.calendarEventId])];
    writeState(fresh);
  }, 140);
}

function installTaskHooks() {
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!form || !['taskForm','quickTaskForm'].includes(form.id)) return;
    const before = readState();
    const idBefore = form.id === 'taskForm' ? (document.getElementById('taskId')?.value || '') : '';
    const title = form.id === 'taskForm'
      ? (document.getElementById('taskTitle')?.value.trim() || '')
      : (document.getElementById('quickTaskInput')?.value.trim() || '');
    const oldTask = idBefore ? (before.tasks || []).find(task => String(task.id) === String(idBefore)) : null;
    const oldIds = new Set((before.tasks || []).map(task => String(task.id)));

    setTimeout(async () => {
      const state = readState();
      let task = idBefore ? (state.tasks || []).find(item => String(item.id) === String(idBefore)) : null;
      if (!task) {
        task = [...(state.tasks || [])].reverse().find(item => !oldIds.has(String(item.id)) && (!title || item.title === title));
      }
      if (!task || task.demo) return;

      if (!task.due && oldTask?.calendarEventId) {
        task.calendarEventId = '';
        task.calendarDirty = false;
        task.calendarSyncedAt = new Date().toISOString();
        state.calendarTombstones = [...new Set([...(state.calendarTombstones || []), oldTask.calendarEventId])];
        writeState(state);
        if (connected()) void processTombstones();
        return;
      }

      if (!task.due) return;
      task.calendarDirty = true;
      writeState(state);
      if (connected()) {
        try { await pushTask(task); }
        catch (error) { console.error('Mesraah calendar save sync:', error); }
      }
    }, 160);
  }, true);

  document.addEventListener('click', event => {
    const button = event.target.closest('#deleteTaskBtn');
    if (!button) return;
    const id = document.getElementById('taskId')?.value || '';
    const task = (readState().tasks || []).find(item => String(item.id) === String(id));
    if (task) queueDeletion(JSON.parse(JSON.stringify(task)));
  }, true);
}

function installCalendarUi() {
  const findCard = () => [...document.querySelectorAll('.connection-card')].find(card => card.textContent.includes('Google Calendar') || card.textContent.includes('التقويم'));
  const decorate = () => {
    const card = findCard();
    const connectButton = document.getElementById('v80CalendarConnect');
    if (!card || !connectButton || document.getElementById('v112CalendarSync')) return;
    const actions = document.createElement('div');
    actions.className = 'v112-calendar-actions';
    connectButton.insertAdjacentElement('beforebegin', actions);
    actions.appendChild(connectButton);
    const sync = document.createElement('button');
    sync.type = 'button';
    sync.id = 'v112CalendarSync';
    sync.textContent = 'مزامنة الآن';
    sync.hidden = !connected();
    actions.appendChild(sync);
    sync.onclick = async () => {
      sync.disabled = true;
      sync.textContent = 'جار المزامنة…';
      try {
        const result = await syncNow();
        showSummary(result);
      } finally {
        sync.disabled = false;
        sync.textContent = 'مزامنة الآن';
      }
    };
    showSummary(getSummary());
  };

  const showSummary = summary => {
    const sync = document.getElementById('v112CalendarSync');
    if (sync) sync.hidden = !connected();
    const status = document.getElementById('v80CalendarStatus');
    if (!status || !summary?.ok) return;
    const fromGoogle = Number(summary.imported || 0) + Number(summary.updated || 0);
    const toGoogle = Number(summary.pushed || 0);
    if (!fromGoogle && !toGoogle && !summary.deleted) status.textContent = 'المواعيد متزامنة بين مسراح وGoogle Calendar';
    else status.textContent = `Google ← ${toGoogle} من مسراح · مسراح ← ${fromGoogle} من Google`;
  };

  window.addEventListener('mesraah:calendar-status', () => {
    decorate();
    const sync = document.getElementById('v112CalendarSync');
    if (sync) sync.hidden = !connected();
    if (!connected()) return;
    const last = Number(sessionStorage.getItem(AUTO_KEY) || 0);
    if (Date.now() - last < 60000) return;
    sessionStorage.setItem(AUTO_KEY, String(Date.now()));
    void syncNow({ silent: false });
  });
  window.addEventListener('mesraah:calendar-sync', event => showSummary(event.detail));
  decorate();
  setTimeout(decorate, 500);
}

function boot() {
  installStorageBridge();
  installTaskHooks();
  installCalendarUi();
  if (connected()) {
    const last = Number(sessionStorage.getItem(AUTO_KEY) || 0);
    if (Date.now() - last >= 60000) {
      sessionStorage.setItem(AUTO_KEY, String(Date.now()));
      void syncNow({ silent: false });
    }
  }
}

window.MesraahCalendarSync = { syncNow, pushTask, getSummary };

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
