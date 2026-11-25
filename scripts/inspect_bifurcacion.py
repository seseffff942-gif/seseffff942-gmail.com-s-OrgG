import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT connections FROM workflow_entity WHERE id = 'workflowCobros01'")
conns_json = c.fetchone()[0]
conns = json.loads(conns_json)

print("Connections from Bifurcación (4 Casos):")
print(json.dumps(conns.get('Bifurcación (4 Casos)'), indent=2))

