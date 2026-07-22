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
  /** Respuesta cruda completa del certificador, para guardarla integra. */
  respuestaCompleta?: any;
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
    return {
      exito: true,
      numeroAutorizacion: json.uuid,
      serie: json.serie,
      numero: json.numero !== undefined && json.numero !== null ? String(json.numero) : undefined,
      fecha: json.fecha,
      // INFILE devuelve el XML certificado en base64 en 'xml_certificado'.
      xmlCertificado: json.xml_certificado,
      respuestaCompleta: json,
    };
  }

  const errores = Array.isArray(json?.descripcion_errores) ? json.descripcion_errores : [];
  const mensajes = errores
    .slice(0, 5)
    .map((e: any) => e?.mensaje_error)
    .filter(Boolean)
    .join(' | ');

  return {
    exito: false,
    codigo: 'RECHAZADO',
    mensaje: mensajes || json?.descripcion || 'El certificador rechazo el documento sin detalle.',
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
