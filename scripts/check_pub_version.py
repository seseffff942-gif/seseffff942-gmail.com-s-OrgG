import sqlite3

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()

c.execute("PRAGMA table_info(workflow_published_version)")
print("Columns of workflow_published_version:", [col[1] for col in c.fetchall()])

c.execute("SELECT * FROM workflow_published_version")
rows = c.fetchall()
print(f"Total published versions: {len(rows)}")
for r in rows:
    print(r[0], r[1])

conn.close()
