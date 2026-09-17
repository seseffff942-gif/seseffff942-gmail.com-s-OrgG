import { execFileSync } from 'child_process';

const pyCode = `
import subprocess

out = subprocess.check_output(
    ["docker", "exec", "evolution_postgres", "psql", "-U", "postgres", "-d", "agricovet_db", "-t", "-c", "SELECT photo FROM users WHERE id = 'sys-print-template';"],
    text=True
)
print("sys-print-template length:", len(out.strip()))
if len(out.strip()) > 0:
    print(out.strip()[:500])
else:
    print("EMPTY OR NULL")
`;

try {
  const res = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: pyCode, encoding: 'utf-8' });
  console.log(res);
} catch (e) {
  console.error(e);
}
