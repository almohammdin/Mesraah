import { getApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app-check.js';

const RECAPTCHA_SITE_KEY = '6LdgFnstAAAAAJod6T7NgPLzkfFkSYNbc4_q4rfe';
const app = getApp();

try {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true
  });
} catch (error) {
  if (!String(error?.message || '').includes('already')) {
    console.warn('Mesraah App Check core:', error);
    throw error;
  }
}

window.MesraahFirebaseApp = app;
window.dispatchEvent(new CustomEvent('mesraah:appcheck-ready'));
