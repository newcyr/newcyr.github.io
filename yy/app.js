/* ============================================================
   NEWCYR 应用中心
   JSON 驱动 · 检索 / 详情 / 镜像下载
   ============================================================ */
'use strict';

var $ = function (sel, root) { return (root || document).querySelector(sel); };
var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

var state = {
  config: null,
  apps: [],
  entries: [],
  category: '全部',
  sort: 'updated',
  mirrorId: 'direct',
  query: '',
  searchOpen: false,
  activeIndex: -1,
  flat: [],
  toastTimer: null,
  revealTimer: null
};

/* ---------- helpers ---------- */
function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(value) {
  return String(value == null ? '' : value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function fmtSize(bytes) {
  if (!bytes || bytes <= 0) return '—';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function fmtDate(value) {
  return value ? String(value).slice(0, 10) : '—';
}

function debounce(fn, wait) {
  var timer = null;
  return function () {
    var args = arguments;
    var self = this;
    clearTimeout(timer);
    timer = setTimeout(function () { fn.apply(self, args); }, wait);
  };
}

async function fetchJSON(url) {
  var response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error('HTTP ' + response.status + ' · ' + url);
  return response.json();
}

/* ---------- theme ---------- */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#070B14' : '#F6F8FC');
  var button = $('#themeBtn');
  if (button) button.setAttribute('aria-label', theme === 'dark' ? '切换亮色模式' : '切换深色模式');
}

function initTheme() {
  var button = $('#themeBtn');
  if (!button) return;
  button.addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('yy-theme', next); } catch (e) {}
  });
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
}

/* ---------- mirror resolution ---------- */
function getMirror(id) {
  if (!state.config || !state.config.mirrors) return null;
  for (var i = 0; i < state.config.mirrors.length; i++) {
    if (state.config.mirrors[i].id === id) return state.config.mirrors[i];
  }
  return null;
}

function directMirror() {
  return getMirror('direct') || { id: 'direct', name: '本站直连', kind: 'origin' };
}

function mirrorSupports(mirror, app) {
  if (!mirror || !mirror.limitMB) return true;
  if (!app || !app.sizeBytes) return true;
  return app.sizeBytes <= mirror.limitMB * 1048576;
}

function resolveDownload(app, mirror) {
  if (!mirror || mirror.kind === 'origin') {
    return new URL(app.file, new URL('.', location.href)).href;
  }
  var repo = state.config.repo || {};
  var basePath = String(repo.basePath || '').replace(/^\/+|\/+$/g, '');
  var file = String(app.file || '').replace(/^\/+/, '');
  var path = (basePath ? basePath + '/' : '') + file;
  var values = {
    owner: repo.owner || '',
    repo: repo.name || '',
    branch: repo.branch || 'main',
    basePath: basePath,
    path: path
  };
  return String(mirror.url || '').replace(/\{(\w+)\}/g, function (match, key) {
    return values[key] != null ? values[key] : match;
  });
}

function effectiveMirror(app) {
  var chosen = getMirror(state.mirrorId) || directMirror();
  if (mirrorSupports(chosen, app)) return { mirror: chosen, fallback: false };
  return { mirror: directMirror(), fallback: true };
}

/* ---------- rendering: app cards ---------- */
function iconHTML(app, className) {
  var content = app.icon
    ? '<img src="' + esc(app.icon) + '" alt="" loading="lazy" decoding="async">'
    : esc(app.iconText || app.name.slice(0, 1));
  return '<span class="' + className + '">' + content + '</span>';
}

function sortedApps(list) {
  var apps = list.slice();
  if (state.sort === 'name') {
    apps.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'zh-Hans-CN'); });
  } else if (state.sort === 'size') {
    apps.sort(function (a, b) { return (b.sizeBytes || 0) - (a.sizeBytes || 0); });
  } else {
    apps.sort(function (a, b) {
      return String(b.updated || '').localeCompare(String(a.updated || '')) || (a.order || 99) - (b.order || 99);
    });
  }
  return apps;
}

