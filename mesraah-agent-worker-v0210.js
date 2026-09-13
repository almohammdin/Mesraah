const DATA_KEY='mesraah_v030';
const AGENT_VERSION=1;
const SCHEDULE_CHECK_MS=60*1000;
const MAX_INBOX_ITEMS=80;
const MAX_LOG_ITEMS=50;

const DEFAULT_SETTINGS={enabled:true,dueToday:true,dueTomorrow:true,overdue:true,followups:true,missingDetails:true};
const DEFAULT_SCHEDULE={timeZone:'Asia/Riyadh',workDays:[0,1,2,3,4],workStart:8,workEnd:17,quietStart:22,quietEnd:6,offHoursInterval:3};

function uid(){return globalThis.crypto?.randomUUID?.()||`agent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}
function escapeHtml(value=''){return String(value).replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]))}
function readState(){try{return JSON.parse(localStorage.getItem(DATA_KEY)||'{}')||{}}catch{return {}}}
function dayKey(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}
function addDays(dateText,amount){const date=new Date(`${dateText}T12:00:00+03:00`);date.setUTCDate(date.getUTCDate()+amount);return dayKey(date)}
function formatDateTime(value){const date=new Date(value);if(Number.isNaN(date.getTime()))return '';return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',{timeZone:'Asia/Riyadh',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(date)}
function normalizeAgent(agent={}){return {version:AGENT_VERSION,enabled:agent.enabled!==false,settings:{...DEFAULT_SETTINGS,...(agent.settings||{})},schedule:{...DEFAULT_SCHEDULE,...(agent.schedule||{})},inbox:Array.isArray(agent.inbox)?agent.inbox:[],log:Array.isArray(agent.log)?agent.log:[],dismissedKeys:Array.isArray(agent.dismissedKeys)?agent.dismissedKeys:[],lastRunAt:agent.lastRunAt||'',lastRunReason:agent.lastRunReason||'',lastResult:agent.lastResult||null,lastScheduleSlot:agent.lastScheduleSlot||''}}

function riyadhClock(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',hourCycle:'h23'}).formatToParts(date).reduce((out,part)=>{if(part.type!=='literal')out[part.type]=part.value;return out},{});
  const weekday={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[parts.weekday];
  return {date:`${parts.year}-${parts.month}-${parts.day}`,hour:Number(parts.hour),weekday};
}
export function scheduleSlot(date=new Date(),customSchedule={}){
  const schedule={...DEFAULT_SCHEDULE,...customSchedule},clock=riyadhClock(date),hour=clock.hour;
  if(hour>=schedule.quietStart||hour<schedule.quietEnd)return '';
  const workday=schedule.workDays.includes(clock.weekday);
  if(workday&&hour>=schedule.workStart&&hour<schedule.workEnd)return `${clock.date}:work:${String(hour).padStart(2,'0')}`;
  const anchor=workday&&hour>=schedule.workEnd?schedule.workEnd:schedule.quietEnd;
  const slotHour=anchor+Math.floor((hour-anchor)/schedule.offHoursInterval)*schedule.offHoursInterval;
  return `${clock.date}:${workday?'off':'weekend'}:${String(slotHour).padStart(2,'0')}`;
}
function taskName(task){return String(task?.title||'مهمة بلا عنوان').trim()||'مهمة بلا عنوان'}
function isRealOpenTask(task){return task&&!task.demo&&task.status!=='done'}
function finding({rule,task,date,severity,title,message,actionLabel='فتح المهمة'}){const taskId=String(task?.id||'');return {key:`${date}:${rule}:${taskId||'summary'}`,rule,taskId,severity,title,message,actionLabel,createdAt:new Date().toISOString(),status:'new'}}

export function analyzeMesraahTasks(state={},options={}){
  const date=options.today||dayKey(),tomorrow=addDays(date,1),agent=normalizeAgent(state.agent),settings={...agent.settings,...(options.settings||{})};
  const tasks=(Array.isArray(state.tasks)?state.tasks:[]).filter(isRealOpenTask),findings=[];
  for(const task of tasks){
    const title=taskName(task);
    if(settings.overdue&&task.due&&task.due<date)findings.push(finding({rule:'overdue',task,date,severity:'urgent',title:'مهمة متأخرة',message:`«${title}» تجاوزت موعدها ${task.due}. تحتاج قرارا: إنجاز، إعادة جدولة أو إلغاء.`}));
    else if(settings.dueToday&&task.due===date)findings.push(finding({rule:'due_today',task,date,severity:'high',title:'موعدها اليوم',message:`«${title}» مستحقة اليوم.`}));
    else if(settings.dueTomorrow&&task.due===tomorrow)findings.push(finding({rule:'due_tomorrow',task,date,severity:'medium',title:'موعدها غدا',message:`«${title}» موعدها غدا. راجع جاهزيتها اليوم.`}));

    if(settings.followups&&task.follow&&task.follow<=date)findings.push(finding({rule:'follow_due',task,date,severity:task.follow<date?'high':'medium',title:'متابعة مستحقة',message:`حان وقت متابعة «${title}»${task.follow<date?` منذ ${task.follow}`:' اليوم'}.`}));
    else if(settings.followups&&task.status==='waiting'&&!task.follow)findings.push(finding({rule:'waiting_without_follow',task,date,severity:'medium',title:'انتظار بلا موعد متابعة',message:`«${title}» بانتظار الآخرين ولا يوجد لها موعد متابعة.`}));

    if(settings.missingDetails&&['important','strategic'].includes(task.priority)&&!task.due)findings.push(finding({rule:'important_without_due',task,date,severity:'medium',title:'مهمة مهمة بلا موعد',message:`«${title}» مصنفة ${task.priority==='strategic'?'استراتيجية':'مهمة'} ولا يوجد لها موعد إنجاز.`}));
  }
  const rank={urgent:0,high:1,medium:2,low:3};
  findings.sort((a,b)=>(rank[a.severity]??9)-(rank[b.severity]??9)||a.title.localeCompare(b.title,'ar'));
  return findings;
}

function writeAgent(nextAgent,{emit=true}={}){const state=readState();state.agent=nextAgent;localStorage.setItem(DATA_KEY,JSON.stringify(state));if(emit)window.dispatchEvent(new CustomEvent('mesraah:agent-updated',{detail:{agent:nextAgent}}));return nextAgent}
function showToast(message){window.MesraahCore?.toast?.(message)}

export function runAgent({reason='scheduled',force=false,slot=''}={}){
  const state=readState(),agent=normalizeAgent(state.agent);
  if(!agent.enabled&&!force)return {ok:false,skipped:true,reason:'disabled',agent};
  if(slot&&agent.lastScheduleSlot===slot)return {ok:false,skipped:true,reason:'schedule-slot-complete',agent};
  const candidates=analyzeMesraahTasks(state,{settings:agent.settings}),known=new Set(agent.inbox.map(item=>item.key)),dismissed=new Set(agent.dismissedKeys);
  const added=candidates.filter(item=>!known.has(item.key)&&!dismissed.has(item.key)).map(item=>({...item,id:uid()}));
  const now=new Date().toISOString(),openTasks=(state.tasks||[]).filter(isRealOpenTask),today=dayKey();
  const result={found:candidates.length,added:added.length,overdue:openTasks.filter(task=>task.due&&task.due<today).length,followups:openTasks.filter(task=>task.follow&&task.follow<=today).length};
  const nextAgent={...agent,inbox:[...added,...agent.inbox].slice(0,MAX_INBOX_ITEMS),log:[{id:uid(),at:now,reason,result},...agent.log].slice(0,MAX_LOG_ITEMS),lastRunAt:now,lastRunReason:reason,lastResult:result,lastScheduleSlot:slot||agent.lastScheduleSlot};
  writeAgent(nextAgent);renderAgent();return {ok:true,agent:nextAgent,result};
}

function updateAgent(mutator){const next=mutator(normalizeAgent(readState().agent));writeAgent(next);renderAgent();return next}
function runScheduledIfDue(){const agent=normalizeAgent(readState().agent),slot=scheduleSlot(new Date(),agent.schedule);if(!slot)return {ok:false,skipped:true,reason:'quiet-hours'};return runAgent({reason:'schedule',slot})}
function setEnabled(enabled){const next=updateAgent(agent=>({...agent,enabled:Boolean(enabled)}));if(next.enabled){runScheduledIfDue();showToast('بدأ وكيل مسراح المتابعة')}else showToast('تم إيقاف وكيل مسراح')}
function setRule(rule,enabled){updateAgent(agent=>({...agent,settings:{...agent.settings,[rule]:Boolean(enabled)}}));if(enabled)runScheduledIfDue()}
function dismissItem(id){updateAgent(agent=>{const target=agent.inbox.find(item=>item.id===id);return {...agent,inbox:agent.inbox.filter(item=>item.id!==id),dismissedKeys:target?[...new Set([...agent.dismissedKeys,target.key])].slice(-250):agent.dismissedKeys}})}
function markAllRead(){updateAgent(agent=>({...agent,inbox:agent.inbox.map(item=>({...item,status:'read',readAt:item.readAt||new Date().toISOString()}))}))}
async function openTask(taskId){if(!taskId)return;const result=await window.MesraahAgentBridge?.openTask?.({taskId});if(!result?.ok)showToast('تعذر فتح المهمة')}

function renderFinding(item){const tone={urgent:'عاجل',high:'مهم',medium:'انتبه',low:'معلومة'}[item.severity]||'تنبيه';return `<article class="agent-finding is-${escapeHtml(item.severity)} ${item.status==='read'?'is-read':''}"><div class="agent-finding-mark" aria-hidden="true"></div><div class="agent-finding-copy"><div class="agent-finding-meta"><span>${tone}</span><time>${escapeHtml(formatDateTime(item.createdAt))}</time></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.message)}</p></div><div class="agent-finding-actions">${item.taskId?`<button type="button" data-agent-open-task="${escapeHtml(item.taskId)}">${escapeHtml(item.actionLabel||'فتح المهمة')}</button>`:''}<button type="button" class="is-quiet" data-agent-dismiss="${escapeHtml(item.id)}">تجاهل</button></div></article>`}
function renderAgent(){
  const agent=normalizeAgent(readState().agent),unread=agent.inbox.filter(item=>item.status!=='read').length;
  const navCount=document.getElementById('agentNavCount');if(navCount){navCount.textContent=String(unread);navCount.hidden=unread===0}
  const status=document.getElementById('agentStatus');if(status){status.textContent=agent.enabled?'يعمل':'متوقف';status.classList.toggle('is-on',agent.enabled)}
  const toggle=document.getElementById('agentEnabled');if(toggle)toggle.checked=agent.enabled;
  const last=document.getElementById('agentLastRun');if(last)last.textContent=agent.lastRunAt?`آخر مراجعة ${formatDateTime(agent.lastRunAt)}`:'لم يبدأ بعد';
  const summary=document.getElementById('agentRunSummary');if(summary){const r=agent.lastResult||{};summary.innerHTML=`<article><small>اكتشف</small><strong>${Number(r.found)||0}</strong></article><article><small>جديد</small><strong>${Number(r.added)||0}</strong></article><article><small>متأخر</small><strong>${Number(r.overdue)||0}</strong></article><article><small>متابعة</small><strong>${Number(r.followups)||0}</strong></article>`}
  const list=document.getElementById('agentInboxList');if(list)list.innerHTML=agent.inbox.length?agent.inbox.map(renderFinding).join(''):'<div class="agent-empty"><span>✓</span><h3>لا يوجد شيء يحتاج تدخلك الآن</h3><p>سيواصل الوكيل مراجعة المهام والمتابعات.</p></div>';
  for(const [rule,value] of Object.entries(agent.settings)){const input=document.querySelector(`[data-agent-rule="${rule}"]`);if(input)input.checked=Boolean(value)}
}
function bindUi(){
  document.getElementById('agentEnabled')?.addEventListener('change',event=>setEnabled(event.target.checked));
  document.getElementById('agentRunNow')?.addEventListener('click',()=>{const output=runAgent({reason:'manual',force:true});showToast(output.result?.added?`وجد الوكيل ${output.result.added} تنبيه جديد`:'اكتملت المراجعة')});
  document.getElementById('agentMarkRead')?.addEventListener('click',markAllRead);
  document.querySelectorAll('[data-agent-rule]').forEach(input=>input.addEventListener('change',event=>setRule(event.target.dataset.agentRule,event.target.checked)));
  document.addEventListener('click',event=>{const open=event.target.closest('[data-agent-open-task]');if(open){void openTask(open.dataset.agentOpenTask);return}const dismiss=event.target.closest('[data-agent-dismiss]');if(dismiss)dismissItem(dismiss.dataset.agentDismiss)});
}
function boot(){
  bindUi();renderAgent();setTimeout(runScheduledIfDue,900);setInterval(runScheduledIfDue,SCHEDULE_CHECK_MS);
  let mutationTimer=0;const scheduleMutationRun=()=>{clearTimeout(mutationTimer);mutationTimer=setTimeout(runScheduledIfDue,700)};window.addEventListener('mesraah:task-mutated',scheduleMutationRun);window.addEventListener('mesraah:data-changed',scheduleMutationRun);
  window.addEventListener('storage',event=>{if(event.key===DATA_KEY)renderAgent()});window.addEventListener('mesraah:agent-updated',renderAgent);
}
if(typeof window!=='undefined'){window.MesraahAgentWorker={runNow:options=>runAgent({reason:'manual',force:true,...options}),render:renderAgent,setEnabled};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot()}
