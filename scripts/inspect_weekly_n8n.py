import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT id, status, startedAt, stoppedAt FROM execution_entity ORDER BY id DESC LIMIT 20")
for row in c.fetchall():
    print(row)

