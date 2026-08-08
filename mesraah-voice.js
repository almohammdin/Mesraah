import { GoogleGenAI, Modality } from 'https://cdn.jsdelivr.net/npm/@google/genai@2.14.0/+esm';
import { TASK_TOOL_DECLARATIONS, executeTaskTool } from './mesraah-voice-tools.js?v=0.10.1';

const MODEL = 'gemini-3.1-flash-live-preview';
const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const DATA_KEY = 'mesraah_v030';

let active = false;
let session = null;
let micStream = null;
let micContext = null;
let outputContext = null;
let micSource = null;
let micProcessor = null;
let silentGain = null;
let outputWorklet = null;
let outputGain = null;
let micSuppressed = false;
let outputQueuedUntil = 0;
let resumeMicTimer = null;
let streamEndSent = false;

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

const IOS_ECHO_GUARD = isIOS();

function endpoint() {
  return String(window.MESRAAH_VOICE_TOKEN_ENDPOINT || '').trim();
}

function readState() {
  try { return JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {}; }
  catch { return {}; }
}

function contextInstruction() {
  const state = readState();
  const tasks = (state.tasks || [])
    .filter(task => task.status !== 'done')
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
    .slice(0, 20)
    .map(task => ({
      id: task.id,
      title: task.title,
      notes: task.notes || '',
      due: task.due || '',
      follow: task.follow || '',
      status: task.status || '',
      priority: task.priority || ''
    }));
  const people = (state.people || []).slice(0, 30).map(person => ({
    name: person.name,
    relation: person.relation || '',
    city: person.city || '',
    organization: person.organization || '',
    note: person.note || ''
  }));
  const calendar = window.MesraahCalendar?.getCachedEvents?.().slice(0, 20) || [];
  const now = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
    timeZone: 'Asia/Riyadh', dateStyle: 'full', timeStyle: 'medium'
  }).format(new Date());

  return `أنت مسراح، مساعد شخصي سعودي صوتي. تكلم بطبيعية واختصار وبلهجة سعودية سهلة.
الوقت الحالي في الرياض: ${now}.
استخدم بيانات مسراح وأدواته الفعلية. أي سؤال عن مهمة موجودة استخدم search_tasks أولا حتى تكون إجابتك من الحالة الحالية وليست من ذاكرة بداية الجلسة.
عند أمر إضافة صريح استخدم add_task واحفظ كل التفاصيل التي قالها المستخدم: التاريخ والوقت وكل الأشخاص والمكان والملاحظات.
عند طلب تعديل مهمة موجودة ابحث عنها أولا إذا لم يكن لديك taskId مؤكد، ثم استخدم update_task على نفس المهمة. لا تنشئ مهمة جديدة بدل التعديل.
عند طلب حذف ابحث وحدد المهمة دون غموض، ثم استخدم delete_task فقط بعد طلب حذف صريح. إذا وجدت أكثر من نتيجة محتملة اسأل المستخدم أي واحدة يقصد.
عند طلب إنجاز مهمة استخدم complete_task.
قاعدة صارمة: ممنوع أن تقول تم أو أضفت أو عدلت أو حذفت أو أنجزت إلا بعد أن ترجع أداة التنفيذ ok=true. إذا فشلت الأداة قل إن التنفيذ لم يكتمل.
عبارات الرغبة مثل ودي أو أبغى أو أفكر ليست أمرا بالحفظ؛ ناقشها أولا واسأل هل يريد إضافتها.
ردودك قصيرة ومناسبة لشخص يقود السيارة.

سياق أولي:
${JSON.stringify({ name: state.profile?.name || '', tasks, people, calendar })}`;
}

