const fs = require('fs');

const base46 = JSON.parse(fs.readFileSync('scripts/clean_master_audit_46.json', 'utf-8'));

const newClients = [
  {
    id: 47,
    nombre: "Jorlin Ipiña",
    lugar: "San Luis",
    periodo: "Mayo",
    estado: "PENDIENTE",
    facturasErick: 0,
    totalErick: 0.0,
    folios: "Sin compras individuales",
    vendedor: "Por coordinar",
    diagnostico: "Vinculado a Ferroagro Morales / Sara Ipiña en Chacalté. Sin facturación individual emitida."
  },
  {
    id: 48,
    nombre: "David Monroy",
    lugar: "San Luis",
    periodo: "Mayo",
    estado: "PENDIENTE",
    facturasErick: 0,
    totalErick: 0.0,
    folios: "Sin compras",
    vendedor: "Por coordinar",
    diagnostico: "Sin órdenes de compra registradas en San Luis Petén durante el periodo auditado."
  },
  {
    id: 49,
    nombre: "Angel Hidalgo",
    lugar: "El Chal",
    periodo: "Mayo",
    estado: "PENDIENTE",
    facturasErick: 0,
    totalErick: 0.0,
    folios: "Sin compras",
    vendedor: "Por coordinar",
    diagnostico: "Sin historial de compra registrado en El Chal. Programar visita de prospección comercial."
  },
  {
    id: 50,
    nombre: "Byron Escobar",
    lugar: "Dolores",
    periodo: "Mayo",
    estado: "ACTIVO",
    facturasErick: 1,
    totalErick: 1047.50,
    folios: "1015",
    vendedor: "Erick Juárez",
    diagnostico: "Venta efectiva concretada en Agroveterinaria Escobar (Aldea Boca del Monte, Dolores Petén)."
  },
  {
    id: 51,
    nombre: "Yamileth Lopez",
    lugar: "Macanche Flores",
    periodo: "Junio",
    estado: "PENDIENTE",
    facturasErick: 0,
    totalErick: 0.0,
    folios: "Sin compras",
    vendedor: "Por coordinar",
    diagnostico: "Sin registro de ventas en Macanché, Flores Petén."
  },
  {
    id: 52,
    nombre: "Jaime Sagastume",
    lugar: "El Chal",
    periodo: "Junio",
    estado: "ACTIVO",
    facturasErick: 2,
    totalErick: 2320.00,
    folios: "818, 940",
    vendedor: "Erick Juárez",
    diagnostico: "Seguimiento comercial al día y dos compras registradas en Agroveterinaria Los Amigos (El Chal)."
  }
];

const consolidated52 = [...base46, ...newClients];

fs.writeFileSync('scripts/clean_master_audit_52.json', JSON.stringify(consolidated52, null, 2), 'utf-8');
console.log('✅ clean_master_audit_52.json generado exitosamente.');

const activos = consolidated52.filter(x => x.estado === 'ACTIVO');
const pendientes = consolidated52.filter(x => x.estado === 'PENDIENTE');
const totalQ = consolidated52.reduce((a, b) => a + b.totalErick, 0);
const facturasTotales = consolidated52.reduce((a, b) => a + b.facturasErick, 0);

console.log(`Total Clientes: ${consolidated52.length}`);
console.log(`Activos: ${activos.length} (${((activos.length/consolidated52.length)*100).toFixed(1)}%)`);
console.log(`Pendientes: ${pendientes.length} (${((pendientes.length/consolidated52.length)*100).toFixed(1)}%)`);
console.log(`Total Facturado Erick: Q${totalQ.toLocaleString('es-GT', {minimumFractionDigits: 2})}`);
console.log(`Total Facturas Erick: ${facturasTotales}`);
