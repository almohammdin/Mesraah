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
const HISTORY_KEY = 'mesraah_assistant_history_v1';
const RECAPTCHA_SITE_KEY = '6LdgFnstAAAAAJod6T7NgPLzkfFkSYNbc4_q4rfe';
const MODEL = 'gemini-3.5-flash-lite';
const TIME_ZONE = 'Asia/Riyadh';

const firebaseApp = getApp();
try {
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });
} catch (error) {
  if (!String(error?.message || '').includes('already')) console.warn('Mesraah App Check:', error);
}

const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
const schema = Schema.object({
  properties: {
    mode: Schema.enumString({ enum: ['reply', 'task'] }),
    reply: Schema.string(),
    confirmed: Schema.boolean(),
    actionType: Schema.enumString({ enum: ['none', 'task', 'calendar', 'connect_calendar'] }),
    actionLabel: Schema.string(),
    title: Schema.string(),
    date: Schema.string(),
    time: Schema.string(),
    durationMinutes: Schema.number(),
    location: Schema.string(),
    notes: Schema.string(),
    personId: Schema.string(),
    spaceId: Schema.string(),
    priority: Schema.enumString({ enum: ['normal', 'important', 'strategic'] })
  }
});

const model = getGenerativeModel(ai, {
  model: MODEL,
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: schema,
    temperature: 0.2,
    maxOutputTokens: 520
  }
});

function readState() {
  try { return JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {}; }
  catch { return {}; }
}

function readHistory() {
  try {
    const value = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(value) ? value.slice(-8) : [];
  } catch { return []; }
}

function saveHistory(items) {
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(-8)));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>\"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[char]));
}

function normalizeArabic(value = '') {
  return String(value).trim().replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ـ/g,'').replace(/[ًٌٍَُِّْ]/g,'').replace(/\s+/g,' ');
}

function desireStatement(text) {
  return /^(ابي|ابغى|ودي|ناوي|افكر|حاب|حابب|اتمنى|يمكن|ممكن)\b/.test(normalizeArabic(text));
}

function explicitTask(text) {
  const s = normalizeArabic(text);
  return /\b(ذكرني|تذكرني|سجل|سجلها|سجل لي|اضف|اضف لي|حط موعد|حط تذكير|اعمل تذكير|سوي تذكير|كلم|اتصل|ارسل|ابعث|تابع|راجع|احجز|حدد|رتب|جهز|ادفع|اشتر|خلص|انجز)\b/.test(s);
}

function dateContext() {
  const now = new Date();
  const fmt = (date, calendar) => new Intl.DateTimeFormat(`ar-SA-u-ca-${calendar}-nu-latn`, {
    timeZone: TIME_ZONE, weekday:'long', day:'numeric', month:'long', year:'numeric'
  }).format(date).replace(/،/g,'').replace(/\s+/g,' ').trim();
  const iso = date => {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone:TIME_ZONE, year:'numeric', month:'2-digit', day:'2-digit' })
      .formatToParts(date).reduce((o,p)=>{if(p.type!=='literal')o[p.type]=p.value;return o;},{});
    return `${p.year}-${p.month}-${p.day}`;
  };
  const tomorrow = new Date(now.getTime() + 86400000);
  return {
    todayIso: iso(now),
    tomorrowIso: iso(tomorrow),
    todayGregorian: fmt(now,'gregory'),
    tomorrowGregorian: fmt(tomorrow,'gregory'),
    todayHijri: fmt(now,'islamic-umalqura'),
    tomorrowHijri: fmt(tomorrow,'islamic-umalqura')
  };
}

function compactState() {
  const state = readState();
  const today = dateContext().todayIso;
  const tasks = (state.tasks || [])
    .filter(t => t.status !== 'done')
    .sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'))
    .slice(0,24)
    .map(t => ({ id:t.id, title:t.title, due:t.due||'', follow:t.follow||'', status:t.status||'', priority:t.priority||'', spaceId:t.spaceId||'', personId:t.personId||'' }));
  return {
    profile: { name: state.profile?.name || '' },
    today,
    spaces: (state.spaces || []).slice(0,30).map(x => ({ id:x.id, name:x.name })),
    people: (state.people || []).slice(0,40).map(x => ({ id:x.id, name:x.name, relation:x.relation||'', city:x.city||'', organization:x.organization||'', note:x.note||'' })),
    tasks
  };
}

function calendarContext() {
  return window.MesraahCalendar?.getCachedEvents?.().slice(0,24) || [];
}

