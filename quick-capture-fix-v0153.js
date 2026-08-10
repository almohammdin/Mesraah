(()=>{
 const VERSION='0.15.3';
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
 function installStyles(){
  if(document.getElementById('v153QuickFixStyles'))return;
  const style=document.createElement('style');
  style.id='v153QuickFixStyles';
  style.textContent=`
   #v11VoiceCard.v14-assistant-home{grid-template-columns:minmax(0,1fr) minmax(220px,250px)!important;overflow:hidden!important}
   #v11VoiceCard.v14-assistant-home .v11-voice-action{position:relative!important;inset:auto!important;transform:none!important;min-width:0!important;width:100%!important;max-width:250px!important;box-sizing:border-box!important;justify-self:stretch!important;overflow:hidden!important;padding:4px!important}
   #v11VoiceCard .v112-hub-orb{position:relative!important;inset:auto!important;transform:none!important;width:84px!important;height:84px!important;max-width:calc(100% - 12px)!important;margin:4px auto 10px!important;box-sizing:border-box!important;overflow:hidden!important}
   #v11VoiceCard .v112-hub-orb span{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;height:100%!important;line-height:1!important}
   #v11VoiceCard .v112-hub-primary{width:100%!important;max-width:100%!important;box-sizing:border-box!important}
   @media(max-width:700px){#v11VoiceCard.v14-assistant-home{grid-template-columns:1fr!important;overflow:hidden!important}#v11VoiceCard.v14-assistant-home .v11-voice-action{max-width:none!important;width:100%!important}#v11VoiceCard .v112-hub-orb{width:76px!important;height:76px!important}}
  `;
  document.head.appendChild(style);
 }
 function installQuickCapture(){
  const form=document.getElementById('quickTaskForm');
  const input=document.getElementById('quickTaskInput');
  const button=form?.querySelector('button[type="submit"]');
  if(!form||!input||!button||form.dataset.v153Ready)return;
  form.dataset.v153Ready='1';
  input.placeholder='أضف مهمة… مثال: اتصل بمحمد الأحد';
  input.setAttribute('aria-label','إضافة مهمة');
  const emptyAction=event=>{
   if(input.value.trim())return;
   event.preventDefault();
   event.stopPropagation();
   event.stopImmediatePropagation();
   openBlankTask();
  };
  button.addEventListener('click',emptyAction,true);
  form.addEventListener('submit',emptyAction,true);
 }
 function boot(){installStyles();installQuickCapture();document.documentElement.dataset.mesraahVersion=VERSION}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
