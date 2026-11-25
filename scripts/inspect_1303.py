import sqlite3
import json

conn = sqlite3.connect("/var/lib/docker/volumes/n8n_data/_data/database.sqlite")
c = conn.cursor()
c.execute("SELECT data FROM execution_data WHERE executionId=1303")
row = c.fetchone()
if row:
    raw = row[0]
    data = json.loads(raw)
    print("ACTUAL CAPTION IN 1303:\n", data[59])
