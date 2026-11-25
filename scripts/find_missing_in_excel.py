import csv
import json

with open('scripts/snapshot_products_2026_11_23.json', 'r', encoding='utf-8') as f:
    db = json.load(f)

# Read user product names from csv
user_prods = []
with open('scripts/user_manual_inventory.csv', 'r', encoding='utf-8') as f:
    for row in csv.reader(f):
        if row and row[0] and not row[0].startswith('COMPRA') and not row[0].startswith('VENTA') and 'UNIDAD' not in (row[1] if len(row)>1 else ''):
            user_prods.append(row[0].strip().lower())

print(f"Total product names in user CSV: {len(user_prods)}")

missing_in_excel = []
for p in db:
    if p.get('is_external'): continue
    name = p['name'].strip().lower()
    stock = float(p.get('stock') or 0)
    # Check if matched in user_prods
    matched = False
    for up in user_prods:
        if name in up or up in name:
            matched = True
            break
        # Special name checks
        if 'cipermetrina' in name and 'cipermectrina' in up:
            if ('1lt' in name and 'litro' in up) or ('100ml' in name and '100 ml' in up) or ('250' in name and '250' in up) or ('500' in name and '500' in up):
                matched = True; break
        if 'fosfobest' in name and 'fosbest' in up:
            matched = True; break
        if 'agripiojin' in name and 'agripiojon' in up:
            matched = True; break
        if 'chemi stress' in name and 'chemiestress' in up:
            matched = True; break
        if 'jeringa' in name and 'jeringa' in up:
            matched = True; break
        if '2,4d' in name and '2,4 d' in up:
            matched = True; break
        if 'yerbatron' in name and 'yerbatron' in up:
            if ('litro' in name and '1 litro' in up) or ('20 litros' in name and '20 litros' in up):
                matched = True; break
        if 'semevin' in name and 'semevin' in up:
            if ('litro' in name and 'litro' in up) or ('36 fs' in name and '125 ml' in up):
                matched = True; break
        if 'certero' in name and 'certero' in up:
            matched = True; break
        if 'arete' in name and 'arete' in up:
            matched = True; break

    if not matched:
        missing_in_excel.append(p)

print(f"\nProducts in App that were COMPLETELY OMITTED in Excel ({len(missing_in_excel)}):")
tot_m_stock = 0
tot_m_cost = 0
tot_m_sale = 0
for p in missing_in_excel:
    s = float(p.get('stock') or 0)
    pr = float(p.get('price') or 0)
    co = float(p.get('cost_price') or 0)
    if s != 0:
        tot_m_stock += s
        tot_m_cost += s * co
        tot_m_sale += s * pr
        print(f"  * [{p.get('category')}] {p['name']}: stock={s}, cost=Q{co}, price=Q{pr}, tot_sale=Q{s*pr}")

print(f"\nTotal Omitted: Stock={tot_m_stock} uds, Cost=Q{tot_m_cost:,.2f}, Sale=Q{tot_m_sale:,.2f}")
