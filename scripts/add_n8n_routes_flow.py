import sqlite3, json, shutil, os

DB_PATH = '/var/lib/docker/volumes/n8n_data/_data/database.sqlite'
if not os.path.exists(DB_PATH):
    print("Error: database.sqlite not found at", DB_PATH)
    exit(1)

shutil.copyfile(DB_PATH, DB_PATH + '.bak_before_rutas_webhook')
print("✅ Backup creado exitosamente en database.sqlite.bak_before_rutas_webhook")

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.execute("SELECT nodes, connections FROM workflow_entity WHERE id = 'workflowCobros01'")
row = c.fetchone()
if not row:
    print("Error: workflowCobros01 not found")
    exit(1)

nodes = json.loads(row[0])
conns = json.loads(row[1])

# Check if already exists
existing_names = [n['name'] for n in nodes]
print(f"Workflow actual tiene {len(nodes)} nodos y {len(conns)} conexiones.")

code_js = '''const item = $input.first().json;
const body = item.body || item;

const action = body.action || 'finish_route';
const sellerName = body.sellerName || 'Asesor';
const sellerCode = body.sellerCode || 'S/C';
const startedAt = body.startedAt;
const finishedAt = body.finishedAt || new Date().toISOString();
const visits = body.visits || [];
const targetPhone = body.phone || '50248234048';

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

let text = '';

if (action === 'start_route') {
  const fechaStr = formatDateGuatemala(startedAt);
  const horaStr = formatTimeGuatemala(startedAt);

  text = `🚀 *INICIO DE RUTA EN TERRENO - AGRICOVET* 🇬🇹
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
¡Buenos días, *${sellerName}*! Has iniciado exitosamente tu ruta comercial:

💼 *Código Asesor:* #${sellerCode}
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
} else {
  // Fin de ruta
  const fechaStr = formatDateGuatemala(startedAt);
  const horaInicio = formatTimeGuatemala(startedAt);
  const horaFin = formatTimeGuatemala(finishedAt);

  const diffMs = new Date(finishedAt).getTime() - new Date(startedAt || finishedAt).getTime();
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const duracionTexto = diffHrs > 0 ? `${diffHrs}h ${diffMins}m` : `${diffMins} min`;

  let visitsList = '';
  if (!visits || visits.length === 0) {
    visitsList = '• _No se registraron visitas durante esta jornada._\\n';
  } else {
    visitsList = visits.map((v, idx) => {
      const horaV = formatTimeGuatemala(v.createdAt || v.created_at);
      const tipoRaw = String(v.visitType || v.visit_type || 'rutina').toLowerCase();
      const tipoIcon = tipoRaw === 'pedido' ? '🛒' : (tipoRaw === 'cobro' ? '💰' : (tipoRaw === 'prospeccion' ? '🎯' : '📋'));
      const tipoLabel = tipoRaw.charAt(0).toUpperCase() + tipoRaw.slice(1);
      const cName = v.clientName || v.client_name || 'Cliente';
      const compName = v.companyName || v.company_name;
      const clienteEmpresa = compName ? `${cName} _(${compName})_` : cName;
      const notas = v.notes ? `\\n   📝 _Nota:_ ${v.notes}` : '';

      return `${idx + 1}. ⏰ *${horaV}* — *${clienteEmpresa}*\\n   ${tipoIcon} *Razón:* ${tipoLabel}${notas}`;
    }).join('\\n\\n');
  }

  text = `🏁 *RESUMEN DE JORNADA & VISITAS - AGRICOVET* 🇬🇹
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
¡Muchas gracias por tu entrega, esfuerzo y dedicación en la ruta de hoy!

👤 *Asesor:* *${sellerName}*
💼 *Código Asesor:* #${sellerCode}
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

let cleanPhone = String(targetPhone).replace(/\\D/g, '');
if (cleanPhone.length === 8) cleanPhone = '502' + cleanPhone;

return [{
  json: {
    number: cleanPhone,
    text: text,
    action: action,
    sellerName: sellerName,
    sellerCode: sellerCode,
    totalVisits: visits.length
  }
}];
''';

node_webhook = {
  "parameters": {
    "httpMethod": "POST",
    "path": "rutas-visitas",
    "options": {}
  },
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2,
  "position": [
    -5808,
    4800
  ],
  "id": "1c-rutas-webhook-9999-aaaa",
  "name": "1c. Webhook Rutas y Visitas (rutas-visitas)",
  "webhookId": "1c-rutas-webhook-9999-aaaa"
}

node_code = {
  "parameters": {
    "jsCode": code_js
  },
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [
    -5408,
    4800
  ],
  "id": "2c-rutas-format-code-9999-bbbb",
  "name": "Formatear Resumen de Rutas (WhatsApp)"
}

node_http = {
  "parameters": {
    "method": "POST",
    "url": "http://evolution_api:8080/message/sendText/bot-recibos",
    "sendHeaders": True,
    "headerParameters": {
      "parameters": [
        {
          "name": "apikey",
          "value": "B6D711FCDE4D4FD5936544120E713976"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "sendBody": True,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({\\n  number: $json.number,\\n  text: $json.text\\n}) }}",
    "options": {}
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [
    -5008,
    4800
  ],
  "id": "3c-rutas-send-wa-9999-cccc",
  "name": "📲 Enviar WhatsApp Rutas (Evolution API)"
}

# Filtrar si ya existían los nuevos para reemplazarlos limpiamente
nodes = [n for n in nodes if n['name'] not in [node_webhook['name'], node_code['name'], node_http['name']]]
nodes.append(node_webhook)
nodes.append(node_code)
nodes.append(node_http)

# Agregar conexiones para el nuevo flujo SIN TOCAR ninguna otra conexión existente
conns[node_webhook['name']] = {
  "main": [
    [
      {
        "node": node_code['name'],
        "type": "main",
        "index": 0
      }
    ]
  ]
}

conns[node_code['name']] = {
  "main": [
    [
      {
        "node": node_http['name'],
        "type": "main",
        "index": 0
      }
    ]
  ]
}

c.execute("UPDATE workflow_entity SET nodes = ?, connections = ? WHERE id = 'workflowCobros01'",
          (json.dumps(nodes), json.dumps(conns)))
conn.commit()
conn.close()

print(f"✅ Workflow actualizado en SQLite: Ahora tiene {len(nodes)} nodos y {len(conns)} conexiones.")
