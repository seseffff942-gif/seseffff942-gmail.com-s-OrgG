const pg = require('pg');
const fs = require('fs');

async function testAllPending() {
  const client = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
  await client.connect();

  const data52 = JSON.parse(fs.readFileSync('scripts/clean_master_audit_52.json', 'utf-8'));
  const pending = data52.filter(x => x.estado === 'PENDIENTE' && x.id !== 29); // exclude Wilder Lemus since we already verified him

  const invs = (await client.query(`
    SELECT i.folio, i.date, i."clientName", i."totalAmount", u.name as seller_name
    FROM invoices i
    LEFT JOIN users u ON (u.email = i."sellerId" OR u.id = i."sellerId")
    WHERE i.is_archived IS NOT TRUE
  `)).rows;

  console.log('--- BUSCANDO COINCIDENCIAS PARA CADA UNO DE LOS PENDIENTES ---');
  for (const p of pending) {
    const words = p.nombre.toLowerCase().replace(/[\(\)\/]/g, '').split(' ').filter(w => w.length > 3);
    const matches = invs.filter(inv => {
      const cn = (inv.clientName || '').toLowerCase();
      return words.some(w => cn.includes(w));
    });

    console.log(`\n• #${p.id} ${p.nombre} (${p.lugar}):`);
    if (matches.length > 0) {
      for (const m of matches) {
        console.log(`   ? Folio ${m.folio} (${String(m.date).split('T')[0]}): "${m.clientName}" | Q${m.totalAmount} | Vendedor: ${m.seller_name}`);
      }
    } else {
      console.log('   0 coincidencias.');
    }
  }

  await client.end();
}

testAllPending();