function cardHTML(app) {
  var tags = (app.tags || []).slice(0, 4).map(function (tag) {
    return '<span class="tag">' + esc(tag) + '</span>';
  }).join('');
  var page = app.page || '';

  return '' +
    '<article class="app-card reveal" data-app="' + esc(app.id) + '" style="--accent:' + esc(app.accent || '#0b5cff') + '">' +
      '<div class="card-top">' +
        iconHTML(app, 'app-icon') +
        '<div class="card-title">' +
          '<h3>' + esc(app.name) + '<span class="ver-pill">v' + esc(app.version || '1.0.0') + '</span></h3>' +
          '<p>' + esc(app.tagline || '') + '</p>' +
          (app.latin ? '<small>' + esc(app.latin) + '</small>' : '') +
        '</div>' +
      '</div>' +
      '<div class="tag-row">' + tags + '</div>' +
      '<p class="card-desc">' + esc(app.description || '') + '</p>' +
      '<dl class="card-meta">' +
        '<div><dt>平台</dt><dd>' + esc(app.os || app.platform || 'Android') + '</dd></div>' +
        '<div><dt>体积</dt><dd>' + esc(app.size || fmtSize(app.sizeBytes)) + '</dd></div>' +
        '<div><dt>更新</dt><dd>' + esc(fmtDate(app.updated)) + '</dd></div>' +
      '</dl>' +
      '<div class="card-actions">' +
        '<button class="btn btn-primary" type="button" data-action="download" data-id="' + esc(app.id) + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5"/><path d="M5 19h14"/></svg>' +
          '快速下载' +
        '</button>' +
        '<button class="btn btn-ghost" type="button" data-action="detail" data-id="' + esc(app.id) + '">详情</button>' +
      '</div>' +
      '<div class="card-foot">' +
        '<span class="line-dot" aria-hidden="true"></span>' +
        '<span>线路</span><b data-line-name>本站直连</b>' +
        '<span class="sep">·</span>' +
        (app.checksum && app.checksum.value ? '<span>SHA-256 已提供</span>' : '<span>直链安装包</span>') +
        (page ? '<a class="card-page" href="' + esc(page) + '">打开下载页' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></a>' : '') +
      '</div>' +
    '</article>';
}

function addCardHTML() {
  return '' +
    '<a class="add-card reveal" href="SDK.md">' +
      '<span class="add-plus" aria-hidden="true">+</span>' +
      '<span class="add-copy">' +
        '<h3>添加你的应用</h3>' +
        '<p>复制 <code>apps/template.json</code>，填写配置并加入清单，刷新即可上线，不需要改页面代码。</p>' +
      '</span>' +
      '<span class="add-link">查看接入 SDK →</span>' +
    '</a>';
}

function renderApps() {
  var grid = $('#appGrid');
  if (!grid) return;
  var list = state.apps.filter(function (app) {
    return state.category === '全部' || app.category === state.category;
  });
  var ordered = sortedApps(list);
  grid.innerHTML = ordered.map(cardHTML).join('') + addCardHTML();
  grid.setAttribute('aria-busy', 'false');

  var empty = $('#gridEmpty');
  if (empty) empty.hidden = ordered.length > 0;

  syncMirrorLabels();
  observeReveals();
}

function renderCategories() {
  var wrap = $('#categoryChips');
  if (!wrap) return;
  var categories = [];
  state.apps.forEach(function (app) {
    if (app.category && categories.indexOf(app.category) === -1) categories.push(app.category);
  });
  var items = ['全部'].concat(categories);
  wrap.innerHTML = items.map(function (name) {
    var count = name === '全部' ? state.apps.length : state.apps.filter(function (app) { return app.category === name; }).length;
    return '<button class="chip" type="button" role="tab" data-category="' + esc(name) + '" aria-selected="' + (state.category === name ? 'true' : 'false') + '">' +
      esc(name) + ' <span style="opacity:.65;font-size:.66em">' + count + '</span></button>';
  }).join('');

  $$('.chip', wrap).forEach(function (chip) {
    chip.addEventListener('click', function () {
      state.category = chip.getAttribute('data-category');
      renderCategories();
      renderApps();
    });
  });
}

/* ---------- rendering: stats / knowledge ---------- */
function renderStats() {
  var totalBytes = state.apps.reduce(function (sum, app) { return sum + (app.sizeBytes || 0); }, 0);
  var values = {
    statApps: String(state.apps.length),
    statSize: fmtSize(totalBytes),
    statMirrors: String((state.config.mirrors || []).length),
    statMirrorsFloat: String((state.config.mirrors || []).length),
    footUpdated: fmtDate(state.config.site && state.config.site.updated)
  };
  Object.keys(values).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.textContent = values[id];
  });
}

