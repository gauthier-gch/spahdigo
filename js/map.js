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
let allMarkers = [];
let currentMapFilter = "all";
let ratedBarIds = new Set();

// ── Metro lines state ──────────────────────────────────────────
let metroLayerGroup = null;
let metroLoaded     = false;
let metroVisible    = false;

// ── Geolocation state ──────────────────────────────────────────
let userLocationMarker = null;
let geoWatcher         = null;
let geoActive          = false;

// ── Score → color gradient (Red → Gold → Green) ───────────────
function scoreToColor(score) {
  if (score === null || score === undefined || isNaN(score)) return "#888888";
  const t = Math.max(0, Math.min(10, score)) / 10;
  let r, g, b;
  if (t < 0.5) {
    const x = t * 2;
    r = Math.round(224 + (245 - 224) * x);
    g = Math.round(82  + (166 - 82)  * x);
    b = Math.round(82  + (35  - 82)  * x);
  } else {
    const x = (t - 0.5) * 2;
    r = Math.round(245 + (76  - 245) * x);
    g = Math.round(166 + (175 - 166) * x);
    b = Math.round(35  + (80  - 35)  * x);
  }
  return `rgb(${r},${g},${b})`;
}

window.addEventListener("user-ready", () => { initMap(); });

function initMap() {
  if (mapInitialized) return;
  mapInitialized = true;
  const mapContainer = document.getElementById("page-map");

  // ── Filter bar ─────────────────────────────────────────────
  const filterBar = document.createElement("div");
  filterBar.id = "map-filter-bar";
  filterBar.style.cssText = "position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:500;display:flex;gap:6px;background:rgba(20,20,23,0.9);padding:6px 10px;border-radius:50px;border:1px solid var(--border);backdrop-filter:blur(10px);white-space:nowrap;max-width:92vw;overflow-x:auto;";
  filterBar.innerHTML = `
    <button class="map-filter-btn active" data-f="all"           style="background:var(--gold);color:var(--dark);border:none;padding:5px 12px;border-radius:20px;font-size:12px;font-family:var(--font-body);font-weight:600;cursor:pointer;white-space:nowrap;">Tous</button>
    <button class="map-filter-btn"        data-f="me"            style="background:transparent;color:var(--muted);border:1px solid var(--border);padding:5px 12px;border-radius:20px;font-size:12px;font-family:var(--font-body);cursor:pointer;white-space:nowrap;">Moi</button>
    <button class="map-filter-btn"        data-f="friends"       style="background:transparent;color:var(--muted);border:1px solid var(--border);padding:5px 12px;border-radius:20px;font-size:12px;font-family:var(--font-body);cursor:pointer;white-space:nowrap;">Mes amis</button>
    <button class="map-filter-btn"        data-f="friend-select" id="map-btn-friend" style="background:transparent;color:var(--muted);border:1px solid var(--border);padding:5px 12px;border-radius:20px;font-size:12px;font-family:var(--font-body);cursor:pointer;white-space:nowrap;">Un ami...</button>
    <button class="map-filter-btn"        data-f="group-select"  id="map-btn-group"  style="background:transparent;color:var(--muted);border:1px solid var(--border);padding:5px 12px;border-radius:20px;font-size:12px;font-family:var(--font-body);cursor:pointer;white-space:nowrap;">Groupe...</button>
    <button class="map-filter-btn"        data-f="metro"         id="map-btn-metro"  style="background:transparent;color:var(--muted);border:1px solid var(--border);padding:5px 12px;border-radius:20px;font-size:12px;font-family:var(--font-body);cursor:pointer;white-space:nowrap;">🚇 Métro</button>
  `;
  mapContainer.appendChild(filterBar);

  filterBar.addEventListener("click", async e => {
    const btn = e.target.closest("[data-f]"); if (!btn) return;
    const f = btn.dataset.f;
    if (f === "friend-select") { await openFriendSelector(); return; }
    if (f === "group-select")  { await openGroupSelector();  return; }
    if (f === "metro")         { await toggleMetroLines(btn); return; }
    setMapFilter(f, btn);
  });

  // ── Map div ────────────────────────────────────────────────
  const mapDiv = document.createElement("div");
  mapDiv.id = "map"; mapDiv.style.cssText = "position:absolute;inset:0;";
  mapContainer.appendChild(mapDiv);

  // ── "Noter un bar" button ──────────────────────────────────
  const noteBtn = document.createElement("button");
  noteBtn.id = "btn-noter-bar"; noteBtn.className = "btn btn-primary";
  noteBtn.innerHTML = "🍺 Noter un bar";
  mapContainer.appendChild(noteBtn);

  // ── Geolocation "fly to me" button ────────────────────────
  const geoBtn = document.createElement("button");
  geoBtn.id = "btn-geolocate";
  geoBtn.innerHTML = "📍";
  geoBtn.title = "Centrer sur ma position";
  geoBtn.style.cssText = "position:absolute;bottom:84px;right:14px;z-index:500;width:44px;height:44px;background:var(--dark2);border:1px solid var(--border);color:var(--text);border-radius:50%;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.5);transition:all .2s;backdrop-filter:blur(6px);opacity:0;pointer-events:none;";
  mapContainer.appendChild(geoBtn);
  // Clicking flies the map to the current position
  geoBtn.addEventListener("click", () => {
    if (userLocationMarker) leafletMap.flyTo(userLocationMarker.getLatLng(), 16, { duration:1.2 });
  });

  // ── Initialize Leaflet ─────────────────────────────────────
  leafletMap = L.map("map", { center:[48.8566,2.3522], zoom:13, zoomControl:false });
  window._leafletMap = leafletMap;
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { attribution:"© OpenStreetMap © CartoDB", subdomains:"abcd", maxZoom:19 }).addTo(leafletMap);

  noteBtn.addEventListener("click", () => { document.getElementById("modal-rate").classList.remove("hidden"); window.dispatchEvent(new Event("open-rate-modal")); });
  setTimeout(() => leafletMap.invalidateSize(), 100);
  setTimeout(() => leafletMap.invalidateSize(), 500);
  loadBarsOnMap();

  // ── Auto-start geolocation on map init ─────────────────────
  startGeolocation(geoBtn);
}

