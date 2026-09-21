const { execFileSync } = require('child_process');

const py = `
import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT nodes FROM workflow_entity WHERE id = 'workflowCobros01'")
nodes = json.loads(c.fetchone()[0])
for n in nodes:
    code = n.get('parameters', {}).get('jsCode', '')
    if 'boletas_guardadas' in code or 'fs' in code:
        print(f"Node '{n['name']}' has fs/boletas_guardadas:")
        print(code[:200])
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
