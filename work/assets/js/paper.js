/* NEWCYR · WORKSPACE — 试卷详情 / 题目 / 答案 */
(() => {
  const { $, ICONS, escapeHtml, escAttr, loadData, formatDate, modeLabel, reveal, bindZoom, getLang } = window.Work;

  const params = new URLSearchParams(location.search);
  const paperId = params.get('id');
  const questionId = params.get('q');

  let DATA = { site: {}, papers: [] };
  let paper = null;
  let answersVisible = true;

  const content = $('#paperContent');
  const state = $('#paperState');
  const toolbar = $('#qToolbar');

  function imgSrc(path) {
    if (!path) return '';
    if (/^(https?:|data:|blob:)/.test(path)) return path;
    /* 数据中的图片路径相对于 work/ 根目录 */
    return path;
  }

  function imgList(paths, extra = '') {
    return (paths || []).filter(Boolean)
      .map(p => `<img src="${escAttr(imgSrc(p))}" alt="题目图片" loading="lazy" data-zoom ${extra}>`)
      .join('');
  }

  function answerHtml(q, withHeading = true) {
    const head = withHeading
      ? `<div class="answer-hd">${ICONS.check}<span>${getLang() === 'en' ? 'Answer' : '参考答案'}</span></div>`
      : '';
    const body = q.answer
      ? `<div class="answer-body">${escapeHtml(q.answer)}</div>`
      : `<div class="answer-body">${escapeHtml(getLang() === 'en' ? 'No answer yet.' : '暂未填写答案。')}</div>`;
    return `<div class="answer">${head}${body}${imgList(q.answerImages, 'style="margin:12px 16px 16px"')}</div>`;
  }

  function renderFacts() {
    const facts = [];
    if (paper.subject) facts.push(`<span class="fact">${escapeHtml(paper.subject)}</span>`);
    if (paper.grade) facts.push(`<span class="fact">${escapeHtml(paper.grade)}</span>`);
    if (paper.date) facts.push(`<span class="fact">${ICONS.calendar}${escapeHtml(formatDate(paper.date))}</span>`);
    facts.push(`<span class="fact">${ICONS.layers}${paper.questions.length} ${getLang() === 'en' ? 'questions' : '题'}</span>`);
    facts.push(`<span class="fact mode">${escapeHtml(modeLabel(paper.mode))}</span>`);
    $('#paperFacts').innerHTML = facts.join('');
    $('#crumbTitle').textContent = paper.title || (getLang() === 'en' ? 'Paper' : '试卷');
    $('#paperTitle').textContent = paper.title || '未命名试卷';
    $('#paperSummary').textContent = paper.summary || '';
    document.title = `${paper.title || '试卷'} · 作业答案中心`;
  }

  function renderState(title, sub) {
    toolbar.innerHTML = '';
    content.innerHTML = '';
    state.innerHTML = `<div class="state"><div class="ico">${ICONS.doc}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(sub)}</p>
      <p style="margin-top:16px"><a class="btn btn-ghost btn-sm" href="index.html">${getLang() === 'en' ? 'Back to papers' : '返回试卷列表'}</a></p></div>`;
  }

  /* ---------------- 列表：逐题查看 ---------------- */
  function renderStepList() {
    toolbar.innerHTML = `
      <span class="label">${getLang() === 'en'
        ? `${paper.questions.length} questions · tap one to see the answer`
        : `本卷共 ${paper.questions.length} 题 · 点击题目查看答案`}</span>
      <span class="fact mode">${ICONS.eye}${getLang() === 'en' ? 'Tap to reveal' : '点题看答案'}</span>`;
    state.innerHTML = '';
    content.innerHTML = `<div class="q-list">${paper.questions.map((q, i) => `
      <a class="q-card q-linkcard reveal" href="paper.html?id=${encodeURIComponent(paper.id)}&q=${encodeURIComponent(q.id)}" style="--d:${i % 4 * 60}ms">
        <div class="q-hd">
          <div class="q-no">
            <span class="q-num">${escapeHtml(q.label || i + 1)}</span>
            <span class="q-type">${q.images.length ? (getLang() === 'en' ? 'Image question' : '图片题') : (getLang() === 'en' ? 'Question' : '题目')}</span>
          </div>
          <span class="go">${getLang() === 'en' ? 'See answer' : '查看答案'} ${ICONS.arrow}</span>
        </div>
        <div class="q-snippet">${escapeHtml(q.stem || '')}</div>
        <div class="p-meta" style="border-top:0;padding-top:4px">
          <span>${String(i + 1).padStart(2, '0')} / ${String(paper.questions.length).padStart(2, '0')}</span>
          <span>${q.answer ? (getLang() === 'en' ? 'Answer ready' : '答案已备') : (getLang() === 'en' ? 'No answer' : '暂无答案')}</span>
        </div>
      </a>`).join('')}</div>`;
    bindZoom(content);
    reveal(content);
  }

  /* ---------------- 列表：整卷答案 ---------------- */
  function renderFull() {
    toolbar.innerHTML = `
      <span class="label">${getLang() === 'en'
        ? `${paper.questions.length} questions · full answers shown`
        : `本卷共 ${paper.questions.length} 题 · 整卷答案已展开`}</span>
      <div class="q-actions" style="margin:0">
        <button class="btn btn-ghost btn-sm" id="toggleAnswers" type="button">${answersVisible ? ICONS.eyeOff + (getLang() === 'en' ? 'Hide answers' : '隐藏答案') : ICONS.eye + (getLang() === 'en' ? 'Show answers' : '显示答案')}</button>
        <button class="btn btn-ghost btn-sm" id="printPaper" type="button">${getLang() === 'en' ? 'Print' : '打印'}</button>
      </div>`;
    state.innerHTML = '';
    content.innerHTML = `<div class="q-list">${paper.questions.map((q, i) => `
      <article class="q-card reveal" style="--d:${i % 4 * 60}ms">
        <div class="q-hd">
          <div class="q-no">
            <span class="q-num">${escapeHtml(q.label || i + 1)}</span>
            <span class="q-type">${q.images.length ? (getLang() === 'en' ? 'Image question' : '图片题') : (getLang() === 'en' ? 'Question' : '题目')}</span>
          </div>
          <span class="q-index">${String(i + 1).padStart(2, '0')} / ${String(paper.questions.length).padStart(2, '0')}</span>
        </div>
        ${q.stem ? `<div class="q-stem">${escapeHtml(q.stem)}</div>` : ''}
        ${q.images.length ? `<div class="q-images">${imgList(q.images)}</div>` : ''}
        ${answerHtml(q)}
      </article>`).join('')}</div>`;

    const applyVisibility = () => {
      content.querySelectorAll('.answer').forEach(el => { el.hidden = !answersVisible; });
      $('#toggleAnswers').innerHTML = answersVisible
        ? ICONS.eyeOff + (getLang() === 'en' ? 'Hide answers' : '隐藏答案')
        : ICONS.eye + (getLang() === 'en' ? 'Show answers' : '显示答案');
    };
    applyVisibility();
    $('#toggleAnswers').addEventListener('click', () => { answersVisible = !answersVisible; applyVisibility(); });
    $('#printPaper').addEventListener('click', () => window.print());
    bindZoom(content);
    reveal(content);
  }

  /* ---------------- 单题详情 ---------------- */
  function renderQuestion() {
    const idx = paper.questions.findIndex(q => q.id === questionId);
    if (idx === -1) { renderStepList(); return; }
    const q = paper.questions[idx];

    toolbar.innerHTML = `
      <span class="label">${getLang() === 'en'
        ? `Question ${idx + 1} of ${paper.questions.length}`
        : `第 ${idx + 1} 题 · 共 ${paper.questions.length} 题`}</span>
      <a class="crumb-back" href="paper.html?id=${encodeURIComponent(paper.id)}" style="display:inline-flex;align-items:center;gap:6px;font-size:.82rem;font-weight:600;color:var(--brand)">${ICONS.back}${getLang() === 'en' ? 'Back to paper' : '返回试卷'}</a>`;

    state.innerHTML = '';
    content.innerHTML = `
      <article class="q-card" style="margin-top:26px">
        <div class="q-hd">
          <div class="q-no">
            <span class="q-num">${escapeHtml(q.label || idx + 1)}</span>
            <span class="q-type">${getLang() === 'en' ? 'Question' : '题目'}</span>
          </div>
          <span class="q-index">${String(idx + 1).padStart(2, '0')} / ${String(paper.questions.length).padStart(2, '0')}</span>
        </div>
        ${q.stem ? `<div class="q-stem">${escapeHtml(q.stem)}</div>` : ''}
        ${q.images.length ? `<div class="q-images">${imgList(q.images)}</div>` : ''}
        ${answerHtml(q)}
        <div class="q-nav">
          ${idx > 0
            ? `<a href="paper.html?id=${encodeURIComponent(paper.id)}&q=${encodeURIComponent(paper.questions[idx - 1].id)}">${ICONS.back}${getLang() === 'en' ? 'Previous' : '上一题'}</a>`
            : '<span class="q-nav disabled" aria-hidden="true"></span>'}
          <a class="btn btn-primary btn-sm" href="paper.html?id=${encodeURIComponent(paper.id)}">${getLang() === 'en' ? 'All questions' : '全部题目'} ${ICONS.arrow}</a>
          ${idx < paper.questions.length - 1
            ? `<a href="paper.html?id=${encodeURIComponent(paper.id)}&q=${encodeURIComponent(paper.questions[idx + 1].id)}">${getLang() === 'en' ? 'Next' : '下一题'} ${ICONS.arrow}</a>`
            : '<span class="q-nav disabled" aria-hidden="true"></span>'}
        </div>
      </article>`;
    bindZoom(content);
  }

  function render() {
    if (!paper) return;
    renderFacts();
    if (!paper.questions.length) {
      toolbar.innerHTML = '';
      content.innerHTML = '';
      state.innerHTML = `<div class="state"><div class="ico">${ICONS.doc}</div><h3>${getLang() === 'en' ? 'No questions yet' : '这份试卷还没有题目'}</h3><p>${getLang() === 'en' ? 'The admin can add questions from the dashboard.' : '管理员可在后台添加题目与答案。'}</p></div>`;
      return;
    }
    if (questionId) renderQuestion();
    else if (paper.mode === 'full') renderFull();
    else renderStepList();
  }

  document.addEventListener('work:lang', render);

  loadData('data/papers.json')
    .then(data => {
      DATA = data;
      paper = data.papers.find(p => p.id === paperId);
      if (!paper) {
        $('#paperTitle').textContent = getLang() === 'en' ? 'Paper not found' : '未找到试卷';
        $('#paperSummary').textContent = '';
        $('#paperFacts').innerHTML = '';
        renderState(getLang() === 'en' ? 'Paper not found' : '未找到这份试卷',
          getLang() === 'en' ? 'It may have been removed.' : '它可能已被删除，或链接有误。');
        return;
      }
      render();
    })
    .catch(err => renderState(getLang() === 'en' ? 'Failed to load' : '加载失败', err.message));
})();
