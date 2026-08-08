import('./firebase-sync.js?v=0.5.2')
  .then(async () => {
    await import('./firebase-appcheck-core.js?v=0.8.5');
    await import('./google-calendar.js?v=0.8.5');
    await import('./firebase-live-voice-v085.js?v=0.8.5');
    const modules = await Promise.allSettled([
      import('./firebase-ai-assistant.js?v=0.8.5'),
      import('./v080-hardening.js?v=0.8.5')
    ]);
    modules.forEach(result => {
      if (result.status === 'rejected') console.error('Mesraah v0.8.5 module:', result.reason);
    });
    await import('./ui-v080.js?v=0.8.5');
    await import('./version-v085.js?v=0.8.5');
  })
  .catch(error => {
    console.error('Mesraah v0.8.5 bootstrap:', error);
  });
