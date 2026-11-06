/* NEWCYR · WORKSPACE — 试卷详情：栏目 / 逐题隐藏答案 / 图片 / 用户评价 */
(() => {
  const {
    $, ICONS, escapeHtml, escAttr, loadData, formatDate, modeLabel, reveal, bindZoom, getLang,
    paperStats, starsHtml, averageRating, reviewsForPaper, localReviews, saveLocalReview, removeLocalReview,
    hydrateImages, IMG_PLACEHOLDER
  } = window.Work;

  const params = new URLSearchParams(location.search);
  const paperId = params.get('id');
  const focusQ = params.get('q');

  let paper = null;
  let answersHidden = true;
  let glanceHidden = false;
  let formRating = 5;
  let reviewNotice = '';

  const content = $('#paperContent');
  const state = $('#paperState');
  const toolbar = $('#qToolbar');
  const glance = $('#answerGlance');
  const reviewBox = $('#reviewSection');

  const isEn = () => getLang() === 'en';
  const T = (zh, en) => (isEn() ? en : zh);

  function imgList(paths, extra = '') {
    return (paths || []).filter(Boolean)
      .map(p => `<img src="${IMG_PLACEHOLDER}" data-img-path="${escAttr(p)}" alt="题目图片" loading="lazy" data-zoom ${extra}>`)
      .join('');
  }

  function answerHtml(q) {
    const body = q.answer
      ? `<div class="answer-body">${escapeHtml(q.answer)}</div>`
      : `<div class="answer-body is-empty">${T('暂未填写答案。', 'No answer yet.')}</div>`;
    return `
      <div class="answer">
        <div class="answer-hd">${ICONS.check}<span>${T('参考答案', 'Answer')}</span></div>
        ${body}
        ${q.answerImages.length ? `<div class="answer-images">${imgList(q.answerImages)}</div>` : ''}
      </div>`;
  }

  /* ---------------- 页头 ---------------- */
  function renderFacts() {
    const stats = paperStats(paper);
    const facts = [];
    if (paper.subject) facts.push(`<span class="fact">${escapeHtml(paper.subject)}</span>`);
    if (paper.grade) facts.push(`<span class="fact">${escapeHtml(paper.grade)}</span>`);
    if (paper.date) facts.push(`<span class="fact">${ICONS.calendar}${escapeHtml(formatDate(paper.date))}</span>`);
    facts.push(`<span class="fact">${ICONS.layers}${stats.sections} ${T('个栏目', 'sections')}</span>`);
    facts.push(`<span class="fact">${stats.questions} ${T('道题', 'questions')}</span>`);
    if (stats.images || stats.sections) {
      facts.push(`<span class="fact">${ICONS.image}${stats.images} ${T('张图片', 'images')}</span>`);
    }
    facts.push(`<span class="fact mode">${ICONS.eyeOff}${escapeHtml(modeLabel(paper.mode))}</span>`);
    $('#paperFacts').innerHTML = facts.join('');
    $('#crumbTitle').textContent = paper.title || T('试卷', 'Paper');
    $('#paperTitle').textContent = paper.title || T('未命名试卷', 'Untitled paper');
    $('#paperSummary').textContent = paper.summary || '';
    document.title = `${paper.title || T('试卷', 'Paper')} · ${T('作业答案中心', 'Answer Works')}`;
  }

  function renderState(title, sub) {
    toolbar.innerHTML = '';
    content.innerHTML = '';
    if (glance) { glance.innerHTML = ''; glance.className = ''; }
    if (reviewBox) reviewBox.innerHTML = '';
    state.innerHTML = `<div class="state"><div class="ico">${ICONS.doc}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(sub)}</p>
      <p style="margin-top:16px"><a class="btn btn-ghost btn-sm" href="index.html">${T('返回试卷列表', 'Back to papers')}</a></p></div>`;
  }

  /* ---------------- 栏目 ---------------- */
  function questionCard(q, index, total) {
    return `
      <article class="q-card reveal" id="q-${escAttr(q.id)}" data-qid="${escAttr(q.id)}" style="--d:${index % 4 * 60}ms">
        <div class="q-hd">
          <div class="q-no">
            <span class="q-num">${escapeHtml(q.label || index + 1)}</span>
            <span class="q-type">${q.images.length ? T('图片题', 'Image question') : T('题目', 'Question')}</span>
          </div>
          <div class="q-hd-right">
            <span class="q-index">${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
            <button class="answer-toggle" type="button" data-toggle-answer aria-expanded="false">
              ${ICONS.eye}<span>${T('显示答案', 'Show answer')}</span>
            </button>
          </div>
        </div>
        ${q.stem ? `<div class="q-stem">${escapeHtml(q.stem)}</div>` : ''}
        ${q.images.length ? `<div class="q-images">${imgList(q.images)}</div>` : ''}
        ${answerHtml(q)}
      </article>`;
  }

  function sectionHtml(section, si) {
    const isImages = section.kind === 'images';
    const count = isImages ? section.images.length : section.questions.length;
    return `
      <section class="sec-block reveal" id="sec-${escAttr(section.id)}" style="--d:${si % 4 * 60}ms">
        <div class="sec-hd">
          <div class="sec-hd-main">
            <span class="sec-kicker">${String(si + 1).padStart(2, '0')} · ${isImages ? T('图片栏目', 'Image section') : T('一题一答', 'Question & answer')}</span>
            <h2>${escapeHtml(section.title || T('未命名栏目', 'Untitled section'))}</h2>
            ${section.note ? `<p class="sec-note">${escapeHtml(section.note)}</p>` : ''}
          </div>
          <span class="fact">${isImages ? `${count} ${T('张图片', 'images')}` : `${count} ${T('道题', 'questions')}`}</span>
        </div>
        ${isImages
          ? (section.images.length
            ? `<div class="img-gallery">${section.images.map((src, ii) => `
                <figure class="img-tile">
                  <img src="${IMG_PLACEHOLDER}" data-img-path="${escAttr(src)}" alt="${escapeHtml(section.title || '图片')} ${ii + 1}" loading="lazy" data-zoom>
                  <figcaption><span>${String(ii + 1).padStart(2, '0')}</span>${T('点击放大', 'Tap to zoom')}</figcaption>
                </figure>`).join('')}</div>`
            : `<div class="sec-empty">${T('该栏目还没有图片。', 'No images in this section yet.')}</div>`)
          : (section.questions.length
            ? `<div class="q-list">${section.questions.map((q, qi) => questionCard(q, qi, section.questions.length)).join('')}</div>`
            : `<div class="sec-empty">${T('该栏目还没有题目。', 'No questions in this section yet.')}</div>`)}
      </section>`;
  }

  /* ---------------- 答案显隐 ---------------- */
  function setCardAnswer(card, show) {
    const answer = card.querySelector('.answer');
    const btn = card.querySelector('[data-toggle-answer]');
    if (!answer) return;
    answer.hidden = !show;
    if (btn) {
      btn.setAttribute('aria-expanded', String(show));
      btn.innerHTML = show
        ? `${ICONS.eyeOff}<span>${T('隐藏答案', 'Hide answer')}</span>`
        : `${ICONS.eye}<span>${T('显示答案', 'Show answer')}</span>`;
    }
  }

  function applyAllAnswers(hidden) {
    answersHidden = hidden;
    content.querySelectorAll('.q-card').forEach(card => setCardAnswer(card, !hidden));
    const btn = $('#toggleAllAnswers');
    if (btn) {
      btn.innerHTML = hidden
        ? `${ICONS.eye}<span>${T('显示全部答案', 'Show all answers')}</span>`
        : `${ICONS.eyeOff}<span>${T('隐藏全部答案', 'Hide all answers')}</span>`;
      btn.setAttribute('aria-pressed', String(!hidden));
    }
  }

  /* ---------------- 答案速览（进入试卷即完整展示全部答案） ---------------- */
  function glanceItems() {
    const items = [];
    let ordinal = 0;
    paper.sections.forEach(section => {
      if (section.kind !== 'qa') return;
      section.questions.forEach(q => {
        ordinal += 1;
        if (!q.answer && !q.answerImages.length) return;
        items.push({ q, label: q.label || String(ordinal) });
      });
    });
    return items;
  }

  function answerText(q) {
    return q.answer || T('图片答案', 'Image answer');
  }

  /* 速览行只取答案首行（如选择题的 C），完整内容在下方明细中展示 */
  function answerKey(q) {
    const text = answerText(q).trim();
    const first = text.split(/\r?\n/).find(line => line.trim()) || text;
    return first.length > 18 ? `${first.slice(0, 18)}…` : first;
  }

  function renderGlance() {
    if (!glance) return;
    const items = glanceItems();
    if (!items.length) {
      glance.innerHTML = '';
      glance.className = '';
      return;
    }
    /* 所有答案都是单行短答案时，仅用紧凑答案串即可完整展示，不再重复明细 */
    const compactOnly = items.every(({ q }) => {
      const text = answerText(q).trim();
      return q.answer && !/\r?\n/.test(text) && text.length <= 18;
    });
    const detailHtml = compactOnly ? '' : `
      <div class="ag-list">
        ${items.map(({ q, label }) => {
          const count = q.answerImages.length;
          const text = answerText(q);
          return `<a class="ag-item" href="#q-${escAttr(q.id)}" data-glance="${escAttr(q.id)}" title="${escAttr(text)}">
            <span class="ag-no">${escapeHtml(label)}</span>
            <span class="ag-text">${escapeHtml(text)}</span>
            ${count ? `<span class="ag-badge">${ICONS.image}${count}</span>` : ''}
          </a>`;
        }).join('')}
      </div>`;

    glance.className = `answer-glance reveal${glanceHidden ? ' is-hidden' : ''}`;
    glance.innerHTML = `
      <div class="ag-head">
        <span class="ag-mark">${ICONS.check}</span>
        <div class="ag-title">
          <small>Answer key</small>
          <h2>${T('全部答案', 'All answers')}</h2>
        </div>
        <span class="ag-count">${items.length} ${T('道题', 'answered')}</span>
        <button class="answer-toggle" id="glanceToggle" type="button" aria-expanded="${!glanceHidden}">
          ${glanceHidden ? ICONS.eye : ICONS.eyeOff}<span>${glanceHidden ? T('显示答案', 'Show answers') : T('隐藏答案', 'Hide answers')}</span>
        </button>
      </div>
      <div class="ag-strip">
        ${items.map(({ q, label }) => `<a class="ag-pair" href="#q-${escAttr(q.id)}" data-glance="${escAttr(q.id)}" title="${escAttr(answerText(q))}">
          <span class="ag-pair-no">${escapeHtml(label)}</span><span class="ag-pair-key">${escapeHtml(answerKey(q))}</span>
        </a>`).join('')}
      </div>
      ${detailHtml}`;

    $('#glanceToggle').addEventListener('click', () => {
      glanceHidden = !glanceHidden;
      glance.classList.toggle('is-hidden', glanceHidden);
      const btn = $('#glanceToggle');
      btn.setAttribute('aria-expanded', String(!glanceHidden));
      btn.innerHTML = `${glanceHidden ? ICONS.eye : ICONS.eyeOff}<span>${glanceHidden ? T('显示答案', 'Show answers') : T('隐藏答案', 'Hide answers')}</span>`;
    });

    glance.querySelectorAll('[data-glance]').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        const target = Array.from(content.querySelectorAll('[data-qid]'))
          .find(el => el.dataset.qid === item.dataset.glance);
        if (!target) return;
        setCardAnswer(target, true);
        content.querySelectorAll('.q-card.is-focus').forEach(el => el.classList.remove('is-focus'));
        target.classList.add('is-focus');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    reveal(glance);
  }

  /* ---------------- 评价 ---------------- */
  function reviewFormHtml(mine) {
    return `
      <form class="review-form" id="reviewForm" novalidate>
        <h3>${mine ? T('修改我的评价', 'Edit my review') : T('写下你的评价', 'Write a review')}</h3>
        <label class="field">
          <span>${T('昵称（可选）', 'Nickname (optional)')}</span>
          <input id="reviewName" maxlength="20" value="${escAttr(mine ? mine.name : '')}" placeholder="${T('匿名同学', 'Anonymous')}" autocomplete="nickname">
        </label>
        <div class="field">
          <span>${T('评分', 'Rating')}</span>
          <div class="star-input" id="starInput" role="group" aria-label="${T('评分', 'Rating')}">
            ${[1, 2, 3, 4, 5].map(n => `
              <button type="button" data-score="${n}" class="${n <= formRating ? 'on' : ''}" aria-label="${n} ${T('星', 'stars')}" aria-pressed="${n <= formRating}">${ICONS.star}</button>`).join('')}
          </div>
        </div>
        <label class="field">
          <span>${T('评价内容', 'Your review')}</span>
          <textarea id="reviewText" rows="4" maxlength="500" placeholder="${T('这份试卷的题目、答案或排版如何？', 'How are the questions, answers and layout?')}">${escapeHtml(mine ? mine.text : '')}</textarea>
        </label>
        <div class="review-form-foot">
          <button class="btn btn-primary btn-sm" type="submit">${mine ? T('更新评价', 'Update') : T('提交评价', 'Submit')}</button>
          ${mine ? `<button class="btn btn-ghost btn-sm" type="button" id="reviewDelete">${T('删除我的评价', 'Delete mine')}</button>` : ''}
          <span class="review-msg" id="reviewMsg"></span>
        </div>
        <p class="review-hint">${T('静态站点没有服务器，你的评价保存在本设备；管理员可在后台发布「精选评价」供所有人查看。', 'This is a static site: your review stays on this device. Admins can publish featured reviews visible to everyone.')}</p>
      </form>`;
  }

  function reviewListHtml(list) {
    if (!list.length) {
      return `<div class="review-empty"><div class="ico">${ICONS.star}</div><p>${T('还没有评价，来写第一条吧。', 'No reviews yet. Be the first to write one.')}</p></div>`;
    }
    return list
      .slice()
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .map(r => `
        <article class="review-item">
          <div class="r-top">
            <div class="r-who">
              <b>${escapeHtml(r.name || T('匿名同学', 'Anonymous'))}</b>
              ${r.local ? `<span class="r-tag">${T('我的评价', 'Mine')}</span>` : `<span class="r-tag r-gold">${T('精选', 'Featured')}</span>`}
            </div>
            <span class="r-date">${escapeHtml(formatDate(r.date))}</span>
          </div>
          ${starsHtml(r.rating)}
          <p class="r-text">${escapeHtml(r.text || T('（未填写评价内容）', '(No comment)'))}</p>
        </article>`)
      .join('');
  }

  function renderReviews() {
    if (!reviewBox) return;
    const list = reviewsForPaper(paper);
    const avg = averageRating(list);
    const mine = localReviews(paper.id)[0] || null;

    reviewBox.innerHTML = `
      <div class="reviews-sec">
        <div class="review-head">
          <div class="review-head-main">
            <span class="kicker">Reviews</span>
            <h2>${T('用户评价', 'User reviews')}</h2>
            <p>${T('看看大家怎么评价这份试卷。', 'See what others think about this paper.')}</p>
          </div>
          <div class="review-score">
            <b>${list.length ? avg.toFixed(1) : '—'}</b>
            <div>
              ${starsHtml(avg)}
              <span>${list.length} ${T('条评价', 'reviews')}</span>
            </div>
          </div>
        </div>
        <div class="review-grid">
          ${reviewFormHtml(mine)}
          <div class="review-list">${reviewListHtml(list)}</div>
        </div>
      </div>`;

    const starBox = $('#starInput');
    starBox.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        formRating = Number(btn.dataset.score) || 5;
        starBox.querySelectorAll('button').forEach(b => {
          const on = Number(b.dataset.score) <= formRating;
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', String(on));
        });
      });
    });

    $('#reviewForm').addEventListener('submit', e => {
      e.preventDefault();
      const text = $('#reviewText').value.trim();
      const name = $('#reviewName').value.trim();
      if (!text) {
        const msg = $('#reviewMsg');
        msg.textContent = T('请先填写评价内容。', 'Please write something first.');
        msg.classList.add('err');
        return;
      }
      saveLocalReview(paper.id, {
        id: mine ? mine.id : `r-${Date.now().toString(36)}`,
        name: name || '',
        rating: formRating,
        text: text
      });
      reviewNotice = T('评价已保存到本设备。', 'Saved on this device.');
      renderReviews();
      const msg = $('#reviewMsg');
      if (msg) { msg.textContent = reviewNotice; msg.classList.remove('err'); }
      reviewNotice = '';
    });

    const del = $('#reviewDelete');
    if (del) del.addEventListener('click', () => {
      if (!confirm(T('删除我的评价？', 'Delete my review?'))) return;
      removeLocalReview(paper.id, mine.id);
      renderReviews();
    });
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    if (!paper) return;
    renderFacts();
    const stats = paperStats(paper);

    if (!paper.sections.length) {
      renderState(T('这份试卷还没有内容', 'This paper is empty'),
        T('管理员可在后台添加栏目、题目与图片。', 'The admin can add sections, questions and images.'));
      return;
    }

    toolbar.innerHTML = `
      <span class="label">${stats.sections} ${T('个栏目', 'sections')} · ${stats.questions} ${T('道题', 'questions')} · ${stats.images} ${T('张图片', 'images')}</span>
      <div class="q-actions">
        <button class="btn btn-ghost btn-sm" id="toggleAllAnswers" type="button" aria-pressed="true">${ICONS.eyeOff}<span>${T('隐藏全部答案', 'Hide all answers')}</span></button>
        <button class="btn btn-ghost btn-sm" id="printPaper" type="button">${T('打印', 'Print')}</button>
      </div>`;

    state.innerHTML = '';
    content.innerHTML = paper.sections.map(sectionHtml).join('');
    hydrateImages(content);
    renderReviews();

    bindZoom(content);
    reveal(content);

    answersHidden = paper.mode !== 'full';
    applyAllAnswers(answersHidden);
    renderGlance();

    content.querySelectorAll('[data-toggle-answer]').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.q-card');
        const answer = card.querySelector('.answer');
        setCardAnswer(card, answer.hidden);
      });
    });

    $('#toggleAllAnswers').addEventListener('click', () => applyAllAnswers(!answersHidden));
    $('#printPaper').addEventListener('click', () => window.print());

    if (focusQ) {
      const target = Array.from(content.querySelectorAll('[data-qid]')).find(el => el.dataset.qid === focusQ);
      if (target) {
        setCardAnswer(target, true);
        target.classList.add('is-focus');
        setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
      }
    }
  }

  document.addEventListener('work:lang', () => { if (paper) render(); });
  document.addEventListener('work:reviews', () => { if (paper) renderReviews(); });

  loadData('data/papers.json')
    .then(data => {
      paper = data.papers.find(p => p.id === paperId);
      if (!paper) {
        $('#paperTitle').textContent = T('未找到试卷', 'Paper not found');
        $('#paperSummary').textContent = '';
        $('#paperFacts').innerHTML = '';
        renderState(T('未找到这份试卷', 'Paper not found'),
          T('它可能已被删除，或链接有误。', 'It may have been removed, or the link is wrong.'));
        return;
      }
      render();
    })
    .catch(err => renderState(T('加载失败', 'Failed to load'), err.message));
})();
