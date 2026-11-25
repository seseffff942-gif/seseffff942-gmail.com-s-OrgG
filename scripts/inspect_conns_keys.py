import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT connections FROM workflow_entity WHERE id = 'workflowCobros01'")
conns_json = c.fetchone()[0]
conns = json.loads(conns_json)

for k in conns.keys():
    if 'Bifurca' in k or 'Evaluar' in k or 'WhatsApp' in k or 'Ventas' in k or '1b' in k:
        print(f"Key: {repr(k)} -> {conns[k]}")

