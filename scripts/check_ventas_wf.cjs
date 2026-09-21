const { execFileSync } = require('child_process');

const py = `
import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT name, nodes FROM workflow_entity WHERE name LIKE '%ventas%' OR name LIKE '%reporte%'")
rows = c.fetchall()
for r in rows:
    print('=== WORKFLOW:', r[0], '===')
    nodes = json.loads(r[1])
    for n in nodes:
        name = n.get('name', '')
        params = n.get('parameters', {})
        if 'Code' in n.get('type', '') or 'code' in params or 'jsCode' in params or 'sendText' in json.dumps(params):
            print('--- NODE:', name, '(', n.get('type'), ') ---')
            if 'jsCode' in params:
                print(params['jsCode'][:2000])
            elif 'text' in params:
                print(params['text'])
            elif 'jsonBody' in params:
                print(params['jsonBody'][:1500])
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