function injectStyles() {
  if (document.getElementById('mesraahVoiceStyles')) return;
  const style = document.createElement('style');
  style.id = 'mesraahVoiceStyles';
  style.textContent = `
    .mesraah-voice-detail{min-height:50px;margin:10px auto 15px;padding:10px 12px;border:1px solid rgba(255,255,255,.11);border-radius:14px;background:rgba(255,255,255,.055);color:rgba(255,255,255,.82);font-size:11px;line-height:1.75;text-align:right;overflow-wrap:anywhere}
    .mesraah-voice-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
    .v80-voice-overlay[data-state="connecting"] .v80-voice-orb{animation:v80Breath 1.25s ease-in-out infinite}
    .v80-voice-overlay[data-state="listening"] .v80-voice-orb{animation:v80Breath 1s ease-in-out infinite}
    .v80-voice-overlay[data-state="speaking"] .v80-voice-orb{animation:v80Breath .7s ease-in-out infinite}
  `;
  document.head.appendChild(style);
}

function ensureUi() {
  document.getElementById('v80VoiceOverlay')?.remove();
  const host = document.createElement('div');
  host.id = 'v80VoiceOverlay';
  host.className = 'v80-voice-overlay';
  host.hidden = true;
  host.innerHTML = `
    <section class="v80-voice-card" role="dialog" aria-modal="true" aria-label="محادثة صوتية مع مسراح">
      <div class="v80-voice-top">
        <div><span class="v80-voice-kicker">مسراح</span><strong>تحدث مع مسراح</strong></div>
        <button type="button" id="mesraahVoiceClose" aria-label="إغلاق">×</button>
      </div>
      <div class="v80-voice-orb"><span></span><span></span><span></span></div>
      <div class="v80-voice-status" id="mesraahVoiceStatus" role="status" aria-live="polite">جاهز</div>
      <div class="mesraah-voice-detail" id="mesraahVoiceDetail">تكلم بشكل طبيعي، ومسراح يسمعك ويتعامل مع مهامك.</div>
      <div class="mesraah-voice-actions"><button type="button" class="v80-voice-stop" id="mesraahVoiceStop">إنهاء المحادثة</button></div>
    </section>`;
  document.body.appendChild(host);
  document.getElementById('mesraahVoiceClose').onclick = stop;
  document.getElementById('mesraahVoiceStop').onclick = stop;
}

function setStatus(text, state = '') {
  const el = document.getElementById('mesraahVoiceStatus');
  if (el) el.textContent = text;
  const host = document.getElementById('v80VoiceOverlay');
  if (host) host.dataset.state = state;
}

function setDetail(text) {
  const el = document.getElementById('mesraahVoiceDetail');
  if (el) el.textContent = String(text || '');
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

function base64ToFloat32(value) {
  const binary = atob(value);
  const length = binary.length - (binary.length % 2);
  const buffer = new ArrayBuffer(length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < length; i += 1) bytes[i] = binary.charCodeAt(i);
  const pcm = new Int16Array(buffer);
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i += 1) out[i] = pcm[i] / 32768;
  return out;
}

function resampleToInt16(input, sourceRate) {
  const ratio = sourceRate / INPUT_RATE;
  const out = new Int16Array(Math.max(1, Math.round(input.length / ratio)));
  for (let i = 0; i < out.length; i += 1) {
    const pos = i * ratio;
    const left = Math.floor(pos);
    const right = Math.min(left + 1, input.length - 1);
    const mix = pos - left;
    const value = (input[left] || 0) * (1 - mix) + (input[right] || 0) * mix;
    const clamped = Math.max(-1, Math.min(1, value));
    out[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
  }
  return out;
}

async function prepareAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx || !navigator.mediaDevices?.getUserMedia) throw new Error('voice-not-supported');
  micContext = new AudioCtx();
  try { outputContext = new AudioCtx({ sampleRate: OUTPUT_RATE }); }
  catch { outputContext = new AudioCtx(); }
  await Promise.all([micContext.resume(), outputContext.resume()]);
  if (!outputContext.audioWorklet) throw new Error('voice-playback-not-supported');
  await outputContext.audioWorklet.addModule('./mesraah-voice-playback.worklet.js?v=0.10.1');
  outputWorklet = new AudioWorkletNode(outputContext, 'mesraah-voice-playback');
  outputGain = outputContext.createGain();
  outputGain.gain.value = 1;
  outputWorklet.connect(outputGain);
  outputGain.connect(outputContext.destination);
  outputQueuedUntil = outputContext.currentTime;
  micStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
}

