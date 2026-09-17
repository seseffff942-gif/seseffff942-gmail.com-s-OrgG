import sqlite3
import json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()

c.execute("SELECT nodes FROM workflow_entity WHERE id = 'workflowCobros01'")
row = c.fetchone()
nodes = json.loads(row[0])

ventas_nodes = [
    "Evaluar Hora y Meta",
    "Bifurcación (4 Casos)",
    "WhatsApp 12PM Meta Cumplida",
    "WhatsApp 12PM Meta No Cumplida",
    "WhatsApp 5PM Cierre Meta Cumplida",
    "WhatsApp 5PM Cierre Meta No Cumplida"
]

for n in nodes:
    if n.get('name') in ventas_nodes:
        print("====================================")
        print(f"NODE: {n.get('name')}")
        print(json.dumps(n.get('parameters'), indent=2))

