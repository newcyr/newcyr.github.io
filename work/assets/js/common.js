/* NEWCYR · WORKSPACE — 公共脚本：主题 / 双语 / 导航 / 数据 / 评价 */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const root = document.documentElement;
  const THEME_KEY = 'newcyr.theme';
  const LANG_KEY = 'newcyr.lang';
  const REVIEW_KEY = 'newcyr.work.reviews';

  /* ---------------- theme ---------------- */
  const metaTheme = $('#themeColor');
  function setTheme(theme, persist) {
    root.dataset.theme = theme;
    if (metaTheme) metaTheme.setAttribute('content', theme === 'dark' ? '#070B14' : '#FFFFFF');
    $$('.theme-btn').forEach(b => b.setAttribute('aria-pressed', String(theme === 'dark')));
    if (persist) { try { localStorage.setItem(THEME_KEY, theme); } catch (e) {} }
  }
  let savedTheme = null;
  try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) {}
  setTheme(savedTheme === 'dark' ? 'dark' : 'light', false);
  function toggleTheme() { setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true); }
  $$('.theme-btn').forEach(b => b.addEventListener('click', toggleTheme));

  /* ---------------- language ---------------- */
  let lang = 'zh';
  try { lang = localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh'; } catch (e) {}
  function applyLang(next, persist) {
    lang = next === 'en' ? 'en' : 'zh';
    root.lang = lang === 'zh' ? 'zh-CN' : 'en';
    $$('[data-zh]').forEach(el => {
      const value = lang === 'zh' ? el.dataset.zh : el.dataset.en;
      if (value !== undefined) el.innerHTML = value;
    });
    $$('.lang-btn').forEach(el => {
      const on = el.dataset.lang === lang;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-pressed', String(on));
    });
    $$('[data-set-lang]').forEach(el => el.classList.toggle('is-active', el.dataset.setLang === lang));
    document.dispatchEvent(new CustomEvent('work:lang', { detail: { lang } }));
    if (persist) { try { localStorage.setItem(LANG_KEY, lang); } catch (e) {} }
  }
  $$('.lang-btn').forEach(btn => btn.addEventListener('click', () => applyLang(btn.dataset.lang, true)));
  $$('[data-set-lang]').forEach(btn => btn.addEventListener('click', () => applyLang(btn.dataset.setLang, true)));

  /* ---------------- header ---------------- */
  const header = $('#header');
  const menuBtn = $('#menuBtn');
  const navLinks = $('#navLinks');
  let lastY = window.scrollY;
  function onScroll() {
    const y = window.scrollY;
    if (header) {
      header.classList.toggle('scrolled', y > 8);
      if (window.innerWidth > 860) header.classList.toggle('hide', y > 220 && y > lastY);
    }
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    $$('a', navLinks).forEach(a => a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }));
  }

  /* ---------------- year ---------------- */
  $$('#year').forEach(el => { el.textContent = String(new Date().getFullYear()); });

  /* ---------------- reveal ---------------- */
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let io = null;
  if (!reduce && 'IntersectionObserver' in window) {
    io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  }
  function reveal(scope = document) {
    $$('.reveal', scope).forEach((el, i) => {
      if (reduce || !io) { el.classList.add('in'); return; }
      el.style.setProperty('--d', (i % 4) * 60 + 'ms');
      io.observe(el);
    });
  }

  /* ---------------- helpers ---------------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const escapeHtml = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ESC[c]);
  const escAttr = v => escapeHtml(v).replace(/\n/g, '&#10;');

  const ICONS = {
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M12.5 5.5 19 12l-6.5 6.5"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H6M11.5 5.5 5 12l6.5 6.5"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5 9 17.5 20 6.5"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3.5h7l4.5 4.5v12a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5z"/><path d="M13.5 3.5V8h4.5"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10 5.9A9.9 9.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.2 7.1A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9.7 9.7 0 0 0 3.3-.6"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 3.5 8 12 12.5 20.5 8z"/><path d="M3.5 12 12 16.5 20.5 12M3.5 16 12 20.5 20.5 16"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8v.4"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m4.5 17 5-5 3.5 3.5 3-2.5 4 4"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 8.5h2.8l1.4-2.2h6.6l1.4 2.2h2.8a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-15a1.5 1.5 0 0 1-1.5-1.5V10a1.5 1.5 0 0 1 1.5-1.5z"/><circle cx="12" cy="13.6" r="3.1"/></svg>',
    rotate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v6h-6"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.75 5.65 6.2.88-4.5 4.4 1.08 6.17L12 17.2 6.47 20.1l1.08-6.17-4.5-4.4 6.2-.88z" fill="currentColor"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  };

  /* ---------------- 数据标准化 ---------------- */
  function normalizeQuestion(q, j) {
    const item = Object.assign({}, q || {});
    if (!item.id) item.id = `q-${j + 1}`;
    ['label', 'stem', 'answer'].forEach(k => { if (item[k] == null) item[k] = ''; });
    item.images = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
    item.answerImages = Array.isArray(item.answerImages) ? item.answerImages.filter(Boolean) : [];
    return item;
  }

  function normalizeReview(r, i) {
    return {
      id: r.id || `r-${i + 1}`,
      name: r.name || '',
      rating: Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5))),
      text: r.text || '',
      date: r.date || ''
    };
  }

  function normalizePaper(p, i) {
    if (!p || typeof p !== 'object') return null;
    if (!p.id) p.id = `paper-${i + 1}`;
    p.mode = p.mode === 'full' ? 'full' : 'step';
    ['title', 'subject', 'grade', 'date', 'summary', 'cover'].forEach(k => { if (p[k] == null) p[k] = ''; });

    let sections = Array.isArray(p.sections) ? p.sections.filter(Boolean) : [];
    /* 兼容旧数据：questions → 一个「一题一答」栏目 */
    if (!sections.length && Array.isArray(p.questions) && p.questions.length) {
      sections = [{ id: `${p.id}-s1`, title: '题目与答案', kind: 'qa', questions: p.questions }];
    }
    p.sections = sections.map((s, si) => {
      if (!s.id) s.id = `${p.id}-s${si + 1}`;
      s.kind = s.kind === 'images' ? 'images' : 'qa';
      s.title = s.title || (s.kind === 'images' ? '图片资料' : '题目与答案');
      s.note = s.note || '';
      s.questions = Array.isArray(s.questions) ? s.questions.map(normalizeQuestion) : [];
      s.images = Array.isArray(s.images) ? s.images.filter(Boolean) : [];
      return s;
    });
    delete p.questions;
    p.reviews = Array.isArray(p.reviews) ? p.reviews.map(normalizeReview) : [];
    return p;
  }

  function paperStats(p) {
    const stats = { sections: p.sections.length, questions: 0, images: 0 };
    p.sections.forEach(s => {
      if (s.kind === 'qa') stats.questions += s.questions.length;
      else stats.images += s.images.length;
    });
    return stats;
  }

  /* ---------------- 评价（本机存储 + 精选评价） ---------------- */
  function readReviewStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch (e) { return {}; }
  }
  function writeReviewStore(store) {
    try { localStorage.setItem(REVIEW_KEY, JSON.stringify(store)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('work:reviews'));
  }
  function localReviews(paperId) {
    const list = readReviewStore()[paperId];
    return Array.isArray(list) ? list.map((r, i) => Object.assign(normalizeReview(r, i), { local: true })) : [];
  }
  function saveLocalReview(paperId, review) {
    const store = readReviewStore();
    const list = Array.isArray(store[paperId]) ? store[paperId] : [];
    const next = normalizeReview(Object.assign({ date: new Date().toISOString().slice(0, 10) }, review, { local: undefined }));
    const idx = list.findIndex(r => r.id === next.id);
    if (idx >= 0) list[idx] = next; else list.push(next);
    store[paperId] = list;
    writeReviewStore(store);
    return list;
  }
  function removeLocalReview(paperId, reviewId) {
    const store = readReviewStore();
    const list = Array.isArray(store[paperId]) ? store[paperId] : [];
    store[paperId] = list.filter(r => r.id !== reviewId);
    writeReviewStore(store);
  }
  function allLocalReviews() {
    return readReviewStore();
  }
  function reviewsForPaper(paper) {
    return (paper.reviews || []).concat(localReviews(paper.id));
  }

  function starsHtml(rating) {
    const value = Math.round(Number(rating) || 0);
    return `<span class="stars" role="img" aria-label="${value} 星">${
      [1, 2, 3, 4, 5].map(i => `<span class="${i <= value ? 'on' : 'off'}">${ICONS.star}</span>`).join('')
    }</span>`;
  }
  function averageRating(list) {
    if (!list.length) return 0;
    return list.reduce((sum, r) => sum + Number(r.rating || 0), 0) / list.length;
  }

  /* ---------------- data ---------------- */
  async function loadData(path = 'data/papers.json') {
    const res = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`数据加载失败（HTTP ${res.status}）`);
    const data = await res.json();
    const papers = (Array.isArray(data.papers) ? data.papers : []).map(normalizePaper).filter(Boolean);
    return {
      site: Object.assign({ title: '作业答案中心', subtitle: '', notice: '' }, data.site || {}),
      papers,
      updatedAt: data.updatedAt || ''
    };
  }

  function formatDate(value) {
    if (!value) return '';
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}.${m[2]}.${m[3]}` : String(value);
  }

  function modeLabel(mode, l = lang) {
    if (mode === 'full') return l === 'en' ? 'Answers shown' : '默认显示答案';
    return l === 'en' ? 'Answers hidden' : '默认隐藏答案';
  }

  /* ---------------- image mirrors ----------------
     前端图片优先走镜像；镜像连不上 / 卡住 / 速度低于 30KB/s 时自动切换下一个镜像，
     两个镜像都不可用时回到官方源。 */
  const IMG_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const MIRROR_BASES = [
    'https://cdn.jsdelivr.net/gh/newcyr/newcyr.github.io@main/work/',
    'https://fastly.jsdelivr.net/gh/newcyr/newcyr.github.io@main/work/'
  ];
  const MIRROR_MIN_SPEED = 30 * 1024;   // 最低 30KB/s
  const MIRROR_STALL_MS = 6000;         // 6 秒收不到数据视为卡死
  const MIRROR_CONNECT_MS = 10000;      // 10 秒拿不到响应视为不连通
  const MIRROR_TOTAL_MS = 25000;        // 单张图片最长等待
  const MIRROR_COOLDOWN = 10 * 60 * 1000;
  const mirrorState = MIRROR_BASES.map(() => ({ deadUntil: 0 }));
  let preferredMirror = 0;
  const assetCache = new Map();
  const assetJobs = new Map();

  function officialUrl(path) {
    if (/^(https?:|data:|blob:)/.test(path)) return path;
    try { return new URL(path, location.href).href; } catch (e) { return path; }
  }

  async function downloadWithGuard(url) {
    const controller = new AbortController();
    const connectTimer = setTimeout(() => controller.abort(), MIRROR_CONNECT_MS);
    const totalTimer = setTimeout(() => controller.abort(), MIRROR_TOTAL_MS);
    try {
      const res = await fetch(url, { signal: controller.signal, mode: 'cors', credentials: 'omit' });
      clearTimeout(connectTimer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body || !res.body.getReader) return await res.blob();
      const reader = res.body.getReader();
      const chunks = [];
      let bytes = 0;
      const started = performance.now();
      while (true) {
        let stallTimer = 0;
        const stalled = new Promise((_, reject) => {
          stallTimer = setTimeout(() => {
            controller.abort();
            reject(new Error('stalled'));
          }, MIRROR_STALL_MS);
        });
        const { done, value } = await Promise.race([reader.read(), stalled]);
        clearTimeout(stallTimer);
        if (done) break;
        chunks.push(value);
        bytes += value.byteLength;
        const elapsed = (performance.now() - started) / 1000;
        if (elapsed >= 4 && bytes / elapsed < MIRROR_MIN_SPEED) {
          controller.abort();
          throw new Error('slow');
        }
      }
      return new Blob(chunks, { type: res.headers.get('content-type') || 'image/jpeg' });
    } finally {
      clearTimeout(connectTimer);
      clearTimeout(totalTimer);
    }
  }

  function resolveAssetUrl(path) {
    if (!path) return Promise.resolve('');
    if (/^(https?:|data:|blob:)/.test(path)) return Promise.resolve(path);
    if (!/^assets\//.test(path)) return Promise.resolve(officialUrl(path));
    if (assetCache.has(path)) return Promise.resolve(assetCache.get(path));
    if (assetJobs.has(path)) return assetJobs.get(path);

    const job = (async () => {
      const now = Date.now();
      const order = [];
      for (let step = 0; step < MIRROR_BASES.length; step += 1) {
        const idx = (preferredMirror + step) % MIRROR_BASES.length;
        if (mirrorState[idx].deadUntil <= now) order.push(idx);
      }
      for (const idx of order) {
        try {
          const blob = await downloadWithGuard(MIRROR_BASES[idx] + path);
          const url = URL.createObjectURL(blob);
          preferredMirror = idx;
          mirrorState[idx].deadUntil = 0;
          assetCache.set(path, url);
          return url;
        } catch (err) {
          /* 404 只说明镜像还没同步到这张新图，不代表镜像不可用；网络/超时/低速才冷却 */
          if (!/HTTP 404/.test(err.message || '')) {
            mirrorState[idx].deadUntil = Date.now() + MIRROR_COOLDOWN;
          }
        }
      }
      const fallback = officialUrl(path);
      assetCache.set(path, fallback);
      return fallback;
    })();
    assetJobs.set(path, job);
    return job.finally(() => assetJobs.delete(path));
  }

  function hydrateImages(scope = document) {
    $$('img[data-img-path]', scope).forEach(img => {
      if (img.dataset.imgBound) return;
      img.dataset.imgBound = '1';
      const path = img.dataset.imgPath;
      resolveAssetUrl(path).then(url => {
        img.dataset.resolvedSrc = url;
        img.src = url;
      }).catch(() => { img.src = officialUrl(path); });
    });
  }

  /* ---------------- lightbox ---------------- */
  let rotation = 0;
  let zoomBound = false;
  function applyRotation(box) {
    const img = box.querySelector('.lightbox-img');
    if (!img) return;
    const odd = rotation % 180 !== 0;
    img.style.transform = `rotate(${rotation}deg)`;
    /* 竖图旋转后交换受限边，避免超出屏幕；底部留出按钮空间 */
    img.style.maxWidth = odd ? 'calc(88vh - 92px)' : 'min(1100px,94vw)';
    img.style.maxHeight = odd ? '94vw' : 'calc(88vh - 92px)';
  }
  function ensureLightbox() {
    let box = $('#lightbox');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'lightbox';
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = `<button class="close" type="button" aria-label="关闭">${ICONS.x}</button>
      <img class="lightbox-img" alt="">
      <button class="rotate" type="button" aria-label="旋转图片" title="旋转 90°">${ICONS.rotate}<span>旋转</span></button>`;
    document.body.appendChild(box);
    const close = () => { box.classList.remove('open'); box.querySelector('img').src = ''; };
    box.addEventListener('click', e => {
      if (e.target === box || e.target.closest('.close')) { close(); return; }
      if (e.target.closest('.rotate')) {
        rotation = (rotation + 90) % 360;
        applyRotation(box);
      }
    });
    document.addEventListener('keydown', e => {
      if (!box.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'r' || e.key === 'R') { rotation = (rotation + 90) % 360; applyRotation(box); }
    });
    return box;
  }
  function openLightbox(src, alt) {
    const box = ensureLightbox();
    const img = box.querySelector('.lightbox-img');
    img.src = src;
    img.alt = alt || '';
    rotation = 0;
    applyRotation(box);
    box.classList.add('open');
  }
  function bindZoom() {
    if (zoomBound) return;
    zoomBound = true;
    /* 事件委托：后台缩略图等动态渲染的图片也能点击预览 */
    document.addEventListener('click', e => {
      const img = e.target.closest('[data-zoom]');
      if (!img || img.closest('#lightbox')) return;
      e.preventDefault();
      const alt = img.getAttribute('alt');
      const ready = img.dataset.resolvedSrc;
      if (ready) { openLightbox(ready, alt); return; }
      const path = img.dataset.imgPath;
      if (path) {
        resolveAssetUrl(path)
          .then(url => openLightbox(url, alt))
          .catch(() => openLightbox(officialUrl(path), alt));
        return;
      }
      openLightbox(img.getAttribute('src'), alt);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('loaded');
    reveal();
    bindZoom();
    hydrateImages();
  });
  applyLang(lang, false);

  window.Work = {
    $, $$, ICONS, escapeHtml, escAttr, loadData, formatDate, modeLabel,
    reveal, bindZoom, applyLang,
    IMG_PLACEHOLDER, hydrateImages, resolveAssetUrl, officialUrl,
    normalizePaper, paperStats, starsHtml, averageRating,
    localReviews, saveLocalReview, removeLocalReview, allLocalReviews, reviewsForPaper,
    getLang: () => lang,
    imageUri: (...parts) => parts.filter(Boolean).join('')
  };
})();
