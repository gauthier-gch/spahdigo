// js/rating.js
import { db, auth } from "./firebase-config.js";
import { collection, addDoc, getDocs, doc, updateDoc, increment, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { loadBarsOnMap, addBarMarker } from "./map.js";

const CRITERIA = [
  { key:"prix_biere",           label:"Prix Biere",            weight:3   },
  { key:"prix_vin",             label:"Prix Vin",              weight:3   },
  { key:"gout_vin",             label:"Gout Vin",              weight:2   },
  { key:"ambiance",             label:"Ambiance",              weight:2   },
  { key:"plage_hh",             label:"Plage Happy Hour",      weight:2   },
  { key:"distance_maison",      label:"Distance Maison",       weight:3   },
  { key:"distance_travail",     label:"Distance Travail",      weight:2   },
  { key:"beaute",               label:"Beaute",                weight:1   },
  { key:"variete_carte",        label:"Variete Carte",         weight:1.5 },
  { key:"viabilite_saisonniere",label:"Viabilite Saisonniere", weight:1.5 },
  { key:"places",               label:"Places",                weight:2   },
  { key:"toilettes",            label:"Toilettes",             weight:0.5 },
];

const modal         = document.getElementById("modal-rate");
const stepSearch    = document.getElementById("step-search");
const stepCreate    = document.getElementById("step-create");
const stepRate      = document.getElementById("step-rate");
const searchInput   = document.getElementById("bar-search-input");
const searchResults = document.getElementById("bar-search-results");
const criteriaList  = document.getElementById("criteria-list");
let selectedBar = null;

window.addEventListener("open-rate-modal", () => resetToSearch());
document.getElementById("close-rate-modal").addEventListener("click", () => { modal.classList.add("hidden"); });

function resetToSearch() {
  stepSearch.classList.remove("hidden"); stepCreate.classList.add("hidden"); stepRate.classList.add("hidden");
  searchInput.value=""; searchResults.innerHTML=""; selectedBar=null;
  const c=document.getElementById("rating-comment"); if(c) c.value="";
}

let allBars=[];
async function fetchAllBars() {
  if(allBars.length>0)return;
  const snap=await getDocs(collection(db,"bars"));
  snap.forEach(d=>allBars.push({id:d.id,...d.data()}));
}

searchInput.addEventListener("input", async()=>{
  const q=searchInput.value.toLowerCase().trim(); searchResults.innerHTML=""; if(!q)return;
  await fetchAllBars();
  allBars.filter(b=>b.name.toLowerCase().includes(q)||b.address.toLowerCase().includes(q)).slice(0,6).forEach(bar=>{
    const li=document.createElement("li");
    li.innerHTML=`<div>${bar.name}</div><div class="bar-addr">${bar.address}</div>`;
    li.addEventListener("click",()=>openRateStep(bar)); searchResults.appendChild(li);
  });
});

document.getElementById("btn-create-bar").addEventListener("click",()=>{ stepSearch.classList.add("hidden"); stepCreate.classList.remove("hidden"); });
document.getElementById("btn-back-search").addEventListener("click", resetToSearch);

const addrInput=document.getElementById("new-bar-address");
const addrResults=document.getElementById("address-results");
let addrTimeout=null, selectedAddr=null;

addrInput.addEventListener("input",()=>{
  clearTimeout(addrTimeout); addrResults.innerHTML=""; selectedAddr=null; updateAddrStatus("","");
  const q=addrInput.value.trim(); if(q.length<4)return;
  addrTimeout=setTimeout(()=>searchAddress(q),500);
});

async function searchAddress(q) {
  addrResults.innerHTML=`<li style="color:var(--muted);font-size:12px;padding:10px;">Recherche...</li>`;
  try {
    const res=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`);
    const data=await res.json(); addrResults.innerHTML="";
    if(!data.length){addrResults.innerHTML=`<li style="color:var(--danger);font-size:12px;padding:10px;">Adresse introuvable. Sois plus precis.</li>`;return;}
    data.forEach(item=>{
      const li=document.createElement("li"); li.style.cssText="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px;"; li.textContent=item.display_name;
      li.addEventListener("click",()=>{ selectedAddr=item; addrInput.value=item.display_name; addrResults.innerHTML=""; updateAddrStatus("Adresse trouvee !","var(--gold)"); });
      addrResults.appendChild(li);
    });
  } catch(e){ addrResults.innerHTML=`<li style="color:var(--danger);font-size:12px;padding:10px;">Erreur reseau.</li>`; }
}

function updateAddrStatus(msg,color){ const el=document.getElementById("addr-status"); if(el){el.textContent=msg;el.style.color=color;} }

document.getElementById("btn-save-new-bar").addEventListener("click", async()=>{
  const name=document.getElementById("new-bar-name").value.trim();
  const saveBtn=document.getElementById("btn-save-new-bar");
  if(!name){alert("Donne un nom au bar !");return;}
  if(!selectedAddr){alert("Selectionne une adresse dans la liste.");return;}
  saveBtn.textContent="Enregistrement..."; saveBtn.disabled=true;
  const lat=parseFloat(selectedAddr.lat), lng=parseFloat(selectedAddr.lon), address=selectedAddr.display_name;
  const barRef=await addDoc(collection(db,"bars"),{name,address,lat,lng,createdAt:serverTimestamp(),ratingCount:0,totalScore:0});
  allBars=[];
  const bar={id:barRef.id,name,address,lat,lng};
  addBarMarker(bar.id,bar);
  saveBtn.textContent="Enregistrer et noter"; saveBtn.disabled=false;
  openRateStep(bar);
});

async function openRateStep(bar) {
  selectedBar=bar; stepSearch.classList.add("hidden"); stepCreate.classList.add("hidden"); stepRate.classList.remove("hidden");
  const user=auth.currentUser;
  const existing=await getDocs(query(collection(db,"ratings"),where("barId","==",bar.id),where("userId","==",user.uid)));
  const submitBtn=document.getElementById("btn-submit-rating");
  if(!existing.empty){
    const prev=existing.docs[0].data();
    document.getElementById("rating-bar-name").textContent=bar.name+" (modifier)";
    buildCriteriaUI(prev.scores,prev.skipped||[]);
    document.getElementById("rating-comment").value=prev.comment||"";
    submitBtn.innerHTML="Mettre a jour ma note &#127866;";
    submitBtn.dataset.existingId=existing.docs[0].id; submitBtn.dataset.existingScore=prev.globalScore;
  } else {
    document.getElementById("rating-bar-name").textContent=bar.name;
    buildCriteriaUI();
    submitBtn.innerHTML="Envoyer ma note &#127866;";
    submitBtn.dataset.existingId=""; submitBtn.dataset.existingScore="";
  }
}

function buildCriteriaUI(prevScores={}, prevSkipped=[]) {
  criteriaList.innerHTML = "";

  // Intro text
  const intro = document.createElement("p");
  intro.style.cssText = "font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:16px;padding:12px;background:var(--dark3);border-radius:10px;border-left:3px solid var(--gold);";
  intro.textContent = "Voici plusieurs critères pour noter ce bar : attribue une note de 0 a 10 pour chacun. Tu peux ignorer des critères si tu le souhaites.";
  criteriaList.appendChild(intro);

  CRITERIA.forEach(c=>{
    const val=prevScores[c.key]!==undefined?prevScores[c.key]:5;
    const skipped=prevSkipped.includes(c.key);
    const div=document.createElement("div"); div.className="criterion-item"; div.dataset.key=c.key;
    div.innerHTML=`
      <label style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="${skipped?"color:var(--muted);text-decoration:line-through;":""}" id="label-${c.key}">${c.label}</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="weight">x${c.weight}</span>
          <span class="score-display" id="disp-${c.key}" style="${skipped?"color:var(--muted);":""}">${skipped?"—":`${val}<span style="font-size:12px;color:var(--muted);font-family:var(--font-body);font-weight:400;"> /10</span>`}</span>
        </div>
      </label>
      <div id="slider-wrap-${c.key}" style="${skipped?"opacity:0.3;pointer-events:none;":""}">
        <input type="range" min="0" max="10" step="0.5" value="${val}" id="range-${c.key}" />
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:4px;">
        <button data-key="${c.key}" class="btn-skip-criteria" style="background:${skipped?"var(--gold)":"var(--dark3)"};color:${skipped?"var(--dark)":"var(--muted)"};border:1px solid ${skipped?"var(--gold)":"var(--border)"};padding:3px 10px;border-radius:20px;font-size:11px;font-family:var(--font-body);cursor:pointer;transition:all .15s;">${skipped?"Inclure":"Ignorer"}</button>
      </div>
    `;
    criteriaList.appendChild(div);
    const range=div.querySelector(`#range-${c.key}`);
    const disp=div.querySelector(`#disp-${c.key}`);
    range.addEventListener("input",()=>{ disp.innerHTML=`${range.value}<span style="font-size:12px;color:var(--muted);font-family:var(--font-body);font-weight:400;"> /10</span>`; });

    div.querySelector(".btn-skip-criteria").addEventListener("click",()=>{
      const isSkipped=div.dataset.skipped==="true"; const nowSkipped=!isSkipped; div.dataset.skipped=nowSkipped;
      const labelEl=document.getElementById(`label-${c.key}`);
      const wrapEl=document.getElementById(`slider-wrap-${c.key}`);
      const skipBtn=div.querySelector(".btn-skip-criteria");
      labelEl.style.color=nowSkipped?"var(--muted)":""; labelEl.style.textDecoration=nowSkipped?"line-through":"";
      disp.innerHTML=nowSkipped?"—":`${range.value}<span style="font-size:12px;color:var(--muted);font-family:var(--font-body);font-weight:400;"> /10</span>`;
      disp.style.color=nowSkipped?"var(--muted)":"var(--gold)";
      wrapEl.style.opacity=nowSkipped?"0.3":"1"; wrapEl.style.pointerEvents=nowSkipped?"none":"";
      skipBtn.textContent=nowSkipped?"Inclure":"Ignorer";
      skipBtn.style.background=nowSkipped?"var(--gold)":"var(--dark3)"; skipBtn.style.color=nowSkipped?"var(--dark)":"var(--muted)"; skipBtn.style.borderColor=nowSkipped?"var(--gold)":"var(--border)";
    });
    if(skipped) div.dataset.skipped="true";
  });
}

