import sqlite3
import json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()

c.execute("SELECT id, name, nodes, connections FROM workflow_entity WHERE id = 'workflowCobros01'")
row = c.fetchone()
if not row:
    print("Not found")
    exit()

wid, wname, nodes_raw, conn_raw = row
nodes = json.loads(nodes_raw)
print(f"Workflow: {wname} ({wid})")
print("=== NODES ===")
for n in nodes:
    print(f"- Node: {n.get('name')} | Type: {n.get('type')}")
    if 'parameters' in n:
        params = n['parameters']
        # print some relevant params
        if 'url' in params or 'path' in params or 'template' in params or 'operation' in params:
            print(f"    params: {json.dumps({k: params[k] for k in ['url', 'path', 'template', 'operation', 'rule'] if k in params})}")

print("\n=== CONNECTIONS ===")
print(conn_raw)
