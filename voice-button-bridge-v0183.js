(()=>{
  if(window.__MESRAAH_VOICE_BUTTON_BRIDGE_0184__) return;
  window.__MESRAAH_VOICE_BUTTON_BRIDGE_0184__=true;

  const style=document.createElement('style');
  style.id='mesraahVoiceCta0184';
  style.textContent=`
  #v11VoiceCard.v14-assistant-home .v11-voice-action{
    min-width:0!important;
    width:100%!important;
    max-width:430px!important;
    justify-self:center!important;
    align-self:center!important;
    padding:0!important;
  }
  #v11VoiceCard.v14-assistant-home .v112-hub-buttons{
    display:grid!important;
    grid-template-columns:148px minmax(0,1fr)!important;
    gap:16px!important;
    align-items:stretch!important;
    width:100%!important;
  }
  #v11VoiceCard.v14-assistant-home .v112-hub-orb{
    display:none!important;
  }
  #v11VoiceCard.v14-assistant-home .v112-hub-primary{
    grid-column:1/-1!important;
    min-height:138px!important;
    padding:18px 20px!important;
    border-radius:24px!important;
    display:grid!important;
    grid-template-columns:138px minmax(0,1fr)!important;
    align-items:center!important;
    gap:18px!important;
    text-align:right!important;
    background:rgba(255,255,255,.12)!important;
    border:1px solid rgba(255,255,255,.24)!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 14px 30px rgba(5,38,55,.15)!important;
    color:#fff!important;
  }
  #v11VoiceCard.v14-assistant-home .v112-hub-primary::before{
    content:'';
    width:118px;
    height:118px;
    border-radius:28px;
    background:#fff url('./voice-assistant-mark.svg?v=0.18.4') center/94px 94px no-repeat;
    box-shadow:0 8px 22px rgba(0,0,0,.14);
    justify-self:center;
  }
  #v11VoiceCard.v14-assistant-home .v112-hub-primary>span{display:none!important}
  #v11VoiceCard.v14-assistant-home .v112-hub-primary strong{
    color:#fff!important;
    font-size:0!important;
    line-height:1.4!important;
    white-space:normal!important;
  }
  #v11VoiceCard.v14-assistant-home .v112-hub-primary strong::before{
    content:'تحدث مع المساعد الصوتي';
    display:block;
    font-size:1.2rem;
    font-weight:900;
    color:#fff;
    margin-bottom:6px;
  }
  #v11VoiceCard.v14-assistant-home .v112-hub-primary strong::after{
    content:'لمسراح';
    display:block;
    font-size:.92rem;
    font-weight:800;
    color:rgba(255,255,255,.72);
  }
  #v11VoiceCard.v14-assistant-home .v112-hub-primary[aria-busy="true"]::after{
    content:'أجهز الاتصال…';
    display:block;
    grid-column:2;
    font-size:.78rem;
    color:rgba(255,255,255,.72);
    margin-top:-26px;
  }
  @media(max-width:760px){
    #v11VoiceCard.v14-assistant-home .v11-voice-action{max-width:none!important}
    #v11VoiceCard.v14-assistant-home .v112-hub-primary{grid-template-columns:96px 1fr!important;min-height:112px!important;padding:14px!important;gap:13px!important}
    #v11VoiceCard.v14-assistant-home .v112-hub-primary::before{width:88px;height:88px;background-size:72px 72px;border-radius:22px}
    #v11VoiceCard.v14-assistant-home .v112-hub-primary strong::before{font-size:1rem}
    #v11VoiceCard.v14-assistant-home .v112-hub-primary strong::after{font-size:.8rem}
  }`;
  document.head.appendChild(style);

  let loadingPromise=null;
  async function ensureVoice(){
    if(window.MesraahVoice?.start) return window.MesraahVoice;
    if(loadingPromise) return loadingPromise;
    loadingPromise=(async()=>{
      window.MesraahVoiceDiagnostics={stage:'loader',code:'starting',at:Date.now()};
      try{
        await import('./mesraah-voice-config.js?v=0.18.4');
        window.MesraahVoiceDiagnostics={stage:'loader',code:'config-ok',at:Date.now()};
        await import('./mesraah-voice-appcheck.js?v=0.18.4');
        window.MesraahVoiceDiagnostics={stage:'loader',code:'appcheck-module-ok',at:Date.now()};
        await import('./mesraah-voice-v0182.js?v=0.18.4');
        if(!window.MesraahVoice?.start) throw new Error('voice-engine-not-ready');
        window.MesraahVoiceDiagnostics={stage:'loader',code:'engine-ok',at:Date.now()};
        return window.MesraahVoice;
      }catch(error){
        window.MesraahVoiceDiagnostics={stage:'loader',code:'failed',detail:String(error?.message||error),at:Date.now()};
        throw error;
      }finally{
        loadingPromise=null;
      }
    })();
    return loadingPromise;
  }

  function showInlineError(button,error){
    const detail=String(error?.message||error||'');
    const old=document.getElementById('voiceStartInlineError');
    old?.remove();
    const note=document.createElement('div');
    note.id='voiceStartInlineError';
    note.style.cssText='margin-top:8px;padding:9px 12px;border-radius:12px;background:rgba(255,255,255,.12);color:#fff;font-size:.78rem;line-height:1.6;text-align:right';
    note.textContent=detail.includes('app-check')?'تعذر التحقق من الاتصال الصوتي. حاول مرة أخرى.':detail.includes('Failed to fetch')?'تعذر تحميل محرك الصوت من الشبكة. حاول مرة أخرى.':'تعذر تشغيل المساعد الصوتي الآن. حاول مرة أخرى.';
    button.closest('.v11-voice-action')?.appendChild(note);
  }

  document.addEventListener('click',async event=>{
    const button=event.target.closest?.('#v112VoiceStart');
    if(!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(button.dataset.voiceLoading==='1') return;
    button.dataset.voiceLoading='1';
    button.setAttribute('aria-busy','true');
    document.getElementById('voiceStartInlineError')?.remove();
    try{
      const voice=await ensureVoice();
      await voice.start();
    }catch(error){
      console.error('Mesraah voice button:',error,window.MesraahVoiceDiagnostics);
      showInlineError(button,error);
    }finally{
      button.removeAttribute('aria-busy');
      button.dataset.voiceLoading='0';
    }
  },true);
})();