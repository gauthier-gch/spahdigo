// js/map.js
import { db, auth } from "./firebase-config.js";
import { collection, getDocs, query, where, orderBy, limit, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const VERIFIED_PSEUDOS = ["gauthier"];
function verifiedBadge(pseudo) {
  if (!pseudo || !VERIFIED_PSEUDOS.includes(pseudo.toLowerCase())) return "";
  return `<span onclick="event.stopPropagation();showCertifTooltip(this)" style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;background:#1d9bf0;border-radius:50%;margin-left:4px;font-size:9px;vertical-align:middle;flex-shrink:0;cursor:pointer;">&#10003;</span>`;
}

let mapInitialized = false;
let leafletMap;
let allMarkers = []; // { id, bar, marker }
let currentMapFilter = "all"; // all | me | friends | friend:<uid> | group:<id>

window.addEventListener("user-ready", () => { initMap(); });

function initMap() {
  if (mapInitialized) return;
  mapInitialized = true;
  const mapContainer = document.getElementById("page-map");

  // Filter bar UI
  const filterBar = document.createElement("div");
  filterBar.id = "map-filter-bar";
  filterBar.style.cssText = "position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:500;display:flex;gap:6px;background:rgba(13,13,13,0.85);padding:6px 10px;border-radius:50px;border:1px solid var(--border);backdrop-filter:blur(8px);white-space:nowrap;max-width:92vw;overflow-x:auto;";
  filterBar.innerHTML = `
    <button class="map-filter-btn active" data-f="all" style="background:var(--gold);color:var(--dark);border:none;padding:5px 12px;border-radius:20px;font-size:12px;font-family:var(--font-body);font-weight:600;cursor:pointer;white-space:nowrap;">Tous</button>
    <button class="map-filter-btn" data-f="me" style="background:transparent;color:var(--muted);border:1px solid var(--border);padding:5px 12px;border-radius:20px;font-size:12px;font-family:var(--font-body);cursor:pointer;white-space:nowrap;">Moi</button>
    <button class="map-filter-btn" data-f="friends" style="background:transparent;color:var(--muted);border:1px solid var(--border);padding:5px 12px;border-radius:20px;font-size:12px;font-family:var(--font-body);cursor:pointer;white-space:nowrap;">Mes amis</button>
    <button class="map-filter-btn" data-f="friend-select" style="background:transparent;color:var(--muted);border:1px solid var(--border);padding:5px 12px;border-radius:20px;font-size:12px;font-family:var(--font-body);cursor:pointer;white-space:nowrap;">Un ami...</button>
    <button class="map-filter-btn" data-f="group-select" style="background:transparent;color:var(--muted);border:1px solid var(--border);padding:5px 12px;border-radius:20px;font-size:12px;font-family:var(--font-body);cursor:pointer;white-space:nowrap;">Groupe...</button>
  `;
  mapContainer.appendChild(filterBar);

  filterBar.addEventListener("click", async e => {
    const btn = e.target.closest("[data-f]"); if (!btn) return;
    const f = btn.dataset.f;
    if (f === "friend-select") { await openFriendSelector(); return; }
    if (f === "group-select")  { await openGroupSelector(); return; }
    setMapFilter(f, btn);
  });

  const mapDiv = document.createElement("div");
  mapDiv.id = "map"; mapDiv.style.cssText = "position:absolute;inset:0;";
  mapContainer.appendChild(mapDiv);

  const noteBtn = document.createElement("button");
  noteBtn.id = "btn-noter-bar"; noteBtn.className = "btn btn-primary";
  noteBtn.innerHTML = "🍺 Noter un bar";
  mapContainer.appendChild(noteBtn);

  leafletMap = L.map("map", { center:[48.8566,2.3522], zoom:13, zoomControl:false });
  window._leafletMap = leafletMap;
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { attribution:"© OpenStreetMap © CartoDB", subdomains:"abcd", maxZoom:19 }).addTo(leafletMap);

  noteBtn.addEventListener("click", () => { document.getElementById("modal-rate").classList.remove("hidden"); window.dispatchEvent(new Event("open-rate-modal")); });
  setTimeout(() => leafletMap.invalidateSize(), 100);
  setTimeout(() => leafletMap.invalidateSize(), 500);
  loadBarsOnMap();
}

function setMapFilter(f, activeBtn) {
  currentMapFilter = f;
  document.querySelectorAll(".map-filter-btn").forEach(b => {
    b.style.background="transparent"; b.style.color="var(--muted)"; b.style.borderColor="var(--border)"; b.classList.remove("active");
  });
  if (activeBtn) { activeBtn.style.background="var(--gold)"; activeBtn.style.color="var(--dark)"; activeBtn.style.borderColor="var(--gold)"; activeBtn.classList.add("active"); }
  applyMapFilter();
}

