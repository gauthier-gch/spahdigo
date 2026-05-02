// js/social.js
import { db, auth } from "./firebase-config.js";
import {
  collection, query, where, getDocs, doc, getDoc,
  addDoc, setDoc, updateDoc, deleteDoc,
  serverTimestamp, onSnapshot, orderBy, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const page = document.getElementById("page-social");

window.addEventListener("user-ready", () => {
  renderSocialPage();
});

// ── Render base layout ─────────────────────────────────────────
function renderSocialPage() {
  page.innerHTML = `
    <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px 0;">
      <h2 class="page-title">SOCIAL</h2>
      <button id="btn-edit-profile" style="background:var(--dark3);border:1px solid var(--border);color:var(--text);padding:8px 14px;border-radius:50px;font-size:13px;font-family:var(--font-body);cursor:pointer;">
        &#9998; Mon profil
      </button>
    </div>

    <!-- Tabs -->
    <div style="display:flex;gap:0;padding:14px 20px 0;">
      <button class="social-tab active" data-tab="friends" style="flex:1;padding:10px;border:none;border-bottom:2px solid var(--gold);background:transparent;color:var(--gold);font-family:var(--font-body);font-weight:600;font-size:13px;cursor:pointer;">
        Amis
      </button>
      <button class="social-tab" data-tab="requests" style="flex:1;padding:10px;border:none;border-bottom:2px solid var(--border);background:transparent;color:var(--muted);font-family:var(--font-body);font-weight:600;font-size:13px;cursor:pointer;">
        Demandes <span id="requests-badge"></span>
      </button>
      <button class="social-tab" data-tab="messages" style="flex:1;padding:10px;border:none;border-bottom:2px solid var(--border);background:transparent;color:var(--muted);font-family:var(--font-body);font-weight:600;font-size:13px;cursor:pointer;">
        Messages
      </button>
    </div>

    <!-- Search bar (visible on friends tab) -->
    <div id="friend-search-bar" style="padding:12px 20px 0;">
      <div style="position:relative;">
        <input id="search-pseudo-input" class="input" placeholder="Rechercher un pseudo..." style="padding-right:48px;" />
        <button id="btn-search-pseudo" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:var(--gold);border:none;color:var(--dark);width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:16px;">&#128269;</button>
      </div>
      <div id="search-results-social" style="margin-top:8px;"></div>
    </div>

    <!-- Tab content -->
    <div id="tab-friends"   class="social-tab-content" style="flex:1;overflow-y:auto;padding:12px 20px;"></div>
    <div id="tab-requests"  class="social-tab-content" style="display:none;flex:1;overflow-y:auto;padding:12px 20px;"></div>
    <div id="tab-messages"  class="social-tab-content" style="display:none;flex:1;overflow-y:auto;padding:12px 20px;"></div>
  `;

  // Tab switching
  document.querySelectorAll(".social-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".social-tab").forEach(t => {
        t.style.borderBottomColor = "var(--border)";
        t.style.color = "var(--muted)";
        t.classList.remove("active");
      });
      tab.style.borderBottomColor = "var(--gold)";
      tab.style.color = "var(--gold)";
      tab.classList.add("active");

      document.querySelectorAll(".social-tab-content").forEach(c => c.style.display = "none");
      document.getElementById("tab-" + tab.dataset.tab).style.display = "block";

      // Hide search bar on messages tab
      document.getElementById("friend-search-bar").style.display =
        tab.dataset.tab === "messages" ? "none" : "block";

      if (tab.dataset.tab === "requests") loadRequests();
      if (tab.dataset.tab === "messages") loadConversations();
    });
  });

  document.getElementById("btn-edit-profile").addEventListener("click", openEditProfile);
  document.getElementById("btn-search-pseudo").addEventListener("click", searchByPseudo);
  document.getElementById("search-pseudo-input").addEventListener("keydown", e => {
    if (e.key === "Enter") searchByPseudo();
  });

  loadFriends();
  loadPendingRequestsCount();
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

  if (snap.empty) {
    resultsEl.innerHTML = `<p style="color:var(--muted);font-size:13px;">Aucun utilisateur trouve.</p>`;
    return;
  }

  resultsEl.innerHTML = "";
  snap.forEach(d => {
    if (d.id === me.uid) return; // skip self
    const u = d.data();
    const card = document.createElement("div");
    card.style.cssText = "display:flex;align-items:center;gap:12px;padding:12px;background:var(--card);border-radius:var(--radius);margin-bottom:8px;border:1px solid var(--border);";
    card.innerHTML = `
      <div class="avatar" style="width:40px;height:40px;font-size:16px;">&#129489;</div>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:14px;">@${u.pseudo}</div>
        <div style="color:var(--muted);font-size:12px;">${u.name || ""}</div>
      </div>
      <button data-uid="${d.id}" data-pseudo="${u.pseudo}" class="btn-add-friend btn btn-primary" style="width:auto;padding:8px 14px;font-size:12px;">
        Ajouter
      </button>
    `;
    resultsEl.appendChild(card);
  });

  // Bind add buttons
  resultsEl.querySelectorAll(".btn-add-friend").forEach(btn => {
    btn.addEventListener("click", async () => {
      await sendFriendRequest(btn.dataset.uid, btn.dataset.pseudo);
      btn.textContent = "Demande envoyee !";
      btn.disabled = true;
      btn.style.opacity = "0.6";
    });
  });
}

