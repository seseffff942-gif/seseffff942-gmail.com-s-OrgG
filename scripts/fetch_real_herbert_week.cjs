const { execFileSync } = require('child_process');

const py = `
import subprocess
import json

# 1. User info
user_cmd = [
    "docker", "exec", "evolution_postgres", "psql", "-U", "postgres", "-d", "agricovet_db", "-t", "-A", "-c",
    "SELECT row_to_json(u) FROM (SELECT id, name, \\"sellerCode\\", email, phone, role FROM users WHERE email ILIKE '%gruas%' OR \\"sellerCode\\" = '1521') u;"
]
user_json = subprocess.check_output(user_cmd, text=True).strip()
print("USER DATA:")
print(user_json)

# 2. Invoices this week (14 al 19 Sep 2026)
inv_cmd = [
    "docker", "exec", "evolution_postgres", "psql", "-U", "postgres", "-d", "agricovet_db", "-t", "-A", "-c",
    """SELECT json_agg(t) FROM (
        SELECT id, folio, \\"clientName\\", \\"totalAmount\\", \\"paidAmount\\", status, date, items, \\"sellerId\\" 
        FROM invoices 
        WHERE (\\\"sellerId\\\" ILIKE '%gruas%' OR \\\"sellerId\\\" = '1521' OR \\\"sellerId\\\" = 'u4')
          AND date >= '2026-09-14T00:00:00' 
          AND date <= '2026-09-19T23:59:59'
          AND status != 'cancelled' AND status != 'rejected'
        ORDER BY date ASC
    ) t;"""
]
inv_json = subprocess.check_output(inv_cmd, text=True).strip()
print("INVOICES THIS WEEK:")
print(inv_json)
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
