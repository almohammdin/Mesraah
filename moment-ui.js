(async () => {
  const VERSION='0.20.6';
  const idle=fn=>('requestIdleCallback' in window?requestIdleCallback(fn,{timeout:1800}):setTimeout(fn,700));
  const onFirstClick=(selector,load)=>{
    let started=false;
    const handler=event=>{
      if(started||!event.target.closest?.(selector))return;
      started=true;
      document.removeEventListener('click',handler,true);
      void load();
    };
    document.addEventListener('click',handler,true);
  };
  function stampVersion(){
    document.documentElement.dataset.mesraahVersion=VERSION;
    const footer=document.querySelector('.mesraah-footer-bottom');
    footer?.querySelectorAll(':scope > span').forEach(el=>{
      if(/^v\d+\.\d+\.\d+$/.test(el.textContent.trim()))el.textContent=`v${VERSION}`;
    });
    footer?.querySelectorAll('.v7-version').forEach(el=>el.textContent=`v${VERSION}`);
  }

  try {
    await import('./ux-v011.js?v=0.20.4');
    await import('./priority-core-v015.js?v=0.20.4');
    await import('./assistant-gate-v0200.js?v=0.20.4');
    await import('./assistant-hub-v0112.js?v=0.20.4');
    await import('./assistant-first-v014.js?v=0.20.6');
    stampVersion();

    window.MesraahTextAssistantLoadError=null;
    window.MesraahTextAssistantReady=null;
    window.MesraahFirebaseReady=null;
    window.MesraahEnsureFirebase=()=>{
      if(!window.MesraahFirebaseReady)window.MesraahFirebaseReady=import('./firebase-sync.js?v=0.20.4').catch(error=>{console.error('Mesraah cloud load:',error);return null});
      return window.MesraahFirebaseReady;
    };
    window.MesraahEnsureTextAssistant=()=>{
      if(!window.MesraahTextAssistantReady)window.MesraahTextAssistantReady=(async()=>{
        try{
          await window.MesraahEnsureFirebase();
          await import('./assistant-cloud-bridge-v018.js?v=0.20.4');
          await import('./assistant-reliability-v017.js?v=0.20.4');
          if(typeof window.MesraahAssistant?.ask!=='function')throw new Error('text-assistant-not-ready');
          return window.MesraahAssistant;
        }catch(error){
          window.MesraahTextAssistantLoadError=error;
          console.error('Mesraah text assistant load:',error);
          return null;
        }
      })();
      return window.MesraahTextAssistantReady;
    };
    window.MesraahCalendarViewReady=null;
    window.MesraahEnsureCalendarView=()=>{
      if(!window.MesraahCalendarViewReady)window.MesraahCalendarViewReady=import('./calendar-view-v0122.js?v=0.20.4').catch(error=>{console.error('Mesraah calendar view load:',error);return null});
      return window.MesraahCalendarViewReady;
    };
    window.MesraahCalendarServicesReady=null;
    window.MesraahEnsureCalendarServices=()=>{
      if(!window.MesraahCalendarServicesReady)window.MesraahCalendarServicesReady=(async()=>{
        await window.MesraahEnsureFirebase();
        await import('./google-calendar.js?v=0.20.4');
        await import('./calendar-dedupe-repair-v0191.js?v=0.20.4');
        await import('./calendar-sync-v0191.js?v=0.20.4');
        return window.MesraahCalendar;
      })().catch(error=>{console.error('Mesraah calendar services load:',error);return null});
      return window.MesraahCalendarServicesReady;
    };

    await import('./ux-v0111-fixes.js?v=0.20.4');
    await import('./modal-runtime-v0115.js?v=0.20.4');
    await import('./task-state-bridge-v012.js?v=0.20.4');
    await import('./recurrence-v012.js?v=0.20.5');
    await import('./v080-hardening.js?v=0.20.4');
    await import('./quick-capture-fix-v0153.js?v=0.20.4');
    await import('./assistant-input-v017.js?v=0.20.4');
    await import('./day-view-v017.js?v=0.20.4');
    await import('./task-date-fix-v0174.js?v=0.20.4');
    await import('./mesraah-agent-bridge-v0200.js?v=0.20.4');

    window.MesraahVoiceLoadError=null;
    window.MesraahVoiceReady=null;
    await import('./voice-button-bridge-v0183.js?v=0.20.4');

    const hijriButton=document.querySelector('[data-v11-date-mode="hijri"]');
    hijriButton?.addEventListener('click',()=>{
      const due=document.getElementById('v11DueGregorian');
      if(due?.value)return;
      const parts=new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn',{
        timeZone:'Asia/Riyadh',year:'numeric',month:'numeric',day:'numeric'
      }).formatToParts(new Date()).reduce((out,part)=>{
        if(part.type!=='literal')out[part.type]=Number(part.value);
        return out;
      },{});
      const day=document.getElementById('v11HijriDay');
      const month=document.getElementById('v11HijriMonth');
      const year=document.getElementById('v11HijriYear');
      if(day)day.value=String(parts.day);
      if(month)month.value=String(parts.month);
      if(year)year.value=String(parts.year);
      day?.dispatchEvent(new Event('change',{bubbles:true}));
    });

    stampVersion();
    window.dispatchEvent(new Event('mesraah:home-ready'));

    onFirstClick('.nav-item[data-view="calendar"],[data-open-view="calendar"]',window.MesraahEnsureCalendarView);

    idle(async()=>{
      try{
        await import('./examples-v0112.js?v=0.20.4');
        stampVersion();
      }catch(error){console.error('Mesraah deferred UI:',error);}
    });

    idle(async()=>{
      try{
        await window.MesraahEnsureFirebase();
        await import('./ui-v080.js?v=0.20.4');
        stampVersion();
      }catch(error){console.error('Mesraah deferred services:',error);}
    });
  } catch(error) {
    console.error('Mesraah bootstrap:',error);
    window.dispatchEvent(new Event('mesraah:home-ready'));
  }
})();
