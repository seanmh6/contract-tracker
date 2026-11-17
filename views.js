function iso(d){return d.toISOString().slice(0,10);}
function addDays(date,n){const d=new Date(date+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return iso(d);}
function prevMonthStart(date){const d=new Date(date+"T00:00:00Z");d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-1);return iso(d);}
function daysInMonth(date){const d=new Date(date+"T00:00:00Z");return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();}
function pretty(date){const d=new Date(date+"T00:00:00Z");return d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"});}
function defaultInvoices(){return [
  {id:1,date:"2026-09-01",status:"Paid",paid:"2026-09-01",notes:"ASD 11AUG"},
  {id:2,date:"2026-10-01",status:"Paid",paid:"2026-09-27",notes:""},
  {id:3,date:"2026-11-01",status:"Draft",paid:"",notes:""},
  {id:4,date:"2026-12-01",status:"Draft",paid:"",notes:""},
  {id:5,date:"2027-01-01",status:"Draft",paid:"",notes:""}
];}
function ensureInvoices(){if(!Array.isArray(state.invoices)||!state.invoices.length){state.invoices=defaultInvoices();save();}}
function invoiceRows(){
  const terms=+state.setup.terms||15, client=state.setup.client||"BT T2 LLC", ret=+state.setup.retainer||0;
  return state.invoices.map(inv=>{
    const periodStart=prevMonthStart(inv.date), periodEnd=addDays(inv.date,-1);
    const span=(Date.parse(inv.date+"T00:00:00Z")-Date.parse(periodStart+"T00:00:00Z"))/86400000;
    const retainer=Math.round(ret*span/daysInMonth(periodStart)*100)/100;
    const lines=state.expenses.filter(e=>e.reimb==="Yes"&&e.date>=periodStart&&e.date<inv.date);
    const reimb=Math.round(lines.reduce((s,e)=>s+(+e.amount||0),0)*100)/100;
    const due=addDays(inv.date,terms);
    const labor=state.labor.filter(r=>r.date>=periodStart&&r.date<=periodEnd);
    return {id:inv.id,date:inv.date,status:inv.status||"Draft",paid:inv.paid||"",notes:inv.notes||"",client,number:"INV-"+periodEnd.slice(0,7),periodStart,periodEnd,retainer,reimb,total:Math.round((retainer+reimb)*100)/100,due,cashYear:Number((inv.paid||due).slice(0,4)),lines,labor};
  }).sort((a,b)=>a.date.localeCompare(b.date));
}
function invoiceText(v){
  const costs=v.lines.length?v.lines.map(e=>"- "+e.date+"  "+e.vendor+"  "+money2(e.amount)+(e.desc?"  "+e.desc:"")).join("\n"):"- none";
  const work=v.labor.length?v.labor.map(r=>"- "+r.date+"  "+(r.hours||0)+"h  "+r.work).join("\n"):"- none";
  return [v.number+"  "+v.status,"Client: "+v.client,"Period: "+pretty(v.periodStart)+" – "+pretty(v.periodEnd),"Invoice date: "+v.date,"Due: "+v.due,"Retainer: "+money2(v.retainer),"Reimbursable expenses: "+money2(v.reimb),costs,"Invoice total: "+money2(v.total),"Cash-basis year: "+v.cashYear,"","Work logged this period:",work].join("\n");
}
function invoiceView(){
  const rows=invoiceRows();
  return `<section><h2>Monthly invoices</h2><p class="muted">Total is the retainer plus expenses marked reimbursable in that month. Copy one and hand it to Micra.</p>
  ${rows.map(v=>`<div class="metric"><span><b>${v.number}</b> · ${v.status}<div class="muted">${pretty(v.periodStart)} – ${pretty(v.periodEnd)}</div><div class="muted">Retainer ${money2(v.retainer)} + reimbursed ${money2(v.reimb)}</div></span><b>${money2(v.total)}</b></div>
  <div class="row" style="margin-bottom:12px"><button type="button" data-copy="${v.id}">Copy for Micra</button><button type="button" data-paid="${v.id}">${v.status==="Paid"?"Mark draft":"Mark paid"}</button></div>`).join("")}
  <button type="button" id="nextinv">Add next month</button>
  <p id="copied" class="muted"></p></section>`;
}
function exportJson(){
  const payload=Object.assign({},state,{invoiceReport:invoiceRows().map(v=>({number:v.number,status:v.status,client:v.client,periodStart:v.periodStart,periodEnd:v.periodEnd,invoiceDate:v.date,due:v.due,paid:v.paid,notes:v.notes,retainer:v.retainer,reimbursable:v.reimb,total:v.total,cashYear:v.cashYear,expenses:v.lines,labor:v.labor}))});
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="contract-tracker-"+new Date().toISOString().slice(0,10)+".json";
  a.click();
}
function askBackup(){if(confirm("Saved on this phone. Download a JSON backup now?")) exportJson();}
function trendView(){
  const rows=trend();
  if(!rows.length) return `<section><p>No hours yet, so there is no hourly trend.</p></section>`;
  const max=Math.max(...rows.map(r=>r.rate),1);
  return `<section><h2>Take-home $ / hour by month</h2><p class="muted">Retainer minus this year's expenses, mileage, and the total tax on the contract. This month counts only the days so far.</p>
  ${rows.map(r=>`<div class="metric"><span>${r.k}${r.partial?" · through the "+r.day:""}<div class="muted">${money2(r.home)} take-home</div></span><b>${r.h.toFixed(1)} h · ${money2(r.rate)}/h</b></div><div class="bar"><i style="width:${Math.max(4,r.rate/max*100)}%"></i></div>`).join("")}
  </section>`;
}
function costsView(){
  const today=new Date().toISOString().slice(0,10);
  const rows=[...state.expenses].sort((a,b)=>b.date.localeCompare(a.date));
  return `<form id="cost"><h2>Add expense</h2>
  <label>Date<input name="date" type="date" value="${today}" required></label>
  <label>Vendor<input name="vendor" required></label>
  <div class="row"><label>Category<select name="category">${CATS.map(c=>`<option>${c}</option>`).join("")}</select></label>
  <label>Amount<input name="amount" inputmode="decimal" required></label></div>
  <label>Description<input name="desc"></label>
  <label>Reimbursable<select name="reimb"><option value="No">No — deductible</option><option value="Yes">Yes — billed to client</option></select></label>
  <button class="wide" type="submit">Add expense</button></form>
  <section><h2>Expenses · ${rows.length}</h2>${rows.map(r=>`<div class="metric"><span>${esc(r.vendor)}<div class="muted">${r.date} · ${esc(r.category)}${r.reimb==="Yes"?" · reimbursed":""}</div></span><b>${money2(r.amount)}</b></div>`).join("")||`<p class="muted">None yet.</p>`}</section>`;
}
