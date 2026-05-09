// js/profile.js — Profile page (Instagram-style)
import { db, auth } from "./firebase-config.js";
import {
  collection, query, where, getDocs, doc, getDoc,
  addDoc, updateDoc, serverTimestamp, arrayUnion, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const page = document.getElementById("page-profile");

const VERIFIED_PSEUDOS = ["gauthier"];
function verifiedBadge(pseudo) {
  if (!pseudo || !VERIFIED_PSEUDOS.includes(pseudo.toLowerCase())) return "";
  return `<span onclick="event.stopPropagation();showCertifTooltip(this)" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;background:#1d9bf0;border-radius:50%;margin-left:6px;font-size:10px;vertical-align:middle;flex-shrink:0;cursor:pointer;">&#10003;</span>`;
}

window.showCertifTooltip = function(el) {
  document.querySelectorAll(".certif-tooltip").forEach(t => t.remove());
  const tooltip = document.createElement("div");
  tooltip.className = "certif-tooltip";
  tooltip.textContent = "Pour avoir une chance d'obtenir la certif, n'h\u00e9site pas \u00e0 payer des verres \u00e0 @gauthier \uD83C\uDF7A";
  tooltip.style.cssText = `position:fixed;background:#1d9bf0;color:#fff;padding:10px 14px;border-radius:12px;font-size:13px;font-family:var(--font-body);max-width:240px;line-height:1.4;box-shadow:0 4px 20px rgba(0,0,0,.4);z-index:9999;animation:fadeInUp .15s ease;`;
  const rect = el.getBoundingClientRect();
  tooltip.style.left = Math.min(rect.left - 100, window.innerWidth - 260) + "px";
  tooltip.style.top  = (rect.bottom + 8) + "px";
  document.body.appendChild(tooltip);
  setTimeout(() => { document.addEventListener("click", () => tooltip.remove(), { once:true }); }, 50);
};

window.addEventListener("user-ready", () => {
  renderProfilePage();
  listenForFriendRequestBadge();
});

// ── Friend request badge on nav ────────────────────────────────
function listenForFriendRequestBadge() {
  const me = auth.currentUser;
  const q  = query(collection(db,"friendRequests"), where("toUid","==",me.uid), where("status","==","pending"));
  onSnapshot(q, snap => {
    const btn = document.querySelector('.nav-btn[data-page="profile"]');
    if (!btn) return;
    let dot = btn.querySelector(".nav-badge");
    if (!dot) { dot = document.createElement("span"); dot.className = "nav-badge"; btn.appendChild(dot); }
    const count = snap.size;
    dot.style.cssText = `position:absolute;top:4px;right:calc(50% - 16px);min-width:16px;height:16px;padding:0 4px;background:#e05252;border-radius:8px;font-size:10px;font-weight:700;color:#fff;font-family:var(--font-body);display:${count>0?"flex":"none"};align-items:center;justify-content:center;border:2px solid var(--dark2);`;
    dot.textContent = count > 0 ? (count > 9 ? "9+" : count) : "";
  });
}

// ── Render profile page ────────────────────────────────────────
async function renderProfilePage() {
  const me     = auth.currentUser;
  const meSnap = await getDoc(doc(db,"users",me.uid));
  const userData = meSnap.data() || {};

  // Count bars created and rated
  const [barsCreatedSnap, barsRatedSnap, friendReqSnap] = await Promise.all([
    getDocs(query(collection(db,"bars"),    where("createdBy","==",me.uid))),
    getDocs(query(collection(db,"ratings"), where("userId","==",me.uid))),
    getDocs(query(collection(db,"friendRequests"), where("toUid","==",me.uid), where("status","==","pending")))
  ]);

  const friendIds    = userData.friends || [];
  const barsCreated  = barsCreatedSnap.size;
  const barsRated    = barsRatedSnap.size;
  const pendingReqs  = friendReqSnap.size;
  const photo        = userData.photoURL || "";

  page.innerHTML = `
    <div style="flex:1;overflow-y:auto;">

      <!-- Header -->
      <div style="padding:24px 20px 16px;display:flex;align-items:center;gap:20px;">
        <!-- Avatar -->
        <div id="profile-avatar" style="width:80px;height:80px;border-radius:50%;background:var(--dark3);border:3px solid var(--gold);display:flex;align-items:center;justify-content:center;font-size:32px;overflow:hidden;flex-shrink:0;cursor:pointer;">
          ${photo ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;" />` : "&#129489;"}
        </div>
        <!-- Stats -->
        <div style="flex:1;display:flex;justify-content:space-around;">
          <div id="btn-friends-count" style="text-align:center;cursor:pointer;">
            <div style="font-family:var(--font-display);font-size:28px;color:var(--gold);">${friendIds.length}</div>
            <div style="font-size:11px;color:var(--muted);">Amis</div>
          </div>
          <div style="text-align:center;">
            <div style="font-family:var(--font-display);font-size:28px;color:var(--gold);">${barsRated}</div>
            <div style="font-size:11px;color:var(--muted);">Bars notes</div>
          </div>
        </div>
      </div>

      <!-- Pseudo + edit -->
      <div style="padding:0 20px 16px;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="display:flex;align-items:center;gap:4px;">
            <span style="font-weight:700;font-size:18px;">@${userData.pseudo || me.displayName}</span>
            ${verifiedBadge(userData.pseudo)}
          </div>
          <div style="color:var(--muted);font-size:13px;margin-top:2px;">${userData.name || ""}</div>
        </div>
        <button id="btn-edit-profile" style="background:var(--dark3);border:1px solid var(--border);color:var(--text);padding:8px 16px;border-radius:10px;font-size:13px;font-family:var(--font-body);cursor:pointer;">
          &#9998; Modifier
        </button>
      </div>

      <!-- Action buttons -->
      <div style="padding:0 20px;display:flex;gap:10px;margin-bottom:16px;">
        <button id="btn-add-friend" class="btn btn-secondary" style="flex:1;font-size:13px;padding:10px;">
          &#128270; Ajouter un ami
        </button>
        <button id="btn-friend-requests" class="btn btn-secondary" style="flex:1;font-size:13px;padding:10px;position:relative;">
          Demandes
          ${pendingReqs > 0 ? `<span style="position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;background:#e05252;border-radius:9px;font-size:11px;font-weight:700;color:#fff;display:flex;align-items:center;justify-content:center;padding:0 4px;">${pendingReqs}</span>` : ""}
        </button>
      </div>

      <!-- Divider -->
      <div style="height:1px;background:var(--border);margin:0 20px 16px;"></div>

      <!-- Friends list preview -->
      <div style="padding:0 20px;">
        <h3 style="font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;">Mes amis</h3>
        <div id="friends-preview" style="display:flex;flex-direction:column;gap:8px;"></div>
        ${!friendIds.length ? `<p style="color:var(--muted);font-size:13px;text-align:center;padding:16px 0;">Recherche des amis avec le bouton ci-dessus !</p>` : ""}
      </div>

    </div>
  `;

  // Load friends preview
  if (friendIds.length) loadFriendsPreview(friendIds);

  // Events
  document.getElementById("profile-avatar").addEventListener("click", openEditProfile);
  document.getElementById("btn-edit-profile").addEventListener("click", openEditProfile);
  document.getElementById("btn-add-friend").addEventListener("click", openAddFriend);
  document.getElementById("btn-friend-requests").addEventListener("click", openFriendRequests);
  document.getElementById("btn-friends-count").addEventListener("click", () => openFriendsList(friendIds));
}

// ── Friends preview list ───────────────────────────────────────
async function loadFriendsPreview(friendIds) {
  const container = document.getElementById("friends-preview");
  if (!container) return;
  for (const fid of friendIds.slice(0, 20)) {
    const s = await getDoc(doc(db,"users",fid));
    if (!s.exists()) continue;
    const f     = s.data();
    const photo = f.photoURL ? `<img src="${f.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />` : "&#129489;";
    const card  = document.createElement("div");
    card.style.cssText = "display:flex;align-items:center;gap:12px;padding:10px;border-radius:var(--radius);cursor:pointer;transition:background .15s;";
    card.innerHTML = `
      <div style="width:44px;height:44px;border-radius:50%;background:var(--dark3);border:2px solid var(--border);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">${photo}</div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;font-weight:600;font-size:14px;">@${f.pseudo}${verifiedBadge(f.pseudo)}</div>
        <div style="color:var(--muted);font-size:12px;">${f.name||""}</div>
      </div>
      <span style="color:var(--muted);font-size:18px;">&#62;</span>
    `;
    card.addEventListener("mouseenter", () => card.style.background = "var(--dark3)");
    card.addEventListener("mouseleave", () => card.style.background = "transparent");
    card.addEventListener("click", () => openFriendProfile(fid, f));
    container.appendChild(card);
  }
}