function renderKnowledge() {
  var list = $('#knowledgeList');
  if (!list || !state.config) return;
  var items = state.config.knowledge || [];
  list.innerHTML = items.map(function (item, index) {
    return '<details class="k-item reveal" id="k-' + esc(item.id) + '"' + (index === 0 ? ' open' : '') + '>' +
      '<summary><span class="k-index">Q' + (index + 1) + '</span>' + esc(item.question) + '</summary>' +
      '<div class="k-body">' + esc(item.answer) + '</div>' +
      '</details>';
  }).join('');
  observeReveals();
}

/* ---------- reveal ---------- */
var revealObserver = null;
function observeReveals() {
  var items = $$('.reveal');
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
  }
  items.forEach(function (el) {
    if (!el.classList.contains('in')) revealObserver.observe(el);
  });
  clearTimeout(state.revealTimer);
  state.revealTimer = setTimeout(function () {
    $$('.reveal').forEach(function (el) { el.classList.add('in'); });
  }, 1200);
}

/* ---------- search index & panel ---------- */
function buildEntries() {
  state.entries = [];
  state.apps.forEach(function (app) {
    var text = [
      app.name, app.latin, app.tagline, app.description, app.category,
      (app.tags || []).join(' '), (app.keywords || []).join(' '),
      (app.highlights || []).map(function (h) { return h.title + ' ' + h.desc; }).join(' '),
      (app.faq || []).map(function (f) { return f.q + ' ' + f.a; }).join(' ')
    ].filter(Boolean).join(' ');
    state.entries.push({
      type: 'app', app: app, title: app.name,
      sub: [app.latin, app.tagline].filter(Boolean).join(' · '), text: text
    });
    (app.faq || []).forEach(function (faq, index) {
      state.entries.push({
        type: 'faq', app: app, faqIndex: index,
        title: faq.q, sub: app.name + ' · 常见问题', text: faq.q + ' ' + faq.a
      });
    });
  });
  ((state.config && state.config.knowledge) || []).forEach(function (item) {
    state.entries.push({
      type: 'site', knowledgeId: item.id, title: item.question,
      sub: '下载与安装 · 知识库', text: item.question + ' ' + item.answer
    });
  });
}

function markText(text, tokens) {
  var safe = esc(text);
  if (!tokens || !tokens.length) return safe;
  var pattern = tokens.filter(Boolean)
    .map(function (token) { return escapeRegExp(esc(token)); })
    .sort(function (a, b) { return b.length - a.length; })
    .join('|');
  if (!pattern) return safe;
  return safe.replace(new RegExp('(' + pattern + ')', 'gi'), '<mark>$1</mark>');
}

function snippet(text, tokens, maxLength) {
  var raw = String(text || '').replace(/\s+/g, ' ').trim();
  var limit = maxLength || 96;
  var index = -1;
  (tokens || []).forEach(function (token) {
    var found = raw.toLowerCase().indexOf(token.toLowerCase());
    if (found !== -1 && (index === -1 || found < index)) index = found;
  });
  var start = index > 18 ? index - 18 : 0;
  var out = raw.slice(start, start + limit);
  var end = start + limit < raw.length;
  return (start > 0 ? '…' : '') + markText(out, tokens) + (end ? '…' : '');
}

function searchEntries(query) {
  var tokens = normalize(query).split(' ').filter(Boolean);
  if (!tokens.length) return [];
  return state.entries.map(function (entry) {
    var haystack = normalize(entry.title + ' ' + entry.sub + ' ' + entry.text);
    var matchedAll = tokens.every(function (token) { return haystack.indexOf(token) !== -1; });
    if (!matchedAll) return null;
    var score = 0;
    tokens.forEach(function (token) {
      if (normalize(entry.title).indexOf(token) !== -1) score += 14;
      if (normalize(entry.sub).indexOf(token) !== -1) score += 5;
      if (normalize(entry.text).indexOf(token) !== -1) score += 1;
    });
    if (entry.type === 'app') score += 4;
    return { entry: entry, score: score };
  }).filter(Boolean).sort(function (a, b) {
    return b.score - a.score;
  }).slice(0, 12).map(function (item) { return item.entry; });
}

