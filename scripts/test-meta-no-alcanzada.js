/**
 * test-meta-no-alcanzada.js
 * 
 * Script de prueba independiente para enviar datos de prueba (MOCK) 
 * con la META NO ALCANZADA (Corte 5:00 PM) al webhook de n8n.
 * 
 * Diseñado exclusivamente para probar las plantillas de WhatsApp de Meta No Alcanzada.
 * Destinatario único: Emanuel Lima (seseffff942@gmail.com / 50248234048).
 * 
 * Uso:
 *   node scripts/test-meta-no-alcanzada.js
 */

import 'dotenv/config';

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  'https://flattop-accent-throttle.ngrok-free.dev/webhook/ventas-reporte';

function getTodayFormattedGT() {
  const now = new Date();
  const gtOffset = -6 * 60; // UTC-6 Guatemala
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const gtNow = new Date(utcMs + gtOffset * 60000);

  const year = gtNow.getFullYear();
  const month = String(gtNow.getMonth() + 1).padStart(2, '0');
  const day = String(gtNow.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

async function runTestMockMetaNoAlcanzada() {
  const todayLabel = getTodayFormattedGT();

  const mockSeller = {
    nombreDestinatario: 'Emanuel Lima',
    vendedor: 'Emanuel Lima',
    email: 'seseffff942@gmail.com',
    telefono: '50248234048',
    numero: '50248234048',
    rol: 'admin'
  };

  const UMBRAL = 8750.00;
  const CANTIDAD_VENDIDA = 3650.00; // Por debajo de la meta
  const CANTIDAD_FALTANTE = 5100.00; // Le faltan Q5,100.00
  const ALCANZO_META = false;
  const CANTIDAD_FACTURAS = 2;

  const mockVentas = [
    {
      id: 'inv-test-101',
      folio: 'FAC-8910',
      cliente: 'Rancho Santa Marta',
      nit: '3341290-7',
      monto: 2050.00,
      tipo: 'contado',
      estado: 'completado',
      hora: '10:30',
      productos: [
        {
          producto: 'PUYA ELECTRICAS RECARGABLE (98 CM)',
          cantidad: 2,
          precioUnitario: 800.00,
          subtotal: 1600.00
        },
        {
          producto: 'Vitaminas y Minerales Ganaderos 5KG',
          cantidad: 1,
          precioUnitario: 450.00,
          subtotal: 450.00
        }
      ]
    },
    {
      id: 'inv-test-102',
      folio: 'FAC-8911',
      cliente: 'Hacienda El Paraíso',
      nit: '6612984-2',
      monto: 1600.00,
      tipo: 'contado',
      estado: 'completado',
      hora: '15:15',
      productos: [
        {
          producto: 'Desparasitante Bovino Amplio Espectro 1L',
          cantidad: 2,
          precioUnitario: 800.00,
          subtotal: 1600.00
        }
      ]
    }
  ];

  const payload = {
    fecha: todayLabel,
    corte: 'cierre',
    tipoCorte: 'cierre',
    tipoReporte: 'cierre',
    tipo: 'cierre',
    esCierre: true,
    momento: 'cierre',
    hora: '17:00',
    horaCorte: '17:00',
    corteHora: '17:00',
    titulo: 'Cierre del Día',
    vendedor: mockSeller.vendedor,
    nombreDestinatario: mockSeller.nombreDestinatario,
    email: mockSeller.email,
    numero: mockSeller.numero,
    telefono: mockSeller.telefono,
    cantidadVendida: CANTIDAD_VENDIDA,
    cantidadFaltante: CANTIDAD_FALTANTE,
    alcanzoMeta: ALCANZO_META,
    umbral: UMBRAL,
    cantidadFacturas: CANTIDAD_FACTURAS,
    mensaje: `Hola ${mockSeller.nombreDestinatario}, cierre del día (5:00 PM): has acumulado Q${CANTIDAD_VENDIDA.toLocaleString('es-GT', { minimumFractionDigits: 2 })} en ventas hoy (${CANTIDAD_FACTURAS} factura(s)). Te faltaron Q${CANTIDAD_FALTANTE.toLocaleString('es-GT', { minimumFractionDigits: 2 })} para llegar a la meta de Q${UMBRAL.toLocaleString('es-GT')}.`,
    destinatarios: [
      {
        nombreDestinatario: mockSeller.nombreDestinatario,
        telefono: mockSeller.telefono,
        numero: mockSeller.numero,
        email: mockSeller.email,
        rol: mockSeller.rol
      }
    ],
    ventas: mockVentas
  };

  console.log('\n' + '═'.repeat(60));
  console.log('🧪 PRUEBA DE CORTE DE VENTAS - META NO ALCANZADA (5:00 PM MOCK)');
  console.log('═'.repeat(60));
  console.log(`📅 Fecha:              ${payload.fecha}`);
  console.log(`⏰ Corte:              5:00 PM (17:00)`);
  console.log(`👤 Destinatario:       ${payload.nombreDestinatario} (${payload.email})`);
  console.log(`📱 Teléfono:           ${payload.telefono}`);
  console.log(`🎯 Meta / Umbral:      Q${UMBRAL.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`);
  console.log(`💰 Cantidad Vendida:   Q${CANTIDAD_VENDIDA.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`);
  console.log(`📉 Cantidad Faltante:  Q${CANTIDAD_FALTANTE.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`);
  console.log(`🔴 ¿Alcanzó Meta?:     ${ALCANZO_META ? 'SÍ' : 'NO (🔴 BAJO META)'}`);
  console.log(`📄 Cantidad Facturas:  ${CANTIDAD_FACTURAS}`);
  console.log(`🌐 URL Webhook:        ${N8N_WEBHOOK_URL}`);
  console.log('═'.repeat(60) + '\n');

  try {
    console.log('📤 Enviando payload de prueba al webhook...');
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const bodyText = await res.text().catch(() => '');

    if (res.ok) {
      console.log(`✅ Webhook enviado con éxito (HTTP ${res.status})`);
      console.log(`📩 Respuesta n8n: ${bodyText}\n`);
    } else {
      console.error(`❌ El webhook respondió con error: HTTP ${res.status}`);
      console.error(`   Detalle: ${bodyText}\n`);
      if (res.status === 404) {
        console.log('💡 TIP: Asegúrate de que el flujo en n8n esté con el interruptor "Active" (Activado) o en modo "Listen for test event".');
      }
    }
  } catch (err) {
    console.error('❌ Error de conexión al enviar el webhook:', err.message);
  }
}

runTestMockMetaNoAlcanzada();
