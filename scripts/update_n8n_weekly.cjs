const { execFileSync } = require('child_process');

const pyScript = `
import sqlite3, json, shutil

DB_PATH = '/var/lib/docker/volumes/n8n_data/_data/database.sqlite'
shutil.copyfile(DB_PATH, DB_PATH + '.bak_semanal')
print("Backup created successfully.")

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.execute("SELECT nodes, connections FROM workflow_entity WHERE id = 'xcs2SGXwl1jhznjI'")
row = c.fetchone()
nodes = json.loads(row[0])
conns = json.loads(row[1])

# 1. Update "Evaluar Hora y Meta"
evaluar_js = '''// Preparación de datos según las plantillas oficiales de AgricoVet (Diarias y Semanales)
const item = $input.first().json;

// Detección Semanal vs Diario
const esSemanal = Boolean(item.esSemanal || item.tipoCorte === 'semanal' || item.tipoReporte === 'semanal' || item.tipo === 'semanal');

// 1. Detección de Hora
let horaNum = 12;
if (item.corteHora) {
  horaNum = parseInt(String(item.corteHora).split(':')[0], 10);
} else if (item.corte) {
  horaNum = parseInt(String(item.corte).split(':')[0], 10);
} else if (item.horaCorte !== undefined) {
  horaNum = Number(item.horaCorte);
} else if (item.tipoCorte === 'cierre' || item.esCierre || esSemanal) {
  horaNum = 17;
} else {
  horaNum = new Date().getHours();
}

// 2. Detección de Meta
const defaultMeta = esSemanal ? 52500 : 8750;
const totalDia = Number(item.cantidadVendida !== undefined ? item.cantidadVendida : (item.totalVentasDia || item.totalVentas || 0));
const meta = Number(item.umbral || item.metaSemanal || item.metaDiaria || defaultMeta);
const metaCumplida = item.alcanzoMeta !== undefined ? Boolean(item.alcanzoMeta) : (totalDia >= meta);
const faltante = item.cantidadFaltante !== undefined ? Number(item.cantidadFaltante) : Math.max(0, meta - totalDia);
const superavit = Math.max(0, totalDia - meta);

// Determinar corte
const esCorteMediodia = !esSemanal && horaNum <= 14;

// Determinar ruta:
// 0: 12 PM - Meta Alcanzada
// 1: 12 PM - Meta No Alcanzada
// 2: 5 PM - Meta Alcanzada
// 3: 5 PM - Meta No Alcanzada
// 4: Semanal - Meta Alcanzada
// 5: Semanal - Meta No Alcanzada
let ruta = 0;
if (esSemanal) {
  ruta = metaCumplida ? 4 : 5;
} else if (esCorteMediodia) {
  ruta = metaCumplida ? 0 : 1;
} else {
  ruta = metaCumplida ? 2 : 3;
}

// Formatos numéricos
const formatNum = (val) => Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatQ = (val) => 'Q. ' + formatNum(val);

// Nombre
const nombreDestinatario = item.vendedor || item.nombreDestinatario || "Asesor";

// Teléfono limpio para Evolution API
let tel = item.telefono || item.numero || "";
if (!tel && item.destinatarios && item.destinatarios[0]) {
  tel = item.destinatarios[0].telefono || item.destinatarios[0].numero || item.destinatarios[0];
}
let telefonoDestino = String(tel).replace(/\\D/g, '');
if (telefonoDestino.length === 8) {
  telefonoDestino = '502' + telefonoDestino;
}
if (!telefonoDestino) {
  telefonoDestino = '50248234048';
}

const codigoAsesor = item.codigoAsesor || item.sellerCode || (nombreDestinatario === 'Herbert Argueta' ? '1521' : '');
const periodo = item.periodo || (item.fechaInicio && item.fechaFin ? `${item.fechaInicio} al ${item.fechaFin}` : 'Semana Actual');
const cantidadFacturas = item.cantidadFacturas !== undefined ? item.cantidadFacturas : (Array.isArray(item.ventas) ? item.ventas.length : 0);
const porcentaje = item.porcentajeCumplimiento !== undefined ? item.porcentajeCumplimiento : (meta > 0 ? (totalDia / meta * 100).toFixed(1) : '100.0');

let detalleVentas = item.detalleVentas || '';
if (!detalleVentas && Array.isArray(item.ventas) && item.ventas.length > 0) {
  detalleVentas = item.ventas.map(v => {
    const fol = v.folio ? `#${v.folio}` : 'S/F';
    let fStr = '';
    if (v.fecha) {
      fStr = ` (${v.fecha.slice(8,10)}/${v.fecha.slice(5,7)})`;
    } else if (v.date) {
      fStr = ` (${v.date.slice(8,10)}/${v.date.slice(5,7)})`;
    }
    const montoStr = Number(v.monto || v.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
    return `▫️ *${fol}*${fStr}: Q${montoStr} - ${v.cliente || v.clientName || 'Cliente'}`;
  }).join('\\n');
}

