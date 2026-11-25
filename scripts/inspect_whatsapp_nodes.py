import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT nodes FROM workflow_entity WHERE id = 'workflowCobros01'")
nodes_json = c.fetchone()[0]
nodes = json.loads(nodes_json)

for n in nodes:
    if 'WhatsApp' in n['name']:
        print(f"=== NODE: {n['name']} ===")
        print(json.dumps(n['parameters'], indent=2))

