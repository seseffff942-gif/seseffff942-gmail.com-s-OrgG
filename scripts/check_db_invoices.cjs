const { execSync } = require('child_process');
const pg = require('pg');

async function main() {
  console.log('Testing DB connections...');

  // Try 1: docker exec evolution_postgres
  try {
    const out = execSync('docker exec evolution_postgres psql -U postgres -d agricovet_db -t -c "SELECT count(*) FROM invoices;"', { encoding: 'utf-8' });
    console.log('Docker evolution_postgres count(*):', out.trim());
  } catch (e) {
    console.log('Docker evolution_postgres error:', e.message);
  }

  // Try 2: pg connection string options
  const connStrings = [
    'postgresql://postgres:postgres123@localhost:5432/postgres',
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    'postgresql://postgres:evolution_pass@localhost:5432/agricovet_db'
  ];

  for (const cs of connStrings) {
    try {
      const client = new pg.Client({ connectionString: cs });
      await client.connect();
      const res = await client.query('SELECT count(*) FROM invoices;');
      console.log(`Connected to ${cs}: count = ${res.rows[0].count}`);
      await client.end();
    } catch (e) {
      console.log(`Failed ${cs}: ${e.message}`);
    }
  }
}

main();
