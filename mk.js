/* Marketing consent panel (email + texts), shared by Customers and Lookup.
   Turning one on or off records the answer, the date and who changed it, then asks the
   customer sync to send just that answer to Lightspeed. Nothing is ever sent for a blank. */
(function(){
"use strict";
const F={ email:"fldeT9x0wfNxLsk5D", emailAt:"fldxWnRI4tWuBRcjO", emailBy:"fldGm8zNVmBPsGCPh",
  sms:"fldxJEcE4LWe0p1H6", smsAt:"fld3DeqU6c2GBizyc", smsBy:"fld8RR1jHCFybzXt4",
  send:"fld6DC8isMLsBXRm9", lsEmail:"fldRXWXuWjO5DjvCN", lsTexts:"fldstXtAKoR0byNPO",
  sent:"fldGVrxiiWEysjpw5", sync:"fldvOfBOrkJ1EPGPS", lsId:"fld3r7r2XwkHQzGM6", lastSynced:"fld8YPvoGKMmtT9Om" };
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sel=v=>v&&typeof v==="object"?(v.name||""):(v||"");
const day=s=>{ if(!s) return ""; const d=new Date(s); return isNaN(d)?"":d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); };
const ST={}; // per customer: {busy:"email"|"sms", err, msg}
const css=`.mkp{margin-top:12px;padding:6px 10px;border:1px solid var(--line);border-radius:6px;background:var(--sunk);font-size:13px}
.mkp .mkr{display:flex;gap:4px 10px;align-items:center;flex-wrap:wrap;padding:4px 0;border-top:1px solid var(--line)}
.mkp .mkr:first-of-type{border-top:0}
.mkp .mkl{flex:1 1 200px;min-width:0;line-height:1.3}
.mkp .mkl .mkt{font-weight:700;margin-right:6px}
.mkp .mks{color:var(--muted);font-size:12.5px}
.mkp .mkb{display:flex;gap:4px;flex:none}
.mkp .mkb button{font:inherit;font-weight:700;font-size:12.5px;padding:3px 9px;border-radius:5px;border:1px solid var(--line2);background:var(--surface);color:var(--ink);cursor:pointer;min-height:28px;line-height:1.2}
.mkp .mkb button.on{background:var(--ok-soft);color:var(--ok);border-color:transparent}
.mkp .mkb button.off{background:var(--warn-soft);color:var(--warn);border-color:transparent}
.mkp .mkb button:disabled{opacity:.6;cursor:default}
.mkp .mkn{margin:2px 0 2px;font-size:12px}
.mkp .mkn.err{color:var(--warn)} .mkp .mkn.ok{color:var(--ok)}`;
const st=document.createElement("style"); st.textContent=css; document.head.appendChild(st);

function state(c,k){ const f=c.fields||{}; const ans=sel(f[k==="email"?F.email:F.sms]), at=f[k==="email"?F.emailAt:F.smsAt], by=f[k==="email"?F.emailBy:F.smsBy];
  const ls=!!f[k==="email"?F.lsEmail:F.lsTexts], t=x=>x?Date.parse(x)||0:0, sent=t(f[F.sent]), waiting=!!f[F.send]&&!!ans&&(t(at)?t(at)>sent:!sent);
  return {ans,at,by,ls,waiting,linked:!!f[F.lsId],synced:!!f[F.lastSynced]}; }
function row(c,k,label){ const s=state(c,k), S=ST[c.id]||{}, busy=S.busy===k;
  let now; if(s.waiting) now=`Sending “${esc(s.ans)}” to Lightspeed…`;
  else if(!s.linked) now="Not in Lightspeed yet";
  else now=`Lightspeed ${s.ls?"on":"off"}${s.synced?"":" (not synced yet)"}`;
  const last=s.ans?` · last answer <b>${esc(s.ans)}</b>${s.at?" "+esc(day(s.at)):""}${s.by?" by "+esc(s.by):""}`:" · never asked";
  const isOn=s.waiting?s.ans==="Yes":s.ls;
  return `<div class="mkr"><div class="mkl"><span class="mkt">${label}</span><span class="mks">${now}${last}</span></div>
    <div class="mkb" role="group" aria-label="${label}"><button title="Only when the customer tells you. Saved with today's date and your name." data-mk="${k}" data-mkv="Yes" class="${isOn?"on":""}" ${busy?"disabled":""} aria-pressed="${isOn}">${busy&&S.v==="Yes"?"Saving…":"On"}</button><button title="Only when the customer tells you. Saved with today's date and your name." data-mk="${k}" data-mkv="No" class="${!isOn&&(s.ans==="No"||s.linked)?"off":""}" ${busy?"disabled":""} aria-pressed="${!isOn}">${busy&&S.v==="No"?"Saving…":"Off"}</button></div></div>`; }
function html(c){ if(!c||!c.fields) return ""; const S=ST[c.id]||{};
  return `<div class="mkp" data-mkp="${esc(c.id)}">${row(c,"email","Marketing emails")}${row(c,"sms","Marketing texts")}
    ${S.err?`<div class="mkn err">${esc(S.err)}</div>`:S.msg?`<div class="mkn ok">${esc(S.msg)}</div>`:""}</div>`; }
/* opts: {who, patch(fields)->Promise<fields>, render(), after()} */
async function click(btn,c,opts){ const k=btn.dataset.mk, v=btn.dataset.mkv; if(!k||!c||!c.id) return false;
  const S=ST[c.id]=ST[c.id]||{};
  if(!opts.who){ S.err="Pick your name in Who's working (top right) first, so we know who changed it."; S.msg=""; opts.render(); return true; }
  const now=new Date().toISOString(), f={};
  if(k==="email"){ f[F.email]=v; f[F.emailAt]=now; f[F.emailBy]=opts.who; } else { f[F.sms]=v; f[F.smsAt]=now; f[F.smsBy]=opts.who; }
  f[F.send]=true; f[F.sync]=true;
  S.busy=k; S.v=v; S.err=""; S.msg=""; opts.render();
  try{ const out=await opts.patch(f); c.fields=Object.assign(c.fields||{}, out||f);
    S.msg=`Saved: ${k==="email"?"marketing emails":"marketing texts"} ${v==="Yes"?"on":"off"}. Sending to Lightspeed.`; }
  catch(e){ S.err="Didn't save: "+(e&&e.message||e); }
  S.busy=""; opts.render(); if(!S.err&&opts.after) opts.after(); return true; }
window.MKUI={ F, html, click, fields:[F.email,F.emailAt,F.emailBy,F.sms,F.smsAt,F.smsBy,F.send,F.lsEmail,F.lsTexts,F.lsId,F.lastSynced,F.sent,F.sync] };
})();
