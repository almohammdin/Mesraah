(()=>{
  if(window.__MESRAAH_VOICE_BUTTON_BRIDGE_0202__)return;
  window.__MESRAAH_VOICE_BUTTON_BRIDGE_0202__=true;
  async function ensureVoice(){
    if(window.MesraahVoice?.mode==='gemini-live-agent-0202'&&window.MesraahVoice?.start)return window.MesraahVoice;
    if(!window.MesraahVoiceReady){
      window.MesraahVoiceReady=(async()=>{
        if(!window.MesraahAgentBridge)await import('./mesraah-agent-bridge-v0200.js?v=0.20.4');
        await import('./mesraah-live-appcheck-v0192.js?v=0.20.4');
        await import('./mesraah-live-v0202.js?v=0.20.4');
        await import('./mesraah-voice-wake.js?v=0.20.4');
        return window.MesraahVoice;
      })().catch(error=>{
        window.MesraahVoiceLoadError=error;
        return null;
      });
    }
    const voice=await window.MesraahVoiceReady;
    if(voice?.mode!=='gemini-live-agent-0202'||!voice?.start){
      throw window.MesraahVoiceLoadError||new Error('mesraah-live-agent-not-ready');
    }
    return voice;
  }

  function showInlineError(button,error){
    document.getElementById('voiceStartInlineError')?.remove();
    const note=document.createElement('div');
    note.id='voiceStartInlineError';
    note.style.cssText='grid-column:1/-1;margin-top:2px;padding:8px 10px;border-radius:11px;background:rgba(255,255,255,.12);color:#fff;font-size:.76rem;line-height:1.55;text-align:right';
    const detail=String(error?.message||error||'');
    note.textContent=detail?`تعذر تشغيل المساعد الصوتي: ${detail.slice(0,150)}`:'تعذر تشغيل المساعد الصوتي الآن.';
    (button.closest('.v14-inline-compose')||button.parentElement)?.appendChild(note);
  }

  document.addEventListener('click',async event=>{
    const button=event.target.closest?.('#v112VoiceStart');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(button.dataset.voiceLoading==='1')return;
    button.dataset.voiceLoading='1';
    button.setAttribute('aria-busy','true');
    document.getElementById('voiceStartInlineError')?.remove();
    try{
      const voice=await ensureVoice();
      await voice.start();
    }catch(error){
      console.error('Mesraah Agent Live button:',error);
      showInlineError(button,error);
    }finally{
      button.removeAttribute('aria-busy');
      button.dataset.voiceLoading='0';
    }
  },true);
})();
