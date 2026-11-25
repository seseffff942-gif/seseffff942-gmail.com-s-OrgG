const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db'
  });

  const res = await pool.query(`SELECT id, name, category, stock, price, cost_price, variants FROM products;`);
  
  const items = [];
  for (const r of res.rows) {
    let s = Number(r.stock || 0);
    let p = Number(r.price || 0);
    let c = Number(r.cost_price || 0);
    let variants = r.variants;
    if (typeof variants === 'string') {
      try { variants = JSON.parse(variants); } catch (e) {}
    }
    if (variants && Array.isArray(variants) && variants.length > 0) {
      s = 0;
      let vp = 0;
      let vc = 0;
      for (const v of variants) {
        const vst = Number(v.stock !== undefined ? v.stock : r.stock || 0);
        s += vst;
        vp += vst * Number(v.price || p);
        vc += vst * Number(v.cost_price || c);
      }
      p = s > 0 ? vp / s : p;
      c = s > 0 ? vc / s : c;
    }
    if (s > 0) {
      items.push({
        id: r.id,
        name: r.name,
        category: r.category,
        stock: s,
        price: p,
        cost: c,
        valPrice: s * p,
        valCost: s * c
      });
    }
  }

  console.log(`Analyzing ${items.length} positive-stock items...`);

  // Check by Category
  const catMap = {};
  for (const it of items) {
    if (!catMap[it.category]) catMap[it.category] = { stock: 0, valPrice: 0, valCost: 0, items: [] };
    catMap[it.category].stock += it.stock;
    catMap[it.category].valPrice += it.valPrice;
    catMap[it.category].valCost += it.valCost;
    catMap[it.category].items.push(it);
  }

  console.log("\n=== CATEGORIES CLOSE TO 320 STOCK OR 27K VALUE ===");
  for (const [cat, data] of Object.entries(catMap)) {
    console.log(`Cat: ${cat} -> Stock: ${data.stock}, ValPrice: Q${data.valPrice.toFixed(2)}, ValCost: Q${data.valCost.toFixed(2)} (${data.items.length} items)`);
  }

  // Look for combinations of categories
  const catNames = Object.keys(catMap);
  for (let i = 0; i < catNames.length; i++) {
    for (let j = i + 1; j < catNames.length; j++) {
      const s = catMap[catNames[i]].stock + catMap[catNames[j]].stock;
      const vp = catMap[catNames[i]].valPrice + catMap[catNames[j]].valPrice;
      const vc = catMap[catNames[i]].valCost + catMap[catNames[j]].valCost;
      if (Math.abs(s - 320) <= 25 && (Math.abs(vp - 27000) <= 3000 || Math.abs(vc - 27000) <= 3000)) {
        console.log(`MATCH 2 CATS: ${catNames[i]} + ${catNames[j]} -> stock=${s}, valPrice=Q${vp.toFixed(2)}, valCost=Q${vc.toFixed(2)}`);
      }
    }
  }

  // Find exact combinations of 2 to 4 items with stock near 320 and value near 27000
  console.log("\n=== ITEM COMBINATIONS (Stock 315-325, Val 26k-28k) ===");
  
  // 1 item
  for (const it of items) {
    if (Math.abs(it.stock - 320) <= 10 && (Math.abs(it.valPrice - 27000) <= 2000 || Math.abs(it.valCost - 27000) <= 2000)) {
      console.log(`1 ITEM: ${it.name} [${it.category}] stock=${it.stock}, valPrice=${it.valPrice}, valCost=${it.valCost}`);
    }
  }

  // 2 items
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const s = items[i].stock + items[j].stock;
      const vp = items[i].valPrice + items[j].valPrice;
      const vc = items[i].valCost + items[j].valCost;
      if (Math.abs(s - 320) <= 10 && (Math.abs(vp - 27000) <= 1500 || Math.abs(vc - 27000) <= 1500)) {
        console.log(`2 ITEMS: "${items[i].name}" (${items[i].stock}, Q${items[i].valPrice}/Q${items[i].valCost}) + "${items[j].name}" (${items[j].stock}, Q${items[j].valPrice}/Q${items[j].valCost}) -> stock=${s}, valPrice=Q${vp.toFixed(2)}, valCost=Q${vc.toFixed(2)}`);
      }
    }
  }

  // 3 items
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].stock + items[j].stock > 330) continue;
      for (let k = j + 1; k < items.length; k++) {
        const s = items[i].stock + items[j].stock + items[k].stock;
        const vp = items[i].valPrice + items[j].valPrice + items[k].valPrice;
        const vc = items[i].valCost + items[j].valCost + items[k].valCost;
        if (Math.abs(s - 320) <= 5 && (Math.abs(vp - 27000) <= 1000 || Math.abs(vc - 27000) <= 1000)) {
          console.log(`3 ITEMS: "${items[i].name}" (${items[i].stock}) + "${items[j].name}" (${items[j].stock}) + "${items[k].name}" (${items[k].stock}) -> stock=${s}, valPrice=Q${vp.toFixed(2)}, valCost=Q${vc.toFixed(2)}`);
        }
      }
    }
  }

  // 4 items
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].stock + items[j].stock > 330) continue;
      for (let k = j + 1; k < items.length; k++) {
        if (items[i].stock + items[j].stock + items[k].stock > 330) continue;
        for (let l = k + 1; l < items.length; l++) {
          const s = items[i].stock + items[j].stock + items[k].stock + items[l].stock;
          const vp = items[i].valPrice + items[j].valPrice + items[k].valPrice + items[l].valPrice;
          const vc = items[i].valCost + items[j].valCost + items[k].valCost + items[l].valCost;
          if (Math.abs(s - 320) <= 2 && (Math.abs(vp - 27000) <= 500 || Math.abs(vc - 27000) <= 500)) {
            console.log(`4 ITEMS: "${items[i].name}" + "${items[j].name}" + "${items[k].name}" + "${items[l].name}" -> stock=${s}, valPrice=Q${vp.toFixed(2)}, valCost=Q${vc.toFixed(2)}`);
          }
        }
      }
    }
  }

  await pool.end();
}

run();
