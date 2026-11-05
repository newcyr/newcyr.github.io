/* NEWCYR · WORKSPACE — 试卷列表 / 用户评价 */
(() => {
  const {
    $, ICONS, escapeHtml, loadData, formatDate, reveal, starsHtml,
    paperStats, averageRating, reviewsForPaper
  } = window.Work;

  let DATA = { site: {}, papers: [], updatedAt: '' };
  let subject = 'all';
  let keyword = '';

  const grid = $('#paperGrid');
  const state = $('#paperState');
  const chips = $('#subjectChips');
  const search = $('#searchInput');
  const reviewList = $('#reviewList');
  const reviewSummary = $('#reviewSummary');

  const T = (zh, en) => (window.Work.getLang() === 'en' ? en : zh);

  function subjects() {
    const set = new Set();
    DATA.papers.forEach(p => { if (p.subject) set.add(p.subject); });
    return Array.from(set);
  }

  function allReviews() {
    const items = [];
    DATA.papers.forEach(p => {
      reviewsForPaper(p).forEach(r => {
        items.push(Object.assign({}, r, { paperId: p.id, paperTitle: p.title }));
      });
    });
    return items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  function match(p) {
    if (subject !== 'all' && p.subject !== subject) return false;
    if (!keyword) return true;
    const hay = [p.title, p.subject, p.grade, p.summary, ...p.sections.map(s => s.title || '')]
      .join('\n').toLowerCase();
    return hay.includes(keyword);
  }

  function cardHtml(p, i) {
    const stats = paperStats(p);
    const badge = p.mode === 'full'
      ? T('默认显示答案', 'Answers shown')
      : T('默认隐藏答案', 'Answers hidden');
    const tags = [p.subject, p.grade].filter(Boolean)
      .map(t => `<span>${escapeHtml(t)}</span>`).join('');
    const reviews = reviewsForPaper(p);
    const avg = averageRating(reviews);
    const rating = reviews.length
      ? `<span class="p-rating">${ICONS.star}${avg.toFixed(1)}<i>(${reviews.length})</i></span>`
      : '';
    const href = `paper.html?id=${encodeURIComponent(p.id)}`;
    return `
      <a class="paper-card reveal" href="${href}" style="--d:${i % 4 * 60}ms" aria-label="${escapeHtml(p.title)}">
        <div class="p-top">
          <div class="p-icon">${String(i + 1).padStart(2, '0')}</div>
          <span class="p-badge">${escapeHtml(badge)}</span>
        </div>
        <div>
          <div class="p-cat">${escapeHtml(p.subject || '')}</div>
          <h3>${escapeHtml(p.title || T('未命名试卷', 'Untitled paper'))}</h3>
        </div>
        <p class="p-desc">${escapeHtml(p.summary || T('暂无简介', 'No summary yet'))}</p>
        <div class="p-tags">${tags || `<span>${T('未分类', 'Uncategorized')}</span>`}</div>
        <div class="p-meta">
          <span>${stats.questions} ${T('题', 'questions')} · ${stats.images} ${T('图', 'images')} · ${escapeHtml(formatDate(p.date))}</span>
          ${rating || `<span class="p-link">${T('查看题目', 'Open')} ${ICONS.arrow}</span>`}
        </div>
      </a>`;
  }

  function renderChips() {
    const list = subjects();
    if (!list.length) { chips.innerHTML = ''; return; }
    const allLabel = T('全部', 'All');
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
      renderState(T('还没有试卷', 'No papers yet'),
        T('请到后台管理添加第一份试卷。', 'Add one from the admin page.'));
      $('#countNote').textContent = '';
      return;
    }
    if (!list.length) {
      renderState(T('没有匹配的试卷', 'No matching papers'),
        T('换个关键词，或选择其他学科试试。', 'Try another keyword or subject.'));
    } else {
      grid.innerHTML = list.map(cardHtml).join('');
    }
    $('#countNote').textContent = `${list.length} / ${DATA.papers.length}`;
    reveal(grid);
  }

  function renderStats() {
    const papers = DATA.papers;
    const questions = papers.reduce((n, p) => n + paperStats(p).questions, 0);
    const reviews = allReviews();
    const avg = averageRating(reviews);
    $('#statPapers').textContent = papers.length;
    $('#statQuestions').textContent = questions;
    $('#statSubjects').textContent = subjects().length;
    $('#statRating').textContent = reviews.length ? avg.toFixed(1) : '—';
    $('#statReviews').textContent = reviews.length ? `${reviews.length} ${T('条评价', 'reviews')}` : T('暂无评价', 'No reviews');
  }

  function renderNotice() {
    const bar = $('#siteNotice');
    const text = DATA.site.notice || '';
    if (text) { $('#siteNoticeText').textContent = text; bar.hidden = false; }
    else bar.hidden = true;
    if (DATA.site.subtitle) $('#heroSub').textContent = DATA.site.subtitle;
    document.title = `${DATA.site.title || '作业答案中心'} · NEWCYR`;
  }

  function renderReviews() {
    if (!reviewList || !reviewSummary) return;
    const list = allReviews();
    const avg = averageRating(list);

    reviewSummary.innerHTML = `
      <div class="review-score home-score">
        <b>${list.length ? avg.toFixed(1) : '—'}</b>
        <div>
          ${starsHtml(avg)}
          <span>${list.length ? `${list.length} ${T('条评价', 'reviews')}` : T('还没有评价', 'No reviews yet')}</span>
        </div>
      </div>`;

    if (!list.length) {
      reviewList.innerHTML = `
        <div class="review-empty wide">
          <div class="ico">${ICONS.star}</div>
          <h3>${T('还没有人评价', 'No reviews yet')}</h3>
          <p>${T('打开任意试卷，在页面底部写下你的评价。', 'Open any paper and leave a review at the bottom.')}</p>
          <p style="margin-top:14px"><a class="btn btn-primary btn-sm" href="#papers">${T('去选择试卷', 'Browse papers')} ${ICONS.arrow}</a></p>
        </div>`;
      return;
    }

    reviewList.innerHTML = list.slice(0, 8).map(r => `
      <article class="review-item reveal">
        <div class="r-top">
          <div class="r-who">
            <b>${escapeHtml(r.name || T('匿名同学', 'Anonymous'))}</b>
            ${r.local ? `<span class="r-tag">${T('我的评价', 'Mine')}</span>` : `<span class="r-tag r-gold">${T('精选', 'Featured')}</span>`}
          </div>
          <span class="r-date">${escapeHtml(formatDate(r.date))}</span>
        </div>
        ${starsHtml(r.rating)}
        <p class="r-text">${escapeHtml(r.text || '')}</p>
        ${r.paperTitle ? `<a class="r-paper" href="paper.html?id=${encodeURIComponent(r.paperId)}">${ICONS.doc}${escapeHtml(r.paperTitle)}</a>` : ''}
      </article>`).join('');
    reveal(reviewList);
  }

  function renderAll() {
    renderChips();
    renderGrid();
    renderStats();
    renderNotice();
    renderReviews();
    search.setAttribute('placeholder', T('搜索试卷、学科或关键词', 'Search papers, subjects, keywords'));
  }

  search.addEventListener('input', () => {
    keyword = search.value.trim().toLowerCase();
    renderGrid();
  });
  document.addEventListener('work:lang', renderAll);
  document.addEventListener('work:reviews', () => { renderStats(); renderReviews(); });

  loadData('data/papers.json')
    .then(data => { DATA = data; renderAll(); })
    .catch(err => {
      renderState(T('加载失败', 'Failed to load'), err.message);
      $('#countNote').textContent = '';
    });
})();
