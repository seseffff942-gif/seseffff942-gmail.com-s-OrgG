import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT executionId, data FROM execution_data WHERE executionId = 1418")
eid, data_str = c.fetchone()
data = json.loads(data_str)
print("Type of data:", type(data))
if isinstance(data, list):
    print("List len:", len(data))
    for i, item in enumerate(data[:3]):
        print(f"Item {i} type: {type(item)}, keys: {list(item.keys()) if isinstance(item, dict) else item}")
elif isinstance(data, dict):
    print("Keys:", list(data.keys()))

