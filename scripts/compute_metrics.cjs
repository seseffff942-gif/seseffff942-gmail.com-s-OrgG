const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scripts/detailed_reconciliation_report.json', 'utf-8'));

let totalFacturado = 0;
let totalFacturas = 0;
let encontradosCount = 0;
let noEncontradosCount = 0;

const sellerTotals = {};

data.forEach(item => {
  if (item.encontradoEnBD === 'SÍ') {
    encontradosCount++;
    totalFacturado += item.totalFacturado;
    totalFacturas += item.facturasCount;
    item.detalleFacturas.forEach(f => {
      const v = f.vendedor || 'Desconocido';
      sellerTotals[v] = (sellerTotals[v] || 0) + f.monto;
    });
  } else {
    noEncontradosCount++;
  }
});

console.log('--- METRICAS GENERALES ---');
console.log(`Total clientes en libreta: ${data.length}`);
console.log(`Clientes con ventas en BD: ${encontradosCount} (${((encontradosCount / data.length) * 100).toFixed(1)}%)`);
console.log(`Clientes sin ventas en BD: ${noEncontradosCount} (${((noEncontradosCount / data.length) * 100).toFixed(1)}%)`);
console.log(`Total facturado acumulado: Q${totalFacturado.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`);
console.log(`Total facturas emitidas: ${totalFacturas}`);
console.log('\n--- DISTRIBUCIÓN POR VENDEDOR ---');
for (const [s, val] of Object.entries(sellerTotals)) {
  const pct = ((val / totalFacturado) * 100).toFixed(1);
  console.log(`• ${s}: Q${val.toLocaleString('es-GT', { minimumFractionDigits: 2 })} (${pct}%)`);
}
