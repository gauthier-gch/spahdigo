// js/auth.js
import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDocs,
  collection, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { registerForNotifications } from "./notifications.js";

// Tab switching
document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab + "-form").classList.add("active");
    document.getElementById("auth-error").textContent = "";
  });
});

// Login
document.getElementById("btn-login").addEventListener("click", async () => {
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl    = document.getElementById("auth-error");
  errEl.textContent = "";
  if (!email || !password) { errEl.textContent = "Remplis tous les champs."; return; }
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    errEl.textContent = "Email ou mot de passe incorrect.";
  }
});

// Forgot password
document.getElementById("btn-forgot-password").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const errEl = document.getElementById("auth-error");
  errEl.textContent = "";
  errEl.style.color = "var(--danger)";
  if (!email) {
    errEl.textContent = "Entre ton email ci-dessus pour recevoir le lien.";
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    errEl.textContent = "Email envoye ! Verifie ta boite mail... et tes spams !";
    errEl.style.color = "var(--gold)";
  } catch (e) {
    if (e.code === "auth/user-not-found") {
      errEl.textContent = "Aucun compte trouve avec cet email. Tu peux t'inscrire !";
    } else {
      errEl.textContent = "Email invalide ou erreur. Verifie et reessaie.";
    }
  }
});

// Register
document.getElementById("btn-register").addEventListener("click", async () => {
  const pseudo    = document.getElementById("reg-pseudo").value.trim().toLowerCase();
  const firstname = document.getElementById("reg-firstname").value.trim();
  const lastname  = document.getElementById("reg-lastname").value.trim();
  const name      = firstname + " " + lastname;
  const email     = document.getElementById("reg-email").value.trim();
  const phone     = document.getElementById("reg-phone").value.trim();
  const password  = document.getElementById("reg-password").value;
  const errEl     = document.getElementById("auth-error");
  errEl.textContent = "";
  errEl.style.color = "var(--danger)";

  if (!pseudo || !firstname || !lastname || !email || !phone || !password) {
    errEl.textContent = "Veuillez remplir tous les champs."; return;
  }
  if (pseudo.length < 3) {
    errEl.textContent = "Le pseudo doit faire au moins 3 caracteres."; return;
  }
  const pseudoSnap = await getDocs(query(collection(db, "users"), where("pseudo", "==", pseudo)));
  if (!pseudoSnap.empty) {
    errEl.textContent = "Ce pseudo est deja pris, choisis-en un autre."; return;
  }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: pseudo });
    await setDoc(doc(db, "users", cred.user.uid), {
      pseudo, firstname, lastname, name, email, phone,
      photoURL: "", createdAt: serverTimestamp(), friends: []
    });
  } catch (e) {
    if (e.code === "auth/email-already-in-use") errEl.textContent = "Cet email est deja utilise.";
    else if (e.code === "auth/weak-password") errEl.textContent = "Mot de passe trop court (6 min).";
    else errEl.textContent = "Erreur lors de l inscription.";
  }
});

onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById("auth-screen").classList.remove("active");
    document.getElementById("app-screen").classList.add("active");
    window.dispatchEvent(new CustomEvent("user-ready", { detail: user }));
    // Register for push notifications
    registerForNotifications(user);
  } else {
    document.getElementById("auth-screen").classList.add("active");
    document.getElementById("app-screen").classList.remove("active");
  }
});
