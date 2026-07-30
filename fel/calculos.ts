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

/** Decimales que admite el campo PrecioUnitario del XML del DTE. */
const DECIMALES_PRECIO_UNITARIO = 4;

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
 * El error estaba en redondear el precio unitario a 2 decimales. Una linea de
 * 13 unidades por Q180.00 tiene un unitario de 13.846153..., que se declaraba
 * como 13.85; SAT calculaba 13.85 x 13 = 180.05 contra un Precio de 180.00 y
 * la rechazaba.
 *
 * El campo PrecioUnitario del XML admite 4 decimales, asi que se declara con
 * esa precision (13.8462) en vez de recortarlo a 2. Asi el producto que
 * recalcula SAT queda dentro del centavo y no hace falta inventar un descuento
 * de cuadre en la factura del cliente.
 */
export function calcularItem(linea: LineaFactura): ItemFEL {
  const precioUnitario = redondear(linea.precioUnitario, DECIMALES_PRECIO_UNITARIO);
  const precio = redondearMoneda(linea.cantidad * precioUnitario);
  const descuento = redondearMoneda(linea.descuento ?? 0);
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
