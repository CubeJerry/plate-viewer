"use strict";
const CFG=window.PLATE_VIEWER_CONFIG,API=CFG.apiBaseUrl.replace(/\/$/,"");
const ROWS=["A","B","C","D","E","F","G","H"],COLS=Array.from({length:12},(_,i)=>String(i+1));
const state={draft:null,plate:null,completed:new Set(),mode:matchMedia("(max-width:680px)").matches?"touch":"plate",hide:false};
const el={};let toastTimer,wakeLock=null;
document.addEventListener("DOMContentLoaded",init);
function init(){
  const ids=["apiStatus","creatorView","viewerView","plateTitle","platePaste","clipboardButton","pasteSummary","parseButton","clearButton","showRowHeaders","showColumnHeaders","rowHeaders","columnHeaders","expiryDays","activePreviewCount","previewEmpty","previewScroll","platePreview","createHint","createButton","sharePanel","plateLink","copyLinkButton","shareLinkButton","qrCode","viewerLoading","viewerError","viewerErrorTitle","viewerErrorMessage","viewerContent","viewerPlateId","viewerPlateTitle","offlineStatus","completedCount","activeCount","progressFill","touchModeButton","plateModeButton","hideCompleted","wakeLockButton","viewerCopyButton","resetProgressButton","touchChecklist","plateChecklistWrap","plateChecklist","completionPanel","toast"];
  ids.forEach(id=>el[id]=document.getElementById(id));wire();registerSW();ping();
  const plateId=new URLSearchParams(location.search).get("plate");plateId?openViewer(plateId.trim().toUpperCase()):openCreator();
}
function wire(){
  el.parseButton.onclick=()=>parseDraft();el.clearButton.onclick=clearDraft;el.clipboardButton.onclick=pasteClipboard;el.createButton.onclick=createPlate;
  el.copyLinkButton.onclick=()=>copy(el.plateLink.href,"Plate link copied.");el.shareLinkButton.onclick=shareLink;
  [el.showRowHeaders,el.showColumnHeaders,el.rowHeaders,el.columnHeaders].forEach(n=>n.onchange=refreshHeaders);
  el.platePaste.oninput=debounce(()=>{saveDraft();describePaste();},150);el.plateTitle.oninput=debounce(saveDraft,150);el.expiryDays.onchange=saveDraft;
  el.touchModeButton.onclick=()=>setMode("touch");el.plateModeButton.onclick=()=>setMode("plate");
  el.hideCompleted.onchange=()=>{
    state.hide=el.hideCompleted.checked;
    renderViewer();
  };
  
  if (el.wakeLockButton) {
    el.wakeLockButton.onclick = toggleWakeLock;
  
    if (!("wakeLock" in navigator)) {
      el.wakeLockButton.hidden = true;
    }
  }
  
  el.viewerCopyButton.onclick=()=>copy(location.href,"Plate link copied.");
}
function openCreator(){el.creatorView.hidden=false;el.viewerView.hidden=true;restoreDraft();if(el.platePaste.value.trim())parseDraft(true);}
async function openViewer(id){
  el.creatorView.hidden=true;el.viewerView.hidden=false;
  if(!/^[A-Z0-9]{8,14}$/.test(id))return showViewerError("Invalid plate link","The plate identifier in this link is not valid.");
  try{const loaded=await fetchPlate(id);state.plate=loaded.plate;state.completed=loadTicks(id,state.plate.cells);el.offlineStatus.textContent=loaded.offline?"Offline copy loaded. Ticks still work and stay on this phone.":"Live plate loaded. Tick progress is stored only on this device.";el.offlineStatus.className=`helper ${loaded.offline?"warning":"success"}`;el.viewerPlateId.textContent=`PLATE ID // ${state.plate.id}`;el.viewerPlateTitle.textContent=state.plate.title||"96-well plate";setMode(localStorage.getItem("plate-viewer:mode")||state.mode,false);renderViewer();el.viewerLoading.hidden=true;el.viewerContent.hidden=false;document.title=`${state.plate.title||"Plate"} · Plate Viewer`;}
  catch(err){showViewerError("Plate unavailable",friendly(err));}
}
async function fetchPlate(id){
  const key=`plate-viewer:plate:${id}`;
  try{const r=await fetch(`${API}/api/plates/${encodeURIComponent(id)}`,{headers:{Accept:"application/json"},cache:"no-store"}),data=await safeJson(r);if(!r.ok){const e=new Error(data?.error||`Plate request failed (${r.status}).`);e.status=r.status;throw e;}validatePlate(data);localStorage.setItem(key,JSON.stringify(data));return{plate:data,offline:false};}
  catch(err){const cached=localStorage.getItem(key);if(cached&&(!err.status||err.status>=500)){const data=JSON.parse(cached);validatePlate(data);return{plate:data,offline:true};}throw err;}
}
function renderViewer(){renderTouch();renderSpatial();updateProgress();}
function renderTouch(){
  const frag=document.createDocumentFragment();el.touchChecklist.replaceChildren();
  state.plate.cells.forEach((value,index)=>{if(!value)return;const coord=coordinate(index),done=state.completed.has(coord),b=document.createElement("button");b.type="button";b.className=`touch-well${done?" completed":""}${state.hide&&done?" filtered":""}`;b.style.setProperty("--well-accent",accent(value));b.setAttribute("aria-pressed",String(done));b.setAttribute("aria-label",`${coord}, ${value}, ${done?"completed":"not completed"}`);b.innerHTML=`<span class="touch-coordinate">${esc(coord)}</span><span class="touch-state">${done?"COMPLETE":"TAP TO TICK"}</span><span class="touch-value">${esc(value)}</span>`;b.onclick=()=>toggle(coord);frag.appendChild(b);});
  if(!frag.childNodes.length){const p=document.createElement("p");p.className="helper";p.textContent=state.hide?"All completed wells are hidden.":"No active wells.";frag.appendChild(p);}el.touchChecklist.appendChild(frag);
}
function renderSpatial(){
  const frag=document.createDocumentFragment();el.plateChecklist.replaceChildren();addHeaders(frag,state.plate);
  for(let r=0;r<8;r++){const rh=document.createElement("div");rh.className="plate-head";rh.textContent=state.plate.showRowHeaders===false?"":state.plate.rowHeaders[r];frag.appendChild(rh);for(let c=0;c<12;c++){const i=r*12+c,value=state.plate.cells[i],coord=coordinate(i),done=state.completed.has(coord),cell=document.createElement("div");cell.className=`plate-well ${value?"active":"inactive"}${done?" completed":""}${state.hide&&done?" filtered":""}`;cell.style.setProperty("--well-accent",accent(value));if(value){const b=document.createElement("button");b.type="button";b.className="well-button";b.setAttribute("aria-pressed",String(done));b.innerHTML=`<span class="coord">${esc(coord)}</span><span class="value">${esc(value)}</span>`;b.onclick=()=>toggle(coord);cell.appendChild(b);}else cell.innerHTML=`<span class="coord">${coord}</span>`;frag.appendChild(cell);}}el.plateChecklist.appendChild(frag);
}
function toggle(coord){state.completed.has(coord)?state.completed.delete(coord):state.completed.add(coord);saveTicks();renderViewer();if(navigator.vibrate)navigator.vibrate(16);}
function saveTicks(){localStorage.setItem(`plate-viewer:ticks:${state.plate.id}`,JSON.stringify([...state.completed]));}
function loadTicks(id,cells){state.mode=localStorage.getItem("plate-viewer:mode")||state.mode;try{const active=new Set(cells.map((v,i)=>v?coordinate(i):null).filter(Boolean));return new Set(JSON.parse(localStorage.getItem(`plate-viewer:ticks:${id}`)||"[]").filter(x=>active.has(x)));}catch{return new Set();}}
function resetTicks(){if(!confirm("Untick every completed well on this phone?"))return;state.completed.clear();saveTicks();renderViewer();toast("All ticks cleared.");}
function updateProgress(){const active=state.plate.cells.map((v,i)=>v?coordinate(i):null).filter(Boolean),done=active.filter(x=>state.completed.has(x)).length,total=active.length;el.completedCount.textContent=done;el.activeCount.textContent=total;el.progressFill.style.width=`${total?Math.round(done/total*100):0}%`;el.completionPanel.hidden=!total||done!==total;}
function setMode(mode,persist=true){state.mode=mode==="plate"?"plate":"touch";el.touchChecklist.hidden=state.mode!=="touch";el.plateChecklistWrap.hidden=state.mode!=="plate";el.touchModeButton.classList.toggle("active",state.mode==="touch");el.plateModeButton.classList.toggle("active",state.mode==="plate");el.touchModeButton.setAttribute("aria-pressed",String(state.mode==="touch"));el.plateModeButton.setAttribute("aria-pressed",String(state.mode==="plate"));if(persist)localStorage.setItem("plate-viewer:mode",state.mode);}
function parseDraft(silent=false){
  try{const matrix=parseExcel(el.platePaste.value),headers=readHeaders(),cells=pad(matrix),active=cells.filter(Boolean).length,dims=dimensions(matrix);state.draft={title:clean(el.plateTitle.value,80)||"96-well plate",cells,rowHeaders:headers.rows,columnHeaders:headers.cols,showRowHeaders:el.showRowHeaders.checked,showColumnHeaders:el.showColumnHeaders.checked,expiresInDays:Number(el.expiryDays.value)};renderPreview();el.createButton.disabled=!active;el.createHint.textContent=active?`${active} active wells ready. Blank wells will be inactive.`:"At least one non-empty well is required.";el.createHint.className=`helper ${active?"success":"warning"}`;const exact=dims.rows===8&&dims.min===12&&dims.max===12;el.pasteSummary.textContent=`${dims.rows} row${dims.rows===1?"":"s"}; ${dims.min===dims.max?dims.max:`${dims.min}–${dims.max}`} columns. ${exact?"Exact 8 × 12 plate.":"Missing cells were padded."}`;el.pasteSummary.className=`helper ${exact?"success":"warning"}`;saveDraft();if(!silent)toast("Plate loaded into preview.");}
  catch(err){state.draft=null;el.createButton.disabled=true;el.pasteSummary.textContent=err.message;el.pasteSummary.className="helper error-text";if(!silent)toast(err.message,true);}
}
function parseExcel(raw){if(!raw.trim())throw new Error("Paste an Excel plate range first.");let lines=raw.replace(/\r\n?/g,"\n").split("\n");while(lines.length&&lines.at(-1)==="")lines.pop();if(lines.length>8)throw new Error(`Detected ${lines.length} rows. Paste no more than 8.`);return lines.map((line,r)=>{const cells=line.split("\t");if(cells.length>12)throw new Error(`Row ${r+1} has ${cells.length} columns. Paste no more than 12.`);return cells.map(v=>clean(String(v).replace(/^"|"$/g,""),120));});}
function pad(matrix){const out=Array(96).fill("");matrix.slice(0,8).forEach((row,r)=>row.slice(0,12).forEach((v,c)=>out[r*12+c]=v));return out;}
function dimensions(matrix){const n=matrix.map(r=>r.length);return{rows:matrix.length,min:n.length?Math.min(...n):0,max:n.length?Math.max(...n):0};}
function readHeaders(){return{rows:headerList(el.rowHeaders.value,8,ROWS,"row"),cols:headerList(el.columnHeaders.value,12,COLS,"column")};}
function headerList(raw,n,fallback,label){const v=raw.split(/[\t,\n]+/).map(x=>clean(x,20)).filter(Boolean);if(!v.length)return[...fallback];if(v.length!==n)throw new Error(`Custom ${label} headers require exactly ${n} labels.`);return v;}
function refreshHeaders(){if(!state.draft)return saveDraft();try{const h=readHeaders();Object.assign(state.draft,{rowHeaders:h.rows,columnHeaders:h.cols,showRowHeaders:el.showRowHeaders.checked,showColumnHeaders:el.showColumnHeaders.checked});renderPreview();saveDraft();}catch(err){toast(err.message,true);}}
function renderPreview(){
  if(!state.draft){el.previewEmpty.hidden=false;el.previewScroll.hidden=true;el.activePreviewCount.textContent="0";return;}
  const frag=document.createDocumentFragment();addHeaders(frag,state.draft);for(let r=0;r<8;r++){const rh=document.createElement("div");rh.className="plate-head";rh.textContent=state.draft.showRowHeaders?state.draft.rowHeaders[r]:"";frag.appendChild(rh);for(let c=0;c<12;c++){const i=r*12+c,v=state.draft.cells[i],cell=document.createElement("div");cell.className=`plate-well ${v?"active":"inactive"}`;cell.style.setProperty("--well-accent",accent(v));cell.innerHTML=`<span class="coord">${coordinate(i)}</span><span class="value">${esc(v)}</span>`;frag.appendChild(cell);}}el.platePreview.replaceChildren(frag);el.previewEmpty.hidden=true;el.previewScroll.hidden=false;el.activePreviewCount.textContent=state.draft.cells.filter(Boolean).length;
}
function addHeaders(frag,plate){const corner=document.createElement("div");corner.className="plate-corner";corner.textContent=plate.showRowHeaders===false&&plate.showColumnHeaders===false?"":"↘";frag.appendChild(corner);for(let c=0;c<12;c++){const h=document.createElement("div");h.className="plate-head";h.textContent=plate.showColumnHeaders===false?"":plate.columnHeaders[c];frag.appendChild(h);}}
async function createPlate(){
  if(!state.draft)return;el.createButton.disabled=true;el.createButton.textContent="Transmitting…";
  try{const r=await fetch(`${API}/api/plates`,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(state.draft)}),data=await safeJson(r);if(!r.ok)throw new Error(data?.error||`Could not create plate (${r.status}).`);const url=new URL(location.href);url.search="";url.hash="";url.searchParams.set("plate",data.id);showShare(url.toString());toast("Phone checklist created.");}
  catch(err){toast(friendly(err),true);}finally{el.createButton.disabled=false;el.createButton.textContent="Create phone checklist";}
}
function showShare(url){el.plateLink.href=url;el.plateLink.textContent=url;el.qrCode.replaceChildren();if(window.PlateQRCode)window.PlateQRCode.render(el.qrCode,url,{size:240,dark:"#0a0a0f",light:"#fff",margin:4});else{const p=document.createElement("p");p.style.color="#0a0a0f";p.textContent="QR unavailable. Copy the link instead.";el.qrCode.appendChild(p);}el.sharePanel.hidden=false;el.sharePanel.scrollIntoView({behavior:"smooth",block:"center"});}
async function shareLink(){const url=el.plateLink.href;if(navigator.share){try{await navigator.share({title:state.draft?.title||"Plate checklist",url});return;}catch(err){if(err.name==="AbortError")return;}}copy(url,"Plate link copied.");}
async function pasteClipboard(){try{el.platePaste.value=await navigator.clipboard.readText();parseDraft();}catch{toast("Clipboard access was blocked. Paste manually.",true);el.platePaste.focus();}}
function clearDraft(){if(el.platePaste.value.trim()&&!confirm("Clear the current plate draft?"))return;el.platePaste.value="";el.plateTitle.value="96-well plate";state.draft=null;el.sharePanel.hidden=true;el.pasteSummary.textContent="Awaiting plate data.";el.pasteSummary.className="helper";el.createHint.textContent="At least one non-empty well is required.";el.createButton.disabled=true;renderPreview();localStorage.removeItem("plate-viewer:draft");}
function describePaste(){if(!el.platePaste.value.trim()){el.pasteSummary.textContent="Awaiting plate data.";el.pasteSummary.className="helper";return;}try{const d=dimensions(parseExcel(el.platePaste.value));el.pasteSummary.textContent=`${d.rows} rows detected; up to ${d.max} columns. Select Load plate.`;el.pasteSummary.className="helper";}catch(err){el.pasteSummary.textContent=err.message;el.pasteSummary.className="helper error-text";}}
function saveDraft(){localStorage.setItem("plate-viewer:draft",JSON.stringify({title:el.plateTitle.value,raw:el.platePaste.value,showRows:el.showRowHeaders.checked,showCols:el.showColumnHeaders.checked,rowHeaders:el.rowHeaders.value,columnHeaders:el.columnHeaders.value,expiry:el.expiryDays.value}));}
function restoreDraft(){try{const d=JSON.parse(localStorage.getItem("plate-viewer:draft")||"null");if(!d)return;el.plateTitle.value=d.title||"96-well plate";el.platePaste.value=d.raw||"";el.showRowHeaders.checked=d.showRows!==false;el.showColumnHeaders.checked=d.showCols!==false;el.rowHeaders.value=d.rowHeaders||ROWS.join(", ");el.columnHeaders.value=d.columnHeaders||COLS.join(", ");el.expiryDays.value=String(d.expiry||30);}catch{localStorage.removeItem("plate-viewer:draft");}}
async function ping(){try{const r=await fetch(`${API}/health`,{cache:"no-store"});if(!r.ok)throw 0;el.apiStatus.classList.add("online");el.apiStatus.querySelector("span").textContent="API ONLINE";}catch{el.apiStatus.classList.add("offline");el.apiStatus.querySelector("span").textContent="API OFFLINE";}}
async function toggleWakeLock(){
  if (!("wakeLock" in navigator)) return;
  try{
    if(wakeLock){await wakeLock.release();wakeLock=null;el.wakeLockButton.textContent="Keep awake";el.wakeLockButton.classList.remove("secondary");toast("Screen wake lock released.");return;}
    wakeLock=await navigator.wakeLock.request("screen");el.wakeLockButton.textContent="Screen awake";el.wakeLockButton.classList.add("secondary");toast("Screen will stay awake while this checklist is open.");wakeLock.addEventListener("release",()=>{wakeLock=null;el.wakeLockButton.textContent="Keep awake";el.wakeLockButton.classList.remove("secondary");},{once:true});
  }catch(err){toast(`Could not keep the screen awake: ${err.message}`,true);}
}

