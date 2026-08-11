import {GoogleGenAI,Modality} from 'https://cdn.jsdelivr.net/npm/@google/genai@2.14.0/+esm';
import {MESRAAH_AGENT_TOOL_DECLARATIONS,executeMesraahAgentTool} from './mesraah-agent-tools-v0200.js?v=0.20.0';

const MODEL='gemini-3.1-flash-live-preview';
const INPUT_RATE=16000;
const OUTPUT_RATE=24000;
const TOOL_TIMEOUT_MS=15000;
const DATA_MUTATION_TOOLS=new Set(['add_task','update_task','delete_task','complete_task']);

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

function isIOS(){return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)}
const IOS_ECHO_GUARD=isIOS();
const endpoint=()=>String(window.MESRAAH_LIVE_TOKEN_ENDPOINT||'https://mesraah-live-token.naif123456.workers.dev/token').trim();
const emitState=(state,label)=>window.dispatchEvent(new CustomEvent('mesraah:voice-state',{detail:{state,label}}));

function contextInstruction(){
  const context=window.MesraahAgentBridge?.getPlatformContext?.()||{};
  return `أنت مسراح، مساعد شخصي سعودي ذكي يعمل كوكيل حي داخل منصة مسراح. هذه محادثة Gemini Live حقيقية، والمنصة أمام المستخدم أثناء الحديث.
تكلم بعربية سعودية سهلة وطبيعية وباختصار. لا تسرد الواجهة ولا تقرأ النصوص آليا.

قاعدة أساسية: إذا كان طلب المستخدم يتعلق بمكان أو عنصر داخل المنصة، نفذ الحركة فعليا بالأداة أمامه ثم تكلم. لا تقل له فقط أين يجد الشيء.
- إذا قال افتح التقويم أو المساحات أو الأشخاص أو الوارد أو المتابعات أو الإنجاز أو المكافآت أو الإدارة: استخدم navigate_to_view.
- إذا طلب مساحة أو شخصا محددا: استخدم open_entity.
- إذا قال افتح مهمة جديدة: استخدم open_new_task فقط، ولا تحفظ حتى يكون طلب الحفظ أو الإضافة صريحا.
- إذا أعطاك تفاصيل مهمة جديدة: افتح النموذج ثم استخدم fill_task_draft لتظهر الكتابة في الحقول أمامه. إذا كان كلامه أمرا صريحا مثل أضف أو سجل أو احفظ، استخدم save_task confirmed=true بعد تعبئة المسودة.
- إذا طلب تعديل مهمة موجودة: استخدم search_tasks أولا، ثم open_task، ثم set_task_field أو fill_task_draft، ثم save_task فقط إذا طلب التعديل/الحفظ صراحة.
- إذا سألك عن حقل أو ماذا يكتب فيه: استخدم focus_task_field حتى يرى الحقل الذي تشرحه.
- عند السؤال عن مهمة حالية أو بعد تغيير، استخدم search_tasks أو get_mesraah_context للحصول على أحدث حالة.
- لا تقل تم أو حفظت أو عدلت إلا بعد رجوع الأداة ok=true، وللحفظ يجب أن ترجع persisted=true.
- التغييرات في نموذج المهمة قبل save_task هي مسودة فقط؛ أخبر المستخدم بذلك إذا سأل.
- إذا طلب عدة مهام صراحة، يمكنك استخدام add_task لكل مهمة حتى تنجزها كلها، لكن عند مهمة واحدة فضّل الرحلة المرئية داخل النموذج.
- إذا طلب إنجاز أو حذف مهمة صراحة، استخدم أداة المهمة المناسبة بعد تحديدها دون غموض.
- اسأل سؤالا واحدا قصيرا فقط عندما تكون معلومة لازمة للتنفيذ ناقصة.

مسراح نفسه هو مصدر الحقيقة والذاكرة العملية. لا تعتمد على ذاكرة صوتية منفصلة.
حالة مسراح والواجهة عند بدء المحادثة:
${JSON.stringify(context)}`;
}

