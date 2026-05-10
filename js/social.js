// js/social.js
import { db, auth } from "./firebase-config.js";
import {
  collection, query, where, getDocs, doc, getDoc,
  addDoc, updateDoc, serverTimestamp, onSnapshot,
  orderBy, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const page = document.getElementById("page-social");

// ── Verified users ─────────────────────────────────────────────
const VERIFIED_PSEUDOS = ["gauthier"];

function verifiedBadge(pseudo) {
  if (!pseudo || !VERIFIED_PSEUDOS.includes(pseudo.toLowerCase())) return "";
  return `<span onclick="event.stopPropagation();showCertifTooltip(this)"
    style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;background:#1d9bf0;border-radius:50%;margin-left:4px;font-size:10px;vertical-align:middle;flex-shrink:0;cursor:pointer;">&#10003;</span>`;
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
  setTimeout(() => { document.addEventListener("click", () => tooltip.remove(), { once: true }); }, 50);
};

window.addEventListener("user-ready", () => {
  processAcceptedRequests();
  renderSocialPage();
  listenForBadges();
});

// ── Live badge listeners ───────────────────────────────────────
function listenForBadges() {
  const me = auth.currentUser;

  // Friend request badge
  const reqQ = query(collection(db, "friendRequests"), where("toUid","==",me.uid), where("status","==","pending"));
  onSnapshot(reqQ, snap => {
    const count = snap.size;
    const badge = document.getElementById("requests-badge");
    if (badge) {
      badge.textContent = count > 0 ? (count > 9 ? "9+" : count) : "";
      badge.style.display = count > 0 ? "inline-flex" : "none";
    }
    updateTotalBadge();
  });

  // Unread messages: convos where lastSenderId != me AND unreadBy contains me
  const convoQ = query(collection(db, "conversations"), where("members","array-contains",me.uid));
  onSnapshot(convoQ, snap => {
    let unread = 0;
    snap.forEach(d => {
      const data = d.data();
      if (data.unreadBy && data.unreadBy.includes(me.uid)) unread++;
    });
    // Update messages tab badge
    const msgBadge = document.getElementById("msg-tab-badge");
    if (msgBadge) {
      msgBadge.textContent = unread > 0 ? unread : "";
      msgBadge.style.display = unread > 0 ? "inline-flex" : "none";
    }
    updateTotalBadge();
  });
}

// Updates the nav dot + iPhone home screen badge
function updateTotalBadge() {
  const me = auth.currentUser;
  if (!me) return;

  // Count pending requests
  getDocs(query(collection(db,"friendRequests"), where("toUid","==",me.uid), where("status","==","pending"))).then(reqSnap => {
    getDocs(query(collection(db,"conversations"), where("members","array-contains",me.uid))).then(convoSnap => {
      let unreadMsgs = 0;
      convoSnap.forEach(d => { if (d.data().unreadBy?.includes(me.uid)) unreadMsgs++; });
      const total = reqSnap.size + unreadMsgs;

      // Red dot on Social nav button
      const btn = document.querySelector('.nav-btn[data-page="social"]');
      if (btn) {
        let dot = btn.querySelector(".nav-badge");
        if (!dot) { dot = document.createElement("span"); dot.className = "nav-badge"; btn.appendChild(dot); }
        dot.style.cssText = `
          position:absolute;top:4px;right:calc(50% - 18px);
          min-width:16px;height:16px;padding:0 4px;
          background:#e05252;border-radius:8px;
          font-size:10px;font-weight:700;color:#fff;
          font-family:var(--font-body);
          display:${total > 0 ? "flex" : "none"};
          align-items:center;justify-content:center;
          border:2px solid var(--dark2);
        `;
        dot.textContent = total > 0 ? (total > 9 ? "9+" : total) : "";
      }

      // iPhone home screen badge (Badging API)
      // On iOS, this requires notification permission first
      if ("setAppBadge" in navigator) {
        if (total > 0) navigator.setAppBadge(total).catch(()=>{});
        else navigator.clearAppBadge().catch(()=>{});
      }
    });
  });
}

// Request notification permission (needed for app badge on iOS)
export function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") return;
  if (Notification.permission === "denied") return;
  // Must be triggered by a user gesture — call this on first login
  Notification.requestPermission();
}

