import sqlite3, json, shutil

DB_PATH = '/var/lib/docker/volumes/n8n_data/_data/database.sqlite'
shutil.copyfile(DB_PATH, DB_PATH + '.bak_cobros_semanal')
print("Backup created successfully.")

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.execute("SELECT nodes, connections FROM workflow_entity WHERE id = 'workflowCobros01'")
row = c.fetchone()
nodes = json.loads(row[0])
conns = json.loads(row[1])

# 1. Update "Evaluar Hora y Meta"
evaluar_js = '''// Mapeo de variables de ventas (Diarias y Semanales)
const inputData = $input.first().json;
const body = inputData.body || inputData;

// Detección Semanal vs Diario
const esSemanal = Boolean(body.esSemanal || body.tipoCorte === 'semanal' || body.tipoReporte === 'semanal' || body.tipo === 'semanal');

// Extraer hora y corte
let horaNum = NaN;
if (body.horaCorte !== undefined && body.horaCorte !== null) {
  const match = String(body.horaCorte).trim().match(/^(\d+)/);
  if (match) horaNum = Number(match[1]);
} else if (body.hora !== undefined && body.hora !== null) {
  const match = String(body.hora).trim().match(/^(\d+)/);
  if (match) horaNum = Number(match[1]);
}

if (isNaN(horaNum)) {
  horaNum = new Date().getHours();
}

// Determinar corte (12 PM vs 5 PM vs Semanal)
let esCorteMediodia = false;
if (esSemanal) {
  esCorteMediodia = false;
} else if (body.esCierre !== undefined && body.esCierre !== null) {
  esCorteMediodia = !body.esCierre;
} else if (body.tipo) {
  esCorteMediodia = /medio|12/i.test(String(body.tipo));
} else if (body.titulo) {
  esCorteMediodia = /medio|12/i.test(String(body.titulo));
} else {
  esCorteMediodia = horaNum <= 14;
}

// Extraer valores numéricos del payload
const defaultMeta = esSemanal ? 52500 : 8750;
const meta = Number(body.umbral !== undefined ? body.umbral : (body.metaSemanal || body.metaDiaria || body.meta || defaultMeta));
const totalDia = Number(body.cantidadVendida !== undefined ? body.cantidadVendida : (body.totalVentasDia || body.totalVentas || body.total || 0));
const metaCumplida = body.alcanzoMeta !== undefined ? Boolean(body.alcanzoMeta) : (body.metaCumplida !== undefined ? Boolean(body.metaCumplida) : totalDia >= meta);
const faltante = body.cantidadFaltante !== undefined ? Number(body.cantidadFaltante) : (body.montoFaltante !== undefined ? Number(body.montoFaltante) : Math.max(0, meta - totalDia));
const superavit = Math.max(0, totalDia - meta);
const fecha = body.fecha || new Date().toLocaleDateString('es-GT');

// Determinar ruta:
// 0: 12pm Alcanzada
// 1: 12pm No Alcanzada
// 2: 5pm Alcanzada
// 3: 5pm No Alcanzada
// 4: Semanal Alcanzada
// 5: Semanal No Alcanzada
let ruta = 0;
if (esSemanal) {
  ruta = metaCumplida ? 4 : 5;
} else if (esCorteMediodia) {
  ruta = metaCumplida ? 0 : 1;
} else {
  ruta = metaCumplida ? 2 : 3;
}

// Formateadores numéricos limpios (ej: 4,000 / Q.4,000.00)
const formatNum = (val) => Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatQ = (val) => 'Q. ' + formatNum(val);

// Nombre del destinatario
const nombre = String(body.nombreDestinatario || body.vendedor || body.nombre || "Asesor").trim();

// Extracción del teléfono
let rawPhone = "";
if (Array.isArray(body.destinatarios) && body.destinatarios.length > 0) {
  const first = body.destinatarios[0];
  rawPhone = typeof first === 'object' && first !== null ? (first.telefono || first.phone || first.numero || "") : String(first);
} else if (body.numero || body.telefono || body.phone || body.celular || body.to) {
  rawPhone = String(body.numero || body.telefono || body.phone || body.celular || body.to);
}

let cleanPhone = String(rawPhone).replace(/\\D/g, "");
if (cleanPhone.length === 8) {
  cleanPhone = "502" + cleanPhone;
} else if (!cleanPhone || cleanPhone.length < 8) {
  cleanPhone = "50248234048";
}

const codigoAsesor = body.codigoAsesor || body.sellerCode || (nombre === 'Herbert Argueta' ? '1521' : '');
const periodo = body.periodo || (body.fechaInicio && body.fechaFin ? `${body.fechaInicio} al ${body.fechaFin}` : 'Semana Actual');
const cantidadFacturas = body.cantidadFacturas !== undefined ? body.cantidadFacturas : (Array.isArray(body.ventas) ? body.ventas.length : 0);
const porcentaje = body.porcentajeCumplimiento !== undefined ? body.porcentajeCumplimiento : (meta > 0 ? (totalDia / meta * 100).toFixed(1) : '100.0');

let detalleVentas = body.detalleVentas || '';
if (!detalleVentas && Array.isArray(body.ventas) && body.ventas.length > 0) {
  detalleVentas = body.ventas.map(v => {
    const fol = v.folio ? `#${v.folio}` : 'S/F';
    let fStr = '';
    if (v.fecha) {
      fStr = ` (${v.fecha.slice(8,10)}/${v.fecha.slice(5,7)})`;
    } else if (v.date) {
      fStr = ` (${v.date.slice(8,10)}/${v.date.slice(5,7)})`;
    } else if (v.hora) {
      fStr = ` (${v.hora})`;
    }
    const montoStr = Number(v.monto || v.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
    return `▫️ *${fol}*${fStr}: Q${montoStr} - ${v.cliente || v.clientName || 'Cliente'}`;
  }).join('\\n');
}

return {
  json: {
    ...body,
    ruta,
    esSemanal,
    horaCorte: horaNum,
    esCorteMediodia,
    metaCumplida,
    to_phone: cleanPhone,
    param_nombre: nombre,
    param_codigo_asesor: codigoAsesor,
    param_periodo: periodo,
    param_cantidad_facturas: cantidadFacturas,
    param_porcentaje: porcentaje,
    param_detalle_ventas: detalleVentas,
    param_texto_completo: body.textoWhatsApp || '',
    param_total_num: formatNum(totalDia),
    param_meta_num: formatNum(meta),
    param_faltante_num: formatNum(faltante),
    param_superavit_num: formatNum(superavit),
    param_total_q: formatQ(totalDia),
    param_meta_q: formatQ(meta),
    param_faltante_q: formatQ(faltante),
    param_superavit_q: formatQ(superavit)
  }
};''';

