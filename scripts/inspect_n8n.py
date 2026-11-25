import sqlite3
import json

conn = sqlite3.connect("/var/lib/docker/volumes/n8n_data/_data/database.sqlite")
c = conn.cursor()
c.execute("SELECT data FROM execution_data WHERE executionId=1292")
row = c.fetchone()
if row:
    raw = row[0]
    data = json.loads(raw)
    for i, item in enumerate(data):
        if isinstance(item, dict) and "caption" in item:
            print(f"data[{i}] caption:", repr(item["caption"]))
            idx = int(item["caption"])
            print("ACTUAL CAPTION TEXT:\n", data[idx])
