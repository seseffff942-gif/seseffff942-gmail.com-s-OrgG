const { execFileSync } = require('child_process');

const py = `
import subprocess

# Test if n8n code node has fs access or throws
script = """
const { NodeVM } = require('/usr/local/lib/node_modules/n8n/node_modules/vm2');
// n8n v1 uses standard vm or isolated-vm or vm2
console.log('Testing n8n code sandbox...');
"""
res = subprocess.run(["docker", "exec", "-i", "n8n", "node", "-e", script], capture_output=True, text=True)
print(res.stdout, res.stderr)
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
