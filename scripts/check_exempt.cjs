const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db'
  });

  const res = await pool.query(`SELECT id, name, category, stock, price, cost_price, is_external, variants FROM products;`);
  
  function doesNotNeedStock(product) {
    if (!product) return false;
    const nameLower = (product.name || '').toLowerCase();
    const categoryLower = (product.category || '').toLowerCase();
    if (categoryLower.includes('incubadora') || nameLower.includes('incubadora') || categoryLower === 'incubadoras') {
      return true;
    }
    const keywords = ['bebedero', 'comedero', 'puya', 'arete', 'aretes'];
    return keywords.some(keyword => nameLower.includes(keyword) || categoryLower.includes(keyword));
  }

  function isTecunProduct(p) {
    return (p.category || '').toUpperCase() === 'TECUN';
  }

  function isFiatProduct(p) {
    return (p.category || '').toUpperCase() === 'FIAT';
  }

  let exemptStock = 0;
  let exemptValPrice = 0;
  let exemptValCost = 0;
  const exemptItems = [];

  let tecunFiatNegStock = 0;
  let tecunFiatNegItems = [];

  let allProds = [];

  for (const p of res.rows) {
    let variants = p.variants;
    if (typeof variants === 'string') {
      try { variants = JSON.parse(variants); } catch (e) {}
    }
    let s = Number(p.stock || 0);
    let pr = Number(p.price || 0);
    let cost = Number(p.cost_price || 0);

    let vStock = 0;
    let vValPrice = 0;
    let vValCost = 0;

    if (variants && Array.isArray(variants) && variants.length > 0) {
      for (const v of variants) {
        const vst = Number(v.stock !== undefined ? v.stock : s);
        const vpr = Number(v.price || pr);
        const vco = Number(v.cost_price || cost);
        vStock += vst;
        vValPrice += Math.max(0, vst) * vpr;
        vValCost += Math.max(0, vst) * vco;
      }
    } else {
      vStock = s;
      vValPrice = Math.max(0, s) * pr;
      vValCost = Math.max(0, s) * cost;
    }

    const item = {
      name: p.name,
      category: p.category,
      stock: vStock,
      price: pr,
      cost_price: cost,
      valPrice: vValPrice,
      valCost: vValCost,
      isExempt: doesNotNeedStock(p),
      isTecun: isTecunProduct(p),
      isFiat: isFiatProduct(p)
    };
    allProds.push(item);

    if (doesNotNeedStock(p)) {
      exemptStock += vStock;
      exemptValPrice += vValPrice;
      exemptValCost += vValCost;
      exemptItems.push(item);
    }
  }

  console.log("=== EXEMPT PRODUCTS (doesNotNeedStock) ===");
  console.log(`Total exempt stock: ${exemptStock}`);
  console.log(`Total exempt valPrice: Q${exemptValPrice.toFixed(2)}`);
  console.log(`Total exempt valCost: Q${exemptValCost.toFixed(2)}`);
  console.log("Exempt items count:", exemptItems.length);
  exemptItems.forEach(i => {
    console.log(`- "${i.name}" [${i.category}]: stock=${i.stock}, price=${i.price}, cost=${i.cost_price}, valPrice=Q${i.valPrice}`);
  });

  console.log("\n=== TECUN / FIAT / NEGATIVE ITEMS ===");
  allProds.filter(p => p.stock < 0).forEach(i => {
    console.log(`- "${i.name}" [${i.category}]: stock=${i.stock}, price=${i.price}, cost=${i.cost_price}`);
  });

  // Calculate Header Card 2 vs Valuation Table
  let card2Stock = 0;
  let valTableStock = 0;
  let valTablePriceVal = 0;
  let valTableCostVal = 0;

  for (const p of allProds) {
    if (!p.isExempt) {
      card2Stock += Math.max(0, p.stock);
    }
    valTableStock += p.stock;
    if (p.category !== 'INCUBADORAS' && p.stock > 0) {
      valTablePriceVal += p.valPrice;
      valTableCostVal += p.valCost;
    }
  }

  console.log("\n=== COMPARISON ===");
  console.log("Header Card 2 Stock (Excluding exempt & negatives):", card2Stock);
  console.log("Valuation Table Stock (Including all):", valTableStock);
  console.log("Difference in Stock:", valTableStock - card2Stock);
  console.log("Valuation Table Price Total:", valTablePriceVal);
  console.log("Valuation Table Cost Total:", valTableCostVal);

  await pool.end();
}

run();
