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
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const API = 'https://www.googleapis.com/calendar/v3';
const TIME_ZONE = 'Asia/Riyadh';

const auth = getAuth(getApp());
let token = sessionStorage.getItem(TOKEN_KEY) || '';
let connectedEmail = '';

function emit() {
  window.dispatchEvent(new CustomEvent('mesraah:calendar-status', {
    detail: status()
  }));
}

function status() {
  return {
    connected: Boolean(token),
    email: connectedEmail || auth.currentUser?.email || '',
    cachedEvents: getCachedEvents()
  };
}

function provider() {
  const p = new GoogleAuthProvider();
  p.addScope(SCOPE);
  p.setCustomParameters({ prompt: 'consent', include_granted_scopes: 'true' });
  return p;
}

async function authorize() {
  const p = provider();
  const user = auth.currentUser;
  let result;

  if (!user) {
    result = await signInWithPopup(auth, p);
  } else if (user.providerData.some(item => item.providerId === 'google.com')) {
    result = await reauthenticateWithPopup(user, p);
  } else {
    result = await linkWithPopup(user, p);
  }

  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) throw new Error('calendar-no-access-token');
  token = credential.accessToken;
  connectedEmail = result.user?.email || '';
  sessionStorage.setItem(TOKEN_KEY, token);
  emit();
  return token;
}

async function apiFetch(path, options = {}) {
  if (!token) throw new Error('calendar-not-connected');
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (response.status === 401 || response.status === 403) {
    if (response.status === 401) disconnectSession();
    const body = await response.text().catch(() => '');
    const error = new Error(response.status === 401 ? 'calendar-auth-expired' : 'calendar-api-denied');
    error.status = response.status;
    error.body = body;
    throw error;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error('calendar-api-error');
    error.status = response.status;
    error.body = body;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

function dateIso(date) {
  return date.toISOString();
}

async function listUpcoming({ days = 7, maxResults = 30 } = {}) {
  if (!token) return [];
  const now = new Date();
  const end = new Date(now.getTime() + days * 86400000);
  const qs = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    timeMin: dateIso(now),
    timeMax: dateIso(end),
    maxResults: String(maxResults),
    timeZone: TIME_ZONE
  });
  const data = await apiFetch(`/calendars/primary/events?${qs.toString()}`);
  const events = (data?.items || []).map(item => ({
    id: item.id || '',
    title: item.summary || 'موعد',
    start: item.start?.dateTime || item.start?.date || '',
    end: item.end?.dateTime || item.end?.date || '',
    location: item.location || '',
    htmlLink: item.htmlLink || '',
    status: item.status || ''
  }));
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), events }));
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

async function createEvent({ title, date, time = '', durationMinutes = 60, location = '', description = '' }) {
  if (!title || !date) throw new Error('calendar-event-missing-data');

  let body;
  if (time) {
    const start = toRfc3339(date, time);
    body = {
      summary: title,
      description,
      location,
      start: { dateTime: start, timeZone: TIME_ZONE },
      end: { dateTime: plusMinutes(start, durationMinutes), timeZone: TIME_ZONE }
    };
  } else {
    const start = new Date(`${date}T12:00:00+03:00`);
    const next = new Date(start.getTime() + 86400000);
    const nextDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(next);
    body = {
      summary: title,
      description,
      location,
      start: { date },
      end: { date: nextDate }
    };
  }

  const event = await apiFetch('/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  await listUpcoming().catch(() => {});
  return event;
}

async function connect() {
  await authorize();
  await listUpcoming();
  emit();
  return status();
}

function disconnectSession() {
  token = '';
  connectedEmail = '';
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(CACHE_KEY);
  emit();
}

window.MesraahCalendar = {
  connect,
  disconnectSession,
  listUpcoming,
  createEvent,
  getCachedEvents,
  status
};

emit();
