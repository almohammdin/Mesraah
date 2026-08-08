(() => {
  const VERSION = '0.8.5';

  function ensureCss(href, marker) {
    if (document.querySelector(`link[${marker}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(marker, '');
    document.head.appendChild(link);
  }

  function loadCss() {
    ensureCss(`ui-v080.css?v=${VERSION}`, 'data-mesraah-v080');
    ensureCss(`v080-hardening.css?v=${VERSION}`, 'data-mesraah-hardening');
  }

  function normalizeVersion() {
    document.documentElement.dataset.mesraahVersion = VERSION;
    const footer = document.querySelector('.mesraah-footer-bottom');
    footer?.querySelectorAll(':scope > span').forEach(el => {
      if (/^v\d+\.\d+\.\d+$/.test(el.textContent.trim())) el.textContent = `v${VERSION}`;
    });
    footer?.querySelectorAll('.v7-version').forEach(el => { el.textContent = `v${VERSION}`; });
  }

  function installExamplesCard() {
    const manage = document.querySelector('#view-manage .manage-layout');
    const clear = document.getElementById('clearExamplesBtn');
    if (!manage || !clear || document.getElementById('v80ExamplesCard')) return;
    const card = document.createElement('section');
    card.id = 'v80ExamplesCard';
    card.className = 'panel v80-examples-card';
    card.innerHTML = `
      <div class="v80-examples-copy">
        <span class="eyebrow">البيانات التجريبية</span>
        <h2>الأمثلة الجاهزة</h2>
        <p>إذا انتهيت من استكشاف مسراح، امسح الأمثلة وابدأ ببياناتك.</p>
      </div>
      <div class="v80-examples-action"></div>`;
    clear.textContent = 'مسح جميع الأمثلة';
    clear.className = 'v80-clear-examples';
    clear.setAttribute('aria-label', 'مسح جميع الأمثلة الجاهزة');
    card.querySelector('.v80-examples-action').appendChild(clear);
    manage.appendChild(card);
  }

  function calendarCard() {
    const cards = [...document.querySelectorAll('.connection-card')];
    return cards.find(card => card.textContent.includes('Google Calendar') || card.textContent.includes('التقويم'));
  }

  function installCalendarUi() {
    const card = calendarCard();
    if (!card) return;
    card.classList.add('v80-calendar-card');
    const button = card.querySelector('button');
    if (!button) return;
    button.disabled = false;
    button.id = 'v80CalendarConnect';
    button.setAttribute('aria-label', 'ربط Google Calendar بمسراح');

    if (!card.querySelector('.v80-service-status')) {
      const status = document.createElement('span');
      status.className = 'v80-service-status';
      status.id = 'v80CalendarStatus';
      status.setAttribute('role', 'status');
      card.querySelector('div')?.appendChild(status);
    }

    renderCalendarStatus();
    button.onclick = async () => {
      button.disabled = true;
      button.textContent = 'جار الربط…';
      try {
        await window.MesraahCalendar?.connect?.();
        renderCalendarStatus();
      } catch (error) {
        console.error('Mesraah Calendar connect:', error);
        const status = document.getElementById('v80CalendarStatus');
        if (status) {
          status.textContent = error?.status === 403
            ? 'فعّل Calendar API ثم أعد المحاولة'
            : 'تعذر الربط الآن';
        }
        button.textContent = 'إعادة المحاولة';
        button.disabled = false;
      }
    };
  }

  function renderCalendarStatus() {
    const button = document.getElementById('v80CalendarConnect');
    const statusEl = document.getElementById('v80CalendarStatus');
    if (!button || !statusEl) return;
    const status = window.MesraahCalendar?.status?.() || { connected: false };
    if (status.connected) {
      button.textContent = 'متصل';
      button.disabled = false;
      button.classList.add('connected');
      statusEl.textContent = status.cachedEvents?.length
        ? `${status.cachedEvents.length} موعد قريب جاهز لمسراح`
        : 'متصل بـ Google Calendar';
    } else {
      button.textContent = 'ربط';
      button.disabled = false;
      button.classList.remove('connected');
      statusEl.textContent = 'اقرأ مواعيدك وأضفها من مسراح';
    }
  }

  function installVoiceButton() {
    const card = document.querySelector('.fly-card');
    const help = card?.querySelector('.fly-help');
    if (!card || document.getElementById('v80VoiceChat')) return;
    const row = document.createElement('div');
    row.className = 'v80-fly-tools';
    row.innerHTML = `
      <button type="button" id="v80VoiceChat" class="v80-voice-start" aria-label="فتح محادثة صوتية مع مسراح">
        <span aria-hidden="true">◉</span>
        <span><strong>محادثة صوتية</strong><small>اسأل مسراح عن يومك وأنت على الطريق</small></span>
      </button>
      <button type="button" id="v80ClearChat" class="v80-clear-chat" title="بدء محادثة جديدة" aria-label="مسح سياق المحادثة الحالية">محادثة جديدة</button>`;
    (help || card.querySelector('.fly-row'))?.insertAdjacentElement('afterend', row);
    document.getElementById('v80VoiceChat').onclick = () => window.MesraahVoice?.start?.();
    document.getElementById('v80ClearChat').onclick = () => {
      window.MesraahAssistant?.clearHistory?.();
      const preview = document.getElementById('flyPreview');
      if (preview) preview.classList.remove('show');
      const input = document.getElementById('flyInput');
      if (input) input.value = '';
    };
  }

  function polishGmail() {
    const cards = [...document.querySelectorAll('.connection-card')];
    const gmail = cards.find(card => card.textContent.includes('Gmail'));
    if (!gmail) return;
    const button = gmail.querySelector('button');
    if (button) {
      button.textContent = 'بعد التقويم';
      button.disabled = true;
    }
    if (!gmail.querySelector('.v80-service-status')) {
      const status = document.createElement('span');
      status.className = 'v80-service-status';
      status.textContent = 'المرحلة التالية بعد استقرار التقويم';
      gmail.querySelector('div')?.appendChild(status);
    }
  }

  function boot() {
    loadCss();
    normalizeVersion();
    installExamplesCard();
    installCalendarUi();
    installVoiceButton();
    polishGmail();
  }

  window.addEventListener('mesraah:calendar-status', renderCalendarStatus);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
