const { execFileSync } = require('child_process');

const py = `
import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT nodes FROM workflow_entity WHERE id = 'xcs2SGXwl1jhznjI'")
row = c.fetchone()
nodes = json.loads(row[0])
for n in nodes:
    if n.get('name') == 'Evaluar Hora y Meta':
        code = n.get('parameters', {}).get('jsCode', '')
        for idx, line in enumerate(code.splitlines()):
            print(f"{idx+1}: {line}")
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
