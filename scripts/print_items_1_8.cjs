const fs = require('fs');
const data = JSON.parse(fs.readFileSync('scripts/notebook_search_results.json', 'utf-8'));

for (let i = 0; i < 8; i++) {
  const entry = data[i];
  const target = entry.item;
  console.log(`📌 #${target.id} Cuaderno: "${target.name}" — Lugar: ${target.place}`);
  console.log(`   Invoices count: ${entry.invoices.length}`);
  entry.invoices.forEach(inv => {
    console.log(`      • Folio: ${inv.folio} | Fecha: ${inv.date ? String(inv.date).split('T')[0] : 'S/F'} | Cliente Factura: "${inv.clientName}" | Total: Q${inv.totalAmount} | Vendedor: ${inv.seller_name || inv.sellerId}`);
  });
  console.log(`   Clients count: ${entry.clients.length}`);
  entry.clients.forEach(c => {
    console.log(`      • "${c.name}" | "${c.companyName}" | "${c.address}" | Vendedor: ${c.seller_name || c.sellerId}`);
  });
  console.log('');
}