function allowedId(value, list) {
  const id = String(value || '');
  return list.some(x => String(x.id) === id) ? id : '';
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function normalizeTime(value) {
  const text = String(value || '').trim();
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : '';
}

function normalizeResult(raw, text, context) {
  let mode = raw?.mode === 'task' ? 'task' : 'reply';
  if (desireStatement(text) && !explicitTask(text)) mode = 'reply';
  const actionType = ['none','task','calendar','connect_calendar'].includes(raw?.actionType) ? raw.actionType : 'none';
  return {
    mode,
    reply: String(raw?.reply || '').trim(),
    confirmed: Boolean(raw?.confirmed),
    action: {
      type: actionType,
      label: String(raw?.actionLabel || '').trim(),
      title: String(raw?.title || '').trim(),
      date: normalizeDate(raw?.date),
      time: normalizeTime(raw?.time),
      durationMinutes: Math.max(15, Math.min(480, Number(raw?.durationMinutes) || 60)),
      location: String(raw?.location || '').trim(),
      notes: String(raw?.notes || '').trim(),
      personId: allowedId(raw?.personId, context.people),
      spaceId: allowedId(raw?.spaceId, context.spaces),
      priority: ['normal','important','strategic'].includes(raw?.priority) ? raw.priority : 'normal'
    }
  };
}

function assistantPrompt(text) {
  const context = compactState();
  const calendar = calendarContext();
  const dates = dateContext();
  const history = readHistory();
  const calendarConnected = Boolean(window.MesraahCalendar?.status?.().connected);

  return {
    context,
    prompt: `أنت مسراح، مساعد شخصي سعودي لإدارة يوم المستخدم. لست مجرد محول كلام إلى مهام.

هدفك أن تكون محادثتك طبيعية وسياقية وذكية:
- اقرأ سياق مهام المستخدم والأشخاص والمساحات والمواعيد المرفق أدناه قبل الرد.
- اربط كلام المستخدم بما عنده فعلا إذا كان هناك ارتباط حقيقي، ولا تخترع علاقة أو مدينة أو موعد غير موجود.
- إذا قال رغبة مثل "ابغى أزور خالتي بكرة" فهذا reply، ورد طبيعي مثل "فكرة طيبة" ثم إن كان مفيدا اقترح إجراء محددا: موعد أو مهمة. لا تحوله مباشرة إلى مهمة.
- إذا كان لديه موعد قريب في نفس اليوم أو المكان وكان ذلك موجودا في البيانات، استخدمه في الاقتراح.
- إذا طلب صراحة "ذكرني/سجل/أضف/كلم/تابع..." فيمكن mode=task وإظهار معاينة تنفيذية.
- إذا كان الرد يحتاج اقتراحا، اجعل actionType=task أو calendar واكتب actionLabel قصيرا مثل "أضف الزيارة".
- إذا كان التقويم غير متصل واقتراحك يحتاج Calendar، استخدم connect_calendar.
- لا تقل أبدا إنك أضفت أو حفظت شيئا قبل موافقة المستخدم.
- إذا كانت الرسالة الحالية "إي/نعم/تمام/اعتمد" وكانت آخر رسالة منك تتضمن اقتراح إجراء واضح في السجل، اعتبرها موافقة: confirmed=true وأعد نفس الإجراء وبياناته حتى ينفذ التطبيق.
- إذا لم تكن هناك حاجة لإجراء، actionType=none.
- الرد باللهجة السعودية الطبيعية، مختصر، ذكي وغير متكلف.

السياق الزمني المؤكد:
اليوم: ${dates.todayIso} | ${dates.todayGregorian} | ${dates.todayHijri}
غدا: ${dates.tomorrowIso} | ${dates.tomorrowGregorian} | ${dates.tomorrowHijri}

التقويم متصل: ${calendarConnected ? 'نعم' : 'لا'}

بيانات مسراح:
${JSON.stringify(context)}

مواعيد Google Calendar القريبة:
${JSON.stringify(calendar)}

آخر المحادثة:
${JSON.stringify(history)}

رسالة المستخدم:
${text}
`
  };
}

function refreshCalendarInBackground() {
  if (!window.MesraahCalendar?.status?.().connected) return;
  const refresh = window.MesraahCalendar.listUpcoming?.({ days: 7, maxResults: 30 });
  if (refresh?.catch) refresh.catch(() => {});
}

async function ask(text) {
  refreshCalendarInBackground();
  const { context, prompt } = assistantPrompt(text);
  const response = await model.generateContent(prompt);
  const payload = response?.response?.text?.();
  if (!payload) throw new Error('empty-assistant-response');
  return normalizeResult(JSON.parse(payload), text, context);
}

function populateTaskForm(action) {
  const values = {
    taskId:'', taskTitle:action.title, taskNotes:action.notes,
    taskSpace:action.spaceId, taskPerson:action.personId,
    taskStatus:'inbox', taskPriority:action.priority,
    taskDue:action.date, taskFollow:'', taskPoints:'10'
  };
  Object.entries(values).forEach(([id,value]) => { const el=document.getElementById(id); if(el) el.value=value||''; });
  const title = document.getElementById('taskModalTitle'); if(title) title.textContent='مهمة جديدة';
  const del = document.getElementById('deleteTaskBtn'); if(del) del.hidden=true;
}

function saveTask(action) {
  populateTaskForm(action);
  const dialog=document.getElementById('taskModal');
  const form=document.getElementById('taskForm');
  if(dialog && !dialog.open) dialog.showModal();
  form?.requestSubmit();
}

function openTask(action) {
  populateTaskForm(action);
  const dialog=document.getElementById('taskModal');
  if(dialog && !dialog.open) dialog.showModal();
}

async function executeAction(action) {
  if (action.type === 'calendar') {
    if (!window.MesraahCalendar?.status?.().connected) return { ok:false, needsConnect:true };
    const event = await window.MesraahCalendar.createEvent({
      title:action.title, date:action.date, time:action.time,
      durationMinutes:action.durationMinutes, location:action.location, description:action.notes
    });
    return { ok:true, kind:'calendar', event };
  }
  if (action.type === 'task') {
    saveTask(action);
    return { ok:true, kind:'task' };
  }
  return { ok:false };
}

function renderThinking() {
  const box=document.getElementById('flyPreview'); if(!box)return;
  box.classList.add('show','v80-assistant');
  box.innerHTML='<div class="v80-assistant-label">مسراح</div><div class="v80-thinking"><span></span><span></span><span></span></div>';
}

function recordHistory(userText, result) {
  const history=readHistory();
  history.push({ role:'user', text:userText });
  history.push({ role:'assistant', text:result.reply, action:result.action });
  saveHistory(history);
}

function renderResult(userText, result) {
  const box=document.getElementById('flyPreview'); if(!box)return;
  box.classList.add('show','v80-assistant');
  const action=result.action;
  const hasAction=action.type!=='none' && action.title;
  const meta=[action.date,action.time,action.location].filter(Boolean).map(escapeHtml).join(' • ');
  box.innerHTML=`
    <div class="v80-assistant-label"><span>✦</span> مسراح</div>
    <div class="fly-ai-answer">${escapeHtml(result.reply || 'تفضل.').replace(/\n/g,'<br>')}</div>
    ${hasAction ? `<div class="v80-action-card"><div><strong>${escapeHtml(action.title)}</strong>${meta?`<small>${meta}</small>`:''}</div><div class="v80-action-buttons"><button type="button" class="v80-action-primary" id="v80ActionDo">${escapeHtml(action.label || (action.type==='calendar'?'أضف للموعد':'أضف المهمة'))}</button>${action.type==='task'?'<button type="button" class="v80-action-edit" id="v80ActionEdit">تعديل</button>':''}</div></div>` : ''}`;

  if (hasAction) {
    document.getElementById('v80ActionDo')?.addEventListener('click', async () => {
      const button=document.getElementById('v80ActionDo'); if(button)button.disabled=true;
      try {
        if(action.type==='connect_calendar') {
          await window.MesraahCalendar?.connect?.();
          if(button){button.textContent='تم ربط التقويم';button.disabled=true;}
          return;
        }
        const done=await executeAction(action);
        if(done.needsConnect) {
          await window.MesraahCalendar?.connect?.();
          const retry=await executeAction(action);
          if(!retry.ok) throw new Error('calendar-action-failed');
        }
        if(button){button.textContent=action.type==='calendar'?'تمت الإضافة للتقويم':'تمت الإضافة';button.disabled=true;}
      } catch(error) {
        console.error('Mesraah action:',error);
        if(button){button.textContent='تعذر التنفيذ';button.disabled=false;}
      }
    });
    document.getElementById('v80ActionEdit')?.addEventListener('click',()=>openTask(action));
  }

  recordHistory(userText,result);
}

function toast(message) {
  const el=document.getElementById('toast'); if(!el)return;
  el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2500);
}

