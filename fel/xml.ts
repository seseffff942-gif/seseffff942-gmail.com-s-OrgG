/**
 * Generacion del XML del DTE (Documento Tributario Electronico) para FEL
 * Guatemala, siguiendo la estructura que INFILE certifica.
 *
 * Basado en la implementacion de referencia del cliente (sistema NestJS ya en
 * uso con INFILE), con dos mejoras:
 *
 *  1. TODOS los valores se escapan. La referencia interpolaba nombres y
 *     direcciones tal cual; un cliente llamado "Agro & Vet" o una direccion
 *     con "<" generaba XML invalido y el rechazo del certificador.
 *  2. Los montos salen de fel/calculos.ts, que garantiza que
 *     gravable + IVA == gran total sin descuadres de centavos.
 *
 * Soporta FACT (factura) y FCAM (factura cambiaria, la que usa este negocio)
 * con su complemento de abonos.
 */
import type { TotalesFEL } from './calculos.js';

export interface EmisorXML {
  nit: string;
  nombre: string;
  nombreComercial?: string;
  /** Correo del emisor. SAT lo valida en produccion; no debe ir vacio. */
  correo?: string;
  direccion: string;
  codigoPostal?: string;
  municipio?: string;
  departamento?: string;
  pais?: string;
  codigoEstablecimiento: number | string;
  afiliacionIva?: string;
}

export interface ReceptorXML {
  /** NIT sin formato, o "CF" para consumidor final. */
  nit: string;
  nombre: string;
  direccion?: string;
  /** Correo del receptor (opcional): si se envia, INFILE le remite el DTE. */
  correo?: string;
}

export interface OpcionesXML {
  tipo: 'FACT' | 'FCAM';
  moneda?: string;
  /** Solo FCAM: fecha de vencimiento del abono, formato YYYY-MM-DD. */
  fechaVencimiento?: string;
  /** Permite fijar la fecha de emision en pruebas. Por defecto: ahora (GT). */
  fechaEmision?: string;
}

/** Escapa un valor para usarlo en texto o atributos XML. */
export function escaparXml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Quita guiones, barras y espacios de un NIT: SAT lo exige sin formato. */
export function nitPlano(nit: string): string {
  const limpio = String(nit || '').replace(/[\s\-\/\.]/g, '').toUpperCase();
  return limpio || 'CF';
}

/**
 * Fecha-hora actual de Guatemala (UTC-6, sin horario de verano) en el formato
 * que espera SAT. Se calcula explicitamente porque el servidor (Vercel) corre
 * en UTC: usar la hora local del proceso emitiria documentos 6 horas en el
 * futuro y SAT los rechaza.
 */
export function fechaHoraGuatemala(base?: Date): string {
  const gt = new Date((base ?? new Date()).getTime() - 6 * 3600 * 1000);
  return gt.toISOString().slice(0, 19);
}

const f2 = (n: number) => Number(n || 0).toFixed(2);
const f4 = (n: number) => Number(n || 0).toFixed(4);

/**
 * Construye el GTDocumento completo listo para enviarse a INFILE.
 */
