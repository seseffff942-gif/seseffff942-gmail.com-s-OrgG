/**
 * check-daily-sales.js
 * 
 * Consulta la base de datos de Supabase para obtener las ventas de hoy del vendedor seseffff942@gmail.com.
 * Captura dinámicamente:
 *   - cantidadVendida: Total acumulado en Quetzales vendido hoy por seseffff942@gmail.com
 *   - cantidadFaltante: Cuánto le falta para llegar a la meta (Q8,750.00)
 *   - alcanzoMeta: Booleano indicando si superó o igualó los Q8,750.00
 * 
 * Envía una solicitud HTTP POST al webhook de n8n con estas variables procesadas.
 *
 * Uso:
 *   node scripts/check-daily-sales.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ─── Configuración ──────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Faltan variables de entorno: SUPABASE_URL y/o SUPABASE_ANON_KEY');
  process.exit(1);
}

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'http://localhost:5678/webhook/ventas-reporte';

const SALES_THRESHOLD = Number(process.env.SALES_THRESHOLD) || 8750;

// Vendedor objetivo específico
const TARGET_SELLER_EMAIL = 'seseffff942@gmail.com';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTodayRangeGT() {
  const now = new Date();
  const gtOffset = -6 * 60; // UTC-6 (Guatemala)
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const gtNow = new Date(utcMs + gtOffset * 60000);

  const year = gtNow.getFullYear();
  const month = String(gtNow.getMonth() + 1).padStart(2, '0');
  const day = String(gtNow.getDate()).padStart(2, '0');

  const startOfDay = `${year}-${month}-${day}T00:00:00`;
  const endOfDay = `${year}-${month}-${day}T23:59:59`;

  return { startOfDay, endOfDay, todayLabel: `${year}-${month}-${day}` };
}

// ─── Lógica principal ───────────────────────────────────────────────────────

async function main() {
  const { startOfDay, endOfDay, todayLabel } = getTodayRangeGT();

  console.log(`\n` + '─'.repeat(60));
  console.log(`🕛 Revisando ventas del día: ${todayLabel}`);
  console.log(`   Rango: ${startOfDay}  →  ${endOfDay}`);
  console.log(`   Umbral mínimo: Q${SALES_THRESHOLD.toLocaleString('es-GT')}`);
  console.log(`   Vendedor a monitorear: ${TARGET_SELLER_EMAIL}`);
  console.log('─'.repeat(60) + '\n');

  // 1. Obtener usuario de Supabase para validar ID/email/nombre/teléfono
  const { data: usersData } = await supabase
    .from('users')
    .select('id, name, email, phone')
    .ilike('email', TARGET_SELLER_EMAIL);

  const foundUser = usersData && usersData.length > 0 ? usersData[0] : null;
  const sellerIdKeys = [
    TARGET_SELLER_EMAIL.toLowerCase(),
    foundUser?.id ? foundUser.id.toLowerCase() : null,
  ].filter(Boolean);

  const sellerDisplayName = foundUser?.name || TARGET_SELLER_EMAIL.split('@')[0];
  const sellerPhone = foundUser?.phone || process.env.TARGET_SELLER_PHONE || '+50248234048';

  // 2. Consultar facturas de hoy en Supabase
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, folio, clientName, nit, totalAmount, date, items, invoice_type, status, sellerId')
    .gte('date', startOfDay)
    .lte('date', endOfDay);

  if (error) {
    console.error('❌ Error al consultar Supabase:', error.message);
    process.exit(1);
  }

  // 3. Filtrar y sumar únicamente las facturas de seseffff942@gmail.com
  let cantidadVendida = 0;
  let cantidadFacturas = 0;
  const ventas = [];

  for (const inv of invoices || []) {
    const sId = (inv.sellerId || '').toLowerCase();
    if (sellerIdKeys.includes(sId) || sId === TARGET_SELLER_EMAIL.toLowerCase()) {
      const amount = Number(inv.totalAmount) || 0;
      cantidadVendida += amount;
      cantidadFacturas += 1;

      // Formatear hora de la venta
      let horaVenta = '';
      if (inv.date) {
        try {
          const d = new Date(inv.date);
          horaVenta = d.toLocaleTimeString('es-GT', { timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit' });
        } catch {
          horaVenta = inv.date;
        }
      }

      // Detalle de productos de la factura
      const productos = (inv.items || []).map((item) => ({
        producto: item.productName || item.name || 'Producto',
        cantidad: item.quantity || 1,
        precioUnitario: item.price || 0,
        subtotal: item.total || 0,
      }));

      ventas.push({
        id: inv.id,
        folio: inv.folio || '',
        cliente: inv.clientName || 'Cliente',
        nit: inv.nit || 'CF',
        monto: amount,
        tipo: inv.invoice_type || 'contado',
        estado: inv.status || 'completado',
        hora: horaVenta,
        productos,
      });
    }
  }

  // 4. Calcular variables dinámicas
  cantidadVendida = Math.round(cantidadVendida * 100) / 100;
  const cantidadFaltante = Math.max(
    0,
    Math.round((SALES_THRESHOLD - cantidadVendida) * 100) / 100
  );
  const alcanzoMeta = cantidadVendida >= SALES_THRESHOLD;

  const estado = alcanzoMeta ? '🟢 META ALCANZADA' : '🔴 BAJO META';
  console.log(`   ${estado}  ${sellerDisplayName} (${TARGET_SELLER_EMAIL})`);
  console.log(`   📱 Teléfono / Número: ${sellerPhone}`);
  console.log(`   💰 Cantidad Vendida:  Q${cantidadVendida.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`);
  console.log(`   📉 Cantidad Faltante: Q${cantidadFaltante.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`);
  console.log(`   📊 Total Facturas Hoy: ${cantidadFacturas}\n`);

  // 5. Construir payload exclusivo con tu información, tu número y tus ventas del día
  const payload = {
    fecha: todayLabel,
    vendedor: sellerDisplayName,
    email: TARGET_SELLER_EMAIL,
    numero: sellerPhone,
    telefono: sellerPhone,
    cantidadVendida,
    cantidadFaltante,
    alcanzoMeta,
    umbral: SALES_THRESHOLD,
    cantidadFacturas,
    mensaje: alcanzoMeta
      ? `Hola ${sellerDisplayName}, has alcanzado la meta de ventas de hoy con un total de Q${cantidadVendida.toLocaleString('es-GT', { minimumFractionDigits: 2 })} en ${cantidadFacturas} factura(s).`
      : `Hola ${sellerDisplayName}, has vendido Q${cantidadVendida.toLocaleString('es-GT', { minimumFractionDigits: 2 })} hoy (${cantidadFacturas} factura(s)). Te faltan Q${cantidadFaltante.toLocaleString('es-GT', { minimumFractionDigits: 2 })} para llegar a la meta de Q${SALES_THRESHOLD.toLocaleString('es-GT')}.`,
    ventas,
  };

  await sendWebhook(payload);
}

// ─── Envío del webhook ──────────────────────────────────────────────────────

async function sendWebhook(payload) {
  console.log(`📤 Enviando variables dinámicas al webhook de n8n...`);
  console.log(`   URL: ${N8N_WEBHOOK_URL}`);

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text().catch(() => '');

    if (response.ok) {
      console.log(`✅ Webhook enviado exitosamente (status ${response.status})`);
      if (responseText) console.log(`   Respuesta n8n: ${responseText}`);
    } else {
      console.error(`❌ Error al enviar webhook: HTTP ${response.status}`);
      if (responseText) console.error(`   Detalle: ${responseText}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ No se pudo conectar al webhook:`, err.message);
    process.exit(1);
  }
}

// ─── Ejecutar ───────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('❌ Error inesperado:', err);
  process.exit(1);
});
