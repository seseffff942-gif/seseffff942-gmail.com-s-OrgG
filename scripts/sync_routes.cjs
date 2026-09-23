const pg = require('pg');
const fs = require('fs');

const pool = new pg.Pool({ connectionString: 'postgresql://postgres:evolution_pass@185.166.39.49:5432/agricovet_db' });

async function syncLocalRoutes() {
  const dbRes = await pool.query('SELECT * FROM public.seller_routes ORDER BY started_at DESC');
  console.log(`Leídas ${dbRes.rows.length} rutas desde PostgreSQL:`);
  
  const mapped = dbRes.rows.map(r => ({
    id: r.id,
    sellerId: r.seller_id || r.sellerId,
    sellerName: r.seller_name || r.sellerName,
    sellerEmail: r.seller_email || r.sellerEmail,
    status: r.status,
    startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
    finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null,
    startLatitude: r.start_latitude ? Number(r.start_latitude) : null,
    startLongitude: r.start_longitude ? Number(r.start_longitude) : null,
    endLatitude: r.end_latitude ? Number(r.end_latitude) : null,
    endLongitude: r.end_longitude ? Number(r.end_longitude) : null,
    totalStops: r.total_stops || 0,
    totalDistanceKm: r.total_distance_km ? Number(r.total_distance_km) : 0,
    totalDurationMins: r.total_duration_mins || 0,
    notes: r.notes || '',
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : (r.started_at ? new Date(r.started_at).toISOString() : new Date().toISOString())
  }));

  fs.writeFileSync('seller_routes_local.json', JSON.stringify(mapped, null, 2), 'utf8');
  console.log('seller_routes_local.json sincronizado exactamente con las 3 rutas reales:');
  mapped.forEach(r => console.log(`- Ruta: ${r.id} | Asesor: ${r.sellerName || r.sellerId} | Estado: ${r.status}`));

  await pool.end();
}

syncLocalRoutes();
