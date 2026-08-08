(() => {
  const MODEL = 'gemini-3.1-flash-live-preview';
  const INPUT_RATE = 16000;
  const OUTPUT_RATE = 24000;
  const DATA_KEY = 'mesraah_v030';

  let active = false;
  let socket = null;
  let micStream = null;
  let micContext = null;
  let outputContext = null;
  let micSource = null;
  let micProcessor = null;
  let silentGain = null;
  let nextPlayAt = 0;
  let playingSources = new Set();
  let setupReady = false;
  let setupTimer = null;

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
      timeZone: 'Asia/Riyadh',
      dateStyle: 'full',
      timeStyle: 'medium'
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
    if (document.getElementById('v91NativeStyles')) return;
    const style = document.createElement('style');
    style.id = 'v91NativeStyles';
    style.textContent = `
      .v91-detail{min-height:50px;margin:10px auto 15px;padding:10px 12px;border:1px solid rgba(255,255,255,.11);border-radius:14px;background:rgba(255,255,255,.055);color:rgba(255,255,255,.78);font-size:11px;line-height:1.75;text-align:right;overflow-wrap:anywhere}
      .v91-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}.v91-fallback{border:1px solid rgba(255,255,255,.16);background:transparent;color:#fff;border-radius:12px;padding:9px 13px;font:inherit;font-size:10px;cursor:pointer}
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
          <div><span class="v80-voice-kicker">Native Live v0.9.1</span><strong>تحدث مع مسراح</strong></div>
          <button type="button" id="v91Close" aria-label="إغلاق">×</button>
        </div>
        <div class="v80-voice-orb"><span></span><span></span><span></span></div>
        <div class="v80-voice-status" id="v91Status" role="status" aria-live="polite">جاهز</div>
        <div class="v91-detail" id="v91Detail">صوتك يذهب مباشرة إلى Gemini Live ويعود الرد صوتا.</div>
        <div class="v91-actions">
          <button type="button" class="v80-voice-stop" id="v91Stop">إنهاء المحادثة</button>
          <button type="button" class="v91-fallback" id="v91Fallback" hidden>الوضع الاحتياطي</button>
        </div>
      </section>`;
    document.body.appendChild(host);
    document.getElementById('v91Close').onclick = stop;
    document.getElementById('v91Stop').onclick = stop;
    document.getElementById('v91Fallback').onclick = useFallback;
  }

  function setStatus(text, state = '') {
    const el = document.getElementById('v91Status');
    if (el) el.textContent = text;
    const host = document.getElementById('v80VoiceOverlay');
    if (host) host.dataset.state = state;
  }

  function setDetail(text) {
    const el = document.getElementById('v91Detail');
    if (el) el.textContent = String(text || '');
  }

  function showFallback(show = true) {
    const el = document.getElementById('v91Fallback');
    if (el) el.hidden = !show;
  }

  function makeError(stage, message, extra = {}) {
    const error = new Error(message);
    error.stage = stage;
    Object.assign(error, extra);
    return error;
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
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
    if (!AudioCtx) throw makeError('audio', 'AudioContext غير مدعوم');
    if (!navigator.mediaDevices?.getUserMedia) throw makeError('audio', 'getUserMedia غير مدعوم');

    micContext = new AudioCtx();
    outputContext = new AudioCtx();
    await Promise.all([micContext.resume(), outputContext.resume()]);
    nextPlayAt = outputContext.currentTime;

    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch (error) {
      throw makeError('microphone', error?.name || 'microphone-denied');
    }
  }

  function startMic() {
    if (!active || !setupReady || !micContext || !micStream || micProcessor) return;
    micSource = micContext.createMediaStreamSource(micStream);
    micProcessor = micContext.createScriptProcessor(2048, 1, 1);
    silentGain = micContext.createGain();
    silentGain.gain.value = 0;

    micProcessor.onaudioprocess = event => {
      if (!active || !setupReady || socket?.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcm = resampleToInt16(input, micContext.sampleRate);
      const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
      socket.send(JSON.stringify({
        realtimeInput: {
          audio: {
            data: bytesToBase64(bytes),
            mimeType: `audio/pcm;rate=${INPUT_RATE}`
          }
        }
      }));
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

  function clearPlayback() {
    playingSources.forEach(source => { try { source.stop(); } catch {} });
    playingSources.clear();
    if (outputContext) nextPlayAt = outputContext.currentTime;
  }

  function playPcm(base64) {
    if (!active || !outputContext || !base64) return;
    const bytes = base64ToBytes(base64);
    const length = bytes.byteLength - (bytes.byteLength % 2);
    if (!length) return;
    const view = new DataView(bytes.buffer, bytes.byteOffset, length);
    const count = length / 2;
    const buffer = outputContext.createBuffer(1, count, OUTPUT_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < count; i += 1) channel[i] = view.getInt16(i * 2, true) / 32768;

    const source = outputContext.createBufferSource();
    source.buffer = buffer;
    source.connect(outputContext.destination);
    const startAt = Math.max(outputContext.currentTime + 0.012, nextPlayAt);
    nextPlayAt = startAt + buffer.duration;
    playingSources.add(source);
    source.onended = () => playingSources.delete(source);
    source.start(startAt);
    setStatus('مسراح يتكلم', 'speaking');
  }

  async function fetchTokenWithAppCheck(forceRefresh = false) {
    const url = endpoint();
    if (!url) throw makeError('token-endpoint', 'عنوان خادم الرمز غير موجود');
    if (typeof window.MesraahGetAppCheckToken !== 'function') throw makeError('app-check', 'App Check غير جاهز');

    let appCheckToken;
    try {
      appCheckToken = await window.MesraahGetAppCheckToken({ forceRefresh });
    } catch (error) {
      throw makeError('app-check', error?.message || 'تعذر إصدار App Check token');
    }

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Firebase-AppCheck': appCheckToken
        },
        body: '{}'
      });
    } catch (error) {
      throw makeError('token-network', error?.message || 'تعذر الوصول إلى Worker');
    }

    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && !forceRefresh) return fetchTokenWithAppCheck(true);
    if (!response.ok || !data.token) {
      throw makeError('token-worker', `${response.status} ${data.error || 'token-error'}${data.detail ? ` • ${data.detail}` : ''}`, { status: response.status });
    }
    return data.token;
  }

  function setupMessage() {
    return {
      setup: {
        model: `models/${MODEL}`,
        generationConfig: {
          responseModalities: ['AUDIO']
        },
        systemInstruction: {
          parts: [{ text: contextInstruction() }]
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        realtimeInputConfig: {
          automaticActivityDetection: {}
        }
      }
    };
  }

  function handleServerMessage(message) {
    if (message.setupComplete) {
      clearTimeout(setupTimer);
      setupReady = true;
      setStatus('أسمعك الآن', 'listening');
      setDetail('تكلم بشكل طبيعي. تستطيع مقاطعة مسراح أثناء رده.');
      startMic();
      return;
    }

    if (message.error) {
      setStatus('رفض Gemini الجلسة', 'error');
      setDetail(JSON.stringify(message.error).slice(0, 500));
      return;
    }

    const content = message.serverContent;
    if (!content) return;

    if (content.interrupted) {
      clearPlayback();
      setStatus('أسمعك الآن', 'listening');
    }
    if (content.inputTranscription?.text) setDetail(`أنت: ${content.inputTranscription.text}`);
    if (content.outputTranscription?.text) setDetail(`مسراح: ${content.outputTranscription.text}`);
    for (const part of content.modelTurn?.parts || []) {
      if (part.inlineData?.data) playPcm(part.inlineData.data);
    }
    if (content.turnComplete && active) setStatus('أسمعك الآن', 'listening');
  }

  async function connectSocket(token) {
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`;

    return new Promise((resolve, reject) => {
      let settled = false;
      socket = new WebSocket(wsUrl);

      const fail = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      const connectTimer = setTimeout(() => fail(makeError('websocket', 'انتهت مهلة فتح WebSocket')), 15000);

      socket.addEventListener('open', () => {
        clearTimeout(connectTimer);
        try {
          socket.send(JSON.stringify(setupMessage()));
        } catch (error) {
          fail(makeError('setup-send', error?.message || 'تعذر إرسال setup'));
          return;
        }

        setupTimer = setTimeout(() => fail(makeError('setup', 'لم يصل setupComplete خلال 15 ثانية')), 15000);
      }, { once: true });

      socket.addEventListener('message', event => {
        let message;
        try { message = JSON.parse(event.data); }
        catch { return; }
        handleServerMessage(message);
        if (message.setupComplete && !settled) {
          settled = true;
          resolve();
        }
      });

      socket.addEventListener('error', () => {
        clearTimeout(connectTimer);
        fail(makeError('websocket', 'WebSocket error'));
      }, { once: true });

      socket.addEventListener('close', event => {
        clearTimeout(connectTimer);
        clearTimeout(setupTimer);
        if (!settled) {
          fail(makeError('websocket-close', `${event.code}${event.reason ? ` • ${event.reason}` : ''}`));
          return;
        }
        if (!active) return;
        setupReady = false;
        stopMic();
        setStatus('انقطع الاتصال الصوتي', 'error');
        setDetail(`إغلاق ${event.code}${event.reason ? ` • ${event.reason}` : ''}`);
        showFallback(true);
      });
    });
  }

  async function start() {
    if (active) return;
    ensureUi();
    injectStyles();
    const host = document.getElementById('v80VoiceOverlay');
    host.hidden = false;
    active = true;
    setupReady = false;
    showFallback(false);
    setStatus('أجهز الصوت الحي…', 'connecting');
    setDetail('1/3 أجهز المايك');

    try {
      await prepareAudio();
      setDetail('2/3 أطلب رمزا مؤقتا آمنا');
      const token = await fetchTokenWithAppCheck(false);
      if (!active) return;
      setDetail('3/3 أفتح قناة Gemini Live');
      await connectSocket(token);
    } catch (error) {
      console.error('Mesraah Native Live v0.9.1:', error);
      setStatus('تعذر تشغيل Native Live', 'error');
      setDetail(`المرحلة: ${error?.stage || 'unknown'} | ${error?.message || error}`);
      showFallback(true);
      await shutdownMedia();
      active = false;
    }
  }

  async function shutdownMedia() {
    stopMic();
    clearPlayback();
    micStream?.getTracks?.().forEach(track => track.stop());
    micStream = null;
    try { await micContext?.close(); } catch {}
    try { await outputContext?.close(); } catch {}
    micContext = null;
    outputContext = null;
  }

  async function stop() {
    active = false;
    setupReady = false;
    clearTimeout(setupTimer);
    try {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
        socket.close(1000, 'User ended conversation');
      } else socket?.close?.();
    } catch {}
    socket = null;
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

  injectStyles();
  ensureUi();
})();
