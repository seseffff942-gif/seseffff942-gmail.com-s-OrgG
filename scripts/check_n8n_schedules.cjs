const { execFileSync } = require('child_process');

const py = `
import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT id, name, active, nodes FROM workflow_entity")
for row in c.fetchall():
    wfid, wfname, active, nodes_json = row
    nodes = json.loads(nodes_json)
    for n in nodes:
        t = n.get('type', '')
        if 'schedule' in t.lower() or 'cron' in t.lower() or 'interval' in t.lower():
            print(f"Workflow '{wfname}' ({wfid}) active={active} has trigger: {n['name']} ({t})")
            print(json.dumps(n.get('parameters', {}), indent=2))
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
