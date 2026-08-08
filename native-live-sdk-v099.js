const SOURCE = 'https://cdn.jsdelivr.net/gh/almohammdin/Mesraah@e9bc14f81565fe958d8ac5b1ea5e8f3e897c42ed/native-live-sdk-v098.js';

async function boot() {
  const response = await fetch(`${SOURCE}?v=099`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`native-live-v098-source-${response.status}`);
  let code = await response.text();

  // v0.9.8 TOOL_CODE was authored through a raw template and preserved two
  // backslashes inside regex literals. Normalize them before that loader runs.
  code = code
    .replaceAll('0.9.8', '0.9.9')
    .replaceAll(String.raw`/\\s+/g`, String.raw`/\s+/g`)
    .replaceAll(String.raw`/^\\d{4}-\\d{2}-\\d{2}$/`, String.raw`/^\d{4}-\d{2}-\d{2}$/`);

  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  try {
    await import(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

boot().catch(error => {
  console.error('Mesraah Native Live v0.9.9 loader:', error);
  window.__MESRAAH_NATIVE_LIVE_LOAD_ERROR__ = String(error?.message || error);
});
