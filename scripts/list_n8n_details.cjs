const { execFileSync } = require('child_process');

try {
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    `python3 -c "
import sqlite3, json
conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
for row in c.execute('SELECT id, name FROM workflow_entity'):
    print(row[0], row[1])
"
`
  ], { encoding: 'utf-8' });
  console.log(out);
} catch (e) {
  console.error(e.message);
}

