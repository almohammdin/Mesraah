const crypto=require('node:crypto');

const DEFAULT_SETTINGS={dueToday:true,dueTomorrow:true,overdue:true,followups:true,missingDetails:true};
const MAX_INBOX_ITEMS=80;
const MAX_LOG_ITEMS=50;

function dayKey(date=new Date()){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
function addDays(dateText,amount){
  const date=new Date(`${dateText}T12:00:00+03:00`);
  date.setUTCDate(date.getUTCDate()+amount);
  return dayKey(date);
}
function isRealOpenTask(task){return task&&!task.demo&&task.status!=='done'}
function taskName(task){return String(task?.title||'مهمة بلا عنوان').trim()||'مهمة بلا عنوان'}
function finding({rule,task,date,severity,title,message}){
  const taskId=String(task?.id||'');
  return {key:`${date}:${rule}:${taskId||'summary'}`,rule,taskId,severity,title,message,actionLabel:'فتح المهمة',createdAt:new Date().toISOString(),status:'new'};
}

function analyzeTasks(state={},today=dayKey()){
  const tomorrow=addDays(today,1);
  const settings={...DEFAULT_SETTINGS,...(state.agent?.settings||{})};
  const tasks=(Array.isArray(state.tasks)?state.tasks:[]).filter(isRealOpenTask);
  const findings=[];
  for(const task of tasks){
    const title=taskName(task);
    if(settings.overdue&&task.due&&task.due<today)findings.push(finding({rule:'overdue',task,date:today,severity:'urgent',title:'مهمة متأخرة',message:`«${title}» تجاوزت موعدها ${task.due}. تحتاج قرارا: إنجاز، إعادة جدولة أو إلغاء.`}));
    else if(settings.dueToday&&task.due===today)findings.push(finding({rule:'due_today',task,date:today,severity:'high',title:'موعدها اليوم',message:`«${title}» مستحقة اليوم.`}));
    else if(settings.dueTomorrow&&task.due===tomorrow)findings.push(finding({rule:'due_tomorrow',task,date:today,severity:'medium',title:'موعدها غدا',message:`«${title}» موعدها غدا. راجع جاهزيتها اليوم.`}));

    if(settings.followups&&task.follow&&task.follow<=today)findings.push(finding({rule:'follow_due',task,date:today,severity:task.follow<today?'high':'medium',title:'متابعة مستحقة',message:`حان وقت متابعة «${title}»${task.follow<today?` منذ ${task.follow}`:' اليوم'}.`}));
    else if(settings.followups&&task.status==='waiting'&&!task.follow)findings.push(finding({rule:'waiting_without_follow',task,date:today,severity:'medium',title:'انتظار بلا موعد متابعة',message:`«${title}» بانتظار الآخرين ولا يوجد لها موعد متابعة.`}));

    if(settings.missingDetails&&['important','strategic'].includes(task.priority)&&!task.due)findings.push(finding({rule:'important_without_due',task,date:today,severity:'medium',title:'مهمة مهمة بلا موعد',message:`«${title}» مصنفة ${task.priority==='strategic'?'استراتيجية':'مهمة'} ولا يوجد لها موعد إنجاز.`}));
  }
  const rank={urgent:0,high:1,medium:2,low:3};
  return findings.sort((a,b)=>(rank[a.severity]??9)-(rank[b.severity]??9)||a.title.localeCompare(b.title,'ar'));
}

function runPolicy(state={},reason='cloud-schedule',now=new Date()){
  const agent=state.agent&&typeof state.agent==='object'?state.agent:{};
  if(agent.enabled!==true)return {skipped:true,reason:'disabled-or-not-activated'};
  const inbox=Array.isArray(agent.inbox)?agent.inbox:[];
  const log=Array.isArray(agent.log)?agent.log:[];
  const dismissedKeys=Array.isArray(agent.dismissedKeys)?agent.dismissedKeys:[];
  const candidates=analyzeTasks(state,dayKey(now));
  const known=new Set(inbox.map(item=>item.key));
  const dismissed=new Set(dismissedKeys);
  const added=candidates.filter(item=>!known.has(item.key)&&!dismissed.has(item.key)).map(item=>({...item,id:crypto.randomUUID()}));
  const tasks=(state.tasks||[]).filter(isRealOpenTask),today=dayKey(now),at=now.toISOString();
  const result={found:candidates.length,added:added.length,overdue:tasks.filter(task=>task.due&&task.due<today).length,followups:tasks.filter(task=>task.follow&&task.follow<=today).length};
  return {skipped:false,agent:{...agent,version:1,enabled:true,settings:{...DEFAULT_SETTINGS,...(agent.settings||{})},inbox:[...added,...inbox].slice(0,MAX_INBOX_ITEMS),log:[{id:crypto.randomUUID(),at,reason,result},...log].slice(0,MAX_LOG_ITEMS),dismissedKeys,lastRunAt:at,lastRunReason:reason,lastResult:result},result};
}

module.exports={analyzeTasks,runPolicy,dayKey};
