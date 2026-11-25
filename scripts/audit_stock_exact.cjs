const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db'
  });

  const res = await pool.query(`
    SELECT id, name, category, stock, price, cost_price, is_external, variants 
    FROM products 
    ORDER BY category, name;
  `);

  function doesNotNeedStock(p) {
    if (!p) return false;
    const nameLower = (p.name || '').toLowerCase();
    const categoryLower = (p.category || '').toLowerCase();
    if (categoryLower.includes('incubadora') || nameLower.includes('incubadora') || categoryLower === 'incubadoras') {
      return true;
    }
    const keywords = ['bebedero', 'comedero', 'puya', 'arete', 'aretes'];
    return keywords.some(k => nameLower.includes(k) || categoryLower.includes(k));
  }

  let rawStockTotal = 0;
  let positiveStockTotal = 0;
  let card2StockTotal = 0; // ignores negative, ignores doesNotNeedStock
  let negativeItems = [];
  let exemptItems = [];

  for (const p of res.rows) {
    let variants = p.variants;
    if (typeof variants === 'string') {
      try { variants = JSON.parse(variants); } catch (e) {}
    }
    let s = Number(p.stock || 0);
    if (variants && Array.isArray(variants) && variants.length > 0) {
      s = variants.reduce((acc, v) => acc + Number(v.stock !== undefined ? v.stock : p.stock || 0), 0);
    }

    if (p.is_external) continue;

    rawStockTotal += s;
    positiveStockTotal += Math.max(0, s);

    if (s < 0) {
      negativeItems.push({ name: p.name, category: p.category, stock: s });
    }

    if (doesNotNeedStock(p)) {
      exemptItems.push({ name: p.name, category: p.category, stock: s });
    } else {
      card2StockTotal += Math.max(0, s);
    }
  }

  console.log("=== DESGLOSE EXACTO DEL SISTEMA ===");
  console.log(`1. Stock Crudo (Sumando todo, incluyendo negativos): ${rawStockTotal}`);
  console.log(`2. Stock Físico Real (Solo existencias >= 0): ${positiveStockTotal}`);
  console.log(`3. Stock Tarjeta Superior (Excluyendo negativos y exentos/incubadoras): ${card2StockTotal}`);
  
  console.log("\n--- PRODUCTOS CON STOCK NEGATIVO QUE RESTAN EN LA SUMA INFERIOR ---");
  let sumNegatives = 0;
  negativeItems.forEach(i => {
    console.log(`  * ${i.name} [${i.category}]: ${i.stock} unidades`);
    sumNegatives += i.stock;
  });
  console.log(`Total unidades negativas restando: ${sumNegatives}`);

  console.log("\n--- PRODUCTOS EXENTOS / INCUBADORAS QUE ARRIBA SE EXCLUYEN ---");
  exemptItems.forEach(i => {
    console.log(`  * ${i.name} [${i.category}]: ${i.stock} unidades`);
  });

  await pool.end();
}

run();
