(() => {
  const SOURCE = 'https://cdn.jsdelivr.net/gh/almohammdin/Mesraah@a9a36af543d82bb007139e8db4682c80cc39891e/native-live-v091.js';

  async function boot() {
    const response = await fetch(`${SOURCE}?v=094`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`native-live-source-${response.status}`);

    let code = await response.text();
    code = code
      .replaceAll('Native Live v0.9.1', 'Native Live v0.9.4')
      .replaceAll('Mesraah Native Live v0.9.1', 'Mesraah Native Live v0.9.4');

    // Keep the original v1alpha constrained WebSocket used by Google's current SDK
    // for ephemeral-token Live sessions. Do not rewrite it to v1beta here.
    (0, eval)(`${code}\n//# sourceURL=mesraah-native-live-v094-runtime.js`);
    window.__MESRAAH_NATIVE_LIVE_VERSION__ = '0.9.4';
  }

  boot().catch(error => {
    console.error('Mesraah Native Live v0.9.4 loader:', error);
    window.__MESRAAH_NATIVE_LIVE_LOAD_ERROR__ = String(error?.message || error);
  });
})();