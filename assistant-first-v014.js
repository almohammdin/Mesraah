const DATA_KEY='mesraah_v030';
const VERSION='0.14.1';

if(!window.__MESRAAH_ASSISTANT_FIRST_V0141__){
 window.__MESRAAH_ASSISTANT_FIRST_V0141__=true;
 const $=s=>document.querySelector(s);
 const previousSetItem=Storage.prototype.setItem;
 let lastSuggestionSignature='';
 let refreshQueued=false;

 function readState(){try{return JSON.parse(localStorage.getItem(DATA_KEY)||'{}')||{}}catch{return {}}}
 function esc(v=''){return String(v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
 function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
 function activeTasks(s){return (s.tasks||[]).filter(t=>t.status!=='done')}
 function smartScore(t){const api=window.MesraahPriority;const value=api?.score?.(t);if(Number.isFinite(value))return value;const legacy=t.priority==='strategic'?90:t.priority==='important'?65:30;return legacy+(t.due&&t.due<=today()?15:0)}
 function bestTask(s){return [...activeTasks(s)].sort((a,b)=>smartScore(b)-smartScore(a)||(a.due||'9999').localeCompare(b.due||'9999'))[0]||null}
 function recentSpace(s){const counts=new Map();activeTasks(s).forEach(t=>{if(t.spaceId)counts.set(String(t.spaceId),(counts.get(String(t.spaceId))||0)+1)});return [...counts].sort((a,b)=>b[1]-a[1]).map(([id])=>(s.spaces||[]).find(x=>String(x.id)===id)).find(Boolean)||null}
 function suggestions(){const s=readState(),open=activeTasks(s),td=today(),late=open.filter(t=>t.due&&t.due<td),dueToday=open.filter(t=>t.due===td),best=bestTask(s),space=recentSpace(s),items=[];
  if(best)items.push({label:'ابدأ بالمهمة الأعلى أولوية',detail:best.title,type:'task',id:best.id});
  if(late.length)items.push({label:`لديك ${late.length} مهام متأخرة`,detail:'راجع ما يحتاج تدخلك أولا',type:'prompt',prompt:'ما المهام المتأخرة عندي ورتبها لي؟'});
  if(dueToday.length)items.push({label:'رتب مهامي لهذا اليوم',detail:`${dueToday.length} مهام مرتبطة باليوم`,type:'prompt',prompt:'رتب لي يومي حسب الأولوية'});
  if(space)items.push({label:`أكمل العمل في ${space.name}`,detail:'افتح المساحة وما يستحق المتابعة فيها',type:'space',id:space.id});
  if(!items.length)items.push({label:'أضف أول مهمة',detail:'قل لمسراح ما تريد إنجازه',type:'prompt',prompt:'أريد إضافة مهمة جديدة'});
  return items.slice(0,4);
 }
 function installStyles(){if($('#assistantFirstStyles'))return;const st=document.createElement('style');st.id='assistantFirstStyles';st.textContent=`
 #v11VoiceCard.v14-assistant-home{display:block!important;margin:18px 0 20px;border-radius:28px;padding:24px;background:linear-gradient(145deg,color-mix(in srgb,var(--surface,#fff) 96%,var(--brand,#0d3656)),var(--surface,#fff));box-shadow:0 18px 44px rgba(13,54,86,.08)}
 #v11VoiceCard.v14-assistant-home .v11-voice-copy{max-width:780px}#v11VoiceCard.v14-assistant-home .v11-voice-copy h2{font-size:clamp(1.55rem,3vw,2.25rem);margin:7px 0 6px}#v11VoiceCard.v14-assistant-home .v11-voice-copy p{line-height:1.7}
 .v14-inline-compose{display:grid;grid-template-columns:1fr auto;gap:9px;margin-top:16px;padding:8px;border:1px solid var(--line,#dbe3ea);border-radius:18px;background:var(--surface,#fff)}.v14-inline-compose input{border:0;background:transparent;color:var(--text,#17324a);font:inherit;font-size:1rem;padding:8px 10px;outline:0;min-width:0}.v14-inline-compose button{border:0;border-radius:13px;padding:10px 16px;font:inherit;font-weight:800;cursor:pointer;background:var(--brand,#0d3656);color:#fff}
 .v14-inline-suggestions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:12px}.v14-inline-suggestion{border:1px solid var(--line,#dbe3ea);background:var(--surface,#fff);border-radius:15px;padding:12px;text-align:right;color:inherit;font:inherit;cursor:pointer;min-height:78px}.v14-inline-suggestion strong{display:block;font-size:.85rem}.v14-inline-suggestion small{display:block;color:var(--muted,#667786);font-size:.71rem;line-height:1.5;margin-top:5px}
 #v11VoiceCard.v14-assistant-home .v112-hub-buttons{grid-template-columns:1fr}#v11VoiceCard.v14-assistant-home #v112TextStart{display:none}#v11VoiceCard.v14-assistant-home .v112-text-chat{margin-top:14px}.v14-secondary-priority{margin-top:8px}.v14-secondary-priority #smartPriorityPanel{margin-top:0;box-shadow:none}
 @media(max-width:900px){.v14-inline-suggestions{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){#v11VoiceCard.v14-assistant-home{padding:17px;border-radius:22px}.v14-inline-suggestions{grid-template-columns:1fr 1fr}}
 `;document.head.appendChild(st)}
 function ensureInlineUi(){const card=$('#v11VoiceCard');if(!card||card.dataset.v14Inline)return false;card.dataset.v14Inline='1';card.classList.add('v14-assistant-home');const copy=card.querySelector('.v11-voice-copy');if(copy){const h2=copy.querySelector('h2');if(h2)h2.textContent='ماذا تريد أن تنجز اليوم؟';const p=copy.querySelector('p');if(p)p.textContent='اكتب أو تحدث بشكل طبيعي، ومسراح يوجهك إلى المهمة أو الشخص أو المساحة المناسبة.'}
  const action=card.querySelector('.v11-voice-action');const compose=document.createElement('div');compose.className='v14-inline-compose';compose.innerHTML='<input id="v14AssistantInput" maxlength="300" autocomplete="off" placeholder="مثال: رتب لي يومي، أو ما أهم مهمة عندي؟"><button type="button" id="v14AssistantSend">إرسال</button>';(action||copy)?.insertAdjacentElement('afterend',compose);const sug=document.createElement('div');sug.id='v14Suggestions';sug.className='v14-inline-suggestions';compose.insertAdjacentElement('afterend',sug);bind();renderSuggestions(true);demotePriority();return true}
 function renderSuggestions(force=false){const h=$('#v14Suggestions');if(!h)return;const items=suggestions(),signature=JSON.stringify(items);if(!force&&signature===lastSuggestionSignature)return;lastSuggestionSignature=signature;h.innerHTML=items.map((x,i)=>`<button type="button" class="v14-inline-suggestion" data-v14-suggestion="${i}"><strong>${esc(x.label)}</strong><small>${esc(x.detail)}</small></button>`).join('');h._items=items}
 function openTask(id){document.querySelector(`[data-edit="${CSS.escape(String(id))}"]`)?.click()}
 function openSpace(id){document.querySelector(`[data-open-entity="space"][data-entity-id="${CSS.escape(String(id))}"]`)?.click()}
 function ask(text){const chat=$('#v112TextChat');if(chat?.hidden)$('#v112TextStart')?.click();const input=$('#v112ChatInput');if(input){input.value=text;input.focus();$('#v112ChatSend')?.click()}}
 function handle(item){if(!item)return;if(item.type==='task'){openTask(item.id);return}if(item.type==='space'){openSpace(item.id);return}ask(item.prompt)}
 function bind(){const input=$('#v14AssistantInput');const go=()=>{const text=input?.value.trim();if(!text)return;input.value='';ask(text)};$('#v14AssistantSend')?.addEventListener('click',go);input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go()}});$('#v14Suggestions')?.addEventListener('click',e=>{const b=e.target.closest('[data-v14-suggestion]');if(!b)return;handle(e.currentTarget._items?.[Number(b.dataset.v14Suggestion)])})}
 function demotePriority(){const panel=$('#smartPriorityPanel');if(!panel)return;let wrap=$('.v14-secondary-priority');if(!wrap){wrap=document.createElement('details');wrap.className='v14-secondary-priority';wrap.innerHTML='<summary>عرض الأولويات والمصفوفة</summary>';panel.parentNode.insertBefore(wrap,panel)}if(panel.parentElement!==wrap)wrap.appendChild(panel)}
 function scheduleRefresh(){if(refreshQueued)return;refreshQueued=true;requestAnimationFrame(()=>{refreshQueued=false;renderSuggestions()})}
 Storage.prototype.setItem=function(key,value){const result=previousSetItem.call(this,key,value);if(this===localStorage&&key===DATA_KEY)scheduleRefresh();return result};
 function boot(){installStyles();if(!ensureInlineUi())setTimeout(()=>ensureInlineUi(),180);setTimeout(()=>{ensureInlineUi();demotePriority();renderSuggestions(true)},650);document.documentElement.dataset.mesraahVersion=VERSION}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}