// ── Filter helpers ─────────────────────────────────────────────
function setMapFilter(f, activeBtn) {
  currentMapFilter = f;
  document.querySelectorAll(".map-filter-btn").forEach(b => {
    if (b.dataset.f === "metro") return; // don't reset metro toggle
    b.style.background="transparent"; b.style.color="var(--muted)"; b.style.borderColor="var(--border)"; b.classList.remove("active");
  });
  if (activeBtn) {
    activeBtn.style.background="var(--gold)"; activeBtn.style.color="var(--dark)";
    activeBtn.style.borderColor="var(--gold)"; activeBtn.classList.add("active");
  }
  applyMapFilter();
}

async function applyMapFilter() {
  const me = auth.currentUser;
  let allowedBarIds = null;

  if (currentMapFilter === "me") {
    const snap = await getDocs(query(collection(db,"ratings"), where("userId","==",me.uid)));
    allowedBarIds = new Set(snap.docs.map(d=>d.data().barId));

  } else if (currentMapFilter === "friends") {
    const meSnap = await getDoc(doc(db,"users",me.uid));
    const friends = meSnap.data()?.friends || [];
    const uids = [me.uid, ...friends];
    let barIds = new Set();
    for (let i = 0; i < uids.length; i += 10) {
      const batch = uids.slice(i, i + 10);
      const snap = await getDocs(query(collection(db,"ratings"), where("userId","in",batch)));
      snap.docs.forEach(d => barIds.add(d.data().barId));
    }
    allowedBarIds = barIds;

  } else if (currentMapFilter.startsWith("friend:")) {
    const fuid = currentMapFilter.split(":")[1];
    const snap = await getDocs(query(collection(db,"ratings"), where("userId","==",fuid)));
    allowedBarIds = new Set(snap.docs.map(d=>d.data().barId));

  } else if (currentMapFilter.startsWith("group:")) {
    const gid = currentMapFilter.split(":")[1];
    const gSnap = await getDoc(doc(db,"conversations",gid));
    const members = gSnap.data()?.members || [];
    const barRaters = {};
    for (let i = 0; i < members.length; i += 10) {
      const batch = members.slice(i, i + 10);
      const snap = await getDocs(query(collection(db,"ratings"), where("userId","in",batch)));
      snap.docs.forEach(d => {
        const r = d.data();
        if (!barRaters[r.barId]) barRaters[r.barId] = new Set();
        barRaters[r.barId].add(r.userId);
      });
    }
    allowedBarIds = new Set(
      Object.entries(barRaters)
        .filter(([,s]) => members.every(m => s.has(m)))
        .map(([id]) => id)
    );
  }

  allMarkers.forEach(({ id, marker }) => {
    const visible = allowedBarIds === null || allowedBarIds.has(id);
    if (visible) { if (!leafletMap.hasLayer(marker)) marker.addTo(leafletMap); }
    else         { if (leafletMap.hasLayer(marker))  leafletMap.removeLayer(marker); }
  });
}

