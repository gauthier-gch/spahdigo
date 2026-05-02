// js/map.js
import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let mapInitialized = false;
let leafletMap;

window.addEventListener("user-ready", () => {
  initMap();
});

function initMap() {
  if (mapInitialized) return;
  mapInitialized = true;

  const mapContainer = document.getElementById("page-map");

  // Create map div
  const mapDiv = document.createElement("div");
  mapDiv.id = "map";
  mapDiv.style.cssText = "flex:1;width:100%;height:100%;";
  mapContainer.appendChild(mapDiv);

  // Create "Noter un bar" button
  const btn = document.createElement("button");
  btn.id = "btn-noter-bar";
  btn.className = "btn btn-primary";
  btn.textContent = "🍺 Noter un bar";
  mapContainer.appendChild(btn);

  // Init Leaflet with dark tile
  leafletMap = L.map("map", {
    center: [48.8566, 2.3522],
    zoom: 13,
    zoomControl: false
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "© OpenStreetMap © CartoDB",
    subdomains: "abcd",
    maxZoom: 19
  }).addTo(leafletMap);

  // Open rating modal on button click
  btn.addEventListener("click", () => {
    document.getElementById("modal-rate").classList.remove("hidden");
    // Reset modal to search step
    window.dispatchEvent(new Event("open-rate-modal"));
  });

  // Load existing bars
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

export function addBarMarker(id, bar) {
  if (!leafletMap) return;
  const icon = L.divIcon({
    className: "",
    html: `<div class="bar-marker"><span>🍺</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30]
  });

  const avgScore = bar.totalScore && bar.ratingCount
    ? (bar.totalScore / bar.ratingCount).toFixed(1)
    : "—";

  L.marker([bar.lat, bar.lng], { icon })
    .addTo(leafletMap)
    .bindPopup(`
      <div class="popup-bar-name">${bar.name}</div>
      <div class="popup-bar-score">
        ${bar.address}<br/>
        Note moyenne : <strong>${avgScore}/10</strong>
        (${bar.ratingCount || 0} avis)
      </div>
    `);
}
