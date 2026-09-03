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
 function installStyles(){}
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
