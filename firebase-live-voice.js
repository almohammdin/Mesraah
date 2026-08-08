import { getApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  getAI,
  getLiveGenerativeModel,
  GoogleAIBackend,
  ResponseModality,
  startAudioConversation
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-ai.js';

const DATA_KEY='mesraah_v030';
const MODEL='gemini-2.5-flash-native-audio-preview-12-2025';
let session=null;
let controller=null;
let starting=false;

function stateContext(){
  try{
    const state=JSON.parse(localStorage.getItem(DATA_KEY)||'{}')||{};
    const tasks=(state.tasks||[]).filter(t=>t.status!=='done').sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).slice(0,25).map(t=>({title:t.title,due:t.due||'',follow:t.follow||'',status:t.status||'',priority:t.priority||''}));
    const people=(state.people||[]).slice(0,30).map(p=>({name:p.name,relation:p.relation||'',city:p.city||''}));
    const calendar=window.MesraahCalendar?.getCachedEvents?.().slice(0,20)||[];
    return {name:state.profile?.name||'',tasks,people,calendar};
  }catch{return {tasks:[],people:[],calendar:[]};}
}

function systemInstruction(){
  const ctx=stateContext();
  return `أنت مسراح، مساعد شخصي سعودي صوتي. تحدث بالعربية السعودية الطبيعية وبجمل قصيرة مناسبة لشخص يقود السيارة.\n\nاقرأ بيانات المستخدم التالية قبل الإجابة:\n${JSON.stringify(ctx)}\n\nإذا سألك وش عندي اليوم أو بكرة، اعتمد على المهام والمواعيد الموجودة فقط. لا تخترع مواعيد. إذا لم يكن Google Calendar متصلا أو لا توجد بيانات تقويم قل ذلك ببساطة. اقترح الخطوة التالية عندما تكون مفيدة، لكن لا تدّع أنك أنشأت أو عدلت مهمة أو موعدا من المحادثة الصوتية. قل للمستخدم إنه يستطيع تأكيدها في على الطاير. كن مختصرا وتفاعليا، وتذكر سياق الحديث داخل الجلسة.`;
}

function ensureUi(){
  if(document.getElementById('v80VoiceOverlay'))return;
  const overlay=document.createElement('div');
  overlay.id='v80VoiceOverlay';
  overlay.className='v80-voice-overlay';
  overlay.hidden=true;
  overlay.innerHTML=`
    <section class="v80-voice-card" role="dialog" aria-modal="true" aria-label="محادثة صوتية مع مسراح">
      <div class="v80-voice-top"><div><span class="v80-voice-kicker">محادثة صوتية</span><strong>تحدث مع مسراح</strong></div><button type="button" id="v80VoiceClose" aria-label="إغلاق">×</button></div>
      <div class="v80-voice-orb"><span></span><span></span><span></span></div>
      <div class="v80-voice-status" id="v80VoiceStatus">جاهز</div>
      <p>اسأله عن يومك ومهامك ومواعيدك وأنت على الطريق.</p>
      <button type="button" class="v80-voice-stop" id="v80VoiceStop">إنهاء المحادثة</button>
    </section>`;
  document.body.appendChild(overlay);
  document.getElementById('v80VoiceClose').onclick=stop;
  document.getElementById('v80VoiceStop').onclick=stop;
}

function setStatus(text,state=''){
  const el=document.getElementById('v80VoiceStatus');if(el)el.textContent=text;
  const overlay=document.getElementById('v80VoiceOverlay');if(overlay)overlay.dataset.state=state;
}

async function start(){
  if(starting||controller)return;
  starting=true;ensureUi();
  const overlay=document.getElementById('v80VoiceOverlay');overlay.hidden=false;
  setStatus('جار الاتصال…','connecting');
  try{
    if(window.MesraahCalendar?.status?.().connected) await window.MesraahCalendar.listUpcoming({days:2,maxResults:20}).catch(()=>{});
    const ai=getAI(getApp(),{backend:new GoogleAIBackend()});
    const liveModel=getLiveGenerativeModel(ai,{
      model:MODEL,
      systemInstruction:systemInstruction(),
      generationConfig:{
        responseModalities:[ResponseModality.AUDIO],
        inputAudioTranscription:{},
        outputAudioTranscription:{},
        contextWindowCompression:{triggerTokens:10000,slidingWindow:{targetTokens:7000}}
      }
    });
    session=await liveModel.connect();
    controller=await startAudioConversation(session);
    setStatus('أسمعك الآن','listening');
  }catch(error){
    console.error('Mesraah Live voice:',error);
    setStatus(error?.name==='NotAllowedError'?'اسمح للمايك ثم جرب مرة ثانية':'تعذر تشغيل المحادثة الصوتية','error');
    await closeSession();
  }finally{starting=false;}
}

async function closeSession(){
  try{if(controller)await controller.stop();}catch{}
  controller=null;
  try{if(session&&!session.isClosed)await session.close();}catch{}
  session=null;
}

async function stop(){
  setStatus('تم إنهاء المحادثة','');
  await closeSession();
  const overlay=document.getElementById('v80VoiceOverlay');
  if(overlay)setTimeout(()=>{overlay.hidden=true;},180);
}

window.MesraahVoice={start,stop,get active(){return Boolean(controller);}};
ensureUi();
