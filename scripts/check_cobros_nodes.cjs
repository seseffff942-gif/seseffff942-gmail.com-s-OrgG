const { execFileSync } = require('child_process');

const py = `
import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT nodes FROM workflow_entity WHERE id = 'workflowCobros01'")
nodes = json.loads(c.fetchone()[0])
for n in nodes:
    name = n['name']
    if 'resumen' in name.lower() or 'cobro' in name.lower() or '8' in name:
        print(f"Node: {name} (type: {n['type']})")
        params = n.get('parameters', {})
        if 'path' in params:
            print(f"  path: {params['path']}")
        if 'url' in params:
            print(f"  url: {params['url']}")
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
