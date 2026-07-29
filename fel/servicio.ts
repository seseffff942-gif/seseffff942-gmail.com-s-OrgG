/**
 * Servicio de FEL: prepara documentos a partir de las facturas del sistema,
 * los guarda y consulta su estado.
 *
 * Recibe el cliente de Supabase como parametro para no duplicar la conexion
 * ni crear dependencias circulares con server.ts.
 */
import { calcularTotales, validarCuadre, type LineaFactura, type TotalesFEL } from './calculos.js';
import {
  anularDTE,
  certificarDTE,
  credencialesCompletas,
  InfileNoConfiguradoError,
  type CredencialesInfile,
} from './infile.js';
import { construirXmlAnulacion, construirXmlDTE } from './xml.js';

export type EstadoFEL = 'pendiente' | 'enviado' | 'certificado' | 'error' | 'anulado';
export type TipoDTE = 'FACT' | 'FCAM' | 'NCRE' | 'NDEB' | 'NABN' | 'RDON';

/**
 * Plazo de la factura cambiaria, en dias. Por regla del negocio siempre es 30:
 * define la fecha de vencimiento del abono en el XML y debe coincidir con la
 * leyenda impresa (ver DIAS_CREDITO_FCAM en src/utils.ts).
 */
const DIAS_CREDITO_FCAM = 30;

/** Datos del receptor que se pueden ajustar antes de emitir (nombre y NIT). */
export interface ReceptorOverride {
  nit?: string;
  nombre?: string;
}

