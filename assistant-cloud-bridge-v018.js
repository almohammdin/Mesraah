import { getApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const DATA_KEY='mesraah_v030';
function readState(){try{return JSON.parse(localStorage.getItem(DATA_KEY)||'{}')||{}}catch{return {}}}
async function saveNow(){
  const app=getApp(),auth=getAuth(app),user=auth.currentUser;
  if(!user)return {ok:true,mode:'local'};
  const db=getFirestore(app),state=readState();
  await setDoc(doc(db,'users',user.uid),{mesraah:{state,schemaVersion:4,updatedAt:serverTimestamp()},account:{email:user.email||'',displayName:user.displayName||''}},{merge:true});
  localStorage.setItem(`mesraah_user_cache_v2_${user.uid}`,JSON.stringify(state));
  localStorage.setItem(`mesraah_dirty_v2_${user.uid}`,'0');
  return {ok:true,mode:'cloud'};
}
window.MesraahCloudBridge={saveNow};
