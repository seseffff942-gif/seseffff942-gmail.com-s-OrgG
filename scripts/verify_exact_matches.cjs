const pg = require('pg');

async function main() {
  const client = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
  await client.connect();

  const invoices = (await client.query(`
    SELECT i.id, i.folio, i."clientName", i.date, i."totalAmount", i."sellerId",
           u.name as seller_name, u.email as seller_email
    FROM invoices i
    LEFT JOIN users u ON (u.email = i."sellerId" OR u.id = i."sellerId")
    WHERE i.is_archived IS NOT TRUE
    ORDER BY CAST(NULLIF(regexp_replace(i.folio, '\\D', '', 'g'), '') AS INTEGER) ASC, i.date ASC;
  `)).rows;

  const clients = (await client.query(`
    SELECT c.id, c.name, c."companyName", c.phone, c.address, c."sellerId",
           u.name as seller_name
    FROM clients c
    LEFT JOIN users u ON (u.email = c."sellerId" OR u.id = c."sellerId");
  `)).rows;

  const targets = [
    { name: "Cesar Noyola", zone: "Aldea La Maquina" },
    { name: "Brenda Duarte", zone: "Cruce dos Aguadas" },
    { name: "Wilder Lemus", zone: "Poptun" },
    { name: "Elio Arreaza", zone: "Poptun" },
    { name: "Ervin Hernandez", zone: "Sacpuy" },
    { name: "Hugo Sutuj", zone: "El Chal" },
    { name: "Hary Campos", zone: "El Chal" },
    { name: "Sherlina Marroquin", zone: "Santa Ana" },
    { name: "Ermides Recinos", zone: "El Naranjo" },
    { name: "Luis Carranza", zone: "Dolores" },
    { name: "Edwin Lopez", zone: "Sabaneta Dolores" },
    { name: "Jose Alejandro Ordoñez", zone: "San Luis" },
    { name: "Sara Ipiña", zone: "Chacalte San Luis" },
    { name: "Noe Garcia", zone: "El Chal" },
    { name: "Eber de Leon", zone: "Las Cruces" },
    { name: "Jose Elias Polanco", zone: "San Luis" },
    { name: "David de Jesus", zone: "San Luis" },
    { name: "Fernando Valdez", zone: "San Luis" },
    { name: "Mildred Salazar", zone: "La Libertad" },
    { name: "Edwin Hernandez", zone: "San Luis" },
    { name: "Eliberto Cortez", zone: "Sacpuy" }
  ];

  console.log('--- VERIFICACIÓN EXACTA DE CADA CLIENTE ---');
  for (const t of targets) {
    const invMatches = invoices.filter(i => {
      const cn = (i.clientName || '').toLowerCase();
      const nParts = t.name.toLowerCase().split(' ');
      return nParts.every(p => cn.includes(p));
    });

    const cliMatches = clients.filter(c => {
      const full = `${c.name || ''} ${c.companyName || ''} ${c.address || ''}`.toLowerCase();
      const nParts = t.name.toLowerCase().split(' ');
      return nParts.every(p => full.includes(p));
    });

    console.log(`\n• ${t.name} (${t.zone}):`);
    if (invMatches.length > 0) {
      console.log(`   Facturas (${invMatches.length}): ${invMatches.map(x => `Folio ${x.folio} (Q${Number(x.totalAmount).toFixed(0)} - ${x.seller_name})`).join(', ')}`);
    } else {
      console.log(`   Facturas: 0 encontradas`);
    }
    if (cliMatches.length > 0) {
      console.log(`   Catálogo: ${cliMatches.map(c => `${c.name} [${c.companyName}] (${c.address})`).join(' | ')}`);
    } else {
      console.log(`   Catálogo: No registrado`);
    }
  }

  await client.end();
}

main();
