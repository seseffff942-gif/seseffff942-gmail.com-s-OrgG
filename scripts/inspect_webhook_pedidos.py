import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT nodes, connections FROM workflow_entity WHERE id = 'workflowCobros01'")
nodes, conns = c.fetchone()
nodes = json.loads(nodes)
conns = json.loads(conns)

for n in nodes:
    if "pedidos" in json.dumps(n).lower():
        print("NODE:", n.get("name"), n.get("type"))
        print("PARAMS:", json.dumps(n.get("parameters"), indent=2))

for src, targets in conns.items():
    if "pedidos" in src.lower() or "pedidos" in json.dumps(targets).lower():
        print(f"CONN: {src} -> {targets}")

