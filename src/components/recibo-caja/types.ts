export interface FacturaDetalle {
  no_factura: string;
  fecha_factura: string;
  valor: number;
}

export interface ChequeDetalle {
  no_cheque: string;
  banco: string;
  valor: number;
}

export interface ReciboCajaDB {
  id?: string;
  folio: string;
  numero_secuencial?: number;
  fecha: string;
  cliente_nombre: string;
  cliente_nit: string;
  cliente_codigo: string;
  cantidad_letras: string;
  facturas: FacturaDetalle[];
  cheques: ChequeDetalle[];
  efectivo_total: number;
  monto_total: number;
  observaciones: string;
  cajero_nombre: string;
  created_at?: string;
}