// ── Friend profile modal (also exported for messages.js) ───────
export async function openFriendProfileFromOutside(uid, userData) {
  return openFriendProfile(uid, userData);
}

async function openFriendProfile(uid, userData) {
  const [barsRatedSnap] = await Promise.all([
    getDocs(query(collection(db,"ratings"), where("userId","==",uid)))
  ]);
  const photo = userData.photoURL || "";

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:2000;display:flex;flex-direction:column;overflow-y:auto;";
  overlay.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--border);background:var(--dark);flex-shrink:0;">
      <button id="back-friend-profile" style="background:var(--dark3);border:none;color:var(--text);width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;">&#8592;</button>
      <span style="font-family:var(--font-display);font-size:22px;letter-spacing:1px;color:var(--gold);">@${userData.pseudo}</span>
    </div>
    <div style="padding:32px 20px;">
      <!-- Avatar + stats -->
      <div style="display:flex;align-items:center;gap:24px;margin-bottom:24px;">
        <div style="width:80px;height:80px;border-radius:50%;background:var(--dark3);border:3px solid var(--gold);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:32px;flex-shrink:0;">
          ${photo ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;" />` : "&#129489;"}
        </div>
        <div style="flex:1;display:flex;justify-content:space-around;">
          <div id="friend-profile-friends-count" style="text-align:center;cursor:pointer;" data-uid="${uid}">
            <div style="font-family:var(--font-display);font-size:28px;color:var(--gold);">${(userData.friends||[]).length}</div>
            <div style="font-size:11px;color:var(--muted);text-decoration:underline dotted;">Amis</div>
          </div>
          <div style="text-align:center;">
            <div style="font-family:var(--font-display);font-size:28px;color:var(--gold);">${barsRatedSnap.size}</div>
            <div style="font-size:11px;color:var(--muted);">Bars notes</div>
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <span style="font-weight:700;font-size:18px;">@${userData.pseudo}</span>
        ${verifiedBadge(userData.pseudo)}
      </div>
      <div style="color:var(--muted);font-size:13px;margin-bottom:24px;">${userData.name||""}</div>

      <!-- Rated bars -->
      <h3 style="font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;">Bars notes</h3>
      <div id="friend-bars-rated" style="display:flex;flex-direction:column;gap:8px;">
        <p style="color:var(--muted);font-size:13px;">Chargement...</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("back-friend-profile").addEventListener("click", () => overlay.remove());

  // Click on friend count → show their friends list
  document.getElementById("friend-profile-friends-count").addEventListener("click", () => {
    openFriendOfFriendList(uid, userData.friends || [], userData.pseudo);
  });

  // Load friend's rated bars
  const ratedContainer = document.getElementById("friend-bars-rated");
  const ratings = barsRatedSnap.docs.map(d => d.data()).sort((a,b) => b.globalScore - a.globalScore);
  if (!ratings.length) {
    ratedContainer.innerHTML = `<p style="color:var(--muted);font-size:13px;">Pas encore de notes.</p>`;
  } else {
    ratedContainer.innerHTML = "";
    ratings.slice(0, 10).forEach((r, i) => {
      const item = document.createElement("div");
      item.style.cssText = "display:flex;align-items:center;gap:12px;padding:12px;background:var(--card);border-radius:var(--radius);border:1px solid var(--border);";
      item.innerHTML = `
        <div style="font-family:var(--font-display);font-size:22px;color:var(--gold);min-width:28px;">#${i+1}</div>
        <div style="flex:1;font-weight:600;font-size:14px;">${r.barName}</div>
        <div style="font-family:var(--font-display);font-size:22px;color:var(--gold);">${r.globalScore.toFixed(1)}</div>
      `;
      ratedContainer.appendChild(item);
    });
  }
}

