const DATA_KEY = 'mesraah_v030';

const recurrenceProps = {
  repeat: { type: 'string', enum: ['none','daily','weekly','monthly','yearly'], description: 'تكرار المهمة. none يعني بدون تكرار.' },
  repeatInterval: { type: 'number', description: 'كل كم وحدة يتكرر، مثل كل أسبوعين = 2.' },
  repeatCount: { type: 'number', description: 'إجمالي عدد مرات المهمة عند اختيار نهاية بعد عدد مرات.' },
  repeatUntil: { type: 'string', description: 'آخر تاريخ للتكرار YYYY-MM-DD. لا تجمعه مع repeatCount.' }
};

export const TASK_TOOL_DECLARATIONS = [
  {
    name: 'search_tasks',
    description: 'ابحث لحظيا في مهام مسراح الحالية. استخدمها قبل السؤال أو التعديل أو الحذف إذا لم يكن taskId مؤكدا.',
    parametersJsonSchema: { type:'object', properties:{
      query:{type:'string'}, includeDone:{type:'boolean'}, due:{type:'string'}, personName:{type:'string'}, spaceName:{type:'string'}
    }, additionalProperties:false }
  },
  {
    name: 'add_task',
    description: 'أضف مهمة فعلية إلى مسراح بعد طلب صريح. احفظ التاريخ والوقت والأشخاص والمكان والتكرار. لا تقل تم إلا إذا رجعت ok=true.',
    parametersJsonSchema: { type:'object', properties:{
      title:{type:'string'}, due:{type:'string'}, time:{type:'string'}, location:{type:'string'},
      peopleNames:{type:'array',items:{type:'string'}}, follow:{type:'string'},
      priority:{type:'string',enum:['normal','important','strategic']}, status:{type:'string',enum:['inbox','active','waiting']},
      spaceName:{type:'string'}, notes:{type:'string'}, ...recurrenceProps
    }, required:['title'], additionalProperties:false }
  },
  {
    name: 'update_task',
    description: 'عدّل نفس المهمة الموجودة ولا تنشئ مهمة جديدة. غيّر الحقول المطلوبة فقط، بما فيها التكرار عند طلبه.',
    parametersJsonSchema: { type:'object', properties:{
      taskId:{type:'string'}, title:{type:'string'}, due:{type:'string'}, time:{type:'string'}, location:{type:'string'},
      peopleNames:{type:'array',items:{type:'string'}}, follow:{type:'string'},
      priority:{type:'string',enum:['normal','important','strategic']}, status:{type:'string',enum:['inbox','active','waiting']},
      spaceName:{type:'string'}, notes:{type:'string'}, ...recurrenceProps
    }, required:['taskId'], additionalProperties:false }
  },
  {
    name:'delete_task',
    description:'احذف مهمة موجودة فقط بعد طلب حذف صريح وتحديدها دون غموض.',
    parametersJsonSchema:{type:'object',properties:{taskId:{type:'string'}},required:['taskId'],additionalProperties:false}
  },
  {
    name:'complete_task',
    description:'علّم مهمة موجودة كمنجزة فقط عند الطلب الصريح. المهمة المتكررة تنشئ دورتها التالية تلقائيا.',
    parametersJsonSchema:{type:'object',properties:{taskId:{type:'string'}},required:['taskId'],additionalProperties:false}
  }
];

