const DATA_KEY = 'mesraah_v030';

export const TASK_TOOL_DECLARATIONS = [
  {
    name: 'search_tasks',
    description: 'ابحث لحظيا في مهام مسراح الحالية. استخدم هذه الوظيفة قبل الإجابة عن أي سؤال عن مهمة موجودة، وقبل التعديل أو الحذف أو الإنجاز إذا لم يكن لديك taskId مؤكد من نتيجة بحث سابقة.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'كلمات البحث مثل اسم المهمة أو الشخص أو المكان أو المساحة. اتركها فارغة لعرض المهام.' },
        includeDone: { type: 'boolean', description: 'هل تشمل المهام المنجزة؟ الافتراضي false.' },
        due: { type: 'string', description: 'تاريخ محدد بصيغة YYYY-MM-DD عند الحاجة.' },
        personName: { type: 'string', description: 'اسم شخص للبحث عنه داخل المهمة أو تفاصيلها.' },
        spaceName: { type: 'string', description: 'اسم المساحة أو الجهة إن كان السؤال عنها.' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'add_task',
    description: 'أضف مهمة فعلية إلى مسراح. استخدمها فقط عندما يطلب المستخدم صراحة الإضافة أو الحفظ أو التسجيل. حافظ على التاريخ والوقت وكل الأشخاص والمكان والملاحظات. لا تقل تم إلا إذا رجعت الأداة ok=true.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'عنوان المهمة نفسه فقط بصياغة قصيرة.' },
        due: { type: 'string', description: 'تاريخ المهمة YYYY-MM-DD. الليلة تعني تاريخ اليوم وبكرة تاريخ الغد.' },
        time: { type: 'string', description: 'وقت المهمة HH:MM بنظام 24 ساعة.' },
        location: { type: 'string', description: 'المكان كاملا كما ذكره المستخدم.' },
        peopleNames: { type: 'array', items: { type: 'string' }, description: 'كل أسماء الأشخاص المذكورين.' },
        follow: { type: 'string', description: 'موعد المتابعة YYYY-MM-DD إن وجد.' },
        priority: { type: 'string', enum: ['normal', 'important', 'strategic'] },
        status: { type: 'string', enum: ['inbox', 'active', 'waiting'] },
        spaceName: { type: 'string', description: 'اسم المساحة أو الجهة الموجودة في مسراح.' },
        notes: { type: 'string', description: 'أي تفاصيل إضافية لم يمثلها حقل آخر.' }
      },
      required: ['title'],
      additionalProperties: false
    }
  },
  {
    name: 'update_task',
    description: 'عدّل نفس المهمة الموجودة ولا تنشئ مهمة جديدة. يجب إرسال taskId من search_tasks أو من نتيجة أداة سابقة. غيّر فقط الحقول التي طلب المستخدم تغييرها، وحافظ على بقية التفاصيل. لا تقل تم التعديل إلا إذا رجعت الأداة ok=true.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'معرف المهمة المؤكد من search_tasks.' },
        title: { type: 'string' },
        due: { type: 'string', description: 'YYYY-MM-DD' },
        time: { type: 'string', description: 'HH:MM بنظام 24 ساعة، ويمكن إرسال قيمة فارغة لمسح الوقت.' },
        location: { type: 'string', description: 'المكان الجديد، ويمكن إرسال قيمة فارغة لمسحه.' },
        peopleNames: { type: 'array', items: { type: 'string' }, description: 'قائمة الأشخاص الجديدة كاملة عند تغيير الأشخاص.' },
        follow: { type: 'string', description: 'YYYY-MM-DD ويمكن إرسال قيمة فارغة لمسح المتابعة.' },
        priority: { type: 'string', enum: ['normal', 'important', 'strategic'] },
        status: { type: 'string', enum: ['inbox', 'active', 'waiting'] },
        spaceName: { type: 'string', description: 'المساحة الجديدة، ويمكن إرسال قيمة فارغة لإلغاء الربط.' },
        notes: { type: 'string', description: 'الملاحظات الإضافية الجديدة.' }
      },
      required: ['taskId'],
      additionalProperties: false
    }
  },
  {
    name: 'delete_task',
    description: 'احذف مهمة موجودة فقط بعد طلب حذف صريح من المستخدم وبعد تحديد المهمة دون غموض. يجب إرسال taskId مؤكد. لا تقل حذفتها إلا إذا رجعت الأداة ok=true.',
    parametersJsonSchema: {
      type: 'object',
      properties: { taskId: { type: 'string', description: 'معرف المهمة المؤكد.' } },
      required: ['taskId'],
      additionalProperties: false
    }
  },
  {
    name: 'complete_task',
    description: 'علّم مهمة موجودة كمنجزة فقط عندما يطلب المستخدم ذلك صراحة. يجب إرسال taskId مؤكد. لا تقل تم الإنجاز إلا إذا رجعت الأداة ok=true.',
    parametersJsonSchema: {
      type: 'object',
      properties: { taskId: { type: 'string', description: 'معرف المهمة المؤكد.' } },
      required: ['taskId'],
      additionalProperties: false
    }
  }
];

