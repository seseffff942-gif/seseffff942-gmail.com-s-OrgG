const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:evolution_pass@172.17.0.1:5432/agricovet_db",
  ssl: false
});

async function main() {
  console.log("=== BUSCANDO 'hidalgo' EN TODAS LAS TABLAS DE POSTGRESQL ===");

  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);

  for (const row of tablesRes.rows) {
    const t = row.table_name;
    try {
      // Find text/varchar columns
      const colsRes = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND data_type IN ('text', 'character varying', 'jsonb', 'json')
      `, [t]);

      if (colsRes.rows.length === 0) continue;

      const whereClauses = colsRes.rows.map(c => `CAST("${c.column_name}" AS TEXT) ILIKE '%hidalgo%'`).join(' OR ');
      const q = `SELECT * FROM "${t}" WHERE ${whereClauses} LIMIT 5`;
      const res = await pool.query(q);
      if (res.rows.length > 0) {
        console.log(`\n🎉 ENCONTRADO EN TABLA "${t}": ${res.rows.length} fila(s)`);
        console.log(JSON.stringify(res.rows, null, 2));
      }
    } catch (e) {
      // ignore
    }
  }

  await pool.end();
}

main().catch(console.error);

