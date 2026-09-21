const { execFileSync } = require('child_process');

const py = `
import subprocess, json

res = subprocess.run(["docker", "inspect", "n8n"], capture_output=True, text=True)
data = json.loads(res.stdout)[0]
print("Env vars:")
for e in data['Config']['Env']:
    if 'DB' in e or 'DATABASE' in e or 'N8N' in e:
        print(" ", e)
print("Mounts:")
for m in data['Mounts']:
    print(" ", m['Source'], "->", m['Destination'])
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
