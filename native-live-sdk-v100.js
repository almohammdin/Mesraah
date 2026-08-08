const SOURCE = 'https://cdn.jsdelivr.net/gh/almohammdin/Mesraah@1008336269c853df36ae7f8ac14f8e95ffc9dbab/native-live-sdk-v097.js';

const TOOL_CODE = String.raw`
const TOOL_DECLARATIONS = [
  {
    name: 'search_tasks',
    description: 'ابحث لحظيا في مهام مسراح الحالية. استخدم هذه الوظيفة قبل الإجابة عن أي سؤال يتعلق بالمهام الموجودة أو مواعيدها أو الأشخاص أو الأماكن المذكورة في تفاصيلها. لا تعتمد فقط على سياق بداية الجلسة.',
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
    description: 'أضف مهمة فعلية إلى مسراح. استدع هذه الوظيفة فقط عندما يصدر المستخدم أمرا صريحا بالحفظ أو الإضافة مثل أضف، ضيف، سجل، حط مهمة، أنشئ مهمة. حافظ على كل تفاصيل كلام المستخدم: التاريخ والوقت والأشخاص والمكان والملاحظات. لا تضع الوقت أو الأشخاص أو المكان في العنوان إذا لها حقول مستقلة. إذا لم يوجد حقل مناسب لتفصيل مهم ضعه في notes. إذا قال رغبة فقط مثل ودي أو أبغى أو أفكر بدون طلب إضافة، ناقشه واسأله هل يريد إضافتها ولا تستدع الوظيفة حتى يؤكد.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'عنوان المهمة نفسه فقط بصياغة قصيرة، مثل عشاء أو الاتصال بخالد.' },
        due: { type: 'string', description: 'تاريخ المهمة بصيغة YYYY-MM-DD. الليلة تعني تاريخ اليوم، وبكرة تعني تاريخ الغد.' },
        time: { type: 'string', description: 'وقت المهمة بصيغة HH:MM بنظام 24 ساعة، مثلا 21:00.' },
        location: { type: 'string', description: 'المكان كاملا كما ذكره المستخدم، مثلا مطعم أوسكار، شارع حراء، جدة.' },
        peopleNames: { type: 'array', items: { type: 'string' }, description: 'كل أسماء الأشخاص المذكورين مع المهمة، بدون إسقاط أي اسم.' },
        follow: { type: 'string', description: 'موعد المتابعة بصيغة YYYY-MM-DD إن وجد.' },
        priority: { type: 'string', enum: ['normal', 'important', 'strategic'], description: 'الأهمية.' },
        status: { type: 'string', enum: ['inbox', 'active', 'waiting'], description: 'الحالة، والافتراضي inbox.' },
        spaceName: { type: 'string', description: 'اسم المساحة الموجودة في مسراح إن كانت مرتبطة بالمهمة.' },
        notes: { type: 'string', description: 'أي تفاصيل إضافية مهمة لم يمثلها حقل آخر. لا تسقط أي معلومة قالها المستخدم.' }
      },
      required: ['title'],
      additionalProperties: false
    }
  }
];

function normalizeToolText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findNamedId(items = [], name = '') {
  const wanted = normalizeToolText(name);
  if (!wanted) return '';
  const exact = items.find(item => normalizeToolText(item.name) === wanted);
  if (exact) return exact.id || '';
  const partial = items.find(item => {
    const candidate = normalizeToolText(item.name);
    return candidate.includes(wanted) || wanted.includes(candidate);
  });
  return partial?.id || '';
}

function taskToolView(task, state) {
  const person = (state.people || []).find(p => p.id === task.personId);
  const space = (state.spaces || []).find(s => s.id === task.spaceId);
  return {
    id: task.id,
    title: task.title || '',
    notes: task.notes || '',
    status: task.status || 'inbox',
    priority: task.priority || 'normal',
    due: task.due || '',
    follow: task.follow || '',
    person: person?.name || '',
    space: space?.name || ''
  };
}

function searchTasksTool(args = {}) {
  const state = readState();
  const query = normalizeToolText(args.query || '');
  const personWanted = normalizeToolText(args.personName || '');
  const spaceWanted = normalizeToolText(args.spaceName || '');
  const includeDone = Boolean(args.includeDone);
  const due = String(args.due || '').trim();

  let tasks = [...(state.tasks || [])];
  if (!includeDone) tasks = tasks.filter(task => task.status !== 'done');
  if (due) tasks = tasks.filter(task => task.due === due || task.follow === due);

  tasks = tasks.filter(task => {
    const person = (state.people || []).find(p => p.id === task.personId);
    const space = (state.spaces || []).find(s => s.id === task.spaceId);
    const haystack = normalizeToolText([
      task.title,
      task.notes,
      task.due,
      task.follow,
      person?.name,
      space?.name
    ].filter(Boolean).join(' '));
    if (personWanted && !haystack.includes(personWanted)) return false;
    if (spaceWanted && !normalizeToolText(space?.name || '').includes(spaceWanted)) return false;
    if (!query) return true;
    return haystack.includes(query) || query.split(' ').every(word => !word || haystack.includes(word));
  });

  tasks.sort((a, b) => (a.due || '9999-99-99').localeCompare(b.due || '9999-99-99'));
  const results = tasks.slice(0, 20).map(task => taskToolView(task, state));
  return { count: tasks.length, tasks: results, truncated: tasks.length > results.length };
}

function formatTaskNotes(args = {}) {
  const lines = [];
  const time = /^\d{2}:\d{2}$/.test(String(args.time || '')) ? String(args.time) : '';
  const people = Array.isArray(args.peopleNames)
    ? args.peopleNames.map(name => String(name || '').trim()).filter(Boolean)
    : [];
  const location = String(args.location || '').trim();
  const extra = String(args.notes || '').trim();

  if (time) lines.push('الوقت: ' + time);
  if (people.length) lines.push('مع: ' + people.join('، '));
  if (location) lines.push('المكان: ' + location);
  if (extra) lines.push(extra);
  return { text: lines.join('\n'), people };
}

async function addTaskTool(args = {}) {
  const title = String(args.title || '').replace(/\s+/g, ' ').trim();
  if (!title) return { ok: false, error: 'missing-title' };

  const before = readState();
  const form = document.getElementById('taskForm');
  const dialog = document.getElementById('taskModal');
  if (!form || !dialog) return { ok: false, error: 'task-form-unavailable' };

  const details = formatTaskNotes(args);
  const firstPersonName = details.people[0] || '';
  const personId = findNamedId(before.people || [], firstPersonName);
  const spaceId = findNamedId(before.spaces || [], args.spaceName || '');
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
  const priority = ['normal', 'important', 'strategic'].includes(args.priority) ? args.priority : 'normal';
  const status = ['inbox', 'active', 'waiting'].includes(args.status) ? args.status : 'inbox';

  document.getElementById('taskId').value = '';
  document.getElementById('taskTitle').value = title;
  document.getElementById('taskNotes').value = details.text;
  document.getElementById('taskSpace').value = spaceId;
  document.getElementById('taskPerson').value = personId;
  document.getElementById('taskStatus').value = status;
  document.getElementById('taskPriority').value = priority;
  document.getElementById('taskDue').value = validDate(args.due);
  document.getElementById('taskFollow').value = validDate(args.follow);
  document.getElementById('taskPoints').value = priority === 'strategic' ? '30' : priority === 'important' ? '20' : '10';

  const oldVisibility = dialog.style.visibility;
  try {
    dialog.style.visibility = 'hidden';
    if (!dialog.open) dialog.showModal();
    form.requestSubmit();
  } catch (error) {
    try { if (dialog.open) dialog.close(); } catch {}
    dialog.style.visibility = oldVisibility;
    return { ok: false, error: String(error?.message || error) };
  }
  dialog.style.visibility = oldVisibility;

  await new Promise(resolve => setTimeout(resolve, 40));
  const after = readState();
  const added = (after.tasks || [])
    .slice()
    .reverse()
    .find(task => task.title === title && !(before.tasks || []).some(old => old.id === task.id));

  if (!added) return { ok: false, error: 'task-save-not-confirmed' };
  return {
    ok: true,
    task: taskToolView(added, after),
    detailsSaved: {
      time: args.time || '',
      peopleNames: details.people,
      location: args.location || ''
    }
  };
}

async function executeMesraahTool(name, args) {
  if (name === 'search_tasks') return searchTasksTool(args);
  if (name === 'add_task') return addTaskTool(args);
  return { ok: false, error: 'unknown-tool' };
}

async function handleToolCalls(functionCalls = []) {
  if (!session || !functionCalls.length) return;
  setStatus('أنفذ في مسراح…', 'connecting');
  const functionResponses = [];
  for (const fc of functionCalls) {
    let result;
    try {
      result = await executeMesraahTool(fc.name, fc.args || {});
    } catch (error) {
      result = { ok: false, error: String(error?.message || error) };
    }
    functionResponses.push({
      name: fc.name,
      id: fc.id,
      response: { result }
    });
  }
  try {
    session.sendToolResponse({ functionResponses });
  } catch (error) {
    console.error('Mesraah Live tool response:', error);
    setDetail('تعذر إعادة نتيجة الأداة إلى Gemini.');
  }
}
`;

