import {GoogleGenAI,Modality} from 'https://cdn.jsdelivr.net/npm/@google/genai@2.14.0/+esm';
import {MESRAAH_AGENT_TOOL_DECLARATIONS,executeMesraahAgentTool} from './mesraah-agent-tools-v0200.js?v=0.20.3';

const MODEL='gemini-3.1-flash-live-preview';
const INPUT_RATE=16000;
const OUTPUT_RATE=24000;
const TOOL_TIMEOUT_MS=15000;
const DATA_MUTATION_TOOLS=new Set(['add_task','update_task','delete_task','complete_task']);
const DOCK_ID='mesraahVoiceDock0202';

let active=false;
let session=null;
let micStream=null;
let micContext=null;
let outputContext=null;
let micSource=null;
let micProcessor=null;
let silentGain=null;
let outputWorklet=null;
let outputGain=null;
let micSuppressed=false;
let outputQueuedUntil=0;
let resumeMicTimer=null;
let streamEndSent=false;

function isIOS(){
  return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
}

const IOS_ECHO_GUARD=isIOS();
const endpoint=()=>String(window.MESRAAH_LIVE_TOKEN_ENDPOINT||'https://mesraah-live-token.naif123456.workers.dev/token').trim();
const emitState=(state,label)=>window.dispatchEvent(new CustomEvent('mesraah:voice-state',{detail:{state,label}}));

function contextInstruction(){
  const context=window.MesraahAgentBridge?.getPlatformContext?.()||{};
  return `أنت مسراح، مساعد شخصي سعودي ذكي يعمل كوكيل حي داخل منصة مسراح. هذه محادثة Gemini Live حقيقية، والمنصة أمام المستخدم أثناء الحديث.
تكلم بعربية سعودية سهلة وطبيعية وباختصار. لا تسرد الواجهة ولا تقرأ النصوص آليا.

قاعدة أساسية: إذا كان كلام المستخدم يتعلق بقسم أو عنصر داخل المنصة، نفذ الحركة المناسبة فعليا أمامه ثم تكلم. لا تكتف بوصف مكان الشيء.
- إذا سأل عن التقويم أو المساحات أو الأشخاص أو الوارد أو المتابعات أو الإنجاز أو المكافآت أو الإدارة، انتقل إلى القسم المناسب باستخدام navigate_to_view حتى لو لم يقل كلمة افتح حرفيا، ما دام الانتقال يساعده على رؤية ما تتحدث عنه.
- إذا طلب مساحة أو شخصا محددا أو سأل عنه، استخدم open_entity عندما يكون تحديده ممكنا.
- إذا سأل عن مهمة محددة، استخدم search_tasks أولا، ثم open_task عندما يفيد فتحها لعرض التفاصيل أمامه.
- إذا قال افتح مهمة جديدة: استخدم open_new_task فقط، ولا تحفظ حتى يكون طلب الحفظ أو الإضافة صريحا.
- إذا أعطاك تفاصيل مهمة جديدة: افتح النموذج ثم استخدم fill_task_draft لتظهر الكتابة في الحقول أمامه. إذا كان كلامه أمرا صريحا مثل أضف أو سجل أو احفظ، استخدم save_task confirmed=true بعد تعبئة المسودة.
- إذا طلب تعديل مهمة موجودة: استخدم search_tasks أولا، ثم open_task، ثم set_task_field أو fill_task_draft، ثم save_task فقط إذا طلب التعديل أو الحفظ صراحة.
- إذا سألك عن حقل أو ماذا يكتب فيه: استخدم focus_task_field حتى يرى الحقل الذي تشرحه.
- عند السؤال عن مهمة حالية أو بعد تغيير، استخدم search_tasks أو get_mesraah_context للحصول على أحدث حالة.
- لا تقل تم أو حفظت أو عدلت إلا بعد رجوع الأداة ok=true، وللحفظ يجب أن ترجع persisted=true.
- التغييرات في نموذج المهمة قبل save_task هي مسودة فقط.
- إذا طلب عدة مهام صراحة، نفذ جميعها ولا تتوقف بعد الأولى.
- إذا طلب إنجاز أو حذف مهمة صراحة، استخدم أداة المهمة المناسبة بعد تحديدها دون غموض.
- اسأل سؤالا واحدا قصيرا فقط عندما تكون معلومة لازمة للتنفيذ ناقصة.

مسراح نفسه هو مصدر الحقيقة والذاكرة العملية. لا تعتمد على ذاكرة صوتية منفصلة.
حالة مسراح والواجهة عند بدء المحادثة:
${JSON.stringify(context)}`;
}

