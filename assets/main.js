/* ============================================================
   ORVINLAB — shared behaviour
   Loaded by every page with <script src="assets/main.js" defer>
   Each block no-ops when its target isn't on the current page.
   ============================================================ */
(function () {
  "use strict";

  /* ---- reduced motion: read it live, users toggle the OS setting
          without reloading, and CSS media queries can't gate JS ---- */
  var reduceMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduce = reduceMQ.matches;

  /* ---- current year ---- */
  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---- nav glass state, driven by a sentinel instead of a scroll listener ---- */
  var nav = document.getElementById("nav");
  var sentinel = document.getElementById("navSentinel");
  if (nav && sentinel && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      nav.classList.toggle("is-scrolled", !entries[0].isIntersecting);
    }).observe(sentinel);
  } else if (nav) {
    nav.classList.add("is-scrolled");
  }

  /* ---- mobile menu ---- */
  var toggle = document.getElementById("menuToggle");
  var menu = document.getElementById("menu");

  if (toggle && menu) {
    var toggleLabel = toggle.querySelector(".sr");
    var idleTimer;
    var lastFocus = null;
    var pageLocks = [
      document.querySelector(".skip"),
      document.querySelector("main"),
      document.querySelector("footer")
    ].filter(Boolean);

    var setPageLock = function (open) {
      pageLocks.forEach(function (node) {
        if ("inert" in node) node.inert = open;
        if (open) node.setAttribute("aria-hidden", "true");
        else node.removeAttribute("aria-hidden");
      });
    };

    var getMenuFocusables = function () {
      return Array.prototype.slice.call(
        menu.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      );
    };

    var setMenu = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      if (toggleLabel) toggleLabel.textContent = open ? "Close menu" : "Open menu";

      clearTimeout(idleTimer);
      menu.classList.add("is-active");           // will-change, just in time

      if (open) {
        lastFocus = document.activeElement;
        menu.removeAttribute("data-closed");
        menu.setAttribute("data-open", "");
        document.body.setAttribute("data-menu-open", "");
        setPageLock(true);
        var firstLink = menu.querySelector(".menu__link");
        if (firstLink) firstLink.focus({ preventScroll: true });
      } else {
        menu.removeAttribute("data-open");
        menu.setAttribute("data-closed", "");
        document.body.removeAttribute("data-menu-open");
        setPageLock(false);
        // release the compositor layer once the surface is idle again
        idleTimer = setTimeout(function () { menu.classList.remove("is-active"); }, 400);
        if (lastFocus && typeof lastFocus.focus === "function") {
          lastFocus.focus({ preventScroll: true });
        } else {
          toggle.focus({ preventScroll: true });
        }
      }
    };

    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });

    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });

    menu.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        e.preventDefault();
        setMenu(false);
        return;
      }

      if (e.key !== "Tab" || toggle.getAttribute("aria-expanded") !== "true") return;

      var focusables = getMenuFocusables();
      if (!focusables.length) {
        e.preventDefault();
        toggle.focus({ preventScroll: true });
        return;
      }

      var first = focusables[0];
      var last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true" && !e.target.closest(".menu")) {
        setMenu(false);
      }
    });

    /* close on resize back to desktop so the overlay can't strand the page */
    window.addEventListener("resize", function () {
      if (window.innerWidth > 900 && toggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
      }
    });
  }

  /* ---- cursor glow: fine pointers only, and only when motion is welcome ---- */
  var glow = document.getElementById("cursorGlow");
  if (glow) {
    var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    var glowOn = false, gx = 0, gy = 0, queued = false;

    var paint = function () {
      queued = false;
      // one write per frame, nothing read back — no forced synchronous layout
      glow.style.transform = "translate3d(" + gx + "px," + gy + "px,0)";
    };

    var onMove = function (e) {
      gx = e.clientX;
      gy = e.clientY;
      if (!glow.hasAttribute("data-on")) glow.setAttribute("data-on", "");
      if (!queued) { queued = true; requestAnimationFrame(paint); }
    };

    var syncGlow = function () {
      var want = finePointer.matches && !reduce;
      if (want === glowOn) return;
      glowOn = want;
      if (want) {
        window.addEventListener("pointermove", onMove, { passive: true });
      } else {
        window.removeEventListener("pointermove", onMove);
        glow.removeAttribute("data-on");
      }
    };

    syncGlow();

    var onPreferenceChange = function () {
      reduce = reduceMQ.matches;
      syncGlow();
    };
    if (reduceMQ.addEventListener) {
      reduceMQ.addEventListener("change", onPreferenceChange);
      finePointer.addEventListener("change", syncGlow);
    } else if (reduceMQ.addListener) {
      reduceMQ.addListener(onPreferenceChange);   // Safari < 14
      finePointer.addListener(syncGlow);
    }
  }

  /* ============================================================
     CUSTOM CURSOR  +  MAGNETIC BUTTONS  +  TITLE TILT   (GSAP)

     Gated on a fine pointer and on motion being welcome. Anything coarse or
     reduced keeps the native cursor untouched — `cursor:none` also discards the
     OS cursor size and contrast settings people rely on, so this is opt-in by
     capability, not a default.
     ============================================================ */
  (function () {
    if (typeof gsap === "undefined") return;

    var fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!fine.matches || reduceMQ.matches) return;

    var ring = document.createElement("div");
    var dot = document.createElement("div");
    ring.className = "cursor"; dot.className = "cursor-dot";
    ring.setAttribute("aria-hidden", "true"); dot.setAttribute("aria-hidden", "true");
    document.body.appendChild(ring); document.body.appendChild(dot);
    document.documentElement.classList.add("has-cursor");

    /* quickTo reuses one tween per property instead of spawning a new one per
       mousemove — the difference is hundreds of tween objects a second. */
    var rx = gsap.quickTo(ring, "x", { duration: 0.42, ease: "power3" });
    var ry = gsap.quickTo(ring, "y", { duration: 0.42, ease: "power3" });
    var dx = gsap.quickTo(dot, "x", { duration: 0.09, ease: "power2" });
    var dy = gsap.quickTo(dot, "y", { duration: 0.09, ease: "power2" });

    var shown = false, mag = null, mx = 0, my = 0;

    window.addEventListener("pointermove", function (e) {
      mx = e.clientX; my = e.clientY;
      rx(mx); ry(my); dx(mx); dy(my);
      if (!shown) {
        shown = true;
        gsap.to([ring, dot], { opacity: 1, duration: 0.3, overwrite: "auto" });   // never plain true: it would kill the quickTo x/y tweens
      }
      if (mag) pull(mag);
    }, { passive: true });

    /* leaving the window entirely — not just crossing an element */
    document.addEventListener("pointerleave", function () {
      shown = false;
      gsap.to([ring, dot], { opacity: 0, duration: 0.25, overwrite: "auto" });
    });

    var MAG_SEL = ".btn, .teaser, .mailto";
    var HOVER_SEL = "a, button, summary, .faq__q, .chip, " + MAG_SEL;

    function pull(el) {
      var r = el.getBoundingClientRect();
      var ox = mx - (r.left + r.width / 2);
      var oy = my - (r.top + r.height / 2);
      // capped: past ~10px it stops reading as attraction and starts reading as a bug
      var cap = 10;
      gsap.to(el, {
        "--mag-x": Math.max(-cap, Math.min(cap, ox * 0.22)) + "px",
        "--mag-y": Math.max(-cap, Math.min(cap, oy * 0.28)) + "px",
        duration: 0.4, ease: "power3", overwrite: "auto"
      });
    }
    function release(el) {
      gsap.to(el, {
        "--mag-x": "0px", "--mag-y": "0px",
        duration: 0.7, ease: "elastic.out(1, 0.55)", overwrite: "auto"
      });
    }

    document.addEventListener("pointerover", function (e) {
      var t = e.target.closest ? e.target.closest(HOVER_SEL) : null;
      if (!t) return;
      gsap.to(ring, {
        width: 62, height: 62, margin: "-31px 0 0 -31px",
        borderWidth: 1, borderColor: "rgba(50,255,78,.95)",
        boxShadow: "0 0 18px rgba(50,255,78,.55), 0 0 40px rgba(50,255,78,.25)",
        duration: 0.35, ease: "power3", overwrite: "auto"
      });
      gsap.to(dot, { scale: 0.5, duration: 0.35, ease: "power3", overwrite: "auto" });
      var m = e.target.closest(MAG_SEL);
      if (m) { mag = m; pull(m); }
    });

    document.addEventListener("pointerout", function (e) {
      var t = e.target.closest ? e.target.closest(HOVER_SEL) : null;
      if (!t) return;
      // ignore moves between a child and its own parent
      if (e.relatedTarget && t.contains(e.relatedTarget)) return;
      gsap.to(ring, {
        width: 36, height: 36, margin: "-18px 0 0 -18px",
        borderWidth: 1.5, borderColor: "",
        boxShadow: "none",
        duration: 0.4, ease: "power3", overwrite: "auto"
      });
      gsap.to(dot, { scale: 1, duration: 0.4, ease: "power3", overwrite: "auto" });
      var m = e.target.closest(MAG_SEL);
      if (m) { if (mag === m) mag = null; release(m); }
    });

    /* press feedback on the ring, so a click registers on the cursor too */
    window.addEventListener("pointerdown", function () {
      gsap.to(ring, { scale: 0.8, duration: 0.12, ease: "power2", overwrite: "auto" });
    });
    window.addEventListener("pointerup", function () {
      gsap.to(ring, { scale: 1, duration: 0.3, ease: "power3", overwrite: "auto" });
    });

    /* ---- the title keeps its subtle 3D tilt, now driven by GSAP ---- */
    var title = document.getElementById("title3d");
    if (title) {
      var trx = gsap.quickTo(title, "rotationX", { duration: 0.7, ease: "power3" });
      var trY = gsap.quickTo(title, "rotationY", { duration: 0.7, ease: "power3" });
      gsap.set(title, { transformPerspective: 1100, transformOrigin: "50% 50%" });
      window.addEventListener("pointermove", function (e) {
        var r = title.getBoundingClientRect();
        var nx = (e.clientX - (r.left + r.width / 2)) / Math.max(1, r.width);
        var ny = (e.clientY - (r.top + r.height / 2)) / Math.max(1, r.height * 2.2);
        // a few degrees only; more than that stops reading as depth
        trx(Math.max(-1, Math.min(1, -ny)) * 4.2);
        trY(Math.max(-1, Math.min(1, nx)) * 5.6);
      }, { passive: true });
    }
  })();
})();
