import sqlite3, json

DB_PATH = '/var/lib/docker/volumes/n8n_data/_data/database.sqlite'
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.execute("SELECT versionId, activeVersionId, nodes, connections FROM workflow_entity WHERE id = 'workflowCobros01'")
row = c.fetchone()
version_id, active_version_id, nodes_json, conns_json = row
nodes = json.loads(nodes_json)

target_node_names = [
    "WhatsApp 12PM Meta Cumplida",
    "WhatsApp 12PM Meta No Cumplida",
    "WhatsApp 5PM Cierre Meta Cumplida",
    "WhatsApp 5PM Cierre Meta No Cumplida",
    "WhatsApp Semanal Meta Cumplida",
    "WhatsApp Semanal Meta No Cumplida"
]

send_media_body = """={{ JSON.stringify({
  number: $json.to_phone,
  mediatype: "image",
  mimetype: "image/jpeg",
  caption: $json.param_caption,
  media: $json.param_logo_base64 || $json.logoBase64
}) }}"""

for n in nodes:
    if n['name'] in target_node_names:
        n['parameters']['url'] = "http://evolution_api:8080/message/sendMedia/bot-recibos"
        n['parameters']['jsonBody'] = send_media_body
        print(f"Fixed {n['name']} jsonBody with actual newlines.")

# Save to workflow_entity
updated_nodes_json = json.dumps(nodes)
c.execute("UPDATE workflow_entity SET nodes = ? WHERE id = 'workflowCobros01'", (updated_nodes_json,))

# Save to workflow_history
c.execute("""
    UPDATE workflow_history 
    SET nodes = ?
    WHERE workflowId = 'workflowCobros01' AND versionId IN (?, ?)
""", (updated_nodes_json, version_id, active_version_id))

print(f"Updated workflow_history rows: {c.rowcount}")
conn.commit()
conn.close()
print("Fixed newlines successfully!")
