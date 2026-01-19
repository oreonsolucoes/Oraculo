import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* ================= FIREBASE CONFIG ================= */
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
const CAMINHO_PADRAO = "Geral";

/* ================= ELEMENTOS DO DOM ================= */
const loginScr = document.getElementById("login-scr");
const dashScr = document.getElementById("dash-scr");
const btnLogin = document.getElementById("btn-login");
const btnLogout = document.getElementById("btn-logout");
const modal = document.getElementById("modal");
const modalNome = document.getElementById("modalNome");
const modalIp = document.getElementById("m-ip");
const filtroTempo = document.getElementById("filtroTempo");

/* ================= VARIÁVEIS GLOBAIS ================= */
let currentDevice = null;
let chart = null;
let dadosHistoricosLocais = {};
let cidAtualParaEdicao = null;

/* ================= FUNÇÕES AUXILIARES ================= */
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

/* ================= RENDER DOS DISPOSITIVOS ================= */
function render(data) {
    let total = 0, online = 0, offline = 0, warn = 0;

    // Limpa os containers
    ["P1", "P2", "TORRE", "OUTROS"].forEach(l => {
        const el = document.getElementById(`local-${l}`);
        if (el) el.innerHTML = "";
    });

    for (const cid in data) {
        if (cid === "historico" || cid === "cmd") continue;
        const dispositivos = data[cid]?.stats?.dispositivos;
        if (!dispositivos) continue;

        for (const nome in dispositivos) {
            total++;
            const d = dispositivos[nome];
            const local = detectarLocal(nome);
            const classe = statusClasse(d);

            if (classe === "online") online++;
            else if (classe === "offline") offline++;
            else warn++;

            // Gerar subtítulo de portas no card
            let htmlPortasCard = "";
            if (d.status_portas && Object.keys(d.status_portas).length > 0) {
                Object.keys(d.status_portas).forEach(p => {
                    const s = d.status_portas[p];
                    const cor = s.status === 'online' ? 'text-emerald-400' : 'text-red-500';
                    const statusTexto = s.status === 'online' ? 'OPERANDO' : 'INOPERANTE';
                    htmlPortasCard += `<div class="text-[9px] font-bold ${cor}">PORTA ${p}: ${statusTexto}</div>`;
                });
            } else {
                htmlPortasCard = `<div class="text-[9px] text-slate-500 uppercase">Apenas IP</div>`;
            }

            const card = document.createElement("div");
            card.className = `card ${classe}`;
            card.innerHTML = `
                <div class="card-actions">
                    <button class="btn-mini" onclick="event.stopPropagation(); prepararEdicao('${nome}', '${d.ip}', '${cid}', '${d.porta || ""}')">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-mini btn-delete" onclick="event.stopPropagation(); excluirDispositivo('${nome}', '${cid}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                <div class="mb-1">
                    <strong class="text-white">${nome}</strong><br>
                    <span class="text-[10px] text-slate-400 font-mono">${d.ip}</span>
                </div>
                <div class="portas-resumo-card">${htmlPortasCard}</div>
                <div class="flex justify-between items-end mt-2">
                    <span class="text-xl font-mono font-bold ${d.status === 'online' ? 'text-white' : 'text-slate-600'}">
                        ${d.lat}<small class="text-xs ml-1">ms</small>
                    </span>
                    <div class="status-indicator ${d.status}"></div>
                </div>
            `;

            card.onclick = () => abrirModal(nome, d, cid);
            document.getElementById(`local-${local}`)?.appendChild(card);
        }
    }

    // Atualiza resumo no header
    const rTotal = document.getElementById("r-total");
    const rOnline = document.getElementById("r-online");
    const rWarn = document.getElementById("r-warn");
    const rOffline = document.getElementById("r-offline");

    if (rTotal) rTotal.innerHTML = `${total}<br><small>Total</small>`;
    if (rOnline) rOnline.innerHTML = `${online}<br><small>Online</small>`;
    if (rWarn) rWarn.innerHTML = `${warn}<br><small>Alerta</small>`;
    if (rOffline) rOffline.innerHTML = `${offline}<br><small>Offline</small>`;
}

/* ================= MODAL ================= */
window.alternarModal = (aba) => {
    const btnPing = document.getElementById('btn-tab-ping');
    const btnPortas = document.getElementById('btn-tab-portas');
    const conteinerPing = document.getElementById('conteiner-ping');
    const conteinerPortas = document.getElementById('m-portas-detalhe');

    if (aba === 'ping') {
        btnPing.classList.add('active');
        btnPortas.classList.remove('active');
        conteinerPing.classList.remove('hidden');
        conteinerPortas.classList.add('hidden');
    } else {
        btnPing.classList.remove('active');
        btnPortas.classList.add('active');
        conteinerPing.classList.add('hidden');
        conteinerPortas.classList.remove('hidden');
    }
};

