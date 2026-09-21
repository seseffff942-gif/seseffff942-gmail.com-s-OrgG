const { execFileSync } = require('child_process');

const py = `
import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("PRAGMA table_info(workflow_history)")
print("Columns of workflow_history:", [col[1] for col in c.fetchall()])

c.execute("SELECT versionId, workflowId, nodes FROM workflow_history WHERE versionId = '1c8296f7-4c70-4b28-8346-9eec46b4abf2'")
row = c.fetchone()
if row:
    nodes = json.loads(row[2])
    print(f"workflow_history has {len(nodes)} nodes for version {row[0]}")
    for n in nodes:
        if n['name'] == 'Evaluar Hora y Meta':
            print("jsCode in workflow_history:")
            print(n['parameters']['jsCode'][:300])
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
