import psycopg2
import json

MASTER_CLIENTS = [
    # 1. Hector Mendoza
    {"id": 1, "nombre": "Hector Mendoza", "lugar": "El Remate", "periodo": "Enero", "search": ["hector mendoza", "mendoza"]},
    # 2. Eider Guerra
    {"id": 2, "nombre": "Eider Guerra (Elder)", "lugar": "El Zapote / Ixlu", "periodo": "Enero / Feb", "search": ["eider", "elder", "guerra"]},
    # 3. Marlon Garrido
    {"id": 3, "nombre": "Marlon Garrido (Mailon)", "lugar": "El Caoba", "periodo": "Enero / Feb", "search": ["garrido", "mailon", "marlon"]},
    # 4. Cesar Lopez
    {"id": 4, "nombre": "Cesar Lopez", "lugar": "San Benito", "periodo": "Enero", "search": ["cesar lopez", "cesar lópez", "pop lópez cesar"]},
    # 5. Iris Reyes
    {"id": 5, "nombre": "Iris Reyes", "lugar": "Santa Elena", "periodo": "Enero / Feb", "search": ["iris reyes", "alexa"]},
    # 6. Wilman Chonay
    {"id": 6, "nombre": "Wilman Chonay", "lugar": "Dolores", "periodo": "Enero / Feb / Mar", "search": ["chonay", "wilman"]},
    # 7. Lidia Felipe Rashel
    {"id": 7, "nombre": "Lidia Felipe Rashel", "lugar": "Dolores (Calzada Mopán)", "periodo": "Enero / Mar", "search": ["lidia felipe", "rashel", "rachel", "felipe tuch", "felipe contreras"]},
    # 8. Luis Espina
    {"id": 8, "nombre": "Luis Espina", "lugar": "Poptun", "periodo": "Enero", "search": ["luis espina", "espina"]},
    # 9. Geovany Hernandez
    {"id": 9, "nombre": "Geovany Hernandez", "lugar": "Santa Elena", "periodo": "Enero", "search": ["geovany", "geovani", "cordero"]},
    # 10. Erick Hernandez
    {"id": 10, "nombre": "Erick Hernandez", "lugar": "Ixlu", "periodo": "Enero", "search": ["efinagro", "erick hernandez", "erick hernández"]},
    # 11. Fredy Vicente
    {"id": 11, "nombre": "Fredy Vicente", "lugar": "Santa Ana", "periodo": "Enero", "search": ["fredy vicente", "agroveterinaria vicente"]},
    # 12. Hever Tello
    {"id": 12, "nombre": "Hever Tello (Eber Bello)", "lugar": "San Francisco", "periodo": "Enero / Feb", "search": ["tello", "san francisco", "hever"]},
    # 13. Rony Vicente
    {"id": 13, "nombre": "Rony Vicente", "lugar": "Santa Elena", "periodo": "Enero", "search": ["rony vicente", "el sembrador"]},
    # 14. Leonidas Giron
    {"id": 14, "nombre": "Leonidas Giron", "lugar": "Mopan Dolores", "periodo": "Enero", "search": ["leonidas", "giron", "girón"]},
    # 15. Eliel Betancourt
    {"id": 15, "nombre": "Eliel Betancourt", "lugar": "Sayaxche / Chacte", "periodo": "Enero / Feb", "search": ["eliel", "betancourt", "betancourth", "la cumbre"]},
    # 16. Israel España
    {"id": 16, "nombre": "Israel España (Angel España)", "lugar": "El Chal", "periodo": "Enero", "search": ["angel españa", "agro el chal", "israel españa"]},
    # 17. Walter Molina
    {"id": 17, "nombre": "Walter Molina", "lugar": "El Chal", "periodo": "Enero", "search": ["walter molina", "molina"]},
    
    # --- Nuevos de Página 1 y 2 ---
    # 18. Hugo Sutuj
    {"id": 18, "nombre": "Hugo Sutuj", "lugar": "El Chal", "periodo": "Enero", "search": ["hugo sutuj", "sutuj", "corral"]},
    # 19. Hary Campos
    {"id": 19, "nombre": "Hary Campos", "lugar": "El Chal", "periodo": "Enero", "search": ["hary campos", "rejo", "campos"]},
    # 20. Ervin Hernandez
    {"id": 20, "nombre": "Ervin Hernandez", "lugar": "Sacpuy San Andres", "periodo": "Enero / Feb", "search": ["ervin", "erlin", "sacpuy"]},
    # 21. Ermides Recinos
    {"id": 21, "nombre": "Ermides Recinos", "lugar": "El Naranjo La Libertad", "periodo": "Enero", "search": ["ermides", "recinos", "naranjo"]},
    # 22. Sherlina Marroquin
    {"id": 22, "nombre": "Sherlina Marroquin", "lugar": "Santa Ana", "periodo": "Enero / Feb", "search": ["sherlina", "marroquin", "marroquín"]},
    # 23. Eber de Leon
    {"id": 23, "nombre": "Eber de Leon", "lugar": "Las Cruces Peten", "periodo": "Enero", "search": ["eber de leon", "de leon", "de león", "cruces"]},
    # 24. Jose Elias Polanco
    {"id": 24, "nombre": "Jose Elias Polanco", "lugar": "San Luis", "periodo": "Enero", "search": ["polanco", "jose elias", "josé elías"]},
    # 25. Cesar Noyola
    {"id": 25, "nombre": "Cesar Noyola", "lugar": "Aldea La Maquina", "periodo": "Febrero", "search": ["cesar noyola", "noyola", "maquina"]},
    # 26. Brenda Duarte
    {"id": 26, "nombre": "Brenda Duarte", "lugar": "Cruce dos Aguadas San Andres", "periodo": "Febrero", "search": ["brenda duarte", "duarte", "tres hermanos", "3 hermanos"]},
    # 27. Eliberto Cortez
    {"id": 27, "nombre": "Eliberto Cortez", "lugar": "Sacpuy San Andres", "periodo": "Febrero", "search": ["eliberto", "cortez", "cortés"]},
    # 28. Jose Alejandro Ordoñez
    {"id": 28, "nombre": "Jose Alejandro Ordoñez", "lugar": "San Luis", "periodo": "Febrero", "search": ["ordoñez", "ordóñez", "jose alejandro"]},
    # 29. Wilder Lemus
    {"id": 29, "nombre": "Wilder Lemus", "lugar": "Poptun", "periodo": "Febrero", "search": ["wilder", "lemus"]},
    # 30. David de Jesus
    {"id": 30, "nombre": "David de Jesus", "lugar": "San Luis Peten", "periodo": "Febrero", "search": ["david de jesus", "david de jesús"]},
    # 31. Fernando Valdez
    {"id": 31, "nombre": "Fernando Valdez", "lugar": "San Luis", "periodo": "Febrero / Mar", "search": ["fernando valdez", "valdez"]},
    # 32. Mildred Salazar
    {"id": 32, "nombre": "Mildred Salazar", "lugar": "La Libertad", "periodo": "Febrero", "search": ["mildred", "salazar"]},
    # 33. Noe Garcia
    {"id": 33, "nombre": "Noe Garcia", "lugar": "El Chal", "periodo": "Febrero", "search": ["noe garcia", "noe garcía", "garcia lopez"]},
    # 34. Elio Arreaza
    {"id": 34, "nombre": "Elio Arreaza", "lugar": "Poptun", "periodo": "Marzo", "search": ["elio arreaza", "arreaza", "potro"]},
    # 35. Sara Ipiña
    {"id": 35, "nombre": "Sara Ipiña", "lugar": "Chacalte San Luis", "periodo": "Marzo", "search": ["sara ipiña", "ipiña", "chacalte"]},
    # 36. Edwin Hernandez
    {"id": 36, "nombre": "Edwin Hernandez", "lugar": "San Luis Peten", "periodo": "Marzo", "search": ["edwin hernandez", "edwin hernández"]},
    # 37. Luis Carranza
    {"id": 37, "nombre": "Luis Carranza", "lugar": "Dolores", "periodo": "Marzo", "search": ["luis carranza", "carranza", "el ganadero"]},
    # 38. Edwin Lopez
    {"id": 38, "nombre": "Edwin Lopez", "lugar": "Sabaneta Dolores", "periodo": "Marzo", "search": ["edwin lopez", "edwin lópez", "sabaneta", "el campesino"]}
]