// ── Friend requests ────────────────────────────────────────────
async function sendFriendRequest(toUid, toPseudo) {
  const me = auth.currentUser;
  const meData = await getDoc(doc(db, "users", me.uid));
  const mePseudo = meData.data()?.pseudo || me.displayName;

  // Check not already sent
  const existing = await getDocs(query(
    collection(db, "friendRequests"),
    where("fromUid", "==", me.uid),
    where("toUid", "==", toUid)
  ));
  if (!existing.empty) return;

  await addDoc(collection(db, "friendRequests"), {
    fromUid: me.uid,
    fromPseudo: mePseudo,
    toUid,
    toPseudo,
    status: "pending",
    createdAt: serverTimestamp()
  });
}

async function loadPendingRequestsCount() {
  const me = auth.currentUser;
  const q = query(
    collection(db, "friendRequests"),
    where("toUid", "==", me.uid),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  const badge = document.getElementById("requests-badge");
  if (badge && snap.size > 0) {
    badge.textContent = ` (${snap.size})`;
    badge.style.color = "var(--gold)";
  }
}

async function loadRequests() {
  const me = auth.currentUser;
  const container = document.getElementById("tab-requests");
  container.innerHTML = `<p style="color:var(--muted);font-size:13px;">Chargement...</p>`;

  const q = query(
    collection(db, "friendRequests"),
    where("toUid", "==", me.uid),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    container.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;padding-top:24px;">Aucune demande en attente.</p>`;
    return;
  }

  container.innerHTML = "";
  snap.forEach(d => {
    const req = d.data();
    const card = document.createElement("div");
    card.style.cssText = "display:flex;align-items:center;gap:12px;padding:14px;background:var(--card);border-radius:var(--radius);margin-bottom:10px;border:1px solid var(--border);";
    card.innerHTML = `
      <div class="avatar" style="width:42px;height:42px;font-size:17px;">&#129489;</div>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:14px;">@${req.fromPseudo}</div>
        <div style="color:var(--muted);font-size:12px;">souhaite vous ajouter</div>
      </div>
      <div style="display:flex;gap:6px;">
        <button data-id="${d.id}" data-from="${req.fromUid}" class="btn-accept" style="background:var(--gold);border:none;color:var(--dark);padding:8px 12px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;">&#10003;</button>
        <button data-id="${d.id}" class="btn-decline" style="background:var(--dark3);border:1px solid var(--border);color:var(--muted);padding:8px 12px;border-radius:8px;font-size:13px;cursor:pointer;">&#10005;</button>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll(".btn-accept").forEach(btn => {
    btn.addEventListener("click", async () => {
      await acceptRequest(btn.dataset.id, btn.dataset.from);
      btn.closest("div[style]").remove();
      loadFriends();
    });
  });
  container.querySelectorAll(".btn-decline").forEach(btn => {
    btn.addEventListener("click", async () => {
      await declineRequest(btn.dataset.id);
      btn.closest("div[style]").remove();
    });
  });
}

async function acceptRequest(requestId, fromUid) {
  const me = auth.currentUser;
  // Add each other as friends
  await updateDoc(doc(db, "users", me.uid), { friends: arrayUnion(fromUid) });
  await updateDoc(doc(db, "users", fromUid), { friends: arrayUnion(me.uid) });
  // Mark request as accepted
  await updateDoc(doc(db, "friendRequests", requestId), { status: "accepted" });
  // Create conversation
  await createConversation(me.uid, fromUid);
}

async function declineRequest(requestId) {
  await updateDoc(doc(db, "friendRequests", requestId), { status: "declined" });
}

async function createConversation(uid1, uid2) {
  // Check if already exists
  const q = query(collection(db, "conversations"), where("members", "array-contains", uid1));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    if (d.data().members.includes(uid2)) return d.id;
  }
  const ref = await addDoc(collection(db, "conversations"), {
    members: [uid1, uid2],
    isGroup: false,
    lastMessage: "",
    updatedAt: serverTimestamp()
  });
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

  if (!friendIds.length) {
    container.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;padding-top:24px;">
      Recherchez des amis par pseudo ci-dessus !
    </p>`;
    return;
  }

  container.innerHTML = "";
  for (const fid of friendIds) {
    const fSnap = await getDoc(doc(db, "users", fid));
    if (!fSnap.exists()) continue;
    const f = fSnap.data();
    const card = document.createElement("div");
    card.style.cssText = "display:flex;align-items:center;gap:12px;padding:12px;border-radius:var(--radius);margin-bottom:6px;cursor:pointer;transition:background .15s;";
    card.innerHTML = `
      <div class="avatar" style="width:44px;height:44px;font-size:18px;">&#129489;</div>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:14px;">@${f.pseudo}</div>
        <div style="color:var(--muted);font-size:12px;">${f.name || ""}</div>
      </div>
      <button data-uid="${fid}" data-pseudo="${f.pseudo}" class="btn-message" style="background:var(--dark3);border:1px solid var(--border);color:var(--text);padding:8px 14px;border-radius:8px;font-size:12px;cursor:pointer;">
        &#128172; Message
      </button>
    `;
    card.addEventListener("mouseenter", () => card.style.background = "var(--dark3)");
    card.addEventListener("mouseleave", () => card.style.background = "transparent");
    container.appendChild(card);
  }

  container.querySelectorAll(".btn-message").forEach(btn => {
    btn.addEventListener("click", async () => {
      const convoId = await createConversation(me.uid, btn.dataset.uid);
      openChat(convoId, "@" + btn.dataset.pseudo);
    });
  });
}

// ── Conversations list ─────────────────────────────────────────
async function loadConversations() {
  const me = auth.currentUser;
  const container = document.getElementById("tab-messages");
  container.innerHTML = `<p style="color:var(--muted);font-size:13px;">Chargement...</p>`;

  const q = query(collection(db, "conversations"), where("members", "array-contains", me.uid));
  const snap = await getDocs(q);

  if (snap.empty) {
    container.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;padding-top:24px;">
      Ajoutez des amis pour commencer a discuter !
    </p>`;
    return;
  }

  container.innerHTML = "";
  for (const d of snap.docs) {
    const convo = d.data();
    // Get other member's pseudo
    const otherId = convo.members.find(uid => uid !== me.uid);
    let otherPseudo = "Conversation";
    if (otherId) {
      const otherSnap = await getDoc(doc(db, "users", otherId));
      if (otherSnap.exists()) otherPseudo = "@" + (otherSnap.data().pseudo || otherId);
    }

    const item = document.createElement("div");
    item.style.cssText = "display:flex;align-items:center;gap:14px;padding:12px;border-radius:var(--radius);cursor:pointer;transition:background .15s;margin-bottom:4px;";
    item.innerHTML = `
      <div class="avatar" style="width:46px;height:46px;font-size:18px;">&#129489;</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:14px;">${otherPseudo}</div>
        <div style="color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${convo.lastMessage || "Commencer la discussion..."}
        </div>
      </div>
    `;
    item.addEventListener("mouseenter", () => item.style.background = "var(--dark3)");
    item.addEventListener("mouseleave", () => item.style.background = "transparent");
    item.addEventListener("click", () => openChat(d.id, otherPseudo));
    container.appendChild(item);
  }
}

// ── Chat ───────────────────────────────────────────────────────
function openChat(convoId, title) {
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

  document.getElementById("back-chat").addEventListener("click", () => {
    unsub();
    overlay.remove();
    loadConversations();
  });

  const msgArea = document.getElementById("messages-area");

  // Live messages
  const msgsQ = query(
    collection(db, "conversations", convoId, "messages"),
    orderBy("createdAt")
  );
  const unsub = onSnapshot(msgsQ, snap => {
    msgArea.innerHTML = "";
    snap.forEach(m => {
      const msg  = m.data();
      const isMe = msg.userId === auth.currentUser.uid;
      const div  = document.createElement("div");
      div.style.cssText = `
        max-width:75%;align-self:${isMe ? "flex-end" : "flex-start"};
        background:${isMe ? "var(--gold)" : "var(--card)"};
        color:${isMe ? "var(--dark)" : "var(--text)"};
        padding:10px 14px;
        border-radius:${isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px"};
        font-size:14px;word-break:break-word;
      `;
      div.textContent = msg.text;
      msgArea.appendChild(div);
    });
    msgArea.scrollTop = msgArea.scrollHeight;
  });

  // Send message
  async function sendMessage() {
    const input = document.getElementById("msg-input");
    const text  = input.value.trim();
    if (!text) return;
    input.value = "";
    const me = auth.currentUser;
    await addDoc(collection(db, "conversations", convoId, "messages"), {
      text,
      userId:   me.uid,
      userName: me.displayName,
      createdAt: serverTimestamp()
    });
    // Update last message on conversation
    await updateDoc(doc(db, "conversations", convoId), {
      lastMessage: text,
      updatedAt: serverTimestamp()
    });
  }

  document.getElementById("send-msg").addEventListener("click", sendMessage);
  document.getElementById("msg-input").addEventListener("keydown", e => {
    if (e.key === "Enter") sendMessage();
  });
}

// ── Edit profile ───────────────────────────────────────────────
function openEditProfile() {
  const user = auth.currentUser;
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:2000;display:flex;align-items:center;justify-content:center;padding:24px;";
  overlay.innerHTML = `
    <div style="background:var(--dark2);border-radius:24px;padding:24px;width:100%;max-width:360px;border:1px solid var(--border);">
      <h3 style="font-family:var(--font-display);font-size:24px;color:var(--gold);margin-bottom:16px;">Mon profil</h3>
      <input id="profile-pseudo" class="input" value="${user.displayName || ""}" placeholder="Pseudo" style="margin-bottom:12px;" />
      <button id="btn-save-profile" class="btn btn-primary" style="margin-bottom:8px;">Enregistrer</button>
      <button id="close-profile" class="btn btn-ghost">Annuler</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("close-profile").addEventListener("click", () => overlay.remove());
  document.getElementById("btn-save-profile").addEventListener("click", async () => {
    const pseudo = document.getElementById("profile-pseudo").value.trim();
    if (!pseudo) return;
    const { updateProfile } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    await updateProfile(user, { displayName: pseudo });
    await updateDoc(doc(db, "users", user.uid), { pseudo });
    overlay.remove();
    alert("Profil mis a jour !");
  });
}
