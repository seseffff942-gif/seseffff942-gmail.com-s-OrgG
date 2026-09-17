import { execFileSync } from 'child_process';

const bashScript = process.argv[2] || 'docker ps';
try {
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'bash'
  ], { input: bashScript, encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 });
  console.log(out);
} catch (e) {
  console.error('Error:', e.message);
  if (e.stdout) console.log('STDOUT:', e.stdout);
  if (e.stderr) console.error('STDERR:', e.stderr);
}