def normalize(s):
    import unicodedata
    if not s: return ""
    return ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if unicodedata.category(c) != 'Mn')

conn = psycopg2.connect('postgresql://postgres:postgres123@localhost:5432/postgres')
cur = conn.cursor()

cur.execute("""
    SELECT i.id, i.folio, i."clientName", i.date, i."totalAmount", i."sellerId",
           u.name as seller_name, u.email as seller_email
    FROM invoices i
    LEFT JOIN users u ON (u.email = i."sellerId" OR u.id = i."sellerId")
    WHERE i.is_archived IS NOT TRUE
    ORDER BY CAST(NULLIF(regexp_replace(i.folio, '\\D', '', 'g'), '') AS INTEGER) ASC, i.date ASC;
""")
invoices = cur.fetchall()

cur.execute("""
    SELECT c.id, c.name, c."companyName", c.address, c."sellerId", u.name as seller_name
    FROM clients c
    LEFT JOIN users u ON (u.email = c."sellerId" OR u.id = c."sellerId");
""")
clients = cur.fetchall()

report = []

for item in MASTER_CLIENTS:
    matched_invs = []
    
    for inv in invoices:
        folio, cName, dt, amt, sId, sName, sEmail = inv[1], inv[2], inv[3], float(inv[4] or 0), inv[5], inv[6], inv[7]
        cNorm = normalize(cName)
        
        match = False
        for p in item['search']:
            pNorm = normalize(p)
            if pNorm in cNorm:
                match = True
                break
        
        # Disambiguations
        if match:
            if item['id'] == 1 and "mendoza" not in cNorm: match = False
            elif item['id'] == 2 and ("eider" not in cNorm and "elder" not in cNorm): match = False
            elif item['id'] == 8 and "espina" not in cNorm: match = False
            elif item['id'] == 14 and "leonidas" not in cNorm: match = False
            elif item['id'] == 17 and "walter" not in cNorm and "molina" not in cNorm: match = False
            elif item['id'] == 23 and "cruces" not in cNorm: match = False
            elif item['id'] == 24 and "polanco" not in cNorm: match = False
            elif item['id'] == 27 and "cortez" not in cNorm and "cortes" not in cNorm: match = False
            elif item['id'] == 30 and "david de jesus" not in cNorm: match = False
            elif item['id'] == 31 and "valdez" not in cNorm: match = False
            elif item['id'] == 32 and "mildred" not in cNorm and "salazar" not in cNorm: match = False
            elif item['id'] == 36 and ("edwin" not in cNorm or "hernandez" not in cNorm): match = False
        
        if match:
            is_erick = 'jerick' in (sEmail or '').lower() or 'erick' in (sName or '').lower()
            matched_invs.append({
                'folio': folio,
                'fecha': str(dt).split(' ')[0] if dt else 'S/F',
                'cliente': cName,
                'monto': amt,
                'vendedor': sName or sId,
                'isErick': is_erick
            })
            
    erick_invs = [x for x in matched_invs if x['isErick']]
    erick_total = sum(x['monto'] for x in erick_invs)
    total_monto = sum(x['monto'] for x in matched_invs)
    
    estado = "ACTIVO CON VENTA" if len(erick_invs) > 0 else "PENDIENTE DE VISITA"
    
    report.append({
        'id': item['id'],
        'nombre': item['nombre'],
        'lugar': item['lugar'],
        'periodo': item['periodo'],
        'estado': estado,
        'facturasErick': len(erick_invs),
        'totalErick': erick_total,
        'facturasTotal': len(matched_invs),
        'totalGeneral': total_monto,
        'folios': ', '.join(x['folio'] for x in erick_invs) if erick_invs else "Sin compras",
        'vendedor': "Erick Juárez" if erick_invs else ("Emanuel Lima" if matched_invs else "Por coordinar"),
        'detalle': matched_invs
    })

with open('scripts/full_master_audit_data.json', 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2, ensure_ascii=False)

print("Master audit data generated successfully.")
cur.close()
conn.close()