function searchRowHTML(entry, index, tokens) {
  var isApp = entry.type === 'app';
  var icon = isApp
    ? iconHTML(entry.app, 'sr-icon')
    : '<span class="sr-icon q" aria-hidden="true">Q</span>';
  var label = isApp ? 'v' + esc(entry.app.version || '1.0.0') : (entry.type === 'faq' ? '问答' : '知识');
  var title = markText(entry.title, tokens);
  var subText;
  if (isApp) {
    subText = snippet(entry.sub, tokens, 72);
  } else if (entry.type === 'faq') {
    subText = snippet(entry.app.faq[entry.faqIndex].a, tokens, 88);
  } else {
    var item = (state.config.knowledge || []).filter(function (k) { return k.id === entry.knowledgeId; })[0];
    subText = snippet(item ? item.answer : entry.sub, tokens, 88);
  }
  return '<button class="sr-row" type="button" role="option" id="sr-' + index + '" data-index="' + index + '" aria-selected="false">' +
    icon +
    '<span class="sr-body">' +
      '<span class="sr-title">' + title + '<span>' + label + '</span></span>' +
      '<span class="sr-sub">' + subText + '</span>' +
    '</span>' +
    '<svg class="sr-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
  '</button>';
}

function renderSearchPanel() {
  var panel = $('#searchPanel');
  var results = $('#searchResults');
  var title = $('#searchPanelTitle');
  var count = $('#searchPanelCount');
  if (!panel || !results || !state.config) return;

  var query = state.query.trim();
  var tokens = normalize(query).split(' ').filter(Boolean);
  var appEntries = [];
  var knowledgeEntries = [];

  if (!query) {
    sortedApps(state.apps).slice(0, 4).forEach(function (app) {
      appEntries.push({ type: 'app', app: app, title: app.name, sub: [app.latin, app.tagline].filter(Boolean).join(' · '), text: '' });
    });
    (state.config.knowledge || []).slice(0, 3).forEach(function (item) {
      knowledgeEntries.push({ type: 'site', knowledgeId: item.id, title: item.question, sub: '下载与安装 · 知识库', text: item.answer });
    });
    title.textContent = '快捷入口';
    count.textContent = state.apps.length + ' 款应用 · ' + (state.config.knowledge || []).length + ' 条知识';
  } else {
    var matched = searchEntries(query);
    matched.forEach(function (entry) {
      if (entry.type === 'app') appEntries.push(entry);
      else knowledgeEntries.push(entry);
    });
    title.textContent = '检索结果';
    count.textContent = matched.length ? matched.length + ' 条匹配' : '没有匹配';
  }

  var flat = [];
  var html = '';
  if (appEntries.length) {
    html += '<div class="sr-group">应用 <em>' + appEntries.length + '</em></div>';
    appEntries.slice(0, 5).forEach(function (entry) {
      html += searchRowHTML(entry, flat.length, tokens);
      flat.push(entry);
    });
  }
  if (knowledgeEntries.length) {
    html += '<div class="sr-group">' + (query ? '知识' : '热门知识') + ' <em>' + knowledgeEntries.length + '</em></div>';
    knowledgeEntries.slice(0, 7).forEach(function (entry) {
      html += searchRowHTML(entry, flat.length, tokens);
      flat.push(entry);
    });
  }

  state.flat = flat;
  state.activeIndex = -1;
  results.innerHTML = html || '<div class="search-empty"><b>' +
    (query ? '没有找到「' + esc(query) + '」' : '暂无内容') + '</b><span>' +
    (query ? '换个关键词试试，例如「安装」「镜像」「手写」。' : '请稍后重试。') + '</span></div>';
  results.setAttribute('aria-activedescendant', '');
  panel.hidden = false;
  state.searchOpen = true;
  var input = $('#searchInput');
  if (input) input.setAttribute('aria-expanded', 'true');
}

function closeSearch(keepQuery) {
  var panel = $('#searchPanel');
  var input = $('#searchInput');
  if (panel) panel.hidden = true;
  state.searchOpen = false;
  state.activeIndex = -1;
  if (!keepQuery) state.query = '';
  if (input) {
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    if (!keepQuery) {
      input.value = '';
      var clearButton = $('#searchClear');
      if (clearButton) clearButton.hidden = true;
    }
  }
}

