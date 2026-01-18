import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, get, child, push, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBC-agoIxYi24cO1KKz8k4oonp_wNF5EZc",
    authDomain: "oraculo-c5300.firebaseapp.com",
    projectId: "oraculo-c5300",
    storageBucket: "oraculo-c5300.appspot.com",
    messagingSenderId: "819166531273",
    appId: "1:819166531273:web:dad9fb0b70486e59c7c718",
    databaseURL: "https://oraculo-c5300-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const dbRef = ref(db);
let dbData = {};
let callData = {};

// Cria card com imagem
function createOptionCard(name, id, img) {
    const div = document.createElement("div");
    div.className = "col-md-3";
    div.innerHTML = `
    <div class="card option-card text-center p-3" data-id="${id}">
      <img src="${img || 'https://via.placeholder.com/120'}" class="card-img-top mx-auto rounded shadow-sm" alt="${name}">
      <div class="card-body"><h6>${name}</h6></div>
    </div>`;
    return div;
}

// --- Carrega locais ---
async function loadData() {
    const snapshot = await get(child(dbRef, "opcoes/locais"));
    if (!snapshot.exists()) return alert("Nenhum local cadastrado!");

    dbData = snapshot.val();
    const container = document.getElementById("locations");
    container.innerHTML = "";

    Object.entries(dbData).forEach(([id, local]) => {
        container.appendChild(createOptionCard(local.nome, id, local.imagem));
    });

    setupSelection("locations", "local", "toStep2");
}
loadData();

// --- Seleções ---
function setupSelection(containerId, key, nextBtnId) {
    const container = document.getElementById(containerId);
    const nextButton = document.getElementById(nextBtnId);
    nextButton.disabled = true;

    container.querySelectorAll(".option-card").forEach(card => {
        card.addEventListener("click", () => {
            container.querySelectorAll(".option-card").forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");
            callData[key] = card.dataset.id;
            nextButton.disabled = false;
        });
    });
}

// --- Etapas ---
document.getElementById("toStep2").onclick = () => {
    const localId = callData.local;
    const equipamentos = dbData[localId]?.equipamentos || {};
    const container = document.getElementById("equipments");
    container.innerHTML = "";

    Object.entries(equipamentos).forEach(([id, eq]) => {
        container.appendChild(createOptionCard(eq.nome, id, eq.imagem));
    });

    setupSelection("equipments", "equipamento", "toStep3");
    document.getElementById("step1").classList.add("d-none");
    document.getElementById("step2").classList.remove("d-none");
};

document.getElementById("toStep3").onclick = () => {
    const { local, equipamento } = callData;
    const modelos = dbData[local]?.equipamentos?.[equipamento]?.modelos || {};
    let instalacoes = {};

    Object.values(modelos).forEach(m => {
        if (m.instalacoes) Object.assign(instalacoes, m.instalacoes);
    });

    const container = document.getElementById("installations");
    container.innerHTML = "";

    Object.entries(instalacoes).forEach(([id, inst]) => {
        container.appendChild(createOptionCard(inst.nome, id, inst.imagem));
    });

    setupSelection("installations", "instalacao", "toStep4");
    document.getElementById("step2").classList.add("d-none");
    document.getElementById("step3").classList.remove("d-none");
};

document.getElementById("toStep4").onclick = () => {
    const { local, equipamento } = callData;
    const modelos = dbData[local]?.equipamentos?.[equipamento]?.modelos || {};
    let erros = new Set();
    Object.values(modelos).forEach(m => (m.erros || []).forEach(e => erros.add(e)));

    const container = document.getElementById("issues");
    container.innerHTML = "";

    Array.from(erros).forEach(err => {
        container.innerHTML += `
      <div class="col-md-3">
        <div class="card option-card text-center p-3" data-id="${err}">
          <h6>${err}</h6>
        </div>
      </div>`;
    });

    setupSelection("issues", "erro", "submitBtn");
    document.getElementById("step3").classList.add("d-none");
    document.getElementById("step4").classList.remove("d-none");
};

document.getElementById("submitBtn").onclick = async () => {
    const { local, equipamento, instalacao, erro } = callData;
    await set(push(ref(db, "chamados")), {
        local, equipamento, instalacao, erro,
        dataHora: new Date().toISOString(), status: "aberto"
    });
    document.getElementById("step4").classList.add("d-none");
    document.getElementById("confirmation").classList.remove("d-none");
};

document.getElementById("newCall").onclick = () => location.reload();
