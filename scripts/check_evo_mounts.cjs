const { execFileSync } = require('child_process');

const py = `
import subprocess, json

res = subprocess.run(["docker", "inspect", "evolution_api"], capture_output=True, text=True)
data = json.loads(res.stdout)[0]
print("Mounts of evolution_api:")
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
