const { execFileSync } = require('child_process');

const targetPhone = '50248234048'; // Emanuel Lima

const realWeeklyMessage = `📊 *CIERRE SEMANAL DE VENTAS - SÁBADO 5:00 PM* 🏁
━━━━━━━━━━━━━━━━━━━━━━━━━━
Estimado(a) *Herbert Argueta*, te compartimos el resumen consolidado de tu rendimiento comercial durante la presente semana:

📅 *Período:* Lunes 14/09/2026 al Sábado 19/09/2026
💼 *Código Asesor:* #1521
📄 *Total Facturas Emitidas:* 7 facturas

📊 *BALANCE FINANCIERO SEMANAL:*
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

💪 *¡Buen trabajo esta semana con 7 clientes atendidos! Analicemos oportunidades para que la próxima semana alcancemos la meta completa del 100%. ¡Feliz fin de semana!* 🎯

━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 _Sistema de Gestión & Rendimiento Comercial Agricovet_`;

const pyScript = `
import urllib.request
import json

def send_wa(phone, text):
    url = "http://localhost:8080/message/sendText/bot-recibos"
    headers = {
        "apikey": "B6D711FCDE4D4FD5936544120E713976",
        "Content-Type": "application/json"
    }
    data = json.dumps({"number": phone, "text": text}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        return resp.read().decode('utf-8')

res = send_wa("${targetPhone}", """${realWeeklyMessage.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}""")
print("ENVIO CIERRE REAL HERBERT:", res)
`;

try {
  console.log(`Enviando Cierre Semanal REAL de Herbert Argueta a ${targetPhone}...`);
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: pyScript, encoding: 'utf-8' });
  console.log('Servidor respondió:\n', out);
} catch (err) {
  console.error('Error enviando WhatsApp:', err.message);
}
