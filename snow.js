// Test-Overrides: true = immer an, false = immer aus, null = automatisch nach Datum
// Weihnachtsmütze am Logo (automatisch 1.12. bis 26.12.)
const SANTA_HAT_FORCE = null;

// Schnee (automatisch 1.12. bis 31.01.)
const SNOW_FORCE = true;

(function () {
    'use strict';

    function inSeason(d) {
        const m = d.getMonth() + 1;
        return m === 12 || m === 1;
    }

    const enabled = SNOW_FORCE === null ? inSeason(new Date()) : SNOW_FORCE;
    if (!enabled) return;

    // Bewegung nur ohne "reduzierte Bewegung"-Präferenz
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) return;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');
    canvas.tabIndex = -1;
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1001;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let w = 0,
        h = 0,
        flakes = [],
        raf = 0,
        last = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function lightboxOpen() {
        return !!document.querySelector('.lightbox:not([hidden])');
    }

    // Fläche des geöffneten Modal-Dialogs, über die kein Schnee fallen soll
    function dialogRect() {
        const d = document.querySelector('.modal:not([hidden]) .modal-dialog');
        return d ? d.getBoundingClientRect() : null;
    }

    function resize() {
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const count = Math.min(120, Math.round((w * h) / 14000));
        while (flakes.length < count) flakes.push(make(true));
        flakes.length = count;
    }

    function make(randomY) {
        return {
            x: Math.random() * w,
            y: randomY ? Math.random() * h : -10,
            r: 1 + Math.random() * 2.5,
            v: 20 + Math.random() * 40,
            p: Math.random() * Math.PI * 2,
            s: 0.5 + Math.random()
        };
    }

    function frame(t) {
        raf = requestAnimationFrame(frame);
        const dt = Math.min((t - last) / 1000, 0.1);
        last = t;
        ctx.clearRect(0, 0, w, h);
        if (lightboxOpen()) return;
        const box = dialogRect();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 2;
        for (const f of flakes) {
            f.y += f.v * dt;
            f.p += f.s * dt;
            f.x += Math.sin(f.p) * 12 * dt;
            if (f.y > h + 10) Object.assign(f, make(false), { x: Math.random() * w });
            if (box && f.x > box.left - f.r - 3 && f.x < box.right + f.r + 3 && f.y > box.top - f.r - 3 && f.y < box.bottom + f.r + 3) continue;
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function start() {
        if (!raf) {
            last = performance.now();
            raf = requestAnimationFrame(frame);
        }
    }

    function stop() {
        cancelAnimationFrame(raf);
        raf = 0;
        ctx.clearRect(0, 0, w, h);
    }

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    motionQuery.addEventListener('change', (e) => (e.matches ? stop() : start()));
    start();
})();

(function () {
    'use strict';

    const now = new Date();
    const inSeason = now.getMonth() === 11 && now.getDate() <= 26;
    const enabled = SANTA_HAT_FORCE === null ? inSeason : SANTA_HAT_FORCE;
    if (!enabled) return;

    function addHat() {
        const svg = document.querySelector('.hero-mark svg');
        if (!svg || svg.querySelector('.santa-hat')) return;
        svg.style.overflow = 'visible';
        const ns = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(ns, 'g');
        g.setAttribute('class', 'santa-hat');
        g.setAttribute('aria-hidden', 'true');
        g.innerHTML =
            '<path d="M7.5 5 C 8 -2, 14 -7, 22 -6 C 24 -5.5, 25.5 -3.5, 27 -1 L 25.5 4.5 Z" fill="#d62828"/>' +
            '<path d="M5.5 4 C 5.5 1.5, 8 1, 16 0.8 C 24 1, 26.5 1.5, 26.5 4 C 26.5 6.2, 24 6.6, 16 6.4 C 8 6.6, 5.5 6.2, 5.5 4 Z" fill="#fff" stroke="#e5e5e5" stroke-width="0.3"/>' +
            '<circle cx="26.5" cy="-2" r="2.6" fill="#fff" stroke="#e5e5e5" stroke-width="0.3"/>';
        svg.appendChild(g);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addHat);
    else addHat();
})();
