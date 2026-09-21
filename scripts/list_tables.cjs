const pg = require('pg');
const c = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
c.connect().then(async () => {
  const r = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';");
  console.log('Tables in DB:', r.rows.map(x => x.table_name).join(', '));
  await c.end();
});
