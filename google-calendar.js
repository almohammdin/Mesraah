import { getApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  linkWithPopup,
  reauthenticateWithPopup
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';

const TOKEN_KEY = 'mesraah_calendar_token_v1';
const CACHE_KEY = 'mesraah_calendar_events_v1';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events.owned';
const API = 'https://www.googleapis.com/calendar/v3';
const TIME_ZONE = 'Asia/Riyadh';

const auth = getAuth(getApp());
let token = sessionStorage.getItem(TOKEN_KEY) || '';
let connectedEmail = '';
let lastError = null;

function emit() {
  window.dispatchEvent(new CustomEvent('mesraah:calendar-status', {
    detail: status()
  }));
}

function status() {
  return {
    connected: Boolean(token && !lastError),
    authorized: Boolean(token),
    email: connectedEmail || auth.currentUser?.email || '',
    cachedEvents: getCachedEvents(),
    lastError: lastError ? {
      code: lastError.code || lastError.message || 'calendar-error',
      status: lastError.status || 0,
      detail: lastError.detail || ''
    } : null
  };
}

function provider() {
  const p = new GoogleAuthProvider();
  p.addScope(SCOPE);
  p.setCustomParameters({ include_granted_scopes: 'true' });
  return p;
}

function oauthError(error) {
  const code = String(error?.code || error?.message || 'calendar-oauth-error');
  const out = new Error(code);
  out.code = code;
  out.status = 0;
  out.detail = String(error?.message || '');
  return out;
}

async function authorize() {
  const p = provider();
  const user = auth.currentUser;
  let result;

  try {
    if (!user) {
      result = await signInWithPopup(auth, p);
    } else if (user.providerData.some(item => item.providerId === 'google.com')) {
      result = await reauthenticateWithPopup(user, p);
    } else {
      result = await linkWithPopup(user, p);
    }
  } catch (error) {
    lastError = oauthError(error);
    emit();
    throw lastError;
  }

  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    lastError = new Error('calendar-no-access-token');
    lastError.code = 'calendar-no-access-token';
    emit();
    throw lastError;
  }

  token = credential.accessToken;
  connectedEmail = result.user?.email || '';
  lastError = null;
  sessionStorage.setItem(TOKEN_KEY, token);
  emit();
  return token;
}

function classifyApiError(response, body = '') {
  let payload = null;
  try { payload = JSON.parse(body); } catch {}

  const reason = String(
    payload?.error?.errors?.[0]?.reason ||
    payload?.error?.status ||
    ''
  );
  const message = String(payload?.error?.message || body || '');
  const haystack = `${reason} ${message}`;

  let code = 'calendar-api-error';
  if (response.status === 401) code = 'calendar-auth-expired';
  else if (response.status === 403 && /accessNotConfigured|SERVICE_DISABLED|has not been used|is disabled|disabled for project/i.test(haystack)) code = 'calendar-api-disabled';
  else if (response.status === 403 && /insufficientPermissions|insufficient permission|PERMISSION_DENIED/i.test(haystack)) code = 'calendar-permission-denied';
  else if (response.status === 403 && /rateLimit|quota|RESOURCE_EXHAUSTED/i.test(haystack)) code = 'calendar-quota';
  else if (response.status === 403) code = 'calendar-api-denied';

  const error = new Error(code);
  error.code = code;
  error.status = response.status;
  error.reason = reason;
  error.detail = message;
  error.body = body;
  return error;
}

async function apiFetch(path, options = {}) {
  if (!token) {
    const error = new Error('calendar-not-connected');
    error.code = 'calendar-not-connected';
    throw error;
  }

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = classifyApiError(response, body);
    lastError = error;
    if (response.status === 401) disconnectSession({ emitNow: false });
    emit();
    throw error;
  }

  lastError = null;
  if (response.status === 204) return null;
  return response.json();
}

function dateIso(date) {
  return date.toISOString();
}

