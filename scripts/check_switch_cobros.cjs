const { execFileSync } = require('child_process');

const py = `
import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT nodes, connections FROM workflow_entity WHERE id = 'workflowCobros01'")
row = c.fetchone()
nodes = json.loads(row[0])
conns = json.loads(row[1])

for n in nodes:
    if 'Bifurcac' in n['name']:
        print("SWITCH RULES:")
        print(json.dumps(n.get('parameters', {}), indent=2))

print("SWITCH CONNS:")
for k, v in conns.items():
    if 'Bifurcac' in k:
        print(k, "->", json.dumps(v, indent=2))
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
