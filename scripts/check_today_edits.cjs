const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db'
  });

  const res = await pool.query(`
    SELECT * FROM audit_logs 
    WHERE created_at >= '2026-11-21 00:00:00'
    ORDER BY created_at DESC;
  `);

  console.log(`Logs today (${res.rows.length}):`);
  for (const r of res.rows) {
    console.log(`[${r.created_at.toISOString()}] ${r.action} on ${r.entity_name}:`);
    console.log(`  prev:`, JSON.stringify(r.previous_data));
    console.log(`  new :`, JSON.stringify(r.new_data));
  }

  await pool.end();
}

run();
