const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db",
  ssl: false
});

async function main() {
  const res = await pool.query(
    "SELECT * FROM seller_routes WHERE id = 'route_u_1780897737916_1793709073129'"
  );
  console.log("Finished route details:", res.rows[0]);
  await pool.end();
}
main().catch(console.error);
