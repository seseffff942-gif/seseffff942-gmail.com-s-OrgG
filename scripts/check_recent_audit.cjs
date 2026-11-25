const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db'
  });

  const res = await pool.query(`
    SELECT * FROM audit_logs 
    ORDER BY created_at DESC 
    LIMIT 100;
  `);

  console.log(`Fetched ${res.rows.length} recent audit logs:`);
  for (const r of res.rows) {
    console.log(`[${r.created_at.toISOString ? r.created_at.toISOString() : r.created_at}] [${r.action}] ${r.user_email || r.user_id}: ${r.description} (entity: ${r.entity_name})`);
  }

  await pool.end();
}

run();
