(()=>{
  if(window.__MESRAAH_VOICE_BUTTON_BRIDGE_0192__)return;
  window.__MESRAAH_VOICE_BUTTON_BRIDGE_0192__=true;
  const style=document.createElement('style');
  style.id='mesraahVoiceCta0192';
  style.textContent=`#v11VoiceCard.v14-assistant-home .v11-voice-action{display:grid!important;grid-template-columns:104px minmax(0,1fr)!important;grid-template-rows:1fr!important;gap:16px!important;align-items:center!important;width:100%!important;max-width:390px!important;min-width:0!important;margin:0!important;padding:16px!important;border-radius:24px!important;background:linear-gradient(155deg,rgba(255,255,255,.16),rgba(255,255,255,.08))!important;border:1px solid rgba(255,255,255,.20)!important;box-sizing:border-box!important}#v11VoiceCard.v14-assistant-home .v112-hub-orb{display:block!important;grid-column:1!important;grid-row:1!important;width:104px!important;height:104px!important;min-width:104px!important;min-height:104px!important;margin:0!important;border-radius:28px!important;background:#fff url('./voice-assistant-mark.svg?v=0.18.5') center/88px 88px no-repeat!important;border:1px solid rgba(255,255,255,.38)!important;box-shadow:0 12px 30px rgba(0,0,0,.16)!important}#v11VoiceCard.v14-assistant-home .v112-hub-orb span{display:none!important}#v11VoiceCard.v14-assistant-home .v112-hub-buttons{grid-column:2!important;grid-row:1!important;display:grid!important;grid-template-columns:1fr!important;gap:9px!important;width:100%!important;min-width:0!important}#v11VoiceCard.v14-assistant-home .v112-hub-primary{min-height:72px!important;padding:12px 16px!important;display:grid!important;grid-template-columns:1fr!important;gap:3px!important;text-align:right!important;justify-items:start!important;align-content:center!important;border-radius:16px!important;background:#fff!important;color:#0d3656!important;border:0!important;box-shadow:0 7px 18px rgba(0,0,0,.12)!important}#v11VoiceCard.v14-assistant-home .v112-hub-primary>span{display:none!important}#v11VoiceCard.v14-assistant-home .v112-hub-primary strong{font-size:0!important;white-space:normal!important;color:#0d3656!important}#v11VoiceCard.v14-assistant-home .v112-hub-primary strong::before{content:'تحدث مع المساعد الصوتي';display:block;font-size:1.08rem;font-weight:900;color:#0d3656;margin-bottom:3px}#v11VoiceCard.v14-assistant-home .v112-hub-primary strong::after{content:'لمسراح';display:block;font-size:.82rem;font-weight:800;color:#567083}#v11VoiceCard.v14-assistant-home .v112-hub-secondary{min-height:40px!important;font-size:.82rem!important}#v11VoiceCard.v14-assistant-home .v112-hub-primary[aria-busy="true"]{opacity:.78!important}@media(max-width:800px){#v11VoiceCard.v14-assistant-home .v11-voice-action{grid-template-columns:88px minmax(0,1fr)!important;gap:12px!important;max-width:none!important;padding:13px!important}#v11VoiceCard.v14-assistant-home .v112-hub-orb{width:88px!important;height:88px!important;min-width:88px!important;min-height:88px!important;background-size:76px 76px!important}}`;
  document.head.appendChild(style);

  async function ensureVoice(){
    if(window.MesraahVoice?.mode==='gemini-live-majalis-0192'&&window.MesraahVoice?.start)return window.MesraahVoice;
    if(!window.MesraahVoiceReady){
      window.MesraahVoiceReady=(async()=>{
        await import('./mesraah-live-appcheck-v0192.js?v=0.19.2');
        await import('./mesraah-live-v0192.js?v=0.19.2');
        return window.MesraahVoice;
      })().catch(error=>{
        window.MesraahVoiceLoadError=error;
        return null;
      });
    }
    const voice=await window.MesraahVoiceReady;
    if(voice?.mode!=='gemini-live-majalis-0192'||!voice?.start){
      throw window.MesraahVoiceLoadError||new Error('mesraah-live-engine-not-ready');
    }
    return voice;
  }

  function showInlineError(button,error){
    document.getElementById('voiceStartInlineError')?.remove();
    const note=document.createElement('div');
    note.id='voiceStartInlineError';
    note.style.cssText='grid-column:1/-1;margin-top:2px;padding:8px 10px;border-radius:11px;background:rgba(255,255,255,.12);color:#fff;font-size:.76rem;line-height:1.55;text-align:right';
    const detail=String(error?.message||error||'');
    note.textContent=detail?`تعذر تشغيل Gemini Live: ${detail.slice(0,150)}`:'تعذر تشغيل Gemini Live الآن.';
    button.closest('.v11-voice-action')?.appendChild(note);
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
      console.error('Mesraah Gemini Live button:',error);
      showInlineError(button,error);
    }finally{
      button.removeAttribute('aria-busy');
      button.dataset.voiceLoading='0';
    }
  },true);
})();
