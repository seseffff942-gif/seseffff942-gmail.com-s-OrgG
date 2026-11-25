import sqlite3
import json

conn = sqlite3.connect("/var/lib/docker/volumes/n8n_data/_data/database.sqlite")
c = conn.cursor()
c.execute("SELECT id, status, createdAt FROM execution_entity WHERE createdAt >= '2026-11-03' ORDER BY id ASC")
rows = c.fetchall()
print(f"Total executions today: {len(rows)}")
for r in rows:
    print(r)

