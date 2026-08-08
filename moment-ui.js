import('./firebase-sync.js?v=0.5.2')
  .then(async () => {
    await import('./firebase-appcheck-core.js?v=0.8.7');
    await import('./google-calendar.js?v=0.8.7');
    await import('./firebase-ai-assistant.js?v=0.8.7');
    await import('./voice-conversation-v087.js?v=0.8.7');
    const modules = await Promise.allSettled([
      import('./v080-hardening.js?v=0.8.7')
    ]);
    modules.forEach(result => {
      if (result.status === 'rejected') console.error('Mesraah v0.8.7 module:', result.reason);
    });
    await import('./ui-v080.js?v=0.8.7');
  })
  .catch(error => {
    console.error('Mesraah v0.8.7 bootstrap:', error);
  });