return {
  json: {
    ...item,
    ruta,
    esSemanal,
    horaCorte: horaNum,
    esCorteMediodia,
    metaCumplida,
    telefonoDestino,
    param_nombre: nombreDestinatario,
    param_codigo_asesor: codigoAsesor,
    param_periodo: periodo,
    param_cantidad_facturas: cantidadFacturas,
    param_porcentaje: porcentaje,
    param_detalle_ventas: detalleVentas,
    param_texto_completo: item.textoWhatsApp || '',
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
        print("Updated Evaluar Hora y Meta jsCode.")
    elif n['name'] == 'Bifurcación (4 Casos)':
        rules = n['parameters']['rules']['values']
        # Check if rules for 4 and 5 already exist
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
            print("Added Switch rules for Semanal (routes 4 and 5).")

# 2. Add HTTP nodes for weekly cases if not present
node_names = [n['name'] for n in nodes]

if 'Evolution Semanal Meta Cumplida' not in node_names:
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
            "jsonBody": "={{ JSON.stringify({\\n  number: $json.telefonoDestino,\\n  text: $json.param_texto_completo || `🏆 *CIERRE SEMANAL DE VENTAS - SÁBADO 5:00 PM* 🏁\\\\n━━━━━━━━━━━━━━━━━━━━━━━━━━\\\\nEstimado(a) *${$json.param_nombre}*, ¡excelente trabajo! Has culminado la semana cumpliendo exitosamente tu objetivo comercial:\\\\n\\\\n📅 *Semana:* ${$json.param_periodo}\\\\n💼 *Código Asesor:* #${$json.param_codigo_asesor}\\\\n📄 *Facturas Emitidas:* ${$json.param_cantidad_facturas} facturas\\\\n\\\\n📊 *RESUMEN FINANCIERO:*\\\\n💰 *Total Vendido Semana:* ${$json.param_total_q}\\\\n🎯 *Meta Semanal Asignada:* ${$json.param_meta_q}\\\\n📈 *Superávit Logrado:* ${$json.param_superavit_q}\\\\n🔥 *Cumplimiento Semanal:* ${$json.param_porcentaje}%\\\\n\\\\n⭐ *¡Felicitaciones por tu entrega y constancia esta semana! A descansar y recargar energías para arrancar con fuerza el lunes.* 🚀\\\\n\\\\n━━━━━━━━━━━━━━━━━━━━━━━━━━\\\\n📌 _Sistema de Gestión & Rendimiento Comercial Agricovet_`\\n}) }}",
            "options": {}
        },
        "id": "c7e45a11-5829-4d62-a39c-88248c82a101",
        "name": "Evolution Semanal Meta Cumplida",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [1040, 900]
    })
    print("Added node Evolution Semanal Meta Cumplida.")

if 'Evolution Semanal Meta No Cumplida' not in node_names:
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
            "jsonBody": "={{ JSON.stringify({\\n  number: $json.telefonoDestino,\\n  text: $json.param_texto_completo || `📊 *CIERRE SEMANAL DE VENTAS - SÁBADO 5:00 PM* 🏁\\\\n━━━━━━━━━━━━━━━━━━━━━━━━━━\\\\nEstimado(a) *${$json.param_nombre}*, te compartimos el informe consolidado de tu cierre semanal de ventas:\\\\n\\\\n📅 *Semana:* ${$json.param_periodo}\\\\n💼 *Código Asesor:* #${$json.param_codigo_asesor}\\\\n📄 *Facturas Emitidas:* ${$json.param_cantidad_facturas} facturas\\\\n\\\\n📊 *RESUMEN FINANCIERO:*\\\\n💰 *Total Vendido Semana:* ${$json.param_total_q}\\\\n🎯 *Meta Semanal Asignada:* ${$json.param_meta_q}\\\\n📉 *Faltante para la Meta:* ${$json.param_faltante_q}\\\\n📈 *Cumplimiento Semanal:* ${$json.param_porcentaje}%\\\\n\\\\n${$json.param_detalle_ventas ? '📋 *DETALLE DE VENTAS DE LA SEMANA:*\\\\n' + $json.param_detalle_ventas + '\\\\n\\\\n' : ''}💪 *¡Buen esfuerzo durante estos días! Analicemos oportunidades con nuestros clientes para que la próxima semana alcancemos la meta completa.* 🎯\\\\n\\\\n━━━━━━━━━━━━━━━━━━━━━━━━━━\\\\n📌 _Sistema de Gestión & Rendimiento Comercial Agricovet_`\\n}) }}",
            "options": {}
        },
        "id": "d8f56b22-6930-5e73-b40d-99359d93b202",
        "name": "Evolution Semanal Meta No Cumplida",
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.2,
        "position": [1040, 1100]
    })
    print("Added node Evolution Semanal Meta No Cumplida.")

# 3. Update connections
switch_conns = conns.get('Bifurcación (4 Casos)', {}).get('main', [])
while len(switch_conns) < 6:
    switch_conns.append([])

switch_conns[4] = [{"node": "Evolution Semanal Meta Cumplida", "type": "main", "index": 0}]
switch_conns[5] = [{"node": "Evolution Semanal Meta No Cumplida", "type": "main", "index": 0}]
conns['Bifurcación (4 Casos)']['main'] = switch_conns
print("Updated Bifurcación connections with outputs 4 and 5.")

# Save back to sqlite
c.execute("UPDATE workflow_entity SET nodes = ?, connections = ? WHERE id = 'xcs2SGXwl1jhznjI'", (json.dumps(nodes), json.dumps(conns)))
conn.commit()
conn.close()
print("Workflow xcs2SGXwl1jhznjI successfully updated in n8n database.")
`;

try {
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: pyScript, encoding: 'utf-8' });
  console.log(out);
} catch (e) {
  console.error('Error:', e.message);
}
