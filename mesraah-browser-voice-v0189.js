import { executeTaskTool } from './mesraah-voice-tools.js?v=0.18.9';

const DATA_KEY='mesraah_v030';
const HISTORY_KEY='mesraah_assistant_history_v1';
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
let active=false;
let recognition=null;
let speaking=false;
let processing=false;
let restartTimer=null;

function readState(){try{return JSON.parse(localStorage.getItem(DATA_KEY)||'{}')||{}}catch{return {}}}
function setStatus(text,state=''){const el=document.getElementById('mesraahVoiceStatus');if(el)el.textContent=text;const host=document.getElementById('v80VoiceOverlay');if(host)host.dataset.state=state}
function setDetail(text){const el=document.getElementById('mesraahVoiceDetail');if(el)el.textContent=String(text||'')}
function ensureUi(){
  let host=document.getElementById('v80VoiceOverlay');
  if(host)return host;
  host=document.createElement('div');host.id='v80VoiceOverlay';host.className='v80-voice-overlay';host.hidden=true;
  host.innerHTML='<section class="v80-voice-card" role="dialog" aria-modal="true" aria-label="محادثة صوتية مع مسراح"><div class="v80-voice-top"><div><span class="v80-voice-kicker">مسراح</span><strong>تحدث مع مسراح</strong></div><button type="button" id="mesraahVoiceClose" aria-label="إغلاق">×</button></div><div class="v80-voice-orb"><span></span><span></span><span></span></div><div class="v80-voice-status" id="mesraahVoiceStatus">جاهز</div><div class="mesraah-voice-detail" id="mesraahVoiceDetail">تكلم بشكل طبيعي. الصوت يستخدم نفس مساعد مسراح وبياناته الحالية.</div><div class="mesraah-voice-actions"><button type="button" class="v80-voice-stop" id="mesraahVoiceStop">إنهاء المحادثة</button></div></section>';
  document.body.appendChild(host);
  document.getElementById('mesraahVoiceClose').onclick=stop;
  document.getElementById('mesraahVoiceStop').onclick=stop;
  return host;
}
function installStyles(){if(document.getElementById('mesraahBrowserVoice0189'))return;const style=document.createElement('style');style.id='mesraahBrowserVoice0189';style.textContent='.v80-voice-overlay[data-state="listening"] .v80-voice-orb{animation:v80Breath 1s ease-in-out infinite}.v80-voice-overlay[data-state="thinking"] .v80-voice-orb{animation:v80Breath 1.3s ease-in-out infinite}.v80-voice-overlay[data-state="speaking"] .v80-voice-orb{animation:v80Breath .72s ease-in-out infinite}.mesraah-voice-detail{min-height:52px;margin:10px auto 15px;padding:10px 12px;border:1px solid rgba(255,255,255,.11);border-radius:14px;background:rgba(255,255,255,.055);color:rgba(255,255,255,.86);font-size:13px;line-height:1.7;text-align:right;overflow-wrap:anywhere}.mesraah-voice-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}';document.head.appendChild(style)}
function normalizeText(text=''){return String(text).replace(/\s+/g,' ').trim()}
function recordHistory(userText,result){try{const current=JSON.parse(sessionStorage.getItem(HISTORY_KEY)||'[]'),history=Array.isArray(current)?current:[];history.push({role:'user',text:userText});history.push({role:'assistant',text:result?.reply||'',action:result?.action||null});sessionStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(-8)))}catch{}}
function nameById(list,id){return(list||[]).find(item=>String(item.id)===String(id))?.name||''}
function clickView(view){const button=document.querySelector(`.nav-item[data-view="${view}"]`)||document.querySelector(`[data-open-view="${view}"]`);button?.click();return Boolean(button)}
function openEntity(kind,id){if(!id)return false;const button=document.querySelector(`[data-open-entity="${kind}"][data-entity-id="${CSS.escape(String(id))}"]`);button?.click();return Boolean(button)}
function openTask(id){if(!id)return false;const button=document.querySelector(`[data-edit="${CSS.escape(String(id))}"]`);button?.click();return Boolean(button)}
async function persist(){try{return await window.MesraahCloudBridge?.saveNow?.()}catch(error){console.warn('Mesraah browser voice cloud save:',error);return{ok:false,error:String(error?.message||error)}}}
async function addTask(action){const state=readState();const person=nameById(state.people,action.personId),space=nameById(state.spaces,action.spaceId);const result=await executeTaskTool('add_task',{title:action.title||'',due:action.date||'',time:action.time||'',location:action.location||'',notes:action.notes||'',priority:action.priority||'normal',status:'inbox',spaceName:space,peopleNames:person?[person]:[],repeat:action.repeat||'none',repeatInterval:action.repeatInterval||1,repeatCount:action.repeatCount||0,repeatUntil:action.repeatUntil||''});if(result?.ok){const cloud=await persist();if(cloud?.ok===false)return{ok:false,error:'cloud-save-not-confirmed'}}return result||{ok:false,error:'empty-task-result'}}
async function executeAction(action){
  if(!action||action.type==='none')return{ok:false,kind:'none'};
  const viewMap={open_today:'today',open_calendar:'calendar',open_inbox:'inbox',open_spaces:'spaces',open_people:'people',open_followups:'followups',open_achievements:'achievements',open_rewards:'rewards'};
  if(viewMap[action.type])return{ok:clickView(viewMap[action.type]),kind:'navigation'};
  if(action.type==='open_space')return{ok:openEntity('space',action.spaceId),kind:'navigation'};
  if(action.type==='open_person')return{ok:openEntity('person',action.personId),kind:'navigation'};
  if(action.type==='open_task')return{ok:openTask(action.taskId),kind:'navigation'};
  if(action.type==='connect_calendar'){await window.MesraahCalendar?.connect?.();return{ok:Boolean(window.MesraahCalendar?.status?.().connected),kind:'connect'}};
  if(action.type==='task'||action.type==='calendar'){const result=await addTask(action);return{ok:Boolean(result?.ok),kind:'task',task:result?.task,error:result?.error}};
  return{ok:false,kind:'unknown'};
}
function chooseVoice(){const voices=window.speechSynthesis?.getVoices?.()||[];return voices.find(v=>/^ar-SA$/i.test(v.lang))||voices.find(v=>/^ar\b/i.test(v.lang))||null}
function speak(text){return new Promise(resolve=>{const clean=normalizeText(text);if(!clean||!window.speechSynthesis){resolve();return}speaking=true;try{recognition?.abort?.()}catch{}window.speechSynthesis.cancel();const utter=new SpeechSynthesisUtterance(clean);utter.lang='ar-SA';const voice=chooseVoice();if(voice)utter.voice=voice;utter.rate=1;utter.pitch=1;utter.onstart=()=>{setStatus('مسراح يتكلم','speaking');setDetail(`مسراح: ${clean}`)};utter.onend=()=>{speaking=false;resolve()};utter.onerror=()=>{speaking=false;resolve()};window.speechSynthesis.speak(utter)})}
function scheduleListen(delay=180){clearTimeout(restartTimer);if(!active||speaking||processing)return;restartTimer=setTimeout(()=>startListening(),delay)}
function startListening(){if(!active||speaking||processing||!recognition)return;try{recognition.start()}catch(error){if(!/already started|recognition has already started/i.test(String(error?.message||error)))console.warn('Mesraah recognition start:',error)}}
async function handleUserText(text){const clean=normalizeText(text);if(!clean||processing||!active)return;processing=true;setStatus('أفهم طلبك…','thinking');setDetail(`أنت: ${clean}`);try{
  const ask=window.MesraahAssistant?.ask;if(typeof ask!=='function')throw new Error('assistant-not-ready');
  const result=await ask(clean);if(!result)throw new Error('assistant-empty');
  const action=result.action||{type:'none'};let reply=normalizeText(result.reply||'تفضل.');
  const navTypes=new Set(['open_today','open_calendar','open_inbox','open_spaces','open_people','open_followups','open_achievements','open_rewards','open_space','open_person','open_task']);
  if(navTypes.has(action.type)){const done=await executeAction(action);if(done.ok)reply=reply||'تفضل.';else reply=`${reply} تعذر فتح المطلوب.`.trim()}
  else if(result.confirmed&&['task','calendar','connect_calendar'].includes(action.type)){const done=await executeAction(action);reply=done.ok?`${reply} وتم التنفيذ.`.trim():`${reply} لكن التنفيذ لم يكتمل.`.trim()}
  recordHistory(clean,result);
  await speak(reply);
}catch(error){console.error('Mesraah unified browser voice:',error);await speak('تعذر الرد الآن. جرب مرة ثانية.')}finally{processing=false;if(active)scheduleListen(260)}}
function buildRecognition(){if(!SpeechRecognition)return null;const rec=new SpeechRecognition();rec.lang='ar-SA';rec.continuous=false;rec.interimResults=true;rec.maxAlternatives=1;let finalText='';rec.onstart=()=>{finalText='';setStatus('أسمعك الآن','listening');setDetail('تكلم بشكل طبيعي. مسراح يستخدم نفس مهامك ومساحاتك وأشخاصك الحالية.')};rec.onresult=event=>{let interim='';for(let i=event.resultIndex;i<event.results.length;i++){const text=event.results[i][0]?.transcript||'';if(event.results[i].isFinal)finalText+=` ${text}`;else interim+=` ${text}`}const shown=normalizeText(finalText||interim);if(shown)setDetail(`أنت: ${shown}`)};rec.onerror=event=>{const code=String(event.error||'');if(code==='aborted'||code==='no-speech')return;if(code==='not-allowed'||code==='service-not-allowed'){setStatus('الميكروفون يحتاج إذن','error');setDetail('اسمح لمسراح باستخدام الميكروفون من المتصفح ثم افتح المحادثة مرة ثانية.');active=false;return}console.warn('Mesraah speech recognition:',code);setStatus('تعذر سماعك','error');setDetail(`تعذر التقاط الصوت (${code||'غير معروف'}).`)};rec.onend=()=>{const text=normalizeText(finalText);finalText='';if(!active||speaking||processing)return;if(text)void handleUserText(text);else scheduleListen(250)};return rec}
async function ensureAssistant(){if(typeof window.MesraahAssistant?.ask==='function')return;await import('./assistant-reliability-v017.js?v=0.18.9');if(typeof window.MesraahAssistant?.ask!=='function')throw new Error('assistant-not-ready')}
async function start(){if(active)return;installStyles();const host=ensureUi();host.hidden=false;setStatus('أجهز المحادثة…','thinking');setDetail('أربط الصوت بنفس مساعد مسراح…');try{await ensureAssistant();if(!SpeechRecognition)throw new Error('speech-recognition-not-supported');recognition=buildRecognition();active=true;setStatus('أسمعك الآن','listening');setDetail('تكلم بشكل طبيعي. هذه المحادثة تستخدم نفس مساعد مسراح وبياناته الحالية.');startListening()}catch(error){console.error('Mesraah browser voice start:',error);active=false;setStatus('تعذر تشغيل المحادثة الصوتية','error');setDetail(String(error?.message||error).includes('speech-recognition-not-supported')?'المتصفح الحالي لا يدعم التعرف الصوتي المباشر. استخدم Chrome أو Edge لهذه المحادثة.':'تعذر تجهيز مساعد مسراح الآن.')}}
async function stop(){active=false;processing=false;speaking=false;clearTimeout(restartTimer);try{recognition?.abort?.()}catch{}recognition=null;try{window.speechSynthesis?.cancel?.()}catch{}setStatus('انتهت المحادثة','');const host=document.getElementById('v80VoiceOverlay');if(host)setTimeout(()=>{host.hidden=true},100)}

installStyles();ensureUi();
window.MesraahVoice={start,stop,get active(){return active},mode:'unified-browser'};
