const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db'
  });

  const res = await pool.query(`
    SELECT action, entity_name, description, previous_data, new_data, created_at 
    FROM audit_logs 
    WHERE entity_name ILIKE '%POTER%' OR entity_name ILIKE '%PARAQUAT%' OR entity_name ILIKE '%COMEDERO%' OR entity_name ILIKE '%GLUFOSIN%'
    ORDER BY created_at DESC 
    LIMIT 20;
  `);

  console.log(`Found ${res.rows.length} audit logs:`);
  for (const r of res.rows) {
    console.log(`[${r.created_at.toISOString ? r.created_at.toISOString() : r.created_at}] [${r.action}] ${r.description}`);
    console.log(`  prev:`, JSON.stringify(r.previous_data), `new:`, JSON.stringify(r.new_data));
  }

  await pool.end();
}

run();
