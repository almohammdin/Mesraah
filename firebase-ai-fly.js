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
const MODEL_NAME = 'gemini-3.6-flash';

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

const model = getGenerativeModel(ai, {
  model: MODEL_NAME,
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: taskSchema,
    temperature: 0.1
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

function riyadhNowText() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date()).reduce((out, part) => {
    if (part.type !== 'literal') out[part.type] = part.value;
    return out;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
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

function normalizeResult(raw, sourceText, state) {
  const spaces = contextList(state.spaces);
  const people = contextList(state.people);
  const priority = ['normal', 'important', 'strategic'].includes(raw?.priority) ? raw.priority : 'normal';
  const status = ['inbox', 'active', 'waiting'].includes(raw?.status) ? raw.status : 'inbox';
  const title = String(raw?.title || '').trim() || String(sourceText || '').trim();

  return {
    title,
    due: normalizeDate(raw?.due),
    dueTime: normalizeTime(raw?.dueTime),
    follow: normalizeDate(raw?.follow),
    followTime: normalizeTime(raw?.followTime),
    spaceId: allowedId(raw?.spaceId, spaces),
    personId: allowedId(raw?.personId, people),
    priority,
    status,
    points: normalizePoints(raw?.points),
    notes: String(raw?.notes || '').trim(),
    createdAt: new Date().toISOString()
  };
}

async function parseWithGemini(text) {
  const state = readState();
  const spaces = contextList(state.spaces);
  const people = contextList(state.people);
  const prompt = `
أنت محلل أوامر مهام داخل تطبيق عربي سعودي اسمه مسراح.
استخرج من كلام المستخدم مهمة واحدة فقط وحولها إلى البيانات المطلوبة في الـ JSON Schema.

الوقت الحالي في الرياض: ${riyadhNowText()}
المنطقة الزمنية: Asia/Riyadh

المساحات الموجودة في حساب المستخدم:
${JSON.stringify(spaces)}

الأشخاص الموجودون في حساب المستخدم:
${JSON.stringify(people)}

قواعد مهمة:
- افهم اللهجة السعودية والعربية الطبيعية مثل: بكرة، بعد بكرة، الأحد الجاي، العصر، بعد الظهر، الليل.
- title عنوان عملي مختصر، ويحافظ على اسم الشخص أو الجهة إذا كان مهما لفهم المهمة.
- due و follow بصيغة YYYY-MM-DD. إذا لم يذكر المستخدم تاريخا أرجع سلسلة فارغة.
- dueTime و followTime بصيغة HH:MM بنظام 24 ساعة. إذا لم يذكر وقتا أرجع سلسلة فارغة.
- spaceId اختر فقط id موجودا في قائمة المساحات إذا كان التطابق واضحا، وإلا سلسلة فارغة.
- personId اختر فقط id موجودا في قائمة الأشخاص إذا كان التطابق واضحا، وإلا سلسلة فارغة.
- priority: normal عادة، important إذا قال مهم أو عاجل أو ظهر أنها أولوية عالية، strategic فقط للمهام الاستراتيجية الواضحة.
- status: inbox هو الافتراضي. استخدم waiting فقط إذا كان المستخدم يصف شيئا قائما بالفعل وينتظر ردا أو إجراء من شخص آخر.
- points واحدة من 5 أو 10 أو 20 أو 30 بحسب حجم المهمة.
- notes للتفاصيل المهمة التي لا تناسب العنوان. لا تكرر العنوان.
- لا تخترع تاريخا أو شخصا أو مساحة غير مفهومة من الكلام.

نص المستخدم:
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
  const newTaskButton = document.getElementById('newTaskBtn');
  newTaskButton?.click();

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

function renderPreview(task) {
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

function renderThinking() {
  const preview = document.getElementById('flyPreview');
  if (!preview) return;
  preview.innerHTML = '<strong>يفهم المهمة…</strong><small>جيمناي يرتب الموعد والمتابعة والتفاصيل</small>';
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

  const localSendHandler = send.onclick;
  let busy = false;

  const run = async () => {
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true;
    send.disabled = true;
    send.textContent = 'يفهم…';
    renderThinking();

    try {
      const task = await parseWithGemini(text);
      renderPreview(task);
    } catch (error) {
      console.error('Mesraah Gemini fly parser:', error);
      showToast('تعذر فهمها بالذكاء الآن، استخدمت التحليل المحلي');
      if (typeof localSendHandler === 'function') localSendHandler.call(send);
    } finally {
      busy = false;
      send.disabled = false;
      send.textContent = 'إضافة';
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
