(()=>{
 const VERSION='0.15.3';
 function installStyles(){
  if(document.getElementById('v153QuickFixStyles'))return;
  const style=document.createElement('style');
  style.id='v153QuickFixStyles';
  style.textContent=`
   #v11VoiceCard.v14-assistant-home{grid-template-columns:minmax(0,1fr) minmax(220px,250px)!important;overflow:hidden!important}
   #v11VoiceCard.v14-assistant-home .v11-voice-action{min-width:0!important;width:100%!important;max-width:250px!important;box-sizing:border-box!important;justify-self:stretch!important;overflow:visible!important}
   #v11VoiceCard .v112-hub-orb{width:90px!important;height:90px!important;max-width:100%!important;margin:0 auto 12px!important;box-sizing:border-box!important}
   #v11VoiceCard .v112-hub-orb span{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;height:100%!important;line-height:1!important}
   #v11VoiceCard .v112-hub-primary{width:100%!important;box-sizing:border-box!important}
   @media(max-width:700px){#v11VoiceCard.v14-assistant-home{grid-template-columns:1fr!important;overflow:hidden!important}#v11VoiceCard.v14-assistant-home .v11-voice-action{max-width:none!important;width:100%!important}#v11VoiceCard .v112-hub-orb{width:82px!important;height:82px!important}}
  `;
  document.head.appendChild(style);
 }
 function installQuickCapture(){
  const form=document.getElementById('quickTaskForm');
  const input=document.getElementById('quickTaskInput');
  if(!form||!input||form.dataset.v153Ready)return;
  form.dataset.v153Ready='1';
  input.placeholder='أضف مهمة… مثال: اتصل بمحمد الأحد';
  input.setAttribute('aria-label','إضافة مهمة');
  form.addEventListener('submit',event=>{
   if(input.value.trim())return;
   event.preventDefault();
   event.stopImmediatePropagation();
   const trigger=document.getElementById('newTaskBtn')||document.querySelector('[data-add-task]');
   trigger?.click();
  },true);
 }
 function boot(){installStyles();installQuickCapture();document.documentElement.dataset.mesraahVersion=VERSION}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
