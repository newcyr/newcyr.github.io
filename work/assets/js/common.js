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

  /* ---------------- lightbox ---------------- */
  const zoomSrc = new WeakSet();
  function ensureLightbox() {
    let box = $('#lightbox');
    if (box) return box;
    box = document.createElement('div');
    box.id = 'lightbox';
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = `<button class="close" type="button" aria-label="关闭">${ICONS.x}</button><img alt="">`;
    document.body.appendChild(box);
    const close = () => { box.classList.remove('open'); box.querySelector('img').src = ''; };
    box.addEventListener('click', e => {
      if (e.target === box || e.target.closest('.close')) close();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && box.classList.contains('open')) close(); });
    return box;
  }
  function bindZoom(scope = document) {
    $$('[data-zoom]', scope).forEach(img => {
      if (zoomSrc.has(img)) return;
      zoomSrc.add(img);
      img.addEventListener('click', () => {
        const box = ensureLightbox();
        box.querySelector('img').src = img.getAttribute('src');
        box.classList.add('open');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('loaded');
    reveal();
    bindZoom();
  });
  applyLang(lang, false);

  window.Work = {
    $, $$, ICONS, escapeHtml, escAttr, loadData, formatDate, modeLabel,
    reveal, bindZoom, applyLang,
    normalizePaper, paperStats, starsHtml, averageRating,
    localReviews, saveLocalReview, removeLocalReview, allLocalReviews, reviewsForPaper,
    getLang: () => lang,
    imageUri: (...parts) => parts.filter(Boolean).join('')
  };
})();
