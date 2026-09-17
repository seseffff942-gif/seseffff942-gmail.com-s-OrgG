import { execFileSync } from 'child_process';

const pyCode = `
import sqlite3
import json

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()

def unflatten(raw_str):
    arr = json.loads(raw_str)
    if not isinstance(arr, list):
        return arr
    
    memo = {}
    def resolve(idx):
        if idx in memo:
            return memo[idx]
        val = arr[idx]
        if isinstance(val, dict):
            res = {}
            memo[idx] = res
            for k, v in val.items():
                if isinstance(v, str) and v.isdigit() and int(v) < len(arr):
                    res[k] = resolve(int(v))
                else:
                    res[k] = v
            return res
        elif isinstance(val, list):
            res = []
            memo[idx] = res
            for item in val:
                if isinstance(item, str) and item.isdigit() and int(item) < len(arr):
                    res.append(resolve(int(item)))
                else:
                    res.append(item)
            return res
        else:
            memo[idx] = val
            return val

    return resolve(0)

for eid in [213, 214, 215, 216, 217, 218, 219, 220, 221, 222]:
    c.execute('SELECT data FROM execution_data WHERE executionId = ?', (eid,))
    row = c.fetchone()
    if not row: continue
    try:
        data = unflatten(row[0])
        # Find runData
        runData = data.get('resultData', {}).get('runData', {})
        lastNode = data.get('resultData', {}).get('lastNodeExecuted', '')
        
        # Webhook input
        webhook_data = runData.get('Webhook Ventas', [{}])[0].get('data', {}).get('main', [[{}]])[0][0].get('json', {}).get('body', {})
        
        # Output of last node
        last_node_data = runData.get(lastNode, [{}])[0].get('data', {}).get('main', [[{}]])[0][0].get('json', {})
        
        print(f"=== EID {eid} ===")
        print(f"  Vendedor: {webhook_data.get('vendedor')} | Tel: {webhook_data.get('telefono')} | Corte: {webhook_data.get('corte')} | Total: {webhook_data.get('cantidadVendida')}")
        print(f"  Node Executed: {lastNode}")
        print(f"  Response: {json.dumps(last_node_data)}")
    except Exception as e:
        print(f"  EID {eid} Error parsing: {e}")
`;

try {
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: pyCode, encoding: 'utf-8' });
  console.log(out);
} catch (e) {
  console.error(e);
}
