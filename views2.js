function nextEstimate(v){
  const year=Number(String(state.setup.start).slice(0,4))||2026;
  const marks=[[year,4,15,0.25],[year,6,15,0.5],[year,9,15,0.75],[year+1,1,15,1]];
  const today=todayIso();
  let pick=marks.find(m=>{
    const d=m[0]+"-"+String(m[1]).padStart(2,"0")+"-"+String(m[2]).padStart(2,"0");
    return d>=today;
  })||[year+1,4,15,0.25];
  const when=new Date(pick[0],pick[1]-1,pick[2]);
  const wd=when.getDay();
  if(wd===6) when.setDate(when.getDate()+2);
  if(wd===0) when.setDate(when.getDate()+1);
  const iso=when.getFullYear()+"-"+String(when.getMonth()+1).padStart(2,"0")+"-"+String(when.getDate()).padStart(2,"0");
  const label=when.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
  const amount=Math.max(0,v.extra)*pick[3];
  return {iso,label,amount};
}
function taxView(){
  const v=snap();
  const q=nextEstimate(v);
  const known=(+state.setup.priorTax||0)>0;
  const kids=+state.setup.kids||0;
  const onContract=Math.max(0,v.contractTax-v.seTax);
  const pay=known?(q.amount<=0?"Nothing extra is due. Tax already taken from the W-2 paycheck covers the minimum.":"This is what is still short if no estimate has been sent yet."):"Enter last year's tax on File before trusting this minimum.";
  return `<section><h2>The contract</h2>
  ${metric("Expenses deducted",money2(v.exp))}
  ${metric("Mileage deducted",money2(v.miles))}
  ${metric("Profit left",money(v.net))}
  ${metric("Social Security",money2(v.ssTax))}
  ${metric("Medicare",money2(v.medTax))}
  ${metric("Income tax",money(onContract))}
  ${metric("Total tax on the contract",money(v.contractTax))}
  ${metric("Rate on that profit",v.net>0?(v.contractRate*100).toFixed(1)+"%":"—")}
  <p class="muted">Social Security, Medicare, and income tax are the only taxes on the contract. The total is those three added together. Do not add it on again.${v.addlMed>1?" Medicare includes the extra tax once combined income passes $250,000.":""}</p></section>
  <section><h2>The whole return</h2>
  ${metric("Income tax after the child credit",money2(v.incomeAfter))}
  ${metric("Total federal tax",money2(v.total))}
  ${metric("W-2 Social Security and Medicare",money(v.fica))}
  <p class="muted">The child credit is $2,200 for each of ${kids} kids, and it only lowers income tax. Total federal tax is that income tax plus the contract's Social Security and Medicare. The W-2 line was already taken out of the paycheck and is not part of the total.</p></section>
  <section><h2>Quarterly payment</h2>
  ${metric("Next due",q.label)}
  ${metric("Minimum to pay",known?money(q.amount):"—")}
  <p class="muted">${pay} December's retainer is next year's income. VA pay is not taxed. This is a planning estimate.</p></section>`;
}
function fileView(){
  const s=state.setup;
  const field=(name,label,step)=>`<label>${label}<input name="${name}" type="number" step="${step||"1"}" value="${s[name]||0}"></label>`;
  return `<section><h2>Import the workbook</h2><p class="muted">Choose the tracker JSON from Files. This replaces what is on this phone. It does not read the Excel file.</p>
  <label class="btn">Choose JSON<input id="file" type="file" accept="application/json,.json" hidden></label>
  <p id="msg"></p>
  <button type="button" id="export">Export JSON</button></section>
  <form id="setup"><h2>Assumptions</h2><p class="muted">Filled in when you import. Change them here if a number is wrong.</p>
  ${field("retainer","Monthly retainer")}
  <label>Contract start<input name="start" type="date" value="${s.start||"2026-08-11"}"></label>
  ${field("mileRate","Mileage rate, Jul–Dec","0.001")}
  ${field("withhold","Expected W-2 withholding")}
  ${field("priorTax","Prior-year tax")}
  ${field("kids","Children for the credit")}
  ${field("gsWages","GS wages","0.01")}
  ${field("guardWages","Guard wages","0.01")}
  ${field("va","VA compensation","0.01")}
  <label>Client<input name="client" value="${esc(s.client||"")}"></label>
  ${field("terms","Payment terms, days")}
  <button class="wide" type="submit">Save assumptions</button></form>`;
}
function esc(s){return String(s||"").replace(/[&<>"]/g,function(c){if(c==="&")return "&"+"amp;";if(c==="<")return "&"+"lt;";if(c===">")return "&"+"gt;";return "&"+"quot;";});}
function bind(){
  const form=document.getElementById("labor");
  if(form) form.onsubmit=e=>{
    e.preventDefault();
    const f=new FormData(form);
    const work=String(f.get("work")||"").trim();
    const date=String(f.get("date")||"");
    if(!date||!work){document.getElementById("err").textContent="Date and work are required.";return;}
    const row={date,work,hours:+f.get("hours")||0,miles:+f.get("miles")||0,start:String(f.get("start")||"").trim(),end:String(f.get("end")||"").trim()};
    if(editing!=null){
      const cur=state.labor.find(r=>String(r.id)===String(editing));
      if(cur) Object.assign(cur,row);
      editing=null;
    }else state.labor.unshift(Object.assign({id:Date.now()},row));
    save(); askBackup(); tab="log"; render();
  };
  const drop=document.getElementById("drop");
  if(drop) drop.onclick=()=>{
    state.labor=state.labor.filter(r=>String(r.id)!==String(editing));
    editing=null; save(); askBackup(); tab="log"; render();
  };
  document.querySelectorAll("[data-edit]").forEach(btn=>btn.onclick=()=>{editing=btn.dataset.edit;tab="add";render();});
  const cost=document.getElementById("cost");
  if(cost) cost.onsubmit=e=>{
    e.preventDefault();
    const f=new FormData(cost);
    if(!f.get("vendor")||!+f.get("amount")) return;
    state.expenses.unshift({id:Date.now(),date:String(f.get("date")),vendor:String(f.get("vendor")).trim(),category:String(f.get("category")),desc:String(f.get("desc")||"").trim(),amount:+f.get("amount"),reimb:String(f.get("reimb"))});
    save(); askBackup(); render();
  };
  const setup=document.getElementById("setup");
  if(setup) setup.onsubmit=e=>{
    e.preventDefault();
    const f=new FormData(setup);
    ["retainer","mileRate","withhold","priorTax","kids","gsWages","guardWages","va","terms"].forEach(k=>{state.setup[k]=+f.get(k)||0;});
    state.setup.client=String(f.get("client")||"").trim();
    state.setup.start=String(f.get("start")||state.setup.start);
    save(); tab="dash"; render();
  };
  const file=document.getElementById("file");
  if(file) file.onchange=()=>{
    const chosen=file.files&&file.files[0]; if(!chosen) return;
    chosen.text().then(text=>{
      try{
        const p=JSON.parse(text);
        if(!Array.isArray(p.labor)||!Array.isArray(p.expenses)) throw new Error("bad");
        state=Object.assign(empty(),p,{revision:"phone-3",invoices:Array.isArray(p.invoices)?p.invoices:[],setup:Object.assign(empty().setup,p.setup||{})});
        save(); tab="dash"; render();
      }catch(err){document.getElementById("msg").textContent="That file is not a tracker JSON.";}
    });
  };
  const exp=document.getElementById("export");
  if(exp) exp.onclick=exportJson;
  const copied=document.getElementById("copied");
  document.querySelectorAll("[data-copy]").forEach(btn=>btn.onclick=()=>{
    const v=invoiceRows().find(r=>String(r.id)===btn.dataset.copy);
    const text=invoiceText(v);
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(()=>{copied.textContent="Copied "+v.number+". Paste it to Micra.";});
    else {copied.textContent=text;}
  });
  document.querySelectorAll("[data-paid]").forEach(btn=>btn.onclick=()=>{
    const inv=state.invoices.find(r=>String(r.id)===btn.dataset.paid);
    if(!inv) return;
    if(inv.status==="Paid"){inv.status="Draft";inv.paid="";}
    else {inv.status="Paid";inv.paid=todayIso();}
    save(); render();
  });
  const next=document.getElementById("nextinv");
  if(next) next.onclick=()=>{
    const last=invoiceRows().slice(-1)[0];
    const d=new Date((last?last.date:"2026-09-01")+"T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth()+1);
    state.invoices.push({id:Date.now(),date:iso(d),status:"Draft",paid:"",notes:""});
    save(); render();
  };
}
render();
