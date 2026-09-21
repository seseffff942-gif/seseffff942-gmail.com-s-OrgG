const pg = require('pg');

async function checkRemate() {
  const client = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
  await client.connect();

  const r = await client.query(`SELECT id, name, "companyName", address, "sellerId" FROM clients WHERE LOWER("companyName") LIKE '%mascota%' OR LOWER(address) LIKE '%remate%'`);
  console.log('Clientes en El Remate / La Mascota:');
  console.log(r.rows);

  await client.end();
}

checkRemate();