export function construirXmlDTE(
  emisor: EmisorXML,
  receptor: ReceptorXML,
  totales: TotalesFEL,
  opciones: OpcionesXML
): string {
  const tipo = opciones.tipo;
  const moneda = opciones.moneda || 'GTQ';
  const fechaEmision = opciones.fechaEmision || fechaHoraGuatemala();

  const itemsXml = totales.items
    .map((it, idx) => `        <dte:Item BienOServicio="B" NumeroLinea="${idx + 1}">
          <dte:Cantidad>${f2(it.cantidad)}</dte:Cantidad>
          <dte:UnidadMedida>UNI</dte:UnidadMedida>
          <dte:Descripcion>${escaparXml(it.descripcion)}</dte:Descripcion>
          <dte:PrecioUnitario>${f4(it.precioUnitario)}</dte:PrecioUnitario>
          <dte:Precio>${f4(it.precio)}</dte:Precio>
          <dte:Descuento>${f4(it.descuento)}</dte:Descuento>
          <dte:Impuestos>
            <dte:Impuesto>
              <dte:NombreCorto>IVA</dte:NombreCorto>
              <dte:CodigoUnidadGravable>1</dte:CodigoUnidadGravable>
              <dte:MontoGravable>${f4(it.montoGravable)}</dte:MontoGravable>
              <dte:MontoImpuesto>${f4(it.montoIva)}</dte:MontoImpuesto>
            </dte:Impuesto>
          </dte:Impuestos>
          <dte:Total>${f4(it.total)}</dte:Total>
        </dte:Item>`)
    .join('\n');

  // Complemento obligatorio de la factura cambiaria: el calendario de abonos.
  // Este negocio maneja un solo abono por el total, con vencimiento segun los
  // dias de credito de la factura.
  let complementosXml = '';
  if (tipo === 'FCAM') {
    const vencimiento = opciones.fechaVencimiento || fechaEmision.slice(0, 10);
    complementosXml = `
        <dte:Complementos>
          <dte:Complemento IDComplemento="1" NombreComplemento="Abono" URIComplemento="http://www.sat.gob.gt/dte/fel/CompCambiaria/0.1.0">
            <cfc:AbonosFacturaCambiaria xmlns:cfc="http://www.sat.gob.gt/dte/fel/CompCambiaria/0.1.0" Version="1">
              <cfc:Abono>
                <cfc:NumeroAbono>1</cfc:NumeroAbono>
                <cfc:FechaVencimiento>${escaparXml(vencimiento)}</cfc:FechaVencimiento>
                <cfc:MontoAbono>${f2(totales.granTotal)}</cfc:MontoAbono>
              </cfc:Abono>
            </cfc:AbonosFacturaCambiaria>
          </dte:Complemento>
        </dte:Complementos>`;
  }

  return `<dte:GTDocumento xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:dte="http://www.sat.gob.gt/dte/fel/0.2.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="0.1"
  xsi:schemaLocation="http://www.sat.gob.gt/dte/fel/0.1.0">
  <dte:SAT ClaseDocumento="dte">
    <dte:DTE ID="DatosCertificados">
      <dte:DatosEmision ID="DatosEmision">
        <dte:DatosGenerales CodigoMoneda="${escaparXml(moneda)}" FechaHoraEmision="${escaparXml(fechaEmision)}" Tipo="${tipo}" />
        <dte:Emisor AfiliacionIVA="${escaparXml(emisor.afiliacionIva || 'GEN')}" CodigoEstablecimiento="${escaparXml(emisor.codigoEstablecimiento)}" CorreoEmisor="${escaparXml(emisor.correo || '')}" NITEmisor="${escaparXml(nitPlano(emisor.nit))}" NombreComercial="${escaparXml(emisor.nombreComercial || emisor.nombre)}" NombreEmisor="${escaparXml(emisor.nombre)}">
          <dte:DireccionEmisor>
            <dte:Direccion>${escaparXml(emisor.direccion)}</dte:Direccion>
            <dte:CodigoPostal>${escaparXml(emisor.codigoPostal || '01001')}</dte:CodigoPostal>
            <dte:Municipio>${escaparXml(emisor.municipio || 'GUATEMALA')}</dte:Municipio>
            <dte:Departamento>${escaparXml(emisor.departamento || 'GUATEMALA')}</dte:Departamento>
            <dte:Pais>${escaparXml((emisor.pais || 'GT').toUpperCase())}</dte:Pais>
          </dte:DireccionEmisor>
        </dte:Emisor>
        <dte:Receptor${receptor.correo ? ` CorreoReceptor="${escaparXml(receptor.correo)}"` : ''} IDReceptor="${escaparXml(nitPlano(receptor.nit))}" NombreReceptor="${escaparXml(receptor.nombre || 'Consumidor Final')}">
          <dte:DireccionReceptor>
            <dte:Direccion>${escaparXml(receptor.direccion || 'Ciudad')}</dte:Direccion>
            <dte:CodigoPostal>01001</dte:CodigoPostal>
            <dte:Municipio>GUATEMALA</dte:Municipio>
            <dte:Departamento>GUATEMALA</dte:Departamento>
            <dte:Pais>GT</dte:Pais>
          </dte:DireccionReceptor>
        </dte:Receptor>
        <dte:Frases>
          <dte:Frase TipoFrase="1" CodigoEscenario="1" />
        </dte:Frases>
        <dte:Items>
${itemsXml}
        </dte:Items>
        <dte:Totales>
          <dte:TotalImpuestos>
            <dte:TotalImpuesto NombreCorto="IVA" TotalMontoImpuesto="${f2(totales.totalMontoIva)}" />
          </dte:TotalImpuestos>
          <dte:GranTotal>${f2(totales.granTotal)}</dte:GranTotal>
        </dte:Totales>${complementosXml}
      </dte:DatosEmision>
    </dte:DTE>
  </dte:SAT>
</dte:GTDocumento>`;
}

/**
 * XML de anulacion de un DTE ya certificado (GTAnulacionDocumento).
 */
export function construirXmlAnulacion(params: {
  numeroAutorizacion: string;
  nitEmisor: string;
  nitReceptor: string;
  fechaEmisionDocumento: string; // ISO de la factura original
  motivo?: string;
}): string {
  const conZonaGt = (iso: string) => {
    const d = new Date(iso);
    return `${new Date(d.getTime() - 6 * 3600 * 1000).toISOString().slice(0, 19)}-06:00`;
  };

  return `<dte:GTAnulacionDocumento xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:dte="http://www.sat.gob.gt/dte/fel/0.1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="0.1"
  xsi:schemaLocation="http://www.sat.gob.gt/dte/fel/0.1.0">
  <dte:SAT>
    <dte:AnulacionDTE ID="DatosCertificados">
      <dte:DatosGenerales
        FechaEmisionDocumentoAnular="${escaparXml(conZonaGt(params.fechaEmisionDocumento))}"
        FechaHoraAnulacion="${escaparXml(conZonaGt(new Date().toISOString()))}"
        ID="DatosAnulacion"
        IDReceptor="${escaparXml(nitPlano(params.nitReceptor))}"
        MotivoAnulacion="${escaparXml(params.motivo || 'Anulacion solicitada por el emisor')}"
        NITEmisor="${escaparXml(nitPlano(params.nitEmisor))}"
        NumeroDocumentoAAnular="${escaparXml(params.numeroAutorizacion)}" />
    </dte:AnulacionDTE>
  </dte:SAT>
</dte:GTAnulacionDocumento>`;
}
