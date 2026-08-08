import { getApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app-check.js';
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  Schema
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-ai.js';

const DATA_KEY = 'mesraah_v030';
const RECAPTCHA_ENTERPRISE_SITE_KEY = '6LdgFnstAAAAAJod6T7NgPLzkfFkSYNbc4_q4rfe';
const FAST_MODEL = 'gemini-3.5-flash-lite';

const firebaseApp = getApp();

initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY),
  isTokenAutoRefreshEnabled: true
});

const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

const taskSchema = Schema.object({
  properties: {
    title: Schema.string(),
    due: Schema.string(),
    dueTime: Schema.string(),
    follow: Schema.string(),
    followTime: Schema.string(),
    spaceId: Schema.string(),
    personId: Schema.string(),
    priority: Schema.enumString({ enum: ['normal', 'important', 'strategic'] }),
    status: Schema.enumString({ enum: ['inbox', 'active', 'waiting'] }),
    points: Schema.number(),
    notes: Schema.string()
  }
});

const taskModel = getGenerativeModel(ai, {
  model: FAST_MODEL,
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: taskSchema,
    temperature: 0,
    maxOutputTokens: 420
  }
});

const questionModel = getGenerativeModel(ai, {
  model: FAST_MODEL,
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 320
  }
});

function readState() {
  try {
    return JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>\"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  }[char]));
}

function normalizeArabic(value = '') {
  return String(value)
    .trim()
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ـ/g, '')
    .replace(/\s+/g, ' ');
}

function riyadhDateContext() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const gregorian = date => new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
    timeZone: 'Asia/Riyadh',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(date).replace(/،/g, '').replace(/\s+/g, ' ').trim();

  const hijri = date => new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
    timeZone: 'Asia/Riyadh',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(date).replace(/،/g, '').replace(/\s+/g, ' ').trim();

  const time = new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
    timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(now);

  return {
    todayGregorian: gregorian(now),
    todayHijri: hijri(now),
    tomorrowGregorian: gregorian(tomorrow),
    tomorrowHijri: hijri(tomorrow),
    time
  };
}

function contextList(items = []) {
  return items
    .filter(item => item && item.id && item.name)
    .map(item => ({ id: String(item.id), name: String(item.name) }));
}

