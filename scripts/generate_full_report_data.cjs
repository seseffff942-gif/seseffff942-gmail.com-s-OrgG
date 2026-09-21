const pg = require('pg');
const fs = require('fs');

const NOTEBOOK_LIST = [
  { id: 1, name: "Hector Mendoza", location: "El Remate", notes: "No registra ventas ni clientes con este nombre en El Remate. En El Remate está registrada Deimy Marisol Mateo Carias (Agroveterinaria La Mascota)." },
  { id: 2, name: "Eider Guerra", location: "El Zapote / Ixlu", notes: "No registra compras en Ixlu a nombre de Eider Guerra. Los clientes con apellido Guerra son Christian Guerra / Brenda Duarte Guerra / Abner Guerra en otras zonas (Izabal / Cruce dos aguadas)." },
  { id: 3, name: "Mailon Garrido (Marlon)", location: "El Caoba", notes: "Registrado como Marlon Ninrod Garrido Fajardo (Agroveterinaria el Sembrador) en Aldea El Caoba, Flores, Petén." },
  { id: 4, name: "Cesar Lopez", location: "San Benito", notes: "Registrado como César López / Pop López Cesar Amilcar (Agroveterinaria El Amigo) en San Benito, Petén." },
  { id: 5, name: "Iris Reyes", location: "Santa Elena", notes: "Registrada como Iris Adela Reyes García Gonzales (Agroveterinaria Alexa) en Santa Elena, Petén." },
  { id: 6, name: "Wilman Chonay", location: "Dolores", notes: "Registrado como Wilman Chonay Samol (Agropecuaria Chonay) en Barrio El Centro, Dolores, Petén." },
  { id: 7, name: "Lidia Felipe Rashel", location: "Dolores (Calzada Mopan)", notes: "No registra ventas bajo Lidia Felipe ni Rashel en Dolores. En Calzada Mopan está registrado Edwin Joaquin López Hernández (Agrocomercializadora El Campesino)." },
  { id: 8, name: "Luis Espina", location: "Poptun", notes: "No registra compras ni cliente en catálogo. En Poptun el cliente registrado es Elio Misael Arreaza de la Rosa (Agro. El Potro)." },
  { id: 9, name: "Geovany Hernandez", location: "Santa Elena", notes: "Registrado como Geovany Hernández Mejía (Agrovtas. El Cordero) en Santa Elena, Petén." },
  { id: 10, name: "Erick Hernandez", location: "Ixlu", notes: "Registrado como Erick Hernández (Efinagro) en Ixlu, Flores, Petén." },
  { id: 11, name: "Fredy Vicente", location: "Santa Ana", notes: "Registrado como Fredy Vicente Vicente (Agroveterinaria Vicente) en Santa Ana, Petén." },
  { id: 12, name: "Eber Bello (Hever Tello)", location: "San Francisco", notes: "Registrado en base de datos como Hever Joel Tello Hernández (Agroveterinaria San Francisco) en San Francisco, Petén." },
  { id: 13, name: "Rony Vicente", location: "Santa Elena", notes: "Registrado como Rony Orlando Vicente Vicente (Agros. El Sembrador) en Santa Elena, Petén." },
  { id: 14, name: "Leonidas Giron", location: "Mopan Dolores", notes: "No registra compras ni cliente bajo Leonidas Girón. En Mopan Sabanetas está registrado Edwin Joaquin López Hernández." },
  { id: 15, name: "Eliel Betancourt", location: "Sayaxche Peten", notes: "Registrado como Walfren Eliel Betancourth Barrera (Agroveterinaria La Cumbre) y Erick Betancourt (Las Posas, Sayaxché)." },
  { id: 16, name: "Israel España (Angel España)", location: "El Chal", notes: "Registrado en El Chal como Angel España (Agro El Chal), a media cuadra de Banrural, El Chal, Petén." },
  { id: 17, name: "Walter Molina", location: "El Chal", notes: "No registra compras ni cliente con este nombre en El Chal. Clientes en El Chal incluyen Agro El Corral, Agrodespensa El Primo, Agro El Chal, Agroveterinaria El Rejo, Agroveterinaria El Agrónomo." }
];

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

  console.log(`Total invoices analyzed: ${invRes.rows.length}`);

  // Map each notebook client to their EXACT invoices
  const reportData = [];

  for (const item of NOTEBOOK_LIST) {
    let matched = [];

    if (item.id === 3) { // Marlon Garrido
      matched = invRes.rows.filter(i => (i.clientName || '').toLowerCase().includes('garrido'));
    } else if (item.id === 4) { // Cesar Lopez
      matched = invRes.rows.filter(i => (i.clientName || '').toLowerCase().includes('césar lópez') || (i.clientName || '').toLowerCase().includes('cesar lópez') || (i.clientName || '').toLowerCase().includes('pop lópez cesar'));
    } else if (item.id === 5) { // Iris Reyes
      matched = invRes.rows.filter(i => (i.clientName || '').toLowerCase().includes('iris reyes') || (i.clientName || '').toLowerCase().includes('alexa'));
    } else if (item.id === 6) { // Wilman Chonay
      matched = invRes.rows.filter(i => (i.clientName || '').toLowerCase().includes('chonay'));
    } else if (item.id === 9) { // Geovany Hernandez
      matched = invRes.rows.filter(i => (i.clientName || '').toLowerCase().includes('geovani hernández') || (i.clientName || '').toLowerCase().includes('geovany') && (i.clientName || '').toLowerCase().includes('cordero'));
    } else if (item.id === 10) { // Erick Hernandez
      matched = invRes.rows.filter(i => (i.clientName || '').toLowerCase().includes('erick hernández') && (i.clientName || '').toLowerCase().includes('efinagro'));
    } else if (item.id === 11) { // Fredy Vicente
      matched = invRes.rows.filter(i => (i.clientName || '').toLowerCase().includes('fredy') && (i.clientName || '').toLowerCase().includes('vicente'));
    } else if (item.id === 12) { // Hever Tello
      matched = invRes.rows.filter(i => (i.clientName || '').toLowerCase().includes('tello') || (i.clientName || '').toLowerCase().includes('agroveterinaria san francisco'));
    } else if (item.id === 13) { // Rony Vicente
      matched = invRes.rows.filter(i => (i.clientName || '').toLowerCase().includes('rony') && (i.clientName || '').toLowerCase().includes('vicente'));
    } else if (item.id === 15) { // Eliel Betancourt
      matched = invRes.rows.filter(i => (i.clientName || '').toLowerCase().includes('eliel betancourt') || (i.clientName || '').toLowerCase().includes('betancourth'));
    } else if (item.id === 16) { // Angel / Israel España
      matched = invRes.rows.filter(i => (i.clientName || '').toLowerCase().includes('angel españa') || (i.clientName || '').toLowerCase().includes('agro el chal'));
    }

    const totalFacturado = matched.reduce((acc, x) => acc + Number(x.totalAmount || 0), 0);
    const foliosList = matched.map(x => x.folio).join(', ');
    const sellersMap = {};
    matched.forEach(x => {
      const s = x.seller_name || x.sellerId;
      sellersMap[s] = (sellersMap[s] || 0) + Number(x.totalAmount || 0);
    });

    reportData.push({
      id: item.id,
      nombreCuaderno: item.name,
      lugarCuaderno: item.location,
      encontradoEnBD: matched.length > 0 ? "SÍ" : "NO",
      facturasCount: matched.length,
      totalFacturado: totalFacturado,
      folios: foliosList || "Sin compras",
      vendedores: Object.keys(sellersMap).length > 0 ? Object.entries(sellersMap).map(([s, val]) => `${s} (Q${val.toFixed(2)})`).join(', ') : "Ninguno",
      detalleFacturas: matched.map(m => ({
        folio: m.folio,
        fecha: m.date ? String(m.date).split('T')[0] : 'S/F',
        cliente: m.clientName,
        monto: Number(m.totalAmount || 0),
        vendedor: m.seller_name || m.sellerId
      })),
      observacion: item.notes
    });
  }

  fs.writeFileSync('scripts/detailed_reconciliation_report.json', JSON.stringify(reportData, null, 2), 'utf-8');
  console.log('Saved detailed report data to scripts/detailed_reconciliation_report.json');

  await client.end();
}

main().catch(console.error);
