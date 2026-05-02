// js/rating.js
import { db, auth } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, doc, updateDoc,
  increment, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { loadBarsOnMap, addBarMarker } from "./map.js";

// â”€â”€ Criteria with weights â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CRITERIA = [
  { key: "prix_biere",    label: "Prix BiÃ¨re",           weight: 3   },
  { key: "prix_vin",      label: "Prix Vin",             weight: 3   },
  { key: "gout_vin",      label: "GoÃ»t Vin",             weight: 2   },
  { key: "ambiance",      label: "Ambiance",             weight: 1   },
  { key: "plage_hh",      label: "Plage Happy Hour",     weight: 2   },
  { key: "distance_maison", label: "Distance Maison",    weight: 3   },
  { key: "distance_travail", label: "Distance Travail",  weight: 2   },
  { key: "beaute",        label: "BeautÃ©",               weight: 1   },
  { key: "variete_carte", label: "VariÃ©tÃ© Carte",        weight: 1.5 },
  { key: "viabilite_saisonniere", label: "ViabilitÃ© SaisonniÃ¨re", weight: 1.5 },
  { key: "places",        label: "Places",               weight: 2   },
  { key: "toilettes",     label: "Toilettes",            weight: 1   },
];

const TOTAL_WEIGHT = CRITERIA.reduce((sum, c) => sum + c.weight, 0);

// â”€â”€ DOM refs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const modal        = document.getElementById("modal-rate");
const stepSearch   = document.getElementById("step-search");
const stepCreate   = document.getElementById("step-create");
const stepRate     = document.getElementById("step-rate");
const searchInput  = document.getElementById("bar-search-input");
const searchResults = document.getElementById("bar-search-results");
const criteriaList = document.getElementById("criteria-list");

let selectedBar = null; // { id, name, address, lat, lng } or null for new

// â”€â”€ Open/close modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
window.addEventListener("open-rate-modal", () => resetToSearch());

document.getElementById("close-rate-modal").addEventListener("click", () => {
  modal.classList.add("hidden");
});

function resetToSearch() {
  stepSearch.classList.remove("hidden");
  stepCreate.classList.add("hidden");
  stepRate.classList.add("hidden");
  searchInput.value = "";
  searchResults.innerHTML = "";
  selectedBar = null;
}

// â”€â”€ Search bars â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let allBars = [];
async function fetchAllBars() {
  if (allBars.length > 0) return;
  const snap = await getDocs(collection(db, "bars"));
  snap.forEach(d => allBars.push({ id: d.id, ...d.data() }));
}

searchInput.addEventListener("input", async () => {
  const q = searchInput.value.toLowerCase().trim();
  searchResults.innerHTML = "";
  if (!q) return;
  await fetchAllBars();
  const filtered = allBars.filter(b =>
    b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q)
  ).slice(0, 6);
  filtered.forEach(bar => {
    const li = document.createElement("li");
    li.innerHTML = `<div>${bar.name}</div><div class="bar-addr">${bar.address}</div>`;
    li.addEventListener("click", () => openRateStep(bar));
    searchResults.appendChild(li);
  });
});

// â”€â”€ Create new bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.getElementById("btn-create-bar").addEventListener("click", () => {
  stepSearch.classList.add("hidden");
  stepCreate.classList.remove("hidden");
});
document.getElementById("btn-back-search").addEventListener("click", resetToSearch);

document.getElementById("btn-save-new-bar").addEventListener("click", async () => {
  const name    = document.getElementById("new-bar-name").value.trim();
  const address = document.getElementById("new-bar-address").value.trim();
  if (!name || !address) { alert("Remplis le nom et l'adresse !"); return; }

  // Geocode address via Nominatim (free)
  let lat = 48.8566, lng = 2.3522;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
    );
    const data = await res.json();
    if (data[0]) { lat = parseFloat(data[0].lat); lng = parseFloat(data[0].lon); }
  } catch (_) {}

  const barRef = await addDoc(collection(db, "bars"), {
    name, address, lat, lng,
    createdAt: serverTimestamp(),
    ratingCount: 0,
    totalScore: 0
  });
  allBars = []; // reset cache
  const bar = { id: barRef.id, name, address, lat, lng };
  addBarMarker(bar.id, bar);
  openRateStep(bar);
});

// â”€â”€ Rating step â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openRateStep(bar) {
  selectedBar = bar;
  stepSearch.classList.add("hidden");
  stepCreate.classList.add("hidden");
  stepRate.classList.remove("hidden");
  document.getElementById("rating-bar-name").textContent = bar.name;
  buildCriteriaUI();
}

function buildCriteriaUI() {
  criteriaList.innerHTML = "";
  CRITERIA.forEach(c => {
    const div = document.createElement("div");
    div.className = "criterion-item";
    div.innerHTML = `
      <label>
        <span>${c.label}</span>
        <span class="weight">Ã—${c.weight}</span>
        <span class="score-display" id="disp-${c.key}">5</span>
      </label>
      <input type="range" min="0" max="10" step="0.5" value="5"
             id="range-${c.key}" />
    `;
    criteriaList.appendChild(div);
    const range = div.querySelector(`#range-${c.key}`);
    const disp  = div.querySelector(`#disp-${c.key}`);
    range.addEventListener("input", () => { disp.textContent = range.value; });
  });
}

// â”€â”€ Submit rating â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.getElementById("btn-submit-rating").addEventListener("click", async () => {
  if (!selectedBar) return;
  const user = auth.currentUser;
  if (!user) return;

  const scores = {};
  let weightedSum = 0;
  CRITERIA.forEach(c => {
    const val = parseFloat(document.getElementById(`range-${c.key}`).value);
    scores[c.key] = val;
    weightedSum += val * c.weight;
  });
  const globalScore = weightedSum / TOTAL_WEIGHT;

  await addDoc(collection(db, "ratings"), {
    barId:   selectedBar.id,
    barName: selectedBar.name,
    userId:  user.uid,
    userName: user.displayName || "Anonyme",
    scores,
    globalScore,
    createdAt: serverTimestamp()
  });

  // Update bar aggregate
  await updateDoc(doc(db, "bars", selectedBar.id), {
    ratingCount: increment(1),
    totalScore:  increment(globalScore)
  });

  modal.classList.add("hidden");
  allBars = [];
  loadBarsOnMap();
  alert(`Note envoyÃ©e pour ${selectedBar.name} ! Score : ${globalScore.toFixed(1)}/10 ðŸº`);
});
