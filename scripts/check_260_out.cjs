const { execFileSync } = require('child_process');

const py = `
import subprocess

script = """
const sqlite3 = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const { parse } = require('/usr/local/lib/node_modules/n8n/node_modules/flatted');
const db = new sqlite3.Database('/home/node/.n8n/database.sqlite');
db.get('SELECT executionId, data FROM execution_data WHERE executionId = 260', (err, row) => {
  if (err || !row) return console.error(err);
  try {
    const full = parse(row.data);
    const nodeArr = full.resultData.runData['WhatsApp Semanal Meta No Cumplida'];
    console.log('nodeArr length:', nodeArr.length);
    console.log('nodeArr[0] keys:', Object.keys(nodeArr[0]));
    if (nodeArr[0].error) {
      console.log('Node error:', nodeArr[0].error);
    }
    if (nodeArr[0].data) {
      console.log('Node data keys:', Object.keys(nodeArr[0].data));
    }
  } catch(e) {
    console.error('Err:', e.message);
  }
});
"""

res = subprocess.run(["docker", "exec", "-i", "n8n", "node", "-e", script], capture_output=True, text=True)
print(res.stdout)
print(res.stderr)
`;

try {
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: py, encoding: 'utf-8' });
  console.log(out);
} catch (e) {
  console.error(e.message);
}
