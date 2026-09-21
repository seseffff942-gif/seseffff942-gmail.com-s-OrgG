const { execFileSync } = require('child_process');

const py = `
import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT id, name, active, nodes FROM workflow_entity")
for row in c.fetchall():
    wfid, wfname, active, nodes_json = row
    nodes = json.loads(nodes_json)
    for idx, n in enumerate(nodes):
        code = n.get('parameters', {}).get('jsCode', '')
        if 'param_total_q' in code:
            print(f"FOUND IN: workflow {wfid} ({wfname}), node [{idx}] {n['name']} (active={active})")
            print("--- First 300 chars of code: ---")
            print(code[:300])
            print("--- Let's check ruta logic in this code: ---")
            for line in code.split('\\n'):
                if 'ruta' in line:
                    print("  ", line)
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