async function applyMapFilter() {
  const me = auth.currentUser;
  let allowedBarIds = null; // null = show all

  if (currentMapFilter === "me") {
    const snap = await getDocs(query(collection(db,"ratings"), where("userId","==",me.uid)));
    allowedBarIds = new Set(snap.docs.map(d=>d.data().barId));
  } else if (currentMapFilter === "friends") {
    const meSnap = await getDoc(doc(db,"users",me.uid));
    const friends = meSnap.data()?.friends||[];
    const uids = [me.uid, ...friends];
    const snap = await getDocs(query(collection(db,"ratings"), where("userId","in",uids.slice(0,10))));
    allowedBarIds = new Set(snap.docs.map(d=>d.data().barId));
  } else if (currentMapFilter.startsWith("friend:")) {
    const fuid = currentMapFilter.split(":")[1];
    const snap = await getDocs(query(collection(db,"ratings"), where("userId","==",fuid)));
    allowedBarIds = new Set(snap.docs.map(d=>d.data().barId));
  } else if (currentMapFilter.startsWith("group:")) {
    const gid = currentMapFilter.split(":")[1];
    const gSnap = await getDoc(doc(db,"conversations",gid));
    const members = gSnap.data()?.members||[];
    const snap = await getDocs(query(collection(db,"ratings"), where("userId","in",members.slice(0,10))));
    // Only bars rated by ALL members
    const barRaters = {};
    snap.docs.forEach(d => { const r=d.data(); if(!barRaters[r.barId])barRaters[r.barId]=new Set(); barRaters[r.barId].add(r.userId); });
    allowedBarIds = new Set(Object.entries(barRaters).filter(([,s])=>members.every(m=>s.has(m))).map(([id])=>id));
  }

  // Show/hide markers
  allMarkers.forEach(({ id, marker }) => {
    const visible = allowedBarIds === null || allowedBarIds.has(id);
    if (visible) { if (!leafletMap.hasLayer(marker)) marker.addTo(leafletMap); }
    else { if (leafletMap.hasLayer(marker)) leafletMap.removeLayer(marker); }
  });
}

async function openFriendSelector() {
  const me = auth.currentUser;
  const meSnap = await getDoc(doc(db,"users",me.uid));
  const friendIds = meSnap.data()?.friends||[];
  if (!friendIds.length) { alert("Vous n'avez pas encore d'amis !"); return; }
  const friends=[];
  for(const fid of friendIds){const s=await getDoc(doc(db,"users",fid));if(s.exists())friends.push({uid:fid,...s.data()});}

  const overlay = document.createElement("div");
  overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:3000;display:flex;align-items:center;justify-content:center;padding:24px;";
  overlay.innerHTML=`<div style="background:var(--dark2);border-radius:20px;padding:20px;width:100%;max-width:320px;border:1px solid var(--border);">
    <h3 style="font-family:var(--font-display);font-size:22px;color:var(--gold);margin-bottom:14px;">Choisir un ami</h3>
    <div id="friend-list-select" style="display:flex;flex-direction:column;gap:8px;max-height:50vh;overflow-y:auto;"></div>
    <button id="close-friend-sel" class="btn btn-ghost" style="margin-top:12px;">Annuler</button>
  </div>`;
  document.body.appendChild(overlay);
  document.getElementById("close-friend-sel").addEventListener("click",()=>overlay.remove());
  const list=document.getElementById("friend-list-select");
  friends.forEach(f=>{
    const btn=document.createElement("button");
    btn.style.cssText="display:flex;align-items:center;gap:10px;padding:10px;background:var(--dark3);border:1px solid var(--border);border-radius:10px;cursor:pointer;color:var(--text);font-family:var(--font-body);font-size:14px;width:100%;";
    const photo=f.photoURL?`<img src="${f.photoURL}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;"/>`:`<span style="width:32px;height:32px;border-radius:50%;background:var(--dark);display:flex;align-items:center;justify-content:center;">&#129489;</span>`;
    btn.innerHTML=`${photo}<span>@${f.pseudo}</span>`;
    btn.addEventListener("click",()=>{
      currentMapFilter=`friend:${f.uid}`;
      // Update active button label
      document.querySelectorAll(".map-filter-btn").forEach(b=>{b.style.background="transparent";b.style.color="var(--muted)";b.style.borderColor="var(--border)";});
      const selBtn=document.querySelector('[data-f="friend-select"]');
      if(selBtn){selBtn.style.background="var(--gold)";selBtn.style.color="var(--dark)";selBtn.textContent=`@${f.pseudo}`;}
      overlay.remove(); applyMapFilter();
    });
    list.appendChild(btn);
  });
}

