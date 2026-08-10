(()=>{
 const VERSION='0.17.4';
 function installStyles(){if(document.getElementById('v174TaskDateFixStyles'))return;const s=document.createElement('style');s.id='v174TaskDateFixStyles';s.textContent=`
 #taskModal .v11-greg-wrap[hidden],#taskModal .v11-hijri-wrap[hidden]{display:none!important}
 #taskModal .v11-greg-wrap:not([hidden]){display:block!important}
 #taskModal .v11-hijri-wrap:not([hidden]){display:grid!important}
 #taskModal #v11DueGregorian,#taskModal #v11HijriDay,#taskModal #v11HijriMonth,#taskModal #v11HijriYear,#taskModal #v11TaskTime{direction:ltr!important;unicode-bidi:isolate!important;font-variant-numeric:lining-nums tabular-nums!important;font-feature-settings:'lnum' 1,'tnum' 1!important}
 #taskModal .v11-dual-preview{font-variant-numeric:lining-nums tabular-nums!important}
 `;document.head.appendChild(s)}
 function latin(v=''){return String(v).replace(/[٠-٩]/g,d=>'0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]).replace(/[۰-۹]/g,d=>'0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])}
 function prepare(){installStyles();['v11DueGregorian','v11HijriDay','v11HijriMonth','v11HijriYear','v11TaskTime'].forEach(id=>{const el=document.getElementById(id);if(!el)return;el.lang='en';el.dir='ltr';if(el.tagName==='SELECT'){[...el.options].forEach(o=>{o.textContent=latin(o.textContent);o.value=latin(o.value)})}else if('value'in el){const next=latin(el.value);if(next!==el.value)el.value=next}});const greg=document.querySelector('.v11-greg-wrap'),hijri=document.querySelector('.v11-hijri-wrap');const active=document.querySelector('[data-v11-date-mode].active')?.dataset.v11DateMode||'gregorian';if(greg)greg.hidden=active!=='gregorian';if(hijri)hijri.hidden=active!=='hijri'}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-v11-date-mode]');if(!b)return;requestAnimationFrame(prepare)},true);
 document.addEventListener('focusin',e=>{if(e.target?.closest?.('#taskModal'))prepare()},true);
 const dialog=document.getElementById('taskModal');dialog?.addEventListener('toggle',prepare);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{prepare();setTimeout(prepare,500)},{once:true});else{prepare();setTimeout(prepare,500)}
 document.documentElement.dataset.mesraahVersion=VERSION;
})();