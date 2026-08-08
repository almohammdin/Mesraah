import('./firebase-sync.js?v=0.5.2')
  .then(async () => {
    await import('./firebase-appcheck-core.js?v=0.8.5');
    await import('./google-calendar.js?v=0.8.5');
    await import('./firebase-live-voice-v086.js?v=0.8.6');
    const modules = await Promise.allSettled([
      import('./firebase-ai-assistant.js?v=0.8.5'),
      import('./v080-hardening.js?v=0.8.5')
    ]);
    modules.forEach(result => {
      if (result.status === 'rejected') console.error('Mesraah v0.8.6 module:', result.reason);
    });
    await import('./ui-v080.js?v=0.8.6');
    await import('./version-v086.js?v=0.8.6');
  })
  .catch(error => {
    console.error('Mesraah v0.8.6 bootstrap:', error);
  });
