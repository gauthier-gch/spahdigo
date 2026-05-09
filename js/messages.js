// js/messages.js — Messages page (conversations + create group)
import { db, auth } from "./firebase-config.js";
import {
  collection, query, where, getDocs, doc, getDoc,
  addDoc, updateDoc, serverTimestamp, onSnapshot,
  orderBy, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const page = document.getElementById("page-messages");

window.addEventListener("user-ready", () => {
  renderMessagesPage();
  listenForUnreadMessages();
});

// ── Unread badge on nav ────────────────────────────────────────
function listenForUnreadMessages() {
  const me = auth.currentUser;
  const q  = query(collection(db, "conversations"), where("members","array-contains",me.uid));
  onSnapshot(q, snap => {
    let unread = 0;
    snap.forEach(d => { if (d.data().unreadBy?.includes(me.uid)) unread++; });
    const btn = document.querySelector('.nav-btn[data-page="messages"]');
    if (!btn) return;
    let dot = btn.querySelector(".nav-badge");
    if (!dot) { dot = document.createElement("span"); dot.className = "nav-badge"; btn.appendChild(dot); }
    dot.style.cssText = `position:absolute;top:4px;right:calc(50% - 16px);min-width:16px;height:16px;padding:0 4px;background:#e05252;border-radius:8px;font-size:10px;font-weight:700;color:#fff;font-family:var(--font-body);display:${unread>0?"flex":"none"};align-items:center;justify-content:center;border:2px solid var(--dark2);`;
    dot.textContent = unread > 0 ? (unread > 9 ? "9+" : unread) : "";
  });
}

// ── Render messages page ───────────────────────────────────────
function renderMessagesPage() {
  page.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px 12px;flex-shrink:0;">
      <h2 class="page-title">MESSAGES</h2>
      <button id="btn-new-group" style="background:var(--dark3);border:1px solid var(--border);color:var(--text);padding:8px 14px;border-radius:50px;font-size:13px;font-family:var(--font-body);cursor:pointer;">
        &#128101; Nouveau groupe
      </button>
    </div>
    <div id="convos-list" style="flex:1;overflow-y:auto;padding:0 12px 12px;"></div>
  `;
  document.getElementById("btn-new-group").addEventListener("click", openCreateGroup);
  loadConversations();
}

// ── Load conversations ─────────────────────────────────────────
async function loadConversations() {
  const me = auth.currentUser;
  const list = document.getElementById("convos-list");
  if (!list) return;
  list.innerHTML = `<p style="color:var(--muted);font-size:13px;padding:16px;">Chargement...</p>`;

  const q    = query(collection(db,"conversations"), where("members","array-contains",me.uid), orderBy("updatedAt","desc"));
  const snap = await getDocs(q);

  if (snap.empty) {
    list.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;padding:32px 16px;">
      Pas encore de conversations.<br/>Ajoutez des amis depuis votre profil !
    </p>`;
    return;
  }

  list.innerHTML = "";
  for (const d of snap.docs) {
    const convo = d.data();
    let displayName, photoHTML;

    if (convo.isGroup) {
      displayName = convo.name || "Groupe";
      photoHTML   = `<span style="font-size:22px;">&#128101;</span>`;
    } else {
      const otherId = convo.members.find(uid => uid !== me.uid);
      let pseudo = "Conversation", photo = "";
      if (otherId) {
        const s = await getDoc(doc(db,"users",otherId));
        if (s.exists()) { pseudo = "@" + s.data().pseudo; photo = s.data().photoURL || ""; }
      }
      displayName = pseudo;
      photoHTML   = photo ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />` : "&#129489;";
    }

    const isUnread = convo.unreadBy?.includes(me.uid);
    const otherId  = convo.isGroup ? null : convo.members.find(uid => uid !== me.uid);
    const item = document.createElement("div");
    item.style.cssText = "display:flex;align-items:center;gap:14px;padding:12px;border-radius:var(--radius);cursor:pointer;transition:background .15s;margin-bottom:4px;";
    item.innerHTML = `
      <div id="avatar-${d.id}" style="width:50px;height:50px;border-radius:50%;background:var(--dark3);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;overflow:hidden;position:relative;cursor:${otherId?"pointer":"default"};">
        ${photoHTML}
        ${isUnread ? `<span style="position:absolute;top:-2px;right:-2px;width:14px;height:14px;background:#e05252;border-radius:50%;border:2px solid var(--dark2);"></span>` : ""}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:${isUnread?"700":"600"};font-size:14px;">${displayName}</div>
        <div style="color:${isUnread?"var(--text)":"var(--muted)"};font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:${isUnread?"600":"400"};">
          ${convo.lastMessage || "Commencer la discussion..."}
        </div>
      </div>
      <div style="font-size:11px;color:var(--muted);flex-shrink:0;">${formatTime(convo.updatedAt)}</div>
    `;
    item.addEventListener("mouseenter", () => item.style.background = "var(--dark3)");
    item.addEventListener("mouseleave", () => item.style.background = "transparent");

    // Click on avatar → view friend profile (only for 1-on-1 convos)
    if (otherId) {
      const avatarEl = item.querySelector(`#avatar-${d.id}`);
      if (avatarEl) {
        avatarEl.addEventListener("click", async e => {
          e.stopPropagation();
          const fSnap = await getDoc(doc(db,"users",otherId));
          if (fSnap.exists()) {
            // Dynamically import openFriendProfile from profile.js
            const { openFriendProfileFromOutside } = await import("./profile.js");
            openFriendProfileFromOutside(otherId, fSnap.data());
          }
        });
      }
    }

    // Click on row → open chat
    item.addEventListener("click", async e => {
      if (e.target.closest(`#avatar-${d.id}`)) return; // handled above
      if (isUnread) {
        const { arrayRemove } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await updateDoc(doc(db,"conversations",d.id), { unreadBy: arrayRemove(me.uid) });
      }
      openChat(d.id, displayName, convo.isGroup);
    });
    list.appendChild(item);
  }
}