function handleSearchKeys(event) {
  var input = $('#searchInput');
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!state.searchOpen) renderSearchPanel();
    if (!state.flat.length) return;
    event.preventDefault();
    var step = event.key === 'ArrowDown' ? 1 : -1;
    var next = state.activeIndex + step;
    if (next < 0) next = state.flat.length - 1;
    if (next >= state.flat.length) next = 0;
    state.activeIndex = next;
    $$('.sr-row').forEach(function (row) {
      row.setAttribute('aria-selected', row.getAttribute('data-index') === String(next) ? 'true' : 'false');
    });
    var active = $('#sr-' + next);
    if (active) {
      input.setAttribute('aria-activedescendant', 'sr-' + next);
      active.scrollIntoView({ block: 'nearest' });
    }
    return;
  }
  if (event.key === 'Enter') {
    if (!state.searchOpen || !state.flat.length) return;
    event.preventDefault();
    activateSearchResult(state.activeIndex >= 0 ? state.activeIndex : 0);
    return;
  }
  if (event.key === 'Escape') {
    if (state.searchOpen) {
      event.preventDefault();
      closeSearch(true);
      input.blur();
    }
  }
}

function activateSearchResult(index) {
  var entry = state.flat[index];
  if (!entry) return;
  if (entry.type === 'app') {
    closeSearch();
    openApp(entry.app.id);
  } else if (entry.type === 'faq') {
    closeSearch();
    openApp(entry.app.id, { faqIndex: entry.faqIndex });
  } else if (entry.type === 'site') {
    closeSearch();
    focusKnowledge(entry.knowledgeId);
  }
}

function focusKnowledge(id) {
  var item = document.getElementById('k-' + id);
  if (!item) return;
  item.open = true;
  document.getElementById('knowledge').scrollIntoView({ behavior: 'smooth', block: 'start' });
  item.classList.add('flash');
  setTimeout(function () { item.classList.remove('flash'); }, 1600);
}

function initSearch() {
  var input = $('#searchInput');
  var clearButton = $('#searchClear');
  var panel = $('#searchPanel');
  var results = $('#searchResults');
  var mirrorButton = $('#searchMirrorBtn');
  if (!input || !panel) return;

  input.addEventListener('focus', function () {
    if (!state.query) renderSearchPanel();
    else if (!state.searchOpen) renderSearchPanel();
  });

  input.addEventListener('input', function () {
    state.query = input.value;
    if (clearButton) clearButton.hidden = !input.value;
    renderSearchPanel();
  });

  input.addEventListener('keydown', handleSearchKeys);

  if (clearButton) {
    clearButton.addEventListener('click', function () {
      input.value = '';
      state.query = '';
      clearButton.hidden = true;
      renderSearchPanel();
      input.focus();
    });
  }

  if (results) {
    results.addEventListener('click', function (event) {
      var row = event.target.closest('.sr-row');
      if (!row) return;
      activateSearchResult(Number(row.getAttribute('data-index')));
    });
  }

  if (mirrorButton) {
    mirrorButton.addEventListener('click', function () {
      closeSearch(true);
      openMirrorDialog();
    });
  }

  document.addEventListener('click', function (event) {
    if (!state.searchOpen) return;
    if (!event.target.closest('#searchWrap')) closeSearch(true);
  });

  document.addEventListener('keydown', function (event) {
    if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k') {
      event.preventDefault();
      closeAppDialog();
      closeMirrorDialog();
      input.focus();
      input.select();
      renderSearchPanel();
    }
  });
}

/* ---------- toast & clipboard ---------- */
function toast(message) {
  var el = $('#toast');
  if (!el) return;
  clearTimeout(state.toastTimer);
  if (typeof el.showPopover === 'function' && !el.matches(':popover-open')) {
    try { el.showPopover(); } catch (e) {}
  }
  el.textContent = message;
  requestAnimationFrame(function () { el.classList.add('show'); });
  state.toastTimer = setTimeout(function () {
    el.classList.remove('show');
    setTimeout(function () {
      if (typeof el.hidePopover === 'function' && el.matches(':popover-open')) {
        try { el.hidePopover(); } catch (e) {}
      }
    }, 350);
  }, 3200);
}

function copyText(text, done) {
  function fallback() {
    var area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      if (done) done();
    } catch (e) {
      toast('复制失败，请手动选择文本');
    }
    document.body.removeChild(area);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {
      if (done) done();
    }).catch(fallback);
  } else {
    fallback();
  }
}

/* ---------- app detail dialog ---------- */
function getApp(id) {
  return state.apps.filter(function (app) { return app.id === id; })[0] || null;
}

function detailHighlightHTML(item) {
  return '<div class="d-highlight">' +
    '<span class="d-h-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12l5 5L20 7"/></svg></span>' +
    '<div><b>' + esc(item.title) + '</b><p>' + esc(item.desc) + '</p></div>' +
  '</div>';
}

