import { execFileSync } from 'child_process';

const pyCode = `
import json
import glob
import re

logs = glob.glob('/var/lib/docker/containers/*1487088faf26*/*-json.log')
if not logs:
    # find container
    import subprocess
    cid = subprocess.check_output("docker ps -q -f name=agricovet-b-yd2pbk", shell=True, text=True).strip()
    logs = glob.glob(f'/var/lib/docker/containers/{cid}*/*-json.log')

print("Found log file:", logs)
if logs:
    with open(logs[0], 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
        print(f"Total lines: {len(lines)}")
        # Search backwards for statuses
        found = 0
        for l in reversed(lines):
            if 'statuses' in l or 'recipient_id' in l or 'failed' in l or 'error' in l:
                try:
                    obj = json.loads(l)
                    log_msg = obj.get('log', '')
                    if 'whatsapp' in log_msg or 'statuses' in log_msg:
                        print("LOG:", log_msg.strip())
                        found += 1
                        if found > 15:
                            break
                except:
                    pass
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
