const KEY="contractTracker_phone";
const CATS=["Supplies","Maintenance","Travel","Office","Professional Fees","Other"];
const empty=()=>({revision:"phone-2",labor:[],expenses:[],setup:{retainer:0,start:"2026-08-11",mileRate:0.76,withhold:0,priorTax:0,kids:0,gsWages:0,guardWages:0,va:0,autoBackup:false}});
let state=load();
let tab="dash";
function load(){try{const raw=localStorage.getItem(KEY);if(!raw)return empty();const p=JSON.parse(raw);if(!Array.isArray(p.labor)||!Array.isArray(p.expenses))return empty();return Object.assign(empty(),p,{setup:Object.assign(empty().setup,p.setup)});}catch(e){return empty();}}
function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function money(n){return Number(n||0).toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0});}
function money2(n){return Number(n||0).toLocaleString("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2});}
function rate(date){return date<"2026-07-01"?0.725:Number(state.setup.mileRate)||0.76}
function snap(){
  const s=state.setup, year=Number(String(s.start).slice(0,4))||2026;
  const start=Date.parse(s.start+"T00:00:00Z");
  const yearEnd=Date.UTC(year,11,31);
  const now=new Date();
  const asOf=Math.min(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()),yearEnd);
  const labor=state.labor.filter(r=>String(r.date).startsWith(String(year)));
  const hours=labor.reduce((a,r)=>a+(+r.hours||0),0);
  const miles=labor.reduce((a,r)=>a+(+r.miles||0)*rate(r.date),0);
  const exp=state.expenses.filter(r=>String(r.date).startsWith(String(year))&&r.reimb!=="Yes").reduce((a,r)=>a+(+r.amount||0),0);
  const months=Math.max(0,12-new Date(start).getUTCMonth());
  const accrued=(+s.retainer||0)*months;
  const cash=(+s.retainer||0)*Math.max(0,months-1);
  const span=Math.max(1,(yearEnd-start)/86400000+1);
  const elapsed=Math.max(1,(asOf-start)/86400000+1);
  const est=hours>0?(hours/elapsed)*span:0;
  const net=cash-exp-miles;
  const seEarn=Math.max(0,net)*0.9235;
  const w2=(+s.gsWages||0)+(+s.guardWages||0);
  const ssRoom=Math.max(0,184500-w2);
  const seTax=Math.min(seEarn,ssRoom)*0.124+seEarn*0.029+Math.max(0,w2+seEarn-250000)*0.009;
  const half=seTax/2;
  const taxable=Math.max(0,Math.max(0,w2+net-half-32200)-Math.max(0,net-half)*0.2);
  let income=0;
  if(taxable>24800) income=taxable<=100800?2480+(taxable-24800)*0.12:2480+9120+(taxable-100800)*0.22;
  else income=taxable*0.1;
  const incomeAfter=Math.max(0,income-(+s.kids||0)*2200);
  const total=incomeAfter+seTax;
  const extra=Math.max(0,Math.min(total,+s.priorTax||0)-(+s.withhold||0));
  const fica=w2*0.0765;
  const gross=cash+w2+(+s.va||0);
  return {hours,est,cash,accrued,exp,miles,net,seTax,incomeAfter,total,extra,gross,take:gross-exp-miles-fica-total,fica,perHour:est?accrued/est:0,after:est?(accrued-exp-miles)/est:0,week:est/(span/7)};
}
function trend(){
  const m={};
  state.labor.forEach(r=>{const k=String(r.date).slice(0,7);m[k]=(m[k]||0)+(+r.hours||0);});
  const ret=+state.setup.retainer||0;
  return Object.keys(m).sort().map(k=>({k,h:m[k],rate:m[k]?ret/m[k]:0}));
}
function metric(label,value){return `<div class="metric"><span>${label}</span><b>${value}</b></div>`;}
function render(){
  const latest=state.labor.reduce((m,r)=>r.date>m?r.date:m,"");
  document.getElementById("status").textContent=state.labor.length?("Latest "+latest+" \u00b7 "+state.labor.length+" labor"):"No entries yet";
  const tabs=[["dash","Dash"],["add","Add"],["log","Log"],["trend","Trend"],["costs","Costs"],["tax","Tax"],["file","File"]];
  document.getElementById("nav").innerHTML=tabs.map(([id,label])=>`<button type="button" data-tab="${id}" class="${tab===id?"on":""}">${label}</button>`).join("");
  document.getElementById("nav").onclick=e=>{const b=e.target.closest("button");if(!b)return;tab=b.dataset.tab;render();};
  const view=document.getElementById("view");
  const pages={dash:dash,add:addForm,log:logTable,trend:trendView,costs:costsView,tax:taxView,file:fileView};
  view.innerHTML=pages[tab]();
  bind();
}
function dash(){
  const v=snap();
  const emptyNote=state.labor.length?"":`<p class="muted">Import the JSON on File to load the workbook. Until then these stay at zero.</p>`;
  return `<section><h2>This year</h2>${emptyNote}
  ${metric("Hours logged",v.hours.toFixed(1))}
  ${metric("Est. hours by year-end",v.est.toFixed(1))}
  ${metric("Est. hours / week",v.week.toFixed(1))}
  ${metric("Gross $ / hour",v.est?money2(v.perHour):"\u2014")}
  ${metric("After costs $ / hour",v.est?money2(v.after):"\u2014")}
  ${metric("Cash contract",money(v.cash))}
  ${metric("Gross income",money(v.gross))}
  ${metric("Est. take-home",money(v.take))}
  ${metric("Federal tax",money2(v.total))}
  ${metric("Extra estimates",money(v.extra))}
  </section>`;
}
function addForm(){
  const today=new Date().toISOString().slice(0,10);
  return `<form id="labor"><h2>Add labor</h2>
  <label>Date<input name="date" type="date" value="${today}" required></label>
  <label>Work<textarea name="work" required placeholder="What you did"></textarea></label>
  <div class="row"><label>Hours<input name="hours" inputmode="decimal" placeholder="0.0"></label>
  <label>Miles<input name="miles" inputmode="decimal" placeholder="0"></label></div>
  <div class="row"><label>Start<input name="start"></label><label>End<input name="end"></label></div>
  <p class="err" id="err"></p>
  <button class="wide" type="submit">Add entry</button></form>`;
}
function logTable(){
  const rows=[...state.labor].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
  if(!rows.length) return `<section><p>No labor yet. Import the JSON on File, or add a row.</p></section>`;
  return `<section><h2>All labor \u00b7 ${rows.length}</h2><table>${rows.map(r=>`<tr><td>${r.date.slice(5)}</td><td>${esc(r.work)}<div class="muted">${esc(r.start||"")}${r.end?" \u2192 "+esc(r.end):""}</div></td><td>${r.hours||""}</td></tr>`).join("")}</table></section>`;
}
