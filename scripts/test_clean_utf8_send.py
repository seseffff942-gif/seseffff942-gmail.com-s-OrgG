# -*- coding: utf-8 -*-
import requests

payload = {
    "fecha": "2026-11-02",
    "corte": "12:00",
    "tipoCorte": "mediodia",
    "esConsolidado": True,
    "numero": "50248234048",
    "telefono": "50248234048",
    "nombreDestinatario": "Emanuel Lima",
    "vendedor": "Emanuel Lima",
    "email": "seseffff942@gmail.com",
    "cantidadVendida": 2160,
    "umbral": 16700,
    "cantidadFacturas": 3,
    "textoWhatsApp": """📊 *RESUMEN CONSOLIDADO DE VENTAS - CORTE DE MEDIODÍA (12:00 PM)* 🏢
━━━━━━━━━━━━━━━━━━━━━━━━━━
Estimado *Emanuel Lima*, le presentamos el consolidado oficial de ventas del día (*2026-11-02*):

💰 *TOTAL GENERAL VENDIDO:* *Q. 2,160.00*
📄 *Facturas Totales Hoy:* 3 factura(s)
🎯 *Meta Diaria por Asesor:* Q. 8,350.00

━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 *DETALLE POR ASESOR:*

1️⃣ *Herbert Argueta* (Asesor #1521):
  ▫️ Total Vendido: *Q. 1,500.00* (2 factura(s))
  ▫️ Estado: ⚠️ *Bajo Meta* (-Q. 6,850.00)

2️⃣ *Erick Juárez* (Asesor):
  ▫️ Total Vendido: *Q. 660.00* (1 factura(s))
  ▫️ Estado: ⚠️ *Bajo Meta* (-Q. 7,690.00)

━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 _Sistema de Gestión & Rendimiento Comercial Agricovet_"""
}

res = requests.post("http://185.166.39.49:5678/webhook/ventas-reporte", json=payload)
print("Response:", res.status_code, res.text)

