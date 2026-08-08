(() => {
  const MODEL = 'gemini-3.1-flash-live-preview';
  const INPUT_RATE = 16000;
  const OUTPUT_RATE = 24000;
  const ENDPOINT_KEY = 'mesraah_native_live_token_endpoint';
  const DATA_KEY = 'mesraah_v030';

  let active = false;
  let socket = null;
  let micStream = null;
  let micContext = null;
  let micSource = null;
  let micProcessor = null;
  let silentGain = null;
  let outputContext = null;
  let nextPlayAt = 0;
  let playingSources = new Set();
  let setupReady = false;

  function endpoint() {
    return String(window.MESRAAH_NATIVE_LIVE_TOKEN_ENDPOINT || localStorage.getItem(ENDPOINT_KEY) || '').trim();
  }

  function readState() {
    try { return JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {}; }
    catch { return {}; }
  }

  function systemInstruction() {
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

    return `أنت مسراح، مساعد شخصي سعودي صوتي. هذه محادثة صوتية حقيقية، فتحدث بطبيعية واختصار وبلهجة سعودية سهلة.
الوقت الحالي في الرياض: ${now}.
افهم كلام المستخدم من صوته مباشرة، وتفاعل معه مثل مساعد شخصي يعرف يومه، وليس كقارئ مهام.
إذا سألك عن اليوم أو بكرة استخدم البيانات الموجودة فقط. اربط بين المهام والمواعيد والأشخاص عندما يكون الارتباط حقيقيا ومفيدا، ولا تخترع موعدا أو مدينة أو علاقة.
إذا ذكر رغبة مثل زيارة شخص، تفاعل أولا ثم اقترح وقتا أو خطوة مناسبة إذا ساعدت البيانات.
لا تدع تنفيذ أي مهمة أو موعد في هذه النسخة قبل وجود استدعاء أداة مؤكد. يمكنك اقتراح الإجراء صوتيا فقط.
يجب أن يكون الرد بالعربية السعودية وبصوت طبيعي وجمل مناسبة لمن يقود السيارة.

بيانات المستخدم:
${JSON.stringify({ name: state.profile?.name || '', tasks, people, calendar })}`;
  }

  function ensureUi() {
    let overlay = document.getElementById('v80VoiceOverlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'v80VoiceOverlay';
    overlay.className = 'v80-voice-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="v80-voice-card" role="dialog" aria-modal="true" aria-label="محادثة صوتية حية مع مسراح">
        <div class="v80-voice-top">
          <div><span class="v80-voice-kicker">Native Live</span><strong>تحدث مع مسراح</strong></div>
          <button type="button" id="v90VoiceClose" aria-label="إغلاق">×</button>
        </div>
        <div class="v80-voice-orb"><span></span><span></span><span></span></div>
        <div class="v80-voice-status" id="v90VoiceStatus" role="status" aria-live="polite">جاهز</div>
        <div class="v90-transcript" id="v90Transcript">صوتك يذهب مباشرة إلى Gemini Live ويعود الرد صوتا.</div>
        <div class="v90-voice-actions">
          <button type="button" class="v80-voice-stop" id="v90VoiceStop">إنهاء المحادثة</button>
          <button type="button" class="v90-fallback" id="v90Fallback" hidden>الوضع الاحتياطي</button>
        </div>
      </section>`;
    document.body.appendChild(overlay);
    document.getElementById('v90VoiceClose').onclick = stop;
    document.getElementById('v90VoiceStop').onclick = stop;
    document.getElementById('v90Fallback').onclick = useFallback;
  }

  function injectStyles() {
    if (document.getElementById('v90NativeStyles')) return;
    const style = document.createElement('style');
    style.id = 'v90NativeStyles';
    style.textContent = `
      .v90-transcript{min-height:48px;margin:10px auto 16px;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:rgba(255,255,255,.75);font-size:11px;line-height:1.7;text-align:right}
      .v90-transcript strong{color:#fff}.v90-voice-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}.v90-fallback{border:1px solid rgba(255,255,255,.15);background:transparent;color:rgba(255,255,255,.8);border-radius:13px;padding:9px 13px;font:inherit;font-size:10.5px;cursor:pointer}
      .v80-voice-overlay[data-state="connecting"] .v80-voice-orb{animation:v80Breath 1.4s ease-in-out infinite}.v80-voice-overlay[data-state="listening"] .v80-voice-orb{animation:v80Breath 1.05s ease-in-out infinite}.v80-voice-overlay[data-state="speaking"] .v80-voice-orb{animation:v80Breath .72s ease-in-out infinite}
    `;
    document.head.appendChild(style);
  }

  function setStatus(text, state = '') {
    const status = document.getElementById('v90VoiceStatus');
    if (status) status.textContent = text;
    const overlay = document.getElementById('v80VoiceOverlay');
    if (overlay) overlay.dataset.state = state;
  }

  function setTranscript(text, speaker = '') {
    const el = document.getElementById('v90Transcript');
    if (!el) return;
    el.textContent = speaker ? `${speaker} ${text}` : text;
  }

  function showFallback(show = true) {
    const button = document.getElementById('v90Fallback');
    if (button) button.hidden = !show;
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function resampleToInt16(input, sourceRate, targetRate = INPUT_RATE) {
    if (!input?.length) return new Int16Array();
    const ratio = sourceRate / targetRate;
    const outputLength = Math.max(1, Math.round(input.length / ratio));
    const output = new Int16Array(outputLength);
    for (let i = 0; i < outputLength; i += 1) {
      const position = i * ratio;
      const left = Math.floor(position);
      const right = Math.min(left + 1, input.length - 1);
      const mix = position - left;
      const value = (input[left] || 0) * (1 - mix) + (input[right] || 0) * mix;
      const clamped = Math.max(-1, Math.min(1, value));
      output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }
    return output;
  }

  function int16ToBytes(samples) {
    return new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  }

  async function prepareAudio() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('microphone-not-supported');
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    micContext = new AudioCtx();
    outputContext = new AudioCtx();
    await Promise.all([micContext.resume(), outputContext.resume()]);
    nextPlayAt = outputContext.currentTime;
  }

  function beginMicStreaming() {
    if (!active || !setupReady || !micStream || !micContext || micProcessor) return;
    micSource = micContext.createMediaStreamSource(micStream);
    micProcessor = micContext.createScriptProcessor(2048, 1, 1);
    silentGain = micContext.createGain();
    silentGain.gain.value = 0;

    micProcessor.onaudioprocess = event => {
      if (!active || !socket || socket.readyState !== WebSocket.OPEN || !setupReady) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcm = resampleToInt16(input, micContext.sampleRate, INPUT_RATE);
      if (!pcm.length) return;
      socket.send(JSON.stringify({
        realtimeInput: {
          audio: {
            data: bytesToBase64(int16ToBytes(pcm)),
            mimeType: `audio/pcm;rate=${INPUT_RATE}`
          }
        }
      }));
    };

    micSource.connect(micProcessor);
    micProcessor.connect(silentGain);
    silentGain.connect(micContext.destination);
  }

  function stopMicStreaming() {
    if (micProcessor) {
      micProcessor.onaudioprocess = null;
      try { micProcessor.disconnect(); } catch {}
    }
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

  async function playPcm(base64) {
    if (!active || !outputContext || !base64) return;
    const bytes = base64ToBytes(base64);
    const evenLength = bytes.byteLength - (bytes.byteLength % 2);
    if (!evenLength) return;
    const view = new DataView(bytes.buffer, bytes.byteOffset, evenLength);
    const count = evenLength / 2;
    const buffer = outputContext.createBuffer(1, count, OUTPUT_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < count; i += 1) channel[i] = view.getInt16(i * 2, true) / 32768;

    const source = outputContext.createBufferSource();
    source.buffer = buffer;
    source.connect(outputContext.destination);
    const startAt = Math.max(outputContext.currentTime + 0.015, nextPlayAt);
    nextPlayAt = startAt + buffer.duration;
    playingSources.add(source);
    source.onended = () => playingSources.delete(source);
    source.start(startAt);
    setStatus('مسراح يتكلم', 'speaking');
  }

  async function requestEphemeralToken() {
    const url = endpoint();
    if (!url) throw new Error('token-endpoint-missing');
    if (typeof window.MesraahGetAppCheckToken !== 'function') throw new Error('app-check-not-ready');
    const appCheckToken = await window.MesraahGetAppCheckToken();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Firebase-AppCheck': appCheckToken
      },
      body: '{}'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token) {
      const error = new Error(data?.error || `token-endpoint-${response.status}`);
      error.status = response.status;
      throw error;
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
          parts: [{ text: systemInstruction() }]
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
      setupReady = true;
      setStatus('أسمعك الآن', 'listening');
      setTranscript('تكلم بشكل طبيعي. تستطيع مقاطعتي وأنا أتكلم.');
      beginMicStreaming();
      return;
    }

    const content = message.serverContent;
    if (content) {
      if (content.interrupted) {
        clearPlayback();
        setStatus('أسمعك الآن', 'listening');
      }
      if (content.inputTranscription?.text) setTranscript(content.inputTranscription.text, 'أنت:');
      if (content.outputTranscription?.text) setTranscript(content.outputTranscription.text, 'مسراح:');
      for (const part of content.modelTurn?.parts || []) {
        if (part.inlineData?.data) playPcm(part.inlineData.data).catch(console.error);
      }
      if (content.turnComplete && active) setStatus('أسمعك الآن', 'listening');
    }

    if (message.goAway && active) {
      setStatus('سأجدد الاتصال', 'connecting');
    }
  }

  async function connectNative(token) {
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token)}`;
    socket = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('live-connect-timeout')), 15000);
      socket.addEventListener('open', () => {
        clearTimeout(timeout);
        socket.send(JSON.stringify(setupMessage()));
        resolve();
      }, { once: true });
      socket.addEventListener('error', () => {
        clearTimeout(timeout);
        reject(new Error('live-websocket-error'));
      }, { once: true });
    });

    socket.addEventListener('message', event => {
      try { handleServerMessage(JSON.parse(event.data)); }
      catch (error) { console.warn('Mesraah Native Live message:', error); }
    });
    socket.addEventListener('close', event => {
      if (!active) return;
      setupReady = false;
      stopMicStreaming();
      setStatus('انقطع الاتصال الصوتي', 'error');
      setTranscript(event.reason || `أغلق الاتصال برمز ${event.code}`);
      showFallback(true);
    });
  }

  async function start() {
    if (active) return;
    ensureUi();
    injectStyles();
    const overlay = document.getElementById('v80VoiceOverlay');
    overlay.hidden = false;
    active = true;
    setupReady = false;
    showFallback(false);
    setStatus('أجهز الصوت الحي…', 'connecting');
    setTranscript('أفتح قناة صوت مباشرة وآمنة مع Gemini Live.');

    try {
      await prepareAudio();
      const token = await requestEphemeralToken();
      if (!active) return;
      await connectNative(token);
    } catch (error) {
      console.error('Mesraah Native Live start:', error);
      setStatus('تعذر تشغيل Native Live', 'error');
      const message = String(error?.message || 'unknown');
      if (message === 'token-endpoint-missing') setTranscript('خادم الرمز المؤقت لم يربط بعد بهذه النسخة التجريبية.');
      else if (message === 'NotAllowedError' || error?.name === 'NotAllowedError') setTranscript('اسمح لمسراح باستخدام المايك ثم حاول مرة ثانية.');
      else setTranscript('تعذر فتح المحادثة الحية. الوضع الاحتياطي ما زال متاحا.');
      showFallback(true);
      await shutdownMedia();
    }
  }

  async function shutdownMedia() {
    stopMicStreaming();
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
    try {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
        socket.close(1000, 'User ended conversation');
      } else socket?.close?.();
    } catch {}
    socket = null;
    await shutdownMedia();
    setStatus('انتهت المحادثة', '');
    const overlay = document.getElementById('v80VoiceOverlay');
    if (overlay) setTimeout(() => { overlay.hidden = true; }, 160);
  }

  async function useFallback() {
    await stop();
    try {
      await import('./voice-conversation-v087.js?v=0.8.7');
      window.MesraahVoice?.start?.();
    } catch (error) {
      console.error('Mesraah fallback voice:', error);
    }
  }

  window.MesraahNativeLive = {
    start,
    stop,
    get active() { return active; },
    setTokenEndpoint(url) { localStorage.setItem(ENDPOINT_KEY, String(url || '').trim()); }
  };
  window.MesraahVoice = window.MesraahNativeLive;

  injectStyles();
  ensureUi();
})();
