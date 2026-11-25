const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db'
  });

  const res = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public';`);
  console.log("Tables:", res.rows.map(r => r.table_name));

  for (const t of res.rows) {
    const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1;`, [t.table_name]);
    console.log(`Table ${t.table_name} columns:`, cols.rows.map(c => c.column_name).join(', '));
  }

  await pool.end();
}

run();
