const { execFileSync } = require('child_process');

const py = `
import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT data FROM execution_data WHERE executionId = 256")
d_row = c.fetchone()
d = json.loads(d_row[0])
print("d length:", len(d))
for i in range(min(5, len(d))):
    print(f"item {i} type:", type(d[i]))
    if isinstance(d[i], str):
        print(f"item {i} value:", d[i][:50])
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
