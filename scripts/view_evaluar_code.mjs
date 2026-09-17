import { execFileSync } from 'child_process';

const pyCode = `
import sqlite3
import json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()

c.execute("SELECT nodes FROM workflow_entity WHERE id = 'workflowCobros01'")
row = c.fetchone()
nodes = json.loads(row[0])

for n in nodes:
    if n.get('name') == 'Evaluar Hora y Meta':
        print(n.get('parameters', {}).get('jsCode', ''))
`;

try {
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: pyCode, encoding: 'utf-8' });
  console.log(out);
} catch (e) {
  console.error(e);
}
