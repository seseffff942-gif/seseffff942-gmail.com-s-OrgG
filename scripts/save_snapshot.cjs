const { Pool } = require('pg');
const fs = require('fs');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db'
  });

  const res = await pool.query("SELECT * FROM products ORDER BY category, name;");
  fs.writeFileSync("/app/snapshot_products_2026_11_23.json", JSON.stringify(res.rows, null, 2));
  console.log("SNAPSHOT SAVED IN APP: " + res.rows.length + " products.");

  await pool.end();
}

run();
