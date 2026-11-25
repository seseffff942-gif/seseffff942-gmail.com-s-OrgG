import sqlite3, json, zlib

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT executionId, data FROM execution_data WHERE executionId IN (1418, 1419, 1420, 1421, 1422, 1423, 1424)")
for row in c.fetchall():
    eid, data_raw = row
    data_str = ""
    try:
        data_str = zlib.decompress(data_raw).decode('utf-8')
    except:
        try:
            data_str = data_raw.decode('utf-8')
        except:
            data_str = str(data_raw)
    data = json.loads(data_str) if data_str.startswith('{') else {}
    result_data = data.get('resultData', {})
    run_data = result_data.get('runData', {})
    print(f"=== EXECUTION {eid} ===")
    for node_name, node_runs in run_data.items():
        for run in node_runs:
            output = run.get('data', {}).get('main', [[]])[0]
            if output:
                first_item = output[0].get('json', {})
                nombre = first_item.get('nombreDestinatario') or first_item.get('param_nombre') or first_item.get('vendedor')
                tipo = first_item.get('tipoCorte') or first_item.get('tipoReporte') or first_item.get('tipo')
                to_phone = first_item.get('to_phone') or first_item.get('numero') or first_item.get('phone')
                caption = first_item.get('param_caption') or first_item.get('caption')
                ruta = first_item.get('ruta')
                print(f"  Node: {node_name} | Dest: {nombre} | Tipo: {tipo} | Ruta: {ruta} | Phone: {to_phone}")
                if caption:
                    print(f"    Caption: {repr(caption[:140])}")

