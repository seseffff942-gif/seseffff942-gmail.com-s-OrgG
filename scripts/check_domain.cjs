const { execFileSync } = require('child_process');

const py = `
import subprocess, json

res = subprocess.run(["docker", "inspect", "agricovet-b-yd2pbk.1.i0njxu98zs5grdfkh3j6r8wu7"], capture_output=True, text=True)
data = json.loads(res.stdout)[0]
labels = data.get('Config', {}).get('Labels', {})
for k, v in labels.items():
    print(f"{k} = {v}")
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