async function boot() {
  const response = await fetch(`${SOURCE}?v=100`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`native-live-v097-source-${response.status}`);
  let code = await response.text();

  code = code
    .replace("const VERSION = '0.9.7';", "const VERSION = '0.10.0';")
    .replace(
      'function handleMessage(message) {',
      `${TOOL_CODE}\nfunction handleMessage(message) {\n  if (message?.toolCall?.functionCalls?.length) {\n    handleToolCalls(message.toolCall.functionCalls).catch(error => console.error('Mesraah Live tools:', error));\n  }`
    )
    .replace(
      'outputAudioTranscription: {}\n      },',
      "outputAudioTranscription: {},\n        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },\n        tools: [{ functionDeclarations: TOOL_DECLARATIONS }]\n      },"
    )
    .replace(
      'في هذه النسخة التجريبية اقترح الإجراءات صوتيا فقط، ولا تدع أنك نفذت مهمة أو موعدا قبل وجود أداة تنفيذ مؤكدة.',
      'لديك أداتان فعليتان لمهام مسراح. أي سؤال عن المهام الحالية استخدم search_tasks أولا ثم أجب من نتيجتها. إذا أمر المستخدم صراحة بإضافة أو تسجيل أو حفظ مهمة استخدم add_task. استخرج كل التفاصيل التي قالها المستخدم: التاريخ والوقت وكل الأشخاص والمكان وأي ملاحظات، ولا تسقط أي تفصيل. اجعل title اسم المهمة فقط، وضع الوقت في time، وكل الأشخاص في peopleNames، والمكان كاملا في location، وما تبقى في notes. لا تقل تم أو أضفت إلا بعد أن ترجع الأداة ok=true. أما عبارات الرغبة مثل ودي أو أبغى أو أفكر فلا تحولها إلى مهمة تلقائيا؛ ناقشها واسأل هل يريد إضافتها، وبعد موافقته استخدم add_task.'
    )
    .replace(
      'صوت Gemini Native Live بطابور تشغيل مستمر.',
      'Native Live بصوت ثابت ومتصل بمهام مسراح مع حفظ كل تفاصيل المهمة.'
    );

  if (!code.includes("voiceName: 'Kore'")) throw new Error('voice-config-patch-failed');
  if (!code.includes('peopleNames')) throw new Error('task-details-tools-patch-failed');
  if (!code.includes('tools: [{ functionDeclarations: TOOL_DECLARATIONS }]')) throw new Error('tools-config-patch-failed');

  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  try {
    await import(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

boot().catch(error => {
  console.error('Mesraah Native Live v0.10.0 loader:', error);
  window.__MESRAAH_NATIVE_LIVE_LOAD_ERROR__ = String(error?.message || error);
});