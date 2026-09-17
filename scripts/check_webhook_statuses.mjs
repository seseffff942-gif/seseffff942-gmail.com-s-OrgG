import { execFileSync } from 'child_process';

const pyCode = `
import subprocess

logs = subprocess.check_output("docker logs agricovet-b-yd2pbk.1.5l005mpgxt7xlmexdvh9l1jmj --tail 1000", shell=True, text=True)
lines = logs.split('\\n')
for i, l in enumerate(lines):
    if 'Webhook received:' in l:
        print('\\n'.join(lines[i:i+25]))
        print('='*50)
`;

try {
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: pyCode, encoding: 'utf-8' });
  console.log(out.slice(-4000));
} catch (e) {
  console.error(e);
}
