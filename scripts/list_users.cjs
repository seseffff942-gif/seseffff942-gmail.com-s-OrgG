const pg = require('pg');

async function main() {
  const client = new pg.Client({ connectionString: 'postgresql://postgres:postgres123@localhost:5432/postgres' });
  await client.connect();

  const users = await client.query('SELECT id, name, email, role FROM users;');
  console.log('--- USERS / SELLERS ---');
  users.rows.forEach(u => console.log(`${u.id} | ${u.name} | ${u.email} | ${u.role}`));

  await client.end();
}

main();
