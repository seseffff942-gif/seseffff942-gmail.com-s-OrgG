# -*- coding: utf-8 -*-
with open('server.ts', 'r', encoding='utf-8') as f:
    content = f.read()

idx_start = content.find('for (const adm of adminRecipients)')
idx_end = content.find('payloadsToDispatch.push({\n        recipientName: adm.name,')

assert idx_start != -1 and idx_end != -1, f"Indices not found: {idx_start}, {idx_end}"

clean_block = '''for (const adm of adminRecipients) {
      const horaTexto = corte === "17:00" ? "5:00 PM" : "12:00 PM";
      const tituloHorario = corte === "17:00" ? "CIERRE DEL DÍA (5:00 PM)" : "CORTE DE MEDIODÍA (12:00 PM)";

      let textoConsolidado = `📊 *RESUMEN CONSOLIDADO DE VENTAS - ${tituloHorario}* 🏢\\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\\n` +
        `Estimado *${adm.name}*, le presentamos el consolidado oficial de ventas del día (*${todayLabel}*):\\n\\n` +
        `💰 *TOTAL GENERAL VENDIDO:* *Q. ${totalGeneral.toLocaleString("es-GT", { minimumFractionDigits: 2 })}*\\n` +
        `📄 *Facturas Totales Hoy:* ${totalFacturasGeneral} factura(s)\\n` +
        `🎯 *Meta Diaria por Asesor:* Q. ${SALES_THRESHOLD.toLocaleString("es-GT", { minimumFractionDigits: 2 })}\\n\\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\\n` +
        `👥 *DETALLE POR ASESOR:*\\n\\n` +
        `1️⃣ *Herbert Argueta* (Asesor #1521):\\n` +
        `  ▫️ Total Vendido: *Q. ${herbertMonto.toLocaleString("es-GT", { minimumFractionDigits: 2 })}* (${herbertFacturas} factura(s))\\n` +
        `  ▫️ Estado: ${herbertMeta ? `🏆 *Meta Cumplida* (+Q. ${herbertDiff.toLocaleString("es-GT", { minimumFractionDigits: 2 })})` : `⚠️ *Bajo Meta* (-Q. ${herbertDiff.toLocaleString("es-GT", { minimumFractionDigits: 2 })})`}\\n\\n` +
        `2️⃣ *Erick Juárez* (Asesor):\\n` +
        `  ▫️ Total Vendido: *Q. ${erickMonto.toLocaleString("es-GT", { minimumFractionDigits: 2 })}* (${erickFacturas} factura(s))\\n` +
        `  ▫️ Estado: ${erickMeta ? `🏆 *Meta Cumplida* (+Q. ${erickDiff.toLocaleString("es-GT", { minimumFractionDigits: 2 })})` : `⚠️ *Bajo Meta* (-Q. ${erickDiff.toLocaleString("es-GT", { minimumFractionDigits: 2 })})`}\\n`;

      if (emanuelVendio) {
        textoConsolidado += `\\n⭐ *Emanuel Lima (Ventas Propias):*\\n` +
          `  ▫️ Total Vendido: *Q. ${emanuelMonto.toLocaleString("es-GT", { minimumFractionDigits: 2 })}* (${emanuelFacturas} factura(s))\\n` +
          `  ▫️ Estado: ✅ Registró ventas hoy en sistema\\n`;
      }

      textoConsolidado += `━━━━━━━━━━━━━━━━━━━━━━━━━━\\n📌 _Sistema de Gestión & Rendimiento Comercial Agricovet_`;

      '''

content = content[:idx_start] + clean_block + content[idx_end:]

with open('server.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('Clean UTF-8 block written successfully!')

