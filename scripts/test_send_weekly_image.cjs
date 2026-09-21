const { execFileSync } = require('child_process');

const py = `
import urllib.request, json, base64

with open('/opt/evolution-api/boletas_guardadas/logo_ti_v2.jpg', 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode('ascii')

caption_text = """📊 *CIERRE SEMANAL DE VENTAS - SÁBADO 5:00 PM* 🏁
━━━━━━━━━━━━━━━━━━━━━━━━━━
Estimado(a) *Herbert Argueta*, te compartimos el informe consolidado de tu cierre semanal de ventas:

📅 *Semana:* Lunes 14/09/2026 al Sábado 19/09/2026
💼 *Código Asesor:* #1521
📄 *Facturas Emitidas:* 7 facturas

📊 *RESUMEN FINANCIERO:*
💰 *Total Vendido Semana:* Q. 24,849.85
🎯 *Meta Semanal Asignada:* Q. 52,500.00
📉 *Faltante para la Meta:* Q. 27,650.15
📈 *Cumplimiento Semanal:* 47.3%

📋 *DETALLE DE VENTAS DE LA SEMANA:*
▫️ *#1162* (14/09): Q14,222.83 - Alex García (Agroveterinaria Bances)
▫️ *#1163* (16/09): Q2,418.50 - Pablo Aroche (Distribuidora Bello Progreso)
▫️ *#1167* (16/09): Q1,211.00 - Delvin Flores (Agroservicios Nissi)
▫️ *#1169* (17/09): Q2,624.00 - Edy Rosales (Agroveterinaria El Finquero)
▫️ *#1170* (17/09): Q1,179.00 - Leonardo González (Agroveterinaria El Éxito)
▫️ *#1171* (17/09): Q974.52 - Copropiedad Peláez (Agroveterinaria Eben Ezer)
▫️ *#1173* (17/09): Q2,220.00 - Juan Pineda (Agro Mi Arlet)

💪 *¡Buen esfuerzo durante estos días! Analicemos oportunidades con nuestros clientes para que la próxima semana alcancemos la meta completa.* 🎯

━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 _Sistema de Gestión & Rendimiento Comercial Agricovet_"""

payload = {
    "number": "50248234048",
    "mediatype": "image",
    "mimetype": "image/jpeg",
    "caption": caption_text,
    "media": img_b64
}

req = urllib.request.Request(
    "http://localhost:8080/message/sendMedia/bot-recibos",
    data=json.dumps(payload).encode('utf-8'),
    headers={
        "apikey": "B6D711FCDE4D4FD5936544120E713976",
        "Content-Type": "application/json"
    },
    method="POST"
)

try:
    with urllib.request.urlopen(req) as resp:
        print("Status:", resp.status)
        print("Response:", resp.read().decode('utf-8')[:300])
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.read().decode('utf-8'))
except Exception as e:
    print("Error:", str(e))
`;

try {
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: py, encoding: 'utf-8' });
  console.log(out);
} catch (e) {
  console.error(e.message);
}