function showViewerError(title,msg){el.viewerLoading.hidden=true;el.viewerContent.hidden=true;el.viewerError.hidden=false;el.viewerErrorTitle.textContent=title;el.viewerErrorMessage.textContent=msg;}
function validatePlate(p){if(!p||!Array.isArray(p.cells)||p.cells.length!==96)throw new Error("Stored plate data is malformed.");if(!Array.isArray(p.rowHeaders)||p.rowHeaders.length!==8)p.rowHeaders=[...ROWS];if(!Array.isArray(p.columnHeaders)||p.columnHeaders.length!==12)p.columnHeaders=[...COLS];}
function coordinate(i){return`${ROWS[Math.floor(i/12)]}${i%12+1}`;}
function accent(v){if(!v)return"#465064";let h=0;for(let i=0;i<v.length;i++)h=((h<<5)-h+v.charCodeAt(i))|0;return["#00d4ff","#ff00ff","#00ff88"][Math.abs(h)%3];}
function clean(v,n){return String(v??"").replace(/[\u0000-\u001F\u007F]/g," ").replace(/\s+/g," ").trim().slice(0,n);}
function esc(v){return String(v??"").replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[ch]);}
async function safeJson(r){try{return await r.json();}catch{return null;}}
function friendly(err){if(err?.status===404)return"This plate ID was not found.";if(err?.status===410)return"This plate link has expired.";if(!navigator.onLine)return"This device is offline and no cached copy is available yet.";return err?.message||"Unexpected error.";}
async function copy(text,msg){try{await navigator.clipboard.writeText(text);}catch{const t=document.createElement("textarea");t.value=text;t.style.position="fixed";t.style.opacity="0";document.body.appendChild(t);t.select();document.execCommand("copy");t.remove();}toast(msg);}
function toast(msg,bad=false){clearTimeout(toastTimer);el.toast.textContent=msg;el.toast.classList.toggle("bad",bad);el.toast.classList.add("show");toastTimer=setTimeout(()=>el.toast.classList.remove("show"),3000);}
function debounce(fn,ms){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),ms);};}
function registerSW(){if("serviceWorker"in navigator)addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));}
