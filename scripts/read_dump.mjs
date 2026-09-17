import { execFileSync } from 'child_process';

const pyCode = `
try:
    with open('/tmp/webhook_capture.txt', 'r', errors='ignore') as f:
        content = f.read()
        print("Capture length:", len(content))
        lines = content.split('\\n')
        for i, l in enumerate(lines):
            if 'whatsapp' in l or 'statuses' in l or 'errors' in l or 'C3BBEC1FF7269FC69' in l:
                print('\\n'.join(lines[max(0, i-5): min(len(lines), i+30)]))
                print('='*50)
except Exception as e:
    print('Error:', e)
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
