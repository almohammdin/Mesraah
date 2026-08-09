(async () => {
  try {
    // Render the current interface first. Cloud, calendar and AI integrations load after it.
    await import('./ui-v080.js?v=0.12.4');
    await import('./ux-v011.js?v=0.12.7');
    await import('./ux-v0111-fixes.js?v=0.12.7');
    await import('./modal-runtime-v0115.js?v=0.12.4');
    await import('./task-state-bridge-v012.js?v=0.12.4');
    await import('./recurrence-v012.js?v=0.12.4');
    await import('./examples-v0112.js?v=0.12.4');
    await import('./calendar-view-v0122.js?v=0.12.4');
    await import('./v080-hardening.js?v=0.12.4');

    await import('./firebase-sync.js?v=0.12.4');
    await import('./mesraah-voice-appcheck.js?v=0.12.4');
    await import('./google-calendar.js?v=0.12.4');
    await import('./assistant-reliability-v012.js?v=0.12.5');
    await import('./mesraah-voice-tools.js?v=0.12.4');
    await import('./mesraah-voice-config.js?v=0.12.4');
    await import('./mesraah-voice.js?v=0.12.4');
    await import('./mesraah-voice-wake.js?v=0.12.4');
    await import('./calendar-sync-v0112.js?v=0.12.4');
    await import('./assistant-hub-v0112.js?v=0.12.5');

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

    document.documentElement.dataset.mesraahVersion = '0.12.7';
    const footer = document.querySelector('.mesraah-footer-bottom');
    footer?.querySelectorAll(':scope > span').forEach(element => {
      if (/^v\d+\.\d+\.\d+$/.test(element.textContent.trim())) element.textContent = 'v0.12.7';
    });
    footer?.querySelectorAll('.v7-version').forEach(element => { element.textContent = 'v0.12.7'; });
  } catch (error) {
    console.error('Mesraah bootstrap:', error);
  }
})();
