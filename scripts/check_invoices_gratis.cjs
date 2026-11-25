const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db' });
async function run() {
  const res = await pool.query("SELECT id, folio, items FROM invoices WHERE items::text ILIKE '%Gratis%'");
  console.log('Invoices with Gratis:', res.rows.length);
  for (const r of res.rows) {
    console.log('Invoice folio:', r.folio);
  }
  await pool.end();
}
run();
