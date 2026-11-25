import sqlite3

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("PRAGMA table_info(execution_entity)")
for col in c.fetchall():
    print(col[1])

