const DATA_KEY = 'mesraah_v030';
const CAL_FIELDS = [
  'calendarEventId', 'calendarSource', 'calendarDirty', 'calendarSyncedAt',
  'calendarEventUpdated', 'calendarHtmlLink'
];

function readState() {
  try { return JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {}; }
  catch { return {}; }
}

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function taskTime(task = {}) {
  if (task.time) return String(task.time);
  const match = String(task.notes || '').match(/(?:^|\n)الوقت\s*:\s*([^\n]+)/);
  const value = match?.[1]?.trim() || '';
  return /^\d{2}:\d{2}$/.test(value) ? value : '';
}

function fingerprint(task = {}) {
  const title = normalizeText(task.title || '');
  const date = String(task.due || '');
  const time = taskTime(task);
  return title && date ? `${title}|${date}|${time}` : '';
}

function imported(task = {}) {
  return String(task.id || '').startsWith('gcal-');
}

function copyCalendar(from, to) {
  CAL_FIELDS.forEach(field => {
    if (from[field] !== undefined) to[field] = from[field];
  });
}

function repair() {
  const state = readState();
  state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const groups = new Map();
  for (const task of state.tasks) {
    const fp = fingerprint(task);
    if (!fp) continue;
    if (!groups.has(fp)) groups.set(fp, []);
    groups.get(fp).push(task);
  }

  const removeIds = new Set();
  const tombstones = new Set(state.calendarTombstones || []);
  let merged = 0;

  for (const group of groups.values()) {
    const originals = group.filter(task => !imported(task));
    const imports = group.filter(imported);
    if (originals.length !== 1 || !imports.length) continue;

    const canonical = originals[0];
    const external = imports.find(task => task.calendarSource === 'google' && task.calendarEventId);
    const best = external || imports.find(task => task.calendarEventId) || imports[0];

    if (external) {
      if (
        canonical.calendarEventId && canonical.calendarSource === 'mesraah'
        && String(canonical.calendarEventId) !== String(external.calendarEventId)
      ) {
        tombstones.add(canonical.calendarEventId);
      }
      copyCalendar(external, canonical);
      canonical.calendarSource = 'google';
    } else if (!canonical.calendarEventId && best?.calendarEventId) {
      copyCalendar(best, canonical);
    }

    if (!canonical.notes && best?.notes) canonical.notes = best.notes;
    if (!canonical.location && best?.location) canonical.location = best.location;

    for (const item of imports) {
      if (
        item.calendarEventId && item.calendarSource === 'mesraah'
        && String(item.calendarEventId) !== String(canonical.calendarEventId)
      ) {
        tombstones.add(item.calendarEventId);
      }
      removeIds.add(String(item.id));
      merged += 1;
    }
  }

  if (!merged && !tombstones.size) return { merged: 0 };
  state.tasks = state.tasks.filter(task => !removeIds.has(String(task.id)));
  state.calendarTombstones = [...tombstones].filter(Boolean);
  localStorage.setItem(DATA_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('mesraah:calendar-data-changed'));
  window.dispatchEvent(new CustomEvent('mesraah:data-changed', {
    detail: { type: 'calendar-dedupe-repair', merged }
  }));
  setTimeout(() => window.MesraahCloudBridge?.saveNow?.().catch?.(() => {}), 100);
  return { merged };
}

window.MesraahCalendarDedupeRepair = { repair };
repair();