function readState() {
  try { return JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {}; }
  catch { return {}; }
}

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function findNamedId(items = [], name = '') {
  const wanted = normalize(name);
  if (!wanted) return '';
  const exact = items.find(item => normalize(item.name) === wanted);
  if (exact) return exact.id || '';
  const partial = items.find(item => {
    const candidate = normalize(item.name);
    return candidate.includes(wanted) || wanted.includes(candidate);
  });
  return partial?.id || '';
}

function taskView(task, state) {
  const person = (state.people || []).find(item => item.id === task.personId);
  const space = (state.spaces || []).find(item => item.id === task.spaceId);
  return {
    id: task.id,
    title: task.title || '',
    notes: task.notes || '',
    status: task.status || 'inbox',
    priority: task.priority || 'normal',
    due: task.due || '',
    follow: task.follow || '',
    points: task.points || 0,
    person: person?.name || '',
    space: space?.name || ''
  };
}

function parseDetails(notes = '') {
  const details = { time: '', peopleNames: [], location: '', extra: [] };
  String(notes || '').split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (/^الوقت\s*:/.test(trimmed)) {
      details.time = trimmed.replace(/^الوقت\s*:\s*/, '').trim();
    } else if (/^مع\s*:/.test(trimmed)) {
      details.peopleNames = trimmed.replace(/^مع\s*:\s*/, '').split(/[،,]/).map(v => v.trim()).filter(Boolean);
    } else if (/^المكان\s*:/.test(trimmed)) {
      details.location = trimmed.replace(/^المكان\s*:\s*/, '').trim();
    } else {
      details.extra.push(trimmed);
    }
  });
  return details;
}

function formatDetails({ time = '', peopleNames = [], location = '', notes = '' } = {}) {
  const lines = [];
  const cleanTime = /^\d{2}:\d{2}$/.test(String(time || '')) ? String(time) : '';
  const people = Array.isArray(peopleNames) ? peopleNames.map(v => String(v || '').trim()).filter(Boolean) : [];
  const cleanLocation = String(location || '').trim();
  const extra = String(notes || '').trim();
  if (cleanTime) lines.push(`الوقت: ${cleanTime}`);
  if (people.length) lines.push(`مع: ${people.join('، ')}`);
  if (cleanLocation) lines.push(`المكان: ${cleanLocation}`);
  if (extra) lines.push(extra);
  return { text: lines.join('\n'), people };
}

