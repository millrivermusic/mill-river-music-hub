/* MRM customer line (11/13/2026, Jon): wherever a customer shows up, show name · email · phone without opening the file,
   so staff can confirm them every time. Missing info shows as "no email" / "no phone" so it gets noticed.
   Click an email or phone to copy it.
   Use:  MRMCust.line({name, email, phone})            -> HTML string (when the page already has the info)
         <span data-mrm-cust="recXXXXXXXXXXXXXX"></span>  -> filled in automatically from the User Database
         MRMCust.get(recId) -> Promise<{name,email,phone}> */
(function () {
  if (window.MRMCust) return;
  var BASE = "appZD2jJGbSlvofcV", USERS = "tblGJnacXCV52gZdS";
  var FIELDS = ["First Name", "Last Name", "E-mail", "Mobile", "Phone"];
  var cache = {}, waiting = {}, tried = {}, timer = null;
  function ls(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function str(v) { return v == null ? "" : String(v).trim(); }

  var css = document.createElement("style");
  css.textContent =
    ".mc-line{display:inline-flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px;min-width:0;max-width:100%}" +
    ".mc-line .mc-n{font-weight:600}" +
    ".mc-line .mc-c{font-size:.92em;opacity:.85;cursor:copy;border-bottom:1px dotted currentColor;word-break:break-all}" +
    ".mc-line .mc-c:hover{opacity:1}" +
    ".mc-line .mc-miss{font-size:.85em;color:#B4532A;font-style:italic}" +
    ".mc-line .mc-ok{font-size:.85em;color:#2F6B3A;font-weight:600}" +
    ".mc-block{display:block;margin:2px 0}";
  (document.head || document.documentElement).appendChild(css);

  function rec2c(r) {
    var f = r.fields || {};
    return { id: r.id, name: (str(f["First Name"]) + " " + str(f["Last Name"])).trim() || "(no name)", email: str(f["E-mail"]), phone: str(f.Mobile) || str(f.Phone) };
  }

  function line(c, opt) {
    c = c || {}; opt = opt || {};
    var parts = [];
    if (!opt.noName) parts.push('<span class="mc-n">' + esc(c.name || "(no name)") + "</span>");
    parts.push(c.email ? '<span class="mc-c" data-mc-copy="' + esc(c.email) + '" title="Click to copy">' + esc(c.email) + "</span>" : '<span class="mc-miss">no email</span>');
    parts.push(c.phone ? '<span class="mc-c" data-mc-copy="' + esc(c.phone) + '" title="Click to copy">' + esc(c.phone) + "</span>" : '<span class="mc-miss">no phone</span>');
    return '<span class="mc-line' + (opt.block ? " mc-block" : "") + '">' + parts.join('<span aria-hidden="true">·</span>') + "</span>";
  }

  function fetchIds(ids) {
    var out = [];
    for (var i = 0; i < ids.length; i += 50) out.push(ids.slice(i, i + 50));
    return Promise.all(out.map(function (part) {
      var f = "OR(" + part.map(function (id) { return "RECORD_ID()='" + id + "'"; }).join(",") + ")";
      var q = USERS + "?pageSize=100&filterByFormula=" + encodeURIComponent(f) + FIELDS.map(function (x) { return "&fields%5B%5D=" + encodeURIComponent(x); }).join("");
      return fetch("https://api.airtable.com/v0/" + BASE + "/" + q, { headers: { "Content-Type": "application/json", Authorization: "Bearer " + (ls("mrm-photos-token") || "via-hub") } })
        .then(function (r) { return r.json(); })
        .then(function (j) { (j.records || []).forEach(function (r) { cache[r.id] = rec2c(r); }); });
    }));
  }

  function flush() {
    timer = null;
    var ids = Object.keys(waiting); waiting = {};
    if (!ids.length) return;
    fetchIds(ids).catch(function () {}).then(function () { fill(document); });
  }
  function want(id) { if (cache[id] || tried[id]) return; tried[id] = 1; waiting[id] = 1; if (!timer) timer = setTimeout(flush, 60); }

  function fill(root) {
    var els = (root.querySelectorAll ? root : document).querySelectorAll("[data-mrm-cust]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i], id = el.getAttribute("data-mrm-cust");
      if (!/^rec[A-Za-z0-9]{14}$/.test(id || "")) continue;
      if (el.getAttribute("data-mc-done") === id) continue;
      if (cache[id]) { el.innerHTML = line(cache[id], { noName: el.hasAttribute("data-mc-noname"), block: el.hasAttribute("data-mc-block") }); el.setAttribute("data-mc-done", id); }
      else want(id);
    }
  }

  function get(id) { if (cache[id]) return Promise.resolve(cache[id]); return fetchIds([id]).then(function () { return cache[id] || null; }); }

  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest && e.target.closest("[data-mc-copy]"); if (!t) return;
    e.preventDefault(); e.stopPropagation();
    var v = t.getAttribute("data-mc-copy"), old = t.textContent;
    function done() { t.textContent = "copied"; t.classList.add("mc-ok"); setTimeout(function () { t.textContent = old; t.classList.remove("mc-ok"); }, 900); }
    try { navigator.clipboard.writeText(v).then(done, function () {}); } catch (x) {}
  }, true);

  var mo = new MutationObserver(function () { fill(document); });
  function start() { fill(document); mo.observe(document.body, { childList: true, subtree: true }); }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);

  window.MRMCust = { line: line, get: get, fill: fill, put: function (c) { if (c && c.id) cache[c.id] = c; } };
})();