// ── Friends list modal ─────────────────────────────────────────
async function openFriendsList(friendIds) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:24px;";
  overlay.innerHTML = `
    <div style="background:var(--dark2);border-radius:24px;padding:24px;width:100%;max-width:360px;border:1px solid var(--border);max-height:80vh;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="font-family:var(--font-display);font-size:24px;color:var(--gold);">MES AMIS</h3>
        <button id="close-friends-list" style="background:var(--dark3);border:none;color:var(--muted);width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;">&#10005;</button>
      </div>
      <div id="full-friends-list" style="overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:8px;">
        <p style="color:var(--muted);font-size:13px;">Chargement...</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("close-friends-list").addEventListener("click", () => overlay.remove());

  const container = document.getElementById("full-friends-list");
  container.innerHTML = "";
  for (const fid of friendIds) {
    const s = await getDoc(doc(db,"users",fid));
    if (!s.exists()) continue;
    const f     = s.data();
    const photo = f.photoURL ? `<img src="${f.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />` : "&#129489;";
    const item  = document.createElement("div");
    item.style.cssText = "display:flex;align-items:center;gap:12px;padding:10px;border-radius:var(--radius);cursor:pointer;transition:background .15s;";
    item.innerHTML = `
      <div style="width:40px;height:40px;border-radius:50%;background:var(--dark3);border:2px solid var(--border);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:16px;">${photo}</div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;font-weight:600;font-size:14px;">@${f.pseudo}${verifiedBadge(f.pseudo)}</div>
        <div style="color:var(--muted);font-size:12px;">${f.name||""}</div>
      </div>
    `;
    item.addEventListener("mouseenter", () => item.style.background = "var(--dark3)");
    item.addEventListener("mouseleave", () => item.style.background = "transparent");
    item.addEventListener("click", () => { overlay.remove(); openFriendProfile(fid, f); });
    container.appendChild(item);
  }
}

