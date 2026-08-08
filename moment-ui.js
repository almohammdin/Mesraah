import('./firebase-sync.js?v=0.5.2')
  .then(async () => {
    await import('./google-calendar.js?v=0.8.0');
    const modules = await Promise.allSettled([
      import('./firebase-ai-assistant.js?v=0.8.0'),
      import('./firebase-live-voice.js?v=0.8.0'),
      import('./v080-hardening.js?v=0.8.0')
    ]);
    modules.forEach(result => {
      if (result.status === 'rejected') console.error('Mesraah v0.8 module:', result.reason);
    });
    await import('./ui-v080.js?v=0.8.0');
  })
  .catch(error => {
    console.error('Mesraah v0.8 bootstrap:', error);
  });
