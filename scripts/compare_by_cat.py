import csv
import json

with open('scripts/snapshot_products_2026_11_23.json', 'r', encoding='utf-8') as f:
    db_products = json.load(f)

# Normalize jeringas in DB to units (multiply boxes by 100) or user to boxes
# User counted jeringas as units (1900 units = 19 boxes * 100)
# So user's total units = 21,202. If jeringas are counted as boxes (19), user total is 21,202 - 1881 = 19,321!
# App total units = 19,302 (or 19,325 with aretes)!
# 19,325 - 19,321 = ONLY 4 UNITS DIFFERENCE!

# Let's inspect category by category!
# Categories in user's CSV:
user_cats = {}
with open('scripts/user_manual_inventory.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    current_cat = None
    for row in reader:
        if not row or not any(row): continue
        c0 = row[0].strip() if len(row) > 0 else ""
        c1 = row[1].strip() if len(row) > 1 else ""
        c3 = row[3].strip() if len(row) > 3 else ""
        c5 = row[5].strip() if len(row) > 5 else ""
        if "UNIDAD" in c1.upper() or "STOCK" in c1.upper():
            current_cat = c0.strip()
            user_cats[current_cat] = {"stock": 0, "cost": 0, "sale": 0, "items": []}
            continue
        if c0 == "" and c1 != "":
            # Subtotal row
            continue
        if c0 and not c0.startswith("COMPRA") and not c0.startswith("VENTA"):
            try:
                s = float(c1) if c1 else 0.0
                co = float(row[2].strip()) if len(row) > 2 and row[2].strip() else 0.0
                pr = float(row[4].strip()) if len(row) > 4 and row[4].strip() else 0.0
                tc = float(c3) if c3 else (s * co)
                ts = float(c5) if c5 else (s * pr)
                user_cats[current_cat]["items"].append({
                    "name": c0, "stock": s, "cost": co, "price": pr, "tot_cost": tc, "tot_sale": ts
                })
                user_cats[current_cat]["stock"] += s
                user_cats[current_cat]["cost"] += tc
                user_cats[current_cat]["sale"] += ts
            except:
                pass

print("=== USER CSV BY CATEGORY ===")
for cat, d in user_cats.items():
    print(f"{cat.ljust(25)} | Stock: {d['stock']:>7.0f} | Cost: Q{d['cost']:>10.2f} | Sale: Q{d['sale']:>10.2f} | Items: {len(d['items'])}")

# Now DB by category:
db_cats = {}
for p in db_products:
    if p.get('is_external'): continue
    c = p.get('category') or "OTROS"
    # Map TECUN vs Tecun
    c_upper = c.upper()
    if "TECUN" in c_upper:
        c_norm = "TECUN / BAYER"
    elif "FORAGRO" in c_upper:
        c_norm = "FORAGRO"
    elif "SISTEMAS" in c_upper:
        c_norm = "SISTEMAS AGROPECUARIOS"
    elif "AVINDUSTRIAS" in c_upper:
        c_norm = "AVINDUSTRIAS"
    elif "MALLO" in c_upper:
        c_norm = "MALLO"
    elif "WELLCO" in c_upper:
        c_norm = "WELLCO"
    elif "BIOZOO" in c_upper:
        c_norm = "BIOZOO"
    elif "TECNIAGRO" in c_upper:
        c_norm = "TECNIAGRO"
    elif "INSUMOS" in c_upper:
        c_norm = "INSUMOS MODERNOS"
    elif "AGRONORSA" in c_upper:
        c_norm = "AGRONORSA"
    elif "AGROSONA" in c_upper:
        c_norm = "AGROSONA"
    elif "BOTICA" in c_upper:
        c_norm = "BOTICA GANADERA"
    elif "DUWEST" in c_upper:
        c_norm = "DUWEST"
    elif "AGRICOVET" in c_upper:
        c_norm = "AGRICOVET"
    elif "FIAT" in c_upper:
        c_norm = "FIAT"
    elif "INCUBADORA" in c_upper:
        c_norm = "INCUBADORAS"
    else:
        c_norm = "OTROS"

    if c_norm not in db_cats:
        db_cats[c_norm] = {"stock": 0, "cost": 0, "sale": 0, "items": []}
    
    variants = p.get('variants')
    if isinstance(variants, str):
        try: variants = json.loads(variants)
        except: variants = None
    
    s = float(p.get('stock') or 0)
    pr = float(p.get('price') or 0)
    co = float(p.get('cost_price') or 0)

    if variants and isinstance(variants, list) and len(variants) > 0:
        for v in variants:
            v_s = max(0, float(v.get('stock') if v.get('stock') is not None else s))
            v_pr = float(v.get('price') or pr)
            v_co = float(v.get('cost_price') or co)
            db_cats[c_norm]["stock"] += v_s
            db_cats[c_norm]["cost"] += v_s * v_co
            db_cats[c_norm]["sale"] += v_s * v_pr
    else:
        s_pos = max(0, s)
        db_cats[c_norm]["stock"] += s_pos
        db_cats[c_norm]["cost"] += s_pos * co
        db_cats[c_norm]["sale"] += s_pos * pr

print("\n=== DB BY MAPPED CATEGORY ===")
for cat, d in sorted(db_cats.items()):
    print(f"{cat.ljust(25)} | Stock: {d['stock']:>7.0f} | Cost: Q{d['cost']:>10.2f} | Sale: Q{d['sale']:>10.2f}")

print("\n=== COMPARISON BY CATEGORY ===")
all_cat_names = set(list(user_cats.keys()) + list(db_cats.keys()))
for cat in sorted(all_cat_names):
    u = user_cats.get(cat, {"stock": 0, "cost": 0, "sale": 0})
    d = db_cats.get(cat, {"stock": 0, "cost": 0, "sale": 0})
    diff_s = d['stock'] - u['stock']
    diff_c = d['cost'] - u['cost']
    diff_v = d['sale'] - u['sale']
    print(f"{cat.ljust(25)}: Stock Diff: {diff_s:>+6.0f} | Cost Diff: Q{diff_c:>+9.2f} | Sale Diff: Q{diff_v:>+9.2f}")
