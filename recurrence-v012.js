const DATA_KEY='mesraah_v030';
const FREQ_LABELS={daily:'يومي',weekly:'أسبوعي',monthly:'شهري',yearly:'سنوي'};
const OPEN_SERIES_OCCURRENCES=90;
const MAX_SERIES_OCCURRENCES=999;
let pendingDelete=null;
let undoTimer=null;

function readState(){try{return JSON.parse(localStorage.getItem(DATA_KEY)||'{}')||{}}catch{return {}}}
function writeState(state){localStorage.setItem(DATA_KEY,JSON.stringify(state||{}))}
function validDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):''}
function newId(){return globalThis.crypto?.randomUUID?.()||`r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}

function recurrenceFromUi(){
  const freq=document.getElementById('v12RepeatFreq')?.value||'none';
  if(freq==='none')return null;
  const interval=Math.max(1,Math.min(99,Math.round(Number(document.getElementById('v12RepeatInterval')?.value)||1)));
  const end=document.getElementById('v12RepeatEnd')?.value||'never';
  const count=end==='count'?Math.max(2,Math.min(999,Math.round(Number(document.getElementById('v12RepeatCount')?.value)||2))):0;
  const until=end==='until'?validDate(document.getElementById('v12RepeatUntil')?.value):'';
  return {freq,interval,...(count?{count}:{}),...(!count&&until?{until}: {})};
}

function formatRecurrence(rec){
  if(!rec?.freq)return 'بدون تكرار';
  const base=FREQ_LABELS[rec.freq]||'متكرر';
  const interval=Number(rec.interval)||1;
  const every=interval>1?` · كل ${interval}`:'';
  const end=rec.count?` · ${rec.count} مرات`:rec.until?` · حتى ${rec.until}`:'';
  return `${base}${every}${end}`;
}

function updateEndFields(){
  const end=document.getElementById('v12RepeatEnd')?.value||'never';
  const count=document.getElementById('v12RepeatCountWrap');
  const until=document.getElementById('v12RepeatUntilWrap');
  if(count)count.hidden=end!=='count';
  if(until)until.hidden=end!=='until';
  updateSummary();
}
function updateSummary(){const el=document.getElementById('v12RepeatSummary');if(el)el.textContent=formatRecurrence(recurrenceFromUi())}

function installUi(){
  const form=document.getElementById('taskForm');
  const anchor=document.querySelector('.v11-primary-grid');
  if(!form||!anchor||document.getElementById('v12RecurrenceCard'))return;
  const card=document.createElement('section');
  card.id='v12RecurrenceCard';card.className='v12-recurrence-card';
  card.innerHTML=`
    <div class="v12-repeat-head"><strong>تكرار المهمة</strong><span id="v12RepeatSummary">بدون تكرار</span></div>
    <div class="v12-repeat-grid">
      <label><span>التكرار</span><select id="v12RepeatFreq"><option value="none">بدون تكرار</option><option value="daily">يومي</option><option value="weekly">أسبوعي</option><option value="monthly">شهري</option><option value="yearly">سنوي</option></select></label>
      <label><span>كل</span><input id="v12RepeatInterval" type="number" min="1" max="99" value="1" inputmode="numeric"></label>
      <label><span>النهاية</span><select id="v12RepeatEnd"><option value="never">بدون نهاية</option><option value="count">بعد عدد مرات</option><option value="until">حتى تاريخ</option></select></label>
      <label id="v12RepeatCountWrap" hidden><span>عدد المرات</span><input id="v12RepeatCount" type="number" min="2" max="999" value="5" inputmode="numeric"></label>
      <label id="v12RepeatUntilWrap" hidden><span>حتى</span><input id="v12RepeatUntil" type="date"></label>
    </div>`;
  anchor.insertAdjacentElement('afterend',card);
  ['v12RepeatFreq','v12RepeatInterval','v12RepeatEnd','v12RepeatCount','v12RepeatUntil'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{updateEndFields();updateSummary()}));
  document.getElementById('v12RepeatInterval')?.addEventListener('input',updateSummary);
}

function populateUi(){
  const id=document.getElementById('taskId')?.value||'';
  const task=id?(readState().tasks||[]).find(x=>String(x.id)===String(id)):null;
  const rec=task?.recurrence||null;
  const freq=document.getElementById('v12RepeatFreq');if(!freq)return;
  freq.value=rec?.freq||'none';document.getElementById('v12RepeatInterval').value=String(rec?.interval||1);
  const end=rec?.count?'count':rec?.until?'until':'never';document.getElementById('v12RepeatEnd').value=end;
  document.getElementById('v12RepeatCount').value=String(rec?.count||5);document.getElementById('v12RepeatUntil').value=rec?.until||'';
  updateEndFields();updateSummary();
}

function installDialogWatcher(){
  const dialog=document.getElementById('taskModal');if(!dialog||dialog.dataset.v12RepeatWatch)return;dialog.dataset.v12RepeatWatch='1';
  new MutationObserver(()=>{if(dialog.open)setTimeout(populateUi,0)}).observe(dialog,{attributes:true,attributeFilter:['open']});
}

function findSavedTask(before,idBefore,title){
  const state=readState();
  if(idBefore)return (state.tasks||[]).find(x=>String(x.id)===String(idBefore));
  const oldIds=new Set((before.tasks||[]).map(x=>String(x.id)));
  return [...(state.tasks||[])].reverse().find(x=>!oldIds.has(String(x.id))&&(!title||x.title===title));
}

function installSaveBridge(){
  const form=document.getElementById('taskForm');if(!form||form.dataset.v12RepeatSubmit)return;form.dataset.v12RepeatSubmit='1';
  form.addEventListener('submit',()=>{
    const before=readState();const idBefore=document.getElementById('taskId')?.value||'';const title=document.getElementById('taskTitle')?.value.trim()||'';const rec=recurrenceFromUi();
    setTimeout(()=>{
      const task=findSavedTask(before,idBefore,title);if(!task)return;const state=readState();const current=(state.tasks||[]).find(x=>String(x.id)===String(task.id));if(!current)return;
      if(rec){
        current.recurrence=rec;current.recurrenceSeriesId=current.recurrenceSeriesId||current.id;current.recurrenceOccurrence=current.recurrenceOccurrence||1;
        materializeSeries(state,current,rec);
      }else{delete current.recurrence;delete current.recurrenceSeriesId;delete current.recurrenceOccurrence}
      commitTasks(state.tasks);decorateTasks();
    },130);
  },true);
}

function addDate(iso,freq,interval){
  const [y,m,d]=iso.split('-').map(Number);if(!y||!m||!d)return '';
  if(freq==='daily'||freq==='weekly'){
    const date=new Date(Date.UTC(y,m-1,d,12));date.setUTCDate(date.getUTCDate()+(freq==='weekly'?7:1)*interval);return date.toISOString().slice(0,10);
  }
  if(freq==='monthly'){
    const total=y*12+(m-1)+interval;const ty=Math.floor(total/12),tm=total%12;const last=new Date(Date.UTC(ty,tm+1,0)).getUTCDate();return `${ty}-${String(tm+1).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`;
  }
  if(freq==='yearly'){
    const ty=y+interval;const last=new Date(Date.UTC(ty,m,0)).getUTCDate();return `${ty}-${String(m).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`;
  }
  return '';
}

function addDays(iso,days){
  const date=new Date(`${iso}T12:00:00Z`);if(Number.isNaN(date.getTime()))return '';
  date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);
}

function dayDistance(from,to){
  const a=new Date(`${from}T12:00:00Z`),b=new Date(`${to}T12:00:00Z`);
  if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime()))return 0;
  return Math.round((b-a)/86400000);
}

function commitTasks(tasks,fields={}){
  if(window.MesraahCore?.replaceTasks){window.MesraahCore.replaceTasks(tasks,fields);return}
  const state=readState();state.tasks=tasks;Object.assign(state,fields);writeState(state);
}

function cloneOccurrence(task,due,occurrence,seriesId,recurrence){
  const copy={...task,id:newId(),due,follow:task.follow&&task.due?addDays(due,dayDistance(task.due,task.follow)):(task.follow||''),status:task.status==='done'?'active':task.status,createdAt:new Date().toISOString(),recurrence:{...recurrence},recurrenceSeriesId:seriesId,recurrenceOccurrence:occurrence,calendarDirty:Boolean(due)};
  delete copy.completedAt;delete copy.calendarEventId;delete copy.calendarSyncedAt;delete copy.calendarEventUpdated;delete copy.calendarHtmlLink;
  return copy;
}

function materializeSeries(state,anchor,recurrence){
  if(!anchor?.due||!recurrence?.freq)return 0;
  const tasks=state.tasks||[];const seriesId=anchor.recurrenceSeriesId||anchor.id;const startOccurrence=Math.max(1,Number(anchor.recurrenceOccurrence)||1);
  anchor.recurrenceSeriesId=seriesId;anchor.recurrenceOccurrence=startOccurrence;
  const existing=new Map(tasks.filter(task=>String(task.recurrenceSeriesId||'')===String(seriesId)).map(task=>[Math.max(1,Number(task.recurrenceOccurrence)||1),task]));
  existing.set(startOccurrence,anchor);
  for(const task of existing.values())task.recurrence={...recurrence};
  const target=recurrence.count?Math.min(MAX_SERIES_OCCURRENCES,Number(recurrence.count)):recurrence.until?MAX_SERIES_OCCURRENCES:Math.min(MAX_SERIES_OCCURRENCES,Math.max(OPEN_SERIES_OCCURRENCES,startOccurrence+OPEN_SERIES_OCCURRENCES-1));
  let due=anchor.due,occurrence=startOccurrence,added=0;
  while(occurrence<target){
    const nextDue=addDate(due,recurrence.freq,Math.max(1,Number(recurrence.interval)||1));if(!nextDue)break;
    occurrence+=1;if(recurrence.until&&nextDue>recurrence.until)break;
    const current=existing.get(occurrence);
    if(current){current.recurrence={...recurrence};current.recurrenceSeriesId=seriesId;current.recurrenceOccurrence=occurrence}
    else{const created=cloneOccurrence(anchor,nextDue,occurrence,seriesId,recurrence);tasks.push(created);existing.set(occurrence,created);added+=1}
    due=nextDue;
  }
  return added;
}

function coreCreateFrom(task,nextDue,nextOccurrence,seriesId){
  const form=document.getElementById('taskForm');if(!form||typeof form.onsubmit!=='function')return null;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v??''};
  const before=readState();const oldIds=new Set((before.tasks||[]).map(x=>String(x.id)));
  set('taskId','');set('taskTitle',task.title||'مهمة متكررة');set('taskNotes',task.notes||'');set('taskSpace',task.spaceId||'');set('taskPerson',task.personId||'');set('taskStatus','active');set('taskPriority',task.priority||'normal');set('taskDue',nextDue);set('taskFollow','');set('taskPoints',String(task.points||10));
  form.onsubmit({preventDefault(){}});
  const after=readState();const created=[...(after.tasks||[])].reverse().find(x=>!oldIds.has(String(x.id))&&x.title===task.title);if(!created)return null;
  const current=(after.tasks||[]).find(x=>String(x.id)===String(created.id));
  Object.assign(current,{time:task.time||'',location:task.location?{...task.location}:undefined,peopleNames:Array.isArray(task.peopleNames)?[...task.peopleNames]:[],dateSource:task.dateSource||'gregorian',recurrence:{...task.recurrence},recurrenceSeriesId:seriesId,recurrenceOccurrence:nextOccurrence,calendarDirty:Boolean(nextDue)});
  delete current.calendarEventId;delete current.calendarSyncedAt;delete current.calendarEventUpdated;delete current.calendarHtmlLink;delete current.completedAt;
  writeState(after);return current;
}

async function createNextIfNeeded(taskId){
  const state=readState();const task=(state.tasks||[]).find(x=>String(x.id)===String(taskId));if(!task||task.status!=='done'||!task.recurrence?.freq||!task.due)return {ok:false,skipped:true};
  const rec=task.recurrence;const currentOcc=Math.max(1,Number(task.recurrenceOccurrence)||1);if(rec.count&&currentOcc>=Number(rec.count))return {ok:true,finished:true};
  const nextDue=addDate(task.due,rec.freq,Math.max(1,Number(rec.interval)||1));if(!nextDue)return {ok:false,error:'repeat-date-failed'};if(rec.until&&nextDue>rec.until)return {ok:true,finished:true};
  const seriesId=task.recurrenceSeriesId||task.id;const nextOcc=currentOcc+1;
  if((state.tasks||[]).some(x=>x.recurrenceSeriesId===seriesId&&Number(x.recurrenceOccurrence)===nextOcc))return {ok:true,duplicatePrevented:true};
  if(!task.recurrenceSeriesId){task.recurrenceSeriesId=seriesId;task.recurrenceOccurrence=currentOcc;writeState(state)}
  const next=coreCreateFrom(task,nextDue,nextOcc,seriesId);if(!next)return {ok:false,error:'repeat-create-failed'};
  window.dispatchEvent(new CustomEvent('mesraah:task-mutated',{detail:{type:'add',taskId:next.id}}));decorateTasks();return {ok:true,taskId:next.id,due:nextDue};
}

function decorateTasks(){
  const state=readState();const byId=new Map((state.tasks||[]).map(x=>[String(x.id),x]));
  document.querySelectorAll('.task-item[data-task]').forEach(item=>{
    const task=byId.get(String(item.dataset.task));let chip=item.querySelector('.v12-repeat-chip');
    if(!task?.recurrence){chip?.remove();return}
    if(!chip){chip=document.createElement('span');chip.className='v12-repeat-chip';(item.querySelector('.v11-task-extra')||item.querySelector('.task-meta'))?.appendChild(chip)}
    const label=`↻ ${formatRecurrence(task.recurrence)}`;
    if(chip.textContent!==label)chip.textContent=label;
  });
}

function installCompletionHook(){
  document.addEventListener('click',event=>{const done=event.target.closest('[data-done]');if(!done)return;const id=done.dataset.done;setTimeout(()=>void createNextIfNeeded(id),90)},true);
}

function ensureDeleteDialog(){
  let dialog=document.getElementById('v12DeleteDialog');if(dialog)return dialog;
  dialog=document.createElement('dialog');dialog.id='v12DeleteDialog';dialog.className='v12-delete-dialog';
  dialog.innerHTML=`<form method="dialog"><div class="v12-delete-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/></svg></div><h2 id="v12DeleteTitle">حذف المهمة</h2><p id="v12DeleteText"></p><div class="v12-delete-actions"><button type="button" class="v12-delete-one" id="v12DeleteOne">حذف هذه المهمة</button><button type="button" class="v12-delete-series" id="v12DeleteSeries">حذف السلسلة كاملة</button><button type="button" class="v12-delete-confirm" id="v12DeleteConfirm" hidden>تأكيد حذف السلسلة</button><button value="cancel" class="v12-delete-cancel">إلغاء</button></div></form>`;
  document.body.appendChild(dialog);
  dialog.querySelector('#v12DeleteOne').onclick=()=>performDelete('one');
  dialog.querySelector('#v12DeleteSeries').onclick=()=>showSeriesConfirmation();
  dialog.querySelector('#v12DeleteConfirm').onclick=()=>performDelete('series');
  dialog.addEventListener('close',()=>{pendingDelete=null;resetDeleteDialog()});
  return dialog;
}

function resetDeleteDialog(){
  const dialog=document.getElementById('v12DeleteDialog');if(!dialog)return;
  dialog.querySelector('#v12DeleteOne').hidden=false;dialog.querySelector('#v12DeleteSeries').hidden=false;dialog.querySelector('#v12DeleteConfirm').hidden=true;
}

function openDeleteDialog(task){
  const dialog=ensureDeleteDialog();pendingDelete=JSON.parse(JSON.stringify(task));resetDeleteDialog();
  const state=readState();const seriesId=task.recurrenceSeriesId||task.id;const series=(state.tasks||[]).filter(item=>String(item.recurrenceSeriesId||'')===String(seriesId));const repeated=Boolean(task.recurrence||series.length>1);
  dialog.querySelector('#v12DeleteTitle').textContent=repeated?'حذف مهمة متكررة':'حذف المهمة';
  dialog.querySelector('#v12DeleteText').textContent=repeated?`«${task.title||'المهمة'}» ضمن سلسلة فيها ${Math.max(1,series.length)} مهمة. اختر نطاق الحذف.`:`سيتم حذف «${task.title||'المهمة'}».`;
  dialog.querySelector('#v12DeleteOne').textContent=repeated?'حذف هذه المهمة فقط':'حذف المهمة';
  dialog.querySelector('#v12DeleteSeries').hidden=!repeated;
  if(!dialog.open)dialog.showModal();
}

function showSeriesConfirmation(){
  const dialog=document.getElementById('v12DeleteDialog');if(!dialog||!pendingDelete)return;
  const state=readState();const seriesId=pendingDelete.recurrenceSeriesId||pendingDelete.id;const count=(state.tasks||[]).filter(item=>String(item.recurrenceSeriesId||'')===String(seriesId)).length;
  dialog.querySelector('#v12DeleteTitle').textContent='تأكيد حذف السلسلة';
  dialog.querySelector('#v12DeleteText').textContent=`سيتم حذف ${Math.max(1,count)} مهمة مرتبطة بهذه السلسلة.`;
  dialog.querySelector('#v12DeleteOne').hidden=true;dialog.querySelector('#v12DeleteSeries').hidden=true;dialog.querySelector('#v12DeleteConfirm').hidden=false;
}

function showDeleteUndo(deleted){
  clearTimeout(undoTimer);document.querySelector('.v12-delete-undo')?.remove();
  const bar=document.createElement('div');bar.className='v11-undo v12-delete-undo';bar.innerHTML=`<span>${deleted.length>1?`حذفت ${deleted.length} مهمة`:`حذفت «${deleted[0]?.title||'المهمة'}»`}</span><button type="button">تراجع</button>`;document.body.appendChild(bar);
  bar.querySelector('button').onclick=()=>{
    const state=readState();const ids=new Set((state.tasks||[]).map(task=>String(task.id)));const restored=deleted.filter(task=>!ids.has(String(task.id))).map(task=>{const copy={...task};if(copy.calendarEventId){delete copy.calendarEventId;delete copy.calendarHtmlLink;delete copy.calendarSyncedAt;copy.calendarDirty=Boolean(copy.due)}return copy});
    const eventIds=new Set(deleted.map(task=>task.calendarEventId).filter(Boolean));const tombstones=(state.calendarTombstones||[]).filter(id=>!eventIds.has(id));commitTasks([...(state.tasks||[]),...restored],{calendarTombstones:tombstones});
    restored.forEach(task=>window.dispatchEvent(new CustomEvent('mesraah:task-mutated',{detail:{type:'add',taskId:task.id}})));bar.remove();window.MesraahCore?.toast?.(restored.length>1?'تمت استعادة السلسلة':'تمت استعادة المهمة');
  };
  undoTimer=setTimeout(()=>bar.remove(),6500);
}

function performDelete(scope){
  if(!pendingDelete)return;const state=readState();const seriesId=pendingDelete.recurrenceSeriesId||pendingDelete.id;
  const deleted=(state.tasks||[]).filter(task=>scope==='series'?String(task.recurrenceSeriesId||'')===String(seriesId):String(task.id)===String(pendingDelete.id));if(!deleted.length)return;
  const ids=new Set(deleted.map(task=>String(task.id)));const remaining=(state.tasks||[]).filter(task=>!ids.has(String(task.id)));const tombstones=[...new Set([...(state.calendarTombstones||[]),...deleted.map(task=>task.calendarEventId).filter(Boolean)])];
  commitTasks(remaining,{calendarTombstones:tombstones});document.getElementById('v12DeleteDialog')?.close();document.getElementById('taskModal')?.close();
  deleted.forEach(task=>window.dispatchEvent(new CustomEvent('mesraah:task-mutated',{detail:{type:'delete',taskId:task.id,calendarEventId:task.calendarEventId||''}})));
  window.MesraahCore?.toast?.(scope==='series'?'تم حذف السلسلة':'تم حذف المهمة');showDeleteUndo(deleted);
}

function installDeleteScope(){
  if(window.__MESRAAH_RECURRENCE_DELETE__)return;window.__MESRAAH_RECURRENCE_DELETE__=true;
  window.addEventListener('click',event=>{const button=event.target.closest?.('#deleteTaskBtn');if(!button)return;const id=document.getElementById('taskId')?.value||'';const task=(readState().tasks||[]).find(item=>String(item.id)===String(id));if(!task)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openDeleteDialog(task)},true);
}

function materializeExistingSeries(){
  const state=readState();const anchors=new Map();
  for(const task of state.tasks||[]){
    if(!task.recurrence?.freq||!task.due)continue;const seriesId=String(task.recurrenceSeriesId||task.id);const saved=anchors.get(seriesId);
    if(!saved||Math.max(1,Number(task.recurrenceOccurrence)||1)<Math.max(1,Number(saved.recurrenceOccurrence)||1))anchors.set(seriesId,task);
  }
  let added=0;for(const task of anchors.values())added+=materializeSeries(state,task,task.recurrence);
  if(added)commitTasks(state.tasks);
}

function observe(){['todayTaskList','inboxList','followupList'].forEach(id=>{const el=document.getElementById(id);if(el)new MutationObserver(decorateTasks).observe(el,{childList:true,subtree:true})})}
function boot(){installUi();installDialogWatcher();installSaveBridge();installCompletionHook();installDeleteScope();materializeExistingSeries();decorateTasks();observe()}
window.MesraahRecurrence={createNextIfNeeded,formatRecurrence,materializeSeries};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