// ── Chat ───────────────────────────────────────────────────────
function openChat(convoId, title, isGroup = false) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:var(--dark2);z-index:2000;display:flex;flex-direction:column;";
  overlay.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--border);background:var(--dark);flex-shrink:0;">
      <button id="back-chat" style="background:var(--dark3);border:none;color:var(--text);width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;">&#8592;</button>
      <span style="font-family:var(--font-display);font-size:24px;letter-spacing:1px;color:var(--gold);">${title}</span>
    </div>
    <div id="messages-area" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px;"></div>
    <div style="display:flex;gap:8px;padding:12px 16px;border-top:1px solid var(--border);padding-bottom:calc(12px + env(safe-area-inset-bottom));flex-shrink:0;">
      <input id="msg-input" class="input" placeholder="Message..." style="flex:1;" />
      <button id="send-msg" class="btn btn-primary" style="width:auto;padding:12px 18px;">&#10148;</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("back-chat").addEventListener("click", () => { unsub(); overlay.remove(); loadConversations(); });

  const msgArea     = document.getElementById("messages-area");
  const senderCache = {};

  async function getSender(uid) {
    if (senderCache[uid]) return senderCache[uid];
    try { const s = await getDoc(doc(db,"users",uid)); senderCache[uid] = s.exists() ? s.data() : {}; }
    catch(_) { senderCache[uid] = {}; }
    return senderCache[uid];
  }

  let rendering = false, pendingRender = null;
  const msgsQ = query(collection(db,"conversations",convoId,"messages"), orderBy("createdAt"));
  const unsub  = onSnapshot(msgsQ, snap => { pendingRender = snap; if (!rendering) doRender(); });

  async function doRender() {
    if (!pendingRender) return;
    rendering = true;
    const snap = pendingRender; pendingRender = null;
    const wasAtBottom = msgArea.scrollHeight - msgArea.scrollTop - msgArea.clientHeight < 60;
    msgArea.innerHTML = "";
    for (const m of snap.docs) {
      const msg  = m.data();
      if (!msg.createdAt) continue;
      const isMe = msg.userId === auth.currentUser.uid;
      const div  = document.createElement("div");
      div.style.cssText = `max-width:75%;align-self:${isMe?"flex-end":"flex-start"};display:flex;flex-direction:column;gap:3px;`;
      if (isGroup && !isMe) {
        const sd = await getSender(msg.userId);
        const photo = sd.photoURL ? `<img src="${sd.photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />` : "&#129489;";
        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:2px;";
        row.innerHTML = `<div style="width:22px;height:22px;border-radius:50%;background:var(--dark3);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;">${photo}</div><span style="font-size:11px;color:var(--muted);font-weight:600;">@${sd.pseudo||msg.userName||"?"}</span>`;
        div.appendChild(row);
      }
      const bubble = document.createElement("div");
      bubble.style.cssText = `background:${isMe?"var(--gold)":"var(--card)"};color:${isMe?"var(--dark)":"var(--text)"};padding:10px 14px;border-radius:${isMe?"18px 18px 4px 18px":"18px 18px 18px 4px"};font-size:14px;word-break:break-word;`;
      bubble.textContent = msg.text;
      div.appendChild(bubble);
      msgArea.appendChild(div);
    }
    if (wasAtBottom) msgArea.scrollTop = msgArea.scrollHeight;
    rendering = false;
    if (pendingRender) doRender();
  }

  async function sendMessage() {
    const input = document.getElementById("msg-input");
    const text  = input.value.trim(); if (!text) return;
    input.value = "";
    const me = auth.currentUser;
    await addDoc(collection(db,"conversations",convoId,"messages"), { text, userId:me.uid, userName:me.displayName, createdAt:serverTimestamp() });
    const cSnap   = await getDoc(doc(db,"conversations",convoId));
    const members = cSnap.data()?.members || [];
    await updateDoc(doc(db,"conversations",convoId), { lastMessage:text, lastSenderId:me.uid, unreadBy:members.filter(u=>u!==me.uid), updatedAt:serverTimestamp() });
  }

  document.getElementById("send-msg").addEventListener("click", sendMessage);
  document.getElementById("msg-input").addEventListener("keydown", e => { if (e.key==="Enter") sendMessage(); });
}

