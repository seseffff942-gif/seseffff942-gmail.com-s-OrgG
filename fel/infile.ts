/**
 * Integracion con INFILE (certificador de FEL en Guatemala).
 *
 * Protocolo (segun la implementacion de referencia del cliente, ya en
 * produccion con INFILE en otro sistema):
 *
 *   POST {url}            con el XML del DTE en el cuerpo
 *   Cabeceras:            UsuarioFirma, LlaveFirma, UsuarioApi, LlaveApi,
 *                         identificador (correlacion unica por intento)
 *   Respuesta (JSON):     { resultado: bool, uuid, serie, numero, fecha,
 *                           descripcion_errores: [{ mensaje_error }] }
 *
 * La URL y las credenciales viven en la tabla fel_config (ambiente de
 * pruebas o produccion) — nunca en el codigo.
 */

export interface CredencialesInfile {
  usuario: string;
  llaveFirma: string;
  llaveToken: string;
  url: string;
  ambiente: 'pruebas' | 'produccion';
}

export interface RespuestaCertificacion {
  exito: boolean;
  numeroAutorizacion?: string;
  serie?: string;
  numero?: string;
  fecha?: string;
  xmlCertificado?: string;
  codigo?: string;
  mensaje?: string;
  /**
   * Alertas informativas que acompanan una respuesta EXITOSA. La mas importante
   * en pruebas: el aviso de que el documento se proceso en el SandBox de INFILE
   * y "no debe ser usado como comprobante fiscal".
   */
  alertas?: string[];
  /** Respuesta cruda completa del certificador, para guardarla integra. */
  respuestaCompleta?: any;
}

/**
 * Extrae los mensajes legibles de cualquiera de los arreglos de errores/alertas
 * que devuelve INFILE. Segun la version del servicio, el detalle puede venir en
 * `descripcion_errores` (formato anterior) o en `descripcion_alertas_sat` /
 * `descripcion_alertas_infile` (formato del proceso unificado v2). Se soportan
 * todos para no perder nunca el motivo real de un rechazo.
 */
function extraerMensajes(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((e: any) => {
      if (!e) return '';
      if (typeof e === 'string') return e;
      const texto = e.mensaje_error ?? e.mensaje ?? e.descripcion ?? '';
      if (!texto) return '';
      const ctx = [e.fuente, e.numeral].filter(Boolean).join(' ');
      return ctx ? `${texto} (${ctx})` : String(texto);
    })
    .filter(Boolean);
}

export class InfileNoConfiguradoError extends Error {
  constructor(faltantes: string[] = []) {
    super(
      'La integracion con INFILE aun no esta configurada' +
      (faltantes.length ? ` (falta: ${faltantes.join(', ')})` : '') +
      '. El documento se guardo en estado pendiente y puede certificarse despues.'
    );
    this.name = 'InfileNoConfiguradoError';
  }
}

export function credencialesFaltantes(c: Partial<CredencialesInfile> | null): string[] {
  const faltan: string[] = [];
  if (!c?.usuario) faltan.push('usuario');
  if (!c?.llaveFirma) faltan.push('llave de firma');
  if (!c?.llaveToken) faltan.push('llave/token de API');
  if (!c?.url) faltan.push('URL del certificador');
  return faltan;
}

export function credencialesCompletas(c: Partial<CredencialesInfile> | null): boolean {
  return credencialesFaltantes(c).length === 0;
}

const TIMEOUT_MS = 30_000;

