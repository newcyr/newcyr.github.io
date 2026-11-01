/* 我的世界联机服 · 登录凭证模块
 * 登录凭证写入 localStorage，有效期 30 天，全站通用；
 * 无本地后台时仍可凭缓存进入联机页，仅服务器相关功能不可用。
 */
(function () {
  const KEY = 'mc_auth_v1';
  const BACKEND_KEY = 'mc_backend';
  const DAY = 24 * 60 * 60 * 1000;
  const TTL = 30 * DAY;
  const DEFAULT_BACKEND = 'http://127.0.0.1:8860';

  /* auth.js 位于 <站点根>/mc/assets/，账号数据固定读取 /mc/accounts.json，
     这样 /login、/signup 等站内其它路径也能做离线校验 */
  const MC_BASE = (function () {
    const src = document.currentScript ? document.currentScript.src : '';
    const m = src.match(/^([^?#]*)\/assets\/auth\.js/);
    return m ? m[1] : '';
  })();

  const enc = new TextEncoder();

  function b64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function bytesToB64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function readAuth() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.exp || data.exp < Date.now()) {
        localStorage.removeItem(KEY);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  function saveAuth(user, token) {
    const data = {
      email: user.email,
      nickname: user.nickname,
      avatar: user.avatar || '',
      bio: user.bio || '',
      token: token || '',
      loginAt: Date.now(),
      exp: Date.now() + TTL
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return data;
  }

  function updateAuth(patch) {
    const current = readAuth();
    if (!current) return null;
    const next = Object.assign({}, current, patch, { exp: Date.now() + TTL });
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  function logout() {
    localStorage.removeItem(KEY);
  }

  function backendBase() {
    return (localStorage.getItem(BACKEND_KEY) || DEFAULT_BACKEND).replace(/\/+$/, '');
  }

  function setBackendBase(url) {
    localStorage.setItem(BACKEND_KEY, url.replace(/\/+$/, ''));
  }

  async function apiCall(path, options) {
    const opts = Object.assign({ method: 'GET', headers: {} }, options);
    if (opts.body && typeof opts.body !== 'string') {
      opts.body = JSON.stringify(opts.body);
    }
    opts.headers['Content-Type'] = 'application/json';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(backendBase() + path, Object.assign({ signal: controller.signal }, opts));
      let data = {};
      try { data = await res.json(); } catch (e) {}
      if (!res.ok) {
        const err = new Error(data.error || ('请求失败（' + res.status + '）'));
        err.status = res.status;
        throw err;
      }
      return data;
    } catch (e) {
      if (!e.status) e.offline = true;
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadAccounts() {
    const res = await fetch(MC_BASE + '/accounts.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('账号数据加载失败（' + res.status + '）');
    const data = await res.json();
    return data.accounts || [];
  }

  async function verifyPasswordLocal(email, password) {
    const accounts = await loadAccounts();
    const account = accounts.find((a) => a.email === email);
    if (!account) throw new Error('该邮箱尚未注册，请联系服主开通账号');
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt: b64ToBytes(account.salt),
      iterations: account.iterations || 100000,
      hash: 'SHA-256'
    }, key, 256);
    if (bytesToB64(new Uint8Array(bits)) !== account.hash) throw new Error('邮箱或密码错误');
    return account;
  }

  async function loginPassword(email, password) {
    const mail = email.trim().toLowerCase();
    try {
      const data = await apiCall('/api/auth/login', { method: 'POST', body: { email: mail, password } });
      return { auth: saveAuth(data.user, data.token), mode: 'online' };
    } catch (e) {
      if (e.status) throw e;
      const account = await verifyPasswordLocal(mail, password);
      return {
        auth: saveAuth({ email: account.email, nickname: account.nickname, avatar: account.avatar, bio: account.bio }, ''),
        mode: 'offline'
      };
    }
  }

  async function sendCode(email) {
    return apiCall('/api/auth/send-code', { method: 'POST', body: { email: email.trim().toLowerCase() } });
  }

  async function loginCode(email, code) {
    const data = await apiCall('/api/auth/code-login', { method: 'POST', body: { email: email.trim().toLowerCase(), code: code.trim() } });
    return { auth: saveAuth(data.user, data.token), mode: 'online' };
  }

  function requireLogin(next) {
    if (!readAuth()) {
      const target = next || location.pathname.split('/').pop() || 'play.html';
      location.replace('login.html?next=' + encodeURIComponent(target));
      return false;
    }
    return true;
  }

  function goLogin(next) {
    location.href = 'login.html?next=' + encodeURIComponent(next || 'play.html');
  }

  async function resizeImage(file, size) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = size || 128;
          canvas.height = size || 128;
          const ctx = canvas.getContext('2d');
          const s = Math.max(canvas.width / img.width, canvas.height / img.height);
          const w = img.width * s, h = img.height * s;
          ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => reject(new Error('图片读取失败'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });
  }

  window.MCAuth = {
    readAuth, saveAuth, updateAuth, logout,
    backendBase, setBackendBase, apiCall,
    loginPassword, sendCode, loginCode,
    requireLogin, goLogin, resizeImage,
    TTL, KEY
  };
})();
