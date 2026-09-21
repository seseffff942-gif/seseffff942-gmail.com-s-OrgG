const pg = require('pg');

async function main() {
  const c = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
  await c.connect();

  const unmatchedNames = [
    'hector', 'mendoza', 'eider', 'guerra', 'espina', 'rashel', 'lidia', 'leonidas', 'giron', 'molina', 'walter'
  ];

  console.log('--- QUOTATIONS ---');
  for (const n of unmatchedNames) {
    const q = await c.query('SELECT id, "clientName", "sellerId", total FROM quotations WHERE "clientName" ILIKE $1;', [`%${n}%`]);
    if (q.rows.length > 0) {
      console.log(`Quotations matching "${n}":`, q.rows);
    }
  }

  console.log('\n--- RECIBOS DE CAJA ---');
  for (const n of unmatchedNames) {
    const rc = await c.query('SELECT id, folio, "clientName", amount, "sellerId" FROM recibos_caja WHERE "clientName" ILIKE $1;', [`%${n}%`]);
    if (rc.rows.length > 0) {
      console.log(`Recibos de caja matching "${n}":`, rc.rows);
    }
  }

  console.log('\n--- RECIBOS CONFORMES ---');
  for (const n of unmatchedNames) {
    const rcf = await c.query('SELECT id, folio, "clientName", "sellerId" FROM recibos_conformes WHERE "clientName" ILIKE $1;', [`%${n}%`]);
    if (rcf.rows.length > 0) {
      console.log(`Recibos conformes matching "${n}":`, rcf.rows);
    }
  }

  await c.end();
}

main();
