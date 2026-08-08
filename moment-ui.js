import('./firebase-sync.js?v=0.5.2')
  .then(async () => {
    await import('./google-calendar.js?v=0.8.1');
    const modules = await Promise.allSettled([
      import('./firebase-ai-assistant.js?v=0.8.1'),
      import('./firebase-live-voice.js?v=0.8.2'),
      import('./v080-hardening.js?v=0.8.1')
    ]);
    modules.forEach(result => {
      if (result.status === 'rejected') console.error('Mesraah v0.8.2 module:', result.reason);
    });
    await import('./ui-v080.js?v=0.8.2');
  })
  .catch(error => {
    console.error('Mesraah v0.8.2 bootstrap:', error);
  });
