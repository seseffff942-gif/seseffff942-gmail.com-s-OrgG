const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const REMOTE_URL = process.env.SUPABASE_URL;
const REMOTE_KEY = process.env.SUPABASE_ANON_KEY;
const remoteSupabase = (REMOTE_URL && REMOTE_KEY) ? createClient(REMOTE_URL, REMOTE_KEY) : null;

async function syncCleanVisits() {
  const visitsFile = path.join(__dirname, '..', 'client_visits_local.json');
  const visits = JSON.parse(fs.readFileSync(visitsFile, 'utf8'));

  console.log(`📁 Cargadas ${visits.length} visitas limpias y realistas desde client_visits_local.json`);

  // 1. Docker PostgreSQL
  const pgClient = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });

  await pgClient.connect();
  console.log('✅ Conectado a Docker PostgreSQL.');

  await pgClient.query('DELETE FROM public.client_visits;');
  console.log('🧹 Tabla client_visits vaciada en Docker.');

  for (const v of visits) {
    await pgClient.query(`
      INSERT INTO public.client_visits (
        id, client_id, "clientId", client_name, "clientName", client_code, "clientCode", company_name, "companyName",
        seller_id, "sellerId", seller_name, "sellerName", seller_email, "sellerEmail",
        latitude, longitude, accuracy, distance_meters, "distanceMeters",
        visit_type, "visitType", notes, photo_url, "photoUrl", created_at, "createdAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27
      );
    `, [
      v.id, v.clientId || v.client_id, v.clientId || v.client_id, v.clientName || v.client_name, v.clientName || v.client_name,
      v.clientCode || v.client_code, v.clientCode || v.client_code, v.companyName || v.company_name, v.companyName || v.company_name,
      v.sellerId || v.seller_id, v.sellerId || v.seller_id, v.sellerName || v.seller_name, v.sellerName || v.seller_name,
      v.sellerEmail || v.seller_email, v.sellerEmail || v.seller_email,
      v.latitude || 0, v.longitude || 0, v.accuracy || 5, v.distanceMeters || v.distance_meters || 0, v.distanceMeters || v.distance_meters || 0,
      v.visitType || v.visit_type || 'rutina', v.visitType || v.visit_type || 'rutina', v.notes || '', v.photoUrl || v.photo_url || null, v.photoUrl || v.photo_url || null,
      v.createdAt || v.created_at, v.createdAt || v.created_at
    ]);
  }

  const dockerCount = await pgClient.query('SELECT count(*) FROM public.client_visits;');
  const dockerToday = await pgClient.query("SELECT count(*) FROM public.client_visits WHERE \"createdAt\"::text LIKE '2026-08-30%';");
  console.log(`✅ Docker: ${dockerCount.rows[0].count} visitas en total. Visitas de hoy: ${dockerToday.rows[0].count}`);

  await pgClient.query("NOTIFY pgrst, 'reload schema';");
  await pgClient.end();

  // 2. Remote Supabase (si aplica)
  if (remoteSupabase) {
    try {
      console.log('🌐 Sincronizando con Supabase remoto...');
      await remoteSupabase.from('client_visits').delete().neq('id', '0_none');
      for (const v of visits) {
        await remoteSupabase.from('client_visits').insert([v]);
      }
      console.log('✅ Supabase remoto actualizado con las 13 visitas limpias.');
    } catch (e) {
      console.warn('⚠️ Supabase remoto:', e.message);
    }
  }

  console.log('🎉 Sincronización de visitas completada.');
}

syncCleanVisits().catch(console.error);
