const pg = require('pg');

const NEW_CLIENTS_LIST = [
  // Página 1 (Final Enero / Primera lista)
  { id: "P1_01", page: 1, section: "Enero/Continuación", name: "Hugo Sutuj", place: "El Chal", patterns: ["hugo sutuj", "sutuj", "agro el corral"] },
  { id: "P1_02", page: 1, section: "Enero/Continuación", name: "Hary Campos", place: "El Chal", patterns: ["hary campos", "el rejo", "campos"] },
  { id: "P1_03", page: 1, section: "Enero/Continuación", name: "Ervin Hernandez", place: "Sacpuy", patterns: ["ervin", "erlin", "sacpuy"] },
  { id: "P1_04", page: 1, section: "Enero/Continuación", name: "Ermides Recinos", place: "El Naranjo La Libertad", patterns: ["ermides", "recinos", "naranjo"] },
  { id: "P1_05", page: 1, section: "Enero/Continuación", name: "Sherlina Marroquin", place: "Santa Ana", patterns: ["sherlina", "marroquin", "marroquín"] },
  { id: "P1_06", page: 1, section: "Enero/Continuación", name: "Eber de Leon", place: "Las Cruces Peten", patterns: ["eber de leon", "de leon", "de león", "cruces"] },
  { id: "P1_07", page: 1, section: "Enero/Continuación", name: "Jose Elias Polanco", place: "San Luis", patterns: ["polanco", "jose elias", "josé elías"] },

  // Página 1 (Febrero)
  { id: "P1_08", page: 1, section: "Febrero", name: "Cesar Noyola", place: "Aldea La Maquina", patterns: ["noyola", "cesar noyola", "maquina", "máquina"] },
  { id: "P1_09", page: 1, section: "Febrero", name: "Wilman Chonay", place: "Dolores", patterns: ["chonay", "wilman", "walman"] },
  { id: "P1_10", page: 1, section: "Febrero", name: "Brenda Duarte", place: "Cruce dos Aguadas San Andres", patterns: ["brenda duarte", "duarte", "tres hermanos", "3 hermanos"] },
  { id: "P1_11", page: 1, section: "Febrero", name: "Elder Guerra / Eider Guerra", place: "Ixlu", patterns: ["eider", "elder", "guerra"] },
  { id: "P1_12", page: 1, section: "Febrero", name: "Marlon Garrido", place: "El Caoba", patterns: ["marlon garrido", "mailon", "garrido", "el sembrador"] },
  { id: "P1_13", page: 1, section: "Febrero", name: "Eliberto Cortez", place: "Sacpuy San Andres", patterns: ["eliberto", "cortez", "cortés"] },
  { id: "P1_14", page: 1, section: "Febrero", name: "Jose Alejandro Ordoñez", place: "San Luis", patterns: ["ordoñez", "ordóñez", "jose alejandro"] },
  { id: "P1_15", page: 1, section: "Febrero", name: "Ervin Hernandez", place: "Sacpuy San Andres", patterns: ["ervin", "erlin", "sacpuy"] },
  { id: "P1_16", page: 1, section: "Febrero", name: "Wilder Lemus", place: "Poptun", patterns: ["wilder", "lemus", "poptun", "poptún"] },

  // Página 2 (Febrero continuación)
  { id: "P2_17", page: 2, section: "Febrero", name: "Sherlina Marroquin", place: "Santa Ana", patterns: ["sherlina", "marroquin", "marroquín"] },
  { id: "P2_18", page: 2, section: "Febrero", name: "Iris Reyes", place: "Santa Elena", patterns: ["iris reyes", "alexa"] },
  { id: "P2_19", page: 2, section: "Febrero", name: "Eber Tello", place: "San Francisco", patterns: ["tello", "san francisco", "hever"] },
  { id: "P2_20", page: 2, section: "Febrero", name: "David de Jesus", place: "San Luis Peten", patterns: ["david de jesus", "david de jesús"] },
  { id: "P2_21", page: 2, section: "Febrero", name: "Fernando Valdez", place: "San Luis", patterns: ["fernando valdez", "valdez"] },
  { id: "P2_22", page: 2, section: "Febrero", name: "Mildred Salazar", place: "La Libertad", patterns: ["mildred", "salazar", "libertad"] },
  { id: "P2_23", page: 2, section: "Febrero", name: "Eliel Betancourt", place: "La Cumbre Chacte Peten", patterns: ["eliel", "betancourt", "betancourth", "la cumbre"] },
  { id: "P2_24", page: 2, section: "Febrero", name: "Noe Garcia", place: "El Chal", patterns: ["noe garcia", "noe garcía", "garcia", "garcía"] },

  // Página 2 (Marzo)
  { id: "P2_25", page: 2, section: "Marzo", name: "Elio Arreaza", place: "Poptun", patterns: ["elio arreaza", "arreaza", "el potro"] },
  { id: "P2_26", page: 2, section: "Marzo", name: "Sara Ipiña", place: "Chacalte San Luis", patterns: ["sara ipiña", "ipiña", "chacalte"] },
  { id: "P2_27", page: 2, section: "Marzo", name: "Fernando Valdez", place: "San Luis", patterns: ["fernando valdez", "valdez"] },
  { id: "P2_28", page: 2, section: "Marzo", name: "Edwin Hernandez", place: "San Luis Peten", patterns: ["edwin hernandez", "edwin hernández"] },
  { id: "P2_29", page: 2, section: "Marzo", name: "Wilman Chonay", place: "Dolores", patterns: ["chonay", "wilman"] },
  { id: "P2_30", page: 2, section: "Marzo", name: "Luis Carranza", place: "Dolores", patterns: ["luis carranza", "carranza", "el ganadero"] },
  { id: "P2_31", page: 2, section: "Marzo", name: "Edwin Lopez", place: "Sabaneta Dolores", patterns: ["edwin lopez", "edwin lópez", "sabaneta", "el campesino"] },
  { id: "P2_32", page: 2, section: "Marzo", name: "Lidia Felipe", place: "Dolores Mopan", patterns: ["lidia felipe", "lidia", "felipe"] }
];

