import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
  onAuthStateChanged,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAAvC9y5jQ_7fAwmkCqBtgFDrBRF5t4uI0',
  authDomain: 'mesraah-a2dfc.firebaseapp.com',
  projectId: 'mesraah-a2dfc',
  storageBucket: 'mesraah-a2dfc.firebasestorage.app',
  messagingSenderId: '986043593957',
  appId: '1:986043593957:web:b848313ef8cf83a5f3500c'
};

const DATA_KEY = 'mesraah_v030';
const GUEST_KEY = 'mesraah_guest_v2';
const ACTIVE_UID_KEY = 'mesraah_active_uid_v2';
const CACHE_PREFIX = 'mesraah_user_cache_v2_';
const LINKED_PREFIX = 'mesraah_linked_v2_';
const DIRTY_PREFIX = 'mesraah_dirty_v2_';
const RELOAD_PREFIX = 'mesraah_reload_guard_v3_';
const SCHEMA_VERSION = 4;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
auth.languageCode = 'ar';

let currentUser = null;
let applyingState = false;
let authResolved = false;
let signingOut = false;
let saveTimer = null;
let lastObservedRaw = localStorage.getItem(DATA_KEY) || '{}';
let cloudStatus = 'حفظ محلي';

function parseState(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function currentRaw() {
  return localStorage.getItem(DATA_KEY) || '{}';
}

function currentState() {
  return parseState(currentRaw());
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = canonical(value[key]);
      return out;
    }, {});
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(canonical(value && typeof value === 'object' ? value : {}));
}

function statesEqual(a, b) {
  return stableStringify(a) === stableStringify(b);
}