for n in nodes:
    if n['name'] == 'Evaluar Hora y Meta':
        n['parameters']['jsCode'] = evaluar_js
        print("Updated Evaluar Hora y Meta in workflowCobros01.")
        break

# 2. Update Bifurcación
switch_node_name = None
for n in nodes:
    if 'Bifurcac' in n['name']:
        switch_node_name = n['name']
        rules = n['parameters']['rules']['values']
        has_4 = any(r.get('outputKey') == 'Semanal - Meta Alcanzada' for r in rules)
        if not has_4:
            rules.append({
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                    "conditions": [{"leftValue": "={{ $json.ruta }}", "rightValue": 4, "operator": {"type": "number", "operation": "equals"}}],
                    "combinator": "and"
                },
                "renameOutput": True,
                "outputKey": "Semanal - Meta Alcanzada"
            })
            rules.append({
                "conditions": {
                    "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                    "conditions": [{"leftValue": "={{ $json.ruta }}", "rightValue": 5, "operator": {"type": "number", "operation": "equals"}}],
                    "combinator": "and"
                },
                "renameOutput": True,
                "outputKey": "Semanal - Meta No Alcanzada"
            })
            print("Added Switch rules 4 & 5 to Bifurcación.")
        break

# 3. Add weekly HTTP nodes
node_names = [n['name'] for n in nodes]

