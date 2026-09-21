const { execFileSync } = require('child_process');

function runRemote(cmd) {
  return execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    cmd
  ], { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
}

try {
  // Check execution data for 244
  const query = "SELECT data FROM execution_data WHERE executionId = 244;";
  const out = runRemote(`sqlite3 /var/lib/docker/volumes/n8n_data/_data/database.sqlite "${query}"`);
  console.log('Execution 244 data length:', out.length);
  // Also check evolution api logs around 22:06:18
  const evoLogs = runRemote('docker logs --tail 30 evolution_api');
  console.log('Evo logs:\n', evoLogs);
} catch (e) {
  console.error('Error:', e.message);
}
