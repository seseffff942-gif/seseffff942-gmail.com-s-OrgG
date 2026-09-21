const pg = require('pg');

async function check() {
  const client = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
  await client.connect();

  const r = await client.query(`
    SELECT id, name, "companyName", address FROM clients 
    WHERE LOWER(name) LIKE '%vicente%' OR LOWER(name) LIKE '%bac%' OR LOWER(name) LIKE '%villegas%'
  `);
  console.log('Clientes Rony Vicente / Alfonso Bac / Andrea:');
  console.log(r.rows);

  await client.end();
}

check();
