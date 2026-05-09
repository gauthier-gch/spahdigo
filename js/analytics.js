// js/analytics.js
import { db, auth } from "./firebase-config.js";
import { collection, query, where, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const page = document.getElementById("page-analytics");
const CRITERIA_LABELS = {
  prix_biere:"Prix Bière", prix_vin:"Prix Vin", gout_vin:"Goût Vin",
  ambiance:"Ambiance", plage_hh:"Plage HH", distance_maison:"Distance Maison",
  distance_travail:"Distance Travail", beaute:"Beauté", variete_carte:"Variété Carte",
  viabilite_saisonniere:"Viabilité Sais.", places:"Places", toilettes:"Toilettes"
};

window.addEventListener("user-ready", () => { renderAnalyticsPage(); });

let currentFilter = "all", currentGroupId = null, currentCriteria = "globalScore";

// Cached bar list for client-side search filtering
let currentBars = [];

function renderAnalyticsPage() {
  page.innerHTML = `
    <div style="padding:16px 20px 0;"><h2 class="page-title">Analytics</h2></div>
    <div class="analytics-body">
      <div class="section-label" style="padding:0 0 8px;">Afficher les notes de</div>
      <div class="filter-bar" id="filter-who">
        <button class="filter-chip active" data-who="all">Tous</button>
        <button class="filter-chip" data-who="me">Moi</button>
        <button class="filter-chip" data-who="friends">Amis</button>
        <button class="filter-chip" data-who="group">Groupe...</button>
      </div>
      <div id="group-selector" style="display:none;margin-bottom:12px;">
        <select id="group-select" class="input" style="padding:10px 14px;color:var(--text);background:var(--dark3);">
          <option value="">Choisir un groupe...</option>
        </select>
      </div>
      <div class="section-label" style="padding:8px 0;">Trier par critère</div>
      <div class="filter-bar" id="filter-criteria" style="overflow-x:auto;flex-wrap:wrap;padding-bottom:4px;gap:6px;">
        <button class="filter-chip active" data-crit="globalScore">Score global</button>
        <button class="filter-chip" data-crit="prix_biere">Prix Bière</button>
        <button class="filter-chip" data-crit="prix_vin">Prix Vin</button>
        <button class="filter-chip" data-crit="gout_vin">Goût Vin</button>
        <button class="filter-chip" data-crit="ambiance">Ambiance</button>
        <button class="filter-chip" data-crit="plage_hh">Plage HH</button>
        <button class="filter-chip" data-crit="distance_maison">Distance Maison</button>
        <button class="filter-chip" data-crit="distance_travail">Distance Travail</button>
        <button class="filter-chip" data-crit="viabilite_saisonniere">Viabilité Sais.</button>
        <button class="filter-chip" data-crit="places">Places</button>
      </div>
      <!-- Search bar -->
      <div style="margin-bottom:12px;">
        <input id="analytics-search" class="input" placeholder="🔍 Rechercher un bar..." style="font-size:14px;" />
      </div>
      <div class="section-label" style="padding:0 0 10px;">Top bars <span id="bars-count" style="color:var(--border);font-size:10px;"></span></div>
      <div id="top-bars-list" class="top-bars-list"><p style="color:var(--muted);font-size:13px;">Chargement...</p></div>
    </div>
  `;

  document.getElementById("filter-who").addEventListener("click", async e => {
    const btn = e.target.closest("[data-who]"); if (!btn) return;
    document.querySelectorAll("#filter-who .filter-chip").forEach(c => c.classList.remove("active"));
    btn.classList.add("active"); currentFilter = btn.dataset.who; currentGroupId = null;
    const gs = document.getElementById("group-selector");
    if (currentFilter === "group") { gs.style.display="block"; await loadGroupOptions(); }
    else { gs.style.display="none"; loadTopBars(); }
  });

  document.getElementById("group-select").addEventListener("change", e => {
    currentGroupId = e.target.value || null;
    if (currentGroupId) loadTopBars();
    else document.getElementById("top-bars-list").innerHTML = `<p style="color:var(--muted);font-size:13px;">Sélectionnez un groupe.</p>`;
  });

  document.getElementById("filter-criteria").addEventListener("click", e => {
    const btn = e.target.closest("[data-crit]"); if (!btn) return;
    document.querySelectorAll("#filter-criteria .filter-chip").forEach(c => c.classList.remove("active"));
    btn.classList.add("active"); currentCriteria = btn.dataset.crit;
    if (currentFilter !== "group" || currentGroupId) loadTopBars();
  });

  document.getElementById("analytics-search").addEventListener("input", e => {
    renderBarsList(e.target.value.trim());
  });

  loadTopBars();
}

async function loadGroupOptions() {
  const me = auth.currentUser;
  const snap = await getDocs(query(collection(db, "conversations"), where("members","array-contains",me.uid), where("isGroup","==",true)));
  const select = document.getElementById("group-select");
  select.innerHTML = `<option value="">Choisir un groupe...</option>`;
  if (snap.empty) { select.innerHTML += `<option disabled>Aucun groupe</option>`; document.getElementById("top-bars-list").innerHTML=`<p style="color:var(--muted);font-size:13px;text-align:center;">Créez un groupe depuis l'onglet Messages !</p>`; return; }
  snap.forEach(d => { const opt=document.createElement("option"); opt.value=d.id; opt.textContent=d.data().name||"Groupe"; select.appendChild(opt); });
  document.getElementById("top-bars-list").innerHTML = `<p style="color:var(--muted);font-size:13px;">Sélectionnez un groupe.</p>`;
}

async function loadTopBars() {
  const listEl = document.getElementById("top-bars-list");
  if (!listEl) return;
  listEl.innerHTML = `<p style="color:var(--muted);font-size:13px;">Chargement...</p>`;
  currentBars = [];

  const user = auth.currentUser;
  let userIds = [];

  if (currentFilter==="me") { userIds=[user.uid]; }
  else if (currentFilter==="friends") {
    const ms = await getDoc(doc(db,"users",user.uid));
    const friends = ms.data()?.friends||[];
    if (!friends.length) { listEl.innerHTML=`<p style="color:var(--muted);font-size:13px;text-align:center;">Pas encore d'amis.</p>`; return; }
    userIds=[user.uid,...friends].slice(0,10);
  } else if (currentFilter==="group") {
    if (!currentGroupId) return;
    const gs = await getDoc(doc(db,"conversations",currentGroupId));
    if (!gs.exists()) return;
    userIds=gs.data().members||[];
  } else { userIds=null; }

  let snap;
  if (userIds===null) snap=await getDocs(query(collection(db,"ratings")));
  else if (userIds.length===1) snap=await getDocs(query(collection(db,"ratings"),where("userId","==",userIds[0])));
  else snap=await getDocs(query(collection(db,"ratings"),where("userId","in",userIds.slice(0,10))));

  // Fetch current user's rated bar IDs for "pas testé" badge
  let myRatedBarIds;
  if (currentFilter === "me") {
    myRatedBarIds = new Set(snap.docs.map(d => d.data().barId));
  } else {
    const mySnap = await getDocs(query(collection(db,"ratings"), where("userId","==",user.uid)));
    myRatedBarIds = new Set(mySnap.docs.map(d => d.data().barId));
  }

  const barMap={};
  snap.forEach(d => {
    const r=d.data();
    if (!barMap[r.barId]) barMap[r.barId]={name:r.barName,scores:[],raters:new Set()};
    const score=currentCriteria==="globalScore"?r.globalScore:(r.scores?.[currentCriteria]??null);
    if (score!==null&&score!==undefined) { barMap[r.barId].scores.push(score); barMap[r.barId].raters.add(r.userId); }
  });

  const requiredRaters = currentFilter==="group"&&userIds ? new Set(userIds) : null;
  const sorted = Object.entries(barMap)
    .filter(([,b]) => { if (!requiredRaters) return b.scores.length>0; for(const uid of requiredRaters){if(!b.raters.has(uid))return false;} return true; })
    .map(([id,b]) => ({ id, name:b.name, count:b.raters.size, avg:b.scores.reduce((a,v)=>a+v,0)/b.scores.length }))
    .sort((a,b)=>b.avg-a.avg).slice(0,1000);

  if (!sorted.length) {
    listEl.innerHTML = currentFilter==="group"
      ? `<p style="color:var(--muted);font-size:13px;text-align:center;">Aucun bar noté par tous les membres.</p>`
      : `<p style="color:var(--muted);font-size:13px;text-align:center;">Aucune note trouvée.</p>`;
    return;
  }

  // Tag each bar with rank and rated status
  currentBars = sorted.map((b, i) => ({ ...b, rank: i + 1, isRated: myRatedBarIds.has(b.id) }));

  const countEl = document.getElementById("bars-count");
  if (countEl) countEl.textContent = `— ${currentBars.length} bars`;

  const searchVal = document.getElementById("analytics-search")?.value.trim() || "";
  renderBarsList(searchVal);
}

function renderBarsList(searchText) {
  const listEl = document.getElementById("top-bars-list");
  if (!listEl) return;
  if (!currentBars.length) return;

  const criteriaLabel = currentCriteria==="globalScore"?"Score global":(CRITERIA_LABELS[currentCriteria]||currentCriteria);
  const filtered = searchText
    ? currentBars.filter(b => b.name.toLowerCase().includes(searchText.toLowerCase()))
    : currentBars;

  if (!filtered.length) {
    listEl.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;">Aucun bar trouvé pour "${searchText}".</p>`;
    return;
  }

  listEl.innerHTML = "";
  filtered.forEach(b => {
    const isTop10 = b.rank <= 10;
    const item = document.createElement("div");
    item.className = "bar-rank-item";
    item.style.opacity = isTop10 ? "1" : "0.6";
    item.style.borderColor = isTop10 ? "var(--border)" : "rgba(58,58,66,0.5)";
    item.dataset.barid   = b.id;
    item.dataset.barname = b.name;
    item.innerHTML = `
      <div class="rank-num" style="color:${isTop10?"var(--gold)":"var(--muted)"};">#${b.rank}</div>
      <div class="bar-rank-info">
        <div class="bar-rank-name" style="color:${isTop10?"var(--text)":"var(--muted)"};">
          ${b.name}${!b.isRated ? '<span class="unrated-badge">pas testé</span>' : ''}
        </div>
        <div class="bar-rank-addr">${b.count} avis · ${criteriaLabel}</div>
      </div>
      <div class="bar-rank-score" style="color:${isTop10?"var(--gold)":"var(--muted)"};">${b.avg.toFixed(1)}</div>
    `;
    item.addEventListener("click", async () => {
      const { openBarDetailsModal } = await import("./bar-details.js");
      openBarDetailsModal(b.id, b.name);
    });
    listEl.appendChild(item);
  });
}
