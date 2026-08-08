import { getApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  getAppCheck,
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app-check.js';

const RECAPTCHA_SITE_KEY = '6LdgFnstAAAAAJod6T7NgPLzkfFkSYNbc4_q4rfe';
const app = getApp();
let appCheck;

try {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });
} catch (error) {
  if (!String(error?.message || '').includes('already')) {
    console.warn('Mesraah App Check core:', error);
    throw error;
  }
  appCheck = getAppCheck(app);
}

window.MesraahFirebaseApp = app;
window.MesraahAppCheck = appCheck;
window.MesraahGetAppCheckToken = async ({ forceRefresh = false } = {}) => {
  const result = await getToken(appCheck, forceRefresh);
  if (!result?.token) throw new Error('app-check-token-missing');
  return result.token;
};
window.dispatchEvent(new CustomEvent('mesraah:appcheck-ready'));
