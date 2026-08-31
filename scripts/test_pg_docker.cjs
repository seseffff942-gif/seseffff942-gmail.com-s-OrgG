const { Client } = require('pg');

async function testDockerPg() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });

  try {
    await client.connect();
    console.log('✅ Conexión exitosa a Supabase PostgreSQL en Docker (puerto 54322)');
    
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('Tablas encontradas en public:');
    for (const row of res.rows) {
      const countRes = await client.query(`SELECT count(*) FROM public."${row.table_name}";`).catch(() => ({ rows: [{ count: 'N/A' }] }));
      console.log(` - ${row.table_name}: ${countRes.rows[0].count} registros`);
    }
  } catch (err) {
    console.error('❌ Error conectando a PostgreSQL Docker:', err.message);
  } finally {
    await client.end().catch(() => {});
  }
}

testDockerPg();
