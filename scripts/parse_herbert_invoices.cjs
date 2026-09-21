const { execFileSync } = require('child_process');

const py = `
import subprocess
import json

cmd = [
    "docker", "exec", "evolution_postgres", "psql", "-U", "postgres", "-d", "agricovet_db", "-t", "-A", "-c",
    """SELECT json_agg(t) FROM (
        SELECT id, folio, \\"clientName\\", \\"totalAmount\\", \\"paidAmount\\", status, date
        FROM invoices 
        WHERE (\\\"sellerId\\\" ILIKE '%gruas%' OR \\\"sellerId\\\" = '1521' OR \\\"sellerId\\\" = 'u4')
          AND date >= '2026-09-14T00:00:00' 
          AND date <= '2026-09-19T23:59:59'
          AND status != 'cancelled' AND status != 'rejected'
        ORDER BY date ASC
    ) t;"""
]
raw = subprocess.check_output(cmd, text=True).strip()
invoices = json.loads(raw)

total_vendido = sum(float(i.get('totalAmount') or 0) for i in invoices)
total_cobrado = sum(float(i.get('paidAmount') or 0) for i in invoices)
count = len(invoices)

print(f"COUNT: {count}")
print(f"TOTAL_VENDIDO: {total_vendido:.2f}")
print(f"TOTAL_COBRADO: {total_cobrado:.2f}")
for inv in invoices:
    folio = inv.get('folio') or 'S/F'
    cliente = inv.get('clientName') or 'Sin Nombre'
    total = float(inv.get('totalAmount') or 0)
    date = (inv.get('date') or '')[:10]
    print(f"- Folio #{folio} | {date} | Q{total:,.2f} | {cliente}")
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
