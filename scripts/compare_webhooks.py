import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()

c.execute("SELECT nodes FROM workflow_entity WHERE id = 'workflowCobros01'")
nodes = json.loads(c.fetchone()[0])

for n in nodes:
    if 'webhook' in n['type'].lower():
        print(f"\\n--- WEBHOOK NODE: {n['name']} ---")
        print(json.dumps(n, indent=2))

conn.close()
