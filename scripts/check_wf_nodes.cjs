const { execFileSync } = require('child_process');

const py = `
import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()

for wfid in ['workflowCobros01', 'xcs2SGXwl1jhznjI']:
    c.execute("SELECT name, active, nodes FROM workflow_entity WHERE id = ?", (wfid,))
    row = c.fetchone()
    if not row:
        continue
    wfname, active, nodes_json = row
    nodes = json.loads(nodes_json)
    print(f"=== WORKFLOW {wfid} ({wfname}) active={active} ===")
    for idx, n in enumerate(nodes):
        if 'Evaluar' in n['name'] or 'Bifurcac' in n['name'] or 'Semanal' in n['name']:
            print(f"  [{idx}] {n['name']} (type: {n['type']})")
            if 'Evaluar' in n['name']:
                code = n.get('parameters', {}).get('jsCode', '')
                print(f"      Eval code preview: {code[:150]}...")
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
