const DATA_KEY='mesraah_v030';
const VERSION='0.15.1';

if(!window.__MESRAAH_ASSISTANT_FIRST_V0151__){
 window.__MESRAAH_ASSISTANT_FIRST_V0151__=true;
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
 #view-today .mesraah-story-card{margin-bottom:10px;padding-block:11px;min-height:0}
 #view-today .welcome-card{min-height:0!important;height:auto!important;margin-bottom:12px;padding:15px 20px!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;gap:18px!important;border-radius:24px!important}
 #view-today .welcome-card>div:first-child{display:grid!important;grid-template-columns:auto minmax(220px,1fr)!important;grid-template-areas:'moment greeting' 'moment sub'!important;align-items:center!important;column-gap:24px!important;row-gap:2px!important;min-width:0}
 #view-today .welcome-card #todayMoment{grid-area:moment!important;margin:0!important;min-width:390px!important;max-width:none!important;display:flex!important;align-items:center!important;gap:9px!important;padding:8px 10px!important;border-radius:18px!important}
 #view-today .welcome-card #greeting{grid-area:greeting!important;margin:0!important;font-size:clamp(1.7rem,2.5vw,2.55rem)!important;line-height:1.12!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
 #view-today .welcome-card #welcomeLine{grid-area:sub!important;margin:2px 0 0!important;line-height:1.35!important;font-size:.86rem!important}
 #view-today .v72-moment .v72-time-pane{padding:7px 10px!important;min-width:105px!important;border-radius:13px!important}
 #view-today .v72-moment .v72-date-pane{display:grid!important;grid-template-columns:auto auto!important;align-items:center!important;gap:4px 10px!important;padding:4px 8px!important;min-width:245px!important}
 #view-today .v72-moment .v72-dayline{grid-column:1/-1!important;margin:0!important;padding:0 0 3px!important;line-height:1.15!important}
 #view-today .v72-moment .v72-date-row{margin:0!important;padding:4px 7px!important;line-height:1.1!important;white-space:nowrap!important}
 #view-today .v72-moment .v72-live-label{font-size:.66rem!important}.v72-hm{font-size:1.55rem!important}.v72-sec{font-size:.75rem!important}
 #view-today .day-ring{width:78px!important;height:78px!important;min-width:78px!important;margin:0!important}
 #view-today .day-ring strong{font-size:1.15rem!important}#view-today .day-ring span{font-size:.66rem!important}

 #v11VoiceCard.v14-assistant-home{display:grid!important;grid-template-columns:minmax(0,1fr) 160px!important;column-gap:18px!important;align-items:start!important;margin:0 0 14px!important;border-radius:25px!important;padding:19px 20px!important;background:radial-gradient(circle at 82% 8%,rgba(74,190,177,.28),transparent 32%),linear-gradient(135deg,#0b314d,#0f5b62 72%,#14746f)!important;border:1px solid rgba(255,255,255,.12)!important;box-shadow:0 16px 34px rgba(13,54,86,.18)!important;color:#fff!important}
 #v11VoiceCard.v14-assistant-home .v11-voice-copy{grid-column:1;max-width:none!important;padding:0!important;color:#fff!important}
 #v11VoiceCard.v14-assistant-home .v11-voice-kicker{color:#8fe3d7!important;font-weight:900!important}
 #v11VoiceCard.v14-assistant-home .v11-voice-copy h2{font-size:clamp(1.35rem,2.2vw,2rem)!important;margin:3px 0 4px!important;line-height:1.2!important;color:#fff!important;text-shadow:0 1px 0 rgba(0,0,0,.08)}
 #v11VoiceCard.v14-assistant-home .v11-voice-copy p{margin:0!important;line-height:1.5!important;font-size:.84rem!important;color:rgba(255,255,255,.84)!important}
 #v11VoiceCard.v14-assistant-home .v11-voice-action{grid-column:2;grid-row:1/5;align-self:center!important;margin:0!important;padding:0!important;color:#fff!important}
 #v11VoiceCard.v14-assistant-home .v112-hub-orb{width:52px!important;height:52px!important;margin:0 auto 7px!important;background:rgba(255,255,255,.12)!important;border:1px solid rgba(255,255,255,.2)!important;color:#fff!important}
 #v11VoiceCard.v14-assistant-home .v112-hub-buttons{grid-template-columns:1fr!important;gap:6px!important}#v11VoiceCard.v14-assistant-home #v112TextStart{display:none!important}
 #v11VoiceCard.v14-assistant-home .v112-hub-primary{min-height:42px!important;padding:8px 10px!important;border-radius:12px!important;background:#fff!important;color:#0d3656!important;border:0!important;box-shadow:0 5px 14px rgba(0,0,0,.12)!important}
 #v11VoiceCard.v14-assistant-home .v112-hub-primary span,#v11VoiceCard.v14-assistant-home .v112-hub-primary strong{color:#0d3656!important}

 .v14-inline-compose{grid-column:1;display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:11px;padding:6px;border:1px solid rgba(255,255,255,.2);border-radius:15px;background:rgba(255,255,255,.12);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
 .v14-inline-compose input{border:0;background:#fff;color:#17324a;font:inherit;font-size:.92rem;padding:9px 11px;outline:0;min-width:0;border-radius:10px}
 .v14-inline-compose input::placeholder{color:#687987}
 .v14-inline-compose button{border:0;border-radius:10px;padding:8px 15px;font:inherit;font-weight:850;cursor:pointer;background:#7ed9cc;color:#0b314d}
 .v14-inline-suggestions{grid-column:1;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:8px}
 .v14-inline-suggestion{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.10);border-radius:13px;padding:9px 10px;text-align:right;color:#fff;font:inherit;cursor:pointer;min-height:58px;transition:transform .15s ease,background .15s ease,border-color .15s ease}
 .v14-inline-suggestion:hover{transform:translateY(-1px);background:rgba(255,255,255,.17);border-color:rgba(255,255,255,.28)}
 .v14-inline-suggestion strong{display:block;font-size:.78rem;line-height:1.3;color:#fff}.v14-inline-suggestion small{display:block;color:rgba(255,255,255,.72);font-size:.66rem;line-height:1.35;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

 #v11VoiceCard.v14-assistant-home .v112-text-chat{grid-column:1/-1;margin-top:10px!important;border:1px solid rgba(255,255,255,.14)!important;border-radius:17px!important;background:#f3f8f7!important;overflow:hidden!important;box-shadow:0 8px 18px rgba(0,0,0,.08)!important;color:#17324a!important}
 #v11VoiceCard .v112-chat-head{padding:9px 12px!important;background:#e4f1ef!important;border-bottom:1px solid #d3e4e1!important;color:#17324a!important}
 #v11VoiceCard .v112-chat-head strong,#v11VoiceCard .v112-chat-head button{color:#17324a!important}
 #v11VoiceCard .v112-chat-transcript{min-height:76px!important;max-height:190px!important;padding:12px!important;background:#f3f8f7!important}
 #v11VoiceCard .v112-chat-message{width:100%!important;max-width:100%!important;margin-bottom:7px!important;padding:0!important;background:transparent!important;border:0!important;box-sizing:border-box!important}
 #v11VoiceCard .v112-chat-answer{width:fit-content!important;max-width:min(88%,34rem)!important;box-sizing:border-box!important;overflow-wrap:break-word!important;word-break:normal!important;hyphens:none!important;white-space:normal!important;text-align:right!important;direction:rtl!important}
 #v11VoiceCard .v112-chat-message.assistant{text-align:right!important}#v11VoiceCard .v112-chat-message.assistant .v112-chat-answer{display:inline-block;padding:9px 12px!important;border-radius:14px 14px 5px 14px!important;background:#fff!important;border:1px solid #dbe6e4!important;box-shadow:0 3px 10px rgba(13,54,86,.045)!important;color:#17324a!important}
 #v11VoiceCard .v112-chat-message.user{text-align:left!important}#v11VoiceCard .v112-chat-message.user .v112-chat-answer{display:inline-block;padding:9px 12px!important;border-radius:14px 14px 14px 5px!important;background:#0d3656!important;color:#fff!important}
 #v11VoiceCard .v112-chat-action{width:min(100%,38rem)!important;box-sizing:border-box!important;margin-top:9px!important;padding:12px!important;gap:10px!important;border-radius:14px!important;background:#e2f1ee!important;border:1px solid #acd0c9!important;box-shadow:0 4px 12px rgba(13,54,86,.08)!important;color:#17324a!important;text-align:right!important;direction:rtl!important}
 #v11VoiceCard .v112-chat-action strong{font-size:1rem!important;line-height:1.55!important;color:#17324a!important;overflow-wrap:break-word!important;word-break:normal!important}
 #v11VoiceCard .v112-chat-action small{margin-top:4px!important;font-size:.84rem!important;line-height:1.55!important;color:#526d78!important;overflow-wrap:break-word!important;word-break:normal!important}
 #v11VoiceCard .v112-chat-action-buttons{gap:8px!important}#v11VoiceCard .v112-chat-action-buttons button{min-height:40px!important;padding:8px 13px!important;border-radius:10px!important;background:#0d5d63!important;color:#fff!important;border:1px solid #0d5d63!important;font-size:.88rem!important;font-weight:850!important}#v11VoiceCard .v112-chat-action-buttons button.secondary{background:#fff!important;color:#17324a!important;border-color:#9fc6bf!important}
 #v11VoiceCard .v112-chat-compose{padding:8px!important;background:#eaf3f1!important;border-top:1px solid #d3e4e1!important}#v11VoiceCard .v112-chat-compose input{background:#fff!important;color:#17324a!important;border:1px solid #cbdedb!important;border-radius:11px!important}
 .v14-secondary-priority{margin-top:7px}.v14-secondary-priority #smartPriorityPanel{margin-top:0;box-shadow:none}

 @media(max-width:1100px){#view-today .welcome-card>div:first-child{grid-template-columns:1fr!important;grid-template-areas:'moment' 'greeting' 'sub'!important;gap:5px!important}#view-today .welcome-card #todayMoment{min-width:0!important}#view-today .welcome-card #greeting{white-space:normal!important}.v14-inline-suggestions{grid-template-columns:repeat(2,minmax(0,1fr))}}
 @media(max-width:700px){#view-today .welcome-card{grid-template-columns:1fr!important;padding:13px!important}#view-today .day-ring{display:none!important}#view-today .welcome-card #todayMoment{display:grid!important;grid-template-columns:auto 1fr!important}.v72-date-pane{min-width:0!important}#v11VoiceCard.v14-assistant-home{grid-template-columns:1fr!important;padding:15px!important}#v11VoiceCard.v14-assistant-home .v11-voice-action{grid-column:1!important;grid-row:auto!important;margin-top:8px!important}.v14-inline-suggestions{grid-template-columns:1fr 1fr}#v11VoiceCard .v112-chat-answer{max-width:92%!important}#v11VoiceCard .v112-chat-action{width:100%!important}#v11VoiceCard .v112-chat-action-buttons{display:grid!important;grid-template-columns:1fr 1fr!important}#v11VoiceCard .v112-chat-action-buttons button{width:100%!important;min-width:0!important}}
 `;document.head.appendChild(st)}

 function ensureInlineUi(){const card=$('#v11VoiceCard');if(!card||card.dataset.v15Inline)return false;card.dataset.v15Inline='1';card.classList.add('v14-assistant-home');const copy=card.querySelector('.v11-voice-copy');if(copy){const h2=copy.querySelector('h2');if(h2)h2.textContent='ماذا تريد أن تنجز اليوم؟';const p=copy.querySelector('p');if(p)p.textContent='اكتب أو تحدث بشكل طبيعي، ومسراح يوجهك إلى المهمة أو الشخص أو المساحة المناسبة.'}
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
 function ready(){document.documentElement.dataset.mesraahVersion=VERSION;window.dispatchEvent(new Event('mesraah:home-ready'))}
 function boot(){installStyles();if(ensureInlineUi())ready();else setTimeout(()=>{ensureInlineUi();ready()},60);setTimeout(()=>{ensureInlineUi();demotePriority();renderSuggestions(true)},220)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}