function purgeLegacyVoiceUi(){
  document.querySelectorAll('#v80VoiceOverlay,.v80-voice-overlay,#mesraahVoiceOverlay,.mesraah-voice-overlay').forEach(el=>{
    if(el.id!==DOCK_ID)el.remove();
  });
  document.getElementById('mesraahLiveStyles0201')?.remove();
}

function ensureUi(){
  purgeLegacyVoiceUi();
  if(document.getElementById(DOCK_ID))return;
  const host=document.createElement('div');
  host.id=DOCK_ID;
  host.className='mesraah-live-dock-overlay';
  host.hidden=true;
  host.innerHTML=`<section class="mesraah-live-dock-card" role="region" aria-label="محادثة صوتية مع مسراح">
    <div class="mesraah-live-bars" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="mesraah-live-copy"><strong class="mesraah-live-status" id="mesraahVoiceStatus" aria-live="polite">جاهز</strong><p id="mesraahVoiceDetail">تكلم بشكل طبيعي</p></div>
    <button type="button" class="mesraah-live-stop" id="mesraahVoiceStop" aria-label="إنهاء المحادثة">×</button>
  </section>`;
  document.body.appendChild(host);
  document.getElementById('mesraahVoiceStop').onclick=stop;
}

function injectStyles(){
  if(document.getElementById('mesraahLiveStyles0202'))return;
  const style=document.createElement('style');
  style.id='mesraahLiveStyles0202';
  style.textContent=`
    html.mesraah-voice-active #v11VoiceCard{display:none!important}
    .mesraah-live-dock-overlay{position:fixed!important;left:0!important;right:0!important;top:auto!important;bottom:max(10px,env(safe-area-inset-bottom))!important;width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;z-index:10100!important;display:flex!important;justify-content:center!important;align-items:flex-end!important;padding:0 12px!important;margin:0!important;background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;pointer-events:none!important;overflow:visible!important}
    .mesraah-live-dock-overlay[hidden]{display:none!important}
    .mesraah-live-dock-card{width:min(620px,100%)!important;height:auto!important;min-height:56px!important;max-height:72px!important;display:grid!important;grid-template-columns:38px minmax(0,1fr) 36px!important;align-items:center!important;gap:10px!important;padding:7px 9px 7px 11px!important;margin:0!important;border:1px solid rgba(255,255,255,.22)!important;border-radius:15px!important;background:linear-gradient(135deg,#0d3656,#155b72)!important;box-shadow:0 12px 32px rgba(0,0,0,.24)!important;color:#fff!important;pointer-events:auto!important;text-align:right!important;overflow:hidden!important}
    .mesraah-live-bars{width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.13);display:flex;align-items:center;justify-content:center;gap:3px}
    .mesraah-live-bars i{display:block;width:3px;height:12px;border-radius:99px;background:#fff;animation:mesraahVoiceBars0202 .9s ease-in-out infinite}.mesraah-live-bars i:nth-child(2){height:20px;animation-delay:.15s}.mesraah-live-bars i:nth-child(3){animation-delay:.3s}
    @keyframes mesraahVoiceBars0202{50%{transform:scaleY(.45);opacity:.65}}
    .mesraah-live-copy{min-width:0}.mesraah-live-status{display:block;font-size:10.5px}.mesraah-live-dock-card p{margin:2px 0 0!important;padding:0!important;border:0!important;background:transparent!important;color:rgba(255,255,255,.72)!important;font-size:9px!important;line-height:1.35!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;min-height:0!important}
    .mesraah-live-stop{width:34px;height:34px;border:1px solid rgba(255,255,255,.18);border-radius:10px;background:rgba(255,255,255,.09);color:#fff;font:inherit;font-size:19px;line-height:1}
    @media(max-width:520px){.mesraah-live-dock-overlay{padding:0 8px!important}.mesraah-live-dock-card{min-height:52px!important;grid-template-columns:34px minmax(0,1fr) 34px!important;gap:8px!important;padding:6px 7px!important}.mesraah-live-bars{width:32px;height:32px}.mesraah-live-stop{width:32px;height:32px}}
  `;
  document.head.appendChild(style);
}

