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
 function activeTasks(s){const tasks=s.tasks||[],finishedThrough=new Map();tasks.forEach(t=>{const series=String(t.recurrenceSeriesId||'');if(!series||t.status!=='done'||!t.due)return;const saved=finishedThrough.get(series)||'';if(t.due>saved)finishedThrough.set(series,t.due)});const occurrences=new Set();return tasks.filter(t=>{if(t.status==='done')return false;const series=String(t.recurrenceSeriesId||'');if(series&&t.due&&t.due<=(finishedThrough.get(series)||''))return false;const occurrence=series&&t.recurrenceOccurrence?`${series}:${t.recurrenceOccurrence}`:'';if(occurrence){if(occurrences.has(occurrence))return false;occurrences.add(occurrence)}return true})}
 function smartScore(t){const api=window.MesraahPriority;const value=api?.score?.(t);if(Number.isFinite(value))return value;const legacy=t.priority==='strategic'?90:t.priority==='important'?65:30;return legacy+(t.due&&t.due<=today()?15:0)}
 function bestTask(s){const td=today();return [...activeTasks(s)].filter(t=>!t.due||t.due>=td).sort((a,b)=>smartScore(b)-smartScore(a)||(a.due||'9999').localeCompare(b.due||'9999'))[0]||null}
 function recentSpace(s){const counts=new Map();activeTasks(s).forEach(t=>{if(t.spaceId)counts.set(String(t.spaceId),(counts.get(String(t.spaceId))||0)+1)});return [...counts].sort((a,b)=>b[1]-a[1]).map(([id])=>(s.spaces||[]).find(x=>String(x.id)===id)).find(Boolean)||null}
 function suggestions(){const s=readState(),open=activeTasks(s),td=today(),late=open.filter(t=>t.due&&t.due<td),dueToday=open.filter(t=>t.due===td),best=bestTask(s),space=recentSpace(s),items=[];
  if(best)items.push({label:'ابدأ بالمهمة الأعلى أولوية',detail:best.title,type:'task',id:best.id});
  if(late.length)items.push({label:`لديك ${late.length} مهام متأخرة`,detail:'راجع ما يحتاج تدخلك أولا',type:'prompt',prompt:'ما المهام المتأخرة عندي ورتبها لي؟'});
  if(dueToday.length)items.push({label:'رتب مهامي لهذا اليوم',detail:`${dueToday.length} مهام مرتبطة باليوم`,type:'prompt',prompt:'رتب لي يومي حسب الأولوية'});
  if(space)items.push({label:`أكمل العمل في ${space.name}`,detail:'افتح المساحة وما يستحق المتابعة فيها',type:'space',id:space.id});
  if(!items.length)items.push({label:'أضف أول مهمة',detail:'قل لمسراح ما تريد إنجازه',type:'prompt',prompt:'أريد إضافة مهمة جديدة'});
  return items.slice(0,3);
 }

 function installStyles(){}

 function ensureInlineUi(){const card=$('#v11VoiceCard');if(!card||card.dataset.v15Inline)return false;card.dataset.v15Inline='1';card.classList.add('v14-assistant-home');const copy=card.querySelector('.v11-voice-copy');if(copy){const h2=copy.querySelector('h2');if(h2)h2.textContent='ماذا تريد أن تنجز اليوم؟';const p=copy.querySelector('p');if(p)p.textContent='اكتب أو تحدث بشكل طبيعي، ومسراح يوجهك إلى المهمة أو الشخص أو المساحة المناسبة.'}
  const action=card.querySelector('.v11-voice-action');const compose=document.createElement('div');compose.className='v14-inline-compose';compose.innerHTML='<input id="v14AssistantInput" maxlength="300" autocomplete="off" placeholder="مثال: رتب مهامي اليوم حسب الأولوية" aria-label="اكتب طلبك لمسراح"><button type="button" id="v14AssistantSend">إرسال</button>';const voice=action?.querySelector('#v112VoiceStart');if(voice){voice.className='v14-voice-button';voice.innerHTML='<span aria-hidden="true">🎙</span><strong class="sr-only">تحدث مع مسراح</strong>';voice.setAttribute('aria-label','تحدث مع مسراح');voice.title='تحدث مع مسراح';compose.appendChild(voice)}(action||copy)?.insertAdjacentElement('afterend',compose);action?.remove();const sug=document.createElement('div');sug.id='v14Suggestions';sug.className='v14-inline-suggestions';compose.insertAdjacentElement('afterend',sug);bind();renderSuggestions(true);demotePriority();return true}
 function renderSuggestions(force=false){const h=$('#v14Suggestions');if(!h)return;const items=suggestions(),signature=JSON.stringify(items);if(!force&&signature===lastSuggestionSignature)return;lastSuggestionSignature=signature;h.innerHTML=items.map((x,i)=>`<button type="button" class="v14-inline-suggestion" data-v14-suggestion="${i}"><strong>${esc(x.label)}</strong><small>${esc(x.detail)}</small></button>`).join('');h._items=items}
 function openTask(id){document.querySelector(`[data-edit="${CSS.escape(String(id))}"]`)?.click()}
 function openSpace(id){document.querySelector(`[data-open-entity="space"][data-entity-id="${CSS.escape(String(id))}"]`)?.click()}
 function ask(text){const chat=$('#v112TextChat');if(chat?.hidden)chat.hidden=false;const input=$('#v112ChatInput');if(input){input.value=text;input.focus();$('#v112ChatSend')?.click()}}
 function handle(item){if(!item)return;if(item.type==='task'){openTask(item.id);return}if(item.type==='space'){openSpace(item.id);return}ask(item.prompt)}
 function bind(){const input=$('#v14AssistantInput');const go=()=>{const text=input?.value.trim();if(!text)return;input.value='';ask(text)};$('#v14AssistantSend')?.addEventListener('click',go);input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go()}});$('#v14Suggestions')?.addEventListener('click',e=>{const b=e.target.closest('[data-v14-suggestion]');if(!b)return;handle(e.currentTarget._items?.[Number(b.dataset.v14Suggestion)])})}
 function demotePriority(){const panel=$('#smartPriorityPanel');if(!panel)return;let wrap=$('.v14-secondary-priority');if(!wrap){wrap=document.createElement('details');wrap.className='v14-secondary-priority';wrap.innerHTML='<summary>عرض الأولويات والمصفوفة</summary>';panel.parentNode.insertBefore(wrap,panel)}if(panel.parentElement!==wrap)wrap.appendChild(panel)}
 function scheduleRefresh(){if(refreshQueued)return;refreshQueued=true;requestAnimationFrame(()=>{refreshQueued=false;renderSuggestions()})}
 Storage.prototype.setItem=function(key,value){const result=previousSetItem.call(this,key,value);if(this===localStorage&&key===DATA_KEY)scheduleRefresh();return result};
 function ready(){document.documentElement.dataset.mesraahVersion=VERSION;window.dispatchEvent(new Event('mesraah:home-ready'))}
 function boot(){installStyles();if(ensureInlineUi())ready();else setTimeout(()=>{ensureInlineUi();ready()},60);setTimeout(()=>{ensureInlineUi();demotePriority();renderSuggestions(true)},220)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}
