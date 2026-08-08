import('./firebase-sync.js?v=0.5.2')
  .then(async () => {
    await import('./firebase-appcheck-core.js?v=0.8.4');
    await import('./google-calendar.js?v=0.8.4');
    await import('./firebase-live-voice-v084.js?v=0.8.4');
    const modules = await Promise.allSettled([
      import('./firebase-ai-assistant.js?v=0.8.4'),
      import('./v080-hardening.js?v=0.8.4')
    ]);
    modules.forEach(result => {
      if (result.status === 'rejected') console.error('Mesraah v0.8.4 module:', result.reason);
    });
    await import('./ui-v080.js?v=0.8.4');
    await import('./version-v084.js?v=0.8.4');
  })
  .catch(error => {
    console.error('Mesraah v0.8.4 bootstrap:', error);
  });