function ensureUi(){
  if(document.getElementById('v80VoiceOverlay'))return;
  const host=document.createElement('div');host.id='v80VoiceOverlay';host.className='v80-voice-overlay';host.hidden=true;
  host.innerHTML=`<section class="v80-voice-card" role="region" aria-label="محادثة صوتية مع مسراح">
    <div class="v80-voice-orb" aria-hidden="true"><span></span><span></span><span></span></div>
    <div class="v80-voice-copy"><strong class="v80-voice-status" id="mesraahVoiceStatus" aria-live="polite">جاهز</strong><p class="mesraah-voice-detail" id="mesraahVoiceDetail">تكلم بشكل طبيعي</p></div>
    <button type="button" class="v80-voice-stop" id="mesraahVoiceStop" aria-label="إنهاء المحادثة">×</button>
  </section>`;
  document.body.appendChild(host);document.getElementById('mesraahVoiceStop').onclick=stop;
}
function injectStyles(){
  if(document.getElementById('mesraahLiveStyles0200'))return;
  const style=document.createElement('style');style.id='mesraahLiveStyles0200';style.textContent=`
    .v80-voice-overlay{position:fixed;left:0;right:0;bottom:max(10px,env(safe-area-inset-bottom));z-index:500;display:flex;justify-content:center;padding:0 12px;pointer-events:none}
    .v80-voice-overlay[hidden]{display:none}
    .v80-voice-card{width:min(560px,100%);min-height:54px;display:grid;grid-template-columns:38px minmax(0,1fr) 34px;align-items:center;gap:9px;padding:7px 8px 7px 10px;border:1px solid rgba(255,255,255,.24);border-radius:15px;background:linear-gradient(135deg,#0d3656,#155b72);box-shadow:0 12px 30px rgba(5,33,47,.26);color:#fff;pointer-events:auto;text-align:right;backdrop-filter:blur(12px)}
    .v80-voice-orb{width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.13);display:flex;align-items:center;justify-content:center;gap:3px}
    .v80-voice-orb span{display:block;width:3px;height:12px;border-radius:99px;background:#fff;animation:mesraahAgentBars .9s ease-in-out infinite}.v80-voice-orb span:nth-child(2){height:20px;animation-delay:.15s}.v80-voice-orb span:nth-child(3){animation-delay:.3s}
    @keyframes mesraahAgentBars{50%{transform:scaleY(.45);opacity:.65}}
    .v80-voice-copy{min-width:0}.v80-voice-status{display:block;font-size:10.5px}.mesraah-voice-detail{margin:2px 0 0!important;padding:0!important;border:0!important;background:transparent!important;color:rgba(255,255,255,.76)!important;font-size:9px!important;line-height:1.35!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:0!important}
    .v80-voice-stop{width:32px;height:32px;border:1px solid rgba(255,255,255,.18);border-radius:9px;background:rgba(255,255,255,.09);color:#fff;font:inherit;font-size:18px;line-height:1}
    @media(max-width:520px){.v80-voice-overlay{padding:0 8px}.v80-voice-card{min-height:52px;grid-template-columns:34px minmax(0,1fr) 32px;gap:8px;padding:6px 7px}.v80-voice-orb{width:32px;height:32px}.v80-voice-stop{width:30px;height:30px}}
  `;document.head.appendChild(style);
}
function setStatus(text,state){const el=document.getElementById('mesraahVoiceStatus');if(el)el.textContent=text;emitState(state,text)}
function setDetail(text){const el=document.getElementById('mesraahVoiceDetail');if(el)el.textContent=String(text||'')}
function bytesToBase64(bytes){let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(binary)}
function base64ToFloat32(value){const binary=atob(value),length=binary.length-(binary.length%2),buffer=new ArrayBuffer(length),bytes=new Uint8Array(buffer);for(let i=0;i<length;i++)bytes[i]=binary.charCodeAt(i);const pcm=new Int16Array(buffer),out=new Float32Array(pcm.length);for(let i=0;i<pcm.length;i++)out[i]=pcm[i]/32768;return out}
function resampleToInt16(input,sourceRate){const ratio=sourceRate/INPUT_RATE,out=new Int16Array(Math.max(1,Math.round(input.length/ratio)));for(let i=0;i<out.length;i++){const pos=i*ratio,left=Math.floor(pos),right=Math.min(left+1,input.length-1),mix=pos-left,value=(input[left]||0)*(1-mix)+(input[right]||0)*mix,clamped=Math.max(-1,Math.min(1,value));out[i]=clamped<0?clamped*32768:clamped*32767}return out}

