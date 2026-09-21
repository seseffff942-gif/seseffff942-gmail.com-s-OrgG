const pg = require('pg');
const fs = require('fs');

async function extractInvoices() {
  const client = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
  await client.connect();

  const clients52 = JSON.parse(fs.readFileSync('scripts/clean_master_audit_52.json', 'utf-8'));
  
  const allFolios = [];
  for (const c of clients52) {
    if (c.folios && !c.folios.includes('Sin compras')) {
      const fList = c.folios.split(',').map(s => s.trim());
      allFolios.push(...fList);
    }
  }

  const res = await client.query(`
    SELECT i.folio, i.date, i."clientName", i."totalAmount", i."sellerId",
           u.name as seller_name, u.email as seller_email
    FROM invoices i
    LEFT JOIN users u ON (u.email = i."sellerId" OR u.id = i."sellerId")
    WHERE i.folio = ANY($1)
    ORDER BY CAST(NULLIF(regexp_replace(i.folio, '\\D', '', 'g'), '') AS INTEGER) ASC, i.date ASC
  `, [allFolios]);

  const invoiceDetails = [];
  for (const row of res.rows) {
    const isErick = (row.seller_email || '').includes('jerick') || (row.seller_name || '').toLowerCase().includes('erick');
    if (!isErick) continue;

    // Find which client this folio belongs to
    const matchedClient = clients52.find(c => {
      if (!c.folios || c.folios.includes('Sin compras')) return false;
      const fList = c.folios.split(',').map(s => s.trim());
      return fList.includes(row.folio);
    });

    invoiceDetails.push({
      folio: row.folio,
      fecha: row.date ? String(row.date).split('T')[0] : 'S/F',
      refLibreta: matchedClient ? matchedClient.nombre : 'Desconocido',
      lugar: matchedClient ? matchedClient.lugar : 'Petén',
      clienteFactura: row.clientName,
      monto: Number(row.totalAmount || 0),
      vendedor: 'Erick Juárez'
    });
  }

  fs.writeFileSync('scripts/master_invoices_detail_52.json', JSON.stringify(invoiceDetails, null, 2), 'utf-8');
  console.log(`✅ ${invoiceDetails.length} facturas de Erick guardadas en scripts/master_invoices_detail_52.json.`);

  const sum = invoiceDetails.reduce((a, b) => a + b.monto, 0);
  console.log(`Total facturado en detalle: Q${sum.toFixed(2)}`);

  await client.end();
}

extractInvoices();
