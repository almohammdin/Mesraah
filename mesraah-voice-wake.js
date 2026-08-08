let wakeLock = null;
let installed = false;

async function requestWakeLock() {
  const voice = window.MesraahVoice;
  if (!voice?.active) return;
  if (document.visibilityState !== 'visible') return;
  if (!('wakeLock' in navigator) || typeof navigator.wakeLock?.request !== 'function') return;
  if (wakeLock && !wakeLock.released) return;

  try {
    const sentinel = await navigator.wakeLock.request('screen');
    if (!window.MesraahVoice?.active || document.visibilityState !== 'visible') {
      try { await sentinel.release(); } catch {}
      return;
    }
    wakeLock = sentinel;
    sentinel.addEventListener('release', () => {
      if (wakeLock === sentinel) wakeLock = null;
    }, { once: true });
  } catch (error) {
    console.warn('Mesraah screen awake unavailable:', error);
  }
}

async function releaseWakeLock() {
  const sentinel = wakeLock;
  wakeLock = null;
  if (!sentinel || sentinel.released) return;
  try { await sentinel.release(); } catch {}
}

function rebindVoiceCloseButtons(voice) {
  const close = document.getElementById('mesraahVoiceClose');
  const stop = document.getElementById('mesraahVoiceStop');
  if (close) close.onclick = () => voice.stop();
  if (stop) stop.onclick = () => voice.stop();
}

function install() {
  const voice = window.MesraahVoice;
  if (!voice || installed) return false;
  installed = true;

  const originalStart = voice.start.bind(voice);
  const originalStop = voice.stop.bind(voice);

  voice.start = async (...args) => {
    const running = originalStart(...args);
    rebindVoiceCloseButtons(voice);
    void requestWakeLock();
    try {
      return await running;
    } finally {
      if (!voice.active) await releaseWakeLock();
    }
  };

  voice.stop = async (...args) => {
    await releaseWakeLock();
    return originalStop(...args);
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && voice.active) void requestWakeLock();
    else void releaseWakeLock();
  });

  window.addEventListener('pagehide', () => { void releaseWakeLock(); });
  return true;
}

if (!install()) {
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (install() || attempts >= 100) clearInterval(timer);
  }, 100);
}