function clearPlayback() {
  try { outputWorklet?.port.postMessage({ type: 'clear' }); } catch {}
  if (outputContext) outputQueuedUntil = outputContext.currentTime;
}

function suppressMicForModelOutput() {
  if (!IOS_ECHO_GUARD || micSuppressed) return;
  micSuppressed = true;
  if (!streamEndSent && session) {
    streamEndSent = true;
    try { session.sendRealtimeInput({ audioStreamEnd: true }); } catch {}
  }
}

function resumeMicAfterPlayback() {
  clearTimeout(resumeMicTimer);
  if (!IOS_ECHO_GUARD) {
    if (active) setStatus('أسمعك الآن', 'listening');
    return;
  }
  const remainingMs = outputContext ? Math.max(0, (outputQueuedUntil - outputContext.currentTime) * 1000) : 0;
  resumeMicTimer = setTimeout(() => {
    micSuppressed = false;
    streamEndSent = false;
    if (active) setStatus('أسمعك الآن', 'listening');
  }, remainingMs + 140);
}

function playPcm(base64) {
  if (!active || !outputContext || !outputWorklet || !base64) return;
  suppressMicForModelOutput();
  const samples = base64ToFloat32(base64);
  if (!samples.length) return;
  const base = Math.max(outputContext.currentTime, outputQueuedUntil);
  outputQueuedUntil = base + samples.length / OUTPUT_RATE;
  try { outputWorklet.port.postMessage({ samples }, [samples.buffer]); }
  catch { outputWorklet.port.postMessage({ samples }); }
  setStatus('مسراح يتكلم', 'speaking');
}

async function fetchToken(forceRefresh = false) {
  const url = endpoint();
  if (!url || typeof window.MesraahVoiceGetAppCheckToken !== 'function') throw new Error('voice-connection-not-ready');
  const appCheckToken = await window.MesraahVoiceGetAppCheckToken({ forceRefresh });
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Firebase-AppCheck': appCheckToken },
    body: '{}'
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && !forceRefresh) return fetchToken(true);
  if (!response.ok || !data.token) throw new Error('voice-token-failed');
  return data.token;
}

async function handleToolCalls(functionCalls = []) {
  if (!session || !functionCalls.length) return;
  setStatus('أنفذ طلبك…', 'connecting');
  const functionResponses = [];
  for (const call of functionCalls) {
    let result;
    try { result = await executeTaskTool(call.name, call.args || {}); }
    catch (error) { result = { ok: false, error: String(error?.message || error) }; }
    functionResponses.push({ name: call.name, id: call.id, response: { result } });
  }
  try { session.sendToolResponse({ functionResponses }); }
  catch (error) {
    console.error('Mesraah voice tool response:', error);
    setDetail('تعذر إكمال التنفيذ الآن.');
  }
}

function handleMessage(message) {
  if (message?.toolCall?.functionCalls?.length) {
    handleToolCalls(message.toolCall.functionCalls).catch(error => console.error('Mesraah voice tools:', error));
  }
  const content = message?.serverContent;
  if (!content) return;
  if (content.interrupted) {
    clearPlayback();
    micSuppressed = false;
    streamEndSent = false;
    setStatus('أسمعك الآن', 'listening');
  }
  if (content.inputTranscription?.text && !micSuppressed) setDetail(`أنت: ${content.inputTranscription.text}`);
  if (content.outputTranscription?.text) setDetail(`مسراح: ${content.outputTranscription.text}`);
  for (const part of content.modelTurn?.parts || []) if (part.inlineData?.data) playPcm(part.inlineData.data);
  if (content.turnComplete && active) resumeMicAfterPlayback();
}

