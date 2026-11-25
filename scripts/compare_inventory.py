import csv
import json
import re

def normalize_name(n):
    if not n:
        return ""
    n = n.lower().strip()
    n = re.sub(r'\s+', ' ', n)
    n = n.replace('gramos', 'gr').replace('gramo', 'gr')
    n = n.replace('litros', 'litro').replace('litro', 'l').replace('1 litro', 'litro')
    n = n.replace('cipermectrina', 'cipermetrina')
    n = n.replace('fosbest', 'fosfobest')
    n = n.replace('agripiojon', 'agripiojin')
    n = n.replace('nitro grow', 'nitrogrow')
    n = n.replace('trinsulfa', 'trimsulfa')
    n = n.replace('sana soco', 'sana soco')
    n = n.replace('arete 1 pieza', 'arete 1 pieza')
    return n

# 1. Parse user's CSV
user_items = []
current_cat = None
user_cat_subtotals = {}

with open('scripts/user_manual_inventory.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    for row in reader:
        if not row or not any(row):
            continue
        c0 = row[0].strip() if len(row) > 0 else ""
        c1 = row[1].strip() if len(row) > 1 else ""
        c2 = row[2].strip() if len(row) > 2 else ""
        c3 = row[3].strip() if len(row) > 3 else ""
        c4 = row[4].strip() if len(row) > 4 else ""
        c5 = row[5].strip() if len(row) > 5 else ""

        # Category header e.g. "TECUN / BAYER,UNIDADES EN STOCK,..."
        if "UNIDAD" in c1.upper() or "STOCK" in c1.upper():
            current_cat = c0.strip()
            continue

        # Subtotal row e.g. ",866,,41913.10,,55933.63"
        if c0 == "" and c1 != "":
            try:
                sub_stock = float(c1)
                sub_cost = float(c3) if c3 else 0.0
                sub_sale = float(c5) if c5 else 0.0
                user_cat_subtotals[current_cat] = {
                    "stock": sub_stock,
                    "cost": sub_cost,
                    "sale": sub_sale
                }
            except:
                pass
            continue

        if c0 and (c0.startswith("COMPRA") or c0.startswith("VENTA")):
            continue

        if c0:
            try:
                stock = float(c1) if c1 else 0.0
                cost = float(c2) if c2 else 0.0
                tot_cost = float(c3) if c3 else (stock * cost)
                price = float(c4) if c4 else 0.0
                tot_sale = float(c5) if c5 else (stock * price)

                user_items.append({
                    "cat": current_cat,
                    "raw_name": c0,
                    "norm_name": normalize_name(c0),
                    "stock": stock,
                    "cost": cost,
                    "tot_cost": tot_cost,
                    "price": price,
                    "tot_sale": tot_sale
                })
            except Exception as e:
                pass

print(f"Loaded {len(user_items)} items from user's manual CSV across {len(user_cat_subtotals)} categories.")

# 2. Parse DB snapshot
with open('scripts/snapshot_products_2026_11_23.json', 'r', encoding='utf-8') as f:
    db_products = json.load(f)

print(f"Loaded {len(db_products)} products from DB snapshot.")

db_items = []
for p in db_products:
    if p.get('is_external'):
        continue
    variants = p.get('variants')
    if isinstance(variants, str):
        try: variants = json.loads(variants)
        except: variants = None
    
    parent_stock = float(p.get('stock') or 0)
    parent_price = float(p.get('price') or 0)
    parent_cost = float(p.get('cost_price') or 0)

    if variants and isinstance(variants, list) and len(variants) > 0:
        for v in variants:
            v_name = f"{p.get('name')} - {v.get('color', '')} {v.get('size', '')}".strip()
            v_stock = float(v.get('stock') if v.get('stock') is not None else parent_stock)
            v_price = float(v.get('price') or parent_price)
            v_cost = float(v.get('cost_price') or parent_cost)
            db_items.append({
                "id": p.get('id'),
                "cat": p.get('category'),
                "raw_name": v_name,
                "norm_name": normalize_name(v_name),
                "parent_name": p.get('name'),
                "norm_parent": normalize_name(p.get('name')),
                "stock": v_stock,
                "cost": v_cost,
                "tot_cost": v_stock * v_cost,
                "price": v_price,
                "tot_sale": v_stock * v_price,
                "is_variant": True
            })
    else:
        db_items.append({
            "id": p.get('id'),
            "cat": p.get('category'),
            "raw_name": p.get('name'),
            "norm_name": normalize_name(p.get('name')),
            "parent_name": p.get('name'),
            "norm_parent": normalize_name(p.get('name')),
            "stock": parent_stock,
            "cost": parent_cost,
            "tot_cost": parent_stock * parent_cost,
            "price": parent_price,
            "tot_sale": parent_stock * parent_price,
            "is_variant": False
        })

print(f"DB active items (including expanded variants, excluding external): {len(db_items)}")

# 3. Overall Totals Comparison
user_tot_stock = sum(i['stock'] for i in user_items)
user_tot_cost = sum(i['tot_cost'] for i in user_items)
user_tot_sale = sum(i['tot_sale'] for i in user_items)

db_tot_stock = sum(i['stock'] for i in db_items)
db_tot_cost = sum(i['tot_cost'] for i in db_items)
db_tot_sale = sum(i['tot_sale'] for i in db_items)

print("\n" + "="*70)
print("GRAND TOTALS COMPARISON (USER MANUAL vs APP DATABASE):")
print("="*70)
print(f"STOCK (UNIDADES):")
print(f"  * Usuario Manual CSV: {user_tot_stock:,.0f} unidades")
print(f"  * App (Base de Datos): {db_tot_stock:,.0f} unidades")
print(f"  * DIFERENCIA STOCK:    {db_tot_stock - user_tot_stock:+,.0f} unidades")

print(f"\nCOSTO TOTAL (INVERSIÓN):")
print(f"  * Usuario Manual CSV: Q{user_tot_cost:,.2f}")
print(f"  * App (Base de Datos): Q{db_tot_cost:,.2f}")
print(f"  * DIFERENCIA COSTO:    Q{db_tot_cost - user_tot_cost:+,.2f}")

print(f"\nVENTA TOTAL (VALORIZACIÓN EN VENTA):")
print(f"  * Usuario Manual CSV: Q{user_tot_sale:,.2f}")
print(f"  * App (Base de Datos): Q{db_tot_sale:,.2f}")
print(f"  * DIFERENCIA VENTA:    Q{db_tot_sale - user_tot_sale:+,.2f}")

# 4. Check why Jeringas (MODERNA) has 1900 units vs 19 units!
print("\n" + "="*70)
print("CHECKING SPECIFIC HIGHLIGHTS (e.g. JERINGAS, AGRICOVET, ETC):")
print("="*70)

for u in user_items:
    if "jeringa" in u['norm_name']:
        print(f"User Jeringa: {u['raw_name']} -> stock: {u['stock']}, cost: {u['cost']}, price: {u['price']}")

for d in db_items:
    if "jeringa" in d['norm_name']:
        print(f"DB Jeringa:   {d['raw_name']} -> stock: {d['stock']}, cost: {d['cost']}, price: {d['price']}")

# 5. Matching Items & Finding Missing
matched_user = set()
matched_db = set()

discrepancies = []

for u_idx, u in enumerate(user_items):
    best_match = None
    # exact or normalized match
    for d_idx, d in enumerate(db_items):
        if d_idx in matched_db:
            continue
        # check match
        if u['norm_name'] == d['norm_name'] or u['norm_name'] in d['norm_name'] or d['norm_name'] in u['norm_name']:
            best_match = (d_idx, d)
            break
        # also try parent name
        if u['norm_name'] == d['norm_parent'] or u['norm_name'] in d['norm_parent']:
            best_match = (d_idx, d)
            break

    if best_match:
        d_idx, d = best_match
        matched_user.add(u_idx)
        matched_db.add(d_idx)
        
        diff_stock = d['stock'] - u['stock']
        diff_cost = d['cost'] - u['cost']
        diff_price = d['price'] - u['price']
        diff_tot_cost = d['tot_cost'] - u['tot_cost']
        diff_tot_sale = d['tot_sale'] - u['tot_sale']

        if abs(diff_stock) > 0.01 or abs(diff_cost) > 0.05 or abs(diff_price) > 0.05:
            discrepancies.append({
                "user_name": u['raw_name'],
                "db_name": d['raw_name'],
                "cat_user": u['cat'],
                "cat_db": d['cat'],
                "u_stock": u['stock'], "d_stock": d['stock'], "diff_stock": diff_stock,
                "u_cost": u['cost'], "d_cost": d['cost'], "diff_cost": diff_cost,
                "u_price": u['price'], "d_price": d['price'], "diff_price": diff_price,
                "diff_tot_cost": diff_tot_cost,
                "diff_tot_sale": diff_tot_sale
            })

print(f"\nMatched {len(matched_user)} items between User and DB.")
print(f"Found {len(discrepancies)} items with differences in stock, cost, or price.")

# 6. Items in DB that are MISSING from User's manual CSV
missing_in_user = [d for idx, d in enumerate(db_items) if idx not in matched_db and d['stock'] > 0]
print(f"\nItems in DB with stock > 0 that user DID NOT include in Excel ({len(missing_in_user)} items):")
miss_stock = sum(d['stock'] for d in missing_in_user)
miss_cost = sum(d['tot_cost'] for d in missing_in_user)
miss_sale = sum(d['tot_sale'] for d in missing_in_user)
print(f"Total omitted stock: {miss_stock} uds | Total Cost: Q{miss_cost:,.2f} | Total Sale: Q{miss_sale:,.2f}")
for d in missing_in_user:
    print(f"  - [{d['cat']}] {d['raw_name']}: stock={d['stock']}, cost=Q{d['cost']}, price=Q{d['price']}, val=Q{d['tot_sale']:,.2f}")

# 7. Print top discrepancies
print("\n" + "="*70)
print("TOP DISCREPANCIES (STOCK OR PRICE/COST DIFFERENCE):")
print("="*70)
for disc in sorted(discrepancies, key=lambda x: abs(x['diff_stock']), reverse=True)[:25]:
    print(f"• {disc['user_name']} vs {disc['db_name']} [{disc['cat_db']}]:")
    print(f"    Stock -> User: {disc['u_stock']} | App: {disc['d_stock']} (Diff: {disc['diff_stock']:+})")
    print(f"    Costo -> User: Q{disc['u_cost']} | App: Q{disc['d_cost']} (Diff: Q{disc['diff_cost']:+})")
    print(f"    Venta -> User: Q{disc['u_price']} | App: Q{disc['d_price']} (Diff: Q{disc['diff_price']:+})")
    print(f"    Diff Costo Total: Q{disc['diff_tot_cost']:+,.2f} | Diff Venta Total: Q{disc['diff_tot_sale']:+,.2f}")
