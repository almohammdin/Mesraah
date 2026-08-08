(() => {
  const VERSION = '0.8.2';
  const CLOCK_KEY = 'mesraah_clock24';

  function ensureFreshBuild() {
    const url = new URL(window.location.href);
    if (url.searchParams.get('build') === VERSION) return false;
    const key = `mesraah_build_redirect_${VERSION}`;
    if (sessionStorage.getItem(key) === '1') return false;
    sessionStorage.setItem(key, '1');
    url.searchParams.set('build', VERSION);
    window.location.replace(url.toString());
    return true;
  }

  if (ensureFreshBuild()) return;

  function parts(date = new Date()) {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Riyadh', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
    }).formatToParts(date).reduce((out, part) => { if (part.type !== 'literal') out[part.type] = part.value; return out; }, {});
  }

  function clean(text = '') { return String(text).replace(/،/g, '').replace(/\s+/g, ' ').trim(); }
  function weekday(date = new Date()) { return clean(new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',{timeZone:'Asia/Riyadh',weekday:'long'}).format(date)); }
  function hijri(date = new Date()) { return clean(new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn',{timeZone:'Asia/Riyadh',day:'numeric',month:'long',year:'numeric'}).format(date)); }
  function gregorian(date = new Date()) { return clean(new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',{timeZone:'Asia/Riyadh',day:'numeric',month:'long',year:'numeric'}).format(date)); }

  function buildMoment() {
    const host = document.getElementById('todayMoment'); if (!host) return;
    host.className = 'today-moment v72-moment';
    host.innerHTML = `
      <div class="v72-time-pane"><span class="v72-live-label"><span class="v72-live-dot" aria-hidden="true"></span>الآن</span><button class="time-toggle v72-clock" id="timeToggle" type="button" aria-label="تبديل نظام الساعة"><span class="v72-hm" id="todayTime"></span><span class="v72-sec" id="todaySeconds"></span><span class="v72-period" id="todayPeriod"></span></button></div>
      <div class="v72-date-pane"><div class="v72-dayline"><strong id="todayWeekday"></strong><span>اليوم</span></div><div class="v72-date-row"><span class="v72-date-label">هجري</span><span class="v72-date-value" id="todayHijri"></span></div><div class="v72-date-row"><span class="v72-date-label">ميلادي</span><span class="v72-date-value" id="todayGregorian"></span></div></div>
      <span class="eyebrow legacy-date" id="todayDate" hidden></span>`;
    document.getElementById('timeToggle')?.addEventListener('click',()=>{const is24=localStorage.getItem(CLOCK_KEY)==='1';localStorage.setItem(CLOCK_KEY,is24?'0':'1');renderMoment();});
  }

  function renderMoment() {
    const time=document.getElementById('todayTime'),seconds=document.getElementById('todaySeconds'),period=document.getElementById('todayPeriod'),day=document.getElementById('todayWeekday'),h=document.getElementById('todayHijri'),g=document.getElementById('todayGregorian'),toggle=document.getElementById('timeToggle');
    if(!time||!seconds||!period||!day||!h||!g||!toggle)return;
    const now=new Date(),p=parts(now),hour24=Number(p.hour||0),is24=localStorage.getItem(CLOCK_KEY)==='1';
    time.textContent=is24?`${String(hour24).padStart(2,'0')}:${p.minute}`:`${hour24%12||12}:${p.minute}`;seconds.textContent=`:${p.second}`;period.textContent=is24?'':(hour24<12?'ص':'م');day.textContent=weekday(now);h.textContent=hijri(now);g.textContent=gregorian(now);toggle.title=is24?'التحويل إلى نظام 12 ساعة':'التحويل إلى نظام 24 ساعة';toggle.setAttribute('aria-label',toggle.title);
  }

  function installStoryIcon() {
    const card=document.querySelector('.mesraah-story-card'),icon=card?.querySelector('.story-path');if(!card||!icon)return;
    icon.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6"></path><path d="M10 21h4"></path><path d="M8.5 15.5c-1.4-1.1-2.2-2.8-2.2-4.6A5.7 5.7 0 0 1 12 5.2a5.7 5.7 0 0 1 5.7 5.7c0 1.8-.8 3.5-2.2 4.6-.7.6-1 1.1-1.1 1.7H9.6c-.1-.6-.4-1.1-1.1-1.7Z"></path><path d="M12 2.5v1"></path><path d="m4.8 5.2.8.8"></path><path d="m19.2 5.2-.8.8"></path></svg>`;
  }

  function normalizeVersion() {
    document.documentElement.dataset.mesraahVersion=VERSION;
    const footer=document.querySelector('.mesraah-footer-bottom');if(!footer)return;
    footer.querySelectorAll(':scope > span').forEach(el=>{if(/^v\d+\.\d+\.\d+$/.test(el.textContent.trim()))el.textContent=`v${VERSION}`;});
    footer.querySelectorAll('.v7-version').forEach(el=>el.textContent=`v${VERSION}`);
  }

  async function loadV8() {
    if (window.__MESRAAH_V8_BOOTSTRAP__) return;
    window.__MESRAAH_V8_BOOTSTRAP__ = true;
    try { await import('./moment-ui.js?v=0.8.2'); }
    catch (error) { console.error('Mesraah v0.8.2 bootstrap:', error); }
  }

  function boot() { buildMoment();renderMoment();installStoryIcon();normalizeVersion();window.setInterval(renderMoment,1000);loadV8(); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
