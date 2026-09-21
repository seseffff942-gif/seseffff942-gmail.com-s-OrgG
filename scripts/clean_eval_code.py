import sqlite3, json

DB_PATH = '/var/lib/docker/volumes/n8n_data/_data/database.sqlite'
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.execute("SELECT versionId, activeVersionId, nodes, connections FROM workflow_entity WHERE id = 'workflowCobros01'")
row = c.fetchone()
version_id, active_version_id, nodes_json, conns_json = row
nodes = json.loads(nodes_json)

# Reset Evaluar Hora y Meta cleanly
eval_code = """// Mapeo de variables de ventas (Diarias y Semanales)
const inputData = $input.first().json;
const body = inputData.body || inputData;

// Detección Semanal vs Diario
const esSemanal = Boolean(body.esSemanal || body.tipoCorte === 'semanal' || body.tipoReporte === 'semanal' || body.tipo === 'semanal');

// Extraer hora y corte
let horaNum = NaN;
if (body.horaCorte !== undefined && body.horaCorte !== null) {
  const match = String(body.horaCorte).trim().match(/^(\\d+)/);
  if (match) horaNum = Number(match[1]);
} else if (body.hora !== undefined && body.hora !== null) {
  const match = String(body.hora).trim().match(/^(\\d+)/);
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

// Logo corporativo en base64 (División TI & Rendimiento Comercial)
const logoBase64 = body.logoBase64 || body.logo || '';

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
    param_logo_base64: logoBase64,
    param_total_num: formatNum(totalDia),
    param_meta_num: formatNum(meta),
    param_faltante_num: formatNum(faltante),
    param_superavit_num: formatNum(superavit),
    param_total_q: formatQ(totalDia),
    param_meta_q: formatQ(meta),
    param_faltante_q: formatQ(faltante),
    param_superavit_q: formatQ(superavit)
  }
};
"""

for n in nodes:
    if n['name'] == 'Evaluar Hora y Meta':
        n['parameters']['jsCode'] = eval_code
        print("Updated Evaluar Hora y Meta with clean code.")

# Save to workflow_entity
updated_nodes_json = json.dumps(nodes)
c.execute("UPDATE workflow_entity SET nodes = ? WHERE id = 'workflowCobros01'", (updated_nodes_json,))

# Save to workflow_history
c.execute("""
    UPDATE workflow_history 
    SET nodes = ?
    WHERE workflowId = 'workflowCobros01' AND versionId IN (?, ?)
""", (updated_nodes_json, version_id, active_version_id))

print(f"Updated workflow_history rows: {c.rowcount}")
conn.commit()
conn.close()
print("Clean Evaluar Hora y Meta applied successfully.")
