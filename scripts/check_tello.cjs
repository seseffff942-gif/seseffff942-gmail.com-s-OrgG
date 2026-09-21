const pg = require('pg');
const c = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
c.connect().then(async () => {
  const r1 = await c.query('SELECT folio, "clientName", date, "totalAmount", "sellerId" FROM invoices WHERE "clientName" ILIKE \'%tello%\' OR "clientName" ILIKE \'%san francisco%\';');
  console.log('Invoices tello / san francisco:', r1.rows);

  const r2 = await c.query('SELECT folio, "clientName", date, "totalAmount", "sellerId" FROM invoices WHERE "clientName" ILIKE \'%remate%\';');
  console.log('Invoices remate:', r2.rows);

  const r3 = await c.query('SELECT folio, "clientName", date, "totalAmount", "sellerId" FROM invoices WHERE "clientName" ILIKE \'%mendoza%\';');
  console.log('Invoices mendoza:', r3.rows);

  const r4 = await c.query('SELECT folio, "clientName", date, "totalAmount", "sellerId" FROM invoices WHERE "clientName" ILIKE \'%rashel%\' OR "clientName" ILIKE \'%lidia%\';');
  console.log('Invoices rashel / lidia:', r4.rows);

  const r5 = await c.query('SELECT folio, "clientName", date, "totalAmount", "sellerId" FROM invoices WHERE "clientName" ILIKE \'%espina%\';');
  console.log('Invoices espina:', r5.rows);

  const r6 = await c.query('SELECT folio, "clientName", date, "totalAmount", "sellerId" FROM invoices WHERE "clientName" ILIKE \'%leonidas%\';');
  console.log('Invoices leonidas:', r6.rows);

  const r7 = await c.query('SELECT folio, "clientName", date, "totalAmount", "sellerId" FROM invoices WHERE "clientName" ILIKE \'%molina%\';');
  console.log('Invoices molina:', r7.rows);

  await c.end();
});
