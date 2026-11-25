import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
for target_id in [1422, 1423, 1424]:
    c.execute("SELECT executionId, data FROM execution_data WHERE executionId = ?", (target_id,))
    eid, data_str = c.fetchone()
    arr = json.loads(data_str)
    print(f"=== EXECUTION {eid} ===")
    for i, item in enumerate(arr):
        if isinstance(item, str) and "CIERRE SEMANAL" in item:
            print(f"  Caption: {item}")
        if isinstance(item, str) and ("50248234048" in item or "50241323037" in item or "50254743595" in item):
            print(f"  Phone string: {item}")

