import { execSync } from 'child_process';

const ids = [213, 214, 215, 216, 217, 218, 219, 220, 221, 222];

for (const id of ids) {
  const cmd = `sqlite3 /var/lib/docker/volumes/n8n_data/_data/database.sqlite "SELECT data FROM execution_data WHERE executionId = ${id};"`;
  const sshCmd = `ssh -n -i "C:\\Users\\sesef\\.ssh\\id_ed25519" -o StrictHostKeyChecking=no root@185.166.39.49 "${cmd.replace(/"/g, '\\"')}"`;
  try {
    const raw = execSync(sshCmd, { encoding: 'utf-8' });
    // Search for recipient name, phone, message and meta response in raw json
    const nameMatch = raw.match(/"nombreDestinatario":"([^"]+)"/);
    const phoneMatch = raw.match(/"telefono":"([^"]+)"/);
    const nodeMatch = raw.match(/"lastNodeExecuted":"([^"]+)"/);
    const statusMatch = raw.match(/"message_status":"([^"]+)"/);
    const corteMatch = raw.match(/"corte":"([^"]+)"/);
    const timeMatch = raw.match(/"startTime":([0-9]+)/);
    const timeStr = timeMatch ? new Date(Number(timeMatch[1])).toISOString() : '';

    console.log(`Execution ${id} [${timeStr}]: Corte: ${corteMatch?.[1]} | Destinatario: ${nameMatch?.[1]} | Tel: ${phoneMatch?.[1]} | LastNode: ${nodeMatch?.[1]} | Status: ${statusMatch?.[1]}`);
    
    // Check if error
    if (raw.includes('error') || raw.includes('Error') || raw.includes('failed') || raw.includes('rejected')) {
      const errMatches = raw.match(/"message":"([^"]+)"/g);
      console.log(`  -> Potential messages:`, errMatches?.slice(0, 5));
    }
  } catch (e) {
    console.error(`Error for ${id}:`, e.message);
  }
}
