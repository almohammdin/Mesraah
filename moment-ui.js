(async () => {
  const VERSION='0.15.3';
  const idle=fn=>('requestIdleCallback'in window?requestIdleCallback(fn,{timeout:1800}):setTimeout(fn,700));
  function stampVersion(){
    document.documentElement.dataset.mesraahVersion=VERSION;
    const footer=document.querySelector('.mesraah-footer-bottom');
    footer?.querySelectorAll(':scope > span').forEach(el=>{if(/^v\d+\.\d+\.\d+$/.test(el.textContent.trim()))el.textContent=`v${VERSION}`});
    footer?.querySelectorAll('.v7-version').forEach(el=>el.textContent=`v${VERSION}`);
  }
  try {
    await import('./ux-v011.js?v=0.15.1');
    await import('./ux-v0111-fixes.js?v=0.12.7');
    await import('./modal-runtime-v0115.js?v=0.12.4');
    await import('./task-state-bridge-v012.js?v=0.13.0');
    await import('./recurrence-v012.js?v=0.12.4');
    await import('./v080-hardening.js?v=0.12.4');
    await import('./priority-core-v015.js?v=0.15.1');
    await import('./assistant-hub-v0112.js?v=0.15.2');
    await import('./assistant-first-v014.js?v=0.15.1');
    await import('./quick-capture-fix-v0153.js?v=0.15.3');

    const hijriButton=document.querySelector('[data-v11-date-mode="hijri"]');
    hijriButton?.addEventListener('click',()=>{
      const due=document.getElementById('v11DueGregorian');if(due?.value)return;
      const parts=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn',{timeZone:'Asia/Riyadh',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date()).reduce((out,part)=>{if(part.type!=='literal')out[part.type]=Number(part.value);return out},{});
      const day=document.getElementById('v11HijriDay'),month=document.getElementById('v11HijriMonth'),year=document.getElementById('v11HijriYear');
      if(day)day.value=String(parts.day);if(month)month.value=String(parts.month);if(year)year.value=String(parts.year);day?.dispatchEvent(new Event('change',{bubbles:true}));
    });
    stampVersion();
    idle(async()=>{try{await import('./examples-v0112.js?v=0.12.4');await import('./calendar-view-v0122.js?v=0.12.4');stampVersion()}catch(error){console.error('Mesraah deferred UI:',error)}});
    idle(async()=>{try{await import('./firebase-sync.js?v=0.12.4');await import('./google-calendar.js?v=0.12.4');await import('./calendar-sync-v0112.js?v=0.12.4');await import('./ui-v080.js?v=0.15.1');stampVersion()}catch(error){console.error('Mesraah deferred services:',error)}});
    idle(async()=>{try{await import('./mesraah-voice-appcheck.js?v=0.12.4');await import('./assistant-reliability-v012.js?v=0.15.2');await import('./mesraah-voice-tools.js?v=0.12.4');await import('./mesraah-voice-config.js?v=0.12.4');await import('./mesraah-voice.js?v=0.12.4');await import('./mesraah-voice-wake.js?v=0.12.4');stampVersion()}catch(error){console.error('Mesraah deferred assistant engines:',error)}});
  } catch (error) {
    console.error('Mesraah bootstrap:', error);
    window.dispatchEvent(new Event('mesraah:home-ready'));
  }
})();