function appDialogHTML(app) {
  var tags = (app.tags || []).map(function (tag) { return '<span class="tag">' + esc(tag) + '</span>'; }).join('');
  var highlights = (app.highlights || []).map(detailHighlightHTML).join('');
  var faq = (app.faq || []).map(function (item, index) {
    return '<details data-faq-index="' + index + '"><summary>' + esc(item.q) + '</summary><div class="a">' + esc(item.a) + '</div></details>';
  }).join('');
  var checksum = app.checksum && app.checksum.value && app.checksum.value !== '填写安装包的 SHA-256，可留空'
    ? '<div class="d-checksum"><code>' + esc(app.checksum.value) + '</code><button type="button" data-detail-action="copy-hash" data-hash="' + esc(app.checksum.value) + '">复制</button></div>'
    : '<p class="d-note">此版本暂未提供校验值，可在下载页查看文件信息。</p>';
  var page = app.page
    ? '<a class="btn btn-ghost" href="' + esc(app.page) + '" target="_blank" rel="noopener">打开下载页' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></a>'
    : '';

  return '' +
    '<div class="d-top">' +
      '<button class="d-close" type="button" data-detail-action="close" aria-label="关闭">&times;</button>' +
      '<div class="d-id">' +
        iconHTML(app, 'd-icon') +
        '<div>' +
          '<h2>' + esc(app.name) + '<span class="d-ver">v' + esc(app.version || '1.0.0') + '</span></h2>' +
          (app.latin ? '<small>' + esc(app.latin) + '</small>' : '') +
        '</div>' +
      '</div>' +
      '<p class="d-tagline">' + esc(app.tagline || '') + '</p>' +
      '<p class="d-desc">' + esc(app.description || '') + '</p>' +
      '<div class="d-tags">' + tags + '</div>' +
    '</div>' +
    '<div class="d-body">' +
      '<dl class="d-meta">' +
        '<div><dt>版本</dt><dd>v' + esc(app.version || '1.0.0') + '</dd></div>' +
        '<div><dt>平台要求</dt><dd>' + esc(app.os || app.platform || 'Android') + '</dd></div>' +
        '<div><dt>安装包大小</dt><dd>' + esc(app.size || fmtSize(app.sizeBytes)) + '</dd></div>' +
        '<div><dt>更新日期</dt><dd>' + esc(fmtDate(app.updated)) + '</dd></div>' +
      '</dl>' +
      (highlights ? '<section class="d-section"><div class="d-section-title">功能亮点</div><div class="d-highlights">' + highlights + '</div></section>' : '') +
      (faq ? '<section class="d-section"><div class="d-section-title">常见问题</div><div class="d-faq">' + faq + '</div></section>' : '') +
      '<section class="d-section"><div class="d-section-title">安装包与线路</div>' + checksum +
        '<div class="d-line"><span>当前线路</span><b data-line-name>本站直连</b><span>·</span><button type="button" data-detail-action="mirror">切换线路</button></div>' +
      '</section>' +
      '<p class="d-note">安装前请在浏览器或文件管理器中允许「安装未知应用」。所有安装包均来自 NEWCYR 官方仓库，建议核对 SHA-256 后再安装。</p>' +
    '</div>' +
    '<footer class="d-footer">' +
      '<button class="btn btn-primary" type="button" data-detail-action="download">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5"/><path d="M5 19h14"/></svg>' +
        '快速下载 · ' + esc(app.size || fmtSize(app.sizeBytes)) +
      '</button>' + page +
    '</footer>';
}

function syncScrollLock() {
  document.documentElement.classList.toggle('dialog-open', !!document.querySelector('dialog[open]'));
}

function openApp(id, options) {
  var app = getApp(id);
  if (!app) return;
  var dialog = $('#appDialog');
  var body = $('#appDialogBody');
  if (!dialog || !body) return;
  body.innerHTML = appDialogHTML(app);
  body.setAttribute('data-current-id', app.id);
  body.scrollTop = 0;
  syncMirrorLabels();
  if (!dialog.open) dialog.showModal();
  syncScrollLock();

  var opts = options || {};
  if (typeof opts.faqIndex === 'number') {
    setTimeout(function () {
      var item = body.querySelectorAll('.d-faq details')[opts.faqIndex];
      if (item) {
        item.open = true;
        item.scrollIntoView({ block: 'center' });
      }
    }, 80);
  }
}

