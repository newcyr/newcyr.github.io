/* NEWCYR · WORKSPACE — AI JSON 接口：粘贴 JSON 即可执行后台操作 */
(() => {
  const CFG = window.WORK_AI_CONFIG || {};
  const ACFG = window.WORK_ADMIN_CONFIG || {};
  const { $, escapeHtml } = window.Work;

  const API = 'https://api.github.com';
  const REPO = CFG.repo || 'newcyr/newcyr.github.io';
  const BRANCH = CFG.branch || 'main';
  const DATA_PATH = CFG.dataPath || 'work/data/papers.json';
  const SITE_URL = CFG.siteUrl || 'https://newcyr.github.io/work/';

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const state = {
    token: null,
    login: null,
    data: null,
    sha: null,
    busy: false,
    ready: false
  };

  const cmdInput = $('#cmdInput');
  const output = $('#output');
  const runBtn = $('#runBtn');
  const parseHint = $('#parseHint');
  const resultMeta = $('#resultMeta');

  /* ---------------- 基础工具 ---------------- */
  const uid = prefix => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const str = v => (v == null ? '' : String(v));
  const arr = v => (Array.isArray(v) ? v.filter(Boolean) : []);
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const today = () => new Date().toISOString().slice(0, 10);

  const b64 = {
    enc(bytes) {
      let s = '';
      bytes.forEach(b => { s += String.fromCharCode(b); });
      return btoa(s);
    },
    dec(value) {
      return Uint8Array.from(atob(String(value).replace(/\s+/g, '')), c => c.charCodeAt(0));
    }
  };
  const b64Text = text => b64.enc(enc.encode(text));
  const unb64Text = value => dec.decode(b64.dec(value));

  /* ---------------- 加解密（复用 admin/config.js 的密文） ---------------- */
  async function deriveKey(password, salt, iterations) {
    const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  }

  async function decryptPayload(password) {
    if (!crypto.subtle) throw new Error('当前环境不支持 WebCrypto，请通过 HTTPS 访问此页面');
    if (!ACFG.kdf || !ACFG.cipher) throw new Error('缺少 admin/config.js，无法解密 Token');
    const salt = b64.dec(ACFG.kdf.salt);
    const iv = b64.dec(ACFG.cipher.iv);
    const key = await deriveKey(password, salt, ACFG.kdf.iterations || 310000);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, b64.dec(ACFG.cipher.data));
    return JSON.parse(dec.decode(plain));
  }

  /* ---------------- GitHub API ---------------- */
  function apiError(status, message) {
    if (status === 401) return 'Token 无效或已失效，请在后台「高级设置」中更换 Token';
    if (status === 403) return 'Token 权限不足，或触发了 GitHub 频率限制';
    if (status === 404) return '仓库路径不存在，或分支填写有误';
    if (status === 409) return '数据已被其他修改更新，请先执行 {"action":"get"} 重新读取后再试';
    if (status === 422) return '提交被拒绝：内容可能过大或格式不合法';
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

  const getContents = path => gh(`/repos/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`);

  const putText = (path, text, message, sha) => gh(`/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    body: Object.assign({ message, content: b64Text(text), branch: BRANCH }, sha ? { sha } : {})
  });

  const putBinary = (path, base64, message) => gh(`/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    body: { message, content: base64, branch: BRANCH }
  });

  async function deletePath(path, message) {
    const file = await getContents(path);
    return gh(`/repos/${REPO}/contents/${path}`, {
      method: 'DELETE',
      body: { message, sha: file.sha, branch: BRANCH }
    });
  }

  /* ---------------- 数据标准化 ---------------- */
  function normalizeQuestion(raw, j) {
    const q = Object.assign({}, raw || {});
    q.id = str(q.id) || uid('q');
    q.label = str(q.label) || String(j + 1);
    q.stem = str(q.stem);
    q.answer = str(q.answer);
    q.images = arr(q.images);
    q.answerImages = arr(q.answerImages);
    return q;
  }

  function normalizeReview(raw, i) {
    const r = Object.assign({}, raw || {});
    return {
      id: str(r.id) || `r-${i + 1}`,
      name: str(r.name),
      rating: Math.min(5, Math.max(1, Math.round(Number(r.rating) || 5))),
      text: str(r.text),
      date: str(r.date)
    };
  }

  function normalizeSection(raw, si) {
    const s = Object.assign({}, raw || {});
    s.id = str(s.id) || uid('s');
    s.kind = s.kind === 'images' ? 'images' : 'qa';
    s.title = str(s.title) || (s.kind === 'images' ? '图片资料' : '题目与答案');
    s.note = str(s.note);
    s.images = arr(s.images);
    s.questions = s.kind === 'qa' ? arr(s.questions).map(normalizeQuestion) : [];
    return s;
  }

  function normalizePaper(raw) {
    const p = Object.assign({}, raw || {});
    p.id = str(p.id) || uid('p');
    p.mode = p.mode === 'full' ? 'full' : 'step';
    ['title', 'subject', 'grade', 'date', 'summary', 'cover'].forEach(k => { p[k] = str(p[k]); });
    if (!p.date) p.date = today();

    let sections = arr(p.sections);
    if (!sections.length && Array.isArray(p.questions) && p.questions.length) {
      sections = [{ id: `${p.id}-s1`, title: '题目与答案', kind: 'qa', questions: p.questions }];
    }
    p.sections = sections.map(normalizeSection);
    delete p.questions;
    p.reviews = arr(p.reviews).map(normalizeReview);
    return p;
  }

  function normalizeData(raw) {
    const data = Object.assign({ updatedAt: '', site: {}, papers: [] }, raw || {});
    data.site = Object.assign({ title: '作业答案中心', subtitle: '', notice: '' }, data.site || {});
    data.papers = arr(data.papers).map(normalizePaper);
    return data;
  }

  function stats(p) {
    const s = { sections: 0, questions: 0, images: 0 };
    p.sections.forEach(sec => {
      s.sections += 1;
      if (sec.kind === 'qa') s.questions += sec.questions.length;
      else s.images += sec.images.length;
      sec.questions.forEach(q => { s.images += q.images.length + q.answerImages.length; });
    });
    return s;
  }

  function summarize() {
    const papers = state.data ? state.data.papers : [];
    const questions = papers.reduce((n, p) => n + stats(p).questions, 0);
    const images = papers.reduce((n, p) => n + stats(p).images, 0);
    return { papers: papers.length, questions, images, updatedAt: state.data ? state.data.updatedAt : '' };
  }

  /* ---------------- 载入 ---------------- */
  async function loadRemote() {
    try {
      const file = await getContents(DATA_PATH);
      state.data = normalizeData(JSON.parse(unb64Text(file.content)));
      state.sha = file.sha;
    } catch (err) {
      if (err.status === 404) {
        state.data = normalizeData({});
        state.sha = null;
      } else {
        throw err;
      }
    }
  }

  async function publish(message) {
    state.data.updatedAt = new Date().toISOString();
    const text = JSON.stringify(state.data, null, 2) + '\n';
    const res = await putText(DATA_PATH, text, message || 'content(work): AI 更新数据', state.sha);
    state.sha = res.content.sha;
  }

  function paperById(id) {
    return state.data.papers.find(p => p.id === id) || null;
  }

  function findPaper(cmd) {
    if (cmd.paperId) {
      const p = paperById(str(cmd.paperId));
      if (!p) throw new Error(`未找到 paperId = ${cmd.paperId}`);
      return p;
    }
    if (cmd.title) {
      const list = state.data.papers.filter(p => p.title === str(cmd.title));
      if (!list.length) throw new Error(`未找到标题为「${cmd.title}」的试卷`);
      if (list.length > 1) throw new Error(`标题「${cmd.title}」对应多份试卷，请改用 paperId`);
      return list[0];
    }
    throw new Error('缺少 paperId 或 title');
  }

  function findSection(paper, cmd) {
    if (cmd.sectionId) {
      const s = paper.sections.find(x => x.id === str(cmd.sectionId));
      if (!s) throw new Error(`试卷中没有 sectionId = ${cmd.sectionId}`);
      return s;
    }
    if (cmd.sectionIndex != null) {
      const s = paper.sections[Number(cmd.sectionIndex)];
      if (!s) throw new Error(`栏目序号越界：${cmd.sectionIndex}`);
      return s;
    }
    throw new Error('缺少 sectionId 或 sectionIndex');
  }

  function questionIn(section, cmd) {
    if (cmd.questionId) {
      const q = section.questions.find(x => x.id === str(cmd.questionId));
      if (!q) throw new Error(`栏目中没有 questionId = ${cmd.questionId}`);
      return q;
    }
    if (cmd.questionIndex != null) {
      const q = section.questions[Number(cmd.questionIndex)];
      if (!q) throw new Error(`题目序号越界：${cmd.questionIndex}`);
      return q;
    }
    throw new Error('缺少 questionId 或 questionIndex');
  }

  function requireConfirm(cmd) {
    if (cmd.confirm !== true) throw new Error('此为破坏性操作，需要在指令中加入 "confirm": true');
  }

  /* ---------------- 清理图片 ---------------- */
  async function purgePaperImages(paperId) {
    let removed = 0;
    try {
      const list = await gh(`/repos/${REPO}/contents/work/assets/uploads/${paperId}?ref=${encodeURIComponent(BRANCH)}`);
      if (!Array.isArray(list)) return 0;
      for (const file of list) {
        if (file.type !== 'file') continue;
        try {
          await gh(`/repos/${REPO}/contents/${file.path}`, {
            method: 'DELETE',
            body: { message: 'chore(work): AI 清理已删除试卷的图片', sha: file.sha, branch: BRANCH }
          });
          removed += 1;
        } catch (e) { /* 忽略单个文件失败 */ }
      }
    } catch (e) { /* 目录不存在 */ }
    return removed;
  }

  async function deleteRepoImage(path) {
    try {
      await deletePath(`work/${path}`, 'chore(work): AI 删除图片');
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------------- 指令执行 ---------------- */
  async function execute(cmd) {
    if (!cmd || typeof cmd !== 'object' || Array.isArray(cmd)) {
      throw new Error('每条指令必须是一个 JSON 对象');
    }
    const action = str(cmd.action).trim();
    if (!action) throw new Error('缺少 action 字段');

    const dry = cmd.dryRun === true;
    const backup = dry ? clone(state.data) : null;
    if (dry) state.data = clone(state.data);

    let result = null;
    let mutated = false;
    let after = null;

    try {
      switch (action) {
        case 'get':
        case 'getData':
        case 'read': {
          result = {
            ok: true,
            action: 'get',
            login: state.login,
            repo: `${REPO}@${BRANCH}`,
            sha: state.sha,
            summary: summarize(),
            site: state.data.site,
            papers: state.data.papers
          };
          break;
        }

        case 'setSite': {
          const site = cmd.site && typeof cmd.site === 'object' ? cmd.site : cmd;
          ['title', 'subtitle', 'notice'].forEach(k => {
            if (site[k] != null) state.data.site[k] = str(site[k]);
          });
          mutated = true;
          result = { ok: true, action: 'setSite', site: state.data.site };
          break;
        }

        case 'upsertPaper':
        case 'createPaper': {
          if (!cmd.paper || typeof cmd.paper !== 'object') throw new Error('缺少 paper 对象');
          const next = normalizePaper(cmd.paper);
          const idx = state.data.papers.findIndex(p => p.id === next.id);
          const created = idx < 0;
          if (created) state.data.papers.push(next);
          else state.data.papers[idx] = next;
          mutated = true;
          result = {
            ok: true, action: 'upsertPaper', created,
            paperId: next.id, title: next.title, summary: stats(next)
          };
          break;
        }

        case 'patchPaper':
        case 'updatePaper': {
          const paper = findPaper(cmd);
          const patch = cmd.patch && typeof cmd.patch === 'object' ? cmd.patch : cmd.fields;
          if (!patch || typeof patch !== 'object') throw new Error('缺少 patch 对象');
          ['title', 'subject', 'grade', 'date', 'summary', 'cover', 'mode'].forEach(k => {
            if (patch[k] != null) paper[k] = str(patch[k]);
          });
          if (patch.mode != null) paper.mode = patch.mode === 'full' ? 'full' : 'step';
          if (Array.isArray(patch.sections)) paper.sections = patch.sections.map(normalizeSection);
          if (Array.isArray(patch.reviews)) paper.reviews = patch.reviews.map(normalizeReview);
          mutated = true;
          result = {
            ok: true, action: 'patchPaper',
            paperId: paper.id, title: paper.title, summary: stats(paper)
          };
          break;
        }

        case 'deletePaper': {
          requireConfirm(cmd);
          const paper = findPaper(cmd);
          const statsBefore = stats(paper);
          state.data.papers = state.data.papers.filter(p => p.id !== paper.id);
          mutated = true;
          result = { ok: true, action: 'deletePaper', paperId: paper.id, title: paper.title, removed: statsBefore };
          after = async () => {
            result.cleanup = { imagesDeleted: await purgePaperImages(paper.id) };
          };
          break;
        }

        case 'deleteSection': {
          requireConfirm(cmd);
          const paper = findPaper(cmd);
          const section = findSection(paper, cmd);
          paper.sections = paper.sections.filter(s => s.id !== section.id);
          mutated = true;
          result = { ok: true, action: 'deleteSection', paperId: paper.id, sectionId: section.id, title: section.title };
          break;
        }

        case 'deleteQuestion': {
          requireConfirm(cmd);
          const paper = findPaper(cmd);
          const section = findSection(paper, cmd);
          const q = questionIn(section, cmd);
          section.questions = section.questions.filter(x => x.id !== q.id);
          mutated = true;
          result = { ok: true, action: 'deleteQuestion', paperId: paper.id, sectionId: section.id, questionId: q.id, label: q.label };
          break;
        }

        case 'uploadImage': {
          if (!cmd.data) throw new Error('缺少 data（base64 或 dataURL）');
          const raw = str(cmd.data);
          const m = raw.match(/^data:(image\/(png|jpeg|jpg|webp|gif|svg\+xml));base64,/i);
          const base64 = (m ? raw.slice(m[0].length) : raw).replace(/\s+/g, '');
          if (!/^[A-Za-z0-9+/=]+$/.test(base64)) throw new Error('data 不是合法的 base64');
          let size = 0;
          try { size = atob(base64).length; } catch (e) { throw new Error('base64 解码失败'); }
          const limit = (CFG.maxImageMB || 2.5) * 1024 * 1024;
          if (size > limit) throw new Error(`图片约 ${(size / 1024 / 1024).toFixed(2)}MB，超过 ${CFG.maxImageMB || 2.5}MB 限制`);

          let ext = '';
          if (m) ext = m[2].toLowerCase().replace('jpeg', 'jpg').replace('svg+xml', 'svg');
          if (!ext && cmd.filename) ext = str(cmd.filename).split('.').pop().toLowerCase().replace('jpeg', 'jpg');
          if (!ext && cmd.ext) ext = str(cmd.ext).replace('.', '').toLowerCase();
          if (!['png', 'jpg', 'gif', 'webp', 'svg'].includes(ext)) ext = 'png';

          const folder = (str(cmd.paperId) || 'ai').replace(/[^a-zA-Z0-9_-]/g, '') || 'ai';
          const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
          const path = `assets/uploads/${folder}/${name}`;
          if (!dry) {
            await putBinary(`work/${path}`, base64, `chore(work): AI 上传图片 ${name}`);
          }
          result = {
            ok: true, action: 'uploadImage', dryRun: dry, path,
            url: `${SITE_URL}${path}`, bytes: size,
            note: '把 path 填入题目/栏目的 images 或 answerImages 字段，再执行 upsertPaper/patchPaper 发布'
          };
          break;
        }

        case 'deleteImage': {
          requireConfirm(cmd);
          const path = str(cmd.path);
          if (!path) throw new Error('缺少 path');
          if (!/^assets\/[A-Za-z0-9._\/-]+$/.test(path) || path.includes('..')) {
            throw new Error('path 必须是 data 中使用的相对路径，例如 assets/uploads/xxx/yyy.png');
          }
          let refs = 0;
          state.data.papers.forEach(p => p.sections.forEach(s => {
            const before = s.images.length;
            s.images = s.images.filter(x => x !== path);
            refs += before - s.images.length;
            s.questions.forEach(q => {
              const b1 = q.images.length;
              q.images = q.images.filter(x => x !== path);
              refs += b1 - q.images.length;
              const b2 = q.answerImages.length;
              q.answerImages = q.answerImages.filter(x => x !== path);
              refs += b2 - q.answerImages.length;
            });
          }));
          if (!refs && cmd.force !== true) throw new Error('没有任何内容引用这张图片；确认要删文件请加 "force": true');
          mutated = true;
          result = { ok: true, action: 'deleteImage', path, removedRefs: refs, fileDeleted: false };
          if (!dry) after = async () => { result.fileDeleted = await deleteRepoImage(path); };
          break;
        }

        case 'replaceAll': {
          requireConfirm(cmd);
          if (!Array.isArray(cmd.papers)) throw new Error('缺少 papers 数组');
          const papers = cmd.papers.map(normalizePaper);
          const site = cmd.site && typeof cmd.site === 'object' ? cmd.site : {};
          state.data = normalizeData({ site: Object.assign({}, state.data.site, site), papers });
          mutated = true;
          result = { ok: true, action: 'replaceAll', summary: summarize() };
          break;
        }

        default:
          throw new Error(`不支持的 action：${action}`);
      }

      if (dry) {
        const preview = result;
        return Object.assign({}, preview, {
          dryRun: true,
          preview: { summary: summarize(), site: state.data.site, papers: state.data.papers }
        });
      }

      if (mutated) await publish(str(cmd.message) || `content(work): AI ${action}`);
      if (after) await after();
      updateStatus();
      return result;
    } finally {
      if (dry) state.data = backup;
    }
  }

  /* ---------------- 状态与输出 ---------------- */
  function setStatus(text, kind = '') {
    $('#aiStatus').textContent = text;
    $('#aiDot').className = 'dot' + (kind ? ` ${kind}` : '');
  }

  function updateStatus() {
    const s = summarize();
    setStatus(`已连接 ${REPO} · ${BRANCH} · ${s.papers} 份试卷 / ${s.questions} 题 / ${s.images} 图 · ${state.login || ''}`);
  }

  function printResult(obj) {
    output.textContent = JSON.stringify(obj, null, 2);
    const ok = obj && obj.ok !== false;
    resultMeta.textContent = ok ? '执行完成 · 可继续粘贴下一条指令' : '执行失败 · 请修正 JSON 后重试';
    output.scrollTop = 0;
  }

  function showError(err) {
    printResult({ ok: false, error: err.message });
  }

  /* ---------------- 解析与运行 ---------------- */
  function updateParseHint() {
    const raw = cmdInput.value.trim();
    if (!raw) {
      parseHint.textContent = '等待指令';
      parseHint.className = 'ai-hint';
      return;
    }
    try {
      const data = JSON.parse(raw);
      const count = Array.isArray(data) ? data.length : 1;
      parseHint.textContent = `JSON 格式正确 · ${count} 条指令`;
      parseHint.className = 'ai-hint ok';
    } catch (err) {
      parseHint.textContent = `JSON 格式有误：${err.message}`;
      parseHint.className = 'ai-hint err';
    }
  }

  async function run() {
    if (state.busy || !state.ready) return;
    const raw = cmdInput.value.trim();
    if (!raw) { showError(new Error('请先粘贴 JSON 指令')); return; }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      showError(new Error(`JSON 解析失败：${err.message}`));
      return;
    }

    const commands = Array.isArray(parsed) ? parsed : [parsed];
    const results = [];
    state.busy = true;
    runBtn.disabled = true;
    runBtn.textContent = '执行中…';
    resultMeta.textContent = `正在执行 ${commands.length} 条指令…`;

    try {
      for (let i = 0; i < commands.length; i += 1) {
        try {
          const res = await execute(commands[i]);
          results.push(res);
        } catch (err) {
          results.push({ ok: false, index: i, action: str(commands[i] && commands[i].action), error: err.message });
          break;
        }
      }
      const payload = results.length === 1 && !Array.isArray(parsed)
        ? results[0]
        : { ok: results.every(r => r.ok !== false), results };
      printResult(payload);
    } finally {
      state.busy = false;
      runBtn.disabled = false;
      runBtn.textContent = '执行';
    }
  }

  /* ---------------- 示例 ---------------- */
  const SAMPLE = {
    action: 'upsertPaper',
    message: 'AI: 新建示例试卷',
    paper: {
      title: '八年级物理 · 第一章 单元测',
      subject: '物理',
      grade: '八年级',
      date: '2026-11-05',
      summary: '一题一答 + 纯图片栏目示例',
      mode: 'step',
      sections: [
        {
          title: '选择题与解析',
          kind: 'qa',
          questions: [
            {
              label: '1',
              stem: '光在同种均匀介质中沿什么传播？',
              answer: '沿直线传播。'
            }
          ]
        },
        {
          title: '图片资料',
          kind: 'images',
          note: '点击图片可放大查看。',
          images: ['assets/samples/rules.svg']
        }
      ]
    }
  };

  /* ---------------- 启动 ---------------- */
  async function boot() {
    setStatus('正在解密管理密码…');
    try {
      if (!CFG.password) throw new Error('ai-config.js 中缺少 password');
      const payload = await decryptPayload(CFG.password);
      if (!payload || !payload.token) throw new Error('Token 密文内容无效');
      state.token = payload.token;
      state.login = payload.login || '';

      const user = await gh('/user');
      state.login = user.login;
      await loadRemote();

      state.ready = true;
      runBtn.disabled = false;
      updateStatus();
      if (!cmdInput.value.trim()) cmdInput.value = JSON.stringify({ action: 'get' }, null, 2);
      updateParseHint();
      printResult({
        ok: true,
        ready: true,
        login: state.login,
        repo: `${REPO}@${BRANCH}`,
        summary: summarize(),
        tip: '已自动解锁。粘贴 JSON 指令后点击「执行」；示例可点右上角「载入示例」。'
      });
    } catch (err) {
      setStatus(err.message, 'err');
      printResult({ ok: false, stage: 'boot', error: err.message });
    }
  }

  /* ---------------- 事件 ---------------- */
  cmdInput.addEventListener('input', updateParseHint);
  runBtn.addEventListener('click', run);
  $('#reloadBtn').addEventListener('click', async () => {
    if (!state.ready) { boot(); return; }
    try {
      await loadRemote();
      updateStatus();
      printResult({ ok: true, action: 'reload', summary: summarize(), papers: state.data.papers });
    } catch (err) {
      showError(err);
    }
  });
  $('#sampleBtn').addEventListener('click', () => {
    cmdInput.value = JSON.stringify(SAMPLE, null, 2);
    updateParseHint();
  });
  $('#clearBtn').addEventListener('click', () => {
    cmdInput.value = '';
    updateParseHint();
    output.textContent = '// 结果会以 JSON 显示在这里';
    resultMeta.textContent = '尚未执行任何指令。';
  });
  $('#copyBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(output.textContent);
      $('#copyBtn').textContent = '已复制';
      setTimeout(() => { $('#copyBtn').textContent = '复制结果'; }, 1600);
    } catch (e) {
      showError(new Error('复制失败，请手动选中结果'));
    }
  });
  $('#fileInput').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      cmdInput.value = String(reader.result || '');
      updateParseHint();
    };
    reader.onerror = () => showError(new Error('读取文件失败'));
    reader.readAsText(file);
    e.target.value = '';
  });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !state.busy) run();
  });

  boot();
})();