// ── Metro lines ────────────────────────────────────────────────
const METRO_COLORS = {
  "1":"#FFCD00","2":"#003CA6","3":"#837902","3b":"#6EC4E8","4":"#CF009E",
  "5":"#FF7E2E","6":"#6ECA97","7":"#FA9ABA","7b":"#6ECA97","8":"#E19BDF",
  "9":"#B6BD00","10":"#C9910D","11":"#704B1C","12":"#007852","13":"#6EC4E8","14":"#62259D"
};

async function toggleMetroLines(btn) {
  if (metroVisible) {
    if (metroLayerGroup) metroLayerGroup.removeFrom(leafletMap);
    metroVisible = false;
    if (btn) { btn.style.background="transparent"; btn.style.color="var(--muted)"; btn.style.borderColor="var(--border)"; }
    return;
  }

  if (btn) { btn.textContent = "⏳ Métro"; btn.style.opacity="0.7"; }

  if (!metroLoaded) {
    // Free OpenStreetMap Overpass API — no API key needed.
    // Match subway + RER relations in greater Paris bounding box.
    const q = `[out:json][timeout:30];(relation["route"~"subway|metro"](48.75,2.15,48.98,2.55););out geom;`;
    const body = `data=${encodeURIComponent(q)}`;
    const postOpts = { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body };
    // Try primary mirror then two fallbacks
    const MIRRORS = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
    ];
    let data = null;
    for (const mirror of MIRRORS) {
      try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 20000);
        const res  = await fetch(mirror, { ...postOpts, signal: ctrl.signal });
        clearTimeout(tid);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
        break;
      } catch(e) { console.warn("Overpass mirror failed:", mirror, e.message); }
    }
    if (!data || !data.elements?.length) {
      if (btn) { btn.textContent = "🚇 Métro"; btn.style.opacity="1"; }
      alert("Impossible de charger les lignes de métro. Réessaie plus tard.");
      return;
    }

    metroLayerGroup = L.layerGroup();
    data.elements.forEach(el => {
      if (el.type !== "relation") return;
      const ref   = el.tags?.ref || "";
      const color = METRO_COLORS[ref] || "#aaa";
      el.members.forEach(member => {
        if (member.type !== "way" || !member.geometry?.length) return;
        const latlngs = member.geometry.map(p => [p.lat, p.lon]);
        L.polyline(latlngs, { color, weight:3, opacity:0.85 }).addTo(metroLayerGroup);
      });
    });
    metroLoaded = true;
  }

  metroLayerGroup.addTo(leafletMap);
  metroVisible = true;
  if (btn) {
    btn.textContent = "🚇 Métro";
    btn.style.opacity = "1";
    btn.style.background = "var(--gold)";
    btn.style.color = "var(--dark)";
    btn.style.borderColor = "var(--gold)";
  }
}

// ── Geolocation — auto-start, button only re-centers ──────────
function startGeolocation(btn) {
  if (!navigator.geolocation) return;

  const icon = L.divIcon({
    className: "",
    html: '<div class="user-location-marker"></div>',
    iconSize: [16,16], iconAnchor: [8,8]
  });

  let firstFix = true;

  geoWatcher = navigator.geolocation.watchPosition(pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    if (!userLocationMarker) {
      userLocationMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(leafletMap);
    } else {
      userLocationMarker.setLatLng([lat, lng]);
    }
    // Show the "fly to me" button once we have a position
    btn.style.opacity = "1";
    btn.style.pointerEvents = "auto";
    // Fly to position only on first fix
    if (firstFix) {
      firstFix = false;
      leafletMap.flyTo([lat, lng], 14, { duration: 1.5 });
    }
  }, () => {
    // Permission denied — silently do nothing (no alert on page load)
  }, { enableHighAccuracy: true, maximumAge: 10000 });
}

