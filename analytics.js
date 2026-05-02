// js/analytics.js
import { db, auth } from "./firebase-config.js";
import {
  collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const page = document.getElementById("page-analytics");

const CRITERIA_LABELS = {
  prix_biere: "Prix Bière", prix_vin: "Prix Vin", gout_vin: "Goût Vin",
  ambiance: "Ambiance", plage_hh: "Happy Hour", distance_maison: "Distance Maison",
  distance_travail: "Distance Travail", beaute: "Beauté", variete_carte: "Variété Carte",
  viabilite_saisonniere: "Viabilité Sais.", places: "Places", toilettes: "Toilettes"
};

window.addEventListener("user-ready", () => {
  renderAnalyticsPage();
});

let currentFilter = "all"; // all | friends | group
let currentCriteria = "globalScore";

function renderAnalyticsPage() {
  page.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">ANALYTICS</h2>
    </div>
    <div class="analytics-body">
      <p style="color:var(--muted);font-size:13px;margin-bottom:12px;">
        Découvrez les meilleurs bars notés par vos connexions.
      </p>

      <div class="section-label" style="padding:0 0 8px;">Afficher les notes de</div>
      <div class="filter-bar" id="filter-who">
        <button class="filter-chip active" data-who="all">🌍 Tous</button>
        <button class="filter-chip" data-who="me">🙋 Moi</button>
        <button class="filter-chip" data-who="friends">👥 Amis</button>
      </div>

      <div class="section-label" style="padding:8px 0;">Trier par</div>
      <div class="filter-bar" id="filter-criteria" style="overflow-x:auto;flex-wrap:nowrap;">
        <button class="filter-chip active" data-crit="globalScore">⭐ Score global</button>
        <button class="filter-chip" data-crit="ambiance">Ambiance</button>
        <button class="filter-chip" data-crit="prix_biere">Prix Bière</button>
        <button class="filter-chip" data-crit="plage_hh">Happy Hour</button>
        <button class="filter-chip" data-crit="beaute">Beauté</button>
      </div>

      <div class="section-label" style="padding:8px 0 10px;">Top bars</div>
      <div id="top-bars-list" class="top-bars-list">
        <p style="color:var(--muted);font-size:13px;">Chargement…</p>
      </div>
    </div>
  `;

  // Who filter
  document.getElementById("filter-who").addEventListener("click", e => {
    const btn = e.target.closest("[data-who]");
    if (!btn) return;
    document.querySelectorAll("#filter-who .filter-chip").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.who;
    loadTopBars();
  });

  // Criteria filter
  document.getElementById("filter-criteria").addEventListener("click", e => {
    const btn = e.target.closest("[data-crit]");
    if (!btn) return;
    document.querySelectorAll("#filter-criteria .filter-chip").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    currentCriteria = btn.dataset.crit;
    loadTopBars();
  });

  loadTopBars();
}

async function loadTopBars() {
  const listEl = document.getElementById("top-bars-list");
  listEl.innerHTML = `<p style="color:var(--muted);font-size:13px;">Chargement…</p>`;

  const user = auth.currentUser;
  let ratingsQuery;

  if (currentFilter === "me") {
    ratingsQuery = query(collection(db, "ratings"), where("userId", "==", user.uid));
  } else if (currentFilter === "friends") {
    // Get friend list
    const userSnap = await getDocs(query(collection(db, "users"), where("email", "==", user.email)));
    const userData = userSnap.docs[0]?.data();
    const friends  = userData?.friends || [];
    if (!friends.length) {
      listEl.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;">Vous n'avez pas encore d'amis dans Spahdigo.</p>`;
      return;
    }
    ratingsQuery = query(collection(db, "ratings"), where("userId", "in", friends.slice(0, 10)));
  } else {
    ratingsQuery = query(collection(db, "ratings"));
  }

  const snap = await getDocs(ratingsQuery);

  // Aggregate by bar
  const barMap = {};
  snap.forEach(d => {
    const r = d.data();
    if (!barMap[r.barId]) {
      barMap[r.barId] = { name: r.barName, scores: [], count: 0 };
    }
    const score = currentCriteria === "globalScore"
      ? r.globalScore
      : (r.scores?.[currentCriteria] ?? null);
    if (score !== null && score !== undefined) {
      barMap[r.barId].scores.push(score);
      barMap[r.barId].count++;
    }
  });

  // Sort by average
  const sorted = Object.entries(barMap)
    .map(([id, b]) => ({
      id,
      name: b.name,
      count: b.count,
      avg: b.scores.length ? b.scores.reduce((a, v) => a + v, 0) / b.scores.length : 0
    }))
    .filter(b => b.count > 0)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10);

  if (!sorted.length) {
    listEl.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;">Aucune note trouvée.<br/>Soyez le premier à noter un bar !</p>`;
    return;
  }

  listEl.innerHTML = "";
  sorted.forEach((b, i) => {
    const criteriaLabel = currentCriteria === "globalScore"
      ? "Score global" : CRITERIA_LABELS[currentCriteria] || currentCriteria;
    const item = document.createElement("div");
    item.className = "bar-rank-item";
    item.innerHTML = `
      <div class="rank-num">#${i + 1}</div>
      <div class="bar-rank-info">
        <div class="bar-rank-name">${b.name}</div>
        <div class="bar-rank-addr">${b.count} avis · ${criteriaLabel}</div>
      </div>
      <div class="bar-rank-score">${b.avg.toFixed(1)}</div>
    `;
    listEl.appendChild(item);
  });
}
