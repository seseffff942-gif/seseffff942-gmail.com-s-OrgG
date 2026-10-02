const { execFileSync } = require('child_process');
const pg = require('pg');

const targetPhone = '50248234048'; // Emanuel Lima (Dueño/CEO)
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:evolution_pass@185.166.39.49:5432/agricovet_db' });

// Formateador de hora en zona horaria de Guatemala (UTC-6)
function formatTimeGuatemala(isoString) {
  if (!isoString) return '--:--';
  const d = new Date(isoString);
  return d.toLocaleTimeString('es-GT', { timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateGuatemala(isoString) {
  if (!isoString) return 'Hoy';
  const d = new Date(isoString);
  return d.toLocaleDateString('es-GT', { timeZone: 'America/Guatemala', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function buildStartRouteMessage(sellerName, sellerCode, startedAt) {
  const fechaStr = formatDateGuatemala(startedAt);
  const horaStr = formatTimeGuatemala(startedAt);

  return `🚀 *INICIO DE RUTA EN TERRENO - AGRICOVET* 🇬🇹
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
¡Buenos días, *${sellerName}*! Has iniciado exitosamente tu ruta comercial:

💼 *Código Asesor:* #${sellerCode || 'S/C'}
📅 *Fecha:* ${fechaStr}
⏰ *Hora de Salida:* ${horaStr}
🟢 *Estado:* En Ruta Activa

🎯 *Recomendaciones para el día:*
• Registra cada visita en el punto exacto con tu ubicación GPS.
• Fotografía de fachada o comprobante obligatoria.
• Toma nota de pedidos y cobros para sincronización inmediata.

💪 *¡Muchos éxitos en tus ventas y visitas de hoy! Vamos con todo el ánimo.* 🚜🌾
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 _Sistema de Gestión & Rutas Comerciales Agricovet_`;
}

function buildFinishRouteMessage(sellerName, sellerCode, startedAt, finishedAt, visits, totalStops) {
  const fechaStr = formatDateGuatemala(startedAt);
  const horaInicio = formatTimeGuatemala(startedAt);
  const horaFin = formatTimeGuatemala(finishedAt);

  // Cálculo de duración
  const diffMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const duracionTexto = diffHrs > 0 ? `${diffHrs}h ${diffMins}m` : `${diffMins} min`;

  let visitsList = '';
  if (visits.length === 0) {
    visitsList = '• _No se registraron visitas durante esta jornada._\n';
  } else {
    visitsList = visits.map((v, idx) => {
      const horaV = formatTimeGuatemala(v.createdAt);
      const tipoIcon = v.visitType === 'pedido' ? '🛒' : (v.visitType === 'cobro' ? '💰' : (v.visitType === 'prospeccion' ? '🎯' : '📋'));
      const tipoLabel = v.visitType ? (v.visitType.charAt(0).toUpperCase() + v.visitType.slice(1)) : 'Rutina';
      const clienteEmpresa = v.companyName ? `${v.clientName} _(${v.companyName})_` : v.clientName;
      const notas = v.notes ? `\n   📝 _Nota:_ ${v.notes}` : '';

      return `${idx + 1}. ⏰ *${horaV}* — *${clienteEmpresa}*\n   ${tipoIcon} *Razón:* ${tipoLabel}${notas}`;
    }).join('\n\n');
  }

  return `🏁 *RESUMEN DE JORNADA & VISITAS - AGRICOVET* 🇬🇹
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
¡Muchas gracias por tu entrega, esfuerzo y dedicación en la ruta de hoy!

👤 *Asesor:* *${sellerName}*
💼 *Código Asesor:* #${sellerCode || 'S/C'}
📅 *Fecha:* ${fechaStr}

⏰ *Hora de Inicio de Ruta:* ${horaInicio}
🏁 *Hora Final de Ruta:* ${horaFin}
⏱️ *Tiempo Total de Ruta:* ${duracionTexto}
📍 *Total Clientes Visitados:* ${visits.length} visitas realizadas

📋 *DETALLE CRONOLÓGICO DE VISITAS:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${visitsList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 *¡Excelente trabajo en campo! Gracias por representar con excelencia a Agricovet. ¡A descansar y feliz retorno a casa!* 🚜💨
📌 _Sistema de Gestión & Rutas Comerciales Agricovet_`;
}

async function run() {
  console.log('Obteniendo datos de hoy de la base de datos...');
  
  // 1. Obtener visitas de Herbert
  const herbertVisitsRes = await pool.query(`
    SELECT "clientName", "companyName", "sellerName", "visitType", notes, "createdAt"
    FROM public.client_visits
    WHERE "sellerName" ILIKE '%Herbert%' AND "createdAt" >= '2026-09-24T00:00:00'
    ORDER BY "createdAt" ASC
  `);

  // 2. Obtener visitas de Erick
  const erickVisitsRes = await pool.query(`
    SELECT "clientName", "companyName", "sellerName", "visitType", notes, "createdAt"
    FROM public.client_visits
    WHERE "sellerName" ILIKE '%Erick%' AND "createdAt" >= '2026-09-24T00:00:00'
    ORDER BY "createdAt" ASC
  `);

  await pool.end();

  console.log(`Visitas encontradas: Herbert (${herbertVisitsRes.rows.length}), Erick (${erickVisitsRes.rows.length})`);

  // Mensaje 1: Inicio de Ruta (Ejemplo Herbert o General)
  const msgInicio = buildStartRouteMessage(
    'Herbert Argueta',
    '1521',
    '2026-09-24T13:11:07.539Z'
  );

  // Mensaje 2: Fin de Ruta Herbert Argueta
  const msgFinHerbert = buildFinishRouteMessage(
    'Herbert Argueta',
    '1521',
    '2026-09-24T13:11:07.539Z',
    '2026-09-24T21:15:00.000Z',
    herbertVisitsRes.rows,
    herbertVisitsRes.rows.length
  );

  // Mensaje 3: Fin de Ruta Erick Juárez
  const msgFinErick = buildFinishRouteMessage(
    'Erick Juárez',
    '8363',
    '2026-09-24T14:43:00.789Z',
    '2026-09-24T21:10:00.000Z',
    erickVisitsRes.rows,
    erickVisitsRes.rows.length
  );

  // Script de envío por Evolution API a través de SSH
  const pyScript = `
import urllib.request
import json
import time

def send_wa(phone, text):
    url = "http://localhost:8080/message/sendText/bot-recibos"
    headers = {
        "apikey": "B6D711FCDE4D4FD5936544120E713976",
        "Content-Type": "application/json"
    }
    data = json.dumps({"number": phone, "text": text}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.read().decode('utf-8')
    except Exception as e:
        return str(e)

print("--- 1. ENVIANDO PRUEBA: INICIO DE RUTA ---")
r1 = send_wa("${targetPhone}", """${msgInicio.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}""")
print("Respuesta 1:", r1)

time.sleep(3)

print("\\n--- 2. ENVIANDO PRUEBA: FIN DE RUTA HERBERT ARGUETA ---")
r2 = send_wa("${targetPhone}", """${msgFinHerbert.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}""")
print("Respuesta 2:", r2)

time.sleep(3)

print("\\n--- 3. ENVIANDO PRUEBA: FIN DE RUTA ERICK JUÁREZ ---")
r3 = send_wa("${targetPhone}", """${msgFinErick.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}""")
print("Respuesta 3:", r3)
`;

  console.log(`Enviando las 3 pruebas a ${targetPhone} por WhatsApp...`);
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: pyScript, encoding: 'utf-8' });

  console.log('\n=== RESULTADO DEL SERVIDOR ===\n', out);
}

run().catch(console.error);
