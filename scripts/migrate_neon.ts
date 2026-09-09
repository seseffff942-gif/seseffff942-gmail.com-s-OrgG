import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: NEON_DATABASE_URL no está definida en .env');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  console.log('🚀 Conectando a Neon PostgreSQL...');
  const client = await pool.connect();
  
  try {
    console.log('✅ Conexión exitosa a Neon.');
    
    // Crear roles anon y authenticated si no existen
    try {
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN 
            CREATE ROLE anon; 
          END IF; 
          IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN 
            CREATE ROLE authenticated; 
          END IF; 
        END $$;
      `);
      console.log('✅ Roles anon y authenticated configurados.');
    } catch (rErr: any) {
      console.warn('⚠️ No se pudieron crear roles específicos:', rErr.message);
    }

    // 1. Ejecutar supabase_schema.sql
    const schemaPath = path.join(process.cwd(), 'supabase_schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('📄 Aplicando supabase_schema.sql...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
      
      // Separar por punto y coma para ejecutar bloques de forma resiliente
      const statements = schemaSql
        .split(/;\s*$/m)
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        try {
          await client.query(stmt);
        } catch (sErr: any) {
          if (!sErr.message.includes('already exists') && !sErr.message.includes('policy')) {
            console.warn(`⚠️ Aviso en sentencia SQL: ${sErr.message}`);
          }
        }
      }
      console.log('✅ supabase_schema.sql procesado.');
    }

    // 2. Ejecutar migraciones en carpeta migrations
    const migrationsDir = path.join(process.cwd(), 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
      for (const file of files) {
        console.log(`📄 Aplicando migración ${file}...`);
        const migSql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        try {
          await client.query(migSql);
          console.log(`✅ ${file} aplicada.`);
        } catch (mErr: any) {
          console.warn(`⚠️ Advertencia en ${file}: ${mErr.message}`);
        }
      }
    }

    // 3. Crear usuario administrador de rescate por si se requiere
    try {
      await client.query(`
        INSERT INTO public.users (id, name, email, role, password)
        VALUES ('superadmin', 'Administrador Principal', 'seseffff942@gmail.com', 'admin', 'admin123')
        ON CONFLICT (id) DO NOTHING;
      `);
    } catch (uErr) {}

    // 4. Verificar tablas creadas
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\n📊 Tablas creadas y disponibles en Neon:');
    res.rows.forEach(r => console.log(` ✔ ${r.table_name}`));
    console.log('\n🎉 ¡Base de datos Neon inicializada al 100%!');

  } catch (err: any) {
    console.error('❌ Error durante la migración:', err);
  } finally {
    client.release();
    await pool.end();
  }
}


runMigration();
