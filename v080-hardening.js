(() => {
  const DATA_KEY = 'mesraah_v030';
  const ACTIVE_UID_KEY = 'mesraah_active_uid_v2';
  const DIRTY_PREFIX = 'mesraah_dirty_v2_';

  function readState() {
    try { return JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {}; }
    catch { return {}; }
  }

  function writeState(state) {
    localStorage.setItem(DATA_KEY, JSON.stringify(state));
    const uid = localStorage.getItem(ACTIVE_UID_KEY);
    if (uid) localStorage.setItem(DIRTY_PREFIX + uid, '1');
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2600);
  }

  function improveAccessibility() {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';

    document.querySelectorAll('.nav-icon,.capture-icon,.stat-icon,.setup-nudge-icon,.story-path').forEach(el => {
      el.setAttribute('aria-hidden', 'true');
    });

    const labels = {
      quickAddSpace: 'إضافة مساحة جديدة',
      mobileMenu: 'فتح القائمة',
      themeBtn: 'تبديل مظهر الصفحة',
      flyVoice: 'إملاء صوتي في على الطاير',
      flySend: 'إرسال إلى مساعد مسراح'
    };
    Object.entries(labels).forEach(([id, label]) => {
      const el = document.getElementById(id);
      if (el && !el.getAttribute('aria-label')) el.setAttribute('aria-label', label);
    });

    document.querySelectorAll('button.close-btn').forEach(el => {
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'إغلاق');
    });

    document.querySelectorAll('img').forEach(img => {
      if (!img.hasAttribute('alt')) img.alt = '';
    });
  }

  function ensurePersonDialog() {
    if (document.getElementById('v80PersonContextModal')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'v80PersonContextModal';
    dialog.className = 'modal small-modal v80-person-context-modal';
    dialog.innerHTML = `
      <form method="dialog" id="v80PersonContextForm">
        <div class="modal-head">
          <div><span class="eyebrow">معلومات تساعد مسراح</span><h2 id="v80PersonContextTitle">تفاصيل الشخص</h2></div>
          <button class="close-btn" value="cancel" type="button" id="v80PersonContextClose" aria-label="إغلاق">×</button>
        </div>
        <input type="hidden" id="v80PersonId">
        <div class="v80-context-grid">
          <label class="field"><span>صلة الشخص</span><input id="v80PersonRelation" maxlength="60" placeholder="مثال: خالتي، عميل، زميل"></label>
          <label class="field"><span>المدينة</span><input id="v80PersonCity" maxlength="60" placeholder="مثال: مكة"></label>
          <label class="field"><span>الجهة</span><input id="v80PersonOrganization" maxlength="90" placeholder="مثال: شركة س"></label>
          <label class="field wide"><span>معلومة تساعد مسراح</span><textarea id="v80PersonNote" rows="2" maxlength="240" placeholder="مثال: يفضل التواصل بعد العصر"></textarea></label>
        </div>
        <p class="v80-context-note">هذه المعلومات اختيارية وتساعد مسراح على ربط كلامك بمهامك ومواعيدك.</p>
        <div class="modal-actions"><span></span><div><button class="secondary-btn" value="cancel" type="button" id="v80PersonContextCancel">إلغاء</button><button class="primary-btn" type="submit">حفظ</button></div></div>
      </form>`;
    document.body.appendChild(dialog);

    const close = () => dialog.close();
    document.getElementById('v80PersonContextClose').onclick = close;
    document.getElementById('v80PersonContextCancel').onclick = close;

    document.getElementById('v80PersonContextForm').addEventListener('submit', event => {
      event.preventDefault();
      const id = document.getElementById('v80PersonId').value;
      const state = readState();
      const person = (state.people || []).find(item => String(item.id) === String(id));
      if (!person) { toast('تعذر العثور على الشخص'); return; }
      person.relation = document.getElementById('v80PersonRelation').value.trim();
      person.city = document.getElementById('v80PersonCity').value.trim();
      person.organization = document.getElementById('v80PersonOrganization').value.trim();
      person.note = document.getElementById('v80PersonNote').value.trim();
      writeState(state);
      dialog.close();
      toast('تم حفظ معلومات الشخص');
      setTimeout(() => location.reload(), 250);
    });
  }

  function openPersonContext(person) {
    ensurePersonDialog();
    const dialog = document.getElementById('v80PersonContextModal');
    document.getElementById('v80PersonId').value = person.id || '';
    document.getElementById('v80PersonContextTitle').textContent = person.name || 'تفاصيل الشخص';
    document.getElementById('v80PersonRelation').value = person.relation || '';
    document.getElementById('v80PersonCity').value = person.city || '';
    document.getElementById('v80PersonOrganization').value = person.organization || '';
    document.getElementById('v80PersonNote').value = person.note || '';
    if (!dialog.open) dialog.showModal();
  }

  function installPeopleContextCard() {
    const manage = document.querySelector('#view-manage .manage-layout');
    if (!manage || document.getElementById('v80PeopleContextCard')) return;

    const card = document.createElement('section');
    card.id = 'v80PeopleContextCard';
    card.className = 'panel v80-people-context-card';
    card.innerHTML = `
      <div class="panel-head"><div><span class="eyebrow">السياق الذكي</span><h2>معلومات الأشخاص</h2><p>أضف الصلة أو المدينة فقط عندما تساعد مسراح في اقتراحاته.</p></div></div>
      <div id="v80PeopleContextList" class="v80-people-context-list"></div>`;

    const tree = manage.querySelector('.manage-tree');
    if (tree) tree.insertAdjacentElement('afterend', card); else manage.appendChild(card);
    renderPeopleContext();
  }

  function renderPeopleContext() {
    const list = document.getElementById('v80PeopleContextList');
    if (!list) return;
    const people = (readState().people || []).filter(p => !p.demo);
    if (!people.length) {
      list.innerHTML = '<div class="v80-context-empty">أضف أشخاصك أولا، وبعدها تستطيع تعريف الصلة أو المدينة عند الحاجة.</div>';
      return;
    }
    list.innerHTML = people.map(person => {
      const meta = [person.relation, person.city, person.organization].filter(Boolean).join(' • ') || 'أضف معلومات اختيارية';
      return `<button type="button" class="v80-person-context-row" data-v80-person="${escapeHtml(person.id)}"><span><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(meta)}</small></span><b>تفاصيل</b></button>`;
    }).join('');
    list.querySelectorAll('[data-v80-person]').forEach(button => {
      button.addEventListener('click', () => {
        const person = people.find(item => String(item.id) === button.dataset.v80Person);
        if (person) openPersonContext(person);
      });
    });
  }

  function watchPeople() {
    const grid = document.getElementById('peopleGrid');
    if (!grid) return;
    new MutationObserver(() => renderPeopleContext()).observe(grid, { childList: true, subtree: true });
  }

  function installErrorBoundary() {
    window.addEventListener('unhandledrejection', event => {
      const message = String(event.reason?.message || '');
      if (/firebase|calendar|assistant|live|network|fetch/i.test(message)) {
        console.error('Mesraah async error:', event.reason);
      }
    });
  }

  function boot() {
    improveAccessibility();
    ensurePersonDialog();
    installPeopleContextCard();
    watchPeople();
    installErrorBoundary();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
