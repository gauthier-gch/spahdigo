// js/social.js
import { db, auth } from "./firebase-config.js";
import {
  collection, query, where, getDocs, doc, getDoc,
  addDoc, serverTimestamp, onSnapshot, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const page = document.getElementById("page-social");

window.addEventListener("user-ready", () => {
  renderSocialPage();
});

function renderSocialPage() {
  page.innerHTML = `
    <div class="page-header">
      <h2 class="page-title">SOCIAL</h2>
    </div>
    <div class="social-actions">
      <button class="btn btn-secondary" id="btn-edit-profile">✏️ Mon profil</button>
      <button class="btn btn-secondary" id="btn-add-friend">➕ Ajouter un ami</button>
    </div>
    <div class="section-label">Conversations</div>
    <div class="conversations-list" id="convos-list">
      <p style="color:var(--muted);padding:16px;font-size:13px;">Chargement…</p>
    </div>
  `;

  document.getElementById("btn-edit-profile").addEventListener("click", openEditProfile);
  document.getElementById("btn-add-friend").addEventListener("click", openAddFriend);

  loadConversations();
}

// ── Conversations ──────────────────────────────────────────────
async function loadConversations() {
  const user = auth.currentUser;
  if (!user) return;
  const list = document.getElementById("convos-list");

  const q = query(
    collection(db, "conversations"),
    where("members", "array-contains", user.uid)
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    list.innerHTML = `<p style="color:var(--muted);padding:16px;font-size:13px;text-align:center;">
      Pas encore de conversations.<br/>Ajoutez des amis pour commencer!
    </p>`;
    return;
  }

  list.innerHTML = "";
  snap.forEach(d => {
    const convo = d.data();
    const name = convo.isGroup
      ? convo.name
      : (convo.memberNames || []).filter(n => n !== auth.currentUser.displayName).join(", ");
    const item = document.createElement("div");
    item.className = "convo-item";
    item.innerHTML = `
      <div class="avatar">${convo.isGroup ? "👥" : "🧑"}</div>
      <div class="convo-info">
        <div class="convo-name">${name || "Conversation"}</div>
        <div class="convo-last">${convo.lastMessage || "Commencer la discussion"}</div>
      </div>
      <div class="convo-time">${formatTime(convo.updatedAt)}</div>
    `;
    item.addEventListener("click", () => openChat(d.id, name, convo));
    list.appendChild(item);
  });
}

// ── Chat ───────────────────────────────────────────────────────
function openChat(convoId, title, convo) {
  const overlay = document.createElement("div");
  overlay.style.cssText = `position:fixed;inset:0;background:var(--dark2);z-index:2000;display:flex;flex-direction:column;`;
  overlay.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--border);background:var(--dark);">
      <button id="back-chat" style="background:var(--dark3);border:none;color:var(--text);width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer;">←</button>
      <span style="font-family:var(--font-display);font-size:24px;letter-spacing:1px;color:var(--gold);">${title}</span>
    </div>
    <div id="messages-area" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;"></div>
    <div style="display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--border);padding-bottom:calc(12px + env(safe-area-inset-bottom));">
      <input id="msg-input" class="input" placeholder="Message…" style="flex:1;" />
      <button id="send-msg" class="btn btn-primary" style="width:auto;padding:12px 18px;">→</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("back-chat").addEventListener("click", () => overlay.remove());

  // Load messages live
  const msgArea = document.getElementById("messages-area");
  const msgsQ   = query(
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
        padding:10px 14px;border-radius:${isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px"};
        font-size:14px;
      `;
      div.textContent = msg.text;
      msgArea.appendChild(div);
    });
    msgArea.scrollTop = msgArea.scrollHeight;
  });

  overlay.addEventListener("remove", unsub);

  // Send message
  document.getElementById("send-msg").addEventListener("click", async () => {
    const input = document.getElementById("msg-input");
    const text  = input.value.trim();
    if (!text) return;
    input.value = "";
    await addDoc(collection(db, "conversations", convoId, "messages"), {
      text,
      userId:   auth.currentUser.uid,
      userName: auth.currentUser.displayName,
      createdAt: serverTimestamp()
    });
  });

  document.getElementById("msg-input").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("send-msg").click();
  });
}

// ── Add friend ─────────────────────────────────────────────────
function openAddFriend() {
  const overlay = document.createElement("div");
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:2000;display:flex;align-items:center;justify-content:center;padding:24px;`;
  overlay.innerHTML = `
    <div style="background:var(--dark2);border-radius:24px;padding:24px;width:100%;max-width:360px;border:1px solid var(--border);">
      <h3 style="font-family:var(--font-display);font-size:24px;color:var(--gold);margin-bottom:16px;">Ajouter un ami</h3>
      <input id="friend-email" class="input" placeholder="Email de votre ami" style="margin-bottom:12px;" />
      <button id="btn-find-friend" class="btn btn-primary" style="margin-bottom:8px;">Rechercher</button>
      <div id="friend-result"></div>
      <button id="close-add-friend" class="btn btn-ghost">Annuler</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("close-add-friend").addEventListener("click", () => overlay.remove());

  document.getElementById("btn-find-friend").addEventListener("click", async () => {
    const email  = document.getElementById("friend-email").value.trim();
    const result = document.getElementById("friend-result");
    result.innerHTML = "<p style='color:var(--muted);font-size:13px;'>Recherche...</p>";

    const q    = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) {
      result.innerHTML = "<p style='color:var(--danger);font-size:13px;'>Utilisateur introuvable.</p>";
      return;
    }
    const friendDoc  = snap.docs[0];
    const friendData = friendDoc.data();
    result.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;">
        <div class="avatar">🧑</div>
        <div style="flex:1;">
          <div style="font-weight:600;">${friendData.pseudo || friendData.name}</div>
          <div style="color:var(--muted);font-size:12px;">${friendData.email}</div>
        </div>
        <button id="btn-start-chat" class="btn btn-primary" style="width:auto;padding:10px 16px;font-size:13px;">
          Discuter
        </button>
      </div>
    `;
    document.getElementById("btn-start-chat").addEventListener("click", async () => {
      const user = auth.currentUser;
      // Check if convo already exists
      const existing = query(
        collection(db, "conversations"),
        where("members", "array-contains", user.uid)
      );
      const existSnap = await getDocs(existing);
      let existingId = null;
      existSnap.forEach(d => {
        const c = d.data();
        if (!c.isGroup && c.members.includes(friendDoc.id)) existingId = d.id;
      });

      if (!existingId) {
        const ref = await addDoc(collection(db, "conversations"), {
          members:     [user.uid, friendDoc.id],
          memberNames: [user.displayName, friendData.pseudo || friendData.name],
          isGroup:     false,
          lastMessage: "",
          updatedAt:   serverTimestamp()
        });
        existingId = ref.id;
      }
      overlay.remove();
      loadConversations();
      openChat(existingId, friendData.pseudo || friendData.name, {});
    });
  });
}

