async function run() {
  const server = require("./dist/server.cjs");
  const localDb = server.localDb;

  // Query invoices today
  const startOfDay = "2026-11-02T00:00:00.000Z";
  const endOfDay = "2026-11-02T23:59:59.999Z";

  const { data: invData } = await localDb.from("invoices")
    .select("id, folio, clientName, nit, totalAmount, date, items, invoice_type, status, sellerId")
    .gte("date", startOfDay)
    .lte("date", endOfDay);

  const { data: allUsers } = await localDb.from("users")
    .select("id, name, email, phone, role, sellerCode");

  console.log("Invoices count:", (invData || []).length);
  
  const SALES_THRESHOLD = 8350;

  // Let's filter target sellers
  const herbert = (allUsers || []).find(u => (u.email || "").toLowerCase() === "gruasytransportesali@gmail.com");
  const erick = (allUsers || []).find(u => (u.email || "").toLowerCase() === "jerickottoniel@gmail.com");
  const emanuel = (allUsers || []).find(u => (u.email || "").toLowerCase() === "seseffff942@gmail.com");

  function calcSeller(user) {
    if (!user) return { amount: 0, count: 0 };
    const keys = [
      (user.email || "").toLowerCase(),
      user.id ? String(user.id).toLowerCase() : null,
      user.sellerCode ? String(user.sellerCode).toLowerCase() : null,
      user.name ? String(user.name).toLowerCase() : null
    ].filter(Boolean);

    let amount = 0;
    let count = 0;
    for (const inv of invData || []) {
      if (!inv || inv.status === 'cancelled' || inv.status === 'rejected') continue;
      const sId = (inv.sellerId || "").toLowerCase();
      if (keys.includes(sId) || sId === (user.email || "").toLowerCase() || (inv.sellerId && user.id && String(inv.sellerId).toLowerCase() === String(user.id).toLowerCase())) {
        amount += Number(inv.totalAmount) || 0;
        count += 1;
      }
    }
    return { amount: Math.round(amount * 100) / 100, count };
  }

  const hStats = calcSeller(herbert);
  const eStats = calcSeller(erick);
  const emStats = calcSeller(emanuel);

  console.log("Herbert:", hStats);
  console.log("Erick:", eStats);
  console.log("Emanuel:", emStats);

  const herbertMonto = hStats.amount;
  const herbertFacturas = hStats.count;
  const herbertMeta = herbertMonto >= SALES_THRESHOLD;
  const herbertDiff = herbertMeta ? (herbertMonto - SALES_THRESHOLD) : (SALES_THRESHOLD - herbertMonto);

  const erickMonto = eStats.amount;
  const erickFacturas = eStats.count;
  const erickMeta = erickMonto >= SALES_THRESHOLD;
  const erickDiff = erickMeta ? (erickMonto - SALES_THRESHOLD) : (SALES_THRESHOLD - erickMonto);

  const emanuelMonto = emStats.amount;
  const emanuelFacturas = emStats.count;
  const emanuelVendio = emanuelMonto > 0;

  const total2Vendedores = Math.round((herbertMonto + erickMonto) * 100) / 100;
  const facturas2Vendedores = herbertFacturas + erickFacturas;

  const totalGeneral = Math.round((total2Vendedores + (emanuelVendio ? emanuelMonto : 0)) * 100) / 100;
  const totalFacturasGeneral = facturas2Vendedores + (emanuelVendio ? emanuelFacturas : 0);

  const todayLabel = "2026-11-02";
  const corte = "17:00";
  const horaTexto = "5:00 PM";
  const tituloHorario = "CIERRE DEL DÍA (5:00 PM)";

  // Personalized message for Emanuel Lima ONLY
  let textoConsolidado = `📊 *RESUMEN CONSOLIDADO DE VENTAS - ${tituloHorario}* 🏢\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Estimado *Emanuel Lima*, le presentamos el consolidado oficial de ventas del día (*${todayLabel}*):\n\n` +
    `💰 *TOTAL GENERAL VENDIDO:* *Q. ${totalGeneral.toLocaleString("es-GT", { minimumFractionDigits: 2 })}*\n` +
    `📄 *Facturas Totales Hoy:* ${totalFacturasGeneral} factura(s)\n` +
    `🎯 *Meta Diaria por Asesor:* Q. ${SALES_THRESHOLD.toLocaleString("es-GT", { minimumFractionDigits: 2 })}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👥 *DETALLE POR ASESOR:*\n\n` +
    `1️⃣ *Herbert Argueta* (Asesor #1521):\n` +
    `  ▫️ Total Vendido: *Q. ${herbertMonto.toLocaleString("es-GT", { minimumFractionDigits: 2 })}* (${herbertFacturas} factura(s))\n` +
    `  ▫️ Estado: ${herbertMeta ? `🏆 *Meta Cumplida* (+Q. ${herbertDiff.toLocaleString("es-GT", { minimumFractionDigits: 2 })})` : `⚠️ *Bajo Meta* (-Q. ${herbertDiff.toLocaleString("es-GT", { minimumFractionDigits: 2 })})`}\n\n` +
    `2️⃣ *Erick Juárez* (Asesor):\n` +
    `  ▫️ Total Vendido: *Q. ${erickMonto.toLocaleString("es-GT", { minimumFractionDigits: 2 })}* (${erickFacturas} factura(s))\n` +
    `  ▫️ Estado: ${erickMeta ? `🏆 *Meta Cumplida* (+Q. ${erickDiff.toLocaleString("es-GT", { minimumFractionDigits: 2 })})` : `⚠️ *Bajo Meta* (-Q. ${erickDiff.toLocaleString("es-GT", { minimumFractionDigits: 2 })})`}\n`;

  if (emanuelVendio) {
    textoConsolidado += `\n⭐ *Emanuel Lima (Ventas Propias):*\n` +
      `  ▫️ Total Vendido: *Q. ${emanuelMonto.toLocaleString("es-GT", { minimumFractionDigits: 2 })}* (${emanuelFacturas} factura(s))\n` +
      `  ▫️ Estado: ✅ Registró ventas hoy en sistema\n`;
  }

  textoConsolidado += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n📌 _Sistema de Gestión & Rendimiento Comercial Agricovet_`;

  console.log("\n--- TEXTO CONSOLIDADO (5:00 PM) ---\n" + textoConsolidado);

  const payload = {
    fecha: todayLabel,
    corte: "17:00",
    tipoCorte: "cierre",
    tipoReporte: "cierre",
    tipo: "cierre",
    esCierre: true,
    hora: "17:00",
    horaCorte: "17:00",
    corteHora: "17:00",
    esConsolidado: true,
    titulo: `Resumen Consolidado (5:00 PM) - Emanuel Lima`,
    vendedor: "Emanuel Lima",
    nombreDestinatario: "Emanuel Lima",
    email: "seseffff942@gmail.com",
    numero: "50248234048",
    telefono: "50248234048",
    cantidadVendida: totalGeneral,
    cantidadFaltante: 0,
    alcanzoMeta: true,
    umbral: 16700,
    cantidadFacturas: totalFacturasGeneral,
    mensaje: textoConsolidado,
    textoWhatsApp: textoConsolidado,
    destinatarios: [{
      nombreDestinatario: "Emanuel Lima",
      telefono: "50248234048",
      numero: "50248234048",
      email: "seseffff942@gmail.com",
      rol: "admin"
    }],
    ventas: []
  };

  const webhookUrl = "http://185.166.39.49:5678/webhook/ventas-reporte";
  console.log("\nEnviando webhook a n8n SOLO para Emanuel Lima (50248234048)...");
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload)
  });
  const resText = await res.text();
  console.log("Respuesta n8n:", res.status, resText);
  process.exit(0);
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
