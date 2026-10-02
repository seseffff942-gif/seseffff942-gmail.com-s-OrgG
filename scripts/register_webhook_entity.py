import sqlite3

DB_PATH = '/var/lib/docker/volumes/n8n_data/_data/database.sqlite'
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.execute("PRAGMA table_info(webhook_entity)")
cols = c.fetchall()
print("Columns of webhook_entity:", [(col[1], col[2]) for col in cols])

# Check if row already exists
c.execute("SELECT * FROM webhook_entity WHERE webhookPath = 'rutas-visitas'")
existing = c.fetchall()
if not existing:
    c.execute("""
        INSERT INTO webhook_entity (workflowId, webhookPath, method, node, webhookId, pathLength)
        VALUES ('workflowCobros01', 'rutas-visitas', 'POST', '1c. Webhook Rutas y Visitas (rutas-visitas)', '1c-rutas-webhook-9999-aaaa', NULL)
    """)
    conn.commit()
    print("✅ Insertada entrada en webhook_entity para 'rutas-visitas'")
else:
    print("Ya existía entrada en webhook_entity")

c.execute("SELECT * FROM webhook_entity")
for r in c.fetchall():
    print(r)

conn.close()
