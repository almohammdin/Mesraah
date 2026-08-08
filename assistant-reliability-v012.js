import { getApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app-check.js';
import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-ai.js';

const DATA_KEY='mesraah_v030';
const HISTORY_KEY='mesraah_assistant_history_v1';
const TIME_ZONE='Asia/Riyadh';
const RECAPTCHA_SITE_KEY='6LdgFnstAAAAAJod6T7NgPLzkfFkSYNbc4_q4rfe';

const firebaseApp=getApp();
try{
  initializeAppCheck(firebaseApp,{provider:new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),isTokenAutoRefreshEnabled:true});
}catch(error){
  if(!String(error?.message||'').includes('already'))throw error;
}

const schema=Schema.object({properties:{
  mode:Schema.enumString({enum:['reply','task']}),reply:Schema.string(),confirmed:Schema.boolean(),
  actionType:Schema.enumString({enum:['none','task','calendar','connect_calendar']}),actionLabel:Schema.string(),title:Schema.string(),date:Schema.string(),time:Schema.string(),durationMinutes:Schema.number(),location:Schema.string(),notes:Schema.string(),personId:Schema.string(),spaceId:Schema.string(),priority:Schema.enumString({enum:['normal','important','strategic']}),
  repeat:Schema.enumString({enum:['none','daily','weekly','monthly','yearly']}),repeatInterval:Schema.number(),repeatCount:Schema.number(),repeatUntil:Schema.string()
}});

const ai=getAI(firebaseApp,{backend:new GoogleAIBackend()});
function makeModel(name){return getGenerativeModel(ai,{model:name,generationConfig:{responseMimeType:'application/json',responseSchema:schema,temperature:.15,maxOutputTokens:420}})}
const fastModel=makeModel('gemini-3.5-flash-lite');
const fallbackModel=makeModel('gemini-3.6-flash');

function readState(){try{return JSON.parse(localStorage.getItem(DATA_KEY)||'{}')||{}}catch{return {}}}
function readHistory(){try{const h=JSON.parse(sessionStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(h)?h.slice(-6):[]}catch{return []}}
function normalizeArabic(v=''){return String(v).trim().replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ـ/g,'').replace(/[ًٌٍَُِّْ]/g,'').replace(/\s+/g,' ')}
function desire(text){return /^(ابي|ابغى|ودي|ناوي|افكر|حاب|حابب|اتمنى|يمكن|ممكن)\b/.test(normalizeArabic(text))}
function explicit(text){return /\b(ذكرني|تذكرني|سجل|اضف|حط|اعمل|سوي|كلم|اتصل|ارسل|تابع|راجع|احجز|حدد|رتب|جهز|ادفع|اشتر|خلص|انجز)\b/.test(normalizeArabic(text))}
function validDate(v){v=String(v||'').trim();return /^\d{4}-\d{2}-\d{2}$/.test(v)?v:''}
function validTime(v){v=String(v||'').trim();return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v)?v:''}
function allowedId(id,list){id=String(id||'');return (list||[]).some(x=>String(x.id)===id)?id:''}

function nowContext(){
  const now=new Date();const tomorrow=new Date(now.getTime()+86400000);
  const iso=d=>new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  const ar=(d,cal)=>new Intl.DateTimeFormat(`ar-SA-u-ca-${cal}-nu-latn`,{timeZone:TIME_ZONE,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d).replace(/،/g,'');
  return {today:iso(now),tomorrow:iso(tomorrow),todayAr:ar(now,'gregory'),todayHijri:ar(now,'islamic-umalqura')};
}

function compact(){
  const s=readState();return {
    profile:{name:s.profile?.name||''},
    tasks:(s.tasks||[]).filter(t=>t.status!=='done').sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).slice(0,15).map(t=>({id:t.id,title:t.title,due:t.due||'',time:t.time||'',follow:t.follow||'',status:t.status||'',priority:t.priority||'',spaceId:t.spaceId||'',personId:t.personId||'',recurrence:t.recurrence||null})),
    spaces:(s.spaces||[]).slice(0,20).map(x=>({id:x.id,name:x.name})),
    people:(s.people||[]).slice(0,25).map(x=>({id:x.id,name:x.name,relation:x.relation||'',city:x.city||'',organization:x.organization||''})),
    calendar:(window.MesraahCalendar?.getCachedEvents?.()||[]).slice(0,12)
  };
}