function normalizeEvent(item = {}) {
  return {
    id: item.id || '',
    title: item.summary || 'موعد',
    description: item.description || '',
    start: item.start?.dateTime || item.start?.date || '',
    end: item.end?.dateTime || item.end?.date || '',
    location: item.location || '',
    htmlLink: item.htmlLink || '',
    status: item.status || '',
    updated: item.updated || '',
    extendedProperties: item.extendedProperties || {}
  };
}

async function listUpcoming({ days = 7, pastDays = 0, maxResults = 30 } = {}) {
  if (!token) return [];
  const now = new Date();
  const start = new Date(now.getTime() - Math.max(0, Number(pastDays) || 0) * 86400000);
  const end = new Date(now.getTime() + Math.max(1, Number(days) || 7) * 86400000);
  const qs = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    timeMin: dateIso(start),
    timeMax: dateIso(end),
    maxResults: String(Math.max(1, Math.min(250, Number(maxResults) || 30))),
    timeZone: TIME_ZONE
  });

  const data = await apiFetch(`/calendars/primary/events?${qs.toString()}`);
  const events = (data?.items || []).map(normalizeEvent);
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), events }));
  lastError = null;
  emit();
  return events;
}

function getCachedEvents() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}');
    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    return [];
  }
}

function toRfc3339(date, time = '09:00') {
  const safeTime = /^\d{2}:\d{2}$/.test(time) ? time : '09:00';
  return `${date}T${safeTime}:00+03:00`;
}

function plusMinutes(dateTime, minutes) {
  const d = new Date(dateTime);
  return new Date(d.getTime() + Math.max(15, Number(minutes) || 60) * 60000).toISOString();
}

function nextDate(date) {
  const start = new Date(`${date}T12:00:00+03:00`);
  const next = new Date(start.getTime() + 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(next);
}

function eventBody({ title, date, time = '', durationMinutes = 60, location = '', description = '', mesraahTaskId = '' }) {
  if (!title || !date) throw new Error('calendar-event-missing-data');
  const body = {
    summary: title,
    description,
    location,
    extendedProperties: {
      private: {
        mesraahSource: 'mesraah',
        ...(mesraahTaskId ? { mesraahTaskId: String(mesraahTaskId) } : {})
      }
    }
  };

  if (time) {
    const start = toRfc3339(date, time);
    body.start = { dateTime: start, timeZone: TIME_ZONE };
    body.end = { dateTime: plusMinutes(start, durationMinutes), timeZone: TIME_ZONE };
  } else {
    body.start = { date };
    body.end = { date: nextDate(date) };
  }
  return body;
}

async function createEvent(options) {
  const body = eventBody(options || {});
  const event = await apiFetch('/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  await listUpcoming({ days: 30, pastDays: 1, maxResults: 100 }).catch(() => {});
  return event;
}

async function patchEvent({ eventId, ...options }) {
  if (!eventId) throw new Error('calendar-event-id-missing');
  const body = eventBody(options || {});
  const event = await apiFetch(`/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
  await listUpcoming({ days: 30, pastDays: 1, maxResults: 100 }).catch(() => {});
  return event;
}

async function deleteEvent(eventId) {
  if (!eventId) return false;
  await apiFetch(`/calendars/primary/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
  await listUpcoming({ days: 30, pastDays: 1, maxResults: 100 }).catch(() => {});
  return true;
}

async function connect() {
  lastError = null;
  emit();
  await authorize();
  await listUpcoming({ days: 30, pastDays: 1, maxResults: 100 });
  return status();
}

function disconnectSession({ emitNow = true } = {}) {
  token = '';
  connectedEmail = '';
  lastError = null;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(CACHE_KEY);
  if (emitNow) emit();
}

window.MesraahCalendar = {
  connect,
  disconnectSession,
  listUpcoming,
  createEvent,
  patchEvent,
  deleteEvent,
  getCachedEvents,
  status,
  scope: SCOPE
};

if (token) {
  listUpcoming({ days: 30, pastDays: 1, maxResults: 100 }).catch(() => emit());
} else {
  emit();
}
