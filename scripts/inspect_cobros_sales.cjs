const { execFileSync } = require('child_process');

const py = `
import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("UPDATE workflow_entity SET active = 0 WHERE id = 'xcs2SGXwl1jhznjI'")
conn.commit()

c.execute("SELECT nodes, connections FROM workflow_entity WHERE id = 'workflowCobros01'")
row = c.fetchone()
nodes = json.loads(row[0])
conns = json.loads(row[1])

for n in nodes:
    if 'Ventas' in n['name'] or 'Meta' in n['name'] or 'Bifurcac' in n['name']:
        print(f"Node: {n['name']} ({n['type']})")
        if 'jsCode' in n.get('parameters', {}):
            print("--- CODE ---")
            print(n['parameters']['jsCode'][:1500])
        elif 'sendText' in json.dumps(n.get('parameters', {})):
            print("--- SEND TEXT ---")
            print(json.dumps(n['parameters'], indent=2))

print("CONNS for sales:")
for k, v in conns.items():
    if 'Ventas' in k or 'Meta' in k or 'Bifurcac' in k:
        print(k, "->", v)
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
