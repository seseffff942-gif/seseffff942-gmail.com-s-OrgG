import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT executionId, data FROM execution_data WHERE executionId IN (1418, 1419, 1420, 1421, 1422, 1423, 1424) ORDER BY executionId ASC")
for eid, data_str in c.fetchall():
    data = json.loads(data_str)
    # Search for any dictionary that contains runData or resultData
    run_data = {}
    for elem in data:
        if isinstance(elem, dict):
            if 'runData' in elem:
                run_data = elem['runData']
                break
            if 'resultData' in elem and 'runData' in elem['resultData']:
                run_data = elem['resultData']['runData']
                break
    
    print(f"=== EXECUTION {eid} ===")
    for node_name, runs in run_data.items():
        if 'Webhook' in node_name or 'Evaluar' in node_name or 'WhatsApp' in node_name:
            for r in runs:
                main_out = r.get('data', {}).get('main', [[]])
                if main_out and main_out[0]:
                    item = main_out[0][0].get('json', {})
                    nombre = item.get('nombreDestinatario') or item.get('param_nombre') or item.get('vendedor')
                    tipo = item.get('tipoCorte') or item.get('tipoReporte') or item.get('tipo')
                    to_phone = item.get('to_phone') or item.get('numero') or item.get('phone')
                    caption = item.get('param_caption') or item.get('caption')
                    ruta = item.get('ruta')
                    esSem = item.get('esSemanal')
                    print(f"  Node: {node_name} | Dest: {nombre} | Tipo: {tipo} | esSemanal: {esSem} | Ruta: {ruta} | Phone: {to_phone}")
                    if caption:
                        print(f"    Caption: {repr(str(caption)[:140])}")

