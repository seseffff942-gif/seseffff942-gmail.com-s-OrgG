const pg = require('pg');

async function checkMore() {
  const client = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
  await client.connect();

  console.log('--- BUSCANDO SAN LUIS EN GENERAL EN CLIENTS Y FACTURAS ---');
  const resSanLuis = await client.query(`
    SELECT i.folio, i.date, i."clientName", i."totalAmount", u.name as seller_name
    FROM invoices i
    LEFT JOIN users u ON (u.email = i."sellerId" OR u.id = i."sellerId")
    WHERE LOWER(i."clientName") LIKE '%san luis%' OR LOWER(i."clientName") LIKE '%isabel%' OR LOWER(i."clientName") LIKE '%izabel%' OR LOWER(i."clientName") LIKE '%mariela%'
  `);
  console.log(resSanLuis.rows);

  const cliSanLuis = await client.query(`
    SELECT id, name, "companyName", address, "sellerId"
    FROM clients
    WHERE LOWER(address) LIKE '%san luis%' OR LOWER(name) LIKE '%isabel%' OR LOWER(name) LIKE '%izabel%' OR LOWER(name) LIKE '%mariela%'
  `);
  console.log('\nClientes en San Luis / Isabel:');
  console.log(cliSanLuis.rows);

  await client.end();
}

checkMore();
