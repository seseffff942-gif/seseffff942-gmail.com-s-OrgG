const { execFileSync } = require('child_process');

const pyScript = `
import urllib.request, json, base64

with open('/opt/evolution-api/boletas_guardadas/logo_ti_v2.jpg', 'rb') as f:
    logo_b64 = base64.b64encode(f.read()).decode('ascii')

payload = {
    "esSemanal": True,
    "tipoCorte": "semanal",
    "tipoReporte": "semanal",
    "vendedor": "Herbert Argueta",
    "codigoAsesor": "1521",
    "periodo": "Lunes 14/09/2026 al Sábado 19/09/2026",
    "cantidadFacturas": 7,
    "cantidadVendida": 24849.85,
    "umbral": 52500.00,
    "cantidadFaltante": 27650.15,
    "alcanzoMeta": False,
    "porcentajeCumplimiento": "47.3",
    "telefono": "50248234048",
    "logoBase64": logo_b64,
    "ventas": [
      { "folio": "1162", "fecha": "2026-09-14", "monto": 14222.83, "cliente": "Alex García (Agroveterinaria Bances)" },
      { "folio": "1163", "fecha": "2026-09-16", "monto": 2418.50, "cliente": "Pablo Aroche (Distribuidora Bello Progreso)" },
      { "folio": "1167", "fecha": "2026-09-16", "monto": 1211.00, "cliente": "Delvin Flores (Agroservicios Nissi)" },
      { "folio": "1169", "fecha": "2026-09-17", "monto": 2624.00, "cliente": "Edy Rosales (Agroveterinaria El Finquero)" },
      { "folio": "1170", "fecha": "2026-09-17", "monto": 1179.00, "cliente": "Leonardo González (Agroveterinaria El Éxito)" },
      { "folio": "1171", "fecha": "2026-09-17", "monto": 974.52, "cliente": "Copropiedad Peláez (Agroveterinaria Eben Ezer)" },
      { "folio": "1173", "fecha": "2026-09-17", "monto": 2220.00, "cliente": "Juan Pineda (Agro Mi Arlet)" }
    ]
}

data = json.dumps(payload).encode('utf-8')
req = urllib.request.Request("http://localhost:5678/webhook/ventas-reporte", data=data, headers={"Content-Type": "application/json"}, method="POST")

try:
    with urllib.request.urlopen(req) as resp:
        print("WEBHOOK RESPONSE:", resp.status, resp.read().decode('utf-8'))
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
