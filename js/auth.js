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
    document.getElementById(`${tab.dataset.tab}-form`).classList.add("active");
  });
});

// Login
document.getElementById("btn-login").addEventListener("click", async () => {
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl    = document.getElementById("auth-error");
  errEl.textContent = "";
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    errEl.textContent = "Email ou mot de passe incorrect.";
  }
});

// Register
document.getElementById("btn-register").addEventListener("click", async () => {
  const name     = document.getElementById("reg-name").value.trim();
  const email    = document.getElementById("reg-email").value.trim();
  const phone    = document.getElementById("reg-phone").value.trim();
  const password = document.getElementById("reg-password").value;
  const errEl    = document.getElementById("auth-error");
  errEl.textContent = "";
  if (!name || !email || !phone || !password) {
    errEl.textContent = "Veuillez remplir tous les champs.";
    return;
  }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, "users", cred.user.uid), {
      name, email, phone,
      createdAt: serverTimestamp(),
      friends: []
    });
  } catch (e) {
    errEl.textContent = e.code === "auth/email-already-in-use"
      ? "Cet email est dÃ©jÃ  utilisÃ©."
      : "Erreur lors de l'inscription.";
  }
});

// Auth state listener â†’ show/hide screens
onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById("auth-screen").classList.remove("active");
    document.getElementById("app-screen").classList.add("active");
    // Dispatch event so other modules know user is ready
    window.dispatchEvent(new CustomEvent("user-ready", { detail: user }));
  } else {
    document.getElementById("auth-screen").classList.add("active");
    document.getElementById("app-screen").classList.remove("active");
  }
});
