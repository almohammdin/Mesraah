(()=>{
  const DATA_KEY='mesraah_v030';
  const VIEWS=new Set(['today','calendar','inbox','spaces','people','followups','achievements','rewards','manage']);
  const FIELD_MAP={
    title:'taskTitle',notes:'taskNotes',date:'v11DueGregorian',due:'v11DueGregorian',time:'v11TaskTime',location:'v11LocationText',
    space:'taskSpace',person:'taskPerson',status:'taskStatus',priority:'taskPriority',follow:'taskFollow',points:'taskPoints'
  };
  const FIELD_LABELS={title:'المهمة',notes:'الملاحظات',date:'التاريخ',due:'التاريخ',time:'الوقت',location:'المكان',space:'المساحة',person:'الشخص',status:'الحالة',priority:'الأهمية',follow:'المتابعة',points:'النقاط'};

  function readState(){try{return JSON.parse(localStorage.getItem(DATA_KEY)||'{}')||{}}catch{return {}}}
  function normalize(value=''){return String(value).trim().toLowerCase().replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[ًٌٍَُِّْـ]/g,'').replace(/\s+/g,' ')}
  function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
  function dispatchValue(el,type='input'){el?.dispatchEvent(new Event(type,{bubbles:true}))}
  function activeView(){return document.querySelector('.view.active[data-view-panel]')?.dataset.viewPanel||document.querySelector('.nav-item.active[data-view]')?.dataset.view||'today'}
  function taskModal(){return document.getElementById('taskModal')}
  function closeTaskForNavigation(){
    const dialog=taskModal();
    if(!dialog?.hasAttribute('open'))return false;
    try{dialog.close('switch')}catch{dialog.removeAttribute('open')}
    return true;
  }
  function currentDraft(){
    const dialog=taskModal();
    if(!dialog?.hasAttribute('open'))return null;
    const value=id=>document.getElementById(id)?.value||'';
    const selectLabel=id=>{const el=document.getElementById(id);return el?.selectedOptions?.[0]?.textContent?.trim()||''};
    return {id:value('taskId'),title:value('taskTitle'),notes:value('taskNotes'),date:value('v11DueGregorian')||value('taskDue'),time:value('v11TaskTime'),location:value('v11LocationText'),spaceId:value('taskSpace'),space:selectLabel('taskSpace'),personId:value('taskPerson'),person:selectLabel('taskPerson'),status:value('taskStatus'),priority:value('taskPriority'),follow:value('taskFollow'),points:value('taskPoints')};
  }
  function getPlatformContext(){
    const state=readState();
    const now=new Date();
    const nowLabel=new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',{timeZone:'Asia/Riyadh',dateStyle:'full',timeStyle:'short'}).format(now);
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
    return {now:nowLabel,today,activeView:activeView(),taskDraft:currentDraft(),state,calendar:(window.MesraahCalendar?.getCachedEvents?.()||[]).slice(0,60)};
  }
  function injectStyles(){
    if(document.getElementById('mesraahAgentStyles0202'))return;
    document.getElementById('mesraahAgentStyles0200')?.remove();
    const style=document.createElement('style');style.id='mesraahAgentStyles0202';style.textContent=`
      .mesraah-agent-focus{position:relative!important;z-index:8!important;outline:3px solid rgba(38,185,172,.72)!important;outline-offset:3px!important;box-shadow:0 0 0 7px rgba(38,185,172,.13)!important;transition:outline-color .2s,box-shadow .2s!important}
      .nav-item.mesraah-agent-focus{transform:translateX(-2px)}
      .mesraah-agent-field-note{position:fixed;z-index:10120;max-width:min(360px,calc(100vw - 28px));padding:8px 11px;border-radius:11px;background:#0d3656;color:#fff;font-size:11px;line-height:1.5;box-shadow:0 12px 28px rgba(13,54,86,.22);pointer-events:none}
    `;document.head.appendChild(style);
  }
  function pulse(el,message=''){
    if(!el)return false;injectStyles();
    el.classList.add('mesraah-agent-focus');
    try{el.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'})}catch{}
    if(message){
      document.querySelector('.mesraah-agent-field-note')?.remove();
      const note=document.createElement('div');note.className='mesraah-agent-field-note';note.textContent=message;document.body.appendChild(note);
      requestAnimationFrame(()=>{const r=el.getBoundingClientRect(),n=note.getBoundingClientRect();note.style.left=`${Math.max(14,Math.min(innerWidth-n.width-14,r.left))}px`;note.style.top=`${Math.max(14,Math.min(innerHeight-n.height-14,r.bottom+8))}px`});
      setTimeout(()=>note.remove(),1800);
    }
    setTimeout(()=>el.classList.remove('mesraah-agent-focus'),1900);
    return true;
  }
  function directViewFallback(view){
    const panel=document.querySelector(`.view[data-view-panel="${view}"]`);if(!panel)return false;
    document.querySelectorAll('.view[data-view-panel]').forEach(item=>item.classList.toggle('active',item===panel));
    document.querySelectorAll('.nav-item[data-view]').forEach(item=>item.classList.toggle('active',item.dataset.view===view));
    document.body.classList.remove('sidebar-open');
    return true;
  }
  async function navigateToView(view,reason=''){
    if(!VIEWS.has(view))return {ok:false,error:'unknown-view'};
    const closedDraft=closeTaskForNavigation();
    if(closedDraft)await sleep(70);
    const button=document.querySelector(`.nav-item[data-view="${view}"]`)||document.querySelector(`[data-open-view="${view}"]`);
    if(button){pulse(button,reason||`أفتح ${button.textContent.trim()}`);button.click()}
    else if(!directViewFallback(view))return {ok:false,error:'view-control-not-found'};
    await sleep(180);
    const panel=document.querySelector(`.view[data-view-panel="${view}"]`);if(panel)pulse(panel.querySelector('h1,h2')||panel,'');
    return {ok:activeView()===view,view,closedDraft,persisted:false};
  }
  function byName(items,name){const wanted=normalize(name);if(!wanted)return null;return items.find(x=>normalize(x.name)===wanted)||items.find(x=>normalize(x.name).includes(wanted)||wanted.includes(normalize(x.name)))||null}
  async function openEntity(kind,{id='',name=''}={}){
    if(!['space','person'].includes(kind))return {ok:false,error:'unknown-entity-kind'};
    const state=readState(),items=kind==='space'?(state.spaces||[]):(state.people||[]),entity=(id?items.find(x=>String(x.id)===String(id)):null)||byName(items,name);
    if(!entity)return {ok:false,error:'entity-not-found'};
    await navigateToView(kind==='space'?'spaces':'people',`أفتح ${entity.name}`);await sleep(120);
    const button=document.querySelector(`[data-open-entity="${kind}"][data-entity-id="${CSS.escape(String(entity.id))}"]`);
    if(!button)return {ok:false,error:'entity-control-not-found',entity};
    pulse(button,`أفتح ${entity.name}`);button.click();await sleep(180);return {ok:true,kind,entity:{id:entity.id,name:entity.name},persisted:false};
  }
  function setCore(id,value){const el=document.getElementById(id);if(!el)return;el.value=value??'';dispatchValue(el,'input');dispatchValue(el,'change')}
  function resetTaskForm(){
    setCore('taskId','');setCore('taskTitle','');setCore('taskNotes','');setCore('taskSpace','');setCore('taskPerson','');setCore('taskStatus','inbox');setCore('taskPriority','normal');setCore('taskDue','');setCore('taskFollow','');setCore('taskPoints','10');
    setCore('v11DueGregorian','');setCore('v11TaskTime','');setCore('v11LocationText','');
    const title=document.getElementById('taskModalTitle');if(title)title.textContent='مهمة جديدة';const del=document.getElementById('deleteTaskBtn');if(del)del.hidden=true;
  }
  async function openNewTask(reason='مهمة جديدة'){
    resetTaskForm();const dialog=taskModal();if(!dialog)return {ok:false,error:'task-modal-not-found'};
    window.MesraahModalRuntime?.open?.('taskModal');if(!dialog.hasAttribute('open'))try{dialog.showModal()}catch{}
    await sleep(100);const title=document.getElementById('taskTitle');pulse(title,reason);try{title?.focus({preventScroll:true})}catch{}
    return {ok:dialog.hasAttribute('open'),mode:'new',persisted:false};
  }
  function taskByArgs({taskId='',query=''}={}){
    const state=readState(),tasks=state.tasks||[];if(taskId){const exact=tasks.find(t=>String(t.id)===String(taskId));if(exact)return exact}
    const wanted=normalize(query);if(!wanted)return null;return tasks.find(t=>normalize(t.title)===wanted)||tasks.find(t=>normalize([t.title,t.notes].join(' ')).includes(wanted))||null;
  }
  async function openTask(args={}){
    const task=taskByArgs(args);if(!task)return {ok:false,error:'task-not-found'};
    const state=readState();setCore('taskId',task.id);setCore('taskTitle',task.title||'');setCore('taskNotes',task.notes||'');setCore('taskSpace',task.spaceId||'');setCore('taskPerson',task.personId||'');setCore('taskStatus',task.status||'inbox');setCore('taskPriority',task.priority||'normal');setCore('taskDue',task.due||'');setCore('taskFollow',task.follow||'');setCore('taskPoints',String(task.points||10));
    const dialog=taskModal();if(!dialog)return {ok:false,error:'task-modal-not-found'};const h=document.getElementById('taskModalTitle');if(h)h.textContent='تعديل المهمة';const del=document.getElementById('deleteTaskBtn');if(del)del.hidden=false;
    window.MesraahModalRuntime?.open?.('taskModal');if(!dialog.hasAttribute('open'))try{dialog.showModal()}catch{};await sleep(160);
    pulse(document.getElementById('taskTitle'),`فتحت مهمة ${task.title}`);
    return {ok:true,task:{id:task.id,title:task.title,space:(state.spaces||[]).find(x=>x.id===task.spaceId)?.name||'',person:(state.people||[]).find(x=>x.id===task.personId)?.name||''},persisted:false};
  }
  function resolveField(field){const key=String(field||'').toLowerCase();const id=FIELD_MAP[key]||field;return {key,id,el:document.getElementById(id)}}
  function ensureFieldVisible(el){const details=el?.closest('details');if(details)details.open=true}
  async function focusTaskField(field,message=''){
    const {key,el}=resolveField(field);if(!el)return {ok:false,error:'field-not-found'};ensureFieldVisible(el);await sleep(40);pulse(el,message||`هذا حقل ${FIELD_LABELS[key]||field}`);try{el.focus({preventScroll:true})}catch{}return {ok:true,field:key||field,persisted:false};
  }
  function setSelectByText(el,value){
    const wanted=normalize(value);const option=[...el.options].find(o=>String(o.value)===String(value))||[...el.options].find(o=>normalize(o.textContent)===wanted)||[...el.options].find(o=>normalize(o.textContent).includes(wanted));
    if(!option)return false;el.value=option.value;return true;
  }
  async function setTaskField(field,value,{animate=true}={}){
    const dialog=taskModal();if(!dialog?.hasAttribute('open'))await openNewTask();
    const {key,el}=resolveField(field);if(!el)return {ok:false,error:'field-not-found'};ensureFieldVisible(el);
    let ok=true;
    if(el instanceof HTMLSelectElement)ok=setSelectByText(el,value);
    else el.value=value??'';
    if(!ok)return {ok:false,error:'option-not-found',field:key,value};
    dispatchValue(el,'input');dispatchValue(el,'change');
    if(key==='date'||key==='due'){const core=document.getElementById('taskDue');if(core)core.value=el.value}
    if(animate){await sleep(70);pulse(el,`${FIELD_LABELS[key]||field}: ${el instanceof HTMLSelectElement?(el.selectedOptions[0]?.textContent||''):el.value}`)}
    return {ok:true,field:key||field,value:el instanceof HTMLSelectElement?(el.selectedOptions[0]?.textContent||el.value):el.value,persisted:false};
  }
  async function fillTaskDraft(values={}){
    if(!taskModal()?.hasAttribute('open'))await openNewTask('أجهز المهمة');
    const order=['title','date','time','space','person','location','priority','status','follow','notes','points'];const applied=[];
    for(const field of order){if(values[field]===undefined||values[field]===null||values[field]==='')continue;const result=await setTaskField(field,values[field],{animate:true});applied.push({field,ok:result.ok,value:result.value||'',error:result.error||''});await sleep(90)}
    return {ok:applied.every(x=>x.ok),applied,draft:currentDraft(),persisted:false};
  }
  async function saveTask(confirmed=false){
    if(confirmed!==true)return {ok:false,error:'explicit-confirmation-required'};
    const dialog=taskModal(),form=document.getElementById('taskForm');if(!dialog?.hasAttribute('open')||!form)return {ok:false,error:'task-form-not-open'};
    const before=readState(),beforeIds=new Set((before.tasks||[]).map(t=>String(t.id))),existingId=document.getElementById('taskId')?.value||'',title=document.getElementById('taskTitle')?.value.trim()||'';
    if(!title)return {ok:false,error:'missing-title'};pulse(form.querySelector('button[type="submit"]')||form,`أحفظ ${title}`);
    try{form.requestSubmit()}catch(error){return {ok:false,error:String(error?.message||error)}}
    await sleep(260);const after=readState();let task=existingId?(after.tasks||[]).find(t=>String(t.id)===String(existingId)):null;if(!task)task=[...(after.tasks||[])].reverse().find(t=>!beforeIds.has(String(t.id))&&t.title===title);
    if(!task)return {ok:false,error:'task-save-not-confirmed'};
    let cloud={ok:true,mode:'local'};try{cloud=await window.MesraahCloudBridge?.saveNow?.()||cloud}catch(error){cloud={ok:false,error:String(error?.message||error)}}
    if(cloud?.ok===false)return {ok:false,error:'cloud-save-not-confirmed',taskId:task.id};
    return {ok:true,persisted:true,task:{id:task.id,title:task.title,due:task.due||'',time:task.time||'',status:task.status||'',priority:task.priority||''},mode:cloud.mode||'local'};
  }
  async function closeTask(){const dialog=taskModal();if(!dialog?.hasAttribute('open'))return {ok:true,persisted:false};try{dialog.close('cancel')}catch{dialog.removeAttribute('open')}return {ok:true,persisted:false}}

  injectStyles();
  window.MesraahAgentBridge={getPlatformContext,navigateToView,openEntity,openNewTask,openTask,focusTaskField,setTaskField,fillTaskDraft,saveTask,closeTask};
})();
