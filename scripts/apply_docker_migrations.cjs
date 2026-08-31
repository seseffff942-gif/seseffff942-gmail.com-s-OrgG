const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigrations() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Supabase PostgreSQL local en Docker (54322)');

    const sqlPath = path.join(__dirname, 'local_migrate.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('⏳ Aplicando scripts/local_migrate.sql...');
    await client.query(sql);
    console.log('✅ local_migrate.sql aplicado correctamente.');

    // Verificar tabla client_visits
    const visitsCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'client_visits';
    `);
    console.log(`\n📋 Columnas en public.client_visits (${visitsCheck.rows.length} columnas):`);
    console.log(visitsCheck.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));

    // Verificar columnas en clients
    const clientsCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clients' AND column_name IN ('latitude', 'longitude', 'location_address', 'locationAddress', 'geotagged_at', 'geotagged_by');
    `);
    console.log(`\n📍 Columnas de geolocalización en public.clients:`);
    console.log(clientsCols.rows.map(c => c.column_name).join(', '));

  } catch (err) {
    console.error('❌ Error aplicando migraciones a Docker:', err);
  } finally {
    await client.end().catch(() => {});
  }
}

applyMigrations();