function setStatus(text,state){
  const el=document.getElementById('mesraahVoiceStatus');
  if(el)el.textContent=text;
  emitState(state,text);
}

function setDetail(text){
  const el=document.getElementById('mesraahVoiceDetail');
  if(el)el.textContent=String(text||'');
}

function bytesToBase64(bytes){
  let binary='';
  for(let i=0;i<bytes.length;i+=0x8000){
    binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  }
  return btoa(binary);
}

function base64ToFloat32(value){
  const binary=atob(value);
  const length=binary.length-(binary.length%2);
  const buffer=new ArrayBuffer(length);
  const bytes=new Uint8Array(buffer);
  for(let i=0;i<length;i++)bytes[i]=binary.charCodeAt(i);
  const pcm=new Int16Array(buffer);
  const out=new Float32Array(pcm.length);
  for(let i=0;i<pcm.length;i++)out[i]=pcm[i]/32768;
  return out;
}

function resampleToInt16(input,sourceRate){
  const ratio=sourceRate/INPUT_RATE;
  const out=new Int16Array(Math.max(1,Math.round(input.length/ratio)));
  for(let i=0;i<out.length;i++){
    const pos=i*ratio;
    const left=Math.floor(pos);
    const right=Math.min(left+1,input.length-1);
    const mix=pos-left;
    const value=(input[left]||0)*(1-mix)+(input[right]||0)*mix;
    const clamped=Math.max(-1,Math.min(1,value));
    out[i]=clamped<0?clamped*32768:clamped*32767;
  }
  return out;
}

async function prepareAudio(){
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx||!navigator.mediaDevices?.getUserMedia)throw new Error('voice-not-supported');
  micContext=new AudioCtx();
  try{outputContext=new AudioCtx({sampleRate:OUTPUT_RATE})}catch{outputContext=new AudioCtx()}
  await Promise.all([micContext.resume(),outputContext.resume()]);
  if(!outputContext.audioWorklet)throw new Error('voice-playback-not-supported');
  await outputContext.audioWorklet.addModule('./mesraah-voice-playback-v0202.worklet.js?v=0.20.3');
  outputWorklet=new AudioWorkletNode(outputContext,'mesraah-voice-playback-0202');
  outputGain=outputContext.createGain();
  outputGain.gain.value=1;
  outputWorklet.connect(outputGain);
  outputGain.connect(outputContext.destination);
  outputQueuedUntil=outputContext.currentTime;
  micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
}

function clearPlayback(){
  try{outputWorklet?.port.postMessage({type:'clear'})}catch{}
  if(outputContext)outputQueuedUntil=outputContext.currentTime;
}

function suppressMicForModelOutput(){
  if(!IOS_ECHO_GUARD||micSuppressed)return;
  micSuppressed=true;
  if(!streamEndSent&&session){
    streamEndSent=true;
    try{session.sendRealtimeInput({audioStreamEnd:true})}catch{}
  }
}

function resumeMicAfterPlayback(){
  clearTimeout(resumeMicTimer);
  if(!IOS_ECHO_GUARD){
    if(active)setStatus('أسمعك الآن','listening');
    return;
  }
  const remainingMs=outputContext?Math.max(0,(outputQueuedUntil-outputContext.currentTime)*1000):0;
  resumeMicTimer=setTimeout(()=>{
    micSuppressed=false;
    streamEndSent=false;
    if(active)setStatus('أسمعك الآن','listening');
  },remainingMs+240);
}