async function prepareAudio(){
  const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx||!navigator.mediaDevices?.getUserMedia)throw new Error('voice-not-supported');
  micContext=new AudioCtx();try{outputContext=new AudioCtx({sampleRate:OUTPUT_RATE})}catch{outputContext=new AudioCtx()}
  await Promise.all([micContext.resume(),outputContext.resume()]);if(!outputContext.audioWorklet)throw new Error('voice-playback-not-supported');
  await outputContext.audioWorklet.addModule('./mesraah-voice-playback.worklet.js?v=0.20.0');outputWorklet=new AudioWorkletNode(outputContext,'mesraah-voice-playback');outputGain=outputContext.createGain();outputGain.gain.value=1;outputWorklet.connect(outputGain);outputGain.connect(outputContext.destination);outputQueuedUntil=outputContext.currentTime;
  micStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
}
function clearPlayback(){try{outputWorklet?.port.postMessage({type:'clear'})}catch{}if(outputContext)outputQueuedUntil=outputContext.currentTime}
function suppressMicForModelOutput(){if(!IOS_ECHO_GUARD||micSuppressed)return;micSuppressed=true;if(!streamEndSent&&session){streamEndSent=true;try{session.sendRealtimeInput({audioStreamEnd:true})}catch{}}}
function resumeMicAfterPlayback(){clearTimeout(resumeMicTimer);if(!IOS_ECHO_GUARD){if(active)setStatus('أسمعك الآن','listening');return}const remainingMs=outputContext?Math.max(0,(outputQueuedUntil-outputContext.currentTime)*1000):0;resumeMicTimer=setTimeout(()=>{micSuppressed=false;streamEndSent=false;if(active)setStatus('أسمعك الآن','listening')},remainingMs+140)}
function playPcm(base64){if(!active||!outputContext||!outputWorklet||!base64)return;suppressMicForModelOutput();const samples=base64ToFloat32(base64);if(!samples.length)return;outputQueuedUntil=Math.max(outputContext.currentTime,outputQueuedUntil)+samples.length/OUTPUT_RATE;try{outputWorklet.port.postMessage({samples},[samples.buffer])}catch{outputWorklet.port.postMessage({samples})}setStatus('مسراح يتحدث','speaking')}
async function fetchToken(forceRefresh=false){if(typeof window.MesraahLiveGetAppCheckToken!=='function')throw new Error('voice-app-check-not-ready');const token=await window.MesraahLiveGetAppCheckToken({forceRefresh}),response=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'application/json','X-Firebase-AppCheck':token},body:'{}'}),data=await response.json().catch(()=>({}));if(response.status===401&&!forceRefresh)return fetchToken(true);if(!response.ok||!data.token)throw new Error(`voice-token-failed:${response.status}`);return data.token}
function withTimeout(promise,ms=TOOL_TIMEOUT_MS){let timer;return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('voice-tool-timeout')),ms)})]).finally(()=>clearTimeout(timer))}
async function persistIfNeeded(call,result){if(!result?.ok||!DATA_MUTATION_TOOLS.has(call.name))return result;try{const cloud=await withTimeout(window.MesraahCloudBridge?.saveNow?.()||Promise.resolve({ok:true,mode:'local'}),8000);if(cloud?.ok===false)return{ok:false,error:'cloud-save-not-confirmed'}}catch{return{ok:false,error:'cloud-save-failed'}}window.dispatchEvent(new CustomEvent('mesraah:data-changed',{detail:{type:'voice-tool',name:call.name}}));return{...result,persisted:true}}
async function handleToolCalls(calls=[]){
  const responses=[];setStatus('أنفذ معك…','working');
  for(const call of calls){let result;try{result=await withTimeout(executeMesraahAgentTool(call.name,call.args||{}));result=await persistIfNeeded(call,result);if(result?.ok){const labels={navigate_to_view:'انتقلت للقسم',open_entity:'فتحت المطلوب',open_new_task:'فتحت مهمة جديدة',open_task:'فتحت المهمة',focus_task_field:'هذا هو الحقل',set_task_field:'كتبت القيمة',fill_task_draft:'عبأت المهمة',save_task:'حفظت المهمة'};if(labels[call.name])setDetail(labels[call.name])}}catch(error){result={ok:false,error:String(error?.message||error)}}responses.push({name:call.name,id:call.id,response:{result}})}
  session?.sendToolResponse({functionResponses:responses});
}
function handleMessage(message){if(message?.toolCall?.functionCalls?.length)handleToolCalls(message.toolCall.functionCalls).catch(console.error);const content=message?.serverContent;if(!content)return;if(content.interrupted){clearPlayback();micSuppressed=false;streamEndSent=false;setStatus('أسمعك الآن','listening')}if(content.inputTranscription?.text&&!micSuppressed)setDetail(`أنت: ${content.inputTranscription.text}`);if(content.outputTranscription?.text)setDetail(`مسراح: ${content.outputTranscription.text}`);for(const part of content.modelTurn?.parts||[])if(part.inlineData?.data)playPcm(part.inlineData.data);if(content.turnComplete&&active)resumeMicAfterPlayback()}
function startMic(){if(!active||!session||!micContext||!micStream||micProcessor)return;micSource=micContext.createMediaStreamSource(micStream);micProcessor=micContext.createScriptProcessor(2048,1,1);silentGain=micContext.createGain();silentGain.gain.value=0;micProcessor.onaudioprocess=event=>{if(!active||!session||micSuppressed)return;const pcm=resampleToInt16(event.inputBuffer.getChannelData(0),micContext.sampleRate),bytes=new Uint8Array(pcm.buffer,pcm.byteOffset,pcm.byteLength);try{session.sendRealtimeInput({audio:{data:bytesToBase64(bytes),mimeType:`audio/pcm;rate=${INPUT_RATE}`}})}catch{}};micSource.connect(micProcessor);micProcessor.connect(silentGain);silentGain.connect(micContext.destination)}
async function shutdown(){clearTimeout(resumeMicTimer);resumeMicTimer=null;micSuppressed=false;streamEndSent=false;if(micProcessor)micProcessor.onaudioprocess=null;try{micProcessor?.disconnect();micSource?.disconnect();silentGain?.disconnect();outputWorklet?.disconnect();outputGain?.disconnect()}catch{}micStream?.getTracks?.().forEach(track=>track.stop());micStream=null;try{await micContext?.close()}catch{}try{await outputContext?.close()}catch{}micContext=outputContext=null;micProcessor=micSource=silentGain=outputWorklet=outputGain=null}
async function start(){
  if(active)return;ensureUi();injectStyles();document.getElementById('v80VoiceOverlay').hidden=false;active=true;setStatus('أجهز المحادثة…','connecting');setDetail('لحظات وأسمعك.');
  try{await prepareAudio();const token=await fetchToken();if(!active)return;const ai=new GoogleGenAI({apiKey:token,httpOptions:{apiVersion:'v1alpha'}});session=await ai.live.connect({model:MODEL,config:{responseModalities:[Modality.AUDIO],systemInstruction:contextInstruction(),inputAudioTranscription:{},outputAudioTranscription:{},speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:'Kore'}}},tools:[{functionDeclarations:MESRAAH_AGENT_TOOL_DECLARATIONS}]},callbacks:{onopen:()=>setStatus('متصل بمسراح','connecting'),onmessage:handleMessage,onerror:event=>console.error('Mesraah Agent Live:',event),onclose:()=>{if(active){setStatus('انقطع الاتصال','error');setDetail('انقطع الاتصال الصوتي. حاول مرة أخرى.')}}});if(!active)return;startMic();setStatus('أسمعك الآن','listening');setDetail('تكلم بشكل طبيعي. أتنقل وأنفذ معك داخل مسراح.')}catch(error){console.error('Mesraah Agent Live start:',error);setStatus('تعذر تشغيل المحادثة الصوتية','error');setDetail(`مرحلة التشغيل: ${String(error?.message||error).slice(0,150)}`);try{session?.close?.()}catch{}session=null;active=false;await shutdown();throw error}
}
async function stop(){active=false;try{session?.close?.()}catch{}session=null;await shutdown();emitState('','اضغط وقل ما تريد');const host=document.getElementById('v80VoiceOverlay');if(host)host.hidden=true}

window.MesraahVoice={start,stop,get active(){return active},mode:'gemini-live-agent-0200'};
ensureUi();injectStyles();
