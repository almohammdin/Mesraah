(() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasSpeech = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

  let active = false;
  let recognition = null;
  let thinking = false;
  let speaking = false;
  let restartTimer = null;
  let turn = 0;

  function injectStyles() {
    if (document.getElementById('v87VoiceStyles')) return;
    const style = document.createElement('style');
    style.id = 'v87VoiceStyles';
    style.textContent = `
      .v87-voice-line{min-height:46px;margin:10px auto 14px;padding:10px 12px;border:1px solid rgba(255,255,255,.10);border-radius:14px;background:rgba(255,255,255,.055);color:rgba(255,255,255,.78);font-size:12px;line-height:1.75;text-align:right}
      .v87-voice-line strong{color:#fff}.v87-voice-start{border:0;background:#fff;color:#123B4A;border-radius:13px;padding:10px 18px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;min-width:150px;margin-inline:4px}.v87-voice-start:hover{transform:translateY(-1px)}
      .v80-voice-overlay[data-state="thinking"] .v80-voice-orb{animation:v80Breath 1.05s ease-in-out infinite}.v80-voice-overlay[data-state="speaking"] .v80-voice-orb{animation:v80Breath .82s ease-in-out infinite}
      .v87-voice-actions{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}.v87-voice-note{margin:8px auto 0!important;font-size:9.5px!important;color:rgba(255,255,255,.48)!important}
    `;
    document.head.appendChild(style);
  }

  function ensureUi() {
    injectStyles();
    let overlay = document.getElementById('v80VoiceOverlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'v80VoiceOverlay';
    overlay.className = 'v80-voice-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="v80-voice-card" role="dialog" aria-modal="true" aria-label="محادثة صوتية مع مسراح">
        <div class="v80-voice-top">
          <div><span class="v80-voice-kicker">محادثة صوتية</span><strong>تحدث مع مسراح</strong></div>
          <button type="button" id="v80VoiceClose" aria-label="إغلاق">×</button>
        </div>
        <div class="v80-voice-orb"><span></span><span></span><span></span></div>
        <div class="v80-voice-status" id="v80VoiceStatus" role="status" aria-live="polite">جاهز</div>
        <div class="v87-voice-line" id="v87VoiceLine">قل أي شيء عن يومك، مهامك أو مواعيدك.</div>
        <div class="v87-voice-actions">
          <button type="button" class="v87-voice-start" id="v87VoiceStart">ابدأ المحادثة</button>
          <button type="button" class="v80-voice-stop" id="v80VoiceStop">إنهاء</button>
        </div>
        <p class="v87-voice-note">يتذكر مسراح سياق الحديث ويستخدم نفس بيانات المنصة.</p>
      </section>`;
    document.body.appendChild(overlay);
    document.getElementById('v80VoiceClose').onclick = stop;
    document.getElementById('v80VoiceStop').onclick = stop;
    document.getElementById('v87VoiceStart').onclick = beginListening;
  }

  function overlay() { return document.getElementById('v80VoiceOverlay'); }
  function setStatus(text, state = '') {
    const el = document.getElementById('v80VoiceStatus');
    if (el) el.textContent = text;
    const host = overlay();
    if (host) host.dataset.state = state;
  }
  function setLine(text, speaker = '') {
    const el = document.getElementById('v87VoiceLine');
    if (!el) return;
    el.innerHTML = speaker ? `<strong>${speaker}</strong> ${escapeHtml(text)}` : escapeHtml(text);
  }
  function escapeHtml(value = '') {
    return String(value).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function supported() {
    if (!SR) return 'المتصفح الحالي لا يوفر التعرف الصوتي للمحادثة';
    if (!hasSpeech) return 'المتصفح الحالي لا يوفر قراءة الرد بالصوت';
    return '';
  }

  function createRecognition() {
    const r = new SR();
    r.lang = 'ar-SA';
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => {
      recognition = r;
      setStatus('أسمعك الآن', 'listening');
    };

    r.onresult = event => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) finalText += text;
        else interim += text;
      }
      if (interim) setLine(interim, 'أنت:');
      if (finalText.trim()) handleTurn(finalText.trim());
    };

    r.onerror = event => {
      recognition = null;
      if (!active) return;
      const code = event.error || '';
      if (code === 'no-speech' || code === 'aborted') {
        scheduleListen(350);
        return;
      }
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        active = false;
        setStatus('اسمح للمايك ثم ابدأ المحادثة', 'error');
        return;
      }
      setStatus('تعذر التقاط الصوت، سأحاول مرة ثانية', 'error');
      scheduleListen(700);
    };

    r.onend = () => {
      if (recognition === r) recognition = null;
      if (active && !thinking && !speaking) scheduleListen(260);
    };
    return r;
  }

  function startListening() {
    if (!active || thinking || speaking || recognition) return;
    try {
      const r = createRecognition();
      r.start();
    } catch (error) {
      console.warn('Mesraah voice recognition start:', error);
      recognition = null;
      if (active) scheduleListen(650);
    }
  }

  function scheduleListen(delay = 250) {
    clearTimeout(restartTimer);
    if (!active || thinking || speaking) return;
    restartTimer = setTimeout(startListening, delay);
  }

  function stopRecognition() {
    if (!recognition) return;
    try { recognition.stop(); } catch {}
    recognition = null;
  }

  function waitForAssistantAnswer(previousHtml, turnId) {
    return new Promise((resolve, reject) => {
      const preview = document.getElementById('flyPreview');
      const send = document.getElementById('flySend');
      if (!preview || !send) return reject(new Error('assistant-ui-missing'));

      let timer;
      const finish = (answer) => {
        clearTimeout(timer);
        observer.disconnect();
        resolve(answer);
      };
      const check = () => {
        if (turnId !== turn) return;
        const answer = preview.querySelector('.fly-ai-answer');
        const changed = preview.innerHTML !== previousHtml;
        if (changed && answer && answer.textContent.trim() && !send.disabled) finish(answer.textContent.trim());
      };
      const observer = new MutationObserver(check);
      observer.observe(preview, { childList: true, subtree: true, characterData: true, attributes: true });
      observer.observe(send, { attributes: true, attributeFilter: ['disabled'] });
      timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error('assistant-timeout'));
      }, 45000);
      check();
    });
  }

  async function askAssistant(text) {
    const input = document.getElementById('flyInput');
    const send = document.getElementById('flySend');
    const preview = document.getElementById('flyPreview');
    if (!input || !send || !preview) throw new Error('assistant-not-ready');

    const turnId = ++turn;
    const previousHtml = preview.innerHTML;
    const response = waitForAssistantAnswer(previousHtml, turnId);
    input.value = text;
    send.click();
    return response;
  }

  function chooseArabicVoice() {
    const voices = window.speechSynthesis.getVoices?.() || [];
    return voices.find(v => /^ar-SA$/i.test(v.lang))
      || voices.find(v => /^ar/i.test(v.lang))
      || null;
  }

  function speak(text) {
    return new Promise(resolve => {
      if (!hasSpeech || !active) return resolve();
      speaking = true;
      setStatus('مسراح يتكلم', 'speaking');
      setLine(text, 'مسراح:');
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.96;
      const voice = chooseArabicVoice();
      if (voice) utterance.voice = voice;
      const done = () => {
        speaking = false;
        resolve();
      };
      utterance.onend = done;
      utterance.onerror = done;
      window.speechSynthesis.speak(utterance);
    });
  }

  async function handleTurn(text) {
    if (!active || thinking) return;
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return;
    if (/^(انهاء|إنهاء|وقف|خلاص|اقفل|أقفل)( المحادثة)?$/i.test(normalized)) {
      stop();
      return;
    }

    thinking = true;
    stopRecognition();
    setLine(normalized, 'أنت:');
    setStatus('أفكر في كلامك', 'thinking');

    try {
      const reply = await askAssistant(normalized);
      thinking = false;
      await speak(reply);
      if (active) scheduleListen(320);
    } catch (error) {
      console.error('Mesraah voice conversation:', error);
      thinking = false;
      setStatus('تعذر الرد الآن', 'error');
      setLine('جرب تقولها مرة ثانية.');
      if (active) scheduleListen(900);
    }
  }

  function beginListening() {
    const issue = supported();
    if (issue) {
      setStatus(issue, 'error');
      return;
    }
    active = true;
    thinking = false;
    speaking = false;
    clearTimeout(restartTimer);
    window.speechSynthesis.cancel();
    setLine('تكلم بشكل طبيعي، وأنا معك.', 'مسراح:');
    startListening();
    const startButton = document.getElementById('v87VoiceStart');
    if (startButton) startButton.textContent = 'أسمعك الآن';
  }

  function start() {
    ensureUi();
    const host = overlay();
    host.hidden = false;
    const issue = supported();
    if (issue) {
      setStatus(issue, 'error');
      setLine('استخدم متصفحا يدعم التعرف الصوتي وقراءة النص.');
      return;
    }
    // The click on the main voice button is a user gesture, so start the microphone immediately.
    beginListening();
  }

  function stop() {
    active = false;
    thinking = false;
    speaking = false;
    clearTimeout(restartTimer);
    restartTimer = null;
    stopRecognition();
    if (hasSpeech) window.speechSynthesis.cancel();
    setStatus('انتهت المحادثة', '');
    const host = overlay();
    if (host) setTimeout(() => { host.hidden = true; }, 180);
  }

  window.MesraahVoice = {
    start,
    stop,
    get active() { return active; }
  };

  ensureUi();
})();