function norm(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

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

  const report = [];

  for (const item of NEW_CLIENTS_LIST) {
    const matchedInvoices = [];
    const matchedClients = [];

    // Search Invoices
    for (const inv of invoices) {
      const cName = norm(inv.clientName);
      let match = false;

      // Disambiguations
      if (item.name.includes("Hugo Sutuj") && (cName.includes("sutuj") || cName.includes("corral"))) match = true;
      else if (item.name.includes("Hary Campos") && (cName.includes("hary") || (cName.includes("campos") && cName.includes("rejo")))) match = true;
      else if (item.name.includes("Ervin Hernandez") && (cName.includes("ervin") || cName.includes("erlin") || cName.includes("sacpuy"))) match = true;
      else if (item.name.includes("Ermides Recinos") && (cName.includes("ermides") || (cName.includes("recinos") && cName.includes("naranjo")))) match = true;
      else if (item.name.includes("Sherlina Marroquin") && (cName.includes("sherlina") || cName.includes("marroquin"))) match = true;
      else if (item.name.includes("Eber de Leon") && (cName.includes("de leon") || cName.includes("de león")) && cName.includes("cruces")) match = true;
      else if (item.name.includes("Jose Elias Polanco") && (cName.includes("polanco") || (cName.includes("elias") && cName.includes("luis")))) match = true;
      else if (item.name.includes("Cesar Noyola") && cName.includes("noyola")) match = true;
      else if (item.name.includes("Wilman Chonay") && (cName.includes("chonay") || cName.includes("wilman"))) match = true;
      else if (item.name.includes("Brenda Duarte") && (cName.includes("duarte") || cName.includes("tres hermanos") || cName.includes("3 hermanos"))) match = true;
      else if (item.name.includes("Elder Guerra") && (cName.includes("eider") || cName.includes("elder")) && cName.includes("guerra")) match = true;
      else if (item.name.includes("Marlon Garrido") && (cName.includes("garrido") || cName.includes("mailon") || cName.includes("marlon"))) match = true;
      else if (item.name.includes("Eliberto Cortez") && (cName.includes("eliberto") || (cName.includes("cortez") && cName.includes("sacpuy")))) match = true;
      else if (item.name.includes("Jose Alejandro Ordoñez") && (cName.includes("ordoñez") || cName.includes("ordonez"))) match = true;
      else if (item.name.includes("Wilder Lemus") && (cName.includes("wilder") || (cName.includes("lemus") && cName.includes("poptun")))) match = true;
      else if (item.name.includes("Iris Reyes") && (cName.includes("iris") || cName.includes("alexa"))) match = true;
      else if (item.name.includes("Eber Tello") && (cName.includes("tello") || cName.includes("san francisco"))) match = true;
      else if (item.name.includes("David de Jesus") && cName.includes("david de jesus")) match = true;
      else if (item.name.includes("Fernando Valdez") && cName.includes("valdez")) match = true;
      else if (item.name.includes("Mildred Salazar") && (cName.includes("mildred") || cName.includes("salazar"))) match = true;
      else if (item.name.includes("Eliel Betancourt") && (cName.includes("eliel") || cName.includes("cumbre") || cName.includes("betancourt"))) match = true;
      else if (item.name.includes("Noe Garcia") && (cName.includes("noe garcia") || (cName.includes("noe") && cName.includes("chal")))) match = true;
      else if (item.name.includes("Elio Arreaza") && (cName.includes("arreaza") || cName.includes("potro"))) match = true;
      else if (item.name.includes("Sara Ipiña") && (cName.includes("sara") || cName.includes("ipina") || cName.includes("chacalte"))) match = true;
      else if (item.name.includes("Edwin Hernandez") && cName.includes("edwin") && cName.includes("hernandez") && cName.includes("luis")) match = true;
      else if (item.name.includes("Luis Carranza") && (cName.includes("carranza") || (cName.includes("luis") && cName.includes("ganadero")))) match = true;
      else if (item.name.includes("Edwin Lopez") && (cName.includes("edwin") && (cName.includes("lopez") || cName.includes("campesino")))) match = true;
      else if (item.name.includes("Lidia Felipe") && (cName.includes("lidia") || cName.includes("felipe"))) match = true;

      if (match) {
        matchedInvoices.push(inv);
      }
    }

    // Search Clients catalog
    for (const c of clients) {
      const full = norm(`${c.name} ${c.companyName} ${c.address}`);
      let match = false;

      if (item.name.includes("Hugo Sutuj") && (full.includes("sutuj") || full.includes("corral"))) match = true;
      else if (item.name.includes("Hary Campos") && (full.includes("hary") || (full.includes("campos") && full.includes("rejo")))) match = true;
      else if (item.name.includes("Ervin Hernandez") && (full.includes("ervin") || full.includes("erlin") || full.includes("sacpuy"))) match = true;
      else if (item.name.includes("Ermides Recinos") && (full.includes("ermides") || (full.includes("recinos") && full.includes("naranjo")))) match = true;
      else if (item.name.includes("Sherlina Marroquin") && (full.includes("sherlina") || full.includes("marroquin"))) match = true;
      else if (item.name.includes("Eber de Leon") && (full.includes("de leon") || full.includes("de león")) && full.includes("cruces")) match = true;
      else if (item.name.includes("Jose Elias Polanco") && (full.includes("polanco") || full.includes("elias"))) match = true;
      else if (item.name.includes("Cesar Noyola") && full.includes("noyola")) match = true;
      else if (item.name.includes("Wilman Chonay") && (full.includes("chonay") || full.includes("wilman"))) match = true;
      else if (item.name.includes("Brenda Duarte") && (full.includes("duarte") || full.includes("tres hermanos") || full.includes("3 hermanos"))) match = true;
      else if (item.name.includes("Elder Guerra") && (full.includes("eider") || full.includes("elder")) && full.includes("guerra")) match = true;
      else if (item.name.includes("Marlon Garrido") && (full.includes("garrido") || full.includes("mailon") || full.includes("marlon"))) match = true;
      else if (item.name.includes("Eliberto Cortez") && (full.includes("eliberto") || full.includes("cortez"))) match = true;
      else if (item.name.includes("Jose Alejandro Ordoñez") && (full.includes("ordoñez") || full.includes("ordonez"))) match = true;
      else if (item.name.includes("Wilder Lemus") && (full.includes("wilder") || (full.includes("lemus") && full.includes("poptun")))) match = true;
      else if (item.name.includes("Iris Reyes") && (full.includes("iris") || full.includes("alexa"))) match = true;
      else if (item.name.includes("Eber Tello") && (full.includes("tello") || full.includes("san francisco"))) match = true;
      else if (item.name.includes("David de Jesus") && full.includes("david de jesus")) match = true;
      else if (item.name.includes("Fernando Valdez") && full.includes("valdez")) match = true;
      else if (item.name.includes("Mildred Salazar") && (full.includes("mildred") || full.includes("salazar"))) match = true;
      else if (item.name.includes("Eliel Betancourt") && (full.includes("eliel") || full.includes("cumbre") || full.includes("betancourt"))) match = true;
      else if (item.name.includes("Noe Garcia") && (full.includes("noe garcia") || (full.includes("noe") && full.includes("chal")))) match = true;
      else if (item.name.includes("Elio Arreaza") && (full.includes("arreaza") || full.includes("potro"))) match = true;
      else if (item.name.includes("Sara Ipiña") && (full.includes("sara") || full.includes("ipina") || full.includes("chacalte"))) match = true;
      else if (item.name.includes("Edwin Hernandez") && full.includes("edwin") && full.includes("hernandez") && full.includes("luis")) match = true;
      else if (item.name.includes("Luis Carranza") && (full.includes("carranza") || full.includes("ganadero"))) match = true;
      else if (item.name.includes("Edwin Lopez") && (full.includes("edwin") && (full.includes("lopez") || full.includes("campesino")))) match = true;
      else if (item.name.includes("Lidia Felipe") && (full.includes("lidia") || full.includes("felipe"))) match = true;

      if (match) {
        matchedClients.push(c);
      }
    }

    const totalFacturado = matchedInvoices.reduce((a, b) => a + Number(b.totalAmount || 0), 0);
    const erickInvoices = matchedInvoices.filter(x => (x.seller_email || '').includes('jerick') || (x.seller_name || '').toLowerCase().includes('erick'));
    const erickTotal = erickInvoices.reduce((a, b) => a + Number(b.totalAmount || 0), 0);

    report.push({
      id: item.id,
      page: item.page,
      section: item.section,
      name: item.name,
      place: item.place,
      hasSales: matchedInvoices.length > 0,
      invoicesCount: matchedInvoices.length,
      totalFacturado: totalFacturado,
      erickInvoicesCount: erickInvoices.length,
      erickTotal: erickTotal,
      folios: matchedInvoices.map(x => `${x.folio} (Q${Number(x.totalAmount).toFixed(0)} - ${x.seller_name || x.sellerId})`).join(', ') || 'Sin compras',
      clientCatalog: matchedClients.map(c => `${c.name} [${c.companyName || 'S/N'}] (${c.address || 'S/D'})`).join(' | ') || 'No registrado',
      status: erickInvoices.length > 0 ? "ACTIVO CON VENTA" : (matchedClients.length > 0 ? "REGISTRADO SIN COMPRA" : "SIN REGISTRO NI VENTA")
    });
  }

  const fs = require('fs');
  fs.writeFileSync('scripts/new_clients_audit_results.json', JSON.stringify(report, null, 2), 'utf-8');
  console.log('Audit completed and saved to scripts/new_clients_audit_results.json');

  await client.end();
}

main().catch(console.error);
