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

  console.log(`Total products: ${res.rows.length}`);

  const prods = [];
  for (const r of res.rows) {
    let variants = r.variants;
    if (typeof variants === 'string') {
      try { variants = JSON.parse(variants); } catch (e) {}
    }
    let s = Number(r.stock || 0);
    let p = Number(r.price || 0);
    let cost = Number(r.cost_price || 0);

    let vStock = 0;
    let vValPrice = 0;
    let vValCost = 0;
    let hasVariants = variants && Array.isArray(variants) && variants.length > 0;

    if (hasVariants) {
      for (const v of variants) {
        const vst = Number(v.stock !== undefined ? v.stock : s);
        const vpr = Number(v.price || p);
        const vco = Number(v.cost_price || cost);
        vStock += vst;
        vValPrice += vst * vpr;
        vValCost += vst * vco;
      }
    } else {
      vStock = s;
      vValPrice = s * p;
      vValCost = s * cost;
    }

    prods.push({
      id: r.id,
      name: r.name,
      category: r.category,
      stock: vStock,
      price: p,
      cost_price: cost,
      valPrice: vValPrice,
      valCost: vValCost,
      is_external: r.is_external,
      hasVariants
    });
  }

  // 1. Any product where stock == 320?
  console.log("=== EXACT OR CLOSE STOCK ===");
  prods.forEach(p => {
    if (p.stock >= 310 && p.stock <= 330) {
      console.log(`Stock ~320: "${p.name}" [${p.category}] stock=${p.stock}, price=${p.price}, cost=${p.cost_price}, valPrice=${p.valPrice}, valCost=${p.valCost}`);
    }
  });

  // 2. Any product where valPrice == ~27,000 or valCost == ~27,000?
  console.log("\n=== VALUATION AROUND 27,000 (25k - 29k) ===");
  prods.forEach(p => {
    if ((p.valPrice >= 25000 && p.valPrice <= 29000) || (p.valCost >= 25000 && p.valCost <= 29000)) {
      console.log(`Val ~27k: "${p.name}" [${p.category}] stock=${p.stock}, price=${p.price}, cost=${p.cost_price}, valPrice=${p.valPrice}, valCost=${p.valCost}`);
    }
  });

  // 3. Category totals (Stock and ValPrice, ValCost)
  console.log("\n=== CATEGORY TOTALS ===");
  const cats = {};
  prods.forEach(p => {
    const c = p.category || 'SIN_CATEGORIA';
    if (!cats[c]) cats[c] = { count: 0, stock: 0, valPrice: 0, valCost: 0, negativeStockItems: [] };
    cats[c].count++;
    cats[c].stock += p.stock;
    cats[c].valPrice += p.valPrice;
    cats[c].valCost += p.valCost;
    if (p.stock < 0) {
      cats[c].negativeStockItems.push({ name: p.name, stock: p.stock });
    }
  });

  for (const [c, d] of Object.entries(cats)) {
    console.log(`${c.padEnd(25)}: count=${String(d.count).padStart(3)}, stock=${String(d.stock).padStart(6)}, valPrice=Q${d.valPrice.toFixed(2).padStart(10)}, valCost=Q${d.valCost.toFixed(2).padStart(10)} ${d.negativeStockItems.length ? 'NEGATIVES: ' + JSON.stringify(d.negativeStockItems) : ''}`);
  }

  // 4. Check negative stock items across all products
  console.log("\n=== ALL NEGATIVE OR ZERO STOCK ITEMS WITH WEIRD DATA ===");
  prods.filter(p => p.stock < 0).forEach(p => {
    console.log(`Negative: "${p.name}" [${p.category}] stock=${p.stock}, price=${p.price}, valPrice=${p.valPrice}`);
  });

  // 5. Look for combinations of 1, 2, or 3 products whose stock sums to exactly 320 and valPrice sums to ~27,000
  console.log("\n=== SUBSETS SUMMING TO STOCK ~320 AND VAL ~27,000 ===");
  for (let i = 0; i < prods.length; i++) {
    const p1 = prods[i];
    if (Math.abs(p1.stock - 320) <= 2 && Math.abs(p1.valPrice - 27000) <= 2000) {
      console.log(`MATCH 1 ITEM: ${p1.name} stock=${p1.stock} valPrice=${p1.valPrice}`);
    }
    if (Math.abs(p1.stock - 320) <= 2 && Math.abs(p1.valCost - 27000) <= 2000) {
      console.log(`MATCH 1 ITEM (by cost): ${p1.name} stock=${p1.stock} valCost=${p1.valCost}`);
    }

    for (let j = i + 1; j < prods.length; j++) {
      const p2 = prods[j];
      const sumStock = p1.stock + p2.stock;
      const sumValP = p1.valPrice + p2.valPrice;
      const sumValC = p1.valCost + p2.valCost;
      if (Math.abs(sumStock - 320) <= 2 && Math.abs(sumValP - 27000) <= 1500) {
        console.log(`MATCH 2 ITEMS (by price): "${p1.name}" (${p1.stock}, Q${p1.valPrice}) + "${p2.name}" (${p2.stock}, Q${p2.valPrice}) = stock ${sumStock}, val Q${sumValP}`);
      }
      if (Math.abs(sumStock - 320) <= 2 && Math.abs(sumValC - 27000) <= 1500) {
        console.log(`MATCH 2 ITEMS (by cost): "${p1.name}" (${p1.stock}, Q${p1.valCost}) + "${p2.name}" (${p2.stock}, Q${p2.valCost}) = stock ${sumStock}, val Q${sumValC}`);
      }
    }
  }

  // 6. Look for 3-item combinations
  for (let i = 0; i < prods.length; i++) {
    const p1 = prods[i];
    if (p1.stock <= 0 || p1.stock > 320) continue;
    for (let j = i + 1; j < prods.length; j++) {
      const p2 = prods[j];
      if (p2.stock <= 0 || p1.stock + p2.stock > 320) continue;
      for (let k = j + 1; k < prods.length; k++) {
        const p3 = prods[k];
        if (p3.stock <= 0) continue;
        const sumStock = p1.stock + p2.stock + p3.stock;
        const sumValP = p1.valPrice + p2.valPrice + p3.valPrice;
        if (Math.abs(sumStock - 320) === 0 && Math.abs(sumValP - 27000) <= 1000) {
          console.log(`MATCH 3 ITEMS (price): "${p1.name}" (${p1.stock}, Q${p1.valPrice}) + "${p2.name}" (${p2.stock}, Q${p2.valPrice}) + "${p3.name}" (${p3.stock}, Q${p3.valPrice}) = stock ${sumStock}, val Q${sumValP}`);
        }
      }
    }
  }

  await pool.end();
}

run();
