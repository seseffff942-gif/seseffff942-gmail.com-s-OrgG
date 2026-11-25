import csv
import json
import re

with open('scripts/snapshot_products_2026_11_23.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

def clean(s):
    s = s.lower().replace(' ', '').replace('/', '').replace('-', '').replace(',', '').replace('.', '')
    s = s.replace('gramos', 'gr').replace('gramo', 'gr').replace('litros', 'l').replace('litro', 'l')
    s = s.replace('cipermectrina', 'cipermetrina')
    s = s.replace('fosbest', 'fosfobest')
    s = s.replace('agripiojon', 'agripiojin')
    s = s.replace('trinsulfa', 'trimsulfa')
    return s

user_prods = {}
with open('scripts/user_manual_inventory.csv', 'r', encoding='utf-8') as f:
    for row in csv.reader(f):
        if row and row[0] and not row[0].startswith('COMPRA') and not row[0].startswith('VENTA') and 'UNIDAD' not in (row[1] if len(row)>1 else ''):
            raw = row[0].strip()
            k = clean(raw)
            try:
                s = float(row[1]) if len(row) > 1 and row[1] else 0.0
                c = float(row[2]) if len(row) > 2 and row[2] else 0.0
                p = float(row[4]) if len(row) > 4 and row[4] else 0.0
            except:
                s, c, p = 0, 0, 0
            user_prods[k] = {"raw": raw, "stock": s, "cost": c, "price": p}

print(f"Total cleaned products in user CSV: {len(user_prods)}")

matched_db = set()
discrepancies = []

for p in db:
    if p.get('is_external'): continue
    k = clean(p['name'])
    s = float(p.get('stock') or 0)
    co = float(p.get('cost_price') or 0)
    pr = float(p.get('price') or 0)

    # find in user_prods
    match = None
    if k in user_prods:
        match = user_prods[k]
    else:
        # substring search
        for uk, uv in user_prods.items():
            if k in uk or uk in k:
                match = uv
                break

    if match:
        matched_db.add(p['id'])
        u_s = match['stock']
        u_c = match['cost']
        u_p = match['price']

        # Special case for Jeringas (1 box = 100 units)
        if 'jeringa' in k:
            u_s_adjusted = u_s / 100.0
            u_c_adjusted = u_c * 100.0
            u_p_adjusted = u_p * 100.0
            diff_s = s - u_s_adjusted
            diff_c = co - u_c_adjusted
            diff_p = pr - u_p_adjusted
        else:
            diff_s = s - u_s
            diff_c = co - u_c
            diff_p = pr - u_p

        if abs(diff_s) > 0.01 or abs(diff_c) > 0.1 or abs(diff_p) > 0.1:
            discrepancies.append({
                "name": p['name'], "cat": p['category'],
                "app_stock": s, "user_stock": match['stock'], "diff_stock": diff_s,
                "app_cost": co, "user_cost": match['cost'], "diff_cost": diff_c,
                "app_price": pr, "user_price": match['price'], "diff_price": diff_p
            })
    else:
        if s > 0:
            print(f"NOT FOUND IN USER CSV: [{p.get('category')}] {p['name']} (Stock={s}, Cost=Q{co}, Price=Q{pr})")

print(f"\nTotal matched in DB: {len(matched_db)}")
print(f"\nTOTAL DISCREPANCIES FOUND: {len(discrepancies)}")
for d in discrepancies:
    print(f"\n--- {d['name']} [{d['cat']}] ---")
    if abs(d['diff_stock']) > 0.01:
        print(f"  * STOCK: App tiene {d['app_stock']} vs Excel {d['user_stock']} (Diferencia: {d['diff_stock']:+})")
    if abs(d['diff_cost']) > 0.1:
        print(f"  * COSTO: App tiene Q{d['app_cost']} vs Excel Q{d['user_cost']} (Diferencia: Q{d['diff_cost']:+})")
    if abs(d['diff_price']) > 0.1:
        print(f"  * PRECIO VENTA: App tiene Q{d['app_price']} vs Excel Q{d['user_price']} (Diferencia: Q{d['diff_price']:+})")
