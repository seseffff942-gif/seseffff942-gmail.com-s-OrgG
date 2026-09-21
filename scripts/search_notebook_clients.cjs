const pg = require('pg');

const NOTEBOOK_NAMES = [
  { id: 1, name: "Hector Mendoza", place: "El Remate", searchPatterns: ["hector mendoza", "mendoza", "hector"] },
  { id: 2, name: "Eider Guerra", place: "El Zapote / Ixlu", searchPatterns: ["eider guerra", "eider", "eyder"] },
  { id: 3, name: "Mailon Garrido", place: "El Caoba", searchPatterns: ["mailon garrido", "marlon garrido", "garrido", "mailon", "marlon"] },
  { id: 4, name: "Cesar Lopez", place: "San Benito", searchPatterns: ["cesar lopez", "cesar lópez", "cesar"] },
  { id: 5, name: "Iris Reyes", place: "Santa Elena", searchPatterns: ["iris reyes", "iris", "alexa"] },
  { id: 6, name: "Wilman Chonay", place: "Dolores", searchPatterns: ["wilman chonay", "walman chonay", "chonay"] },
  { id: 7, name: "Lidia Felipe Rashel", place: "Dolores calzada Mopan", searchPatterns: ["lidia felipe", "rashel", "rachel", "lidia", "felipe"] },
  { id: 8, name: "Luis Espina", place: "Poptun", searchPatterns: ["luis espina", "espina"] },
  { id: 9, name: "Geovany Hernandez", place: "Santa Elena", searchPatterns: ["geovany hernandez", "geovani hernández", "geovani", "geovany", "cordero"] },
  { id: 10, name: "Erick Hernandez", place: "Ixlu", searchPatterns: ["erick hernandez", "erick hernández"] },
  { id: 11, name: "Fredy Vicente", place: "Santa Ana", searchPatterns: ["fredy vicente", "fredy"] },
  { id: 12, name: "Eber Bello", place: "San Francisco", searchPatterns: ["eber bello", "bello", "eber"] },
  { id: 13, name: "Rony Vicente", place: "Santa Elena", searchPatterns: ["rony vicente", "rony"] },
  { id: 14, name: "Leonidas Giron", place: "Mopan Dolores", searchPatterns: ["leonidas giron", "leonidas girón", "leonidas"] },
  { id: 15, name: "Eliel Betancourt", place: "Sayaxche Peten", searchPatterns: ["eliel betancourt", "betancourt", "eliel", "cumbre"] },
  { id: 16, name: "Israel España", place: "El Chal", searchPatterns: ["israel españa", "angel españa", "españa", "espana", "agro el chal"] },
  { id: 17, name: "Walter Molina", place: "El Chal", searchPatterns: ["walter molina", "molina"] }
];

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

