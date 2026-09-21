const { execFileSync } = require('child_process');

const py = `
import urllib.request, json, base64

# Read logo_ti_v2 image from disk or create small test
# First let's check evolution api sendMedia documentation or test small base64
small_png = b"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
payload = {
    "number": "50248234048",
    "mediatype": "image",
    "mimetype": "image/png",
    "caption": "Test logo",
    "media": small_png.decode('ascii')
}

req = urllib.request.Request(
    "http://localhost:8080/message/sendMedia/bot-recibos",
    data=json.dumps(payload).encode('utf-8'),
    headers={
        "apikey": "B6D711FCDE4D4FD5936544120E713976",
        "Content-Type": "application/json"
    },
    method="POST"
)

try:
    with urllib.request.urlopen(req) as resp:
        print("Status:", resp.status)
        print("Response:", resp.read().decode('utf-8')[:300])
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.read().decode('utf-8'))
except Exception as e:
    print("Error:", str(e))
`;

try {
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: py, encoding: 'utf-8' });
  console.log(out);
} catch (e) {
  console.error(e.message);
}
