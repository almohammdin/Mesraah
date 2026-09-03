(()=>{
  if(window.__MESRAAH_ASSISTANT_GATE_0200__)return;
  window.__MESRAAH_ASSISTANT_GATE_0200__=true;
  const prior=window.MesraahAssistant||{};
  const gate={...prior};
  gate.ask=async(...args)=>{
    const ready=window.MesraahTextAssistantReady||window.MesraahEnsureTextAssistant?.();
    if(ready)await ready;
    const current=window.MesraahAssistant;
    if(!current||current===gate||typeof current.ask!=='function')throw window.MesraahTextAssistantLoadError||new Error('text-assistant-not-ready');
    return current.ask(...args);
  };
  gate.clearHistory=()=>{
    const current=window.MesraahAssistant;
    if(current&&current!==gate&&typeof current.clearHistory==='function')return current.clearHistory();
    try{sessionStorage.removeItem('mesraah_assistant_history_v1')}catch{}
  };
  window.MesraahAssistant=gate;
})();
