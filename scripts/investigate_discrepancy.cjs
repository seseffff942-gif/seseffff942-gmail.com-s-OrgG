const { Pool } = require('pg');
const fs = require('fs');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db'
  });

  console.log("=== CHECKING CONSIGNACIONES ===");
  try {
    const cons = await pool.query("SELECT * FROM consignaciones ORDER BY created_at DESC LIMIT 10;");
    console.log("Consignaciones count:", cons.rows.length);
    console.log(JSON.stringify(cons.rows, null, 2));
  } catch (e) {
    console.log("Error querying consignaciones:", e.message);
  }

  console.log("\n=== CHECKING PRODUCTS TOTALS & PRODUCTS WITH STOCK ~320 OR VALUE ~27000 ===");
  try {
    const prods = await pool.query("SELECT id, name, category, stock, price, is_external, variants FROM products;");
    console.log("Total products in DB:", prods.rows.length);
    
    let totalStock = 0;
    let totalValuation = 0;
    let totalStockNoInc = 0;
    let totalValNoInc = 0;

    const items = [];

    for (const p of prods.rows) {
      const isInc = (p.category || '').toUpperCase() === 'INCUBADORAS';
      let variants = p.variants;
      if (typeof variants === 'string') {
        try { variants = JSON.parse(variants); } catch (e) {}
      }
      
      let pStock = 0;
      let pVal = 0;

      if (variants && Array.isArray(variants) && variants.length > 0) {
        for (const v of variants) {
          const s = Number(v.stock !== undefined ? v.stock : (p.stock || 0));
          const pr = Number(v.price || p.price || 0);
          pStock += s;
          pVal += s * pr;
        }
      } else {
        const s = Number(p.stock || 0);
        const pr = Number(p.price || 0);
        pStock = s;
        pVal = s * pr;
      }

      totalStock += pStock;
      totalValuation += pVal;
      if (!isInc) {
        totalStockNoInc += pStock;
        totalValNoInc += pVal;
      }

      items.push({
        id: p.id,
        name: p.name,
        category: p.category,
        stock: pStock,
        price: p.price,
        val: pVal,
        is_external: p.is_external
      });
    }

    console.log(`Summary:
    Total Stock (all): ${totalStock}
    Total Stock (no incubadoras): ${totalStockNoInc}
    Total Valuation (all): Q${totalValuation.toFixed(2)}
    Total Valuation (no incubadoras): Q${totalValNoInc.toFixed(2)}
    `);

    // Find products where stock is around 320 or value is around 27,000
    console.log("--- Items with stock around 320 (300 to 350) ---");
    items.filter(i => i.stock >= 300 && i.stock <= 350).forEach(i => {
      console.log(`${i.name} [${i.category}]: stock=${i.stock}, price=${i.price}, val=Q${i.val}`);
    });

    console.log("\n--- Items with valuation around Q27,000 (Q25,000 to Q30,000) ---");
    items.filter(i => i.val >= 24000 && i.val <= 30000).forEach(i => {
      console.log(`${i.name} [${i.category}]: stock=${i.stock}, price=${i.price}, val=Q${i.val}`);
    });

    console.log("\n--- Check combinations or items whose unit price * 320 = ~27,000 (price ~ 84.37) ---");
    items.filter(i => Number(i.price) >= 75 && Number(i.price) <= 95).forEach(i => {
      console.log(`${i.name} [${i.category}]: stock=${i.stock}, price=${i.price}, val=Q${i.val}`);
    });

    console.log("\n--- Check items with is_external = true ---");
    items.filter(i => i.is_external).forEach(i => {
      console.log(`${i.name} [${i.category}]: stock=${i.stock}, price=${i.price}, val=Q${i.val}`);
    });

    console.log("\n--- Check items in other categories or inactive/office ---");
    const catMap = {};
    for (const i of items) {
      const c = i.category || 'SIN_CATEGORIA';
      if (!catMap[c]) catMap[c] = { count: 0, stock: 0, val: 0 };
      catMap[c].count++;
      catMap[c].stock += i.stock;
      catMap[c].val += i.val;
    }
    console.log("Categories Breakdown:", JSON.stringify(catMap, null, 2));

  } catch (e) {
    console.error("Error products:", e);
  }

  console.log("\n=== CHECKING RECENT AUDIT LOGS FOR STOCK / CONSIGNACIONES / ADJUSTMENTS ===");
  try {
    const logs = await pool.query(`
      SELECT * FROM audit_logs 
      WHERE action LIKE '%STOCK%' OR action LIKE '%CONSIGN%' OR action LIKE '%INVENTORY%' OR action LIKE '%PRODUCT%'
      ORDER BY created_at DESC LIMIT 20;
    `);
    console.log("Recent audit logs count:", logs.rows.length);
    logs.rows.forEach(l => {
      console.log(`[${l.created_at}] ${l.user_email || l.user_id} - ${l.action}: ${l.details || l.description || ''}`);
    });
  } catch (e) {
    console.log("Error audit logs:", e.message);
  }

  await pool.end();
}

run();
