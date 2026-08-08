import('./firebase-sync.js?v=0.5.2')
  .then(async () => {
    await import('./mesraah-voice-appcheck.js?v=0.10.3');
    await import('./google-calendar.js?v=0.10.3');
    await import('./firebase-ai-assistant.js?v=0.10.3');
    await import('./mesraah-voice-config.js?v=0.10.3');
    await import('./mesraah-voice.js?v=0.10.3');
    await import('./mesraah-voice-wake.js?v=0.10.3');
    const modules = await Promise.allSettled([
      import('./v080-hardening.js?v=0.10.3')
    ]);
    modules.forEach(result => {
      if (result.status === 'rejected') console.error('Mesraah module:', result.reason);
    });
    await import('./ui-v080.js?v=0.10.3');
  })
  .catch(error => {
    console.error('Mesraah bootstrap:', error);
  });
