import { getAI, getLiveGenerativeModel, GoogleAIBackend, ResponseModality, startAudioConversation } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-ai.js';
import { TASK_TOOL_DECLARATIONS, executeTaskTool } from './mesraah-voice-tools.js?v=0.18.0';

const DATA_KEY='mesraah_v030';
const MODEL='gemini-2.5-flash-native-audio-preview-12-2025';
let session=null;
let controller=null;
let active=false;

function readState(){try{return JSON.parse(localStorage.getItem(DATA_KEY)||'{}')||{}}catch{return {}}}
function setStatus(text,state=''){const el=document.getElementById('mesraahVoiceStatus');if(el)el.textContent=text;const host=document.getElementById('v80VoiceOverlay');if(host)host.dataset.state=state}
function setDetail(text){const el=document.getElementById('mesraahVoiceDetail');if(el)el.textContent=String(text||'')}
function ensureUi(){if(document.getElementById('v80VoiceOverlay'))return;const host=document.createElement('div');host.id='v80VoiceOverlay';host.className='v80-voice-overlay';host.hidden=true;host.innerHTML='<section class="v80-voice-card" role="dialog" aria-modal="true" aria-label="محادثة صوتية مع مسراح"><div class="v80-voice-top"><div><span class="v80-voice-kicker">مسراح</span><strong>تحدث مع مسراح</strong></div><button type="button" id="mesraahVoiceClose" aria-label="إغلاق">×</button></div><div class="v80-voice-orb"><span></span><span></span><span></span></div><div class="v80-voice-status" id="mesraahVoiceStatus">جاهز</div><div class="mesraah-voice-detail" id="mesraahVoiceDetail">تكلم بشكل طبيعي، ومسراح يقرأ بياناتك الحالية وينفذ معك.</div><div class="mesraah-voice-actions"><button type="button" class="v80-voice-stop" id="mesraahVoiceStop">إنهاء المحادثة</button></div></section>';document.body.appendChild(host);document.getElementById('mesraahVoiceClose').onclick=stop;document.getElementById('mesraahVoiceStop').onclick=stop}

function instruction(){const s=readState();const tasks=(s.tasks||[]).filter(t=>t.status!=='done').slice(0,50).map(t=>({id:t.id,title:t.title,due:t.due||'',time:t.time||'',status:t.status||'',priority:t.priority||'',spaceId:t.spaceId||'',personId:t.personId||''}));const spaces=(s.spaces||[]).slice(0,40).map(x=>({id:x.id,name:x.name}));const people=(s.people||[]).slice(0,50).map(x=>({id:x.id,name:x.name}));return `أنت مسراح، مساعد شخصي سعودي صوتي. تكلم باختصار وبلهجة سعودية سهلة.
مسراح نفسه هو مصدر الحقيقة والذاكرة الأساسية. لا تعتمد على ذاكرة المحادثة وحدها.
عند أي سؤال عن المهام الحالية استخدم search_tasks عند الحاجة. عند الإضافة استخدم add_task، وعند التعديل ابحث أولا ثم update_task، وعند الحذف ابحث أولا ثم delete_task، وعند الإنجاز استخدم complete_task.
لا تقل تم أو أضفت أو عدلت أو حذفت أو أنجزت إلا بعد أن ترجع أداة مسراح ok=true ويكتمل الحفظ.
إذا أعطاك المستخدم أكثر من مهمة في طلب واحد، نفذ كل المهام المطلوبة تباعا إذا كان طلبه صريحا بإضافتها جميعا. إذا كان الطلب يحتمل التدرج، بعد تنفيذ الأولى أخبره بما تم وما بقي واسأله عن التالية.
بيانات مسراح الحالية: ${JSON.stringify({name:s.profile?.name||'',tasks,spaces,people})}`}

async function runTools(functionCalls=[]){const calls=Array.isArray(functionCalls)?functionCalls:[];if(!calls.length)return {name:'mesraah',response:{ok:false,error:'no-function-calls'}};let lastResponse={name:calls[0]?.name||'mesraah',response:{ok:false,error:'not-run'}};for(const call of calls){setStatus('أنفذ طلبك…','connecting');let result;try{result=await executeTaskTool(call.name,call.args||{});if(result?.ok&&call.name!=='search_tasks'){const cloud=await window.MesraahCloudBridge?.saveNow?.();if(cloud?.ok===false)result={ok:false,error:'cloud-save-not-confirmed'}}}catch(error){result={ok:false,error:String(error?.message||error)}}lastResponse={name:call.name,response:result||{ok:false,error:'empty-result'}};setDetail(result?.ok?'تم تنفيذ طلبك في مسراح.':'تعذر إكمال التنفيذ في مسراح.')}return lastResponse}

function explain(error){const m=String(error?.message||error||'');if(/NotAllowedError|permission|microphone/i.test(m))return 'يحتاج مسراح إذن استخدام الميكروفون.';if(/app.?check/i.test(m))return 'تعذر التحقق من أمان الاتصال عبر Firebase.';if(/model|404|not found/i.test(m))return 'تعذر بدء نموذج المحادثة الصوتية في Firebase.';if(/quota|429/i.test(m))return 'خدمة المحادثة الصوتية وصلت حد الاستخدام مؤقتا.';return `تعذر تشغيل المحادثة الصوتية عبر Firebase${m?`: ${m.slice(0,110)}`:''}`}

async function start(){if(active)return;ensureUi();const host=document.getElementById('v80VoiceOverlay');host.hidden=false;active=true;setStatus('أجهز المحادثة…','connecting');setDetail('أتصل بمسراح عبر Firebase مباشرة…');try{const app=window.MesraahVoiceFirebaseApp;if(!app)throw new Error('firebase-voice-app-not-ready');const ai=getAI(app,{backend:new GoogleAIBackend()});const model=getLiveGenerativeModel(ai,{model:MODEL,generationConfig:{responseModalities:[ResponseModality.AUDIO],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:'Kore'}}}},systemInstruction:{role:'system',parts:[{text:instruction()}]},tools:[{functionDeclarations:TASK_TOOL_DECLARATIONS}]});session=await model.connect();if(!active){await session?.close?.();return}controller=await startAudioConversation(session,{functionCallingHandler:runTools});setStatus('أسمعك الآن','listening');setDetail('تكلم بشكل طبيعي. مسراح يقرأ مهامك ومساحاتك وأشخاصك الحالية وينفذ معك.')}catch(error){console.error('Mesraah Firebase Live start:',error);setStatus('تعذر تشغيل المحادثة الصوتية','error');setDetail(explain(error));active=false;try{await controller?.stop?.()}catch{}try{await session?.close?.()}catch{}controller=session=null;throw error}}

async function stop(){active=false;try{await controller?.stop?.()}catch{}try{await session?.close?.()}catch{}controller=session=null;setStatus('انتهت المحادثة','');const host=document.getElementById('v80VoiceOverlay');if(host)setTimeout(()=>{host.hidden=true},100)}

window.MesraahVoice={start,stop,get active(){return active}};
ensureUi();
