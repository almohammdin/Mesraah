import { GoogleGenAI, Modality } from 'https://cdn.jsdelivr.net/npm/@google/genai@2.14.0/+esm';

const MODEL = 'gemini-3.1-flash-live-preview';
const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const DATA_KEY = 'mesraah_v030';
const VERSION = '0.9.7';

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
  return String(window.MESRAAH_NATIVE_LIVE_TOKEN_ENDPOINT || '').trim();
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
    .slice(0, 25)
    .map(task => ({
      title: task.title,
      due: task.due || '',
      follow: task.follow || '',
      status: task.status || '',
      priority: task.priority || '',
      spaceId: task.spaceId || '',
      personId: task.personId || ''
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

  return `أنت مسراح، مساعد شخصي سعودي صوتي. هذه محادثة صوتية مباشرة، فتكلم بطبيعية واختصار وبلهجة سعودية سهلة.
الوقت الحالي في الرياض: ${now}.
افهم كلام المستخدم من صوته مباشرة وتفاعل معه كمساعد شخصي يعرف يومه، وليس كقارئ نصوص.
استخدم بيانات مسراح الموجودة فقط. اربط المهام والمواعيد والأشخاص عندما يكون الربط حقيقيا ومفيدا، ولا تخترع معلومة.
إذا ذكر المستخدم رغبة أو فكرة، ناقشه طبيعيا واقترح خطوة مناسبة إذا ساعد السياق.
في هذه النسخة التجريبية اقترح الإجراءات صوتيا فقط، ولا تدع أنك نفذت مهمة أو موعدا قبل وجود أداة تنفيذ مؤكدة.
ردودك قصيرة ومناسبة لشخص يقود السيارة.

بيانات مسراح:
${JSON.stringify({ name: state.profile?.name || '', tasks, people, calendar })}`;
}

function injectStyles() {
  if (document.getElementById('v97NativeStyles')) return;
  const style = document.createElement('style');
  style.id = 'v97NativeStyles';
  style.textContent = `
    .v97-detail{min-height:50px;margin:10px auto 15px;padding:10px 12px;border:1px solid rgba(255,255,255,.11);border-radius:14px;background:rgba(255,255,255,.055);color:rgba(255,255,255,.8);font-size:11px;line-height:1.75;text-align:right;overflow-wrap:anywhere}
    .v97-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}.v97-fallback{border:1px solid rgba(255,255,255,.16);background:transparent;color:#fff;border-radius:12px;padding:9px 13px;font:inherit;font-size:10px;cursor:pointer}
    .v80-voice-overlay[data-state="connecting"] .v80-voice-orb{animation:v80Breath 1.25s ease-in-out infinite}.v80-voice-overlay[data-state="listening"] .v80-voice-orb{animation:v80Breath 1s ease-in-out infinite}.v80-voice-overlay[data-state="speaking"] .v80-voice-orb{animation:v80Breath .7s ease-in-out infinite}
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
    <section class="v80-voice-card" role="dialog" aria-modal="true" aria-label="محادثة صوتية حية مع مسراح">
      <div class="v80-voice-top">
        <div><span class="v80-voice-kicker">Google GenAI SDK · v${VERSION}</span><strong>تحدث مع مسراح</strong></div>
        <button type="button" id="v97Close" aria-label="إغلاق">×</button>
      </div>
      <div class="v80-voice-orb"><span></span><span></span><span></span></div>
      <div class="v80-voice-status" id="v97Status" role="status" aria-live="polite">جاهز</div>
      <div class="v97-detail" id="v97Detail">صوت Gemini Native Live بطابور تشغيل مستمر.</div>
      <div class="v97-actions">
        <button type="button" class="v80-voice-stop" id="v97Stop">إنهاء المحادثة</button>
        <button type="button" class="v97-fallback" id="v97Fallback" hidden>الوضع الاحتياطي</button>
      </div>
    </section>`;
  document.body.appendChild(host);
  document.getElementById('v97Close').onclick = stop;
  document.getElementById('v97Stop').onclick = stop;
  document.getElementById('v97Fallback').onclick = useFallback;
}

function setStatus(text, state = '') {
  const el = document.getElementById('v97Status');
  if (el) el.textContent = text;
  const host = document.getElementById('v80VoiceOverlay');
  if (host) host.dataset.state = state;
}

function setDetail(text) {
  const el = document.getElementById('v97Detail');
  if (el) el.textContent = String(text || '');
}

function showFallback(show = true) {
  const el = document.getElementById('v97Fallback');
  if (el) el.hidden = !show;
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
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
  if (!AudioCtx) throw new Error('AudioContext غير مدعوم');
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia غير مدعوم');

  micContext = new AudioCtx();
  try {
    outputContext = new AudioCtx({ sampleRate: OUTPUT_RATE });
  } catch {
    outputContext = new AudioCtx();
  }

  await Promise.all([micContext.resume(), outputContext.resume()]);

  if (!outputContext.audioWorklet) throw new Error('AudioWorklet غير مدعوم');
  const workletUrl = new URL('./mesraah-playback-v097.worklet.js?v=0.9.7', window.location.href).href;
  await outputContext.audioWorklet.addModule(workletUrl);
  outputWorklet = new AudioWorkletNode(outputContext, 'mesraah-pcm-playback-v097');
  outputGain = outputContext.createGain();
  outputGain.gain.value = 1;
  outputWorklet.connect(outputGain);
  outputGain.connect(outputContext.destination);
  outputQueuedUntil = outputContext.currentTime;

  micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });
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
    setStatus('أسمعك الآن', 'listening');
    return;
  }
  const remainingMs = outputContext
    ? Math.max(0, (outputQueuedUntil - outputContext.currentTime) * 1000)
    : 0;
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
  try {
    outputWorklet.port.postMessage({ samples }, [samples.buffer]);
  } catch {
    outputWorklet.port.postMessage({ samples });
  }
  setStatus('مسراح يتكلم', 'speaking');
}