function playPcm(base64){
  if(!active||!outputContext||!outputWorklet||!base64)return;
  suppressMicForModelOutput();
  const samples=base64ToFloat32(base64);
  if(!samples.length)return;
  outputQueuedUntil=Math.max(outputContext.currentTime,outputQueuedUntil)+samples.length/OUTPUT_RATE;
  try{outputWorklet.port.postMessage({samples},[samples.buffer])}catch{outputWorklet.port.postMessage({samples})}
  setStatus('مسراح يتحدث','speaking');
}

async function fetchToken(forceRefresh=false){
  if(typeof window.MesraahLiveGetAppCheckToken!=='function')throw new Error('voice-app-check-not-ready');
  const token=await window.MesraahLiveGetAppCheckToken({forceRefresh});
  const response=await fetch(endpoint(),{
    method:'POST',
    headers:{'Content-Type':'application/json','X-Firebase-AppCheck':token},
    body:'{}'
  });
  const data=await response.json().catch(()=>({}));
  if(response.status===401&&!forceRefresh)return fetchToken(true);
  if(!response.ok||!data.token)throw new Error(`voice-token-failed:${response.status}`);
  return data.token;
}

function withTimeout(promise,ms=TOOL_TIMEOUT_MS){
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error('voice-tool-timeout')),ms);
    })
  ]).finally(()=>clearTimeout(timer));
}

async function persistIfNeeded(call,result){
  if(!result?.ok||!DATA_MUTATION_TOOLS.has(call.name))return result;
  try{
    const cloud=await withTimeout(window.MesraahCloudBridge?.saveNow?.()||Promise.resolve({ok:true,mode:'local'}),8000);
    if(cloud?.ok===false)return {ok:false,error:'cloud-save-not-confirmed'};
  }catch{
    return {ok:false,error:'cloud-save-failed'};
  }
  window.dispatchEvent(new CustomEvent('mesraah:data-changed',{detail:{type:'voice-tool',name:call.name}}));
  return {...result,persisted:true};
}

async function handleToolCalls(calls=[]){
  const responses=[];
  setStatus('أنفذ معك…','working');
  for(const call of calls){
    let result;
    try{
      result=await withTimeout(executeMesraahAgentTool(call.name,call.args||{}));
      result=await persistIfNeeded(call,result);
      if(result?.ok){
        const labels={navigate_to_view:'انتقلت للقسم',open_entity:'فتحت المطلوب',open_new_task:'فتحت مهمة جديدة',open_task:'فتحت المهمة',focus_task_field:'هذا هو الحقل',set_task_field:'كتبت القيمة',fill_task_draft:'عبأت المهمة',save_task:'حفظت المهمة'};
        if(labels[call.name])setDetail(labels[call.name]);
      }
    }catch(error){
      result={ok:false,error:String(error?.message||error)};
    }
    responses.push({name:call.name,id:call.id,response:{result}});
  }
  session?.sendToolResponse({functionResponses:responses});
}

function handleMessage(message){
  if(message?.toolCall?.functionCalls?.length){
    handleToolCalls(message.toolCall.functionCalls).catch(console.error);
  }
  const content=message?.serverContent;
  if(!content)return;
  if(content.interrupted){
    clearPlayback();
    micSuppressed=false;
    streamEndSent=false;
    setStatus('أسمعك الآن','listening');
  }
  if(content.inputTranscription?.text&&!micSuppressed)setDetail(`أنت: ${content.inputTranscription.text}`);
  if(content.outputTranscription?.text)setDetail(`مسراح: ${content.outputTranscription.text}`);
  for(const part of content.modelTurn?.parts||[]){
    if(part.inlineData?.data)playPcm(part.inlineData.data);
  }
  if(content.turnComplete&&active)resumeMicAfterPlayback();
}

