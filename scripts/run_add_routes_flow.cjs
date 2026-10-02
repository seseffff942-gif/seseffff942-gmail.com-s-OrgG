const { execFileSync } = require('child_process');
const fs = require('fs');

const pyCode = fs.readFileSync('scripts/add_n8n_routes_flow.py', 'utf-8');

try {
  console.log('Aplicando nuevo flujo de rutas a n8n en el servidor...');
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: pyCode, encoding: 'utf-8' });
  console.log('Salida del servidor:\n', out);

  console.log('Reiniciando contenedor de n8n para aplicar cambios...');
  const restartOut = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'docker restart n8n'
  ], { encoding: 'utf-8' });
  console.log('n8n reiniciado:', restartOut);
} catch (e) {
  console.error('Error:', e.message);
}
