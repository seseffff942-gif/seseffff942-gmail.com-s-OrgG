const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db'
  });

  const res = await pool.query(`SELECT id, name, category, stock, price, cost_price, variants FROM products ORDER BY stock DESC;`);

  console.log("ID | Name | Category | Stock | Price | Cost | TotalPrice | TotalCost");
  for (const p of res.rows) {
    let variants = p.variants;
    if (typeof variants === 'string') {
      try { variants = JSON.parse(variants); } catch (e) {}
    }
    let s = Number(p.stock || 0);
    let pr = Number(p.price || 0);
    let co = Number(p.cost_price || 0);

    let totS = s;
    let totP = s * pr;
    let totC = s * co;

    if (variants && Array.isArray(variants) && variants.length > 0) {
      totS = 0; totP = 0; totC = 0;
      for (const v of variants) {
        const vst = Number(v.stock !== undefined ? v.stock : s);
        totS += vst;
        totP += vst * Number(v.price || pr);
        totC += vst * Number(v.cost_price || co);
      }
    }

    if (totS !== 0 || totP !== 0) {
      console.log(`${p.id} | ${p.name} | ${p.category} | ${totS} | ${pr} | ${co} | ${totP.toFixed(2)} | ${totC.toFixed(2)}`);
    }
  }

  await pool.end();
}

run();
