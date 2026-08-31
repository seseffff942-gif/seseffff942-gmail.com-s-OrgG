const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function syncAllSchemaToDocker() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Docker PostgreSQL.');

    const schemaPath = path.join(__dirname, '..', 'supabase_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('⏳ Ejecutando supabase_schema.sql completo en Docker...');
    await client.query(schemaSql);
    console.log('✅ supabase_schema.sql aplicado con éxito en Docker.');

    // Verificar si existen las tablas de FEL y otras
    const felCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'fel_%';
    `);
    console.log('Tablas FEL presentes:', felCheck.rows.map(r => r.table_name).join(', '));

    // Reload PostgREST schema cache
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log('🔄 Notificación de reload schema enviada a PostgREST.');

  } catch (err) {
    console.error('❌ Error aplicando schema:', err);
  } finally {
    await client.end().catch(() => {});
  }
}

syncAllSchemaToDocker();
