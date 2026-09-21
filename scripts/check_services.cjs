const { execFileSync } = require('child_process');

const py = `
import subprocess

res = subprocess.run(["docker", "exec", "evolution_api", "curl", "-s", "http://localhost:8080/"], capture_output=True, text=True)
print("Evolution root:", res.stdout[:200])

res2 = subprocess.run(["docker", "ps", "--filter", "name=agricovet", "--format", "{{.Names}} {{.Ports}}"], capture_output=True, text=True)
print("Agricovet container:", res2.stdout)
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
