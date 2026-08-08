/* ============================================================
   ORVINLABS — shared behaviour. Vanilla only, no libraries.
   Every block no-ops when its target is absent, so all four pages
   load the same file.
   ============================================================ */
(function () {
  "use strict";

  var reduceMQ = matchMedia("(prefers-reduced-motion: reduce)");
  var fineMQ = matchMedia("(hover: hover) and (pointer: fine)");
  var reduced = function () { return reduceMQ.matches; };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  var year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  /* ============================================================
     LOAD SEQUENCE
     Hard cap 1400ms. sessionStorage gates it to first load only;
     every later navigation in the session gets a 200ms cross-fade.
     The overlay is created BY script, so if script never runs there
     is nothing to trap the page behind.
     ============================================================ */
  (function () {
    var host = $("#loader");
    if (!host) return;
    var seen = false;
    try { seen = sessionStorage.getItem("orv.seen") === "1"; } catch (e) { seen = true; }

    if (reduced()) { host.remove(); return; }

    host.hidden = false;
    document.documentElement.classList.add("is-loading");
    host.setAttribute("data-mode", seen ? "quick" : "full");

    var done = function () {
      document.documentElement.classList.remove("is-loading");
      host.setAttribute("data-out", "");
      setTimeout(function () { host.remove(); }, 520);
      try { sessionStorage.setItem("orv.seen", "1"); } catch (e) {}
    };
    // the cap is a timeout, not the end of a chain: if a font or a frame
    // stalls, the page still clears on schedule
    setTimeout(done, seen ? 200 : 1150);
  })();

  /* ============================================================
     NAV — scroll state via a sentinel, no scroll listener
     ============================================================ */
  (function () {
    var nav = $("#nav"), sentinel = $("#navSentinel");
    if (!nav) return;
    if (!sentinel || !("IntersectionObserver" in window)) { nav.classList.add("is-scrolled"); return; }
    new IntersectionObserver(function (e) {
      nav.classList.toggle("is-scrolled", !e[0].isIntersecting);
    }, { rootMargin: "80px 0px 0px 0px" }).observe(sentinel);
  })();

  /* ============================================================
     SCROLL REVEALS — one observer for the whole page
     ============================================================ */
  (function () {
    var els = $$("[data-reveal]");
    if (!els.length) return;
    if (reduced() || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    // above the fold is already visible; moving it is just latency
    var fold = innerHeight;
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("is-in");
        obs.unobserve(en.target);
      });
    }, { threshold: 0.15 });

    els.forEach(function (el) {
      if (el.getBoundingClientRect().top < fold) { el.classList.add("is-in"); return; }
      io.observe(el);
    });
  })();

  /* ============================================================
     ACCORDION — grid-template-rows 0fr → 1fr, never a guessed height
     ============================================================ */
  $$("[data-acc]").forEach(function (acc) {
    var btn = $(".acc__q", acc), panel = $(".acc__panel", acc);
    if (!btn || !panel) return;
    btn.addEventListener("click", function () {
      var open = acc.hasAttribute("data-open");
      if (open) acc.removeAttribute("data-open"); else acc.setAttribute("data-open", "");
      btn.setAttribute("aria-expanded", String(!open));
    });
  });

  /* ============================================================
     MOBILE MENU
     ============================================================ */
  (function () {
    var toggle = $("#menuToggle"), menu = $("#menu");
    if (!toggle || !menu) return;
    var label = $(".sr", toggle), idle, lastFocus = null;
    var locks = [$(".skip"), $("main"), $("footer")].filter(Boolean);

    var lock = function (on) {
      locks.forEach(function (n) {
        if ("inert" in n) n.inert = on;
        if (on) n.setAttribute("aria-hidden", "true"); else n.removeAttribute("aria-hidden");
      });
    };
    var focusables = function () {
      return $$('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])', menu);
    };
    var set = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      if (label) label.textContent = open ? "Close menu" : "Open menu";
      clearTimeout(idle);
      menu.classList.add("is-active");
      if (open) {
        lastFocus = document.activeElement;
        menu.setAttribute("data-open", "");
        document.body.setAttribute("data-menu-open", "");
        lock(true);
        var f = $(".menu__link", menu); if (f) f.focus({ preventScroll: true });
      } else {
        menu.removeAttribute("data-open");
        document.body.removeAttribute("data-menu-open");
        lock(false);
        idle = setTimeout(function () { menu.classList.remove("is-active"); }, 500);
        (lastFocus && lastFocus.focus ? lastFocus : toggle).focus({ preventScroll: true });
      }
    };

    toggle.addEventListener("click", function () {
      set(toggle.getAttribute("aria-expanded") !== "true");
    });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) set(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || toggle.getAttribute("aria-expanded") !== "true") return;
      e.preventDefault(); set(false);
    });
    menu.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || toggle.getAttribute("aria-expanded") !== "true") return;
      var f = focusables(); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    addEventListener("resize", function () {
      if (innerWidth > 900 && toggle.getAttribute("aria-expanded") === "true") set(false);
    });
  })();

  /* ============================================================
     CUSTOM CURSOR — difference-blend dot, vanilla rAF

     Position and scale compose into ONE transform on ONE element. They
     cannot be split across a wrapper: a wrapper with a transform makes a
     stacking context, and mix-blend-mode only blends inside its own
     stacking context, so the dot would invert nothing but itself.

     That also means the scale cannot be a CSS transition — JS owns the
     transform. It is lerped in the same loop, which is frame-rate
     independent and matches the position easing anyway.
     ============================================================ */
  (function () {
    var dot = null, raf = null, last = 0;
    var tx = 0, ty = 0, x = 0, y = 0;          // pointer target, eased position
    var scale = 1, scaleTarget = 1;
    var magnet = null, mRect = null, mx = 0, my = 0;
    var shown = false;

    // frame-rate independent easing: k is the fraction closed per 60fps frame
    function ease(k, dt) { return 1 - Math.pow(1 - k, dt / 16.67); }

    var HOVER = 'a, button, summary, input, textarea, select, label, .acc__q, .chip, .interactive';
    var MAGNET = '.btn, .teaser, .channel, .mailto';

    function frame(now) {
      var dt = Math.min(50, now - (last || now)); last = now;

      x += (tx - x) * ease(0.35, dt);
      y += (ty - y) * ease(0.35, dt);
      scale += (scaleTarget - scale) * ease(0.30, dt);   // ~99% in 250ms; 0.20 read as sluggish

      dot.style.transform =
        'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) scale(' + scale.toFixed(3) + ')';

      if (magnet && mRect) {
        // rect is cached on pointerover; reading it per frame would force layout
        var ox = Math.max(-10, Math.min(10, (tx - (mRect.left + mRect.width / 2)) * 0.22));
        var oy = Math.max(-10, Math.min(10, (ty - (mRect.top + mRect.height / 2)) * 0.28));
        mx += (ox - mx) * ease(0.15, dt);
        my += (oy - my) * ease(0.15, dt);
        magnet.style.setProperty('--mag-x', mx.toFixed(2) + 'px');
        magnet.style.setProperty('--mag-y', my.toFixed(2) + 'px');
      }
      raf = requestAnimationFrame(frame);
    }

    function move(e) {
      tx = e.clientX; ty = e.clientY;
      if (!shown) {                    // no swoop in from 0,0 on the first move
        shown = true; x = tx; y = ty;
        document.documentElement.classList.add('cursor-on');
      }
    }
    function over(e) {
      if (!e.target.closest) return;
      if (e.target.closest(HOVER)) scaleTarget = 2;
      var m = e.target.closest(MAGNET);
      if (m && m !== magnet) { release(); magnet = m; mRect = m.getBoundingClientRect(); }
    }
    function out(e) {
      if (!e.target.closest) return;
      var t = e.target.closest(HOVER);
      if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) scaleTarget = 1;
      var m = e.target.closest(MAGNET);
      if (m && m === magnet && !(e.relatedTarget && m.contains(e.relatedTarget))) release();
    }
    function release() {
      if (!magnet) return;
      var el = magnet; magnet = null; mRect = null; mx = my = 0;
      el.style.setProperty('--mag-x', '0px');
      el.style.setProperty('--mag-y', '0px');
    }
    function rescan() { if (magnet) mRect = magnet.getBoundingClientRect(); }

    function enable() {
      if (dot) return;
      dot = document.createElement('div');
      dot.className = 'cursor-dot';
      dot.setAttribute('aria-hidden', 'true');
      document.body.appendChild(dot);
      addEventListener('pointermove', move, { passive: true });
      document.addEventListener('pointerover', over);
      document.addEventListener('pointerout', out);
      addEventListener('pointerdown', function () { scaleTarget = 0.7; });
      addEventListener('pointerup', function () { scaleTarget = 1; });
      addEventListener('scroll', rescan, { passive: true });
      addEventListener('resize', rescan);
      raf = requestAnimationFrame(frame);
    }
    function disable() {
      if (!dot) return;
      cancelAnimationFrame(raf); raf = null;
      removeEventListener('pointermove', move);
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerout', out);
      removeEventListener('scroll', rescan);
      removeEventListener('resize', rescan);
      release();
      dot.remove(); dot = null; shown = false;
      document.documentElement.classList.remove('cursor-on');
    }
    function sync() { (fineMQ.matches && !reduced()) ? enable() : disable(); }

    sync();
    // listen for live changes: the old build checked once and left the cursor
    // running until reload if the OS setting was toggled
    (reduceMQ.addEventListener ? reduceMQ.addEventListener('change', sync) : reduceMQ.addListener(sync));
    (fineMQ.addEventListener ? fineMQ.addEventListener('change', sync) : fineMQ.addListener(sync));
  })();
})();
