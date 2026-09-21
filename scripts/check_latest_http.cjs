const { execFileSync } = require('child_process');

const py = `
import subprocess

script = """
const sqlite3 = require('/usr/local/lib/node_modules/n8n/node_modules/sqlite3');
const { parse } = require('/usr/local/lib/node_modules/n8n/node_modules/flatted');
const db = new sqlite3.Database('/home/node/.n8n/database.sqlite');
db.get('SELECT executionId, data FROM execution_data ORDER BY executionId DESC LIMIT 1', (err, row) => {
  if (err || !row) return console.error(err);
  try {
    const full = parse(row.data);
    const runData = full.resultData.runData;
    console.log('Execution ID:', row.executionId);
    console.log('Nodes in runData:', Object.keys(runData));
    for (const k of Object.keys(runData)) {
      if (k.includes('WhatsApp')) {
        const outNode = runData[k];
        if (outNode && outNode[0] && outNode[0].data) {
          console.log(k + ' HTTP status:', outNode[0].data.main[0][0].json);
        }
      }
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
