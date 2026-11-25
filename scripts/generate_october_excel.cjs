const fs = require('fs');
const XLSX = require('xlsx');

// Read JSON
let raw = fs.readFileSync('oct_fel_data.json', 'utf8').replace(/^\uFEFF/, '');
const data = JSON.parse(raw);

console.log('Loaded records:', data.length);

const activas = data.filter(d => d.estado === 'certificado');
const anuladas = data.filter(d => d.estado === 'anulado');

const totalActivasMonto = activas.reduce((acc, d) => acc + (Number(d.gran_total) || 0), 0);
const totalActivasGravable = activas.reduce((acc, d) => acc + (Number(d.monto_gravable) || 0), 0);
const totalActivasIva = activas.reduce((acc, d) => acc + (Number(d.monto_iva) || 0), 0);

const totalAnuladasMonto = anuladas.reduce((acc, d) => acc + (Number(d.gran_total) || 0), 0);
const totalAnuladasGravable = anuladas.reduce((acc, d) => acc + (Number(d.monto_gravable) || 0), 0);
const totalAnuladasIva = anuladas.reduce((acc, d) => acc + (Number(d.monto_iva) || 0), 0);

// Prepare rows for main sheet
const rows = data.map((d, index) => {
  return {
    'No.': index + 1,
    'ID Factura': d.invoice_id || '',
    'Folio': d.folio ? Number(d.folio) : (d.estado === 'anulado' ? 'ANULADO' : ''),
    'Fecha Certificación (FEL)': d.fecha_certificacion_gt || '',
    'NIT Receptor': d.nit || 'CF',
    'Nombre del Cliente': d.cliente || '',
    'Serie FEL': d.serie || '',
    'Número DTE (No. Factura)': d.dte_numero || '',
    'Autorización (UUID FEL)': d.uuid_fel || '',
    'Subtotal (Sin IVA)': Number(Number(d.monto_gravable).toFixed(2)) || 0,
    'IVA (12%)': Number(Number(d.monto_iva).toFixed(2)) || 0,
    'Total (Q)': Number(Number(d.gran_total).toFixed(2)) || 0,
    'Estado': d.estado === 'certificado' ? 'ACTIVA' : 'ANULADA',
    'Motivo Anulación': d.motivo_anulacion || '',
    'Fecha Anulación': d.fecha_anulacion_gt || ''
  };
});

// Append Totals row to the table
rows.push({
  'No.': '',
  'ID Factura': 'TOTALES FACTURAS ACTIVAS',
  'Folio': `${activas.length} activas`,
  'Fecha Certificación (FEL)': '',
  'NIT Receptor': '',
  'Nombre del Cliente': '',
  'Serie FEL': '',
  'Número DTE (No. Factura)': '',
  'Autorización (UUID FEL)': '',
  'Subtotal (Sin IVA)': Number(totalActivasGravable.toFixed(2)),
  'IVA (12%)': Number(totalActivasIva.toFixed(2)),
  'Total (Q)': Number(totalActivasMonto.toFixed(2)),
  'Estado': 'VIGENTES',
  'Motivo Anulación': '',
  'Fecha Anulación': ''
});

rows.push({
  'No.': '',
  'ID Factura': 'TOTALES FACTURAS ANULADAS',
  'Folio': `${anuladas.length} anuladas`,
  'Fecha Certificación (FEL)': '',
  'NIT Receptor': '',
  'Nombre del Cliente': '',
  'Serie FEL': '',
  'Número DTE (No. Factura)': '',
  'Autorización (UUID FEL)': '',
  'Subtotal (Sin IVA)': Number(totalAnuladasGravable.toFixed(2)),
  'IVA (12%)': Number(totalAnuladasIva.toFixed(2)),
  'Total (Q)': Number(totalAnuladasMonto.toFixed(2)),
  'Estado': 'ANULADAS',
  'Motivo Anulación': '',
  'Fecha Anulación': ''
});

// Create worksheet
const ws = XLSX.utils.json_to_sheet(rows);

// Set column widths
ws['!cols'] = [
  { wch: 5 },  // No.
  { wch: 28 }, // ID Factura
  { wch: 12 }, // Folio
  { wch: 22 }, // Fecha Certificacion
  { wch: 14 }, // NIT
  { wch: 48 }, // Cliente
  { wch: 12 }, // Serie
  { wch: 18 }, // Numero DTE
  { wch: 40 }, // UUID
  { wch: 18 }, // Subtotal
  { wch: 14 }, // IVA
  { wch: 16 }, // Total
  { wch: 12 }, // Estado
  { wch: 25 }, // Motivo Anulacion
  { wch: 22 }  // Fecha Anulacion
];

// Summary Sheet
const summaryRows = [
  { 'CONCEPTO': 'RESUMEN FACTURACIÓN ELECTRÓNICA FEL - OCTUBRE 2026', 'CANTIDAD': '', 'MONTO TOTAL (Q)': '' },
  { 'CONCEPTO': 'Período Contable', 'CANTIDAD': '01/10/2026 al 31/10/2026', 'MONTO TOTAL (Q)': '' },
  { 'CONCEPTO': 'Folio Inicial Certificado', 'CANTIDAD': '1211 (01/10/2026 07:24:29)', 'MONTO TOTAL (Q)': '' },
  { 'CONCEPTO': 'Folio Final Certificado', 'CANTIDAD': '1338 (31/10/2026 11:28:54)', 'MONTO TOTAL (Q)': '' },
  { 'CONCEPTO': '', 'CANTIDAD': '', 'MONTO TOTAL (Q)': '' },
  { 'CONCEPTO': 'FACTURAS ACTIVAS / VIGENTES', 'CANTIDAD': activas.length, 'MONTO TOTAL (Q)': Number(totalActivasMonto.toFixed(2)) },
  { 'CONCEPTO': '  - Subtotal sin IVA (Base Gravable)', 'CANTIDAD': '', 'MONTO TOTAL (Q)': Number(totalActivasGravable.toFixed(2)) },
  { 'CONCEPTO': '  - IVA Total (12%)', 'CANTIDAD': '', 'MONTO TOTAL (Q)': Number(totalActivasIva.toFixed(2)) },
  { 'CONCEPTO': '', 'CANTIDAD': '', 'MONTO TOTAL (Q)': '' },
  { 'CONCEPTO': 'FACTURAS ANULADAS', 'CANTIDAD': anuladas.length, 'MONTO TOTAL (Q)': Number(totalAnuladasMonto.toFixed(2)) },
  { 'CONCEPTO': '  - Subtotal Anulado (Sin IVA)', 'CANTIDAD': '', 'MONTO TOTAL (Q)': Number(totalAnuladasGravable.toFixed(2)) },
  { 'CONCEPTO': '  - IVA Anulado (12%)', 'CANTIDAD': '', 'MONTO TOTAL (Q)': Number(totalAnuladasIva.toFixed(2)) },
  { 'CONCEPTO': '', 'CANTIDAD': '', 'MONTO TOTAL (Q)': '' },
  { 'CONCEPTO': 'TOTAL DTEs PROCESADOS ANTE SAT', 'CANTIDAD': data.length, 'MONTO TOTAL (Q)': Number((totalActivasMonto + totalAnuladasMonto).toFixed(2)) }
];

const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
wsSummary['!cols'] = [
  { wch: 45 },
  { wch: 30 },
  { wch: 22 }
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Facturas Octubre 2026');
XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Contable');

const filename = 'Facturas_FEL_Octubre_2026.xlsx';
XLSX.writeFile(wb, filename);
console.log(`Excel created successfully: ${filename}`);
