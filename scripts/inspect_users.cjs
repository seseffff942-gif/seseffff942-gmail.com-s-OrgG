const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
  await c.connect();
  const u = await c.query('SELECT id, name, email, role FROM public.users;');
  console.log('USERS IN DB:', u.rows);
  const visits = await c.query('SELECT id, "clientName", "sellerName", "sellerId", "createdAt" FROM public.client_visits;');
  console.log('CURRENT VISITS IN DB:', visits.rows);
  await c.end();
}

main().catch(console.error);
