import sqlite3

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
for t in c.fetchall():
    print(t[0])

