const pg = require('pg');

async function main() {
  const client = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
  await client.connect();

  // Columns of invoices
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'invoices' 
    ORDER BY ordinal_position;
  `);
  console.log('Invoices columns:', cols.rows.map(r => r.column_name).join(', '));

  // Folio range
  const folios = await client.query(`
    SELECT folio, "clientName", date, "totalAmount", "sellerId" 
    FROM invoices 
    ORDER BY id ASC 
    LIMIT 20;
  `);
  console.log('\nSample first 20 invoices:');
  folios.rows.forEach(r => console.log(`${r.folio} | ${r.date} | ${r.clientName} | Q${r.totalAmount} | ${r.sellerId}`));

  // Check folio 809
  const f809 = await client.query(`
    SELECT folio, "clientName", date, "totalAmount", "sellerId" 
    FROM invoices 
    WHERE folio ILIKE '%809%' OR folio >= '809'
    ORDER BY folio ASC
    LIMIT 30;
  `);
  console.log('\nFolios matching 809 or >= 809:');
  f809.rows.forEach(r => console.log(`${r.folio} | ${r.date} | ${r.clientName} | Q${r.totalAmount} | ${r.sellerId}`));

  // All distinct folios format
  const allFolios = await client.query(`
    SELECT DISTINCT folio 
    FROM invoices 
    ORDER BY folio ASC;
  `);
  console.log(`\nTotal distinct folios: ${allFolios.rows.length}`);
  console.log('Folios sample:', allFolios.rows.slice(0, 15).map(r => r.folio).join(', '));
  console.log('Folios end sample:', allFolios.rows.slice(-15).map(r => r.folio).join(', '));

  await client.end();
}

main().catch(console.error);
