import sqlite3, json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()
c.execute("SELECT executionId, data FROM execution_data WHERE executionId IN (1418, 1419, 1420, 1421, 1422, 1423, 1424)")
for eid, data_str in c.fetchall():
    data = json.loads(data_str)
    result_data = data.get('resultData', {})
    run_data = result_data.get('runData', {})
    print(f"=== EXECUTION {eid} ===")
    for node_name, runs in run_data.items():
        for r in runs:
            main_out = r.get('data', {}).get('main', [[]])
            if main_out and main_out[0]:
                item = main_out[0][0].get('json', {})
                print(f"  Node: {node_name}")
                for k in ['nombreDestinatario', 'param_nombre', 'tipoCorte', 'esSemanal', 'ruta', 'to_phone', 'param_caption']:
                    if k in item:
                        v = item[k]
                        if k == 'param_caption':
                            v = repr(str(v)[:100])
                        print(f"    {k}: {v}")

