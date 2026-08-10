const DATA_KEY = 'mesraah_v030';
const VERSION = '0.13.0';
const GROUPS = {
  start: { label: 'ابدأ بها', short: 'ابدأ بها', description: 'أثر مرتفع وسهلة التنفيذ الآن' },
  plan: { label: 'خطط لها', short: 'خطط لها', description: 'أثر مرتفع وتحتاج جهدا أكبر' },
  opportunity: { label: 'أنجزها عند الفرصة', short: 'عند الفرصة', description: 'سهلة التنفيذ وأثرها أقل' },
  review: { label: 'راجع أهميتها', short: 'راجع أهميتها', description: 'جهدها أكبر مقارنة بأثرها' }
};
const GROUP_ORDER = ['start', 'plan', 'opportunity', 'review'];

if (!window.__MESRAAH_PRIORITY_V013__) {
  window.__MESRAAH_PRIORITY_V013__ = true;

  let dashboardGroup = 'start';
  let dashboardSpace = '';
  let dashboardPerson = '';
  let matrixOpen = false;
  let smartTodaySort = false;
  let smartEntitySort = false;
  let renderQueued = false;

  const nativeSetItem = Storage.prototype.setItem;

  function readState() {
    try { return JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {}; }
    catch { return {}; }
  }

  function writeState(state) {
    localStorage.setItem(DATA_KEY, JSON.stringify(state || {}));
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>\"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
    }[char]));
  }

  function clampRating(value) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 5 ? number : null;
  }

  function assessed(task) {
    return Boolean(clampRating(task?.impact) && clampRating(task?.ease));
  }

  function category(task) {
    const impact = clampRating(task?.impact);
    const ease = clampRating(task?.ease);
    if (!impact || !ease) return '';
    const highImpact = impact >= 4;
    const easy = ease >= 4;
    if (highImpact && easy) return 'start';
    if (highImpact) return 'plan';
    if (easy) return 'opportunity';
    return 'review';
  }

  function score(task) {
    const impact = clampRating(task?.impact);
    const ease = clampRating(task?.ease);
    if (!impact || !ease) return null;
    return Math.round(((impact * 0.65) + (ease * 0.35)) / 5 * 100);
  }

  function todayRiyadh() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date()).reduce((out, part) => {
      if (part.type !== 'literal') out[part.type] = part.value;
      return out;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function taskSortValue(task) {
    if (assessed(task)) return 1000 + (score(task) || 0);
    const legacy = task?.priority === 'strategic' ? 90 : task?.priority === 'important' ? 60 : 20;
    const due = String(task?.due || '9999-99-99');
    const dueBoost = due <= todayRiyadh() ? 20 : 0;
    return legacy + dueBoost;
  }

  function compareTasks(a, b) {
    const byScore = taskSortValue(b) - taskSortValue(a);
    if (byScore) return byScore;
    return String(a?.due || '9999-99-99').localeCompare(String(b?.due || '9999-99-99'));
  }

  function installStyles() {
    if (document.getElementById('mesraahPriorityStyles')) return;
    const style = document.createElement('style');
    style.id = 'mesraahPriorityStyles';
    style.textContent = `
      .smart-priority-panel{margin-top:18px;border:1px solid color-mix(in srgb,var(--line,#dbe3ea) 84%,transparent);background:var(--surface,#fff);border-radius:24px;padding:20px;box-shadow:0 14px 34px rgba(13,54,86,.06)}
      .smart-priority-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}.smart-priority-head h2{margin:3px 0 5px;font-size:1.35rem}.smart-priority-head p{margin:0;color:var(--muted,#667786);font-size:.92rem;line-height:1.7}.smart-priority-kicker{display:inline-flex;align-items:center;gap:6px;font-size:.75rem;font-weight:800;color:var(--brand,#0d3656)}
      .smart-priority-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.smart-priority-actions button,.smart-entity-sort{border:1px solid var(--line,#dbe3ea);background:var(--surface,#fff);color:var(--text,#17324a);border-radius:12px;padding:9px 12px;font:inherit;font-weight:700;cursor:pointer}.smart-priority-actions button.active,.smart-entity-sort[aria-pressed="true"],#smartTodaySortBtn.active{border-color:color-mix(in srgb,var(--brand,#0d3656) 55%,var(--line,#dbe3ea));background:color-mix(in srgb,var(--brand,#0d3656) 8%,var(--surface,#fff));color:var(--brand,#0d3656)}
      .smart-priority-filters{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;margin-bottom:14px}.smart-priority-filters select{width:100%;border:1px solid var(--line,#dbe3ea);background:var(--surface,#fff);color:var(--text,#17324a);border-radius:12px;padding:10px 12px;font:inherit}
      .smart-priority-groups{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.smart-group-card{border:1px solid var(--line,#dbe3ea);background:var(--surface,#fff);border-radius:16px;padding:13px;text-align:right;cursor:pointer;color:inherit;font:inherit;min-height:92px;transition:.18s ease}.smart-group-card:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--brand,#0d3656) 36%,var(--line,#dbe3ea))}.smart-group-card.active{background:color-mix(in srgb,var(--brand,#0d3656) 7%,var(--surface,#fff));border-color:color-mix(in srgb,var(--brand,#0d3656) 45%,var(--line,#dbe3ea))}.smart-group-card strong{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:.92rem}.smart-group-card b{font-size:1rem;color:var(--brand,#0d3656)}.smart-group-card small{display:block;margin-top:7px;color:var(--muted,#667786);font-size:.73rem;line-height:1.45}
      .smart-priority-list{display:grid;gap:8px}.smart-priority-task{display:grid;grid-template-columns:1fr auto;align-items:center;gap:12px;border:1px solid var(--line,#dbe3ea);background:color-mix(in srgb,var(--surface,#fff) 96%,var(--brand,#0d3656));border-radius:14px;padding:12px 14px;text-align:right;color:inherit;font:inherit;cursor:pointer}.smart-priority-task:hover{border-color:color-mix(in srgb,var(--brand,#0d3656) 40%,var(--line,#dbe3ea))}.smart-priority-task strong{display:block;font-size:.93rem}.smart-priority-task small{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;color:var(--muted,#667786);font-size:.73rem}.smart-score{min-width:46px;text-align:center;border-radius:12px;padding:7px 8px;background:color-mix(in srgb,var(--brand,#0d3656) 9%,var(--surface,#fff));color:var(--brand,#0d3656);font-weight:900;font-size:.82rem}.smart-empty{padding:18px;border:1px dashed var(--line,#dbe3ea);border-radius:14px;color:var(--muted,#667786);text-align:center;line-height:1.7}
      .smart-matrix{margin-top:14px}.smart-matrix-axis{display:flex;align-items:center;justify-content:space-between;color:var(--muted,#667786);font-size:.73rem;margin-bottom:7px}.smart-matrix-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.smart-matrix-cell{border:1px solid var(--line,#dbe3ea);border-radius:16px;padding:12px;min-height:135px;background:color-mix(in srgb,var(--surface,#fff) 96%,var(--brand,#0d3656))}.smart-matrix-cell h3{margin:0 0 3px;font-size:.88rem}.smart-matrix-cell>small{color:var(--muted,#667786);font-size:.7rem}.smart-matrix-tasks{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.smart-matrix-task{border:1px solid var(--line,#dbe3ea);background:var(--surface,#fff);border-radius:999px;padding:7px 9px;font:inherit;font-size:.72rem;cursor:pointer;color:inherit;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.smart-matrix-more{font-size:.7rem;color:var(--muted,#667786);align-self:center}
      .smart-assessment{border:1px solid var(--line,#dbe3ea);border-radius:16px;background:color-mix(in srgb,var(--surface,#fff) 97%,var(--brand,#0d3656));margin-top:12px;overflow:hidden}.smart-assessment summary{list-style:none;cursor:pointer;padding:13px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px}.smart-assessment summary::-webkit-details-marker{display:none}.smart-assessment-title{display:flex;align-items:center;gap:8px}.smart-assessment-title strong{font-size:.92rem}.smart-assessment-title small{font-size:.67rem;border:1px solid var(--line,#dbe3ea);border-radius:999px;padding:2px 7px;color:var(--muted,#667786)}.smart-assessment-summary{font-size:.73rem;color:var(--brand,#0d3656);font-weight:800}.smart-assessment-body{border-top:1px solid var(--line,#dbe3ea);padding:14px;display:grid;gap:14px}.smart-metric{display:grid;grid-template-columns:125px 1fr;align-items:center;gap:12px}.smart-metric-copy strong{display:block;font-size:.83rem}.smart-metric-copy small{display:block;color:var(--muted,#667786);font-size:.68rem;margin-top:2px}.smart-rating{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}.smart-rating button{border:1px solid var(--line,#dbe3ea);background:var(--surface,#fff);border-radius:10px;min-height:38px;font:inherit;font-weight:800;color:var(--muted,#667786);cursor:pointer}.smart-rating button[aria-pressed="true"]{background:var(--brand,#0d3656);border-color:var(--brand,#0d3656);color:#fff}.smart-assessment-footer{display:flex;align-items:center;justify-content:space-between;gap:12px}.smart-assessment-hint{font-size:.72rem;color:var(--muted,#667786)}.smart-clear-assessment{border:0;background:transparent;color:var(--muted,#667786);font:inherit;font-size:.72rem;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
      .smart-priority-chip{font-weight:800}.smart-priority-chip[data-smart-group="start"]{color:#16633d}.smart-priority-chip[data-smart-group="plan"]{color:#8a5b00}.smart-priority-chip[data-smart-group="opportunity"]{color:#315c86}.smart-priority-chip[data-smart-group="review"]{color:#7b4553}
      .smart-focus-button{width:100%;border:0;background:transparent;text-align:right;color:inherit;padding:0;cursor:pointer;font:inherit}.smart-focus-button h3{margin:0 0 7px}.smart-focus-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;color:var(--muted,#667786);font-size:.75rem}.smart-focus-label{font-weight:800;color:var(--brand,#0d3656)}
      @media(max-width:900px){.smart-priority-groups{grid-template-columns:repeat(2,minmax(0,1fr))}.smart-priority-head{flex-direction:column}.smart-priority-actions{justify-content:flex-start}.smart-metric{grid-template-columns:1fr}.smart-priority-panel{padding:16px}}
      @media(max-width:600px){.smart-priority-filters,.smart-matrix-grid{grid-template-columns:1fr}.smart-group-card{min-height:82px}.smart-priority-task{grid-template-columns:1fr}.smart-score{justify-self:start}.smart-assessment summary{align-items:flex-start}.smart-assessment-footer{align-items:flex-start;flex-direction:column}}
      [data-theme="dark"] .smart-rating button[aria-pressed="true"]{color:#fff}
    `;
    document.head.appendChild(style);
  }

  function ensureAssessmentUi() {
    const form = document.getElementById('taskForm');
    if (!form || document.getElementById('smartAssessment')) return;
    const detailsAnchor = form.querySelector('.v11-extra-details') || form.querySelector('.modal-actions');
    if (!detailsAnchor) return;

    const assessment = document.createElement('details');
    assessment.id = 'smartAssessment';
    assessment.className = 'smart-assessment';
    assessment.innerHTML = `
      <summary>
        <span class="smart-assessment-title"><strong>الأولوية الذكية</strong><small>اختياري</small></span>
        <span class="smart-assessment-summary" id="smartAssessmentSummary">بدون تقييم</span>
      </summary>
      <div class="smart-assessment-body">
        <div class="smart-metric">
          <div class="smart-metric-copy"><strong>الأثر</strong><small>ما حجم أثر إنجاز المهمة؟</small></div>
          <div class="smart-rating" data-smart-rating="impact" aria-label="تقييم أثر المهمة"></div>
        </div>
        <div class="smart-metric">
          <div class="smart-metric-copy"><strong>سهولة التنفيذ</strong><small>ما مدى سهولة تنفيذها حاليا؟</small></div>
          <div class="smart-rating" data-smart-rating="ease" aria-label="تقييم سهولة التنفيذ"></div>
        </div>
        <div class="smart-assessment-footer">
          <span class="smart-assessment-hint">1 منخفض · 5 مرتفع</span>
          <button type="button" class="smart-clear-assessment" id="smartClearAssessment">مسح التقييم</button>
        </div>
      </div>`;
    detailsAnchor.insertAdjacentElement('beforebegin', assessment);

    assessment.querySelectorAll('[data-smart-rating]').forEach(host => {
      host.innerHTML = [1,2,3,4,5].map(value => `<button type="button" data-smart-value="${value}" aria-pressed="false">${value}</button>`).join('');
      host.addEventListener('click', event => {
        const button = event.target.closest('[data-smart-value]');
        if (!button) return;
        setRating(host.dataset.smartRating, Number(button.dataset.smartValue));
      });
    });

    document.getElementById('smartClearAssessment')?.addEventListener('click', () => {
      setRating('impact', null);
      setRating('ease', null);
    });

    form.addEventListener('submit', captureAssessmentForSave, true);
    const dialog = document.getElementById('taskModal');
    if (dialog) {
      new MutationObserver(() => {
        if (dialog.open) setTimeout(populateAssessment, 0);
      }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    }
  }

  function ratingValue(kind) {
    const active = document.querySelector(`[data-smart-rating="${kind}"] [aria-pressed="true"]`);
    return active ? clampRating(active.dataset.smartValue) : null;
  }

  function setRating(kind, value) {
    const host = document.querySelector(`[data-smart-rating="${kind}"]`);
    if (!host) return;
    host.querySelectorAll('[data-smart-value]').forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.smartValue) === Number(value)));
    });
    updateAssessmentSummary();
  }

  function updateAssessmentSummary() {
    const summary = document.getElementById('smartAssessmentSummary');
    if (!summary) return;
    const impact = ratingValue('impact');
    const ease = ratingValue('ease');
    if (!impact && !ease) {
      summary.textContent = 'بدون تقييم';
      return;
    }
    if (!impact || !ease) {
      summary.textContent = 'أكمل التقييم';
      return;
    }
    const temp = { impact, ease };
    const key = category(temp);
    summary.textContent = `${GROUPS[key].short} · ${score(temp)}`;
  }

  function populateAssessment() {
    ensureAssessmentUi();
    const id = document.getElementById('taskId')?.value || '';
    const task = id ? (readState().tasks || []).find(item => String(item.id) === String(id)) : null;
    setRating('impact', clampRating(task?.impact));
    setRating('ease', clampRating(task?.ease));
    const details = document.getElementById('smartAssessment');
    if (details && !task) details.open = false;
  }

  function captureAssessmentForSave() {
    const state = readState();
    const taskId = document.getElementById('taskId')?.value || '';
    const beforeIds = new Set((state.tasks || []).map(task => String(task.id)));
    const draft = {
      taskId: String(taskId),
      beforeIds,
      impact: ratingValue('impact'),
      ease: ratingValue('ease')
    };
    setTimeout(() => applyAssessmentDraft(draft), 0);
  }

  function applyAssessmentDraft(draft) {
    const state = readState();
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    let task = draft.taskId ? tasks.find(item => String(item.id) === draft.taskId) : tasks.find(item => !draft.beforeIds.has(String(item.id)));
    if (!task) return;
    if (draft.impact) task.impact = draft.impact; else task.impact = null;
    if (draft.ease) task.ease = draft.ease; else task.ease = null;
    writeState(state);
    scheduleRender();
  }

  function ensureDashboard() {
    const stats = document.getElementById('todayStats');
    if (!stats || document.getElementById('smartPriorityPanel')) return;
    const panel = document.createElement('section');
    panel.id = 'smartPriorityPanel';
    panel.className = 'smart-priority-panel';
    panel.innerHTML = `
      <div class="smart-priority-head">
        <div><span class="smart-priority-kicker">✦ ترتيب ذكي</span><h2>بماذا أبدأ؟</h2><p>الأولوية تحسب من الأثر وسهولة التنفيذ، وتعمل على جميع المساحات والأشخاص.</p></div>
        <div class="smart-priority-actions"><button type="button" id="smartMatrixToggle">عرض المصفوفة</button></div>
      </div>
      <div class="smart-priority-filters">
        <select id="smartSpaceFilter" aria-label="تصفية الأولوية حسب المساحة"></select>
        <select id="smartPersonFilter" aria-label="تصفية الأولوية حسب الشخص"></select>
      </div>
      <div class="smart-priority-groups" id="smartPriorityGroups"></div>
      <div class="smart-priority-list" id="smartPriorityList"></div>
      <div class="smart-matrix" id="smartPriorityMatrix" hidden></div>`;
    stats.insertAdjacentElement('afterend', panel);

    document.getElementById('smartSpaceFilter')?.addEventListener('change', event => {
      dashboardSpace = event.target.value;
      renderDashboard();
    });
    document.getElementById('smartPersonFilter')?.addEventListener('change', event => {
      dashboardPerson = event.target.value;
      renderDashboard();
    });
    document.getElementById('smartMatrixToggle')?.addEventListener('click', event => {
      matrixOpen = !matrixOpen;
      event.currentTarget.classList.toggle('active', matrixOpen);
      event.currentTarget.textContent = matrixOpen ? 'إخفاء المصفوفة' : 'عرض المصفوفة';
      renderDashboard();
    });
    document.getElementById('smartPriorityGroups')?.addEventListener('click', event => {
      const card = event.target.closest('[data-smart-group]');
      if (!card) return;
      dashboardGroup = card.dataset.smartGroup;
      renderDashboard();
    });
  }

  function filteredAssessedTasks() {
    const state = readState();
    return (state.tasks || [])
      .filter(task => task.status !== 'done' && assessed(task))
      .filter(task => !dashboardSpace || String(task.spaceId || '') === dashboardSpace)
      .filter(task => !dashboardPerson || String(task.personId || '') === dashboardPerson)
      .sort(compareTasks);
  }

  function populateDashboardFilters() {
    const state = readState();
    const space = document.getElementById('smartSpaceFilter');
    const person = document.getElementById('smartPersonFilter');
    if (!space || !person) return;

    const validSpaces = new Set((state.spaces || []).map(item => String(item.id)));
    const validPeople = new Set((state.people || []).map(item => String(item.id)));
    if (dashboardSpace && !validSpaces.has(dashboardSpace)) dashboardSpace = '';
    if (dashboardPerson && !validPeople.has(dashboardPerson)) dashboardPerson = '';

    space.innerHTML = `<option value="">كل المساحات</option>${(state.spaces || []).map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name || 'مساحة')}</option>`).join('')}`;
    person.innerHTML = `<option value="">كل الأشخاص</option>${(state.people || []).map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name || 'شخص')}</option>`).join('')}`;
    space.value = dashboardSpace;
    person.value = dashboardPerson;
  }

  function taskMeta(task, state) {
    const space = (state.spaces || []).find(item => String(item.id) === String(task.spaceId || ''));
    const person = (state.people || []).find(item => String(item.id) === String(task.personId || ''));
    return [space?.name, person?.name, task.due ? `موعد ${task.due}` : ''].filter(Boolean);
  }

  function renderDashboard() {
    ensureDashboard();
    const panel = document.getElementById('smartPriorityPanel');
    if (!panel) return;
    populateDashboardFilters();

    const state = readState();
    const tasks = filteredAssessedTasks();
    const grouped = Object.fromEntries(GROUP_ORDER.map(key => [key, tasks.filter(task => category(task) === key)]));
    const groupsHost = document.getElementById('smartPriorityGroups');
    const listHost = document.getElementById('smartPriorityList');
    const matrixHost = document.getElementById('smartPriorityMatrix');

    groupsHost.innerHTML = GROUP_ORDER.map(key => {
      const group = GROUPS[key];
      return `<button type="button" class="smart-group-card ${dashboardGroup === key ? 'active' : ''}" data-smart-group="${key}"><strong><span>${group.label}</span><b>${grouped[key].length}</b></strong><small>${group.description}</small></button>`;
    }).join('');

    const selected = grouped[dashboardGroup].slice(0, 6);
    listHost.innerHTML = selected.length ? selected.map(task => {
      const meta = taskMeta(task, state);
      return `<button type="button" class="smart-priority-task" data-edit="${escapeHtml(task.id)}"><span><strong>${escapeHtml(task.title || 'مهمة')}</strong><small>${meta.map(item => `<span>${escapeHtml(item)}</span>`).join('')}<span>أثر ${task.impact}/5</span><span>سهولة ${task.ease}/5</span></small></span><span class="smart-score">${score(task)}</span></button>`;
    }).join('') : '<div class="smart-empty">قيّم الأثر وسهولة التنفيذ لأي مهمة، وستظهر هنا تلقائيا.</div>';

    matrixHost.hidden = !matrixOpen;
    if (matrixOpen) {
      matrixHost.innerHTML = `
        <div class="smart-matrix-axis"><span>أثر أعلى ↑</span><span>سهولة التنفيذ ← أعلى</span></div>
        <div class="smart-matrix-grid">${GROUP_ORDER.map(key => {
          const items = grouped[key];
          const visible = items.slice(0, 7);
          return `<section class="smart-matrix-cell" data-matrix-group="${key}"><h3>${GROUPS[key].label}</h3><small>${GROUPS[key].description}</small><div class="smart-matrix-tasks">${visible.map(task => `<button type="button" class="smart-matrix-task" data-edit="${escapeHtml(task.id)}" title="${escapeHtml(task.title || 'مهمة')}">${escapeHtml(task.title || 'مهمة')}</button>`).join('')}${items.length > visible.length ? `<span class="smart-matrix-more">+${items.length - visible.length}</span>` : ''}</div></section>`;
        }).join('')}</div>`;
    }
  }

  function ensureTodaySort() {
    const host = document.getElementById('todayFilters');
    if (!host || document.getElementById('smartTodaySortBtn')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'smartTodaySortBtn';
    button.textContent = 'الأولوية الذكية';
    button.dataset.smartSort = 'today';
    host.appendChild(button);

    button.addEventListener('click', () => {
      const all = host.querySelector('[data-filter="all"]');
      all?.click();
      host.querySelectorAll('button').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      smartTodaySort = true;
      setTimeout(() => sortTaskItems(document.getElementById('todayTaskList')), 0);
    });

    host.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target || target === button) return;
      smartTodaySort = false;
    }, true);
  }

  function ensureEntitySort() {
    const actions = document.querySelector('.entity-detail-actions');
    if (!actions || document.getElementById('smartEntitySortBtn')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'smartEntitySortBtn';
    button.className = 'smart-entity-sort';
    button.textContent = 'الأولوية الذكية';
    button.setAttribute('aria-pressed', 'false');
    actions.insertBefore(button, actions.firstChild);
    button.addEventListener('click', () => {
      smartEntitySort = !smartEntitySort;
      button.setAttribute('aria-pressed', String(smartEntitySort));
      applyEntitySort();
    });
  }

  function sortTaskItems(host) {
    if (!host) return;
    const state = readState();
    const byId = new Map((state.tasks || []).map(task => [String(task.id), task]));
    const items = [...host.querySelectorAll(':scope > .task-item')];
    const sorted = [...items].sort((a, b) => compareTasks(byId.get(String(a.dataset.task)) || {}, byId.get(String(b.dataset.task)) || {}));
    const currentOrder = items.map(item => String(item.dataset.task)).join('|');
    const nextOrder = sorted.map(item => String(item.dataset.task)).join('|');
    if (currentOrder === nextOrder) return;
    sorted.forEach(item => host.appendChild(item));
  }

  function applyEntitySort() {
    if (!smartEntitySort) return;
    const state = readState();
    const byId = new Map((state.tasks || []).map(task => [String(task.id), task]));
    document.querySelectorAll('#entityTaskList .entity-task-group:not(.is-completed)').forEach(group => {
      const items = [...group.querySelectorAll(':scope > .task-item')];
      const sorted = [...items].sort((a, b) => compareTasks(byId.get(String(a.dataset.task)) || {}, byId.get(String(b.dataset.task)) || {}));
      const currentOrder = items.map(item => String(item.dataset.task)).join('|');
      const nextOrder = sorted.map(item => String(item.dataset.task)).join('|');
      if (currentOrder === nextOrder) return;
      sorted.forEach(item => group.appendChild(item));
    });
  }

  function decorateTaskItems() {
    const state = readState();
    const byId = new Map((state.tasks || []).map(task => [String(task.id), task]));
    document.querySelectorAll('.task-item[data-task]').forEach(item => {
      const task = byId.get(String(item.dataset.task));
      const meta = item.querySelector('.task-meta');
      let chip = item.querySelector('.smart-priority-chip');
      if (!task || !assessed(task) || !meta) {
        chip?.remove();
        return;
      }
      const key = category(task);
      if (!chip) {
        chip = document.createElement('span');
        chip.className = 'chip smart-priority-chip';
        meta.appendChild(chip);
      }
      if (chip.dataset.smartGroup !== key) chip.dataset.smartGroup = key;
      if (chip.textContent !== GROUPS[key].short) chip.textContent = GROUPS[key].short;
      const title = `الأثر ${task.impact}/5 · سهولة التنفيذ ${task.ease}/5 · الدرجة ${score(task)}`;
      if (chip.title !== title) chip.title = title;
    });
  }

  function renderSmartFocus() {
    const host = document.getElementById('focusTask');
    if (!host) return;
    const state = readState();
    const task = (state.tasks || []).filter(item => item.status !== 'done' && assessed(item)).sort(compareTasks)[0];
    if (!task) return;
    const key = category(task);
    const signature = `${task.id}|${task.title}|${task.impact}|${task.ease}|${task.due || ''}|${key}`;
    if (host.dataset.smartFocusSignature === signature && host.querySelector('.smart-focus-button')) return;
    host.dataset.smartFocusSignature = signature;
    host.innerHTML = `<div class="focus-box"><button type="button" class="smart-focus-button" data-edit="${escapeHtml(task.id)}"><h3>${escapeHtml(task.title || 'مهمة')}</h3><div class="smart-focus-meta"><span class="smart-focus-label">${GROUPS[key].label}</span><span>أثر ${task.impact}/5</span><span>سهولة ${task.ease}/5</span><span>درجة ${score(task)}</span></div></button></div>`;
  }

  function setAssessment(taskId, values = {}) {
    const state = readState();
    const task = (state.tasks || []).find(item => String(item.id) === String(taskId));
    if (!task) return false;
    const impact = clampRating(values.impact);
    const ease = clampRating(values.ease);
    if (impact) task.impact = impact; else task.impact = null;
    if (ease) task.ease = ease; else task.ease = null;
    writeState(state);
    scheduleRender();
    return true;
  }

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    queueMicrotask(() => {
      renderQueued = false;
      ensureAssessmentUi();
      ensureDashboard();
      ensureTodaySort();
      ensureEntitySort();
      renderDashboard();
      decorateTaskItems();
      renderSmartFocus();
      if (smartTodaySort) sortTaskItems(document.getElementById('todayTaskList'));
      applyEntitySort();
    });
  }

  Storage.prototype.setItem = function(key, value) {
    const result = nativeSetItem.call(this, key, value);
    if (this === localStorage && key === DATA_KEY) scheduleRender();
    return result;
  };

  const observer = new MutationObserver(mutations => {
    const relevant = mutations.some(mutation => {
      if (mutation.type !== 'childList') return false;
      const target = mutation.target instanceof Element ? mutation.target : mutation.target?.parentElement;
      if (!target) return false;
      return !target.closest('#smartPriorityPanel, #smartAssessment');
    });
    if (relevant) scheduleRender();
  });

  function boot() {
    installStyles();
    ensureAssessmentUi();
    ensureDashboard();
    ensureTodaySort();
    ensureEntitySort();
    scheduleRender();
    observer.observe(document.body, { childList: true, subtree: true });
    document.documentElement.dataset.mesraahPriorityVersion = VERSION;

    window.MesraahPriority = Object.freeze({
      version: VERSION,
      score: task => score(task),
      category: task => category(task),
      assessed: task => assessed(task),
      setAssessment,
      groups: GROUPS
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
