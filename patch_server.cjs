const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
  "let { client, nit, phone, address, items, isOwed, notes, sellerSignature } = req.body;",
  "let { client, nit, phone, address, items, isOwed, notes, sellerSignature, sellerId } = req.body;"
);

code = code.replace(
  "updateData.notes = notes;\n            await supabase.from(\"invoices\").update(updateData).eq('id', id);",
  "updateData.notes = notes;\n            if (sellerId !== undefined) { updateData.sellerId = sellerId; }\n            await supabase.from(\"invoices\").update(updateData).eq('id', id);"
);

code = code.replace(
  "    await supabase.from(\"invoices\").update(updateData).eq('id', id);",
  "    if (sellerId !== undefined) { updateData.sellerId = sellerId; }\n    await supabase.from(\"invoices\").update(updateData).eq('id', id);"
);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts");
