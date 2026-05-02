// js/app.js

// ── Bottom navigation ──────────────────────────────────────────
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.page;

    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.getElementById(`page-${target}`).classList.add("active");

    // Leaflet needs a nudge when its container was hidden
    if (target === "map" && window._leafletMap) {
      setTimeout(() => window._leafletMap.invalidateSize(), 50);
    }
  });
});

// ── Service Worker (PWA offline support) ──────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