function readState(){try{return JSON.parse(localStorage.getItem(DATA_KEY)||'{}')||{}}catch{return {}}}
function normalize(value=''){return String(value).toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ًٌٍَُِّْـ]/g,'').replace(/\s+/g,' ').trim()}
function hasOwn(o,k){return Object.prototype.hasOwnProperty.call(o||{},k)}
function validDate(v){v=String(v||'');return /^\d{4}-\d{2}-\d{2}$/.test(v)?v:''}
function validTime(v){v=String(v||'');return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v)?v:''}
function id(){return globalThis.crypto?.randomUUID?.() || `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}

function findNamedId(items=[],name=''){
  const wanted=normalize(name); if(!wanted)return '';
  const exact=items.find(x=>normalize(x.name)===wanted); if(exact)return exact.id||'';
  return items.find(x=>{const n=normalize(x.name);return n.includes(wanted)||wanted.includes(n)})?.id||'';
}

function parseDetails(notes=''){
  const d={time:'',peopleNames:[],location:'',extra:[]};
  String(notes||'').split(/\r?\n/).forEach(line=>{
    const t=line.trim(); if(!t)return;
    if(/^الوقت\s*:/.test(t))d.time=t.replace(/^الوقت\s*:\s*/,'').trim();
    else if(/^مع\s*:/.test(t))d.peopleNames=t.replace(/^مع\s*:\s*/,'').split(/[،,]/).map(v=>v.trim()).filter(Boolean);
    else if(/^المكان\s*:/.test(t))d.location=t.replace(/^المكان\s*:\s*/,'').trim();
    else d.extra.push(t);
  });
  return d;
}

function formatDetails({time='',peopleNames=[],location='',notes=''}={}){
  const lines=[]; const cleanTime=validTime(time); const people=Array.isArray(peopleNames)?peopleNames.map(v=>String(v||'').trim()).filter(Boolean):[];
  const cleanLocation=String(location||'').trim(); const extra=String(notes||'').trim();
  if(cleanTime)lines.push(`الوقت: ${cleanTime}`); if(people.length)lines.push(`مع: ${people.join('، ')}`); if(cleanLocation)lines.push(`المكان: ${cleanLocation}`); if(extra)lines.push(extra);
  return {text:lines.join('\n'),people,time:cleanTime,location:cleanLocation};
}

function normalizeRecurrence(args={},existing=null){
  const touched=['repeat','repeatInterval','repeatCount','repeatUntil'].some(k=>hasOwn(args,k));
  if(!touched)return existing||null;
  const freq=String(args.repeat||'none'); if(freq==='none'||!['daily','weekly','monthly','yearly'].includes(freq))return null;
  const interval=Math.max(1,Math.min(99,Math.round(Number(args.repeatInterval)||1)));
  const count=Math.max(0,Math.min(999,Math.round(Number(args.repeatCount)||0)));
  const until=validDate(args.repeatUntil);
  return {freq,interval,...(count>=2?{count}:{}),...(!count&&until?{until}: {})};
}

function taskView(task,state){
  const person=(state.people||[]).find(x=>x.id===task.personId); const space=(state.spaces||[]).find(x=>x.id===task.spaceId);
  return {id:task.id,title:task.title||'',notes:task.notes||'',status:task.status||'inbox',priority:task.priority||'normal',due:task.due||'',follow:task.follow||'',time:task.time||'',location:task.location?.name||task.location?.address||'',peopleNames:task.peopleNames||[],recurrence:task.recurrence||null,points:task.points||0,person:person?.name||'',space:space?.name||''};
}

function emitMutation(detail){
  window.dispatchEvent(new CustomEvent('mesraah:task-mutated',{detail}));
  window.dispatchEvent(new CustomEvent('mesraah:data-changed',{detail}));
}

function coreSubmit(payload){
  const form=document.getElementById('taskForm'); if(!form||typeof form.onsubmit!=='function')throw new Error('task-core-unavailable');
  const set=(key,value)=>{const el=document.getElementById(key);if(el)el.value=value??''};
  set('taskId',payload.id||''); set('taskTitle',payload.title||''); set('taskNotes',payload.notes||''); set('taskSpace',payload.spaceId||''); set('taskPerson',payload.personId||'');
  set('taskStatus',payload.status||'inbox'); set('taskPriority',payload.priority||'normal'); set('taskDue',payload.due||''); set('taskFollow',payload.follow||''); set('taskPoints',String(payload.points||10));
  form.onsubmit({preventDefault(){}});
}

function patchExtended(taskId,values={}){
  const state=readState(); const task=(state.tasks||[]).find(x=>String(x.id)===String(taskId)); if(!task)return null;
  Object.entries(values).forEach(([k,v])=>{if(v===undefined)return;if(v===null)delete task[k];else task[k]=v});
  localStorage.setItem(DATA_KEY,JSON.stringify(state)); return task;
}

function searchTasks(args={}){
  const state=readState(); const query=normalize(args.query||''); const personWanted=normalize(args.personName||''); const spaceWanted=normalize(args.spaceName||'');
  let tasks=[...(state.tasks||[])]; if(!args.includeDone)tasks=tasks.filter(t=>t.status!=='done'); if(args.due)tasks=tasks.filter(t=>t.due===args.due||t.follow===args.due);
  tasks=tasks.filter(t=>{const p=(state.people||[]).find(x=>x.id===t.personId);const s=(state.spaces||[]).find(x=>x.id===t.spaceId);const hay=normalize([t.title,t.notes,t.due,t.follow,t.time,t.location?.name,t.location?.address,p?.name,s?.name].filter(Boolean).join(' '));if(personWanted&&!hay.includes(personWanted))return false;if(spaceWanted&&!normalize(s?.name||'').includes(spaceWanted))return false;return !query||hay.includes(query)||query.split(' ').every(w=>!w||hay.includes(w))});
  tasks.sort((a,b)=>(a.due||'9999-99-99').localeCompare(b.due||'9999-99-99')); const out=tasks.slice(0,20).map(t=>taskView(t,state));
  return {ok:true,count:tasks.length,tasks:out,truncated:tasks.length>out.length};
}

function getTaskById(taskId){const state=readState();return {state,task:(state.tasks||[]).find(x=>String(x.id)===String(taskId))}}

async function addTask(args={}){
  const title=String(args.title||'').replace(/\s+/g,' ').trim(); if(!title)return {ok:false,error:'missing-title'};
  const before=readState(); const details=formatDetails(args); const personName=details.people.find(n=>findNamedId(before.people||[],n))||'';
  const personId=findNamedId(before.people||[],personName); const spaceId=findNamedId(before.spaces||[],args.spaceName||'');
  const priority=['normal','important','strategic'].includes(args.priority)?args.priority:'normal'; const status=['inbox','active','waiting'].includes(args.status)?args.status:'inbox';
  coreSubmit({id:'',title,notes:details.text,spaceId,personId,status,priority,due:validDate(args.due),follow:validDate(args.follow),points:priority==='strategic'?30:priority==='important'?20:10});
  const afterCore=readState(); const added=[...(afterCore.tasks||[])].reverse().find(t=>t.title===title&&!(before.tasks||[]).some(old=>old.id===t.id));
  if(!added)return {ok:false,error:'task-save-not-confirmed'};
  const recurrence=normalizeRecurrence(args,null);
  const patched=patchExtended(added.id,{time:details.time,peopleNames:details.people,location:details.location?{name:details.location,address:details.location,placeId:'',lat:null,lng:null}:null,dateSource:'gregorian',recurrence,recurrenceOccurrence:recurrence?1:undefined,recurrenceSeriesId:recurrence?added.id:undefined,calendarDirty:Boolean(added.due)});
  emitMutation({type:'add',taskId:added.id});
  const finalState=readState(); return {ok:true,task:taskView(patched||added,finalState)};
}

async function updateTask(args={}){
  const {state:before,task}=getTaskById(args.taskId); if(!task)return {ok:false,error:'task-not-found'}; if(task.status==='done')return {ok:false,error:'task-already-done'};
  const oldDetails=parseDetails(task.notes||''); const peopleNames=hasOwn(args,'peopleNames')?args.peopleNames:(task.peopleNames||oldDetails.peopleNames); const time=hasOwn(args,'time')?args.time:(task.time||oldDetails.time);
  const location=hasOwn(args,'location')?args.location:(task.location?.name||task.location?.address||oldDetails.location); const notes=hasOwn(args,'notes')?args.notes:oldDetails.extra.join('\n'); const details=formatDetails({time,peopleNames,location,notes});
  let personId=task.personId||''; if(hasOwn(args,'peopleNames')){const linked=details.people.find(n=>findNamedId(before.people||[],n))||'';personId=findNamedId(before.people||[],linked)}
  let spaceId=task.spaceId||''; if(hasOwn(args,'spaceName'))spaceId=findNamedId(before.spaces||[],args.spaceName||'');
  const due=hasOwn(args,'due')?(args.due?validDate(args.due):''):(task.due||''); const follow=hasOwn(args,'follow')?(args.follow?validDate(args.follow):''):(task.follow||'');
  const priority=hasOwn(args,'priority')&&['normal','important','strategic'].includes(args.priority)?args.priority:(task.priority||'normal'); const status=hasOwn(args,'status')&&['inbox','active','waiting'].includes(args.status)?args.status:(task.status||'inbox');
  coreSubmit({id:task.id,title:hasOwn(args,'title')?(String(args.title||'').trim()||task.title):task.title,notes:details.text,spaceId,personId,status,priority,due,follow,points:task.points||10});
  let recurrence=normalizeRecurrence(args,task.recurrence||null); const values={time:details.time,peopleNames:details.people,location:details.location?{...(task.location||{}),name:details.location,address:task.location?.address||details.location}:null,recurrence,calendarDirty:Boolean(due)};
  if(recurrence&&!task.recurrenceSeriesId){values.recurrenceSeriesId=task.id;values.recurrenceOccurrence=task.recurrenceOccurrence||1}
  const patched=patchExtended(task.id,values); if(!patched)return {ok:false,error:'task-update-not-confirmed'};
  if(!due&&task.calendarEventId){const state=readState();const current=(state.tasks||[]).find(x=>String(x.id)===String(task.id));state.calendarTombstones=[...new Set([...(state.calendarTombstones||[]),task.calendarEventId])];if(current){delete current.calendarEventId;current.calendarDirty=false}localStorage.setItem(DATA_KEY,JSON.stringify(state))}
  emitMutation({type:'update',taskId:task.id}); return {ok:true,task:taskView((readState().tasks||[]).find(x=>String(x.id)===String(task.id)),readState())};
}

async function deleteTask(args={}){
  const {state,task}=getTaskById(args.taskId); if(!task)return {ok:false,error:'task-not-found'};
  const button=document.getElementById('deleteTaskBtn'); if(!button||typeof button.onclick!=='function')return {ok:false,error:'delete-core-unavailable'};
  const idField=document.getElementById('taskId'); if(idField)idField.value=task.id; button.onclick();
  const after=readState(); const exists=(after.tasks||[]).some(x=>String(x.id)===String(task.id)); if(exists)return {ok:false,error:'task-delete-not-confirmed'};
  if(task.calendarEventId){after.calendarTombstones=[...new Set([...(after.calendarTombstones||[]),task.calendarEventId])];localStorage.setItem(DATA_KEY,JSON.stringify(after))}
  emitMutation({type:'delete',taskId:task.id,calendarEventId:task.calendarEventId||''}); return {ok:true,deletedId:task.id,title:task.title};
}

async function completeTask(args={}){
  const {task}=getTaskById(args.taskId); if(!task)return {ok:false,error:'task-not-found'}; if(task.status==='done')return {ok:true,alreadyDone:true,task:taskView(task,readState())};
  const trigger=document.createElement('button');trigger.type='button';trigger.hidden=true;trigger.dataset.done=task.id;document.body.appendChild(trigger);trigger.click();trigger.remove();
  await new Promise(r=>setTimeout(r,30)); const after=readState(); const done=(after.tasks||[]).find(x=>String(x.id)===String(task.id)); if(!done||done.status!=='done')return {ok:false,error:'task-complete-not-confirmed'};
  try{await window.MesraahRecurrence?.createNextIfNeeded?.(task.id)}catch(error){console.error('Mesraah recurrence:',error)}
  emitMutation({type:'complete',taskId:task.id}); return {ok:true,task:taskView(done,readState())};
}

export async function executeTaskTool(name,args={}){
  if(name==='search_tasks')return searchTasks(args); if(name==='add_task')return addTask(args); if(name==='update_task')return updateTask(args); if(name==='delete_task')return deleteTask(args); if(name==='complete_task')return completeTask(args); return {ok:false,error:'unknown-tool'};
}

window.MesraahTaskTools={execute:executeTaskTool,search:searchTasks};
