const {onSchedule}=require('firebase-functions/v2/scheduler');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {setGlobalOptions}=require('firebase-functions/v2/options');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {runPolicy,scheduleSlot,isSlotBoundary}=require('./agent-policy');

initializeApp();
setGlobalOptions({region:'us-central1',maxInstances:3,memory:'256MiB',timeoutSeconds:120});

async function processUserDocument(snapshot,reason,{now=new Date(),slot=''}={}){
  const state=snapshot.data()?.mesraah?.state;
  if(!state||typeof state!=='object')return {skipped:true,reason:'state-not-found'};
  const output=runPolicy(state,reason,now,slot);
  if(output.skipped)return output;
  await snapshot.ref.update({
    'mesraah.state.agent':output.agent,
    'mesraah.agentUpdatedAt':FieldValue.serverTimestamp()
  });
  return output;
}

exports.runMesraahAgent=onSchedule({schedule:'0 6-21 * * *',timeZone:'Asia/Riyadh'},async()=>{
  const now=new Date(),slot=scheduleSlot(now);
  if(!isSlotBoundary(now,slot)){
    console.log('Mesraah agent skipped between schedule slots',{slot});
    return;
  }
  const db=getFirestore();
  let cursor=null,processed=0,updated=0;
  do{
    let query=db.collection('users').orderBy('__name__').limit(200);
    if(cursor)query=query.startAfter(cursor);
    const page=await query.get();
    for(const snapshot of page.docs){
      const output=await processUserDocument(snapshot,'cloud-schedule',{now,slot});
      processed+=1;
      if(!output.skipped)updated+=1;
    }
    cursor=page.docs.at(-1)||null;
    if(page.size<200)break;
  }while(cursor);
  console.log('Mesraah agent schedule complete',{processed,updated});
});

exports.runMyMesraahAgent=onCall(async request=>{
  if(!request.auth?.uid)throw new HttpsError('unauthenticated','Sign in to run the agent.');
  const snapshot=await getFirestore().collection('users').doc(request.auth.uid).get();
  if(!snapshot.exists)throw new HttpsError('not-found','Mesraah account was not found.');
  const output=await processUserDocument(snapshot,'cloud-manual');
  return {ok:!output.skipped,skipped:Boolean(output.skipped),reason:output.reason||'',result:output.result||null};
});
