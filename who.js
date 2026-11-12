/* MRM "Who's working?" check (11/11/2026, Jon). On the shared shop computers the last person's name sticks.
   When a desk opens, this asks once per browser tab: "Working as Jon?" One tap confirms; tapping another name
   switches (and reloads the desk so everything is saved under the right name). The name picker at the top of each
   desk still works as before. Same name store as the hub ("mrm-photos-who"). */
(function () {
  var KEY = "mrm-photos-who", OK = "mrm-who-ok";
  function get(k, s) { try { return (s || localStorage).getItem(k) || ""; } catch (e) { return ""; } }
  function set(k, v, s) { try { (s || localStorage).setItem(k, v); } catch (e) {} }
  var who = get(KEY);
  if (who && get(OK, sessionStorage) === who) return;
  var staff = ["Jon", "Sam", "Nina", "Julia", "Ethan", "Kyle", "Andy", "Jeff", "Chris", "Sturgis", "Mike"];
  try { var c = JSON.parse(get("mrm-staff") || "null"); if (Array.isArray(c) && c.length) staff = c; } catch (e) {}
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function show() {
    if (document.getElementById("mrm-whobar")) return;
    var st = document.createElement("style");
    st.textContent = "#mrm-whobar{position:sticky;top:0;z-index:999;background:#fff7e0;border-bottom:2px solid #e3b341;color:#222;padding:10px max(16px,env(safe-area-inset-right)) 10px max(16px,env(safe-area-inset-left));font:15px/1.4 system-ui,sans-serif;display:flex;flex-wrap:wrap;gap:8px;align-items:center}" +
      "#mrm-whobar b{font-weight:800}#mrm-whobar button{font:inherit;border-radius:8px;padding:5px 11px;cursor:pointer;border:1.5px solid #b98a12;background:#fff;color:#222}" +
      "#mrm-whobar button.yes{background:#1f6f3f;border-color:#1f6f3f;color:#fff;font-weight:700}#mrm-whobar .others{display:flex;flex-wrap:wrap;gap:6px}" +
      "@media (prefers-color-scheme:dark){#mrm-whobar{background:#3a3110;color:#f3ead0;border-color:#8a6d14}#mrm-whobar button{background:#222;color:#eee}}";
    document.head.appendChild(st);
    var bar = document.createElement("div"); bar.id = "mrm-whobar"; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", "Who's working");
    var others = staff.filter(function (n) { return n !== who; }).map(function (n) { return '<button type="button" data-n="' + esc(n) + '">' + esc(n) + "</button>"; }).join("");
    bar.innerHTML = who
      ? '<span>Working as <b>' + esc(who) + '</b>?</span><button type="button" class="yes" data-yes="1">Yes, that\'s me</button><span>or I\'m:</span><span class="others">' + others + "</span>"
      : '<span><b>Who\'s working?</b> Tap your name:</span><span class="others">' + others + "</span>";
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.getAttribute("data-yes")) { set(OK, who, sessionStorage); bar.remove(); return; }
      var n = b.getAttribute("data-n"); if (!n) return;
      set(KEY, n); set(OK, n, sessionStorage); location.reload();
    });
    document.body.insertBefore(bar, document.body.firstChild);
  }
  if (document.body) show(); else document.addEventListener("DOMContentLoaded", show);
})();
