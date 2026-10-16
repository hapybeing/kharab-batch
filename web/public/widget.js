/* Kharab Batch? embed. <div data-kharab-batch data-lang="hi" data-batch="SR-13"></div> + <script async src=".../widget.js"></script>
   Adds a sandboxed, read-only iframe (the same check as the app, read straight from Arkiv). No cookies, no tracking, no data collected. MIT. */
(function () {
  var s = document.currentScript || document.querySelector('script[src$="widget.js"]');
  var base = (s && s.src ? s.src : location.href).replace(/widget\.js(\?.*)?$/, "");
  var frames = [];
  function mount(el) {
    if (el.getAttribute("data-mounted")) return; el.setAttribute("data-mounted", "1");
    var q = "?embed=1"; var l = el.getAttribute("data-lang"), b = el.getAttribute("data-batch");
    if (l) q += "&lang=" + encodeURIComponent(l); if (b) q += "&batch=" + encodeURIComponent(b);
    var f = document.createElement("iframe");
    f.src = base + q; f.title = "Kharab Batch? \u2014 check a medicine batch number";
    f.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups"); f.referrerPolicy = "no-referrer";
    f.style.cssText = "width:100%;max-width:360px;height:260px;border:1px solid #dcdce0;border-radius:12px;background:#fff";
    el.appendChild(f); frames.push(f);
  }
  window.addEventListener("message", function (e) {
    if (!e.data || e.data.kharab !== "height") return;
    for (var i = 0; i < frames.length; i++) if (frames[i].contentWindow === e.source) frames[i].style.height = Math.min(1400, Math.ceil(e.data.h) + 4) + "px";
  });
  function go() { var n = document.querySelectorAll("[data-kharab-batch]"); for (var i = 0; i < n.length; i++) mount(n[i]); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
