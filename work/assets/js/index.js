/* NEWCYR · WORKSPACE — 试卷列表 */
(() => {
  const { $, ICONS, escapeHtml, loadData, formatDate, modeLabel, reveal, bindZoom, getLang } = window.Work;

  let DATA = { site: {}, papers: [], updatedAt: '' };
  let subject = 'all';
  let keyword = '';

  const grid = $('#paperGrid');
  const state = $('#paperState');
  const chips = $('#subjectChips');
  const search = $('#searchInput');

  function subjects() {
    const set = new Set();
    DATA.papers.forEach(p => { if (p.subject) set.add(p.subject); });
    return Array.from(set);
  }

  function match(p) {
    if (subject !== 'all' && p.subject !== subject) return false;
    if (!keyword) return true;
    const hay = [p.title, p.subject, p.grade, p.summary, ...(p.questions || []).map(q => q.stem || '')]
      .join('\n').toLowerCase();
    return hay.includes(keyword);
  }

  function cardHtml(p, i) {
    const total = p.questions.length;
    const badge = p.mode === 'full'
      ? (getLang() === 'en' ? 'Full paper' : '整卷答案')
      : (getLang() === 'en' ? 'Per question' : '逐题查看');
    const tags = [p.subject, p.grade].filter(Boolean)
      .map(t => `<span>${escapeHtml(t)}</span>`).join('');
    const href = `paper.html?id=${encodeURIComponent(p.id)}`;
    return `
      <a class="paper-card reveal" href="${href}" style="--d:${i % 4 * 60}ms" aria-label="${escapeHtml(p.title)}">
        <div class="p-top">
          <div class="p-icon">${String(i + 1).padStart(2, '0')}</div>
          <span class="p-badge">${escapeHtml(badge)}</span>
        </div>
        <div>
          <div class="p-cat">${escapeHtml(p.subject || '')}</div>
          <h3>${escapeHtml(p.title || '未命名试卷')}</h3>
        </div>
        <p class="p-desc">${escapeHtml(p.summary || '暂无简介')}</p>
        <div class="p-tags">${tags || '<span>未分类</span>'}</div>
        <div class="p-meta">
          <span>${total} ${getLang() === 'en' ? 'questions' : '题'} · ${escapeHtml(formatDate(p.date))}</span>
          <span class="p-link">${getLang() === 'en' ? 'Open' : '查看题目'} ${ICONS.arrow}</span>
        </div>
      </a>`;
  }

  function renderChips() {
    const list = subjects();
    if (!list.length) { chips.innerHTML = ''; return; }
    const allLabel = getLang() === 'en' ? 'All' : '全部';
    chips.innerHTML = [`<button class="chip ${subject === 'all' ? 'is-active' : ''}" type="button" data-subject="all">${allLabel}</button>`]
      .concat(list.map(s => `<button class="chip ${subject === s ? 'is-active' : ''}" type="button" data-subject="${escapeHtml(s)}">${escapeHtml(s)}</button>`))
      .join('');
    chips.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => {
      subject = btn.dataset.subject;
      renderChips(); renderGrid();
    }));
  }

  function renderState(text, sub) {
    grid.innerHTML = '';
    state.innerHTML = `
      <div class="state reveal">
        <div class="ico">${ICONS.search}</div>
        <h3>${escapeHtml(text)}</h3>
        <p>${escapeHtml(sub)}</p>
      </div>`;
    reveal(state);
  }

  function renderGrid() {
    const list = DATA.papers.filter(match);
    state.innerHTML = '';
    if (!DATA.papers.length) {
      renderState(getLang() === 'en' ? 'No papers yet' : '还没有试卷',
        getLang() === 'en' ? 'Add one from the admin page.' : '请到后台管理添加第一份试卷。');
      $('#countNote').textContent = '';
      return;
    }
    if (!list.length) {
      renderState(getLang() === 'en' ? 'No matching papers' : '没有匹配的试卷',
        getLang() === 'en' ? 'Try another keyword or subject.' : '换个关键词，或选择其他学科试试。');
    } else {
      grid.innerHTML = list.map(cardHtml).join('');
    }
    $('#countNote').textContent = `${list.length} / ${DATA.papers.length}`;
    reveal(grid);
  }

  function renderStats() {
    const questions = DATA.papers.reduce((n, p) => n + p.questions.length, 0);
    $('#statPapers').textContent = DATA.papers.length;
    $('#statQuestions').textContent = questions;
    $('#statSubjects').textContent = subjects().length;
    $('#statUpdated').textContent = formatDate(DATA.updatedAt) || '—';
  }

  function renderNotice() {
    const bar = $('#siteNotice');
    const text = DATA.site.notice || '';
    if (text) { $('#siteNoticeText').textContent = text; bar.hidden = false; }
    else bar.hidden = true;
    if (DATA.site.subtitle) {
      $('#heroSub').textContent = DATA.site.subtitle;
    }
    document.title = `${DATA.site.title || '作业答案中心'} · NEWCYR`;
  }

  function renderAll() {
    renderChips();
    renderGrid();
    renderStats();
    renderNotice();
    search.setAttribute('placeholder', getLang() === 'en' ? 'Search papers, subjects, keywords' : '搜索试卷、学科或关键词');
  }

  search.addEventListener('input', () => {
    keyword = search.value.trim().toLowerCase();
    renderGrid();
  });
  document.addEventListener('work:lang', renderAll);

  loadData('data/papers.json')
    .then(data => { DATA = data; renderAll(); })
    .catch(err => {
      renderState(getLang() === 'en' ? 'Failed to load' : '加载失败', err.message);
      $('#countNote').textContent = '';
    });
})();
