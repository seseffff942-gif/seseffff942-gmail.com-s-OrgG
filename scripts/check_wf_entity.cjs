const { execFileSync } = require('child_process');

const py = `
import sqlite3

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("PRAGMA table_info(workflow_entity)")
print("Columns of workflow_entity:", [col[1] for col in c.fetchall()])
c.execute("SELECT id, name, active, versionId FROM workflow_entity")
for r in c.fetchall():
    print(r)
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
