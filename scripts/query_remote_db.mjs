import { execFileSync } from 'child_process';

const sql = `
SELECT folio, "clientName", "totalAmount", "sellerId", date
FROM invoices 
WHERE LOWER("clientName") LIKE '%wilde%' OR LOWER("clientName") LIKE '%lemus%'
ORDER BY folio DESC;
`;

const cmd = `docker exec -i evolution_postgres psql -U postgres -d agricovet_db -c '${sql.replace(/'/g, "'\\''")}'`;

try {
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    cmd
  ], { encoding: 'utf-8' });
  console.log(out);
} catch (e) {
  console.error('Error:', e.message);
  if (e.stdout) console.log('STDOUT:', e.stdout);
  if (e.stderr) console.error('STDERR:', e.stderr);
}
