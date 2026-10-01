/*
  Kinetic Template
  https://templatemo.com/tm-631-kinetic
*/

(function() {
    "use strict";
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

            // quadratic control point so the curve APEX lands on (posX, posY)
            var cy = 2 * posY - baseY;
            path.setAttribute('d', 'M 0 ' + baseY + ' Q ' + posX + ' ' + cy + ' ' + W + ' ' + baseY);

            grip.setAttribute('cx', posX);
            grip.setAttribute('cy', posY);
            grip.setAttribute('opacity', active ? 1 : 0);

            // === rope as a physical body: it touches boxes and flings them ===
            var ROPE_HALF = 14; // effective rope thickness for contact
            var FRICTION = 0.85;
            var HOME = 0.010; // weak drift back toward origin
            var k3, b;

            function ropeYAt(x) {
                // exact quadratic-bezier Y for curve P0(0,baseY) P1(posX,cy) P2(W,baseY)
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
                return omt * omt * baseY + 2 * omt * t * cy + t * t * baseY;
            }

            // 1) integrate each box under rope contact + weak home drift
            for (k3 = 0; k3 < boxes.length; k3++) {
                b = boxes[k3];
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

                b.vx += -b.ox * HOME;
                b.vy += -b.oy * HOME;
                b.vx *= FRICTION;
                b.vy *= FRICTION;
                b.ox += b.vx;
                b.oy += b.vy;
            }

            // 2) separation so boxes shove each other apart, never overlap
            if (!reduceMotion) {
                for (var pass = 0; pass < 3; pass++) {
                    for (var a2 = 0; a2 < boxes.length; a2++) {
                        for (var c2 = a2 + 1; c2 < boxes.length; c2++) {
                            var ba = boxes[a2],
                                bb = boxes[c2];
                            var ddx = (ba.fx * W + ba.ox) - (bb.fx * W + bb.ox);
                            var ddy = (ba.fy * H + ba.oy) - (bb.fy * H + bb.oy);
                            var ox2 = (ba.w / 2 + bb.w / 2 + 6) - Math.abs(ddx);
                            var oy2 = (ba.h / 2 + bb.h / 2 + 6) - Math.abs(ddy);
                            if (ox2 > 0 && oy2 > 0) {
                                if (ox2 < oy2) {
                                    var sh = (ddx < 0 ? -1 : 1) * ox2 * 0.30;
                                    ba.ox += sh;
                                    bb.ox -= sh;
                                    ba.vx *= 0.5;
                                    bb.vx *= 0.5;
                                } else {
                                    var sv = (ddy < 0 ? -1 : 1) * oy2 * 0.30;
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
            for (k3 = 0; k3 < boxes.length; k3++) {
                var bo = boxes[k3];
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
                'linear-gradient(rgba(242,201,76,.1), rgba(20,43,77,.24))' + (FRONT ? ", url('" + FRONT + "')" : '');

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
        var useBrowserCart = window.location.hostname === 'github.io' || window.location.hostname.endsWith('.github.io');
        var browserCartKey = 'kinetix-cart-v1';

        function readBrowserCart() {
            var savedCart = window.localStorage.getItem(browserCartKey);
            if (!savedCart) return [];

            var items = JSON.parse(savedCart);
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

        function requestBrowserCart(path, method, data) {
            var items = readBrowserCart();
            if (method === 'GET') return browserCartSnapshot(items);

            if (method === 'DELETE' && !path) {
                items = [];
            } else if (method === 'POST' && path === '/items') {
                var button = buttons.find(function(entry) {
                    return entry.dataset.product === (data && data.productId);
                });
                if (!button) throw new Error('Choose a valid product.');
                var existingItem = items.find(function(item) {
                    return item.productId === button.dataset.product;
                });
                if (existingItem) {
                    existingItem.quantity += 1;
                    if (data && typeof data.name === 'string') existingItem.name = data.name;
                } else {
                    var name = data && typeof data.name === 'string' ? data.name : button.dataset.name;
                    items.push({ productId: button.dataset.product, name: name, quantity: 1 });
                }
            } else {
                var decrementMatch = path.match(/^\/items\/([^/]+)\/decrement$/);
                var itemMatch = path.match(/^\/items\/([^/]+)$/);
                if (method === 'POST' && decrementMatch) {
                    var decrementId = decodeURIComponent(decrementMatch[1]);
                    var decrementIndex = items.findIndex(function(item) {
                        return item.productId.toLowerCase() === decrementId.toLowerCase();
                    });
                    if (decrementIndex >= 0) {
                        if (items[decrementIndex].quantity > 1) {
                            items[decrementIndex].quantity -= 1;
                        } else {
                            items.splice(decrementIndex, 1);
                        }
                    }
                } else if (method === 'DELETE' && itemMatch) {
                    var removeId = decodeURIComponent(itemMatch[1]).toLowerCase();
                    items = items.filter(function(item) {
                        return item.productId.toLowerCase() !== removeId;
                    });
                } else {
                    throw new Error('Unsupported cart operation.');
                }
            }

            window.localStorage.setItem(browserCartKey, JSON.stringify(items));
            return browserCartSnapshot(items);
        }

        function formatPrice(value) {
            return '₱' + Number(value).toFixed(2);
        }

        function getProductPrice(productId) {
            var button = document.querySelector('.add-to-cart[data-product="' + productId + '"]');
            return Number(button && button.dataset.price ? button.dataset.price : 0);
        }

        function getSelectedFlavor(productId) {
            var picker = document.querySelector('.product-flavor-picker[data-product="' + productId + '"] select');
            return picker ? (picker.value || 'Original') : 'Original';
        }

        async function requestCart(path, method, data) {
            if (useBrowserCart) return requestBrowserCart(path, method, data);
            var options = { method: method };
            if (data) {
                options.headers = { 'Content-Type': 'application/json' };
                options.body = JSON.stringify(data);
            }
            var response = await fetch(cartEndpoint + path, options);
            var result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Cart request failed.');
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
                button.classList.toggle('is-added', !!item);
                button.textContent = item ? (item.quantity > 1 ? 'Add another (' + item.quantity + ')' : 'Added to cart') : 'Add to cart';
                button.setAttribute('aria-label', item ? button.dataset.name + ', quantity ' + item.quantity + ' in cart. Add another.' : 'Add ' + button.dataset.name + ' to cart');
            });

            document.querySelectorAll('.product-flavor-picker').forEach(function(picker) {
                var productId = picker.getAttribute('data-product');
                var item = items.find(function(entry) {
                    return entry.productId === productId;
                });
                if (item) {
                    var selected = item.name.split(' - ')[1] || item.name;
                    var select = picker.querySelector('select');
                    if (select && selected && Array.prototype.indexOf.call(select.options, select.querySelector('option[value="' + selected + '"]')) >= 0) {
                        select.value = selected;
                    }
                }
            });

            items.forEach(function(item) {
                var row = document.createElement('div');
                row.className = 'cart-item';

                var name = document.createElement('span');
                name.className = 'cart-item-name';
                name.textContent = item.name;
                row.appendChild(name);

                var controls = document.createElement('div');
                controls.className = 'cart-item-controls';
                controls.appendChild(makeAction('-', 'Remove one ' + item.name, async function() {
                    await updateCart('/items/' + encodeURIComponent(item.productId) + '/decrement', 'POST');
                }));

                var quantity = document.createElement('span');
                quantity.className = 'cart-item-quantity';
                quantity.textContent = item.quantity;
                controls.appendChild(quantity);
                controls.appendChild(makeAction('+', 'Add one ' + item.name, async function() {
                    await updateCart('/items', 'POST', { productId: item.productId });
                }));
                controls.appendChild(makeAction('×', 'Remove ' + item.name + ' from cart', async function() {
                    await updateCart('/items/' + encodeURIComponent(item.productId), 'DELETE');
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
                var productName = button.dataset.name + (button.dataset.product === 'soya-pop' ? ' - ' + flavor : '');
                await updateCart('/items', 'POST', { productId: button.dataset.product, name: productName });
                setPanelOpen(true);
                button.disabled = false;
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
            if (!cartTotalPrice.textContent || cartTotalPrice.textContent === '₱0.00') return;
            cartMessage.textContent = 'Checkout is ready for your order. Connect a payment provider to complete the purchase.';
            setPanelOpen(true);
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

})();