export interface ConfigFEL {
  nit_emisor?: string;
  nombre_emisor?: string;
  nombre_comercial?: string;
  direccion?: string;
  correo_emisor?: string;
  codigo_establecimiento?: number;
  afiliacion_iva?: string;
  iva_incluido?: boolean;
  tasa_iva?: number;
  moneda?: string;
  ambiente?: 'pruebas' | 'produccion';
  codigo_postal?: string;
  municipio?: string;
  departamento?: string;
  pais?: string;
  infile_usuario?: string;
  infile_llave_firma?: string;
  infile_llave_token?: string;
  infile_url?: string;
  tipo_dte_default?: string;
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

/**
 * Dias de credito de la factura, guardados como etiqueta |||CREDIT:n dentro
 * de `notes` (mismo formato interno que el resto del sistema).
 * Definen la fecha de vencimiento del abono en la factura cambiaria.
 */
export function extraerDiasCredito(invoice: any): number {
  const m = String(invoice?.notes ?? '').match(/\|\|\|CREDIT:(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
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
  opciones: { tipoDte?: TipoDTE; receptor?: ReceptorOverride } = {}
): Promise<ResultadoCertificacion> {
  const inicio = Date.now();
  const config = await obtenerConfig(supabase);
  const faltantes = configIncompleta(config);
  // El negocio factura con FACTURA CAMBIARIA (FCAM) por defecto; el tipo se
  // puede cambiar por peticion o en fel_config.tipo_dte_default.
  const tipoDte: TipoDTE = opciones.tipoDte ?? ((config?.tipo_dte_default as TipoDTE) || 'FCAM');

  const { totales, advertencias, nitReceptor } = prepararDTE(invoice);

  // Se pueden ajustar el nombre y el NIT del receptor antes de emitir (p. ej.
  // una venta a CF que al facturar necesita el NIT real). Solo afecta el DTE:
  // la factura interna y su folio no se tocan. Si no se envia override, se usan
  // los datos de la factura.
  const nitOverride = (opciones.receptor?.nit ?? '').toString().trim();
  const nombreOverride = (opciones.receptor?.nombre ?? '').toString().trim();
  const nitReceptorFinal = nitOverride || nitReceptor;
  const nombreReceptorFinal = nombreOverride || invoice.client || 'Consumidor Final';

  // Si el override trae un NIT real, la advertencia de "se emitira como CF"
  // (que prepararDTE agrega cuando la factura no tiene NIT) ya no aplica.
  if (nitOverride && !esConsumidorFinal(nitOverride)) {
    const i = advertencias.findIndex((a) => a.includes('consumidor final (CF)'));
    if (i >= 0) advertencias.splice(i, 1);
  }

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
    // Receptor efectivo con el que se emite (puede diferir del cliente de la
    // factura). Se guarda para que la representacion grafica impresa coincida
    // exactamente con lo certificado ante SAT.
    receptor_nit: nitReceptorFinal || 'CF',
    receptor_nombre: nombreReceptorFinal,
    intentos: (existente?.intentos ?? 0) + 1,
    actualizado_en: new Date().toISOString(),
  };

  const credenciales: CredencialesInfile = {
    usuario: config?.infile_usuario ?? '',
    llaveFirma: config?.infile_llave_firma ?? '',
    llaveToken: config?.infile_llave_token ?? '',
    url: config?.infile_url ?? '',
    ambiente: (config?.ambiente as any) ?? 'pruebas',
  };

  // El XML se genera y se guarda SIEMPRE que los datos del emisor esten
  // completos, aunque falten credenciales: queda constancia exacta de lo que
  // se enviaria y se puede revisar antes de la primera certificacion real.
  let xmlEnviado: string | null = null;
  if (faltantes.length === 0) {
    // Vencimiento del abono a 30 dias (plazo estandar del negocio), coherente
    // con la leyenda impresa de la factura cambiaria.
    const fechaBase = new Date(invoice.date || Date.now());
    const vencimiento = new Date(fechaBase.getTime() + DIAS_CREDITO_FCAM * 86400000).toISOString().slice(0, 10);

    xmlEnviado = construirXmlDTE(
      {
        nit: config!.nit_emisor!,
        nombre: config!.nombre_emisor!,
        nombreComercial: config!.nombre_comercial,
        correo: config!.correo_emisor,
        direccion: config!.direccion!,
        codigoPostal: config!.codigo_postal,
        municipio: config!.municipio,
        departamento: config!.departamento,
        pais: config!.pais,
        codigoEstablecimiento: config!.codigo_establecimiento!,
        afiliacionIva: config!.afiliacion_iva,
      },
      { nit: nitReceptorFinal || 'CF', nombre: nombreReceptorFinal, direccion: invoice.address, correo: invoice.email || invoice.clientEmail },
      totales,
      {
        tipo: (tipoDte === 'FCAM' ? 'FCAM' : 'FACT'),
        moneda: config?.moneda || 'GTQ',
        fechaVencimiento: vencimiento,
      }
    );
  }

  const puedeCertificar = faltantes.length === 0 && credencialesCompletas(credenciales);

  if (!puedeCertificar) {
    const motivo = new InfileNoConfiguradoError().message;
    const registro = { ...base, estado: 'pendiente' as EstadoFEL, mensaje_error: motivo, xml_enviado: xmlEnviado };
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

  // --- Certificacion real contra INFILE ---
  try {
    const resp = await certificarDTE(xmlEnviado!, credenciales, id);

    const registro = {
      ...base,
      estado: (resp.exito ? 'certificado' : 'error') as EstadoFEL,
      numero_autorizacion: resp.numeroAutorizacion ?? null,
      serie: resp.serie ?? null,
      numero: resp.numero ?? null,
      xml_enviado: xmlEnviado,
      xml_certificado: resp.xmlCertificado ?? null,
      respuesta_certificador: resp.respuestaCompleta ?? null,
      fecha_certificacion: resp.exito ? (resp.fecha ?? new Date().toISOString()) : null,
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
      codigo_respuesta: resp.codigo ?? (resp.exito ? 'CERTIFICADO' : null),
      mensaje: resp.mensaje ?? null,
      respuesta: resp.respuestaCompleta ?? null,
      duracion_ms: Date.now() - inicio,
    });

    return {
      documento: data,
      // Las alertas de una certificacion exitosa (p. ej. el aviso de SandBox en
      // pruebas) se suman a las advertencias para que queden a la vista.
      advertencias: resp.alertas?.length ? [...advertencias, ...resp.alertas] : advertencias,
      certificado: !!resp.exito,
      mensaje: resp.mensaje,
    };
  } catch (e: any) {
    const registro = { ...base, estado: 'error' as EstadoFEL, mensaje_error: e?.message ?? String(e), xml_enviado: xmlEnviado };
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

export interface ResultadoAnulacion {
  documento: DocumentoFEL;
  anulado: boolean;
  mensaje?: string;
}

/**
 * Anula ante SAT (via INFILE) un DTE ya certificado.
 *
 * La anulacion es un tramite fiscal formal: el documento no desaparece, queda
 * marcado como anulado ante SAT. Solo procede sobre documentos certificados.
 */
export async function anularFactura(
  supabase: any,
  invoice: any,
  motivo: string
): Promise<ResultadoAnulacion> {
  const inicio = Date.now();
  const config = await obtenerConfig(supabase);

  const documento = await obtenerDocumentoPorFactura(supabase, invoice.id);
  if (!documento) throw new Error('Esta factura no tiene ningun documento FEL emitido.');
  if (documento.estado === 'anulado') {
    return { documento, anulado: true, mensaje: 'El documento ya estaba anulado.' };
  }
  if (documento.estado !== 'certificado' || !documento.numero_autorizacion) {
    throw new Error('Solo se puede anular un documento certificado ante SAT.');
  }

  const credenciales: CredencialesInfile = {
    usuario: config?.infile_usuario ?? '',
    llaveFirma: config?.infile_llave_firma ?? '',
    llaveToken: config?.infile_llave_token ?? '',
    url: config?.infile_url ?? '',
    ambiente: (config?.ambiente as any) ?? 'pruebas',
  };

  const xmlAnulacion = construirXmlAnulacion({
    numeroAutorizacion: documento.numero_autorizacion,
    nitEmisor: config?.nit_emisor ?? '',
    nitReceptor: extraerNit(invoice) || 'CF',
    // OJO: debe ser la fecha que SAT registro al CERTIFICAR (la devuelve el
    // certificador), no la fecha de la factura del sistema. La factura suele
    // guardarse a medianoche UTC, que en hora de Guatemala cae el dia
    // anterior, y SAT rechaza la anulacion con FEL-GUI-56 ("la fecha de
    // emision no coincide con la registrada").
    fechaEmisionDocumento: documento.fecha_certificacion || invoice.date || new Date().toISOString(),
    motivo,
  });

  const resp = await anularDTE(xmlAnulacion, credenciales, `ANUL-${documento.id}`);

  const cambios: any = {
    actualizado_en: new Date().toISOString(),
    respuesta_certificador: resp.respuestaCompleta ?? null,
  };
  if (resp.exito) {
    cambios.estado = 'anulado';
    cambios.motivo_anulacion = motivo;
    cambios.fecha_anulacion = new Date().toISOString();
    cambios.mensaje_error = null;
  } else {
    // El documento SIGUE certificado: la anulacion fallo, no el documento.
    cambios.mensaje_error = `Anulacion rechazada: ${resp.mensaje ?? 'sin detalle'}`;
  }

  const { data, error } = await supabase
    .from('fel_documentos')
    .update(cambios)
    .eq('id', documento.id)
    .select()
    .single();
  if (error) throw new Error(`No se pudo actualizar el documento FEL: ${error.message}`);

  await registrarBitacora(supabase, {
    documento_id: documento.id,
    invoice_id: invoice.id,
    operacion: 'anular',
    exito: resp.exito,
    codigo_respuesta: resp.codigo ?? (resp.exito ? 'ANULADO' : null),
    mensaje: resp.exito ? motivo : resp.mensaje ?? null,
    respuesta: resp.respuestaCompleta ?? null,
    duracion_ms: Date.now() - inicio,
  });

  return { documento: data, anulado: resp.exito, mensaje: resp.mensaje };
}