async function main() {
  const client = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
  await client.connect();

  const invRes = await client.query(`
    SELECT i.id, i.folio, i."clientName", i.date, i."totalAmount", i."sellerId", i.status,
           u.name as seller_name, u.email as seller_email
    FROM invoices i
    LEFT JOIN users u ON (u.email = i."sellerId" OR u.id = i."sellerId")
    WHERE i.is_archived IS NOT TRUE
    ORDER BY CAST(NULLIF(regexp_replace(i.folio, '\\D', '', 'g'), '') AS INTEGER) ASC, i.date ASC;
  `);

  const cliRes = await client.query(`
    SELECT c.id, c.name, c."companyName", c.phone, c.address, c."sellerId",
           u.name as seller_name
    FROM clients c
    LEFT JOIN users u ON (u.email = c."sellerId" OR u.id = c."sellerId");
  `);

  const output = [];

  for (const item of NOTEBOOK_NAMES) {
    const matchedInvoices = [];
    const matchedClients = [];

    const normPatterns = item.searchPatterns.map(normalize);

    // Filter invoices: Check full match of name, or primary pattern
    for (const inv of invRes.rows) {
      const cNameNorm = normalize(inv.clientName);
      // Strict or smart match
      let isMatch = false;
      for (const p of normPatterns) {
        if (p.includes(' ') && cNameNorm.includes(p)) {
          isMatch = true;
          break;
        } else if (!p.includes(' ') && normPatterns.length === 1 && cNameNorm.includes(p)) {
          isMatch = true;
          break;
        } else if (normPatterns[0].split(' ').every(w => cNameNorm.includes(w))) {
          isMatch = true;
          break;
        }
      }

      // Specific manual disambiguations
      if (item.name === "Hector Mendoza" && cNameNorm.includes("mendoza")) isMatch = true;
      if (item.name === "Eider Guerra" && (cNameNorm.includes("eider") || cNameNorm.includes("eyder") || cNameNorm.includes("guerra"))) isMatch = true;
      if (item.name === "Mailon Garrido" && (cNameNorm.includes("garrido") || cNameNorm.includes("mailon") || cNameNorm.includes("marlon"))) isMatch = true;
      if (item.name === "Cesar Lopez" && cNameNorm.includes("cesar") && cNameNorm.includes("lopez")) isMatch = true;
      if (item.name === "Iris Reyes" && (cNameNorm.includes("iris reyes") || cNameNorm.includes("alexa"))) isMatch = true;
      if (item.name === "Wilman Chonay" && (cNameNorm.includes("chonay") || cNameNorm.includes("wilman"))) isMatch = true;
      if (item.name === "Lidia Felipe Rashel" && (cNameNorm.includes("lidia") || cNameNorm.includes("rashel") || cNameNorm.includes("rachel") || cNameNorm.includes("felipe"))) isMatch = true;
      if (item.name === "Luis Espina" && (cNameNorm.includes("espina") || (cNameNorm.includes("luis") && cNameNorm.includes("espina")))) isMatch = true;
      if (item.name === "Geovany Hernandez" && (cNameNorm.includes("geovan") || cNameNorm.includes("cordero"))) isMatch = true;
      if (item.name === "Erick Hernandez" && cNameNorm.includes("erick") && cNameNorm.includes("hernandez")) isMatch = true;
      if (item.name === "Fredy Vicente" && cNameNorm.includes("fredy vicente")) isMatch = true;
      if (item.name === "Eber Bello" && (cNameNorm.includes("bello") || cNameNorm.includes("eber"))) isMatch = true;
      if (item.name === "Rony Vicente" && cNameNorm.includes("rony") && cNameNorm.includes("vicente")) isMatch = true;
      if (item.name === "Leonidas Giron" && (cNameNorm.includes("leonidas") || (cNameNorm.includes("giron") && !cNameNorm.includes("oscar")))) isMatch = true;
      if (item.name === "Eliel Betancourt" && (cNameNorm.includes("eliel") || cNameNorm.includes("cumbre") || cNameNorm.includes("betancourt"))) isMatch = true;
      if (item.name === "Israel España" && (cNameNorm.includes("españa") || cNameNorm.includes("espana") || cNameNorm.includes("chal"))) isMatch = true;
      if (item.name === "Walter Molina" && cNameNorm.includes("molina")) isMatch = true;

      if (isMatch) {
        matchedInvoices.push(inv);
      }
    }

    // Filter catalog clients
    for (const c of cliRes.rows) {
      const fullText = normalize(`${c.name || ''} ${c.companyName || ''} ${c.address || ''}`);
      let isMatch = false;

      if (item.name === "Hector Mendoza" && fullText.includes("mendoza")) isMatch = true;
      if (item.name === "Eider Guerra" && (fullText.includes("eider") || fullText.includes("eyder") || fullText.includes("guerra"))) isMatch = true;
      if (item.name === "Mailon Garrido" && (fullText.includes("garrido") || fullText.includes("mailon") || fullText.includes("marlon"))) isMatch = true;
      if (item.name === "Cesar Lopez" && fullText.includes("cesar") && fullText.includes("lopez")) isMatch = true;
      if (item.name === "Iris Reyes" && (fullText.includes("iris") || fullText.includes("alexa"))) isMatch = true;
      if (item.name === "Wilman Chonay" && (fullText.includes("chonay") || fullText.includes("wilman"))) isMatch = true;
      if (item.name === "Lidia Felipe Rashel" && (fullText.includes("lidia") || fullText.includes("rashel") || fullText.includes("rachel") || fullText.includes("felipe"))) isMatch = true;
      if (item.name === "Luis Espina" && (fullText.includes("espina") || (fullText.includes("luis") && fullText.includes("espina")))) isMatch = true;
      if (item.name === "Geovany Hernandez" && (fullText.includes("geovan") || fullText.includes("cordero"))) isMatch = true;
      if (item.name === "Erick Hernandez" && fullText.includes("erick") && fullText.includes("hernandez")) isMatch = true;
      if (item.name === "Fredy Vicente" && fullText.includes("fredy") && fullText.includes("vicente")) isMatch = true;
      if (item.name === "Eber Bello" && (fullText.includes("bello") || fullText.includes("eber"))) isMatch = true;
      if (item.name === "Rony Vicente" && fullText.includes("rony") && fullText.includes("vicente")) isMatch = true;
      if (item.name === "Leonidas Giron" && (fullText.includes("leonidas") || fullText.includes("giron"))) isMatch = true;
      if (item.name === "Eliel Betancourt" && (fullText.includes("eliel") || fullText.includes("betancourt") || fullText.includes("cumbre"))) isMatch = true;
      if (item.name === "Israel España" && (fullText.includes("españa") || fullText.includes("espana") || fullText.includes("chal"))) isMatch = true;
      if (item.name === "Walter Molina" && fullText.includes("molina")) isMatch = true;

      if (isMatch) {
        matchedClients.push(c);
      }
    }

    output.push({
      item,
      invoices: matchedInvoices,
      clients: matchedClients
    });
  }

  const fs = require('fs');
  fs.writeFileSync('scripts/notebook_search_results.json', JSON.stringify(output, null, 2), 'utf-8');
  console.log('Saved search results directly to scripts/notebook_search_results.json');
  await client.end();
}

main().catch(console.error);
