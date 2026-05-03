// js/analytics.js
import { db, auth } from "./firebase-config.js";
import {
  collection, query, where, getDocs, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const page = document.getElementById("page-analytics");

const CRITERIA_LABELS = {
  prix_biere: "Prix Biere", prix_vin: "Prix Vin", gout_vin: "Gout Vin",
  ambiance: "Ambiance", plage_hh: "Happy Hour", distance_maison: "Distance Maison",
  distance_travail: "Distance Travail", beaute: "Beaute", variete_carte: "Variete Carte",
  viabilite_saisonniere: "Viabilite Sais.", places: "Places", toilettes: "Toilettes"
};

window.addEventListener("user-ready", () => {
  renderAnalyticsPage();
});

let currentFilter = "all";
let currentGroupId = null;
let currentCriteria = "globalScore";

function renderAnalyticsPage() {
  page.innerHTML = `
    <div style="padding:16px 20px 0;">
      <h2 class="page-title">ANALYTICS</h2>
    </div>
    <div class="analytics-body">
      <div class="section-label" style="padding:0 0 8px;">Afficher les notes de</div>
      <div class="filter-bar" id="filter-who">
        <button class="filter-chip active" data-who="all">Tous</button>
        <button class="filter-chip" data-who="me">Moi</button>
        <button class="filter-chip" data-who="friends">Amis</button>
        <button class="filter-chip" data-who="group">Groupe...</button>
      </div>

      <!-- Group selector (hidden by default) -->
      <div id="group-selector" style="display:none;margin-bottom:12px;">
        <select id="group-select" class="input" style="padding:10px 14px;">
          <option value="">Choisir un groupe...</option>
        </select>
      </div>

      <div class="section-label" style="padding:8px 0;">Trier par</div>
      <div class="filter-bar" id="filter-criteria" style="overflow-x:auto;flex-wrap:nowrap;padding-bottom:4px;">
        <button class="filter-chip active" data-crit="globalScore">Score global</button>
        <button class="filter-chip" data-crit="ambiance">Ambiance</button>
        <button class="filter-chip" data-crit="prix_biere">Prix Biere</button>
        <button class="filter-chip" data-crit="plage_hh">Happy Hour</button>
        <button class="filter-chip" data-crit="beaute">Beaute</button>
        <button class="filter-chip" data-crit="places">Places</button>
        <button class="filter-chip" data-crit="toilettes">Toilettes</button>
      </div>

      <div class="section-label" style="padding:8px 0 10px;">Top bars</div>
      <div id="top-bars-list" class="top-bars-list">
        <p style="color:var(--muted);font-size:13px;">Chargement...</p>
      </div>
    </div>
  `;

  // Who filter
  document.getElementById("filter-who").addEventListener("click", async e => {
    const btn = e.target.closest("[data-who]");
    if (!btn) return;
    document.querySelectorAll("#filter-who .filter-chip").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.who;
    currentGroupId = null;

    const groupSelector = document.getElementById("group-selector");
    if (currentFilter === "group") {
      groupSelector.style.display = "block";
      await loadGroupOptions();
    } else {
      groupSelector.style.display = "none";
      loadTopBars();
    }
  });

  // Group select dropdown
  document.getElementById("group-select").addEventListener("change", e => {
    currentGroupId = e.target.value || null;
    if (currentGroupId) loadTopBars();
    else {
      document.getElementById("top-bars-list").innerHTML =
        `<p style="color:var(--muted);font-size:13px;">Selectionnez un groupe ci-dessus.</p>`;
    }
  });

  // Criteria filter
  document.getElementById("filter-criteria").addEventListener("click", e => {
    const btn = e.target.closest("[data-crit]");
    if (!btn) return;
    document.querySelectorAll("#filter-criteria .filter-chip").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    currentCriteria = btn.dataset.crit;
    if (currentFilter !== "group" || currentGroupId) loadTopBars();
  });

  loadTopBars();
}

// Load user's groups into the dropdown
async function loadGroupOptions() {
  const me = auth.currentUser;
  const q  = query(collection(db, "conversations"),
    where("members", "array-contains", me.uid),
    where("isGroup", "==", true)
  );
  const snap = await getDocs(q);
  const select = document.getElementById("group-select");
  select.innerHTML = `<option value="">Choisir un groupe...</option>`;

  if (snap.empty) {
    select.innerHTML += `<option disabled>Aucun groupe pour l'instant</option>`;
    document.getElementById("top-bars-list").innerHTML =
      `<p style="color:var(--muted);font-size:13px;text-align:center;">Creez un groupe depuis l'onglet Social !</p>`;
    return;
  }

  snap.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.data().name || "Groupe sans nom";
    select.appendChild(opt);
  });

  document.getElementById("top-bars-list").innerHTML =
    `<p style="color:var(--muted);font-size:13px;">Selectionnez un groupe ci-dessus.</p>`;
}

