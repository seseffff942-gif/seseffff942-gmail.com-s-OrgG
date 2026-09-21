const { execFileSync } = require('child_process');

const py = `
import subprocess, json

res = subprocess.run(["docker", "inspect", "evolution_api"], capture_output=True, text=True)
data = json.loads(res.stdout)[0]
networks = data.get('NetworkSettings', {}).get('Networks', {})
print("Evolution networks:", list(networks.keys()))

res2 = subprocess.run(["docker", "inspect", "n8n"], capture_output=True, text=True)
data2 = json.loads(res2.stdout)[0]
networks2 = data2.get('NetworkSettings', {}).get('Networks', {})
print("n8n networks:", list(networks2.keys()))
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
