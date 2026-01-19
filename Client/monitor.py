import time
import firebase_admin
from firebase_admin import credentials, db
from ping3 import ping
import os

# Inicialização do Firebase
PATH_JSON = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
cred = credentials.Certificate(PATH_JSON)
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://oraculo-c5300-default-rtdb.firebaseio.com'
})


def monitorar():
    print("🚀 Agente Oráculo iniciado | Estrutura: CID > Stats/Histórico")

    while True:
        try:
            # 1. Lê a raiz do monitoramento para pegar todos os CIDs
            root_ref = db.reference("monitoramento")
            monitoramento_data = root_ref.get()

            if monitoramento_data:
                for cid, conteudo in monitoramento_data.items():
                    # Acessa a lista de dispositivos dentro de cada CID
                    dispositivos = conteudo.get(
                        'stats', {}).get('dispositivos', {})

                    for nome_equipamento, info in dispositivos.items():
                        ip = info.get('ip')
                        if not ip:
                            continue

                        # 2. Realiza o Ping
                        latencia = ping(ip, timeout=1)
                        ms = int(latencia * 1000) if latencia is not None else 0
                        status = "online" if latencia is not None else "offline"
                        agora = int(time.time())

                        # 3. Atualiza o Stats (Caminho exato da sua imagem)
                        # monitoramento/CID/stats/dispositivos/NOME
                        db.reference(f"monitoramento/{cid}/stats/dispositivos/{nome_equipamento}").update({
                            "lat": ms,
                            "status": status,
                            "last_update": agora
                        })

                        # 4. Salva o Histórico (Caminho exato da sua imagem)
                        # monitoramento/CID/historico/NOME/TIMESTAMP
                        db.reference(
                            f"monitoramento/{cid}/historico/{nome_equipamento}/{agora}").set(ms)

                        print(
                            f"📡 [{cid[:8]}] {nome_equipamento}: {ms}ms | {status}")

            # Espera 20 segundos para o próximo ciclo
            time.sleep(20)

        except Exception as e:
            print(f"❌ Erro no ciclo de monitoramento: {e}")
            time.sleep(10)


if __name__ == "__main__":
    monitorar()
