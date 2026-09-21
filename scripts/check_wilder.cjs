const pg = require('pg');

async function checkWilder() {
  const client = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
  await client.connect();

  console.log('--- BUSCANDO "WILDER LEMUS" O "EL AMIGO" EN INVOICES ---');
  const res = await client.query(`
    SELECT i.id, i.folio, i.date, i."clientName", i."totalAmount", i."sellerId",
           u.name as seller_name, u.email as seller_email
    FROM invoices i
    LEFT JOIN users u ON (u.email = i."sellerId" OR u.id = i."sellerId")
    WHERE LOWER(i."clientName") LIKE '%wilder%' 
       OR LOWER(i."clientName") LIKE '%lemus%' 
       OR LOWER(i."clientName") LIKE '%el amigo%'
       OR LOWER(i."clientName") LIKE '%amigo%'
  `);
  console.log(res.rows);

  console.log('\n--- BUSCANDO EN CLIENTS ---');
  const cli = await client.query(`
    SELECT id, name, "companyName", address, "sellerId"
    FROM clients
    WHERE LOWER(name) LIKE '%wilder%' 
       OR LOWER(name) LIKE '%lemus%' 
       OR LOWER("companyName") LIKE '%amigo%'
  `);
  console.log(cli.rows);

  await client.end();
}

checkWilder();
