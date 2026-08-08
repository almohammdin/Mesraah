import { getApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  AIError,
  getAI,
  getGenerativeModel,
  getLiveGenerativeModel,
  GoogleAIBackend,
  ResponseModality,
  startAudioConversation
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-ai.js';

const DATA_KEY = 'mesraah_v030';
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const PROBE_MODEL = 'gemini-3.5-flash-lite';

const firebaseApp = getApp();
const liveAI = getAI(firebaseApp, {
  backend: new GoogleAIBackend(),
  useLimitedUseAppCheckTokens: true
});

let session = null;
let controller = null;
let preparing = false;
let readyTimer = null;
let activeModel = '';
let lastError = null;
let lastGatewayProbe = '';
let lastTransport = null;

function stateContext() {
  try {
    const state = JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {};
    const tasks = (state.tasks || [])
      .filter(task => task.status !== 'done')
      .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
      .slice(0, 25)
      .map(task => ({
        title: task.title,
        due: task.due || '',
        follow: task.follow || '',
        status: task.status || '',
        priority: task.priority || '',
        spaceId: task.spaceId || '',
        personId: task.personId || ''
      }));
    const people = (state.people || []).slice(0, 30).map(person => ({
      name: person.name,
      relation: person.relation || '',
      city: person.city || '',
      organization: person.organization || '',
      note: person.note || ''
    }));
    const calendar = window.MesraahCalendar?.getCachedEvents?.().slice(0, 20) || [];
    return { name: state.profile?.name || '', tasks, people, calendar };
  } catch {
    return { tasks: [], people: [], calendar: [] };
  }
}

function contextMessage() {
  const context = stateContext();
  return `أنت مسراح، مساعد شخصي سعودي صوتي. تحدث بالعربية السعودية الطبيعية وبجمل قصيرة مناسبة لشخص يقود السيارة.
اعتمد على بيانات مسراح التالية فقط، واربط بينها عندما يكون الارتباط حقيقيا ومفيدا. لا تخترع موعدا أو مدينة أو علاقة.
إذا سألك المستخدم عن يومه، لخص مهامه ومواعيده ورتب الأهم. إذا ذكر رغبة مثل زيارة شخص، تفاعل معه طبيعيا واقترح وقتا أو خطوة مناسبة إذا كانت البيانات تساعد. اطلب التأكيد قبل أي إجراء.

بيانات مسراح الحالية:
${JSON.stringify(context)}`;
}

function ensureUi() {
  if (document.getElementById('v80VoiceOverlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'v80VoiceOverlay';
  overlay.className = 'v80-voice-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="v80-voice-card" role="dialog" aria-modal="true" aria-label="محادثة صوتية مع مسراح">
      <div class="v80-voice-top">
        <div><span class="v80-voice-kicker">محادثة صوتية</span><strong>تحدث مع مسراح</strong></div>
        <button type="button" id="v80VoiceClose" aria-label="إغلاق">×</button>
      </div>
      <div class="v80-voice-orb"><span></span><span></span><span></span></div>
      <div class="v80-voice-status" id="v80VoiceStatus" role="status" aria-live="polite">جاهز</div>
      <p id="v80VoiceHint">اسأله عن يومك ومهامك ومواعيدك وأنت على الطريق.</p>
      <button type="button" class="v80-voice-go" id="v80VoiceGo" hidden>ابدأ المحادثة</button>
      <button type="button" class="v80-voice-stop" id="v80VoiceStop">إنهاء</button>
    </section>`;
  document.body.appendChild(overlay);
  document.getElementById('v80VoiceClose').onclick = stop;
  document.getElementById('v80VoiceStop').onclick = stop;
  document.getElementById('v80VoiceGo').onclick = startNow;
}

function setStatus(text, state = '', hint = '') {
  const el = document.getElementById('v80VoiceStatus');
  if (el) el.textContent = text;
  const overlay = document.getElementById('v80VoiceOverlay');
  if (overlay) overlay.dataset.state = state;
  if (hint) {
    const hintEl = document.getElementById('v80VoiceHint');
    if (hintEl) hintEl.textContent = hint;
  }
}

function setGoVisible(visible, text = 'ابدأ المحادثة') {
  const button = document.getElementById('v80VoiceGo');
  if (!button) return;
  button.hidden = !visible;
  button.disabled = false;
  button.textContent = text;
  if (visible) setTimeout(() => button.focus({ preventScroll: true }), 0);
}

function environmentIssue() {
  if (!window.isSecureContext) return 'افتح مسراح من اتصال HTTPS آمن';
  if (!navigator.mediaDevices?.getUserMedia) return 'المتصفح الحالي لا يدعم تشغيل المايك بهذه الطريقة';
  if (!window.WebSocket) return 'المتصفح الحالي لا يدعم الاتصال الصوتي المباشر';
  if (!(window.AudioContext || window.webkitAudioContext)) return 'المتصفح الحالي لا يدعم الصوت المباشر';
  return '';
}

function errorCode(error) {
  return String(error?.code || error?.name || 'unknown').replace(/^ai\//, '');
}

function diagnostic(error) {
  const code = errorCode(error);
  const message = String(error?.message || '').replace(/\s+/g, ' ').trim();
  return `${code}${message ? ` • ${message.slice(0, 220)}` : ''}`;
}

function friendlyError(error, phase = 'connect') {
  const code = errorCode(error);
  const name = String(error?.name || '');
  if (name === 'NotAllowedError') return 'اسمح لمسراح باستخدام المايك ثم اضغط ابدأ مرة ثانية';
  if (name === 'NotFoundError') return 'لم أجد مايك متاح على هذا الجهاز';
  if (name === 'NotReadableError') return 'المايك مستخدم من برنامج آخر أو غير متاح حاليا';
  if (name === 'AbortError') return 'تعذر بدء المايك، جرب مرة ثانية';
  if (error instanceof AIError || code) {
    if (code.includes('api-not-enabled')) return 'خدمة Firebase AI Logic تحتاج تفعيلها للمشروع';
    if (code.includes('unsupported')) return 'المتصفح الحالي لا يدعم متطلبات المحادثة الصوتية';
    if (code.includes('no-model')) return 'موديل المحادثة الصوتية غير متاح للمشروع حاليا';
    if (code.includes('fetch-error')) return 'تعذر الوصول إلى خدمة المحادثة الصوتية';
    if (code.includes('session-closed')) return 'انتهت جلسة الصوت؛ جهز اتصالا جديدا';
    if (code.includes('request-error')) return phase === 'audio' ? 'تعذر بدء الصوت من المتصفح' : 'رفضت الخدمة إنشاء جلسة الصوت';
    if (code.includes('response-error')) return 'تعذر إكمال مصافحة الاتصال الصوتي';
  }
  return phase === 'audio' ? 'تعذر بدء المايك أو تشغيل الصوت' : 'تعذر الاتصال بالمحادثة الصوتية';
}

async function runGatewayProbe() {
  const probe = getGenerativeModel(liveAI, {
    model: PROBE_MODEL,
    generationConfig: { maxOutputTokens: 8, temperature: 0 }
  });
  const response = await probe.generateContent('أجب بكلمة OK فقط');
  const text = response?.response?.text?.()?.trim() || '';
  if (!text) throw new Error('gateway-probe-empty');
  return `نجح (${PROBE_MODEL})`;
}

function installWebSocketCapture() {
  const NativeWebSocket = window.WebSocket;
  const capture = {
    host: '',
    firstMessage: '',
    closeCode: '',
    closeReason: ''
  };

  class DiagnosticWebSocket extends NativeWebSocket {
    constructor(url, protocols) {
      super(url, protocols);
      try { capture.host = new URL(String(url)).host; } catch { capture.host = 'live-websocket'; }
      this.addEventListener('message', async event => {
        if (capture.firstMessage) return;
        try {
          let text = '';
          if (typeof event.data === 'string') text = event.data;
          else if (event.data instanceof Blob) text = await event.data.text();
          else text = String(event.data ?? '');
          capture.firstMessage = text.slice(0, 1800);
        } catch (error) {
          capture.firstMessage = `تعذر قراءة أول رسالة: ${String(error?.message || error)}`;
        }
      }, { once: true });
      this.addEventListener('close', event => {
        capture.closeCode = String(event.code || '');
        capture.closeReason = String(event.reason || '').slice(0, 300);
      }, { once: true });
    }
  }

  window.WebSocket = DiagnosticWebSocket;
  return {
    capture,
    restore() { window.WebSocket = NativeWebSocket; }
  };
}

function summarizeServerMessage(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return 'لم تصل رسالة أولى قابلة للقراءة';
  try {
    const parsed = JSON.parse(text);
    if (parsed?.error) {
      const error = parsed.error;
      return `server error ${error.code || ''} ${error.status || ''} • ${error.message || JSON.stringify(error)}`.replace(/\s+/g, ' ').trim().slice(0, 650);
    }
    if (parsed?.setupComplete) return 'setupComplete';
    return JSON.stringify(parsed).slice(0, 650);
  } catch {
    return text.replace(/\s+/g, ' ').slice(0, 650);
  }
}

function transportDiagnostic(capture) {
  if (!capture) return 'لا توجد بيانات WebSocket';
  const first = summarizeServerMessage(capture.firstMessage);
  const close = capture.closeCode || capture.closeReason
    ? ` | إغلاق ${capture.closeCode || '?'}${capture.closeReason ? `: ${capture.closeReason}` : ''}`
    : '';
  return `أول رد: ${first}${close}`;
}

async function connectLiveSession() {
  const liveModel = getLiveGenerativeModel(liveAI, {
    model: LIVE_MODEL,
    generationConfig: { responseModalities: [ResponseModality.AUDIO] }
  });

  const socketDiagnostic = installWebSocketCapture();
  try {
    const liveSession = await liveModel.connect();
    lastTransport = socketDiagnostic.capture;
    activeModel = LIVE_MODEL;
    try { await liveSession.send(contextMessage(), false); }
    catch (contextError) { console.warn('Mesraah Live context:', contextError); }
    return liveSession;
  } catch (error) {
    lastTransport = socketDiagnostic.capture;
    error.mesraahTransport = socketDiagnostic.capture;
    throw error;
  } finally {
    socketDiagnostic.restore();
  }
}

async function prepare() {
  if (controller) return;
  ensureUi();
  const overlay = document.getElementById('v80VoiceOverlay');
  overlay.hidden = false;
  const issue = environmentIssue();
  if (issue) {
    setGoVisible(false);
    setStatus(issue, 'error', 'جرّب أحدث Chrome أو Safari على اتصال HTTPS.');
    return;
  }
  if (session) {
    setStatus('جاهز للمحادثة', 'ready', 'اضغط «ابدأ المحادثة» لتشغيل المايك.');
    setGoVisible(true);
    return;
  }
  if (preparing) return;

  preparing = true;
  lastError = null;
  lastTransport = null;
  lastGatewayProbe = '';
  setGoVisible(false);
  setStatus('أفحص بوابة الذكاء…', 'connecting', 'أتحقق أولا من AI Logic ثم من اتصال Live.');

  try {
    try {
      lastGatewayProbe = await runGatewayProbe();
    } catch (probeError) {
      lastGatewayProbe = `فشل • ${diagnostic(probeError)}`;
      console.error('Mesraah AI gateway probe:', probeError);
    }

    setStatus('أجهز الاتصال الصوتي…', 'connecting', `بوابة AI Logic: ${lastGatewayProbe}`);

    if (window.MesraahCalendar?.status?.().connected) {
      await window.MesraahCalendar.listUpcoming({ days: 2, maxResults: 20 }).catch(() => {});
    }

    session = await connectLiveSession();
    setStatus('جاهز للمحادثة', 'ready', `بوابة AI Logic: ${lastGatewayProbe}. الاتصال الصوتي ناجح.`);
    setGoVisible(true);

    clearTimeout(readyTimer);
    readyTimer = setTimeout(async () => {
      if (!controller && session) {
        await closeSession();
        if (!overlay.hidden) {
          setStatus('انتهى الاتصال الجاهز', '', 'جهز الاتصال من جديد عندما تريد التحدث.');
          setGoVisible(true, 'جهز الاتصال من جديد');
        }
      }
    }, 90000);
  } catch (error) {
    lastError = error;
    console.error('Mesraah Live voice prepare:', error);
    await closeSession();
    const transport = transportDiagnostic(error?.mesraahTransport || lastTransport);
    setStatus(
      friendlyError(error, 'connect'),
      'error',
      `بوابة AI Logic: ${lastGatewayProbe || 'لم تكتمل'} | ${transport} | SDK: ${diagnostic(error)}`
    );
    setGoVisible(true, 'إعادة المحاولة');
  } finally {
    preparing = false;
  }
}

async function startNow() {
  const button = document.getElementById('v80VoiceGo');
  if (!session) {
    if (button) button.hidden = true;
    await prepare();
    return;
  }
  if (controller) return;
  if (button) button.disabled = true;
  clearTimeout(readyTimer);
  try {
    controller = await startAudioConversation(session);
    setGoVisible(false);
    setStatus('أسمعك الآن', 'listening', 'تكلم بشكل طبيعي. مسراح يقرأ مهامك وسياق يومك قبل الرد.');
  } catch (error) {
    lastError = error;
    console.error('Mesraah Live voice audio:', error);
    setStatus(friendlyError(error, 'audio'), 'error', `رمز التشخيص: ${diagnostic(error)}`);
    setGoVisible(true, 'ابدأ مرة ثانية');
  } finally {
    if (button) button.disabled = false;
  }
}

async function closeSession() {
  clearTimeout(readyTimer);
  readyTimer = null;
  try { if (controller) await controller.stop(); } catch (error) { console.warn('Mesraah voice controller stop:', error); }
  controller = null;
  try { if (session) await session.close(); } catch (error) { console.warn('Mesraah voice session close:', error); }
  session = null;
  activeModel = '';
}

async function stop() {
  setStatus('تم إنهاء المحادثة', '');
  setGoVisible(false);
  await closeSession();
  const overlay = document.getElementById('v80VoiceOverlay');
  if (overlay) setTimeout(() => { overlay.hidden = true; }, 180);
}

window.MesraahVoice = {
  start: prepare,
  prepare,
  startNow,
  stop,
  get active() { return Boolean(controller); },
  get ready() { return Boolean(session); },
  get model() { return activeModel; },
  get lastError() { return lastError; },
  get gatewayProbe() { return lastGatewayProbe; },
  get transport() { return lastTransport; }
};

ensureUi();
