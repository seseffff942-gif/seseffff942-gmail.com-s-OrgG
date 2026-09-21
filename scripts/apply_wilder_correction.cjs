const fs = require('fs');

const data = JSON.parse(fs.readFileSync('scripts/clean_master_audit_52.json', 'utf-8'));

// 1. Corregir Wilder Lemus (ID 29)
const wilder = data.find(x => x.id === 29);
if (wilder) {
  wilder.estado = 'ACTIVO';
  wilder.facturasErick = 1;
  wilder.totalErick = 8880.00;
  wilder.folios = '1161';
  wilder.vendedor = 'Erick Juárez';
  wilder.diagnostico = 'Venta efectiva concretada en Agroveterinaria El Amigo (Poptún) por Q8,880.00 (Folio 1161).';
}

// 2. Actualizar Yeimy Catalán (ID 44) con el folio reciente 1174
const yeimy = data.find(x => x.id === 44);
if (yeimy) {
  yeimy.facturasErick = 3;
  yeimy.totalErick = 8318.00; // 4580 + 1560 + 2178
  yeimy.folios = '913, 1043, 1174';
  wilder.diagnostico = 'Cuenta de alto volumen con 3 compras registradas (Agroveterinaria DR, Cruce Dos Aguadas).';
}

// 3. Vincular Héctor Mendoza (ID 1) con Agroveterinaria La Mascota en El Remate
const hector = data.find(x => x.id === 1);
if (hector) {
  hector.estado = 'ACTIVO';
  hector.facturasErick = 2;
  hector.totalErick = 4147.00; // 2648 + 1499
  hector.folios = '919, 1177';
  hector.vendedor = 'Erick Juárez';
  hector.diagnostico = 'Atención comercial efectiva registrada bajo Agroveterinaria La Mascota (Aldea El Remate, Flores Petén).';
}

fs.writeFileSync('scripts/clean_master_audit_52.json', JSON.stringify(data, null, 2), 'utf-8');

const activos = data.filter(x => x.estado === 'ACTIVO');
const pendientes = data.filter(x => x.estado === 'PENDIENTE');
const totalQ = data.reduce((a, b) => a + b.totalErick, 0);
const facturasTotales = data.reduce((a, b) => a + b.facturasErick, 0);

console.log('=== RESULTADOS AUDITORÍA CON PRODUCCIÓN 100% SINCRONIZADA ===');
console.log(`Total Clientes: ${data.length}`);
console.log(`Activos: ${activos.length} (${((activos.length/data.length)*100).toFixed(1)}%)`);
console.log(`Pendientes: ${pendientes.length} (${((pendientes.length/data.length)*100).toFixed(1)}%)`);
console.log(`Total Facturado Erick: Q${totalQ.toLocaleString('es-GT', {minimumFractionDigits: 2})}`);
console.log(`Total Facturas Erick: ${facturasTotales}`);
