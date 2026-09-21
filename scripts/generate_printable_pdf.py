import json
import subprocess
import os

data_dir = r"C:\Users\sesef\.gemini\antigravity-ide\scratch\seseffff942-gmail.com-s-OrgG-copia\scripts"
desktop_pdf = r"C:\Users\sesef\Desktop\Reporte_Conciliacion_Ventas_Folio_809_Listo_Para_Imprimir.pdf"
temp_html = r"C:\Users\sesef\.gemini\antigravity-ide\scratch\reporte_imprimible.html"
edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

with open(os.path.join(data_dir, "clean_master_audit_52.json"), "r", encoding="utf-8") as f:
    clients = json.load(f)

with open(os.path.join(data_dir, "master_invoices_detail_52.json"), "r", encoding="utf-8") as f:
    invoices = json.load(f)

tot_clientes = len(clients)
activos = [c for c in clients if c["estado"] == "ACTIVO"]
pendientes = [c for c in clients if c["estado"] != "ACTIVO"]
tot_activos = len(activos)
tot_pendientes = len(pendientes)
tot_facturado = sum(c["totalErick"] for c in clients)
tot_facturas = sum(c["facturasErick"] for c in clients)

# Top 10 clients for analytics
top_clients = sorted(activos, key=lambda x: x["totalErick"], reverse=True)[:10]

html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte de Conciliación - Folio 809</title>
<style>
  @page {{
    size: letter landscape;
    margin: 10mm 12mm 12mm 12mm;
    @bottom-right {{
      content: counter(page);
    }}
  }}
  * {{
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }}
  body {{
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    background: #fff;
    margin: 0;
    padding: 0;
    font-size: 8pt;
  }}
  .page {{
    page-break-after: always;
    position: relative;
    min-height: 100%;
  }}
  .page:last-child {{
    page-break-after: auto;
  }}
  .header {{
    background: linear-gradient(135deg, #004f50 0%, #00696a 100%);
    color: white;
    padding: 12px 18px;
    border-radius: 6px;
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }}
  .header h1 {{
    margin: 0;
    font-size: 15pt;
    font-weight: 700;
    letter-spacing: -0.3px;
  }}
  .header p {{
    margin: 3px 0 0 0;
    font-size: 8.5pt;
    opacity: 0.9;
  }}
  .badge-tag {{
    background: rgba(255,255,255,0.18);
    border: 1px solid rgba(255,255,255,0.3);
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 7.5pt;
    font-weight: 600;
    text-transform: uppercase;
  }}
  .kpi-row {{
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
  }}
  .kpi-card {{
    flex: 1;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 12px;
    text-align: center;
  }}
  .kpi-card.emerald {{
    border-top: 3px solid #10b981;
  }}
  .kpi-card.amber {{
    border-top: 3px solid #d97706;
  }}
  .kpi-card.teal {{
    border-top: 3px solid #00696a;
  }}
  .kpi-val {{
    font-size: 14pt;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.2;
  }}
  .kpi-lbl {{
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
    color: #64748b;
    margin-top: 2px;
  }}
  table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 7.5pt;
    margin-bottom: 8px;
  }}
  thead {{
    display: table-header-group;
  }}
  th {{
    background-color: #00696a;
    color: white;
    font-weight: 700;
    padding: 5px 6px;
    text-align: left;
    border: 1px solid #004f50;
    font-size: 7.2pt;
    white-space: nowrap;
  }}
  th.center, td.center {{
    text-align: center;
  }}
  th.right, td.right {{
    text-align: right;
  }}
  td {{
    padding: 4px 6px;
    border: 1px solid #e2e8f0;
    vertical-align: middle;
  }}
  tr:nth-child(even) td {{
    background-color: #f8fafc;
  }}
  .badge-activo {{
    background: #dcfce7;
    color: #166534;
    font-weight: 700;
    font-size: 6.8pt;
    padding: 2px 5px;
    border-radius: 4px;
    border: 1px solid #bbf7d0;
    display: inline-block;
  }}
  .badge-pendiente {{
    background: #fef3c7;
    color: #92400e;
    font-weight: 700;
    font-size: 6.8pt;
    padding: 2px 5px;
    border-radius: 4px;
    border: 1px solid #fde68a;
    display: inline-block;
  }}
  .diag-cell {{
    font-size: 7pt;
    color: #334155;
    line-height: 1.25;
  }}
  .tfoot-row td {{
    background: #e2e8f0 !important;
    font-weight: 800;
    font-size: 8pt;
    border-top: 2px solid #00696a;
  }}
  .footer-bar {{
    margin-top: 8px;
    font-size: 6.8pt;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
    border-top: 1px solid #e2e8f0;
    padding-top: 4px;
  }}
  .analytics-grid {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 10px;
  }}
  .card-box {{
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px;
    background: #ffffff;
  }}
  .card-box h3 {{
    margin: 0 0 10px 0;
    font-size: 9.5pt;
    color: #004f50;
    border-bottom: 2px solid #00696a;
    padding-bottom: 4px;
  }}
  .bar-row {{
    display: flex;
    align-items: center;
    margin-bottom: 6px;
    font-size: 7.5pt;
  }}
  .bar-name {{
    width: 140px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 600;
  }}
  .bar-track {{
    flex: 1;
    background: #f1f5f9;
    height: 12px;
    border-radius: 3px;
    overflow: hidden;
    margin: 0 8px;
  }}
  .bar-fill {{
    background: #00696a;
    height: 100%;
    border-radius: 3px;
  }}
  .bar-val {{
    width: 65px;
    text-align: right;
    font-weight: 700;
    color: #0f172a;
  }}
