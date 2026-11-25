const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db' });
async function run() {
  const res = await pool.query("SELECT id, folio, items FROM invoices WHERE items::text ILIKE '%Gratis%'");
  console.log('Found invoices to update:', res.rows.length);
  for (const r of res.rows) {
    let items = r.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch(e) {}
    }
    if (Array.isArray(items)) {
      items = items.map(it => {
        if (it.productName) {
          it.productName = it.productName
            .replace(/\s*\(\s*Bonificación\s*\/\s*Gratis\s*\)/gi, ' (Bonificación)')
            .replace(/\s*\(\s*Gratis\s*\)/gi, ' (Bonificación)');
        }
        return it;
      });
      await pool.query("UPDATE invoices SET items = $1 WHERE id = $2", [JSON.stringify(items), r.id]);
      console.log(`Updated folio ${r.folio}`);
    }
  }
  await pool.end();
}
run();
