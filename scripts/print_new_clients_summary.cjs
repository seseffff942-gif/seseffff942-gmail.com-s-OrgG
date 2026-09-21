const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scripts/new_clients_audit_results.json', 'utf-8'));

console.log('========================================================================================');
console.log('AUDITORÍA DE NUEVA TANDA DE CLIENTES (PÁGINA 1 Y PÁGINA 2 - ENERO, FEBRERO, MARZO)');
console.log('========================================================================================\n');

let total = data.length;
let conVenta = data.filter(x => x.erickInvoicesCount > 0).length;
let sinVenta = total - conVenta;
let totalQ = data.reduce((a, b) => a + b.erickTotal, 0);

console.log(`Total registros analizados: ${total}`);
console.log(`Con venta efectiva de Erick: ${conVenta} (${((conVenta/total)*100).toFixed(1)}%)`);
console.log(`Sin venta / Pendientes: ${sinVenta} (${((sinVenta/total)*100).toFixed(1)}%)`);
console.log(`Total facturado por Erick a esta tanda: Q${totalQ.toLocaleString('es-GT', {minimumFractionDigits: 2})}\n`);

console.log('----------------------------------------------------------------------------------------');
console.log('DETALLE POR CLIENTE:');
console.log('----------------------------------------------------------------------------------------');

data.forEach((item, idx) => {
  const icon = item.erickInvoicesCount > 0 ? "✅" : "❌";
  console.log(`${icon} #${idx+1} [${item.section}] ${item.name} (${item.place}) -> ${item.status}`);
  if (item.erickInvoicesCount > 0) {
    console.log(`   💰 Total Erick: Q${item.erickTotal.toLocaleString('es-GT', {minimumFractionDigits: 2})} | Facturas: ${item.erickInvoicesCount}`);
    console.log(`   🧾 Folios: ${item.folios}`);
  } else {
    console.log(`   ⚠️ Sin compras registradas.`);
    if (item.clientCatalog !== 'No registrado') {
      console.log(`   👤 En catálogo: ${item.clientCatalog}`);
    }
  }
  console.log('');
});
