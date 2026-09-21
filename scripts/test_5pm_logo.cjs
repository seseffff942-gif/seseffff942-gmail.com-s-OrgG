const { execFileSync } = require('child_process');

const pyScript = `
import urllib.request, json, base64

with open('/opt/evolution-api/boletas_guardadas/logo_ti_v2.jpg', 'rb') as f:
    logo_b64 = base64.b64encode(f.read()).decode('ascii')

payload = {
    "corte": "17:00",
    "tipoCorte": "cierre",
    "tipoReporte": "cierre",
    "esCierre": True,
    "hora": "17:00",
    "horaCorte": "17:00",
    "vendedor": "Herbert Argueta",
    "nombreDestinatario": "Herbert Argueta",
    "codigoAsesor": "1521",
    "cantidadFacturas": 0,
    "cantidadVendida": 0,
    "umbral": 8750.00,
    "cantidadFaltante": 8750.00,
    "alcanzoMeta": False,
    "telefono": "50248234048",
    "logoBase64": logo_b64
}

data = json.dumps(payload).encode('utf-8')
req = urllib.request.Request("http://localhost:5678/webhook/ventas-reporte", data=data, headers={"Content-Type": "application/json"}, method="POST")

try:
    with urllib.request.urlopen(req) as resp:
        print("5PM CUT WEBHOOK RESPONSE:", resp.status, resp.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code, e.read().decode('utf-8'))
except Exception as e:
    print("ERROR:", str(e))
`;

try {
  const out = execFileSync('ssh', [
    '-i', 'C:\\Users\\sesef\\.ssh\\id_ed25519',
    '-o', 'StrictHostKeyChecking=no',
    'root@185.166.39.49',
    'python3'
  ], { input: pyScript, encoding: 'utf-8' });
  console.log(out);
} catch (e) {
  console.error(e.message);
}
