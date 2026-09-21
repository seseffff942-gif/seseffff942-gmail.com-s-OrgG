const { execFileSync } = require('child_process');

const py = `
import subprocess

# Query Herbert Argueta invoices for today 2026-09-18
cmd = [
    "docker", "exec", "evolution_postgres", "psql", "-U", "postgres", "-d", "agricovet_db", "-t", "-A", "-c",
    """SELECT id, folio, "clientName", "totalAmount", date 
       FROM invoices 
       WHERE ("sellerId" ILIKE '%gruas%' OR "sellerId" = '1521' OR "sellerId" = 'u4') 
         AND date >= '2026-09-18T00:00:00' 
         AND date <= '2026-09-18T23:59:59'
       ORDER BY date ASC;"""
]
res = subprocess.check_output(cmd, text=True)
print("Facturas de hoy (2026-09-18):")
print(res.strip() if res.strip() else "Ninguna factura hoy.")

cmd_total = [
    "docker", "exec", "evolution_postgres", "psql", "-U", "postgres", "-d", "agricovet_db", "-t", "-A", "-c",
    """SELECT count(*), COALESCE(SUM("totalAmount"), 0) 
       FROM invoices 
       WHERE ("sellerId" ILIKE '%gruas%' OR "sellerId" = '1521' OR "sellerId" = 'u4') 
         AND date >= '2026-09-18T00:00:00' 
         AND date <= '2026-09-18T23:59:59';"""
]
res_total = subprocess.check_output(cmd_total, text=True)
print("Totales hoy:", res_total.strip())
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
