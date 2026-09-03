/**
 * test-meta-completada.js
 * 
 * Script de prueba independiente para enviar datos de prueba (MOCK) 
 * con la META ALCANZADA al webhook de n8n.
 * 
 * Diseñado exclusivamente para probar las plantillas de WhatsApp.
 * Destinatario único: Emanuel Lima (seseffff942@gmail.com / 50248234048).
 * 
 * Uso:
 *   node scripts/test-meta-completada.js
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

async function runTestMockMetaAlcanzada() {
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
  const CANTIDAD_VENDIDA = 11450.00; // Meta superada
  const CANTIDAD_FALTANTE = 0.00;
  const ALCANZO_META = true;
  const CANTIDAD_FACTURAS = 4;

  const mockVentas = [
    {
      id: 'inv-test-001',
      folio: 'FAC-8901',
      cliente: 'Agropecuaria El Roble',
      nit: '7845123-9',
      monto: 3850.00,
      tipo: 'contado',
      estado: 'completado',
      hora: '09:15',
      productos: [
        {
          producto: 'PUYA ELECTRICAS RECARGABLE (112 CM)',
          cantidad: 3,
          precioUnitario: 850.00,
          subtotal: 2550.00
        },
        {
          producto: 'Báscula Ganadera Digital 500KG',
          cantidad: 1,
          precioUnitario: 1300.00,
          subtotal: 1300.00
        }
      ]
    },
    {
      id: 'inv-test-002',
      folio: 'FAC-8902',
      cliente: 'Granja Avícola San José',
      nit: '1249876-4',
      monto: 2400.00,
      tipo: 'credito',
      estado: 'completado',
      hora: '11:40',
      productos: [
        {
          producto: 'PUYA ELECTRICAS RECARGABLE (98 CM)',
          cantidad: 3,
          precioUnitario: 800.00,
          subtotal: 2400.00
        }
      ]
    },
    {
      id: 'inv-test-003',
      folio: 'FAC-8903',
      cliente: 'Veterinaria Los Cedros',
      nit: '5561234-1',
      monto: 3200.00,
      tipo: 'contado',
      estado: 'completado',
      hora: '14:20',
      productos: [
        {
          producto: 'Kit Inseminación Artificial Bovina Pro',
          cantidad: 2,
          precioUnitario: 1600.00,
          subtotal: 3200.00
        }
      ]
    },
    {
      id: 'inv-test-004',
      folio: 'FAC-8904',
      cliente: 'Finca La Esperanza',
      nit: '9984120-K',
      monto: 2000.00,
      tipo: 'contado',
      estado: 'completado',
      hora: '16:05',
      productos: [
        {
          producto: 'Cerca Eléctrica Solar Portátil 10KM',
          cantidad: 1,
          precioUnitario: 2000.00,
          subtotal: 2000.00
        }
      ]
    }
  ];

  const payload = {
    fecha: todayLabel,
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
    mensaje: `¡Felicidades ${mockSeller.nombreDestinatario}! Has superado con éxito tu meta de ventas de hoy con un total de Q${CANTIDAD_VENDIDA.toLocaleString('es-GT', { minimumFractionDigits: 2 })} en ${CANTIDAD_FACTURAS} facturas emitidas.`,
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
  console.log('🧪 PRUEBA DE CORTE DE VENTAS - META ALCANZADA (MOCK)');
  console.log('═'.repeat(60));
  console.log(`📅 Fecha:              ${payload.fecha}`);
  console.log(`👤 Destinatario:       ${payload.nombreDestinatario} (${payload.email})`);
  console.log(`📱 Teléfono:           ${payload.telefono}`);
  console.log(`🎯 Meta / Umbral:      Q${UMBRAL.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`);
  console.log(`💰 Cantidad Vendida:   Q${CANTIDAD_VENDIDA.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`);
  console.log(`📉 Cantidad Faltante:  Q${CANTIDAD_FALTANTE.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`);
  console.log(`🏆 ¿Alcanzó Meta?:     ${ALCANZO_META ? 'SÍ (🟢 META SUPERADA)' : 'NO'}`);
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

runTestMockMetaAlcanzada();
