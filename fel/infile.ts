/**
 * Integracion con INFILE (certificador de FEL en Guatemala).
 *
 * ESTADO: pendiente de credenciales y documentacion de INFILE.
 *
 * Este archivo es la UNICA frontera con el certificador. Todo lo demas del
 * sistema (endpoints, pantallas, base de datos) ya funciona sin el: los
 * documentos se pueden preparar, revisar y consultar. Lo unico que falta es
 * que estas dos funciones dejen de lanzar el error y hagan la llamada real.
 *
 * QUE HACE FALTA PARA COMPLETARLO
 * -------------------------------
 * 1. Documentacion tecnica de la API de INFILE (endpoints y formato).
 * 2. Credenciales del ambiente de PRUEBAS: usuario, llave de firma y token.
 * 3. Un XML de ejemplo ya aceptado, para replicar la estructura exacta del DTE.
 *
 * FLUJO QUE IMPLEMENTAN ESTAS FUNCIONES
 * -------------------------------------
 *   1. Se arma el DTE en XML segun el esquema de SAT.
 *   2. Se firma electronicamente (INFILE ofrece servicio de firma).
 *   3. Se envia al certificador.
 *   4. INFILE valida, reporta a SAT y devuelve el numero de autorizacion (UUID).
 */

export interface CredencialesInfile {
  usuario: string;
  llaveFirma: string;
  llaveToken: string;
  ambiente: 'pruebas' | 'produccion';
}

export interface RespuestaCertificacion {
  exito: boolean;
  numeroAutorizacion?: string;
  serie?: string;
  numero?: string;
  xmlCertificado?: string;
  codigo?: string;
  mensaje?: string;
}

export class InfileNoConfiguradoError extends Error {
  constructor() {
    super(
      'La integracion con INFILE aun no esta configurada. ' +
      'Hacen falta las credenciales del ambiente de pruebas y la documentacion de su API. ' +
      'El documento se guardo en estado pendiente y puede certificarse despues.'
    );
    this.name = 'InfileNoConfiguradoError';
  }
}

export function credencialesCompletas(c: Partial<CredencialesInfile> | null): boolean {
  return !!(c && c.usuario && c.llaveFirma && c.llaveToken);
}

/**
 * Envia un DTE a INFILE para su certificacion.
 * Pendiente de implementar: ver notas al inicio del archivo.
 */
export async function certificarDTE(
  _xml: string,
  _credenciales: CredencialesInfile
): Promise<RespuestaCertificacion> {
  throw new InfileNoConfiguradoError();
}

/**
 * Solicita a INFILE la anulacion de un DTE ya certificado.
 * Pendiente de implementar: ver notas al inicio del archivo.
 */
export async function anularDTE(
  _numeroAutorizacion: string,
  _motivo: string,
  _credenciales: CredencialesInfile
): Promise<RespuestaCertificacion> {
  throw new InfileNoConfiguradoError();
}