function closeAppDialog() {
  var dialog = $('#appDialog');
  if (dialog && dialog.open) dialog.close();
  syncScrollLock();
}

function initAppDialog() {
  var dialog = $('#appDialog');
  var body = $('#appDialogBody');
  if (!dialog || !body) return;

  body.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-detail-action]');
    if (!trigger) return;
    var action = trigger.getAttribute('data-detail-action');
    var currentId = body.getAttribute('data-current-id');
    if (action === 'close') {
      closeAppDialog();
    } else if (action === 'download' && currentId) {
      downloadApp(currentId);
    } else if (action === 'copy-hash') {
      copyText(trigger.getAttribute('data-hash'), function () {
        var original = trigger.textContent;
        trigger.textContent = '已复制';
        setTimeout(function () { trigger.textContent = original; }, 1600);
      });
    } else if (action === 'mirror') {
      closeSearch(true);
      openMirrorDialog();
    }
  });

  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) closeAppDialog();
  });
  dialog.addEventListener('close', syncScrollLock);
}

/* ---------- mirror dialog ---------- */
function renderMirrorList() {
  var list = $('#mirrorList');
  if (!list || !state.config) return;
  var mirrors = state.config.mirrors || [];
  list.innerHTML = mirrors.map(function (mirror) {
    var checked = mirror.id === state.mirrorId;
    var limit = mirror.limitMB
      ? '<span class="mirror-limit">≤ ' + esc(mirror.limitMB) + ' MB</span>'
      : '';
    return '<label class="mirror-option' + (checked ? ' selected' : '') + '">' +
      '<input type="radio" name="yy-mirror" value="' + esc(mirror.id) + '"' + (checked ? ' checked' : '') + '>' +
      '<span class="mirror-info">' +
        '<b>' + esc(mirror.name) + '<span>' + (mirror.kind === 'origin' ? '官方' : '镜像') + '</span></b>' +
        '<p>' + esc(mirror.desc || '') + '</p>' +
      '</span>' +
      '<span class="mirror-side">' + limit + '<span class="latency" data-latency="' + esc(mirror.id) + '">—</span></span>' +
    '</label>';
  }).join('');
}

function setMirror(id) {
  if (!getMirror(id)) return;
  state.mirrorId = id;
  try { localStorage.setItem('yy-mirror', id); } catch (e) {}
  $$('.mirror-option').forEach(function (option) {
    var input = option.querySelector('input');
    var active = input && input.value === id;
    option.classList.toggle('selected', active);
    if (input) input.checked = active;
  });
  syncMirrorLabels();
}

function syncMirrorLabels() {
  var mirror = getMirror(state.mirrorId) || directMirror();
  var button = $('#mirrorBtnName');
  if (button) button.textContent = mirror.name;
  $$('[data-line-name]').forEach(function (el) { el.textContent = mirror.name; });
}

function openMirrorDialog() {
  var dialog = $('#mirrorDialog');
  if (!dialog) return;
  renderMirrorList();
  if (!dialog.open) dialog.showModal();
  syncScrollLock();
}

function closeMirrorDialog() {
  var dialog = $('#mirrorDialog');
  if (dialog && dialog.open) dialog.close();
  syncScrollLock();
}

function probeMirror(mirror) {
  var sample = state.apps.slice().sort(function (a, b) { return (a.sizeBytes || 0) - (b.sizeBytes || 0); })[0];
  if (!sample) return Promise.resolve(null);
  var url = resolveDownload(sample, mirror);
  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, 6000);
  var started = performance.now();
  return fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: controller.signal })
    .then(function () {
      return Math.round(performance.now() - started);
    })
    .catch(function () { return null; })
    .then(function (ms) { clearTimeout(timer); return ms; });
}

function testMirrors() {
  var button = $('#mirrorTest');
  if (!button || !state.config) return;
  button.disabled = true;
  var label = button.textContent;
  button.textContent = '测速中…';
  var mirrors = state.config.mirrors || [];
  $$('.latency').forEach(function (el) { el.textContent = '…'; });
  Promise.all(mirrors.map(function (mirror) {
    return probeMirror(mirror).then(function (ms) {
      var el = document.querySelector('[data-latency="' + mirror.id + '"]');
      if (!el) return;
      if (ms == null) {
        el.textContent = '超时';
        el.classList.remove('good');
      } else {
        el.textContent = ms + ' ms';
        el.classList.toggle('good', ms < 900);
      }
    });
  })).then(function () {
    button.disabled = false;
    button.textContent = label;
  });
}