function startMic() {
  if (!active || !session || !micContext || !micStream || micProcessor) return;
  micSource = micContext.createMediaStreamSource(micStream);
  micProcessor = micContext.createScriptProcessor(2048, 1, 1);
  silentGain = micContext.createGain();
  silentGain.gain.value = 0;
  micProcessor.onaudioprocess = event => {
    if (!active || !session || micSuppressed) return;
    const pcm = resampleToInt16(event.inputBuffer.getChannelData(0), micContext.sampleRate);
    const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    try { session.sendRealtimeInput({ audio: { data: bytesToBase64(bytes), mimeType: `audio/pcm;rate=${INPUT_RATE}` } }); }
    catch (error) { console.warn('Mesraah voice audio send:', error); }
  };
  micSource.connect(micProcessor);
  micProcessor.connect(silentGain);
  silentGain.connect(micContext.destination);
}

function stopMic() {
  if (micProcessor) micProcessor.onaudioprocess = null;
  try { micProcessor?.disconnect(); } catch {}
  try { micSource?.disconnect(); } catch {}
  try { silentGain?.disconnect(); } catch {}
  micProcessor = micSource = silentGain = null;
}

async function shutdownMedia() {
  clearTimeout(resumeMicTimer);
  resumeMicTimer = null;
  micSuppressed = false;
  streamEndSent = false;
  stopMic();
  clearPlayback();
  try { outputWorklet?.disconnect(); } catch {}
  try { outputGain?.disconnect(); } catch {}
  outputWorklet = outputGain = null;
  micStream?.getTracks?.().forEach(track => track.stop());
  micStream = null;
  try { await micContext?.close(); } catch {}
  try { await outputContext?.close(); } catch {}
  micContext = outputContext = null;
}

async function start() {
  if (active) return;
  ensureUi();
  injectStyles();
  const host = document.getElementById('v80VoiceOverlay');
  host.hidden = false;
  active = true;
  setStatus('أجهز المحادثة…', 'connecting');
  setDetail('لحظات وأسمعك.');

  try {
    await prepareAudio();
    setDetail('أجهز الاتصال…');
    const token = await fetchToken(false);
    if (!active) return;
    const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } });
    session = await ai.live.connect({
      model: MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: contextInstruction(),
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        tools: [{ functionDeclarations: TASK_TOOL_DECLARATIONS }]
      },
      callbacks: {
        onopen: () => setStatus('أتصل بمسراح…', 'connecting'),
        onmessage: message => handleMessage(message),
        onerror: event => console.error('Mesraah voice error:', event),
        onclose: event => {
          if (!active) return;
          console.warn('Mesraah voice closed:', event?.code, event?.reason);
          setStatus('انقطع الاتصال', 'error');
          setDetail('انقطع الاتصال الصوتي. حاول مرة أخرى.');
        }
      }
    });
    if (!active) {
      try { session?.close?.(); } catch {}
      session = null;
      return;
    }
    setStatus('أسمعك الآن', 'listening');
    setDetail('تكلم بشكل طبيعي. أقدر أبحث في مهامك وأضيفها وأعدلها وأحذفها وأنجزها بأمرك.');
    startMic();
  } catch (error) {
    console.error('Mesraah voice start:', error);
    setStatus('تعذر تشغيل المحادثة الصوتية', 'error');
    setDetail('تعذر الاتصال الآن. حاول مرة أخرى بعد قليل.');
    try { session?.close?.(); } catch {}
    session = null;
    await shutdownMedia();
    active = false;
  }
}

async function stop() {
  active = false;
  try { session?.close?.(); } catch {}
  session = null;
  await shutdownMedia();
  setStatus('انتهت المحادثة', '');
  const host = document.getElementById('v80VoiceOverlay');
  if (host) setTimeout(() => { host.hidden = true; }, 150);
}

window.MesraahVoice = { start, stop, get active() { return active; } };

injectStyles();
ensureUi();
