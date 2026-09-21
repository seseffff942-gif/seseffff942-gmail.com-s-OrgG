const fs = require('fs');

const raw = fs.readFileSync('scripts/notebook_search_results.json', 'utf-8');
const data = JSON.parse(raw);

console.log('========================================================================================');
console.log('ANÁLISIS DE NOMBRES DEL CUADERNO EN BASE DE DATOS (DESDE FOLIO 809 EN ADELANTE)');
console.log('========================================================================================\n');

for (const entry of data) {
  const target = entry.item;
  console.log(`📌 #${target.id} Cuaderno: "${target.name}" — Lugar: ${target.place}`);
  
  if (entry.invoices.length > 0) {
    console.log(`   ✅ FACTURAS ENCONTRADAS (${entry.invoices.length}):`);
    entry.invoices.forEach(inv => {
      const d = inv.date ? String(inv.date).split('T')[0] : 'S/F';
      console.log(`      • Folio: ${inv.folio} | Fecha: ${d} | Cliente Factura: "${inv.clientName}" | Total: Q${inv.totalAmount} | Vendedor: ${inv.seller_name || inv.sellerId}`);
    });
  } else {
    console.log(`   ❌ FACTURAS: NO APARECE NINGUNA VENTA REGISTRADA`);
  }

  if (entry.clients.length > 0) {
    console.log(`   👤 REGISTRO EN CATÁLOGO DE CLIENTES:`);
    entry.clients.forEach(c => {
      console.log(`      • Cliente: "${c.name}" | Empresa: "${c.companyName || 'S/N'}" | Dirección: "${c.address || 'S/D'}" | Vendedor Asignado: ${c.seller_name || c.sellerId}`);
    });
  } else {
    console.log(`   ⚠️ CATÁLOGO: NO ESTÁ REGISTRADO COMO CLIENTE`);
  }
  console.log('');
}
