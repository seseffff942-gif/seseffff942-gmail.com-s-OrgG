import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT nodes, connections FROM workflow_entity WHERE id = 'workflowCobros01'")
nodes_json, conns_json = c.fetchone()
nodes = json.loads(nodes_json)
conns = json.loads(conns_json)

for n in nodes:
    if n['name'] == 'Evaluar Hora y Meta':
        print("=== EVALUAR HORA Y META JSCODE ===")
        print(n['parameters']['jsCode'])
    if 'switch' in n['type'].lower() or 'if' in n['type'].lower():
        print("=== SWITCH / IF NODE ===")
        print(n['name'], n['type'], json.dumps(n['parameters'], indent=2))

print("=== CONNECTIONS FROM Evaluar Hora y Meta ===")
print(conns.get('Evaluar Hora y Meta'))