function install() {
  const input=document.getElementById('flyInput');
  const send=document.getElementById('flySend');
  const voice=document.getElementById('flyVoice');
  if(!input||!send||!voice)return;
  let busy=false;

  const run=async()=>{
    const text=input.value.trim();if(!text||busy)return;
    busy=true;send.disabled=true;send.textContent='يفكر…';renderThinking();
    try {
      const result=await ask(text);
      if(result.confirmed && ['task','calendar'].includes(result.action.type)) {
        const done=await executeAction(result.action).catch(()=>({ok:false}));
        if(done.ok) result.reply += result.action.type==='calendar' ? ' وتمت إضافته للتقويم.' : ' وتمت إضافته لمسراح.';
      }
      renderResult(text,result);
    } catch(error) {
      console.error('Mesraah contextual assistant:',error);
      const box=document.getElementById('flyPreview');
      if(box){box.classList.add('show');box.innerHTML='<div class="v80-assistant-label">مسراح</div><div class="fly-ai-answer">تعذر الرد الآن. جرب مرة ثانية.</div>';}
    } finally {busy=false;send.disabled=false;send.textContent='إرسال';}
  };

  send.onclick=run;
  input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();event.stopImmediatePropagation();run();}},true);

  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(SR) {
    voice.onclick=()=>{
      if(busy)return;
      const r=new SR();r.lang='ar-SA';r.interimResults=false;voice.classList.add('listening');r.start();
      r.onresult=e=>{input.value=e.results[0][0].transcript;run();};
      r.onend=()=>voice.classList.remove('listening');
      r.onerror=()=>{voice.classList.remove('listening');toast('تعذر تشغيل المايك');};
    };
  }
}

window.MesraahAssistant = { ask, readHistory, clearHistory:()=>sessionStorage.removeItem(HISTORY_KEY) };
install();
