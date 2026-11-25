import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT executionId, data FROM execution_data WHERE executionId = 1418")
eid, data_str = c.fetchone()
data = json.loads(data_str)
for i, elem in enumerate(data):
    if isinstance(elem, dict):
        for k, v in elem.items():
            if 'runData' in k or 'result' in k.lower():
                print(f"Elem {i} key {k}: type {type(v)}")
                if isinstance(v, dict):
                    print("  dict keys:", list(v.keys()))
                elif isinstance(v, str):
                    print("  str value:", v[:200])

