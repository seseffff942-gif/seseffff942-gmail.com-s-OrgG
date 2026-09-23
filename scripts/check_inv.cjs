const pg = require('pg');
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:evolution_pass@185.166.39.49:5432/agricovet_db' });

async function check() {
  const r = await pool.query('SELECT id, folio, "sellerId", "clientName", "totalAmount" FROM public.invoices WHERE id = $1', ['INV-1790009269310-190']);
  console.log('DB INVOICE:', r.rows);

  const r2 = await pool.query('SELECT id, name, "sellerId" FROM public.clients WHERE id = $1', ['CLI-1786722281555']);
  console.log('DB CLIENT:', r2.rows);

  await pool.end();
}
check();
