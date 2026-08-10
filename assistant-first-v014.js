const DATA_KEY='mesraah_v030';
const HISTORY_KEY='mesraah_assistant_history_v1';
const VERSION='0.14.0';

if(!window.__MESRAAH_ASSISTANT_FIRST_V014__){
 window.__MESRAAH_ASSISTANT_FIRST_V014__=true;
 const $=s=>document.querySelector(s);
 function readState(){try{return JSON.parse(localStorage.getItem(DATA_KEY)||'{}')||{}}catch{return {}}}
 function esc(v=''){return String(v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
 function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
 function activeTasks(s){return (s.tasks||[]).filter(t=>t.status!=='done')}
 function smartScore(t){const api=window.MesraahPriority;const value=api?.score?.(t);if(Number.isFinite(value))return value;const legacy=t.priority==='strategic'?90:t.priority==='important'?65:30;return legacy+(t.due&&t.due<=today()?15:0)}
 function bestTask(s){return [...activeTasks(s)].sort((a,b)=>smartScore(b)-smartScore(a)||(a.due||'9999').localeCompare(b.due||'9999'))[0]||null}
 function recentSpace(s){const open=activeTasks(s);const counts=new Map();open.forEach(t=>{if(t.spaceId)counts.set(String(t.spaceId),(counts.get(String(t.spaceId))||0)+1)});return [...counts].sort((a,b)=>b[1]-a[1]).map(([id])=>(s.spaces||[]).find(x=>String(x.id)===id)).find(Boolean)||null}
 function suggestions(){const s=readState(),open=activeTasks(s),td=today(),late=open.filter(t=>t.due&&t.due<td),dueToday=open.filter(t=>t.due===td),best=bestTask(s),space=recentSpace(s),items=[];
  if(best)items.push({label:'ابدأ بالمهمة الأعلى أولوية',detail:best.title,type:'task',id:best.id,prompt:'ما أهم مهمة عندي الآن؟'});
  if(late.length)items.push({label:`لديك ${late.length} مهام متأخرة`,detail:'راجع ما يحتاج تدخلك أولا',type:'prompt',prompt:'ما المهام المتأخرة عندي ورتبها لي؟'});
  if(dueToday.length)items.push({label:'رتب مهامي لهذا اليوم',detail:`${dueToday.length} مهام مرتبطة باليوم`,type:'prompt',prompt:'رتب لي يومي حسب الأولوية'});
  if(space)items.push({label:`أكمل العمل في ${space.name}`,detail:'افتح المساحة وما يستحق المتابعة فيها',type:'space',id:space.id,prompt:`افتح مهام مساحة ${space.name}`});
  if(!items.length)items.push({label:'أضف أول مهمة',detail:'قل لمسراح ما تريد إنجازه',type:'create',prompt:'أريد إضافة مهمة جديدة'});
  return items.slice(0,4);
 }
 function styles(){if($('#assistantFirstStyles'))return;const st=document.createElement('style');st.id='assistantFirstStyles';st.textContent=`
 .v14-assistant-home{margin:18px 0 20px;border:1px solid color-mix(in srgb,var(--line,#dbe3ea) 82%,transparent);border-radius:28px;padding:24px;background:linear-gradient(145deg,color-mix(in srgb,var(--surface,#fff) 96%,var(--brand,#0d3656)),var(--surface,#fff));box-shadow:0 18px 44px rgba(13,54,86,.08)}
 .v14-assistant-head{max-width:760px}.v14-assistant-kicker{font-size:.76rem;font-weight:850;color:var(--brand,#0d3656)}.v14-assistant-head h2{font-size:clamp(1.55rem,3vw,2.25rem);margin:7px 0 6px;letter-spacing:-.02em}.v14-assistant-head p{margin:0;color:var(--muted,#667786);line-height:1.7}
 .v14-compose{display:grid;grid-template-columns:1fr auto auto;gap:9px;margin-top:18px;padding:8px;border:1px solid var(--line,#dbe3ea);border-radius:18px;background:var(--surface,#fff)}.v14-compose input{border:0;background:transparent;color:var(--text,#17324a);font:inherit;font-size:1rem;padding:8px 10px;outline:0;min-width:0}.v14-compose button{border:0;border-radius:13px;padding:10px 15px;font:inherit;font-weight:800;cursor:pointer}.v14-send{background:var(--brand,#0d3656);color:#fff}.v14-voice{background:color-mix(in srgb,var(--brand,#0d3656) 8%,var(--surface,#fff));color:var(--brand,#0d3656)}
 .v14-suggestions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:14px}.v14-suggestion{border:1px solid var(--line,#dbe3ea);background:var(--surface,#fff);border-radius:15px;padding:12px;text-align:right;color:inherit;font:inherit;cursor:pointer;min-height:82px}.v14-suggestion:hover{border-color:color-mix(in srgb,var(--brand,#0d3656) 42%,var(--line,#dbe3ea));transform:translateY(-1px)}.v14-suggestion strong{display:block;font-size:.86rem}.v14-suggestion small{display:block;color:var(--muted,#667786);font-size:.71rem;line-height:1.5;margin-top:5px}
 .v14-assistant-home .v112-text-chat{margin-top:16px}.v14-assistant-home .v112-chat-head{display:flex}.v14-assistant-home.is-chatting .v14-assistant-head p{display:none}
 #view-today>.v11-voice-card{display:none!important}.v14-secondary-priority{margin-top:8px}.v14-secondary-priority #smartPriorityPanel{margin-top:0;box-shadow:none}
 @media(max-width:900px){.v14-suggestions{grid-template-columns:repeat(2,minmax(0,1fr))}}
 @media(max-width:600px){.v14-assistant-home{padding:17px;border-radius:22px}.v14-compose{grid-template-columns:1fr auto}.v14-voice{grid-column:1/-1}.v14-suggestions{grid-template-columns:1fr 1fr}}
 `;document.head.appendChild(st)}
 function ensureHome(){if($('#v14AssistantHome'))return;const welcome=$('#view-today .welcome-card');if(!welcome)return;const host=document.createElement('section');host.id='v14AssistantHome';host.className='v14-assistant-home';host.innerHTML=`<div class="v14-assistant-head"><span class="v14-assistant-kicker">مسراح معك</span><h2>ماذا تريد أن تنجز اليوم؟</h2><p>اكتب أو تحدث بشكل طبيعي، ومسراح يوجهك إلى المهمة أو الشخص أو المساحة المناسبة.</p></div><div class="v14-compose"><input id="v14AssistantInput" maxlength="300" autocomplete="off" placeholder="مثال: رتب لي يومي، أو ما أهم مهمة عندي؟"><button type="button" class="v14-send" id="v14AssistantSend">إرسال</button><button type="button" class="v14-voice" id="v14AssistantVoice">🎙 تحدث</button></div><div class="v14-suggestions" id="v14Suggestions"></div><div id="v14ChatMount"></div>`;welcome.insertAdjacentElement('afterend',host);renderSuggestions();bind();mountExistingChat();demotePriority()}
 function renderSuggestions(){const h=$('#v14Suggestions');if(!h)return;h.innerHTML=suggestions().map((x,i)=>`<button type="button" class="v14-suggestion" data-v14-suggestion="${i}"><strong>${esc(x.label)}</strong><small>${esc(x.detail)}</small></button>`).join('');h._items=suggestions()}
 function openTask(id){document.querySelector(`[data-edit="${CSS.escape(String(id))}"]`)?.click()}
 function openSpace(id){document.querySelector(`[data-open-entity="space"][data-entity-id="${CSS.escape(String(id))}"]`)?.click()}
 function openComposerWith(text){const textStart=$('#v112TextStart');const chat=$('#v112TextChat');if(chat?.hidden)textStart?.click();const input=$('#v112ChatInput');if(input){input.value=text;input.focus();$('#v112ChatSend')?.click()}}
 function handleSuggestion(item){if(!item)return;if(item.type==='task'){openTask(item.id);return}if(item.type==='space'){openSpace(item.id);return}openComposerWith(item.prompt)}
 function bind(){const input=$('#v14AssistantInput'),send=$('#v14AssistantSend');const go=()=>{const text=input?.value.trim();if(!text)return;input.value='';openComposerWith(text);$('#v14AssistantHome')?.classList.add('is-chatting')};send?.addEventListener('click',go);input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go()}});$('#v14AssistantVoice')?.addEventListener('click',()=>window.MesraahVoice?.start?.());$('#v14Suggestions')?.addEventListener('click',e=>{const b=e.target.closest('[data-v14-suggestion]');if(!b)return;handleSuggestion(e.currentTarget._items?.[Number(b.dataset.v14Suggestion)])})}
 function mountExistingChat(){const mount=$('#v14ChatMount'),chat=$('#v112TextChat');if(mount&&chat)mount.appendChild(chat)}
 function demotePriority(){const panel=$('#smartPriorityPanel');if(!panel)return;let wrap=$('.v14-secondary-priority');if(!wrap){wrap=document.createElement('details');wrap.className='v14-secondary-priority';wrap.innerHTML='<summary>عرض الأولويات والمصفوفة</summary>';panel.parentNode.insertBefore(wrap,panel)}wrap.appendChild(panel)}
 function watch(){const obs=new MutationObserver(()=>{ensureHome();mountExistingChat();demotePriority();renderSuggestions()});obs.observe(document.body,{childList:true,subtree:true});window.addEventListener('storage',()=>renderSuggestions())}
 function boot(){styles();ensureHome();watch();document.documentElement.dataset.mesraahVersion=VERSION}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}