function updateNavBadge(page, count) {} // kept for compatibility

// ── Render base layout ─────────────────────────────────────────
function renderSocialPage() {
  page.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px 0;">
      <h2 class="page-title">SOCIAL</h2>
      <button id="btn-edit-profile" style="background:var(--dark3);border:1px solid var(--border);color:var(--text);padding:8px 14px;border-radius:50px;font-size:13px;font-family:var(--font-body);cursor:pointer;">&#9998; Mon profil</button>
    </div>

    <div style="display:flex;padding:14px 20px 0;">
      <button class="social-tab active" data-tab="friends" style="flex:1;padding:10px;border:none;border-bottom:2px solid var(--gold);background:transparent;color:var(--gold);font-family:var(--font-body);font-weight:600;font-size:13px;cursor:pointer;">Amis</button>
      <button class="social-tab" data-tab="requests" style="flex:1;padding:10px;border:none;border-bottom:2px solid var(--border);background:transparent;color:var(--muted);font-family:var(--font-body);font-weight:600;font-size:13px;cursor:pointer;position:relative;">
        Demandes
        <span id="requests-badge" style="display:none;position:absolute;top:4px;right:8px;min-width:16px;height:16px;padding:0 4px;background:#e05252;border-radius:8px;font-size:10px;font-weight:700;color:#fff;font-family:var(--font-body);align-items:center;justify-content:center;"></span>
      </button>
      <button class="social-tab" data-tab="messages" style="flex:1;padding:10px;border:none;border-bottom:2px solid var(--border);background:transparent;color:var(--muted);font-family:var(--font-body);font-weight:600;font-size:13px;cursor:pointer;position:relative;">
        Messages
        <span id="msg-tab-badge" style="display:none;position:absolute;top:4px;right:8px;min-width:16px;height:16px;padding:0 4px;background:#e05252;border-radius:8px;font-size:10px;font-weight:700;color:#fff;font-family:var(--font-body);align-items:center;justify-content:center;"></span>
      </button>
    </div>

    <div id="friend-search-bar" style="padding:12px 20px 0;">
      <div style="position:relative;">
        <input id="search-pseudo-input" class="input" placeholder="Rechercher un pseudo..." style="padding-right:48px;" />
        <button id="btn-search-pseudo" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:var(--gold);border:none;color:var(--dark);width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:16px;">&#128269;</button>
      </div>
      <div id="search-results-social" style="margin-top:8px;"></div>
    </div>

    <div id="messages-toolbar" style="display:none;padding:12px 20px 0;">
      <button id="btn-create-group" class="btn btn-secondary" style="font-size:13px;padding:10px;">&#128101; Creer un groupe</button>
    </div>

    <div id="tab-friends"  class="social-tab-content" style="flex:1;overflow-y:auto;padding:12px 20px;"></div>
    <div id="tab-requests" class="social-tab-content" style="display:none;flex:1;overflow-y:auto;padding:12px 20px;"></div>
    <div id="tab-messages" class="social-tab-content" style="display:none;flex:1;overflow-y:auto;padding:12px 20px;"></div>
  `;

  document.querySelectorAll(".social-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".social-tab").forEach(t => { t.style.borderBottomColor="var(--border)"; t.style.color="var(--muted)"; t.classList.remove("active"); });
      tab.style.borderBottomColor = "var(--gold)"; tab.style.color = "var(--gold)"; tab.classList.add("active");
      document.querySelectorAll(".social-tab-content").forEach(c => c.style.display = "none");
      document.getElementById("tab-" + tab.dataset.tab).style.display = "block";
      document.getElementById("friend-search-bar").style.display = tab.dataset.tab === "friends" ? "block" : "none";
      document.getElementById("messages-toolbar").style.display = tab.dataset.tab === "messages" ? "block" : "none";
      if (tab.dataset.tab === "requests") loadRequests();
      if (tab.dataset.tab === "messages") loadConversations();
    });
  });

  document.getElementById("btn-edit-profile").addEventListener("click", openEditProfile);
  document.getElementById("btn-search-pseudo").addEventListener("click", searchByPseudo);
  document.getElementById("search-pseudo-input").addEventListener("keydown", e => { if (e.key === "Enter") searchByPseudo(); });
  setTimeout(() => { const b = document.getElementById("btn-create-group"); if (b) b.addEventListener("click", openCreateGroup); }, 0);

  loadFriends();
}

// ── Search by pseudo ───────────────────────────────────────────
async function searchByPseudo() {
  const input = document.getElementById("search-pseudo-input").value.trim().toLowerCase();
  const resultsEl = document.getElementById("search-results-social");
  if (!input) return;
  resultsEl.innerHTML = `<p style="color:var(--muted);font-size:13px;">Recherche...</p>`;
  const q = query(collection(db, "users"), where("pseudo", ">=", input), where("pseudo", "<=", input + "\uf8ff"));
  const snap = await getDocs(q);
  const me = auth.currentUser;
  if (snap.empty) { resultsEl.innerHTML = `<p style="color:var(--muted);font-size:13px;">Aucun utilisateur trouve.</p>`; return; }
  resultsEl.innerHTML = "";
  snap.forEach(d => {
    if (d.id === me.uid) return;
    const u = d.data();
    const photoHTML = u.photoURL ? `<img src="${u.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />` : "&#129489;";
    const card = document.createElement("div");
    card.style.cssText = "display:flex;align-items:center;gap:12px;padding:12px;background:var(--card);border-radius:var(--radius);margin-bottom:8px;border:1px solid var(--border);";
    card.innerHTML = `
      <div class="avatar" style="width:40px;height:40px;overflow:hidden;">${photoHTML}</div>
      <div style="flex:1;"><div style="font-weight:600;font-size:14px;">@${u.pseudo}${verifiedBadge(u.pseudo)}</div><div style="color:var(--muted);font-size:12px;">${u.name||""}</div></div>
      <button data-uid="${d.id}" data-pseudo="${u.pseudo}" class="btn-add-friend btn btn-primary" style="width:auto;padding:8px 14px;font-size:12px;">Ajouter</button>
    `;
    resultsEl.appendChild(card);
  });
  resultsEl.querySelectorAll(".btn-add-friend").forEach(btn => {
    btn.addEventListener("click", async () => {
      await sendFriendRequest(btn.dataset.uid, btn.dataset.pseudo);
      btn.textContent = "Demande envoyee !"; btn.disabled = true; btn.style.opacity = "0.6";
    });
  });
}