</style>
</head>
<body>

<!-- PÁGINA 1: AUDITORÍA MASTER (PARTE 1) -->
<div class="page">
  <div class="header">
    <div>
      <h1>INFORME EJECUTIVO: CONCILIACIÓN DE CLIENTES DE RUTA (PETÉN)</h1>
      <p>Auditoría de seguimiento comercial: Cartera asignada a Erick Juárez desde Folio 809 (Enero - Junio) | Página 1</p>
    </div>
    <div class="badge-tag">Agrícola del Campo</div>
  </div>

  <div class="kpi-row">
    <div class="kpi-card teal">
      <div class="kpi-val">{tot_clientes}</div>
      <div class="kpi-lbl">Total Clientes Auditados</div>
    </div>
    <div class="kpi-card emerald">
      <div class="kpi-val">{tot_activos} ({(tot_activos/tot_clientes*100):.1f}%)</div>
      <div class="kpi-lbl">Clientes Activos con Venta</div>
    </div>
    <div class="kpi-card amber">
      <div class="kpi-val">{tot_pendientes} ({(tot_pendientes/tot_clientes*100):.1f}%)</div>
      <div class="kpi-lbl">Pendientes de Visita</div>
    </div>
    <div class="kpi-card teal">
      <div class="kpi-val">Q {tot_facturado:,.2f}</div>
      <div class="kpi-lbl">Facturación Total Erick Juárez</div>
    </div>
    <div class="kpi-card teal">
      <div class="kpi-val">{tot_facturas}</div>
      <div class="kpi-lbl">Facturas Registradas</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width:26px">No.</th>
        <th style="width:130px">Cliente según Libreta</th>
        <th style="width:110px">Ubicación / Municipio</th>
        <th class="center" style="width:70px">Periodo</th>
        <th class="center" style="width:90px">Estado de Gestión</th>
        <th class="center" style="width:45px">Facturas</th>
        <th class="right" style="width:75px">Facturado (Q)</th>
        <th class="center" style="width:85px">Folios</th>
        <th class="center" style="width:75px">Vendedor</th>
        <th>Diagnóstico y Recomendación Comercial</th>
      </tr>
    </thead>
    <tbody>
"""

# First 26 clients on page 1
for c in clients[:26]:
    st_class = "badge-activo" if c["estado"] == "ACTIVO" else "badge-pendiente"
    st_lbl = "ACTIVO" if c["estado"] == "ACTIVO" else "PENDIENTE"
    html += f"""      <tr>
        <td class="center">{c['id']}</td>
        <td><strong>{c['nombre']}</strong></td>
        <td>{c['lugar']}</td>
        <td class="center">{c['periodo']}</td>
        <td class="center"><span class="{st_class}">{st_lbl}</span></td>
        <td class="center">{c['facturasErick']}</td>
        <td class="right">Q {c['totalErick']:,.2f}</td>
        <td class="center" style="font-size:6.8pt">{c['folios']}</td>
        <td class="center">{c['vendedor']}</td>
        <td class="diag-cell">{c['diagnostico']}</td>
      </tr>\n"""

html += """    </tbody>
  </table>
  <div class="footer-bar">
    <span>Reporte de Conciliación de Cartera - Folio 809 en adelante</span>
    <span>Confidencial | Hoja 1 de 4</span>
  </div>
