import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()

c.execute("SELECT nodes FROM workflow_entity WHERE id = 'workflowCobros01'")
nodes = json.loads(c.fetchone()[0])

for n in nodes:
    if n['name'] in ['Evaluar Hora y Meta', 'Formatear Resumen de Rutas (WhatsApp)', 'WhatsApp 12PM Meta Cumplida', '📲 Enviar WhatsApp Rutas (Evolution API)']:
        print(f"\\n--- NODE: {n['name']} ---")
        print("Keys:", list(n.keys()))
        print("type:", n.get('type'), "typeVersion:", n.get('typeVersion'))
        print("disabled:", n.get('disabled'))

conn.close()
