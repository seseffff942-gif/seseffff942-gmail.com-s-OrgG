const { Pool } = require("pg");
const pool = new Pool({
  host: process.env.PGHOST || "dokploy-postgres",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "5f0426c4293f0b35581f4a13",
  database: process.env.PGDATABASE || "agricovet_db",
  port: process.env.PGPORT || 5432
});

async function main() {
  const res = await pool.query(
    "SELECT i.id, i.folio, i.total_amount, i.seller_id, i.date, u.name, u.email FROM invoices i LEFT JOIN users u ON i.seller_id = u.id WHERE DATE(i.date) = '2026-11-02'"
  );
  console.log("Invoices today count:", res.rows.length);
  for (const r of res.rows) {
    console.log(r);
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