function allowedId(value, items) {
  const id = String(value || '');
  return items.some(item => String(item.id) === id) ? id : '';
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function normalizeTime(value) {
  const text = String(value || '').trim();
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : '';
}

function normalizePoints(value) {
  const n = Number(value);
  const allowed = [5, 10, 20, 30];
  return allowed.reduce((best, current) => Math.abs(current - n) < Math.abs(best - n) ? current : best, 10);
}

function normalizeTask(raw, sourceText, state) {
  const spaces = contextList(state.spaces);
  const people = contextList(state.people);
  return {
    title: String(raw?.title || '').trim() || String(sourceText || '').trim(),
    due: normalizeDate(raw?.due),
    dueTime: normalizeTime(raw?.dueTime),
    follow: normalizeDate(raw?.follow),
    followTime: normalizeTime(raw?.followTime),
    spaceId: allowedId(raw?.spaceId, spaces),
    personId: allowedId(raw?.personId, people),
    priority: ['normal', 'important', 'strategic'].includes(raw?.priority) ? raw.priority : 'normal',
    status: ['inbox', 'active', 'waiting'].includes(raw?.status) ? raw.status : 'inbox',
    points: normalizePoints(raw?.points),
    notes: String(raw?.notes || '').trim(),
    createdAt: new Date().toISOString()
  };
}

function detectIntent(text) {
  const raw = String(text || '').trim();
  const s = normalizeArabic(raw);

  const explicitTask = /^(ذكرني|سجل|سجل لي|اضف|حط|اكتب لي مهمه|كلم|اتصل|ارسل|ابعث|تابع|راجع|حدد|احجز|رتب|جهز|اعمل|سوي|سو|ادفع|اشتر|روح|مر على|لا تنسي|لا تنسى)\b/.test(s);
  const taskVerb = /\b(ذكرني|اضف|كلم|اتصل|ارسل|ابعث|تابع|راجع|حدد|احجز|رتب|جهز|سوي|سو|ادفع|اشتر|روح|خلص|انجز)\b/.test(s);
  const explicitQuestion = /[؟?]\s*$/.test(raw) || /^(وش|ايش|اش|هل|متي|وين|اين|كم|ليش|لماذا|كيف|من|ما رايك|وش رايك|ايش رايك|تعرف|تتوقع|صحيح|هل صحيح|ممكن تقول|قل لي|عطني رايك)\b/.test(s);

  if (explicitTask) return 'task';
  if (explicitQuestion && !explicitTask) return 'question';
  if (taskVerb) return 'task';
  return 'ambiguous';
}

async function parseTaskWithGemini(text) {
  const state = readState();
  const dates = riyadhDateContext();
  const spaces = contextList(state.spaces);
  const people = contextList(state.people);

  const prompt = `حلل هذا كأمر مهمة داخل تطبيق مسراح. لا تجاوب عن أسئلة ولا تضف معلومات من عندك.\n\nاليوم في الرياض: ${dates.todayGregorian} | ${dates.todayHijri}\nغدا في الرياض: ${dates.tomorrowGregorian} | ${dates.tomorrowHijri}\nالوقت الآن: ${dates.time}\n\nالمساحات: ${JSON.stringify(spaces)}\nالأشخاص: ${JSON.stringify(people)}\n\nأعد الحقول المطلوبة فقط. due وfollow بصيغة YYYY-MM-DD، والوقت HH:MM. اختر spaceId وpersonId فقط من القوائم. إذا لم يذكر شيء اتركه فارغا. status الافتراضي inbox. النقاط 5 أو 10 أو 20 أو 30.\n\nالأمر: ${text}`;

  const result = await taskModel.generateContent(prompt);
  const responseText = result?.response?.text?.();
  if (!responseText) throw new Error('empty-task-response');
  return normalizeTask(JSON.parse(responseText), text, state);
}

function likelyNeedsLiveVerification(text) {
  const s = normalizeArabic(text);
  return /\b(خبر|اخبار|سعر|اسعار|سهم|اسهم|طقس|مباراه|نتيجه|نتايج|الان|اخر تحديث|احدث|اليوم في السوق|افتتاح|اغلاق)\b/.test(s);
}

async function answerQuestion(text) {
  const dates = riyadhDateContext();
  const liveWarning = likelyNeedsLiveVerification(text)
    ? 'هذا السؤال يبدو لحظيا. إذا لم تكن المعلومة مؤكدة من السياق المتاح، صرح باختصار أنك تحتاج تحقق مباشر ولا تخمن.'
    : '';

  const prompt = `أنت مساعد مسراح. المستخدم يسأل سؤالا ويريد جوابا الآن، وليس إنشاء مهمة.\nجاوب بالعربية السعودية الطبيعية وباختصار مفيد.\nلا تحول السؤال إلى تذكير أو مهمة.\nبالنسبة لأسئلة التاريخ واليوم وغدا والتقويم الهجري، اعتمد حصرا على السياق التالي ولا تخمن:\nاليوم في الرياض: ${dates.todayGregorian} | ${dates.todayHijri}\nغدا في الرياض: ${dates.tomorrowGregorian} | ${dates.tomorrowHijri}\nالوقت الآن: ${dates.time}\n${liveWarning}\n\nسؤال المستخدم: ${text}`;

  const result = await questionModel.generateContent(prompt);
  const answer = result?.response?.text?.()?.trim();
  if (!answer) throw new Error('empty-question-response');
  return answer;
}

function composedNotes(task) {
  return [
    task.notes,
    task.dueTime ? `وقت الإنجاز: ${task.dueTime}` : '',
    task.followTime ? `وقت المتابعة: ${task.followTime}` : ''
  ].filter(Boolean).join('\n');
}

function fillTaskForm(task) {
  document.getElementById('newTaskBtn')?.click();
  const values = {
    taskId: '',
    taskTitle: task.title,
    taskNotes: composedNotes(task),
    taskSpace: task.spaceId,
    taskPerson: task.personId,
    taskStatus: task.status,
    taskPriority: task.priority,
    taskDue: task.due,
    taskFollow: task.follow,
    taskPoints: String(task.points)
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.value = value ?? '';
  });
}

function renderTaskPreview(task) {
  const state = readState();
  const space = (state.spaces || []).find(item => String(item.id) === task.spaceId);
  const person = (state.people || []).find(item => String(item.id) === task.personId);
  const preview = document.getElementById('flyPreview');
  if (!preview) return;

  const meta = [
    space?.name,
    person?.name,
    task.due && `الموعد ${task.due}`,
    task.dueTime && `الوقت ${task.dueTime}`,
    task.follow && `المتابعة ${task.follow}`,
    task.followTime && `وقت المتابعة ${task.followTime}`,
    task.priority === 'important' ? 'مهمة' : task.priority === 'strategic' ? 'استراتيجية' : ''
  ].filter(Boolean);

  preview.innerHTML = `
    <strong>${escapeHtml(task.title)}</strong>
    <small>${meta.length ? meta.map(escapeHtml).join(' • ') : 'ستدخل إلى الوارد'}</small>
    <div class="fly-actions">
      <button class="fly-save" id="flyAiSave" type="button">حفظ</button>
      <button class="fly-edit" id="flyAiEdit" type="button">تعديل</button>
    </div>
  `;
  preview.classList.add('show');

  document.getElementById('flyAiSave')?.addEventListener('click', event => {
    event.stopPropagation();
    fillTaskForm(task);
    document.getElementById('taskForm')?.requestSubmit();
    preview.classList.remove('show');
    const input = document.getElementById('flyInput');
    if (input) input.value = '';
  }, { once: true });

  document.getElementById('flyAiEdit')?.addEventListener('click', event => {
    event.stopPropagation();
    fillTaskForm(task);
  }, { once: true });
}

