const pg = require('pg');

async function main() {
  const client = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
  await client.connect();

  console.log('--- BUSCANDO HISTORIAL COMPLETO DE HERBERT Y ERICK PARA ESTOS 17 CLIENTES ---');

  // Let's get all invoices in the DB, including any archived ones if any
  const allInvoices = await client.query(`
    SELECT i.id, i.folio, i."clientName", i.date, i."totalAmount", i."sellerId", i.status, i.is_archived,
           u.name as seller_name, u.email as seller_email
    FROM invoices i
    LEFT JOIN users u ON (u.email = i."sellerId" OR u.id = i."sellerId")
    ORDER BY i.date ASC;
  `);

  console.log(`Total invoices in DB: ${allInvoices.rows.length}`);

  // Let's check Herbert Argueta total invoices and clients
  const herbertInvoices = allInvoices.rows.filter(i => 
    (i.seller_email || '').includes('gruas') || (i.seller_name || '').toLowerCase().includes('herbert')
  );
  console.log(`Total facturas de Herbert Argueta: ${herbertInvoices.length}`);

  const erickInvoices = allInvoices.rows.filter(i => 
    (i.seller_email || '').includes('jerick') || (i.seller_name || '').toLowerCase().includes('erick')
  );
  console.log(`Total facturas de Erick Juárez: ${erickInvoices.length}`);

  // Now let's check for each of the 17 clients in the notebook:
  // Did Herbert ever sell to them? Did Erick ever sell to them?
  const NOTEBOOK = [
    { id: 1, name: "Hector Mendoza", place: "El Remate", search: ["hector", "mendoza"] },
    { id: 2, name: "Eider Guerra", place: "El Zapote / Ixlu", search: ["eider", "eyder", "guerra"] },
    { id: 3, name: "Mailon Garrido", place: "El Caoba", search: ["garrido", "mailon", "marlon"] },
    { id: 4, name: "Cesar Lopez", place: "San Benito", search: ["cesar lopez", "cesar lópez", "pop lópez cesar"] },
    { id: 5, name: "Iris Reyes", place: "Santa Elena", search: ["iris reyes", "alexa"] },
    { id: 6, name: "Wilman Chonay", place: "Dolores", search: ["chonay", "wilman"] },
    { id: 7, name: "Lidia Felipe Rashel", place: "Dolores Mopan", search: ["lidia", "felipe", "rashel", "rachel"] },
    { id: 8, name: "Luis Espina", place: "Poptun", search: ["espina", "luis espina"] },
    { id: 9, name: "Geovany Hernandez", place: "Santa Elena", search: ["geovany", "geovani", "cordero"] },
    { id: 10, name: "Erick Hernandez", place: "Ixlu", search: ["efinagro", "erick hernandez", "erick hernández"] },
    { id: 11, name: "Fredy Vicente", place: "Santa Ana", search: ["fredy vicente", "agroveterinaria vicente"] },
    { id: 12, name: "Eber Bello", place: "San Francisco", search: ["tello", "san francisco"] },
    { id: 13, name: "Rony Vicente", place: "Santa Elena", search: ["rony vicente", "el sembrador"] },
    { id: 14, name: "Leonidas Giron", place: "Mopan Dolores", search: ["leonidas", "giron", "girón"] },
    { id: 15, name: "Eliel Betancourt", place: "Sayaxche Peten", search: ["eliel", "betancourt", "betancourth", "la cumbre"] },
    { id: 16, name: "Israel España", place: "El Chal", search: ["angel españa", "agro el chal", "israel españa"] },
    { id: 17, name: "Walter Molina", place: "El Chal", search: ["walter molina", "molina"] }
  ];

  const audit = [];

  for (const item of NOTEBOOK) {
    const herbertSales = [];
    const erickSales = [];
    const emanuelSales = [];

    for (const inv of allInvoices.rows) {
      const cName = (inv.clientName || '').toLowerCase();
      let match = false;
      for (const s of item.search) {
        if (cName.includes(s.toLowerCase())) {
          match = true;
          break;
        }
      }

      if (match) {
        // Disambiguate some common names
        if (item.id === 1 && !cName.includes('mendoza')) continue;
        if (item.id === 2 && !cName.includes('eider') && !cName.includes('eyder')) continue;
        if (item.id === 7 && !cName.includes('rashel') && !cName.includes('rachel') && !cName.includes('lidia felipe')) continue;
        if (item.id === 14 && !cName.includes('leonidas')) continue;
        if (item.id === 17 && !cName.includes('walter') && !cName.includes('molina')) continue;

        const seller = (inv.seller_email || '').toLowerCase();
        if (seller.includes('gruas') || (inv.seller_name || '').toLowerCase().includes('herbert')) {
          herbertSales.push(inv);
        } else if (seller.includes('jerick') || (inv.seller_name || '').toLowerCase().includes('erick')) {
          erickSales.push(inv);
        } else {
          emanuelSales.push(inv);
        }
      }
    }

    audit.push({
      id: item.id,
      name: item.name,
      place: item.place,
      erickCount: erickSales.length,
      erickTotal: erickSales.reduce((a, b) => a + Number(b.totalAmount || 0), 0),
      erickFolios: erickSales.map(x => `${x.folio} (${String(x.date).split('T')[0]})`),
      herbertCount: herbertSales.length,
      herbertTotal: herbertSales.reduce((a, b) => a + Number(b.totalAmount || 0), 0),
      herbertFolios: herbertSales.map(x => `${x.folio} (${String(x.date).split('T')[0]})`),
      emanuelCount: emanuelSales.length,
      emanuelTotal: emanuelSales.reduce((a, b) => a + Number(b.totalAmount || 0), 0),
      emanuelFolios: emanuelSales.map(x => `${x.folio} (${String(x.date).split('T')[0]})`),
      status: erickSales.length > 0 ? "ATENDIDO POR ERICK" : (herbertSales.length > 0 ? "SOLO HERBERT VENDIÓ (ERICK LO DEJÓ TIRADO)" : "NUNCA VENDIERON / DEJADO TIRADO")
    });
  }

  console.log('\n================ RESULTADOS DE AUDITORÍA DE TRASPASO ================');
  audit.forEach(a => {
    console.log(`\n#${a.id} ${a.name} (${a.place}) -> ${a.status}`);
    console.log(`   Erick: ${a.erickCount} facturas (Q${a.erickTotal.toFixed(2)}) -> ${a.erickFolios.join(', ') || 'Ninguna'}`);
    console.log(`   Herbert: ${a.herbertCount} facturas (Q${a.herbertTotal.toFixed(2)}) -> ${a.herbertFolios.join(', ') || 'Ninguna'}`);
    if (a.emanuelCount > 0) {
      console.log(`   Emanuel/Otros: ${a.emanuelCount} facturas (Q${a.emanuelTotal.toFixed(2)}) -> ${a.emanuelFolios.join(', ')}`);
    }
  });

  await client.end();
}

main().catch(console.error);
