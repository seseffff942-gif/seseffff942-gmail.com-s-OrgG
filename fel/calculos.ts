/**
 * FEL Guatemala — Calculos de IVA y totales
 *
 * REGLA DEL NEGOCIO (confirmada con el cliente):
 *   Los precios del sistema YA INCLUYEN el 12% de IVA.
 *   Un producto de Q50.00 se le cobra al cliente en Q50.00.
 *   FEL solo exige declarar ese monto descompuesto:
 *
 *     Gran total (lo que paga el cliente) .... Q50.00
 *     Monto gravable (base sin IVA) ......... Q44.642857
 *     Monto del IVA ......................... Q 5.357143
 *
 * CONSECUENCIA IMPORTANTE: ningun precio cambia para el cliente final.
 * La facturacion actual y la facturacion FEL dan el mismo total.
 *
 * INVARIANTE que todo el modulo respeta:
 *     montoGravable + montoIva === granTotal   (exacto, sin centavos perdidos)
 *
 * Se cumple calculando la base primero y derivando el IVA por RESTA,
 * nunca calculando ambos por separado (eso produce descuadres de 1 centavo
 * que SAT rechaza).
 */

export const TASA_IVA = 0.12;

/** Decimales para montos de dinero presentados al cliente. */
const DECIMALES_MONEDA = 2;
/** Decimales para el desglose fiscal. FEL admite mayor precision aqui. */
const DECIMALES_FISCAL = 6;

function redondear(valor: number, decimales: number): number {
  // Number.EPSILON corrige errores de punto flotante como 1.005 -> 1.00
  const factor = Math.pow(10, decimales);
  return Math.round((valor + Number.EPSILON) * factor) / factor;
}

export function redondearMoneda(valor: number): number {
  return redondear(valor, DECIMALES_MONEDA);
}

/**
 * Redondea hacia arriba a 2 decimales.
 *
 * Se normaliza a 6 decimales antes del techo porque en punto flotante
 * 7.77 * 100 da 777.0000000000001, y un Math.ceil directo lo subiria a 7.78.
 */
function techoMoneda(valor: number): number {
  const factor = Math.pow(10, DECIMALES_MONEDA);
  return Math.ceil(redondear(valor * factor, DECIMALES_FISCAL)) / factor;
}

/**
 * Descompone un monto que YA incluye IVA en su base gravable y su impuesto.
 * El IVA se obtiene por resta para garantizar que las partes sumen el total.
 */
export function desglosarIVA(totalConIva: number): {
  montoGravable: number;
  montoIva: number;
  granTotal: number;
} {
  const granTotal = redondearMoneda(totalConIva);
  const montoGravable = redondear(granTotal / (1 + TASA_IVA), DECIMALES_FISCAL);
  const montoIva = redondear(granTotal - montoGravable, DECIMALES_FISCAL);

  return { montoGravable, montoIva, granTotal };
}

export interface LineaFactura {
  cantidad: number;
  precioUnitario: number; // con IVA incluido
  descuento?: number;     // con IVA incluido
  descripcion?: string;
}

export interface ItemFEL {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  /** Cantidad x precio unitario, antes de descuento. */
  precio: number;
  descuento: number;
  /** precio - descuento. Es el total de la linea, con IVA. */
  total: number;
  montoGravable: number;
  montoIva: number;
}

/**
 * Calcula una linea de la factura en el formato que exige el DTE.
 *
 * REGLA 2.3.1 DE SAT: al recibir el XML, SAT NO confia en el campo Precio,
 * lo recalcula como PrecioUnitario x Cantidad con los valores que le llegaron.
 * Si no coincide, rechaza el documento con FEL-GUI-15.
 *
 * Por eso el precio unitario se redondea ANTES de multiplicar, no despues.
 * Antes se calculaba el precio con el unitario sin redondear y se declaraba
 * el unitario ya redondeado: una linea de 13 unidades a Q180.00 (unitario
 * 13.846153...) viajaba como PrecioUnitario 13.85 y Precio 180.00, y SAT
 * calculaba 13.85 x 13 = 180.05 y la rechazaba.
 *
 * El redondeo del unitario es HACIA ARRIBA para que el descuento resultante
 * nunca sea negativo: SAT tampoco acepta descuentos negativos.
 *
 * La diferencia de redondeo se declara como descuento, igual que un descuento
 * comercial. El total de la linea —lo que el cliente paga— no cambia.
 */
export function calcularItem(linea: LineaFactura): ItemFEL {
  // Lo que el sistema le cobra al cliente por esta linea. Es el valor que
  // debe preservarse: todo lo demas se acomoda alrededor de el.
  const totalReal = redondearMoneda(
    linea.cantidad * linea.precioUnitario - (linea.descuento ?? 0)
  );

  const precioUnitario = techoMoneda(linea.precioUnitario);
  const precio = redondearMoneda(linea.cantidad * precioUnitario);

  // Absorbe el descuento comercial y la diferencia de redondeo del unitario.
  const descuento = redondearMoneda(precio - totalReal);
  const total = redondearMoneda(precio - descuento);

  const { montoGravable, montoIva } = desglosarIVA(total);

  return {
    descripcion: linea.descripcion ?? '',
    cantidad: linea.cantidad,
    precioUnitario,
    precio,
    descuento,
    total,
    montoGravable,
    montoIva,
  };
}

export interface TotalesFEL {
  items: ItemFEL[];
  totalMontoGravable: number;
  totalMontoIva: number;
  granTotal: number;
}

/**
 * Calcula los totales del documento.
 *
 * El gran total se suma de los totales de linea (no se recalcula desde la
 * base) para que coincida exactamente con lo que el sistema ya le cobra
 * al cliente hoy.
 */
export function calcularTotales(lineas: LineaFactura[]): TotalesFEL {
  const items = lineas.map(calcularItem);

  const granTotal = redondearMoneda(
    items.reduce((suma, it) => suma + it.total, 0)
  );
  const totalMontoGravable = redondear(
    items.reduce((suma, it) => suma + it.montoGravable, 0),
    DECIMALES_FISCAL
  );
  // Por resta, para que gravable + iva === granTotal siempre.
  const totalMontoIva = redondear(granTotal - totalMontoGravable, DECIMALES_FISCAL);

  return { items, totalMontoGravable, totalMontoIva, granTotal };
}

/**
 * Verifica que un documento calculado cuadre. Usar antes de enviar a INFILE:
 * es mucho mas barato detectar un descuadre aqui que recibir el rechazo de SAT.
 */
export function validarCuadre(totales: TotalesFEL): { valido: boolean; motivo?: string } {
  const sumaPartes = redondear(
    totales.totalMontoGravable + totales.totalMontoIva,
    DECIMALES_FISCAL
  );

  if (Math.abs(sumaPartes - totales.granTotal) > 0.000001) {
    return {
      valido: false,
      motivo: `El desglose no cuadra: gravable (${totales.totalMontoGravable}) + IVA (${totales.totalMontoIva}) = ${sumaPartes}, pero el gran total es ${totales.granTotal}`,
    };
  }

  if (totales.granTotal <= 0) {
    return { valido: false, motivo: 'El gran total debe ser mayor que cero' };
  }

  return { valido: true };
}
