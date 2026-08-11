import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app-check.js';

const APP_NAME = 'mesraah-voice';
const RECAPTCHA_SITE_KEY = '6LdgFnstAAAAAJod6T7NgPLzkfFkSYNbc4_q4rfe';
const firebaseConfig = {
  apiKey: 'AIzaSyAAvC9y5jQ_7fAwmkCqBtgFDrBRF5t4uI0',
  authDomain: 'mesraah-a2dfc.firebaseapp.com',
  projectId: 'mesraah-a2dfc',
  storageBucket: 'mesraah-a2dfc.firebasestorage.app',
  messagingSenderId: '986043593957',
  appId: '1:986043593957:web:b848313ef8cf83a5f3500c'
};

const app = getApps().find(item => item.name === APP_NAME) || initializeApp(firebaseConfig, APP_NAME);
const appCheck = window.__MESRAAH_VOICE_APPCHECK__ || initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
  isTokenAutoRefreshEnabled: true
});
window.__MESRAAH_VOICE_APPCHECK__ = appCheck;

function setVoiceDiag(stage, code, detail='') {
  window.MesraahVoiceDiagnostics = { stage, code, detail, at: Date.now() };
}

async function tokenOnce(forceRefresh=false) {
  setVoiceDiag('appcheck','requesting');
  const result = await getToken(appCheck, forceRefresh);
  if (!result?.token) throw new Error('voice-app-check-token-missing');
  setVoiceDiag('appcheck','ok');
  return result.token;
}

window.MesraahVoiceGetAppCheckToken = async ({ forceRefresh = false } = {}) => {
  try {
    return await tokenOnce(forceRefresh);
  } catch (firstError) {
    setVoiceDiag('appcheck','retrying',String(firstError?.message||firstError));
    await new Promise(r => setTimeout(r, 450));
    try {
      return await tokenOnce(true);
    } catch (secondError) {
      setVoiceDiag('appcheck','failed',String(secondError?.message||secondError));
      const error = new Error('voice-app-check-failed');
      error.cause = secondError;
      throw error;
    }
  }
};

function explainVoiceFailure() {
  const d = window.MesraahVoiceDiagnostics || {};
  if (d.stage === 'appcheck') return 'تعذر التحقق من أمان الاتصال. أعد المحاولة.';
  if (d.stage === 'worker' && d.code === 'timeout') return 'خدمة الاتصال الصوتي تأخرت في الاستجابة. حاول مرة أخرى.';
  if (d.stage === 'worker') return 'تعذر الحصول على تصريح المحادثة الصوتية من خادم مسراح.';
  if (d.stage === 'gemini') return 'تم الوصول إلى خادم مسراح، لكن جلسة Gemini الصوتية لم تبدأ.';
  return '';
}

new MutationObserver(() => {
  const status = document.getElementById('mesraahVoiceStatus');
  const detail = document.getElementById('mesraahVoiceDetail');
  if (!status || !detail) return;
  if (status.textContent?.includes('تعذر تشغيل المحادثة الصوتية')) {
    const message = explainVoiceFailure();
    if (message) detail.textContent = message;
  }
}).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