// ── Friend/group selectors ─────────────────────────────────────
async function openFriendSelector() {
  const me = auth.currentUser;
  const meSnap = await getDoc(doc(db,"users",me.uid));
  const friendIds = meSnap.data()?.friends || [];
  if (!friendIds.length) { alert("Vous n'avez pas encore d'amis !"); return; }

  const friends = [];
  for (const fid of friendIds) {
    const s = await getDoc(doc(db,"users",fid));
    if (s.exists()) friends.push({ uid:fid, ...s.data() });
  }

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:3000;display:flex;align-items:center;justify-content:center;padding:24px;";
  overlay.innerHTML = `
    <div style="background:var(--dark2);border-radius:20px;padding:20px;width:100%;max-width:320px;border:1px solid var(--border);">
      <h3 style="font-family:var(--font-display);font-size:20px;color:var(--gold);margin-bottom:14px;">Choisir un ami</h3>
      <div id="friend-list-select" style="display:flex;flex-direction:column;gap:8px;max-height:50vh;overflow-y:auto;"></div>
      <button id="close-friend-sel" class="btn btn-ghost" style="margin-top:12px;">Annuler</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("close-friend-sel").addEventListener("click", e => { e.stopPropagation(); overlay.remove(); });
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

  const list = document.getElementById("friend-list-select");
  friends.forEach(f => {
    const btn = document.createElement("button");
    btn.style.cssText = "display:flex;align-items:center;gap:10px;padding:10px;background:var(--dark3);border:1px solid var(--border);border-radius:10px;cursor:pointer;color:var(--text);font-family:var(--font-body);font-size:14px;width:100%;";
    const photo = f.photoURL
      ? `<img src="${f.photoURL}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />`
      : `<span style="width:32px;height:32px;border-radius:50%;background:var(--dark);display:flex;align-items:center;justify-content:center;">&#129489;</span>`;
    btn.innerHTML = `${photo}<span>@${f.pseudo}</span>`;
    btn.addEventListener("click", e => {
      e.stopPropagation();
      currentMapFilter = `friend:${f.uid}`;
      document.querySelectorAll(".map-filter-btn").forEach(b => {
        if (b.dataset.f === "metro") return;
        b.style.background="transparent"; b.style.color="var(--muted)"; b.style.borderColor="var(--border)"; b.classList.remove("active");
      });
      const selBtn = document.getElementById("map-btn-friend");
      if (selBtn) {
        selBtn.textContent = `@${f.pseudo}`;
        selBtn.dataset.f = "friend-select";
        selBtn.style.background="var(--gold)"; selBtn.style.color="var(--dark)"; selBtn.style.borderColor="var(--gold)";
      }
      overlay.remove();
      applyMapFilter();
    });
    list.appendChild(btn);
  });
}

async function openGroupSelector() {
  const me = auth.currentUser;
  const snap = await getDocs(query(collection(db,"conversations"), where("members","array-contains",me.uid), where("isGroup","==",true)));
  if (snap.empty) { alert("Vous n'avez pas encore de groupes !"); return; }

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:3000;display:flex;align-items:center;justify-content:center;padding:24px;";
  overlay.innerHTML = `
    <div style="background:var(--dark2);border-radius:20px;padding:20px;width:100%;max-width:320px;border:1px solid var(--border);">
      <h3 style="font-family:var(--font-display);font-size:20px;color:var(--gold);margin-bottom:14px;">Choisir un groupe</h3>
      <div id="group-list-select" style="display:flex;flex-direction:column;gap:8px;max-height:50vh;overflow-y:auto;"></div>
      <button id="close-group-sel" class="btn btn-ghost" style="margin-top:12px;">Annuler</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("close-group-sel").addEventListener("click", e => { e.stopPropagation(); overlay.remove(); });
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

  const list = document.getElementById("group-list-select");
  snap.forEach(d => {
    const g = d.data();
    const btn = document.createElement("button");
    btn.style.cssText = "display:flex;align-items:center;gap:10px;padding:10px;background:var(--dark3);border:1px solid var(--border);border-radius:10px;cursor:pointer;color:var(--text);font-family:var(--font-body);font-size:14px;width:100%;";
    btn.innerHTML = `<span style="font-size:18px;">&#128101;</span><span>${g.name || "Groupe"}</span>`;
    btn.addEventListener("click", e => {
      e.stopPropagation();
      currentMapFilter = `group:${d.id}`;
      document.querySelectorAll(".map-filter-btn").forEach(b => {
        if (b.dataset.f === "metro") return;
        b.style.background="transparent"; b.style.color="var(--muted)"; b.style.borderColor="var(--border)"; b.classList.remove("active");
      });
      const selBtn = document.getElementById("map-btn-group");
      if (selBtn) {
        selBtn.textContent = g.name || "Groupe";
        selBtn.dataset.f = "group-select";
        selBtn.style.background="var(--gold)"; selBtn.style.color="var(--dark)"; selBtn.style.borderColor="var(--gold)";
      }
      overlay.remove();
      applyMapFilter();
    });
    list.appendChild(btn);
  });
}

