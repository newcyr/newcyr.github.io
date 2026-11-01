/* NEWCYR 站点 · 登录凭证模块
 * 账号数据只保存在本机后端（D:\newcyr\data\accounts.json），站点不保存任何密码哈希；
 * 登录必须由后端签发 token，token 缓存在 localStorage，有效期 30 天，全站通用。
 */
(function () {
  const KEY = 'mc_auth_v1';
  const BACKEND_KEY = 'mc_backend';
  const AUTO_BACKEND_KEY = 'mc_backend_auto';
  const DAY = 24 * 60 * 60 * 1000;
  const TTL = 30 * DAY;
  const DEFAULT_BACKEND = 'http://127.0.0.1:8860';

  /* auth.js 位于 <站点根>/mc/assets/，后台地址清单固定读取 /mc/backend.json */
  const MC_BASE = (function () {
    const src = document.currentScript ? document.currentScript.src : '';
    const m = src.match(/^([^?#]*)\/assets\/auth\.js/);
    return m ? m[1] : '';
  })();

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
    const manual = localStorage.getItem(BACKEND_KEY);
    if (manual) return manual.replace(/\/+$/, '');
    return (localStorage.getItem(AUTO_BACKEND_KEY) || DEFAULT_BACKEND).replace(/\/+$/, '');
  }

  function setBackendBase(url) {
    localStorage.setItem(BACKEND_KEY, url.replace(/\/+$/, ''));
  }

  function clearBackendBase() {
    localStorage.removeItem(BACKEND_KEY);
  }

  /* 从站点静态文件 backend.json 自动获取后台公网地址 */
  async function discoverBackend() {
    try {
      const res = await fetch(MC_BASE + '/backend.json?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || data.status !== 'online' || !data.base) return null;
      const base = String(data.base).replace(/\/+$/, '');
      localStorage.setItem(AUTO_BACKEND_KEY, base);
      return base;
    } catch (e) {
      return null;
    }
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

  async function loginPassword(email, password) {
    const mail = email.trim().toLowerCase();
    try {
      const data = await apiCall('/api/auth/login', { method: 'POST', body: { email: mail, password } });
      return { auth: saveAuth(data.user, data.token), mode: 'online' };
    } catch (e) {
      if (e.status) throw e;
      throw new Error('无法连接登录服务（' + backendBase() + '），请确认本机后台已启动，或在页面下方填写正确的后台地址');
    }
  }

  async function register(email, password, nickname) {
    const data = await apiCall('/api/auth/register', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), password, nickname: nickname || '' }
    });
    return { auth: saveAuth(data.user, data.token), user: data.user };
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
    backendBase, setBackendBase, clearBackendBase, discoverBackend, apiCall,
    loginPassword, register, sendCode, loginCode,
    requireLogin, goLogin, resizeImage,
    TTL, KEY
  };
})();
