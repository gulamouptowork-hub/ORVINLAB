/* ============================================================
   ORVINLABS — contact anchor + footer, ONE source for all pages.

   ▼▼▼ FILL THESE IN ▼▼▼
   ============================================================ */
var ORV = {
  EMAIL:     "hello@orvinlab.com",
  WHATSAPP:  "<NUMBER>",     // digits only, incl. country code, e.g. 886912345678
  INSTAGRAM: "<HANDLE>",     // without the @, e.g. orvinlabs
  LOCATION:  "Hualien, Taiwan · UTC+8"
};
/* ▲▲▲ FILL THESE IN ▲▲▲

   This script is deliberately NOT deferred. It runs during parsing, at the
   position of the mount points, so the markup exists before first paint — a
   deferred build would inject a full-height dark section after layout and
   register as cumulative layout shift.

   Per-page headings live in data attributes on #site-contact so each page keeps
   its own closing line while the structure stays shared.
   ============================================================ */
(function () {
  // Two mount points, not one: the contact block is page content and belongs
  // inside <main>, the footer does not.
  var cHost = document.getElementById("site-contact");
  var fHost = document.getElementById("site-footer");
  if (!cHost && !fHost) return;

  var wa = "https://wa.me/" + ORV.WHATSAPP;
  var ig = "https://instagram.com/" + ORV.INSTAGRAM;
  var mail = "mailto:" + ORV.EMAIL;
  var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  var cur = function (f) { return here === f ? ' aria-current="page"' : ""; };

  var ICON = {
    mail: '<path d="M2 5.5h16v11H2z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2.6 6.2 10 12l7.4-5.8" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    wa: '<path d="M10 2.6a7.3 7.3 0 0 0-6.2 11.1L2.8 17.4l3.8-1a7.3 7.3 0 1 0 3.4-13.8Z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7.4 7.1c.3-.1.6 0 .8.3l.7 1c.1.2.1.4 0 .6l-.4.5a4 4 0 0 0 1.9 1.9l.5-.4c.2-.1.4-.1.6 0l1 .7c.3.2.4.5.3.8-.3.7-1 1-1.7.9A6.2 6.2 0 0 1 6.5 8.8c-.1-.7.2-1.4.9-1.7Z" fill="currentColor"/>',
    ig: '<rect x="3" y="3" width="14" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="10" cy="10" r="3.4" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="14.4" cy="5.6" r="1" fill="currentColor"/>'
  };
  function svg(k) {
    return '<svg class="channel__icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">' + ICON[k] + "</svg>";
  }
  function channel(k, href, label, sub, aria, ext) {
    return '<a class="channel" href="' + href + '"' +
      (ext ? ' target="_blank" rel="noopener noreferrer"' : "") +
      ' aria-label="' + aria + '">' + svg(k) +
      '<span class="channel__label">' + label + "</span>" +
      '<span class="channel__sub">' + sub + "</span></a>";
  }

  var host = cHost || fHost;
  var eyebrow = host.getAttribute("data-eyebrow") || "Start here";
  var heading = host.getAttribute("data-heading") || "One line about your business is enough.";
  var lede = host.getAttribute("data-lede") ||
    "Tell us what is eating your week. You will get a real person's answer within a day, " +
    "saying whether we can help and roughly what it costs.";

  if (cHost) cHost.outerHTML =
    '<section class="section contact surface--inverse" id="contact">' +
      '<div class="contact__glow" aria-hidden="true"></div>' +
      '<div class="wrap contact__inner">' +
        '<p class="eyebrow eyebrow--neon">' + eyebrow + "</p>" +
        '<h2 class="h2">' + heading + "</h2>" +
        '<p class="lede">' + lede + "</p>" +
        '<div class="channels">' +
          channel("mail", mail, "Email", ORV.EMAIL, "Email us at " + ORV.EMAIL, false) +
          channel("wa", wa, "WhatsApp", "Reply within a day", "Message us on WhatsApp", true) +
          channel("ig", ig, "Instagram", "See recent work", "See our work on Instagram", true) +
        "</div>" +
        '<p class="tiny contact__note">Replies within one working day &middot; No sales sequence, ever</p>' +
      "</div>" +
    "</section>";

  if (fHost) fHost.outerHTML =
    '<footer class="footer surface--inverse">' +
      '<div class="wrap footer__grid">' +
        '<div class="footer__col footer__col--brand">' +
          '<a class="wm" href="index.html" aria-label="ORVINLABS — home">' +
            '<svg class="petal" aria-hidden="true" focusable="false"><use href="#mark"/></svg>' +
            "<span>ORVINLABS</span><span class=\"wm__dot\"></span></a>" +
          '<p class="footer__blurb">Websites, advertising, automation and AI for small businesses — ' +
          "built by one team so they finally point the same way.</p>" +
        "</div>" +
        '<div class="footer__col"><h2 class="footer__head">Pages</h2><ul>' +
          '<li><a href="index.html"' + cur("index.html") + ">Home</a></li>" +
          '<li><a href="about.html"' + cur("about.html") + ">About</a></li>" +
          '<li><a href="work.html"' + cur("work.html") + ">Work</a></li>" +
          '<li><a href="products.html"' + cur("products.html") + ">Services</a></li>" +
        "</ul></div>" +
        '<div class="footer__col"><h2 class="footer__head">Services</h2><ul>' +
          '<li><a href="products.html">Websites</a></li>' +
          '<li><a href="products.html">Advertising</a></li>' +
          '<li><a href="products.html">Automation</a></li>' +
          '<li><a href="products.html">AI</a></li>' +
        "</ul></div>" +
        '<div class="footer__col"><h2 class="footer__head">Contact</h2><ul class="footer__contact">' +
          '<li><a href="' + mail + '">' + svg("mail") + "<span>" + ORV.EMAIL + "</span></a></li>" +
          '<li><a href="' + wa + '" target="_blank" rel="noopener noreferrer">' + svg("wa") + "<span>WhatsApp</span></a></li>" +
          '<li><a href="' + ig + '" target="_blank" rel="noopener noreferrer">' + svg("ig") + "<span>Instagram</span></a></li>" +
        "</ul></div>" +
      "</div>" +
      '<div class="wrap footer__base">' +
        "<p>&copy; " + new Date().getFullYear() + " ORVINLABS</p>" +
        "<p>" + ORV.LOCATION + "</p>" +
      "</div>" +
    "</footer>";
})();
