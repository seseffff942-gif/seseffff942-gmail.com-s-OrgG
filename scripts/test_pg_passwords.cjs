const { execSync } = require('child_process');

const passwords = [
  'postgres',
  'admin',
  'root',
  '1234',
  '123456',
  '12345678',
  'password',
  'agricovet',
  'sesef',
  'sql',
  'masterkey',
  '12345'
];

let workingPass = null;

for (const p of passwords) {
  try {
    const out = execSync(
      `"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe" -U postgres -p 5432 -d postgres -c "SELECT 1;"`,
      {
        env: { ...process.env, PGPASSWORD: p },
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );
    console.log(`✅ Success! Connected with password: ${p}`);
    workingPass = p;
    break;
  } catch (err) {
    // console.log(`Failed: ${p}`);
  }
}

if (workingPass) {
  try {
    const list = execSync(
      `"C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe" -U postgres -p 5432 -d postgres -c "\\l"`,
      {
        env: { ...process.env, PGPASSWORD: workingPass },
        encoding: 'utf8'
      }
    );
    console.log('\nDatabases list:\n', list);
  } catch (e) {
    console.error('Error listing DBs:', e.message);
  }
} else {
  console.log('❌ Could not connect with common default passwords.');
}