document.getElementById("btn-submit-rating").addEventListener("click", async()=>{
  if(!selectedBar)return; const user=auth.currentUser; if(!user)return;
  const submitBtn=document.getElementById("btn-submit-rating");
  const existingId=submitBtn.dataset.existingId; const existingScore=parseFloat(submitBtn.dataset.existingScore)||0;
  const scores={},skipped=[]; let weightedSum=0,activeWeight=0;
  CRITERIA.forEach(c=>{
    const div=criteriaList.querySelector(`[data-key="${c.key}"]`);
    const isSkipped=div?.dataset.skipped==="true";
    if(isSkipped){skipped.push(c.key);}else{
      const val=parseFloat(document.getElementById(`range-${c.key}`).value);
      scores[c.key]=val; weightedSum+=val*c.weight; activeWeight+=c.weight;
    }
  });
  const globalScore=activeWeight>0?weightedSum/activeWeight:0;
  const comment=document.getElementById("rating-comment").value.trim();

  if(existingId){
    await updateDoc(doc(db,"ratings",existingId),{scores,skipped,globalScore,comment,updatedAt:serverTimestamp()});
    await updateDoc(doc(db,"bars",selectedBar.id),{totalScore:increment(globalScore-existingScore)});
    alert(`Note mise a jour ! Score : ${globalScore.toFixed(1)}/10`);
  } else {
    await addDoc(collection(db,"ratings"),{barId:selectedBar.id,barName:selectedBar.name,userId:user.uid,userName:user.displayName||"Anonyme",scores,skipped,globalScore,comment:comment||"",createdAt:serverTimestamp()});
    await updateDoc(doc(db,"bars",selectedBar.id),{ratingCount:increment(1),totalScore:increment(globalScore)});
    alert(`Note envoyee ! Score : ${globalScore.toFixed(1)}/10`);
  }
  modal.classList.add("hidden"); allBars=[]; loadBarsOnMap();
});
