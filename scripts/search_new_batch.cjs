const pg = require('pg');

async function searchNew() {
  const client = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
  await client.connect();

  const newTargets = [
    { name: "Jose Antonio Nufio", place: "San Andres", terms: ["nufio", "antonio nufio"] },
    { name: "Julio Morales", place: "Paxcaman", terms: ["julio morales", "paxcaman", "morales"] },
    { name: "Nery Paredes", place: "El Mango / Santa Ana", terms: ["nery paredes", "paredes", "el mango"] },
    { name: "Mariela Salguero", place: "San Luis", terms: ["mariela", "salguero", "salguéro"] },
    { name: "Marvin Reyes", place: "Santa Elena", terms: ["marvin reyes", "marvin"] },
    { name: "Yeimy Catalan", place: "San Andres Dos Aguadas", terms: ["yeimy", "catalan", "catalán"] },
    { name: "Daniel Luis (Agro Rural)", place: "Santa Elena", terms: ["daniel luis", "agro rural", "emil daniel"] },
    { name: "Maria Izabel", place: "San Luis", terms: ["maria izabel", "izabel", "maria isabel"] }
  ];

  console.log('=== BÚSQUEDA DE NUEVOS CLIENTES DE ABRIL / PÁGINAS 3 Y 4 ===\n');

  for (const t of newTargets) {
    console.log(`\n🔍 Buscando: ${t.name} (${t.place})`);
    
    // Facturas
    const conditions = t.terms.map(term => `LOWER(i."clientName") LIKE '%${term.toLowerCase()}%'`).join(' OR ');
    const invRes = await client.query(`
      SELECT i.folio, i.date, i."clientName", i."totalAmount", i."sellerId",
             u.name as seller_name, u.email as seller_email
      FROM invoices i
      LEFT JOIN users u ON (u.email = i."sellerId" OR u.id = i."sellerId")
      WHERE (${conditions})
      ORDER BY i.date ASC
    `);

    if (invRes.rows.length > 0) {
      console.log(`   🧾 Facturas encontradas (${invRes.rows.length}):`);
      for (const inv of invRes.rows) {
        console.log(`      - Folio ${inv.folio} (${String(inv.date).split('T')[0]}): "${inv.clientName}" | Q${inv.totalAmount} | Vendedor: ${inv.seller_name || inv.sellerId}`);
      }
    } else {
      console.log(`   ❌ Facturas: 0 encontradas`);
    }

    // Clientes en catálogo
    const cliConditions = t.terms.map(term => `LOWER(c.name) LIKE '%${term.toLowerCase()}%' OR LOWER(c."companyName") LIKE '%${term.toLowerCase()}%' OR LOWER(c.address) LIKE '%${term.toLowerCase()}%'`).join(' OR ');
    const cliRes = await client.query(`
      SELECT c.id, c.name, c."companyName", c.address, c."sellerId", u.name as seller_name
      FROM clients c
      LEFT JOIN users u ON (u.email = c."sellerId" OR u.id = c."sellerId")
      WHERE (${cliConditions})
    `);

    if (cliRes.rows.length > 0) {
      console.log(`   👤 En catálogo (${cliRes.rows.length}):`);
      for (const cli of cliRes.rows) {
        console.log(`      - ${cli.name} [${cli.companyName}] (${cli.address}) | Vendedor: ${cli.seller_name}`);
      }
    } else {
      console.log(`   👤 En catálogo: No registrado`);
    }
  }

  await client.end();
}

searchNew();
