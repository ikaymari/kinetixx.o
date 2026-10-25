/* =====================================================================
   KINETIX — Enhancement script (loads after kinetix-script.js)
   Self-contained, wrapped in an IIFE, touches no existing globals.
   Modules: progress · header · nav spy · back-to-top · reveal ·
            tilt · spotlight · particle background
   ===================================================================== */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- Build injected UI ---------- */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html) n.innerHTML = html;
    return n;
  }

  var bg = el('div', 'kx-bg',
    '<div class="kx-bg__grid"></div>' +
    '<div class="kx-bg__orb kx-bg__orb--1"></div>' +
    '<div class="kx-bg__orb kx-bg__orb--2"></div>' +
    '<div class="kx-bg__orb kx-bg__orb--3"></div>' +
    '<canvas class="kx-bg__canvas"></canvas>' +
    '<div class="kx-bg__noise"></div>');
  bg.setAttribute('aria-hidden', 'true');
  var progress = el('div', 'kx-progress');
  var spot = el('div', 'kx-spot');
  var topBtn = el('button', 'kx-top',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>');
  topBtn.type = 'button';
  topBtn.setAttribute('aria-label', 'Back to top');
  document.body.insertBefore(bg, document.body.firstChild);
  document.body.appendChild(progress);
  document.body.appendChild(spot);
  document.body.appendChild(topBtn);

  /* ---------- Scroll-driven: progress, header, back-to-top ---------- */
  var header = $('.site-header');
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY || doc.scrollTop;
      var max = doc.scrollHeight - window.innerHeight;
      progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')';
      if (header) header.classList.toggle('is-scrolled', y > 24);
      topBtn.classList.toggle('is-visible', y > 600);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
  topBtn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* ---------- Nav scroll-spy ---------- */
  var links = $$('#navLinks a[href^="#"]');
  var targets = links.map(function (a) { return $(a.getAttribute('href')); }).filter(Boolean);
  if ('IntersectionObserver' in window && targets.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach(function (t) { spy.observe(t); });
  }

  /* ---------- Reveal on scroll (with stagger) ---------- */
  var revealSel = [
    '.section-head', '.announcements-heading', '.reveal-cap', '.purpose-item',
    '.team-heading', '.team-card', '.category-heading', '.services-intro',
    '.legal-intro', '.product-card', '.product-video-card', '.ach-card',
    '.contact-item', '.gal-video-card'
  ].join(',');

  if (!reduceMotion && 'IntersectionObserver' in window) {
    doc.classList.add('kx-js');
    var items = $$(revealSel);
    items.forEach(function (n) {
      n.classList.add('kx-reveal');
      var sibs = n.parentElement ? $$(':scope > ' + n.tagName.toLowerCase() + '.' + n.classList[0], n.parentElement) : [];
      var idx = Math.max(0, sibs.indexOf(n));
      n.style.setProperty('--kx-delay', Math.min(idx, 6) * 70 + 'ms');
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (n) { io.observe(n); });
    // Safety net: never leave content hidden
    setTimeout(function () { items.forEach(function (n) { n.classList.add('is-in'); }); }, 6000);
  }

  /* ---------- 3D tilt on team + achievement cards ---------- */
  if (finePointer && !reduceMotion) {
    $$('.team-card, .ach-card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--kx-ry', (px * 8).toFixed(2) + 'deg');
        card.style.setProperty('--kx-rx', (-py * 8).toFixed(2) + 'deg');
      });
      card.addEventListener('pointerleave', function () {
        card.style.setProperty('--kx-rx', '0deg');
        card.style.setProperty('--kx-ry', '0deg');
      });
    });

    /* ---------- Cursor spotlight ---------- */
    var sx = 0, sy = 0, spotRaf = false;
    window.addEventListener('pointermove', function (e) {
      sx = e.clientX; sy = e.clientY;
      spot.classList.add('is-on');
      if (spotRaf) return;
      spotRaf = true;
      requestAnimationFrame(function () {
        spot.style.transform = 'translate3d(' + sx + 'px,' + sy + 'px,0)';
        spotRaf = false;
      });
    }, { passive: true });
    document.addEventListener('pointerleave', function () { spot.classList.remove('is-on'); });
  }

  /* ---------- Particle network background ---------- */
  var canvas = $('.kx-bg__canvas');
  if (canvas && !reduceMotion) {
    var ctx = canvas.getContext('2d');
    var W, H, dpr, particles = [], mouse = { x: -999, y: -999 }, running = true;

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.round(Math.min(90, Math.max(28, (W * H) / 20000)));
      particles = [];
      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
          r: Math.random() * 1.6 + .6
        });
      }
    }
    function color() {
      return getComputedStyle(doc).getPropertyValue('--kx-dot').trim() || '255,255,255';
    }
    var rgb = color();
    new MutationObserver(function () { rgb = color(); })
      .observe(doc, { attributes: true, attributeFilter: ['data-theme'] });

    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        var mdx = p.x - mouse.x, mdy = p.y - mouse.y, md = mdx * mdx + mdy * mdy;
        if (md < 14000) { p.x += mdx * 0.004; p.y += mdy * 0.004; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fillStyle = 'rgba(' + rgb + ',.45)';
        ctx.fill();
        for (var j = i + 1; j < particles.length; j++) {
          var q = particles[j], dx = p.x - q.x, dy = p.y - q.y, d = dx * dx + dy * dy;
          if (d < 14400) {
            ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.16 * (1 - d / 14400)).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
      }
      requestAnimationFrame(frame);
    }
    window.addEventListener('pointermove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    var resizeT;
    window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(size, 200); });
    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running) requestAnimationFrame(frame);
    });
    size();
    requestAnimationFrame(frame);
  }
})();
