const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db'
  });

  const res = await pool.query("SELECT id, name, category, stock, is_external, variants FROM products;");
  
  const cats = {};
  let totalFisicoPositivo = 0;
  let totalNegativos = 0;
  let totalAretesIncubadoras = 0;
  let externalCount = 0;
  let totalCatalogProducts = res.rows.length;

  for (const p of res.rows) {
    let variants = p.variants;
    if (typeof variants === "string") {
      try { variants = JSON.parse(variants); } catch (e) {}
    }
    let s = Number(p.stock || 0);
    if (variants && Array.isArray(variants) && variants.length > 0) {
      s = variants.reduce((acc, v) => acc + Number(v.stock !== undefined ? v.stock : p.stock || 0), 0);
    }
    if (p.is_external) {
      externalCount++;
      continue;
    }

    const c = p.category || "Sin Categoría";
    if (!cats[c]) cats[c] = { positivos: 0, negativos: 0, items: 0 };
    cats[c].items++;

    if (s > 0) {
      cats[c].positivos += s;
      if (c === "INCUBADORAS") {
        totalAretesIncubadoras += s;
      } else {
        totalFisicoPositivo += s;
      }
    } else if (s < 0) {
      cats[c].negativos += s;
      totalNegativos += s;
    }
  }

  console.log("TOTAL_CATALOG_PRODUCTS:", totalCatalogProducts);
  console.log("TOTAL_BODEGA_FISICO_SIN_INCUBADORAS:", totalFisicoPositivo);
  console.log("ARETES_INCUBADORAS:", totalAretesIncubadoras);
  console.log("TOTAL_FISICO_ABSOLUTO:", totalFisicoPositivo + totalAretesIncubadoras);
  console.log("TOTAL_NEGATIVOS_PENDIENTES_INGRESO:", totalNegativos);
  console.log("TOTAL_NETO_RESTANDO_NEGATIVOS:", totalFisicoPositivo + totalAretesIncubadoras + totalNegativos);
  console.log("\n--- DESGLOSE POR MARCA / CATEGORÍA ---");
  for (const [c, d] of Object.entries(cats)) {
    console.log(`${c.padEnd(25)} | Positivos: ${String(d.positivos).padStart(6)} uds | Negativos: ${String(d.negativos).padStart(5)} uds | Productos: ${d.items}`);
  }

  await pool.end();
}

run();
