/*
  Kinetic Template
  https://templatemo.com/tm-631-kinetic
*/

(function() {
    "use strict";
    function styleKinetixTitle(title) {
        var text = title.textContent.trim();
        title.setAttribute('aria-label', text);
        title.classList.add('kinetix-display-title');
        title.style.setProperty('font-family', "'Anton', Impact, 'Arial Black', sans-serif", 'important');
        title.style.setProperty('font-weight', '900', 'important');
        title.style.setProperty('text-transform', 'uppercase', 'important');
        title.textContent = '';

        Array.from(text).forEach(function(character) {
            if (/\s/.test(character)) {
                var wordSpace = document.createElement('span');
                wordSpace.className = 'kinetix-title-word-space';
                wordSpace.setAttribute('aria-hidden', 'true');
                wordSpace.textContent = '\u00a0';
                title.appendChild(wordSpace);
                return;
            }

            var letter = document.createElement('span');
            letter.className = 'kinetix-title-letter';
            letter.textContent = character;
            title.appendChild(letter);
        });
    }

    document.querySelectorAll(
        '.reveal-cap > h2, .team-heading h2, .section-head h2, .legal-intro h2, ' +
        '.category-heading h3, .announcements-heading h2, .purpose-item h3, .gal-title'
    ).forEach(styleKinetixTitle);

    var visitorSessionKey = 'kinetix-visitor-counted';
    var alreadyCounted = false;
    try {
        alreadyCounted = window.sessionStorage.getItem(visitorSessionKey) === 'true';
    } catch (error) {
        console.error('Unable to check the Kinetix visitor session:', error);
    }
    if (!alreadyCounted) {
        fetch('/api/visits', { method: 'POST', credentials: 'same-origin', keepalive: true })
            .then(function(response) {
                if (!response.ok) throw new Error('The visitor count request failed with HTTP ' + response.status + '.');
                try {
                    window.sessionStorage.setItem(visitorSessionKey, 'true');
                } catch (error) {
                    console.error('Unable to save the Kinetix visitor session:', error);
                }
            })
            .catch(function(error) {
                console.error('Unable to record the Kinetix website visit:', error);
            });
    }
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* =====================================================
       01 // ELASTIC STRING PHYSICS
       ===================================================== */
    (function() {
        var hero = document.getElementById('hero');
        var svg = document.getElementById('stringSvg');
        var path = document.getElementById('stringPath');
        var aL = document.getElementById('anchorL');
        var aR = document.getElementById('anchorR');
        var grip = document.getElementById('grip');
        if (!hero || !svg || !path || !aL || !aR || !grip) return;

        // ---- kinetic box field ----
        var field = document.createElement('div');
        field.className = 'field';
        hero.insertBefore(field, hero.firstChild);

        var boxes = [];
        var COUNT = 20;
        for (var bi = 0; bi < COUNT; bi++) {
            var el = document.createElement('div');
            var roll = Math.random();
            el.className = 'box' + (roll < 0.18 ? ' acid' : (roll < 0.36 ? ' warm' : ''));
            var bw = 26 + Math.random() * 96;
            var bh = (Math.random() < 0.80) ? bw : (26 + Math.random() * 96); // mostly squares
            el.style.width = bw.toFixed(0) + 'px';
            el.style.height = bh.toFixed(0) + 'px';
            var fx = Math.random(); // 0..1 across hero
            var fy = 0.08 + Math.random() * 0.84; // keep clear of very top/bottom
            el.style.left = (fx * 100).toFixed(2) + '%';
            el.style.top = (fy * 100).toFixed(2) + '%';
            el.style.marginLeft = (-bw / 2) + 'px';
            el.style.marginTop = (-bh / 2) + 'px';
            field.appendChild(el);
            boxes.push({
                el: el,
                fx: fx,
                fy: fy,
                w: bw,
                h: bh,
                rot: (Math.random() * 2 - 1) * 14,
                oy: 0,
                ox: 0,
                vx: 0,
                vy: 0,
                prevRopeY: 0
            });
        }

        var W = 0,
            H = 0,
            baseY = 0;

        function size() {
            var r = hero.getBoundingClientRect();
            W = r.width;
            H = r.height;
            baseY = H / 2;
            var word = hero.querySelector('.hero-title > span:first-child');
            if (word) {
                var wr = word.getBoundingClientRect();
                if (wr.height) baseY = wr.top + wr.height / 2 - svg.getBoundingClientRect().top;
            }
            svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
            aL.setAttribute('cx', 0);
            aL.setAttribute('cy', baseY);
            aR.setAttribute('cx', W);
            aR.setAttribute('cy', baseY);
        }

        function relaxHomes() {
            if (!W || !H) return;
            var m = 12;
            var pts = boxes.map(function(b) {
                return {
                    x: b.fx * W,
                    y: b.fy * H,
                    hw: b.w / 2,
                    hh: b.h / 2
                };
            });
            for (var it = 0; it < 16; it++) {
                for (var a = 0; a < pts.length; a++) {
                    for (var c = a + 1; c < pts.length; c++) {
                        var pa = pts[a],
                            pb = pts[c];
                        var dx = pa.x - pb.x,
                            dy = pa.y - pb.y;
                        var ox = (pa.hw + pb.hw + 8) - Math.abs(dx);
                        var oy = (pa.hh + pb.hh + 8) - Math.abs(dy);
                        if (ox > 0 && oy > 0) {
                            if (ox < oy) {
                                var s = (dx < 0 ? -1 : 1) * ox * 0.5;
                                pa.x += s;
                                pb.x -= s;
                            } else {
                                var s2 = (dy < 0 ? -1 : 1) * oy * 0.5;
                                pa.y += s2;
                                pb.y -= s2;
                            }
                        }
                    }
                }
                for (var q = 0; q < pts.length; q++) {
                    var p = pts[q];
                    if (p.x < p.hw + m) p.x = p.hw + m;
                    else if (p.x > W - p.hw - m) p.x = W - p.hw - m;
                    if (p.y < p.hh + m) p.y = p.hh + m;
                    else if (p.y > H - p.hh - m) p.y = H - p.hh - m;
                }
            }
            boxes.forEach(function(b, idx) {
                b.fx = pts[idx].x / W;
                b.fy = pts[idx].y / H;
                b.el.style.left = (b.fx * 100).toFixed(3) + '%';
                b.el.style.top = (b.fy * 100).toFixed(3) + '%';
            });
        }
        size();
        relaxHomes();
        window.addEventListener('resize', function() {
            size();
            relaxHomes();
            posY = baseY;
        });
        window.addEventListener('load', function() {
            size();
            posY = baseY;
        });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function() {
            size();
            posY = baseY;
        });

        // spring state: posX/posY = apex target the curve reaches
        var mouseX = 0,
            mouseY = 0,
            active = false;
        var posX = 0,
            posY = 0,
            velX = 0,
            velY = 0;

        hero.addEventListener('pointermove', function(e) {
            var r = hero.getBoundingClientRect();
            mouseX = e.clientX - r.left;
            mouseY = e.clientY - r.top;
            active = true;
        });
        hero.addEventListener('pointerleave', function() {
            active = false;
        });

        // quadratic control point so the curve APEX lands on (posX, posY)
        var curveY = 0;

        function ropeYAt(x) {
            // exact quadratic-bezier Y for curve P0(0,baseY) P1(posX,curveY) P2(W,baseY)
            var A = W - 2 * posX,
                t;
            if (Math.abs(A) < 0.0001) {
                t = x / W;
            } else {
                var disc = posX * posX + A * x;
                if (disc < 0) disc = 0;
                t = (-posX + Math.sqrt(disc)) / A;
            }
            if (t < 0) t = 0;
            else if (t > 1) t = 1;
            var omt = 1 - t;
            return omt * omt * baseY + 2 * omt * t * curveY + t * t * baseY;
        }

        // 1) integrate each box under rope contact + weak home drift
        function integrateBoxes() {
            var ROPE_HALF = 14; // effective rope thickness for contact
            var HOME = 0.010; // weak drift back toward origin
            for (var i = 0; i < boxes.length; i++) {
                var b = boxes[i];
                var hh = b.h / 2,
                    hw = b.w / 2;
                var px = b.fx * W + b.ox;
                var py = b.fy * H + b.oy;

                if (!reduceMotion) {
                    // sample rope across the box span, keep the point nearest the box
                    var nearest = ropeYAt(px);
                    var rl = ropeYAt(px - hw),
                        rr = ropeYAt(px + hw);
                    if (Math.abs(rl - py) < Math.abs(nearest - py)) nearest = rl;
                    if (Math.abs(rr - py) < Math.abs(nearest - py)) nearest = rr;

                    var gap = py - nearest; // signed box->rope
                    var pen = (hh + ROPE_HALF) - Math.abs(gap); // contact depth
                    if (pen > 0) {
                        var dir = gap === 0 ? (b.fy < 0.5 ? -1 : 1) : (gap > 0 ? 1 : -1);
                        b.vy += dir * pen * 0.16; // eject out of the rope
                        b.vy += (nearest - b.prevRopeY) * 0.55; // ride the rope's sweep
                    }
                    b.prevRopeY = nearest;
                }

                var FRICTION = 0.85;
                b.vx += -b.ox * HOME;
                b.vy += -b.oy * HOME;
                b.vx *= FRICTION;
                b.vy *= FRICTION;
                b.ox += b.vx;
                b.oy += b.vy;
            }
        }

        // 2) separation so boxes shove each other apart, never overlap
        function separateBoxes() {
            for (var pass = 0; pass < 3; pass++) {
                for (var a = 0; a < boxes.length; a++) {
                    for (var c = a + 1; c < boxes.length; c++) {
                        var ba = boxes[a],
                            bb = boxes[c];
                        var ddx = (ba.fx * W + ba.ox) - (bb.fx * W + bb.ox);
                        var ddy = (ba.fy * H + ba.oy) - (bb.fy * H + bb.oy);
                        var ox = (ba.w / 2 + bb.w / 2 + 6) - Math.abs(ddx);
                        var oy = (ba.h / 2 + bb.h / 2 + 6) - Math.abs(ddy);
                        if (ox > 0 && oy > 0) {
                            if (ox < oy) {
                                var sh = (ddx < 0 ? -1 : 1) * ox * 0.30;
                                ba.ox += sh;
                                bb.ox -= sh;
                                ba.vx *= 0.5;
                                bb.vx *= 0.5;
                            } else {
                                var sv = (ddy < 0 ? -1 : 1) * oy * 0.30;
                                ba.oy += sv;
                                bb.oy -= sv;
                                ba.vy *= 0.5;
                                bb.vy *= 0.5;
                            }
                        }
                    }
                }
            }
        }

        // 3) render, clamped inside the hero
        function renderBoxes() {
            for (var i = 0; i < boxes.length; i++) {
                var bo = boxes[i];
                var bhw = bo.w / 2,
                    bhh = bo.h / 2,
                    hx = bo.fx * W,
                    hy = bo.fy * H;
                var minOx = (bhw + 4) - hx,
                    maxOx = (W - bhw - 4) - hx;
                var minOy = (bhh + 4) - hy,
                    maxOy = (H - bhh - 4) - hy;
                if (bo.ox < minOx) {
                    bo.ox = minOx;
                    if (bo.vx < 0) bo.vx = 0;
                } else if (bo.ox > maxOx) {
                    bo.ox = maxOx;
                    if (bo.vx > 0) bo.vx = 0;
                }
                if (bo.oy < minOy) {
                    bo.oy = minOy;
                    if (bo.vy < 0) bo.vy = 0;
                } else if (bo.oy > maxOy) {
                    bo.oy = maxOy;
                    if (bo.vy > 0) bo.vy = 0;
                }
                bo.el.style.transform =
                    'translate(' + bo.ox.toFixed(1) + 'px,' + bo.oy.toFixed(1) + 'px) rotate(' +
                    (bo.rot + bo.oy * 0.10).toFixed(2) + 'deg)';
            }
        }

        function draw() {
            if (W === 0) size();
            posX = (active ? mouseX : W / 2);

            if (reduceMotion) {
                posY = baseY; // flat, no physics
            } else {
                var targetY = active ? mouseY : baseY;
                var k = 0.055,
                    damp = 0.80; // low damping = visible spring bounce
                velY += (targetY - posY) * k;
                velY *= damp;
                posY += velY;
            }

            curveY = 2 * posY - baseY;
            path.setAttribute('d', 'M 0 ' + baseY + ' Q ' + posX + ' ' + curveY + ' ' + W + ' ' + baseY);

            grip.setAttribute('cx', posX);
            grip.setAttribute('cy', posY);
            grip.setAttribute('opacity', active ? 1 : 0);

            // === rope as a physical body: it touches boxes and flings them ===
            if (!reduceMotion) integrateBoxes();
            if (!reduceMotion) separateBoxes();
            renderBoxes();

            requestAnimationFrame(draw);
        }
        posX = W / 2;
        posY = baseY;
        requestAnimationFrame(draw);
    })();

    /* =====================================================
       02 // 2D MATRIX ACCORDION
       ===================================================== */
    (function() {
        var grid = document.getElementById('matrix');
        var cells = Array.prototype.slice.call(grid.querySelectorAll('.cell'));
        var activeCell = null;
        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        function animateRect(cell, fromRect, toRect) {
            if (reduceMotion || !toRect.width || !toRect.height) return;
            var offsetX = fromRect.left - toRect.left;
            var offsetY = fromRect.top - toRect.top;
            var scaleX = fromRect.width / toRect.width;
            var scaleY = fromRect.height / toRect.height;
            cell.animate([
                {
                    transform: 'translate(' + offsetX + 'px,' + offsetY + 'px) scale(' + scaleX + ',' + scaleY + ')',
                    transformOrigin: 'top left'
                },
                {
                    transform: 'translate(0,0) scale(1,1)',
                    transformOrigin: 'top left'
                }
            ], {
                duration: 560,
                easing: 'cubic-bezier(.16, 1, .3, 1)'
            });
        }

        function closeCard() {
            if (!activeCell) return;
            var cell = activeCell;
            var fromRect = cell.getBoundingClientRect();
            var column = cell.closest('.category-column');
            cell.classList.remove('is-active');
            column.querySelectorAll('.cell').forEach(function(other) {
                other.classList.remove('is-dim');
            });
            document.body.classList.remove('has-expanded-card');
            activeCell = null;
            animateRect(cell, fromRect, cell.getBoundingClientRect());
        }

        function openCard(cell) {
            if (activeCell === cell) {
                closeCard();
                return;
            }
            if (activeCell) closeCard();

            var fromRect = cell.getBoundingClientRect();
            var column = cell.closest('.category-column');
            column.querySelectorAll('.cell').forEach(function(other) {
                other.classList.toggle('is-dim', other !== cell);
            });
            cell.classList.add('is-active');
            document.body.classList.add('has-expanded-card');
            activeCell = cell;
            animateRect(cell, fromRect, cell.getBoundingClientRect());
        }

        cells.forEach(function(cell) {
            cell.addEventListener('click', function() {
                openCard(cell);
            });
            cell.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openCard(cell);
                }
                if (e.key === 'Escape') {
                    closeCard();
                }
            });
        });

        document.addEventListener('click', function(e) {
            if (activeCell && !activeCell.contains(e.target)) closeCard();
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') closeCard();
        });
    })();

    /* =====================================================
       03 // LENTICULAR STRIP REVEAL
       ===================================================== */
    (function() {
        var lenti = document.getElementById('lenti');
        var N = 10;
        // image paths come from data-front / data-back on #lenti in index.html
        var FRONT = lenti.getAttribute('data-front') || '';
        var BACK = lenti.getAttribute('data-back') || FRONT;

        var slices = [];
        var sizeRef = {
            w: 0
        };

        function buildSliceBg() {
            // background-size is set by CSS (60vw 80vh); here we just offset position per slice
            var r = lenti.getBoundingClientRect();
            sizeRef.w = r.width;
            slices.forEach(function(s, i) {
                var offset = -(i * (r.width / N)) + 1; // +1 compensates the 1px face overhang
                s.front.style.backgroundSize = r.width + 'px ' + r.height + 'px';
                s.back.style.backgroundSize = r.width + 'px ' + r.height + 'px';
                s.front.style.backgroundPosition = offset + 'px 0';
                s.back.style.backgroundPosition = offset + 'px 0';
                s.back.style.transform = ''; // keep face transform in CSS
            });
        }

        for (var i = 0; i < N; i++) {
            var slice = document.createElement('div');
            slice.className = 'slice';

            var front = document.createElement('div');
            front.className = 'face front';
            front.style.backgroundImage =
                'linear-gradient(rgba(255,174,66,.1), rgba(20,43,77,.24))' + (FRONT ? ", url('" + FRONT + "')" : '');

            var back = document.createElement('div');
            back.className = 'face back';
            back.style.backgroundImage =
                'linear-gradient(rgba(40,100,173,.18), rgba(20,43,77,.3))' + (BACK ? ", url('" + BACK + "')" : '');
            // counter-mirror the back image so the second picture reads correctly
            back.style.transform = 'rotateY(180deg) scaleX(-1)';
            back.style.backgroundPositionX = 'right';

            slice.appendChild(front);
            slice.appendChild(back);
            lenti.appendChild(slice);
            slices.push({
                el: slice,
                front: front,
                back: back,
                cur: 0
            });
        }
        buildSliceBg();
        window.addEventListener('resize', buildSliceBg);
        document.addEventListener('pageviewchange', function(event) {
            if (event.detail.view === 'reveal') buildSliceBg();
        });

        var stage = document.getElementById('lentiStage');
        var engaged = false,
            frac = 0;
        stage.addEventListener('pointermove', function(e) {
            var r = lenti.getBoundingClientRect();
            // measured against the image, but the stage padding lets the cursor
            // travel past both edges so the first/last slices can reach a full flip
            var f = (e.clientX - r.left) / r.width;
            if (f < -0.3) f = -0.3;
            if (f > 1.3) f = 1.3;
            frac = f;
            engaged = true;
        });
        stage.addEventListener('pointerleave', function() {
            engaged = false;
        });

        function clamp(v, a, b) {
            return v < a ? a : (v > b ? b : v);
        }

        function loop() {
            if (reduceMotion) {
                requestAnimationFrame(loop);
                return;
            }
            for (var j = 0; j < N; j++) {
                var sp = j / (N - 1);
                var goal;
                if (!engaged) {
                    goal = 0;
                } else {
                    // smooth flip band that sweeps with the cursor, plus a wave ripple
                    var d = frac - sp;
                    var band = 0.16;
                    var base = clamp((d + band) / (2 * band), 0, 1); // 0..1 base flip
                    // ripple peaks mid-flip and vanishes at the ends, so a fully
                    // flipped strip lands exactly on 0 or 180 with no edge showing
                    var mid = Math.sin(base * Math.PI);
                    var ripple = Math.sin(j * 0.85 + frac * 6.0) * 10 * mid;
                    goal = clamp(base * 180 + ripple, 0, 180);
                }
                var s = slices[j];
                s.cur += (goal - s.cur) * 0.16; // eased lerp -> fluid wave
                s.el.style.transform = 'rotateY(' + s.cur.toFixed(2) + 'deg)';
            }
            requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
    })();

    /* =====================================================
       04 // TYPOGRAPHIC SCATTER & SIGNATURE
       ===================================================== */
    (function() {
        var host = document.getElementById('scatter');
        var foot = document.getElementById('initiate');
        var contactWrap = document.getElementById('contactWrap');
        var text = host.getAttribute('data-lines') || host.textContent;
        host.textContent = '';

        function setContactVisibility(c) {
            var vis = clamp(1 - c * 1.8, 0, 1);
            contactWrap.style.opacity = vis.toFixed(3);
            contactWrap.style.transform = 'translateY(' + (c * 26).toFixed(1) + 'px)';
            contactWrap.style.pointerEvents = vis < 0.4 ? 'none' : 'auto';
        }

        var glyphs = [];
        text.split('|').forEach(function(line) {
            var row = document.createElement('span');
            row.className = 'scatter-line';
            for (var i = 0; i < line.length; i++) {
                var ch = line[i];
                var span = document.createElement('span');
                span.className = 'glyph';
                if (ch === ' ') {
                    span.classList.add('space');
                    span.innerHTML = '&nbsp;';
                } else {
                    span.textContent = ch;
                    if (ch === '/') span.classList.add('slash');
                }
                row.appendChild(span);
                glyphs.push(span);
            }
            host.appendChild(row);
        });

        // (re)roll a fresh random scatter vector per glyph, in vmin-scaled px
        function rollVectors() {
            var unit = Math.min(window.innerWidth, window.innerHeight) / 100;
            glyphs.forEach(function(g) {
                g.dataset.tx = ((Math.random() * 2 - 1) * 60 * unit).toFixed(1);
                g.dataset.ty = ((Math.random() * 2 - 1) * 50 * unit).toFixed(1);
                g.dataset.rot = ((Math.random() * 2 - 1) * 70).toFixed(1);
            });
        }
        rollVectors();

        function clamp(v, a, b) {
            return v < a ? a : (v > b ? b : v);
        }

        function apply(v) {
            for (var i = 0; i < glyphs.length; i++) {
                var g = glyphs[i];
                g.style.transform =
                    'translate(' + (parseFloat(g.dataset.tx) * v) + 'px,' +
                    (parseFloat(g.dataset.ty) * v) + 'px) rotate(' +
                    (parseFloat(g.dataset.rot) * v) + 'deg)';
            }
        }

        function scrollProgress() {
            if (document.body.dataset.currentView === 'initiate') return 0;
            var r = foot.getBoundingClientRect();
            var vh = window.innerHeight;
            var p = clamp((vh - r.top) / vh, 0, 1);
            return p * p;
        }

        // cur = animated 0..1. Before any click: scrubs with scroll.
        // After a click: locks and animates between states on each tap.
        var cur = 0,
            manualLock = false,
            exploded = false;

        host.addEventListener('click', function() {
            if (reduceMotion) return;
            if (!manualLock) {
                exploded = cur > 0.5;
                manualLock = true;
            }
            var willExplode = !exploded;
            if (willExplode) rollVectors(); // fresh burst pattern every time
            exploded = willExplode;
        });

        function loop() {
            if (reduceMotion) {
                apply(0);
                setContactVisibility(0);
                requestAnimationFrame(loop);
                return;
            }
            var target = manualLock ? (exploded ? 1 : 0) : scrollProgress();
            if (manualLock) {
                cur += (target - cur) * 0.12; // smooth spring-like toggle
                if (Math.abs(target - cur) < 0.001) cur = target;
            } else {
                cur = target; // 1:1 scroll scrub
            }
            apply(cur);
            setContactVisibility(cur);
            requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);

        window.addEventListener('resize', function() {
            if (!exploded) rollVectors(); // refresh only when assembled (no jump)
        });
    })();

    (function() {
        var topbar = document.querySelector('.topbar');
        var toggle = document.querySelector('.nav-toggle');
        var links = document.getElementById('navLinks');
        if (!topbar || !toggle || !links) return;

        function setOpen(isOpen) {
            topbar.classList.toggle('is-open', isOpen);
            toggle.classList.toggle('is-open', isOpen);
            document.body.classList.toggle('nav-open', isOpen);
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            toggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
        }

        toggle.addEventListener('click', function() {
            setOpen(!topbar.classList.contains('is-open'));
        });

        links.addEventListener('click', function(e) {
            if (e.target.closest('a')) setOpen(false);
        });

        document.addEventListener('click', function(e) {
            if (topbar.classList.contains('is-open') && !topbar.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && topbar.classList.contains('is-open')) setOpen(false);
        });
    })();

    (function() {
        var main = document.getElementById('mainContent');
        var navLinks = Array.prototype.slice.call(document.querySelectorAll('#navLinks a[href^="#"]'));
        if (!main || !navLinks.length) return;

        var views = Array.prototype.slice.call(main.querySelectorAll(':scope > [data-page-view]'));
        var categories = Array.prototype.slice.call(main.querySelectorAll('.category-column'));
        var sectionHead = main.querySelector('#projects .section-head');

        function showView(hash, updateHistory) {
            var id = (hash || '#hero').slice(1);
            if (id === 'projects') id = 'products';
            var target = document.getElementById(id);
            if (!target || !main.contains(target)) {
                id = 'hero';
                target = document.getElementById(id);
            }

            var category = target.closest('.category-column');
            var view = category ? document.getElementById('projects') : target.closest('[data-page-view]');
            if (!view || !views.includes(view)) return;

            views.forEach(function(panel) {
                panel.hidden = panel !== view;
                if (panel === view) panel.scrollTop = 0;
            });
            categories.forEach(function(panel) {
                panel.hidden = panel !== category;
            });
            if (sectionHead) sectionHead.hidden = !!category;

            document.body.classList.add('one-page');
            document.body.dataset.currentView = category ? category.id : view.id;
            navLinks.forEach(function(link) {
                if (link.getAttribute('href') === '#' + id) {
                    link.setAttribute('aria-current', 'page');
                } else {
                    link.removeAttribute('aria-current');
                }
            });

            if (updateHistory && window.location.hash !== '#' + id) {
                window.history.pushState(null, '', '#' + id);
            }
            if (id === 'register' || id === 'legal') {
                window.requestAnimationFrame(function() {
                    target.scrollIntoView({
                        block: 'start',
                        behavior: reduceMotion ? 'auto' : 'smooth'
                    });
                });
            }
            document.dispatchEvent(new CustomEvent('pageviewchange', {
                detail: { view: document.body.dataset.currentView }
            }));
        }

        navLinks.forEach(function(link) {
            link.addEventListener('click', function(event) {
                var href = link.getAttribute('href');
                if (!document.getElementById(href.slice(1))) return;
                event.preventDefault();
                showView(href, true);
            });
        });

        window.addEventListener('hashchange', function() {
            showView(window.location.hash, false);
        });
        window.addEventListener('popstate', function() {
            showView(window.location.hash, false);
        });

        showView(window.location.hash || '#hero', false);
    })();

    (function() {
        var form = document.getElementById('siteSearchForm');
        var input = document.getElementById('siteSearchInput');
        var toggle = document.getElementById('siteSearchToggle');
        var results = document.getElementById('siteSearchResults');
        var main = document.getElementById('mainContent');
        if (!form || !input || !toggle || !results || !main) return;

        function setOpen(isOpen, shouldFocus) {
            form.classList.toggle('is-open', isOpen);
            input.disabled = !isOpen;
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            toggle.setAttribute('aria-label', isOpen ? 'Close search' : 'Open search');
            if (!isOpen) {
                results.hidden = true;
                input.setAttribute('aria-expanded', 'false');
            }
            if (isOpen && shouldFocus) input.focus();
        }

        function search(query) {
            results.textContent = '';
            if (!query) {
                results.hidden = true;
                input.setAttribute('aria-expanded', 'false');
                return;
            }
            results.hidden = false;
            input.setAttribute('aria-expanded', 'true');

            var matches = Array.prototype.slice.call(main.querySelectorAll(':scope > [data-page-view]')).filter(function(view) {
                return view.textContent.toLowerCase().indexOf(query) !== -1;
            }).slice(0, 8);

            if (!matches.length) {
                var empty = document.createElement('p');
                empty.textContent = 'No pages found. Try another search.';
                results.appendChild(empty);
                return;
            }

            var list = document.createElement('ul');
            matches.forEach(function(view) {
                var heading = view.querySelector('h1, h2');
                var item = document.createElement('li');
                var link = document.createElement('a');
                link.href = '#' + view.id;
                link.textContent = heading ? heading.textContent.trim() : view.id;
                link.addEventListener('click', function() {
                    input.value = '';
                    setOpen(false, false);
                });
                item.appendChild(link);
                list.appendChild(item);
            });
            results.appendChild(list);
        }

        toggle.addEventListener('click', function() {
            setOpen(!form.classList.contains('is-open'), true);
        });
        input.addEventListener('input', function() {
            search(input.value.trim().toLowerCase());
        });
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            search(input.value.trim().toLowerCase());
        });
        input.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                if (input.value) {
                    input.value = '';
                    search('');
                } else {
                    setOpen(false, false);
                    toggle.focus();
                }
            }
        });
        document.addEventListener('click', function(event) {
            if (!form.contains(event.target)) {
                setOpen(false, false);
            }
        });
    })();

    (function() {
        var privacyPolicy = document.getElementById('privacyPolicyDetails');
        if (!privacyPolicy) return;
        privacyPolicy.open = false;
        document.addEventListener('pageviewchange', function() {
            privacyPolicy.open = false;
        });
    })();

    (function() {
        var toggle = document.getElementById('faqToggle');
        var panel = document.getElementById('faqPanel');
        var close = document.getElementById('faqClose');
        if (!toggle || !panel || !close) return;

        function setOpen(isOpen) {
            panel.hidden = !isOpen;
            toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            toggle.setAttribute('aria-label', isOpen ? 'Close frequently asked questions' : 'Open frequently asked questions');
            if (isOpen) {
                var firstQuestion = panel.querySelector('summary');
                if (firstQuestion) firstQuestion.focus({
                    preventScroll: true
                });
            }
        }

        toggle.addEventListener('click', function() {
            setOpen(panel.hidden);
        });

        close.addEventListener('click', function() {
            setOpen(false);
            toggle.focus();
        });

        document.addEventListener('click', function(e) {
            if (!panel.hidden && !panel.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !panel.hidden) {
                setOpen(false);
                toggle.focus();
            }
        });
    })();

    (function() {
        var flavorPickers = document.querySelectorAll('.product-flavor-picker select');
        flavorPickers.forEach(function(picker) {
            picker.addEventListener('change', function() {
                var selectedOption = picker.options[picker.selectedIndex];
                var productCard = picker.closest('.product-card');
                var productImage = productCard && productCard.querySelector('.cell-media');
                if (productImage && selectedOption.dataset.image) {
                    productImage.style.backgroundImage = "url('" + selectedOption.dataset.image + "')";
                }
            });
        });
    })();

    (function() {
        var carousel = document.getElementById('productCarousel');
        if (!carousel) return;

        var items = Array.prototype.slice.call(carousel.querySelectorAll('.product-carousel-item'));
        var ghost = document.getElementById('productCarouselGhost');
        var name = document.getElementById('productCarouselName');
        var description = document.getElementById('productCarouselDescription');
        var price = document.getElementById('productCarouselPrice');
        var stock = document.getElementById('productCarouselStock');
        var flavorPicker = carousel.querySelector('.product-flavor-picker');
        var flavorSelect = document.getElementById('productFlavorSelect');
        var soyaButton = carousel.querySelector('.add-to-cart[data-product="soya-pop"]');
        var nutflixButton = carousel.querySelector('.add-to-cart[data-product="nutflix"]');
        var controls = Array.prototype.slice.call(carousel.querySelectorAll('.product-carousel-arrow'));
        if (!items.length || !ghost || !name || !description || !price || !flavorPicker || !flavorSelect || !soyaButton || !nutflixButton) return;

        var activeIndex = 0;

        function render(index) {
            activeIndex = (index + items.length) % items.length;
            var selected = items[activeIndex];
            var isSoya = !!selected.dataset.flavor;

            carousel.style.backgroundColor = selected.dataset.color;
            ghost.textContent = selected.dataset.ghost;
            name.textContent = selected.dataset.name;
            description.textContent = selected.dataset.description;
            price.textContent = '₱' + Number(selected.dataset.price).toFixed(2);
            if (stock) {
                var available = Number(selected.dataset.stock);
                var hasStock = Number.isInteger(available) && available >= 0;
                stock.textContent = !hasStock
                    ? 'Stock unavailable'
                    : available === 0 ? 'Out of stock' : available + ' in stock';
                stock.classList.toggle('is-sold-out', hasStock && available === 0);
            }
            flavorPicker.hidden = !isSoya;
            soyaButton.hidden = !isSoya;
            nutflixButton.hidden = isSoya;
            flavorSelect.value = isSoya ? selected.dataset.flavor : 'Original';
            soyaButton.dataset.stock = isSoya ? selected.dataset.stock : soyaButton.dataset.stock;
            soyaButton.disabled = isSoya && Number(selected.dataset.stock) === 0;
            nutflixButton.disabled = !isSoya && Number(selected.dataset.stock) === 0;

            items.forEach(function(item, itemIndex) {
                var offset = (itemIndex - activeIndex + items.length) % items.length;
                item.classList.toggle('is-current', offset === 0);
                item.classList.toggle('is-next', offset === 1);
                item.classList.toggle('is-previous', offset === items.length - 1);
                item.classList.toggle('is-behind', offset > 1 && offset < items.length - 1);
                item.setAttribute('aria-pressed', offset === 0 ? 'true' : 'false');
            });
        }

        function move(direction) {
            render(activeIndex + direction);
        }

        items.forEach(function(item, index) {
            item.addEventListener('click', function() {
                render(index);
            });
        });

        controls.forEach(function(control) {
            control.addEventListener('click', function() {
                move(Number(control.dataset.direction));
            });
        });

        flavorSelect.addEventListener('change', function() {
            var flavorIndex = items.findIndex(function(item) {
                return item.dataset.flavor === flavorSelect.value;
            });
            if (flavorIndex >= 0) render(flavorIndex);
        });

        document.addEventListener('kinetix:inventory-loaded', function() {
            render(activeIndex);
        });

        carousel.addEventListener('keydown', function(event) {
            if (event.target === flavorSelect) return;
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                move(-1);
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                move(1);
            }
        });

        render(activeIndex);
    })();

    (function() {
        var videoSelect = document.getElementById('galleryVideoSelect');
        var videoPlayer = document.getElementById('galleryVideoPlayer');
        var videoSource = document.getElementById('galleryVideoSource');
        if (!videoSelect || !videoPlayer || !videoSource) return;

        videoSelect.addEventListener('change', function() {
            var selectedOption = videoSelect.options[videoSelect.selectedIndex];
            if (!selectedOption || !selectedOption.value) return;

            videoPlayer.pause();
            videoSource.src = selectedOption.value;
            videoPlayer.setAttribute('aria-label', selectedOption.textContent.trim() + ' video');
            videoPlayer.load();
        });
    })();

    (function() {
        var videoCards = document.querySelectorAll('[data-youtube-url]');
        videoCards.forEach(function(card) {
            var videoUrl = card.dataset.youtubeUrl.trim();
            if (!videoUrl) return;

            var url;
            try {
                url = new URL(videoUrl);
            } catch (error) {
                console.warn('Invalid YouTube video URL:', videoUrl, error);
                return;
            }

            var videoId = '';
            if (url.hostname === 'youtu.be') {
                videoId = url.pathname.split('/')[1] || '';
            } else if (url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com')) {
                videoId = url.searchParams.get('v') || '';
                if (!videoId) {
                    var pathMatch = url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})(?:\/|$)/);
                    videoId = pathMatch ? pathMatch[1] : '';
                }
            }

            if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
                console.warn('YouTube URL does not contain a valid video ID:', videoUrl);
                return;
            }

            var heading = card.closest('article') && card.closest('article').querySelector('h3');
            var title = heading ? heading.textContent.trim() + ' product video' : 'Event video';
            var player = document.createElement('iframe');
            player.className = 'youtube-video-frame';
            player.title = title;
            player.src = 'https://www.youtube-nocookie.com/embed/' + videoId + '?rel=0';
            player.loading = 'lazy';
            player.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            player.allowFullscreen = true;
            card.replaceChildren(player);
            card.classList.add('is-playing');
        });
    })();

    (function() {
        var buttons = Array.prototype.slice.call(document.querySelectorAll('.add-to-cart'));
        var productCount = document.getElementById('productCartCount');
        var cartToggle = document.getElementById('cartToggle');
        var cartPanel = document.getElementById('cartPanel');
        var cartClose = document.getElementById('cartClose');
        var cartBadge = document.getElementById('cartBadge');
        var cartItems = document.getElementById('cartItems');
        var cartEmpty = document.getElementById('cartEmpty');
        var cartMessage = document.getElementById('cartMessage');
        var cartTotal = document.getElementById('cartTotalQuantity');
        var cartClear = document.getElementById('cartClear');
        var cartTotalPrice = document.getElementById('cartTotalPrice');
        var checkoutBtn = document.getElementById('checkoutBtn');
        if (!buttons.length || !productCount || !cartToggle || !cartPanel) return;

        var cartEndpoint = window.location.protocol === 'file:' ? 'http://127.0.0.1:5087/api/cart' : '/api/cart';
        var useBrowserCart = true;
        var lastItems = [];
        var browserCartKey = 'kinetix-cart-v1';

        function readBrowserCart() {
            var savedCart = window.localStorage.getItem(browserCartKey);
            if (!savedCart) return [];

            var items;
            try {
                items = JSON.parse(savedCart);
            } catch (error) {
                try {
                    window.localStorage.removeItem(browserCartKey);
                } catch (cleanupError) {
                    console.error('Unable to clear the corrupted Kinetix cart:', cleanupError);
                }
                return [];
            }
            if (!Array.isArray(items) || items.some(function(item) {
                return !item || typeof item.productId !== 'string' ||
                    typeof item.name !== 'string' || !Number.isInteger(item.quantity) ||
                    item.quantity < 1 || !buttons.some(function(button) {
                        return button.dataset.product === item.productId;
                    });
            })) {
                throw new Error('Saved cart data is invalid.');
            }
            return items;
        }

        function browserCartSnapshot(items) {
            return {
                items: items,
                totalQuantity: items.reduce(function(total, item) {
                    return total + item.quantity;
                }, 0)
            };
        }

        function findButtonByProduct(productId) {
            return buttons.find(function(entry) {
                return entry.dataset.product === productId;
            });
        }

        function addItem(items, data) {
            var button = findButtonByProduct(data && data.productId);
            if (!button) throw new Error('Choose a valid product.');
            var itemKey = data && data.flavor ? button.dataset.product + ':' + data.flavor : button.dataset.product;
            var existingItem = items.find(function(item) {
                return (item.key || item.productId) === itemKey;
            });
            if (existingItem) {
                existingItem.quantity += 1;
            } else {
                var name = data && typeof data.name === 'string' ? data.name : button.dataset.name;
                items.push({ key: itemKey, productId: button.dataset.product, name: name, quantity: 1 });
            }
            return items;
        }

        function decrementItem(items, key) {
            var decrementId = decodeURIComponent(key);
            var index = items.findIndex(function(item) {
                return (item.key || item.productId).toLowerCase() === decrementId.toLowerCase();
            });
            if (index >= 0) {
                if (items[index].quantity > 1) {
                    items[index].quantity -= 1;
                } else {
                    items.splice(index, 1);
                }
            }
            return items;
        }

        function removeItem(items, key) {
            var removeId = decodeURIComponent(key).toLowerCase();
            return items.filter(function(item) {
                return (item.key || item.productId).toLowerCase() !== removeId;
            });
        }

        function requestBrowserCart(path, method, data) {
            var items = readBrowserCart();
            if (method === 'GET') return browserCartSnapshot(items);

            var decrementMatch = method === 'POST' && path && path.match(/^\/items\/([^/]+)\/decrement$/);
            var itemMatch = method === 'DELETE' && path && path.match(/^\/items\/([^/]+)$/);

            if (method === 'DELETE' && !path) {
                items = [];
            } else if (method === 'POST' && path === '/items') {
                items = addItem(items, data);
            } else if (decrementMatch) {
                items = decrementItem(items, decrementMatch[1]);
            } else if (itemMatch) {
                items = removeItem(items, itemMatch[1]);
            } else {
                throw new Error('Unsupported cart operation.');
            }

            window.localStorage.setItem(browserCartKey, JSON.stringify(items));
            return browserCartSnapshot(items);
        }

        function formatPrice(value) {
            return '₱' + Number(value).toFixed(2);
        }

        function getProductPrice(productId) {
            var button = findButtonByProduct(productId);
            return Number(button && button.dataset.price ? button.dataset.price : 0);
        }

        function getSelectedFlavor(productId) {
            var picker = document.querySelector('.product-flavor-picker[data-product="' + productId + '"] select');
            return picker ? (picker.value || 'Original') : 'Original';
        }

        function getStockFor(productId, flavor) {
            if (productId === 'soya-pop') {
                var item = document.querySelector('.product-carousel-item[data-product="soya-pop"][data-flavor="' + flavor + '"]');
                return item && item.dataset.stock !== undefined ? Number(item.dataset.stock) : null;
            }
            var button = findButtonByProduct(productId);
            return button && button.dataset.stock !== undefined ? Number(button.dataset.stock) : null;
        }

        async function requestCart(path, method, data) {
            if (useBrowserCart) return requestBrowserCart(path, method, data);
            var options = { method: method };
            if (data) {
                options.headers = { 'Content-Type': 'application/json' };
                options.body = JSON.stringify(data);
            }
            var response = await fetch(cartEndpoint + path, options);
            var rawBody = await response.text();
            var result = null;
            try {
                result = rawBody ? JSON.parse(rawBody) : null;
            } catch (error) {
                result = null;
            }
            if (!response.ok) throw new Error((result && result.error) || 'Cart request failed with HTTP ' + response.status + '.');
            return result;
        }

        function setPanelOpen(isOpen) {
            cartPanel.hidden = !isOpen;
            cartToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            cartToggle.setAttribute('aria-label', isOpen ? 'Close shopping cart' : 'Open shopping cart');
        }

        function makeAction(label, accessibleLabel, action) {
            var button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.setAttribute('aria-label', accessibleLabel);
            button.addEventListener('click', function(event) {
                event.stopPropagation();
                action();
            });
            return button;
        }

        function renderCart(snapshot) {
            var items = snapshot.items || [];
            lastItems = items;
            var totalQuantity = snapshot.totalQuantity || 0;
            var totalPrice = items.reduce(function(sum, item) {
                return sum + (getProductPrice(item.productId) * item.quantity);
            }, 0);
            cartMessage.textContent = '';
            productCount.textContent = totalQuantity;
            productCount.parentElement.lastChild.textContent = totalQuantity === 1 ? ' item in cart' : ' items in cart';
            cartTotal.textContent = totalQuantity;
            cartTotalPrice.textContent = formatPrice(totalPrice);
            cartBadge.textContent = totalQuantity;
            cartBadge.hidden = totalQuantity === 0;
            cartEmpty.hidden = items.length > 0;
            cartItems.replaceChildren();
            cartClear.disabled = items.length === 0;
            checkoutBtn.disabled = items.length === 0;

            buttons.forEach(function(button) {
                var item = items.find(function(entry) {
                    return entry.productId === button.dataset.product;
                });
                var count = items.filter(function(entry) {
                    return entry.productId === button.dataset.product;
                }).reduce(function(sum, entry) { return sum + entry.quantity; }, 0);
                button.classList.toggle('is-added', !!item);
                button.textContent = item ? (count > 1 ? 'Add another (' + count + ')' : 'Added to cart') : 'Add to cart';
                button.setAttribute('aria-label', item ? button.dataset.name + ', quantity ' + count + ' in cart. Add another.' : 'Add ' + button.dataset.name + ' to cart');
            });

            items.forEach(function(item) {
                var itemKey = item.key || item.productId;
                var row = document.createElement('div');
                row.className = 'cart-item';

                var name = document.createElement('span');
                name.className = 'cart-item-name';
                var parts = item.name.split(' - ');
                name.textContent = parts[0];
                if (parts[1]) {
                    var flavorTag = document.createElement('small');
                    flavorTag.className = 'cart-item-flavor';
                    flavorTag.textContent = 'Flavor: ' + parts[1];
                    name.appendChild(flavorTag);
                }
                row.appendChild(name);

                var controls = document.createElement('div');
                controls.className = 'cart-item-controls';
                controls.appendChild(makeAction('-', 'Remove one ' + item.name, async function() {
                    await updateCart('/items/' + encodeURIComponent(itemKey) + '/decrement', 'POST');
                }));

                var quantity = document.createElement('span');
                quantity.className = 'cart-item-quantity';
                quantity.textContent = item.quantity;
                controls.appendChild(quantity);
                controls.appendChild(makeAction('+', 'Add one ' + item.name, async function() {
                    var flavor = item.flavor || (item.key ? item.key.split(':')[1] : undefined);
                    var stock = getStockFor(item.productId, flavor || 'Original');
                    if (stock !== null && item.quantity >= stock) {
                        cartMessage.textContent = 'There is not enough stock available for ' + item.name + '.';
                        return;
                    }
                    await updateCart('/items', 'POST', { productId: item.productId, name: item.name, flavor: flavor });
                }));
                controls.appendChild(makeAction('×', 'Remove ' + item.name + ' from cart', async function() {
                    await updateCart('/items/' + encodeURIComponent(itemKey), 'DELETE');
                }));
                row.appendChild(controls);

                var itemTotal = document.createElement('small');
                itemTotal.className = 'cart-item-total';
                itemTotal.textContent = formatPrice(getProductPrice(item.productId) * item.quantity);
                row.appendChild(itemTotal);

                cartItems.appendChild(row);
            });
        }

        async function updateCart(path, method, data) {
            cartMessage.textContent = '';
            try {
                renderCart(await requestCart(path, method, data));
                if (useBrowserCart) {
                    cartMessage.textContent = 'Cart saved in this browser only; it does not sync across devices.';
                }
            } catch (error) {
                if (useBrowserCart) {
                    cartMessage.textContent = 'Unable to save the cart in this browser. Check browser storage settings.';
                } else {
                    cartEmpty.hidden = true;
                    cartItems.replaceChildren();
                    cartMessage.textContent = 'Cart server unavailable. Start the backend to sync changes.';
                }
            }
        }

        buttons.forEach(function(button) {
            button.addEventListener('click', async function(e) {
                e.stopPropagation();
                button.disabled = true;
                var flavor = getSelectedFlavor(button.dataset.product);
                var itemKey = button.dataset.product === 'soya-pop' ? button.dataset.product + ':' + flavor : button.dataset.product;
                var existingItem = lastItems.find(function(item) {
                    return (item.key || item.productId) === itemKey;
                });
                var stock = getStockFor(button.dataset.product, flavor);
                if (stock !== null && (existingItem ? existingItem.quantity : 0) >= stock) {
                    cartMessage.textContent = 'There is not enough stock available for ' + button.dataset.name + '.';
                    button.disabled = stock === 0;
                    return;
                }
                var productName = button.dataset.name + (button.dataset.product === 'soya-pop' ? ' - ' + flavor : '');
                await updateCart('/items', 'POST', { productId: button.dataset.product, name: productName, flavor: button.dataset.product === 'soya-pop' ? flavor : undefined });
                setPanelOpen(true);
                button.disabled = button.dataset.stock !== undefined && Number(button.dataset.stock) === 0;
            });
        });

        cartToggle.addEventListener('click', function() {
            setPanelOpen(cartPanel.hidden);
        });

        cartClose.addEventListener('click', function() {
            setPanelOpen(false);
            cartToggle.focus();
        });

        cartClear.addEventListener('click', async function() {
            await updateCart('', 'DELETE');
        });

        checkoutBtn.addEventListener('click', async function() {
            if (!lastItems.length) return;
            openBilling();
        });

        var billingModal = document.getElementById('billingModal');
        var billingForm = document.getElementById('billingForm');
        var billingReceipt = document.getElementById('billingReceipt');
        var billingError = document.getElementById('billingError');
        var pendingOrderNumber = null;

        function cartTotalValue() {
            return lastItems.reduce(function(sum, item) {
                return sum + getProductPrice(item.productId) * item.quantity;
            }, 0);
        }

        function openBilling() {
            pendingOrderNumber = null;
            var lines = document.getElementById('billingLines');
            lines.replaceChildren();
            lastItems.forEach(function(item) {
                var row = document.createElement('div');
                row.className = 'billing-line';
                var label = document.createElement('span');
                label.textContent = item.name + ' × ' + item.quantity + ' @ ' + formatPrice(getProductPrice(item.productId));
                var amount = document.createElement('strong');
                amount.textContent = formatPrice(getProductPrice(item.productId) * item.quantity);
                row.appendChild(label);
                row.appendChild(amount);
                lines.appendChild(row);
            });
            document.getElementById('billingTotal').textContent = formatPrice(cartTotalValue());
            billingError.textContent = '';
            billingForm.hidden = false;
            billingReceipt.hidden = true;
            setPanelOpen(false);
            billingModal.hidden = false;
            document.getElementById('billName').focus();
        }

        function closeBilling() {
            billingModal.hidden = true;
            pendingOrderNumber = null;
        }

        document.getElementById('billingClose').addEventListener('click', closeBilling);
        billingModal.addEventListener('click', function(e) {
            if (e.target === billingModal) closeBilling();
        });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !billingModal.hidden) closeBilling();
        });

        billingForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var name = document.getElementById('billName').value.trim();
            var phone = document.getElementById('billPhone').value.trim();
            var email = document.getElementById('billEmail').value.trim();
            var place = document.getElementById('billPlace').value.trim();
            if (!name || !place || !/^[0-9+\-\s()]{7,}$/.test(phone)) {
                billingError.textContent = 'Please enter your name, a valid contact number, and a pick-up/delivery place.';
                return;
            }
            if (!/^\S+@\S+\.\S+$/.test(email)) {
                billingError.textContent = 'Please enter a valid email address to receive your receipt.';
                return;
            }
            var now = new Date();
            pendingOrderNumber = pendingOrderNumber || ('KNX-' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '-' + Math.floor(1000 + Math.random() * 9000));
            var order = {
                orderNumber: pendingOrderNumber,
                date: now.toLocaleString(),
                customer: { name: name, phone: phone, email: email, place: place },
                payment: document.getElementById('billPayment').value,
                notes: document.getElementById('billNotes').value.trim(),
                items: lastItems.map(function(item) {
                    var price = getProductPrice(item.productId);
                    return { name: item.name, quantity: item.quantity, price: price, total: price * item.quantity };
                }),
                total: cartTotalValue()
            };
            var submitButton = billingForm.querySelector('button[type="submit"]');
            var requestedQuantities = {};
            lastItems.forEach(function(item) {
                var flavor = item.productId === 'soya-pop'
                    ? (item.flavor || (item.key ? item.key.split(':')[1] : item.name.split(' - ')[1]) || 'Original')
                    : null;
                var key = item.productId === 'soya-pop' ? item.productId + ':' + flavor : item.productId;
                if (!requestedQuantities[key]) requestedQuantities[key] = { productId: item.productId, flavor: flavor, quantity: 0 };
                requestedQuantities[key].quantity += item.quantity;
            });
            submitButton.disabled = true;
            try {
                var response = await fetch('/api/orders/reserve', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orderNumber: order.orderNumber,
                        items: Object.keys(requestedQuantities).map(function(key) { return requestedQuantities[key]; }),
                        order: {
                            customer: order.customer,
                            payment: order.payment,
                            notes: order.notes,
                            items: lastItems.map(function(item) {
                                var flavor = item.productId === 'soya-pop'
                                    ? (item.flavor || (item.key ? item.key.split(':')[1] : item.name.split(' - ')[1]) || 'Original')
                                    : null;
                                return { productId: item.productId, flavor: flavor, quantity: item.quantity };
                            })
                        }
                    })
                });
                try {
                    var reservation = await response.json();
                } catch (error) {
                    throw new Error(response.ok
                        ? 'The server returned an unreadable inventory response.'
                        : 'Unable to reserve stock (HTTP ' + response.status + ').');
                }
                if (!response.ok) throw new Error(reservation.error || 'Unable to reserve stock.');
                if (reservation.reserved !== true) throw new Error('The server did not confirm the stock reservation.');
                if (!reservation.order) throw new Error('The server did not confirm the order details.');
                order.orderNumber = reservation.order.orderNumber;
                order.date = new Date(reservation.order.createdAt).toLocaleString();
                order.customer = reservation.order.customer;
                order.payment = reservation.order.payment;
                order.notes = reservation.order.notes || '';
                order.items = reservation.order.items;
                order.total = reservation.order.total;
            } catch (error) {
                billingError.textContent = error.message || 'Unable to place the order. Please try again.';
                submitButton.disabled = false;
                return;
            }
            pendingOrderNumber = null;
            document.dispatchEvent(new Event('kinetix:inventory-updated'));

            billingReceipt.replaceChildren();
            function add(tag, text, cls) {
                var el = document.createElement(tag);
                el.textContent = text;
                if (cls) el.className = cls;
                billingReceipt.appendChild(el);
                return el;
            }
            add('span', 'Order placed', 'mono-label');
            add('h3', 'Thank you, ' + order.customer.name + '!');
            add('p', 'Order no. ' + order.orderNumber + ' · ' + order.date, 'receipt-meta');
            order.items.forEach(function(item) {
                var row = document.createElement('div');
                row.className = 'billing-line';
                var l = document.createElement('span');
                l.textContent = item.name + ' × ' + item.quantity + ' @ ' + formatPrice(item.price);
                var a = document.createElement('strong');
                a.textContent = formatPrice(item.total);
                row.appendChild(l);
                row.appendChild(a);
                billingReceipt.appendChild(row);
            });
            var total = document.createElement('div');
            total.className = 'billing-total';
            total.innerHTML = '<span>Total</span><strong></strong>';
            total.lastChild.textContent = formatPrice(order.total);
            billingReceipt.appendChild(total);
            add('p', 'Payment: ' + order.payment + ' · ' + order.customer.place, 'receipt-meta');
            add('p', 'The KINETIX team will contact you at ' + order.customer.phone + ' to confirm your order.', 'receipt-meta');
            add('p', 'Thank you for choosing our products! We hope you enjoy every sip and bite.', 'receipt-thanks');
            var lines = ['KINETIX Organization - Order Receipt', 'Order no.: ' + order.orderNumber, 'Date: ' + order.date, 'Name: ' + order.customer.name, 'Contact: ' + order.customer.phone, 'Email: ' + order.customer.email, 'Place: ' + order.customer.place, 'Payment: ' + order.payment, order.notes ? 'Notes: ' + order.notes : '', '', 'ORDER DETAILS'];
            order.items.forEach(function(item) {
                lines.push(item.name + ' - ' + item.quantity + ' x ' + formatPrice(item.price) + ' = ' + formatPrice(item.total));
            });
            lines.push('', 'TOTAL: ' + formatPrice(order.total), '', 'Thank you for choosing our products! We hope you enjoy every sip and bite.');
            var mailLink = document.createElement('a');
            mailLink.className = 'checkout-btn receipt-mail';
            mailLink.textContent = 'Send receipt to ' + order.customer.email;
            mailLink.href = 'mailto:' + encodeURIComponent(order.customer.email) + '?cc=ikaymari4@gmail.com&subject=' + encodeURIComponent('KINETIX Receipt ' + order.orderNumber) + '&body=' + encodeURIComponent(lines.join('\n'));
            billingReceipt.appendChild(mailLink);
            var done = add('button', 'Done', 'checkout-btn');
            done.type = 'button';
            done.addEventListener('click', closeBilling);

            billingForm.hidden = true;
            billingReceipt.hidden = false;
            billingForm.reset();
            await updateCart('', 'DELETE');
            cartMessage.textContent = '';
        });

        document.addEventListener('click', function(e) {
            if (!cartPanel.hidden && !cartPanel.contains(e.target) && !cartToggle.contains(e.target)) setPanelOpen(false);
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && !cartPanel.hidden) {
                setPanelOpen(false);
                cartToggle.focus();
            }
        });

        requestCart('', 'GET').then(function(snapshot) {
            renderCart(snapshot);
            cartMessage.textContent = useBrowserCart
                ? 'Cart saved in this browser only; it does not sync across devices.'
                : '';
        }).catch(function() {
            if (useBrowserCart) {
                cartMessage.textContent = 'Unable to load the cart from this browser. Check browser storage settings.';
            } else {
                cartEmpty.hidden = true;
                cartItems.replaceChildren();
                cartMessage.textContent = 'Cart server unavailable. Start the backend from the VS Code task or run dotnet run from backend.';
            }
        });
    })();

    (function() {
        var form = document.getElementById('regForm');
        if (!form) return;
        var formCard = document.getElementById('regFormCard');
        var passCard = document.getElementById('regPassCard');
        var errBox = document.getElementById('regError');
        function row(label, value) {
            var p = document.createElement('p');
            var b = document.createElement('strong');
            b.textContent = label + ': ';
            p.appendChild(b);
            p.appendChild(document.createTextNode(value));
            return p;
        }

        function drawPass(reg) {
            var lines = [['Registration code', reg.code], ['Name', reg.name], ['Event', reg.event], ['Category', reg.category], ['Registered', reg.date]];
            var c = document.createElement('canvas');
            c.width = 800;
            c.height = 160 + lines.length * 56 + 40;
            var g = c.getContext('2d');
            g.fillStyle = '#ffffff';
            g.fillRect(0, 0, c.width, c.height);
            g.fillStyle = '#0b1f3a';
            g.fillRect(0, 0, c.width, 110);
            g.fillStyle = '#ffffff';
            g.font = 'bold 44px Arial, sans-serif';
            g.fillText('KINETIX DIGITAL PASS', 40, 70);
            g.fillStyle = '#111111';
            lines.forEach(function(l, i) {
                var y = 180 + i * 56;
                g.font = 'bold 26px Arial, sans-serif';
                g.fillText(l[0] + ':', 40, y);
                g.font = '26px Arial, sans-serif';
                g.fillText(l[1], 290, y);
            });
            return c.toDataURL('image/png');
        }

        function showPass(reg) {
            document.getElementById('regDownload').href = drawPass(reg);
            var info = document.getElementById('regInfo');
            info.replaceChildren(
                row('Registration code', reg.code),
                row('Name', reg.name),
                row('Email', reg.email),
                row('Contact number', reg.phone),
                row('School / Organization', reg.school || '-'),
                row('Event', reg.event),
                row('Category', reg.category),
                row('Registered', reg.date)
            );
            var body = ['New KINETIX Registration', '', 'Registration code: ' + reg.code, 'Name: ' + reg.name, 'Email: ' + reg.email, 'Contact number: ' + reg.phone, 'School / Organization: ' + (reg.school || '-'), 'Event: ' + reg.event, 'Category: ' + reg.category, 'Registered: ' + reg.date, '', 'Thank you for registering!'].join('\n');
            document.getElementById('regMail').href = 'mailto:ikaymari4@gmail.com?cc=' + encodeURIComponent(reg.email) + '&subject=' + encodeURIComponent('KINETIX Registration ' + reg.code + ' - ' + reg.name) + '&body=' + encodeURIComponent(body);
            formCard.hidden = true;
            passCard.hidden = false;
        }

        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            var name = document.getElementById('regName').value.trim();
            var email = document.getElementById('regEmail').value.trim();
            var phone = document.getElementById('regPhone').value.trim();
            if (!name || !/^\S+@\S+\.\S+$/.test(email) || !/^[0-9+\-\s()]{7,}$/.test(phone)) {
                errBox.textContent = 'Please enter your name, a valid email, and a valid contact number.';
                return;
            }
            errBox.textContent = '';
            var submitButton = form.querySelector('[type="submit"]');
            submitButton.disabled = true;
            try {
                var response = await fetch('/api/registrations', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name,
                        email: email,
                        phone: phone,
                        school: document.getElementById('regSchool').value.trim(),
                        event: document.getElementById('regEvent').value,
                        category: document.getElementById('regCategory').value
                    })
                });
                var result;
                try {
                    result = await response.json();
                } catch (error) {
                    throw new Error(response.ok
                        ? 'The registration server returned an unreadable response.'
                        : 'Registration could not be saved (HTTP ' + response.status + ').');
                }
                if (!response.ok) throw new Error(result.error || 'Registration could not be saved.');
                showPass({
                    code: result.code,
                    name: result.name,
                    email: result.email,
                    phone: result.phone,
                    school: result.school,
                    event: result.event,
                    category: result.category,
                    date: new Date(result.createdAt).toLocaleString()
                });
                form.reset();
            } catch (error) {
                errBox.textContent = error.message === 'Failed to fetch'
                    ? 'Registration could not be saved. Start the Kinetix backend and try again.'
                    : error.message || 'Registration could not be saved. Please try again.';
            } finally {
                submitButton.disabled = false;
            }
        });

        document.getElementById('regNew').addEventListener('click', function() {
            passCard.hidden = true;
            formCard.hidden = false;
        });
    })();

    (function() {
        var grid = document.getElementById('galGrid');
        if (!grid) return;
        var items = Array.prototype.slice.call(grid.children);
        items.sort(function(a, b) { return b.dataset.sort.localeCompare(a.dataset.sort); });
        items.forEach(function(i) { grid.appendChild(i); });
        var current = Math.max(0, items.findIndex(function(item) {
            return item.dataset.front === 'true';
        }));
        var box = document.getElementById('galLightbox');

        function layout() {
            var n = items.length;
            items.forEach(function(it, idx) {
                var d = idx - current;
                if (d > n / 2) d -= n;
                if (d < -n / 2) d += n;
                it.dataset.pos = Math.abs(d) > 2 ? 'far' : String(d);
                it.classList.toggle('is-current', d === 0);
            });
        }
        function go(step) { current = (current + step + items.length) % items.length; layout(); }
        function openPhoto(item) {
            var img = item.querySelector('img');
            document.getElementById('galLightImg').src = img.src;
            document.getElementById('galLightImg').alt = img.alt;
            box.hidden = false;
        }
        items.forEach(function(it, idx) {
            function act() { if (idx === current) openPhoto(it); else { current = idx; layout(); } }
            it.addEventListener('click', act);
            it.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
        });
        document.getElementById('galPrev').addEventListener('click', function() { go(-1); });
        document.getElementById('galNext').addEventListener('click', function() { go(1); });
        box.addEventListener('click', function(e) { if (e.target === box || e.target.id === 'galClose') box.hidden = true; });
        document.addEventListener('keydown', function(e) { if (e.key === 'Escape') box.hidden = true; });
        layout();

    })();

    (function() {
        var btn = document.getElementById('faqBtn');
        var modal = document.getElementById('faqModal');
        if (!btn || !modal) return;
        function close() { modal.hidden = true; }
        btn.addEventListener('click', function() { modal.hidden = false; });
        document.getElementById('faqClose').addEventListener('click', close);
        modal.addEventListener('click', function(e) { if (e.target === modal) close(); });
        document.addEventListener('keydown', function(e) { if (e.key === 'Escape') close(); });
        window.addEventListener('pageviewchange', close);
    })();

    (function() {
        var toggle = document.getElementById('themeToggle');
        if (!toggle) return;
        var root = document.documentElement;

        function apply(theme) {
            var isLight = theme === 'light';
            if (isLight) root.setAttribute('data-theme', 'light');
            else root.removeAttribute('data-theme');
            var next = isLight ? 'Switch to dark mode' : 'Switch to light mode';
            toggle.setAttribute('aria-checked', isLight ? 'true' : 'false');
            toggle.setAttribute('aria-label', next);
            toggle.title = next;
        }

        apply(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

        toggle.addEventListener('click', function() {
            var theme = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
            apply(theme);
            try {
                localStorage.setItem('kinetix-theme', theme);
            } catch (e) {}
        });
    })();

    (function teamPlayerCarousel() {
        var section = document.querySelector('.team-section');
        var sourceList = section && section.querySelector('.team-grid');
        if (!section || !sourceList) return;

        var members = Array.from(sourceList.querySelectorAll('.team-card')).map(function (source) {
            var image = source.querySelector('.team-avatar img');
            var name = source.querySelector('h3');
            var role = source.querySelector('.team-role');
            var description = source.querySelector('p');
            if (!image || !name || !role || !description) return null;
            return {
                image: image.getAttribute('src'),
                name: name.textContent.trim(),
                role: role.textContent.trim(),
                description: description.textContent.trim()
            };
        }).filter(Boolean);
        if (!members.length) return;

        var carousel = document.createElement('div');
        carousel.className = 'team-carousel';
        carousel.setAttribute('role', 'region');
        carousel.setAttribute('aria-label', 'Meet the team carousel');

        var stage = document.createElement('div');
        stage.className = 'team-player-stage';
        stage.setAttribute('aria-live', 'polite');
        stage.setAttribute('aria-atomic', 'true');
        var cards = members.map(function (member, index) {
            var card = document.createElement('button');
            card.type = 'button';
            card.className = 'team-player-card';
            card.dataset.index = String(index);
            card.setAttribute('aria-label', 'Select ' + member.name + ', ' + member.role);

            var image = document.createElement('img');
            image.className = 'team-player-photo';
            image.src = member.image;
            image.alt = '';
            image.draggable = false;

            var content = document.createElement('span');
            content.className = 'team-player-content';
            var number = document.createElement('span');
            number.className = 'team-player-number';
            number.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(members.length).padStart(2, '0');
            var name = document.createElement('span');
            name.className = 'team-player-name';
            name.textContent = member.name;
            var role = document.createElement('span');
            role.className = 'team-player-role';
            role.textContent = member.role;
            var description = document.createElement('span');
            description.className = 'team-player-description';
            description.textContent = member.description;
            content.append(number, name, role, description);
            card.append(image, content);
            stage.append(card);
            return card;
        });

        var controls = document.createElement('div');
        controls.className = 'team-carousel-controls';
        var previous = document.createElement('button');
        previous.type = 'button';
        previous.className = 'team-carousel-arrow';
        previous.setAttribute('aria-label', 'Previous team member');
        previous.textContent = '←';
        var counter = document.createElement('span');
        counter.className = 'team-carousel-counter';
        counter.setAttribute('aria-hidden', 'true');
        var next = document.createElement('button');
        next.type = 'button';
        next.className = 'team-carousel-arrow';
        next.setAttribute('aria-label', 'Next team member');
        next.textContent = '→';
        controls.append(previous, counter, next);

        var selector = document.createElement('div');
        selector.className = 'team-carousel-selector';
        selector.setAttribute('role', 'group');
        selector.setAttribute('aria-label', 'Choose a team member');
        var choices = members.map(function (member, index) {
            var choice = document.createElement('button');
            choice.type = 'button';
            choice.className = 'team-carousel-choice';
            choice.dataset.index = String(index);
            choice.setAttribute('aria-label', 'Show ' + member.name + ', ' + member.role);
            choice.setAttribute('aria-pressed', 'false');
            var image = document.createElement('img');
            image.src = member.image;
            image.alt = '';
            image.loading = 'lazy';
            var name = document.createElement('span');
            name.textContent = member.name;
            choice.append(image, name);
            selector.append(choice);
            return choice;
        });
        carousel.append(stage, controls, selector);
        sourceList.hidden = true;
        sourceList.before(carousel);

        var activeIndex = 0;
        function select(index, scrollChoice) {
            activeIndex = (index + members.length) % members.length;
            cards.forEach(function (card, cardIndex) {
                var offset = cardIndex - activeIndex;
                if (offset > members.length / 2) offset -= members.length;
                if (offset < -members.length / 2) offset += members.length;
                card.classList.toggle('is-active', offset === 0);
                card.classList.toggle('is-previous', offset === -1);
                card.classList.toggle('is-next', offset === 1);
                card.classList.toggle('is-hidden', Math.abs(offset) > 1);
                card.setAttribute('aria-hidden', String(Math.abs(offset) > 1));
                card.tabIndex = Math.abs(offset) <= 1 ? 0 : -1;
            });
            choices.forEach(function (choice, choiceIndex) {
                var active = choiceIndex === activeIndex;
                choice.classList.toggle('is-selected', active);
                choice.setAttribute('aria-pressed', String(active));
                if (active && scrollChoice && choice.scrollIntoView) {
                    choice.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
            });
            counter.textContent = String(activeIndex + 1).padStart(2, '0') + ' / ' + String(members.length).padStart(2, '0');
        }

        previous.addEventListener('click', function () { select(activeIndex - 1, true); });
        next.addEventListener('click', function () { select(activeIndex + 1, true); });
        stage.addEventListener('click', function (event) {
            var card = event.target.closest('.team-player-card');
            if (!card) return;
            var index = Number(card.dataset.index);
            if (index !== activeIndex) select(index, true);
        });
        selector.addEventListener('click', function (event) {
            var choice = event.target.closest('.team-carousel-choice');
            if (choice) select(Number(choice.dataset.index), true);
        });
        carousel.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                select(activeIndex - 1, true);
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                select(activeIndex + 1, true);
            }
        });
        stage.addEventListener('pointermove', function (event) {
            var card = event.target.closest('.team-player-card.is-active');
            if (!card || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
            var bounds = card.getBoundingClientRect();
            var rotateY = ((event.clientX - bounds.left) / bounds.width - .5) * 12;
            var rotateX = (.5 - (event.clientY - bounds.top) / bounds.height) * 10;
            card.style.setProperty('--tilt-x', rotateX.toFixed(2) + 'deg');
            card.style.setProperty('--tilt-y', rotateY.toFixed(2) + 'deg');
        });
        stage.addEventListener('pointerleave', function () {
            cards.forEach(function (card) {
                card.style.removeProperty('--tilt-x');
                card.style.removeProperty('--tilt-y');
            });
        });
        select(0);
    })();

    (function interactiveLayer() {
        var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

        var bar = document.createElement('div');
        bar.className = 'scroll-progress';
        document.body.appendChild(bar);

        var top = document.createElement('button');
        top.type = 'button';
        top.className = 'back-to-top';
        top.setAttribute('aria-label', 'Back to top');
        top.textContent = '\u2191';
        document.body.appendChild(top);

        function scroller() {
            var v = document.querySelector('[data-page-view]:not([hidden])');
            return v && v.scrollHeight > v.clientHeight + 4 && getComputedStyle(v).overflowY !== 'visible' ? v : null;
        }
        function update() {
            var s = scroller();
            var y = s ? s.scrollTop : window.scrollY;
            var max = s ? s.scrollHeight - s.clientHeight : document.documentElement.scrollHeight - window.innerHeight;
            bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
            top.classList.toggle('show', y > 400);
        }
        window.addEventListener('scroll', update, { passive: true });
        document.addEventListener('scroll', update, { passive: true, capture: true });
        window.addEventListener('hashchange', function () { setTimeout(update, 50); });
        top.addEventListener('click', function () {
            var s = scroller();
            (s || window).scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        });
        update();

        if (!fine || reduce) return;

        var glow = document.createElement('div');
        glow.className = 'cursor-glow';
        document.body.appendChild(glow);
        document.addEventListener('mousemove', function (e) {
            glow.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
            glow.classList.add('on');
        });
        document.addEventListener('mouseleave', function () { glow.classList.remove('on'); });

        var tiltSel = '.product-card, .cell, .gallery-item, .hero-photo, .purpose-item';
        document.addEventListener('mousemove', function (e) {
            var el = e.target.closest && e.target.closest(tiltSel);
            if (!el) return;
            var r = el.getBoundingClientRect();
            var x = (e.clientX - r.left) / r.width - 0.5;
            var y = (e.clientY - r.top) / r.height - 0.5;
            el.style.setProperty('--tilt-x', (-y * 6).toFixed(2) + 'deg');
            el.style.setProperty('--tilt-y', (x * 6).toFixed(2) + 'deg');
            el.classList.add('is-tilting');
        });
        document.addEventListener('mouseout', function (e) {
            var el = e.target.closest && e.target.closest(tiltSel);
            if (el && !el.contains(e.relatedTarget)) {
                el.classList.remove('is-tilting');
                el.style.removeProperty('--tilt-x');
                el.style.removeProperty('--tilt-y');
            }
        });

        document.addEventListener('mousemove', function (e) {
            var b = e.target.closest && e.target.closest('.hero-cta, .add-to-cart, .checkout-btn');
            if (!b) return;
            var r = b.getBoundingClientRect();
            b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.12).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * 0.2).toFixed(1) + 'px)';
        });
        document.addEventListener('mouseout', function (e) {
            var b = e.target.closest && e.target.closest('.hero-cta, .add-to-cart, .checkout-btn');
            if (b && !b.contains(e.relatedTarget)) b.style.transform = '';
        });
    })();

    (function roboticsAtmosphere() {
        var hero = document.getElementById('hero');
        if (!hero) return;

        var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var canvas = document.createElement('canvas');
        canvas.className = 'kinetix-particles';
        canvas.setAttribute('aria-hidden', 'true');
        document.body.insertBefore(canvas, document.body.firstChild);

        var context = canvas.getContext('2d');
        if (!context) {
            canvas.remove();
            return;
        }

        var width = 0;
        var height = 0;
        var pixelRatio = 1;
        var particles = [];
        var pointer = { x: -1000, y: -1000 };
        var gold = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#FFAE42';
        var animationFrame = 0;

        function resize() {
            width = window.innerWidth;
            height = window.innerHeight;
            pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
            canvas.width = Math.round(width * pixelRatio);
            canvas.height = Math.round(height * pixelRatio);
            context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

            var count = Math.min(70, Math.max(24, Math.floor(width * height / 22000)));
            particles = [];
            for (var i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - .5) * .28,
                    vy: (Math.random() - .5) * .28
                });
            }
            draw();
        }

        function draw() {
            animationFrame = 0;
            if (document.hidden) return;

            context.clearRect(0, 0, width, height);
            if (!reduceMotion) {
                particles.forEach(function(particle) {
                    particle.x += particle.vx;
                    particle.y += particle.vy;
                    if (particle.x < 0 || particle.x > width) particle.vx *= -1;
                    if (particle.y < 0 || particle.y > height) particle.vy *= -1;
                });
            }

            for (var i = 0; i < particles.length; i++) {
                for (var j = i + 1; j < particles.length; j++) {
                    var first = particles[i];
                    var second = particles[j];
                    var distance = Math.hypot(first.x - second.x, first.y - second.y);
                    if (distance < 132) {
                        context.globalAlpha = .13 * (1 - distance / 132);
                        context.strokeStyle = gold;
                        context.beginPath();
                        context.moveTo(first.x, first.y);
                        context.lineTo(second.x, second.y);
                        context.stroke();
                    }
                }

                var node = particles[i];
                var pointerDistance = Math.hypot(node.x - pointer.x, node.y - pointer.y);
                if (pointerDistance < 150) {
                    context.globalAlpha = .2 * (1 - pointerDistance / 150);
                    context.beginPath();
                    context.moveTo(node.x, node.y);
                    context.lineTo(pointer.x, pointer.y);
                    context.stroke();
                }
            }

            context.globalAlpha = .55;
            context.fillStyle = gold;
            particles.forEach(function(particle) {
                context.beginPath();
                context.arc(particle.x, particle.y, 1.35, 0, Math.PI * 2);
                context.fill();
            });
            context.globalAlpha = 1;

            if (!reduceMotion) animationFrame = window.requestAnimationFrame(draw);
        }

        function scheduleDraw() {
            if (!reduceMotion && !document.hidden && !animationFrame) {
                animationFrame = window.requestAnimationFrame(draw);
            }
        }

        resize();
        window.addEventListener('resize', resize, { passive: true });
        document.addEventListener('mousemove', function(event) {
            pointer.x = event.clientX;
            pointer.y = event.clientY;
        }, { passive: true });
        document.addEventListener('visibilitychange', function() {
            if (document.hidden && animationFrame) {
                window.cancelAnimationFrame(animationFrame);
                animationFrame = 0;
            } else {
                scheduleDraw();
            }
        });

        new MutationObserver(function() {
            gold = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || gold;
            scheduleDraw();
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        if ('IntersectionObserver' in window && !reduceMotion) {
            var revealObserver = new IntersectionObserver(function(entries, observer) {
                entries.forEach(function(entry) {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                });
            }, { threshold: .12 });

            document.querySelectorAll(
                '.section-head, .reveal-cap, .purpose-item, .team-card, .category-column, ' +
                '.contact-item, .legal-item, .reg-card, .gal-item, .announcement-card'
            ).forEach(function(element, index) {
                element.classList.add('kinetix-scroll-reveal');
                element.style.transitionDelay = (index % 4) * 55 + 'ms';
                revealObserver.observe(element);
            });
        }
    })();

})();
