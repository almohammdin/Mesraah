import('./firebase-sync.js?v=0.5.2')
  .then(async () => {
    if (!document.querySelector('link[data-mesraah-v011]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './ux-v011.css?v=0.11.4';
      link.dataset.mesraahV011 = '';
      document.head.appendChild(link);
    }
    if (!document.querySelector('link[data-mesraah-v0111-fixes]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './ux-v0111-fixes.css?v=0.11.4';
      link.dataset.mesraahV0111Fixes = '';
      document.head.appendChild(link);
    }
    if (!document.querySelector('link[data-mesraah-v0112]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = './ux-v0112.css?v=0.11.4';
      link.dataset.mesraahV0112 = '';
      document.head.appendChild(link);
    }

    await import('./mesraah-voice-appcheck.js?v=0.11.4');
    await import('./google-calendar.js?v=0.11.4');
    await import('./firebase-ai-assistant.js?v=0.11.4');
    await import('./mesraah-voice-config.js?v=0.11.4');
    await import('./mesraah-voice.js?v=0.11.4');
    await import('./mesraah-voice-wake.js?v=0.11.4');

    const modules = await Promise.allSettled([
      import('./v080-hardening.js?v=0.11.4')
    ]);
    modules.forEach(result => {
      if (result.status === 'rejected') console.error('Mesraah module:', result.reason);
    });

    await import('./ui-v080.js?v=0.11.4');
    await import('./ux-v011.js?v=0.11.4');
    await import('./ux-v0111-fixes.js?v=0.11.4');
    await import('./calendar-sync-v0112.js?v=0.11.4');
    await import('./assistant-hub-v0112.js?v=0.11.4');
    await import('./examples-v0112.js?v=0.11.4');

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

    document.documentElement.dataset.mesraahVersion = '0.11.4';
    const footer = document.querySelector('.mesraah-footer-bottom');
    footer?.querySelectorAll(':scope > span').forEach(el => {
      if (/^v\d+\.\d+\.\d+$/.test(el.textContent.trim())) el.textContent = 'v0.11.4';
    });
    footer?.querySelectorAll('.v7-version').forEach(el => { el.textContent = 'v0.11.4'; });
  })
  .catch(error => {
    console.error('Mesraah bootstrap:', error);
  });
