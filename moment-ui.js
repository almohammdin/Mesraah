import('./firebase-sync.js?v=0.5.2')
  .then(async () => {
    if (!document.querySelector('link[data-mesraah-v011]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './ux-v011.css?v=0.11.1';
      link.dataset.mesraahV011 = '';
      document.head.appendChild(link);
    }
    if (!document.querySelector('link[data-mesraah-v0111-fixes]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './ux-v0111-fixes.css?v=0.11.1';
      link.dataset.mesraahV0111Fixes = '';
      document.head.appendChild(link);
    }

    await import('./mesraah-voice-appcheck.js?v=0.11.1');
    await import('./google-calendar.js?v=0.11.1');
    await import('./firebase-ai-assistant.js?v=0.11.1');
    await import('./mesraah-voice-config.js?v=0.11.1');
    await import('./mesraah-voice.js?v=0.11.1');
    await import('./mesraah-voice-wake.js?v=0.11.1');

    const modules = await Promise.allSettled([
      import('./v080-hardening.js?v=0.11.1')
    ]);
    modules.forEach(result => {
      if (result.status === 'rejected') console.error('Mesraah module:', result.reason);
    });

    await import('./ui-v080.js?v=0.11.1');
    await import('./ux-v011.js?v=0.11.1');
    await import('./ux-v0111-fixes.js?v=0.11.1');

    const hijriButton = document.querySelector('[data-v11-date-mode="hijri"]');
    hijriButton?.addEventListener('click', () => {
      const due = document.getElementById('v11DueGregorian');
      if (due?.value) return;
      const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
        timeZone: 'Asia/Riyadh', year: 'numeric', month: 'numeric', day: 'numeric'
      }).formatToParts(new Date()).reduce((out, part) => {
        if (part.type !== 'literal') out[part.type] = Number(part.value);
        return out;
      }, {});
      const day = document.getElementById('v11HijriDay');
      const month = document.getElementById('v11HijriMonth');
      const year = document.getElementById('v11HijriYear');
      if (day) day.value = String(parts.day);
      if (month) month.value = String(parts.month);
      if (year) year.value = String(parts.year);
      day?.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const voiceExamples = document.querySelectorAll('.v11-voice-examples span');
    if (voiceExamples[2]) voiceExamples[2].textContent = 'عدل موعد';
  })
  .catch(error => {
    console.error('Mesraah bootstrap:', error);
  });
