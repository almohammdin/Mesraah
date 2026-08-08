import { getApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  AIError,
  getAI,
  getLiveGenerativeModel,
  GoogleAIBackend,
  ResponseModality,
  startAudioConversation
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-ai.js';

const DATA_KEY = 'mesraah_v030';
const MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
let session = null;
let controller = null;
let preparing = false;
let readyTimer = null;

function stateContext() {
  try {
    const state = JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {};
    const tasks = (state.tasks || [])
      .filter(t => t.status !== 'done')
      .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
      .slice(0, 25)
      .map(t => ({
        title: t.title,
        due: t.due || '',
        follow: t.follow || '',
        status: t.status || '',
        priority: t.priority || '',
        spaceId: t.spaceId || '',
        personId: t.personId || ''
      }));
    const people = (state.people || []).slice(0, 30).map(p => ({
      name: p.name,
      relation: p.relation || '',
      city: p.city || '',
      organization: p.organization || '',
      note: p.note || ''
    }));
    const calendar = window.MesraahCalendar?.getCachedEvents?.().slice(0, 20) || [];
    return { name: state.profile?.name || '', tasks, people, calendar };
  } catch {
    return { tasks: [], people: [], calendar: [] };
  }
}

function systemInstruction() {
  const ctx = stateContext();
  return `أنت مسراح، مساعد شخصي سعودي صوتي. تحدث بالعربية السعودية الطبيعية وبجمل قصيرة مناسبة لشخص يقود السيارة.

اقرأ بيانات المستخدم التالية قبل الإجابة:
${JSON.stringify(ctx)}

إذا سألك عن يومه أو بكرة، اعتمد على المهام والمواعيد الموجودة فقط. اربط المعلومات ببعضها عندما يكون الارتباط حقيقيا ومفيدا، مثل اجتماع ومشوار في نفس المدينة، ولا تخترع مدينة أو موعدا أو علاقة غير موجودة. اقترح الخطوة التالية عندما تفيد المستخدم. إذا رغب المستخدم في إنشاء مهمة أو موعد، تحدث معه طبيعيا واطلب منه تأكيد الإجراء. لا تقل إن شيئا تم حفظه قبل التأكيد. كن مختصرا وتفاعليا وتذكر سياق الحديث داخل الجلسة.`;
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

function friendlyError(error, phase = 'connect') {
  const code = String(error?.code || '').replace(/^ai\//, '');
  const name = String(error?.name || '');

  if (name === 'NotAllowedError') return 'اسمح لمسراح باستخدام المايك ثم اضغط ابدأ مرة ثانية';
  if (name === 'NotFoundError') return 'لم أجد مايك متاح على هذا الجهاز';
  if (name === 'NotReadableError') return 'المايك مستخدم من برنامج آخر أو غير متاح حاليا';
  if (name === 'AbortError') return 'تعذر بدء المايك، جرب مرة ثانية';

  if (error instanceof AIError || code) {
    if (code.includes('api-not-enabled')) return 'خدمة Gemini Live تحتاج تفعيل Firebase AI Logic للمشروع';
    if (code.includes('unsupported')) return 'المتصفح الحالي لا يدعم متطلبات المحادثة الصوتية';
    if (code.includes('no-model')) return 'موديل المحادثة الصوتية غير متاح للمشروع حاليا';
    if (code.includes('fetch-error')) return 'تعذر الوصول إلى خدمة المحادثة الصوتية؛ تحقق من الاتصال';
    if (code.includes('session-closed')) return 'انتهت جلسة الصوت؛ جهز اتصالا جديدا';
    if (code.includes('request-error')) return phase === 'audio' ? 'تعذر بدء الصوت من المتصفح؛ اضغط ابدأ مرة ثانية' : 'تعذر إنشاء جلسة الصوت';
  }

  return phase === 'audio' ? 'تعذر بدء المايك أو تشغيل الصوت' : 'تعذر الاتصال بالمحادثة الصوتية';
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
  setGoVisible(false);
  setStatus('أجهز الاتصال…', 'connecting', 'لحظات ويظهر زر بدء المحادثة.');

  try {
    if (window.MesraahCalendar?.status?.().connected) {
      await window.MesraahCalendar.listUpcoming({ days: 2, maxResults: 20 }).catch(() => {});
    }

    const ai = getAI(getApp(), { backend: new GoogleAIBackend() });
    const liveModel = getLiveGenerativeModel(ai, {
      model: MODEL,
      systemInstruction: systemInstruction(),
      generationConfig: {
        responseModalities: [ResponseModality.AUDIO]
      }
    });

    session = await liveModel.connect();
    setStatus('جاهز للمحادثة', 'ready', 'اضغط «ابدأ المحادثة» لتشغيل المايك والتحدث مع مسراح.');
    setGoVisible(true);

    clearTimeout(readyTimer);
    readyTimer = setTimeout(async () => {
      if (!controller && session) {
        await closeSession();
        if (!overlay.hidden) {
          setStatus('انتهى الاتصال الجاهز', '', 'اضغط تجهيز الاتصال مرة ثانية عندما تريد التحدث.');
          setGoVisible(true, 'جهز الاتصال من جديد');
        }
      }
    }, 90000);
  } catch (error) {
    console.error('Mesraah Live voice prepare:', error);
    await closeSession();
    setStatus(friendlyError(error, 'connect'), 'error', 'أعد المحاولة، وإذا استمرت الرسالة سنعرض سبب الخطأ التقني في سجل المتصفح.');
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
    // Important: Firebase requires this helper to be called directly from a user gesture.
    // Keep this as the first awaited operation in this click handler.
    controller = await startAudioConversation(session);
    setGoVisible(false);
    setStatus('أسمعك الآن', 'listening', 'تكلم بشكل طبيعي. مسراح يقرأ مهامك وسياق يومك قبل الرد.');
  } catch (error) {
    console.error('Mesraah Live voice audio:', error);
    setStatus(friendlyError(error, 'audio'), 'error', 'راجع إذن المايك للمتصفح ثم حاول مرة ثانية.');
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
  get ready() { return Boolean(session); }
};

ensureUi();