function searchTasks(args = {}) {
  const state = readState();
  const query = normalize(args.query || '');
  const personWanted = normalize(args.personName || '');
  const spaceWanted = normalize(args.spaceName || '');
  const includeDone = Boolean(args.includeDone);
  const due = String(args.due || '').trim();
  let tasks = [...(state.tasks || [])];

  if (!includeDone) tasks = tasks.filter(task => task.status !== 'done');
  if (due) tasks = tasks.filter(task => task.due === due || task.follow === due);

  tasks = tasks.filter(task => {
    const person = (state.people || []).find(item => item.id === task.personId);
    const space = (state.spaces || []).find(item => item.id === task.spaceId);
    const haystack = normalize([task.title, task.notes, task.due, task.follow, person?.name, space?.name].filter(Boolean).join(' '));
    if (personWanted && !haystack.includes(personWanted)) return false;
    if (spaceWanted && !normalize(space?.name || '').includes(spaceWanted)) return false;
    if (!query) return true;
    return haystack.includes(query) || query.split(' ').every(word => !word || haystack.includes(word));
  });

  tasks.sort((a, b) => (a.due || '9999-99-99').localeCompare(b.due || '9999-99-99'));
  const results = tasks.slice(0, 20).map(task => taskView(task, state));
  return { ok: true, count: tasks.length, tasks: results, truncated: tasks.length > results.length };
}

