const { execFileSync } = require('child_process');

const py = `
import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("PRAGMA table_info(workflow_published_version)")
print("Columns of workflow_published_version:", [col[1] for col in c.fetchall()])
c.execute("SELECT * FROM workflow_published_version")
rows = c.fetchall()
print("Total rows:", len(rows))
for r in rows:
    print(r[:4])
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
