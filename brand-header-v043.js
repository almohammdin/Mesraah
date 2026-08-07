(() => {
 const ICON='mesraah-app-icon.svg?v=0.4.5';
 function ensureHeader(){
  const brand=document.querySelector('.topbar-brand');
  if(!brand)return;
  if(!brand.querySelector('.topbar-platform-icon')){
   const icon=document.createElement('img');
   icon.className='topbar-platform-icon';
   icon.alt='';
   icon.src=ICON;
   brand.prepend(icon);
  }
 }
 function ensureFooter(){
  const bottom=document.querySelector('.mesraah-footer-bottom');
  if(!bottom)return false;
  let mark=bottom.querySelector('.mesraah-footer-platform');
  if(!mark){
   const old=[...bottom.children].find(el=>el.textContent.includes('مِسراح لإدارة المهام والإنجاز'));
   mark=document.createElement('span');
   mark.className='mesraah-footer-platform';
   if(old)old.replaceWith(mark);else bottom.prepend(mark);
  }
  if(!mark.dataset.ready){
   mark.innerHTML=`<img src="${ICON}" alt=""><span class="footer-platform-copy"><strong class="footer-name-ar">مِسْرَاح</strong><span class="footer-name-en">Mesraah</span><span class="footer-desc-ar">إدارة المهام والمتابعات والإنجاز اليومي</span><span class="footer-desc-en">Task, follow-up and daily achievement management</span></span>`;
   mark.dataset.ready='1';
  }
  return true;
 }
 function init(){
  ensureHeader();
  if(ensureFooter())return;
  const mo=new MutationObserver(()=>{
   if(ensureFooter())mo.disconnect();
  });
  mo.observe(document.body,{childList:true,subtree:true});
  setTimeout(()=>mo.disconnect(),3000);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();