async function loadTopBars() {
  const listEl = document.getElementById("top-bars-list");
  listEl.innerHTML = `<p style="color:var(--muted);font-size:13px;">Chargement...</p>`;

  const user = auth.currentUser;
  let userIds = [];

  if (currentFilter === "me") {
    userIds = [user.uid];

  } else if (currentFilter === "friends") {
    const meSnap = await getDoc(doc(db, "users", user.uid));
    const friends = meSnap.data()?.friends || [];
    if (!friends.length) {
      listEl.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;">Vous n'avez pas encore d'amis dans Spahdigo.</p>`;
      return;
    }
    userIds = [user.uid, ...friends].slice(0, 10);

  } else if (currentFilter === "group") {
    if (!currentGroupId) return;
    const groupSnap = await getDoc(doc(db, "conversations", currentGroupId));
    if (!groupSnap.exists()) return;
    userIds = groupSnap.data().members || [];

  } else {
    userIds = null;
  }

  // Fetch ratings
  let snap;
  if (userIds === null) {
    snap = await getDocs(query(collection(db, "ratings")));
  } else if (userIds.length === 1) {
    snap = await getDocs(query(collection(db, "ratings"), where("userId", "==", userIds[0])));
  } else {
    snap = await getDocs(query(collection(db, "ratings"), where("userId", "in", userIds.slice(0, 10))));
  }

  // Aggregate by bar — track which users rated each bar
  const barMap = {};
  snap.forEach(d => {
    const r = d.data();
    if (!barMap[r.barId]) barMap[r.barId] = { name: r.barName, scores: [], raters: new Set() };
    const score = currentCriteria === "globalScore"
      ? r.globalScore
      : (r.scores?.[currentCriteria] ?? null);
    if (score !== null && score !== undefined) {
      barMap[r.barId].scores.push(score);
      barMap[r.barId].raters.add(r.userId);
    }
  });

  // For group filter: only keep bars rated by ALL members
  const requiredRaters = currentFilter === "group" && userIds
    ? new Set(userIds)
    : null;

  const sorted = Object.entries(barMap)
    .filter(([, b]) => {
      if (!requiredRaters) return b.scores.length > 0;
      // Every group member must have rated this bar
      for (const uid of requiredRaters) {
        if (!b.raters.has(uid)) return false;
      }
      return true;
    })
    .map(([id, b]) => ({
      id,
      name: b.name,
      count: b.raters.size,
      avg: b.scores.reduce((a, v) => a + v, 0) / b.scores.length
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 100); // top 100

  if (!sorted.length) {
    listEl.innerHTML = currentFilter === "group"
      ? `<p style="color:var(--muted);font-size:13px;text-align:center;">Aucun bar n'a ete note par tous les membres du groupe.</p>`
      : `<p style="color:var(--muted);font-size:13px;text-align:center;">Aucune note trouvee.</p>`;
    return;
  }

  const criteriaLabel = currentCriteria === "globalScore"
    ? "Score global" : (CRITERIA_LABELS[currentCriteria] || currentCriteria);

  listEl.innerHTML = "";
  sorted.forEach((b, i) => {
    const isTop10 = i < 10;
    const item = document.createElement("div");
    item.className = "bar-rank-item";
    item.style.opacity = isTop10 ? "1" : "0.55";
    item.style.borderColor = isTop10 ? "var(--border)" : "rgba(46,46,46,0.5)";
    item.innerHTML = `
      <div class="rank-num" style="color:${isTop10 ? "var(--gold)" : "var(--muted)"};">#${i + 1}</div>
      <div class="bar-rank-info">
        <div class="bar-rank-name" style="color:${isTop10 ? "var(--text)" : "var(--muted)"};">${b.name}</div>
        <div class="bar-rank-addr">${b.count} avis · ${criteriaLabel}</div>
      </div>
      <div class="bar-rank-score" style="color:${isTop10 ? "var(--gold)" : "var(--muted)"};">${b.avg.toFixed(1)}</div>
    `;
    listEl.appendChild(item);
  });
}
