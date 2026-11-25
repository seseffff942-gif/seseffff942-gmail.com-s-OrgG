const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db'
  });

  const res = await pool.query(`
    SELECT id, name, category, stock, is_external, variants 
    FROM products 
    WHERE stock < 0 OR variants::text LIKE '%"stock":-%';
  `);

  console.log(`Found ${res.rows.length} products with negative stock in DB:`);
  for (const p of res.rows) {
    console.log(`ID: ${p.id} | Name: "${p.name}" | Cat: "${p.category}" | ParentStock: ${p.stock}`);
    let vars = p.variants;
    if (typeof vars === 'string') {
      try { vars = JSON.parse(vars); } catch (e) {}
    }
    if (vars && Array.isArray(vars)) {
      vars.forEach(v => {
        if (Number(v.stock) < 0) {
          console.log(`   -> Variant [${v.color} - ${v.size}]: stock = ${v.stock}`);
        }
      });
    }
  }

  await pool.end();
}

run();
