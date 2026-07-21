/**
 * Servicio de FEL: prepara documentos a partir de las facturas del sistema,
 * los guarda y consulta su estado.
 *
 * Recibe el cliente de Supabase como parametro para no duplicar la conexion
 * ni crear dependencias circulares con server.ts.
 */
import { calcularTotales, validarCuadre, type LineaFactura, type TotalesFEL } from './calculos';
import {
  certificarDTE,
  credencialesCompletas,
  InfileNoConfiguradoError,
  type CredencialesInfile,
} from './infile';

export type EstadoFEL = 'pendiente' | 'enviado' | 'certificado' | 'error' | 'anulado';
export type TipoDTE = 'FACT' | 'FCAM' | 'NCRE' | 'NDEB' | 'NABN' | 'RDON';

export interface ConfigFEL {
  nit_emisor?: string;
  nombre_emisor?: string;
  nombre_comercial?: string;
  direccion?: string;
  codigo_establecimiento?: number;
  afiliacion_iva?: string;
  iva_incluido?: boolean;
  tasa_iva?: number;
  moneda?: string;
  ambiente?: 'pruebas' | 'produccion';
  infile_usuario?: string;
  infile_llave_firma?: string;
  infile_llave_token?: string;
}

export interface DocumentoFEL {
  id: string;
  invoice_id: string;
  tipo_dte: TipoDTE;
  estado: EstadoFEL;
  numero_autorizacion?: string | null;
  serie?: string | null;
  numero?: string | null;
  fecha_certificacion?: string | null;
  monto_gravable?: number | null;
  monto_iva?: number | null;
  gran_total?: number | null;
  intentos?: number;
  mensaje_error?: string | null;
  creado_en?: string;
}

/** Campos de configuracion sin los cuales no se puede emitir un DTE. */
const CAMPOS_OBLIGATORIOS: (keyof ConfigFEL)[] = [
  'nit_emisor',
  'nombre_emisor',
  'direccion',
  'codigo_establecimiento',
];

export function configIncompleta(config: ConfigFEL | null): string[] {
  if (!config) return CAMPOS_OBLIGATORIOS as string[];
  return CAMPOS_OBLIGATORIOS.filter((c) => {
    const v = config[c];
    return v === null || v === undefined || v === '';
  }) as string[];
}

export async function obtenerConfig(supabase: any): Promise<ConfigFEL | null> {
  const { data, error } = await supabase.from('fel_config').select('*').eq('id', 1).maybeSingle();
  if (error) throw new Error(`No se pudo leer la configuracion FEL: ${error.message}`);
  return data ?? null;
}

