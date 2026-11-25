const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db'
  });

  const res = await pool.query(`
    SELECT id, folio, "clientName", date, total, items, status
    FROM invoices 
    WHERE date >= '2026-11-19'
    ORDER BY date DESC, id DESC;
  `);

  console.log(`Invoices Nov 19-21: ${res.rows.length}`);
  let totalUnits = 0;
  let totalQ = 0;

  for (const inv of res.rows) {
    let items = inv.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) {}
    }
    let u = 0;
    if (items && Array.isArray(items)) {
      for (const it of items) u += Number(it.quantity || 0);
    }
    totalUnits += u;
    totalQ += Number(inv.total || 0);
    console.log(`Folio #${inv.folio} | Date: ${inv.date} | Status: ${inv.status} | Client: ${inv.clientName} | Total: Q${inv.total} | Units: ${u}`);
  }

  console.log(`Total units sold: ${totalUnits}, Total Q sold: Q${totalQ.toFixed(2)}`);

  await pool.end();
}

run();