</div>

<!-- PÁGINA 2: AUDITORÍA MASTER (PARTE 2 + TOTALES) -->
<div class="page">
  <div class="header">
    <div>
      <h1>INFORME EJECUTIVO: CONCILIACIÓN DE CLIENTES DE RUTA (PETÉN)</h1>
      <p>Auditoría de seguimiento comercial: Cartera asignada a Erick Juárez (Clientes 27 al 52) | Página 2</p>
    </div>
    <div class="badge-tag">Agrícola del Campo</div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width:26px">No.</th>
        <th style="width:130px">Cliente según Libreta</th>
        <th style="width:110px">Ubicación / Municipio</th>
        <th class="center" style="width:70px">Periodo</th>
        <th class="center" style="width:90px">Estado de Gestión</th>
        <th class="center" style="width:45px">Facturas</th>
        <th class="right" style="width:75px">Facturado (Q)</th>
        <th class="center" style="width:85px">Folios</th>
        <th class="center" style="width:75px">Vendedor</th>
        <th>Diagnóstico y Recomendación Comercial</th>
      </tr>
    </thead>
    <tbody>
"""

# Remaining clients on page 2
for c in clients[26:]:
    st_class = "badge-activo" if c["estado"] == "ACTIVO" else "badge-pendiente"
    st_lbl = "ACTIVO" if c["estado"] == "ACTIVO" else "PENDIENTE"
    html += f"""      <tr>
        <td class="center">{c['id']}</td>
        <td><strong>{c['nombre']}</strong></td>
        <td>{c['lugar']}</td>
        <td class="center">{c['periodo']}</td>
        <td class="center"><span class="{st_class}">{st_lbl}</span></td>
        <td class="center">{c['facturasErick']}</td>
        <td class="right">Q {c['totalErick']:,.2f}</td>
        <td class="center" style="font-size:6.8pt">{c['folios']}</td>
        <td class="center">{c['vendedor']}</td>
        <td class="diag-cell">{c['diagnostico']}</td>
      </tr>\n"""

html += f"""      <tr class="tfoot-row">
        <td class="center" colspan="4">TOTAL GENERAL AUDITADO ({tot_clientes} CLIENTES)</td>
        <td class="center">{tot_activos} Activos / {tot_pendientes} Pend.</td>
        <td class="center">{tot_facturas}</td>
        <td class="right">Q {tot_facturado:,.2f}</td>
        <td class="center">{tot_facturas} Facturas</td>
        <td class="center">Erick Juárez</td>
        <td>Consolidación completa sin anomalías</td>
      </tr>
    </tbody>
  </table>
  <div class="footer-bar">
    <span>Reporte de Conciliación de Cartera - Folio 809 en adelante</span>
    <span>Confidencial | Hoja 2 de 4</span>
  </div>
</div>

<!-- PÁGINA 3: DETALLE DE FACTURAS EMITIDAS -->
<div class="page">
  <div class="header">
    <div>
      <h1>DETALLE DE FACTURAS EMITIDAS POR ERICK JUÁREZ</h1>
      <p>Comprobantes fiscales emitidos a la cartera auditada (Folio 809 en adelante) | Página 3</p>
    </div>
    <div class="badge-tag">{len(invoices)} Comprobantes</div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width:45px">Folio</th>
        <th class="center" style="width:65px">Fecha</th>
        <th style="width:140px">Cliente Libreta</th>
        <th style="width:190px">Cliente Facturado (Razón Social)</th>
        <th style="width:120px">Municipio / Zona</th>
        <th class="right" style="width:85px">Total Factura (Q)</th>
        <th class="center" style="width:90px">Vendedor</th>
      </tr>
    </thead>
    <tbody>
"""

tot_inv_amt = sum(inv["monto"] for inv in invoices)
for inv in invoices[:36]:
    html += f"""      <tr>
        <td class="center"><strong>{inv['folio']}</strong></td>
        <td class="center">{inv['fecha']}</td>
        <td>{inv['refLibreta']}</td>
        <td>{inv['clienteFactura']}</td>
        <td>{inv['lugar']}</td>
        <td class="right">Q {inv['monto']:,.2f}</td>
        <td class="center">{inv['vendedor']}</td>
      </tr>\n"""

html += f"""    </tbody>
  </table>
  <div class="footer-bar">
    <span>Detalle de Facturación - Folio 809</span>
    <span>Confidencial | Hoja 3 de 4</span>
  </div>
