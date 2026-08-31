const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const REMOTE_URL = process.env.SUPABASE_URL;
const REMOTE_KEY = process.env.SUPABASE_ANON_KEY;
const remoteSupabase = (REMOTE_URL && REMOTE_KEY) ? createClient(REMOTE_URL, REMOTE_KEY) : null;

async function setup() {
  const pgClient = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });
  await pgClient.connect();

  // Create seller_routes table in Docker PostgreSQL
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS public.seller_routes (
      id TEXT PRIMARY KEY,
      seller_id TEXT,
      "sellerId" TEXT,
      seller_name TEXT,
      "sellerName" TEXT,
      seller_email TEXT,
      "sellerEmail" TEXT,
      status TEXT DEFAULT 'active',
      started_at TIMESTAMPTZ,
      "startedAt" TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      "finishedAt" TIMESTAMPTZ,
      start_latitude DOUBLE PRECISION,
      "startLatitude" DOUBLE PRECISION,
      start_longitude DOUBLE PRECISION,
      "startLongitude" DOUBLE PRECISION,
      end_latitude DOUBLE PRECISION,
      "endLatitude" DOUBLE PRECISION,
      end_longitude DOUBLE PRECISION,
      "endLongitude" DOUBLE PRECISION,
      total_stops INTEGER DEFAULT 0,
      "totalStops" INTEGER DEFAULT 0,
      total_distance_km DOUBLE PRECISION DEFAULT 0,
      "totalDistanceKm" DOUBLE PRECISION DEFAULT 0,
      total_duration_mins INTEGER DEFAULT 0,
      "totalDurationMins" INTEGER DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      "createdAt" TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('✅ Tabla seller_routes creada/asegurada en Docker.');

  // Add route_id and routeId columns to client_visits if not exists
  await pgClient.query(`
    ALTER TABLE public.client_visits ADD COLUMN IF NOT EXISTS route_id TEXT;
    ALTER TABLE public.client_visits ADD COLUMN IF NOT EXISTS "routeId" TEXT;
  `);
  console.log('✅ Columnas route_id agregadas a client_visits.');

  // Seed sample completed and active routes
  // 1. Erick Juárez - Route 1: Active Today (2026-08-30) - In Progress
  // 2. Erick Juárez - Route 2: Completed 2026-08-25 - Archived
  // 3. Erick Juárez - Route 3: Completed 2026-08-19 - Archived
  // 4. Herbert Argueta - Route 1: Completed 2026-08-28 - Archived
  // 5. Herbert Argueta - Route 2: Completed 2026-08-21 - Archived
  // 6. Herbert Argueta - Route 3: Completed 2026-08-16 - Archived

  const sampleRoutes = [
    {
      id: 'route_erick_20260830',
      sellerId: 'u_1780897737916',
      sellerName: 'Erick Juárez',
      sellerEmail: 'jerickottoniel@gmail.com',
      status: 'active', // 🟢 En curso hoy
      startedAt: '2026-08-30T15:00:00.000Z',
      finishedAt: null,
      startLatitude: 14.6038,
      startLongitude: -90.5186,
      endLatitude: null,
      endLongitude: null,
      totalStops: 2,
      totalDistanceKm: 45.2,
      totalDurationMins: 135,
      notes: 'Ruta activa del día (Zona Central y Chimaltenango).'
    },
    {
      id: 'route_erick_20260825',
      sellerId: 'u_1780897737916',
      sellerName: 'Erick Juárez',
      sellerEmail: 'jerickottoniel@gmail.com',
      status: 'completed', // 🏁 Finalizada / Historial
      startedAt: '2026-08-25T15:30:00.000Z',
      finishedAt: '2026-08-25T21:30:00.000Z',
      startLatitude: 15.4708,
      startLongitude: -90.3708,
      endLatitude: 15.7278,
      endLongitude: -88.5944,
      totalStops: 2,
      totalDistanceKm: 215.0,
      totalDurationMins: 360,
      notes: 'Jornada Verapaces e Izabal finalizada con éxito.'
    },
    {
      id: 'route_erick_20260819',
      sellerId: 'u_1780897737916',
      sellerName: 'Erick Juárez',
      sellerEmail: 'jerickottoniel@gmail.com',
      status: 'completed', // 🏁 Finalizada / Historial
      startedAt: '2026-08-19T17:30:00.000Z',
      finishedAt: '2026-08-19T20:00:00.000Z',
      startLatitude: 14.9722,
      startLongitude: -89.5306,
      endLatitude: 14.9722,
      endLongitude: -89.5306,
      totalStops: 1,
      totalDistanceKm: 0,
      totalDurationMins: 150,
      notes: 'Visita única en Zacapa finalizada.'
    },
    {
      id: 'route_herbert_20260828',
      sellerId: 'u_1780870803300',
      sellerName: 'Herbert Argueta',
      sellerEmail: 'gruasytransportesali@gmail.com',
      status: 'completed', // 🏁 Finalizada / Historial
      startedAt: '2026-08-28T14:30:00.000Z',
      finishedAt: '2026-08-28T21:45:00.000Z',
      startLatitude: 14.3009,
      startLongitude: -90.785,
      endLatitude: 14.5361,
      endLongitude: -91.6778,
      totalStops: 3,
      totalDistanceKm: 148.5,
      totalDurationMins: 435,
      notes: 'Ruta Costa Sur completada.'
    },
    {
      id: 'route_herbert_20260821',
      sellerId: 'u_1780870803300',
      sellerName: 'Herbert Argueta',
      sellerEmail: 'gruasytransportesali@gmail.com',
      status: 'completed', // 🏁 Finalizada / Historial
      startedAt: '2026-08-21T15:30:00.000Z',
      finishedAt: '2026-08-21T20:30:00.000Z',
      startLatitude: 14.8347,
      startLongitude: -91.518,
      endLatitude: 14.9639,
      endLongitude: -91.7944,
      totalStops: 2,
      totalDistanceKm: 58.0,
      totalDurationMins: 300,
      notes: 'Ruta Occidente finalizada.'
    },
    {
      id: 'route_herbert_20260816',
      sellerId: 'u_1780870803300',
      sellerName: 'Herbert Argueta',
      sellerEmail: 'gruasytransportesali@gmail.com',
      status: 'completed', // 🏁 Finalizada / Historial
      startedAt: '2026-08-16T14:30:00.000Z',
      finishedAt: '2026-08-16T19:00:00.000Z',
      startLatitude: 14.2917,
      startLongitude: -89.8958,
      endLatitude: 14.2764,
      endLongitude: -90.2989,
      totalStops: 2,
      totalDistanceKm: 52.0,
      totalDurationMins: 270,
      notes: 'Ruta Oriente Sur finalizada.'
    }
  ];

  await pgClient.query('DELETE FROM public.seller_routes;');
  for (const r of sampleRoutes) {
    await pgClient.query(`
      INSERT INTO public.seller_routes (
        id, seller_id, "sellerId", seller_name, "sellerName", seller_email, "sellerEmail",
        status, started_at, "startedAt", finished_at, "finishedAt",
        start_latitude, "startLatitude", start_longitude, "startLongitude",
        end_latitude, "endLatitude", end_longitude, "endLongitude",
        total_stops, "totalStops", total_distance_km, "totalDistanceKm",
        total_duration_mins, "totalDurationMins", notes, created_at, "createdAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20,
        $21, $22, $23, $24,
        $25, $26, $27, NOW(), NOW()
      );
    `, [
      r.id, r.sellerId, r.sellerId, r.sellerName, r.sellerName, r.sellerEmail, r.sellerEmail,
      r.status, r.startedAt, r.startedAt, r.finishedAt, r.finishedAt,
      r.startLatitude, r.startLatitude, r.startLongitude, r.startLongitude,
      r.endLatitude, r.endLatitude, r.endLongitude, r.endLongitude,
      r.totalStops, r.totalStops, r.totalDistanceKm, r.totalDistanceKm,
      r.totalDurationMins, r.totalDurationMins, r.notes
    ]);
  }

  // Update client_visits with matching route_ids
  await pgClient.query(`
    UPDATE public.client_visits SET route_id = 'route_erick_20260830', "routeId" = 'route_erick_20260830' WHERE "sellerId" = 'u_1780897737916' AND "createdAt"::text LIKE '2026-08-30%';
    UPDATE public.client_visits SET route_id = 'route_erick_20260825', "routeId" = 'route_erick_20260825' WHERE "sellerId" = 'u_1780897737916' AND "createdAt"::text LIKE '2026-08-25%';
    UPDATE public.client_visits SET route_id = 'route_erick_20260819', "routeId" = 'route_erick_20260819' WHERE "sellerId" = 'u_1780897737916' AND "createdAt"::text LIKE '2026-08-19%';
    UPDATE public.client_visits SET route_id = 'route_herbert_20260828', "routeId" = 'route_herbert_20260828' WHERE "sellerId" = 'u_1780870803300' AND "createdAt"::text LIKE '2026-08-28%';
    UPDATE public.client_visits SET route_id = 'route_herbert_20260821', "routeId" = 'route_herbert_20260821' WHERE "sellerId" = 'u_1780870803300' AND "createdAt"::text LIKE '2026-08-21%';
    UPDATE public.client_visits SET route_id = 'route_herbert_20260816', "routeId" = 'route_herbert_20260816' WHERE "sellerId" = 'u_1780870803300' AND "createdAt"::text LIKE '2026-08-16%';
  `);

  // Write local seller_routes_local.json
  const localRoutesFile = path.join(__dirname, '..', 'seller_routes_local.json');
  fs.writeFileSync(localRoutesFile, JSON.stringify(sampleRoutes, null, 2), 'utf8');

  console.log('✅ seller_routes_local.json creado.');
  await pgClient.query("NOTIFY pgrst, 'reload schema';");
  await pgClient.end();

  // Also sync to remote Supabase if possible
  if (remoteSupabase) {
    try {
      console.log('🌐 Sincronizando con Supabase remoto...');
      for (const r of sampleRoutes) {
        await remoteSupabase.from('seller_routes').upsert([{
          id: r.id,
          seller_id: r.sellerId,
          seller_name: r.sellerName,
          seller_email: r.sellerEmail,
          status: r.status,
          started_at: r.startedAt,
          finished_at: r.finishedAt,
          total_stops: r.totalStops,
          total_distance_km: r.totalDistanceKm,
          total_duration_mins: r.totalDurationMins,
          notes: r.notes
        }]);
      }
      console.log('✅ Supabase remoto sincronizado.');
    } catch (e) {
      console.warn('⚠️ Supabase remoto:', e.message);
    }
  }

  console.log('🎉 Sistema de Jornadas y Rutas Activas / Historial configurado exitosamente.');
}

setup().catch(console.error);