// ── Friend-of-friend list (with add button) ────────────────────
async function openFriendOfFriendList(ownerUid, friendIds, ownerPseudo) {
  const me = auth.currentUser;
  const meSnap = await getDoc(doc(db,"users",me.uid));
  const myFriendIds = meSnap.data()?.friends || [];

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:3000;display:flex;align-items:center;justify-content:center;padding:24px;";
  overlay.innerHTML = `
    <div style="background:var(--dark2);border-radius:24px;padding:24px;width:100%;max-width:360px;border:1px solid var(--border);max-height:80vh;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="font-family:var(--font-display);font-size:22px;color:var(--gold);">AMIS DE @${ownerPseudo}</h3>
        <button id="close-fof-list" style="background:var(--dark3);border:none;color:var(--muted);width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;">&#10005;</button>
      </div>
      <div id="fof-list" style="overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:8px;">
        <p style="color:var(--muted);font-size:13px;">Chargement...</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("close-fof-list").addEventListener("click", () => overlay.remove());

  const container = document.getElementById("fof-list");
  if (!friendIds.length) { container.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;padding:16px;">Aucun ami pour l'instant.</p>`; return; }

  container.innerHTML = "";
  for (const fid of friendIds) {
    if (fid === me.uid) continue; // skip yourself
    const s = await getDoc(doc(db,"users",fid));
    if (!s.exists()) continue;
    const f = s.data();
    const photo = f.photoURL ? `<img src="${f.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />` : "&#129489;";
    const isAlreadyFriend = myFriendIds.includes(fid);
    const item = document.createElement("div");
    item.style.cssText = "display:flex;align-items:center;gap:12px;padding:10px;border-radius:var(--radius);cursor:pointer;transition:background .15s;";
    item.innerHTML = `
      <div style="width:40px;height:40px;border-radius:50%;background:var(--dark3);border:2px solid var(--border);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:16px;">${photo}</div>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;font-weight:600;font-size:14px;">@${f.pseudo}${verifiedBadge(f.pseudo)}</div>
        <div style="color:var(--muted);font-size:12px;">${f.name||""}</div>
      </div>
      ${!isAlreadyFriend ? `<button data-uid="${fid}" data-pseudo="${f.pseudo}" class="btn-add-fof" style="background:var(--gold);border:none;color:var(--dark);padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-body);">+ Ajouter</button>` : `<span style="font-size:11px;color:var(--muted);">Ami</span>`}
    `;
    item.addEventListener("mouseenter", () => item.style.background = "var(--dark3)");
    item.addEventListener("mouseleave", () => item.style.background = "transparent");
    // Click on row → view their profile
    item.addEventListener("click", e => {
      if (e.target.classList.contains("btn-add-fof")) return;
      overlay.remove(); openFriendProfile(fid, f);
    });
    container.appendChild(item);
  }

  // Bind add buttons
  container.querySelectorAll(".btn-add-fof").forEach(btn => {
    btn.addEventListener("click", async e => {
      e.stopPropagation();
      await sendFriendRequest(btn.dataset.uid, btn.dataset.pseudo);
      btn.textContent = "Demande envoyee !"; btn.disabled = true; btn.style.opacity = "0.6";
    });
  });
}