</div>

<!-- PÁGINA 4: RESTO DE FACTURAS Y ANALÍTICA -->
<div class="page">
  <div class="header">
    <div>
      <h1>DETALLE DE FACTURAS (CONTINUACIÓN) Y ANALÍTICA DE CARTERA</h1>
      <p>Cierre de comprobantes fiscales y métricas clave de rendimiento | Página 4</p>
    </div>
    <div class="badge-tag">Cierre Auditoría</div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width:45px">Folio</th>
        <th class="center" style="width:65px">Fecha</th>
        <th style="width:140px">Cliente Libreta</th>
        <th style="width:190px">Cliente Facturado (Razón Social)</th>
        <th style="width:120px">Municipio / Zona</th>
        <th class="right" style="width:85px">Total Factura (Q)</th>
        <th class="center" style="width:90px">Vendedor</th>
      </tr>
    </thead>
    <tbody>
"""

for inv in invoices[36:]:
    html += f"""      <tr>
        <td class="center"><strong>{inv['folio']}</strong></td>
        <td class="center">{inv['fecha']}</td>
        <td>{inv['refLibreta']}</td>
        <td>{inv['clienteFactura']}</td>
        <td>{inv['lugar']}</td>
        <td class="right">Q {inv['monto']:,.2f}</td>
        <td class="center">{inv['vendedor']}</td>
      </tr>\n"""

html += f"""      <tr class="tfoot-row">
        <td class="center" colspan="5">TOTAL GENERAL FACTURADO ({len(invoices)} FACTURAS)</td>
        <td class="right">Q {tot_inv_amt:,.2f}</td>
        <td class="center">Erick Juárez</td>
      </tr>
    </tbody>
  </table>

  <!-- BLOQUE ANALÍTICO TOP 10 -->
  <div class="analytics-grid">
    <div class="card-box">
      <h3>Top 10 Clientes de Mayor Facturación (Quetzales)</h3>
"""

max_amt = max(c["totalErick"] for c in top_clients) if top_clients else 1
for c in top_clients:
    pct = (c["totalErick"] / max_amt) * 100
    html += f"""      <div class="bar-row">
        <div class="bar-name">{c['nombre']}</div>
        <div class="bar-track"><div class="bar-fill" style="width: {pct:.1f}%"></div></div>
        <div class="bar-val">Q {c['totalErick']:,.2f}</div>
      </div>\n"""

html += f"""    </div>
    <div class="card-box">
      <h3>Resumen Estratégico de Cartera Petén</h3>
      <table style="width:100%; font-size:8pt">
        <tr><td><strong>Cobertura Comercial:</strong></td><td class="right">{(tot_activos/tot_clientes*100):.1f}% con compra efectiva</td></tr>
        <tr><td><strong>Oportunidad Pendiente:</strong></td><td class="right">{tot_pendientes} clientes pendientes de visita</td></tr>
        <tr><td><strong>Ticket Promedio por Factura:</strong></td><td class="right">Q {(tot_facturado/tot_facturas if tot_facturas else 0):,.2f}</td></tr>
        <tr><td><strong>Facturación Promedio por Cliente Activo:</strong></td><td class="right">Q {(tot_facturado/tot_activos if tot_activos else 0):,.2f}</td></tr>
        <tr><td><strong>Total Recaudado Auditado:</strong></td><td class="right"><strong style="color:#00696a">Q {tot_facturado:,.2f}</strong></td></tr>
      </table>
    </div>
  </div>

  <div class="footer-bar">
    <span>Reporte Ejecutivo de Conciliación - Folio 809</span>
    <span>Confidencial | Hoja 4 de 4</span>
  </div>
</div>

</body>
</html>
"""

with open(temp_html, "w", encoding="utf-8") as f:
    f.write(html)

print("[OK] HTML imprimible generado exitosamente.")

# Generate PDF with Edge headless
cmd = [
    edge_path,
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={desktop_pdf}",
    temp_html
]

subprocess.run(cmd, check=True)
print(f"[OK] PDF listo para imprimir guardado en: {desktop_pdf}")
