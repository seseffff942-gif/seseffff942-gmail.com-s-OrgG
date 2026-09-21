const pg = require('pg');

async function main() {
  const client = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
  await client.connect();

  console.log('--- BUSCANDO POR LUGARES (Poptun, Dolores, El Remate, San Francisco, El Chal, Ixlu) ---');
  
  const places = ['remate', 'poptun', 'poptún', 'mopan', 'san francisco', 'chal', 'ixlu', 'zapote', 'caoba'];
  for (const p of places) {
    const res = await client.query(`
      SELECT id, name, "companyName", address, "sellerId" 
      FROM clients 
      WHERE address ILIKE $1 OR "companyName" ILIKE $1 OR name ILIKE $1;
    `, [`%${p}%`]);
    console.log(`\n📍 Lugar "${p}" (${res.rows.length} clientes encontrados):`);
    res.rows.forEach(r => console.log(`   - ${r.name} | ${r.companyName} | ${r.address} | ${r.sellerId}`));
  }

  console.log('\n--- BUSCANDO POR NOMBRES ESPECÍFICOS ---');
  const names = ['hector', 'mendoza', 'eider', 'eyder', 'guerra', 'espina', 'rashel', 'rachel', 'lidia', 'bello', 'leonidas', 'giron', 'girón', 'walter', 'molina'];
  for (const n of names) {
    const res = await client.query(`
      SELECT id, name, "companyName", address, "sellerId" 
      FROM clients 
      WHERE name ILIKE $1 OR "companyName" ILIKE $1;
    `, [`%${n}%`]);
    if (res.rows.length > 0) {
      console.log(`\n🔍 Nombre "${n}" en clientes:`);
      res.rows.forEach(r => console.log(`   - ${r.name} | ${r.companyName} | ${r.address}`));
    }

    const inv = await client.query(`
      SELECT folio, "clientName", date, "totalAmount", "sellerId"
      FROM invoices
      WHERE "clientName" ILIKE $1;
    `, [`%${n}%`]);
    if (inv.rows.length > 0) {
      console.log(`   Facturas con "${n}" (${inv.rows.length}):`);
      inv.rows.forEach(i => console.log(`      * Folio: ${i.folio} | ${i.clientName} | Q${i.totalAmount}`));
    }
  }

  await client.end();
}

main();
