import sqlite3
import json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()

for eid in [213, 214, 215, 216, 217, 218, 219, 220, 221, 222]:
    c.execute("SELECT data FROM execution_data WHERE executionId = ?", (eid,))
    row = c.fetchone()
    if not row:
        continue
    data_str = row[0]
    # Simple search for to_phone, template name, etc.
    print(f"=== EXECUTION {eid} ===")
    for pattern in ["to_phone", "vendedor", "nombreDestinatario", "telefono", "template", "lastNodeExecuted", "error"]:
        idx = 0
        while True:
            idx = data_str.find(f'"{pattern}"', idx)
            if idx == -1:
                break
            snippet = data_str[max(0, idx-20): min(len(data_str), idx + 80)]
            print(f"  [{pattern}]: {snippet}")
            idx += len(pattern) + 2
            if idx > len(data_str) or True: # just first match per pattern
                break
