const pg = require('pg');

async function inspect() {
  const client = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
  await client.connect();

  const r = await client.query(`
    SELECT i.folio, i.date, i."clientName", i."totalAmount", i."sellerId", u.name as seller_name
    FROM invoices i
    LEFT JOIN users u ON (u.email = i."sellerId" OR u.id = i."sellerId")
    WHERE CAST(NULLIF(regexp_replace(i.folio, '\\D', '', 'g'), '') AS INTEGER) >= 1140
    ORDER BY CAST(NULLIF(regexp_replace(i.folio, '\\D', '', 'g'), '') AS INTEGER) ASC;
  `);

  console.log('Facturas recientes (Folios 1140 en adelante):');
  for (const row of r.rows) {
    console.log(`Folio ${row.folio} (${String(row.date).split('T')[0]}): "${row.clientName}" | Q${row.totalAmount} | Vendedor: ${row.seller_name || row.sellerId}`);
  }

  await client.end();
}

inspect();
