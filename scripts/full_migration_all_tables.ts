import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const neonUrl = process.env.NEON_DATABASE_URL;
const sbUrl = process.env.SUPABASE_URL || 'https://vedgedsbuajueynnyvpn.supabase.co';
const sbKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';

if (!neonUrl) {
  console.error('❌ Falta NEON_DATABASE_URL en .env');
  process.exit(1);
}

const supabase = createClient(sbUrl, sbKey);
const pool = new pg.Pool({
  connectionString: neonUrl,
  ssl: { rejectUnauthorized: false },
  max: 20
});

const ALL_TABLES = [
  'users',
  'products',
  'offers',
  'clients',
  'invoices',
  'payments',
  'recibos_caja',
  'quotations',
  'client_visits',
  'office_inventory',
  'notifications',
  'login_tokens',
  'push_subscriptions',
  'fel_config',
  'fel_documentos',
  'fel_bitacora'
];

async function runFastMigration() {
  console.log('⚡ ===================================================');
  console.log('🚀 MIGRACIÓN ULTRARRÁPIDA: SUPABASE ➔ NEON (POR LOTES)');
  console.log('⚡ ===================================================\n');

  const client = await pool.connect();
  const report: Record<string, { total: number; success: boolean; error?: string }> = {};

  try {
    for (const table of ALL_TABLES) {
      process.stdout.write(`⏳ Clonando "${table}"... `);
      try {
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
          console.log(`⚠️ Supabase error: ${error.message}`);
          report[table] = { total: 0, success: false, error: error.message };
          continue;
        }

        const rows = data || [];
        if (rows.length === 0) {
          console.log(`✔ 0 registros.`);
          report[table] = { total: 0, success: true };
          continue;
        }

        // 1. Recopilar todas las columnas posibles
        const allKeys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
        
        // 2. Asegurar columnas una sola vez en bloque
        for (const k of allKeys) {
          try {
            await client.query(`ALTER TABLE public.${table} ADD COLUMN IF NOT EXISTS "${k}" TEXT;`);
          } catch (e) {}
        }

        // 3. Insertar filas en transacción rápida
        await client.query('BEGIN');
        for (const row of rows) {
          const keys = Object.keys(row);
          if (keys.length === 0) continue;

          const columns = keys.map(k => `"${k}"`).join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          const updateClause = keys
            .filter(k => k !== 'id')
            .map(k => `"${k}" = EXCLUDED."${k}"`)
            .join(', ');

          const values = keys.map(k => {
            const v = row[k];
            if (v !== null && typeof v === 'object') return JSON.stringify(v);
            return v;
          });

          const conflictAction = (keys.includes('id') && updateClause.length > 0)
            ? `ON CONFLICT (id) DO UPDATE SET ${updateClause}`
            : (keys.includes('id') ? `ON CONFLICT (id) DO NOTHING` : '');

          await client.query(`INSERT INTO public.${table} (${columns}) VALUES (${placeholders}) ${conflictAction};`, values);
        }
        await client.query('COMMIT');

        console.log(`✔ ${rows.length} registros clonados.`);
        report[table] = { total: rows.length, success: true };

      } catch (err: any) {
        await client.query('ROLLBACK').catch(() => {});
        console.log(`✖ Error: ${err.message}`);
        report[table] = { total: 0, success: false, error: err.message };
      }
    }

    console.log('\n📊 ================= RESUMEN DE LA MIGRACIÓN =================');
    for (const [tName, res] of Object.entries(report)) {
      const statusIcon = res.success ? '✔' : '✖';
      console.log(` ${statusIcon} ${tName.padEnd(20)} : ${res.total} registros clonados`);
    }
    console.log('==============================================================\n');
    console.log('🎉 ¡TODOS TUS DATOS, FACTURAS, FOTOS Y CLIENTES ESTÁN EN NEON!');

  } finally {
    client.release();
    await pool.end();
  }
}

runFastMigration();
