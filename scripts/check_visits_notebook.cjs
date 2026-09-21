const pg = require('pg');

async function main() {
  const c = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
  await c.connect();

  const visits = await c.query(`
    SELECT v.id, v."clientName", v."sellerName", v."visitType", v."createdAt", v.notes, v."clientCode"
    FROM client_visits v
    ORDER BY v."createdAt" DESC;
  `);
  console.log(`Total visits recorded: ${visits.rows.length}`);
  visits.rows.forEach(v => {
    console.log(`[VISIT] ${v.createdAt ? String(v.createdAt).split('T')[0] : 'S/F'} | ${v.clientName} | Vendedor: ${v.sellerName} | Tipo: ${v.visitType} | Notas: ${v.notes || ''}`);
  });

  await c.end();
}

main();
