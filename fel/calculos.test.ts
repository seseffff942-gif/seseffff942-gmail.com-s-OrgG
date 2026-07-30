/**
 * Pruebas de los calculos fiscales de FEL.
 *
 * Ejecutar con:  npm run test:fel
 *
 * Correr SIEMPRE despues de tocar fel/calculos.ts. Un descuadre de un
 * centavo aqui se traduce en un rechazo de SAT en produccion.
 */
import { calcularTotales, validarCuadre, desglosarIVA, calcularItem } from './calculos.js';

let fallos = 0;
const check = (nombre: string, cond: boolean, extra = '') => {
  console.log(`  ${cond ? 'OK ' : 'FALLA'}  ${nombre}${extra ? '  ' + extra : ''}`);
  if (!cond) fallos++;
};

console.log('\n=== 1. Producto de Q50.00 (precio real del catalogo) ===');
const d = desglosarIVA(50.0);
console.log(`  Gran total ....... Q${d.granTotal}`);
console.log(`  Monto gravable ... Q${d.montoGravable}`);
console.log(`  Monto IVA ........ Q${d.montoIva}`);
check('las partes suman el total', +(d.montoGravable + d.montoIva).toFixed(6) === d.granTotal);
check('el cliente sigue pagando Q50.00', d.granTotal === 50.0);

console.log('\n=== 2. Factura tipica (varios productos del catalogo) ===');
const t2 = calcularTotales([
  { cantidad: 3, precioUnitario: 50.0, descripcion: 'Legatus mixx 30 OD litro' },
  { cantidad: 2, precioUnitario: 1200.0, descripcion: 'Incubadora Pro 50 Huevos' },
  { cantidad: 1, precioUnitario: 850.0, descripcion: 'Incubadora Automatica 24' },
]);
console.log(`  Gran total Q${t2.granTotal} | gravable Q${t2.totalMontoGravable} | IVA Q${t2.totalMontoIva}`);
check('cuadre valido', validarCuadre(t2).valido);
check('total = 150 + 2400 + 850 = 3400', t2.granTotal === 3400);

console.log('\n=== 3. Casos que rompen el redondeo ===');
for (const monto of [0.01, 0.05, 33.33, 99.99, 1.05, 7.77]) {
  const r = desglosarIVA(monto);
  const suma = +(r.montoGravable + r.montoIva).toFixed(6);
  check(`Q${monto}`, suma === r.granTotal, `-> ${r.montoGravable} + ${r.montoIva} = ${suma}`);
}

console.log('\n=== 4. Factura grande (50 lineas con centavos) ===');
const lineas = Array.from({ length: 50 }, (_, i) => ({
  cantidad: (i % 7) + 1,
  precioUnitario: +(10.33 + i * 1.17).toFixed(2),
  descripcion: `Producto ${i + 1}`,
}));
const t4 = calcularTotales(lineas);
const v4 = validarCuadre(t4);
console.log(`  Gran total Q${t4.granTotal} | gravable Q${t4.totalMontoGravable} | IVA Q${t4.totalMontoIva}`);
check('cuadre valido en 50 lineas', v4.valido, v4.motivo ?? '');
const sumaDirecta = +lineas
  .map((l) => +(l.cantidad * l.precioUnitario).toFixed(2))
  .reduce((a, b) => a + b, 0)
  .toFixed(2);
check('el total coincide con la suma directa', t4.granTotal === sumaDirecta, `${t4.granTotal} vs ${sumaDirecta}`);

console.log('\n=== 5. Con descuento ===');
const t5 = calcularTotales([{ cantidad: 10, precioUnitario: 50.0, descuento: 75.5 }]);
console.log(`  500.00 - 75.50 = Q${t5.granTotal}`);
check('cuadre con descuento', validarCuadre(t5).valido);
check('total correcto', t5.granTotal === 424.5);

console.log('\n=== 6. Regla 2.3.1 de SAT: Precio == PrecioUnitario x Cantidad ===');
// SAT recalcula el Precio con los valores del XML. Si el precio unitario se
// redondea despues de multiplicar, no cuadra y rechaza con FEL-GUI-15.
// El primer caso es el rechazo real recibido: 13 unidades por Q180.00.
const casos231: Array<{ cantidad: number; totalDeseado: number; nota: string }> = [
  { cantidad: 13, totalDeseado: 180.0, nota: 'rechazo real FEL-GUI-15' },
  { cantidad: 3, totalDeseado: 100.0, nota: '100/3 no divide exacto' },
  { cantidad: 7, totalDeseado: 50.0, nota: '50/7 no divide exacto' },
  { cantidad: 6, totalDeseado: 1000.0, nota: '1000/6 periodico' },
  { cantidad: 9, totalDeseado: 0.99, nota: 'centavos' },
  { cantidad: 1, totalDeseado: 7.77, nota: 'exacto, no debe generar descuento' },
  { cantidad: 2, totalDeseado: 50.0, nota: 'exacto, no debe generar descuento' },
];

for (const { cantidad, totalDeseado, nota } of casos231) {
  const item = calcularItem({ cantidad, precioUnitario: totalDeseado / cantidad });

  // Esto es literalmente lo que hace SAT al validar la linea.
  const precioSegunSat = +(item.precioUnitario * item.cantidad).toFixed(2);

  check(
    `${cantidad} x Q${item.precioUnitario} (${nota})`,
    precioSegunSat === item.precio,
    `SAT calcula ${precioSegunSat}, el XML declara ${item.precio}`
  );
  check(
    `  descuento no negativo`,
    item.descuento >= 0,
    `descuento ${item.descuento}`
  );
  check(
    `  el cliente sigue pagando Q${totalDeseado}`,
    item.total === totalDeseado,
    `total ${item.total}`
  );
}

// Los precios exactos no deben inventar un descuento.
const exacto = calcularItem({ cantidad: 2, precioUnitario: 25.0 });
check('precio exacto no genera descuento', exacto.descuento === 0, `descuento ${exacto.descuento}`);

// Un descuento comercial real se conserva y se suma al de redondeo.
const conDesc = calcularItem({ cantidad: 4, precioUnitario: 10.0, descuento: 5.0 });
check('descuento comercial se respeta', conDesc.total === 35.0, `total ${conDesc.total}`);
check(
  'descuento comercial cumple 2.3.1',
  +(conDesc.precioUnitario * conDesc.cantidad).toFixed(2) === conDesc.precio
);

console.log(`\n${fallos === 0 ? '*** TODAS LAS PRUEBAS PASARON ***' : `*** ${fallos} PRUEBAS FALLARON ***`}\n`);
process.exit(fallos === 0 ? 0 : 1);