function stateSignature(state) {
  const text = stableStringify(state);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function cacheKey(uid) { return CACHE_PREFIX + uid; }
function linkedKey(uid) { return LINKED_PREFIX + uid; }
function dirtyKey(uid) { return DIRTY_PREFIX + uid; }
function reloadKey(uid) { return RELOAD_PREFIX + uid; }
function userDoc(uid) { return doc(db, 'users', uid); }

function rememberGuest(raw = currentRaw()) {
  localStorage.setItem(GUEST_KEY, raw || '{}');
}

function applyState(uid, state, { reload = false } = {}) {
  const raw = JSON.stringify(state || {});
  const changed = !statesEqual(parseState(currentRaw()), state || {});

  applyingState = true;
  localStorage.setItem(ACTIVE_UID_KEY, uid);
  localStorage.setItem(cacheKey(uid), raw);
  localStorage.setItem(DATA_KEY, raw);
  lastObservedRaw = raw;
  applyingState = false;

  if (!changed || !reload) return false;

  const signature = stateSignature(state || {});
  const key = reloadKey(uid);
  if (sessionStorage.getItem(key) === signature) return false;
  sessionStorage.setItem(key, signature);
  location.reload();
  return true;
}

function restoreGuest() {
  const raw = localStorage.getItem(GUEST_KEY) || '{}';
  applyingState = true;
  localStorage.removeItem(ACTIVE_UID_KEY);
  localStorage.setItem(DATA_KEY, raw);
  lastObservedRaw = raw;
  applyingState = false;
  location.reload();
}

function mergeById(remoteItems, localItems) {
  const map = new Map();
  (Array.isArray(remoteItems) ? remoteItems : []).forEach(item => {
    if (item?.id != null) map.set(String(item.id), item);
  });
  (Array.isArray(localItems) ? localItems : []).forEach(item => {
    if (item?.id == null) return;
    const key = String(item.id);
    map.set(key, { ...(map.get(key) || {}), ...item });
  });
  return [...map.values()];
}

function mergeStates(remoteState, localState) {
  const remote = remoteState && typeof remoteState === 'object' ? remoteState : {};
  const local = localState && typeof localState === 'object' ? localState : {};
  const merged = { ...remote, ...local };

  ['spaces', 'people', 'rewards', 'tasks', 'pointLedger'].forEach(key => {
    merged[key] = mergeById(remote[key], local[key]);
  });

  merged.profile = { ...(remote.profile || {}), ...(local.profile || {}) };
  if (Object.prototype.hasOwnProperty.call(local, 'points')) merged.points = local.points;
  else if (Object.prototype.hasOwnProperty.call(remote, 'points')) merged.points = remote.points;
  if (Object.prototype.hasOwnProperty.call(local, 'pointsSchemaVersion')) merged.pointsSchemaVersion = local.pointsSchemaVersion;
  else if (Object.prototype.hasOwnProperty.call(remote, 'pointsSchemaVersion')) merged.pointsSchemaVersion = remote.pointsSchemaVersion;
  if (Object.prototype.hasOwnProperty.call(local, 'demoVersion')) merged.demoVersion = local.demoVersion;
  else if (Object.prototype.hasOwnProperty.call(remote, 'demoVersion')) merged.demoVersion = remote.demoVersion;
  return merged;
}

function hasRealLocalWork(state) {
  const defaultSpaces = new Set(['personal', 'work', 'family']);
  return Boolean(
    state?.profile?.name || state?.profile?.email ||
    (state?.tasks || []).some(item => !item?.demo) ||
    (state?.people || []).some(item => !item?.demo) ||
    (state?.spaces || []).some(item => !item?.demo && !defaultSpaces.has(String(item?.id || '')))
  );
}

async function readCloud(user) {
  const snapshot = await getDoc(userDoc(user.uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return data?.mesraah?.state && typeof data.mesraah.state === 'object' ? data.mesraah.state : null;
}

async function writeCloud(user, state) {
  const cleanState = JSON.parse(JSON.stringify(state || {}));
  await setDoc(userDoc(user.uid), {
    mesraah: {
      state: cleanState,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: serverTimestamp()
    },
    account: {
      email: user.email || '',
      displayName: user.displayName || ''
    }
  }, { merge: true });
  localStorage.setItem(cacheKey(user.uid), JSON.stringify(cleanState));
  localStorage.setItem(dirtyKey(user.uid), '0');
}

async function connectUser(user) {
  const previousUid = localStorage.getItem(ACTIVE_UID_KEY);
  const browserState = currentState();
  const firstSwitchToThisUser = previousUid !== user.uid;

  if (!previousUid) rememberGuest(currentRaw());

  setStatus('جار المزامنة');
  try {
    const remoteState = await readCloud(user);
    const cachedState = parseState(localStorage.getItem(cacheKey(user.uid)) || '{}');
    const alreadyLinked = localStorage.getItem(linkedKey(user.uid)) === '1';
    const dirty = localStorage.getItem(dirtyKey(user.uid)) === '1';
    let nextState = browserState;
    let shouldWrite = false;

    if (previousUid === user.uid) {
      if (dirty) {
        nextState = remoteState ? mergeStates(remoteState, browserState) : browserState;
        shouldWrite = true;
      } else if (remoteState) {
        nextState = remoteState;
      } else if (Object.keys(cachedState).length) {
        nextState = cachedState;
        shouldWrite = true;
      } else {
        nextState = browserState;
        shouldWrite = true;
      }
    } else if (!alreadyLinked) {
      if (remoteState) {
        nextState = hasRealLocalWork(browserState) ? mergeStates(remoteState, browserState) : remoteState;
        shouldWrite = hasRealLocalWork(browserState);
      } else {
        nextState = browserState;
        shouldWrite = true;
      }
      localStorage.setItem(linkedKey(user.uid), '1');
    } else if (remoteState) {
      nextState = remoteState;
    } else if (Object.keys(cachedState).length) {
      nextState = cachedState;
      shouldWrite = true;
    } else {
      nextState = browserState;
      shouldWrite = true;
    }

    if (shouldWrite) await writeCloud(user, nextState);
    else localStorage.setItem(dirtyKey(user.uid), '0');

    const changed = !statesEqual(browserState, nextState);
    const didReload = applyState(user.uid, nextState, { reload: firstSwitchToThisUser && changed });
    if (didReload) return;

    setStatus('تمت المزامنة');
    renderAccountUi();
  } catch (error) {
    console.error('Mesraah cloud connect:', error);
    const cachedState = parseState(localStorage.getItem(cacheKey(user.uid)) || '{}');
    if (firstSwitchToThisUser && Object.keys(cachedState).length) {
      const changed = !statesEqual(browserState, cachedState);
      const didReload = applyState(user.uid, cachedState, { reload: changed });
      if (didReload) return;
    } else {
      localStorage.setItem(ACTIVE_UID_KEY, user.uid);
    }
    setStatus('الحفظ على الجهاز يعمل');
    showToast(errorMessage(error), 4200);
    renderAccountUi();
  }
}

async function saveCurrentToCloud({ manual = false } = {}) {
  if (!currentUser || applyingState) return;
  try {
    setStatus('جار الحفظ');
    await writeCloud(currentUser, currentState());
    setStatus('تم الحفظ السحابي');
    if (manual) showToast('تمت مزامنة مسراح');
  } catch (error) {
    console.error('Mesraah cloud save:', error);
    setStatus('محفوظ على الجهاز، السحابة تنتظر الاتصال');
    if (manual) showToast(errorMessage(error), 4200);
  }
}

function watchLocalChanges() {
  if (applyingState) return;
  const raw = currentRaw();
  if (raw === lastObservedRaw) return;
  lastObservedRaw = raw;

  if (!currentUser && authResolved) renderAccountUi();

  if (currentUser) {
    localStorage.setItem(cacheKey(currentUser.uid), raw);
    localStorage.setItem(dirtyKey(currentUser.uid), '1');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveCurrentToCloud(), 900);
  } else if (authResolved) {
    rememberGuest(raw);
  }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>\"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  }[char]));
}

function showToast(message, duration = 2800) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function setStatus(value) {
  cloudStatus = value;
  const status = document.getElementById('mesraahCloudStatus');
  if (status) status.textContent = value;
  updateFooterNote();
}

function updateFooterNote() {
  const note = document.querySelector('.sidebar-footer > small');
  if (!note) return;
  note.textContent = currentUser ? cloudStatus : 'حفظ محلي على هذا الجهاز';
}

function accountName() {
  return (currentUser?.displayName || currentUser?.email || 'حسابي').trim();
}

function localProfileName() {
  try {
    const state = JSON.parse(localStorage.getItem(DATA_KEY) || '{}') || {};
    return String(state.profile?.name || '').trim();
  } catch { return ''; }
}

function avatarMarkup() {
  if (currentUser?.photoURL) return `<img src="${escapeHtml(currentUser.photoURL)}" alt="">`;
  return escapeHtml(accountName().charAt(0) || 'م');
}

function ensureUi() {
  const host = document.querySelector('.top-actions');
  if (host && !document.getElementById('cloudAccountBtn')) {
    const wrap = document.createElement('div');
    wrap.className = 'cloud-account-wrap';
    wrap.innerHTML = `
      <button class="cloud-account-btn" id="cloudAccountBtn" type="button" aria-label="تسجيل الدخول للحفظ السحابي">
        <span aria-hidden="true">☁</span><span class="cloud-account-label">دخول</span>
      </button>
      <div class="cloud-menu" id="cloudAccountMenu" hidden></div>
    `;
    const newTask = document.getElementById('newTaskBtn');
    host.insertBefore(wrap, newTask || null);

    document.getElementById('cloudAccountBtn').addEventListener('click', event => {
      event.stopPropagation();
      const menu = document.getElementById('cloudAccountMenu');
      menu.hidden = !menu.hidden;
    });

    document.addEventListener('click', event => {
      const menu = document.getElementById('cloudAccountMenu');
      if (menu && !wrap.contains(event.target)) menu.hidden = true;
    });
  }

  if (!document.getElementById('mesraahAuthOverlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'mesraahAuthOverlay';
    overlay.className = 'auth-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="auth-card" role="dialog" aria-modal="true" aria-labelledby="mesraahAuthTitle">
        <button class="auth-close" id="authCloseBtn" type="button" aria-label="إغلاق">×</button>
        <div class="auth-brand">
          <img src="mesraah-app-icon.svg?v=0.4.6" alt="">
          <div><strong id="mesraahAuthTitle">دخول مسراح</strong><span>احفظ مهامك وافتحها من أجهزتك</span></div>
        </div>
        <button class="auth-google" id="googleSignInBtn" type="button"><b>G</b> المتابعة بحساب Google</button>
        <div class="auth-divider">أو بالبريد</div>
        <form id="emailAuthForm">
          <div class="auth-field"><label for="authEmail">البريد الإلكتروني</label><input id="authEmail" type="email" autocomplete="email" required></div>
          <div class="auth-field"><label for="authPassword">كلمة المرور</label><input id="authPassword" type="password" autocomplete="current-password" minlength="6" required></div>
          <button class="auth-primary" id="emailSignInBtn" type="submit">دخول</button>
        </form>
        <div class="auth-secondary-row">
          <button class="auth-link" id="createAccountBtn" type="button">إنشاء حساب</button>
          <button class="auth-link" id="resetPasswordBtn" type="button">نسيت كلمة المرور</button>
        </div>
        <div class="auth-error" id="authError" role="status"></div>
        <p class="auth-note">تقدر تستخدم مسراح مباشرة بدون حساب. تسجيل الدخول يضيف الحفظ والمزامنة السحابية.</p>
      </section>
    `;
    document.body.appendChild(overlay);

    document.getElementById('authCloseBtn').addEventListener('click', closeAuth);
    overlay.addEventListener('click', event => { if (event.target === overlay) closeAuth(); });
    document.getElementById('googleSignInBtn').addEventListener('click', googleSignIn);
    document.getElementById('emailAuthForm').addEventListener('submit', emailSignIn);
    document.getElementById('createAccountBtn').addEventListener('click', createEmailAccount);
    document.getElementById('resetPasswordBtn').addEventListener('click', resetPassword);
  }
}

function openAuth() {
  ensureUi();
  const overlay = document.getElementById('mesraahAuthOverlay');
  setAuthError('');
  overlay.hidden = false;
  setTimeout(() => document.getElementById('authEmail')?.focus(), 40);
}

function closeAuth() {
  const overlay = document.getElementById('mesraahAuthOverlay');
  if (overlay) overlay.hidden = true;
}

function authInputs() {
  return {
    email: document.getElementById('authEmail')?.value.trim() || '',
    password: document.getElementById('authPassword')?.value || ''
  };
}

function setAuthError(message = '') {
  const el = document.getElementById('authError');
  if (el) el.textContent = message;
}

function setAuthBusy(busy) {
  ['googleSignInBtn', 'emailSignInBtn', 'createAccountBtn', 'resetPasswordBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = busy;
  });
}

async function googleSignIn() {
  setAuthError('');
  setAuthBusy(true);
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
    closeAuth();
  } catch (error) {
    console.error('Mesraah Google auth:', error);
    setAuthError(errorMessage(error));
  } finally {
    setAuthBusy(false);
  }
}

async function emailSignIn(event) {
  event.preventDefault();
  const { email, password } = authInputs();
  setAuthError('');
  setAuthBusy(true);
  try {
    await signInWithEmailAndPassword(auth, email, password);
    closeAuth();
  } catch (error) {
    console.error('Mesraah email sign in:', error);
    setAuthError(errorMessage(error));
  } finally {
    setAuthBusy(false);
  }
}

async function createEmailAccount() {
  const { email, password } = authInputs();
  if (!email || password.length < 6) {
    setAuthError('اكتب بريد صحيح وكلمة مرور من 6 أحرف على الأقل');
    return;
  }
  setAuthError('');
  setAuthBusy(true);
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    closeAuth();
  } catch (error) {
    console.error('Mesraah create account:', error);
    setAuthError(errorMessage(error));
  } finally {
    setAuthBusy(false);
  }
}

async function resetPassword() {
  const { email } = authInputs();
  if (!email) {
    setAuthError('اكتب بريدك الإلكتروني أولا');
    return;
  }
  setAuthError('');
  setAuthBusy(true);
  try {
    await sendPasswordResetEmail(auth, email);
    setAuthError('تم إرسال رابط إعادة كلمة المرور إلى بريدك');
  } catch (error) {
    console.error('Mesraah reset password:', error);
    setAuthError(errorMessage(error));
  } finally {
    setAuthBusy(false);
  }
}

async function signOutToGuest() {
  if (!currentUser || signingOut) return;
  signingOut = true;
  const uid = currentUser.uid;
  try {
    await saveCurrentToCloud();
    localStorage.setItem(cacheKey(uid), currentRaw());
    await signOut(auth);
    restoreGuest();
  } catch (error) {
    signingOut = false;
    console.error('Mesraah sign out:', error);
    showToast('تعذر تسجيل الخروج الآن');
  }
}

function renderAccountUi() {
  ensureUi();
  const button = document.getElementById('cloudAccountBtn');
  const menu = document.getElementById('cloudAccountMenu');
  if (!button || !menu) return;

  if (!currentUser) {
    const name = localProfileName();
    button.innerHTML = `<span class="cloud-avatar">${escapeHtml((name || 'م').charAt(0))}</span><span class="cloud-account-label">${escapeHtml(name || 'الحساب')}</span>`;
    button.setAttribute('aria-label', 'الحساب وإدارة مسراح');
    menu.hidden = true;
    menu.innerHTML = `
      <div class="cloud-account-info">
        <span class="cloud-avatar">${escapeHtml((name || 'م').charAt(0))}</span>
        <div><strong>${escapeHtml(name || 'مسراح على هذا الجهاز')}</strong><small>حفظ محلي</small></div>
      </div>
      <div class="cloud-menu-actions cloud-menu-actions-stack">
        <button class="cloud-manage-btn" id="cloudOpenManage" data-open-view="manage" type="button">إدارة مسراح</button>
        <button class="cloud-signin-btn" id="cloudOpenAuth" type="button">تسجيل الدخول</button>
      </div>`;
    document.getElementById('cloudOpenManage')?.addEventListener('click', () => { menu.hidden = true; });
    document.getElementById('cloudOpenAuth')?.addEventListener('click', () => { menu.hidden = true; openAuth(); });
    updateFooterNote();
    return;
  }

  button.innerHTML = `<span class="cloud-avatar">${avatarMarkup()}</span><span class="cloud-account-label">${escapeHtml(accountName().split(/\s+/)[0])}</span>`;
  button.setAttribute('aria-label', 'الحساب السحابي');
  menu.innerHTML = `
    <div class="cloud-account-info">
      <span class="cloud-avatar">${avatarMarkup()}</span>
      <div><strong>${escapeHtml(accountName())}</strong><small>${escapeHtml(currentUser.email || '')}</small></div>
    </div>
    <div class="cloud-status-row"><span id="mesraahCloudStatus">${escapeHtml(cloudStatus)}</span></div>
    <div class="cloud-menu-actions">
      <button class="cloud-manage-btn" id="cloudOpenManage" data-open-view="manage" type="button">الإدارة</button>
      <button class="cloud-sync-btn" id="cloudSyncNow" type="button">مزامنة الآن</button>
      <button class="cloud-signout-btn" id="cloudSignOut" type="button">تسجيل الخروج</button>
    </div>
  `;
  updateFooterNote();

  document.getElementById('cloudOpenManage')?.addEventListener('click', () => { menu.hidden = true; });

  document.getElementById('cloudSyncNow')?.addEventListener('click', async () => {
    menu.hidden = true;
    await saveCurrentToCloud({ manual: true });
  });
  document.getElementById('cloudSignOut')?.addEventListener('click', async () => {
    menu.hidden = true;
    await signOutToGuest();
  });
}

function errorMessage(error) {
  const code = String(error?.code || '');
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'البريد أو كلمة المرور غير صحيحة';
  if (code.includes('email-already-in-use')) return 'هذا البريد مسجل مسبقا، استخدم دخول';
  if (code.includes('weak-password')) return 'كلمة المرور تحتاج 6 أحرف على الأقل';
  if (code.includes('invalid-email')) return 'صيغة البريد الإلكتروني غير صحيحة';
  if (code.includes('too-many-requests')) return 'محاولات كثيرة، جرب بعد قليل';
  if (code.includes('unauthorized-domain')) return 'نطاق الموقع يحتاج إضافته في Authorized domains';
  if (code.includes('operation-not-allowed')) return 'طريقة الدخول تحتاج تفعيلها في Firebase Authentication';
  if (code.includes('permission-denied')) return 'قواعد Firestore تمنع الوصول إلى بيانات الحساب';
  if (code.includes('popup-closed-by-user')) return 'تم إغلاق نافذة تسجيل الدخول';
  if (code.includes('popup-blocked')) return 'اسمح بالنوافذ المنبثقة لمسراح ثم أعد المحاولة';
  if (code.includes('network-request-failed') || code.includes('unavailable')) return 'الاتصال بالسحابة غير متاح الآن';
  return 'تعذر إكمال العملية الآن';
}

async function boot() {
  ensureUi();
  if (!localStorage.getItem(GUEST_KEY) && !localStorage.getItem(ACTIVE_UID_KEY)) rememberGuest(currentRaw());
  renderAccountUi();

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.warn('Mesraah auth persistence:', error);
  }

  onAuthStateChanged(auth, async user => {
    authResolved = true;

    if (user) {
      currentUser = user;
      signingOut = false;
      closeAuth();
      renderAccountUi();
      await connectUser(user);
      return;
    }

    if (signingOut) return;

    const hadActiveAccount = Boolean(localStorage.getItem(ACTIVE_UID_KEY));
    currentUser = null;
    cloudStatus = 'حفظ محلي';
    renderAccountUi();

    if (hadActiveAccount) restoreGuest();
    else rememberGuest(currentRaw());
  });

  setInterval(watchLocalChanges, 5000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) watchLocalChanges();
  });
}

boot();