async function llamarInfile(
  url: string,
  xml: string,
  credenciales: CredencialesInfile,
  identificador: string
): Promise<RespuestaCertificacion> {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      signal: controlador.signal,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        UsuarioFirma: credenciales.usuario,
        LlaveFirma: credenciales.llaveFirma,
        UsuarioApi: credenciales.usuario,
        LlaveApi: credenciales.llaveToken,
        identificador,
      },
      body: xml,
    });
  } catch (e: any) {
    const esTimeout = e?.name === 'AbortError';
    return {
      exito: false,
      codigo: esTimeout ? 'TIMEOUT' : 'RED',
      mensaje: esTimeout
        ? `El certificador no respondio en ${TIMEOUT_MS / 1000}s. La factura queda pendiente; reintentar mas tarde.`
        : `No se pudo contactar al certificador: ${e?.message ?? e}`,
    };
  } finally {
    clearTimeout(timer);
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    return {
      exito: false,
      codigo: `HTTP_${res.status}`,
      mensaje: `El certificador devolvio una respuesta no valida (HTTP ${res.status}).`,
    };
  }

  if (json?.resultado) {
    // En modalidad de pruebas (SandBox) el documento se certifica pero llega
    // con alertas advirtiendo que no tiene validez fiscal: se conservan para
    // mostrarlas y no confundir una prueba con una emision real.
    const alertas = [
      ...extraerMensajes(json.descripcion_alertas_infile),
      ...extraerMensajes(json.descripcion_alertas_sat),
    ];
    return {
      exito: true,
      numeroAutorizacion: json.uuid,
      serie: json.serie,
      numero: json.numero !== undefined && json.numero !== null ? String(json.numero) : undefined,
      fecha: json.fecha,
      // INFILE devuelve el XML certificado en base64 en 'xml_certificado'.
      xmlCertificado: json.xml_certificado,
      alertas: alertas.length ? alertas : undefined,
      respuestaCompleta: json,
    };
  }

  // El detalle del rechazo puede venir en cualquiera de estos tres arreglos
  // segun la version del servicio; se revisan todos para no perder el motivo.
  const mensajes = [
    ...extraerMensajes(json?.descripcion_errores),
    ...extraerMensajes(json?.descripcion_alertas_sat),
    ...extraerMensajes(json?.descripcion_alertas_infile),
  ];

  return {
    exito: false,
    codigo: 'RECHAZADO',
    mensaje: mensajes.slice(0, 5).join(' | ') || json?.descripcion || 'El certificador rechazo el documento sin detalle.',
    respuestaCompleta: json,
  };
}

/** Envia un DTE a INFILE para su certificacion. */
export async function certificarDTE(
  xml: string,
  credenciales: CredencialesInfile,
  identificador: string
): Promise<RespuestaCertificacion> {
  const faltan = credencialesFaltantes(credenciales);
  if (faltan.length) throw new InfileNoConfiguradoError(faltan);
  return llamarInfile(credenciales.url, xml, credenciales, identificador);
}

/** Solicita la anulacion de un DTE ya certificado. */
export async function anularDTE(
  xmlAnulacion: string,
  credenciales: CredencialesInfile,
  identificador: string
): Promise<RespuestaCertificacion> {
  const faltan = credencialesFaltantes(credenciales);
  if (faltan.length) throw new InfileNoConfiguradoError(faltan);
  return llamarInfile(credenciales.url, xmlAnulacion, credenciales, identificador);
}

/**
 * Servicio de consulta de receptores de INFILE: devuelve el nombre registrado
 * en SAT para un NIT. Permite validar el NIT antes de facturar, evitando
 * rechazos por receptor inexistente.
 */
const URL_CONSULTA_NIT = 'https://consultareceptores.feel.com.gt/rest/action';

export interface ResultadoConsultaNit {
  valido: boolean;
  nit?: string;
  nombre?: string;
  mensaje?: string;
}

export async function consultarNit(
  nit: string,
  credenciales: Pick<CredencialesInfile, 'usuario' | 'llaveToken'>
): Promise<ResultadoConsultaNit> {
  const limpio = String(nit || '').replace(/[\s\-\/\.]/g, '').toUpperCase();
  if (!limpio || limpio === 'CF') {
    return { valido: true, nit: 'CF', nombre: 'Consumidor Final' };
  }

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 15_000);
  try {
    const res = await fetch(URL_CONSULTA_NIT, {
      method: 'POST',
      signal: controlador.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emisor_codigo: credenciales.usuario,
        emisor_clave: credenciales.llaveToken,
        nit_consulta: limpio,
      }),
    });
    const json: any = await res.json().catch(() => null);

    // El servicio devuelve el nombre en 'razon_social' (formato oficial). Se
    // mantienen 'nombre'/'Nombre' como respaldo por si otra version lo usa.
    const nombre = json?.razon_social ?? json?.nombre ?? json?.Nombre ?? null;
    if (json?.resultado && nombre) return { valido: true, nit: limpio, nombre };
    if (nombre) return { valido: true, nit: limpio, nombre };

    return {
      valido: false,
      nit: limpio,
      mensaje: json?.descripcion ?? json?.mensaje ?? 'NIT no encontrado en base de datos.',
    };
  } catch (e: any) {
    return {
      valido: false,
      nit: limpio,
      mensaje: e?.name === 'AbortError'
        ? 'El servicio de consulta de NIT no respondio a tiempo.'
        : `No se pudo consultar el NIT: ${e?.message ?? e}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
