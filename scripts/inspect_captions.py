import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT executionId, data FROM execution_data WHERE executionId IN (1421, 1422, 1423, 1424) ORDER BY executionId ASC")
for eid, data_str in c.fetchall():
    print(f"==================== EXECUTION {eid} ====================")
    # Search for param_caption or textoWhatsApp
    try:
        import re
        match = re.search(r'"param_caption":"(.*?)"(?:,"|\})', data_str)
        if match:
            print("CAPTION:")
            print(match.group(1).encode().decode('unicode-escape'))
        else:
            match2 = re.search(r'"textoWhatsApp":"(.*?)"(?:,"|\})', data_str)
            if match2:
                print("TEXTO WHATSAPP:")
                print(match2.group(1).encode().decode('unicode-escape'))
    except Exception as ex:
        print("Error extracting:", ex)

