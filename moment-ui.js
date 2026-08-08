import('./firebase-sync.js?v=0.5.2')
  .then(async () => {
    if (!document.querySelector('link[data-mesraah-v011]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './ux-v011.css?v=0.11.0';
      link.dataset.mesraahV011 = '';
      document.head.appendChild(link);
    }

    await import('./mesraah-voice-appcheck.js?v=0.11.0');
    await import('./google-calendar.js?v=0.11.0');
    await import('./firebase-ai-assistant.js?v=0.11.0');
    await import('./mesraah-voice-config.js?v=0.11.0');
    await import('./mesraah-voice.js?v=0.11.0');
    await import('./mesraah-voice-wake.js?v=0.11.0');

    const modules = await Promise.allSettled([
      import('./v080-hardening.js?v=0.11.0')
    ]);
    modules.forEach(result => {
      if (result.status === 'rejected') console.error('Mesraah module:', result.reason);
    });

    await import('./ui-v080.js?v=0.11.0');
    await import('./ux-v011.js?v=0.11.0');
  })
  .catch(error => {
    console.error('Mesraah bootstrap:', error);
  });
