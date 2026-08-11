window.MESRAAH_VOICE_TOKEN_ENDPOINT = 'https://mesraah-live-token.naif123456.workers.dev/token';

(() => {
  if (window.__MESRAAH_VOICE_FETCH_PATCHED__) return;
  window.__MESRAAH_VOICE_FETCH_PATCHED__ = true;
  const nativeFetch = window.fetch.bind(window);
  const endpoint = window.MESRAAH_VOICE_TOKEN_ENDPOINT;

  function diag(stage, code, detail='') {
    window.MesraahVoiceDiagnostics = { stage, code, detail, at: Date.now() };
  }

  async function tokenFetch(input, init={}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const externalSignal = init.signal;
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
      diag('worker','requesting');
      const response = await nativeFetch(input, { ...init, signal: controller.signal });
      if (response.ok) diag('gemini','token-ready');
      else diag('worker',`http-${response.status}`, response.statusText || '');
      return response;
    } catch (error) {
      if (error?.name === 'AbortError') diag('worker','timeout','token endpoint timeout');
      else diag('worker','network-error',String(error?.message || error));
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (url !== endpoint) return nativeFetch(input, init);
    try {
      const first = await tokenFetch(input, init);
      if (first.ok || (first.status < 500 && first.status !== 429)) return first;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
    return tokenFetch(input, init);
  };
})();
