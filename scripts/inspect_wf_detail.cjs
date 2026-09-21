const { execFileSync } = require('child_process');

const py = `
import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT id, name, nodes, connections FROM workflow_entity WHERE name LIKE '%ventas%' OR name LIKE '%reporte%'")
rows = c.fetchall()
for r in rows:
    wf_id, name, nodes_json, conn_json = r
    print(f"ID: {wf_id} | Name: {name}")
    nodes = json.loads(nodes_json)
    print("Nodes count:", len(nodes))
    for n in nodes:
        print(f" - {n.get('name')} ({n.get('type')})")
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
