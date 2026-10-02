import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()

c.execute("SELECT nodes, connections FROM workflow_entity WHERE id = 'workflowCobros01'")
row = c.fetchone()
nodes = json.loads(row[0])
conns = json.loads(row[1])

node_names = {n['name']: n for n in nodes}
print(f"Total nodes in nodes list: {len(node_names)}")

missing_targets = []
for source_node, conn_data in conns.items():
    if source_node not in node_names:
        print(f"⚠️ Source node in connections NOT in nodes list: '{source_node}'")
    for conn_type, conn_outputs in conn_data.items():
        for output_idx, target_list in enumerate(conn_outputs):
            for target in target_list:
                target_name = target.get('node')
                if target_name not in node_names:
                    print(f"❌ TARGET NOT FOUND: '{source_node}' -> '{target_name}'")
                    missing_targets.append((source_node, target_name))

if not missing_targets:
    print("✅ All connection targets exist in nodes list!")

conn.close()
