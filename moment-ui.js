(() => {
  const hijri = document.getElementById('todayHijri');
  const gregorian = document.getElementById('todayGregorian');
  const time = document.getElementById('todayTime');
  const toggle = document.getElementById('timeToggle');
  if (!hijri || !gregorian || !time || !toggle) return;

  const CLOCK_KEY = 'mesraah_clock24';
  let is24 = localStorage.getItem(CLOCK_KEY) === '1';

  const clean = value => value.replace(/،/g, '').replace(/\s+/g, ' ').trim();
  const renderDate = now => {
    hijri.textContent = clean(new Intl.DateTimeFormat('ar-SA-u-ca-islamic-nu-latn', {
      day: 'numeric', month: 'long', year: 'numeric'
    }).format(now));
    gregorian.textContent = clean(new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
      day: 'numeric', month: 'long', year: 'numeric'
    }).format(now));
  };
  const renderTime = now => {
    const h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, '0');
    if (is24) {
      time.textContent = `${String(h).padStart(2, '0')}:${m}`;
      toggle.title = 'التحويل إلى نظام 12 ساعة';
      toggle.setAttribute('aria-label', 'الساعة بنظام 24 ساعة، اضغط للتحويل إلى 12 ساعة');
    } else {
      const h12 = h % 12 || 12;
      time.textContent = `${h12}:${m} ${h < 12 ? 'صباحا' : 'مساء'}`;
      toggle.title = 'التحويل إلى نظام 24 ساعة';
      toggle.setAttribute('aria-label', 'الساعة بنظام 12 ساعة، اضغط للتحويل إلى 24 ساعة');
    }
  };
  const render = () => { const now = new Date(); renderDate(now); renderTime(now); };
  toggle.addEventListener('click', () => {
    is24 = !is24;
    localStorage.setItem(CLOCK_KEY, is24 ? '1' : '0');
    renderTime(new Date());
  });
  render();
  setInterval(render, 30000);
})();

