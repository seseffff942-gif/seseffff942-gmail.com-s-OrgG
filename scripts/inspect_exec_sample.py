import sqlite3, json, zlib

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT executionId, data FROM execution_data WHERE executionId = 1418")
row = c.fetchone()
if row:
    eid, data_raw = row
    print("Type of data_raw:", type(data_raw), "len:", len(data_raw) if data_raw else 0)
    data_str = data_raw.decode('utf-8', errors='ignore')
    print("Start of data_str:", data_str[:300])