function getTaskById(id) {
  const state = readState();
  const task = (state.tasks || []).find(item => String(item.id) === String(id));
  return { state, task };
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

async function submitTaskForm(payload) {
  const form = document.getElementById('taskForm');
  const dialog = document.getElementById('taskModal');
  if (!form || !dialog) throw new Error('task-form-unavailable');

  const oldVisibility = dialog.style.visibility;
  dialog.style.visibility = 'hidden';
  if (!dialog.open) dialog.showModal();

  setValue('taskId', payload.id || '');
  setValue('taskTitle', payload.title || '');
  setValue('taskNotes', payload.notes || '');
  setValue('taskSpace', payload.spaceId || '');
  setValue('taskPerson', payload.personId || '');
  setValue('taskStatus', payload.status || 'inbox');
  setValue('taskPriority', payload.priority || 'normal');
  setValue('taskDue', payload.due || '');
  setValue('taskFollow', payload.follow || '');
  setValue('taskPoints', String(payload.points || 10));

  try {
    if (typeof form.onsubmit === 'function') {
      form.onsubmit({ preventDefault() {} });
    } else {
      form.requestSubmit();
    }
  } finally {
    if (dialog.open) {
      try { dialog.close(); } catch {}
    }
    dialog.style.visibility = oldVisibility;
  }
  await new Promise(resolve => setTimeout(resolve, 60));
}

async function addTask(args = {}) {
  const title = String(args.title || '').replace(/\s+/g, ' ').trim();
  if (!title) return { ok: false, error: 'missing-title' };

  const before = readState();
  const details = formatDetails(args);
  const linkedPerson = details.people.find(name => findNamedId(before.people || [], name)) || '';
  const personId = findNamedId(before.people || [], linkedPerson);
  const spaceId = findNamedId(before.spaces || [], args.spaceName || '');
  const priority = ['normal', 'important', 'strategic'].includes(args.priority) ? args.priority : 'normal';
  const status = ['inbox', 'active', 'waiting'].includes(args.status) ? args.status : 'inbox';
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';

  await submitTaskForm({
    id: '', title, notes: details.text, spaceId, personId, status, priority,
    due: validDate(args.due), follow: validDate(args.follow),
    points: priority === 'strategic' ? 30 : priority === 'important' ? 20 : 10
  });

  const after = readState();
  const added = (after.tasks || []).slice().reverse().find(task => task.title === title && !(before.tasks || []).some(old => old.id === task.id));
  if (!added) return { ok: false, error: 'task-save-not-confirmed' };
  return { ok: true, task: taskView(added, after) };
}

async function updateTask(args = {}) {
  const { state: before, task } = getTaskById(args.taskId);
  if (!task) return { ok: false, error: 'task-not-found' };
  if (task.status === 'done') return { ok: false, error: 'task-already-done' };

  const previousDetails = parseDetails(task.notes || '');
  const peopleNames = hasOwn(args, 'peopleNames') ? args.peopleNames : previousDetails.peopleNames;
  const time = hasOwn(args, 'time') ? args.time : previousDetails.time;
  const location = hasOwn(args, 'location') ? args.location : previousDetails.location;
  const notes = hasOwn(args, 'notes') ? args.notes : previousDetails.extra.join('\n');
  const details = formatDetails({ time, peopleNames, location, notes });

  let personId = task.personId || '';
  if (hasOwn(args, 'peopleNames')) {
    const linkedName = details.people.find(name => findNamedId(before.people || [], name)) || '';
    personId = findNamedId(before.people || [], linkedName);
  }

  let spaceId = task.spaceId || '';
  if (hasOwn(args, 'spaceName')) spaceId = findNamedId(before.spaces || [], args.spaceName || '');

  const validDateOrExisting = (key, existing) => {
    if (!hasOwn(args, key)) return existing || '';
    const value = String(args[key] || '');
    return !value || /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : existing || '';
  };

  const priority = hasOwn(args, 'priority') && ['normal', 'important', 'strategic'].includes(args.priority) ? args.priority : task.priority || 'normal';
  const status = hasOwn(args, 'status') && ['inbox', 'active', 'waiting'].includes(args.status) ? args.status : task.status || 'inbox';

  await submitTaskForm({
    id: task.id,
    title: hasOwn(args, 'title') ? String(args.title || '').trim() || task.title : task.title,
    notes: details.text,
    spaceId,
    personId,
    status,
    priority,
    due: validDateOrExisting('due', task.due),
    follow: validDateOrExisting('follow', task.follow),
    points: task.points || 10
  });

  const after = readState();
  const updated = (after.tasks || []).find(item => String(item.id) === String(task.id));
  if (!updated) return { ok: false, error: 'task-update-not-confirmed' };
  return { ok: true, task: taskView(updated, after) };
}

async function deleteTask(args = {}) {
  const { task } = getTaskById(args.taskId);
  if (!task) return { ok: false, error: 'task-not-found' };

  const button = document.getElementById('deleteTaskBtn');
  const dialog = document.getElementById('taskModal');
  if (!button || typeof button.onclick !== 'function' || !dialog) return { ok: false, error: 'delete-handler-unavailable' };

  const oldVisibility = dialog.style.visibility;
  dialog.style.visibility = 'hidden';
  if (!dialog.open) dialog.showModal();
  setValue('taskId', task.id);
  try {
    button.onclick.call(button, { preventDefault() {} });
  } catch (error) {
    if (dialog.open) { try { dialog.close(); } catch {} }
    dialog.style.visibility = oldVisibility;
    return { ok: false, error: String(error?.message || error) };
  }
  dialog.style.visibility = oldVisibility;
  await new Promise(resolve => setTimeout(resolve, 50));

  const after = readState();
  const exists = (after.tasks || []).some(item => String(item.id) === String(task.id));
  return exists ? { ok: false, error: 'task-delete-not-confirmed' } : { ok: true, deletedId: task.id, title: task.title };
}

async function completeTask(args = {}) {
  const { task } = getTaskById(args.taskId);
  if (!task) return { ok: false, error: 'task-not-found' };
  if (task.status === 'done') return { ok: true, alreadyDone: true, task: taskView(task, readState()) };

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.hidden = true;
  trigger.dataset.done = task.id;
  document.body.appendChild(trigger);
  trigger.click();
  trigger.remove();
  await new Promise(resolve => setTimeout(resolve, 50));

  const after = readState();
  const completed = (after.tasks || []).find(item => String(item.id) === String(task.id));
  if (!completed || completed.status !== 'done') return { ok: false, error: 'task-complete-not-confirmed' };
  return { ok: true, task: taskView(completed, after) };
}

export async function executeTaskTool(name, args = {}) {
  if (name === 'search_tasks') return searchTasks(args);
  if (name === 'add_task') return addTask(args);
  if (name === 'update_task') return updateTask(args);
  if (name === 'delete_task') return deleteTask(args);
  if (name === 'complete_task') return completeTask(args);
  return { ok: false, error: 'unknown-tool' };
}
