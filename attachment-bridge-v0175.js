(()=>{
 let installed=false;
 function install(){if(installed)return;const assistant=window.MesraahAssistant,pipeline=window.MesraahAttachmentPipeline;if(!assistant?.ask||!pipeline?.extract)return;installed=true;const originalAsk=assistant.ask.bind(assistant);assistant.ask=async function(text){const files=Array.isArray(window.MesraahPendingAttachments)?window.MesraahPendingAttachments.slice(0,1):[];const file=files[0];if(!file||!String(file.type||'').startsWith('image/'))return originalAsk(text);try{const extracted=await pipeline.extract(file);window.MesraahPendingAttachments=[];const combined=`${String(text||'').trim()}\n\n[محتوى الصورة الذي قرأه مسراح]\n${extracted}`.trim();const result=await originalAsk(combined);window.dispatchEvent(new CustomEvent('mesraah:attachments-consumed'));return result}catch(error){window.MesraahPendingAttachments=files;error.mesraahStage='image-extraction';throw error}};
 }
 install();setTimeout(install,500);setTimeout(install,1500);
})();