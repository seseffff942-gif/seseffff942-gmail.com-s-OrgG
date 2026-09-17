import { execFileSync } from 'child_process';

const pyCode = `
import sqlite3
import re

conn = sqlite3.connect('/var/lib/docker/volumes/n8n_data/_data/database.sqlite')
c = conn.cursor()

for eid in [213, 214, 215, 216, 217, 218, 219, 220, 221, 222]:
    c.execute('SELECT data FROM execution_data WHERE executionId = ?', (eid,))
    row = c.fetchone()
    if not row:
        print(f"EID {eid}: Not found")
        continue
    s = row[0]
    phone = re.search(r'"to_phone":"([^"]+)"', s)
    vend = re.search(r'"vendedor":"([^"]+)"', s)
    dest = re.search(r'"nombreDestinatario":"([^"]+)"', s)
    node = re.search(r'"lastNodeExecuted":"([^"]+)"', s)
    corte = re.search(r'"corte":"([^"]+)"', s)
    wamid = re.search(r'"id":"(wamid\.[^"]+)"', s)
    status = re.search(r'"message_status":"([^"]+)"', s)
    
    # Check if there was an error in the response
    err_fb = re.search(r'("error":\{[^}]+\})', s)

    print(f"EID {eid} | Corte: {corte.group(1) if corte else '?'} | Dest: {dest.group(1) if dest else '?'} | Tel: {phone.group(1) if phone else '?'} | Node: {node.group(1) if node else '?'} | Status: {status.group(1) if status else '?'} | WAMID: {wamid.group(1) if wamid else 'NONE'} | FB_Err: {err_fb.group(1) if err_fb else 'None'}")
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
