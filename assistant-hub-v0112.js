const HISTORY_KEY = 'mesraah_assistant_history_v1';
const DATA_KEY = 'mesraah_v030';
let chatBusy = false;

function escapeHtml(value = '') { return String(value).replace(/[&<>\"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[char])); }
function readState(){try{return JSON.parse(localStorage.getItem(DATA_KEY)||'{}')||{}}catch{return {}}}
function toast(message){const el=document.getElementById('toast');if(!el)return;el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2300)}
function recordHistory(userText,result){try{const current=JSON.parse(sessionStorage.getItem(HISTORY_KEY)||'[]');const history=Array.isArray(current)?current:[];history.push({role:'user',text:userText});history.push({role:'assistant',text:result?.reply||'',action:result?.action||null});sessionStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(-8)))}catch{}}
function timeout(ms=19000){return new Promise((_,reject)=>setTimeout(()=>{const error=new Error('assistant-timeout');error.code='assistant-timeout';reject(error)},ms))}
function setTaskField(id,value){const el=document.getElementById(id);if(el)el.value=value||''}

function nameById(list,id){return (list||[]).find(item=>String(item.id)===String(id))?.name||''}

async function prepareTaskAction(action,{submit=false}={}){
  setTaskField('taskId','');setTaskField('taskTitle',action.title||'');setTaskField('taskNotes',action.notes||'');setTaskField('taskSpace',action.spaceId||'');setTaskField('taskPerson',action.personId||'');setTaskField('taskStatus','inbox');setTaskField('taskPriority',action.priority||'normal');setTaskField('taskDue',action.date||'');setTaskField('taskFollow','');setTaskField('taskPoints','10');
  const title=document.getElementById('taskModalTitle');if(title)title.textContent='مهمة جديدة';const del=document.getElementById('deleteTaskBtn');if(del)del.hidden=true;
  const dialog=document.getElementById('taskModal');if(dialog&&!dialog.open)dialog.showModal();await new Promise(resolve=>setTimeout(resolve,35));
  const due=document.getElementById('v11DueGregorian');if(due){due.value=action.date||'';due.dispatchEvent(new Event('change',{bubbles:true}))}
  const time=document.getElementById('v11TaskTime');if(time)time.value=action.time||'';const location=document.getElementById('v11LocationText');if(location){location.value=action.location||'';location.dispatchEvent(new Event('input',{bubbles:true}))}
  if(submit)document.getElementById('taskForm')?.requestSubmit();
}

async function executeAction(action){
  if(!action||action.type==='none')return {ok:false};
  if(action.type==='connect_calendar'){
    await window.MesraahCalendar?.connect?.();
    return {ok:Boolean(window.MesraahCalendar?.status?.().connected),kind:'connect'};
  }
  if(action.type==='task'){
    const state=readState();
    const result=await window.MesraahTaskTools?.execute?.('add_task',{
      title:action.title,date:undefined,due:action.date||'',time:action.time||'',location:action.location||'',notes:action.notes||'',priority:action.priority||'normal',status:'inbox',
      spaceName:nameById(state.spaces,action.spaceId),peopleNames:nameById(state.people,action.personId)?[nameById(state.people,action.personId)]:[],
      repeat:action.repeat||'none',repeatInterval:action.repeatInterval||1,repeatCount:action.repeatCount||0,repeatUntil:action.repeatUntil||''
    });
    return {ok:Boolean(result?.ok),kind:'task',task:result?.task,error:result?.error};
  }
  if(action.type==='calendar'){
    if(!window.MesraahCalendar?.status?.().connected)await window.MesraahCalendar?.connect?.();
    const event=await window.MesraahCalendar?.createEvent?.({title:action.title,date:action.date,time:action.time,durationMinutes:action.durationMinutes,location:action.location,description:action.notes});
    return {ok:Boolean(event),kind:'calendar',event};
  }
  return {ok:false};
}

function appendMessage(role,html){const transcript=document.getElementById('v112ChatTranscript');if(!transcript)return null;const item=document.createElement('div');item.className=`v112-chat-message ${role}`;item.innerHTML=html;transcript.appendChild(item);transcript.scrollTop=transcript.scrollHeight;return item}
function thinkingMessage(){return appendMessage('assistant','<span class="v112-thinking"><i></i><i></i><i></i></span>')}
function actionLabel(action){if(action?.label)return action.label;if(action?.type==='calendar')return 'أضف الموعد';if(action?.type==='connect_calendar')return 'اربط التقويم';return 'أضف المهمة'}

function renderAssistantResult(result){
  const action=result?.action||{type:'none'};const hasAction=action.type!=='none'&&(action.title||action.type==='connect_calendar');const meta=[action.date,action.time,action.location].filter(Boolean).map(escapeHtml).join(' • ');
  const message=appendMessage('assistant',`<div class="v112-chat-answer">${escapeHtml(result?.reply||'تفضل.').replace(/\n/g,'<br>')}</div>${hasAction?`<div class="v112-chat-action"><div><strong>${escapeHtml(action.title||'ربط Google Calendar')}</strong>${meta?`<small>${meta}</small>`:''}</div><div class="v112-chat-action-buttons"><button type="button" data-v112-do>${escapeHtml(actionLabel(action))}</button>${action.type==='task'?'<button type="button" class="secondary" data-v112-edit>تعديل قبل الحفظ</button>':''}</div></div>`:''}`);
  message?.querySelector('[data-v112-do]')?.addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;const old=button.textContent;button.textContent='جار التنفيذ…';try{const done=await Promise.race([executeAction(action),timeout(5000)]);if(!done.ok)throw new Error(done.error||'assistant-action-failed');button.textContent=done.kind==='calendar'?'تمت الإضافة للتقويم':done.kind==='connect'?'تم الربط':'تمت الإضافة'}catch(error){console.error('Mesraah text action:',error);button.textContent='تعذر التنفيذ';button.disabled=false;setTimeout(()=>{if(!button.disabled)button.textContent=old},1800)}});
  message?.querySelector('[data-v112-edit]')?.addEventListener('click',()=>void prepareTaskAction(action,{submit:false}));
}

