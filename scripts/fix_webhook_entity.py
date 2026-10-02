import sqlite3

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()

c.execute("""
    UPDATE webhook_entity 
    SET webhookId = NULL, pathLength = NULL
    WHERE webhookPath = 'rutas-visitas'
""")
conn.commit()

c.execute("SELECT * FROM webhook_entity")
for r in c.fetchall():
    print(r)

conn.close()