function promptFor(text,ctx){
  const dt=nowContext();return `أنت مسراح، مساعد شخصي سعودي. رد باختصار ولهجة سعودية سهلة.\n
قواعد التنفيذ:\n- السؤال عن الموجود: جاوب من السياق فقط.\n- الرغبة مثل ودي/أبغى/أفكر ليست حفظا تلقائيا ما لم تكن صيغة أمر واضحة.\n- أمر صريح بإضافة مهمة: actionType=task واكتب بيانات المهمة.\n- موعد يراد إضافته مباشرة للتقويم: actionType=calendar.\n- لا تقل تم قبل تنفيذ التطبيق.\n- إذا قال نعم/تمام/اعتمد بعد اقتراح إجراء سابق، confirmed=true وأعد بيانات الإجراء.\n- للتكرار استخدم repeat: daily أو weekly أو monthly أو yearly. repeatInterval افتراضيا 1. إذا قال 5 مرات ضع repeatCount=5. إذا قال حتى تاريخ معين ضع repeatUntil بصيغة YYYY-MM-DD ولا تجمع count وuntil.\n- إذا لا يوجد تكرار repeat=none.\n
اليوم ${dt.today} | ${dt.todayAr} | ${dt.todayHijri}\nغدا ${dt.tomorrow}\nالسياق: ${JSON.stringify(ctx)}\nآخر المحادثة: ${JSON.stringify(readHistory())}\nرسالة المستخدم: ${text}`;
}

function withTimeout(promise,ms){let timer;return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{timer=setTimeout(()=>{const e=new Error('model-timeout');e.code='model-timeout';reject(e)},ms)})]).finally(()=>clearTimeout(timer))}
async function generate(prompt){
  try{return await withTimeout(fastModel.generateContent(prompt),8500)}
  catch(first){console.warn('Mesraah fast text model:',first);return withTimeout(fallbackModel.generateContent(prompt),9000)}
}

function normalizeResult(raw,text,ctx){
  let mode=raw?.mode==='task'?'task':'reply';if(desire(text)&&!explicit(text))mode='reply';
  const type=['none','task','calendar','connect_calendar'].includes(raw?.actionType)?raw.actionType:'none';
  const repeat=['daily','weekly','monthly','yearly'].includes(raw?.repeat)?raw.repeat:'none';
  return {mode,reply:String(raw?.reply||'').trim(),confirmed:Boolean(raw?.confirmed),action:{
    type,label:String(raw?.actionLabel||'').trim(),title:String(raw?.title||'').trim(),date:validDate(raw?.date),time:validTime(raw?.time),durationMinutes:Math.max(15,Math.min(480,Number(raw?.durationMinutes)||60)),location:String(raw?.location||'').trim(),notes:String(raw?.notes||'').trim(),personId:allowedId(raw?.personId,ctx.people),spaceId:allowedId(raw?.spaceId,ctx.spaces),priority:['normal','important','strategic'].includes(raw?.priority)?raw.priority:'normal',repeat,repeatInterval:Math.max(1,Math.min(99,Math.round(Number(raw?.repeatInterval)||1))),repeatCount:Math.max(0,Math.min(999,Math.round(Number(raw?.repeatCount)||0))),repeatUntil:validDate(raw?.repeatUntil)
  }};
}

async function ask(text){
  const ctx=compact();const response=await generate(promptFor(text,ctx));const payload=response?.response?.text?.();if(!payload)throw new Error('empty-assistant-response');return normalizeResult(JSON.parse(payload),text,ctx);
}

const prior=window.MesraahAssistant||{};
window.MesraahAssistant={...prior,ask,readHistory,clearHistory:()=>sessionStorage.removeItem(HISTORY_KEY)};
