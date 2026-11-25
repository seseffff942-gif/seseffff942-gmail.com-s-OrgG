const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db'
  });

  const res = await pool.query(`
    SELECT * 
    FROM invoices 
    WHERE created_at >= '2026-11-19 00:00:00'
    ORDER BY created_at DESC;
  `);

  console.log(`Total sales Nov 19-21: ${res.rows.length}`);
  let totalUnits = 0;
  let totalQuetzales = 0;

  for (const s of res.rows) {
    let items = s.items;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch (e) {}
    }
    let saleUnits = 0;
    if (items && Array.isArray(items)) {
      for (const it of items) {
        saleUnits += Number(it.quantity || 0);
      }
    }
    totalUnits += saleUnits;
    totalQuetzales += Number(s.total || 0);
    const folio = s.invoice_number || s.folio || s.id;
    const client = s.client_name || s.clientName || '';
    const seller = s.seller_name || s.sellerName || '';
    console.log(`[${s.created_at.toISOString ? s.created_at.toISOString().slice(0,16) : s.created_at}] Folio ${folio} | ${seller} -> ${client}: Q${s.total} (${saleUnits} uds)`);
  }

  console.log(`TOTALS Nov 19-21: ${totalUnits} units, Q${totalQuetzales.toFixed(2)}`);

  // Breakdown by date
  for (const date of ['2026-11-19', '2026-11-20', '2026-11-21']) {
    const daySales = res.rows.filter(r => (r.created_at.toISOString ? r.created_at.toISOString() : String(r.created_at)).startsWith(date));
    let dUnits = 0, dQ = 0;
    for (const s of daySales) {
      let items = s.items;
      if (typeof items === 'string') { try { items = JSON.parse(items); } catch (e) {} }
      if (items && Array.isArray(items)) {
        for (const it of items) dUnits += Number(it.quantity || 0);
      }
      dQ += Number(s.total || 0);
    }
    console.log(`Date ${date}: ${daySales.length} sales, ${dUnits} units, Q${dQ.toFixed(2)}`);
  }

  await pool.end();
}

run();
