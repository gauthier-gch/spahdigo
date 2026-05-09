// js/bar-details.js — Shared bar details modal (analytics + friend profile)
import { db } from "./firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const CRITERIA = [
  { key:"prix_biere",            label:"Prix Bière"            },
  { key:"prix_vin",              label:"Prix Vin"              },
  { key:"gout_vin",              label:"Goût Vin"              },
  { key:"ambiance",              label:"Ambiance"              },
  { key:"plage_hh",              label:"Plage HH"              },
  { key:"distance_maison",       label:"Distance Maison"       },
  { key:"distance_travail",      label:"Distance Travail"      },
  { key:"beaute",                label:"Beauté"                },
  { key:"variete_carte",         label:"Variété Carte"         },
  { key:"viabilite_saisonniere", label:"Viabilité Saisonnière" },
  { key:"places",                label:"Places"                },
  { key:"toilettes",             label:"Toilettes"             },
];

export async function openBarDetailsModal(barId, barName) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.8);backdrop-filter:blur(6px);z-index:3500;display:flex;align-items:flex-end;";
  overlay.innerHTML = `
    <div style="background:var(--dark2);border-radius:24px 24px 0 0;width:100%;max-height:88vh;display:flex;flex-direction:column;border-top:1px solid var(--border);animation:fadeInUp .2s ease;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 20px 16px;border-bottom:1px solid var(--border);flex-shrink:0;">
        <h2 style="font-family:var(--font-display);font-size:22px;color:var(--gold);letter-spacing:0.5px;">${barName}</h2>
        <button id="close-bar-details" style="background:var(--dark3);border:none;color:var(--muted);width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">&#10005;</button>
      </div>
      <div id="bar-details-body" style="flex:1;overflow-y:auto;padding:20px;">
        <p style="color:var(--muted);font-size:13px;text-align:center;padding:20px 0;">Chargement...</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("close-bar-details").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });

  // Fetch all ratings for this bar
  const snap = await getDocs(query(collection(db, "ratings"), where("barId", "==", barId)));
  const ratings = snap.docs.map(d => d.data())
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const totalReviews = ratings.length;
  const avgScore = totalReviews > 0
    ? ratings.reduce((s, r) => s + (r.globalScore || 0), 0) / totalReviews
    : null;

  // Per-criteria averages (skip criteria marked as skipped)
  const criteriaRows = CRITERIA.map(c => {
    const scores = ratings
      .filter(r => r.scores?.[c.key] !== undefined && !r.skipped?.includes(c.key))
      .map(r => r.scores[c.key]);
    return { ...c, avg: scores.length ? scores.reduce((a,b)=>a+b,0)/scores.length : null };
  }).filter(c => c.avg !== null);

  const comments = ratings.filter(r => r.comment);

  const criteriaHTML = criteriaRows.length ? `
    <h3 style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Notes par critère</h3>
    <div style="background:var(--dark3);border-radius:14px;padding:0 16px;margin-bottom:24px;border:1px solid var(--border);">
      ${criteriaRows.map((c, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;${i<criteriaRows.length-1?'border-bottom:1px solid var(--border);':''}">
          <span style="font-size:13px;color:var(--muted);">${c.label}</span>
          <span style="font-family:var(--font-display);font-size:18px;color:var(--gold);">${c.avg.toFixed(1)}</span>
        </div>
      `).join("")}
    </div>
  ` : "";

  const commentsHTML = comments.length ? `
    <h3 style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Commentaires</h3>
    ${comments.slice(0, 8).map(r => `
      <div style="padding:10px 12px;background:var(--dark3);border-radius:10px;border-left:2px solid var(--gold);margin-bottom:8px;">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px;display:flex;align-items:center;gap:4px;">
          <strong style="color:var(--text);">${r.userName}</strong>
          <span>·</span>
          <span style="color:var(--gold);">${r.globalScore?.toFixed(1)}/10</span>
        </div>
        <div style="font-size:13px;color:var(--text);line-height:1.5;">${r.comment}</div>
      </div>
    `).join("")}
  ` : `<p style="color:var(--muted);font-size:13px;text-align:center;padding:16px 0;">Aucun commentaire pour l'instant.</p>`;

  document.getElementById("bar-details-body").innerHTML = `
    <!-- Stats overview -->
    <div style="display:flex;gap:12px;margin-bottom:24px;">
      <div style="flex:1;background:var(--dark3);border-radius:14px;padding:18px;text-align:center;border:1px solid var(--border);">
        <div style="font-family:var(--font-display);font-size:42px;color:var(--gold);">${avgScore !== null ? avgScore.toFixed(1) : "—"}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px;text-transform:uppercase;letter-spacing:1px;">Note moyenne</div>
      </div>
      <div style="flex:1;background:var(--dark3);border-radius:14px;padding:18px;text-align:center;border:1px solid var(--border);">
        <div style="font-family:var(--font-display);font-size:42px;color:var(--gold);">${totalReviews}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px;text-transform:uppercase;letter-spacing:1px;">Avis</div>
      </div>
    </div>
    ${criteriaHTML}
    ${commentsHTML}
  `;
}
