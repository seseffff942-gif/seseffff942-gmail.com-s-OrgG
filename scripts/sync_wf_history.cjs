const { execFileSync } = require('child_process');

const py = `
import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()

# Get the latest nodes & connections from workflow_entity
c.execute("SELECT versionId, activeVersionId, nodes, connections, name FROM workflow_entity WHERE id = 'workflowCobros01'")
row = c.fetchone()
version_id, active_version_id, nodes_json, conns_json, name = row
print(f"workflow_entity: versionId={version_id}, activeVersionId={active_version_id}")

nodes = json.loads(nodes_json)
conns = json.loads(conns_json)
print(f"Nodes in workflow_entity: {len(nodes)}")

# Update workflow_history for both version_id and active_version_id
c.execute("""
    UPDATE workflow_history 
    SET nodes = ?, connections = ?, name = ?
    WHERE workflowId = 'workflowCobros01' AND versionId IN (?, ?)
""", (nodes_json, conns_json, name, version_id, active_version_id))

print(f"Updated rows in workflow_history: {c.rowcount}")
conn.commit()
conn.close()
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
