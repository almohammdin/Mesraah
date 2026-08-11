(()=>{
  if(window.__MESRAAH_VOICE_BUTTON_BRIDGE_0183__) return;
  window.__MESRAAH_VOICE_BUTTON_BRIDGE_0183__=true;
  let loading=false;
  async function ensureVoice(){
    if(window.MesraahVoice?.start) return window.MesraahVoice;
    if(loading){
      for(let i=0;i<40;i++){
        await new Promise(r=>setTimeout(r,100));
        if(window.MesraahVoice?.start) return window.MesraahVoice;
      }
      throw new Error('voice-engine-load-timeout');
    }
    loading=true;
    try{
      await import('./mesraah-voice-appcheck.js?v=0.18.3');
      await import('./mesraah-voice-config.js?v=0.18.3');
      await import('./mesraah-voice-v0182.js?v=0.18.3');
      if(!window.MesraahVoice?.start) throw new Error('voice-engine-not-ready');
      return window.MesraahVoice;
    }finally{loading=false}
  }
  document.addEventListener('click',async event=>{
    const button=event.target.closest?.('#v112VoiceStart');
    if(!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(button.dataset.voiceLoading==='1') return;
    button.dataset.voiceLoading='1';
    button.setAttribute('aria-busy','true');
    const original=button.innerHTML;
    button.innerHTML='<strong>أجهز المحادثة الصوتية…</strong>';
    try{
      const voice=await ensureVoice();
      button.innerHTML=original;
      button.removeAttribute('aria-busy');
      button.dataset.voiceLoading='0';
      await voice.start();
    }catch(error){
      console.error('Mesraah voice button:',error);
      button.innerHTML=original;
      button.removeAttribute('aria-busy');
      button.dataset.voiceLoading='0';
      alert('تعذر تشغيل المساعد الصوتي الآن. أعد المحاولة بعد تحديث الصفحة.');
    }
  },true);
})();