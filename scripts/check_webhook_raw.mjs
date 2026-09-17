import { execFileSync } from 'child_process';

const pyCode = `
import subprocess
import json

# Let's write a small node script on the server or inspect docker logs for changes
logs = subprocess.check_output("docker logs agricovet-b-yd2pbk.1.5l005mpgxt7xlmexdvh9l1jmj --tail 500", shell=True, text=True)
print("Logs length:", len(logs))
# Find entries with 'whatsapp_business_account'
for line in logs.split('\\n'):
    if 'statuses' in line or 'errors' in line or 'status' in line or 'recipient_id' in line:
        print(line)
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