// ── Load all bars ──────────────────────────────────────────────
export async function loadBarsOnMap() {
  if (!leafletMap) return;
  allMarkers.forEach(({ marker }) => { if (leafletMap.hasLayer(marker)) leafletMap.removeLayer(marker); });
  allMarkers = [];

  // Fetch current user's rated bar IDs for gradient + unrated styling
  const me = auth.currentUser;
  if (me) {
    const mySnap = await getDocs(query(collection(db,"ratings"), where("userId","==",me.uid)));
    ratedBarIds  = new Set(mySnap.docs.map(d => d.data().barId));
  }

  const snap = await getDocs(collection(db,"bars"));
  snap.forEach(docSnap => { const bar = docSnap.data(); if (bar.lat && bar.lng) addBarMarker(docSnap.id, bar); });
  applyMapFilter();
}

// ── Add a single bar marker ────────────────────────────────────
export async function addBarMarker(id, bar) {
  if (!leafletMap) return;
  const avgScore   = bar.totalScore && bar.ratingCount ? bar.totalScore / bar.ratingCount : null;
  const markerColor = scoreToColor(avgScore);
  const isUnrated  = !ratedBarIds.has(id);

  const icon = L.divIcon({
    className: "",
    html: `<div class="bar-marker${isUnrated?" unrated":""}" style="background:${markerColor};"><span>&#127866;</span></div>`,
    iconSize: [28,28], iconAnchor: [14,28], popupAnchor: [0,-30]
  });

  const avgLabel = avgScore !== null ? avgScore.toFixed(1) : "—";
  const marker = L.marker([bar.lat, bar.lng], { icon }).addTo(leafletMap);
  allMarkers.push({ id, bar, marker });

  marker.on("click", async () => {
    const q = query(collection(db,"ratings"), where("barId","==",id), orderBy("createdAt","desc"), limit(5));
    const snap = await getDocs(q);
    let commentsHtml = "";
    snap.forEach(d => {
      const r = d.data();
      if (r.comment) commentsHtml += `
        <div style="margin-top:8px;padding:8px 10px;background:rgba(255,255,255,0.05);border-radius:8px;border-left:2px solid var(--gold);">
          <div style="font-size:11px;color:#aaa;margin-bottom:3px;display:flex;align-items:center;">
            <strong style="color:#f5f2ed;">${r.userName}</strong>${verifiedBadge(r.userName)}&nbsp;·&nbsp;${r.globalScore.toFixed(1)}/10
          </div>
          <div style="font-size:13px;color:#f5f2ed;">${r.comment}</div>
        </div>`;
    });
    if (!commentsHtml) commentsHtml = '<div style="font-size:12px;color:#8a8a95;margin-top:8px;font-style:italic;">Aucun commentaire pour l\'instant.</div>';
    marker.bindPopup(`
      <div class="popup-bar-name">${bar.name}</div>
      <div class="popup-bar-score" style="margin-top:4px;">${bar.address}<br/>Note moyenne : <strong>${avgLabel}/10</strong> (${bar.ratingCount || 0} avis)</div>
      <div style="margin-top:10px;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#8a8a95;">Commentaires</div>
      ${commentsHtml}
    `, { maxWidth:280 }).openPopup();
  });
}
