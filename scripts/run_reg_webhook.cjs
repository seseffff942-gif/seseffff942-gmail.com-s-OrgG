const { execFileSync } = require('child_process');
const fs = require('fs');

const pyCode = fs.readFileSync('scripts/register_webhook_entity.py', 'utf-8');

try {
  console.log('Registrando webhook en n8n webhook_entity...');
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: pyCode, encoding: 'utf-8' });
  console.log(out);

  console.log('Reiniciando contenedor n8n...');
  execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'docker restart n8n'
  ]);
  console.log('n8n reiniciado con éxito.');
} catch (e) {
  console.error('Error:', e.message);
}
