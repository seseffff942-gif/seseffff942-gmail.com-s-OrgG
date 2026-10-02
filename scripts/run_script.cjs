const { execFileSync } = require('child_process');
const fs = require('fs');

const file = process.argv[2];
const pyCode = fs.readFileSync(file, 'utf-8');

try {
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: pyCode, encoding: 'utf-8' });
  console.log(out);
} catch (e) {
  console.error(e.message);
}
