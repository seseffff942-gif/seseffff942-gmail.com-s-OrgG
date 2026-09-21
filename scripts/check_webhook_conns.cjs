const { execFileSync } = require('child_process');

const py = `
import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT connections FROM workflow_entity WHERE id = 'workflowCobros01'")
conns = json.loads(c.fetchone()[0])
for k, v in conns.items():
    if 'Webhook' in k or 'ventas' in k.lower() or 'evaluar' in k.lower():
        print(f"'{k}' -> {json.dumps(v)}")
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