function initMirror() {
  var mirrorButton = $('#mirrorBtn');
  var list = $('#mirrorList');
  var dialog = $('#mirrorDialog');
  var closeButton = $('#mirrorClose');
  var doneButton = $('#mirrorDone');
  var testButton = $('#mirrorTest');
  if (!mirrorButton || !dialog) return;

  mirrorButton.addEventListener('click', function () {
    closeSearch(true);
    openMirrorDialog();
  });
  if (closeButton) closeButton.addEventListener('click', closeMirrorDialog);
  if (doneButton) doneButton.addEventListener('click', closeMirrorDialog);
  if (list) {
    list.addEventListener('change', function (event) {
      var input = event.target.closest('input[name="yy-mirror"]');
      if (input) setMirror(input.value);
    });
  }
  if (testButton) testButton.addEventListener('click', testMirrors);
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) closeMirrorDialog();
  });
  dialog.addEventListener('close', syncScrollLock);
}

/* ---------- download ---------- */
function downloadApp(id) {
  var app = getApp(id);
  if (!app) return;
  var choice = effectiveMirror(app);
  var url = resolveDownload(app, choice.mirror);
  var filename = String(app.file || '').split('/').pop() || (app.id + '.apk');
  var link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  var message = app.name + ' · 开始下载（' + choice.mirror.name + '）';
  if (choice.fallback) {
    message = '当前线路不支持 ' + (app.size || '该文件') + ' 的大文件，已自动改用本站直连';
  }
  toast(message);
}

/* ---------- data loading ---------- */
function showError(message) {
  var grid = $('#appGrid');
  if (grid) {
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML = '<div class="error-card"><b>应用清单加载失败</b><p>' +
      esc(message) + '</p><p>请通过 HTTP 访问本页（例如 <code>python3 -m http.server</code>），而不是直接双击 HTML 文件。</p>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-retry style="margin-top:14px">重新加载</button></div>';
    var retry = grid.querySelector('[data-retry]');
    if (retry) retry.addEventListener('click', function () { location.reload(); });
  }
  var list = $('#knowledgeList');
  if (list) list.innerHTML = '<p class="grid-empty">知识库加载失败，请检查 apps/config.json。</p>';
}

async function loadData() {
  var config = await fetchJSON('apps/config.json');
  var registry = await fetchJSON('apps/index.json');
  var ids = Array.isArray(registry) ? registry : (registry.apps || []);
  var loaded = await Promise.all(ids.map(function (id) {
    return fetchJSON('apps/' + encodeURIComponent(id) + '.json').catch(function (error) {
      console.warn('[apps] 无法加载 ' + id + '：', error);
      return null;
    });
  }));
  state.config = config;
  state.apps = loaded.filter(function (app) {
    return app && app.id && app.name && app.file;
  });

  var savedMirror = null;
  try { savedMirror = localStorage.getItem('yy-mirror'); } catch (e) {}
  state.mirrorId = (savedMirror && getMirror(savedMirror)) ? savedMirror : (getMirror(config.defaultMirror) ? config.defaultMirror : 'direct');

  buildEntries();
  renderStats();
  renderCategories();
  renderApps();
  renderKnowledge();
  syncMirrorLabels();

  if (state.searchOpen) renderSearchPanel();
  var title = $('#pageTitle');
  if (title) title.textContent = (config.site && config.site.name) || document.title;
}

function initMisc() {
  var header = $('#siteHeader');
  function onScroll() {
    if (header) header.classList.toggle('scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var sort = $('#sortSelect');
  if (sort) {
    sort.addEventListener('change', function () {
      state.sort = sort.value;
      renderApps();
    });
  }

  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  var grid = $('#appGrid');
  if (grid) {
    grid.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-action]');
      if (!trigger) return;
      var action = trigger.getAttribute('data-action');
      var id = trigger.getAttribute('data-id');
      if (action === 'download') downloadApp(id);
      else if (action === 'detail') openApp(id);
    });
  }
}

function init() {
  initTheme();
  initMisc();
  initSearch();
  initAppDialog();
  initMirror();

  var grid = $('#appGrid');
  if (grid) {
    grid.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>';
    grid.setAttribute('aria-busy', 'true');
  }

  loadData().catch(function (error) {
    console.error('[apps] 加载失败：', error);
    showError(error && error.message ? error.message : '未知错误');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
