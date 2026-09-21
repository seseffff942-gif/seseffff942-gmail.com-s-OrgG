const { execFileSync } = require('child_process');

const pyScript = `
import sqlite3, json

DB_PATH = '/var/lib/docker/volumes/n8n_data/_data/database.sqlite'
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.execute("SELECT versionId, activeVersionId, nodes, connections FROM workflow_entity WHERE id = 'workflowCobros01'")
row = c.fetchone()
version_id, active_version_id, nodes_json, conns_json = row
nodes = json.loads(nodes_json)
conns = json.loads(conns_json)

# Read the logo base64 directly from /opt/evolution-api/boletas_guardadas/logo_ti_v2.jpg as fallback
import base64
with open('/opt/evolution-api/boletas_guardadas/logo_ti_v2.jpg', 'rb') as f:
    fallback_b64 = base64.b64encode(f.read()).decode('ascii')
print(f"Fallback logo loaded, length: {len(fallback_b64)}")

# 1. Update Evaluar Hora y Meta
for n in nodes:
    if n['name'] == 'Evaluar Hora y Meta':
        js = n['parameters']['jsCode']
        # Replace the return object to include param_logo_base64
        if 'param_logo_base64' not in js:
            js = js.replace(
                "param_texto_completo: body.textoWhatsApp || '',",
                f"param_texto_completo: body.textoWhatsApp || '',\\n    param_logo_base64: body.logoBase64 || body.logo || '{fallback_b64}',"
            )
            n['parameters']['jsCode'] = js
            print("Updated Evaluar Hora y Meta with param_logo_base64.")

# 2. Update all 6 WhatsApp nodes to sendMedia
node_captions = {
    "WhatsApp 12PM Meta Cumplida": "🎉 NOTIFICACIÓN DE META ALCANZADA 🏆\\\\n\\\\nEstimado(a) ${$json.param_nombre}, confirmamos que has cumplido tu objetivo de ventas al mediodía:\\\\n\\\\n💰 Ventas registradas hoy: ${$json.param_total_num}\\\\n🎯 Meta del día: ${$json.param_meta_num}\\\\n📈 Excedente logrado: ${$json.param_superavit_num}\\\\n\\\\n📌 Notificación del sistema de seguimiento de ventas.",
    "WhatsApp 12PM Meta No Cumplida": "📊 REPORTE Y ESTADO DE VENTAS - 12:00 PM 🕛\\\\n\\\\nEstimado ${$json.param_nombre}, se notifica el resumen de tu cuenta al mediodía:\\\\n\\\\n💰 Total vendido hoy: ${$json.param_total_num}\\\\n🎯 Meta asignada: ${$json.param_meta_num}\\\\n⚠️ Balance pendiente: ${$json.param_faltante_num}\\\\n\\\\n📌 Notificación automática del sistema de gestión.",
    "WhatsApp 5PM Cierre Meta Cumplida": "🏆 REPORTE FINAL DEL DÍA - 5:00 PM 🌅\\\\n\\\\nEstimado ${$json.param_nombre}, cerramos el día con excelentes resultados:\\\\n\\\\n💰 Total vendido hoy: ${$json.param_total_q}\\\\n🎯 Meta asignada: ${$json.param_meta_q}\\\\n📈 Superávit logrado: ${$json.param_superavit_q}\\\\n\\\\n¡Felicitaciones! Superaste tu objetivo del día. 🎉\\\\n\\\\n📌 Notificación automática del sistema de seguimiento de ventas.",
    "WhatsApp 5PM Cierre Meta No Cumplida": "📊 INFORME FINAL DEL DÍA - 17:00 🌅\\\\n\\\\nEstimado ${$json.param_nombre}, cerramos el día con el siguiente resumen:\\\\n\\\\n💰 Total vendido hoy: ${$json.param_total_q}\\\\n🎯 Meta establecida: ${$json.param_meta_q}\\\\n📉 Faltante para la meta: ${$json.param_faltante_q}\\\\n\\\\n¡Buen esfuerzo hoy! Mañana seguimos con todo para alcanzar la meta del día. 💪",
    "WhatsApp Semanal Meta Cumplida": "$json.param_texto_completo || `🏆 *CIERRE SEMANAL DE VENTAS - SÁBADO 5:00 PM* 🏁\\\\n━━━━━━━━━━━━━━━━━━━━━━━━━━\\\\nEstimado(a) *${$json.param_nombre}*, ¡excelente trabajo! Has culminado la semana cumpliendo exitosamente tu objetivo comercial:\\\\n\\\\n📅 *Semana:* ${$json.param_periodo}\\\\n💼 *Código Asesor:* #${$json.param_codigo_asesor}\\\\n📄 *Facturas Emitidas:* ${$json.param_cantidad_facturas} facturas\\\\n\\\\n📊 *RESUMEN FINANCIERO:*\\\\n💰 *Total Vendido Semana:* ${$json.param_total_q}\\\\n🎯 *Meta Semanal Asignada:* ${$json.param_meta_q}\\\\n📈 *Superávit Logrado:* ${$json.param_superavit_q}\\\\n🔥 *Cumplimiento Semanal:* ${$json.param_porcentaje}%\\\\n\\\\n⭐ *¡Felicitaciones por tu entrega y constancia esta semana! A descansar y recargar energías para arrancar con fuerza el lunes.* 🚀\\\\n\\\\n━━━━━━━━━━━━━━━━━━━━━━━━━━\\\\n📌 _Sistema de Gestión & Rendimiento Comercial Agricovet_`",
    "WhatsApp Semanal Meta No Cumplida": "$json.param_texto_completo || `📊 *CIERRE SEMANAL DE VENTAS - SÁBADO 5:00 PM* 🏁\\\\n━━━━━━━━━━━━━━━━━━━━━━━━━━\\\\nEstimado(a) *${$json.param_nombre}*, te compartimos el informe consolidado de tu cierre semanal de ventas:\\\\n\\\\n📅 *Semana:* ${$json.param_periodo}\\\\n💼 *Código Asesor:* #${$json.param_codigo_asesor}\\\\n📄 *Facturas Emitidas:* ${$json.param_cantidad_facturas} facturas\\\\n\\\\n📊 *RESUMEN FINANCIERO:*\\\\n💰 *Total Vendido Semana:* ${$json.param_total_q}\\\\n🎯 *Meta Semanal Asignada:* ${$json.param_meta_q}\\\\n📉 *Faltante para la Meta:* ${$json.param_faltante_q}\\\\n📈 *Cumplimiento Semanal:* ${$json.param_porcentaje}%\\\\n\\\\n${$json.param_detalle_ventas ? '📋 *DETALLE DE VENTAS DE LA SEMANA:*\\\\n' + $json.param_detalle_ventas + '\\\\n\\\\n' : ''}💪 *¡Buen esfuerzo durante estos días! Analicemos oportunidades con nuestros clientes para que la próxima semana alcancemos la meta completa.* 🎯\\\\n\\\\n━━━━━━━━━━━━━━━━━━━━━━━━━━\\\\n📌 _Sistema de Gestión & Rendimiento Comercial Agricovet_`"
}

for n in nodes:
    name = n['name']
    if name in node_captions:
        cap_expr = node_captions[name]
        if not cap_expr.startswith('$json.param_texto_completo'):
            caption_code = f"`{cap_expr}`"
        else:
            caption_code = cap_expr

        n['parameters']['url'] = "http://evolution_api:8080/message/sendMedia/bot-recibos"
        n['parameters']['jsonBody'] = f"={{{{ JSON.stringify({{\\n  number: $json.to_phone,\\n  mediatype: 'image',\\n  mimetype: 'image/jpeg',\\n  caption: {caption_code},\\n  media: $json.param_logo_base64 || $json.logoBase64\\n}}) }}}}"
        print(f"Updated node '{name}' to sendMedia with logo.")

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
print("All 6 WhatsApp nodes updated successfully with logo sendMedia!")
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
  console.error(e.message);
}
