(() => {
  const hijri = document.getElementById('todayHijri');
  const gregorian = document.getElementById('todayGregorian');
  const time = document.getElementById('todayTime');
  const toggle = document.getElementById('timeToggle');
  if (!hijri || !gregorian || !time || !toggle) return;

  const CLOCK_KEY = 'mesraah_clock24';
  let is24 = localStorage.getItem(CLOCK_KEY) === '1';

  const clean = value => value.replace(/،/g, '').replace(/\s+/g, ' ').trim();
  const renderDate = now => {
    hijri.textContent = clean(new Intl.DateTimeFormat('ar-SA-u-ca-islamic-nu-latn', {
      day: 'numeric', month: 'long', year: 'numeric'
    }).format(now));
    gregorian.textContent = clean(new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
      day: 'numeric', month: 'long', year: 'numeric'
    }).format(now));
  };
  const renderTime = now => {
    const h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, '0');
    if (is24) {
      time.textContent = `${String(h).padStart(2, '0')}:${m}`;
      toggle.title = 'التحويل إلى نظام 12 ساعة';
      toggle.setAttribute('aria-label', 'الساعة بنظام 24 ساعة، اضغط للتحويل إلى 12 ساعة');
    } else {
      const h12 = h % 12 || 12;
      time.textContent = `${h12}:${m} ${h < 12 ? 'صباحا' : 'مساء'}`;
      toggle.title = 'التحويل إلى نظام 24 ساعة';
      toggle.setAttribute('aria-label', 'الساعة بنظام 12 ساعة، اضغط للتحويل إلى 24 ساعة');
    }
  };
  const render = () => { const now = new Date(); renderDate(now); renderTime(now); };
  toggle.addEventListener('click', () => {
    is24 = !is24;
    localStorage.setItem(CLOCK_KEY, is24 ? '1' : '0');
    renderTime(new Date());
  });
  render();
  setInterval(render, 30000);
})();

import('./firebase-sync.js?v=0.5.2')
  .then(() => import('./firebase-ai-fly.js?v=0.6.0'))
  .catch(error => {
    console.error('Mesraah Firebase module:', error);
  });
