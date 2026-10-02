import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()

c.execute("SELECT id, status, mode, createdAt, startedAt, stoppedAt FROM execution_entity ORDER BY id DESC LIMIT 5")
rows = c.fetchall()
print("Recent executions:", rows)

if rows:
    last_id = rows[0][0]
    c.execute("SELECT data FROM execution_data WHERE executionId = ?", (last_id,))
    ed = c.fetchone()
    if ed:
        print(f"\\nExecution {last_id} data:")
        try:
            print(json.dumps(json.loads(ed[0]), indent=2)[:1000])
        except:
            print(ed[0][:1000])

conn.close()
