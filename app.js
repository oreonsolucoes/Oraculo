import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* ================= FIREBASE ================= */
const firebaseConfig = {
    apiKey: "AIzaSyBC-agoIxYi24cO1KKz8k4oonp_wNF5EZc",
    authDomain: "oraculo-c5300.firebaseapp.com",
    databaseURL: "https://oraculo-c5300-default-rtdb.firebaseio.com",
    projectId: "oraculo-c5300",
    appId: "1:819166531273:web:dad9fb0b70486e59c7c718"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// No topo do seu app.js, defina o caminho padrão
const CAMINHO_PADRAO = "Geral";

/* ================= GERENCIAMENTO SIMPLIFICADO ================= */

window.salvarDispositivo = async () => {
    const nome = document.getElementById("add-nome").value.trim();
    const ip = document.getElementById("add-ip").value.trim();

    if (!nome || !ip) return alert("Preencha Nome e IP!");

    try {
        // Agora salvamos sempre na pasta 'Geral'
        const path = `monitoramento/${CAMINHO_PADRAO}/stats/dispositivos/${nome}`;

        await set(ref(db, path), {
            ip: ip,
            lat: 0,
            status: "offline",
            last_update: Math.floor(Date.now() / 1000)
        });

        // Limpa os campos
        document.getElementById("add-nome").value = "";
        document.getElementById("add-ip").value = "";
        alert("Equipamento salvo com sucesso!");
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar.");
    }
};

window.excluirDispositivo = async (nome) => {
    if (!confirm(`Excluir ${nome}?`)) return;
    try {
        // Remove dos stats e do histórico dentro de 'Geral'
        await set(ref(db, `monitoramento/${CAMINHO_PADRAO}/stats/dispositivos/${nome}`), null);
        await set(ref(db, `monitoramento/${CAMINHO_PADRAO}/historico/${nome}`), null);
    } catch (err) {
        alert("Erro ao excluir.");
    }
};

/* ================= ELEMENTOS ================= */
const loginScr = document.getElementById("login-scr");
const dashScr = document.getElementById("dash-scr");
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const modal = document.getElementById("modal");
// Ajuste esses dois para bater com o HTML novo:
const modalNome = document.getElementById("modalNome");
const modalIp = document.getElementById("m-ip");
const modalStatus = document.getElementById("m-status");

/* ================= HELPERS ================= */
function detectarLocal(nome) {
    if (nome.includes("P1")) return "P1";
    if (nome.includes("P2")) return "P2";
    if (nome.includes("TORRE")) return "TORRE";
    return "OUTROS";
}

function statusClasse(d) {
    if (d.status !== "online") return "offline";
    if (d.lat > 300) return "warn";
    return "online";
}

/* ================= RENDER ================= */
let currentDevice = null;

function render(data) {
    let total = 0, online = 0, offline = 0, warn = 0;

    ["P1", "P2", "TORRE", "OUTROS"].forEach(l => {
        const el = document.getElementById(`local-${l}`);
        if (el) el.innerHTML = "";
    });

    for (const cid in data) {
        const dispositivos = data[cid]?.stats?.dispositivos;
        if (!dispositivos) continue;

        for (const nome in dispositivos) {
            total++;
            const d = dispositivos[nome];
            const local = detectarLocal(nome);
            const classe = statusClasse(d);

            if (classe === "online") online++;
            if (classe === "offline") offline++;
            if (classe === "warn") warn++;

            const card = document.createElement("div");
            card.className = `card ${classe}`;
            card.innerHTML = `
                <div class="card-actions">
                    <button class="btn-mini" onclick="event.stopPropagation(); prepararEdicao('${nome}', '${d.ip}', '${cid}')">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-mini btn-delete" onclick="event.stopPropagation(); excluirDispositivo('${nome}', '${cid}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                <strong>${nome}</strong><br>
                <span class="text-xs text-slate-400">${d.ip}</span><br>
                <span class="font-mono">${d.lat} ms</span>
`;
            card.onclick = () => abrirModal(nome, d, cid);
            const container = document.getElementById(`local-${local}`);
            if (container) container.appendChild(card);
        }
    }

    document.getElementById("r-total").innerHTML = `${total}<small>Total</small>`;
    document.getElementById("r-online").innerHTML = `${online}<small>Online</small>`;
    document.getElementById("r-offline").innerHTML = `${offline}<small>Offline</small>`;
    document.getElementById("r-warn").innerHTML = `${warn}<small>Alerta</small>`;
}


/* ================= MODAL & HISTÓRICO ================= */
let chart = null;
let dadosHistoricosLocais = {};

// Função principal para abrir o modal
window.abrirModal = async (nome, d, cid) => {
    currentDevice = { nome, cid }; // Para uso no comando de Reboot

    // Preenche informações básicas
    document.getElementById('modalNome').innerText = nome;
    if (document.getElementById('m-ip')) document.getElementById('m-ip').innerText = d.ip;
    if (document.getElementById('m-status')) {
        const statusText = `${d.status.toUpperCase()} | ${d.lat} ms`;
        document.getElementById('m-status').innerText = statusText;
        document.getElementById('m-status').className = `text-center font-bold ${d.status === 'online' ? 'text-emerald-400' : 'text-red-400'}`;
    }

    // Exibe o modal
    modal.classList.remove('hidden');

    // Busca o histórico completo no Firebase
    const histRef = ref(db, `monitoramento/${cid}/historico/${nome}`);

    onValue(histRef, (snapshot) => {
        if (snapshot.exists()) {
            dadosHistoricosLocais = snapshot.val();
            atualizarGrafico();
        } else {
            dadosHistoricosLocais = {};
            if (chart) chart.destroy();
            console.warn("Nenhum histórico encontrado para este dispositivo.");
        }
    }, { onlyOnce: true });
};

// Função para fechar o modal e limpar rastros
window.closeModal = () => {
    modal.classList.add("hidden");
    if (chart) {
        chart.destroy();
        chart = null;
    }
    dadosHistoricosLocais = {};
};

// Listener para o seletor de tempo
const filtroTempo = document.getElementById('filtroTempo');
if (filtroTempo) {
    filtroTempo.addEventListener('change', () => {
        if (Object.keys(dadosHistoricosLocais).length > 0) {
            atualizarGrafico();
        }
    });
}

function atualizarGrafico() {
    const canvas = document.getElementById('chartContainer');
    if (!canvas) return;

    const horasFiltro = parseInt(document.getElementById('filtroTempo').value || 1);
    const agoraSegundos = Math.floor(Date.now() / 1000);
    const limiteTempo = agoraSegundos - (horasFiltro * 3600);

    // Filtra os dados conforme o tempo selecionado
    const timestampsFiltrados = Object.keys(dadosHistoricosLocais)
        .filter(t => parseInt(t) >= limiteTempo)
        .sort((a, b) => a - b);

    if (timestampsFiltrados.length === 0) {
        if (chart) chart.destroy();
        // Zera os campos se não houver dados
        document.getElementById('m-min').innerText = "0 ms";
        document.getElementById('m-max').innerText = "0 ms";
        document.getElementById('m-avg').innerText = "0 ms";
        return;
    }

    const valores = timestampsFiltrados.map(t => dadosHistoricosLocais[t]);

    // --- CÁLCULO DAS MÉTRICAS ---
    // Filtramos apenas valores > 0 para min/média (ignorar quedas no cálculo de latência)
    const valoresPositivos = valores.filter(v => v > 0);

    const minLat = valoresPositivos.length ? Math.min(...valoresPositivos) : 0;
    const maxLat = Math.max(...valores); // Máximo pode incluir o 0 se quiser ver o pico
    const avgLat = valoresPositivos.length ? (valoresPositivos.reduce((a, b) => a + b, 0) / valoresPositivos.length).toFixed(1) : 0;

    // Achar último offline (valor 0)
    const offTimestamps = timestampsFiltrados.filter(t => dadosHistoricosLocais[t] === 0);
    let lastOffStr = "Nunca";
    if (offTimestamps.length > 0) {
        const lastOffTs = Math.max(...offTimestamps);
        const dOff = new Date(lastOffTs * 1000);
        lastOffStr = dOff.toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    // Atualiza o HTML com os novos valores
    document.getElementById('m-min').innerText = `${minLat} ms`;
    document.getElementById('m-max').innerText = `${maxLat} ms`;
    document.getElementById('m-avg').innerText = `${avgLat} ms`;
    document.getElementById('m-last-off').innerText = lastOffStr;
    // ----------------------------

    // Renderização do gráfico (mantém o que você já tem)
    const labels = timestampsFiltrados.map(t => {
        const date = new Date(t * 1000);
        return horasFiltro <= 24
            ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    });

    const ctx = canvas.getContext('2d');
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Latência (ms)',
                data: valores,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                pointRadius: valores.length > 50 ? 0 : 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

/* ================= AUTH & ESTADO DO USUÁRIO ================= */
onAuthStateChanged(auth, user => {
    if (user) {
        loginScr.classList.add("hidden");
        dashScr.classList.remove("hidden");
        onValue(ref(db, "monitoramento"), snap => {
            if (snap.exists()) render(snap.val());
        });
    } else {
        loginScr.classList.remove("hidden");
        dashScr.classList.add("hidden");
    }
});

/* ================= EVENTO DE LOGIN ================= */
btnLogin.onclick = async () => {
    const email = document.getElementById("email").value;
    const pass = document.getElementById("pass").value;

    if (!email || !pass) {
        alert("Por favor, preencha todos os campos.");
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        console.log("Login realizado com sucesso!");
    } catch (err) {
        let msg = "Erro ao tentar entrar.";
        if (err.code === 'auth/invalid-credential') msg = "E-mail ou senha incorretos.";
        else if (err.code === 'auth/too-many-requests') msg = "Muitas tentativas. Tente mais tarde.";
        alert(msg);
    }
};

btnLogout.onclick = () => signOut(auth);

/* ================= PARTICLES CONFIG FINAL ================= */
const initParticles = async () => {
    if (typeof tsParticles !== "undefined") {
        await tsParticles.load("tsparticles", {
            fullScreen: { enable: false },
            background: { color: "transparent" },
            particles: {
                number: { value: 60, density: { enable: true, area: 800 } },
                color: { value: "#10b981" },
                links: {
                    enable: true,
                    distance: 150,
                    color: "#10b981",
                    opacity: 0.3,
                    width: 1
                },
                move: { enable: true, speed: 1.5 },
                size: { value: { min: 1, max: 3 } },
                opacity: { value: 0.5 }
            },
            interactivity: {
                events: {
                    onHover: { enable: true, mode: "grab" }
                }
            }
        });
        console.log("Partículas carregadas!");
    }
};

initParticles();

//* ================= GERENCIAMENTO DE DISPOSITIVOS ================= */

// Variável global para controle de CID dinâmico (coloque isso antes das funções)
let cidAtualParaEdicao = null;

// Função para preencher o formulário para edição
window.prepararEdicao = (nome, ip, cid) => {
    cidAtualParaEdicao = cid; // Captura o ID real do condomínio (Ex: 045B2BB8...)
    document.getElementById("add-nome").value = nome;
    document.getElementById("add-ip").value = ip;
    document.getElementById("add-nome").focus();
};

// Função para Adicionar ou Editar (Salvar)
window.salvarDispositivo = async () => {
    const nome = document.getElementById("add-nome").value.trim();
    const ip = document.getElementById("add-ip").value.trim();

    // IMPORTANTE: Se não for edição, define o CID fixo onde o novo equipamento deve entrar
    const cid = cidAtualParaEdicao || "045B2BB8-6186-EF11-B5BA-782BCBC4E6F3";

    if (!nome || !ip) return alert("Preencha Nome e IP!");

    try {
        // O path agora usa o CID dinâmico, evitando criar tabelas erradas
        const path = `monitoramento/${cid}/stats/dispositivos/${nome}`;

        await set(ref(db, path), {
            ip: ip,
            lat: 0,
            status: "offline",
            last_update: Math.floor(Date.now() / 1000)
        });

        // Limpa campos e reseta o controle
        document.getElementById("add-nome").value = "";
        document.getElementById("add-ip").value = "";
        cidAtualParaEdicao = null;

        alert("Dispositivo salvo com sucesso!");
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar.");
    }
};

// Função para Excluir
window.excluirDispositivo = async (nome, cid) => {
    if (!confirm(`Deseja realmente excluir o equipamento: ${nome}?`)) return;

    try {
        // Remove dos stats e do histórico usando o CID correto
        await set(ref(db, `monitoramento/${cid}/stats/dispositivos/${nome}`), null);
        await set(ref(db, `monitoramento/${cid}/historico/${nome}`), null);
        console.log(`${nome} removido.`);
    } catch (err) {
        alert("Erro ao excluir.");
    }
};