// ── Add friend ─────────────────────────────────────────────────
function openAddFriend() {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:24px;";
  overlay.innerHTML = `
    <div style="background:var(--dark2);border-radius:24px;padding:24px;width:100%;max-width:360px;border:1px solid var(--border);">
      <h3 style="font-family:var(--font-display);font-size:24px;color:var(--gold);margin-bottom:16px;">AJOUTER UN AMI</h3>
      <div style="position:relative;">
        <input id="search-pseudo-input" class="input" placeholder="Rechercher un pseudo..." style="padding-right:48px;" />
        <button id="btn-search-pseudo" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:var(--gold);border:none;color:var(--dark);width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:16px;">&#128269;</button>
      </div>
      <div id="search-results-profile" style="margin-top:12px;"></div>
      <button id="close-add-friend" class="btn btn-ghost" style="margin-top:12px;">Fermer</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("close-add-friend").addEventListener("click", () => overlay.remove());
  document.getElementById("btn-search-pseudo").addEventListener("click", () => searchByPseudo(overlay));
  document.getElementById("search-pseudo-input").addEventListener("keydown", e => { if (e.key==="Enter") searchByPseudo(overlay); });
}

async function searchByPseudo(overlay) {
  const input     = overlay.querySelector("#search-pseudo-input").value.trim().toLowerCase();
  const resultsEl = overlay.querySelector("#search-results-profile");
  if (!input) return;
  resultsEl.innerHTML = `<p style="color:var(--muted);font-size:13px;">Recherche...</p>`;
  const q    = query(collection(db,"users"), where("pseudo",">=",input), where("pseudo","<=",input+"\uf8ff"));
  const snap = await getDocs(q);
  const me   = auth.currentUser;
  if (snap.empty) { resultsEl.innerHTML = `<p style="color:var(--muted);font-size:13px;">Aucun utilisateur trouve.</p>`; return; }
  resultsEl.innerHTML = "";
  snap.forEach(d => {
    if (d.id === me.uid) return;
    const u     = d.data();
    const photo = u.photoURL ? `<img src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />` : "&#129489;";
    const card  = document.createElement("div");
    card.style.cssText = "display:flex;align-items:center;gap:12px;padding:12px;background:var(--card);border-radius:var(--radius);margin-bottom:8px;border:1px solid var(--border);";
    card.innerHTML = `
      <div style="width:40px;height:40px;border-radius:50%;background:var(--dark3);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:16px;">${photo}</div>
      <div style="flex:1;"><div style="font-weight:600;font-size:14px;display:flex;align-items:center;">@${u.pseudo}${verifiedBadge(u.pseudo)}</div><div style="color:var(--muted);font-size:12px;">${u.name||""}</div></div>
      <button data-uid="${d.id}" data-pseudo="${u.pseudo}" class="btn-add-req btn btn-primary" style="width:auto;padding:8px 14px;font-size:12px;">Ajouter</button>
    `;
    resultsEl.appendChild(card);
  });
  resultsEl.querySelectorAll(".btn-add-req").forEach(btn => {
    btn.addEventListener("click", async () => {
      await sendFriendRequest(btn.dataset.uid, btn.dataset.pseudo);
      btn.textContent = "Demande envoyee !"; btn.disabled = true; btn.style.opacity = "0.6";
    });
  });
}

async function sendFriendRequest(toUid, toPseudo) {
  const me     = auth.currentUser;
  const meData = await getDoc(doc(db,"users",me.uid));
  const mePseudo = meData.data()?.pseudo || me.displayName;
  const existing = await getDocs(query(collection(db,"friendRequests"), where("fromUid","==",me.uid), where("toUid","==",toUid)));
  if (!existing.empty) return;
  await addDoc(collection(db,"friendRequests"), { fromUid:me.uid, fromPseudo:mePseudo, toUid, toPseudo, status:"pending", createdAt:serverTimestamp() });
}

// ── Friend requests modal ──────────────────────────────────────
async function openFriendRequests() {
  const me     = auth.currentUser;
  const snap   = await getDocs(query(collection(db,"friendRequests"), where("toUid","==",me.uid), where("status","==","pending")));
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:24px;";
  overlay.innerHTML = `
    <div style="background:var(--dark2);border-radius:24px;padding:24px;width:100%;max-width:360px;border:1px solid var(--border);max-height:80vh;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="font-family:var(--font-display);font-size:24px;color:var(--gold);">DEMANDES</h3>
        <button id="close-requests" style="background:var(--dark3);border:none;color:var(--muted);width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;">&#10005;</button>
      </div>
      <div id="requests-list" style="overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:8px;"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("close-requests").addEventListener("click", () => overlay.remove());

  const container = document.getElementById("requests-list");
  if (snap.empty) { container.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;padding:16px;">Aucune demande en attente.</p>`; return; }

  snap.forEach(d => {
    const req  = d.data();
    const card = document.createElement("div");
    card.style.cssText = "display:flex;align-items:center;gap:12px;padding:14px;background:var(--card);border-radius:var(--radius);border:1px solid var(--border);";
    card.innerHTML = `
      <div style="width:42px;height:42px;border-radius:50%;background:var(--dark3);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:18px;">&#129489;</div>
      <div style="flex:1;"><div style="font-weight:600;font-size:14px;">@${req.fromPseudo}${verifiedBadge(req.fromPseudo)}</div><div style="color:var(--muted);font-size:12px;">souhaite vous ajouter</div></div>
      <div style="display:flex;gap:6px;">
        <button data-id="${d.id}" data-from="${req.fromUid}" class="btn-accept" style="background:var(--gold);border:none;color:var(--dark);padding:8px 12px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;">&#10003;</button>
        <button data-id="${d.id}" class="btn-decline" style="background:var(--dark3);border:1px solid var(--border);color:var(--muted);padding:8px 12px;border-radius:8px;font-size:13px;cursor:pointer;">&#10005;</button>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll(".btn-accept").forEach(btn => {
    btn.addEventListener("click", async () => {
      const me = auth.currentUser;
      await updateDoc(doc(db,"users",me.uid), { friends: arrayUnion(btn.dataset.from) });
      await updateDoc(doc(db,"users",btn.dataset.from), { friends: arrayUnion(me.uid) });
      await updateDoc(doc(db,"friendRequests",btn.dataset.id), { status:"accepted" });
      // Create conversation
      const q = query(collection(db,"conversations"), where("members","array-contains",me.uid));
      const existing = await getDocs(q);
      let found = false;
      existing.forEach(d => { if (!d.data().isGroup && d.data().members.includes(btn.dataset.from)) found = true; });
      if (!found) await addDoc(collection(db,"conversations"), { members:[me.uid,btn.dataset.from], isGroup:false, lastMessage:"", updatedAt:serverTimestamp() });
      btn.closest("div[style]").remove();
      renderProfilePage();
    });
  });
  container.querySelectorAll(".btn-decline").forEach(btn => {
    btn.addEventListener("click", async () => {
      await updateDoc(doc(db,"friendRequests",btn.dataset.id), { status:"declined" });
      btn.closest("div[style]").remove();
    });
  });
}

// ── Edit profile ───────────────────────────────────────────────
async function openEditProfile() {
  const user     = auth.currentUser;
  const userSnap = await getDoc(doc(db,"users",user.uid));
  const userData = userSnap.data() || {};

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto;";
  overlay.innerHTML = `
    <div style="background:var(--dark2);border-radius:24px;padding:24px;width:100%;max-width:360px;border:1px solid var(--border);">
      <h3 style="font-family:var(--font-display);font-size:24px;color:var(--gold);margin-bottom:20px;">MON PROFIL</h3>
      <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:20px;gap:12px;">
        <div id="avatar-preview" style="width:90px;height:90px;border-radius:50%;background:var(--dark3);border:3px solid var(--gold);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:36px;cursor:pointer;">
          ${userData.photoURL ? `<img src="${userData.photoURL}" style="width:100%;height:100%;object-fit:cover;" />` : "&#129489;"}
        </div>
        <input type="file" id="photo-input" accept="image/*" style="display:none;" />
        <button id="btn-change-photo" style="background:var(--dark3);border:1px solid var(--border);color:var(--text);padding:8px 16px;border-radius:8px;font-size:13px;cursor:pointer;font-family:var(--font-body);">Changer la photo</button>
        <p id="photo-status" style="font-size:11px;color:var(--muted);"></p>
      </div>
      <input id="profile-pseudo" class="input" value="${userData.pseudo||user.displayName||""}" placeholder="Pseudo" style="margin-bottom:12px;" />
      <button id="btn-save-profile" class="btn btn-primary" style="margin-bottom:8px;">Enregistrer</button>
      <button id="close-profile" class="btn btn-ghost">Annuler</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("close-profile").addEventListener("click", () => overlay.remove());
  document.getElementById("btn-change-photo").addEventListener("click", () => document.getElementById("photo-input").click());
  document.getElementById("avatar-preview").addEventListener("click", () => document.getElementById("photo-input").click());

  let newPhotoBase64 = null;
  document.getElementById("photo-input").addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return;
    const statusEl = document.getElementById("photo-status");
    if (file.size > 5*1024*1024) { statusEl.textContent="Trop grande (max 5Mo)."; statusEl.style.color="var(--danger)"; return; }
    statusEl.textContent="Compression..."; statusEl.style.color="var(--muted)";
    const base64 = await compressImage(file, 120, 0.6);
    const sizeKB = Math.round(base64.length*0.75/1024);
    newPhotoBase64 = base64;
    document.getElementById("avatar-preview").innerHTML = `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    statusEl.textContent = sizeKB > 500 ? `Encore grande (${sizeKB}Ko)` : `Prete ! (${sizeKB}Ko)`;
    statusEl.style.color = sizeKB > 500 ? "var(--danger)" : "var(--gold)";
  });

  document.getElementById("btn-save-profile").addEventListener("click", async () => {
    const pseudo  = document.getElementById("profile-pseudo").value.trim().toLowerCase();
    const saveBtn = document.getElementById("btn-save-profile");
    const statusEl = document.getElementById("photo-status");
    if (!pseudo) return;
    saveBtn.textContent = "Sauvegarde..."; saveBtn.disabled = true;
    try {
      const timeout = setTimeout(() => { saveBtn.textContent="Enregistrer"; saveBtn.disabled=false; statusEl.textContent="Delai depasse."; statusEl.style.color="var(--danger)"; }, 10000);
      if (pseudo !== userData.pseudo) {
        const snap = await getDocs(query(collection(db,"users"), where("pseudo","==",pseudo)));
        if (!snap.empty) { clearTimeout(timeout); saveBtn.textContent="Enregistrer"; saveBtn.disabled=false; statusEl.textContent="Pseudo deja pris."; statusEl.style.color="var(--danger)"; return; }
      }
      const { updateProfile } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
      await updateProfile(user, { displayName: pseudo });
      const updates = { pseudo }; if (newPhotoBase64) updates.photoURL = newPhotoBase64;
      await updateDoc(doc(db,"users",user.uid), updates);
      clearTimeout(timeout); overlay.remove(); renderProfilePage();
    } catch(e) { saveBtn.textContent="Enregistrer"; saveBtn.disabled=false; statusEl.textContent="Erreur. Reessaie."; statusEl.style.color="var(--danger)"; }
  });
}

function compressImage(file, maxSize, quality=0.6) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w=img.width, h=img.height;
        if(w>h){if(w>maxSize){h=Math.round(h*maxSize/w);w=maxSize;}}else{if(h>maxSize){w=Math.round(w*maxSize/h);h=maxSize;}}
        canvas.width=w; canvas.height=h;
        canvas.getContext("2d").drawImage(img,0,0,w,h);
        const MAX=200*1024; let q=quality; let result=canvas.toDataURL("image/jpeg",q);
        while(result.length>MAX&&q>0.1){q=Math.round((q-0.1)*10)/10;result=canvas.toDataURL("image/jpeg",q);}
        if(result.length>MAX){const c2=document.createElement("canvas");c2.width=Math.round(w*.5);c2.height=Math.round(h*.5);c2.getContext("2d").drawImage(canvas,0,0,c2.width,c2.height);result=c2.toDataURL("image/jpeg",.5);}
        resolve(result);
      };
      img.src=e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
