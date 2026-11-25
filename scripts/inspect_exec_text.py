import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT executionId, data FROM execution_data WHERE executionId IN (1418, 1419, 1420, 1421, 1422, 1423, 1424) ORDER BY executionId ASC")
for eid, data_str in c.fetchall():
    print(f"=== EXECUTION {eid} ===")
    if "CIERRE SEMANAL" in data_str:
        print("  -> CONTAINS 'CIERRE SEMANAL'")
    if "CORTE DE LAS 5:00 PM" in data_str or "5:00 PM" in data_str:
        print("  -> CONTAINS '5:00 PM'")
    if "12:00 PM" in data_str:
        print("  -> CONTAINS '12:00 PM'")
    # Find WhatsApp node
    for target in ["WhatsApp 12PM Meta Cumplida", "WhatsApp 12PM Meta No Cumplida", "WhatsApp 5PM Cierre Meta Cumplida", "WhatsApp 5PM Cierre Meta No Cumplida", "WhatsApp Semanal Meta Cumplida", "WhatsApp Semanal Meta No Cumplida"]:
        if target in data_str:
            print(f"  -> Executed/Referenced: {target}")
    # Extract destination phone
    import re
    phones = set(re.findall(r'502\d{8}', data_str))
    print(f"  -> Phones found: {phones}")

