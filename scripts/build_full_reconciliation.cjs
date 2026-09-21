const pg = require('pg');
const fs = require('fs');

const MASTER_CLIENTS = [
  // --- De la primera foto (Enero) ---
  { id: 1, nombre: "Hector Mendoza", lugar: "El Remate", periodo: "Enero", search: ["hector mendoza", "mendoza"] },
  { id: 2, nombre: "Eider Guerra (Elder)", lugar: "El Zapote / Ixlu", periodo: "Enero / Feb", search: ["eider", "elder", "guerra"] },
  { id: 3, nombre: "Marlon Garrido (Mailon)", lugar: "El Caoba", periodo: "Enero / Feb", search: ["garrido", "mailon", "marlon"] },
  { id: 4, nombre: "Cesar Lopez", lugar: "San Benito", periodo: "Enero", search: ["cesar lopez", "cesar lópez", "pop lópez cesar"] },
  { id: 5, nombre: "Iris Reyes", lugar: "Santa Elena", periodo: "Enero / Feb", search: ["iris reyes", "alexa"] },
  { id: 6, nombre: "Wilman Chonay", lugar: "Dolores", periodo: "Enero / Feb / Mar", search: ["chonay", "wilman"] },
  { id: 7, nombre: "Lidia Felipe Rashel", lugar: "Dolores (Calzada Mopán)", periodo: "Enero / Mar", search: ["lidia felipe", "rashel", "rachel", "felipe tuch", "felipe contreras"] },
  { id: 8, nombre: "Luis Espina", lugar: "Poptun", periodo: "Enero", search: ["luis espina", "espina"] },
  { id: 9, nombre: "Geovany Hernandez", lugar: "Santa Elena", periodo: "Enero", search: ["geovany", "geovani", "cordero"] },
  { id: 10, nombre: "Erick Hernandez", lugar: "Ixlu", periodo: "Enero", search: ["efinagro", "erick hernandez", "erick hernández"] },
  { id: 11, nombre: "Fredy Vicente", lugar: "Santa Ana", periodo: "Enero", search: ["fredy vicente", "agroveterinaria vicente"] },
  { id: 12, nombre: "Hever Tello (Eber Bello)", lugar: "San Francisco", periodo: "Enero / Feb", search: ["tello", "san francisco", "hever"] },
  { id: 13, nombre: "Rony Vicente", lugar: "Santa Elena", periodo: "Enero", search: ["rony vicente", "el sembrador"] },
  { id: 14, nombre: "Leonidas Giron", lugar: "Mopan Dolores", periodo: "Enero", search: ["leonidas", "giron", "girón"] },
  { id: 15, nombre: "Eliel Betancourt", lugar: "Sayaxche / Chacte", periodo: "Enero / Feb", search: ["eliel", "betancourt", "betancourth", "la cumbre"] },
  { id: 16, nombre: "Israel España (Angel España)", lugar: "El Chal", periodo: "Enero", search: ["angel españa", "agro el chal", "israel españa"] },
  { id: 17, nombre: "Walter Molina", lugar: "El Chal", periodo: "Enero", search: ["walter molina", "molina"] },

  // --- Nuevos de Página 1 y 2 ---
  { id: 18, nombre: "Hugo Sutuj", lugar: "El Chal", periodo: "Enero", search: ["hugo sutuj", "sutuj", "corral"] },
  { id: 19, nombre: "Hary Campos", lugar: "El Chal", periodo: "Enero", search: ["hary campos", "rejo", "campos"] },
  { id: 20, nombre: "Ervin Hernandez", lugar: "Sacpuy San Andres", periodo: "Enero / Feb", search: ["ervin", "erlin", "sacpuy"] },
  { id: 21, nombre: "Ermides Recinos", lugar: "El Naranjo La Libertad", periodo: "Enero", search: ["ermides", "recinos", "naranjo"] },
  { id: 22, nombre: "Sherlina Marroquin", lugar: "Santa Ana", periodo: "Enero / Feb", search: ["sherlina", "marroquin", "marroquín"] },
  { id: 23, nombre: "Eber de Leon", lugar: "Las Cruces Peten", periodo: "Enero", search: ["eber de leon", "de leon", "de león", "cruces"] },
  { id: 24, nombre: "Jose Elias Polanco", lugar: "San Luis", periodo: "Enero", search: ["polanco", "jose elias", "josé elías"] },
  { id: 25, nombre: "Cesar Noyola", lugar: "Aldea La Maquina", periodo: "Febrero", search: ["cesar noyola", "noyola", "maquina"] },
  { id: 26, nombre: "Brenda Duarte", lugar: "Cruce dos Aguadas San Andres", periodo: "Febrero", search: ["brenda duarte", "duarte", "tres hermanos", "3 hermanos"] },
  { id: 27, nombre: "Eliberto Cortez", lugar: "Sacpuy San Andres", periodo: "Febrero", search: ["eliberto", "cortez", "cortés"] },
  { id: 28, nombre: "Jose Alejandro Ordoñez", lugar: "San Luis", periodo: "Febrero", search: ["ordoñez", "ordóñez", "jose alejandro"] },
  { id: 29, nombre: "Wilder Lemus", lugar: "Poptun", periodo: "Febrero", search: ["wilder", "lemus"] },
  { id: 30, nombre: "David de Jesus", lugar: "San Luis Peten", periodo: "Febrero", search: ["david de jesus", "david de jesús"] },
  { id: 31, nombre: "Fernando Valdez", lugar: "San Luis", periodo: "Febrero / Mar", search: ["fernando valdez", "valdez"] },
  { id: 32, nombre: "Mildred Salazar", lugar: "La Libertad", periodo: "Febrero", search: ["mildred", "salazar"] },
  { id: 33, nombre: "Noe Garcia", lugar: "El Chal", periodo: "Febrero", search: ["noe garcia", "noe garcía", "garcia lopez"] },
  { id: 34, nombre: "Elio Arreaza", lugar: "Poptun", periodo: "Marzo", search: ["elio arreaza", "arreaza", "potro"] },
  { id: 35, nombre: "Sara Ipiña", lugar: "Chacalte San Luis", periodo: "Marzo", search: ["sara ipiña", "ipiña", "chacalte"] },
  { id: 36, nombre: "Edwin Hernandez", lugar: "San Luis Peten", periodo: "Marzo", search: ["edwin hernandez", "edwin hernández"] },
  { id: 37, nombre: "Luis Carranza", lugar: "Dolores", periodo: "Marzo", search: ["luis carranza", "carranza", "el ganadero"] },
  { id: 38, nombre: "Edwin Lopez", lugar: "Sabaneta Dolores", periodo: "Marzo", search: ["edwin lopez", "edwin lópez", "sabaneta", "el campesino"] }
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

  const report = [];

  for (const item of MASTER_CLIENTS) {
    const matched = [];

    for (const inv of invoices) {
      const cNorm = norm(inv.clientName);
      let match = false;

      for (const p of item.search) {
        if (cNorm.includes(norm(p))) {
          match = true;
          break;
        }
      }

      if (match) {
        if (item.id === 1 && !cNorm.includes("mendoza")) match = false;
        else if (item.id === 2 && !cNorm.includes("eider") && !cNorm.includes("elder")) match = false;
        else if (item.id === 8 && !cNorm.includes("espina")) match = false;
        else if (item.id === 14 && !cNorm.includes("leonidas")) match = false;
        else if (item.id === 17 && !cNorm.includes("walter") && !cNorm.includes("molina")) match = false;
        else if (item.id === 23 && !cNorm.includes("cruces")) match = false;
        else if (item.id === 24 && !cNorm.includes("polanco")) match = false;
        else if (item.id === 27 && !cNorm.includes("cortez") && !cNorm.includes("cortes")) match = false;
        else if (item.id === 30 && !cNorm.includes("david de jesus")) match = false;
        else if (item.id === 31 && !cNorm.includes("valdez")) match = false;
        else if (item.id === 32 && !cNorm.includes("mildred") && !cNorm.includes("salazar")) match = false;
        else if (item.id === 36 && (!cNorm.includes("edwin") || !cNorm.includes("hernandez"))) match = false;
      }

      if (match) {
        const isErick = (inv.seller_email || '').includes('jerick') || (inv.seller_name || '').toLowerCase().includes('erick');
        matched.push({
          folio: inv.folio,
          fecha: inv.date ? String(inv.date).split('T')[0] : 'S/F',
          cliente: inv.clientName,
          monto: Number(inv.totalAmount || 0),
          vendedor: inv.seller_name || inv.sellerId,
          isErick: isErick
        });
      }
    }

    const erickInvs = matched.filter(x => x.isErick);
    const erickTotal = erickInvs.reduce((a, b) => a + b.monto, 0);
    const totalMonto = matched.reduce((a, b) => a + b.monto, 0);
    const estado = erickInvs.length > 0 ? "ACTIVO CON VENTA" : "PENDIENTE DE VISITA";

    report.push({
      id: item.id,
      nombre: item.nombre,
      lugar: item.lugar,
      periodo: item.periodo,
      estado: estado,
      facturasErick: erickInvs.length,
      totalErick: erickTotal,
      facturasTotal: matched.length,
      totalGeneral: totalMonto,
      folios: erickInvs.map(x => x.folio).join(', ') || "Sin compras",
      vendedor: erickInvs.length > 0 ? "Erick Juárez" : (matched.length > 0 ? "Emanuel Lima / Otros" : "Por coordinar"),
      detalle: matched
    });
  }

  fs.writeFileSync('scripts/full_master_audit_data.json', JSON.stringify(report, null, 2), 'utf-8');
  console.log('✅ full_master_audit_data.json generado con éxito.');

  const activos = report.filter(x => x.estado === 'ACTIVO CON VENTA');
  const pendientes = report.filter(x => x.estado === 'PENDIENTE DE VISITA');
  const totalFacturadoErick = activos.reduce((a, b) => a + b.totalErick, 0);

  console.log(`\n--- RESUMEN CONSOLIDADO (38 CLIENTES ÚNICOS) ---`);
  console.log(`Total Clientes Únicos: ${report.length}`);
  console.log(`Activos con Venta de Erick: ${activos.length} (${((activos.length / report.length) * 100).toFixed(1)}%)`);
  console.log(`Pendientes de Visita / Sin Venta: ${pendientes.length} (${((pendientes.length / report.length) * 100).toFixed(1)}%)`);
  console.log(`Total Facturado por Erick: Q${totalFacturadoErick.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`);

  await client.end();
}

main().catch(console.error);
