(() => {
  const VERSION = '0.7.0';
  const DATA_KEY = 'mesraah_v030';
  const $ = selector => document.querySelector(selector);

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>\"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
    }[char]));
  }

  function riyadhYmd(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date).reduce((out, part) => {
      if (part.type !== 'literal') out[part.type] = part.value;
      return out;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function refreshBranding() {
    const topIcon = $('.topbar-platform-icon');
    if (topIcon) topIcon.src = `mesraah-app-icon.svg?v=${VERSION}`;

    const sidebarIcon = $('.brand-block .brand-mark');
    if (sidebarIcon) {
      sidebarIcon.src = `mesraah-app-icon.svg?v=${VERSION}`;
      sidebarIcon.alt = '';
    }
  }

  function installFlyHelp() {
    const card = $('.fly-card');
    const row = $('.fly-row');
    const input = $('#flyInput');
    const send = $('#flySend');
    if (!card || !row || !input || !send) return;

    input.placeholder = 'اسأل أو قل ما تريد إنجازه…';
    if (!card.querySelector('.fly-help')) {
      const help = document.createElement('p');
      help.className = 'fly-help';
      help.innerHTML = '<span class="fly-help-icon" aria-hidden="true">✦</span><span>مساعد ذكي مدعوم بالذكاء الاصطناعي؛ اسأله أو قل له ما تريد إنجازه، ويعرض لك النتيجة قبل الحفظ.</span>';
      row.insertAdjacentElement('afterend', help);
    }

    const normalizeSendLabel = () => {
      if (!send.disabled && send.textContent.trim() === 'إضافة') send.textContent = 'إرسال';
    };
    normalizeSendLabel();
    const observer = new MutationObserver(normalizeSendLabel);
    observer.observe(send, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  }

  function installClockSeconds() {
    const toggle = $('#timeToggle');
    const main = $('#todayTime');
    if (!toggle || !main) return;

    main.classList.add('time-main');
    let seconds = $('#todaySeconds');
    if (!seconds) {
      seconds = document.createElement('span');
      seconds.id = 'todaySeconds';
      seconds.className = 'time-seconds';
      main.insertAdjacentElement('afterend', seconds);
    }
    let period = $('#todayPeriod');
    if (!period) {
      period = document.createElement('span');
      period.id = 'todayPeriod';
      period.className = 'time-period';
      seconds.insertAdjacentElement('afterend', period);
    }

    const render = () => {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date()).reduce((out, part) => {
        if (part.type !== 'literal') out[part.type] = part.value;
        return out;
      }, {});

      const h24 = Number(parts.hour || 0);
      const is24 = localStorage.getItem('mesraah_clock24') === '1';
      main.textContent = is24
        ? `${String(h24).padStart(2, '0')}:${parts.minute}`
        : `${h24 % 12 || 12}:${parts.minute}`;
      seconds.textContent = `:${parts.second}`;
      period.textContent = is24 ? '' : (h24 < 12 ? 'ص' : 'م');
      toggle.title = is24 ? 'التحويل إلى نظام 12 ساعة' : 'التحويل إلى نظام 24 ساعة';
    };

    toggle.addEventListener('click', () => setTimeout(render, 0));
    render();
    window.setInterval(render, 1000);
  }

  function installFooter() {
    const footer = $('.mesraah-footer');
    const bottom = $('.mesraah-footer-bottom');
    const themeButton = $('#themeBtn');
    if (!footer || !bottom) return;

    const directMeta = [...bottom.children].filter(element =>
      element.tagName === 'SPAN' && !element.classList.contains('mesraah-footer-platform')
    );
    directMeta.forEach(element => element.remove());

    let version = bottom.querySelector('.v7-version');
    if (!version) {
      version = document.createElement('span');
      version.className = 'v7-version';
      bottom.appendChild(version);
    }
    version.textContent = `v${VERSION}`;

    if (themeButton) {
      themeButton.className = 'footer-theme-btn';
      bottom.insertBefore(themeButton, version);

      const renderTheme = () => {
        const dark = document.documentElement.dataset.theme === 'dark';
        const sun='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
        const moon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 15.5A8 8 0 0 1 8.5 5a8 8 0 1 0 10.5 10.5Z"/></svg>';
        themeButton.innerHTML = dark ? `${sun} الوضع الفاتح` : `${moon} الوضع الليلي`;
        themeButton.setAttribute('aria-label', dark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الليلي');
      };
      renderTheme();
      new MutationObserver(renderTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
  }

  function statDefinitions() {
    return [
      { id: 'statToday', kind: 'today', title: 'مهام اليوم' },
      { id: 'statLate', kind: 'late', title: 'المهام المتأخرة' },
      { id: 'statWaiting', kind: 'waiting', title: 'بانتظار الآخرين' },
      { id: 'statDone', kind: 'done', title: 'أنجزت اليوم' }
    ];
  }

  function tasksFor(kind) {
    const state = readState();
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const today = riyadhYmd();

    if (kind === 'today') return tasks.filter(task => task.status !== 'done' && (task.due === today || (!task.due && task.status === 'active')));
    if (kind === 'late') return tasks.filter(task => task.status !== 'done' && task.due && task.due < today);
    if (kind === 'waiting') return tasks.filter(task => task.status !== 'done' && task.status === 'waiting');
    if (kind === 'done') return tasks.filter(task => task.status === 'done' && String(task.completedAt || '').slice(0, 10) === today);
    return [];
  }

  function installDashboardLens() {
    const grid = $('#todayStats');
    if (!grid || $('#v7DashboardLens')) return;

    const lens = document.createElement('section');
    lens.id = 'v7DashboardLens';
    lens.className = 'v7-dashboard-lens';
    lens.setAttribute('aria-live', 'polite');
    lens.innerHTML = '<div class="v7-lens-inner"></div>';
    grid.insertAdjacentElement('afterend', lens);

    let activeKind = '';

    const clearActive = () => statDefinitions().forEach(def => {
      document.getElementById(def.id)?.closest('.stat-card')?.classList.remove('v7-active');
    });

    const render = def => {
      const tasks = tasksFor(def.kind);
      const inner = lens.querySelector('.v7-lens-inner');
      const shown = tasks.slice(0, 6);
      const list = shown.length
        ? shown.map(task => {
            const date = task.due ? `<small>${escapeHtml(task.due)}</small>` : '';
            if (def.kind === 'done') {
              return `<button class="v7-lens-task" type="button" data-v7-open-achievements><span>${escapeHtml(task.title || 'مهمة')}</span>${date}</button>`;
            }
            return `<button class="v7-lens-task" type="button" data-edit="${escapeHtml(task.id || '')}"><span>${escapeHtml(task.title || 'مهمة')}</span>${date}</button>`;
          }).join('')
        : '<div class="v7-lens-empty">ما فيه عناصر هنا الآن.</div>';

      inner.innerHTML = `
        <div class="v7-lens-head"><strong>${escapeHtml(def.title)}</strong><span>${tasks.length} ${tasks.length === 1 ? 'عنصر' : 'عناصر'}</span></div>
        <div class="v7-lens-list">${list}</div>
      `;

      inner.querySelectorAll('[data-v7-open-achievements]').forEach(button => {
        button.addEventListener('click', () => {
          document.querySelector('.nav-item[data-view="achievements"]')?.click();
        });
      });

      clearActive();
      document.getElementById(def.id)?.closest('.stat-card')?.classList.add('v7-active');
      lens.classList.add('show');
      activeKind = def.kind;
    };

    statDefinitions().forEach(def => {
      const number = document.getElementById(def.id);
      const card = number?.closest('.stat-card');
      if (!card) return;
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.setAttribute('aria-label', `عرض ${def.title}`);

      const activate = () => {
        if (activeKind === def.kind && lens.classList.contains('show')) {
          lens.classList.remove('show');
          card.classList.remove('v7-active');
          activeKind = '';
          return;
        }
        render(def);
      };

      card.addEventListener('click', event => {
        if (event.target.closest('button,a,input,select')) return;
        activate();
      });
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      });
    });
  }

  function animateStatNumbers() {
    const animating = new WeakSet();
    ['statToday', 'statLate', 'statWaiting', 'statDone'].forEach(id => {
      const element = document.getElementById(id);
      if (!element) return;
      element.dataset.v7Number = '0';

      const animate = () => {
        if (animating.has(element)) return;
        const target = Number(String(element.textContent).replace(/\D/g, '')) || 0;
        const from = Number(element.dataset.v7Number || 0);
        element.dataset.v7Number = String(target);
        if (from === target) return;

        animating.add(element);
        const start = performance.now();
        const duration = 340;
        const tick = now => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          element.textContent = String(Math.round(from + (target - from) * eased));
          if (t < 1) requestAnimationFrame(tick);
          else {
            element.textContent = String(target);
            animating.delete(element);
          }
        };
        requestAnimationFrame(tick);
      };

      new MutationObserver(animate).observe(element, { childList: true, characterData: true, subtree: true });
      animate();
    });
  }

  function boot() {
    refreshBranding();
    installFlyHelp();
    installClockSeconds();
    installFooter();
    installDashboardLens();
    animateStatNumbers();
    document.documentElement.dataset.mesraahVersion = VERSION;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
