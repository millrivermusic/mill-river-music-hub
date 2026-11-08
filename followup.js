/* MRM Hub: "Assign a task or message a teammate?" (11/7/2026)
   Shared by every hub app. After someone finishes something, the page calls
     mrmFollowUp({what:"Return saved", ref:{t:"customer",id:"rec…",label:"Jane Doe",url:"/t/customers/#rec…"}, dept:"Customer Success"})
   A small bar slides up at the bottom. It never blocks the page; ignore it and it goes away.
   Writes to Airtable Team Tasks / Team Messages through the hub (no key on the device). */
(function(){
  var BASE="appZD2jJGbSlvofcV", TT="tblOwTXbybJC6K9Xn", TM="tbl6wGPOAx0AkJwSU";
  var DEPTS=["Reverb","Repair","Shipping","Sales","Customer Success","Intake & Used","Vendor Relations","General"];
  var MDEPT={"Reverb":"Reverb dept","Repair":"Repair dept","Shipping":"Shipping dept"};
  var ICON={"reverb-msg":"💬 Reverb msg","reverb-offer":"🏷 Offer","reverb-order":"📦 Order","reverb-refund":"↩ Refund","item":"🎸 Item","customer":"👤 Customer","deal":"🤝 Deal","return":"↩ Return","warranty":"🛠 Warranty","task":"✅ Task"};
  function ls(k){ try{ return localStorage.getItem(k)||""; }catch(e){ return ""; } }
  function lsj(k,d){ try{ return JSON.parse(localStorage.getItem(k)||"null")||d; }catch(e){ return d; } }
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function staff(){ var s=lsj("mrm-staff",[]); return s.length?s:["Jon","Sam","Nina","Julia","Ethan","Kyle","Andy","Jeff","Chris","Sturgis","Mike"]; }
  function who(){ return ls("mrm-photos-who"); }
  function at(table,body){ return fetch("https://api.airtable.com/v0/"+BASE+"/"+table,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+(ls("mrm-photos-token")||"via-hub")},body:JSON.stringify(body)}).then(function(r){ return r.json().catch(function(){return {};}).then(function(j){ if(!r.ok) throw new Error((j.error&&(j.error.message||j.error.type))||("Airtable "+r.status)); return j; }); }); }
  function abs(u){ return !u?"":/^https?:/.test(u)?u:location.origin+u; }

  var css=".mfu{position:fixed;left:0;right:0;bottom:0;z-index:9999;padding:0 max(12px,env(safe-area-inset-left,0px)) calc(12px + env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-right,0px));pointer-events:none}"
   +".mfu .box{pointer-events:auto;max-width:640px;margin:0 auto;background:var(--surface,#fffbf4);color:var(--ink,#2b211a);border:1px solid var(--line2,#cdbfa8);border-top:3px solid var(--accent,#7a2e1f);border-radius:4px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:12px 14px;font:inherit;font-size:15px}"
   +".mfu .hd{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.mfu .hd b{flex:1;min-width:180px}"
   +".mfu button{font:inherit;font-size:14px;font-weight:600;border-radius:3px;padding:7px 12px;cursor:pointer;border:1px solid var(--line2,#cdbfa8);background:transparent;color:inherit}"
   +".mfu button.pr{background:var(--accent,#7a2e1f);border-color:var(--accent,#7a2e1f);color:var(--accent-ink,#fff7ee)}"
   +".mfu .x{border:0;font-size:18px;padding:2px 8px;color:var(--muted,#7a6a5c)}"
   +".mfu .ref{font-size:12.5px;color:var(--muted,#7a6a5c);margin-top:2px}"
   +".mfu .f{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.mfu .f .w{grid-column:1/-1}"
   +".mfu label{display:flex;flex-direction:column;gap:3px;font-size:12.5px;font-weight:600;color:var(--muted,#7a6a5c)}"
   +".mfu input,.mfu select,.mfu textarea{font:inherit;font-size:15px;color:var(--ink,#2b211a);background:var(--sunk,#faf4ea);border:1px solid var(--line,#e6dccb);border-radius:3px;padding:8px;min-width:0}"
   +".mfu .ft{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}.mfu .msg{font-size:13.5px}"
   +"@media(max-width:520px){.mfu .f{grid-template-columns:1fr}}";
  var st=document.createElement("style"); st.textContent=css; (document.head||document.documentElement).appendChild(st);

  var el=null, CTX=null, MODE="", TIMER=null;
  function close(){ if(el){ el.remove(); el=null; } CTX=null; MODE=""; clearTimeout(TIMER); }
  function opts(list,sel,blank){ return (blank!=null?'<option value="">'+esc(blank)+'</option>':"")+list.map(function(x){ return '<option'+(x===sel?" selected":"")+'>'+esc(x)+'</option>'; }).join(""); }
  function render(){
    if(!el){ el=document.createElement("div"); el.className="mfu"; el.setAttribute("role","dialog"); el.setAttribute("aria-label","Follow up"); document.body.appendChild(el); }
    var c=CTX, ref=c.ref, refLine=ref?'<div class="ref">About: '+esc(ICON[ref.t]||"🔗")+": "+esc(String(ref.label||"").slice(0,70))+'</div>':"";
    var h='<div class="box"><div class="hd"><b>'+esc(c.what||"Done.")+' Assign a task or message a teammate?</b>';
    if(!MODE) h+='<button class="pr" data-mfu="task" type="button">Assign a task</button><button data-mfu="msg" type="button">Message</button>';
    h+='<button class="x" data-mfu="close" type="button" aria-label="No thanks">×</button></div>'+refLine;
    if(MODE==="task"){ var lbl=ref&&ref.label?ref.label:"";
      h+='<div class="f"><label class="w">Task<input id="mfuT" value="'+esc(c.task||(lbl?"Follow up: "+lbl:""))+'"></label>'
        +'<label>For<select id="mfuTo">'+opts(staff(),"","Anyone in the department")+'</select></label>'
        +'<label>Department<select id="mfuD">'+opts(DEPTS,c.dept||"General")+'</select></label>'
        +'<label>Due (optional)<input type="date" id="mfuDue"></label>'
        +'<label class="w">Details (optional)<textarea id="mfuDet" rows="2">'+esc(c.details||"")+'</textarea></label></div>'
        +'<div class="ft"><button class="pr" data-mfu="savetask" type="button">Add task</button><button data-mfu="close" type="button">Cancel</button><span class="msg" id="mfuMsg"></span></div>';
    }
    if(MODE==="msg"){ var tos=["Everyone"].concat(Object.keys(MDEPT).map(function(k){return MDEPT[k];}),staff().filter(function(n){return n!==who();}));
      h+='<div class="f"><label class="w">To<select id="mfuTo">'+opts(tos,c.to||"")+'</select></label>'
        +'<label class="w">Message<textarea id="mfuM" rows="3">'+esc(c.message||"")+'</textarea></label></div>'
        +'<div class="ft"><button class="pr" data-mfu="savemsg" type="button">Send to the team</button><button data-mfu="close" type="button">Cancel</button><span class="msg" id="mfuMsg"></span></div>';
    }
    el.innerHTML=h+'</div>';
    var f=el.querySelector("#mfuT")||el.querySelector("#mfuM"); if(f) setTimeout(function(){ try{ f.focus(); }catch(e){} },30);
  }
  function say(t,bad){ var m=el&&el.querySelector("#mfuMsg"); if(m){ m.textContent=t; m.style.color=bad?"var(--warn,#9e2a1e)":"var(--ok,#2f6b3a)"; } }
  function done(t){ MODE="sent"; el.querySelector(".box").innerHTML='<div class="hd"><b>'+esc(t)+'</b><button class="x" data-mfu="close" type="button" aria-label="Close">×</button></div>'; TIMER=setTimeout(close,3500); }
  document.addEventListener("click",function(e){ var b=e.target.closest&&e.target.closest("[data-mfu]"); if(!b||!el||!el.contains(b)) return; var a=b.dataset.mfu;
    if(a==="close"){ close(); return; }
    if(a==="task"||a==="msg"){ clearTimeout(TIMER); MODE=a; render(); return; }
    var W=who(); if(!W){ say("Pick your name at the top first.",true); return; }
    var refs=CTX.ref?[CTX.ref]:[];
    if(a==="savetask"){ var t=el.querySelector("#mfuT").value.trim(); if(!t){ say("Write what needs doing.",true); return; }
      var to=el.querySelector("#mfuTo").value, f={Task:t,Department:el.querySelector("#mfuD").value,Status:"To do",Details:el.querySelector("#mfuDet").value.trim(),Source:CTX.what||"Hub",["Made By"]:W};
      if(to) f["Assigned To"]=to; var due=el.querySelector("#mfuDue").value; if(due) f.Due=due; if(refs.length){ f.Refs=JSON.stringify(refs); if(refs[0].url) f.Link=abs(refs[0].url); }
      b.disabled=true; say("Adding…"); at(TT,{records:[{fields:f}],typecast:true}).then(function(){ done("Added to "+(to?to+"'s":f.Department+"'s")+" list."); }).catch(function(err){ b.disabled=false; say(err.message,true); }); return; }
    if(a==="savemsg"){ var m=el.querySelector("#mfuM").value.trim(); if(!m){ say("Write the message.",true); return; }
      var to2=el.querySelector("#mfuTo").value, g={Message:m,From:W,To:to2,["Read By"]:[W]}; if(refs.length) g.Refs=JSON.stringify(refs);
      b.disabled=true; say("Sending…"); at(TM,{records:[{fields:g}],typecast:true}).then(function(){ done("Sent to "+to2+". It shows on the Team Board."); }).catch(function(err){ b.disabled=false; say(err.message,true); }); return; }
  });
  document.addEventListener("keydown",function(e){ if(e.key==="Escape"&&el) close(); });
  window.mrmFollowUp=function(ctx){ CTX=ctx||{}; MODE=""; render(); clearTimeout(TIMER); TIMER=setTimeout(function(){ if(!MODE) close(); },20000); };
})();
