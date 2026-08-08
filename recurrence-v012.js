const DATA_KEY='mesraah_v030';
const FREQ_LABELS={daily:'يومي',weekly:'أسبوعي',monthly:'شهري',yearly:'سنوي'};

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
      if(rec){current.recurrence=rec;current.recurrenceSeriesId=current.recurrenceSeriesId||current.id;current.recurrenceOccurrence=current.recurrenceOccurrence||1}else{delete current.recurrence;delete current.recurrenceSeriesId;delete current.recurrenceOccurrence}
      writeState(state);decorateTasks();
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

function observe(){['todayTaskList','inboxList','followupList'].forEach(id=>{const el=document.getElementById(id);if(el)new MutationObserver(decorateTasks).observe(el,{childList:true,subtree:true})})}
function boot(){installUi();installDialogWatcher();installSaveBridge();installCompletionHook();decorateTasks();observe()}
window.MesraahRecurrence={createNextIfNeeded,formatRecurrence};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
