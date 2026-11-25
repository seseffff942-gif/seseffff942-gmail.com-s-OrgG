const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db",
  ssl: false
});

async function main() {
  const res = await pool.query(`
    SELECT id, name, "companyName", address, phone, "sellerId", "clientCode"
    FROM clients
    WHERE address ILIKE '%chal%' OR "companyName" ILIKE '%chal%' OR name ILIKE '%chal%' OR name ILIKE '%angel%'
  `);
  console.log("Clients in El Chal or named Angel:", res.rows);
  await pool.end();
}
main().catch(console.error);

