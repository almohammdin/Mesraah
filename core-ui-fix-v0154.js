(()=>{
 const VERSION='0.15.4';
 function openBlankTask(){
  const form=document.getElementById('taskForm');
  const dialog=document.getElementById('taskModal');
  if(!form||!dialog)return false;
  form.reset();
  const set=(id,value='')=>{const el=document.getElementById(id);if(el)el.value=value};
  set('taskId');set('taskTitle');set('taskNotes');set('taskSpace');set('taskPerson');set('taskStatus','inbox');set('taskPriority','normal');set('taskDue');set('taskFollow');set('taskPoints','10');
  const title=document.getElementById('taskModalTitle');if(title)title.textContent='مهمة جديدة';
  const del=document.getElementById('deleteTaskBtn');if(del)del.hidden=true;
  if(!dialog.open)dialog.showModal();
  requestAnimationFrame(()=>document.getElementById('taskTitle')?.focus());
  return true;
 }
 function installQuickAdd(){
  const form=document.getElementById('quickTaskForm');
  const input=document.getElementById('quickTaskInput');
  const button=form?.querySelector('button[type="submit"]');
  if(!form||!input||!button||form.dataset.v154Ready)return;
  form.dataset.v154Ready='1';
  input.placeholder='أضف مهمة… مثال: اتصل بمحمد الأحد';
  input.setAttribute('aria-label','إضافة مهمة');
  button.addEventListener('click',event=>{
   if(input.value.trim())return;
   event.preventDefault();
   event.stopPropagation();
   event.stopImmediatePropagation();
   openBlankTask();
  },true);
  form.addEventListener('submit',event=>{
   if(input.value.trim())return;
   event.preventDefault();
   event.stopPropagation();
   event.stopImmediatePropagation();
   openBlankTask();
  },true);
 }
 function installVoiceBounds(){
  if(document.getElementById('v154VoiceBounds'))return;
  const style=document.createElement('style');style.id='v154VoiceBounds';style.textContent=`
  #v11VoiceCard.v14-assistant-home{overflow:hidden!important;box-sizing:border-box!important}
  #v11VoiceCard.v14-assistant-home .v11-voice-action{position:relative!important;inset:auto!important;transform:none!important;max-width:100%!important;box-sizing:border-box!important;padding:4px!important;overflow:hidden!important}
  #v11VoiceCard .v112-hub-orb{position:relative!important;inset:auto!important;transform:none!important;width:84px!important;height:84px!important;max-width:calc(100% - 12px)!important;margin:4px auto 10px!important;box-sizing:border-box!important;overflow:hidden!important}
  #v11VoiceCard .v112-hub-orb span{display:flex!important;width:100%!important;height:100%!important;align-items:center!important;justify-content:center!important;line-height:1!important}
  #v11VoiceCard .v112-hub-primary{max-width:100%!important;width:100%!important;box-sizing:border-box!important}
  @media(max-width:700px){#v11VoiceCard .v112-hub-orb{width:76px!important;height:76px!important}}
  `;document.head.appendChild(style);
 }
 function boot(){installVoiceBounds();installQuickAdd();document.documentElement.dataset.mesraahVersion=VERSION}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();