function renderAnswer(answer) {
  const preview = document.getElementById('flyPreview');
  if (!preview) return;
  preview.innerHTML = `
    <strong>الجواب</strong>
    <div class="fly-ai-answer">${escapeHtml(answer).replace(/\n/g, '<br>')}</div>
  `;
  preview.classList.add('show');
}

function renderAmbiguous(text, onAsk, onTask) {
  const preview = document.getElementById('flyPreview');
  if (!preview) return;
  preview.innerHTML = `
    <strong>تقصد تسأل أو تضيفها مهمة؟</strong>
    <small>${escapeHtml(text)}</small>
    <div class="fly-actions">
      <button class="fly-save" id="flyAskChoice" type="button">اسأل</button>
      <button class="fly-edit" id="flyTaskChoice" type="button">أضف كمهمة</button>
    </div>
  `;
  preview.classList.add('show');
  document.getElementById('flyAskChoice')?.addEventListener('click', onAsk, { once: true });
  document.getElementById('flyTaskChoice')?.addEventListener('click', onTask, { once: true });
}

function renderThinking(kind) {
  const preview = document.getElementById('flyPreview');
  if (!preview) return;
  preview.innerHTML = kind === 'question'
    ? '<strong>يفكر…</strong><small>مسراح يجهز جواب مختصر</small>'
    : '<strong>يرتب المهمة…</strong><small>يفهم الموعد والمتابعة والتفاصيل</small>';
  preview.classList.add('show');
}

function showToast(message, duration = 2600) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function installFlyAI() {
  const input = document.getElementById('flyInput');
  const send = document.getElementById('flySend');
  const voice = document.getElementById('flyVoice');
  if (!input || !send || !voice) return;

  const localTaskFallback = send.onclick;
  let busy = false;

  const runTask = async text => {
    renderThinking('task');
    try {
      const task = await parseTaskWithGemini(text);
      renderTaskPreview(task);
    } catch (error) {
      console.error('Mesraah Gemini task parser:', error);
      showToast('تعذر التحليل الذكي، استخدمت التحليل المحلي');
      if (typeof localTaskFallback === 'function') localTaskFallback.call(send);
    }
  };

  const runQuestion = async text => {
    renderThinking('question');
    try {
      const answer = await answerQuestion(text);
      renderAnswer(answer);
    } catch (error) {
      console.error('Mesraah Gemini question:', error);
      showToast('تعذر الرد الآن');
      const preview = document.getElementById('flyPreview');
      if (preview) preview.classList.remove('show');
    }
  };

  const execute = async (intent, text) => {
    if (busy) return;
    busy = true;
    send.disabled = true;
    send.textContent = intent === 'question' ? 'يفكر…' : 'يرتب…';
    try {
      if (intent === 'question') await runQuestion(text);
      else await runTask(text);
    } finally {
      busy = false;
      send.disabled = false;
      send.textContent = 'إضافة';
    }
  };

  const run = async () => {
    const text = input.value.trim();
    if (!text || busy) return;

    const intent = detectIntent(text);
    if (intent === 'ambiguous') {
      renderAmbiguous(
        text,
        () => execute('question', text),
        () => execute('task', text)
      );
      return;
    }

    await execute(intent, text);
  };

  send.onclick = run;

  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    run();
  }, true);

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voice.onclick = () => {
      input.focus();
      showToast('الإدخال الصوتي يحتاج متصفح يدعم المايك');
    };
    return;
  }

  voice.onclick = () => {
    if (busy) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA';
    recognition.interimResults = false;
    voice.classList.add('listening');
    recognition.start();
    recognition.onresult = event => {
      input.value = event.results[0][0].transcript;
      run();
    };
    recognition.onend = () => voice.classList.remove('listening');
    recognition.onerror = () => {
      voice.classList.remove('listening');
      showToast('تعذر تشغيل المايك');
    };
  };
}

installFlyAI();
