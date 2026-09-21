const N8N_WEBHOOK_URL = 'http://185.166.39.49:5678/webhook/ventas-reporte';

async function testWebhook() {
  const payload = {
    esSemanal: true,
    tipoCorte: 'semanal',
    tipoReporte: 'semanal',
    vendedor: 'Herbert Argueta',
    codigoAsesor: '1521',
    periodo: 'Lunes 14/09/2026 al Sábado 19/09/2026',
    cantidadFacturas: 7,
    cantidadVendida: 24849.85,
    umbral: 52500.00,
    cantidadFaltante: 27650.15,
    alcanzoMeta: false,
    porcentajeCumplimiento: '47.3',
    telefono: '50248234048', // Emanuel Lima
    ventas: [
      { folio: '1162', fecha: '2026-09-14', monto: 14222.83, cliente: 'Alex García (Agroveterinaria Bances)' },
      { folio: '1163', fecha: '2026-09-16', monto: 2418.50, cliente: 'Pablo Aroche (Distribuidora Bello Progreso)' },
      { folio: '1167', fecha: '2026-09-16', monto: 1211.00, cliente: 'Delvin Flores (Agroservicios Nissi)' },
      { folio: '1169', fecha: '2026-09-17', monto: 2624.00, cliente: 'Edy Rosales (Agroveterinaria El Finquero)' },
      { folio: '1170', fecha: '2026-09-17', monto: 1179.00, cliente: 'Leonardo González (Agroveterinaria El Éxito)' },
      { folio: '1171', fecha: '2026-09-17', monto: 974.52, cliente: 'Copropiedad Peláez (Agroveterinaria Eben Ezer)' },
      { folio: '1173', fecha: '2026-09-17', monto: 2220.00, cliente: 'Juan Pineda (Agro Mi Arlet)' }
    ]
  };

  console.log('Enviando payload semanal a n8n:', N8N_WEBHOOK_URL);
  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    console.log(`Respuesta n8n: HTTP ${res.status} - ${text}`);
  } catch (e) {
    console.error('Error enviando webhook:', e.message);
  }
}

testWebhook();