// ── Edit profile ───────────────────────────────────────────────
function openEditProfile() {
  const user = auth.currentUser;
  const overlay = document.createElement("div");
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:2000;display:flex;align-items:center;justify-content:center;padding:24px;`;
  overlay.innerHTML = `
    <div style="background:var(--dark2);border-radius:24px;padding:24px;width:100%;max-width:360px;border:1px solid var(--border);">
      <h3 style="font-family:var(--font-display);font-size:24px;color:var(--gold);margin-bottom:16px;">Mon profil</h3>
      <input id="profile-name" class="input" value="${user.displayName || ""}" placeholder="Nom" style="margin-bottom:12px;" />
      <button id="btn-save-profile" class="btn btn-primary" style="margin-bottom:8px;">Enregistrer</button>
      <button id="close-profile" class="btn btn-ghost">Annuler</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("close-profile").addEventListener("click", () => overlay.remove());
  document.getElementById("btn-save-profile").addEventListener("click", async () => {
    const name = document.getElementById("profile-name").value.trim();
    if (!name) return;
    const { updateProfile } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    await updateProfile(user, { displayName: name });
    overlay.remove();
    alert("Profil mis a jour !");
  });
}

// ── Utils ──────────────────────────────────────────────────────
function formatTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)   return "maintenant";
  if (diff < 3600) return `${Math.floor(diff/60)}min`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return d.toLocaleDateString("fr-FR", { day:"numeric", month:"short" });
}
