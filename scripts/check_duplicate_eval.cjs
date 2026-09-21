const { execFileSync } = require('child_process');

const py = `
import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT nodes FROM workflow_entity WHERE id = 'workflowCobros01'")
nodes = json.loads(c.fetchone()[0])
found = []
for idx, n in enumerate(nodes):
    if n['name'] == 'Evaluar Hora y Meta':
        found.append((idx, n['id'], n['parameters']['jsCode'][:100]))
print(f"Total matching 'Evaluar Hora y Meta': {len(found)}")
for f in found:
    print(f)
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
