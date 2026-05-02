// js/auth.js
import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

// Register
document.getElementById("btn-register").addEventListener("click", async () => {
  const pseudo   = document.getElementById("reg-pseudo").value.trim();
  const name     = document.getElementById("reg-name").value.trim();
  const email    = document.getElementById("reg-email").value.trim();
  const phone    = document.getElementById("reg-phone").value.trim();
  const password = document.getElementById("reg-password").value;
  const errEl    = document.getElementById("auth-error");
  errEl.textContent = "";

  if (!pseudo || !name || !email || !phone || !password) {
    errEl.textContent = "Veuillez remplir tous les champs.";
    return;
  }
  if (pseudo.length < 3) {
    errEl.textContent = "Le pseudo doit faire au moins 3 caracteres.";
    return;
  }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Store pseudo as displayName so it shows everywhere in the app
    await updateProfile(cred.user, { displayName: pseudo });
    await setDoc(doc(db, "users", cred.user.uid), {
      pseudo, name, email, phone,
      createdAt: serverTimestamp(),
      friends: []
    });
  } catch (e) {
    if (e.code === "auth/email-already-in-use") {
      errEl.textContent = "Cet email est deja utilise.";
    } else if (e.code === "auth/weak-password") {
      errEl.textContent = "Mot de passe trop court (6 caracteres min).";
    } else {
      errEl.textContent = "Erreur lors de l inscription.";
    }
  }
});

// Auth state listener
onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById("auth-screen").classList.remove("active");
    document.getElementById("app-screen").classList.add("active");
    window.dispatchEvent(new CustomEvent("user-ready", { detail: user }));
  } else {
    document.getElementById("auth-screen").classList.add("active");
    document.getElementById("app-screen").classList.remove("active");
  }
});
