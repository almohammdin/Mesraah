(()=>{
 const VERSION='0.16.0',MAX_CHARS=12000,MAX_IMAGE=8*1024*1024,SUPPORTED=new Set(['image/png','image/jpeg','image/webp']);
 let file=null;
 function toast(message){const el=document.getElementById('toast');if(!el)return;el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
 function defaultPrompt(){return 'اقرأ الصورة كاملة واستخرج منها ما يحتاج إجراء في مسراح. إذا كانت موعدا فاقترح إضافته للتقويم، وإذا كانت مهمة فاقترح المهمة.'}
 function installStyles(){if(document.getElementById('v16InputStyles'))return;const s=document.createElement('style');s.id='v16InputStyles';s.textContent=`
 .v16-attach-btn{border:0;border-radius:10px;min-width:44px;min-height:40px;padding:8px 11px;font:inherit;font-weight:850;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px;background:rgba(255,255,255,.14);color:#fff}
 #v112TextChat .v16-attach-btn{background:#dfecea;color:#17324a;border:1px solid #c8ddda}
 .v16-attachment-preview{display:none;align-items:center;gap:8px;margin-top:7px;padding:7px 9px;border-radius:11px;background:rgba(255,255,255,.13);color:#fff;font-size:.78rem;max-width:100%}
 #v112TextChat .v16-attachment-preview{background:#e5efed;color:#17324a;margin:0 8px 8px}
 .v16-attachment-preview.show{display:flex}.v16-attachment-preview img{width:34px;height:34px;border-radius:8px;object-fit:cover}.v16-attachment-preview span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v16-attachment-preview button{margin-inline-start:auto;border:0;background:transparent;color:inherit;font:inherit;font-weight:900;cursor:pointer;padding:4px 7px}
 #v112ChatInput{max-height:150px;min-height:46px;resize:vertical;line-height:1.6}
 .v16-char-count{font-size:.7rem;color:#71827f;margin-inline-start:auto;padding:0 4px;white-space:nowrap}
 `;document.head.appendChild(s)}
 function ensureFileInput(){let input=document.getElementById('v16ImageInput');if(input)return input;input=document.createElement('input');input.type='file';input.id='v16ImageInput';input.accept='image/png,image/jpeg,image/webp';input.hidden=true;document.body.appendChild(input);input.addEventListener('change',()=>{const picked=input.files?.[0];if(!picked)return;if(!SUPPORTED.has(picked.type)){toast('الصورة يجب أن تكون PNG أو JPEG أو WebP');input.value='';return}if(picked.size>MAX_IMAGE){toast('حجم الصورة يتجاوز 8MB');input.value='';return}file=picked;window.MesraahPendingAttachments=[picked];renderPreviews();input.value=''});return input}
 function clearAttachment(){file=null;window.MesraahPendingAttachments=[];renderPreviews()}
 function previewUrl(){return file?URL.createObjectURL(file):''}
 function renderPreviews(){document.querySelectorAll('.v16-attachment-preview').forEach(el=>{if(!file){el.classList.remove('show');el.innerHTML='';return}const url=previewUrl();el.classList.add('show');el.innerHTML=`<img src="${url}" alt=""><span>${escapeHtml(file.name)}</span><button type="button" aria-label="إزالة الصورة">×</button>`;el.querySelector('button')?.addEventListener('click',clearAttachment,{once:true})})}
 function escapeHtml(v=''){return String(v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
 function attachButton(target,before=null){if(!target||target.querySelector('.v16-attach-btn'))return;const btn=document.createElement('button');btn.type='button';btn.className='v16-attach-btn';btn.title='إرفاق صورة';btn.setAttribute('aria-label','إرفاق صورة');btn.innerHTML='📎 <span>صورة</span>';if(before)target.insertBefore(btn,before);else target.appendChild(btn);btn.addEventListener('click',()=>ensureFileInput().click());const preview=document.createElement('div');preview.className='v16-attachment-preview';target.insertAdjacentElement('afterend',preview)}
 function upgradeField(el){if(!el)return;el.maxLength=MAX_CHARS;el.setAttribute('maxlength',String(MAX_CHARS));el.setAttribute('data-v16-long','1')}
 function install(){installStyles();ensureFileInput();const top=document.getElementById('v14AssistantInput'),topSend=document.getElementById('v14AssistantSend');upgradeField(top);if(topSend?.parentElement)attachButton(topSend.parentElement,topSend);const chat=document.getElementById('v112ChatInput'),chatSend=document.getElementById('v112ChatSend');upgradeField(chat);if(chatSend?.parentElement)attachButton(chatSend.parentElement,chatSend);if(chat&&chat.tagName==='INPUT'){chat.setAttribute('title','يمكن لصق رسائل طويلة حتى 12000 حرف')}
  const prime=(input)=>{if(file&&input&&!input.value.trim())input.value=defaultPrompt()};
  topSend?.addEventListener('click',()=>prime(top),true);top?.addEventListener('keydown',e=>{if(e.key==='Enter')prime(top)},true);chatSend?.addEventListener('click',()=>prime(chat),true);chat?.addEventListener('keydown',e=>{if(e.key==='Enter')prime(chat)},true);
  renderPreviews();document.documentElement.dataset.mesraahVersion=VERSION
 }
 window.addEventListener('mesraah:attachments-consumed',()=>{file=null;renderPreviews()});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{install();setTimeout(install,350);setTimeout(install,1000)},{once:true});else{install();setTimeout(install,350);setTimeout(install,1000)}
})();
