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
const MODEL_NAME = 'gemini-3.5-flash-lite';

const firebaseApp = getApp();
initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY),
  isTokenAutoRefreshEnabled: true
});

const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

const assistantSchema = Schema.object({
  properties: {
    intent: Schema.enumString({ enum: ['task', 'answer'] }),
    answer: Schema.string(),
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

const model = getGenerativeModel(ai, {
  model: MODEL_NAME,
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: assistantSchema,
    temperature: 0.12,
    maxOutputTokens: 360
  }
});

function readState() {
  try { return JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {}; }
  catch { return {}; }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>\"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  }[char]));
}

function riyadhContext() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const parts = date => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).reduce((out, part) => {
    if (part.type !== 'literal') out[part.type] = part.value;
    return out;
  }, {});
  const iso = date => {
    const p = parts(date);
    return `${p.year}-${p.month}-${p.day}`;
  };
  const gregorian = date => new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
    timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(date).replace(/،/g, '').replace(/\s+/g, ' ').trim();
  const hijri = date => new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
    timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(date).replace(/،/g, '').replace(/\s+/g, ' ').trim();
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(now);
  return {
    todayIso: iso(now), tomorrowIso: iso(tomorrow),
    todayGregorian: gregorian(now), tomorrowGregorian: gregorian(tomorrow),
    todayHijri: hijri(now), tomorrowHijri: hijri(tomorrow), time
  };
}

function contextList(items = []) {
  return items.filter(item => item?.id && item?.name).slice(0, 40).map(item => ({
    id: String(item.id), name: String(item.name)
  }));
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

function normalizeResult(raw, sourceText, state) {
  const spaces = contextList(state.spaces);
  const people = contextList(state.people);
  const intent = raw?.intent === 'task' ? 'task' : 'answer';
  return {
    intent,
    answer: String(raw?.answer || '').trim(),
    task: {
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
    }
  };
}

async function askGemini(text) {
  const state = readState();
  const dates = riyadhContext();
  const spaces = contextList(state.spaces);
  const people = contextList(state.people);

  const prompt = `
أنت مساعد ذكي داخل تطبيق سعودي اسمه مسراح. اسم الميزة "على الطاير".
المستخدم قد يسأل سؤالا، يتحدث معك، يطلب رأيا أو معلومة، أو يطلب فعلا إنشاء مهمة.

أهم قاعدة: لا تحول كلام المستخدم إلى مهمة إلا إذا كانت نيته واضحة أنه يريد فعل شيء أو تسجيل التزام/تذكير/موعد.
الأسئلة، طلب الرأي، التصحيح، المحادثة، الاستفسارات والعبارات غير الحاسمة تعاملها answer.
إذا احتملت العبارة المعنيين ولم تكن نية المهمة واضحة: اختر answer. لا تسأل المستخدم "تقصد سؤال أو مهمة؟".

أمثلة:
- "وش رايك بكرة عاشوراء؟" => answer، وليس مهمة.
- "هل بكرة عاشوراء؟" => answer.
- "ذكرني أصوم عاشوراء" => task.
- "بكرة الساعة 10 كلم محمد عن العرض" => task.
- "محمد شخص ممتاز" => answer.
- "كم باقي على الخميس؟" => answer.

السياق الزمني المؤكد في الرياض:
اليوم ISO: ${dates.todayIso}
اليوم: ${dates.todayGregorian} | أم القرى: ${dates.todayHijri}
غدا ISO: ${dates.tomorrowIso}
غدا: ${dates.tomorrowGregorian} | أم القرى: ${dates.tomorrowHijri}
الوقت: ${dates.time}

إذا كان السؤال عن اليوم أو غدا أو التاريخ الهجري، اعتمد على السياق أعلاه ولا تخمن.
إذا طلب معلومة لحظية غير موجودة في السياق ولا تستطيع التأكد منها، قل باختصار إنك تحتاج تحقق مباشر بدل اختلاق جواب.

إذا intent = answer:
- اكتب answer بالعربية السعودية الطبيعية، مختصر ومفيد.
- اترك title وdue وdueTime وfollow وfollowTime وspaceId وpersonId وnotes كسلاسل فارغة.
- priority = normal، status = inbox، points = 10.

إذا intent = task:
- answer سلسلة فارغة.
- title عنوان عملي مختصر.
- due وfollow بصيغة YYYY-MM-DD، والوقت HH:MM بنظام 24 ساعة. اترك غير المذكور فارغا.
- استخدم spaceId وpersonId فقط إذا كان التطابق واضحا من القوائم التالية، وإلا اتركهما فارغين.
- status الافتراضي inbox، واستخدم waiting فقط إذا كان هناك شيء قائم فعلا وينتظر شخصا آخر.
- priority normal عادة، important للمهم/العاجل، strategic للاستراتيجي الواضح.
- points واحدة من 5 أو 10 أو 20 أو 30.

المساحات: ${JSON.stringify(spaces)}
الأشخاص: ${JSON.stringify(people)}

كلام المستخدم:
${text}
`;

  const result = await model.generateContent(prompt);
  const responseText = result?.response?.text?.();
  if (!responseText) throw new Error('empty-ai-response');
  return normalizeResult(JSON.parse(responseText), text, state);
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
    taskId: '', taskTitle: task.title, taskNotes: composedNotes(task),
    taskSpace: task.spaceId, taskPerson: task.personId, taskStatus: task.status,
    taskPriority: task.priority, taskDue: task.due, taskFollow: task.follow,
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
  preview.classList.remove('v71-answer');

  const meta = [
    space?.name, person?.name,
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
    </div>`;
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
  preview.classList.add('v71-answer');
  preview.innerHTML = `
    <div class="v71-ai-label">مسراح</div>
    <div class="fly-ai-answer">${escapeHtml(answer || 'تفضل، اسألني.').replace(/\n/g, '<br>')}</div>`;
  preview.classList.add('show');
}

function renderThinking() {
  const preview = document.getElementById('flyPreview');
  if (!preview) return;
  preview.classList.remove('v71-answer');
  preview.innerHTML = '<strong>يفكر…</strong><small>يفهم كلامك ويحدد المطلوب</small>';
  preview.classList.add('show');
}

function showToast(message, duration = 2600) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function install() {
  const input = document.getElementById('flyInput');
  const send = document.getElementById('flySend');
  const voice = document.getElementById('flyVoice');
  if (!input || !send || !voice) return;

  const localTaskFallback = send.onclick;
  let busy = false;

  const run = async () => {
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true;
    send.disabled = true;
    send.textContent = 'يفكر…';
    renderThinking();

    try {
      const result = await askGemini(text);
      if (result.intent === 'task') renderTaskPreview(result.task);
      else renderAnswer(result.answer);
    } catch (error) {
      console.error('Mesraah assistant:', error);
      const explicitTask = /^(ذكرني|اضف|أضف|كلم|اتصل|ارسل|أرسل|تابع|راجع|حدد|احجز|رتب|سوي|سو)\b/.test(text.trim());
      if (explicitTask && typeof localTaskFallback === 'function') {
        showToast('تعذر التحليل الذكي، استخدمت التحليل المحلي');
        localTaskFallback.call(send);
      } else {
        renderAnswer('تعذر الرد الآن. جرب مرة ثانية.');
      }
    } finally {
      busy = false;
      send.disabled = false;
      send.textContent = 'إرسال';
    }
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
    voice.onclick = () => { input.focus(); showToast('الإدخال الصوتي يحتاج متصفح يدعم المايك'); };
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

install();