// ── Create group ───────────────────────────────────────────────
async function openCreateGroup() {
  const me     = auth.currentUser;
  const meSnap = await getDoc(doc(db,"users",me.uid));
  const friendIds = meSnap.data()?.friends || [];
  if (!friendIds.length) { alert("Ajoutez des amis depuis votre profil avant de creer un groupe !"); return; }

  const friends = [];
  for (const fid of friendIds) { const s = await getDoc(doc(db,"users",fid)); if (s.exists()) friends.push({uid:fid,...s.data()}); }

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:2000;display:flex;align-items:center;justify-content:center;padding:24px;";
  overlay.innerHTML = `
    <div style="background:var(--dark2);border-radius:24px;padding:24px;width:100%;max-width:360px;border:1px solid var(--border);max-height:80vh;overflow-y:auto;">
      <h3 style="font-family:var(--font-display);font-size:26px;color:var(--gold);margin-bottom:16px;letter-spacing:2px;">NOUVEAU GROUPE</h3>
      <p style="color:var(--muted);font-size:12px;margin-bottom:12px;">Seuls tes amis peuvent etre ajoutes au groupe.</p>
      <input id="group-name-input" class="input" placeholder="Nom du groupe (ex: Barathon)" style="margin-bottom:16px;" />
      <p style="font-size:12px;color:var(--muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">Ajouter des amis</p>
      <div id="friend-checkboxes" style="margin-bottom:16px;">
        ${friends.map(f=>`
          <label style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:10px;cursor:pointer;">
            <input type="checkbox" value="${f.uid}" style="width:18px;height:18px;accent-color:var(--gold);cursor:pointer;" />
            <span style="font-size:14px;font-weight:500;">@${f.pseudo}</span>
          </label>
        `).join("")}
      </div>
      <button id="btn-confirm-group" class="btn btn-primary" style="margin-bottom:8px;">Creer le groupe</button>
      <button id="btn-cancel-group" class="btn btn-ghost">Annuler</button>
      <p id="group-error" style="color:var(--danger);font-size:13px;margin-top:8px;text-align:center;"></p>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("btn-cancel-group").addEventListener("click", () => overlay.remove());
  document.getElementById("btn-confirm-group").addEventListener("click", async () => {
    const name    = document.getElementById("group-name-input").value.trim();
    const errEl   = document.getElementById("group-error");
    const checked = [...overlay.querySelectorAll("input[type=checkbox]:checked")].map(c=>c.value);
    if (!name)           { errEl.textContent = "Donne un nom au groupe."; return; }
    if (!checked.length) { errEl.textContent = "Selectionne au moins un ami."; return; }
    await addDoc(collection(db,"conversations"), { name, members:[me.uid,...checked], isGroup:true, lastMessage:"", updatedAt:serverTimestamp() });
    overlay.remove();
    loadConversations();
  });
}

function formatTime(ts) {
  if (!ts) return "";
  const d   = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)    return "maintenant";
  if (diff < 3600)  return `${Math.floor(diff/60)}min`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return d.toLocaleDateString("fr-FR", { day:"numeric", month:"short" });
}