if 'WhatsApp Semanal Meta Cumplida' not in node_names:
    nodes.append({
        "parameters": {
            "method": "POST",
            "url": "http://evolution_api:8080/message/sendText/bot-recibos",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [
                    {"name": "apikey", "value": "B6D711FCDE4D4FD5936544120E713976"},
                    {"name": "Content-Type", "value": "application/json"}
                ]
            },
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": "={{ JSON.stringify({\n  number: $json.to_phone,\n  text: $json.param_texto_completo || `🏆 *CIERRE SEMANAL DE VENTAS - SÁBADO 5:00 PM* 🏁\\n━━━━━━━━━━━━━━━━━━━━━━━━━━\\nEstimado(a) *${$json.param_nombre}*, ¡excelente trabajo! Has culminado la semana cumpliendo exitosamente tu objetivo comercial:\\n\\n📅 *Semana:* ${$json.param_periodo}\\n💼 *Código Asesor:* #${$json.param_codigo_asesor}\\n📄 *Facturas Emitidas:* ${$json.param_cantidad_facturas} facturas\\n\\n📊 *RESUMEN FINANCIERO:*\\n💰 *Total Vendido Semana:* ${$json.param_total_q}\\n🎯 *Meta Semanal Asignada:* ${$json.param_meta_q}\\n📈 *Superávit Logrado:* ${$json.param_superavit_q}\\n🔥 *Cumplimiento Semanal:* ${$json.param_porcentaje}%\\n\\n⭐ *¡Felicitaciones por tu entrega y constancia esta semana! A descansar y recargar energías para arrancar con fuerza el lunes.* 🚀\\n\\n━━━━━━━━━━━━━━━━━━━━━━━━━━\\n📌 _Sistema de Gestión & Rendimiento Comercial Agricovet_`\n}) }}",
            "options": {}
        },
        "id": "e9f67c33-7041-5f84-c51e-00460e04c303",
        "name": "WhatsApp Semanal Meta Cumplida",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [-3800, 2400]
    })
    print("Added node WhatsApp Semanal Meta Cumplida.")

if 'WhatsApp Semanal Meta No Cumplida' not in node_names:
    nodes.append({
        "parameters": {
            "method": "POST",
            "url": "http://evolution_api:8080/message/sendText/bot-recibos",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [
                    {"name": "apikey", "value": "B6D711FCDE4D4FD5936544120E713976"},
                    {"name": "Content-Type", "value": "application/json"}
                ]
            },
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": "={{ JSON.stringify({\n  number: $json.to_phone,\n  text: $json.param_texto_completo || `📊 *CIERRE SEMANAL DE VENTAS - SÁBADO 5:00 PM* 🏁\\n━━━━━━━━━━━━━━━━━━━━━━━━━━\\nEstimado(a) *${$json.param_nombre}*, te compartimos el informe consolidado de tu cierre semanal de ventas:\\n\\n📅 *Semana:* ${$json.param_periodo}\\n💼 *Código Asesor:* #${$json.param_codigo_asesor}\\n📄 *Facturas Emitidas:* ${$json.param_cantidad_facturas} facturas\\n\\n📊 *RESUMEN FINANCIERO:*\\n💰 *Total Vendido Semana:* ${$json.param_total_q}\\n🎯 *Meta Semanal Asignada:* ${$json.param_meta_q}\\n📉 *Faltante para la Meta:* ${$json.param_faltante_q}\\n📈 *Cumplimiento Semanal:* ${$json.param_porcentaje}%\\n\\n${$json.param_detalle_ventas ? '📋 *DETALLE DE VENTAS DE LA SEMANA:*\\n' + $json.param_detalle_ventas + '\\n\\n' : ''}💪 *¡Buen esfuerzo durante estos días! Analicemos oportunidades con nuestros clientes para que la próxima semana alcancemos la meta completa.* 🎯\\n\\n━━━━━━━━━━━━━━━━━━━━━━━━━━\\n📌 _Sistema de Gestión & Rendimiento Comercial Agricovet_`\n}) }}",
            "options": {}
        },
        "id": "fa078d44-8152-6a95-d62f-11571f15d404",
        "name": "WhatsApp Semanal Meta No Cumplida",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [-3800, 2600]
    })
    print("Added node WhatsApp Semanal Meta No Cumplida.")

# 4. Update connections
if switch_node_name:
    conn_key = None
    for k in conns.keys():
        if 'Bifurcac' in k or k == switch_node_name:
            conn_key = k
            break
    if conn_key:
        switch_conns = conns.get(conn_key, {}).get('main', [])
        while len(switch_conns) < 6:
            switch_conns.append([])
        switch_conns[4] = [{"node": "WhatsApp Semanal Meta Cumplida", "type": "main", "index": 0}]
        switch_conns[5] = [{"node": "WhatsApp Semanal Meta No Cumplida", "type": "main", "index": 0}]
        conns[conn_key]['main'] = switch_conns
        print(f"Updated connections for {conn_key} with outputs 4 and 5.")

c.execute("UPDATE workflow_entity SET nodes = ?, connections = ? WHERE id = 'workflowCobros01'", (json.dumps(nodes), json.dumps(conns)))
conn.commit()
conn.close()
print("SUCCESS: Workflow workflowCobros01 updated in n8n database.")
