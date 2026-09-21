const fs = require('fs');

const base38 = JSON.parse(fs.readFileSync('scripts/clean_master_audit_38.json', 'utf-8'));

const newClients = [
  {
    id: 39,
    nombre: "Jose Antonio Nufio",
    lugar: "San Andres",
    periodo: "Marzo / Abril",
    estado: "PENDIENTE",
    facturasErick: 0,
    totalErick: 0.0,
    folios: "Sin compras",
    vendedor: "Por coordinar",
    diagnostico: "Registrado en catálogo (Agro. El Canche en San Andrés), sin facturas emitidas en el periodo."
  },
  {
    id: 40,
    nombre: "Julio Morales",
    lugar: "Paxcaman",
    periodo: "Marzo",
    estado: "ACTIVO",
    facturasErick: 1,
    totalErick: 4226.00,
    folios: "856",
    vendedor: "Erick Juárez",
    diagnostico: "Atención comercial efectiva bajo Ferroagro Paxcaman en aldea Paxcaman, Flores Petén."
  },
  {
    id: 41,
    nombre: "Nery Paredes",
    lugar: "El Mango / Santa Ana",
    periodo: "Marzo / Abril",
    estado: "ACTIVO",
    facturasErick: 1,
    totalErick: 3548.40,
    folios: "1074",
    vendedor: "Erick Juárez",
    diagnostico: "Venta documentada al día en Agroservicio El Campesino (Aldea El Mango, Santa Ana)."
  },
  {
    id: 42,
    nombre: "Mariela Salguero",
    lugar: "San Luis",
    periodo: "Marzo",
    estado: "PENDIENTE",
    facturasErick: 0,
    totalErick: 0.0,
    folios: "Sin compras",
    vendedor: "Por coordinar",
    diagnostico: "Sin registro de ventas en San Luis Petén durante el periodo auditado."
  },
  {
    id: 43,
    nombre: "Marvin Reyes",
    lugar: "Santa Elena",
    periodo: "Marzo",
    estado: "ACTIVO",
    facturasErick: 2,
    totalErick: 2450.00,
    folios: "857, 906",
    vendedor: "Erick Juárez",
    diagnostico: "Recompras consecutivas atendidas por Erick en Agroveterinaria Eben-Ezer (Santa Elena)."
  },
  {
    id: 44,
    nombre: "Yeimy Catalan",
    lugar: "San Andres Dos Aguadas",
    periodo: "Abril",
    estado: "ACTIVO",
    facturasErick: 2,
    totalErick: 6140.00,
    folios: "913, 1043",
    vendedor: "Erick Juárez",
    diagnostico: "Excelente nivel de facturación en Agroveterinaria DR (Cruce Dos Aguadas San Andrés)."
  },
  {
    id: 45,
    nombre: "Daniel Luis (Agro Rural)",
    lugar: "Santa Elena",
    periodo: "Abril",
    estado: "PENDIENTE",
    facturasErick: 0,
    totalErick: 0.0,
    folios: "Sin compras",
    vendedor: "Por coordinar",
    diagnostico: "Registrado en catálogo (Agro. Rural / Daniel Luis en Ave. Telgua Santa Elena) sin compras en periodo."
  },
  {
    id: 46,
    nombre: "Maria Izabel",
    lugar: "San Luis",
    periodo: "Abril",
    estado: "PENDIENTE",
    facturasErick: 0,
    totalErick: 0.0,
    folios: "Sin compras",
    vendedor: "Por coordinar",
    diagnostico: "Sin órdenes de compra registradas en San Luis Petén."
  }
];

const consolidated46 = [...base38, ...newClients];

fs.writeFileSync('scripts/clean_master_audit_46.json', JSON.stringify(consolidated46, null, 2), 'utf-8');
console.log('✅ clean_master_audit_46.json generado exitosamente.');

const activos = consolidated46.filter(x => x.estado === 'ACTIVO');
const pendientes = consolidated46.filter(x => x.estado === 'PENDIENTE');
const totalQ = consolidated46.reduce((a, b) => a + b.totalErick, 0);
const facturasTotales = consolidated46.reduce((a, b) => a + b.facturasErick, 0);

console.log(`Total Clientes: ${consolidated46.length}`);
console.log(`Activos: ${activos.length} (${((activos.length/consolidated46.length)*100).toFixed(1)}%)`);
console.log(`Pendientes: ${pendientes.length} (${((pendientes.length/consolidated46.length)*100).toFixed(1)}%)`);
console.log(`Total Facturado Erick: Q${totalQ.toLocaleString('es-GT', {minimumFractionDigits: 2})}`);
console.log(`Total Facturas Erick: ${facturasTotales}`);
