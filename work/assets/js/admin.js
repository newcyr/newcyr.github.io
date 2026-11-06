/* NEWCYR · WORKSPACE — 后台：解密 Token / 栏目编辑 / 多图上传 / 立即发布 */
(() => {
  const { $, $$, ICONS, escapeHtml, escAttr, formatDate } = window.Work;
  const CFG = window.WORK_ADMIN_CONFIG || {};

  const API = 'https://api.github.com';
  const REPO = CFG.repo || 'newcyr/newcyr.github.io';
  const BRANCH = CFG.branch || 'main';
  const DATA_PATH = CFG.dataPath || 'work/data/papers.json';
  const CONFIG_PATH = CFG.configPath || 'work/admin/config.js';

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const state = {
    token: null,
    password: null,
    login: null,
    data: null,
    sha: null,
    selected: { kind: 'site' },
    dirty: false,
    busy: false,
    previews: {}
  };

  const loginView = $('#loginView');
  const editorView = $('#editorView');
  const loginForm = $('#loginForm');
  const loginBtn = $('#loginBtn');
  const loginMsg = $('#loginMsg');
  const passwordInput = $('#password');
  const sideList = $('#sideList');
  const panel = $('#editorPanel');
  const saveBtn = $('#saveBtn');

  /* ---------------- 工具 ---------------- */
  const uid = prefix => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const today = () => new Date().toISOString().slice(0, 10);

  const b64 = {
    enc(bytes) {
      let s = '';
      bytes.forEach(b => { s += String.fromCharCode(b); });
      return btoa(s);
    },
    dec(str) {
      const clean = String(str).replace(/\s+/g, '');
      return Uint8Array.from(atob(clean), c => c.charCodeAt(0));
    }
  };
  const b64Text = text => b64.enc(enc.encode(text));
  const unb64Text = str => dec.decode(b64.dec(str));

  function toast(message, isError = false) {
    let el = $('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.toggle('err', isError);
    el.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('show'), 3800);
  }

  function setSync(text, kind = '') {
    $('#syncText').textContent = text;
    $('#syncDot').className = 'dot' + (kind ? ` ${kind}` : '');
  }

  function setLoginMsg(text, kind = '') {
    loginMsg.textContent = text;
    loginMsg.className = 'login-note' + (kind ? ` ${kind}` : '');
  }

  function markDirty() {
    state.dirty = true;
    saveBtn.textContent = '保存并发布 •';
    saveBtn.classList.add('has-dirty');
    setSync('有未保存的修改', 'warn');
  }

  function cleanDirty() {
    state.dirty = false;
    saveBtn.textContent = '保存并发布';
    saveBtn.classList.remove('has-dirty');
    setSync(`已同步 · ${state.login || ''}`, '');
  }

  /* ---------------- 加解密 ---------------- */
  async function deriveKey(password, salt, iterations) {
    const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  }

  async function decryptPayload(password) {
    if (!crypto.subtle) throw new Error('当前环境不支持 WebCrypto，请使用 HTTPS 或 localhost 打开');
    if (!CFG.kdf || !CFG.cipher) throw new Error('配置文件缺失，无法解密');
    const salt = b64.dec(CFG.kdf.salt);
    const iv = b64.dec(CFG.cipher.iv);
    const key = await deriveKey(password, salt, CFG.kdf.iterations || 310000);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, b64.dec(CFG.cipher.data));
    return JSON.parse(dec.decode(plain));
  }

  async function encryptPayload(obj, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const iterations = (CFG.kdf && CFG.kdf.iterations) || 310000;
    const key = await deriveKey(password, salt, iterations);
    const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
    return {
      iterations,
      salt: b64.enc(salt),
      iv: b64.enc(iv),
      data: b64.enc(new Uint8Array(buf))
    };
  }

  /* ---------------- GitHub API ---------------- */
  function apiError(status, message) {
    if (status === 401) return 'Token 无效或已失效，请更换 Token';
    if (status === 403) return 'Token 权限不足，或触发了 GitHub 频率限制';
    if (status === 404) return '文件不存在，或仓库/分支填写有误';
    if (status === 409) return '文件已被其他修改更新，请刷新后重试';
    if (status === 422) return '提交被拒绝：内容可能过大或参数不合法';
    return `GitHub API 错误（${status}）：${message || '未知错误'}`;
  }

  async function gh(path, options = {}) {
    const res = await fetch(API + path, {
      method: options.method || 'GET',
      headers: Object.assign({
        Authorization: `Bearer ${state.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }, options.body ? { 'Content-Type': 'application/json' } : {}),
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store'
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) {}
    if (!res.ok) {
      const err = new Error(apiError(res.status, data && data.message));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function getContents(path) {
    return gh(`/repos/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`);
  }

  async function putText(path, text, message, sha) {
    return gh(`/repos/${REPO}/contents/${path}`, {
      method: 'PUT',
      body: Object.assign({ message, content: b64Text(text), branch: BRANCH }, sha ? { sha } : {})
    });
  }

  async function putBinary(path, base64, message) {
    return gh(`/repos/${REPO}/contents/${path}`, {
      method: 'PUT',
      body: { message, content: base64, branch: BRANCH }
    });
  }

  async function deletePath(path, message) {
    const file = await getContents(path);
    return gh(`/repos/${REPO}/contents/${path}`, {
      method: 'DELETE',
      body: { message, sha: file.sha, branch: BRANCH }
    });
  }

  /* ---------------- 数据 ---------------- */
  function normalizeQuestion(q, j) {
    const item = Object.assign({}, q || {});
    if (!item.id) item.id = uid('q');
    ['label', 'stem', 'answer'].forEach(k => { if (item[k] == null) item[k] = ''; });
    item.images = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
    item.answerImages = Array.isArray(item.answerImages) ? item.answerImages.filter(Boolean) : [];
    return item;
  }

  function normalizeData(raw) {
    const data = Object.assign({ updatedAt: '', site: {}, papers: [] }, raw || {});
    data.site = Object.assign({ title: '作业答案中心', subtitle: '', notice: '' }, data.site || {});
    data.papers = Array.isArray(data.papers) ? data.papers.filter(Boolean) : [];
    data.papers.forEach(p => {
      if (!p.id) p.id = uid('p');
      p.mode = p.mode === 'full' ? 'full' : 'step';
      ['title', 'subject', 'grade', 'date', 'summary', 'cover'].forEach(k => { if (p[k] == null) p[k] = ''; });

      let sections = Array.isArray(p.sections) ? p.sections.filter(Boolean) : [];
      if (!sections.length && Array.isArray(p.questions) && p.questions.length) {
        sections = [{ id: `${p.id}-s1`, title: '题目与答案', kind: 'qa', questions: p.questions }];
      }
      p.sections = sections.map(s => {
        if (!s.id) s.id = uid('s');
        s.kind = s.kind === 'images' ? 'images' : 'qa';
        s.title = s.title || (s.kind === 'images' ? '图片资料' : '题目与答案');
        s.note = s.note || '';
        s.questions = Array.isArray(s.questions) ? s.questions.map(normalizeQuestion) : [];
        s.images = Array.isArray(s.images) ? s.images.filter(Boolean) : [];
        return s;
      });
      delete p.questions;

      p.reviews = Array.isArray(p.reviews) ? p.reviews.map((r, ri) => ({
        id: r.id || `r-${ri + 1}`,
        name: r.name || '',
        rating: Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5))),
        text: r.text || '',
        date: r.date || ''
      })) : [];
    });
    return data;
  }

  async function loadRemote() {
    try {
      const file = await getContents(DATA_PATH);
      const data = JSON.parse(unb64Text(file.content));
      state.data = normalizeData(data);
      state.sha = file.sha;
    } catch (err) {
      if (err.status === 404) {
        state.data = normalizeData({});
        state.sha = null;
        toast('仓库中还没有数据文件，保存后将自动创建', false);
      } else {
        throw err;
      }
    }
    state.selected = { kind: 'site' };
    state.dirty = false;
    renderSidebar();
    renderPanel();
    cleanDirty();
  }

  function currentPaper() {
    if (!state.data || state.selected.kind !== 'paper') return null;
    return state.data.papers.find(p => p.id === state.selected.id) || null;
  }

  function currentSection(si) {
    const p = currentPaper();
    return p ? p.sections[si] : null;
  }

  function paperStats(p) {
    const stats = { sections: p.sections.length, questions: 0, images: 0 };
    p.sections.forEach(s => {
      if (s.kind === 'qa') stats.questions += s.questions.length;
      else stats.images += s.images.length;
    });
    return stats;
  }

  /* ---------------- 图片 ---------------- */
  const readDataUrl = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('图片读取失败，请重试'));
    reader.readAsDataURL(file);
  });

  const loadImg = src => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('无法读取这张图片，可能是手机相机的 HEIC/HEIF 格式。请把相机格式设为「兼容性最佳 / JPEG」，或截图后再上传'));
    img.src = src;
  });

  const EXT_TYPE = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
    gif: 'image/gif', svg: 'image/svg+xml', bmp: 'image/bmp',
    heic: 'image/heic', heif: 'image/heif', avif: 'image/avif'
  };
  /* 可原样上传的格式（清晰度优先）；其余格式统一转成 JPG，兼容性最好 */
  const SAFE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

  function detectType(file) {
    if (file.type && file.type.startsWith('image/')) return file.type;
    const ext = String(file.name || '').split('.').pop().toLowerCase();
    return EXT_TYPE[ext] || '';
  }

  async function prepareImage(file) {
    const type = detectType(file);
    if (!type) throw new Error(`「${file.name}」不是受支持的图片格式，请使用 JPG / PNG / WebP`);
    if (file.size > 30 * 1024 * 1024) throw new Error(`「${file.name}」超过 30MB，请压缩后再上传`);
    const dataUrl = await readDataUrl(file);

    if (type === 'image/svg+xml' || type === 'image/gif') {
      if (file.size > 2 * 1024 * 1024) throw new Error('GIF / SVG 图片不能超过 2MB');
      return { dataUrl, ext: type === 'image/gif' ? 'gif' : 'svg' };
    }

    const img = await loadImg(dataUrl);
    const baseExt = (type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
    /* 截图类小图保留原格式，文字更清晰 */
    if (file.size <= 1.4 * 1024 * 1024 && img.naturalWidth <= 1600 && img.naturalHeight <= 1600 && SAFE_TYPES.includes(type)) {
      return { dataUrl, ext: baseExt };
    }

    let scale = Math.min(1, 1600 / img.naturalWidth, 1600 / img.naturalHeight);
    let quality = 0.86;
    let out = '';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      out = canvas.toDataURL('image/jpeg', quality);
      if (out.length <= 2.4 * 1024 * 1024) break;
      scale *= 0.82;
      quality = Math.max(0.6, quality - 0.1);
    }
    if (out.length > 2.8 * 1024 * 1024) throw new Error('图片压缩后仍然过大，请换一张更小的图片');
    return { dataUrl: out, ext: 'jpg' };
  }

  async function uploadImage(file, paper) {
    const prep = await prepareImage(file);
    const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${prep.ext}`;
    const repoPath = `work/assets/uploads/${paper.id}/${name}`;
    const base64 = prep.dataUrl.split(',')[1] || '';
    if (!base64) throw new Error('图片内容为空，无法上传');
    await putBinary(repoPath, base64, `chore(work): 上传图片 ${name}`);
    return { path: `assets/uploads/${paper.id}/${name}`, preview: prep.dataUrl };
  }

  function adminImgSrc(path) {
    if (!path) return '';
    if (/^(https?:|data:|blob:)/.test(path)) return path;
    const local = state.previews[path];
    if (local) return local;
    return `../${path.replace(/^\.\//, '')}`;
  }

  async function removeRepoImage(path) {
    if (!path || /^(https?:|data:|blob:)/.test(path)) return;
    const used = state.data.papers.some(p => p.sections.some(s =>
      (s.images || []).includes(path) ||
      (s.questions || []).some(q => (q.images || []).includes(path) || (q.answerImages || []).includes(path))
    ));
    if (used) return;
    try {
      await deletePath(`work/${path}`, 'chore(work): 删除不再使用的图片');
      delete state.previews[path];
    } catch (err) {
      /* 文件可能已不存在或被 Pages 缓存，忽略即可 */
    }
  }

  async function removePaperImages(paperId) {
    try {
      const list = await gh(`/repos/${REPO}/contents/work/assets/uploads/${paperId}?ref=${encodeURIComponent(BRANCH)}`);
      if (!Array.isArray(list)) return;
      for (const file of list) {
        if (file.type !== 'file') continue;
        await gh(`/repos/${REPO}/contents/${file.path}`, {
          method: 'DELETE',
          body: { message: 'chore(work): 清理已删除试卷的图片', sha: file.sha, branch: BRANCH }
        });
      }
    } catch (err) {
      /* 目录不存在或已清理，忽略 */
    }
  }

  /* ---------------- 侧栏 ---------------- */
  function renderSidebar() {
    const items = [`
      <li>
        <button class="side-item site ${state.selected.kind === 'site' ? 'is-active' : ''}" type="button" data-select="site">
          <span class="t">站点信息</span>
          <span class="m">标题 · 副标题 · 公告</span>
        </button>
      </li>`];

    state.data.papers.forEach(p => {
      const stats = paperStats(p);
      const active = state.selected.kind === 'paper' && state.selected.id === p.id;
      items.push(`
        <li class="side-row">
          <button class="side-item ${active ? 'is-active' : ''}" type="button" data-select="${escAttr(p.id)}">
            <span class="t">${escapeHtml(p.title || '未命名试卷')}</span>
            <span class="m"><span>${stats.sections} 栏目 · ${stats.questions} 题</span><span>${escapeHtml(p.subject || '未分类')}</span></span>
          </button>
          <button class="side-del" type="button" data-del-paper="${escAttr(p.id)}" title="删除并立即发布" aria-label="删除《${escAttr(p.title || '未命名试卷')}》">${ICONS.x}</button>
        </li>`);
    });

    sideList.innerHTML = items.join('');
    sideList.querySelectorAll('[data-select]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.select;
        state.selected = id === 'site' ? { kind: 'site' } : { kind: 'paper', id };
        renderSidebar();
        renderPanel();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    sideList.querySelectorAll('[data-del-paper]').forEach(btn => {
      btn.addEventListener('click', () => removePaper(btn.dataset.delPaper));
    });
    $('#sideFoot').textContent = `共 ${state.data.papers.length} 份试卷 · 删除操作会立即发布到线上`;
  }

  /* ---------------- 编辑面板 ---------------- */
  function sitePanelHtml() {
    const s = state.data.site;
    return `
      <div class="panel">
        <div class="panel-hd">
          <div>
            <h2>站点信息</h2>
            <p>显示在试卷中心首页的标题与说明。</p>
          </div>
          <div class="panel-hd-right">
            <a class="preview-link" href="../index.html" target="_blank" rel="noopener">${ICONS.eye}预览首页</a>
          </div>
        </div>
        <div class="panel-body">
          <div class="form-grid">
            <label class="field span-2">
              <span>站点标题</span>
              <input data-sfield="title" value="${escAttr(s.title)}" placeholder="作业答案中心">
            </label>
            <label class="field span-2">
              <span>副标题 / 首页说明</span>
              <textarea data-sfield="subtitle" rows="3" placeholder="选择试卷，查看题目与参考答案">${escAttr(s.subtitle)}</textarea>
            </label>
            <label class="field span-2">
              <span>公告（可选）</span>
              <textarea data-sfield="notice" rows="2" placeholder="留空则不显示">${escAttr(s.notice)}</textarea>
              <small>会以提示条形式显示在首页试卷列表下方。</small>
            </label>
          </div>
          <div class="panel-actions">
            <span class="count-note">最近更新：${escapeHtml(formatDate(state.data.updatedAt) || '—')}</span>
            <span class="count-note">修改后点击右上角「保存并发布」</span>
          </div>
        </div>
      </div>`;
  }

  function uploaderHtml(list, attrs, labelText) {
    const thumbs = (list || []).map(src => `
      <div class="thumb">
        <img src="${escAttr(adminImgSrc(src))}" alt="" loading="lazy">
        ${state.previews[src] ? '<span class="local-tag">新</span>' : ''}
        <button class="del" type="button" data-action="del-image" data-src="${escAttr(src)}" ${attrs} title="删除这张图片" aria-label="删除图片">${ICONS.x}</button>
      </div>`).join('');
    return `
      <div class="uploader">
        <div class="thumbs">${thumbs || '<span class="thumbs-empty">还没有图片，可一次上传多张</span>'}</div>
        <div class="upload-zone" data-dropzone ${attrs}>
          <label class="upload-btn">${ICONS.image}${labelText}
            <input class="file-input" type="file" accept="image/*" multiple data-upload ${attrs}>
          </label>
          <label class="upload-btn is-camera">${ICONS.camera}拍照上传
            <input class="file-input" type="file" accept="image/*" capture="environment" data-upload ${attrs}>
          </label>
          <span class="drop-tip">或拖拽图片到这里</span>
        </div>
      </div>`;
  }

  function questionEditorHtml(q, si, qi) {
    const attrs = `data-si="${si}" data-qi="${qi}"`;
    return `
      <div class="q-editor">
        <div class="q-editor-hd">
          <div class="no">
            <span class="badge">${escapeHtml(q.label || qi + 1)}</span>
            <span class="kind">${q.images.length ? '图片题' : '文字题'}</span>
          </div>
          <div class="ops">
            <button class="mini-btn" type="button" data-action="move-q-up" data-si="${si}" data-qi="${qi}" ${qi === 0 ? 'disabled' : ''}>↑ 上移</button>
            <button class="mini-btn" type="button" data-action="move-q-down" data-si="${si}" data-qi="${qi}">↓ 下移</button>
            <button class="mini-btn danger" type="button" data-action="del-question" data-si="${si}" data-qi="${qi}">删除</button>
          </div>
        </div>
        <div class="q-editor-body">
          <div class="q-row">
            <label class="field">
              <span>题号</span>
              <input data-qf="label" ${attrs} value="${escAttr(q.label)}" placeholder="1">
            </label>
            <label class="field">
              <span>题干文字</span>
              <textarea data-qf="stem" ${attrs} rows="3" placeholder="支持换行；纯图片题可以留空">${escAttr(q.stem)}</textarea>
            </label>
          </div>
          <div class="field">
            <span>题干图片（可多张）</span>
            ${uploaderHtml(q.images, `data-up="stem" ${attrs}`, '上传题干图片')}
          </div>
          <label class="field">
            <span>答案文字</span>
            <textarea data-qf="answer" ${attrs} rows="3" placeholder="参考答案、解析步骤等">${escAttr(q.answer)}</textarea>
          </label>
          <div class="field">
            <span>答案图片（可多张）</span>
            ${uploaderHtml(q.answerImages, `data-up="answer" ${attrs}`, '上传答案图片')}
          </div>
        </div>
      </div>`;
  }

  function sectionEditorHtml(s, si, total) {
    const isImages = s.kind === 'images';
    return `
      <div class="sec-editor">
        <div class="sec-editor-hd">
          <div class="sec-no">
            <span class="n">栏目 ${String(si + 1).padStart(2, '0')}</span>
            <span class="kind-badge ${s.kind}">${isImages ? '纯图片' : '一题一答'}</span>
          </div>
          <div class="ops">
            <button class="mini-btn" type="button" data-action="move-sec-up" data-si="${si}" ${si === 0 ? 'disabled' : ''}>↑ 上移</button>
            <button class="mini-btn" type="button" data-action="move-sec-down" data-si="${si}" ${si === total - 1 ? 'disabled' : ''}>↓ 下移</button>
            <button class="mini-btn danger" type="button" data-action="del-section" data-si="${si}">删除栏目</button>
          </div>
        </div>
        <div class="sec-editor-body">
          <div class="sec-row">
            <label class="field">
              <span>栏目名称</span>
              <input data-secf="title" data-si="${si}" value="${escAttr(s.title)}" placeholder="${isImages ? '例如：图形与辅助线' : '例如：选择题与证明题'}">
            </label>
            <div class="kind-switch">
              <span>栏目类型</span>
              <div class="seg" role="group" aria-label="栏目类型">
                <button type="button" class="${isImages ? '' : 'is-active'}" data-action="set-kind" data-si="${si}" data-kind="qa">一题一答</button>
                <button type="button" class="${isImages ? 'is-active' : ''}" data-action="set-kind" data-si="${si}" data-kind="images">纯图片</button>
              </div>
            </div>
          </div>
          ${isImages ? `
            <label class="field">
              <span>栏目说明（可选）</span>
              <input data-secf="note" data-si="${si}" value="${escAttr(s.note)}" placeholder="例如：点击图片可放大查看">
            </label>
            <div class="field">
              <span>栏目图片（可多张）</span>
              ${uploaderHtml(s.images, `data-up="section" data-si="${si}"`, '上传图片（可多选）')}
            </div>` : `
            <div class="sub-head">
              <div>
                <h4>题目（${s.questions.length}）</h4>
                <p>每道题都有独立的题干、题目图片、答案文字与答案图片。</p>
              </div>
              <div class="sub-actions">
                <button class="btn-xs" type="button" data-action="add-question" data-si="${si}">＋ 添加题目</button>
              </div>
            </div>
            ${s.questions.length ? s.questions.map((q, qi) => questionEditorHtml(q, si, qi)).join('') : '<div class="empty-q">这个栏目还没有题目，点击「添加题目」开始。</div>'}`}
        </div>
      </div>`;
  }

  function reviewsEditorHtml(p) {
    return `
      <div class="panel-sub">
        <div class="sub-head">
          <div>
            <h3>精选评价</h3>
            <p>精选评价会公开显示给所有访客；普通访客的评价只保存在其本机。</p>
          </div>
          <div class="sub-actions">
            <button class="btn-xs" type="button" data-action="add-review">＋ 添加精选评价</button>
          </div>
        </div>
        <div class="review-editor-list">
          ${p.reviews.length ? p.reviews.map((r, ri) => `
            <div class="review-row">
              <div class="review-row-top">
                <input data-rfield="name" data-ri="${ri}" value="${escAttr(r.name)}" placeholder="昵称（如：匿名同学）" maxlength="20">
                <select data-rfield="rating" data-ri="${ri}">
                  ${[5, 4, 3, 2, 1].map(n => `<option value="${n}" ${Number(r.rating) === n ? 'selected' : ''}>${n} 星</option>`).join('')}
                </select>
                <input type="date" data-rfield="date" data-ri="${ri}" value="${escAttr(r.date || '')}">
                <button class="mini-btn danger" type="button" data-action="del-review" data-ri="${ri}">删除</button>
              </div>
              <textarea data-rfield="text" data-ri="${ri}" rows="2" placeholder="评价内容" maxlength="500">${escapeHtml(r.text)}</textarea>
            </div>`).join('') : '<div class="empty-q">还没有精选评价，点击「添加精选评价」开始。</div>'}
        </div>
      </div>`;
  }

  function paperPanelHtml(p) {
    const stats = paperStats(p);
    return `
      <div class="panel">
        <div class="panel-hd">
          <div>
            <h2>${escapeHtml(p.title || '新试卷')}</h2>
            <p>${stats.sections} 个栏目 · ${stats.questions} 道题 · ${stats.images} 张图片</p>
          </div>
          <div class="panel-hd-right">
            <a class="preview-link" href="../paper.html?id=${encodeURIComponent(p.id)}&_=${Date.now()}" target="_blank" rel="noopener" title="预览读取线上已发布内容，未发布的修改不会显示">${ICONS.eye}预览线上</a>
          </div>
        </div>
        <div class="panel-body">
          <div class="form-grid">
            <label class="field span-2">
              <span>试卷标题</span>
              <input data-pfield="title" value="${escAttr(p.title)}" placeholder="八年级数学 · 第一章 单元测">
            </label>
            <label class="field">
              <span>学科</span>
              <input data-pfield="subject" value="${escAttr(p.subject)}" placeholder="数学">
            </label>
            <label class="field">
              <span>年级</span>
              <input data-pfield="grade" value="${escAttr(p.grade)}" placeholder="八年级">
            </label>
            <label class="field">
              <span>日期</span>
              <input type="date" data-pfield="date" value="${escAttr(p.date)}">
            </label>
            <label class="field">
              <span>Answer default</span>
              <select data-pfield="mode">
                <option value="step" ${p.mode === 'step' ? 'selected' : ''}>默认隐藏答案（阅读时逐题展开）</option>
                <option value="full" ${p.mode === 'full' ? 'selected' : ''}>默认显示答案（打开即可见）</option>
              </select>
              <small>访客仍可随时一键隐藏 / 显示全部答案。</small>
            </label>
            <label class="field span-2">
              <span>简介</span>
              <textarea data-pfield="summary" rows="2" placeholder="栏目、题目数量、考查范围等">${escAttr(p.summary)}</textarea>
            </label>
          </div>

          <div class="panel-sub">
            <div class="sub-head">
              <div>
                <h3>栏目</h3>
                <p>每个栏目可选择「一题一答」或「纯图片」，一个栏目可放多张图片。</p>
              </div>
              <div class="sub-actions">
                <button class="btn-xs" type="button" data-action="add-section" data-kind="qa">＋ 一题一答栏目</button>
                <button class="btn-xs" type="button" data-action="add-section" data-kind="images">＋ 纯图片栏目</button>
              </div>
            </div>
            ${p.sections.length ? p.sections.map((s, si) => sectionEditorHtml(s, si, p.sections.length)).join('') : '<div class="empty-q">还没有栏目，先添加一个「一题一答」或「纯图片」栏目。</div>'}
          </div>

          ${reviewsEditorHtml(p)}

          <div class="danger-zone">
            <div>
              <b>删除这份试卷</b>
              <p>立即从线上移除，并尝试清理该试卷已上传的图片。</p>
            </div>
            <button class="btn btn-danger btn-sm" type="button" data-action="del-paper">立即删除</button>
          </div>
        </div>
      </div>`;
  }

  function renderPanel() {
    if (state.selected.kind === 'site') {
      panel.innerHTML = sitePanelHtml();
      return;
    }
    const p = currentPaper();
    if (!p) { state.selected = { kind: 'site' }; panel.innerHTML = sitePanelHtml(); return; }
    panel.innerHTML = paperPanelHtml(p);
  }

  function rerenderPreserveScroll() {
    const y = window.scrollY;
    renderSidebar();
    renderPanel();
    requestAnimationFrame(() => window.scrollTo({ top: y }));
  }

  /* ---------------- 发布 ---------------- */
  async function publish(message) {
    state.data.updatedAt = new Date().toISOString();
    const text = JSON.stringify(state.data, null, 2) + '\n';
    const res = await putText(DATA_PATH, text, message, state.sha);
    state.sha = res.content.sha;
    cleanDirty();
    return res;
  }

  async function publishAfterDelete(message) {
    if (state.busy) return false;
    state.busy = true;
    saveBtn.disabled = true;
    saveBtn.textContent = '发布中…';
    let ok = false;
    try {
      await publish(message);
      ok = true;
      toast('已立即发布到线上，GitHub Pages 约 1 分钟内更新');
    } catch (err) {
      setSync(err.message, 'err');
      toast(err.message, true);
    } finally {
      state.busy = false;
      saveBtn.disabled = false;
      saveBtn.textContent = state.dirty ? '保存并发布 •' : '保存并发布';
    }
    return ok;
  }

  /* ---------------- 字段绑定 ---------------- */
  function bindField(e) {
    const t = e.target;
    if (t.type === 'file') return;
    let changed = false;
    const p = currentPaper();
    const si = Number(t.dataset.si);

    if (t.dataset.sfield) {
      state.data.site[t.dataset.sfield] = t.value;
      changed = true;
    } else if (t.dataset.pfield) {
      if (p) {
        p[t.dataset.pfield] = t.value;
        if (t.dataset.pfield === 'title') {
          const active = sideList.querySelector('.side-item.is-active .t');
          if (active) active.textContent = t.value || '未命名试卷';
        }
        changed = true;
      }
    } else if (t.dataset.secf && p) {
      const s = p.sections[si];
      if (s) { s[t.dataset.secf] = t.value; changed = true; }
    } else if (t.dataset.qf && p) {
      const s = p.sections[si];
      const q = s && s.questions[Number(t.dataset.qi)];
      if (q) { q[t.dataset.qf] = t.value; changed = true; }
    } else if (t.dataset.rfield && p) {
      const r = p.reviews[Number(t.dataset.ri)];
      if (r) {
        r[t.dataset.rfield] = t.dataset.rfield === 'rating' ? Number(t.value) : t.value;
        changed = true;
      }
    }
    if (changed) markDirty();
  }

  function resolveImageTarget(btn, p) {
    const si = Number(btn.dataset.si);
    const qi = Number(btn.dataset.qi);
    const s = p.sections[si];
    if (!s) return null;
    if (btn.dataset.up === 'section') return { list: s.images, kind: 'images', s };
    const q = s.questions[qi];
    if (!q) return null;
    if (btn.dataset.up === 'answer') return { list: q.answerImages, kind: 'answerImages', q, s };
    return { list: q.images, kind: 'images', q, s };
  }

  async function removePaper(paperId) {
    const p = state.data.papers.find(x => x.id === paperId);
    if (!p) return;
    if (!confirm(`确定删除《${p.title || '未命名试卷'}》并立即从线上移除？`)) return;
    state.data.papers = state.data.papers.filter(x => x.id !== paperId);
    state.selected = { kind: 'site' };
    markDirty();
    renderSidebar();
    renderPanel();
    if (await publishAfterDelete(`content(work): 删除试卷《${p.title || '未命名试卷'}》`)) {
      removePaperImages(paperId);
    }
  }

  async function handleAction(btn) {
    const action = btn.dataset.action;
    const p = currentPaper();
    if (!p) return;
    const si = Number(btn.dataset.si);
    const qi = Number(btn.dataset.qi);
    const s = p.sections[si];

    if (action === 'add-section') {
      const kind = btn.dataset.kind === 'images' ? 'images' : 'qa';
      p.sections.push({
        id: uid('s'),
        title: kind === 'images' ? '图片资料' : '题目与答案',
        kind, note: '', images: [],
        questions: kind === 'qa' ? [{ id: uid('q'), label: '1', stem: '', images: [], answer: '', answerImages: [] }] : []
      });
      markDirty(); renderSidebar(); renderPanel();
      return;
    }

    if (action === 'move-sec-up' || action === 'move-sec-down') {
      const to = action === 'move-sec-up' ? si - 1 : si + 1;
      if (to < 0 || to >= p.sections.length) return;
      [p.sections[si], p.sections[to]] = [p.sections[to], p.sections[si]];
      markDirty(); renderPanel();
      return;
    }

    if (action === 'del-section') {
      if (!s) return;
      const label = s.title || `栏目 ${si + 1}`;
      if (!confirm(`删除栏目「${label}」并立即发布？栏目内的题目和图片也会从线上移除。`)) return;
      p.sections.splice(si, 1);
      markDirty(); renderSidebar(); renderPanel();
      await publishAfterDelete(`content(work): 删除栏目 ${label}`);
      return;
    }

    if (action === 'set-kind') {
      if (!s) return;
      const kind = btn.dataset.kind === 'images' ? 'images' : 'qa';
      if (s.kind === kind) return;
      s.kind = kind;
      s.title = s.title || (kind === 'images' ? '图片资料' : '题目与答案');
      markDirty(); renderPanel();
      return;
    }

    if (action === 'add-question') {
      if (!s) return;
      s.questions.push({
        id: uid('q'), label: String(s.questions.length + 1),
        stem: '', images: [], answer: '', answerImages: []
      });
      markDirty(); renderSidebar(); renderPanel();
      return;
    }

    if (action === 'del-question') {
      if (!s || !s.questions[qi]) return;
      const qLabel = s.questions[qi].label || qi + 1;
      if (!confirm(`删除第 ${qLabel} 题并立即发布？`)) return;
      s.questions.splice(qi, 1);
      markDirty(); renderSidebar(); renderPanel();
      await publishAfterDelete(`content(work): 删除题目 ${qLabel}`);
      return;
    }

    if (action === 'move-q-up' || action === 'move-q-down') {
      if (!s) return;
      const to = action === 'move-q-up' ? qi - 1 : qi + 1;
      if (to < 0 || to >= s.questions.length) return;
      [s.questions[qi], s.questions[to]] = [s.questions[to], s.questions[qi]];
      markDirty(); renderPanel();
      return;
    }

    if (action === 'del-image') {
      const target = resolveImageTarget(btn, p);
      if (!target) return;
      const src = btn.dataset.src;
      if (!confirm('删除这张图片并立即发布？')) return;
      target.list = target.list.filter(x => x !== src);
      /* 数组是引用，需要写回 */
      if (target.kind === 'images' && target.q) target.q.images = target.list;
      else if (target.kind === 'answerImages' && target.q) target.q.answerImages = target.list;
      else target.s.images = target.list;
      markDirty(); renderPanel();
      if (await publishAfterDelete('chore(work): 删除图片')) removeRepoImage(src);
      return;
    }

    if (action === 'del-paper') {
      await removePaper(p.id);
      return;
    }

    if (action === 'add-review') {
      p.reviews.push({ id: uid('r'), name: '', rating: 5, text: '', date: today() });
      markDirty(); renderPanel();
      return;
    }

    if (action === 'del-review') {
      p.reviews.splice(Number(btn.dataset.ri), 1);
      markDirty(); renderPanel();
    }
  }

  async function handleUpload(input) {
    const p = currentPaper();
    if (!p) return;
    const files = Array.from(input.files || []);
    if (!files.length) return;

    const target = resolveImageTarget(input, p);
    if (!target) { toast('找不到上传位置，请刷新页面后重试', true); return; }

    const zone = input.closest('.upload-zone');
    if (zone) zone.classList.add('is-busy');
    const originalText = zone ? zone.querySelector('.drop-tip') : null;
    let okCount = 0;
    const errors = [];

    for (const file of files) {
      if (originalText) originalText.textContent = `上传中… ${okCount}/${files.length}`;
      try {
        const { path, preview } = await uploadImage(file, p);
        state.previews[path] = preview;
        target.list.push(path);
        if (target.kind === 'images' && target.q) target.q.images = target.list;
        else if (target.kind === 'answerImages' && target.q) target.q.answerImages = target.list;
        else target.s.images = target.list;
        okCount += 1;
        markDirty();
      } catch (err) {
        errors.push(err.message);
      }
    }

    if (zone) zone.classList.remove('is-busy');
    if (originalText) originalText.textContent = '或拖拽图片到这里';

    rerenderPreserveScroll();
    if (okCount && errors.length) toast(`已上传 ${okCount} 张，${errors.length} 张失败：${errors[0]}`);
    else if (okCount) toast(`已上传 ${okCount} 张图片，保存并发布后线上可见`, false);
    else toast(errors[0] || '上传失败', true);
  }

  /* ---------------- 高级：更换 Token ---------------- */
  function renderAdvanced() {
    const main = editorView.querySelector('.editor-main');
    let box = $('#advancedPanel');
    if (!box) {
      box = document.createElement('div');
      box.id = 'advancedPanel';
      main.appendChild(box);
    }
    box.innerHTML = `
      <div class="panel">
        <div class="panel-body" style="padding:0">
          <details class="tip" style="margin:0;padding:18px 22px;border:0">
            <summary>高级设置 · 更换 GitHub Token</summary>
            <p>当前 Token 以 PBKDF2 + AES-GCM 密文形式存放在 <code>admin/config.js</code>。若 Token 失效，请粘贴新的 Token，系统会用当前密码重新加密并提交。</p>
            <label class="field" style="margin-top:12px">
              <span>新的 Token</span>
              <input id="newToken" type="password" placeholder="ghp_… 或 github_pat_…" autocomplete="off">
            </label>
            <button class="btn btn-ghost btn-sm" id="changeTokenBtn" type="button" style="margin-top:12px">加密并提交</button>
          </details>
        </div>
      </div>`;
    $('#changeTokenBtn').addEventListener('click', async () => {
      const input = $('#newToken');
      const value = input.value.trim();
      if (!value) { toast('请先填写新的 Token', true); return; }
      if (!state.password) { toast('会话已失效，请重新登录', true); return; }
      const btn = $('#changeTokenBtn');
      btn.disabled = true;
      btn.textContent = '提交中…';
      try {
        const payload = await encryptPayload({ token: value, login: state.login || 'newcyr' }, state.password);
        const config = {
          repo: REPO, branch: BRANCH, dataPath: DATA_PATH, configPath: CONFIG_PATH,
          kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: payload.iterations, salt: payload.salt },
          cipher: { name: 'AES-GCM', iv: payload.iv, data: payload.data },
          updatedAt: new Date().toISOString()
        };
        const text = `/* 由后台自动生成：Token 密文，请勿手动修改 */\nwindow.WORK_ADMIN_CONFIG = ${JSON.stringify(config, null, 2)};\n`;
        const file = await getContents(CONFIG_PATH);
        await putText(CONFIG_PATH, text, 'chore(work): 更新后台 Token 密文', file.sha);
        state.token = value;
        input.value = '';
        toast('Token 已加密并提交，Pages 更新后生效');
      } catch (err) {
        toast(err.message, true);
      } finally {
        btn.disabled = false;
        btn.textContent = '加密并提交';
      }
    });
  }

  /* ---------------- 保存 / 刷新 ---------------- */
  async function save() {
    if (state.busy || !state.data) return;
    state.busy = true;
    saveBtn.disabled = true;
    saveBtn.textContent = '提交中…';
    try {
      await publish('content(work): 更新试卷、答案与评价');
      renderPanel();
      toast('已发布，GitHub Pages 约 1 分钟内更新');
    } catch (err) {
      setSync(err.message, 'err');
      toast(err.message, true);
    } finally {
      state.busy = false;
      saveBtn.disabled = false;
      saveBtn.textContent = state.dirty ? '保存并发布 •' : '保存并发布';
    }
  }

  async function reload() {
    if (state.dirty && !confirm('有未保存的修改，确定放弃并刷新？')) return;
    setSync('正在刷新…');
    try {
      await loadRemote();
      toast('已从仓库重新载入');
    } catch (err) {
      setSync(err.message, 'err');
      toast(err.message, true);
    }
  }

  /* ---------------- 登录 ---------------- */
  function showEditor() {
    loginView.hidden = true;
    editorView.hidden = false;
    document.title = '后台管理 · 作业答案中心';
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const password = passwordInput.value.trim();
    if (!password) { setLoginMsg('请输入管理密码', 'err'); return; }

    loginBtn.disabled = true;
    $('#loginBtnText').textContent = '解密中…';
    setLoginMsg('正在本地解密 Token…');

    try {
      const payload = await decryptPayload(password);
      if (!payload || !payload.token) throw new Error('密文内容无效');
      state.token = payload.token;
      state.password = password;
      state.login = payload.login || null;

      setLoginMsg('Token 已解密，正在验证…', 'ok');
      const user = await gh('/user');
      state.login = user.login;

      setLoginMsg('正在读取试卷数据…', 'ok');
      await loadRemote();
      renderAdvanced();
      showEditor();
      toast(`欢迎回来，${user.login}`);
    } catch (err) {
      const msg = err.name === 'OperationError' ? '密码错误，或密文已损坏' : err.message;
      setLoginMsg(msg, 'err');
      state.token = null;
      state.password = null;
    } finally {
      loginBtn.disabled = false;
      $('#loginBtnText').textContent = '解锁后台';
    }
  });

  /* ---------------- 事件 ---------------- */
  panel.addEventListener('input', bindField);
  panel.addEventListener('change', e => {
    /* data-upload 是空值属性，dataset.upload 为 ""，必须按属性是否存在判断 */
    if (e.target.matches && e.target.matches('[data-upload]')) { handleUpload(e.target); return; }
    bindField(e);
  });

  panel.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    handleAction(btn);
  });

  /* 拖拽上传 */
  panel.addEventListener('dragover', e => {
    const zone = e.target.closest('[data-dropzone]');
    if (!zone) return;
    e.preventDefault();
    zone.classList.add('is-over');
  });
  panel.addEventListener('dragleave', e => {
    const zone = e.target.closest('[data-dropzone]');
    if (zone) zone.classList.remove('is-over');
  });
  panel.addEventListener('drop', e => {
    const zone = e.target.closest('[data-dropzone]');
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove('is-over');
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    handleUpload({ files: e.dataTransfer.files, dataset: zone.dataset, closest: () => zone });
  });

  /* ---------------- 其他按钮 ---------------- */
  $('#addPaperBtn').addEventListener('click', () => {
    const p = {
      id: uid('p'), title: '新试卷', subject: '', grade: '',
      date: today(), summary: '', mode: 'step', cover: '',
      sections: [{ id: uid('s'), title: '题目与答案', kind: 'qa', note: '', images: [], questions: [
        { id: uid('q'), label: '1', stem: '', images: [], answer: '', answerImages: [] }
      ] }],
      reviews: []
    };
    state.data.papers.push(p);
    state.selected = { kind: 'paper', id: p.id };
    markDirty(); renderSidebar(); renderPanel();
  });
  saveBtn.addEventListener('click', save);
  $('#reloadBtn').addEventListener('click', reload);
  $('#logoutBtn').addEventListener('click', () => {
    if (state.dirty && !confirm('有未保存的修改，确定退出？')) return;
    location.reload();
  });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && !editorView.hidden) {
      e.preventDefault();
      save();
    }
  });

  passwordInput.focus();
})();