window.abrirModal = async (nome, d, cid) => {
    currentDevice = { nome, cid };

    modalNome.innerText = nome;
    modalIp.innerText = d.ip;

    // Resetar para a aba de Ping
    alternarModal('ping');

    // Preencher lista de portas
    const elPortasCont = document.getElementById('m-portas-detalhe');
    elPortasCont.innerHTML = "";

    if (d.status_portas && Object.keys(d.status_portas).length > 0) {
        Object.keys(d.status_portas).forEach(p => {
            const s = d.status_portas[p];
            const cor = s.status === 'online' ? 'text-emerald-400' : 'text-red-500';
            const dataVisto = s.last_online ? new Date(s.last_online * 1000).toLocaleString() : "Sem registro";
            elPortasCont.innerHTML += `
                <div class="bg-slate-800/50 p-3 rounded-lg border border-white/5 mb-2 flex justify-between items-center">
                    <div>
                        <div class="text-white font-bold">PORTA ${p}</div>
                        <div class="text-[10px] text-slate-500">Último Online: ${dataVisto}</div>
                    </div>
                    <div class="${cor} font-bold text-xs">${s.status.toUpperCase()}</div>
                </div>`;
        });
    } else {
        elPortasCont.innerHTML = "<p class='text-slate-500 text-center py-4'>Nenhuma porta configurada.</p>";
    }

    modal.classList.remove('hidden');

    // Carrega histórico do gráfico
    onValue(ref(db, `monitoramento/${cid}/historico/${nome}`), (snap) => {
        dadosHistoricosLocais = snap.exists() ? snap.val() : {};
        atualizarGrafico();
    }, { onlyOnce: true });
};

window.closeModal = () => {
    modal.classList.add("hidden");
    if (chart) {
        chart.destroy();
        chart = null;
    }
    dadosHistoricosLocais = {};
};

/* ================= GRÁFICO ================= */
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

    const horasFiltro = parseInt(filtroTempo.value || 1);
    const agoraSegundos = Math.floor(Date.now() / 1000);
    const limiteTempo = agoraSegundos - (horasFiltro * 3600);

    const timestampsFiltrados = Object.keys(dadosHistoricosLocais)
        .filter(t => parseInt(t) >= limiteTempo)
        .sort((a, b) => a - b);

    if (timestampsFiltrados.length === 0) {
        if (chart) chart.destroy();
        document.getElementById('m-min').innerText = "0 ms";
        document.getElementById('m-max').innerText = "0 ms";
        document.getElementById('m-avg').innerText = "0 ms";
        return;
    }

    const valores = timestampsFiltrados.map(t => dadosHistoricosLocais[t]);
    const valoresPositivos = valores.filter(v => v > 0);

    const minLat = valoresPositivos.length ? Math.min(...valoresPositivos) : 0;
    const maxLat = Math.max(...valores);
    const avgLat = valoresPositivos.length ? (valoresPositivos.reduce((a, b) => a + b, 0) / valoresPositivos.length).toFixed(1) : 0;

    document.getElementById('m-min').innerText = `${minLat} ms`;
    document.getElementById('m-max').innerText = `${maxLat} ms`;
    document.getElementById('m-avg').innerText = `${avgLat} ms`;

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

/* ================= GERENCIAMENTO DE DISPOSITIVOS ================= */
window.prepararEdicao = (nome, ip, cid, porta = "") => {
    cidAtualParaEdicao = cid;
    document.getElementById("add-nome").value = nome;
    document.getElementById("add-ip").value = ip;
    const campoPorta = document.getElementById("add-porta");
    if (campoPorta) campoPorta.value = porta;
    document.getElementById("add-nome").focus();
};

window.salvarDispositivo = async () => {
    const nome = document.getElementById("add-nome").value.trim();
    const ip = document.getElementById("add-ip").value.trim();
    const campoPorta = document.getElementById("add-porta");
    const porta = campoPorta ? campoPorta.value.trim() : "";

    if (!nome || !ip) return alert("Preencha ao menos Nome e IP!");

    const cid = cidAtualParaEdicao || CAMINHO_PADRAO;

    const dadosParaSalvar = {
        ip,
        lat: 0,
        status: "offline",
        last_update: Math.floor(Date.now() / 1000)
    };
    if (porta) dadosParaSalvar.porta = porta;

    try {
        await set(ref(db, `monitoramento/${cid}/stats/dispositivos/${nome}`), dadosParaSalvar);

        document.getElementById("add-nome").value = "";
        document.getElementById("add-ip").value = "";
        if (campoPorta) campoPorta.value = "";

        cidAtualParaEdicao = null;
        alert("Dispositivo salvo com sucesso!");
    } catch (err) {
        console.error("Erro ao salvar:", err);
        alert("Erro ao salvar dispositivo.");
    }
};

window.excluirDispositivo = async (nome, cid = CAMINHO_PADRAO) => {
    if (!confirm(`Deseja realmente excluir o equipamento: ${nome}?`)) return;

    try {
        await set(ref(db, `monitoramento/${cid}/stats/dispositivos/${nome}`), null);
        await set(ref(db, `monitoramento/${cid}/historico/${nome}`), null);
        console.log(`${nome} removido.`);
    } catch (err) {
        console.error("Erro ao excluir:", err);
        alert("Erro ao excluir.");
    }
};

/* ================= AUTH ================= */
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

/* ================= PARTÍCULAS ================= */
const initParticles = async () => {
    if (typeof tsParticles !== "undefined") {
        await tsParticles.load("tsparticles", {
            fullScreen: { enable: false },
            background: { color: "transparent" },
            particles: {
                number: { value: 70, density: { enable: true, area: 800 } },
                color: { value: ["#00d2ff", "#ff9d00", "#ff007a"] },
                links: {
                    enable: true,
                    distance: 150,
                    color: "#ffffff",
                    opacity: 0.15,
                    width: 1
                },
                move: { enable: true, speed: 1.2 },
                size: { value: { min: 1, max: 4 } },
                opacity: { value: { min: 0.3, max: 0.6 } }
            },
            interactivity: {
                events: {
                    onHover: { enable: true, mode: "grab" }
                },
                modes: {
                    grab: { distance: 140, links: { opacity: 0.5 } }
                }
            }
        });
        console.log("Partículas carregadas!");
    }
};

initParticles();
