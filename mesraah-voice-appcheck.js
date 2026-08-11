import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app-check.js';

const APP_NAME='mesraah-voice';
const RECAPTCHA_SITE_KEY='6LdgFnstAAAAAJod6T7NgPLzkfFkSYNbc4_q4rfe';
const firebaseConfig={
  apiKey:'AIzaSyAAvC9y5jQ_7fAwmkCqBtgFDrBRF5t4uI0',
  authDomain:'mesraah-a2dfc.firebaseapp.com',
  projectId:'mesraah-a2dfc',
  storageBucket:'mesraah-a2dfc.firebasestorage.app',
  messagingSenderId:'986043593957',
  appId:'1:986043593957:web:b848313ef8cf83a5f3500c'
};

const app=getApps().find(item=>item.name===APP_NAME)||initializeApp(firebaseConfig,APP_NAME);
const appCheck=window.__MESRAAH_VOICE_APPCHECK__||initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),isTokenAutoRefreshEnabled:true});
window.__MESRAAH_VOICE_APPCHECK__=appCheck;
window.MesraahVoiceFirebaseApp=app;
window.MesraahVoiceFirebaseAppCheck=appCheck;

function diag(code,detail=''){window.MesraahVoiceDiagnostics={stage:'firebase-appcheck',code,detail,at:Date.now()}}
async function tokenOnce(forceRefresh=false){diag('requesting');const result=await getToken(appCheck,forceRefresh);if(!result?.token)throw new Error('voice-app-check-token-missing');diag('ok');return result.token}
window.MesraahVoiceGetAppCheckToken=async({forceRefresh=false}={})=>{try{return await tokenOnce(forceRefresh)}catch(first){diag('retrying',String(first?.message||first));await new Promise(r=>setTimeout(r,350));try{return await tokenOnce(true)}catch(second){diag('failed',String(second?.message||second));const error=new Error('voice-app-check-failed');error.cause=second;throw error}}};
