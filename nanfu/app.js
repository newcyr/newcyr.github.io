(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const vh = () => window.innerHeight;
  const isMobile = () => window.innerWidth <= 900;

  /* ---------------------------------------------------------
     Header / theme / menu
  --------------------------------------------------------- */
  const header = $('#siteHeader');
  const navSections = $$('[data-nav]');
  const menuOverlay = $('#menuOverlay');
  const menuBtn = $('#menuBtn');
  const menuClose = $('#menuClose');
  const langBtn = $('#langBtn');
  const langWrap = $('.lang-wrap');

  function updateHeaderTheme() {
    const probe = window.scrollY + header.offsetHeight * 0.5;
    let theme = 'dark';
    for (const sec of navSections) {
      const top = sec.offsetTop;
      const bottom = top + sec.offsetHeight;
      if (probe >= top && probe < bottom) { theme = sec.dataset.nav; break; }
      if (probe < top) break;
    }
    header.classList.toggle('dark', theme === 'dark');
    header.classList.toggle('light', theme === 'light');
    header.classList.toggle('solid', window.scrollY > 24);
  }

  function openMenu() {
    menuOverlay.classList.add('open');
    menuOverlay.setAttribute('aria-hidden', 'false');
    menuBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    menuOverlay.classList.remove('open');
    menuOverlay.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  menuBtn.addEventListener('click', openMenu);
  menuClose.addEventListener('click', closeMenu);
  $$('[data-close]').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  langBtn.addEventListener('click', e => {
    e.stopPropagation();
    const open = langWrap.classList.toggle('open');
    langBtn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', e => {
    if (!langWrap.contains(e.target)) langWrap.classList.remove('open');
  });

  /* ---------------------------------------------------------
     Frame sequence loader & canvas painters
  --------------------------------------------------------- */
  function framePath(base, i, ext = 'webp') {
    return `${base}/${String(i).padStart(5, '0')}.${ext}`;
  }

  function loadSequence(base, count, ext = 'webp') {
    const imgs = new Array(count);
    let loaded = 0;
    for (let i = 1; i <= count; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.src = framePath(base, i, ext);
      img.onload = () => { imgs[i - 1] = img; loaded++; };
      img.onerror = () => { imgs[i - 1] = false; };
    }
    return { imgs, get loaded() { return loaded; } };
  }

  function nearestFrame(seq, want) {
    const n = seq.imgs.length;
    want = clamp(want, 0, n - 1);
    if (seq.imgs[want] && seq.imgs[want] !== false) return seq.imgs[want];
    for (let d = 1; d < n; d++) {
      const a = want - d, b = want + d;
      if (a >= 0 && seq.imgs[a] && seq.imgs[a] !== false) return seq.imgs[a];
      if (b < n && seq.imgs[b] && seq.imgs[b] !== false) return seq.imgs[b];
    }
    return null;
  }

  function fitCanvas(canvas) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    return { w: canvas.width, h: canvas.height };
  }

  const heroSeq = loadSequence('assets/frames/banner', 120);
  const heroCanvas = $('#heroCanvas');
  const heroCtx = heroCanvas.getContext('2d');
  let heroSize = null;
  let heroDrawn = -1;

  function drawHeroFrame(index) {
    if (!heroSize) heroSize = fitCanvas(heroCanvas);
    const img = nearestFrame(heroSeq, index);
    if (!img || index === heroDrawn) return;
    const { w, h } = heroSize;
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    heroCtx.clearRect(0, 0, w, h);
    heroCtx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    heroDrawn = index;
  }

  const batterySeq = loadSequence('assets/frames/battery', 150);
  const batteryCanvas = $('#batteryCanvas');
  const batteryCtx = batteryCanvas.getContext('2d');
  let batterySize = null;
  let batteryDrawn = -1;

  function drawBatteryFrame(index) {
    if (!isMobile()) return;
    if (!batterySize) batterySize = fitCanvas(batteryCanvas);
    const img = nearestFrame(batterySeq, index);
    if (!img || index === batteryDrawn) return;
    batteryCtx.clearRect(0, 0, batterySize.w, batterySize.h);
    batteryCtx.drawImage(img, 0, 0, batterySize.w, batterySize.h);
    batteryDrawn = index;
  }

  /* ---------------------------------------------------------
     Scroll choreography
  --------------------------------------------------------- */
  const hero = $('#hero');
  const heroCopy = $('#heroCopy');
  const heroPart2 = $('#heroPart2');
  const timeline = $('#timeline');
  const tlBg = $('.tl-bg');
  const tlTrack = $('#tlTrack');
  const tlLines = $$('.tl-intro .line');
  const stats = $('#stats');
  const statSlides = $$('.stat-slide');
  const statTabs = $$('.tab');
  const green = $('#green');
  const greenBg = $('.green-bg');
  const greenRings = $$('.green-rings img');
  const greenTitle = $('.green-inner h2');
  const greenList = $('.green-list');
  const fixbox = $('#fixbox');

  let tlMax = 0;
  function measureTimeline() {
    tlMax = Math.max(0, tlTrack.scrollWidth - window.innerWidth);
  }

  function sectionProgress(el, extraVh = 0) {
    const start = el.offsetTop;
    const end = start + el.offsetHeight - vh() - extraVh;
    return clamp((window.scrollY - start) / Math.max(1, end - start));
  }

  function easeOutCubic(x) {
    return 1 - Math.pow(1 - clamp(x), 3);
  }

  let statIndex = -1;
  let lastY = window.scrollY;
  const statThresholds = [0.34, 0.67];

  function setStat(i) {
    if (i === statIndex) return;
    statIndex = i;
    statSlides.forEach((s, k) => s.classList.toggle('active', k === i));
    statTabs.forEach((t, k) => t.classList.toggle('active', k === i));
  }

  function render() {
    const sy = window.scrollY;

    updateHeaderTheme();

    if (isMobile()) {
      if (sy > lastY + 4 && sy > 120) header.classList.add('hide');
      else if (sy < lastY - 4) header.classList.remove('hide');
    } else {
      header.classList.remove('hide');
    }
    lastY = sy;

    /* ---- hero ---- */
    const hp = sectionProgress(hero);
    const fade = clamp(1 - hp / 0.30);
    const push = hp * (isMobile() ? 120 : 170);
    heroCopy.style.opacity = String(fade);
    heroCopy.style.transform = isMobile()
      ? `translateY(${-push}px) scale(${1 + hp * 0.05})`
      : `translateY(calc(-50% - ${push}px)) scale(${1 + hp * 0.04})`;
    heroCopy.style.pointerEvents = fade < 0.3 ? 'none' : 'auto';

    const frameIndex = Math.round(hp * 119);
    heroCanvas.style.opacity = String(clamp((hp - 0.01) / 0.12));
    drawHeroFrame(frameIndex);

    const p2in = clamp((hp - 0.50) / 0.14);
    const p2out = clamp((0.985 - hp) / 0.05);
    const p2 = Math.min(p2in, p2out);
    heroPart2.style.opacity = String(p2);
    heroPart2.style.pointerEvents = p2 > 0.2 ? 'auto' : 'none';

    /* ---- timeline (horizontal track) ---- */
    const tp = sectionProgress(timeline);
    tlBg.style.transform = `translateY(${(tp - 0.5) * -5}%) scale(1.06)`;
    tlTrack.style.transform = `translate3d(${-tp * tlMax}px, 0, 0)`;

    tlLines.forEach((el, i) => {
      const p = clamp((tp - 0.008 - i * 0.012) / 0.05);
      el.style.setProperty('--p', `${Math.round(easeOutCubic(p) * 100)}%`);
    });

    drawBatteryFrame(Math.round(clamp((tp - 0.08) / 0.9) * 149));

    /* ---- stats ---- */
    const sp = sectionProgress(stats);
    let si = 0;
    if (sp >= statThresholds[1]) si = 2;
    else if (sp >= statThresholds[0]) si = 1;
    setStat(si);

    /* ---- green (clip-path reveal + ring zoom) ---- */
    const gp = sectionProgress(green);
    const unit = window.innerWidth / 1440;
    const r0 = 112 * unit;
    const rMax = Math.hypot(window.innerWidth, window.innerHeight) * 1.2;
    let t = clamp((gp - 0.12) / 0.55);
    const grow = t * t * (3 - 2 * t);
    const radius = r0 + (rMax - r0) * grow;
    greenBg.style.clipPath = `circle(${Math.round(radius)}px at 50% 50%)`;

    const zoom = 1 + clamp((gp - 0.12) / 0.55) * 1.6;
    const rot = clamp((gp - 0.12) / 0.55) * 100;
    greenRings.forEach(img => {
      img.style.transform = `translate(-50%, -50%) scale(${zoom}) rotate(${rot}deg)`;
    });

    greenTitle.style.opacity = String(clamp((gp - 0.55) / 0.15));
    greenList.style.opacity = String(clamp((gp - 0.70) / 0.15));
    greenList.style.transform = `translateY(${(1 - clamp((gp - 0.70) / 0.15)) * 24}px)`;

    /* ---- fixbox ---- */
    if (isMobile()) fixbox.classList.toggle('compact', sy > vh() * 0.9);
    else fixbox.classList.remove('compact');

    /* ---- footer theme handled by navSections ---- */
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { render(); ticking = false; });
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------------------------------------------------------
     Stat tabs click
  --------------------------------------------------------- */
  statTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const i = parseInt(tab.dataset.i, 10);
      const range = stats.offsetHeight - vh();
      const target = stats.offsetTop + range * (i === 0 ? 0.08 : i === 1 ? 0.45 : 0.78);
      window.scrollTo({ top: target, behavior: 'smooth' });
    });
  });

  /* ---------------------------------------------------------
     Reveal on enter
  --------------------------------------------------------- */
  $$('.trusted-sub, .legend, .cstat, .china-map, .foot-top, .foot-mid').forEach(el => {
    el.classList.add('reveal');
  });

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.16, rootMargin: '0px 0px -40px' });
  $$('.reveal').forEach(el => io.observe(el));

  /* ---------------------------------------------------------
     Resize & init
  --------------------------------------------------------- */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      heroSize = null;
      heroDrawn = -1;
      measureTimeline();
      render();
    }, 180);
  });

  const heroVideo = $('#heroVideo');
  const p2video = $('.hp-video video');
  [heroVideo, p2video].forEach(v => { if (v) v.play().catch(() => {}); });

  /* preload models on idle */
  window.addEventListener('load', () => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => { render(); });
    } else {
      setTimeout(render, 200);
    }
  });

  // initial paint
  measureTimeline();
  render();
  updateHeaderTheme();
  setTimeout(render, 350);
})();
