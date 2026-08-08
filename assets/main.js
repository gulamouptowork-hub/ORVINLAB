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
     CURSOR + MAGNETIC PULL — vanilla rAF, no library
     The ring lags, the dot tracks; that gap is the whole effect.
     Hover growth is a CSS class, not JS: only position genuinely
     needs per-frame interpolation.
     ============================================================ */
  (function () {
    var ring, dot, raf = null;
    var tx = 0, ty = 0, rx = 0, ry = 0, dx = 0, dy = 0;
    var magnet = null, mRect = null, mx = 0, my = 0;
    var on = false;

    function lerpK(k, dt) { return 1 - Math.pow(1 - k, dt / 16.67); }

    function frame(now) {
      var dt = Math.min(50, now - (frame.last || now)); frame.last = now;
      rx += (tx - rx) * lerpK(0.13, dt);
      ry += (ty - ry) * lerpK(0.13, dt);
      dx += (tx - dx) * lerpK(0.50, dt);
      dy += (ty - dy) * lerpK(0.50, dt);
      ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
      dot.style.transform = "translate3d(" + dx + "px," + dy + "px,0)";
      if (magnet && mRect) {
        // cached rect: reading it per frame would force layout every frame
        var ox = Math.max(-10, Math.min(10, (tx - (mRect.left + mRect.width / 2)) * 0.22));
        var oy = Math.max(-10, Math.min(10, (ty - (mRect.top + mRect.height / 2)) * 0.28));
        mx += (ox - mx) * lerpK(0.15, dt);
        my += (oy - my) * lerpK(0.15, dt);
        // CSS custom properties, never style.transform: the stylesheet composes
        // translate() with :active scale(), and an inline transform would kill it
        magnet.style.setProperty("--mag-x", mx.toFixed(2) + "px");
        magnet.style.setProperty("--mag-y", my.toFixed(2) + "px");
      }
      raf = requestAnimationFrame(frame);
    }

    var MAG = ".btn, .teaser, .channel, .mailto";
    var HOV = "a, button, summary, .acc__q, .chip, " + MAG;

    function move(e) {
      tx = e.clientX; ty = e.clientY;
      if (!on) { on = true; rx = dx = tx; ry = dy = ty; document.documentElement.classList.add("cursor-on"); }
    }
    function over(e) {
      var t = e.target.closest && e.target.closest(HOV);
      if (t) ring.classList.add("is-hover");
      var m = e.target.closest && e.target.closest(MAG);
      if (m && m !== magnet) { release(); magnet = m; mRect = m.getBoundingClientRect(); }
    }
    function out(e) {
      var t = e.target.closest && e.target.closest(HOV);
      if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) ring.classList.remove("is-hover");
      var m = e.target.closest && e.target.closest(MAG);
      if (m && m === magnet && !(e.relatedTarget && m.contains(e.relatedTarget))) release();
    }
    function release() {
      if (!magnet) return;
      var el = magnet; magnet = null; mRect = null; mx = my = 0;
      el.style.setProperty("--mag-x", "0px");
      el.style.setProperty("--mag-y", "0px");
    }

    function enable() {
      if (ring) return;
      ring = document.createElement("div"); ring.className = "cursor";
      dot = document.createElement("div"); dot.className = "cursor-dot";
      ring.setAttribute("aria-hidden", "true"); dot.setAttribute("aria-hidden", "true");
      document.body.appendChild(ring); document.body.appendChild(dot);
      addEventListener("pointermove", move, { passive: true });
      document.addEventListener("pointerover", over);
      document.addEventListener("pointerout", out);
      addEventListener("pointerdown", function () { ring.classList.add("is-down"); });
      addEventListener("pointerup", function () { ring.classList.remove("is-down"); });
      addEventListener("scroll", function () { if (magnet) mRect = magnet.getBoundingClientRect(); }, { passive: true });
      raf = requestAnimationFrame(frame);
    }
    function disable() {
      if (!ring) return;
      cancelAnimationFrame(raf); raf = null;
      removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      release();
      ring.remove(); dot.remove(); ring = dot = null;
      document.documentElement.classList.remove("cursor-on");
      on = false;
    }
    function sync() { (fineMQ.matches && !reduced()) ? enable() : disable(); }

    sync();
    // the old build checked the preference once and never listened; toggling the
    // OS setting left the cursor running until reload
    (reduceMQ.addEventListener ? reduceMQ.addEventListener("change", sync) : reduceMQ.addListener(sync));
    (fineMQ.addEventListener ? fineMQ.addEventListener("change", sync) : fineMQ.addListener(sync));
  })();
})();