async function fetchToken(forceRefresh = false) {
  const url = endpoint();
  if (!url) throw new Error('عنوان خادم الرمز غير موجود');
  if (typeof window.MesraahGetAppCheckToken !== 'function') throw new Error('App Check غير جاهز');

  const appCheckToken = await window.MesraahGetAppCheckToken({ forceRefresh });
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Firebase-AppCheck': appCheckToken
    },
    body: '{}'
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && !forceRefresh) return fetchToken(true);
  if (!response.ok || !data.token) {
    throw new Error(`${response.status} ${data.error || 'token-error'}${data.detail ? ` · ${data.detail}` : ''}`);
  }
  return data.token;
}

function handleMessage(message) {
  const content = message?.serverContent;
  if (!content) return;

  if (content.interrupted) {
    clearPlayback();
    micSuppressed = false;
    streamEndSent = false;
    setStatus('أسمعك الآن', 'listening');
  }

  if (content.inputTranscription?.text && !micSuppressed) {
    setDetail(`أنت: ${content.inputTranscription.text}`);
  }
  if (content.outputTranscription?.text) {
    setDetail(`مسراح: ${content.outputTranscription.text}`);
  }

  for (const part of content.modelTurn?.parts || []) {
    if (part.inlineData?.data) playPcm(part.inlineData.data);
  }

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
    const input = event.inputBuffer.getChannelData(0);
    const pcm = resampleToInt16(input, micContext.sampleRate);
    const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    try {
      session.sendRealtimeInput({
        audio: {
          data: bytesToBase64(bytes),
          mimeType: `audio/pcm;rate=${INPUT_RATE}`
        }
      });
    } catch (error) {
      console.warn('Mesraah SDK audio send:', error);
    }
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
  micProcessor = null;
  micSource = null;
  silentGain = null;
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
  outputWorklet = null;
  outputGain = null;
  micStream?.getTracks?.().forEach(track => track.stop());
  micStream = null;
  try { await micContext?.close(); } catch {}
  try { await outputContext?.close(); } catch {}
  micContext = null;
  outputContext = null;
}

async function start() {
  if (active) return;
  ensureUi();
  injectStyles();
  const host = document.getElementById('v80VoiceOverlay');
  host.hidden = false;
  active = true;
  showFallback(false);
  setStatus('أجهز الصوت الحي…', 'connecting');
  setDetail('1/3 أجهز المايك والصوت المستمر');

  try {
    await prepareAudio();
    setDetail('2/3 أطلب رمزا مؤقتا آمنا');
    const token = await fetchToken(false);
    if (!active) return;

    setDetail('3/3 Google GenAI SDK يفتح الجلسة');
    const ai = new GoogleGenAI({
      apiKey: token,
      httpOptions: { apiVersion: 'v1alpha' }
    });

    session = await ai.live.connect({
      model: MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: contextInstruction(),
        inputAudioTranscription: {},
        outputAudioTranscription: {}
      },
      callbacks: {
        onopen: () => setStatus('أكمل المصافحة…', 'connecting'),
        onmessage: message => handleMessage(message),
        onerror: event => {
          console.error('Mesraah SDK Live error:', event);
          setDetail(`SDK error: ${event?.message || event?.error?.message || 'غير معروف'}`);
        },
        onclose: event => {
          if (!active) return;
          setStatus('انقطع الاتصال الصوتي', 'error');
          setDetail(`SDK close: ${event?.code || ''}${event?.reason ? ` · ${event.reason}` : ''}`);
          showFallback(true);
        }
      }
    });

    if (!active) {
      try { session?.close?.(); } catch {}
      session = null;
      return;
    }

    setStatus('أسمعك الآن', 'listening');
    setDetail(IOS_ECHO_GUARD
      ? 'متصل. حماية صدى الآيفون مفعلة حتى يكتمل رد مسراح بدون تقطيع.'
      : 'الجلسة الحية متصلة. تكلم بشكل طبيعي.');
    startMic();
  } catch (error) {
    console.error('Mesraah Native Live SDK v0.9.7:', error);
    setStatus('تعذر تشغيل Native Live', 'error');
    setDetail(`Google GenAI SDK: ${error?.message || error}`);
    showFallback(true);
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

async function useFallback() {
  await stop();
  try {
    await import('./voice-conversation-v087.js?v=0.8.7');
    window.MesraahVoice?.start?.();
  } catch (error) {
    console.error('Mesraah voice fallback:', error);
  }
}

window.MesraahNativeLive = { start, stop, get active() { return active; } };
window.MesraahVoice = window.MesraahNativeLive;
window.__MESRAAH_NATIVE_LIVE_VERSION__ = VERSION;

injectStyles();
ensureUi();
