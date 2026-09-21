const { execFileSync } = require('child_process');

const py = `
import subprocess

script = """
try {
  const fs = require('fs');
  const b = fs.readFileSync('/data/boletas_guardadas/logo_ti_v2.jpg');
  console.log('Read success, bytes:', b.length);
} catch(e) {
  console.error('Error:', e.message);
}
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
