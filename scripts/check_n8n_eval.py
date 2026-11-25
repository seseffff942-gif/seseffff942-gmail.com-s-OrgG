import sqlite3
import json

conn = sqlite3.connect("/var/lib/docker/volumes/n8n_data/_data/database.sqlite")
c = conn.cursor()
c.execute("SELECT id, name, nodes FROM workflow_entity WHERE id='workflowCobros01'")
row = c.fetchone()
if row:
    print("Found workflow:", row[0], row[1])
    nodes = json.loads(row[2])
    for n in nodes:
        if n.get("name") == "Evaluar Hora y Meta":
            print("=== Evaluar Hora y Meta CODE ===")
            print(n.get("parameters", {}).get("jsCode"))

