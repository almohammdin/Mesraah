import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app-check.js';
import {
  AIError,
  getAI,
  getLiveGenerativeModel,
  GoogleAIBackend,
  ResponseModality,
  startAudioConversation
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-ai.js';

const DATA_KEY = 'mesraah_v030';
const LIVE_APP_NAME = 'mesraah-live-v083';
const RECAPTCHA_SITE_KEY = '6LdgFnstAAAAAJod6T7NgPLzkfFkSYNbc4_q4rfe';
const MODELS = [
  'gemini-2.5-flash-native-audio-preview-12-2025',
  'gemini-2.5-flash-native-audio-preview-09-2025'
];

const firebaseConfig = {
  apiKey: 'AIzaSyAAvC9y5jQ_7fAwmkCqBtgFDrBRF5t4uI0',
  authDomain: 'mesraah-a2dfc.firebaseapp.com',
  projectId: 'mesraah-a2dfc',
  storageBucket: 'mesraah-a2dfc.firebasestorage.app',
  messagingSenderId: '986043593957',
  appId: '1:986043593957:web:b848313ef8cf83a5f3500c'
};

const liveFirebaseApp = getApps().find(app => app.name === LIVE_APP_NAME)
  || initializeApp(firebaseConfig, LIVE_APP_NAME);

try {
  initializeAppCheck(liveFirebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });
} catch (error) {
  if (!String(error?.message || '').includes('already')) {
    console.warn('Mesraah Live App Check:', error);
  }
}

const liveAI = getAI(liveFirebaseApp, {
  backend: new GoogleAIBackend(),
  useLimitedUseAppCheckTokens: true
});

let session = null;
let controller = null;
let preparing = false;
let readyTimer = null;
let activeModel = '';
let lastError = null;

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
    return {
      name: state.profile?.name || '',
      tasks,
      people,
      calendar
    };
  } catch {
    return { tasks: [], people: [], calendar: [] };
  }
}

function contextMessage() {
  const context = stateContext();
  return `تعليمات جلسة مسراح الصوتية:
أنت مسراح، مساعد شخصي سعودي صوتي. تحدث بالعربية السعودية الطبيعية وبجمل قصيرة مناسبة لشخص يقود السيارة.
اقرأ بيانات المستخدم أدناه قبل الإجابة واربط بينها عندما يكون الارتباط حقيقيا ومفيدا.
اعتمد على البيانات الموجودة فقط، ولا تخترع موعدا أو مدينة أو علاقة.
إذا سألك المستخدم عن يومه، لخص مهامه ومواعيده ورتب الأهم.
إذا ذكر رغبة مثل زيارة شخص، تفاعل معه طبيعيا ثم اقترح وقتا أو خطوة مناسبة إذا كانت البيانات تساعد على ذلك.
إذا أراد إنشاء مهمة أو موعد، اطلب التأكيد قبل الادعاء بأن الإجراء تم.
تذكر سياق الحديث داخل الجلسة.

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
  return `${code}${message ? ` • ${message.slice(0, 180)}` : ''}`;
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
    if (code.includes('request-error')) {
      return phase === 'audio'
        ? 'تعذر بدء الصوت من المتصفح'
        : 'رفضت الخدمة إنشاء جلسة الصوت';
    }
    if (code.includes('response-error')) return 'تعذر إكمال مصافحة الاتصال الصوتي';
  }

  return phase === 'audio'
    ? 'تعذر بدء المايك أو تشغيل الصوت'
    : 'تعذر الاتصال بالمحادثة الصوتية';
}

async function connectWithModel(modelName) {
  const liveModel = getLiveGenerativeModel(liveAI, {
    model: modelName,
    generationConfig: {
      responseModalities: [ResponseModality.AUDIO]
    }
  });

  const liveSession = await liveModel.connect();

  try {
    await liveSession.send(contextMessage(), false);
  } catch (contextError) {
    console.warn('Mesraah Live context:', contextError);
  }

  return liveSession;
}

async function connectLiveSession() {
  const failures = [];
  for (const modelName of MODELS) {
    try {
      const liveSession = await connectWithModel(modelName);
      activeModel = modelName;
      return liveSession;
    } catch (error) {
      failures.push({ modelName, error });
      console.error(`Mesraah Live connect ${modelName}:`, error);
    }
  }

  const finalError = failures.at(-1)?.error || new Error('live-connect-failed');
  finalError.mesraahAttempts = failures.map(item => ({
    model: item.modelName,
    diagnostic: diagnostic(item.error)
  }));
  throw finalError;
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
  setGoVisible(false);
  setStatus('أجهز الاتصال…', 'connecting', 'أتحقق من Gemini Live ثم يظهر زر بدء المحادثة.');

  try {
    if (window.MesraahCalendar?.status?.().connected) {
      await window.MesraahCalendar.listUpcoming({ days: 2, maxResults: 20 }).catch(() => {});
    }

    session = await connectLiveSession();
    setStatus(
      'جاهز للمحادثة',
      'ready',
      'الاتصال ناجح. اضغط «ابدأ المحادثة» لتشغيل المايك والتحدث مع مسراح.'
    );
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
    const attempts = Array.isArray(error?.mesraahAttempts)
      ? error.mesraahAttempts.map(item => `${item.model}: ${item.diagnostic}`).join(' | ')
      : diagnostic(error);
    setStatus(
      friendlyError(error, 'connect'),
      'error',
      `رمز التشخيص: ${attempts}`
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
    // Firebase requires this helper to be called directly from a user gesture.
    controller = await startAudioConversation(session);
    setGoVisible(false);
    setStatus(
      'أسمعك الآن',
      'listening',
      'تكلم بشكل طبيعي. مسراح يقرأ مهامك وسياق يومك قبل الرد.'
    );
  } catch (error) {
    lastError = error;
    console.error('Mesraah Live voice audio:', error);
    setStatus(
      friendlyError(error, 'audio'),
      'error',
      `رمز التشخيص: ${diagnostic(error)}`
    );
    setGoVisible(true, 'ابدأ مرة ثانية');
  } finally {
    if (button) button.disabled = false;
  }
}

async function closeSession() {
  clearTimeout(readyTimer);
  readyTimer = null;

  try {
    if (controller) await controller.stop();
  } catch (error) {
    console.warn('Mesraah voice controller stop:', error);
  }
  controller = null;

  try {
    if (session) await session.close();
  } catch (error) {
    console.warn('Mesraah voice session close:', error);
  }
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
  get lastError() { return lastError; }
};

ensureUi();