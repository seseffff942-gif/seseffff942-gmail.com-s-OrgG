const { execFileSync } = require('child_process');

try {
  const query = 'SELECT * FROM login_tokens ORDER BY "createdAt" DESC LIMIT 5;';
  const cmd = `docker exec -i evolution_postgres psql -U postgres -d agricovet_db -c '${query}'`;
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    cmd
  ], { encoding: 'utf-8' });
  console.log(out);
} catch (e) {
  console.error(e.message);
}
