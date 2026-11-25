# -*- coding: utf-8 -*-
with open('server.ts', 'r', encoding='utf-8') as f:
    s = f.read()

needle = '''    const horaTexto = corte === "17:00" ? "5:00 PM" : "12:00 PM";
    const tituloHorario = corte === "17:00" ? "CIERRE DEL D?A - 5:00 PM" : "CORTE DE MEDIOD?A - 12:00 PM";

    const adminRecipients = ['''

replacement = '''    const adminRecipients = ['''

if needle in s:
    s = s.replace(needle, replacement, 1)
    with open('server.ts', 'w', encoding='utf-8') as f:
        f.write(s)
    print("Deduplicated!")
else:
    print("Needle not found, checking exact lines...")

