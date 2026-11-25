const { Pool } = require('pg');
const fs = require('fs');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db'
  });

  console.log("=== SELLER ROUTES IN DB ===");
  try {
    const res = await pool.query(`SELECT * FROM seller_routes ORDER BY created_at DESC LIMIT 10;`);
    console.log("Found seller_routes in DB:", res.rows.length);
    res.rows.forEach(r => console.log(JSON.stringify(r)));
  } catch (e) {
    console.log("Error querying seller_routes:", e.message);
  }

  console.log("\n=== SELLER ROUTES LOCAL JSON ===");
  try {
    if (fs.existsSync('/app/seller_routes_local.json')) {
      const data = JSON.parse(fs.readFileSync('/app/seller_routes_local.json', 'utf8'));
      console.log("Found seller_routes_local.json, entries:", data.length);
      console.log(JSON.stringify(data.slice(-5), null, 2));
    }
  } catch (e) {
    console.log("Error reading seller_routes_local.json:", e.message);
  }

  await pool.end();
}

run();
