import('./firebase-sync.js?v=0.5.2')
  .then(async () => {
    await import('./firebase-appcheck-core.js?v=0.9.0');
    await import('./google-calendar.js?v=0.9.0');
    await import('./firebase-ai-assistant.js?v=0.9.0');
    await import('./native-live-config.js?v=0.9.0');
    await import('./native-live-v090.js?v=0.9.0');
    const modules = await Promise.allSettled([
      import('./v080-hardening.js?v=0.9.0')
    ]);
    modules.forEach(result => {
      if (result.status === 'rejected') console.error('Mesraah v0.9.0 module:', result.reason);
    });
    await import('./ui-v080.js?v=0.9.0');
  })
  .catch(error => {
    console.error('Mesraah v0.9.0 bootstrap:', error);
  });