function startMic(){
  if(!active||!session||!micContext||!micStream||micProcessor)return;
  micSource=micContext.createMediaStreamSource(micStream);
  micProcessor=micContext.createScriptProcessor(4096,1,1);
  silentGain=micContext.createGain();
  silentGain.gain.value=0;
  micProcessor.onaudioprocess=event=>{
    if(!active||!session||micSuppressed)return;
    const pcm=resampleToInt16(event.inputBuffer.getChannelData(0),micContext.sampleRate);
    const bytes=new Uint8Array(pcm.buffer,pcm.byteOffset,pcm.byteLength);
    try{
      session.sendRealtimeInput({audio:{data:bytesToBase64(bytes),mimeType:`audio/pcm;rate=${INPUT_RATE}`}});
    }catch{}
  };
  micSource.connect(micProcessor);
  micProcessor.connect(silentGain);
  silentGain.connect(micContext.destination);
}

async function shutdown(){
  clearTimeout(resumeMicTimer);
  resumeMicTimer=null;
  micSuppressed=false;
  streamEndSent=false;
  if(micProcessor)micProcessor.onaudioprocess=null;
  try{
    micProcessor?.disconnect();
    micSource?.disconnect();
    silentGain?.disconnect();
    outputWorklet?.disconnect();
    outputGain?.disconnect();
  }catch{}
  micStream?.getTracks?.().forEach(track=>track.stop());
  micStream=null;
  try{await micContext?.close()}catch{}
  try{await outputContext?.close()}catch{}
  micContext=null;
  outputContext=null;
  micProcessor=null;
  micSource=null;
  silentGain=null;
  outputWorklet=null;
  outputGain=null;
}

async function start(){
  if(active)return;
  ensureUi();
  injectStyles();
  document.documentElement.classList.add('mesraah-voice-active');
  const dock=document.getElementById(DOCK_ID);
  if(dock)dock.hidden=false;
  active=true;
  setStatus('أجهز المحادثة…','connecting');
  setDetail('لحظات وأسمعك.');
  try{
    await prepareAudio();
    const token=await fetchToken();
    if(!active)return;
    const ai=new GoogleGenAI({apiKey:token,httpOptions:{apiVersion:'v1alpha'}});
    session=await ai.live.connect({
      model:MODEL,
      config:{
        responseModalities:[Modality.AUDIO],
        systemInstruction:contextInstruction(),
        inputAudioTranscription:{},
        outputAudioTranscription:{},
        speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:'Kore'}}},
        tools:[{functionDeclarations:MESRAAH_AGENT_TOOL_DECLARATIONS}]
      },
      callbacks:{
        onopen:()=>setStatus('متصل بمسراح','connecting'),
        onmessage:handleMessage,
        onerror:event=>console.error('Mesraah Agent Live:',event),
        onclose:()=>{
          if(active){
            setStatus('انقطع الاتصال','error');
            setDetail('انقطع الاتصال الصوتي. حاول مرة أخرى.');
          }
        }
      }
    });
    if(!active)return;
    startMic();
    setStatus('أسمعك الآن','listening');
    setDetail('تكلم بشكل طبيعي. أتنقل وأنفذ معك داخل مسراح.');
  }catch(error){
    console.error('Mesraah Agent Live start:',error);
    setStatus('تعذر تشغيل المحادثة الصوتية','error');
    setDetail(`مرحلة التشغيل: ${String(error?.message||error).slice(0,150)}`);
    try{session?.close?.()}catch{}
    session=null;
    active=false;
    document.documentElement.classList.remove('mesraah-voice-active');
    await shutdown();
    throw error;
  }
}

async function stop(){
  active=false;
  try{session?.close?.()}catch{}
  session=null;
  await shutdown();
  document.documentElement.classList.remove('mesraah-voice-active');
  emitState('','اضغط وقل ما تريد');
  const dock=document.getElementById(DOCK_ID);
  if(dock)dock.hidden=true;
}

window.MesraahVoice={start,stop,get active(){return active},mode:'gemini-live-agent-0202'};
ensureUi();
injectStyles();