export async function guardarConfig(supabase: any, cambios: Partial<ConfigFEL>): Promise<ConfigFEL> {
  const { data, error } = await supabase
    .from('fel_config')
    .update({ ...cambios, actualizado_en: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single();
  if (error) throw new Error(`No se pudo guardar la configuracion FEL: ${error.message}`);
  return data;
}

/**
 * Convierte los items de una factura del sistema en lineas para el DTE.
 *
 * Los precios del sistema YA incluyen IVA (regla confirmada con el cliente),
 * asi que el gran total del DTE coincide exactamente con lo que hoy se le
 * cobra al cliente.
 *
 * Si el total de la linea no es igual a cantidad x precio (por ofertas o
 * ajustes), la diferencia se declara como descuento.
 */
export function itemsALineas(items: any[]): LineaFactura[] {
  return (items || []).map((it) => {
    const cantidad = Number(it.quantity ?? it.cantidad ?? 0);
    const precioUnitario = Number(it.price ?? it.precio ?? 0);
    const totalLinea = Number(it.total ?? cantidad * precioUnitario);
    const bruto = cantidad * precioUnitario;
    const descuento = bruto > totalLinea ? bruto - totalLinea : 0;

    return {
      cantidad,
      precioUnitario,
      descuento,
      descripcion: it.productName ?? it.descripcion ?? 'Producto',
    };
  });
}

/**
 * Obtiene el NIT del receptor de una factura.
 *
 * OJO: el sistema NO guarda el NIT en la columna `nit`. Al crear la factura
 * lo escribe al inicio del campo `notes`, antes de las etiquetas `|||`:
 *
 *     "1234567-8|||OBS:...|||TYPE:veterinaria|||CREDIT:30"
 *
 * Al leer facturas, server.ts lo extrae con unas heuristicas para distinguir
 * un NIT de una observacion. Aqui se replican esas mismas reglas, porque el
 * servicio FEL lee la fila cruda de la base y no pasa por ese mapeo.
 *
 * (Deuda tecnica: esta logica de parseo esta duplicada. Convendria unificarla
 * en un solo lugar cuando se modularice server.ts.)
 */
export function extraerNit(invoice: any): string {
  const directo = (invoice?.nit ?? '').toString().trim();
  if (directo) return directo;

  const notas = (invoice?.notes ?? '').toString();
  if (!notas.includes('|||')) return '';

  const posible = notas.split('|||')[0].trim();
  if (!posible) return '';

  // Si el texto es largo o parece una nota de entrega, no es un NIT.
  const bajo = posible.toLowerCase();
  if (posible.length > 25 || bajo.includes('enviar') || bajo.includes('entrega') || bajo.includes('nota')) {
    return '';
  }
  return posible;
}

/** En FEL, "CF" identifica a un consumidor final. Es un valor valido. */
export function esConsumidorFinal(nit: string): boolean {
  const n = nit.toUpperCase().replace(/[\s/\-\.]/g, '');
  return n === '' || n === 'CF' || n === 'CONSUMIDORFINAL';
}

export interface PreparacionDTE {
  totales: TotalesFEL;
  advertencias: string[];
  nitReceptor: string;
}

/**
 * Calcula el desglose fiscal de una factura y avisa de cualquier problema
 * ANTES de enviarla al certificador. Detectar un descuadre aqui es mucho mas
 * barato que recibir el rechazo de SAT.
 */
export function prepararDTE(invoice: any): PreparacionDTE {
  const advertencias: string[] = [];
  const lineas = itemsALineas(invoice?.items || []);
  const nitReceptor = extraerNit(invoice);

  if (lineas.length === 0) advertencias.push('La factura no tiene items.');

  // Solo se avisa cuando NO hay NIT. Si el cliente es consumidor final, el
  // valor "CF" es correcto y no amerita advertencia.
  if (!nitReceptor) {
    advertencias.push('La factura no tiene NIT del receptor; se emitira como consumidor final (CF).');
  }

  const totales = calcularTotales(lineas);
  const cuadre = validarCuadre(totales);
  if (!cuadre.valido) advertencias.push(cuadre.motivo!);

  const totalSistema = Number(invoice?.totalAmount ?? 0);
  if (totalSistema > 0 && Math.abs(totalSistema - totales.granTotal) > 0.01) {
    advertencias.push(
      `El total calculado (Q${totales.granTotal.toFixed(2)}) no coincide con el de la factura (Q${totalSistema.toFixed(2)}).`
    );
  }

  return { totales, advertencias, nitReceptor };
}

export async function obtenerDocumentoPorFactura(
  supabase: any,
  invoiceId: string
): Promise<DocumentoFEL | null> {
  const { data, error } = await supabase
    .from('fel_documentos')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('creado_en', { ascending: false })
    .limit(1);
  if (error) throw new Error(`No se pudo leer el documento FEL: ${error.message}`);
  return data && data.length ? data[0] : null;
}

export async function listarDocumentos(
  supabase: any,
  filtros: { estado?: string; limite?: number } = {}
): Promise<DocumentoFEL[]> {
  let q = supabase.from('fel_documentos').select('*').order('creado_en', { ascending: false });
  if (filtros.estado) q = q.eq('estado', filtros.estado);
  q = q.limit(filtros.limite ?? 200);
  const { data, error } = await q;
  if (error) throw new Error(`No se pudieron listar los documentos FEL: ${error.message}`);
  return data || [];
}

async function registrarBitacora(supabase: any, entrada: Record<string, any>) {
  try {
    await supabase.from('fel_bitacora').insert(entrada);
  } catch {
    // La bitacora nunca debe tumbar la operacion principal.
  }
}

export interface ResultadoCertificacion {
  documento: DocumentoFEL;
  advertencias: string[];
  /** true si realmente se certifico ante SAT. */
  certificado: boolean;
  mensaje?: string;
}

/**
 * Prepara y (cuando haya credenciales) certifica una factura ante INFILE.
 *
 * Mientras la integracion no este configurada, el documento queda guardado en
 * estado 'pendiente' con su desglose ya calculado. Asi el flujo completo se
 * puede probar hoy y, al llegar las credenciales, solo se conecta el ultimo paso.
 */
export async function certificarFactura(
  supabase: any,
  invoice: any,
  opciones: { tipoDte?: TipoDTE } = {}
): Promise<ResultadoCertificacion> {
  const inicio = Date.now();
  const config = await obtenerConfig(supabase);
  const faltantes = configIncompleta(config);
  const tipoDte: TipoDTE = opciones.tipoDte ?? 'FACT';

  const { totales, advertencias } = prepararDTE(invoice);
  if (faltantes.length) {
    advertencias.push(`Falta completar la configuracion del emisor: ${faltantes.join(', ')}.`);
  }

  // Reutiliza el documento existente si ya hubo intentos previos.
  const existente = await obtenerDocumentoPorFactura(supabase, invoice.id);
  if (existente && existente.estado === 'certificado') {
    return {
      documento: existente,
      advertencias,
      certificado: true,
      mensaje: 'Esta factura ya estaba certificada.',
    };
  }

  const id = existente?.id ?? `fel-${invoice.id}-${Date.now()}`;
  const base = {
    id,
    invoice_id: invoice.id,
    tipo_dte: tipoDte,
    monto_gravable: totales.totalMontoGravable,
    monto_iva: totales.totalMontoIva,
    gran_total: totales.granTotal,
    intentos: (existente?.intentos ?? 0) + 1,
    actualizado_en: new Date().toISOString(),
  };

  const credenciales: CredencialesInfile = {
    usuario: config?.infile_usuario ?? '',
    llaveFirma: config?.infile_llave_firma ?? '',
    llaveToken: config?.infile_llave_token ?? '',
    ambiente: (config?.ambiente as any) ?? 'pruebas',
  };

  const puedeCertificar = faltantes.length === 0 && credencialesCompletas(credenciales);

  if (!puedeCertificar) {
    const motivo = new InfileNoConfiguradoError().message;
    const registro = { ...base, estado: 'pendiente' as EstadoFEL, mensaje_error: motivo };
    const { data, error } = await supabase
      .from('fel_documentos')
      .upsert(registro, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw new Error(`No se pudo guardar el documento FEL: ${error.message}`);

    await registrarBitacora(supabase, {
      documento_id: id,
      invoice_id: invoice.id,
      operacion: 'certificar',
      exito: false,
      codigo_respuesta: 'NO_CONFIGURADO',
      mensaje: motivo,
      duracion_ms: Date.now() - inicio,
    });

    return { documento: data, advertencias, certificado: false, mensaje: motivo };
  }

  // --- Camino real: se ejecutara cuando existan credenciales de INFILE ---
  try {
    const xml = ''; // TODO: generar el XML del DTE con los XML de ejemplo de INFILE
    const resp = await certificarDTE(xml, credenciales);

    const registro = {
      ...base,
      estado: (resp.exito ? 'certificado' : 'error') as EstadoFEL,
      numero_autorizacion: resp.numeroAutorizacion ?? null,
      serie: resp.serie ?? null,
      numero: resp.numero ?? null,
      xml_certificado: resp.xmlCertificado ?? null,
      fecha_certificacion: resp.exito ? new Date().toISOString() : null,
      mensaje_error: resp.exito ? null : resp.mensaje ?? 'Rechazado por el certificador',
    };

    const { data, error } = await supabase
      .from('fel_documentos')
      .upsert(registro, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw new Error(`No se pudo guardar el documento FEL: ${error.message}`);

    await registrarBitacora(supabase, {
      documento_id: id,
      invoice_id: invoice.id,
      operacion: 'certificar',
      exito: resp.exito,
      codigo_respuesta: resp.codigo ?? null,
      mensaje: resp.mensaje ?? null,
      duracion_ms: Date.now() - inicio,
    });

    return {
      documento: data,
      advertencias,
      certificado: !!resp.exito,
      mensaje: resp.mensaje,
    };
  } catch (e: any) {
    const registro = { ...base, estado: 'error' as EstadoFEL, mensaje_error: e?.message ?? String(e) };
    const { data } = await supabase
      .from('fel_documentos')
      .upsert(registro, { onConflict: 'id' })
      .select()
      .single();

    await registrarBitacora(supabase, {
      documento_id: id,
      invoice_id: invoice.id,
      operacion: 'certificar',
      exito: false,
      mensaje: e?.message ?? String(e),
      duracion_ms: Date.now() - inicio,
    });

    return {
      documento: data ?? ({ ...registro } as any),
      advertencias,
      certificado: false,
      mensaje: e?.message ?? String(e),
    };
  }
}