// ── Friend requests ────────────────────────────────────────────
async function sendFriendRequest(toUid, toPseudo) {
  const me = auth.currentUser;
  const meData = await getDoc(doc(db, "users", me.uid));
  const mePseudo = meData.data()?.pseudo || me.displayName;
  const existing = await getDocs(query(collection(db, "friendRequests"), where("fromUid","==",me.uid), where("toUid","==",toUid)));
  if (!existing.empty) return;
  await addDoc(collection(db, "friendRequests"), { fromUid: me.uid, fromPseudo: mePseudo, toUid, toPseudo, status: "pending", createdAt: serverTimestamp() });
}

async function loadRequests() {
  const me = auth.currentUser;
  const container = document.getElementById("tab-requests");
  container.innerHTML = `<p style="color:var(--muted);font-size:13px;">Chargement...</p>`;
  const snap = await getDocs(query(collection(db, "friendRequests"), where("toUid","==",me.uid), where("status","==","pending")));
  if (snap.empty) { container.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;padding-top:24px;">Aucune demande en attente.</p>`; return; }
  container.innerHTML = "";
  snap.forEach(d => {
    const req = d.data();
    const card = document.createElement("div");
    card.style.cssText = "display:flex;align-items:center;gap:12px;padding:14px;background:var(--card);border-radius:var(--radius);margin-bottom:10px;border:1px solid var(--border);";
    card.innerHTML = `
      <div class="avatar" style="width:42px;height:42px;font-size:17px;">&#129489;</div>
      <div style="flex:1;"><div style="font-weight:600;font-size:14px;">@${req.fromPseudo}${verifiedBadge(req.fromPseudo)}</div><div style="color:var(--muted);font-size:12px;">souhaite vous ajouter</div></div>
      <div style="display:flex;gap:6px;">
        <button data-id="${d.id}" data-from="${req.fromUid}" class="btn-accept" style="background:var(--gold);border:none;color:var(--dark);padding:8px 12px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;">&#10003;</button>
        <button data-id="${d.id}" class="btn-decline" style="background:var(--dark3);border:1px solid var(--border);color:var(--muted);padding:8px 12px;border-radius:8px;font-size:13px;cursor:pointer;">&#10005;</button>
      </div>
    `;
    container.appendChild(card);
  });
  container.querySelectorAll(".btn-accept").forEach(btn => { btn.addEventListener("click", async () => { try { btn.disabled=true; await acceptRequest(btn.dataset.id, btn.dataset.from); btn.closest("div[style]").remove(); loadFriends(); } catch(e) { btn.disabled=false; alert("Erreur lors de l'acceptation. Réessaie."); console.error(e); } }); });
  container.querySelectorAll(".btn-decline").forEach(btn => { btn.addEventListener("click", async () => { await updateDoc(doc(db, "friendRequests", btn.dataset.id), { status: "declined" }); btn.closest("div[style]").remove(); }); });
}

async function acceptRequest(requestId, fromUid) {
  const me = auth.currentUser;
  // Only update own document — Firestore rules forbid writing to another user's doc.
  // The sender's side is handled by processAcceptedRequests() on their next app load.
  await updateDoc(doc(db, "users", me.uid), { friends: arrayUnion(fromUid) });
  await updateDoc(doc(db, "friendRequests", requestId), { status: "accepted" });
  await createConversation(me.uid, fromUid);
}

async function processAcceptedRequests() {
  const me = auth.currentUser;
  const snap = await getDocs(query(
    collection(db, "friendRequests"),
    where("fromUid", "==", me.uid),
    where("status", "==", "accepted")
  ));
  for (const d of snap.docs) {
    const req = d.data();
    await updateDoc(doc(db, "users", me.uid), { friends: arrayUnion(req.toUid) });
    await updateDoc(doc(db, "friendRequests", d.id), { status: "processed" });
    await createConversation(me.uid, req.toUid);
  }
}

async function createConversation(uid1, uid2) {
  const q = query(collection(db, "conversations"), where("members", "array-contains", uid1));
  const snap = await getDocs(q);
  for (const d of snap.docs) { if (!d.data().isGroup && d.data().members.includes(uid2)) return d.id; }
  const ref = await addDoc(collection(db, "conversations"), { members: [uid1, uid2], isGroup: false, lastMessage: "", updatedAt: serverTimestamp() });
  return ref.id;
}

// ── Friends list ───────────────────────────────────────────────
async function loadFriends() {
  const me = auth.currentUser;
  const container = document.getElementById("tab-friends");
  if (!container) return;
  container.innerHTML = `<p style="color:var(--muted);font-size:13px;">Chargement...</p>`;
  const meSnap = await getDoc(doc(db, "users", me.uid));
  const friendIds = meSnap.data()?.friends || [];
  if (!friendIds.length) { container.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;padding-top:24px;">Recherchez des amis par pseudo ci-dessus !</p>`; return; }
  container.innerHTML = "";
  for (const fid of friendIds) {
    const fSnap = await getDoc(doc(db, "users", fid));
    if (!fSnap.exists()) continue;
    const f = fSnap.data();
    const photoHTML = f.photoURL ? `<img src="${f.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />` : "&#129489;";
    const card = document.createElement("div");
    card.style.cssText = "display:flex;align-items:center;gap:12px;padding:12px;border-radius:var(--radius);margin-bottom:6px;cursor:pointer;transition:background .15s;";
    card.innerHTML = `
      <div class="avatar" style="width:44px;height:44px;overflow:hidden;">${photoHTML}</div>
      <div style="flex:1;"><div style="font-weight:600;font-size:14px;display:flex;align-items:center;">@${f.pseudo}${verifiedBadge(f.pseudo)}</div><div style="color:var(--muted);font-size:12px;">${f.name||""}</div></div>
      <button data-uid="${fid}" data-pseudo="${f.pseudo}" class="btn-message" style="background:var(--dark3);border:1px solid var(--border);color:var(--text);padding:8px 14px;border-radius:8px;font-size:12px;cursor:pointer;">&#128172; Message</button>
    `;
    card.addEventListener("mouseenter", () => card.style.background = "var(--dark3)");
    card.addEventListener("mouseleave", () => card.style.background = "transparent");
    container.appendChild(card);
  }
  container.querySelectorAll(".btn-message").forEach(btn => {
    btn.addEventListener("click", async () => { const id = await createConversation(me.uid, btn.dataset.uid); openChat(id, "@" + btn.dataset.pseudo); });
  });
}

// ── Conversations list (ordered by most recent) ────────────────
async function loadConversations() {
  const me = auth.currentUser;
  const container = document.getElementById("tab-messages");
  container.innerHTML = `<p style="color:var(--muted);font-size:13px;">Chargement...</p>`;
  const q = query(collection(db, "conversations"), where("members","array-contains",me.uid), orderBy("updatedAt","desc"));
  const snap = await getDocs(q);
  if (snap.empty) { container.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;padding-top:24px;">Ajoutez des amis pour commencer a discuter !</p>`; return; }
  container.innerHTML = "";
  for (const d of snap.docs) {
    const convo = d.data();
    let displayName, photoHTML;
    if (convo.isGroup) {
      displayName = convo.name || "Groupe";
      photoHTML = `<span style="font-size:20px;">&#128101;</span>`;
    } else {
      const otherId = convo.members.find(uid => uid !== me.uid);
      let otherPseudo = "Conversation", otherPhoto = "";
      if (otherId) {
        const s = await getDoc(doc(db, "users", otherId));
        if (s.exists()) { otherPseudo = "@" + (s.data().pseudo || otherId); otherPhoto = s.data().photoURL || ""; }
      }
      displayName = otherPseudo;
      photoHTML = otherPhoto ? `<img src="${otherPhoto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />` : "&#129489;";
    }
    // Unread indicator
    const isUnread = convo.unreadBy && convo.unreadBy.includes(me.uid);
    const item = document.createElement("div");
    item.style.cssText = "display:flex;align-items:center;gap:14px;padding:12px;border-radius:var(--radius);cursor:pointer;transition:background .15s;margin-bottom:4px;";
    item.innerHTML = `
      <div class="avatar" style="width:46px;height:46px;overflow:hidden;position:relative;">
        ${photoHTML}
        ${isUnread ? `<span style="position:absolute;top:-2px;right:-2px;width:14px;height:14px;background:#e05252;border-radius:50%;border:2px solid var(--dark2);"></span>` : ""}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:${isUnread ? "700" : "600"};font-size:14px;display:flex;align-items:center;">${displayName}${convo.isGroup ? "" : verifiedBadge(displayName.replace("@",""))}</div>
        <div style="color:${isUnread ? "var(--text)" : "var(--muted)"};font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:${isUnread ? "600" : "400"};">
          ${convo.lastMessage || "Commencer la discussion..."}
        </div>
      </div>
    `;
    item.addEventListener("mouseenter", () => item.style.background = "var(--dark3)");
    item.addEventListener("mouseleave", () => item.style.background = "transparent");
    item.addEventListener("click", async () => {
      // Mark as read — remove me from unreadBy
      const { arrayRemove } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await updateDoc(doc(db, "conversations", d.id), { unreadBy: arrayRemove(me.uid) });
      openChat(d.id, displayName, convo.isGroup);
    });
    container.appendChild(item);
  }
}

// ── Chat (group shows sender name+photo) ──────────────────────
function openChat(convoId, title, isGroup = false) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:var(--dark2);z-index:2000;display:flex;flex-direction:column;";
  overlay.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--border);background:var(--dark);">
      <button id="back-chat" style="background:var(--dark3);border:none;color:var(--text);width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;">&#8592;</button>
      <span style="font-family:var(--font-display);font-size:24px;letter-spacing:1px;color:var(--gold);">${title}</span>
    </div>
    <div id="messages-area" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;"></div>
    <div style="display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--border);padding-bottom:calc(12px + env(safe-area-inset-bottom));">
      <input id="msg-input" class="input" placeholder="Message..." style="flex:1;" />
      <button id="send-msg" class="btn btn-primary" style="width:auto;padding:12px 18px;">&#10148;</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("back-chat").addEventListener("click", () => { unsub(); overlay.remove(); loadConversations(); });

  const msgArea = document.getElementById("messages-area");

  // Cache sender profiles to avoid redundant Firestore reads
  const senderCache = {};
  async function getSenderData(uid) {
    if (senderCache[uid]) return senderCache[uid];
    try {
      const s = await getDoc(doc(db, "users", uid));
      const data = s.exists() ? s.data() : {};
      senderCache[uid] = data;
      return data;
    } catch(_) { return {}; }
  }

  // Render lock — prevents concurrent async renders causing duplicates
  let rendering = false;
  let pendingRender = null;

  const msgsQ = query(
    collection(db, "conversations", convoId, "messages"),
    orderBy("createdAt")
  );

  const unsub = onSnapshot(msgsQ, snap => {
    // Store latest snap and schedule render
    pendingRender = snap;
    if (!rendering) doRender();
  });

  async function doRender() {
    if (!pendingRender) return;
    rendering = true;
    const snap = pendingRender;
    pendingRender = null;

    const wasAtBottom = msgArea.scrollHeight - msgArea.scrollTop - msgArea.clientHeight < 60;
    msgArea.innerHTML = "";

    for (const m of snap.docs) {
      const msg  = m.data();
      // Skip messages with no timestamp yet (still pending server confirmation)
      // They'll appear once Firestore confirms — avoids duplicate flicker
      if (!msg.createdAt) continue;

      const isMe = msg.userId === auth.currentUser.uid;
      const div  = document.createElement("div");
      div.style.cssText = `max-width:75%;align-self:${isMe?"flex-end":"flex-start"};display:flex;flex-direction:column;gap:3px;`;

      // Group chats: show sender name + photo for others
      if (isGroup && !isMe) {
        const sd = await getSenderData(msg.userId);
        const senderPseudo = sd.pseudo || msg.userName || "?";
        const senderPhoto = sd.photoURL
          ? `<img src="${sd.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
          : "&#129489;";
        const senderRow = document.createElement("div");
        senderRow.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:2px;";
        senderRow.innerHTML = `
          <div style="width:22px;height:22px;border-radius:50%;background:var(--dark3);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;">${senderPhoto}</div>
          <span style="font-size:11px;color:var(--muted);font-weight:600;">@${senderPseudo}</span>
        `;
        div.appendChild(senderRow);
      }

      const bubble = document.createElement("div");
      bubble.style.cssText = `background:${isMe?"var(--gold)":"var(--card)"};color:${isMe?"var(--dark)":"var(--text)"};padding:10px 14px;border-radius:${isMe?"18px 18px 4px 18px":"18px 18px 18px 4px"};font-size:14px;word-break:break-word;`;
      bubble.textContent = msg.text;
      div.appendChild(bubble);
      msgArea.appendChild(div);
    }

    // Only scroll to bottom if user was already at the bottom
    if (wasAtBottom) msgArea.scrollTop = msgArea.scrollHeight;

    rendering = false;
    // If another snapshot came in while rendering, process it now
    if (pendingRender) doRender();
  }

  async function sendMessage() {
    const input = document.getElementById("msg-input");
    const text  = input.value.trim();
    if (!text) return;
    input.value = "";
    const me = auth.currentUser;
    await addDoc(collection(db, "conversations", convoId, "messages"), {
      text, userId: me.uid, userName: me.displayName, createdAt: serverTimestamp()
    });
    const convoSnap = await getDoc(doc(db, "conversations", convoId));
    const members = convoSnap.data()?.members || [];
    const unreadBy = members.filter(uid => uid !== me.uid);
    await updateDoc(doc(db, "conversations", convoId), {
      lastMessage: text, lastSenderId: me.uid, unreadBy, updatedAt: serverTimestamp()
    });
  }

  document.getElementById("send-msg").addEventListener("click", sendMessage);
  document.getElementById("msg-input").addEventListener("keydown", e => { if (e.key === "Enter") sendMessage(); });
}

// ── Create group (with clear error messages) ───────────────────
async function openCreateGroup() {
  const me = auth.currentUser;
  const meSnap = await getDoc(doc(db, "users", me.uid));
  const friendIds = meSnap.data()?.friends || [];
  if (!friendIds.length) { alert("Ajoutez des amis avant de creer un groupe !"); return; }

  const friends = [];
  for (const fid of friendIds) {
    const s = await getDoc(doc(db, "users", fid));
    if (s.exists()) friends.push({ uid: fid, ...s.data() });
  }

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:24px;";
  const friendOptions = friends.map(f => `
    <label style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:10px;cursor:pointer;">
      <input type="checkbox" value="${f.uid}" style="width:18px;height:18px;accent-color:var(--gold);cursor:pointer;" />
      <span style="font-size:14px;font-weight:500;">@${f.pseudo}</span>
      <span style="font-size:11px;color:var(--muted);">${f.name||""}</span>
    </label>
  `).join("");

  overlay.innerHTML = `
    <div style="background:var(--dark2);border-radius:24px;padding:24px;width:100%;max-width:360px;border:1px solid var(--border);max-height:80vh;overflow-y:auto;">
      <h3 style="font-family:var(--font-display);font-size:26px;color:var(--gold);margin-bottom:16px;letter-spacing:2px;">NOUVEAU GROUPE</h3>
      <p style="color:var(--muted);font-size:12px;margin-bottom:12px;">Seuls tes amis peuvent etre ajoutes au groupe. Pour ajouter quelqu'un, sois d'abord ami avec lui.</p>
      <input id="group-name-input" class="input" placeholder="Nom du groupe (ex: Barathon)" style="margin-bottom:16px;" />
      <p style="font-size:12px;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">Ajouter des amis</p>
      <div id="friend-checkboxes" style="margin-bottom:16px;">${friendOptions}</div>
      <button id="btn-confirm-group" class="btn btn-primary" style="margin-bottom:8px;">Creer le groupe</button>
      <button id="btn-cancel-group" class="btn btn-ghost">Annuler</button>
      <p id="group-error" style="color:var(--danger);font-size:13px;margin-top:8px;text-align:center;"></p>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("btn-cancel-group").addEventListener("click", () => overlay.remove());
  document.getElementById("btn-confirm-group").addEventListener("click", async () => {
    const groupName = document.getElementById("group-name-input").value.trim();
    const errEl = document.getElementById("group-error");
    const checked = [...overlay.querySelectorAll("input[type=checkbox]:checked")].map(c => c.value);
    if (!groupName) { errEl.textContent = "Donne un nom au groupe."; return; }
    if (checked.length < 1) { errEl.textContent = "Selectionne au moins un ami."; return; }
    const members = [me.uid, ...checked];
    await addDoc(collection(db, "conversations"), { name: groupName, members, isGroup: true, lastMessage: "", updatedAt: serverTimestamp() });
    overlay.remove();
    document.querySelectorAll(".social-tab").forEach(t => { const isMsg = t.dataset.tab==="messages"; t.style.borderBottomColor=isMsg?"var(--gold)":"var(--border)"; t.style.color=isMsg?"var(--gold)":"var(--muted)"; if(isMsg)t.classList.add("active"); else t.classList.remove("active"); });
    document.querySelectorAll(".social-tab-content").forEach(c => c.style.display="none");
    document.getElementById("tab-messages").style.display="block";
    document.getElementById("friend-search-bar").style.display="none";
    document.getElementById("messages-toolbar").style.display="block";
    loadConversations();
  });
}

// ── Edit profile ───────────────────────────────────────────────
async function openEditProfile() {
  const user = auth.currentUser;
  const userSnap = await getDoc(doc(db, "users", user.uid));
  const userData = userSnap.data() || {};
  const currentPhoto = userData.photoURL || "";

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto;";
  overlay.innerHTML = `
    <div style="background:var(--dark2);border-radius:24px;padding:24px;width:100%;max-width:360px;border:1px solid var(--border);">
      <h3 style="font-family:var(--font-display);font-size:24px;color:var(--gold);margin-bottom:20px;">Mon profil</h3>
      <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:20px;gap:12px;">
        <div id="avatar-preview" style="width:90px;height:90px;border-radius:50%;background:var(--dark3);border:2px solid var(--border);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:36px;cursor:pointer;">
          ${currentPhoto ? `<img src="${currentPhoto}" style="width:100%;height:100%;object-fit:cover;" />` : "&#129489;"}
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
  document.getElementById("photo-input").addEventListener("change", async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const statusEl = document.getElementById("photo-status");
    if (file.size > 5*1024*1024) { statusEl.textContent="Image trop grande (max 5Mo)."; statusEl.style.color="var(--danger)"; return; }
    statusEl.textContent="Compression..."; statusEl.style.color="var(--muted)";
    const base64 = await compressImage(file, 120, 0.6);
    const sizeKB = Math.round(base64.length*0.75/1024);
    newPhotoBase64 = base64;
    document.getElementById("avatar-preview").innerHTML = `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    statusEl.textContent = sizeKB > 500 ? `Encore grande (${sizeKB}Ko)` : `Photo prete ! (${sizeKB}Ko)`;
    statusEl.style.color = sizeKB > 500 ? "var(--danger)" : "var(--gold)";
  });

  document.getElementById("btn-save-profile").addEventListener("click", async () => {
    const pseudo = document.getElementById("profile-pseudo").value.trim().toLowerCase();
    const saveBtn = document.getElementById("btn-save-profile");
    const statusEl = document.getElementById("photo-status");
    if (!pseudo) return;
    saveBtn.textContent="Sauvegarde..."; saveBtn.disabled=true; statusEl.textContent="";
    try {
      const timeout = setTimeout(() => { saveBtn.textContent="Enregistrer"; saveBtn.disabled=false; statusEl.textContent="Delai depasse."; statusEl.style.color="var(--danger)"; }, 10000);
      if (pseudo !== userData.pseudo) {
        const snap = await getDocs(query(collection(db, "users"), where("pseudo","==",pseudo)));
        if (!snap.empty) { clearTimeout(timeout); saveBtn.textContent="Enregistrer"; saveBtn.disabled=false; statusEl.textContent="Ce pseudo est deja pris."; statusEl.style.color="var(--danger)"; return; }
      }
      const { updateProfile } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
      await updateProfile(user, { displayName: pseudo });
      const updates = { pseudo }; if (newPhotoBase64) updates.photoURL = newPhotoBase64;
      await updateDoc(doc(db, "users", user.uid), updates);
      clearTimeout(timeout); overlay.remove(); renderSocialPage();
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
        if(result.length>MAX){const c2=document.createElement("canvas");c2.width=Math.round(w*0.5);c2.height=Math.round(h*0.5);c2.getContext("2d").drawImage(canvas,0,0,c2.width,c2.height);result=c2.toDataURL("image/jpeg",0.5);}
        resolve(result);
      };
      img.src=e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
