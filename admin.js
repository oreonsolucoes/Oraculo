import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, update } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBC-agoIxYi24cO1KKz8k4oonp_wNF5EZc",
    authDomain: "oraculo-c5300.firebaseapp.com",
    projectId: "oraculo-c5300",
    storageBucket: "oraculo-c5300.appspot.com",
    messagingSenderId: "819166531273",
    appId: "1:819166531273:web:dad9fb0b70486e59c7c718",
    measurementId: "G-LLG3QD5DHP",
    databaseURL: "https://oraculo-c5300-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Preview de imagens
function previewImage(inputId, imgId) {
    const input = document.getElementById(inputId);
    const img = document.getElementById(imgId);
    input.addEventListener("input", () => {
        const url = input.value.trim();
        if (url) {
            img.src = url;
            img.style.display = "block";
        } else {
            img.style.display = "none";
        }
    });
}
previewImage("localImg", "previewLocal");
previewImage("equipamentoImg", "previewEquip");

// Salvar dados
document.getElementById("salvar").onclick = async () => {
    const localNome = document.getElementById("local").value.trim();
    const equipamentoNome = document.getElementById("equipamento").value.trim();
    const modeloNome = document.getElementById("modelo").value.trim();
    const localImg = document.getElementById("localImg").value.trim();
    const equipamentoImg = document.getElementById("equipamentoImg").value.trim();

    if (!localNome || !equipamentoNome || !modeloNome) {
        alert("Preencha Local, Equipamento e Modelo!");
        return;
    }

    const localId = localNome.toLowerCase().replace(/\s+/g, "_");
    const equipamentoId = equipamentoNome.toLowerCase().replace(/\s+/g, "_");
    const modeloId = modeloNome.toLowerCase().replace(/\s+/g, "_");

    const instalacoes = document.getElementById("instalacoes").value
        .split(",").map(s => s.trim()).filter(Boolean)
        .reduce((acc, nome) => {
            const id = nome.toLowerCase().replace(/\s+/g, "_");
            acc[id] = { nome };
            return acc;
        }, {});

    const erros = document.getElementById("erros").value
        .split(",").map(s => s.trim()).filter(Boolean);

    const updates = {};
    updates[`opcoes/locais/${localId}`] = {
        nome: localNome,
        imagem: localImg || "",
    };
    updates[`opcoes/locais/${localId}/equipamentos/${equipamentoId}`] = {
        nome: equipamentoNome,
        imagem: equipamentoImg || "",
    };
    updates[`opcoes/locais/${localId}/equipamentos/${equipamentoId}/modelos/${modeloId}`] = {
        nome: modeloNome,
        instalacoes,
        erros
    };

    try {
        await update(ref(db), updates);
        document.getElementById("saida").textContent =
            `✅ Estrutura salva!\n\n${JSON.stringify(updates, null, 2)}`;
    } catch (e) {
        document.getElementById("saida").textContent = `❌ Erro: ${e.message}`;
    }
};
