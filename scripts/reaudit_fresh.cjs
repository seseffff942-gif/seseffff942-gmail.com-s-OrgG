const pg = require('pg');
const fs = require('fs');

async function reaudit() {
  const client = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
  await client.connect();

  const data52 = JSON.parse(fs.readFileSync('scripts/clean_master_audit_52.json', 'utf-8'));

  console.log('--- RE-AUDITANDO LOS 52 CLIENTES CON LA BASE DE PRODUCCIÓN SINCRONIZADA ---');

  for (const c of data52) {
    // Buscar facturas
    const nParts = c.nombre.toLowerCase().split(' ').filter(p => p.length > 2 && !p.includes('(') && !p.includes(')'));
    
    const res = await client.query(`
      SELECT i.folio, i.date, i."clientName", i."totalAmount", i."sellerId", u.name as seller_name
      FROM invoices i
      LEFT JOIN users u ON (u.email = i."sellerId" OR u.id = i."sellerId")
      WHERE i.is_archived IS NOT TRUE
    `);

    const matches = res.rows.filter(inv => {
      const cn = (inv.clientName || '').toLowerCase();
      // Check exact matching rules
      if (c.id === 29) { // Wilder Lemus
        return cn.includes('wilder lemus') || (cn.includes('lemus') && cn.includes('amigo'));
      }
      if (c.id === 44) { // Yeimy Catalan
        return cn.includes('yeimy') && (cn.includes('catalan') || cn.includes('catalán') || cn.includes('dr'));
      }
      return false;
    });

    if (matches.length > 0) {
      console.log(`\n• #${c.id} ${c.nombre} (${c.lugar}):`);
      for (const m of matches) {
        console.log(`   - Folio ${m.folio} (${String(m.date).split('T')[0]}): "${m.clientName}" | Q${m.totalAmount} | Vendedor: ${m.seller_name}`);
      }
    }
  }

  await client.end();
}

reaudit();
