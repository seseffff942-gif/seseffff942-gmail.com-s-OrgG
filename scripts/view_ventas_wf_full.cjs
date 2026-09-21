const { execFileSync } = require('child_process');

const py = `
import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT nodes, connections, active FROM workflow_entity WHERE id = 'xcs2SGXwl1jhznjI'")
row = c.fetchone()
nodes = json.loads(row[0])
conns = json.loads(row[1])
active = row[2]
print("ACTIVE:", active)
for n in nodes:
    print("NODE_NAME:", n.get('name'))
    print("NODE_TYPE:", n.get('type'))
    if n.get('name') == 'Evaluar Hora y Meta':
        print("JS_CODE:")
        print(n.get('parameters', {}).get('jsCode', ''))
    elif n.get('name') == 'Bifurcación (4 Casos)':
        print("SWITCH_PARAMS:")
        print(json.dumps(n.get('parameters', {}), indent=2))
    elif 'Evolution' in n.get('name', ''):
        print("HTTP_PARAMS:")
        print(json.dumps(n.get('parameters', {}), indent=2))
print("CONNECTIONS:")
print(json.dumps(conns, indent=2))
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
