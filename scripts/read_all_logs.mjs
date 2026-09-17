import { execFileSync } from 'child_process';

const pyCode = `
with open('/var/lib/docker/containers/1487088faf26199d43106311e8314bd283d899f17417c6add51deb8df68a286d/1487088faf26199d43106311e8314bd283d899f17417c6add51deb8df68a286d-json.log', 'r') as f:
    for line in f:
        print(line.strip())
`;

try {
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: pyCode, encoding: 'utf-8' });
  console.log(out);
} catch (e) {
  console.error(e);
}