async function runChat(){
  const input=document.getElementById('v112ChatInput');const send=document.getElementById('v112ChatSend');if(!input||!send||chatBusy)return;const text=input.value.trim();if(!text)return;
  chatBusy=true;send.disabled=true;input.disabled=true;appendMessage('user',escapeHtml(text));input.value='';const thinking=thinkingMessage();
  try{
    const ask=window.MesraahAssistant?.ask;if(typeof ask!=='function')throw new Error('assistant-not-ready');
    const result=await Promise.race([ask(text),timeout(19000)]);thinking?.remove();if(!result)throw new Error('assistant-empty');
    if(result.confirmed&&['task','calendar','connect_calendar'].includes(result.action?.type)){
      try{const done=await Promise.race([executeAction(result.action),timeout(5000)]);if(done.ok){result.reply=`${result.reply||''}${done.kind==='calendar'?' وتمت إضافته للتقويم.':done.kind==='connect'?' وتم ربط التقويم.':' وتمت إضافته لمسراح.'}`.trim();result.action={type:'none'}}}catch(error){console.error('Mesraah confirmed text action:',error)}
    }
    renderAssistantResult(result);recordHistory(text,result);
  }catch(error){thinking?.remove();const timedOut=String(error?.code||error?.message||'').includes('assistant-timeout');appendMessage('assistant',`<div class="v112-chat-answer">${timedOut?'تأخر الاتصال بالذكاء هذه المرة. المحادثة ما زالت شغالة، أرسلها مرة ثانية.':'تعذر الرد الآن. جرب مرة ثانية.'}</div>`)}finally{chatBusy=false;send.disabled=false;input.disabled=false;input.focus()}
}

function installHub(){
  document.querySelector('.fly-card')?.classList.add('v112-hidden-fly');const card=document.getElementById('v11VoiceCard');if(!card||card.dataset.v112Hub)return;card.dataset.v112Hub='1';
  const copy=card.querySelector('.v11-voice-copy');const action=card.querySelector('.v11-voice-action');if(copy){copy.querySelector('.v11-voice-kicker')?.replaceChildren(document.createTextNode('مسراح معك'));const h2=copy.querySelector('h2');if(h2)h2.textContent='تحدث أو اكتب، ومسراح يرتبها معك';const p=copy.querySelector('p');if(p)p.textContent='محادثة واحدة لمهامك ومواعيدك ومتابعاتك، بالصوت أو الكتابة.';copy.querySelector('.v11-voice-examples')?.remove()}
  if(action)action.innerHTML='<div class="v112-hub-orb" aria-hidden="true"><span>✦</span></div><div class="v112-hub-buttons"><button type="button" class="v112-hub-primary" id="v112VoiceStart"><span>🎙</span><strong>محادثة صوتية</strong></button><button type="button" class="v112-hub-secondary" id="v112TextStart"><span>⌨</span><strong>محادثة كتابية</strong></button></div>';
  const chat=document.createElement('div');chat.id='v112TextChat';chat.className='v112-text-chat';chat.hidden=true;chat.innerHTML='<div class="v112-chat-head"><strong>محادثة كتابية مع مسراح</strong><button type="button" id="v112NewChat">محادثة جديدة</button></div><div class="v112-chat-transcript" id="v112ChatTranscript" aria-live="polite"><div class="v112-chat-message assistant"><div class="v112-chat-answer">اكتب لي بشكل طبيعي، مثلا: وش عندي بكرة؟ أو أضف اجتماع الأحد الساعة 10.</div></div></div><div class="v112-chat-compose"><input id="v112ChatInput" maxlength="300" autocomplete="off" placeholder="اكتب لمسراح…" aria-label="اكتب رسالتك لمسراح"><button type="button" id="v112ChatSend">إرسال</button></div>';card.appendChild(chat);
  document.getElementById('v112VoiceStart')?.addEventListener('click',()=>window.MesraahVoice?.start?.());document.getElementById('v112TextStart')?.addEventListener('click',()=>{chat.hidden=!chat.hidden;if(!chat.hidden)setTimeout(()=>document.getElementById('v112ChatInput')?.focus(),50)});document.getElementById('v112ChatSend')?.addEventListener('click',runChat);document.getElementById('v112ChatInput')?.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();void runChat()}});document.getElementById('v112NewChat')?.addEventListener('click',()=>{window.MesraahAssistant?.clearHistory?.();sessionStorage.removeItem(HISTORY_KEY);const transcript=document.getElementById('v112ChatTranscript');if(transcript)transcript.innerHTML='<div class="v112-chat-message assistant"><div class="v112-chat-answer">بدأنا من جديد. وش ودك تسوي؟</div></div>'});
}
function boot(){installHub();setTimeout(installHub,500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
