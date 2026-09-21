const { execFileSync } = require('child_process');

const py = `
import subprocess

cmd = [
    "docker", "exec", "evolution_postgres", "psql", "-U", "postgres", "-d", "agricovet_db", "-t", "-A", "-c",
    "SELECT count(*), COALESCE(SUM(\\"totalAmount\\"), 0) FROM invoices WHERE (\\\"sellerId\\\" ILIKE '%gruas%' OR \\\"sellerId\\\" = '1521' OR \\\"sellerId\\\" = 'u4') AND date >= '2026-09-14T00:00:00' AND date <= '2026-09-19T23:59:59';"
]
res = subprocess.check_output(cmd, text=True)
print('Ventas semana actual (14 al 19 Sep):', res.strip())

cmd2 = [
    "docker", "exec", "evolution_postgres", "psql", "-U", "postgres", "-d", "agricovet_db", "-t", "-A", "-c",
    "SELECT id, folio, \\"clientName\\", \\"totalAmount\\", date FROM invoices WHERE (\\\"sellerId\\\" ILIKE '%gruas%' OR \\\"sellerId\\\" = '1521' OR \\\"sellerId\\\" = 'u4') ORDER BY date DESC LIMIT 5;"
]
res2 = subprocess.check_output(cmd2, text=True)
print("Ultimas 5 facturas:\\n" + res2.strip())
`;

try {
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: py, encoding: 'utf-8' });
  console.log(out);
} catch (e) {
  console.error(e.message);
}