// Cloud account + sync layer. Mesraah remains fully usable without signing in.
(() => {
  const DATA_KEY = 'mesraah_v030';
  const GUEST_KEY = 'mesraah_guest_v1';
  const ACTIVE_UID_KEY = 'mesraah_active_uid';
  const ACCOUNT_CACHE_PREFIX = 'mesraah_account_v1_';
  const LINKED_PREFIX = 'mesraah_cloud_linked_v1_';
  const DIRTY_PREFIX = 'mesraah_cloud_dirty_v1_';

  const firebaseConfig = {
    apiKey: 'AIzaSyAAvC9y5jQ_7fAwmkCqBtgFDrBRF5t4uI0',
    authDomain: 'mesraah-a2dfc.firebaseapp.com',
    projectId: 'mesraah-a2dfc',
    storageBucket: 'mesraah-a2dfc.firebasestorage.app',
    messagingSenderId: '986043593957',
    appId: '1:986043593957:web:b848313ef8cf83a5f3500c'
  };

  const originalSetItem = Storage.prototype.setItem;
  let applyingCloudState = false;
  let auth = null;
  let db = null;
  let authSdk = null;
  let fsSdk = null;
  let syncTimer = null;
  let currentUser = null;
  let statusText = 'حفظ محلي';

  const rawState = () => localStorage.getItem(DATA_KEY) || '{}';
  const safeParse = raw => {
    try { return JSON.parse(raw || '{}') || {}; } catch { return {}; }
  };
  const setRaw = (key, value) => originalSetItem.call(localStorage, key, value);

  const activeUidAtBoot = localStorage.getItem(ACTIVE_UID_KEY);
  if (!activeUidAtBoot && !localStorage.getItem(GUEST_KEY)) setRaw(GUEST_KEY, rawState());
  if (activeUidAtBoot && !localStorage.getItem(ACCOUNT_CACHE_PREFIX + activeUidAtBoot)) {
    setRaw(ACCOUNT_CACHE_PREFIX + activeUidAtBoot, rawState());
  }

  Storage.prototype.setItem = function(key, value) {
    originalSetItem.call(this, key, value);
    if (this !== localStorage || key !== DATA_KEY || applyingCloudState) return;

    const activeUid = localStorage.getItem(ACTIVE_UID_KEY);
    if (activeUid) {
      originalSetItem.call(localStorage, ACCOUNT_CACHE_PREFIX + activeUid, value);
      originalSetItem.call(localStorage, DIRTY_PREFIX + activeUid, '1');
    } else {
      originalSetItem.call(localStorage, GUEST_KEY, value);
    }
    window.dispatchEvent(new CustomEvent('mesraah:local-save', { detail: { activeUid } }));
  };

  function toast(message, duration = 2600) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    window.setTimeout(() => el.classList.remove('show'), duration);
  }

  function injectStyles() {
    if (document.getElementById('mesraahCloudStyles')) return;
    const style = document.createElement('style');
    style.id = 'mesraahCloudStyles';
    style.textContent = `
      .mesraah-cloud-wrap{position:relative;display:flex;align-items:center}
      .mesraah-cloud-btn{height:38px;border:1px solid rgba(13,54,86,.16);background:#fff;color:#0D3656;border-radius:12px;padding:0 11px;display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;box-shadow:0 2px 10px rgba(13,54,86,.05)}
      .mesraah-cloud-btn:hover{transform:translateY(-1px);border-color:rgba(13,54,86,.3)}
      .mesraah-cloud-icon{font-size:15px;line-height:1}
      .mesraah-cloud-avatar{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#0D3656;color:#fff;font-size:11px;overflow:hidden}
      .mesraah-cloud-avatar img{width:100%;height:100%;object-fit:cover}
      .mesraah-cloud-menu{position:absolute;top:46px;left:0;width:min(300px,calc(100vw - 28px));background:#fff;border:1px solid rgba(13,54,86,.14);box-shadow:0 18px 42px rgba(13,54,86,.16);border-radius:16px;padding:13px;z-index:120;direction:rtl}
      .mesraah-cloud-menu[hidden]{display:none}
      .mesraah-cloud-account{display:flex;gap:10px;align-items:center;padding:4px 2px 11px;border-bottom:1px solid rgba(13,54,86,.09)}
      .mesraah-cloud-account .mesraah-cloud-avatar{width:36px;height:36px;font-size:14px;flex:0 0 auto}
      .mesraah-cloud-account strong,.mesraah-cloud-account small{display:block;max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .mesraah-cloud-account small{margin-top:2px;color:#61717e;font-size:11px}
      .mesraah-cloud-status{display:flex;align-items:center;gap:7px;padding:11px 3px;color:#48606f;font-size:12px}
      .mesraah-cloud-status-dot{width:7px;height:7px;border-radius:50%;background:#2c8b63;box-shadow:0 0 0 4px rgba(44,139,99,.09)}
      .mesraah-cloud-menu-actions{display:flex;gap:8px}
      .mesraah-cloud-menu button{font:inherit;cursor:pointer}
      .mesraah-sync-btn,.mesraah-signout-btn{flex:1;border-radius:10px;padding:8px 9px;font-size:12px;font-weight:700}
      .mesraah-sync-btn{border:1px solid rgba(13,54,86,.16);background:#f5f8fa;color:#0D3656}
      .mesraah-signout-btn{border:0;background:#0D3656;color:#fff}
      html[data-theme="dark"] .mesraah-cloud-btn,body.dark .mesraah-cloud-btn,html.dark .mesraah-cloud-btn{background:#132f43;color:#fff;border-color:rgba(255,255,255,.13)}
      html[data-theme="dark"] .mesraah-cloud-menu,body.dark .mesraah-cloud-menu,html.dark .mesraah-cloud-menu{background:#132f43;color:#fff;border-color:rgba(255,255,255,.13)}
      html[data-theme="dark"] .mesraah-cloud-account,body.dark .mesraah-cloud-account,html.dark .mesraah-cloud-account{border-color:rgba(255,255,255,.1)}
      html[data-theme="dark"] .mesraah-cloud-account small,html[data-theme="dark"] .mesraah-cloud-status,body.dark .mesraah-cloud-account small,body.dark .mesraah-cloud-status{color:#b6c5cf}
      html[data-theme="dark"] .mesraah-sync-btn,body.dark .mesraah-sync-btn{background:#1b3c52;color:#fff;border-color:rgba(255,255,255,.12)}
      @media(max-width:760px){.mesraah-cloud-label{display:none}.mesraah-cloud-btn{width:38px;padding:0;justify-content:center}.mesraah-cloud-menu{position:fixed;top:64px;left:14px}}
    `;
    document.head.appendChild(style);
  }

  function createUi() {
    injectStyles();
    const host = document.querySelector('.top-actions');
    if (!host || document.getElementById('cloudAuthBtn')) return;

    const wrap = document.createElement('div');
    wrap.className = 'mesraah-cloud-wrap';
    wrap.innerHTML = `
      <button class="mesraah-cloud-btn" id="cloudAuthBtn" type="button" aria-label="تسجيل الدخول والحفظ السحابي">
        <span class="mesraah-cloud-icon">☁</span><span class="mesraah-cloud-label">دخول</span>
      </button>
      <div class="mesraah-cloud-menu" id="cloudAuthMenu" hidden></div>
    `;
    const newTask = document.getElementById('newTaskBtn');
    host.insertBefore(wrap, newTask || null);

    document.getElementById('cloudAuthBtn').addEventListener('click', async event => {
      event.stopPropagation();
      if (!currentUser) {
        await startGoogleSignIn();
        return;
      }
      const menu = document.getElementById('cloudAuthMenu');
      menu.hidden = !menu.hidden;
    });
    document.addEventListener('click', event => {
      const menu = document.getElementById('cloudAuthMenu');
      if (menu && !wrap.contains(event.target)) menu.hidden = true;
    });
  }

  function accountName(user) {
    return (user?.displayName || user?.email || 'حسابي').trim();
  }

  function avatarHtml(user, classOnly = false) {
    const first = accountName(user).charAt(0) || 'م';
    const inner = user?.photoURL
      ? `<img src="${String(user.photoURL).replace(/"/g, '&quot;')}" alt="">`
      : first;
    return classOnly ? inner : `<span class="mesraah-cloud-avatar">${inner}</span>`;
  }

  function updateFooterNote(user) {
    const note = document.querySelector('.sidebar-footer > small');
    if (!note) return;
    note.textContent = user ? 'حفظ ومزامنة سحابية' : 'حفظ محلي على هذا الجهاز';
  }

  function renderUi(user, status = statusText) {
    currentUser = user || null;
    statusText = status;
    createUi();
    const btn = document.getElementById('cloudAuthBtn');
    const menu = document.getElementById('cloudAuthMenu');
    if (!btn || !menu) return;

    if (!user) {
      btn.innerHTML = '<span class="mesraah-cloud-icon">☁</span><span class="mesraah-cloud-label">دخول</span>';
      btn.setAttribute('aria-label', 'تسجيل الدخول للحفظ السحابي');
      menu.hidden = true;
      menu.innerHTML = '';
      updateFooterNote(null);
      return;
    }

    btn.innerHTML = `${avatarHtml(user)}<span class="mesraah-cloud-label">${accountName(user).split(/\s+/)[0]}</span>`;
    btn.setAttribute('aria-label', 'الحساب السحابي');
    menu.innerHTML = `
      <div class="mesraah-cloud-account">
        ${avatarHtml(user)}
        <div><strong>${escapeHtml(accountName(user))}</strong><small>${escapeHtml(user.email || '')}</small></div>
      </div>
      <div class="mesraah-cloud-status"><span class="mesraah-cloud-status-dot"></span><span>${escapeHtml(status)}</span></div>
      <div class="mesraah-cloud-menu-actions">
        <button class="mesraah-sync-btn" id="cloudSyncNow" type="button">مزامنة الآن</button>
        <button class="mesraah-signout-btn" id="cloudSignOut" type="button">تسجيل الخروج</button>
      </div>
    `;
    updateFooterNote(user);

    document.getElementById('cloudSyncNow')?.addEventListener('click', async () => {
      menu.hidden = true;
      await syncCurrentAccount(user, true);
    });
    document.getElementById('cloudSignOut')?.addEventListener('click', async () => {
      menu.hidden = true;
      await signOutToGuest();
    });
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>\"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
    }[char]));
  }

  function mergeById(remoteItems, localItems) {
    const map = new Map();
    (Array.isArray(remoteItems) ? remoteItems : []).forEach(item => {
      if (item && item.id != null) map.set(String(item.id), item);
    });
    (Array.isArray(localItems) ? localItems : []).forEach(item => {
      if (!item || item.id == null) return;
      const key = String(item.id);
      map.set(key, { ...(map.get(key) || {}), ...item });
    });
    return [...map.values()];
  }

  function mergeStates(remoteState, localState, user) {
    const remote = remoteState && typeof remoteState === 'object' ? remoteState : {};
    const local = localState && typeof localState === 'object' ? localState : {};
    const merged = { ...remote, ...local };
    ['spaces', 'people', 'rewards', 'tasks'].forEach(key => {
      merged[key] = mergeById(remote[key], local[key]);
    });
    merged.profile = { ...(remote.profile || {}), ...(local.profile || {}) };
    if (!merged.profile.name && user?.displayName) merged.profile.name = user.displayName;
    if (user?.email) merged.profile.email = user.email;
    merged.points = Math.max(Number(remote.points || 0), Number(local.points || 0));
    merged.demoVersion = Math.max(Number(remote.demoVersion || 0), Number(local.demoVersion || 0));
    return merged;
  }

  function cloudDoc(uid) {
    return fsSdk.doc(db, 'users', uid, 'apps', 'mesraah');
  }

  async function writeCloud(uid, state) {
    const cleanState = JSON.parse(JSON.stringify(state || {}));
    await fsSdk.setDoc(cloudDoc(uid), {
      state: cleanState,
      schema: 1,
      updatedAt: fsSdk.serverTimestamp()
    }, { merge: true });
    setRaw(ACCOUNT_CACHE_PREFIX + uid, JSON.stringify(cleanState));
    setRaw(DIRTY_PREFIX + uid, '0');
  }

  function applyAccountState(uid, state, reload = true) {
    const nextRaw = JSON.stringify(state || {});
    const changed = nextRaw !== rawState();
    applyingCloudState = true;
    setRaw(ACTIVE_UID_KEY, uid);
    setRaw(ACCOUNT_CACHE_PREFIX + uid, nextRaw);
    setRaw(DIRTY_PREFIX + uid, '0');
    setRaw(DATA_KEY, nextRaw);
    applyingCloudState = false;
    if (changed && reload) location.reload();
  }

  async function syncCurrentAccount(user, manual = false) {
    if (!user || !db || !fsSdk) return;
    const uid = user.uid;
    renderUi(user, 'جار المزامنة');
    try {
      const snap = await fsSdk.getDoc(cloudDoc(uid));
      const remoteState = snap.exists() ? (snap.data().state || {}) : null;
      const linked = localStorage.getItem(LINKED_PREFIX + uid) === '1';
      const activeUid = localStorage.getItem(ACTIVE_UID_KEY);
      const dirty = localStorage.getItem(DIRTY_PREFIX + uid) === '1';
      const localState = safeParse(rawState());
      const cachedState = safeParse(localStorage.getItem(ACCOUNT_CACHE_PREFIX + uid));

      let nextState;
      let shouldWrite = false;

      if (!linked) {
        if (!activeUid) setRaw(GUEST_KEY, rawState());
        nextState = remoteState ? mergeStates(remoteState, localState, user) : mergeStates({}, localState, user);
        setRaw(LINKED_PREFIX + uid, '1');
        shouldWrite = true;
      } else if (activeUid === uid && dirty) {
        nextState = remoteState ? mergeStates(remoteState, localState, user) : localState;
        shouldWrite = true;
      } else if (remoteState) {
        nextState = remoteState;
      } else if (Object.keys(cachedState).length) {
        nextState = cachedState;
        shouldWrite = true;
      } else {
        nextState = mergeStates({}, localState, user);
        shouldWrite = true;
      }

      nextState.profile = { ...(nextState.profile || {}) };
      if (!nextState.profile.name && user.displayName) nextState.profile.name = user.displayName;
      if (user.email) nextState.profile.email = user.email;

      if (shouldWrite) await writeCloud(uid, nextState);
      const changed = JSON.stringify(nextState) !== rawState();
      applyAccountState(uid, nextState, false);
      renderUi(user, 'تمت المزامنة');
      if (manual) toast('تمت مزامنة مسراح');
      if (changed) location.reload();
    } catch (error) {
      console.error('Mesraah cloud sync:', error);
      const cached = safeParse(localStorage.getItem(ACCOUNT_CACHE_PREFIX + uid));
      if (Object.keys(cached).length && localStorage.getItem(ACTIVE_UID_KEY) !== uid) {
        applyAccountState(uid, cached, false);
        location.reload();
        return;
      }
      renderUi(user, 'الحفظ المحلي يعمل · إعداد السحابة يحتاج إكمال');
      if (manual) toast(cloudErrorMessage(error), 4200);
    }
  }

  async function pushLocalState() {
    const user = auth?.currentUser;
    if (!user || !db || !fsSdk) return;
    try {
      renderUi(user, 'جار الحفظ');
      await writeCloud(user.uid, safeParse(rawState()));
      renderUi(user, 'تم الحفظ السحابي');
    } catch (error) {
      console.error('Mesraah cloud save:', error);
      renderUi(user, 'محفوظ على الجهاز · السحابة تنتظر الاتصال');
    }
  }

  window.addEventListener('mesraah:local-save', () => {
    if (!auth?.currentUser) return;
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(pushLocalState, 850);
  });

  async function startGoogleSignIn() {
    if (!auth || !authSdk) {
      toast('الحفظ السحابي قيد التجهيز');
      return;
    }
    try {
      const provider = new authSdk.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await authSdk.signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Mesraah sign in:', error);
      toast(cloudErrorMessage(error), 4800);
    }
  }

  async function signOutToGuest() {
    const user = auth?.currentUser;
    if (!user || !authSdk) return;
    try {
      setRaw(ACCOUNT_CACHE_PREFIX + user.uid, rawState());
      await authSdk.signOut(auth);
      restoreGuestState();
    } catch (error) {
      console.error('Mesraah sign out:', error);
      toast('تعذر تسجيل الخروج الآن');
    }
  }

  function restoreGuestState() {
    const guestRaw = localStorage.getItem(GUEST_KEY) || '{}';
    applyingCloudState = true;
    localStorage.removeItem(ACTIVE_UID_KEY);
    setRaw(DATA_KEY, guestRaw);
    applyingCloudState = false;
    location.reload();
  }

  function cloudErrorMessage(error) {
    const code = String(error?.code || '');
    if (code.includes('unauthorized-domain')) return 'أضف almohammdin.github.io ضمن Authorized domains في Firebase';
    if (code.includes('operation-not-allowed')) return 'فعّل تسجيل الدخول عبر Google في Firebase Authentication';
    if (code.includes('permission-denied')) return 'قواعد Firestore تحتاج السماح لكل مستخدم ببيانات حسابه';
    if (code.includes('popup-closed-by-user')) return 'تم إغلاق نافذة تسجيل الدخول';
    if (code.includes('popup-blocked')) return 'اسمح بالنوافذ المنبثقة لمسراح ثم أعد المحاولة';
    return 'تعذر إكمال الاتصال السحابي الآن';
  }

  async function bootCloud() {
    createUi();
    renderUi(null, 'حفظ محلي');
    try {
      const [appSdk, loadedAuthSdk, loadedFsSdk] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js')
      ]);
      authSdk = loadedAuthSdk;
      fsSdk = loadedFsSdk;
      const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(firebaseConfig);
      auth = authSdk.getAuth(app);
      db = fsSdk.getFirestore(app);
      auth.languageCode = 'ar';
      await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);

      authSdk.onAuthStateChanged(auth, async user => {
        if (user) {
          renderUi(user, 'جار المزامنة');
          await syncCurrentAccount(user, false);
          return;
        }
        const activeUid = localStorage.getItem(ACTIVE_UID_KEY);
        if (activeUid) {
          restoreGuestState();
          return;
        }
        renderUi(null, 'حفظ محلي');
      });
    } catch (error) {
      console.error('Mesraah Firebase boot:', error);
      renderUi(null, 'حفظ محلي');
    }
  }

  bootCloud();
})();
