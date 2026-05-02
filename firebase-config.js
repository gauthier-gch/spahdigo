// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCYdhB6xJkzfw-nAcuwQpQ0CnlRnzDbKAg",
  authDomain:        "spahdigo.firebaseapp.com",
  projectId:         "spahdigo",
  storageBucket:     "spahdigo.firebasestorage.app",
  messagingSenderId: "166460779875",
  appId:             "1:166460779875:web:aa1ca8e70db13e2222f756"
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
