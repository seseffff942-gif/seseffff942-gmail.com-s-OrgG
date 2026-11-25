import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT executionId, data FROM execution_data WHERE executionId = 1422")
eid, data_str = c.fetchone()
arr = json.loads(data_str)
for i, item in enumerate(arr):
    if isinstance(item, str) and ("CIERRE SEMANAL" in item or "CORTE" in item):
        print(f"Index {i}: {item[:200]}")
    elif isinstance(item, dict) and "param_caption" in item:
        cap = item["param_caption"]
        if isinstance(cap, int):
            cap = arr[cap]
        print(f"Found param_caption at index {i}: {str(cap)[:200]}")