async function openGroupSelector() {
  const me = auth.currentUser;
  const snap = await getDocs(query(collection(db,"conversations"),where("members","array-contains",me.uid),where("isGroup","==",true)));
  if (snap.empty) { alert("Vous n'avez pas encore de groupes !"); return; }

  const overlay=document.createElement("div");
  overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:3000;display:flex;align-items:center;justify-content:center;padding:24px;";
  overlay.innerHTML=`<div style="background:var(--dark2);border-radius:20px;padding:20px;width:100%;max-width:320px;border:1px solid var(--border);">
    <h3 style="font-family:var(--font-display);font-size:22px;color:var(--gold);margin-bottom:14px;">Choisir un groupe</h3>
    <div id="group-list-select" style="display:flex;flex-direction:column;gap:8px;max-height:50vh;overflow-y:auto;"></div>
    <button id="close-group-sel" class="btn btn-ghost" style="margin-top:12px;">Annuler</button>
  </div>`;
  document.body.appendChild(overlay);
  document.getElementById("close-group-sel").addEventListener("click",()=>overlay.remove());
  const list=document.getElementById("group-list-select");
  snap.forEach(d=>{
    const g=d.data();
    const btn=document.createElement("button");
    btn.style.cssText="display:flex;align-items:center;gap:10px;padding:10px;background:var(--dark3);border:1px solid var(--border);border-radius:10px;cursor:pointer;color:var(--text);font-family:var(--font-body);font-size:14px;width:100%;";
    btn.innerHTML=`<span style="font-size:18px;">&#128101;</span><span>${g.name||"Groupe"}</span>`;
    btn.addEventListener("click",()=>{
      currentMapFilter=`group:${d.id}`;
      document.querySelectorAll(".map-filter-btn").forEach(b=>{b.style.background="transparent";b.style.color="var(--muted)";b.style.borderColor="var(--border)";});
      const selBtn=document.querySelector('[data-f="group-select"]');
      if(selBtn){selBtn.style.background="var(--gold)";selBtn.style.color="var(--dark)";selBtn.textContent=g.name||"Groupe";}
      overlay.remove(); applyMapFilter();
    });
    list.appendChild(btn);
  });
}

export async function loadBarsOnMap() {
  if (!leafletMap) return;
  allMarkers = [];
  const snap = await getDocs(collection(db,"bars"));
  snap.forEach(docSnap => { const bar=docSnap.data(); if(bar.lat&&bar.lng) addBarMarker(docSnap.id,bar); });
  applyMapFilter();
}

export async function addBarMarker(id, bar) {
  if (!leafletMap) return;
  const icon = L.divIcon({ className:"", html:'<div class="bar-marker"><span>&#127866;</span></div>', iconSize:[28,28], iconAnchor:[14,28], popupAnchor:[0,-30] });
  const avgScore = bar.totalScore&&bar.ratingCount ? (bar.totalScore/bar.ratingCount).toFixed(1) : "—";
  const marker = L.marker([bar.lat,bar.lng],{icon}).addTo(leafletMap);
  allMarkers.push({ id, bar, marker });

  marker.on("click", async () => {
    const q=query(collection(db,"ratings"),where("barId","==",id),orderBy("createdAt","desc"),limit(5));
    const snap=await getDocs(q);
    let commentsHtml="";
    snap.forEach(d=>{
      const r=d.data();
      if(r.comment) commentsHtml+=`<div style="margin-top:8px;padding:8px 10px;background:rgba(255,255,255,0.05);border-radius:8px;border-left:2px solid #F5A623;">
        <div style="font-size:11px;color:#aaa;margin-bottom:3px;display:flex;align-items:center;"><strong style="color:#f0ede6;">${r.userName}</strong>${verifiedBadge(r.userName)}&nbsp;&#183;&nbsp;${r.globalScore.toFixed(1)}/10</div>
        <div style="font-size:13px;color:#f0ede6;">${r.comment}</div>
      </div>`;
    });
    if(!commentsHtml) commentsHtml='<div style="font-size:12px;color:#888;margin-top:8px;font-style:italic;">Aucun commentaire pour l\'instant.</div>';
    marker.bindPopup(`
      <div class="popup-bar-name">${bar.name}</div>
      <div class="popup-bar-score" style="margin-top:4px;">${bar.address}<br/>Note moyenne : <strong>${avgScore}/10</strong> (${bar.ratingCount||0} avis)</div>
      <div style="margin-top:10px;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#888;">Commentaires</div>
      ${commentsHtml}
    `,{maxWidth:280}).openPopup();
  });
}
