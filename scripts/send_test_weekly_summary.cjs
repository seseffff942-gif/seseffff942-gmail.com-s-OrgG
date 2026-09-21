const { execFileSync } = require('child_process');

const targetPhone = '50248234048'; // Emanuel Lima

// Plantilla 1: Meta Semanal NO Alcanzada (Datos reales de Herbert esta semana: Q24,849.85 / 7 facturas)
const msgMetaNoAlcanzada = `📊 *CIERRE SEMANAL DE VENTAS - SÁBADO 5:00 PM* 🏁
━━━━━━━━━━━━━━━━━━━━━━━━━━
Estimado(a) *Herbert Argueta*, te compartimos el informe consolidado de tu cierre semanal de ventas:

📅 *Semana:* 14/09/2026 al 19/09/2026
💼 *Código Asesor:* #1521
📄 *Facturas Emitidas:* 7 facturas

📊 *RESUMEN FINANCIERO:*
💰 *Total Vendido Semana:* Q. 24,849.85
🎯 *Meta Semanal Asignada:* Q. 52,500.00
📉 *Faltante para la Meta:* Q. 27,650.15
📈 *Cumplimiento Semanal:* 47.3%

💪 *¡Buen esfuerzo durante estos días! Analicemos oportunidades con nuestros clientes para que la próxima semana alcancemos la meta completa.* 🎯

━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 _Sistema de Gestión & Rendimiento Comercial Agricovet_`;

// Plantilla 2: Meta Semanal ALCANZADA (Simulación con meta superada)
const msgMetaAlcanzada = `🏆 *CIERRE SEMANAL DE VENTAS - SÁBADO 5:00 PM* 🏁
━━━━━━━━━━━━━━━━━━━━━━━━━━
Estimado(a) *Herbert Argueta*, ¡excelente trabajo! Has culminado la semana cumpliendo exitosamente tu objetivo comercial:

📅 *Semana:* 14/09/2026 al 19/09/2026
💼 *Código Asesor:* #1521
📄 *Facturas Emitidas:* 14 facturas

📊 *RESUMEN FINANCIERO:*
💰 *Total Vendido Semana:* Q. 55,420.00
🎯 *Meta Semanal Asignada:* Q. 52,500.00
📈 *Superávit Logrado:* Q. 2,920.00
🔥 *Cumplimiento Semanal:* 105.6%

⭐ *¡Felicitaciones por tu entrega y constancia esta semana! A descansar y recargar energías para arrancar con fuerza el lunes.* 🚀

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

res1 = send_wa("${targetPhone}", """${msgMetaNoAlcanzada.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}""")
print("ENVIO 1 (NO ALCANZADA):", res1)

import time
time.sleep(3)

res2 = send_wa("${targetPhone}", """${msgMetaAlcanzada.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}""")
print("ENVIO 2 (ALCANZADA):", res2)
`;

try {
  console.log(`Enviando pruebas de Cierre Semanal a ${targetPhone}...`);
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: pyScript, encoding: 'utf-8' });
  console.log('Resultado del servidor:\n', out);
} catch (err) {
  console.error('Error enviando mensaje:', err.message);
}
