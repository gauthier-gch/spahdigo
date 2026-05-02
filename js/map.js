// js/map.js
import { db } from "./firebase-config.js";
import { collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Verified badge (keep in sync with social.js) ───────────────
const VERIFIED_PSEUDOS = ["gauthier"];

function verifiedBadge(pseudo) {
  if (!pseudo || !VERIFIED_PSEUDOS.includes(pseudo.toLowerCase())) return "";
  return `<span onclick="event.stopPropagation();showCertifTooltip(this)"
    style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;background:#1d9bf0;border-radius:50%;margin-left:4px;font-size:9px;vertical-align:middle;flex-shrink:0;cursor:pointer;">&#10003;</span>`;
}

let mapInitialized = false;
let leafletMap;

window.addEventListener("user-ready", () => {
  initMap();
});

function initMap() {
  if (mapInitialized) return;
  mapInitialized = true;

  const mapContainer = document.getElementById("page-map");

  const mapDiv = document.createElement("div");
  mapDiv.id = "map";
  mapDiv.style.cssText = "position:absolute;inset:0;";
  mapContainer.appendChild(mapDiv);

  const btn = document.createElement("button");
  btn.id = "btn-noter-bar";
  btn.className = "btn btn-primary";
  btn.innerHTML = "🍺 Noter un bar";
  mapContainer.appendChild(btn);

  leafletMap = L.map("map", {
    center: [48.8566, 2.3522],
    zoom: 13,
    zoomControl: false
  });
  window._leafletMap = leafletMap;

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "© OpenStreetMap © CartoDB",
    subdomains: "abcd",
    maxZoom: 19
  }).addTo(leafletMap);

  btn.addEventListener("click", () => {
    document.getElementById("modal-rate").classList.remove("hidden");
    window.dispatchEvent(new Event("open-rate-modal"));
  });

  // Force Leaflet to recalculate size — critical for PWA mode on iPhone
  setTimeout(() => leafletMap.invalidateSize(), 100);
  setTimeout(() => leafletMap.invalidateSize(), 500);

  loadBarsOnMap();
}

export async function loadBarsOnMap() {
  if (!leafletMap) return;
  const snap = await getDocs(collection(db, "bars"));
  snap.forEach(docSnap => {
    const bar = docSnap.data();
    if (bar.lat && bar.lng) addBarMarker(docSnap.id, bar);
  });
}

export async function addBarMarker(id, bar) {
  if (!leafletMap) return;

  const icon = L.divIcon({
    className: "",
    html: '<div class="bar-marker"><span>&#127866;</span></div>',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30]
  });

  const avgScore = bar.totalScore && bar.ratingCount
    ? (bar.totalScore / bar.ratingCount).toFixed(1)
    : "—";

  const marker = L.marker([bar.lat, bar.lng], { icon }).addTo(leafletMap);

  // Load comments on click
  marker.on("click", async () => {
    const q = query(
      collection(db, "ratings"),
      where("barId", "==", id),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    const snap = await getDocs(q);

    let commentsHtml = "";
    snap.forEach(d => {
      const r = d.data();
      if (r.comment) {
        commentsHtml += `
          <div style="margin-top:8px;padding:8px 10px;background:rgba(255,255,255,0.05);border-radius:8px;border-left:2px solid #F5A623;">
            <div style="font-size:11px;color:#aaa;margin-bottom:3px;display:flex;align-items:center;">
              <strong style="color:#f0ede6;">${r.userName}</strong>${verifiedBadge(r.userName)}
              &nbsp;&#183;&nbsp;${r.globalScore.toFixed(1)}/10
            </div>
            <div style="font-size:13px;color:#f0ede6;">${r.comment}</div>
          </div>`;
      }
    });

    if (!commentsHtml) {
      commentsHtml = '<div style="font-size:12px;color:#888;margin-top:8px;font-style:italic;">Aucun commentaire pour l\'instant.</div>';
    }

    marker.bindPopup(`
      <div class="popup-bar-name">${bar.name}</div>
      <div class="popup-bar-score" style="margin-top:4px;">
        ${bar.address}<br/>
        Note moyenne : <strong>${avgScore}/10</strong> (${bar.ratingCount || 0} avis)
      </div>
      <div style="margin-top:10px;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#888;">Commentaires</div>
      ${commentsHtml}
    `, { maxWidth: 280 }).openPopup();
  });
}
