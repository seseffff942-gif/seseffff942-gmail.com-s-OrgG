const pg = require('pg');
const fs = require('fs');

const pool = new pg.Pool({ connectionString: 'postgresql://postgres:evolution_pass@185.166.39.49:5432/agricovet_db' });

async function checkRoutes() {
  const dbRes = await pool.query('SELECT id, seller_name, seller_email, status, started_at, finished_at FROM public.seller_routes ORDER BY started_at DESC');
  console.log('=== RUTAS EN BASE DE DATOS POSTGRESQL ===');
  console.log(`Total rutas en BD: ${dbRes.rows.length}`);
  dbRes.rows.forEach(r => console.log(r));

  console.log('\n=== RUTAS EN SELLER_ROUTES_LOCAL.JSON ===');
  if (fs.existsSync('seller_routes_local.json')) {
    const local = JSON.parse(fs.readFileSync('seller_routes_local.json', 'utf8'));
    console.log(`Total rutas en JSON local: ${local.length}`);
    local.forEach(r => console.log({ id: r.id, name: r.sellerName, email: r.sellerEmail, status: r.status, startedAt: r.startedAt, finishedAt: r.finishedAt }));
  } else {
    console.log('No existe archivo seller_routes_local.json');
  }

  const visitsRes = await pool.query('SELECT id, "clientName", "sellerName", "visitType", notes, "createdAt" FROM public.client_visits ORDER BY "createdAt" DESC');
  console.log('\n=== VISITAS EN BASE DE DATOS POSTGRESQL ===');
  console.log(`Total visitas en BD: ${visitsRes.rows.length}`);
  visitsRes.rows.forEach(v => console.log(v));

  await pool.end();
}

checkRoutes();
