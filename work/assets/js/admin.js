/* NEWCYR · WORKSPACE — 后台：解密 Token / 编辑试卷 / 发布到 GitHub */
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
    busy: false
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
    toast._timer = setTimeout(() => el.classList.remove('show'), 3600);
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

  /* ---------------- 数据 ---------------- */
  function normalizeData(raw) {
    const data = Object.assign({ updatedAt: '', site: {}, papers: [] }, raw || {});
    data.site = Object.assign({ title: '作业答案中心', subtitle: '', notice: '' }, data.site || {});
    data.papers = Array.isArray(data.papers) ? data.papers : [];
    data.papers.forEach(p => {
      if (!p.id) p.id = uid('p');
      p.mode = p.mode === 'full' ? 'full' : 'step';
      ['title', 'subject', 'grade', 'date', 'summary'].forEach(k => { if (p[k] == null) p[k] = ''; });
      p.questions = Array.isArray(p.questions) ? p.questions : [];
      p.questions.forEach(q => {
        if (!q.id) q.id = uid('q');
        ['label', 'stem', 'answer'].forEach(k => { if (q[k] == null) q[k] = ''; });
        q.images = Array.isArray(q.images) ? q.images.filter(Boolean) : [];
        q.answerImages = Array.isArray(q.answerImages) ? q.answerImages.filter(Boolean) : [];
      });
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

  /* ---------------- 图片 ---------------- */
  const readFile = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });

  const loadImg = src => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片解析失败'));
    img.src = src;
  });

  async function prepareImage(file) {
    if (!file.type.startsWith('image/')) throw new Error('只支持图片文件');
    if (file.size > 8 * 1024 * 1024) throw new Error('单张图片不能超过 8MB');
    const dataUrl = await readFile(file);

    if (file.type === 'image/svg+xml') {
      if (file.size > 2 * 1024 * 1024) throw new Error('SVG 图片不能超过 2MB');
      return { dataUrl, ext: 'svg' };
    }
    if (file.type === 'image/gif') {
      if (file.size > 2 * 1024 * 1024) throw new Error('GIF 图片不能超过 2MB');
      return { dataUrl, ext: 'gif' };
    }

    const img = await loadImg(dataUrl);
    const needResize = img.naturalWidth > 1600 || file.size > 1.4 * 1024 * 1024;
    if (!needResize) {
      const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      return { dataUrl, ext };
    }
    const scale = Math.min(1, 1600 / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL('image/jpeg', 0.86);
    if (out.length > 6.5 * 1024 * 1024) throw new Error('压缩后图片仍然过大，请换一张');
    return { dataUrl: out, ext: 'jpg' };
  }

  async function uploadImage(file, paper) {
    const prep = await prepareImage(file);
    const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${prep.ext}`;
    const repoPath = `work/assets/uploads/${paper.id}/${name}`;
    const base64 = prep.dataUrl.split(',')[1] || '';
    await putBinary(repoPath, base64, `chore(work): 上传题目图片 ${name}`);
    return `assets/uploads/${paper.id}/${name}`;
  }

  function adminImgSrc(path) {
    if (!path) return '';
    if (/^(https?:|data:|blob:)/.test(path)) return path;
    return `../${path.replace(/^\.\//, '')}`;
  }

  /* ---------------- 侧栏 ---------------- */
  function renderSidebar() {
    const items = [];
    items.push(`
      <li>
        <button class="side-item site ${state.selected.kind === 'site' ? 'is-active' : ''}" type="button" data-select="site">
          <span class="t">站点信息</span>
          <span class="m">标题 · 副标题 · 公告</span>
        </button>
      </li>`);
    state.data.papers.forEach((p, i) => {
      items.push(`
        <li>
          <button class="side-item ${state.selected.kind === 'paper' && state.selected.id === p.id ? 'is-active' : ''}" type="button" data-select="${escapeHtml(p.id)}">
            <span class="t">${escapeHtml(p.title || '未命名试卷')}</span>
            <span class="m"><span>${String(i + 1).padStart(2, '0')} · ${p.questions.length} 题</span><span>${escapeHtml(p.subject || '未分类')}</span></span>
          </button>
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
    $('#sideFoot').textContent = `共 ${state.data.papers.length} 份试卷 · 修改后记得点击「保存并发布」`;
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
          <a class="preview-link" href="../index.html" target="_blank" rel="noopener">${ICONS.eye}预览首页</a>
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

  function questionEditorHtml(q, i) {
    const thumbs = (list, kind) => (list || []).map(src => `
      <div class="thumb">
        <img src="${escAttr(adminImgSrc(src))}" alt="">
        <button type="button" data-action="del-image" data-qi="${i}" data-kind="${kind}" data-src="${escAttr(src)}" aria-label="移除图片">${ICONS.x}</button>
      </div>`).join('');

    const upload = (kind, labelText, list) => `
      <div class="field">
        <span>${labelText}</span>
        <div class="img-line">
          <div class="thumbs">${thumbs(list, kind)}</div>
          <label class="upload-btn">
            ＋ 上传图片
            <input class="file-input" type="file" accept="image/*" multiple data-upload="${kind}" data-qi="${i}">
          </label>
        </div>
      </div>`;

    return `
      <div class="q-editor">
        <div class="q-editor-hd">
          <div class="no">
            <span class="badge">${escapeHtml(q.label || i + 1)}</span>
            <span class="kind">${q.images.length ? '图片题' : '文字题'}</span>
          </div>
          <div class="ops">
            <button class="mini-btn" type="button" data-action="move-up" data-qi="${i}" ${i === 0 ? 'disabled' : ''}>↑ 上移</button>
            <button class="mini-btn" type="button" data-action="move-down" data-qi="${i}">↓ 下移</button>
            <button class="mini-btn danger" type="button" data-action="del-question" data-qi="${i}">删除</button>
          </div>
        </div>
        <div class="q-editor-body">
          <div class="q-row">
            <label class="field">
              <span>题号</span>
              <input data-qi="${i}" data-qf="label" value="${escAttr(q.label)}" placeholder="1">
            </label>
            <label class="field">
              <span>题干文字</span>
              <textarea data-qi="${i}" data-qf="stem" rows="4" placeholder="支持换行；纯文字题目直接填在这里">${escAttr(q.stem)}</textarea>
            </label>
          </div>
          ${upload('stem', '题干图片（可选，可多张）', q.images)}
          <label class="field">
            <span>答案文字</span>
            <textarea data-qi="${i}" data-qf="answer" rows="4" placeholder="参考答案、解析步骤等">${escAttr(q.answer)}</textarea>
          </label>
          ${upload('answer', '答案图片（可选，可多张）', q.answerImages)}
        </div>
      </div>`;
  }

  function paperPanelHtml(p) {
    return `
      <div class="panel">
        <div class="panel-hd">
          <div>
            <h2>${escapeHtml(p.title || '新试卷')}</h2>
            <p>${p.questions.length} 道题 · ${escapeHtml(p.subject || '未分类')}</p>
          </div>
          <a class="preview-link" href="../paper.html?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener">${ICONS.eye}预览（已发布版本）</a>
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
              <span>答案展示方式</span>
              <select data-pfield="mode">
                <option value="step" ${p.mode === 'step' ? 'selected' : ''}>逐题查看答案</option>
                <option value="full" ${p.mode === 'full' ? 'selected' : ''}>整卷答案可见</option>
              </select>
              <small>逐题：先看题目列表，点进去才显示该题答案。整卷：打开试卷即展示全部答案。</small>
            </label>
            <label class="field span-2">
              <span>简介</span>
              <textarea data-pfield="summary" rows="2" placeholder="题目数量、考查范围等">${escAttr(p.summary)}</textarea>
            </label>
          </div>

          <div class="panel-actions" style="padding-top:6px;align-items:center">
            <h3 style="font-size:.95rem;letter-spacing:-.02em">题目（${p.questions.length}）</h3>
            <button class="btn btn-ghost btn-sm" type="button" data-action="add-question">＋ 添加题目</button>
          </div>
          ${p.questions.length ? p.questions.map(questionEditorHtml).join('') : '<div class="empty-q">还没有题目，点击「添加题目」开始。</div>'}

          <div class="panel-actions" style="border-top:1px solid var(--line);padding-top:16px">
            <button class="btn btn-danger btn-sm" type="button" data-action="del-paper">删除这份试卷</button>
            <span class="count-note">删除后需点击「保存并发布」才会生效</span>
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

  /* ---------------- 字段绑定 ---------------- */
  function bindPanelEvents() {
    const handler = e => {
      const t = e.target;
      if (t.type === 'file') return;
      let changed = false;
      if (t.dataset.sfield) {
        state.data.site[t.dataset.sfield] = t.value;
        changed = true;
      } else if (t.dataset.pfield) {
        const p = currentPaper();
        if (p) {
          p[t.dataset.pfield] = t.value;
          if (t.dataset.pfield === 'title') {
            const active = sideList.querySelector('.side-item.is-active .t');
            if (active) active.textContent = t.value || '未命名试卷';
          }
          changed = true;
        }
      } else if (t.dataset.qf) {
        const p = currentPaper();
        const q = p && p.questions[Number(t.dataset.qi)];
        if (q) { q[t.dataset.qf] = t.value; changed = true; }
      }
      if (changed) markDirty();
    };
    panel.addEventListener('input', handler);
    panel.addEventListener('change', handler);

    panel.addEventListener('click', async e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const p = currentPaper();
      const qi = Number(btn.dataset.qi);

      if (action === 'add-question' && p) {
        p.questions.push({
          id: uid('q'), label: String(p.questions.length + 1),
          stem: '', images: [], answer: '', answerImages: []
        });
        markDirty(); renderSidebar(); renderPanel();
      }

      if (action === 'del-question' && p) {
        if (!confirm('确定删除这道题？')) return;
        p.questions.splice(qi, 1);
        markDirty(); renderSidebar(); renderPanel();
      }

      if ((action === 'move-up' || action === 'move-down') && p) {
        const to = action === 'move-up' ? qi - 1 : qi + 1;
        if (to < 0 || to >= p.questions.length) return;
        [p.questions[qi], p.questions[to]] = [p.questions[to], p.questions[qi]];
        markDirty(); renderPanel();
      }

      if (action === 'del-image' && p) {
        const kind = btn.dataset.kind === 'answer' ? 'answerImages' : 'images';
        const src = btn.dataset.src;
        p.questions[qi][kind] = p.questions[qi][kind].filter(s => s !== src);
        markDirty(); renderPanel();
      }

      if (action === 'del-paper' && p) {
        if (!confirm(`确定删除《${p.title || '未命名试卷'}》？`)) return;
        state.data.papers = state.data.papers.filter(x => x.id !== p.id);
        state.selected = { kind: 'site' };
        markDirty(); renderSidebar(); renderPanel();
      }
    });

    panel.addEventListener('change', async e => {
      const input = e.target;
      if (!input.dataset.upload) return;
      if (!input.files || !input.files.length) return;
      const p = currentPaper();
      if (!p) return;
      const qi = Number(input.dataset.qi);
      const q = p.questions[qi];
      if (!q) return;
      const kind = input.dataset.upload === 'answer' ? 'answerImages' : 'images';
      const label = input.closest('.upload-btn');
      if (label) label.classList.add('is-busy');

      try {
        for (const file of Array.from(input.files)) {
          const path = await uploadImage(file, p);
          q[kind].push(path);
        }
        markDirty();
        renderPanel();
        toast('图片已上传到仓库，保存后可在页面显示');
      } catch (err) {
        toast(err.message, true);
        if (label) label.classList.remove('is-busy');
      }
    });
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
          repo: REPO,
          branch: BRANCH,
          dataPath: DATA_PATH,
          configPath: CONFIG_PATH,
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
    if (state.busy) return;
    if (!state.data) return;
    state.busy = true;
    saveBtn.disabled = true;
    saveBtn.textContent = '提交中…';
    try {
      state.data.updatedAt = new Date().toISOString();
      const text = JSON.stringify(state.data, null, 2) + '\n';
      const res = await putText(DATA_PATH, text, 'content(work): 更新试卷与答案', state.sha);
      state.sha = res.content.sha;
      cleanDirty();
      renderPanel();
      toast('已发布，GitHub Pages 约 1 分钟内更新');
    } catch (err) {
      setSync(err.message, 'err');
      toast(err.message, true);
      saveBtn.textContent = '保存并发布';
    } finally {
      state.busy = false;
      saveBtn.disabled = false;
      if (state.dirty) saveBtn.textContent = '保存并发布 •';
      else saveBtn.textContent = '保存并发布';
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
      const msg = err.name === 'OperationError'
        ? '密码错误，或密文已损坏'
        : err.message;
      setLoginMsg(msg, 'err');
      state.token = null;
      state.password = null;
    } finally {
      loginBtn.disabled = false;
      $('#loginBtnText').textContent = '解锁后台';
    }
  });

  /* ---------------- 其他按钮 ---------------- */
  $('#addPaperBtn').addEventListener('click', () => {
    const p = {
      id: uid('p'), title: '新试卷', subject: '', grade: '',
      date: today(), summary: '', mode: 'step', questions: []
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
  bindPanelEvents();
})();
