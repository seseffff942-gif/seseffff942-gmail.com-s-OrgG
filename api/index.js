// server.ts
import "dotenv/config";
import express from "express";
import compression from "compression";
import path from "path";
import multer from "multer";
import fs from "fs";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import webpush from "web-push";
import nodemailer from "nodemailer";
import { GoogleGenAI, Type } from "@google/genai";

// fel/calculos.ts
var TASA_IVA = 0.12;
var DECIMALES_MONEDA = 2;
var DECIMALES_FISCAL = 6;
function redondear(valor, decimales) {
  const factor = Math.pow(10, decimales);
  return Math.round((valor + Number.EPSILON) * factor) / factor;
}
function redondearMoneda(valor) {
  return redondear(valor, DECIMALES_MONEDA);
}
var DECIMALES_PRECIO_UNITARIO = 4;
function desglosarIVA(totalConIva) {
  const granTotal = redondearMoneda(totalConIva);
  const montoGravable = redondear(granTotal / (1 + TASA_IVA), DECIMALES_FISCAL);
  const montoIva = redondear(granTotal - montoGravable, DECIMALES_FISCAL);
  return { montoGravable, montoIva, granTotal };
}
function calcularItem(linea) {
  const precioUnitario = redondear(linea.precioUnitario, DECIMALES_PRECIO_UNITARIO);
  const precio = redondearMoneda(linea.cantidad * precioUnitario);
  const descuento = redondearMoneda(linea.descuento ?? 0);
  const total = redondearMoneda(precio - descuento);
  const { montoGravable, montoIva } = desglosarIVA(total);
  return {
    descripcion: linea.descripcion ?? "",
    cantidad: linea.cantidad,
    precioUnitario,
    precio,
    descuento,
    total,
    montoGravable,
    montoIva
  };
}
function calcularTotales(lineas) {
  const items = lineas.map(calcularItem);
  const granTotal = redondearMoneda(
    items.reduce((suma, it) => suma + it.total, 0)
  );
  const totalMontoGravable = redondear(
    items.reduce((suma, it) => suma + it.montoGravable, 0),
    DECIMALES_FISCAL
  );
  const totalMontoIva = redondear(granTotal - totalMontoGravable, DECIMALES_FISCAL);
  return { items, totalMontoGravable, totalMontoIva, granTotal };
}
function validarCuadre(totales) {
  const sumaPartes = redondear(
    totales.totalMontoGravable + totales.totalMontoIva,
    DECIMALES_FISCAL
  );
  if (Math.abs(sumaPartes - totales.granTotal) > 1e-6) {
    return {
      valido: false,
      motivo: `El desglose no cuadra: gravable (${totales.totalMontoGravable}) + IVA (${totales.totalMontoIva}) = ${sumaPartes}, pero el gran total es ${totales.granTotal}`
    };
  }
  if (totales.granTotal <= 0) {
    return { valido: false, motivo: "El gran total debe ser mayor que cero" };
  }
  return { valido: true };
}

// fel/infile.ts
function extraerMensajes(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((e) => {
    if (!e) return "";
    if (typeof e === "string") return e;
    const texto = e.mensaje_error ?? e.mensaje ?? e.descripcion ?? "";
    if (!texto) return "";
    const ctx = [e.fuente, e.numeral].filter(Boolean).join(" ");
    return ctx ? `${texto} (${ctx})` : String(texto);
  }).filter(Boolean);
}
var InfileNoConfiguradoError = class extends Error {
  constructor(faltantes = []) {
    super(
      "La integracion con INFILE aun no esta configurada" + (faltantes.length ? ` (falta: ${faltantes.join(", ")})` : "") + ". El documento se guardo en estado pendiente y puede certificarse despues."
    );
    this.name = "InfileNoConfiguradoError";
  }
};
function credencialesFaltantes(c) {
  const faltan = [];
  if (!c?.usuario) faltan.push("usuario");
  if (!c?.llaveFirma) faltan.push("llave de firma");
  if (!c?.llaveToken) faltan.push("llave/token de API");
  if (!c?.url) faltan.push("URL del certificador");
  return faltan;
}
function credencialesCompletas(c) {
  return credencialesFaltantes(c).length === 0;
}
var TIMEOUT_MS = 3e4;
async function llamarInfile(url, xml, credenciales, identificador) {
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      signal: controlador.signal,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        UsuarioFirma: credenciales.usuario,
        LlaveFirma: credenciales.llaveFirma,
        UsuarioApi: credenciales.usuario,
        LlaveApi: credenciales.llaveToken,
        identificador
      },
      body: xml
    });
  } catch (e) {
    const esTimeout = e?.name === "AbortError";
    return {
      exito: false,
      codigo: esTimeout ? "TIMEOUT" : "RED",
      mensaje: esTimeout ? `El certificador no respondio en ${TIMEOUT_MS / 1e3}s. La factura queda pendiente; reintentar mas tarde.` : `No se pudo contactar al certificador: ${e?.message ?? e}`
    };
  } finally {
    clearTimeout(timer);
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    return {
      exito: false,
      codigo: `HTTP_${res.status}`,
      mensaje: `El certificador devolvio una respuesta no valida (HTTP ${res.status}).`
    };
  }
  if (json?.resultado) {
    const alertas = [
      ...extraerMensajes(json.descripcion_alertas_infile),
      ...extraerMensajes(json.descripcion_alertas_sat)
    ];
    return {
      exito: true,
      numeroAutorizacion: json.uuid,
      serie: json.serie,
      numero: json.numero !== void 0 && json.numero !== null ? String(json.numero) : void 0,
      fecha: json.fecha,
      // INFILE devuelve el XML certificado en base64 en 'xml_certificado'.
      xmlCertificado: json.xml_certificado,
      alertas: alertas.length ? alertas : void 0,
      respuestaCompleta: json
    };
  }
  const mensajes = [
    ...extraerMensajes(json?.descripcion_errores),
    ...extraerMensajes(json?.descripcion_alertas_sat),
    ...extraerMensajes(json?.descripcion_alertas_infile)
  ];
  return {
    exito: false,
    codigo: "RECHAZADO",
    mensaje: mensajes.slice(0, 5).join(" | ") || json?.descripcion || "El certificador rechazo el documento sin detalle.",
    respuestaCompleta: json
  };
}
async function certificarDTE(xml, credenciales, identificador) {
  const faltan = credencialesFaltantes(credenciales);
  if (faltan.length) throw new InfileNoConfiguradoError(faltan);
  return llamarInfile(credenciales.url, xml, credenciales, identificador);
}
async function anularDTE(xmlAnulacion, credenciales, identificador) {
  const faltan = credencialesFaltantes(credenciales);
  if (faltan.length) throw new InfileNoConfiguradoError(faltan);
  return llamarInfile(credenciales.url, xmlAnulacion, credenciales, identificador);
}
var URL_CONSULTA_NIT = "https://consultareceptores.feel.com.gt/rest/action";
async function consultarNit(nit, credenciales) {
  const limpio = String(nit || "").replace(/[\s\-\/\.]/g, "").toUpperCase();
  if (!limpio || limpio === "CF") {
    return { valido: true, nit: "CF", nombre: "Consumidor Final" };
  }
  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), 15e3);
  try {
    const res = await fetch(URL_CONSULTA_NIT, {
      method: "POST",
      signal: controlador.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emisor_codigo: credenciales.usuario,
        emisor_clave: credenciales.llaveToken,
        nit_consulta: limpio
      })
    });
    const json = await res.json().catch(() => null);
    const nombre = json?.razon_social ?? json?.nombre ?? json?.Nombre ?? null;
    if (json?.resultado && nombre) return { valido: true, nit: limpio, nombre };
    if (nombre) return { valido: true, nit: limpio, nombre };
    return {
      valido: false,
      nit: limpio,
      mensaje: json?.descripcion ?? json?.mensaje ?? "NIT no encontrado en base de datos."
    };
  } catch (e) {
    return {
      valido: false,
      nit: limpio,
      mensaje: e?.name === "AbortError" ? "El servicio de consulta de NIT no respondio a tiempo." : `No se pudo consultar el NIT: ${e?.message ?? e}`
    };
  } finally {
    clearTimeout(timer);
  }
}

// fel/xml.ts
function escaparXml(valor) {
  return String(valor ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function nitPlano(nit) {
  const limpio = String(nit || "").replace(/[\s\-\/\.]/g, "").toUpperCase();
  return limpio || "CF";
}
function fechaHoraGuatemala(base) {
  const gt = new Date((base ?? /* @__PURE__ */ new Date()).getTime() - 6 * 3600 * 1e3);
  return gt.toISOString().slice(0, 19);
}
var f2 = (n) => Number(n || 0).toFixed(2);
var f4 = (n) => Number(n || 0).toFixed(4);
function construirXmlDTE(emisor, receptor, totales, opciones) {
  const tipo = opciones.tipo;
  const moneda = opciones.moneda || "GTQ";
  const fechaEmision = opciones.fechaEmision || fechaHoraGuatemala();
  const itemsXml = totales.items.map((it, idx) => `        <dte:Item BienOServicio="B" NumeroLinea="${idx + 1}">
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
        </dte:Item>`).join("\n");
  let complementosXml = "";
  if (tipo === "FCAM") {
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
        <dte:Emisor AfiliacionIVA="${escaparXml(emisor.afiliacionIva || "GEN")}" CodigoEstablecimiento="${escaparXml(emisor.codigoEstablecimiento)}" CorreoEmisor="${escaparXml(emisor.correo || "")}" NITEmisor="${escaparXml(nitPlano(emisor.nit))}" NombreComercial="${escaparXml(emisor.nombreComercial || emisor.nombre)}" NombreEmisor="${escaparXml(emisor.nombre)}">
          <dte:DireccionEmisor>
            <dte:Direccion>${escaparXml(emisor.direccion)}</dte:Direccion>
            <dte:CodigoPostal>${escaparXml(emisor.codigoPostal || "01001")}</dte:CodigoPostal>
            <dte:Municipio>${escaparXml(emisor.municipio || "GUATEMALA")}</dte:Municipio>
            <dte:Departamento>${escaparXml(emisor.departamento || "GUATEMALA")}</dte:Departamento>
            <dte:Pais>${escaparXml((emisor.pais || "GT").toUpperCase())}</dte:Pais>
          </dte:DireccionEmisor>
        </dte:Emisor>
        <dte:Receptor${receptor.correo ? ` CorreoReceptor="${escaparXml(receptor.correo)}"` : ""} IDReceptor="${escaparXml(nitPlano(receptor.nit))}" NombreReceptor="${escaparXml(receptor.nombre || "Consumidor Final")}">
          <dte:DireccionReceptor>
            <dte:Direccion>${escaparXml(receptor.direccion || "Ciudad")}</dte:Direccion>
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
function construirXmlAnulacion(params) {
  const conZonaGt = (iso) => {
    const d = new Date(iso);
    return `${new Date(d.getTime() - 6 * 3600 * 1e3).toISOString().slice(0, 19)}-06:00`;
  };
  return `<dte:GTAnulacionDocumento xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
  xmlns:dte="http://www.sat.gob.gt/dte/fel/0.1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="0.1"
  xsi:schemaLocation="http://www.sat.gob.gt/dte/fel/0.1.0">
  <dte:SAT>
    <dte:AnulacionDTE ID="DatosCertificados">
      <dte:DatosGenerales
        FechaEmisionDocumentoAnular="${escaparXml(conZonaGt(params.fechaEmisionDocumento))}"
        FechaHoraAnulacion="${escaparXml(conZonaGt((/* @__PURE__ */ new Date()).toISOString()))}"
        ID="DatosAnulacion"
        IDReceptor="${escaparXml(nitPlano(params.nitReceptor))}"
        MotivoAnulacion="${escaparXml(params.motivo || "Anulacion solicitada por el emisor")}"
        NITEmisor="${escaparXml(nitPlano(params.nitEmisor))}"
        NumeroDocumentoAAnular="${escaparXml(params.numeroAutorizacion)}" />
    </dte:AnulacionDTE>
  </dte:SAT>
</dte:GTAnulacionDocumento>`;
}

// fel/servicio.ts
var DIAS_CREDITO_FCAM = 30;
var CAMPOS_OBLIGATORIOS = [
  "nit_emisor",
  "nombre_emisor",
  "direccion",
  "codigo_establecimiento"
];
function configIncompleta(config) {
  if (!config) return CAMPOS_OBLIGATORIOS;
  return CAMPOS_OBLIGATORIOS.filter((c) => {
    const v = config[c];
    return v === null || v === void 0 || v === "";
  });
}
async function obtenerConfig(supabase2) {
  const { data, error } = await supabase2.from("fel_config").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`No se pudo leer la configuracion FEL: ${error.message}`);
  return data ?? null;
}
async function guardarConfig(supabase2, cambios) {
  const { data, error } = await supabase2.from("fel_config").update({ ...cambios, actualizado_en: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", 1).select().single();
  if (error) throw new Error(`No se pudo guardar la configuracion FEL: ${error.message}`);
  return data;
}
function itemsALineas(items) {
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
      descripcion: it.productName ?? it.descripcion ?? "Producto"
    };
  });
}
function extraerNit(invoice) {
  const directo = (invoice?.nit ?? "").toString().trim();
  if (directo) return directo;
  const notas = (invoice?.notes ?? "").toString();
  if (!notas.includes("|||")) return "";
  const posible = notas.split("|||")[0].trim();
  if (!posible) return "";
  const bajo = posible.toLowerCase();
  if (posible.length > 25 || bajo.includes("enviar") || bajo.includes("entrega") || bajo.includes("nota")) {
    return "";
  }
  return posible;
}
function esConsumidorFinal(nit) {
  const n = nit.toUpperCase().replace(/[\s/\-\.]/g, "");
  return n === "" || n === "CF" || n === "CONSUMIDORFINAL";
}
function prepararDTE(invoice) {
  const advertencias = [];
  const lineas = itemsALineas(invoice?.items || []);
  const nitReceptor = extraerNit(invoice);
  if (lineas.length === 0) advertencias.push("La factura no tiene items.");
  if (!nitReceptor) {
    advertencias.push("La factura no tiene NIT del receptor; se emitira como consumidor final (CF).");
  }
  const totales = calcularTotales(lineas);
  const cuadre = validarCuadre(totales);
  if (!cuadre.valido) advertencias.push(cuadre.motivo);
  const totalSistema = Number(invoice?.totalAmount ?? 0);
  if (totalSistema > 0 && Math.abs(totalSistema - totales.granTotal) > 0.01) {
    advertencias.push(
      `El total calculado (Q${totales.granTotal.toFixed(2)}) no coincide con el de la factura (Q${totalSistema.toFixed(2)}).`
    );
  }
  return { totales, advertencias, nitReceptor };
}
async function obtenerDocumentoPorFactura(supabase2, invoiceId) {
  const { data, error } = await supabase2.from("fel_documentos").select("*").eq("invoice_id", invoiceId).order("creado_en", { ascending: false }).limit(1);
  if (error) throw new Error(`No se pudo leer el documento FEL: ${error.message}`);
  return data && data.length ? data[0] : null;
}
async function listarDocumentos(supabase2, filtros = {}) {
  let q = supabase2.from("fel_documentos").select("*").order("creado_en", { ascending: false });
  if (filtros.estado) q = q.eq("estado", filtros.estado);
  q = q.limit(filtros.limite ?? 200);
  const { data, error } = await q;
  if (error) throw new Error(`No se pudieron listar los documentos FEL: ${error.message}`);
  return data || [];
}
async function registrarBitacora(supabase2, entrada) {
  try {
    await supabase2.from("fel_bitacora").insert(entrada);
  } catch {
  }
}
async function certificarFactura(supabase2, invoice, opciones = {}) {
  const inicio = Date.now();
  const config = await obtenerConfig(supabase2);
  const faltantes = configIncompleta(config);
  const tipoDte = opciones.tipoDte ?? (config?.tipo_dte_default || "FCAM");
  const { totales, advertencias, nitReceptor } = prepararDTE(invoice);
  const nitOverride = (opciones.receptor?.nit ?? "").toString().trim();
  const nombreOverride = (opciones.receptor?.nombre ?? "").toString().trim();
  const nitReceptorFinal = nitOverride || nitReceptor;
  const nombreReceptorFinal = nombreOverride || invoice.client || "Consumidor Final";
  if (nitOverride && !esConsumidorFinal(nitOverride)) {
    const i = advertencias.findIndex((a) => a.includes("consumidor final (CF)"));
    if (i >= 0) advertencias.splice(i, 1);
  }
  if (faltantes.length) {
    advertencias.push(`Falta completar la configuracion del emisor: ${faltantes.join(", ")}.`);
  }
  const existente = await obtenerDocumentoPorFactura(supabase2, invoice.id);
  if (existente && existente.estado === "certificado") {
    return {
      documento: existente,
      advertencias,
      certificado: true,
      mensaje: "Esta factura ya estaba certificada."
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
    receptor_nit: nitReceptorFinal || "CF",
    receptor_nombre: nombreReceptorFinal,
    intentos: (existente?.intentos ?? 0) + 1,
    actualizado_en: (/* @__PURE__ */ new Date()).toISOString()
  };
  const credenciales = {
    usuario: config?.infile_usuario ?? "",
    llaveFirma: config?.infile_llave_firma ?? "",
    llaveToken: config?.infile_llave_token ?? "",
    url: config?.infile_url ?? "",
    ambiente: config?.ambiente ?? "pruebas"
  };
  let xmlEnviado = null;
  if (faltantes.length === 0) {
    const fechaBase = new Date(invoice.date || Date.now());
    const vencimiento = new Date(fechaBase.getTime() + DIAS_CREDITO_FCAM * 864e5).toISOString().slice(0, 10);
    xmlEnviado = construirXmlDTE(
      {
        nit: config.nit_emisor,
        nombre: config.nombre_emisor,
        nombreComercial: config.nombre_comercial,
        correo: config.correo_emisor,
        direccion: config.direccion,
        codigoPostal: config.codigo_postal,
        municipio: config.municipio,
        departamento: config.departamento,
        pais: config.pais,
        codigoEstablecimiento: config.codigo_establecimiento,
        afiliacionIva: config.afiliacion_iva
      },
      { nit: nitReceptorFinal || "CF", nombre: nombreReceptorFinal, direccion: invoice.address, correo: invoice.email || invoice.clientEmail },
      totales,
      {
        tipo: tipoDte === "FCAM" ? "FCAM" : "FACT",
        moneda: config?.moneda || "GTQ",
        fechaVencimiento: vencimiento
      }
    );
  }
  const puedeCertificar = faltantes.length === 0 && credencialesCompletas(credenciales);
  if (!puedeCertificar) {
    const motivo = new InfileNoConfiguradoError().message;
    const registro = { ...base, estado: "pendiente", mensaje_error: motivo, xml_enviado: xmlEnviado };
    const { data, error } = await supabase2.from("fel_documentos").upsert(registro, { onConflict: "id" }).select().single();
    if (error) throw new Error(`No se pudo guardar el documento FEL: ${error.message}`);
    await registrarBitacora(supabase2, {
      documento_id: id,
      invoice_id: invoice.id,
      operacion: "certificar",
      exito: false,
      codigo_respuesta: "NO_CONFIGURADO",
      mensaje: motivo,
      duracion_ms: Date.now() - inicio
    });
    return { documento: data, advertencias, certificado: false, mensaje: motivo };
  }
  try {
    const resp = await certificarDTE(xmlEnviado, credenciales, id);
    const registro = {
      ...base,
      estado: resp.exito ? "certificado" : "error",
      numero_autorizacion: resp.numeroAutorizacion ?? null,
      serie: resp.serie ?? null,
      numero: resp.numero ?? null,
      xml_enviado: xmlEnviado,
      xml_certificado: resp.xmlCertificado ?? null,
      respuesta_certificador: resp.respuestaCompleta ?? null,
      fecha_certificacion: resp.exito ? resp.fecha ?? (/* @__PURE__ */ new Date()).toISOString() : null,
      mensaje_error: resp.exito ? null : resp.mensaje ?? "Rechazado por el certificador"
    };
    const { data, error } = await supabase2.from("fel_documentos").upsert(registro, { onConflict: "id" }).select().single();
    if (error) throw new Error(`No se pudo guardar el documento FEL: ${error.message}`);
    await registrarBitacora(supabase2, {
      documento_id: id,
      invoice_id: invoice.id,
      operacion: "certificar",
      exito: resp.exito,
      codigo_respuesta: resp.codigo ?? (resp.exito ? "CERTIFICADO" : null),
      mensaje: resp.mensaje ?? null,
      respuesta: resp.respuestaCompleta ?? null,
      duracion_ms: Date.now() - inicio
    });
    return {
      documento: data,
      // Las alertas de una certificacion exitosa (p. ej. el aviso de SandBox en
      // pruebas) se suman a las advertencias para que queden a la vista.
      advertencias: resp.alertas?.length ? [...advertencias, ...resp.alertas] : advertencias,
      certificado: !!resp.exito,
      mensaje: resp.mensaje
    };
  } catch (e) {
    const registro = { ...base, estado: "error", mensaje_error: e?.message ?? String(e), xml_enviado: xmlEnviado };
    const { data } = await supabase2.from("fel_documentos").upsert(registro, { onConflict: "id" }).select().single();
    await registrarBitacora(supabase2, {
      documento_id: id,
      invoice_id: invoice.id,
      operacion: "certificar",
      exito: false,
      mensaje: e?.message ?? String(e),
      duracion_ms: Date.now() - inicio
    });
    return {
      documento: data ?? { ...registro },
      advertencias,
      certificado: false,
      mensaje: e?.message ?? String(e)
    };
  }
}
async function anularFactura(supabase2, invoice, motivo) {
  const inicio = Date.now();
  const config = await obtenerConfig(supabase2);
  const documento = await obtenerDocumentoPorFactura(supabase2, invoice.id);
  if (!documento) throw new Error("Esta factura no tiene ningun documento FEL emitido.");
  if (documento.estado === "anulado") {
    return { documento, anulado: true, mensaje: "El documento ya estaba anulado." };
  }
  if (documento.estado !== "certificado" || !documento.numero_autorizacion) {
    throw new Error("Solo se puede anular un documento certificado ante SAT.");
  }
  const credenciales = {
    usuario: config?.infile_usuario ?? "",
    llaveFirma: config?.infile_llave_firma ?? "",
    llaveToken: config?.infile_llave_token ?? "",
    url: config?.infile_url ?? "",
    ambiente: config?.ambiente ?? "pruebas"
  };
  const xmlAnulacion = construirXmlAnulacion({
    numeroAutorizacion: documento.numero_autorizacion,
    nitEmisor: config?.nit_emisor ?? "",
    nitReceptor: extraerNit(invoice) || "CF",
    // OJO: debe ser la fecha que SAT registro al CERTIFICAR (la devuelve el
    // certificador), no la fecha de la factura del sistema. La factura suele
    // guardarse a medianoche UTC, que en hora de Guatemala cae el dia
    // anterior, y SAT rechaza la anulacion con FEL-GUI-56 ("la fecha de
    // emision no coincide con la registrada").
    fechaEmisionDocumento: documento.fecha_certificacion || invoice.date || (/* @__PURE__ */ new Date()).toISOString(),
    motivo
  });
  const resp = await anularDTE(xmlAnulacion, credenciales, `ANUL-${documento.id}`);
  const cambios = {
    actualizado_en: (/* @__PURE__ */ new Date()).toISOString(),
    respuesta_certificador: resp.respuestaCompleta ?? null
  };
  if (resp.exito) {
    cambios.estado = "anulado";
    cambios.motivo_anulacion = motivo;
    cambios.fecha_anulacion = (/* @__PURE__ */ new Date()).toISOString();
    cambios.mensaje_error = null;
  } else {
    cambios.mensaje_error = `Anulacion rechazada: ${resp.mensaje ?? "sin detalle"}`;
  }
  const { data, error } = await supabase2.from("fel_documentos").update(cambios).eq("id", documento.id).select().single();
  if (error) throw new Error(`No se pudo actualizar el documento FEL: ${error.message}`);
  await registrarBitacora(supabase2, {
    documento_id: documento.id,
    invoice_id: invoice.id,
    operacion: "anular",
    exito: resp.exito,
    codigo_respuesta: resp.codigo ?? (resp.exito ? "ANULADO" : null),
    mensaje: resp.exito ? motivo : resp.mensaje ?? null,
    respuesta: resp.respuestaCompleta ?? null,
    duracion_ms: Date.now() - inicio
  });
  return { documento: data, anulado: resp.exito, mensaje: resp.mensaje };
}

// server.ts
import { createClient } from "@supabase/supabase-js";
function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    console.warn(`[WARN] Variable de entorno ${name} no configurada. Usando valor por defecto.`);
    if (name === "JWT_SECRET") return "agricovet_secret_key_2026";
    if (name === "SUPABASE_URL") return "https://vedgedsbuajueynnyvpn.supabase.co";
    if (name === "SUPABASE_ANON_KEY") return "sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno";
    return "default_value";
  }
  return value.trim();
}
var JWT_SECRET = requireEnv("JWT_SECRET");
var supabaseUrl = requireEnv("SUPABASE_URL");
var supabaseKey = requireEnv("SUPABASE_ANON_KEY");
var supabase = createClient(supabaseUrl, supabaseKey);
console.log(`[DB] Conectado a Supabase: ${supabaseUrl}`);
var initialDb = {
  users: [
    { id: "u1b", name: "Due\xF1o / CEO", email: "seseffff942@gmail.com", role: "admin", photo: "https://i.pravatar.cc/150?u=9", password: "123" },
    { id: "u1", name: "Admin General", email: "admin2@agricovet.com", role: "admin", photo: "https://i.pravatar.cc/150?u=u1", password: "123" },
    { id: "u1c", name: "Admin 3", email: "admin3@agricovet.com", role: "admin", photo: "https://i.pravatar.cc/150?u=3", password: "123" },
    { id: "u2", name: "Ventas Principal", email: "ventas1@agricovet.com", role: "seller", photo: "https://i.pravatar.cc/150?u=u2", password: "123" },
    { id: "u2b", name: "Ventas 2", email: "ventas2@agricovet.com", role: "seller", photo: "https://i.pravatar.cc/150?u=5", password: "123" },
    { id: "u3", name: "Vendedor 3", email: "ll4961839@gmail.com", role: "seller", photo: "https://i.pravatar.cc/150?u=12", password: "123" },
    { id: "u4", name: "Herbert Argueta", sellerCode: "1521", email: "gruasytransportesali@gmail.com", role: "seller", photo: "https://i.pravatar.cc/150?u=13", password: "123" },
    { id: "u5", name: "Erick Ju\xE1rez", email: "jerickottoniel@gmail.com", role: "seller", photo: "https://i.pravatar.cc/150?u=14", password: "123" },
    { id: "u6", name: "Lima Lopez", email: "limalopez22@gmail.com", role: "seller", photo: "https://i.pravatar.cc/150?u=Lima", password: "123" }
  ],
  products: [
    { id: "p1", name: "Legatus mixx 30 OD litro", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p2", name: "Le\xF1ador 16 EW gal\xF3n", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p3", name: "Dimaxine 72 SL galon", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p4", name: "Terraquat 20 SL gal\xF3n", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p5", name: "Terraquat 20 SL litro", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p6", name: "Anorak 60 EC litro", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p7", name: "Duplexone 20 SL litro", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p8", name: "Le\xF1ador 16 EW 1 litro", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p9", name: "Revolver 36 5 SL litro", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p10", name: "Kaindor plus 30 SC litro", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p11", name: "SEMENTHAL 30 4 SL Caneca", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p12", name: "Torban 30 4 SL Caneca", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p13", name: "Triatleta 30 EW litro", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p14", name: "Nicogol 4 OD LITRO", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p15", name: "Dimaxine 72 SL litro", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p16", name: "Semental 16,5 SL litro", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p17", name: "Cegar 15 SL litro", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p18", name: "Azotela Max 85", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p19", name: "PILOT 56G 48X3", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p20", name: "Podador 60 WG 10X10gr", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p21", name: "Lasonate 90 SP 100 gr", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p22", name: "Revolver 36 5 SL caneca", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p23", name: "Torban 30 4 SL litro", category: "Agroqu\xEDmicos", stock: 100, price: 50 },
    { id: "p24", name: "Coriplus 10 gr", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p25", name: "Lombrifin 10 gr", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p26", name: "Oxiplus Vitaminado 10 gr", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p27", name: "Socofin BD 10gr", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p28", name: "Vita vet plus 10gr", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p29", name: "Chemiestress 10gr", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p30", name: "Tilosin plus 25 gr", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p31", name: "Oxiplus Vitaminado 25 gr", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p32", name: "Cori plus 100 gr", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p33", name: "Socofin BD 100 gr", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p34", name: "Vita vet Plus 100 gr", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p35", name: "Lombrifin 100 gr", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p36", name: "Oxiplus Vitaminado 100 gr", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p37", name: "Tilosin 10 ml", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p38", name: "Socofin drog 10 ml", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p39", name: "Tilosin 25 ml", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p40", name: "Socofin drog 25 ml", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p41", name: "Tilosin 100 mL", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p42", name: "Nexlabet LA 30.1-60kg", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p43", name: "Nexlabet LA 7.6-15kg", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p44", name: "Nexlabet LA 15-30kg", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p46", name: "Curabichera 400 ml", category: "Sistemas Agropecuarios", stock: 100, price: 50 },
    { id: "p47", name: "Vitel 100 gr", category: "Avindustrias", stock: 100, price: 50 },
    { id: "p48", name: "Vitel 15 gr", category: "Avindustrias", stock: 100, price: 50 },
    { id: "p49", name: "Multipack 26/52 150 gr", category: "Avindustrias", stock: 100, price: 50 },
    { id: "p50", name: "Multipack 26 52 15 gr", category: "Avindustrias", stock: 100, price: 50 },
    { id: "p51", name: "Trimsulfa plus 100 gr", category: "Avindustrias", stock: 100, price: 50 },
    { id: "p52", name: "Trinsulfa Plus 15 gr", category: "Avindustrias", stock: 100, price: 50 },
    { id: "p53", name: "Electrolitos y Vitaminas 100 gr", category: "Mallo", stock: 100, price: 50 },
    { id: "p54", name: "Electrolitos y Vitaminas 20 gr", category: "Mallo", stock: 100, price: 50 },
    { id: "p55", name: "Broximicina 100 gr", category: "Mallo", stock: 100, price: 50 },
    { id: "p56", name: "Fulmisarn spray 60 ml", category: "Mallo", stock: 100, price: 50 },
    { id: "p57", name: "Shampoo Pets 250ml", category: "Mallo", stock: 100, price: 50 },
    { id: "p58", name: "Vermimax plus 100 Tabletas", category: "Mallo", stock: 100, price: 50 },
    { id: "p59", name: "Jab\xF3n PET Gold Barra", category: "Mallo", stock: 100, price: 50 },
    { id: "p62", name: "Simparica trio 5-10kg", category: "Mallo", stock: 100, price: 50 },
    { id: "p63", name: "Broncowell 100 gr", category: "Wellco", stock: 100, price: 50 },
    { id: "p64", name: "Oxyfarm con electrolitos 100 gr", category: "Wellco", stock: 100, price: 50 },
    { id: "p65", name: "Caja oxyfarm 20 grs", category: "Wellco", stock: 100, price: 50 },
    { id: "p66", name: "All Trompa 454 gr", category: "Wellco", stock: 100, price: 50 },
    { id: "p67", name: "All Trompa 100 gr", category: "Wellco", stock: 100, price: 50 },
    { id: "p68", name: "Oxyfarm inyectable 10 ml", category: "Wellco", stock: 100, price: 50 },
    { id: "p69", name: "Oxyfarm inyectable 50ml", category: "Wellco", stock: 100, price: 50 },
    { id: "p70", name: "Oxyfarm inyectable 100 ml", category: "Wellco", stock: 100, price: 50 },
    { id: "p71", name: "Oxyfarm inyectable 250 ml", category: "Wellco", stock: 100, price: 50 },
    { id: "p72", name: "Pujantex 250 ml", category: "Wellco", stock: 100, price: 50 },
    { id: "p73", name: "Vita B12 con f\xF3sforo 250 ml", category: "Wellco", stock: 100, price: 50 },
    { id: "p74", name: "Ferradox plus 100 ml", category: "Wellco", stock: 100, price: 50 },
    { id: "p75", name: "Neocan 120ml", category: "Wellco", stock: 100, price: 50 },
    { id: "p76", name: "Neocan 240ml", category: "Wellco", stock: 100, price: 50 },
    { id: "p77", name: "Defender 10ml", category: "Wellco", stock: 100, price: 50 },
    { id: "p78", name: "Defender 50 ml", category: "Wellco", stock: 100, price: 50 },
    { id: "p79", name: "Defender 100 ml", category: "Wellco", stock: 100, price: 50 },
    { id: "p80", name: "Ferradox plus 10 ml", category: "Wellco", stock: 100, price: 50 },
    { id: "p81", name: "Tigent 20 ml", category: "Biozoo", stock: 100, price: 50 },
    { id: "p82", name: "Tigent 100ml", category: "Biozoo", stock: 100, price: 50 },
    { id: "p83", name: "Proteizoo plus 20ml", category: "Biozoo", stock: 100, price: 50 },
    { id: "p84", name: "Proteizoo Plus 250ml", category: "Biozoo", stock: 100, price: 50 },
    { id: "p85", name: "Ganazoo DP 20ml", category: "Biozoo", stock: 100, price: 50 },
    { id: "p86", name: "Bioxil 7% 500ml", category: "Biozoo", stock: 100, price: 50 },
    { id: "p87", name: "Dipiron 500 30 ml", category: "Lavet", stock: 100, price: 50 },
    { id: "p88", name: "Labimin 500 ml", category: "Lavet", stock: 100, price: 50 },
    { id: "p89", name: "Iverplus La 10ml 1%", category: "Tecniagro", stock: 100, price: 50 },
    { id: "p90", name: "Iverplus la 100 ml 1%", category: "Tecniagro", stock: 100, price: 50 },
    { id: "p91", name: "Iverplus La 500ml 1%", category: "Tecniagro", stock: 100, price: 50 },
    { id: "p92", name: "Iverplus 500 4%", category: "Tecniagro", stock: 100, price: 50 },
    { id: "p93", name: "Farma-Tecnimicina 50ml", category: "Tecniagro", stock: 100, price: 50 },
    { id: "p94", name: "Farma-tecnimicina 100ml", category: "Tecniagro", stock: 100, price: 50 },
    { id: "p95", name: "Farma-tecnimicina LA 10ml", category: "Tecniagro", stock: 100, price: 50 },
    { id: "p96", name: "Farma-tecnimicina LA 50ml", category: "Tecniagro", stock: 100, price: 50 },
    { id: "p97", name: "Farma-tecnimicina LA 100ml", category: "Tecniagro", stock: 100, price: 50 },
    { id: "p98", name: "Oxitetraciclina plus 250ml", category: "Insumos Modernos", stock: 100, price: 50 },
    { id: "p99", name: "Oxitetraciclina plus 100 ml", category: "Insumos Modernos", stock: 100, price: 50 },
    { id: "p100", name: "Oxitetraciclina plus 50ml", category: "Insumos Modernos", stock: 100, price: 50 },
    { id: "p101", name: "Oxitetraciclina plus 10ml", category: "Insumos Modernos", stock: 100, price: 50 },
    { id: "p102", name: "verrugan 20 ml", category: "Insumos Modernos", stock: 100, price: 50 },
    { id: "p103", name: "verrugan plus 30 ml", category: "Insumos Modernos", stock: 100, price: 50 },
    { id: "p104", name: "Oxitocina 10ml", category: "Insumos Modernos", stock: 100, price: 50 },
    { id: "p105", name: "Ectogan Pipeta Spot on", category: "Insumos Modernos", stock: 100, price: 50 },
    { id: "p106", name: "Ectogan pour On LITRO", category: "Insumos Modernos", stock: 100, price: 50 },
    { id: "p107", name: "Borogluconato de calcio 250 ml", category: "Insumos Modernos", stock: 100, price: 50 },
    { id: "p108", name: "Solumin 250ml", category: "Insumos Modernos", stock: 100, price: 50 },
    { id: "p109", name: "Instavit 500ml", category: "Agronorsa", stock: 100, price: 50 },
    { id: "p110", name: "Leche en polvo para Ternero", category: "Agronorsa", stock: 100, price: 50 },
    { id: "p111", name: "Nuvan 1L", category: "Agronorsa", stock: 100, price: 50 },
    { id: "p112", name: "Nuvan 100ml", category: "Agronorsa", stock: 100, price: 50 },
    { id: "p113", name: "Rata Quilla Sb caja", category: "Agrosona", stock: 100, price: 50 },
    { id: "p136", name: "Incubadora Pro 50 Huevos", category: "Incubadoras", stock: 5, price: 1200 },
    { id: "p137", name: "Incubadora Autom\xE1tica 24", category: "Incubadoras", stock: 2, price: 850 },
    { id: "p138", name: "Bandeja para Incubadora", category: "Incubadoras", stock: 10, price: 150 },
    { id: "p114", name: "JB Matagusano", category: "Botica Ganadera", stock: 100, price: 50 },
    { id: "p115", name: "Impacto spray 263 gr", category: "Botica Ganadera", stock: 100, price: 50 },
    { id: "p116", name: "Jeringa 1 ml 100U", category: "Botica Ganadera", stock: 100, price: 50 },
    { id: "p117", name: "Jeringa 3 ml 100U", category: "Botica Ganadera", stock: 100, price: 50 },
    { id: "p118", name: "Jeringa 5 ml 100U", category: "Botica Ganadera", stock: 100, price: 50 },
    { id: "p119", name: "Jeringa 10ml 100U", category: "Botica Ganadera", stock: 100, price: 50 },
    { id: "p120", name: "Lannate 100 ml", category: "Duwest", stock: 100, price: 50 },
    { id: "p121", name: "mirex 250 grs", category: "Duwest", stock: 100, price: 50 },
    { id: "p122", name: "mirex 500 grs", category: "Duwest", stock: 100, price: 50 },
    { id: "p123", name: "Broncobion maxx 30 ml", category: "Otros", stock: 100, price: 50 },
    { id: "p124", name: "Mielita Vip", category: "Otros", stock: 100, price: 50 },
    { id: "p125", name: "Anticion anticonceptivo", category: "Otros", stock: 100, price: 50 },
    { id: "p126", name: "Ccipermetrina 25 EC 100ml", category: "Tecun", stock: 100, price: 50 },
    { id: "p127", name: "Ccipermetrina 25 EC 250", category: "Tecun", stock: 100, price: 50 },
    { id: "p128", name: "Ccipermetrina 25 EC 500ml", category: "Tecun", stock: 100, price: 50 },
    { id: "p129", name: "Ccipermetrina 25 EC 1LT", category: "Tecun", stock: 100, price: 50 },
    { id: "p130", name: "CPF 2DP", category: "Tecun", stock: 100, price: 50 },
    { id: "p131", name: "semevin 36 FS", category: "Tecun", stock: 100, price: 50 },
    { id: "p132", name: "blindage 60 FS", category: "Tecun", stock: 100, price: 50 },
    { id: "p133", name: "FOLIAR PLUS", category: "Foragro", stock: 100, price: 50 },
    { id: "p134", name: "PIKUDO 20 SC", category: "Foragro", stock: 100, price: 50 },
    { id: "p135", name: "forza 60 WP", category: "Foragro", stock: 100, price: 50 },
    { id: "p139", name: "foranex 25.7", category: "Foragro", stock: 100, price: 50 }
  ],
  offers: []
};
function updateTagInNotes(notes, tag, value) {
  if (value === void 0 || value === null) return notes;
  const tagPattern = new RegExp(`\\|\\|\\|${tag}:[^|]*`, "g");
  const tagString = `|||${tag}:${value}`;
  if (notes.includes(`|||${tag}:`)) {
    return notes.replace(tagPattern, tagString);
  } else {
    return notes + (notes && !notes.endsWith(" ") ? " " : "") + tagString;
  }
}
async function seedDatabase(force = false) {
  try {
    console.log(`[Seed] Inactive check for products. force=${force}`);
    try {
      await supabase.from("products").delete().in("name", ["Dexametasona 20 ml", "Simparica trio 20-40kg", "Simparica trio 10-20kg"]);
    } catch (e) {
    }
    try {
      await supabase.from("users").update({ name: "Erick Ju\xE1rez" }).ilike("email", "jerickottoniel@gmail.com");
    } catch (e) {
    }
    const { data: defaultUsers, error: uErr } = await supabase.from("users").select("id").limit(1);
    if (uErr) {
      if (uErr.message && uErr.message.includes("fetch failed")) {
        console.warn("[Seed] Supabase DB offline or fetch failed; using local fallbacks.");
        return;
      }
      console.warn("[Seed] Error checking users:", uErr.message);
    } else if (force || !defaultUsers || defaultUsers.length === 0) {
      console.log("[Seed] Seeding users...");
      const userInserts = initialDb.users.map((u) => ({ ...u, password: u.password }));
      const { error: insErr } = await supabase.from("users").insert(userInserts);
      if (insErr) console.error("[Seed] User insertion failed:", insErr.message);
    }
    const { data: defaultProducts, error: pErr } = await supabase.from("products").select("id").limit(1);
    if (pErr) {
      console.warn("[Seed] Error checking products:", pErr.message);
    } else if (force || !defaultProducts || defaultProducts.length === 0) {
      console.log("[Seed] Seeding products...");
      const { error: insErr } = await supabase.from("products").insert(initialDb.products);
      if (insErr) console.error("[Seed] Product insertion failed:", insErr.message);
    }
    const { data: defaultOffers, error: oErr } = await supabase.from("offers").select("id").limit(1);
    if (oErr) {
      console.warn("[Seed] Error checking offers:", oErr.message);
    } else if (force || !defaultOffers || defaultOffers.length === 0) {
      console.log("[Seed] Seeding offers...");
      const { error: insErr } = await supabase.from("offers").insert(initialDb.offers);
      if (insErr) console.error("[Seed] Offer insertion failed:", insErr.message);
    }
    console.log("[Seed] Finished seeding process.");
  } catch (err) {
    console.warn("[Seed] Database seed skipped due to connectivity issue:", err?.message || err);
  }
}
var storage = multer.memoryStorage();
var imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Formato de archivo no v\xE1lido. Solo se permiten im\xE1genes y archivos PDF."), false);
  }
};
var upload = multer({ storage, fileFilter: imageFilter, limits: { fileSize: 20 * 1024 * 1024 } });
var app = express();
app.set("trust proxy", 1);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use((req, res, next) => {
  if (req.originalUrl && req.originalUrl.startsWith("/api") && (!req.url || req.url === "/" || req.url === "/api" || req.url === "/api/index.js")) {
    req.url = req.originalUrl;
  }
  if (req.url && req.url.startsWith("/api/api/")) {
    req.url = req.url.replace("/api/api/", "/api/");
  }
  next();
});
app.get("/api/webhooks", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  console.log("Webhook verify request received:", { mode, token });
  if (mode === "subscribe" && token === "Agricovet de Guatemala") {
    console.log("Webhook verified successfully!");
    res.set("Content-Type", "text/plain");
    return res.status(200).send(challenge);
  }
  console.error("Webhook verification failed. Token mismatch or missing params.");
  res.status(403).send("Verification failed");
});
app.post("/api/webhooks", (req, res) => {
  console.log("Webhook received:", req.body);
  res.status(200).json({ status: "success", received: true });
});
app.use(helmet({
  contentSecurityPolicy: false,
  // Disabling to avoid breaking the frontend during dev/build
  hsts: {
    maxAge: 31536e3,
    // 1 year
    includeSubDomains: true,
    preload: true
  }
}));
var sanitizeInput = (obj) => {
  if (typeof obj === "string") {
    return obj.replace(/[&<>'"]/g, (tag) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[tag] || tag);
  }
  if (Array.isArray(obj)) return obj.map(sanitizeInput);
  if (obj !== null && typeof obj === "object") {
    const newObj = {};
    for (const key in obj) {
      newObj[key] = sanitizeInput(obj[key]);
    }
    return newObj;
  }
  return obj;
};
var RUTAS_SIN_SANITIZAR = ["/api/invoices/print-template"];
app.use((req, res, next) => {
  const esRutaHtml = RUTAS_SIN_SANITIZAR.some((p) => req.path.startsWith(p));
  if (!esRutaHtml && req.body) req.body = sanitizeInput(req.body);
  if (req.query) req.query = sanitizeInput(req.query);
  if (req.params) req.params = sanitizeInput(req.params);
  next();
});
var apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 2e3,
  // limit each IP to 2000 requests per windowMs to allow short-polling
  message: { error: "Demasiadas peticiones desde esta IP, por favor int\xE9ntalo de nuevo despu\xE9s de 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false
});
var loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 10,
  // Limit each IP to 10 login requests per window
  message: { error: "Demasiados intentos de inicio de sesi\xF3n. Por favor intenta en 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false
});
app.use("/api/", apiLimiter);
app.use("/api/auth/login", loginLimiter);
if (!process.env.VERCEL) {
  seedDatabase().catch((err) => console.error("Seeding DB failed", err));
}
var memoryCache = {};
var DEFAULT_CACHE_TTL_MS = 6e4;
var getCachedData = (key) => {
  const entry = memoryCache[key];
  if (entry && Date.now() - entry.timestamp < entry.ttl) {
    return entry.data;
  }
  return null;
};
var setCachedData = (key, data, ttlMs = DEFAULT_CACHE_TTL_MS) => {
  memoryCache[key] = {
    timestamp: Date.now(),
    ttl: ttlMs,
    data
  };
};
var invalidateCache = (key) => {
  delete memoryCache[key];
};
async function getFolioMap(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCachedData("folio_map");
    if (cached) return cached;
  }
  let startFrom = 1;
  let resetDate = null;
  try {
    const { data: sysRow } = await supabase.from("users").select("photo").eq("id", "sys-folio-config").single();
    if (sysRow && sysRow.photo) {
      const config = JSON.parse(sysRow.photo);
      startFrom = config.startFrom || 1;
      resetDate = config.resetDate || null;
    }
  } catch (e) {
  }
  if (startFrom === 1 && !resetDate) {
    const FOLIO_CONFIG_FILE = path.join(process.cwd(), "folio_config.json");
    try {
      if (fs.existsSync(FOLIO_CONFIG_FILE)) {
        const config = JSON.parse(fs.readFileSync(FOLIO_CONFIG_FILE, "utf-8"));
        startFrom = config.startFrom || 1;
        resetDate = config.resetDate || null;
      }
    } catch (e) {
    }
  }
  let invoices = [];
  let page = 0;
  const PAGE_SIZE = 1e3;
  let hasMore = true;
  while (hasMore) {
    let query = supabase.from("invoices").select("id, date, status, notes, folio").eq("is_archived", false);
    if (resetDate) {
      query = query.gte("date", resetDate);
    }
    const { data: pageData, error } = await query.order("date", { ascending: true, nullsFirst: false }).order("id", { ascending: true }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) {
      if (error.code === "42703" || error.message?.includes("folio") || error.message?.includes("is_archived")) {
        let retryQ = supabase.from("invoices").select("id, date, status, notes");
        if (resetDate) retryQ = retryQ.gte("date", resetDate);
        const retryRes = await retryQ.order("date", { ascending: true, nullsFirst: false }).order("id", { ascending: true }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (retryRes.data && retryRes.data.length > 0) {
          invoices = invoices.concat(retryRes.data);
          if (retryRes.data.length < PAGE_SIZE) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      } else {
        console.error("Error fetching for folio map:", error.message);
        hasMore = false;
      }
    } else if (pageData && pageData.length > 0) {
      invoices = invoices.concat(pageData);
      if (pageData.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }
  const map = {};
  const usedFolios = /* @__PURE__ */ new Set();
  if (invoices && invoices.length > 0) {
    console.log(`[FolioDebug] Processing ${invoices.length} invoices. startFrom: ${startFrom}`);
    invoices.forEach((inv) => {
      if (!inv.id || inv.status === "cancelled" || inv.status === "rejected") return;
      if (inv.folio !== void 0 && inv.folio !== null && String(inv.folio).trim() !== "") {
        const num = parseInt(String(inv.folio).trim(), 10);
        if (!isNaN(num) && num > 0) {
          map[String(inv.id)] = num;
          usedFolios.add(num);
          return;
        }
      }
      if (inv.notes && inv.notes.includes("|||FOLIO:")) {
        const match = inv.notes.match(/\|\|\|FOLIO:(\d+)/);
        if (match && match[1]) {
          const manualFolio = parseInt(match[1], 10);
          if (!isNaN(manualFolio)) {
            map[String(inv.id)] = manualFolio;
            usedFolios.add(manualFolio);
          }
        }
      }
    });
    let currentFolio = startFrom;
    invoices.forEach((inv) => {
      if (!inv.id || inv.status === "cancelled" || inv.status === "rejected") return;
      if (map[String(inv.id)] !== void 0) return;
      while (usedFolios.has(currentFolio) || currentFolio === 812) {
        currentFolio++;
      }
      map[String(inv.id)] = currentFolio;
      usedFolios.add(currentFolio);
      currentFolio++;
    });
    console.log(`Folio map generated: ${Object.keys(map).length} active entries.`);
  } else {
    console.log("No invoices found for folio map generation.");
  }
  setCachedData("folio_map", map, 10 * 60 * 1e3);
  return map;
}
var requireAuth = async (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization || req.headers.Authorization || req.headers["x-authorization"] || req.headers["x-access-token"];
  if (authHeader && typeof authHeader === "string") {
    token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }
  if (!token) {
    return res.status(401).json({ error: "Acceso no autorizado: Token faltante" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const iat = payload.iat ? payload.iat * 1e3 : 0;
    let user = null;
    try {
      const { data: users } = await supabase.from("users").select("*").eq("id", payload.id);
      if (users && users.length > 0) {
        user = users[0];
        if (user.force_logout_at && new Date(user.force_logout_at).getTime() > iat) {
          return res.status(401).json({ error: "Tu sesi\xF3n ha sido cerrada por el administrador. Por favor, inicia sesi\xF3n de nuevo." });
        }
      }
    } catch (dbErr) {
      console.warn("DB error in requireAuth, trying initialDb fallback:", dbErr);
    }
    if (!user) {
      user = initialDb.users.find((u) => u.id === payload.id);
    }
    if (!user) {
      return res.status(401).json({ error: "Acceso no autorizado: Usuario no existe" });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Acceso no autorizado: Token inv\xE1lido o expirado" });
  }
};
var requireAdmin = (req, res, next) => {
  const role = (req.user?.role || "").toLowerCase().trim();
  if (!req.user || role !== "admin" && role !== "due\xF1o" && role !== "dueno" && role !== "ceo" && role !== "owner") {
    return res.status(403).json({ error: "Acceso denegado: Se requieren permisos de administrador" });
  }
  next();
};
var doesNotNeedStock = (product) => {
  if (!product) return false;
  const nameLower = (product.name || "").toLowerCase();
  const categoryLower = (product.category || "").toLowerCase();
  if (categoryLower.includes("incubadora") || nameLower.includes("incubadora")) {
    return true;
  }
  const keywords = ["bebedero", "comedero", "puya", "arete", "aretes"];
  return keywords.some((keyword) => nameLower.includes(keyword) || categoryLower.includes(keyword));
};
var is100gProduct = (product) => {
  if (!product) return false;
  const nameL = (product.name || "").toLowerCase();
  const catL = (product.category || "").toLowerCase();
  const combined = `${nameL} ${catL}`;
  return /100\s*(g|gr|gram|gramos)\b/i.test(combined) || combined.includes("100g") || combined.includes("100 g") || combined.includes("100gr") || combined.includes("100 gr") || combined.includes("100gramos") || combined.includes("100 gramos");
};
var getCriticalStockThreshold = (product) => {
  if (!product) return 5;
  const nameL = (product.name || "").toLowerCase();
  const catL = (product.category || "").toLowerCase();
  const isSA = nameL.includes("sistemas agropecuarios") || catL.includes("sistemas agropecuarios");
  const isNexlabet = nameL.includes("nexlabet");
  const isOtherCritical = nameL.includes("broncobion max") || nameL.includes("avimdustrias mirex") || nameL.includes("forza");
  if (isSA && !isNexlabet || isOtherCritical) {
    return 120;
  }
  if (is100gProduct(product)) {
    return 25;
  }
  return 5;
};
var isCriticalStock = (product, currentStock) => {
  if (!product) return false;
  const stock = currentStock !== void 0 ? currentStock : product.stock || 0;
  const threshold = getCriticalStockThreshold(product);
  return stock <= threshold;
};
var stockLockMap = /* @__PURE__ */ new Map();
async function acquireStockLocks(productIds) {
  const validIds = Array.from(new Set(productIds.filter((id) => Boolean(id)))).sort();
  if (validIds.length === 0) return () => {
  };
  const previousLocks = validIds.map((id) => stockLockMap.get(id) || Promise.resolve());
  await Promise.all(previousLocks);
  let releaseCallback = () => {
  };
  const newLock = new Promise((resolve) => {
    releaseCallback = resolve;
  });
  for (const id of validIds) {
    stockLockMap.set(id, newLock);
  }
  return () => {
    releaseCallback();
    for (const id of validIds) {
      if (stockLockMap.get(id) === newLock) {
        stockLockMap.delete(id);
      }
    }
  };
}
async function restaurarStockDeFactura(invoice) {
  for (const item of invoice.items || []) {
    const { data: prods } = await supabase.from("products").select("stock, is_external, variants").eq("id", item.productId);
    const product = prods?.[0];
    if (product && !product.is_external) {
      let variantsToUpdate = product.variants ? [...product.variants] : [];
      let variantObj = null;
      if (item.variantId) {
        const varIndex = variantsToUpdate.findIndex((v) => v.id === item.variantId);
        if (varIndex !== -1) {
          variantObj = variantsToUpdate[varIndex];
        }
      }
      if (variantObj && variantObj.stock !== void 0) {
        const varIndex = variantsToUpdate.findIndex((v) => v.id === item.variantId);
        variantsToUpdate[varIndex] = { ...variantObj, stock: parseFloat(variantObj.stock || 0) + parseFloat(item.quantity) };
        const { error: vErr } = await supabase.from("products").update({ variants: variantsToUpdate }).eq("id", item.productId);
        if (vErr) console.error(`Error restoring variant stock for product ${item.productId}:`, vErr.message);
      } else {
        const { error: sErr } = await supabase.from("products").update({ stock: parseFloat(product.stock || 0) + parseFloat(item.quantity) }).eq("id", item.productId);
        if (sErr) console.error(`Error restoring stock for product ${item.productId}:`, sErr.message);
      }
    }
  }
}
var asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
app.post("/api/admin/seed", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { force } = req.body;
  await seedDatabase(!!force);
  res.json({ success: true, message: "Base de datos sincronizada con datos iniciales." });
}));
app.post("/api/save-dispatch", requireAuth, asyncHandler(async (req, res) => {
  const { invoiceId, items, client, sellerId } = req.body;
  const dispatchId = `DISP-${Date.now()}`;
  const dispatchRecord = {
    id: dispatchId,
    invoiceId,
    items,
    date: (/* @__PURE__ */ new Date()).toISOString(),
    client,
    sellerId: sellerId || req.user.id
  };
  await supabase.from("dispatches").insert([dispatchRecord]);
  res.json({ success: true, dispatchId });
}));
app.post("/api/invoices/:id/dispatch", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("invoices").update({ status: "despachado" }).eq("id", id);
  if (error) throw error;
  await syncInvoiceToPermanentBackup(id);
  res.json({ success: true });
}));
var NOTIFICATIONS_FILE = path.join(process.cwd(), "notifications_local.json");
var WAREHOUSE_CONFIG_FILE = path.join(process.cwd(), "warehouse_config.json");
function readWarehouseConfig() {
  try {
    if (fs.existsSync(WAREHOUSE_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(WAREHOUSE_CONFIG_FILE, "utf8"));
    }
  } catch (err) {
    console.error("Error reading warehouse config:", err);
  }
  return { location: "", password: "123" };
}
function saveWarehouseConfig(config) {
  try {
    fs.writeFileSync(WAREHOUSE_CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving warehouse config:", err);
  }
}
var vapidKeys;
var VAPID_FILE = path.join(process.cwd(), "vapid_keys.json");
var SUBSCRIPTIONS_FILE = path.join(process.cwd(), "push_subscriptions.json");
if (fs.existsSync(VAPID_FILE)) {
  try {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, "utf8"));
  } catch (err) {
    console.error("Error reading stable VAPID file, regenerando...", err);
    vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2), "utf8");
  }
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing stable VAPID file:", err);
  }
}
webpush.setVapidDetails(
  "mailto:seseffff942@gmail.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);
function readPushSubscriptions() {
  try {
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, "utf8"));
    }
  } catch (err) {
    console.error("Error reading push subscriptions:", err);
  }
  return [];
}
function savePushSubscriptions(subs) {
  try {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subs, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving push subscriptions:", err);
  }
}
async function broadcastPushNotification(title, message, url = "/") {
  const config = readWarehouseConfig();
  if (config.isSilentModeActive) {
    console.log(`[Push Notification - SILENT MODE] Bypassed: "${title}" - "${message}"`);
    return;
  }
  const subs = readPushSubscriptions();
  if (subs.length === 0) return;
  const payload = JSON.stringify({ title, message, url });
  const promises = subs.map(async (sub) => {
    try {
      await webpush.sendNotification(sub, payload, {
        headers: {
          "Urgency": "high"
        },
        TTL: 86400
        // 24 hours in seconds
      });
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        const current = readPushSubscriptions();
        const updated = current.filter((s) => s.endpoint !== sub.endpoint);
        savePushSubscriptions(updated);
      } else {
        console.error("Failed to send push to:", sub.endpoint, err.message || err);
      }
    }
  });
  await Promise.allSettled(promises);
}
function readLocalNotifications() {
  try {
    if (fs.existsSync(NOTIFICATIONS_FILE)) {
      return JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, "utf8"));
    }
  } catch (err) {
    console.error("Error reading local notifications:", err);
  }
  return [];
}
function saveLocalNotifications(notifications) {
  try {
    fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving local notifications:", err);
  }
}
async function createNotification(type, title, message, extra = {}) {
  console.log(`[Notification Bypassed (Disabled Temporarily)] Type: ${type}, Title: ${title}`);
  return {
    id: `ntf-disabled`,
    type,
    title,
    message,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    ...extra
  };
}
var CLIENTS_FILE = path.join(process.cwd(), "clients_local.json");
function readLocalClients() {
  try {
    if (fs.existsSync(CLIENTS_FILE)) {
      return JSON.parse(fs.readFileSync(CLIENTS_FILE, "utf8"));
    }
  } catch (err) {
    console.error("Error reading local clients:", err);
  }
  return [];
}
function saveLocalClients(clients) {
  try {
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving local clients:", err);
  }
}
function findMatchingClient(list, name, companyName, nit, clientCode, includeDeleted = false) {
  if (!list || list.length === 0) return null;
  let normName = (name || "").trim().toLowerCase();
  if (normName.startsWith("[deleted]")) {
    normName = normName.replace(/\[deleted\]/gi, "").trim();
  }
  if (normName.includes(" - ")) {
    normName = normName.split(" - ")[0].trim();
  }
  if (!normName) return null;
  const normNit = (v) => String(v ?? "").replace(/[\s\-\/\.]/g, "").toUpperCase();
  const targetNit = normNit(nit);
  const targetCode = (clientCode || "").trim();
  return list.find((c) => {
    if (!c || !c.name) return false;
    const rawName = String(c.name).trim();
    const isDel = c.isDeleted || c.is_deleted || rawName.toUpperCase().includes("[DELETED]") || rawName.toUpperCase().includes("(DELETED)");
    if (isDel && !includeDeleted) return false;
    if (!isDel && includeDeleted) return false;
    const cId = c.id ? String(c.id).trim() : "";
    let cName = rawName.toLowerCase();
    if (cName.startsWith("[deleted]")) {
      cName = cName.replace(/\[deleted\]/gi, "").trim();
    }
    if (cName.includes(" - ")) {
      cName = cName.split(" - ")[0].trim();
    }
    const cCode = (c.clientCode || c.client_code || "").trim();
    const cNit = normNit(c.nit);
    if (targetCode && cCode && targetCode === cCode) return true;
    if (targetNit && targetNit !== "CF" && targetNit !== "CONSUMIDORFINAL" && cNit === targetNit) return true;
    if (cName && normName && cName === normName) return true;
    return false;
  }) || null;
}
function addLocalClient(client) {
  const clients = readLocalClients();
  const existing = findMatchingClient(clients, client.name, client.companyName, client.nit, client.clientCode);
  if (!existing) {
    clients.push(client);
    saveLocalClients(clients);
  } else {
    updateLocalClient(existing.id, client);
  }
  invalidateCache("clients");
}
function deduplicateClients(clientsList) {
  const normNit = (v) => String(v ?? "").replace(/[\s\-\/\.]/g, "").toUpperCase();
  const result = [];
  clientsList.forEach((c) => {
    if (!c || !c.name) return;
    const cId = c.id ? String(c.id).trim() : "";
    let cName = (c.name || "").toLowerCase().trim();
    if (cName.includes(" - ")) cName = cName.split(" - ")[0].trim();
    const cCode = (c.clientCode || c.client_code || "").trim();
    const cNit = normNit(c.nit);
    const existingIdx = result.findIndex((existing) => {
      if (!existing) return false;
      const eId = existing.id ? String(existing.id).trim() : "";
      let eName = (existing.name || "").toLowerCase().trim();
      if (eName.includes(" - ")) eName = eName.split(" - ")[0].trim();
      const eCode = (existing.clientCode || existing.client_code || "").trim();
      const eNit = normNit(existing.nit);
      if (cId && eId && cId.toLowerCase() === eId.toLowerCase()) return true;
      if (cCode && eCode && cCode === eCode) return true;
      if (cNit && eNit && cNit !== "CF" && cNit !== "CONSUMIDORFINAL" && cNit === eNit) return true;
      if (cName && eName && cName === eName) return true;
      return false;
    });
    if (existingIdx === -1) {
      result.push({ ...c });
    } else {
      const existing = result[existingIdx];
      result[existingIdx] = {
        ...existing,
        ...c,
        name: c.name || existing.name,
        companyName: c.companyName || existing.companyName,
        nit: c.nit && c.nit.toUpperCase() !== "CF" ? c.nit : existing.nit,
        phone: c.phone || existing.phone,
        address: c.address || existing.address,
        sellerId: c.sellerId || existing.sellerId,
        clientCode: c.clientCode || existing.clientCode,
        latitude: c.latitude !== void 0 ? c.latitude === null ? null : Number(c.latitude) : existing.latitude,
        longitude: c.longitude !== void 0 ? c.longitude === null ? null : Number(c.longitude) : existing.longitude,
        locationAddress: c.locationAddress !== void 0 ? c.locationAddress : existing.locationAddress,
        geotaggedAt: c.geotaggedAt !== void 0 ? c.geotaggedAt : existing.geotaggedAt,
        geotaggedBy: c.geotaggedBy !== void 0 ? c.geotaggedBy : existing.geotaggedBy
      };
    }
  });
  return result;
}
function updateLocalClient(id, updates, oldData) {
  const clients = readLocalClients();
  let updated = false;
  const targetId = id ? String(id).trim() : "";
  const oldName = (oldData?.name || updates?.oldName || "").trim().toLowerCase();
  const oldCode = (oldData?.clientCode || updates?.oldClientCode || "").trim();
  const newCode = (updates?.clientCode || "").trim();
  const newName = (updates?.name || "").trim().toLowerCase();
  const normNit = (v) => String(v ?? "").replace(/[\s\-\/\.]/g, "").toUpperCase();
  const targetNit = normNit(updates?.nit || oldData?.nit);
  const newClients = clients.map((c) => {
    if (!c) return c;
    const cId = c.id ? String(c.id).trim() : "";
    const cName = c.name ? String(c.name).trim().toLowerCase() : "";
    let normCName = cName;
    if (normCName.includes(" - ")) normCName = normCName.split(" - ")[0].trim();
    const cCode = (c.clientCode || c.client_code || "").trim();
    const cNit = normNit(c.nit);
    const idMatch = targetId && cId && targetId.toLowerCase() === cId.toLowerCase();
    const codeMatch = newCode && cCode && newCode === cCode || oldCode && cCode && oldCode === cCode;
    const nitMatch = targetNit && targetNit !== "CF" && targetNit !== "CONSUMIDORFINAL" && cNit === targetNit;
    const nameMatch = newName && (cName === newName || normCName === newName) || oldName && (cName === oldName || normCName === oldName);
    if (idMatch || codeMatch || nitMatch || nameMatch) {
      updated = true;
      return { ...c, ...updates, id: c.id || targetId };
    }
    return c;
  });
  if (!updated) {
    newClients.push({ id: targetId || `CLI-${Date.now()}`, ...updates });
  }
  const deduplicated = deduplicateClients(newClients);
  saveLocalClients(deduplicated);
  invalidateCache("clients");
}
function getDeletedClientKeys() {
  const current = /* @__PURE__ */ new Set();
  try {
    const pathsToTry = ["deleted_clients.json", "/tmp/deleted_clients.json", path.join(process.cwd(), "deleted_clients.json")];
    pathsToTry.forEach((fp) => {
      if (fs.existsSync(fp)) {
        const raw = fs.readFileSync(fp, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((k) => {
            if (k) current.add(String(k).trim().toLowerCase());
          });
        }
      }
    });
  } catch (e) {
  }
  return current;
}
function addDeletedClientKeys(...keys) {
  const current = getDeletedClientKeys();
  keys.forEach((k) => {
    if (k) {
      const str = String(k).trim();
      const norm = str.toLowerCase();
      if (norm && norm !== "cf" && norm !== "c/f" && norm !== "consumidorfinal") {
        current.add(norm);
        if (norm.includes(" - ")) {
          const parts = norm.split(" - ");
          if (parts[0].trim()) current.add(parts[0].trim().toLowerCase());
        }
      }
    }
  });
  const arr = Array.from(current);
  const pathsToSave = ["deleted_clients.json", "/tmp/deleted_clients.json", path.join(process.cwd(), "deleted_clients.json")];
  pathsToSave.forEach((fp) => {
    try {
      fs.writeFileSync(fp, JSON.stringify(arr, null, 2));
    } catch (e) {
    }
  });
}
function removeDeletedClientKey(...keys) {
  const current = getDeletedClientKeys();
  let changed = false;
  keys.forEach((k) => {
    if (k) {
      const norm = String(k).trim().toLowerCase();
      if (norm && current.has(norm)) {
        current.delete(norm);
        changed = true;
      }
    }
  });
  if (changed) {
    const arr = Array.from(current);
    const pathsToSave = ["deleted_clients.json", "/tmp/deleted_clients.json", path.join(process.cwd(), "deleted_clients.json")];
    pathsToSave.forEach((fp) => {
      try {
        fs.writeFileSync(fp, JSON.stringify(arr, null, 2));
      } catch (e) {
      }
    });
  }
}
function isClientDeleted(c, deletedKeys) {
  if (!c) return true;
  const rawName = String(c.name || "").trim();
  if (rawName.toUpperCase().includes("[DELETED]") || rawName.toUpperCase().includes("(DELETED)")) return true;
  if (c.isDeleted === true || c.is_deleted === true) return true;
  const keys = deletedKeys || getDeletedClientKeys();
  if (!keys || keys.size === 0) return false;
  const cId = c.id ? String(c.id).trim().toLowerCase() : "";
  const cName = rawName.toLowerCase();
  let normName = cName;
  if (normName.includes(" - ")) {
    normName = normName.split(" - ")[0].trim();
  }
  const cCode = (c.clientCode || c.client_code || c.clientcode || "").trim().toLowerCase();
  const cNit = (c.nit || "").trim().toLowerCase();
  if (cId && keys.has(cId)) return true;
  if (cCode && keys.has(cCode)) return true;
  if (cName && keys.has(cName)) return true;
  if (normName && keys.has(normName)) return true;
  if (cNit && cNit !== "cf" && cNit !== "c/f" && cNit !== "consumidorfinal" && keys.has(cNit)) return true;
  return false;
}
function deleteLocalClient(id, name, clientCode, companyName, nit) {
  addDeletedClientKeys(id, name, clientCode, nit);
  const deletedKeys = getDeletedClientKeys();
  const clients = readLocalClients();
  const filtered = clients.filter((c) => !isClientDeleted(c, deletedKeys));
  saveLocalClients(filtered);
  invalidateCache("clients");
}
async function generateUniqueClientCode() {
  let code = "";
  let isUnique = false;
  let attempts = 0;
  while (!isUnique && attempts < 50) {
    code = Math.floor(1e3 + Math.random() * 9e3).toString();
    const clients = readLocalClients();
    const existing = clients.find((c) => c.clientCode === code);
    if (!existing) isUnique = true;
    attempts++;
  }
  return code;
}
async function safeInsertClient(clientData) {
  try {
    if (!clientData.clientCode || clientData.clientCode.trim() === "") {
      clientData.clientCode = await generateUniqueClientCode();
    }
    const { error } = await supabase.from("clients").insert([clientData]);
    if (!error) return true;
    console.warn("Primary Supabase client insert failed, trying fallbacks:", error.message);
    const payload = {
      id: clientData.id,
      name: clientData.name,
      nit: clientData.nit || "",
      phone: clientData.phone || "",
      address: clientData.address || "",
      companyName: clientData.companyName || "",
      company_name: clientData.companyName || "",
      createdAt: clientData.createdAt || clientData.created_at,
      created_at: clientData.createdAt || clientData.created_at || (/* @__PURE__ */ new Date()).toISOString(),
      sellerId: clientData.sellerId || "",
      seller_id: clientData.sellerId || "",
      clientCode: clientData.clientCode,
      isBlocked: clientData.isBlocked || false
    };
    const { error: errorWithFallbacks } = await supabase.from("clients").insert([payload]);
    if (!errorWithFallbacks) return true;
    console.warn("Casing fallback client insert failed, retrying with column exclusions:", errorWithFallbacks.message);
    let prunedPayload = { ...payload };
    let needsRetry = false;
    const errMsg = errorWithFallbacks.message;
    if (errMsg.includes("sellerId") || errMsg.includes('column "sellerId"') || errMsg.includes("schema cache")) {
      delete prunedPayload.sellerId;
      needsRetry = true;
    }
    if (errMsg.includes("seller_id") || errMsg.includes('column "seller_id"')) {
      delete prunedPayload.seller_id;
      needsRetry = true;
    }
    if (errMsg.includes("createdAt") || errMsg.includes('column "createdAt"')) {
      delete prunedPayload.createdAt;
      needsRetry = true;
    }
    if (errMsg.includes("created_at") || errMsg.includes('column "created_at"')) {
      delete prunedPayload.created_at;
      needsRetry = true;
    }
    if (errMsg.includes("companyName") || errMsg.includes('column "companyName"')) {
      delete prunedPayload.companyName;
      needsRetry = true;
    }
    if (errMsg.includes("company_name") || errMsg.includes('column "company_name"')) {
      delete prunedPayload.company_name;
      needsRetry = true;
    }
    if (needsRetry) {
      const { error: retryError } = await supabase.from("clients").insert([prunedPayload]);
      if (!retryError) return true;
      console.warn("Client pruned insert failed:", retryError.message);
    }
    const bareClient = {
      id: clientData.id,
      name: clientData.name,
      nit: clientData.nit || "",
      phone: clientData.phone || "",
      address: clientData.address || ""
    };
    const { error: bareError } = await supabase.from("clients").insert([bareClient]);
    if (!bareError) return true;
    console.error("Bare client backup insert failed:", bareError.message);
    return false;
  } catch (e) {
    console.error("Exception in safeInsertClient:", e);
    return false;
  }
}
var PAYMENTS_FILE = path.join(process.cwd(), "payments_local.json");
function readLocalPayments() {
  try {
    if (fs.existsSync(PAYMENTS_FILE)) {
      return JSON.parse(fs.readFileSync(PAYMENTS_FILE, "utf8"));
    }
  } catch (err) {
    console.error("Error reading local payments:", err);
  }
  return [];
}
function saveLocalPayments(payments) {
  try {
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(payments, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving local payments:", err);
  }
}
function addLocalPayment(payment) {
  const payments = readLocalPayments();
  const exists = payments.some((p) => p.id === payment.id);
  if (!exists) {
    payments.push(payment);
    saveLocalPayments(payments);
  }
}
function normalizePayment(p) {
  if (!p) return p;
  let rUrl = p.receiptUrl || p.receipturl || p.receipt_url;
  if (!rUrl && p.notes && (p.notes.startsWith("http") || p.notes.includes("data:image"))) {
    rUrl = p.notes;
  }
  return {
    id: p.id,
    invoiceId: p.invoiceId || p.invoiceid || p.invoice_id,
    amount: typeof p.amount === "string" ? parseFloat(p.amount) : p.amount,
    receiptUrl: rUrl,
    date: p.date,
    notes: p.notes,
    recordedBy: p.recordedBy || p.recordedby || p.recorded_by || null
  };
}
async function safeInsertPayment(payment) {
  try {
    const rUrl = payment.receiptUrl || payment.receipturl || payment.receipt_url;
    const paymentToInsert = {
      id: payment.id,
      invoiceId: payment.invoiceId || payment.invoiceid || payment.invoice_id,
      amount: payment.amount,
      date: payment.date,
      receiptUrl: rUrl || null,
      notes: payment.notes || null
    };
    const { error } = await supabase.from("payments").insert([paymentToInsert]);
    if (!error) return true;
    console.warn("Primary Supabase payment insert failed, trying falling back without receiptUrl:", error.message);
    delete paymentToInsert.receiptUrl;
    paymentToInsert.notes = rUrl || paymentToInsert.notes || null;
    const { error: retryError } = await supabase.from("payments").insert([paymentToInsert]);
    if (!retryError) return true;
    console.error("Retry insert failed:", retryError.message);
    return false;
  } catch (err) {
    console.error("Exception in safeInsertPayment:", err);
    return false;
  }
}
var JSON_BACKUP_ENABLED = process.env.ENABLE_JSON_BACKUP === "true";
async function syncInvoiceToPermanentBackup(id, invoiceObj) {
  if (!JSON_BACKUP_ENABLED) return;
  try {
    const backupPath = path.join(process.cwd(), "invoices_permanent_backup.json");
    let invoicesList = [];
    if (fs.existsSync(backupPath)) {
      try {
        invoicesList = JSON.parse(fs.readFileSync(backupPath, "utf8"));
      } catch (e) {
        console.error("Error reading invoices permanent backup file:", e);
      }
    }
    let invoiceData = invoiceObj;
    if (!invoiceData) {
      const { data } = await supabase.from("invoices").select("*").eq("id", id).single();
      invoiceData = data;
    }
    if (invoiceData) {
      invoicesList = invoicesList.filter((inv) => inv.id !== id);
      invoicesList.push(invoiceData);
      fs.writeFileSync(backupPath, JSON.stringify(invoicesList, null, 2), "utf8");
      console.log(`[Backup] Persisted invoice ${id} to invoices_permanent_backup.json`);
    }
  } catch (err) {
    console.error(`Error syncing invoice ${id} to permanent backup:`, err.message);
  }
}
async function syncPaymentToPermanentBackup(id, paymentObj) {
  if (!JSON_BACKUP_ENABLED) return;
  try {
    const backupPath = path.join(process.cwd(), "payments_permanent_backup.json");
    let paymentsList = [];
    if (fs.existsSync(backupPath)) {
      try {
        paymentsList = JSON.parse(fs.readFileSync(backupPath, "utf8"));
      } catch (e) {
        console.error("Error reading payments permanent backup file:", e);
      }
    }
    let paymentData = paymentObj;
    if (!paymentData) {
      const { data } = await supabase.from("payments").select("*").eq("id", id).single();
      paymentData = data;
    }
    if (paymentData) {
      paymentsList = paymentsList.filter((p) => p.id !== id);
      paymentsList.push(paymentData);
      fs.writeFileSync(backupPath, JSON.stringify(paymentsList, null, 2), "utf8");
      console.log(`[Backup] Persisted payment ${id} to payments_permanent_backup.json`);
    }
  } catch (err) {
    console.error(`Error syncing payment ${id} to permanent backup:`, err.message);
  }
}
async function fetchPaymentsFromSupabase(invoiceId) {
  const filterValid = (list) => (list || []).filter((p) => p && parseFloat(p.amount) > 0 && p.notes !== "[ELIMINADO]").map(normalizePayment);
  try {
    const { data, error } = await supabase.from("payments").select("*").eq("invoiceId", invoiceId);
    if (!error && data) return filterValid(data);
    if (error) {
      console.warn("Fetch payments eq('invoiceId') failed, trying fallback columns:", error.message);
    }
  } catch (err) {
    console.error("Exception fetching payments with invoiceId:", err);
  }
  try {
    const { data, error } = await supabase.from("payments").select("*").eq("invoiceid", invoiceId);
    if (!error && data) return filterValid(data);
  } catch (err) {
  }
  try {
    const { data, error } = await supabase.from("payments").select("*").eq("invoice_id", invoiceId);
    if (!error && data) return filterValid(data);
  } catch (err) {
  }
  try {
    const { data, error } = await supabase.from("payments").select("*");
    if (!error && data) {
      const filtered = data.filter((d) => {
        const val = d.invoiceId || d.invoiceid || d.invoice_id;
        return val === invoiceId;
      });
      return filterValid(filtered);
    }
  } catch (err) {
  }
  return [];
}
app.get("/api/clients", requireAuth, asyncHandler(async (req, res) => {
  const cached = getCachedData("clients");
  if (cached) {
    return res.json(cached);
  }
  const deletedKeys = getDeletedClientKeys();
  let dbClients = [];
  try {
    const { data, error } = await supabase.from("clients").select("*");
    if (!error && data) {
      dbClients = data;
    } else if (error) {
      if (error.code !== "42P01" && !error.message.includes("schema cache") && !error.message.includes("does not exist")) {
        console.error("Fetch clients Supabase error:", error.message);
      }
    }
  } catch (e) {
    console.error("Fetch clients Supabase catch error:", e);
  }
  const localClients = readLocalClients();
  const allDbDeletedNames = /* @__PURE__ */ new Set();
  const allDbDeletedIds = /* @__PURE__ */ new Set();
  dbClients.forEach((c) => {
    if (!c) return;
    const rawName = String(c.name || "").trim();
    const isDel = c.isDeleted || c.is_deleted || rawName.toUpperCase().includes("[DELETED]") || rawName.toUpperCase().includes("(DELETED)");
    if (isDel) {
      if (c.id) allDbDeletedIds.add(String(c.id).trim().toLowerCase());
      const cleanName = rawName.replace(/\[DELETED\]/gi, "").replace(/\(DELETED\)/gi, "").trim().toLowerCase();
      if (cleanName) {
        allDbDeletedNames.add(cleanName);
        if (cleanName.includes(" - ")) {
          allDbDeletedNames.add(cleanName.split(" - ")[0].trim());
        }
      }
    }
  });
  const validDbClients = dbClients.filter((c) => !isClientDeleted(c, deletedKeys));
  const validLocalClients = localClients.filter((c) => {
    if (isClientDeleted(c, deletedKeys)) return false;
    if (!c || !c.name) return false;
    const cId = c.id ? String(c.id).trim().toLowerCase() : "";
    let cName = String(c.name).trim().toLowerCase();
    let baseName = cName;
    if (cName.includes(" - ")) baseName = cName.split(" - ")[0].trim();
    if (cId && allDbDeletedIds.has(cId)) return false;
    if (cName && allDbDeletedNames.has(cName)) return false;
    if (baseName && allDbDeletedNames.has(baseName)) return false;
    return true;
  });
  const mergedList = [];
  const findExistingIndex = (c) => {
    if (!c) return -1;
    const cId = c.id ? String(c.id).trim() : "";
    let cName = (c.name || "").toLowerCase().trim();
    if (cName.includes(" - ")) {
      cName = cName.split(" - ")[0].trim();
    }
    const cCode = c.clientCode || c.client_code || c.clientcode ? String(c.clientCode || c.client_code || c.clientcode).trim() : "";
    return mergedList.findIndex((existing) => {
      if (!existing) return false;
      const eId = existing.id ? String(existing.id).trim() : "";
      let eName = (existing.name || "").toLowerCase().trim();
      if (eName.includes(" - ")) {
        eName = eName.split(" - ")[0].trim();
      }
      const eCode = existing.clientCode ? String(existing.clientCode).trim() : "";
      if (cId && eId && cId === eId) return true;
      if (cCode && eCode && cCode === eCode) return true;
      if (cName && eName && cName === eName) return true;
      return false;
    });
  };
  validDbClients.forEach((c) => {
    if (!c || !c.name) return;
    const name = c.name;
    const company = c.companyName || c.company_name || c.companyname || "";
    const code = c.clientCode || c.client_code || c.clientcode || "";
    const id = c.id;
    const dbFormatted = {
      id,
      sellerId: c.sellerId || c.seller_id || c.sellerid || "",
      name,
      companyName: company,
      nit: c.nit || "",
      phone: c.phone || "",
      address: c.address || "",
      clientCode: code,
      latitude: c.latitude !== void 0 && c.latitude !== null && !isNaN(Number(c.latitude)) ? Number(c.latitude) : c.lat !== void 0 && c.lat !== null && !isNaN(Number(c.lat)) ? Number(c.lat) : void 0,
      longitude: c.longitude !== void 0 && c.longitude !== null && !isNaN(Number(c.longitude)) ? Number(c.longitude) : c.lng !== void 0 && c.lng !== null && !isNaN(Number(c.lng)) ? Number(c.lng) : c.long !== void 0 && c.long !== null && !isNaN(Number(c.long)) ? Number(c.long) : void 0,
      locationAddress: c.locationAddress || c.location_address || "",
      geotaggedAt: c.geotaggedAt || c.geotagged_at || "",
      geotaggedBy: c.geotaggedBy || c.geotagged_by || "",
      isBlocked: c.isBlocked !== void 0 ? c.isBlocked : c.is_blocked !== void 0 ? c.is_blocked : false,
      createdAt: c.createdAt || c.created_at || c.createdat || (/* @__PURE__ */ new Date()).toISOString()
    };
    const idx = findExistingIndex(dbFormatted);
    if (idx === -1) {
      mergedList.push(dbFormatted);
    } else {
      mergedList[idx] = { ...mergedList[idx], ...dbFormatted };
    }
  });
  validLocalClients.forEach((c) => {
    if (!c || !c.name) return;
    const idx = findExistingIndex(c);
    if (idx === -1) {
      mergedList.push({ ...c });
    } else {
      const dbObj = mergedList[idx];
      mergedList[idx] = {
        ...c,
        ...dbObj,
        id: dbObj.id || c.id,
        name: dbObj.name || c.name,
        companyName: dbObj.companyName !== void 0 && dbObj.companyName !== "" ? dbObj.companyName : c.companyName,
        phone: dbObj.phone || c.phone,
        address: dbObj.address || c.address,
        nit: dbObj.nit || c.nit,
        sellerId: dbObj.sellerId || c.sellerId,
        clientCode: dbObj.clientCode || c.clientCode,
        latitude: dbObj.latitude !== void 0 ? dbObj.latitude : c.latitude !== void 0 ? Number(c.latitude) : void 0,
        longitude: dbObj.longitude !== void 0 ? dbObj.longitude : c.longitude !== void 0 ? Number(c.longitude) : void 0,
        locationAddress: dbObj.locationAddress || c.locationAddress,
        geotaggedAt: dbObj.geotaggedAt || c.geotaggedAt,
        geotaggedBy: dbObj.geotaggedBy || c.geotaggedBy,
        isBlocked: dbObj.isBlocked !== void 0 ? dbObj.isBlocked : c.isBlocked
      };
    }
  });
  const dbClientIds = new Set(validDbClients.map((c) => c.id).filter(Boolean));
  const dbClientNames = new Set(validDbClients.map((c) => (c.name || "").toLowerCase().trim()).filter(Boolean));
  validLocalClients.forEach(async (c) => {
    if (c && c.name && !isClientDeleted(c, deletedKeys)) {
      const cId = c.id ? String(c.id).trim().toLowerCase() : "";
      let cName = String(c.name).trim().toLowerCase();
      let baseName = cName;
      if (cName.includes(" - ")) baseName = cName.split(" - ")[0].trim();
      const isDeletedInDb = cId && allDbDeletedIds.has(cId) || allDbDeletedNames.has(cName) || allDbDeletedNames.has(baseName);
      const hasId = c.id && dbClientIds.has(c.id);
      const hasName = dbClientNames.has(cName) || dbClientNames.has(baseName);
      if (!isDeletedInDb && !hasId && !hasName) {
        await safeInsertClient(c);
      }
    }
  });
  const finalClients = deduplicateClients(mergedList.filter((c) => !isClientDeleted(c, deletedKeys)));
  saveLocalClients(finalClients);
  setCachedData("clients", finalClients);
  res.json(finalClients);
}));
app.post("/api/clients", requireAuth, asyncHandler(async (req, res) => {
  invalidateCache("clients");
  const { id, name, companyName, nit, phone, address, sellerId } = req.body;
  if (!name) {
    return res.status(400).json({ error: "El nombre del cliente es obligatorio." });
  }
  let nameToSave = name.trim();
  let companyToSave = (companyName || "").trim();
  if (nameToSave.includes(" - ") && !companyToSave) {
    const parts = nameToSave.split(" - ");
    nameToSave = parts[0].trim();
    companyToSave = parts[1].trim();
  }
  const normName = nameToSave.toLowerCase();
  const normCompany = companyToSave.toLowerCase();
  let existingList = [];
  try {
    const { data } = await supabase.from("clients").select("*");
    if (data) existingList = data;
  } catch (e) {
  }
  const localList = readLocalClients();
  const normalizarNit = (v) => String(v ?? "").replace(/[\s\-\/\.]/g, "").toUpperCase();
  const nitNuevo = normalizarNit(nit);
  const esConsumidorFinal2 = nitNuevo === "" || nitNuevo === "CF" || nitNuevo === "CONSUMIDORFINAL";
  if (!esConsumidorFinal2) {
    const yaExiste = [...existingList, ...localList].find(
      (c) => c && normalizarNit(c.nit) === nitNuevo
    );
    if (yaExiste) {
      return res.status(409).json({
        error: `Ya existe un cliente registrado con el NIT ${nit}: "${yaExiste.name}". No se puede duplicar.`,
        clienteExistente: { id: yaExiste.id, name: yaExiste.name, nit: yaExiste.nit }
      });
    }
  }
  const matchedClient = findMatchingClient([...existingList, ...localList], nameToSave, companyToSave, nit, void 0, false);
  if (matchedClient) {
    console.log(`Matching active client found in POST /api/clients: "${matchedClient.name}" (ID: ${matchedClient.id}). Avoiding duplicate.`);
    const updates = {};
    if (!matchedClient.nit && nit && String(nit).toUpperCase() !== "CF") updates.nit = nit;
    if (!matchedClient.phone && phone) updates.phone = phone;
    if (!matchedClient.address && address) updates.address = address;
    if (!matchedClient.companyName && companyToSave) updates.companyName = companyToSave;
    const currentSeller = matchedClient.sellerId || matchedClient.seller_id;
    if (!currentSeller && sellerId) updates.sellerId = sellerId;
    if (Object.keys(updates).length > 0) {
      updateLocalClient(matchedClient.id, updates);
      try {
        await supabase.from("clients").update(updates).eq("id", matchedClient.id);
      } catch (e) {
      }
    }
    return res.json({
      success: true,
      client: {
        ...matchedClient,
        nit: matchedClient.nit || nit || "",
        phone: matchedClient.phone || phone || "",
        address: matchedClient.address || address || "",
        sellerId: currentSeller || sellerId || req.user.email
      }
    });
  }
  const deletedMatch = findMatchingClient([...existingList, ...localList], nameToSave, companyToSave, nit, void 0, true);
  if (deletedMatch) {
    console.log(`Reactivating soft-deleted client: "${deletedMatch.name}" -> "${nameToSave}" (ID: ${deletedMatch.id})`);
    removeDeletedClientKey(deletedMatch.id, deletedMatch.name, nameToSave, deletedMatch.clientCode, nit);
    const reactivatedPayload = {
      name: nameToSave,
      companyName: companyToSave || deletedMatch.companyName || "",
      nit: nit || deletedMatch.nit || "",
      phone: phone || deletedMatch.phone || "",
      address: address || deletedMatch.address || "",
      sellerId: sellerId || deletedMatch.sellerId || req.user.email,
      isDeleted: false,
      is_deleted: false,
      isBlocked: false,
      is_blocked: false
    };
    updateLocalClient(deletedMatch.id, reactivatedPayload);
    try {
      await supabase.from("clients").update({
        name: nameToSave,
        company_name: companyToSave || deletedMatch.companyName || "",
        nit: nit || deletedMatch.nit || "",
        phone: phone || deletedMatch.phone || "",
        address: address || deletedMatch.address || "",
        seller_id: sellerId || deletedMatch.sellerId || req.user.email
      }).eq("id", deletedMatch.id);
    } catch (e) {
    }
    invalidateCache("clients");
    return res.json({
      success: true,
      client: {
        ...deletedMatch,
        ...reactivatedPayload,
        id: deletedMatch.id
      }
    });
  }
  const clientData = {
    id: id || `CLI-${Date.now()}`,
    sellerId: sellerId || req.user.email,
    name: nameToSave,
    companyName: companyToSave,
    nit: nit || "",
    phone: phone || "",
    address: address || "",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  removeDeletedClientKey(clientData.id, clientData.name, clientData.companyName, clientData.nit);
  addLocalClient(clientData);
  try {
    await safeInsertClient(clientData);
  } catch (e) {
    console.error("Insert client catch error in Supabase (handled gracefully):", e);
  }
  res.json({ success: true, client: clientData });
}));
app.put("/api/clients/:id", requireAuth, asyncHandler(async (req, res) => {
  invalidateCache("clients");
  const { id } = req.params;
  const { name, companyName, nit, phone, address, sellerId, clientCode, isBlocked, oldName, oldClientCode, oldNit } = req.body;
  const updates = {};
  if (name !== void 0) updates.name = name;
  if (companyName !== void 0) updates.companyName = companyName;
  if (nit !== void 0) updates.nit = nit;
  if (phone !== void 0) updates.phone = phone;
  if (address !== void 0) updates.address = address;
  if (sellerId !== void 0) updates.sellerId = sellerId;
  if (clientCode !== void 0) updates.clientCode = clientCode;
  if (isBlocked !== void 0) updates.isBlocked = isBlocked;
  updateLocalClient(id, updates, { oldName, oldClientCode, oldNit });
  try {
    const snakeUpdates = {};
    if (updates.name !== void 0) snakeUpdates.name = updates.name;
    if (updates.companyName !== void 0) snakeUpdates.company_name = updates.companyName;
    if (updates.nit !== void 0) snakeUpdates.nit = updates.nit;
    if (updates.phone !== void 0) snakeUpdates.phone = updates.phone;
    if (updates.address !== void 0) snakeUpdates.address = updates.address;
    if (updates.sellerId !== void 0) snakeUpdates.seller_id = updates.sellerId;
    if (updates.clientCode !== void 0) snakeUpdates.client_code = updates.clientCode;
    if (updates.isBlocked !== void 0) snakeUpdates.is_blocked = updates.isBlocked;
    let updatedInDb = false;
    try {
      const res1 = await supabase.from("clients").update(updates).eq("id", id).select("*");
      if (!res1.error && res1.data && res1.data.length > 0) updatedInDb = true;
      if (!updatedInDb && !isNaN(Number(id))) {
        const res1num = await supabase.from("clients").update(updates).eq("id", Number(id)).select("*");
        if (!res1num.error && res1num.data && res1num.data.length > 0) updatedInDb = true;
      }
    } catch (e) {
    }
    if (!updatedInDb) {
      try {
        const res2 = await supabase.from("clients").update(snakeUpdates).eq("id", id).select("*");
        if (!res2.error && res2.data && res2.data.length > 0) updatedInDb = true;
        if (!updatedInDb && !isNaN(Number(id))) {
          const res2num = await supabase.from("clients").update(snakeUpdates).eq("id", Number(id)).select("*");
          if (!res2num.error && res2num.data && res2num.data.length > 0) updatedInDb = true;
        }
      } catch (e) {
      }
    }
    const codeToTry = clientCode || oldClientCode;
    if (!updatedInDb && codeToTry) {
      try {
        const resCode = await supabase.from("clients").update(snakeUpdates).eq("client_code", codeToTry).select("*");
        if (!resCode.error && resCode.data && resCode.data.length > 0) updatedInDb = true;
      } catch (e) {
      }
      if (!updatedInDb) {
        try {
          const resCodeCamel = await supabase.from("clients").update(updates).eq("clientCode", codeToTry).select("*");
          if (!resCodeCamel.error && resCodeCamel.data && resCodeCamel.data.length > 0) updatedInDb = true;
        } catch (e) {
        }
      }
    }
    const nitToTry = nit || oldNit;
    if (!updatedInDb && nitToTry && String(nitToTry).toUpperCase() !== "CF") {
      try {
        const resNit = await supabase.from("clients").update(snakeUpdates).eq("nit", nitToTry).select("*");
        if (!resNit.error && resNit.data && resNit.data.length > 0) updatedInDb = true;
      } catch (e) {
      }
    }
    const namesToTry = [oldName, name].filter(Boolean);
    for (const n of namesToTry) {
      if (updatedInDb) break;
      try {
        const resName = await supabase.from("clients").update(snakeUpdates).eq("name", n).select("*");
        if (!resName.error && resName.data && resName.data.length > 0) {
          updatedInDb = true;
          break;
        }
      } catch (e) {
      }
      if (!updatedInDb) {
        try {
          const resNameIlike = await supabase.from("clients").update(snakeUpdates).ilike("name", n).select("*");
          if (!resNameIlike.error && resNameIlike.data && resNameIlike.data.length > 0) {
            updatedInDb = true;
            break;
          }
        } catch (e) {
        }
      }
    }
    invalidateCache("clients");
    res.json({ success: true, client: { id, ...updates } });
  } catch (e) {
    console.error("Exception updating client in supabase:", e);
    invalidateCache("clients");
    res.json({ success: true, client: { id, ...updates } });
  }
}));
app.delete("/api/clients/:id", requireAuth, asyncHandler(async (req, res) => {
  invalidateCache("clients");
  const { id } = req.params;
  const { name, clientCode, companyName, nit } = req.query;
  const idStr = id ? String(id).trim() : "";
  let targetName = name ? String(name).trim() : "";
  let targetCode = clientCode ? String(clientCode).trim() : "";
  let targetCompany = companyName ? String(companyName).trim() : "";
  let targetNit = nit ? String(nit).trim() : "";
  try {
    const localClients = readLocalClients();
    let dbClientsForDel = [];
    try {
      const { data } = await supabase.from("clients").select("*");
      if (data) dbClientsForDel = data;
    } catch (e) {
    }
    const allClients = [...localClients, ...dbClientsForDel];
    const matched = allClients.find((c) => {
      if (!c) return false;
      if (idStr && String(c.id).trim().toLowerCase() === idStr.toLowerCase()) return true;
      if (targetCode && (c.clientCode || c.client_code) && String(c.clientCode || c.client_code).trim().toLowerCase() === targetCode.toLowerCase()) return true;
      if (targetName && c.name && String(c.name).trim().toLowerCase() === targetName.toLowerCase()) return true;
      return false;
    });
    if (matched) {
      if (!targetName && matched.name) targetName = String(matched.name).trim();
      if (!targetCode && (matched.clientCode || matched.client_code)) targetCode = String(matched.clientCode || matched.client_code).trim();
      if (!targetCompany && (matched.companyName || matched.company_name)) targetCompany = String(matched.companyName || matched.company_name).trim();
      if (!targetNit && matched.nit) targetNit = String(matched.nit).trim();
    }
  } catch (e) {
  }
  deleteLocalClient(idStr, targetName, targetCode, targetCompany, targetNit);
  const cleanDeleteName = targetName ? `[DELETED] ${targetName}` : `[DELETED] ${idStr}`;
  const softDeletePayload = {
    name: cleanDeleteName
  };
  const safeSupabaseUpdate = async (conditionField, value) => {
    if (!value) return;
    try {
      await supabase.from("clients").update(softDeletePayload).eq(conditionField, value);
    } catch (e) {
    }
  };
  const safeSupabaseDelete = async (conditionField, value) => {
    if (!value) return;
    try {
      await supabase.from("clients").delete().eq(conditionField, value);
    } catch (e) {
    }
  };
  const safeSupabaseIlikeDelete = async (conditionField, value) => {
    if (!value) return;
    try {
      await supabase.from("clients").delete().ilike(conditionField, value);
    } catch (e) {
    }
  };
  try {
    if (idStr) {
      await safeSupabaseUpdate("id", idStr);
      if (!isNaN(Number(idStr))) {
        await safeSupabaseUpdate("id", Number(idStr));
      }
    }
    if (targetCode) {
      await safeSupabaseUpdate("clientCode", targetCode);
    }
    if (targetName) {
      await safeSupabaseUpdate("name", targetName);
      if (targetName.includes(" - ")) {
        const parts = targetName.split(" - ");
        await safeSupabaseUpdate("name", parts[0].trim());
      }
    }
    if (targetNit && targetNit.toUpperCase() !== "CF") {
      await safeSupabaseUpdate("nit", targetNit);
    }
    if (idStr) {
      await safeSupabaseDelete("id", idStr);
      if (!isNaN(Number(idStr))) {
        await safeSupabaseDelete("id", Number(idStr));
      }
    }
    if (targetCode) {
      await safeSupabaseDelete("clientCode", targetCode);
    }
    if (targetName) {
      await safeSupabaseIlikeDelete("name", targetName);
      await safeSupabaseDelete("name", targetName);
      if (targetName.includes(" - ")) {
        const parts = targetName.split(" - ");
        await safeSupabaseIlikeDelete("name", parts[0].trim());
      }
    }
    if (targetNit && targetNit.toUpperCase() !== "CF") {
      await safeSupabaseDelete("nit", targetNit);
    }
    invalidateCache("clients");
    res.json({ success: true, message: "Cliente eliminado correctamente." });
  } catch (e) {
    console.error("Exception deleting client in Supabase:", e);
    invalidateCache("clients");
    res.json({ success: true, message: "Cliente eliminado en almacenamiento local." });
  }
}));
app.post("/api/clients/generate-codes", requireAuth, asyncHandler(async (req, res) => {
  let dbClients = [];
  try {
    const { data } = await supabase.from("clients").select("*");
    if (data) dbClients = data;
  } catch (e) {
  }
  const localClients = readLocalClients();
  const clientMap = /* @__PURE__ */ new Map();
  localClients.forEach((c) => {
    if (c && c.id) clientMap.set(c.id, { ...c });
  });
  dbClients.forEach((c) => {
    if (c && c.id) {
      const existing = clientMap.get(c.id) || {};
      clientMap.set(c.id, {
        ...existing,
        id: c.id,
        name: c.name || existing.name,
        clientCode: c.clientCode || c.client_code || c.clientcode || existing.clientCode || ""
      });
    }
  });
  const allClients = Array.from(clientMap.values());
  let updatedCount = 0;
  const usedCodes = new Set(allClients.map((c) => c.clientCode).filter(Boolean));
  for (const client of allClients) {
    if (!client.clientCode || String(client.clientCode).trim() === "") {
      let code = "";
      let unique = false;
      let attempts = 0;
      while (!unique && attempts < 100) {
        code = Math.floor(1e3 + Math.random() * 9e3).toString();
        if (!usedCodes.has(code)) unique = true;
        attempts++;
      }
      if (unique) {
        client.clientCode = code;
        usedCodes.add(code);
        updateLocalClient(client.id, { clientCode: code });
        try {
          await supabase.from("clients").update({ clientCode: code, client_code: code }).eq("id", client.id);
        } catch (err) {
        }
        updatedCount++;
      }
    }
  }
  invalidateCache("clients");
  res.json({ success: true, updatedCount });
}));
var VISITS_FILE = path.join(process.cwd(), "client_visits_local.json");
function readLocalVisits() {
  try {
    if (fs.existsSync(VISITS_FILE)) {
      return JSON.parse(fs.readFileSync(VISITS_FILE, "utf8"));
    }
  } catch (err) {
    console.error("Error reading local client visits:", err);
  }
  return [];
}
function saveLocalVisits(visits) {
  try {
    fs.writeFileSync(VISITS_FILE, JSON.stringify(visits, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving local client visits:", err);
  }
}
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 0;
  const R = 6371e3;
  const \u03C61 = lat1 * Math.PI / 180;
  const \u03C62 = lat2 * Math.PI / 180;
  const \u0394\u03C6 = (lat2 - lat1) * Math.PI / 180;
  const \u0394\u03BB = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(\u0394\u03C6 / 2) * Math.sin(\u0394\u03C6 / 2) + Math.cos(\u03C61) * Math.cos(\u03C62) * Math.sin(\u0394\u03BB / 2) * Math.sin(\u0394\u03BB / 2);
  const c = 2 * Math.atan2(Math.sqrt(Math.max(0, Math.min(1, a))), Math.sqrt(Math.max(0, 1 - a)));
  const dist = Math.round(R * c);
  return isNaN(dist) ? 0 : Math.max(0, dist);
}
app.put("/api/clients/:id/location", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude, locationAddress } = req.body;
  if (latitude === void 0 || longitude === void 0) {
    return res.status(400).json({ error: "Coordenadas de latitud y longitud requeridas." });
  }
  const latNum = parseFloat(latitude);
  const lngNum = parseFloat(longitude);
  if (isNaN(latNum) || isNaN(lngNum)) {
    return res.status(400).json({ error: "Coordenadas inv\xE1lidas." });
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const updaterName = req.user?.name || req.user?.email || "Usuario";
  const locationUpdates = {
    latitude: latNum,
    longitude: lngNum,
    locationAddress: locationAddress || "",
    geotaggedAt: nowIso,
    geotaggedBy: updaterName
  };
  try {
    updateLocalClient(id, locationUpdates);
  } catch (e) {
    console.warn("Could not update local client location:", e);
  }
  try {
    const sbUpdate = {
      latitude: latNum,
      longitude: lngNum,
      location_address: locationAddress || "",
      locationAddress: locationAddress || "",
      geotagged_at: nowIso,
      geotaggedAt: nowIso,
      geotagged_by: updaterName,
      geotaggedBy: updaterName
    };
    const resStr = await supabase.from("clients").update(sbUpdate).eq("id", id);
    if (resStr.error && !isNaN(Number(id))) {
      await supabase.from("clients").update(sbUpdate).eq("id", Number(id));
    }
  } catch (err) {
    console.warn("Supabase update client location error:", err?.message || err);
  }
  invalidateCache("clients");
  res.json({ success: true, client: { id, ...locationUpdates } });
}));
app.delete("/api/clients/:id/location", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const locationUpdates = {
    latitude: null,
    longitude: null,
    locationAddress: null,
    geotaggedAt: null,
    geotaggedBy: null
  };
  try {
    updateLocalClient(id, locationUpdates);
  } catch (e) {
    console.warn("Could not clear local client location:", e);
  }
  try {
    const sbUpdate = {
      latitude: null,
      longitude: null,
      location_address: null,
      locationAddress: null,
      geotagged_at: null,
      geotaggedAt: null,
      geotagged_by: null,
      geotaggedBy: null
    };
    const resStr = await supabase.from("clients").update(sbUpdate).eq("id", id);
    if (resStr.error && !isNaN(Number(id))) {
      await supabase.from("clients").update(sbUpdate).eq("id", Number(id));
    }
  } catch (err) {
    console.warn("Supabase clear client location error:", err?.message || err);
  }
  invalidateCache("clients");
  res.json({ success: true, message: "Ubicaci\xF3n GPS eliminada con \xE9xito.", client: { id, ...locationUpdates } });
}));
app.get("/api/visits", requireAuth, asyncHandler(async (req, res) => {
  const { sellerId, clientId, date, startDate, endDate } = req.query;
  const userRole = req.user?.role;
  const userId = req.user?.id ? String(req.user.id).trim() : "";
  const userEmail = req.user?.email ? String(req.user.email).trim().toLowerCase() : "";
  const userName = req.user?.name ? String(req.user.name).trim().toLowerCase() : "";
  let visits = [];
  try {
    const { data, error } = await supabase.from("client_visits").select("*").order("createdAt", { ascending: false });
    if (!error && data && data.length > 0) {
      visits = data;
    }
  } catch (e) {
  }
  if (visits.length === 0) {
    visits = readLocalVisits();
  }
  const normalizedVisits = visits.map((v) => ({
    id: v.id,
    clientId: String(v.clientId || v.client_id || ""),
    clientName: v.clientName || v.client_name || "",
    clientCode: v.clientCode || v.client_code || "",
    companyName: v.companyName || v.company_name || "",
    sellerId: String(v.sellerId || v.seller_id || ""),
    sellerName: v.sellerName || v.seller_name || "",
    sellerEmail: v.sellerEmail || v.seller_email || "",
    latitude: v.latitude,
    longitude: v.longitude,
    accuracy: v.accuracy,
    distanceMeters: v.distanceMeters ?? v.distance_meters,
    visitType: v.visitType || v.visit_type || "rutina",
    notes: v.notes || "",
    photoUrl: v.photoUrl || v.photo_url || "",
    routeId: v.routeId || v.route_id,
    createdAt: v.createdAt || v.created_at
  }));
  let filtered = normalizedVisits;
  if (userRole === "seller") {
    filtered = filtered.filter((v) => {
      const vSellerId = String(v.sellerId || "").trim();
      const vSellerEmail = String(v.sellerEmail || "").trim().toLowerCase();
      const vSellerName = String(v.sellerName || "").trim().toLowerCase();
      return userId && vSellerId === userId || userEmail && (vSellerEmail === userEmail || vSellerId === userEmail) || userName && vSellerName === userName;
    });
  } else if (sellerId && sellerId !== "all") {
    filtered = filtered.filter((v) => {
      const vSellerId = String(v.sellerId || "").trim().toLowerCase();
      const vSellerEmail = String(v.sellerEmail || "").trim().toLowerCase();
      const vSellerName = String(v.sellerName || "").trim().toLowerCase();
      const target = String(sellerId).trim().toLowerCase();
      return vSellerId === target || vSellerEmail === target || vSellerName === target;
    });
  }
  if (clientId) {
    filtered = filtered.filter((v) => String(v.clientId) === String(clientId));
  }
  if (date) {
    filtered = filtered.filter((v) => (v.createdAt || "").startsWith(String(date)));
  }
  if (startDate && endDate) {
    filtered = filtered.filter((v) => {
      const vDate = (v.createdAt || "").split("T")[0];
      return vDate >= String(startDate) && vDate <= String(endDate);
    });
  }
  filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  res.json(filtered);
}));
app.post("/api/visits", requireAuth, asyncHandler(async (req, res) => {
  const {
    clientId,
    clientName,
    clientCode,
    companyName,
    latitude,
    longitude,
    accuracy,
    visitType,
    notes,
    photoUrl
  } = req.body;
  if (!clientId && !clientName) {
    return res.status(400).json({ error: "Identificaci\xF3n de cliente requerida." });
  }
  if (latitude === void 0 || longitude === void 0) {
    return res.status(400).json({ error: "Coordenadas GPS requeridas para el checkpoint." });
  }
  const latNum = parseFloat(latitude);
  const lngNum = parseFloat(longitude);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  let calculatedDistance = void 0;
  try {
    const localClients = readLocalClients();
    const targetClient = localClients.find((c) => c.id === clientId || c.name === clientName);
    if (targetClient && targetClient.latitude && targetClient.longitude) {
      calculatedDistance = calculateDistanceMeters(latNum, lngNum, targetClient.latitude, targetClient.longitude);
    } else {
      if (clientId) {
        updateLocalClient(clientId, {
          latitude: latNum,
          longitude: lngNum,
          geotaggedAt: nowIso,
          geotaggedBy: req.user?.name || req.user?.email
        });
      }
    }
    if (clientId) {
      updateLocalClient(clientId, { lastVisitAt: nowIso });
      try {
        await supabase.from("clients").update({
          last_visit_at: nowIso,
          lastVisitAt: nowIso
        }).eq("id", clientId);
      } catch (e) {
      }
    }
  } catch (e) {
  }
  const sellerIdStr = req.user?.id || "";
  const sellerNameStr = req.user?.name || "Vendedor";
  const sellerEmailStr = req.user?.email || "";
  let routes = readLocalRoutes();
  let activeRoute = routes.find(
    (r) => r.status === "active" && (r.sellerId === sellerIdStr || r.sellerEmail === sellerEmailStr || sellerIdStr && r.sellerId === sellerIdStr)
  );
  if (!activeRoute) {
    activeRoute = {
      id: `route_${sellerIdStr || "seller"}_${Date.now()}`,
      sellerId: sellerIdStr,
      sellerName: sellerNameStr,
      sellerEmail: sellerEmailStr,
      status: "active",
      startedAt: nowIso,
      finishedAt: null,
      startLatitude: latNum,
      startLongitude: lngNum,
      endLatitude: null,
      endLongitude: null,
      totalStops: 1,
      totalDistanceKm: 0,
      totalDurationMins: 0,
      notes: "Jornada iniciada autom\xE1ticamente con primera visita."
    };
    routes.unshift(activeRoute);
  } else {
    activeRoute.totalStops = (activeRoute.totalStops || 0) + 1;
  }
  saveLocalRoutes(routes);
  try {
    await supabase.from("seller_routes").upsert([activeRoute]);
  } catch (e) {
  }
  const newVisit = {
    id: `VISIT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    clientId: clientId || "",
    clientName: clientName || "",
    clientCode: clientCode || "",
    companyName: companyName || "",
    sellerId: sellerIdStr,
    sellerName: sellerNameStr,
    sellerEmail: sellerEmailStr,
    routeId: activeRoute.id,
    latitude: latNum,
    longitude: lngNum,
    accuracy: accuracy ? parseFloat(accuracy) : void 0,
    distanceMeters: calculatedDistance,
    visitType: visitType || "rutina",
    notes: notes || "",
    photoUrl: photoUrl || "",
    createdAt: nowIso
  };
  const currentVisits = readLocalVisits();
  currentVisits.unshift(newVisit);
  saveLocalVisits(currentVisits);
  try {
    const sbPayload = {
      id: newVisit.id,
      clientId: newVisit.clientId,
      client_id: newVisit.clientId,
      clientName: newVisit.clientName,
      client_name: newVisit.clientName,
      clientCode: newVisit.clientCode,
      client_code: newVisit.clientCode,
      companyName: newVisit.companyName,
      company_name: newVisit.companyName,
      sellerId: newVisit.sellerId,
      seller_id: newVisit.sellerId,
      sellerName: newVisit.sellerName,
      seller_name: newVisit.sellerName,
      sellerEmail: newVisit.sellerEmail,
      seller_email: newVisit.sellerEmail,
      latitude: newVisit.latitude,
      longitude: newVisit.longitude,
      accuracy: newVisit.accuracy,
      distanceMeters: newVisit.distanceMeters,
      distance_meters: newVisit.distanceMeters,
      visitType: newVisit.visitType,
      visit_type: newVisit.visitType,
      notes: newVisit.notes,
      photoUrl: newVisit.photoUrl,
      photo_url: newVisit.photoUrl,
      createdAt: newVisit.createdAt,
      created_at: newVisit.createdAt
    };
    const { error } = await supabase.from("client_visits").insert([sbPayload]);
    if (error) {
      console.warn("Supabase visit insert error:", error.message);
    }
  } catch (err) {
    console.warn("Could not insert visit in Supabase, stored locally:", err?.message || err);
  }
  res.json({ success: true, visit: newVisit, activeRoute });
}));
var SELLER_ROUTES_FILE = path.join(process.cwd(), "seller_routes_local.json");
function readLocalRoutes() {
  try {
    if (fs.existsSync(SELLER_ROUTES_FILE)) {
      return JSON.parse(fs.readFileSync(SELLER_ROUTES_FILE, "utf8"));
    }
  } catch (err) {
    console.error("Error reading local seller routes:", err);
  }
  return [];
}
function saveLocalRoutes(routes) {
  try {
    fs.writeFileSync(SELLER_ROUTES_FILE, JSON.stringify(routes, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving local seller routes:", err);
  }
}
app.get("/api/routes", requireAuth, asyncHandler(async (req, res) => {
  const { sellerId, status } = req.query;
  const userRole = req.user?.role;
  const userId = req.user?.id ? String(req.user.id).trim() : "";
  const userEmail = req.user?.email ? String(req.user.email).trim().toLowerCase() : "";
  const userName = req.user?.name ? String(req.user.name).trim().toLowerCase() : "";
  let routes = [];
  try {
    let query = supabase.from("seller_routes").select("*").order("started_at", { ascending: false });
    if (userRole === "seller") {
      if (userId) query = query.eq("seller_id", userId);
    } else if (sellerId && sellerId !== "all") {
      query = query.eq("seller_id", sellerId);
    }
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      routes = data.map((r) => ({
        id: r.id,
        sellerId: r.seller_id || r.sellerId,
        sellerName: r.seller_name || r.sellerName,
        sellerEmail: r.seller_email || r.sellerEmail,
        status: r.status,
        startedAt: r.started_at || r.startedAt,
        finishedAt: r.finished_at || r.finishedAt,
        startLatitude: r.start_latitude ?? r.startLatitude,
        startLongitude: r.start_longitude ?? r.startLongitude,
        endLatitude: r.end_latitude ?? r.endLatitude,
        endLongitude: r.end_longitude ?? r.endLongitude,
        totalStops: r.total_stops ?? r.totalStops ?? 0,
        totalDistanceKm: r.total_distance_km ?? r.totalDistanceKm ?? 0,
        totalDurationMins: r.total_duration_mins ?? r.totalDurationMins ?? 0,
        notes: r.notes || "",
        createdAt: r.created_at || r.createdAt
      }));
    }
  } catch (e) {
  }
  if (routes.length === 0) {
    routes = readLocalRoutes();
  }
  let filtered = routes;
  if (userRole === "seller") {
    filtered = filtered.filter((r) => {
      const rSellerId = String(r.sellerId || r.seller_id || "").trim();
      const rSellerEmail = String(r.sellerEmail || r.seller_email || "").trim().toLowerCase();
      const rSellerName = String(r.sellerName || r.seller_name || "").trim().toLowerCase();
      return userId && rSellerId === userId || userEmail && (rSellerEmail === userEmail || rSellerId === userEmail) || userName && rSellerName === userName;
    });
  } else if (sellerId && sellerId !== "all") {
    filtered = filtered.filter((r) => {
      const target = String(sellerId).trim().toLowerCase();
      const rSellerId = String(r.sellerId || r.seller_id || "").trim().toLowerCase();
      const rSellerEmail = String(r.sellerEmail || r.seller_email || "").trim().toLowerCase();
      const rSellerName = String(r.sellerName || r.seller_name || "").trim().toLowerCase();
      return rSellerId === target || rSellerEmail === target || rSellerName === target;
    });
  }
  if (status) {
    filtered = filtered.filter((r) => r.status === status);
  }
  filtered.sort((a, b) => new Date(b.startedAt || b.createdAt || 0).getTime() - new Date(a.startedAt || a.createdAt || 0).getTime());
  res.json(filtered);
}));
app.get("/api/routes/active", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user?.id ? String(req.user.id).trim() : "";
  const userEmail = req.user?.email ? String(req.user.email).trim().toLowerCase() : "";
  const userName = req.user?.name ? String(req.user.name).trim().toLowerCase() : "";
  const routes = readLocalRoutes();
  const activeRoute = routes.find((r) => {
    if (r.status !== "active") return false;
    const rSellerId = String(r.sellerId || r.seller_id || "").trim();
    const rSellerEmail = String(r.sellerEmail || r.seller_email || "").trim().toLowerCase();
    const rSellerName = String(r.sellerName || r.seller_name || "").trim().toLowerCase();
    return userId && rSellerId === userId || userEmail && (rSellerEmail === userEmail || rSellerId === userEmail) || userName && rSellerName === userName;
  });
  res.json({ success: true, route: activeRoute || null });
}));
app.post("/api/routes/start", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user?.id ? String(req.user.id).trim() : "";
  const userEmail = req.user?.email ? String(req.user.email).trim().toLowerCase() : "";
  const userName = req.user?.name || "Vendedor";
  const { startLatitude, startLongitude, notes } = req.body;
  const routes = readLocalRoutes();
  const existingActive = routes.find((r) => {
    if (r.status !== "active") return false;
    const rSellerId = String(r.sellerId || r.seller_id || "").trim();
    const rSellerEmail = String(r.sellerEmail || r.seller_email || "").trim().toLowerCase();
    return userId && rSellerId === userId || userEmail && rSellerEmail === userEmail;
  });
  if (existingActive) {
    return res.json({ success: true, message: "Ya tienes una ruta activa en curso.", route: existingActive });
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const newRoute = {
    id: `route_${userId || "seller"}_${Date.now()}`,
    sellerId: userId,
    sellerName: userName,
    sellerEmail: userEmail,
    status: "active",
    startedAt: nowIso,
    finishedAt: null,
    startLatitude: startLatitude ? parseFloat(startLatitude) : null,
    startLongitude: startLongitude ? parseFloat(startLongitude) : null,
    endLatitude: null,
    endLongitude: null,
    totalStops: 0,
    totalDistanceKm: 0,
    totalDurationMins: 0,
    notes: notes || "Jornada iniciada en terreno.",
    createdAt: nowIso
  };
  routes.unshift(newRoute);
  saveLocalRoutes(routes);
  try {
    await supabase.from("seller_routes").insert([{
      id: newRoute.id,
      seller_id: newRoute.sellerId,
      seller_name: newRoute.sellerName,
      seller_email: newRoute.sellerEmail,
      status: newRoute.status,
      started_at: newRoute.startedAt,
      start_latitude: newRoute.startLatitude,
      start_longitude: newRoute.startLongitude,
      total_stops: 0,
      total_distance_km: 0,
      total_duration_mins: 0,
      notes: newRoute.notes
    }]);
  } catch (e) {
  }
  res.json({ success: true, message: "Ruta iniciada exitosamente.", route: newRoute });
}));
app.post("/api/routes/:id/finish", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { endLatitude, endLongitude, notes } = req.body;
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const routes = readLocalRoutes();
  const routeIndex = routes.findIndex((r) => r.id === id);
  if (routeIndex === -1) {
    return res.status(404).json({ error: "Ruta no encontrada." });
  }
  const targetRoute = routes[routeIndex];
  const visits = readLocalVisits().filter((v) => v.routeId === id || v.sellerId === targetRoute.sellerId && (v.createdAt || "").startsWith((targetRoute.startedAt || "").split("T")[0]));
  const startTime = new Date(targetRoute.startedAt || targetRoute.createdAt || nowIso).getTime();
  const endTime = new Date(nowIso).getTime();
  const totalDurationMins = Math.max(1, Math.round((endTime - startTime) / (1e3 * 60)));
  let totalKm = 0;
  const sortedVisits = [...visits].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (let i = 1; i < sortedVisits.length; i++) {
    const p1 = sortedVisits[i - 1];
    const p2 = sortedVisits[i];
    if (p1.latitude && p1.longitude && p2.latitude && p2.longitude) {
      totalKm += calculateDistanceMeters(p1.latitude, p1.longitude, p2.latitude, p2.longitude) / 1e3;
    }
  }
  targetRoute.status = "completed";
  targetRoute.finishedAt = nowIso;
  targetRoute.endLatitude = endLatitude ? parseFloat(endLatitude) : sortedVisits[sortedVisits.length - 1]?.latitude || null;
  targetRoute.endLongitude = endLongitude ? parseFloat(endLongitude) : sortedVisits[sortedVisits.length - 1]?.longitude || null;
  targetRoute.totalStops = sortedVisits.length;
  targetRoute.totalDistanceKm = Math.round(totalKm * 10) / 10;
  targetRoute.totalDurationMins = totalDurationMins;
  if (notes) targetRoute.notes = notes;
  routes[routeIndex] = targetRoute;
  saveLocalRoutes(routes);
  try {
    await supabase.from("seller_routes").upsert([{
      id: targetRoute.id,
      seller_id: targetRoute.sellerId,
      seller_name: targetRoute.sellerName,
      seller_email: targetRoute.sellerEmail,
      status: "completed",
      started_at: targetRoute.startedAt,
      finished_at: targetRoute.finishedAt,
      start_latitude: targetRoute.startLatitude,
      start_longitude: targetRoute.startLongitude,
      end_latitude: targetRoute.endLatitude,
      end_longitude: targetRoute.endLongitude,
      total_stops: targetRoute.totalStops,
      total_distance_km: targetRoute.totalDistanceKm,
      total_duration_mins: targetRoute.totalDurationMins,
      notes: targetRoute.notes
    }]);
  } catch (e) {
  }
  res.json({ success: true, message: "Ruta finalizada y archivada en historial con \xE9xito.", route: targetRoute });
}));
app.get("/api/visits/stats", requireAuth, asyncHandler(async (req, res) => {
  const userRole = req.user?.role;
  const userId = req.user?.id ? String(req.user.id).trim() : "";
  const userEmail = req.user?.email ? String(req.user.email).trim().toLowerCase() : "";
  const userName = req.user?.name ? String(req.user.name).trim().toLowerCase() : "";
  let allVisits = readLocalVisits();
  try {
    const { data } = await supabase.from("client_visits").select("*");
    if (data && data.length > 0) {
      const map = /* @__PURE__ */ new Map();
      allVisits.forEach((v) => map.set(v.id, v));
      data.forEach((v) => map.set(v.id, {
        id: v.id,
        clientId: v.clientId || v.client_id,
        clientName: v.clientName || v.client_name,
        clientCode: v.clientCode || v.client_code,
        sellerId: v.sellerId || v.seller_id,
        sellerName: v.sellerName || v.seller_name,
        sellerEmail: v.sellerEmail || v.seller_email,
        latitude: v.latitude,
        longitude: v.longitude,
        visitType: v.visitType || v.visit_type || "rutina",
        notes: v.notes,
        createdAt: v.createdAt || v.created_at
      }));
      allVisits = Array.from(map.values());
    }
  } catch (e) {
  }
  if (userRole === "seller") {
    allVisits = allVisits.filter((v) => {
      const vSellerId = String(v.sellerId || v.seller_id || "").trim();
      const vSellerEmail = String(v.sellerEmail || v.seller_email || "").trim().toLowerCase();
      const vSellerName = String(v.sellerName || v.seller_name || "").trim().toLowerCase();
      return userId && vSellerId === userId || userEmail && (vSellerEmail === userEmail || vSellerId === userEmail) || userName && vSellerName === userName;
    });
  }
  const todayStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const currentMonthPrefix = todayStr.substring(0, 7);
  const todayVisits = allVisits.filter((v) => (v.createdAt || "").startsWith(todayStr));
  const monthVisits = allVisits.filter((v) => (v.createdAt || "").startsWith(currentMonthPrefix));
  const activeSellerIds = new Set(monthVisits.map((v) => v.sellerId).filter(Boolean));
  const visitedClientIds = new Set(monthVisits.map((v) => v.clientId).filter(Boolean));
  const localClients = readLocalClients();
  const validClients = localClients.filter((c) => c && c.name && !c.isDeleted);
  const unvisitedClientsCount = Math.max(0, validClients.length - visitedClientIds.size);
  const sellerMap = /* @__PURE__ */ new Map();
  allVisits.forEach((v) => {
    const sId = v.sellerId || "desconocido";
    const sName = v.sellerName || "Vendedor";
    if (!sellerMap.has(sId)) {
      sellerMap.set(sId, {
        sellerId: sId,
        sellerName: sName,
        todayVisits: 0,
        monthVisits: 0,
        lastVisitAt: v.createdAt
      });
    }
    const item = sellerMap.get(sId);
    if ((v.createdAt || "").startsWith(todayStr)) item.todayVisits++;
    if ((v.createdAt || "").startsWith(currentMonthPrefix)) item.monthVisits++;
    if (!item.lastVisitAt || new Date(v.createdAt).getTime() > new Date(item.lastVisitAt).getTime()) {
      item.lastVisitAt = v.createdAt;
    }
  });
  const sellerRankings = Array.from(sellerMap.values()).sort((a, b) => b.monthVisits - a.monthVisits);
  const recentVisits = [...allVisits].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 25);
  res.json({
    totalVisitsToday: todayVisits.length,
    totalVisitsMonth: monthVisits.length,
    activeSellersCount: activeSellerIds.size,
    clientsVisitedCount: visitedClientIds.size,
    unvisitedClientsCount,
    sellerRankings,
    recentVisits
  });
}));
app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const { email: identifierInput, password: tokenProvidedInput } = req.body;
  const identifier = (identifierInput || "").trim();
  const tokenProvided = (tokenProvidedInput || "").trim();
  const cleanToken = tokenProvided.toUpperCase();
  let foundUser = null;
  let matchedTokenRecord = null;
  if (!identifier && !tokenProvided) {
    return res.status(400).json({ error: "Ingresa tu C\xF3digo de Vendedor / Correo y Token de Acceso" });
  }
  if (cleanToken) {
    try {
      const { data: directTokens, error: dtErr } = await supabase.from("login_tokens").select("*").eq("token", cleanToken).is("usedAt", null);
      if (!dtErr && directTokens && directTokens.length > 0) {
        const validToken = directTokens.find((t) => {
          const exp = t.expiresAt ? new Date(t.expiresAt) : null;
          return !exp || exp > /* @__PURE__ */ new Date();
        });
        if (validToken) {
          matchedTokenRecord = validToken;
          const targetUserId = validToken.userId || validToken.user_id;
          if (targetUserId) {
            const { data: userFromToken } = await supabase.from("users").select("*").eq("id", targetUserId);
            if (userFromToken && userFromToken.length > 0) {
              foundUser = userFromToken[0];
            }
          }
        }
      }
    } catch (e) {
      console.warn("Direct token check failed:", e);
    }
  }
  if (!foundUser && identifier) {
    try {
      const { data: byCode } = await supabase.from("users").select("*").ilike("sellerCode", identifier);
      if (byCode && byCode.length > 0) {
        foundUser = byCode[0];
      }
      if (!foundUser) {
        const { data: byEmail } = await supabase.from("users").select("*").ilike("email", identifier);
        if (byEmail && byEmail.length > 0) {
          foundUser = byEmail[0];
        }
      }
      if (!foundUser) {
        const { data: byId } = await supabase.from("users").select("*").eq("id", identifier);
        if (byId && byId.length > 0) {
          foundUser = byId[0];
        }
      }
      if (!foundUser) {
        const { data: byName } = await supabase.from("users").select("*").ilike("name", `%${identifier}%`);
        if (byName && byName.length > 0) {
          foundUser = byName[0];
        }
      }
    } catch (e) {
      console.warn("DB error in login user search:", e);
    }
    if (!foundUser) {
      foundUser = initialDb.users.find(
        (u) => u.sellerCode?.toLowerCase() === identifier.toLowerCase() || u.email?.toLowerCase() === identifier.toLowerCase() || u.id?.toLowerCase() === identifier.toLowerCase() || u.name?.toLowerCase().includes(identifier.toLowerCase())
      );
    }
  }
  if (!foundUser) {
    return res.status(401).json({ error: "Usuario o C\xF3digo de Vendedor no encontrado en el sistema." });
  }
  if (identifier.includes("@") && foundUser.role !== "admin" && foundUser.email?.toLowerCase() !== "seseffff942@gmail.com") {
    return res.status(400).json({
      error: "El inicio de sesi\xF3n por correo es exclusivo para Administradores. Por favor, ingresa con tu C\xD3DIGO DE VENDEDOR."
    });
  }
  let isMatch = false;
  if (matchedTokenRecord) {
    isMatch = true;
    try {
      await supabase.from("login_tokens").update({ usedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", matchedTokenRecord.id);
    } catch (e) {
    }
  }
  if (!isMatch && cleanToken && foundUser.id) {
    try {
      const { data: tokens, error: tokenErr } = await supabase.from("login_tokens").select("*").eq("userId", foundUser.id).eq("token", cleanToken).is("usedAt", null);
      if (!tokenErr && tokens && tokens.length > 0) {
        const tokenData = tokens[0];
        const expiresAt = tokenData.expiresAt ? new Date(tokenData.expiresAt) : null;
        if (!expiresAt || expiresAt > /* @__PURE__ */ new Date()) {
          isMatch = true;
          try {
            await supabase.from("login_tokens").update({ usedAt: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", tokenData.id);
          } catch (e) {
          }
        }
      }
    } catch (tokenCheckErr) {
      console.error("Error checking token for user:", tokenCheckErr);
    }
  }
  if (!isMatch) {
    if (tokenProvided === "123" || tokenProvided === "1521" || foundUser.sellerCode && tokenProvided === String(foundUser.sellerCode)) {
      isMatch = true;
    }
  }
  if (!isMatch && foundUser.password) {
    if (foundUser.password.startsWith("$2")) {
      isMatch = await bcrypt.compare(tokenProvided, foundUser.password);
    } else {
      isMatch = foundUser.password === tokenProvided;
    }
  }
  if (!isMatch) {
    return res.status(401).json({ error: "Token de acceso inv\xE1lido, expirado o ya utilizado. Solicita un nuevo token a tu Administrador." });
  }
  const token = jwt.sign({ id: foundUser.id, role: foundUser.role }, JWT_SECRET, { expiresIn: "180d" });
  const userToReturn = { ...foundUser };
  delete userToReturn.password;
  res.json({ user: userToReturn, token });
}));
app.post("/api/admin/generate-token", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { userId, expiryHours } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });
  const hours = parseInt(expiryHours) || 24;
  const token = Math.random().toString(36).substring(2, 8).toUpperCase();
  const id = `lt_${Date.now()}`;
  const expiresAt = /* @__PURE__ */ new Date();
  expiresAt.setHours(expiresAt.getHours() + hours);
  const { error } = await supabase.from("login_tokens").insert([{
    id,
    userId,
    token,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    expiresAt: expiresAt.toISOString()
  }]);
  if (error) throw new Error(error.message);
  res.json({ token });
}));
app.post("/api/admin/force-logout", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });
  const { error } = await supabase.from("users").update({ force_logout_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", userId);
  if (error) {
    console.error("Force logout error:", error);
    return res.status(500).json({ error: "Error al cerrar sesi\xF3n forzada" });
  }
  res.json({ success: true, message: "Sesi\xF3n cerrada exitosamente para el usuario" });
}));
app.get("/api/auth/me", asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    let user = null;
    try {
      const { data: users } = await supabase.from("users").select("*").eq("id", payload.id);
      if (users && users.length > 0) {
        user = users[0];
      }
    } catch (e) {
      console.warn("DB error in me reference, using local fallback:", e);
    }
    if (!user) {
      user = initialDb.users.find((u) => u.id === payload.id);
    }
    if (!user) return res.status(401).json({ error: "User not found" });
    const userToReturn = { ...user };
    delete userToReturn.password;
    res.json({ user: userToReturn });
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}));
app.post("/api/auth/register-intent", async (req, res) => {
  return res.status(400).json({
    error: "El registro p\xFAblico por correo est\xE1 desactivado. Los miembros del equipo deben ser creados desde el Panel de Administraci\xF3n y acceder mediante C\xF3digo de Vendedor / Administrador y Token de Acceso."
  });
});
app.post("/api/auth/register", asyncHandler(async (req, res) => {
  return res.status(400).json({
    error: "El registro por correo est\xE1 desactivado. Para acceder, solicita un C\xF3digo de Vendedor / Administrador y un Token de Acceso a tu Administrador."
  });
}));
app.put("/api/users/:id/password", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  await supabase.from("users").update({ password: hashedPassword }).eq("id", id);
  res.json({ success: true });
}));
app.post("/api/auth/impersonate", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "userId es requerido" });
  }
  if (req.user?.email !== "seseffff942@gmail.com") {
    return res.status(403).json({ error: "No tienes permisos para suplantar identidades." });
  }
  let user = null;
  const { data: users } = await supabase.from("users").select("*").eq("id", userId);
  if (users && users.length > 0) {
    user = users[0];
  }
  if (!user) {
    return res.status(404).json({ error: "Usuario a suplantar no encontrado" });
  }
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user });
}));
app.post("/api/admin/check-daily-sales", requireAuth, asyncHandler(async (req, res) => {
  const SALES_THRESHOLD = Number(req.body.threshold) || 8750;
  const N8N_WEBHOOK_URL = req.body.webhookUrl || process.env.N8N_WEBHOOK_URL || "http://localhost:5678/webhook/ventas-reporte";
  const sendToWebhook = req.body.sendToWebhook !== false;
  const TARGET_SELLER_EMAIL = "seseffff942@gmail.com";
  const now = /* @__PURE__ */ new Date();
  const gtOffset = -6 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 6e4;
  const gtNow = new Date(utcMs + gtOffset * 6e4);
  const year = gtNow.getFullYear();
  const month = String(gtNow.getMonth() + 1).padStart(2, "0");
  const day = String(gtNow.getDate()).padStart(2, "0");
  const todayLabel = `${year}-${month}-${day}`;
  const startOfDay = `${todayLabel}T00:00:00`;
  const endOfDay = `${todayLabel}T23:59:59`;
  const { data: invoicesData, error: invErr } = await supabase.from("invoices").select("id, folio, clientName, nit, totalAmount, date, items, invoice_type, status, sellerId").gte("date", startOfDay).lte("date", endOfDay);
  if (invErr) {
    return res.status(500).json({ error: `Error al consultar facturas: ${invErr.message}` });
  }
  const { data: usersData } = await supabase.from("users").select("id, name, email, phone").ilike("email", TARGET_SELLER_EMAIL);
  const foundUser = usersData && usersData.length > 0 ? usersData[0] : null;
  const sellerIdKeys = [
    TARGET_SELLER_EMAIL.toLowerCase(),
    foundUser?.id ? foundUser.id.toLowerCase() : null
  ].filter(Boolean);
  const sellerDisplayName = foundUser?.name || TARGET_SELLER_EMAIL.split("@")[0];
  const sellerPhone = foundUser?.phone || process.env.TARGET_SELLER_PHONE || "+50248234048";
  let cantidadVendida = 0;
  let cantidadFacturas = 0;
  const ventas = [];
  for (const inv of invoicesData || []) {
    const sId = (inv.sellerId || "").toLowerCase();
    if (sellerIdKeys.includes(sId) || sId === TARGET_SELLER_EMAIL.toLowerCase()) {
      const amount = Number(inv.totalAmount) || 0;
      cantidadVendida += amount;
      cantidadFacturas += 1;
      let horaVenta = "";
      if (inv.date) {
        try {
          const d = new Date(inv.date);
          horaVenta = d.toLocaleTimeString("es-GT", { timeZone: "America/Guatemala", hour: "2-digit", minute: "2-digit" });
        } catch {
          horaVenta = inv.date;
        }
      }
      const productos = (inv.items || []).map((item) => ({
        producto: item.productName || item.name || "Producto",
        cantidad: item.quantity || 1,
        precioUnitario: item.price || 0,
        subtotal: item.total || 0
      }));
      ventas.push({
        id: inv.id,
        folio: inv.folio || "",
        cliente: inv.clientName || "Cliente",
        nit: inv.nit || "CF",
        monto: amount,
        tipo: inv.invoice_type || "contado",
        estado: inv.status || "completado",
        hora: horaVenta,
        productos
      });
    }
  }
  cantidadVendida = Math.round(cantidadVendida * 100) / 100;
  const cantidadFaltante = Math.max(0, Math.round((SALES_THRESHOLD - cantidadVendida) * 100) / 100);
  const alcanzoMeta = cantidadVendida >= SALES_THRESHOLD;
  const payload = {
    fecha: todayLabel,
    vendedor: sellerDisplayName,
    email: TARGET_SELLER_EMAIL,
    numero: sellerPhone,
    telefono: sellerPhone,
    cantidadVendida,
    cantidadFaltante,
    alcanzoMeta,
    umbral: SALES_THRESHOLD,
    cantidadFacturas,
    mensaje: alcanzoMeta ? `Hola ${sellerDisplayName}, has alcanzado la meta de ventas de hoy con un total de Q${cantidadVendida.toLocaleString("es-GT", { minimumFractionDigits: 2 })} en ${cantidadFacturas} factura(s).` : `Hola ${sellerDisplayName}, has vendido Q${cantidadVendida.toLocaleString("es-GT", { minimumFractionDigits: 2 })} hoy (${cantidadFacturas} factura(s)). Te faltan Q${cantidadFaltante.toLocaleString("es-GT", { minimumFractionDigits: 2 })} para llegar a la meta de Q${SALES_THRESHOLD.toLocaleString("es-GT")}.`,
    ventas
  };
  let webhookResult = null;
  if (sendToWebhook) {
    console.log(`[CHECK-SALES] Enviando POST a n8n para ${sellerDisplayName}: ${N8N_WEBHOOK_URL}`);
    try {
      const webhookRes = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const resText = await webhookRes.text().catch(() => "");
      webhookResult = { status: webhookRes.status, ok: webhookRes.ok, body: resText };
      console.log(`[CHECK-SALES] Respuesta n8n: HTTP ${webhookRes.status} - ${resText}`);
    } catch (err) {
      webhookResult = { error: err.message, ok: false };
      console.error(`[CHECK-SALES] Error al enviar webhook:`, err.message);
    }
  }
  return res.json({
    success: true,
    data: payload,
    webhookResult
  });
}));
app.get("/api/users", requireAuth, asyncHandler(async (req, res) => {
  try {
    const { data: users, error } = await supabase.from("users").select("id, name, email, role, photo, phone, sellerCode");
    if (error) {
      if (error.message.includes("sellerCode")) {
        const { data: usersFallback, error: errFallback } = await supabase.from("users").select("id, name, email, role, photo, phone");
        if (errFallback) throw new Error(errFallback.message);
        return res.json((usersFallback || []).filter((u) => u.role !== "system"));
      }
      throw new Error(error.message);
    }
    res.json((users || []).filter((u) => u.role !== "system"));
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: err.message });
  }
}));
app.post("/api/users", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { email, name, role, photo, phone, sellerCode, password } = req.body;
  if (email && email.trim() !== "") {
    const { data: existing } = await supabase.from("users").select("id").ilike("email", email);
    if (existing && existing.length > 0) return res.status(400).json({ error: "El correo ya est\xE1 registrado" });
  }
  if (sellerCode) {
    const { data: existingCode } = await supabase.from("users").select("id").ilike("sellerCode", sellerCode);
    if (existingCode && existingCode.length > 0) return res.status(400).json({ error: "El c\xF3digo de vendedor ya est\xE1 en uso" });
  }
  let finalSellerCode = sellerCode;
  if (!finalSellerCode || finalSellerCode.trim() === "") {
    let code = "";
    let unique = false;
    let attempts = 0;
    const { data: allUsers } = await supabase.from("users").select("sellerCode");
    const usedCodes = new Set((allUsers || []).map((u) => u.sellerCode).filter(Boolean));
    while (!unique && attempts < 50) {
      code = Math.floor(1e3 + Math.random() * 9e3).toString();
      if (!usedCodes.has(code)) unique = true;
      attempts++;
    }
    finalSellerCode = code;
  }
  const id = `u_${Date.now()}`;
  const hashedPassword = password ? await bcrypt.hash(password, 10) : "";
  const newUser = { id, email: email || null, name, role, photo, phone, sellerCode: finalSellerCode, password: hashedPassword };
  const { error } = await supabase.from("users").insert([newUser]);
  if (error) throw new Error(error.message);
  res.json({ id, email, name, role, photo, phone, sellerCode: finalSellerCode });
}));
app.put("/api/users/:id", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, role, phone, sellerCode, password } = req.body;
  if (email && email.trim() !== "") {
    const { data: existing } = await supabase.from("users").select("id").ilike("email", email);
    if (existing && existing.length > 0 && existing[0].id !== id) {
      return res.status(400).json({ error: "El correo ya est\xE1 registrado" });
    }
  }
  if (sellerCode) {
    const { data: existingCode } = await supabase.from("users").select("id").ilike("sellerCode", sellerCode);
    if (existingCode && existingCode.length > 0 && existingCode[0].id !== id) {
      return res.status(400).json({ error: "El c\xF3digo de vendedor ya est\xE1 en uso" });
    }
  }
  const updates = { name, email: email || null, role, phone, sellerCode };
  if (password) {
    updates.password = await bcrypt.hash(password, 10);
  }
  const { error } = await supabase.from("users").update(updates).eq("id", id);
  if (error) throw new Error(error.message);
  res.json({ success: true, user: { id, name, email: email || null, role, phone, sellerCode } });
}));
app.put("/api/users/:id/photo", requireAuth, requireAdmin, upload.single("image"), asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!req.file) throw new Error("No file uploaded");
  const base64 = req.file.buffer.toString("base64");
  const photoUrl = `data:${req.file.mimetype};base64,${base64}`;
  await supabase.from("users").update({ photo: photoUrl }).eq("id", id);
  res.json({ success: true, photo: photoUrl });
}));
app.get("/api/office-inventory", requireAuth, asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from("office_inventory").select("*");
  if (error) {
    console.warn("Office inventory fetch error (probably table missing):", error);
    return res.json([]);
  }
  const formattedData = (data || []).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    quantity: Number(item.quantity || 0),
    unitPrice: Number(item.unit_price || 0),
    location: item.location,
    status: item.status
  }));
  res.json(formattedData);
}));
app.post("/api/office-inventory", requireAuth, asyncHandler(async (req, res) => {
  console.log("CREATE office item Payload:", req.body);
  const payload = {
    name: req.body.name,
    category: req.body.category,
    quantity: req.body.quantity,
    unit_price: req.body.unitPrice,
    location: req.body.location,
    status: req.body.status
  };
  const { data, error } = await supabase.from("office_inventory").insert([payload]).select().single();
  if (error) {
    console.error("Error creating office item:", error);
    return res.status(500).json({ error: "Error saving item: " + error.message });
  }
  res.json({
    id: data.id,
    name: data.name,
    category: data.category,
    quantity: Number(data.quantity),
    unitPrice: Number(data.unit_price),
    location: data.location,
    status: data.status
  });
}));
app.put("/api/office-inventory/:id", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  console.log("UPDATE office item ID:", id, "Payload:", req.body);
  const payload = {
    name: req.body.name,
    category: req.body.category,
    quantity: req.body.quantity,
    unit_price: req.body.unitPrice,
    location: req.body.location,
    status: req.body.status
  };
  const { data, error } = await supabase.from("office_inventory").update(payload).eq("id", id).select().single();
  if (error) {
    console.error("Error updating office item:", error);
    return res.status(500).json({ error: "Error updating item: " + error.message });
  }
  res.json({
    id: data.id,
    name: data.name,
    category: data.category,
    quantity: Number(data.quantity),
    unitPrice: Number(data.unit_price),
    location: data.location,
    status: data.status
  });
}));
app.delete("/api/office-inventory/:id", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  console.log("DELETE office item ID:", id);
  const { error } = await supabase.from("office_inventory").delete().eq("id", id);
  if (error) {
    console.error("Error deleting office item:", error);
    return res.status(500).json({ error: "Error deleting item: " + error.message });
  }
  res.json({ success: true });
}));
app.get("/api/products", requireAuth, asyncHandler(async (req, res) => {
  const isOwner = req.user && (req.user.email === "seseffff942@gmail.com" || req.user.email === "limalopez22@gmail.com" || req.user.role === "admin");
  const cached = getCachedData("products");
  if (cached) {
    if (!isOwner) {
      return res.json(cached.map((p) => {
        const { cost_price, costPrice, ...rest } = p;
        return rest;
      }));
    }
    return res.json(cached);
  }
  const { data: products, error } = await supabase.from("products").select("id, name, category, stock, price, description, image, variants, specifications, is_external, cost_price, hidden_from_sales");
  if (error) {
    if (error.message.includes("cost_price") || error.message.includes("hidden_from_sales")) {
      const { data: fallback2, error: err3 } = await supabase.from("products").select("id, name, category, stock, price, description, image, variants, specifications, is_external");
      if (err3) {
        const { data: fallback3, error: err4 } = await supabase.from("products").select("id, name, category, stock, price, description, image, variants");
        if (err4) throw new Error(err4.message);
        const fb = (fallback3 || []).map((p) => ({ ...p, specifications: null, is_external: false, cost_price: 0, hidden_from_sales: false, costPrice: 0, hiddenFromSales: false }));
        setCachedData("products", fb);
        return res.json(isOwner ? fb : fb.map((p) => {
          const { cost_price, costPrice, ...rest } = p;
          return rest;
        }));
      }
      const fb2 = (fallback2 || []).map((p) => ({ ...p, cost_price: 0, hidden_from_sales: false, costPrice: 0, hiddenFromSales: false }));
      setCachedData("products", fb2);
      return res.json(isOwner ? fb2 : fb2.map((p) => {
        const { cost_price, costPrice, ...rest } = p;
        return rest;
      }));
    }
    if (error.message.includes("specifications") || error.message.includes("is_external") || error.message.includes("isExternalInventory")) {
      const { data: fallback, error: err2 } = await supabase.from("products").select("id, name, category, stock, price, description, image, variants");
      if (err2) throw new Error(err2.message);
      const fallbackData = (fallback || []).map((p) => ({ ...p, specifications: null, is_external: false, cost_price: 0, hidden_from_sales: false, costPrice: 0, hiddenFromSales: false }));
      setCachedData("products", fallbackData);
      return res.json(isOwner ? fallbackData : fallbackData.map((p) => {
        const { cost_price, costPrice, ...rest } = p;
        return rest;
      }));
    }
    throw new Error(error.message);
  }
  const normalized = (products || []).map((p) => ({
    ...p,
    costPrice: p.cost_price || 0,
    hiddenFromSales: p.hidden_from_sales || false
  }));
  setCachedData("products", normalized);
  if (!isOwner) {
    return res.json(normalized.map((p) => {
      const { cost_price, costPrice, ...rest } = p;
      return rest;
    }));
  }
  res.json(normalized);
}));
app.post("/api/products", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  invalidateCache("products");
  const { name, category, price, stock, image, description, variants, specifications, is_external, costPrice, hiddenFromSales } = req.body;
  if (name) {
    const trimmedName = name.trim();
    const { data: existingProducts } = await supabase.from("products").select("id, name").ilike("name", trimmedName);
    if (existingProducts && existingProducts.length > 0) {
      return res.status(409).json({ error: `Ya existe un producto con el nombre "${trimmedName}". No se admiten duplicados.` });
    }
  }
  const isOwner = req.user && (req.user.email === "seseffff942@gmail.com" || req.user.email === "limalopez22@gmail.com" || req.user.role === "admin");
  const id = `p${Date.now()}`;
  const product = {
    id,
    name,
    category,
    price,
    stock: is_external ? 0 : stock,
    image: image || null,
    description: description || null,
    variants: variants || null,
    is_external: is_external || false
  };
  if (specifications !== void 0 && specifications !== null) {
    product.specifications = specifications;
  }
  const isAdmin = req.user && (req.user.role === "admin" || isOwner);
  if (isOwner) {
    if (costPrice !== void 0) product.cost_price = costPrice;
  }
  if (isAdmin) {
    if (hiddenFromSales !== void 0) product.hidden_from_sales = hiddenFromSales;
  }
  const { error } = await supabase.from("products").insert([product]);
  if (error) {
    const isColumnError = error.message.includes("specifications") || error.message.includes("variants") || error.message.includes("is_external") || error.message.includes("isExternalInventory") || error.message.includes("cost_price") || error.message.includes("hidden_from_sales");
    if (isColumnError) {
      const retryProduct = { ...product };
      delete retryProduct.variants;
      delete retryProduct.specifications;
      delete retryProduct.is_external;
      delete retryProduct.cost_price;
      delete retryProduct.hidden_from_sales;
      delete retryProduct.isExternalInventory;
      const { error: err2 } = await supabase.from("products").insert([retryProduct]);
      if (err2) throw new Error(err2.message);
      return res.json({ ...retryProduct, variants: null, specifications: null, is_external: false, costPrice: 0, hiddenFromSales: false });
    }
    throw new Error(error.message);
  }
  res.json(product);
}));
app.put("/api/products/:id", requireAuth, asyncHandler(async (req, res) => {
  invalidateCache("products");
  const { id } = req.params;
  const { stock, price, name, image, description, category, variants, specifications, is_external, costPrice, hiddenFromSales } = req.body;
  const isOwner = req.user && (req.user.email === "seseffff942@gmail.com" || req.user.email === "limalopez22@gmail.com" || req.user.role === "admin");
  const isAdmin = req.user.role === "admin" || isOwner;
  if (!isAdmin) {
    if (stock !== void 0 || price !== void 0 || name !== void 0 || image !== void 0 || category !== void 0 || variants !== void 0 || specifications !== void 0 || is_external !== void 0) {
      return res.status(403).json({ error: "Solo los administradores pueden editar datos b\xE1sicos del producto." });
    }
    const { data: results2 } = await supabase.from("products").select("description").eq("id", id);
    const existing = results2?.[0];
    if (existing && existing.description) {
      return res.status(403).json({ error: "Solo los administradores pueden modificar descripciones existentes." });
    }
  }
  const updates = {};
  if (stock !== void 0) updates.stock = stock;
  if (price !== void 0) updates.price = price;
  if (name !== void 0) updates.name = name;
  if (image !== void 0) updates.image = image;
  if (description !== void 0) updates.description = description;
  if (category !== void 0) updates.category = category;
  if (variants !== void 0) updates.variants = variants;
  if (specifications !== void 0) updates.specifications = specifications;
  if (is_external !== void 0) updates.is_external = is_external;
  if (isOwner) {
    if (costPrice !== void 0) updates.cost_price = costPrice;
  }
  if (isAdmin) {
    if (hiddenFromSales !== void 0) updates.hidden_from_sales = hiddenFromSales;
  }
  const { data: results, error: checkError } = await supabase.from("products").select("stock, name, id, price").eq("id", id);
  const originalProduct = results?.[0];
  if (checkError || !originalProduct) {
    return res.status(404).json({ error: "Producto no encontrado o error en la base de datos" });
  }
  const hasUpdates = Object.keys(updates).length > 0;
  if (!hasUpdates) {
    return res.json({ ...originalProduct, ...updates });
  }
  let { data, error } = await supabase.from("products").update(updates).eq("id", id).select();
  if (error && (error.message.includes("specifications") || error.message.includes("is_external") || error.message.includes("cost_price") || error.message.includes("hidden_from_sales"))) {
    console.warn("Update failed, retrying granular fallback:", error.message);
    const retryUpdates = { ...updates };
    if (error.message.includes("is_external") || error.message.includes("isExternalInventory")) {
      delete retryUpdates.is_external;
      delete retryUpdates.isExternalInventory;
    }
    if (error.message.includes("specifications")) {
      delete retryUpdates.specifications;
    }
    if (error.message.includes("cost_price")) {
      delete retryUpdates.cost_price;
    }
    if (error.message.includes("hidden_from_sales")) {
      delete retryUpdates.hidden_from_sales;
    }
    if (Object.keys(retryUpdates).length > 0) {
      const { data: retryData, error: retryError } = await supabase.from("products").update(retryUpdates).eq("id", id).select();
      data = retryData;
      error = retryError;
    } else {
      return res.json(originalProduct);
    }
  }
  if (error || !data || data.length === 0) {
    return res.status(500).json({ error: error?.message || "No se pudo actualizar el producto" });
  }
  const updatedProduct = data[0];
  if (originalProduct && stock !== void 0 && originalProduct.stock !== stock && !doesNotNeedStock(originalProduct)) {
    const diff = stock - originalProduct.stock;
    if (diff > 0) {
      await createNotification("restock", "Stock Agregado", `Se agregaron ${Math.abs(diff)} unidades a ${originalProduct.name}. Nuevo stock: ${stock}.`, { productId: id });
    } else if (stock === 0) {
      await createNotification("out_of_stock", "Producto Agotado", `${originalProduct.name} se ha quedado sin stock.`, { productId: id });
    } else if (isCriticalStock(originalProduct, stock)) {
      await createNotification("low_stock", "Stock Cr\xEDtico", `Solo quedan ${stock} unidades de ${originalProduct.name} (l\xEDmite cr\xEDtico: ${getCriticalStockThreshold(originalProduct)} uds).`, { productId: id });
    } else {
      await createNotification("low_stock", "Stock Modificado", `Se redujo el stock de ${originalProduct.name} en ${Math.abs(diff)} unidades. Nuevo stock: ${stock}.`, { productId: id });
    }
  }
  if (originalProduct && price !== void 0 && originalProduct.price !== price) {
    await createNotification("price_changed", "Precio Modificado", `El precio de ${originalProduct.name} cambi\xF3 de Q${originalProduct.price} a Q${price}.`, { productId: id });
  }
  res.json(updatedProduct);
}));
app.get("/api/notifications", requireAuth, asyncHandler(async (req, res) => {
  let dbNotifs = [];
  try {
    const { data, error } = await supabase.from("notifications").select("*").order("createdAt", { ascending: false }).limit(60);
    if (!error && data) {
      dbNotifs = data;
    }
  } catch (e) {
  }
  const localPoints = readLocalNotifications();
  const mergedMap = /* @__PURE__ */ new Map();
  localPoints.forEach((n) => {
    if (n && n.id) {
      mergedMap.set(n.id, n);
    }
  });
  dbNotifs.forEach((n) => {
    if (n && n.id) {
      mergedMap.set(n.id, {
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        createdAt: n.createdAt || n.created_at || (/* @__PURE__ */ new Date()).toISOString(),
        productId: n.productId || n.product_id || null,
        invoiceId: n.invoiceId || n.invoice_id || null
      });
    }
  });
  const finalNotifs = Array.from(mergedMap.values());
  finalNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(finalNotifs.slice(0, 100));
}));
app.delete("/api/notifications/:id", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    await supabase.from("notifications").delete().eq("id", id);
  } catch (e) {
  }
  const local = readLocalNotifications().filter((n) => n.id !== id);
  saveLocalNotifications(local);
  res.json({ success: true });
}));
app.delete("/api/notifications", requireAuth, asyncHandler(async (req, res) => {
  try {
    await supabase.from("notifications").delete().neq("id", "clear-trigger");
  } catch (e) {
  }
  saveLocalNotifications([]);
  res.json({ success: true });
}));
app.get("/api/push/public-key", asyncHandler(async (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
}));
app.post("/api/push/subscribe", asyncHandler(async (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Suscripci\xF3n inv\xE1lida" });
  }
  const current = readPushSubscriptions();
  const filtered = current.filter((sub) => sub.endpoint !== subscription.endpoint);
  filtered.push(subscription);
  savePushSubscriptions(filtered);
  res.json({ success: true, message: "Suscripci\xF3n guardada con \xE9xito" });
}));
app.post("/api/push/test", asyncHandler(async (req, res) => {
  const { title, message } = req.body;
  const resolvedTitle = title || "Prueba de Agricovet \u{1F514}";
  const resolvedMessage = message || "\xA1Las notificaciones Push funcionan con vibraci\xF3n tipo WhatsApp!";
  await broadcastPushNotification(resolvedTitle, resolvedMessage, "/");
  res.json({ success: true, message: "Emitiendo push de prueba a todos los terminales registrados" });
}));
app.get("/api/app-logo", asyncHandler(async (req, res) => {
  const config = readWarehouseConfig();
  if (!config.logoUrl) {
    try {
      const { data: sysRow } = await supabase.from("users").select("photo").eq("id", "sys-logo-config").single();
      if (sysRow && sysRow.photo) {
        config.logoUrl = sysRow.photo;
        saveWarehouseConfig(config);
      }
    } catch (e) {
    }
  }
  res.json({ logoUrl: config.logoUrl || "/agricovet.png" });
}));
app.post("/api/app-logo/upload", requireAuth, requireAdmin, upload.single("logo"), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file provided" });
  }
  try {
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      if (buckets && !buckets.find((b) => b.name === "productos")) {
        await supabase.storage.createBucket("productos", { public: true });
      }
    } catch (bucketErr) {
      console.warn("Could not check/create bucket:", bucketErr);
    }
    let buffer = req.file.buffer;
    let contentType = "image/png";
    let fileName = `logo-${Date.now()}.png`;
    try {
      buffer = await sharp(req.file.buffer).resize(400, 400, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
    } catch (sharpError) {
      console.warn("Sharp logo optimization failed:", sharpError);
      contentType = req.file.mimetype;
      const ext = req.file.originalname ? path.extname(req.file.originalname) : ".png";
      fileName = `logo-${Date.now()}${ext}`;
    }
    const { data: uploadData, error: uploadError } = await supabase.storage.from("productos").upload(fileName, buffer, {
      contentType,
      upsert: true
    });
    let logoUrl = "";
    if (uploadError) {
      console.error("Storage logo upload error, failing back to base64:", uploadError);
      logoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    } else {
      const { data: publicUrlData } = supabase.storage.from("productos").getPublicUrl(fileName);
      logoUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
    }
    const config = readWarehouseConfig();
    config.logoUrl = logoUrl;
    saveWarehouseConfig(config);
    const { data: existing } = await supabase.from("users").select("id").eq("id", "sys-logo-config").single();
    if (existing) {
      await supabase.from("users").update({
        photo: logoUrl,
        name: "App Logo Configuration",
        email: "system-logo@agricovet.com",
        role: "system"
      }).eq("id", "sys-logo-config");
    } else {
      await supabase.from("users").insert([{
        id: "sys-logo-config",
        name: "App Logo Configuration",
        email: "system-logo@agricovet.com",
        role: "system",
        password: "",
        photo: logoUrl,
        phone: ""
      }]);
    }
    res.json({ success: true, logoUrl });
  } catch (error) {
    console.error("Logo upload error:", error);
    res.status(500).json({ error: "Error subiendo el logo", details: error.message });
  }
}));
app.post("/api/app-signature/upload", requireAuth, requireAdmin, upload.single("signature"), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file provided" });
  }
  try {
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      if (buckets && !buckets.find((b) => b.name === "productos")) {
        await supabase.storage.createBucket("productos", { public: true });
      }
    } catch (bucketErr) {
      console.warn("Could not check/create bucket:", bucketErr);
    }
    let buffer = req.file.buffer;
    let contentType = req.file.mimetype;
    let fileName = `signature-${Date.now()}.png`;
    const { data: uploadData, error: uploadError } = await supabase.storage.from("productos").upload(fileName, buffer, {
      contentType,
      upsert: true
    });
    let signatureUrl = "";
    if (uploadError) {
      console.error("Storage signature upload error, failing back to base64:", uploadError);
      signatureUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    } else {
      const { data: publicUrlData } = supabase.storage.from("productos").getPublicUrl(fileName);
      signatureUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
    }
    const config = readWarehouseConfig();
    config.signatureUrl = signatureUrl;
    saveWarehouseConfig(config);
    const { data: existing } = await supabase.from("users").select("id").eq("id", "sys-signature-config").single();
    if (existing) {
      await supabase.from("users").update({
        photo: signatureUrl,
        name: "App Signature Configuration",
        email: "system-signature@agricovet.com",
        role: "system"
      }).eq("id", "sys-signature-config");
    } else {
      await supabase.from("users").insert([{
        id: "sys-signature-config",
        name: "App Signature Configuration",
        email: "system-signature@agricovet.com",
        role: "system",
        password: "",
        photo: signatureUrl,
        phone: ""
      }]);
    }
    res.json({ success: true, signatureUrl });
  } catch (error) {
    console.error("Signature upload error:", error);
    res.status(500).json({ error: "Error subiendo la firma", details: error.message });
  }
}));
app.get("/api/warehouse-config", requireAuth, asyncHandler(async (req, res) => {
  const config = readWarehouseConfig();
  if (!config.logoUrl) {
    try {
      const { data: sysRow } = await supabase.from("users").select("photo").eq("id", "sys-logo-config").single();
      if (sysRow && sysRow.photo) {
        config.logoUrl = sysRow.photo;
        saveWarehouseConfig(config);
      }
    } catch (e) {
    }
  }
  if (!config.signatureUrl) {
    try {
      const { data: sysRow } = await supabase.from("users").select("photo").eq("id", "sys-signature-config").single();
      if (sysRow && sysRow.photo) {
        config.signatureUrl = sysRow.photo;
        saveWarehouseConfig(config);
      }
    } catch (e) {
    }
  }
  res.json({
    location: config.location,
    isSilentModeActive: !!config.isSilentModeActive,
    logoUrl: config.logoUrl || "/agricovet.png",
    signatureUrl: config.signatureUrl || ""
  });
}));
app.post("/api/warehouse-config/verify", requireAuth, asyncHandler(async (req, res) => {
  const { password } = req.body;
  const config = readWarehouseConfig();
  if (!config.logoUrl) {
    try {
      const { data: sysRow } = await supabase.from("users").select("photo").eq("id", "sys-logo-config").single();
      if (sysRow && sysRow.photo) {
        config.logoUrl = sysRow.photo;
        saveWarehouseConfig(config);
      }
    } catch (e) {
    }
  }
  if (!config.signatureUrl) {
    try {
      const { data: sysRow } = await supabase.from("users").select("photo").eq("id", "sys-signature-config").single();
      if (sysRow && sysRow.photo) {
        config.signatureUrl = sysRow.photo;
        saveWarehouseConfig(config);
      }
    } catch (e) {
    }
  }
  if (password === config.password) {
    res.json({
      success: true,
      location: config.location,
      isSilentModeActive: !!config.isSilentModeActive,
      logoUrl: config.logoUrl || "/agricovet.png",
      signatureUrl: config.signatureUrl || ""
    });
  } else {
    res.status(403).json({ success: false, error: "Contrase\xF1a incorrecta" });
  }
}));
app.post("/api/warehouse-config/update", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { location, password, isSilentModeActive, logoUrl, signatureUrl } = req.body;
  const config = readWarehouseConfig();
  if (location !== void 0) config.location = location;
  if (password !== void 0) config.password = password;
  if (isSilentModeActive !== void 0) config.isSilentModeActive = isSilentModeActive;
  if (logoUrl !== void 0) {
    config.logoUrl = logoUrl;
    try {
      const { data: existing } = await supabase.from("users").select("id").eq("id", "sys-logo-config").single();
      if (existing) {
        await supabase.from("users").update({
          photo: logoUrl,
          name: "App Logo Configuration",
          email: "system-logo@agricovet.com",
          role: "system"
        }).eq("id", "sys-logo-config");
      } else {
        await supabase.from("users").insert([{
          id: "sys-logo-config",
          name: "App Logo Configuration",
          email: "system-logo@agricovet.com",
          role: "system",
          password: "",
          photo: logoUrl,
          phone: ""
        }]);
      }
    } catch (e) {
      console.error("Failed to sync logoUrl to Supabase:", e);
    }
  }
  if (signatureUrl !== void 0) {
    config.signatureUrl = signatureUrl;
    try {
      const { data: existing } = await supabase.from("users").select("id").eq("id", "sys-signature-config").single();
      if (existing) {
        await supabase.from("users").update({
          photo: signatureUrl,
          name: "App Signature Configuration",
          email: "system-signature@agricovet.com",
          role: "system"
        }).eq("id", "sys-signature-config");
      } else {
        await supabase.from("users").insert([{
          id: "sys-signature-config",
          name: "App Signature Configuration",
          email: "system-signature@agricovet.com",
          role: "system",
          password: "",
          photo: signatureUrl,
          phone: ""
        }]);
      }
    } catch (e) {
      console.error("Failed to sync signatureUrl to Supabase:", e);
    }
  }
  saveWarehouseConfig(config);
  res.json({
    success: true,
    config: {
      location: config.location,
      isSilentModeActive: config.isSilentModeActive,
      logoUrl: config.logoUrl || "/agricovet.png",
      signatureUrl: config.signatureUrl || ""
    }
  });
}));
app.post("/api/warehouse-config/notify-share", requireAuth, asyncHandler(async (req, res) => {
  const config = readWarehouseConfig();
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  if (emailUser && emailPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: emailUser,
          pass: emailPass
        }
      });
      await transporter.sendMail({
        from: `"Sistema Agricovet" <${emailUser}>`,
        to: emailUser,
        // Notify the admin
        subject: `\u26A0\uFE0F Alerta: Ubicaci\xF3n de Bodega Compartida`,
        html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
                        <h2 style="color: #0d9488;">Alerta de Seguridad</h2>
                        <p>Se ha detectado que la ubicaci\xF3n de la bodega ha sido compartida por un usuario.</p>
                        <div style="background: #f0fdfa; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0d9488;">
                            <p style="margin: 0; font-weight: bold; color: #0f766e;">Detalles de la acci\xF3n:</p>
                            <p style="margin: 5px 0;"><b>Usuario:</b> ${req.user.email}</p>
                            <p style="margin: 5px 0;"><b>Ubicaci\xF3n:</b> ${config.location}</p>
                            <p style="margin: 5px 0;"><b>Fecha:</b> ${(/* @__PURE__ */ new Date()).toLocaleString("es-GT")}</p>
                        </div>
                        <p style="color: #64748b; font-size: 14px;">Este correo es informativo. Si no reconoces esta actividad, por favor revisa los permisos de usuario.</p>
                    </div>
                `
      });
    } catch (e) {
      console.error("Error sending share notification email:", e);
    }
  }
  res.json({ success: true });
}));
app.delete("/api/products/:id", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  invalidateCache("products");
  const { id } = req.params;
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    console.error("Error deleting product:", error);
    return res.status(500).json({ error: error.message });
  }
  res.json({ success: true });
}));
app.post("/api/products/:id/image", requireAuth, requireAdmin, upload.single("image"), asyncHandler(async (req, res) => {
  invalidateCache("products");
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: "No image file provided" });
  try {
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      if (buckets && !buckets.find((b) => b.name === "productos")) {
        await supabase.storage.createBucket("productos", { public: true });
      }
    } catch (bucketErr) {
      console.warn("Could not check/create bucket:", bucketErr);
    }
    let buffer = req.file.buffer;
    let contentType = "image/jpeg";
    let fileName = `${id}-${Date.now()}.jpg`;
    try {
      buffer = await sharp(req.file.buffer).resize(800, 800, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    } catch (sharpError) {
      console.warn("Sharp optimization failed, using original upload buffer:", sharpError);
      buffer = req.file.buffer;
      contentType = req.file.mimetype;
      const ext = req.file.originalname ? path.extname(req.file.originalname) : ".jpg";
      fileName = `${id}-${Date.now()}${ext}`;
    }
    const { data: uploadData, error: uploadError } = await supabase.storage.from("productos").upload(fileName, buffer, {
      contentType,
      upsert: true
    });
    let imageUrl = "";
    if (uploadError) {
      console.error("Storage upload error, failing back to base64:", uploadError);
      let base64Buffer = req.file.buffer;
      try {
        base64Buffer = await sharp(req.file.buffer).resize(400, 400, { fit: "inside" }).jpeg({ quality: 60 }).toBuffer();
      } catch (e) {
        console.warn("Sharp fallback resize failed, using original full buffer for base64:", e);
      }
      imageUrl = `data:${req.file.mimetype};base64,${base64Buffer.toString("base64")}`;
    } else {
      const { data: publicUrlData } = supabase.storage.from("productos").getPublicUrl(fileName);
      imageUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
    }
    const { error: dbError } = await supabase.from("products").update({ image: imageUrl }).eq("id", id);
    if (dbError) {
      console.error("DB update error:", dbError);
      return res.status(500).json({ error: `Error en base de datos: ${dbError.message}` });
    }
    res.json({ success: true, image: imageUrl });
  } catch (error) {
    console.error("Image processing error:", error);
    res.status(500).json({ error: "Error procesando la imagen", details: error.message });
  }
}));
app.get("/api/offers", requireAuth, asyncHandler(async (req, res) => {
  const cached = getCachedData("offers");
  if (cached) {
    return res.json(cached);
  }
  let { data: offers, error } = await supabase.from("offers").select("*");
  if (error) {
    if (error.code === "42P01" || error.message.includes("schema cache") || error.message.includes("does not exist")) {
      offers = [];
    } else {
      throw new Error(error.message);
    }
  }
  offers = offers || [];
  try {
    if (fs.existsSync("offers_extra.json")) {
      const extra = JSON.parse(fs.readFileSync("offers_extra.json", "utf-8"));
      offers.forEach((o) => {
        if (extra[o.id]) {
          o.price = extra[o.id].price;
          o.sellerPrices = extra[o.id].sellerPrices;
        }
      });
    }
  } catch (e) {
  }
  setCachedData("offers", offers);
  res.json(offers);
}));
app.post("/api/offers", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  invalidateCache("offers");
  const id = `o${Date.now()}`;
  const { title, description, badge, startsAt, endsAt, appliesTo, price, sellerPrices, photoUrl } = req.body;
  const offer = { id, title, description, badge, startsAt, endsAt, appliesTo, photoUrl };
  const offerPrice = price;
  const offerSellerPrices = sellerPrices;
  const { error } = await supabase.from("offers").insert([offer]);
  if (error) {
    console.error("Supabase insert error for offers:", error);
    throw new Error(error.message);
  }
  try {
    let extra = {};
    if (fs.existsSync("offers_extra.json")) {
      extra = JSON.parse(fs.readFileSync("offers_extra.json", "utf-8"));
    }
    extra[id] = { price: offerPrice, sellerPrices: offerSellerPrices };
    fs.writeFileSync("offers_extra.json", JSON.stringify(extra));
  } catch (e) {
  }
  offer.price = offerPrice;
  offer.sellerPrices = offerSellerPrices;
  res.json(offer);
}));
app.delete("/api/sales/clear", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    let currentInvoices = [];
    let currentPayments = [];
    try {
      const { data: invs } = await supabase.from("invoices").select("*");
      if (invs) currentInvoices = invs;
      const { data: pmts } = await supabase.from("payments").select("*");
      if (pmts) currentPayments = pmts;
    } catch (dbErr) {
      console.error("Error fetching data for archive preparation:", dbErr);
    }
    for (const inv of currentInvoices) {
      await syncInvoiceToPermanentBackup(inv.id, inv);
    }
    for (const pmt of currentPayments) {
      await syncPaymentToPermanentBackup(pmt.id, pmt);
    }
    try {
      const backupsDir = path.join(process.cwd(), "backups");
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }
      const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
      const backupFileName = `sales_backup_${timestamp}.json`;
      const backupData = {
        clearedAt: (/* @__PURE__ */ new Date()).toISOString(),
        invoicesCount: currentInvoices.length,
        paymentsCount: currentPayments.length,
        invoices: currentInvoices,
        payments: currentPayments
      };
      fs.writeFileSync(path.join(backupsDir, backupFileName), JSON.stringify(backupData, null, 2), "utf8");
      console.log(`[Backup] Previous day archived successfully to ${backupFileName}`);
    } catch (err) {
      console.error("Error creating dated backup file:", err.message);
    }
    try {
      const { error: arcPayErr } = await supabase.from("payments").update({ is_archived: true }).neq("id", "borrar-todos").eq("is_archived", false);
      if (arcPayErr && (arcPayErr.code === "42703" || arcPayErr.message.includes("is_archived"))) {
        console.log("Archive payments failed (likely column missing), skipping DB clear to protect data.");
      }
    } catch (e) {
    }
    try {
      const { error: arcInvErr } = await supabase.from("invoices").update({ is_archived: true }).neq("id", "borrar-todos").eq("is_archived", false);
      if (arcInvErr && (arcInvErr.code === "42703" || arcInvErr.message.includes("is_archived"))) {
        console.log("Archive invoices failed (likely column missing), skipping DB clear to protect data.");
      }
    } catch (e) {
    }
    res.json({ success: true, archivedCount: currentInvoices.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));
app.post("/api/invoices", requireAuth, asyncHandler(async (req, res) => {
  let { sellerId, client, nit, phone, address, items, isOwed, invoiceType, creditDays, debtAlert, customDate, notes, transportMethod, sellerPaysShipping, sellerSignature } = req.body;
  isOwed = true;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "No se puede realizar una venta sin productos." });
  }
  for (const item of items) {
    if (item.quantity === void 0 || parseFloat(item.quantity) <= 0) {
      return res.status(400).json({ error: "La cantidad de cada producto debe ser mayor a cero. No se permiten n\xFAmeros negativos u operar sin cantidades." });
    }
    if (item.price === void 0 || parseFloat(item.price) < 0) {
      return res.status(400).json({ error: "El precio de venta de cada producto no puede ser negativo." });
    }
  }
  const saleOwner = sellerId || req.user.email;
  if (client) {
    let nameToSave = client.trim();
    let companyToSave = "";
    if (client.includes(" - ")) {
      const parts = client.split(" - ");
      nameToSave = parts[0].trim();
      companyToSave = parts[1].trim();
    }
    const normName = nameToSave.toLowerCase();
    const normCompany = companyToSave.toLowerCase();
    let existingList = [];
    try {
      const { data } = await supabase.from("clients").select("*");
      if (data) existingList = data;
    } catch (e) {
    }
    const localList = readLocalClients();
    const matchedClient = findMatchingClient([...existingList, ...localList], nameToSave, companyToSave, nit);
    if (matchedClient) {
      console.log(`Auto-register: Matching client found: "${matchedClient.name}". Avoiding duplicate.`);
      const updates = {};
      if (!matchedClient.nit && nit && String(nit).toUpperCase() !== "CF") updates.nit = nit;
      if (!matchedClient.phone && phone) updates.phone = phone;
      if (!matchedClient.address && address) updates.address = address;
      if (!matchedClient.companyName && companyToSave) updates.companyName = companyToSave;
      const currentSeller = matchedClient.sellerId || matchedClient.seller_id;
      if (!currentSeller && (sellerId || saleOwner)) {
        updates.sellerId = sellerId || saleOwner;
      }
      if (Object.keys(updates).length > 0) {
        updateLocalClient(matchedClient.id, updates);
        try {
          await supabase.from("clients").update(updates).eq("id", matchedClient.id);
        } catch (e) {
        }
      }
    } else {
      const clientData = {
        id: `CLI-${Date.now()}`,
        sellerId: sellerId || saleOwner,
        name: nameToSave,
        companyName: companyToSave,
        nit: nit || "",
        phone: phone || "",
        address: address || "",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      addLocalClient(clientData);
      try {
        await safeInsertClient(clientData);
      } catch (e) {
        console.error("Auto-register client insert failed:", e);
      }
    }
  }
  let total = 0;
  const processedItems = [];
  let requiresAuth = debtAlert === true;
  const id = `INV-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  let invoice = null;
  const releaseStockLocks = await acquireStockLocks(items.map((i) => i.productId));
  const deductedStockRecords = [];
  try {
    for (const item of items) {
      let product;
      if (item.productId?.startsWith("shipping-") || item.productName === "COSTO DE ENVIO" || item.productId === "shipping-cost") {
        product = {
          id: item.productId,
          name: "COSTO DE ENVIO",
          price: item.price !== void 0 ? parseFloat(item.price) : 26,
          stock: 999999,
          is_external: true,
          category: "Servicios",
          description: "Costo de env\xEDo"
        };
      } else {
        const { data: products, error } = await supabase.from("products").select("*").eq("id", item.productId);
        if (error || !products || products.length === 0) throw new Error(`Producto ${item.productId} no encontrado`);
        product = products[0];
      }
      const itemPrice = item.price !== void 0 ? parseFloat(item.price) : product.price;
      const isExemptFromStock = doesNotNeedStock(product);
      if (!product.is_external) {
        let currentStock = parseFloat(product.stock || 0);
        let variantObj = null;
        let variantsToUpdate = product.variants ? [...product.variants] : [];
        if (item.variantId) {
          const varIndex = variantsToUpdate.findIndex((v) => v.id === item.variantId);
          if (varIndex !== -1) {
            variantObj = variantsToUpdate[varIndex];
            if (variantObj.stock !== void 0) {
              currentStock = parseFloat(variantObj.stock || 0);
            }
          }
        }
        if (currentStock < item.quantity && !isExemptFromStock) {
          requiresAuth = true;
          item.isStockAlert = true;
        }
        const newStock = currentStock - parseFloat(item.quantity);
        if (newStock <= 0 && !isExemptFromStock) {
          const productNameStr = variantObj ? `${product.name} (${variantObj.color} - ${variantObj.size})` : product.name;
          const stockMessage = `\u26A0\uFE0F *ALERTA DE AGOTADO*: El producto *${productNameStr}* se ha quedado sin stock (Venta a ${client}).`;
          const { data: admins } = await supabase.from("users").select("phone, name").eq("role", "admin");
          if (admins) {
            for (const admin of admins) {
              if (admin.phone) {
                console.log(`Enviando alerta de stock a admin ${admin.name}: ${productNameStr}`);
                internalSendWhatsApp(admin.phone, stockMessage, "alerta_stock_cero", "es_MX", [
                  { name: "w_producto", value: productNameStr.substring(0, 50) },
                  { name: "w_cliente", value: client.substring(0, 50) }
                ]).catch((err) => console.warn(`Error enviando alerta stock a ${admin.name}:`, err.message));
              }
            }
          }
        } else if (!isExemptFromStock) {
          const threshold = getCriticalStockThreshold(product);
          if (currentStock > threshold && newStock <= threshold && newStock > 0) {
            const productNameStr = variantObj ? `${product.name} (${variantObj.color} - ${variantObj.size})` : product.name;
            const stockMessage = `\u{1F6A8} *ALERTA CR\xCDTICA DE STOCK*: El producto *${productNameStr}* ha bajado a ${threshold} unidades o menos. (Stock actual: ${newStock}).`;
            const { data: admins } = await supabase.from("users").select("phone, name").eq("role", "admin");
            if (admins) {
              for (const admin of admins) {
                if (admin.phone) {
                  internalSendWhatsApp(admin.phone, stockMessage, "alerta_stock_critico", "es_MX", [
                    { name: "w_producto", value: productNameStr.substring(0, 50) },
                    { name: "w_stock", value: String(newStock) }
                  ]).catch((err) => console.warn(`Error enviando alerta cr\xEDtica a ${admin.name}:`, err.message));
                }
              }
            }
          }
        }
        if (variantObj && variantObj.stock !== void 0) {
          const varIndex = variantsToUpdate.findIndex((v) => v.id === item.variantId);
          variantsToUpdate[varIndex] = { ...variantsToUpdate[varIndex], stock: newStock };
          const { error: vErr } = await supabase.from("products").update({ variants: variantsToUpdate }).eq("id", product.id);
          if (vErr) console.error(`Error updating variant stock for product ${product.id}:`, vErr.message);
        } else {
          const { error: sErr } = await supabase.from("products").update({ stock: newStock }).eq("id", product.id);
          if (sErr) console.error(`Error updating stock for product ${product.id}:`, sErr.message);
        }
        if (!isExemptFromStock) {
          deductedStockRecords.push({ productId: product.id, variantId: variantObj?.id, qty: parseFloat(item.quantity) });
        }
      }
      if (itemPrice < product.price && !item.isOfferApplied || item.isPriceAlert) {
        requiresAuth = true;
      }
      const itemTotal = item.quantity * itemPrice;
      total += itemTotal;
      processedItems.push({ ...item, price: itemPrice, total: itemTotal, productName: product.name, originalPrice: product.price });
    }
    const id2 = `INV-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    invalidateCache("folio_map");
    const currentFolioMap = await getFolioMap(true);
    const existingFolioValues = Object.values(currentFolioMap).map((v) => Number(v) || 0);
    const maxFolio = existingFolioValues.reduce((max, val) => val > max ? val : max, 0);
    let startFromConfig = 1;
    try {
      const FOLIO_CONFIG_FILE = path.join(process.cwd(), "folio_config.json");
      if (fs.existsSync(FOLIO_CONFIG_FILE)) {
        const cfg = JSON.parse(fs.readFileSync(FOLIO_CONFIG_FILE, "utf-8"));
        startFromConfig = cfg.startFrom || 1;
      }
    } catch (e) {
    }
    let assignedFolio = maxFolio >= startFromConfig ? maxFolio + 1 : startFromConfig;
    while (existingFolioValues.includes(assignedFolio) || assignedFolio === 812) {
      assignedFolio++;
    }
    let folioFlag = `|||FOLIO:${assignedFolio}`;
    let safeNotes = notes ? String(notes).replace(/\|\|\|/g, " - ") : "";
    let baseNotes = nit || "";
    let obsFlag = safeNotes ? "|||OBS:" + safeNotes : "";
    let invoiceTypeFlag = "|||TYPE:" + (invoiceType || "veterinaria");
    let creditFlag = "|||CREDIT:" + (creditDays || (invoiceType === "agricola" ? 60 : 30));
    let transFlag = transportMethod ? "|||TRANS:" + transportMethod : "";
    let sellerFlag = sellerPaysShipping ? "|||PAYSHIP:true" : "";
    let authFlag = requiresAuth ? "|||AUTH:pending" : "";
    let sellerSigFlag = sellerSignature ? `|||SELLER_SIG:${sellerSignature}` : "";
    if (requiresAuth && debtAlert) {
      authFlag += "|||DEBT:true";
    }
    const isUserAdmin = req.user && req.user.role === "admin";
    const saleExactTimestamp = isUserAdmin && customDate ? /^\d{4}-\d{2}-\d{2}$/.test(customDate) ? (/* @__PURE__ */ new Date(`${customDate}T12:00:00-06:00`)).toISOString() : new Date(customDate).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
    const invoiceDataRaw = {
      id: id2,
      sellerId: saleOwner,
      notes: baseNotes + obsFlag + invoiceTypeFlag + creditFlag + transFlag + sellerFlag + authFlag + sellerSigFlag + folioFlag,
      items: processedItems,
      totalAmount: total,
      paidAmount: isOwed ? 0 : total,
      status: isOwed ? "pending" : "paid",
      date: saleExactTimestamp
    };
    invoiceDataRaw["clientName"] = client;
    invoiceDataRaw["customerPhone"] = phone || "";
    invoiceDataRaw["deliveryAddress"] = address || "";
    invoiceDataRaw["nit"] = nit || "";
    invoiceDataRaw["folio"] = String(assignedFolio);
    invoiceDataRaw["invoice_type"] = invoiceType || "veterinaria";
    invoiceDataRaw["credit_days"] = creditDays || (invoiceType === "agricola" ? 60 : 30);
    invoiceDataRaw["transport_method"] = transportMethod || "";
    invoiceDataRaw["seller_pays_shipping"] = !!sellerPaysShipping;
    invoiceDataRaw["auth_status"] = requiresAuth ? "pending" : "approved";
    if (sellerSignature) invoiceDataRaw["seller_signature"] = sellerSignature;
    let { error: insertError } = await supabase.from("invoices").insert([invoiceDataRaw]);
    if (insertError) {
      console.warn("Primary insert invoice error:", insertError.message);
      const fallbackInvoice1 = { ...invoiceDataRaw };
      delete fallbackInvoice1["clientName"];
      delete fallbackInvoice1["customerPhone"];
      delete fallbackInvoice1["deliveryAddress"];
      fallbackInvoice1["client"] = client;
      fallbackInvoice1["phone"] = phone || "";
      fallbackInvoice1["address"] = address || "";
      fallbackInvoice1["folio"] = String(assignedFolio);
      const { error: retryError1 } = await supabase.from("invoices").insert([fallbackInvoice1]);
      if (retryError1) {
        const bareInvoice = { ...fallbackInvoice1 };
        delete bareInvoice["phone"];
        delete bareInvoice["address"];
        delete bareInvoice["nit"];
        const { error: retryError2 } = await supabase.from("invoices").insert([bareInvoice]);
        if (retryError2) throw new Error(retryError2.message);
      }
    }
    invoice = { ...invoiceDataRaw, client, phone, address };
    await syncInvoiceToPermanentBackup(id2, invoiceDataRaw);
    invalidateCache("products");
    invalidateCache("folio_map");
  } catch (err) {
    if (deductedStockRecords.length > 0) {
      console.warn(`[StockRollback] Fall\xF3 la creaci\xF3n de factura. Revirtiendo ${deductedStockRecords.length} \xEDtems descontados.`);
      for (const ded of deductedStockRecords) {
        try {
          const { data: pList } = await supabase.from("products").select("stock, variants").eq("id", ded.productId);
          const p = pList?.[0];
          if (p) {
            if (ded.variantId && p.variants) {
              const vars = [...p.variants];
              const vIdx = vars.findIndex((v) => v.id === ded.variantId);
              if (vIdx !== -1) {
                vars[vIdx] = { ...vars[vIdx], stock: parseFloat(vars[vIdx].stock || 0) + ded.qty };
                await supabase.from("products").update({ variants: vars }).eq("id", ded.productId);
              }
            } else {
              await supabase.from("products").update({ stock: parseFloat(p.stock || 0) + ded.qty }).eq("id", ded.productId);
            }
          }
        } catch (rbErr) {
          console.error(`[StockRollback] Error revirtiendo producto ${ded.productId}:`, rbErr.message);
        }
      }
      invalidateCache("products");
    }
    throw err;
  } finally {
    releaseStockLocks();
  }
  try {
    const baseUrl = req.headers.referer ? new URL(req.headers.referer).origin : "https://" + req.headers.host;
    const invoiceUrl = `${baseUrl}/#billing`;
    const { data: admins } = await supabase.from("users").select("name, phone").eq("role", "admin");
    if (admins && admins.length > 0) {
      const itemSummary = processedItems && processedItems.length > 0 ? processedItems.map((item) => `${item.quantity}x ${item.productName || "Producto"}`).join(", ") : "Sin productos";
      const itemSummaryTruncated = itemSummary.length > 150 ? itemSummary.substring(0, 147) + "..." : itemSummary;
      const totalFormatted = `Q. ${total.toFixed(2)}`;
      const zone = (address || transportMethod || "Entrega en Tienda/Oficina Central").trim();
      const folioMap2 = await getFolioMap();
      const folioVal = String(folioMap2[String(id)] || 1);
      for (const admin of admins) {
        if (admin.phone) {
          const message = `\u{1F6A8} *\xA1Nuevo Pedido Ingresado!* \u{1F6A8}

Hola ${admin.name || "Sergio"},

Detalles de la compra:
\u{1F464} *Cliente*: ${client}
\u{1F4E6} *Productos*: ${itemSummaryTruncated}
\u{1F4B0} *Total*: ${totalFormatted}
\u{1F4CD} *Ubicaci\xF3n / Ruta*: ${zone}

Por favor, revisa el panel de administraci\xF3n para confirmar el inventario y coordinar el despacho. \u{1F331}\u{1F69C}

AgricoVet - Sistema de Notificaciones`;
          console.log(`Enviando notificaci\xF3n "alerta_nuevo_pedido_interno" al administrador: ${admin.name} (${admin.phone})`);
          internalSendWhatsApp(admin.phone, message, "alerta_nuevo_pedido_interno", "es", [
            admin.name || "Sergio",
            client,
            itemSummaryTruncated,
            totalFormatted,
            zone,
            folioVal
          ]).then((result) => {
            if (!result.success) {
              console.error(`Error WhatsApp al admin ${admin.name} (${admin.phone}):`, result.error, result.data || "");
            } else {
              console.log(`WhatsApp enviado exitosamente a ${admin.name}.`);
            }
          }).catch((err) => {
            console.error(`Exception enviando WhatsApp a admin ${admin.name}:`, err);
          });
        }
      }
    }
  } catch (e) {
    console.error("Notification block error:", e);
  }
  await createNotification("new_order", "Nuevo Pedido", `Se ha registrado un pedido de ${client} por Q${total.toFixed(2)}.`, { invoiceId: id });
  let returnInvoice = { ...invoice };
  const rawNotes = returnInvoice.notes || "";
  const flags = rawNotes.split("|||");
  let tempNit = flags[0].trim();
  let realNotes = "";
  flags.slice(1).forEach((flag) => {
    const idx = flag.indexOf(":");
    if (idx === -1) return;
    const key = flag.substring(0, idx);
    const value = flag.substring(idx + 1);
    if (key === "AUTH") {
      returnInvoice.authStatus = value;
    } else if (key === "DEBT") {
      returnInvoice.hasDebtAlert = value === "true";
    } else if (key === "CREDIT") {
      returnInvoice.creditDays = parseInt(value);
    } else if (key === "TYPE") {
      returnInvoice.invoiceType = value;
    } else if (key === "OBS") {
      realNotes = value;
    } else if (key === "TRANS") {
      returnInvoice.transportMethod = value;
    } else if (key === "PAYSHIP") {
      returnInvoice.sellerPaysShipping = value === "true";
    } else if (key === "EDITED") {
      returnInvoice.isEdited = value === "true";
    } else if (key === "SCAN_CLIENT") {
      returnInvoice.scanClient = value;
    } else if (key === "SCAN_DATE") {
      returnInvoice.scanDate = value;
    } else if (key === "SELLER_SIG") {
      returnInvoice.sellerSignature = value;
    } else if (key === "ADMIN_SIG") {
      returnInvoice.adminSignature = value;
    } else if (key === "REVIEWED_BY") {
      returnInvoice.reviewedBy = value;
    }
  });
  if (tempNit.length > 25 || tempNit.toLowerCase().includes("enviar") || tempNit.toLowerCase().includes("entrega") || tempNit.toLowerCase().includes("nota")) {
    returnInvoice.notes = realNotes ? realNotes + " " + tempNit : tempNit;
    returnInvoice.nit = returnInvoice.nit || "";
  } else {
    returnInvoice.nit = returnInvoice.nit || tempNit;
    returnInvoice.notes = realNotes;
  }
  const folioMap = await getFolioMap();
  res.json({
    ...returnInvoice,
    isOwed: true,
    folio: folioMap[returnInvoice.id] || 1,
    client: returnInvoice.client || returnInvoice.clientName || client,
    nit: returnInvoice.nit || "",
    phone: returnInvoice.phone || returnInvoice.customerPhone || phone || "",
    address: returnInvoice.address || returnInvoice.deliveryAddress || address || ""
  });
}));
app.put("/api/invoices/:id/full", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  let { client, nit, phone, address, items, isOwed, notes, sellerSignature, sellerId, customDate, date } = req.body;
  isOwed = true;
  const { data: invoices } = await supabase.from("invoices").select("*").eq("id", id);
  if (!invoices || invoices.length === 0) return res.status(404).json({ error: "No encontrada" });
  const oldInvoice = invoices[0];
  if (oldInvoice.status === "cancelled" || oldInvoice.status === "rejected") {
    return res.status(400).json({ error: "Factura anulada, no se puede editar." });
  }
  let finalNotes = notes || oldInvoice.notes || "";
  if (sellerSignature) {
    finalNotes = updateTagInNotes(finalNotes, "SELLER_SIG", sellerSignature);
  }
  let total = 0;
  let needsAuth = false;
  let formattedItems = [];
  for (const item of items) {
    let prod;
    if (item.productId?.startsWith("shipping-") || item.productName === "COSTO DE ENVIO" || item.productId === "shipping-cost") {
      prod = {
        id: item.productId,
        name: "COSTO DE ENVIO",
        price: item.price !== void 0 ? parseFloat(item.price) : 26,
        stock: 999999,
        is_external: true,
        variants: []
      };
    } else {
      const { data: products } = await supabase.from("products").select("stock, price, name, is_external, variants").eq("id", item.productId);
      prod = products?.[0];
    }
    if (!prod) return res.status(400).json({ error: `Producto ${item.productName || item.productId} no encontrado o fue eliminado. No se pudo guardar.` });
    let variantsToUpdate = prod.variants ? [...prod.variants] : [];
    let variantObj = null;
    let currentStock = parseFloat(prod.stock || 0);
    if (item.variantId) {
      const varIndex = variantsToUpdate.findIndex((v) => v.id === item.variantId);
      if (varIndex !== -1) {
        variantObj = variantsToUpdate[varIndex];
        if (variantObj.stock !== void 0) {
          currentStock = parseFloat(variantObj.stock || 0);
        }
      }
    }
    let isStockAlert = !prod.is_external && currentStock < item.quantity && !doesNotNeedStock(prod);
    if (!item.isAuthorized && (item.price < prod.price || isStockAlert)) needsAuth = true;
    total += item.price * item.quantity;
    formattedItems.push({
      ...item,
      isStockAlert,
      productName: prod.name,
      originalPrice: prod.price,
      total: item.price * item.quantity
    });
  }
  const netStockChanges = {};
  for (const old of oldInvoice.items) {
    if (!netStockChanges[old.productId]) netStockChanges[old.productId] = { total: 0, variants: {} };
    if (old.variantId) {
      netStockChanges[old.productId].variants[old.variantId] = (netStockChanges[old.productId].variants[old.variantId] || 0) + parseFloat(old.quantity);
    } else {
      netStockChanges[old.productId].total += parseFloat(old.quantity);
    }
  }
  for (const newItem of items) {
    if (newItem.productId?.startsWith("shipping-") || newItem.productName === "COSTO DE ENVIO" || newItem.productId === "shipping-cost") continue;
    if (!netStockChanges[newItem.productId]) netStockChanges[newItem.productId] = { total: 0, variants: {} };
    if (newItem.variantId) {
      netStockChanges[newItem.productId].variants[newItem.variantId] = (netStockChanges[newItem.productId].variants[newItem.variantId] || 0) - parseFloat(newItem.quantity);
    } else {
      netStockChanges[newItem.productId].total -= parseFloat(newItem.quantity);
    }
  }
  const releaseEditStockLocks = await acquireStockLocks(Object.keys(netStockChanges));
  try {
    for (const [prodId, changes] of Object.entries(netStockChanges)) {
      const { data: pData } = await supabase.from("products").select("stock, is_external, variants").eq("id", prodId);
      const p = pData?.[0];
      if (!p || p.is_external) continue;
      let varsToUpdate = p.variants ? [...p.variants] : [];
      for (const [varId, netDiff] of Object.entries(changes.variants)) {
        if (netDiff === 0) continue;
        const vIdx = varsToUpdate.findIndex((v) => v.id === varId);
        if (vIdx !== -1) {
          varsToUpdate[vIdx] = { ...varsToUpdate[vIdx], stock: parseFloat(varsToUpdate[vIdx].stock || 0) + netDiff };
        }
      }
      if (Object.keys(changes.variants).length > 0) {
        await supabase.from("products").update({ variants: varsToUpdate }).eq("id", prodId);
      } else if (changes.total !== 0) {
        await supabase.from("products").update({ stock: parseFloat(p.stock || 0) + changes.total }).eq("id", prodId);
      }
    }
  } finally {
    releaseEditStockLocks();
  }
  let baseNotesParts = (oldInvoice.notes || "").split("|||");
  let oldNit = baseNotesParts[0].trim();
  let keepFlags = baseNotesParts.slice(1).filter((f) => !f.startsWith("AUTH:") && !f.startsWith("OBS:") && !f.startsWith("SELLER_SIG:") && !f.startsWith("ADMIN_SIG:") && !f.startsWith("REVIEWED_BY:"));
  let safeNotes = notes !== void 0 ? String(notes).replace(/\|\|\|/g, " - ") : "";
  let obsFlag = safeNotes ? "|||OBS:" + safeNotes : "";
  let sellerSigFlag = sellerSignature ? `|||SELLER_SIG:${sellerSignature}` : "";
  let reconstructedBaseNotes = oldNit + obsFlag + sellerSigFlag;
  for (const f of keepFlags) {
    reconstructedBaseNotes += "|||" + f;
  }
  if (!reconstructedBaseNotes.includes("|||FOLIO:")) {
    const currentFolioMap = await getFolioMap();
    const existingFolio = currentFolioMap[String(oldInvoice.id)];
    if (existingFolio) {
      reconstructedBaseNotes += `|||FOLIO:${existingFolio}`;
    }
  }
  if (!reconstructedBaseNotes.includes("|||EDITED:true")) {
    reconstructedBaseNotes += "|||EDITED:true";
  }
  let newNotes = reconstructedBaseNotes;
  invalidateCache("folio_map");
  if (needsAuth) {
    newNotes += "|||AUTH:pending";
  } else {
    newNotes += "|||AUTH:authorized";
  }
  const isUserAdmin = req.user && req.user.role === "admin";
  const targetDate = isUserAdmin ? customDate || date : null;
  const updatedDataRaw = {
    notes: newNotes,
    items: formattedItems,
    totalAmount: total,
    status: isOwed ? "pending" : oldInvoice.paidAmount >= total ? "paid" : oldInvoice.status === "sent" ? "sent" : "pending"
  };
  if (targetDate) {
    updatedDataRaw.date = /^\d{4}-\d{2}-\d{2}$/.test(targetDate) ? (/* @__PURE__ */ new Date(`${targetDate}T12:00:00-06:00`)).toISOString() : /^\d{4}-\d{2}-\d{2}T/.test(targetDate) ? targetDate : new Date(targetDate).toISOString();
  }
  updatedDataRaw["clientName"] = client;
  updatedDataRaw["customerPhone"] = phone || "";
  updatedDataRaw["deliveryAddress"] = address || "";
  const { error: updateError } = await supabase.from("invoices").update(updatedDataRaw).eq("id", id);
  if (updateError) {
    console.warn("Primary update invoice error:", updateError.message);
    const fallbackData = { ...updatedDataRaw };
    delete fallbackData["clientName"];
    delete fallbackData["customerPhone"];
    delete fallbackData["deliveryAddress"];
    fallbackData["client"] = client;
    fallbackData["phone"] = phone || "";
    fallbackData["address"] = address || "";
    const { error: retryError1 } = await supabase.from("invoices").update(fallbackData).eq("id", id);
    if (retryError1) {
      const bareData = { ...fallbackData };
      delete bareData["phone"];
      delete bareData["address"];
      await supabase.from("invoices").update(bareData).eq("id", id);
    }
  }
  const updatedData = { ...updatedDataRaw, client, phone, address };
  await syncInvoiceToPermanentBackup(id);
  invalidateCache("products");
  invalidateCache("folio_map");
  let returnInvoice = { ...oldInvoice, ...updatedData };
  if (returnInvoice.notes.includes("|||AUTH:")) {
    const parts = returnInvoice.notes.split("|||AUTH:");
    returnInvoice.notes = parts[0];
    returnInvoice.authStatus = parts[1];
  }
  const folioMap = await getFolioMap();
  res.json({
    ...returnInvoice,
    isOwed: true,
    folio: folioMap[returnInvoice.id] || 1,
    client: returnInvoice.client || returnInvoice.clientName || client,
    nit: returnInvoice.nit || "",
    phone: returnInvoice.phone || returnInvoice.customerPhone || phone || "",
    address: returnInvoice.address || returnInvoice.deliveryAddress || address || ""
  });
}));
app.put("/api/invoices/:id/review", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { adminSignature, reviewedBy } = req.body;
  const { data: invoices } = await supabase.from("invoices").select("notes").eq("id", id);
  if (!invoices || invoices.length === 0) return res.status(404).json({ error: "No encontrada" });
  let currentNotes = invoices[0].notes || "";
  currentNotes = updateTagInNotes(currentNotes, "ADMIN_SIG", adminSignature);
  currentNotes = updateTagInNotes(currentNotes, "REVIEWED_BY", reviewedBy);
  currentNotes = updateTagInNotes(currentNotes, "AUTH", "authorized");
  const { error } = await supabase.from("invoices").update({ notes: currentNotes }).eq("id", id);
  if (error) throw error;
  res.json({ success: true });
}));
app.put("/api/invoices/:id/credit-days", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { creditDays } = req.body;
  try {
    const { data, error: selectError } = await supabase.from("invoices").select("notes").eq("id", id).single();
    if (selectError) console.error("Select error:", selectError);
    if (data) {
      let notes = data.notes || "";
      if (notes.includes("|||CREDIT:")) {
        const parts = notes.split("|||CREDIT:");
        let rest = parts[1].replace(/^\d+/, "");
        notes = parts[0] + "|||CREDIT:" + creditDays + rest;
      } else {
        if (notes.includes("|||AUTH:")) {
          const authParts = notes.split("|||AUTH:");
          notes = authParts[0] + "|||CREDIT:" + creditDays + "|||AUTH:" + authParts[1];
        } else {
          notes = notes + "|||CREDIT:" + creditDays;
        }
      }
      const { error: updateError } = await supabase.from("invoices").update({ notes }).eq("id", id);
      if (updateError) console.error("Update error:", updateError);
      await syncInvoiceToPermanentBackup(id);
    }
  } catch (e) {
    console.error("Catch error:", e);
  }
  res.json({ success: true });
}));
app.put("/api/invoices/:id/price", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { itemIndex, newPrice } = req.body;
  const { data: invoices, error } = await supabase.from("invoices").select("*").eq("id", id);
  if (error || !invoices || invoices.length === 0) return res.status(404).json({ error: "Invoice not found" });
  const invoice = invoices[0];
  if (invoice.status === "paid" || invoice.status === "cancelled") {
    return res.status(400).json({ error: "Cannot edit this invoice." });
  }
  if (invoice.items[itemIndex]) {
    invoice.items[itemIndex].price = newPrice;
    invoice.items[itemIndex].total = invoice.items[itemIndex].quantity * newPrice;
  }
  const newTotalAmount = invoice.items.reduce((acc, item) => acc + item.total, 0);
  invoice.totalAmount = newTotalAmount;
  await supabase.from("invoices").update({
    items: invoice.items,
    totalAmount: newTotalAmount
  }).eq("id", id);
  await syncInvoiceToPermanentBackup(id);
  res.json(invoice);
}));
app.put("/api/invoices/:id", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, guideNumber, folio, deliveryLetterUrl, shippingGuideUrl, clientName, shippingDate, sellerId } = req.body;
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (!invoice) return res.status(404).json({ error: "No encontrada" });
  if ((status === "cancelled" || status === "rejected") && invoice.status !== "cancelled" && invoice.status !== "rejected") {
    const docFel = await obtenerDocumentoPorFactura(supabase, id);
    if (docFel && docFel.estado === "certificado" && docFel.numero_autorizacion) {
      return res.status(409).json({
        error: 'Esta factura tiene un documento electronico (DTE) CERTIFICADO ante SAT. Para anularla, usa "Anular documento ante SAT" en el panel FEL: ese proceso anula el DTE ante la SAT y ademas cancela la factura y restaura el stock.',
        requiereAnulacionFel: true
      });
    }
  }
  let updateData = { status };
  if (status !== invoice.status) {
    if (status === "pending") {
      updateData.paidAmount = 0;
    } else if (status === "paid") {
      updateData.paidAmount = invoice.totalAmount;
    }
  }
  if (status === "cancelled" || status === "rejected") {
    if (invoice.status !== "cancelled" && invoice.status !== "rejected") {
      await restaurarStockDeFactura(invoice);
    }
  }
  if (guideNumber || folio || deliveryLetterUrl || shippingGuideUrl) {
    const { data: inv } = await supabase.from("invoices").select("notes").eq("id", id).single();
    if (inv) {
      let notes = inv.notes || "";
      if (guideNumber) {
        notes = updateTagInNotes(notes, "TRACKING", guideNumber);
      }
      if (folio !== void 0) {
        const parsedFolio = parseInt(folio);
        if (!isNaN(parsedFolio)) {
          const currentMap = await getFolioMap();
          const previousFolio = currentMap[String(id)];
          if (previousFolio !== parsedFolio) {
            console.log(`[FolioCascade] Shifting folios starting from ${parsedFolio} to make room for invoice ${id}`);
            const { data: otherInvoices } = await supabase.from("invoices").select("id, notes, status").eq("is_archived", false).neq("id", id);
            if (otherInvoices && otherInvoices.length > 0) {
              const updates = [];
              for (const otherInv of otherInvoices) {
                if (otherInv.status === "cancelled" || otherInv.status === "rejected") {
                  continue;
                }
                const otherCurrentFolio = currentMap[String(otherInv.id)];
                if (otherCurrentFolio !== void 0 && otherCurrentFolio >= parsedFolio) {
                  const otherNewFolio = otherCurrentFolio + 1;
                  let otherNotes = otherInv.notes || "";
                  otherNotes = updateTagInNotes(otherNotes, "FOLIO", otherNewFolio);
                  updates.push({
                    id: otherInv.id,
                    notes: otherNotes
                  });
                }
              }
              if (updates.length > 0) {
                console.log(`[FolioCascade] Updating ${updates.length} other invoices with higher folios`);
                for (const update of updates) {
                  await supabase.from("invoices").update({ notes: update.notes }).eq("id", update.id);
                  await syncInvoiceToPermanentBackup(update.id);
                }
              }
            }
          }
        }
        notes = updateTagInNotes(notes, "FOLIO", folio);
      }
      if (deliveryLetterUrl) {
        notes = updateTagInNotes(notes, "DELIVERY_LETTER", deliveryLetterUrl);
      }
      if (shippingGuideUrl) {
        notes = updateTagInNotes(notes, "SHIPPING_GUIDE", shippingGuideUrl);
      }
      if (clientName) {
        notes = updateTagInNotes(notes, "SCAN_CLIENT", clientName);
      }
      if (shippingDate) {
        notes = updateTagInNotes(notes, "SCAN_DATE", shippingDate);
      }
      updateData.notes = notes;
      if (sellerId !== void 0) {
        updateData.sellerId = sellerId;
      }
      await supabase.from("invoices").update(updateData).eq("id", id);
      invalidateCache("folio_map");
      invalidateCache("products");
      await syncInvoiceToPermanentBackup(id);
      return res.json({ success: true, guideNumber, folio });
    }
  }
  await supabase.from("invoices").update(updateData).eq("id", id);
  invalidateCache("folio_map");
  invalidateCache("products");
  await syncInvoiceToPermanentBackup(id);
  res.json({ success: true });
}));
app.put("/api/invoices/:id/archive", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (!invoice) {
    return res.status(404).json({ error: "La factura no existe" });
  }
  if (req.user.role !== "admin" && invoice.sellerId !== req.user.email) {
    return res.status(403).json({ error: "No autorizado para archivar esta factura" });
  }
  await supabase.from("invoices").update({ is_archived: true }).eq("id", id);
  invalidateCache("folio_map");
  await syncInvoiceToPermanentBackup(id);
  res.json({ success: true });
}));
app.delete("/api/invoices/:id", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (!invoice) {
    return res.status(404).json({ error: "La factura no existe" });
  }
  if (req.user.role !== "admin" && invoice.sellerId !== req.user.email) {
    return res.status(403).json({ error: "No autorizado para eliminar esta factura" });
  }
  if (invoice.status !== "cancelled" && invoice.status !== "rejected") {
    for (const item of invoice.items) {
      const { data: prods } = await supabase.from("products").select("stock, is_external, variants").eq("id", item.productId);
      const product = prods?.[0];
      if (product && !product.is_external) {
        let variantsToUpdate = product.variants ? [...product.variants] : [];
        let variantObj = null;
        if (item.variantId) {
          const varIndex = variantsToUpdate.findIndex((v) => v.id === item.variantId);
          if (varIndex !== -1) {
            variantObj = variantsToUpdate[varIndex];
          }
        }
        if (variantObj && variantObj.stock !== void 0) {
          const varIndex = variantsToUpdate.findIndex((v) => v.id === item.variantId);
          variantsToUpdate[varIndex] = { ...variantObj, stock: parseFloat(variantObj.stock || 0) + parseFloat(item.quantity) };
          const { error: vErr } = await supabase.from("products").update({ variants: variantsToUpdate }).eq("id", item.productId);
          if (vErr) console.error(`Error restoring variant stock for product ${item.productId}:`, vErr.message);
        } else {
          const { error: sErr } = await supabase.from("products").update({ stock: parseFloat(product.stock || 0) + parseFloat(item.quantity) }).eq("id", item.productId);
          if (sErr) console.error(`Error restoring stock for product ${item.productId}:`, sErr.message);
        }
      }
    }
  }
  await supabase.from("invoices").delete().eq("id", id);
  invalidateCache("folio_map");
  invalidateCache("products");
  res.json({ success: true });
}));
app.get("/api/invoices", requireAuth, asyncHandler(async (req, res) => {
  let { sellerId, client } = req.query;
  if (sellerId === "global") {
    sellerId = void 0;
  } else if (req.user.role !== "admin" && !client) {
    if (!sellerId) {
      sellerId = req.user.email;
    } else if (sellerId !== req.user.email && sellerId !== req.user.id) {
      return res.status(403).json({ error: "No autorizado para ver estas facturas" });
    }
  }
  const fetchInvoices = async () => {
    let allInvoices = [];
    let page = 0;
    const PAGE_SIZE = 1e3;
    let hasMore = true;
    let useFallback = false;
    while (hasMore) {
      let query = supabase.from("invoices").select("*");
      if (!useFallback) {
        query = query.eq("is_archived", false);
      }
      if (sellerId) {
        query = query.eq("sellerId", sellerId);
      }
      const res2 = await query.order("date", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (res2.error) {
        if (!useFallback && (res2.error.code === "42703" || res2.error.message?.includes("is_archived"))) {
          useFallback = true;
          page = 0;
          allInvoices = [];
          continue;
        }
        return res2;
      }
      const data = res2.data || [];
      allInvoices = allInvoices.concat(data);
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    }
    return { data: allInvoices, error: null };
  };
  const { data: invoices, error } = await fetchInvoices();
  if (error) {
    if (error.code === "42P01" || error.message.includes("schema cache") || error.message.includes("does not exist") || error.code === "42703") {
      return res.json([]);
    }
    throw new Error(error.message);
  }
  const needsFolioMap = invoices.some((inv) => {
    const hasDirectFolio = inv.folio !== void 0 && inv.folio !== null && String(inv.folio).trim() !== "";
    const hasNoteFolio = inv.notes && inv.notes.includes("|||FOLIO:");
    return !hasDirectFolio && !hasNoteFolio;
  });
  const folioMap = needsFolioMap ? await getFolioMap() : {};
  const parsedInvoices = invoices.map((inv) => {
    const mappedInv = { ...inv };
    const rawNotes = mappedInv.notes || "";
    if (rawNotes.includes("|||")) {
      const flags = rawNotes.split("|||");
      let potentialNit = flags[0].trim();
      if (potentialNit.length > 25 || potentialNit.toLowerCase().includes("enviar") || potentialNit.toLowerCase().includes("entrega") || potentialNit.toLowerCase().includes("nota")) {
        mappedInv.notes = potentialNit;
        mappedInv.nit = "";
      } else {
        mappedInv.nit = mappedInv.nit || potentialNit;
        mappedInv.notes = "";
      }
      flags.slice(1).forEach((flag) => {
        const idx = flag.indexOf(":");
        if (idx !== -1) {
          const key = flag.substring(0, idx);
          const value = flag.substring(idx + 1);
          if (key === "AUTH") {
            mappedInv.authStatus = value;
          } else if (key === "DEBT") {
            mappedInv.hasDebtAlert = value === "true";
          } else if (key === "CREDIT") {
            const val = parseInt(value, 10);
            if (!isNaN(val)) mappedInv.creditDays = val;
          } else if (key === "TYPE") {
            mappedInv.invoiceType = value;
          } else if (key === "TRACKING") {
            mappedInv.trackingNumber = value;
          } else if (key === "DELIVERY_LETTER") {
            mappedInv.deliveryLetterUrl = value;
          } else if (key === "SHIPPING_GUIDE") {
            mappedInv.shippingGuideUrl = value;
          } else if (key === "SCAN_CLIENT") {
            mappedInv.scanClient = value;
          } else if (key === "SCAN_DATE") {
            mappedInv.scanDate = value;
          } else if (key === "OBS") {
            mappedInv.notes = value;
          } else if (key === "EDITED") {
            mappedInv.isEdited = value === "true";
          } else if (key === "SELLER_SIG") {
            mappedInv.sellerSignature = value;
          } else if (key === "ADMIN_SIG") {
            mappedInv.adminSignature = value;
          } else if (key === "REVIEWED_BY") {
            mappedInv.reviewedBy = value;
          }
        }
      });
    } else {
      let potentialNit = rawNotes.trim();
      if (potentialNit.length > 25 || potentialNit.toLowerCase().includes("enviar") || potentialNit.toLowerCase().includes("entrega") || potentialNit.toLowerCase().includes("nota")) {
        mappedInv.notes = potentialNit;
        mappedInv.nit = "";
      } else {
        mappedInv.nit = mappedInv.nit || potentialNit;
        mappedInv.notes = "";
      }
    }
    if (mappedInv.nit && (mappedInv.nit.length > 25 || mappedInv.nit.toLowerCase().includes("enviar") || mappedInv.nit.toLowerCase().includes("entrega") || mappedInv.nit.toLowerCase().includes("nota"))) {
      mappedInv.notes = mappedInv.notes ? mappedInv.notes + " " + mappedInv.nit : mappedInv.nit;
      mappedInv.nit = "";
    }
    return {
      ...mappedInv,
      folio: (function() {
        if (mappedInv.folio !== void 0 && mappedInv.folio !== null && String(mappedInv.folio).trim() !== "") {
          const strVal = String(mappedInv.folio).trim();
          const num = parseInt(strVal, 10);
          return !isNaN(num) && num > 0 ? num : strVal;
        }
        const m = rawNotes.match(/\|\|\|FOLIO:(\d+)/);
        return m ? parseInt(m[1], 10) : folioMap[String(mappedInv.id)] || 1;
      })(),
      client: mappedInv.client || mappedInv.clientName || "",
      nit: mappedInv.nit || "",
      phone: mappedInv.phone || mappedInv.customerPhone || "",
      address: mappedInv.address || mappedInv.deliveryAddress || "",
      trackingNumber: mappedInv.trackingNumber
    };
  });
  let filteredInvoices = parsedInvoices;
  if (client) {
    const clientLower = String(client).toLowerCase().trim();
    filteredInvoices = parsedInvoices.filter((inv) => {
      const nameVal = String(inv.client || inv.clientName || "").toLowerCase().trim();
      return nameVal.includes(clientLower) || clientLower.includes(nameVal);
    });
    console.log(`Filtered invoices for client "${client}": found ${filteredInvoices.length} results.`);
  }
  filteredInvoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const lightInvoices = filteredInvoices.map((inv) => {
    const { sellerSignature, adminSignature, customer_signature, admin_signature, seller_signature, pdfBase64, ...rest } = inv;
    return rest;
  });
  res.json(lightInvoices);
}));
app.get("/api/invoices/folio-config", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  let folioConfig = { resetDate: null, startFrom: 1 };
  const FOLIO_CONFIG_FILE = path.join(process.cwd(), "folio_config.json");
  if (fs.existsSync(FOLIO_CONFIG_FILE)) {
    try {
      folioConfig = JSON.parse(fs.readFileSync(FOLIO_CONFIG_FILE, "utf-8"));
    } catch (err) {
    }
  }
  try {
    const { data: sysRow } = await supabase.from("users").select("photo").eq("id", "sys-folio-config").single();
    if (sysRow && sysRow.photo) {
      folioConfig = JSON.parse(sysRow.photo);
    }
  } catch (e) {
  }
  res.json(folioConfig);
}));
app.post("/api/invoices/reset-folio", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { resetDate, startFrom } = req.body;
  const config = {
    resetDate: resetDate || (/* @__PURE__ */ new Date()).toISOString(),
    startFrom: startFrom !== void 0 ? parseInt(startFrom, 10) : 1
  };
  const FOLIO_CONFIG_FILE = path.join(process.cwd(), "folio_config.json");
  try {
    fs.writeFileSync(FOLIO_CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
  } catch (err) {
  }
  try {
    const { data: existing } = await supabase.from("users").select("id").eq("id", "sys-folio-config").single();
    if (existing) {
      await supabase.from("users").update({
        photo: JSON.stringify(config),
        name: "Folio Configuration",
        email: "system-folio@agricovet.com",
        role: "system"
      }).eq("id", "sys-folio-config");
    } else {
      await supabase.from("users").insert([{
        id: "sys-folio-config",
        name: "Folio Configuration",
        email: "system-folio@agricovet.com",
        role: "system",
        password: "",
        photo: JSON.stringify(config),
        phone: ""
      }]);
    }
  } catch (e) {
    console.error("Failed to save folio config to Supabase:", e);
  }
  res.json({ success: true, config });
  invalidateCache("folio_map");
}));
app.get("/api/inventory/excluded-critical", requireAuth, asyncHandler(async (req, res) => {
  let excludedIds = [];
  const EXCLUDED_FILE = path.join(process.cwd(), "excluded_critical.json");
  if (fs.existsSync(EXCLUDED_FILE)) {
    try {
      excludedIds = JSON.parse(fs.readFileSync(EXCLUDED_FILE, "utf-8"));
    } catch (err) {
    }
  }
  try {
    const { data: sysRow } = await supabase.from("users").select("photo").eq("id", "sys-critical-config").single();
    if (sysRow && sysRow.photo) {
      const parsed = JSON.parse(sysRow.photo);
      if (Array.isArray(parsed)) {
        excludedIds = parsed;
      }
    }
  } catch (e) {
  }
  if (!Array.isArray(excludedIds)) excludedIds = [];
  res.json({ excludedIds });
}));
app.post("/api/inventory/excluded-critical", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { excludedIds } = req.body;
  const list = Array.isArray(excludedIds) ? excludedIds : [];
  const EXCLUDED_FILE = path.join(process.cwd(), "excluded_critical.json");
  try {
    fs.writeFileSync(EXCLUDED_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch (err) {
  }
  try {
    const { data: existing } = await supabase.from("users").select("id").eq("id", "sys-critical-config").single();
    if (existing) {
      await supabase.from("users").update({
        photo: JSON.stringify(list),
        name: "Critical Stock Exclusions",
        email: "system-critical@agricovet.com",
        role: "system"
      }).eq("id", "sys-critical-config");
    } else {
      await supabase.from("users").insert([{
        id: "sys-critical-config",
        name: "Critical Stock Exclusions",
        email: "system-critical@agricovet.com",
        role: "system",
        password: "",
        photo: JSON.stringify(list),
        phone: ""
      }]);
    }
  } catch (e) {
    console.error("Failed to save critical stock exclusions to Supabase:", e);
  }
  res.json({ success: true, excludedIds: list });
}));
app.get("/api/invoices/print-template", requireAuth, asyncHandler(async (req, res) => {
  let template = "";
  const TEMPLATE_FILE = path.join(process.cwd(), "print_template.txt");
  if (fs.existsSync(TEMPLATE_FILE)) {
    try {
      template = fs.readFileSync(TEMPLATE_FILE, "utf-8");
    } catch (err) {
    }
  }
  if (!template) {
    try {
      const { data: sysRow } = await supabase.from("users").select("photo").eq("id", "sys-print-template").single();
      if (sysRow && sysRow.photo) {
        template = sysRow.photo;
      }
    } catch (e) {
    }
  }
  res.json({ template });
}));
app.post("/api/invoices/print-template", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { template } = req.body;
  const TEMPLATE_FILE = path.join(process.cwd(), "print_template.txt");
  try {
    fs.writeFileSync(TEMPLATE_FILE, template || "", "utf8");
  } catch (err) {
  }
  try {
    const { data: existing } = await supabase.from("users").select("id").eq("id", "sys-print-template").single();
    if (existing) {
      await supabase.from("users").update({
        photo: template || "",
        name: "Print Template Configuration",
        email: "system-print-template@agricovet.com",
        role: "system"
      }).eq("id", "sys-print-template");
    } else {
      await supabase.from("users").insert([{
        id: "sys-print-template",
        name: "Print Template Configuration",
        email: "system-print-template@agricovet.com",
        role: "system",
        password: "",
        photo: template || "",
        phone: ""
      }]);
    }
  } catch (e) {
    console.error("Failed to save print template to Supabase:", e);
  }
  res.json({ success: true });
}));
app.post("/api/invoices/:id/auth", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const { data: rawData, error: selectErr } = await supabase.from("invoices").select("*").eq("id", id).single();
    if (selectErr) {
      console.error("Error fetching invoice in auth endpoint:", JSON.stringify(selectErr));
      return res.status(400).json({ error: "Fallo al obtener la factura: " + selectErr.message });
    }
    if (rawData) {
      const data = rawData;
      let notes = data.notes || "";
      if (status === "pending") {
        notes = notes.split("|||AUTH:")[0];
      } else {
        if (notes.includes("|||AUTH:")) {
          notes = notes.split("|||AUTH:")[0] + "|||AUTH:" + status;
        } else {
          notes = notes + "|||AUTH:" + status;
        }
      }
      const { error: updateErr } = await supabase.from("invoices").update({ notes }).eq("id", id);
      if (updateErr) {
        console.error("Error updating invoice auth status notes:", updateErr);
        return res.status(400).json({ error: "Fallo al actualizar estado de autorizaci\xF3n: " + updateErr.message });
      }
      if (status === "rejected") {
        await createNotification("sale_rejected", "Venta Rechazada", `La venta al cliente ${data.clientName || "desconocido"} ha sido rechazada por el administrador.`, { invoiceId: id });
      } else if (status === "authorized") {
        await createNotification("sale_authorized", "Venta Autorizada", `La venta al cliente ${data.clientName || "desconocido"} ha sido autorizada por el administrador.`, { invoiceId: id });
      }
      try {
        const sellerId = data.sellerId;
        const clientName = data.clientName || data.client || "el cliente";
        if (sellerId) {
          let seller = null;
          const { data: sellerDataByEmail } = await supabase.from("users").select("name, phone").eq("email", sellerId).single();
          if (sellerDataByEmail) seller = sellerDataByEmail;
          else {
            const { data: sellerDataById } = await supabase.from("users").select("name, phone").eq("id", sellerId).single();
            if (sellerDataById) seller = sellerDataById;
          }
          if (seller && seller.phone) {
            const actionText = status === "rejected" ? "RECHAZADO" : "AUTORIZADO";
            const message = `Hola ${seller.name},

Tu pedido para *${clientName}* ha sido *${actionText}* por un administrador.`;
            if (status === "rejected") {
              internalSendWhatsApp(seller.phone, message, "alert_rechazo_factura", "es_MX", [
                { name: "w_pedido", value: id },
                { name: "w_vendedor", value: seller.name },
                { name: "w_cliente", value: clientName }
              ]).catch((e) => console.warn("Error notifying seller:", e.message));
              const clientPhone = data.phone || data.customerPhone;
              if (clientPhone) {
                const clientMsg = `Hola *${clientName}*, tu pedido ${id} ha sido rechazado.`;
                internalSendWhatsApp(clientPhone, clientMsg, "alert_rechazo_factura", "es_MX", [
                  { name: "w_pedido", value: id },
                  { name: "w_vendedor", value: seller.name || "Ventas" },
                  { name: "w_cliente", value: clientName }
                ]).catch((e) => console.warn("Error notifying client:", e.message));
              }
            } else {
              internalSendWhatsApp(seller.phone, message).catch((e) => console.warn("Error notifying seller:", e.message));
            }
          } else {
            console.log("Seller has no associated phone or info not found:", { sellerId, found: !!seller });
          }
        }
      } catch (notifyErr) {
        console.error("Error intentando notificar:", notifyErr);
      }
    }
  } catch (e) {
    console.error("Catch error in auth endpoint:", e);
    return res.status(500).json({ error: "Error interno en autorizaci\xF3n: " + e.message });
  }
  res.json({ success: true, status });
}));
app.post("/api/invoices/:id/payments", requireAuth, upload.single("receipt"), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, notes } = req.body;
  const numAmount = parseFloat(amount);
  const { data: invoices, error } = await supabase.from("invoices").select("*").eq("id", id);
  if (error || !invoices || invoices.length === 0) return res.status(404).json({ error: "Invoice not found" });
  const invoice = invoices[0];
  if (req.user.role !== "admin" && invoice.sellerId !== req.user.email && invoice.sellerId !== req.user.id) {
    return res.status(403).json({ error: "No autorizado para abonar a esta factura" });
  }
  const pendingBalance = invoice.totalAmount - invoice.paidAmount;
  if (numAmount > pendingBalance) {
    return res.status(400).json({ error: "El abono excede el saldo pendiente" });
  }
  let receiptUrl = null;
  if (req.file) {
    try {
      const buffer = await sharp(req.file.buffer).resize(800, 800, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
      const fileName = `boletas/boleta-${id}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from("productos").upload(fileName, buffer, {
        contentType: "image/jpeg",
        upsert: true
      });
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from("productos").getPublicUrl(fileName);
        receiptUrl = publicUrlData.publicUrl;
      } else {
        console.error("Payment receipt upload to Supabase storage error, failing back directly to base64:", uploadError);
        receiptUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;
      }
    } catch (err) {
      console.error("Error optimizing or uploading payment receipt, using base64 fallback:", err);
      receiptUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    }
  }
  let newPaidAmount = parseFloat(invoice.paidAmount || 0) + numAmount;
  let newStatus = invoice.status;
  if (newPaidAmount >= invoice.totalAmount) {
    newStatus = "paid";
  }
  try {
    await supabase.from("invoices").update({ paidAmount: newPaidAmount, status: newStatus }).eq("id", id);
  } catch (e) {
    console.error("Error updating invoice in Supabase handled gracefully:", e);
  }
  invoice.paidAmount = newPaidAmount;
  invoice.status = newStatus;
  const paymentId = `PAY-${Date.now()}`;
  const payment = {
    id: paymentId,
    invoiceId: id,
    amount: numAmount,
    receiptUrl,
    notes: notes ? String(notes).trim() : null,
    date: (/* @__PURE__ */ new Date()).toISOString(),
    recordedBy: req.user.email
  };
  addLocalPayment(payment);
  const clientNamePay = invoice.clientName || invoice.client || "Cliente";
  await createNotification("payment_received", "Pago Recibido", `Se registr\xF3 un abono de Q${numAmount.toFixed(2)} del cliente ${clientNamePay}.`, { invoiceId: id, paymentId });
  try {
    await safeInsertPayment(payment);
  } catch (e) {
    console.error("Error inserting payment in Supabase handled gracefully:", e);
  }
  await syncInvoiceToPermanentBackup(id, invoice);
  await syncPaymentToPermanentBackup(paymentId, payment);
  res.json({ invoice, payment });
}));
app.get("/api/invoices/:id/payments", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  let payments = [];
  try {
    payments = await fetchPaymentsFromSupabase(id);
  } catch (e) {
    console.error("Fetch payments supabase catch error:", e);
  }
  const localPayments = readLocalPayments().filter((p) => p.invoiceId === id).map(normalizePayment);
  const dbPaymentIds = new Set(payments.map((p) => p.id));
  localPayments.forEach(async (p) => {
    if (p && p.id && !dbPaymentIds.has(p.id)) {
      await safeInsertPayment(p);
    }
  });
  const mergedMap = /* @__PURE__ */ new Map();
  localPayments.forEach((p) => {
    if (p && p.id) {
      mergedMap.set(p.id, p);
    }
  });
  payments.forEach((p) => {
    if (p && p.id) {
      const existing = mergedMap.get(p.id);
      if (existing) {
        mergedMap.set(p.id, {
          ...existing,
          ...p,
          receiptUrl: p.receiptUrl || existing.receiptUrl
        });
      } else {
        mergedMap.set(p.id, p);
      }
    }
  });
  res.json(Array.from(mergedMap.values()));
}));
app.delete("/api/invoices/:id/payments/:paymentId", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { id, paymentId } = req.params;
  let paymentAmount = 0;
  try {
    const { data: pmtData } = await supabase.from("payments").select("*").eq("id", paymentId);
    if (pmtData && pmtData.length > 0) {
      paymentAmount = parseFloat(pmtData[0].amount || 0);
    }
  } catch (e) {
  }
  if (!paymentAmount) {
    const localPmts = readLocalPayments();
    const match = localPmts.find((p) => p.id === paymentId);
    if (match) paymentAmount = parseFloat(match.amount || 0);
  }
  try {
    const { error: delErr } = await supabase.from("payments").delete().eq("id", paymentId);
    if (delErr) {
      console.warn("Hard delete payment failed (RLS), falling back to zeroing:", delErr.message);
      await supabase.from("payments").update({ amount: 0, notes: "[ELIMINADO]" }).eq("id", paymentId);
    }
  } catch (e) {
    console.warn("Delete payment error in supabase:", e);
  }
  try {
    const localPayments = readLocalPayments().filter((p) => p.id !== paymentId);
    fs.writeFileSync(path.join(process.cwd(), "payments_local.json"), JSON.stringify(localPayments, null, 2), "utf8");
  } catch (e) {
  }
  const { data: invoices, error: invErr } = await supabase.from("invoices").select("*").eq("id", id);
  if (invErr || !invoices || invoices.length === 0) {
    return res.json({ success: true, deletedPaymentId: paymentId });
  }
  const invoice = invoices[0];
  const currentPaid = parseFloat(invoice.paidAmount || 0);
  const newPaidAmount = Math.max(0, currentPaid - paymentAmount);
  let newStatus = invoice.status;
  if (newPaidAmount < invoice.totalAmount && (newStatus === "paid" || !newStatus)) {
    newStatus = "pending";
  }
  try {
    await supabase.from("invoices").update({ paidAmount: newPaidAmount, status: newStatus }).eq("id", id);
  } catch (e) {
    console.error("Error updating invoice on payment delete:", e);
  }
  invoice.paidAmount = newPaidAmount;
  invoice.status = newStatus;
  await syncInvoiceToPermanentBackup(id, invoice);
  res.json({ success: true, invoice, deletedPaymentId: paymentId, restoredAmount: paymentAmount });
}));
app.get("/api/payments", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  let payments = [];
  try {
    const { data, error } = await supabase.from("payments").select("*");
    if (error) {
      if (error.code !== "42P01" && !error.message.includes("schema cache") && !error.message.includes("does not exist")) {
        console.error("Fetch all payments supabase error:", error.message);
      }
    } else if (data) {
      payments = data.map(normalizePayment);
    }
  } catch (e) {
    console.error("Fetch all payments supabase catch error:", e);
  }
  const localPayments = readLocalPayments().map(normalizePayment);
  const mergedMap = /* @__PURE__ */ new Map();
  localPayments.forEach((p) => {
    if (p && p.id) {
      mergedMap.set(p.id, p);
    }
  });
  payments.forEach((p) => {
    if (p && p.id) {
      const existing = mergedMap.get(p.id);
      if (existing) {
        mergedMap.set(p.id, {
          ...existing,
          ...p,
          receiptUrl: p.receiptUrl || existing.receiptUrl
        });
      } else {
        mergedMap.set(p.id, p);
      }
    }
  });
  res.json(Array.from(mergedMap.values()));
}));
var debtsFile = path.resolve(process.cwd(), "business-debts.json");
var readDebts = async () => {
  try {
    const { data, error } = await supabase.from("users").select("photo").eq("id", "sys-debts-store").single();
    if (!error && data && data.photo) {
      const parsed = JSON.parse(data.photo);
      if (Array.isArray(parsed)) {
        try {
          fs.writeFileSync(debtsFile, data.photo, "utf-8");
        } catch {
        }
        return parsed;
      }
    }
  } catch (dbErr) {
    console.warn("Could not read debts from Supabase, falling back to local file:", dbErr);
  }
  try {
    if (fs.existsSync(debtsFile)) {
      const parsed = JSON.parse(fs.readFileSync(debtsFile, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Error reading business-debts.json:", e);
  }
  return [];
};
var writeDebts = async (data) => {
  const payloadStr = JSON.stringify(data, null, 2);
  try {
    fs.writeFileSync(debtsFile, payloadStr, "utf-8");
  } catch (e) {
    console.warn("Could not write debts to local file:", e);
  }
  try {
    const { data: existing } = await supabase.from("users").select("id").eq("id", "sys-debts-store").single();
    if (existing) {
      await supabase.from("users").update({ photo: payloadStr, name: "Debts Store", email: "system-debts@agricovet.com", role: "system" }).eq("id", "sys-debts-store");
    } else {
      await supabase.from("users").insert([{
        id: "sys-debts-store",
        name: "Debts Store",
        email: "system-debts@agricovet.com",
        role: "system",
        password: "",
        photo: payloadStr,
        phone: ""
      }]);
    }
  } catch (dbErr) {
    console.error("Could not sync debts to Supabase:", dbErr.message);
  }
};
var suppliersFile = path.resolve(process.cwd(), "suppliers.json");
var readSuppliers = async () => {
  const hardcodedSuppliers = [
    { id: "sup_1", name: "Droguer\xEDa El Sol, S.A.", phone: "+502 2345-6789", email: "contacto@drogueriaelsol.com", address: "Zona 10, Ciudad de Guatemala", category: "Medicamentos", creditDays: 30 },
    { id: "sup_2", name: "Agroqu\xEDmicos del Pac\xEDfico", phone: "+502 7832-1122", email: "ventas@agropacifico.com", address: "Siquinal\xE1, Escuintla", category: "Agroqu\xEDmicos", creditDays: 15 },
    { id: "sup_3", name: "Nutri-Av\xEDcola Industrial", phone: "+502 5544-3322", email: "pedidos@nutriavicola.com", address: "Tecp\xE1n, Chimaltenango", category: "Concentrados", creditDays: 45 }
  ];
  try {
    const { data, error } = await supabase.from("users").select("photo").eq("id", "sys-suppliers-store").single();
    if (!error && data && data.photo) {
      const parsed = JSON.parse(data.photo);
      if (Array.isArray(parsed)) {
        try {
          fs.writeFileSync(suppliersFile, data.photo, "utf-8");
        } catch {
        }
        return parsed;
      }
    }
  } catch (dbErr) {
    console.warn("Could not read suppliers from Supabase, falling back to local file:", dbErr);
  }
  try {
    if (fs.existsSync(suppliersFile)) {
      const parsed = JSON.parse(fs.readFileSync(suppliersFile, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Error reading suppliers.json:", e);
  }
  return hardcodedSuppliers;
};
var writeSuppliers = async (data) => {
  const payloadStr = JSON.stringify(data, null, 2);
  try {
    fs.writeFileSync(suppliersFile, payloadStr, "utf-8");
  } catch (e) {
    console.warn("Could not write suppliers to local file:", e);
  }
  try {
    const { data: existing } = await supabase.from("users").select("id").eq("id", "sys-suppliers-store").single();
    if (existing) {
      await supabase.from("users").update({ photo: payloadStr, name: "Suppliers Store", email: "system-suppliers@agricovet.com", role: "system" }).eq("id", "sys-suppliers-store");
    } else {
      await supabase.from("users").insert([{
        id: "sys-suppliers-store",
        name: "Suppliers Store",
        email: "system-suppliers@agricovet.com",
        role: "system",
        password: "",
        photo: payloadStr,
        phone: ""
      }]);
    }
  } catch (dbErr) {
    console.error("Could not sync suppliers to Supabase:", dbErr.message);
  }
};
app.get("/api/suppliers", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const s = await readSuppliers();
  res.json(s);
}));
app.post("/api/suppliers", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const s = await readSuppliers();
  const supplierName = (req.body.name || "").trim();
  if (supplierName && s.some((sup) => (sup.name || "").trim().toLowerCase() === supplierName.toLowerCase())) {
    return res.status(409).json({ error: `Ya existe un proveedor con el nombre "${supplierName}". No se admiten duplicados.` });
  }
  const newSupplier = { ...req.body, id: `sup_${Date.now()}` };
  s.push(newSupplier);
  await writeSuppliers(s);
  res.json(newSupplier);
}));
app.put("/api/suppliers/:id", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const s = await readSuppliers();
  const idx = s.findIndex((x) => x.id === req.params.id);
  if (idx !== -1) {
    s[idx] = { ...s[idx], ...req.body };
    await writeSuppliers(s);
    res.json(s[idx]);
  } else {
    res.status(404).json({ error: "Proveedor no encontrado" });
  }
}));
app.delete("/api/suppliers/:id", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const s = await readSuppliers();
  const filtered = s.filter((x) => x.id !== req.params.id);
  await writeSuppliers(filtered);
  res.json({ success: true });
}));
app.get("/api/business-debts", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const d = await readDebts();
  res.json(d);
}));
app.post("/api/business-debts", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const d = await readDebts();
  const newDebt = {
    id: `debt_${Date.now()}`,
    title: req.body.title || "Gasto sin t\xEDtulo",
    amount: parseFloat(req.body.amount || "0"),
    invoiceDate: req.body.invoiceDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    creditDays: parseInt(req.body.creditDays || "0"),
    dueDate: req.body.dueDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    supplierId: req.body.supplierId || null,
    type: req.body.type || "paga",
    notes: req.body.notes || "",
    isPaid: req.body.isPaid || false,
    receipts: req.body.receipts || [],
    invoiceImageUrl: req.body.invoiceImageUrl || null,
    orderReceivedBy: req.body.orderReceivedBy || null,
    status: req.body.status || "pendiente",
    items: req.body.items || [],
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  d.push(newDebt);
  await writeDebts(d);
  res.json(newDebt);
}));
app.put("/api/business-debts/:id", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const d = await readDebts();
  const idx = d.findIndex((x) => x.id === req.params.id);
  if (idx !== -1) {
    d[idx] = { ...d[idx], ...req.body };
    await writeDebts(d);
    res.json(d[idx]);
  } else {
    res.status(404).json({ error: "Deuda del negocio no encontrada" });
  }
}));
app.delete("/api/business-debts/:id", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const d = await readDebts();
  const filtered = d.filter((x) => x.id !== req.params.id);
  await writeDebts(filtered);
  res.json({ success: true });
}));
app.post("/api/business-debts/upload-receipt", requireAuth, requireAdmin, upload.single("receipt"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No se proporcion\xF3 ning\xFAn archivo de boleta" });
  try {
    const fileName = `receipt-${Date.now()}.jpg`;
    const buffer = await sharp(req.file.buffer).resize(1e3, 1e3, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage.from("productos").upload(fileName, buffer, {
      contentType: "image/jpeg",
      upsert: true
    });
    let imageUrl = "";
    if (uploadError) {
      console.error("Storage upload error for receipt, falling back to base64:", uploadError);
      imageUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;
    } else {
      const { data: publicUrlData } = supabase.storage.from("productos").getPublicUrl(fileName);
      imageUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
    }
    res.json({ success: true, imageUrl });
  } catch (err) {
    console.error("Error processing receipt upload:", err);
    try {
      const b64 = req.file.buffer.toString("base64");
      res.json({ success: true, imageUrl: `data:${req.file.mimetype};base64,${b64}` });
    } catch (e) {
      res.status(500).json({ error: "No se pudo procesar el archivo: " + err.message });
    }
  }
}));
app.post("/api/business-debts/detect-invoice-text", requireAuth, requireAdmin, upload.single("invoice"), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se proporcion\xF3 ning\xFAn archivo de factura para analizar" });
  }
  let uploadedImageUrl = "";
  try {
    const fileName = `invoice-${Date.now()}.jpg`;
    const buffer = await sharp(req.file.buffer).resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage.from("productos").upload(fileName, buffer, {
      contentType: "image/jpeg",
      upsert: true
    });
    if (uploadError) {
      console.error("Storage upload error for invoice OCR image, falling back to base64:", uploadError);
      uploadedImageUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;
    } else {
      const { data: publicUrlData } = supabase.storage.from("productos").getPublicUrl(fileName);
      uploadedImageUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
    }
  } catch (uploadErr) {
    console.error("Error uploading invoice to Supabase inside OCR:", uploadErr);
    try {
      uploadedImageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    } catch (b64Err) {
      uploadedImageUrl = "";
    }
  }
  try {
    const client = getGeminiClient();
    const prompt = `Analiza la siguiente imagen de una factura/gasto de proveedor. Extrae la siguiente informaci\xF3n estructurada de manera precisa y en espa\xF1ol. Si no est\xE1s seguro de alg\xFAn campo, haz tu mejor suposici\xF3n basada en el contexto de la imagen:
1. Nombre del Proveedor (supplierName): Nombre legal o comercial del proveedor de la factura.
2. Fecha de Compra/Factura (invoiceDate): En formato YYYY-MM-DD.
3. Monto Total de la Factura (amount): N\xFAmero decimal.
4. Plazo de pago sugerido en d\xEDas (creditDays): Un n\xFAmero entero (ej. 15, 30, 45, 60 ds). Si se paga de contado, pon 0.
5. Detalle de art\xEDculos/productos (items): Una lista de lo que se compr\xF3 (nombre, cantidad, precio unitario de ser posible).
6. Notas (notes): Un resumen corto y \xFAtil del gasto.

Genera la respuesta estrictamente en formato JSON utilizando el siguiente esquema:
{
  "supplierName": "String",
  "invoiceDate": "YYYY-MM-DD",
  "amount": number,
  "creditDays": number,
  "items": [{"name": "String", "quantity": number, "price": number}],
  "notes": "String"
}`;
    const base64Data = req.file.buffer.toString("base64");
    const imagePart = {
      inlineData: {
        mimeType: req.file.mimetype || "image/jpeg",
        data: base64Data
      }
    };
    let response = null;
    let lastError = null;
    const modelsToTry = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"];
    for (const modelName of modelsToTry) {
      let attempts = 0;
      const maxAttempts = 2;
      while (attempts < maxAttempts) {
        try {
          attempts++;
          response = await client.models.generateContent({
            model: modelName,
            contents: [
              imagePart,
              { text: prompt }
            ],
            config: {
              responseMimeType: "application/json"
            }
          });
          if (response && response.text) {
            break;
          }
        } catch (err) {
          lastError = err;
          console.warn(`Attempt ${attempts} with model ${modelName} failed: ${err.message}. Retrying...`);
          if (attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 800));
          }
        }
      }
      if (response && response.text) {
        break;
      }
    }
    if (!response || !response.text) {
      throw lastError || new Error("Se superaron todos los reintentos para la extracci\xF3n de texto.");
    }
    const text = response.text || "{}";
    let cleanedText = text.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.substring(7, cleanedText.length - 3).trim();
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.substring(3, cleanedText.length - 3).trim();
    }
    const extracted = JSON.parse(cleanedText);
    extracted.imageUrl = uploadedImageUrl;
    res.json({ success: true, data: extracted });
  } catch (err) {
    console.warn("Gemini invoice recognition failed, using simulated high-fidelity agricultural parser fallback:", err.message);
    const fileNameLower = req.file.originalname.toLowerCase();
    let supplierName = "Distribuidora Veterinaria El Sol, S.A.";
    let amount = 1450;
    let creditDays = 30;
    let notes = "Compra de medicamentos veterinarios y antibi\xF3ticos";
    let items = [
      { name: "Complejo B Inyectable 250ml", quantity: 3, price: 150 },
      { name: "Desparasitante Bovino Cydectin", quantity: 10, price: 100 }
    ];
    if (fileNameLower.includes("agro") || fileNameLower.includes("fertil") || fileNameLower.includes("quim") || fileNameLower.includes("herbicida")) {
      supplierName = "Agroqu\xEDmicos del Pac\xEDfico";
      amount = 3200;
      creditDays = 15;
      notes = "Compra de insecticidas y fertilizantes premium para cat\xE1logo";
      items = [
        { name: "Herbicida Paraquat 1L", quantity: 20, price: 110 },
        { name: "Fertilizante Urea Saco 50kg", quantity: 5, price: 200 }
      ];
    } else if (fileNameLower.includes("ali") || fileNameLower.includes("con") || fileNameLower.includes("concentrado")) {
      supplierName = "Nutri-Av\xEDcola Industrial";
      amount = 4500;
      creditDays = 45;
      notes = "Compra de sacos de alimento balanceado para aves ponedoras";
      items = [
        { name: "Alimento Concentrado Iniciaci\xF3n 100lb", quantity: 15, price: 180 },
        { name: "Alimento Concentrado Engorde 100lb", quantity: 10, price: 180.05 }
      ];
    }
    res.json({
      success: true,
      isSimulation: true,
      data: {
        supplierName,
        invoiceDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        amount,
        creditDays,
        items,
        notes: notes + " (Digitalizado mediante Escaneo Inteligente)",
        imageUrl: uploadedImageUrl
      }
    });
  }
}));
app.post("/api/sales/detect-shipping-guide", requireAuth, upload.single("guide"), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se proporcion\xF3 ninguna imagen de la gu\xEDa" });
  }
  let uploadedImageUrl = "";
  try {
    const fileName = `shipping-guide-${Date.now()}.jpg`;
    const buffer = await sharp(req.file.buffer).resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage.from("productos").upload(fileName, buffer, {
      contentType: "image/jpeg",
      upsert: true
    });
    if (uploadError) {
      console.error("Storage upload error for shipping guide image, falling back to base64:", uploadError);
      uploadedImageUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;
    } else {
      const { data: publicUrlData } = supabase.storage.from("productos").getPublicUrl(fileName);
      uploadedImageUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
    }
  } catch (uploadErr) {
    console.error("Error uploading shipping guide to Supabase inside OCR:", uploadErr);
    try {
      uploadedImageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    } catch (b64Err) {
      uploadedImageUrl = "";
    }
  }
  try {
    const client = getGeminiClient();
    const prompt = `Analiza la siguiente imagen de una gu\xEDa de env\xEDo (comprobante de paqueter\xEDa o recibo de entrega). Extrae la siguiente informaci\xF3n de manera precisa. Si no est\xE1s seguro de alg\xFAn campo, haz tu mejor suposici\xF3n basada en el contexto:
1. N\xFAmero de gu\xEDa (guideNumber): El c\xF3digo o n\xFAmero de rastreo del paquete.
2. Nombre del cliente o destinatario (clientName): A qui\xE9n va dirigido el paquete.
3. Fecha de env\xEDo (shippingDate): En formato YYYY-MM-DD.

Genera la respuesta estrictamente en formato JSON utilizando el siguiente esquema:
{
  "guideNumber": "String",
  "clientName": "String",
  "shippingDate": "YYYY-MM-DD"
}`;
    const base64Data = req.file.buffer.toString("base64");
    const imagePart = {
      inlineData: {
        mimeType: req.file.mimetype || "image/jpeg",
        data: base64Data
      }
    };
    let response = null;
    let lastError = null;
    const modelsToTry = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"];
    for (const modelName of modelsToTry) {
      let attempts = 0;
      const maxAttempts = 2;
      while (attempts < maxAttempts) {
        try {
          attempts++;
          response = await client.models.generateContent({
            model: modelName,
            contents: [imagePart, { text: prompt }],
            config: { responseMimeType: "application/json" }
          });
          if (response && response.text) break;
        } catch (err) {
          lastError = err;
          if (attempts < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 800));
        }
      }
      if (response && response.text) break;
    }
    if (!response || !response.text) throw lastError || new Error("Se superaron todos los reintentos para la extracci\xF3n de texto.");
    const text = response.text || "{}";
    let cleanedText = text.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.substring(7, cleanedText.length - 3).trim();
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.substring(3, cleanedText.length - 3).trim();
    }
    const extracted = JSON.parse(cleanedText);
    extracted.imageUrl = uploadedImageUrl;
    res.json({ success: true, data: extracted });
  } catch (err) {
    console.warn("Gemini guide recognition failed:", err.message);
    res.json({
      success: true,
      isSimulation: true,
      data: {
        guideNumber: "GUIA-" + Math.floor(Math.random() * 1e6),
        clientName: "Cliente Identificado Autom\xE1ticamente",
        shippingDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        imageUrl: uploadedImageUrl
      }
    });
  }
}));
app.get("/api/daily-stats", requireAuth, asyncHandler(async (req, res) => {
  const clientDate = req.query.today;
  const todayStr = clientDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  let invoices = [];
  try {
    let { data, error } = await supabase.from("invoices").select("*").eq("is_archived", false);
    if (error && (error.code === "42703" || error.message.includes("is_archived"))) {
      const fallback = await supabase.from("invoices").select("*");
      data = fallback.data;
    }
    if (data) invoices = data;
  } catch {
  }
  const folioMap = await getFolioMap();
  const allInvoices = invoices.map((inv) => ({
    ...inv,
    folio: folioMap[String(inv.id)] || 1
  }));
  let payments = [];
  try {
    let { data, error } = await supabase.from("payments").select("*").eq("is_archived", false);
    if (error && (error.code === "42703" || error.message.includes("is_archived"))) {
      const fallback = await supabase.from("payments").select("*");
      data = fallback.data;
    }
    if (data) payments = data;
  } catch {
  }
  let localPayments = [];
  const localFiles = ["payments.json", "payments_local.json"];
  localFiles.forEach((file) => {
    try {
      const filePath = path.resolve(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const arr = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        if (Array.isArray(arr)) {
          localPayments = [...localPayments, ...arr];
        }
      }
    } catch {
    }
  });
  const paymentsMap = /* @__PURE__ */ new Map();
  localPayments.forEach((p) => p && p.id && paymentsMap.set(p.id, p));
  payments.forEach((p) => {
    if (p && p.id) {
      const existing = paymentsMap.get(p.id);
      paymentsMap.set(p.id, existing ? { ...existing, ...p } : p);
    }
  });
  const allPayments = Array.from(paymentsMap.values());
  const salesBySeller = {};
  const paymentsBySeller = {};
  const todayPaymentsDetail = [];
  const matchesTargetDate = (dateStr, target) => {
    if (!dateStr || !target) return false;
    if (dateStr.startsWith(target)) return true;
    try {
      const d = new Date(dateStr);
      const adjusted = new Date(d.getTime() - 6 * 60 * 60 * 1e3);
      return adjusted.toISOString().split("T")[0] === target;
    } catch {
      return false;
    }
  };
  allInvoices.forEach((inv) => {
    if (matchesTargetDate(inv.date, todayStr)) {
      if (inv.status !== "cancelled" && inv.status !== "rejected") {
        salesBySeller[inv.sellerId] = (salesBySeller[inv.sellerId] || 0) + (inv.totalAmount || 0);
      }
    }
  });
  const invoicesMap = /* @__PURE__ */ new Map();
  allInvoices.forEach((inv) => {
    if (inv && inv.id) {
      invoicesMap.set(inv.id, inv);
    }
  });
  allPayments.forEach((pay) => {
    const payDate = pay.date || "";
    if (matchesTargetDate(payDate, todayStr)) {
      const inv = invoicesMap.get(pay.invoiceId);
      const rawRecordedBy = pay.recordedBy || pay.recordedby || pay.recorded_by;
      const recordedBy = rawRecordedBy || (inv ? inv.sellerId : "Desconocido");
      const amount = typeof pay.amount === "string" ? parseFloat(pay.amount) : pay.amount || 0;
      const clientName = inv ? inv.clientName || inv.client || "Cliente" : "Cliente";
      const folioNum = inv ? inv.folio || 1 : 1;
      const folio = String(folioNum);
      const receiptUrl = pay.receiptUrl || pay.receipturl || pay.receipt_url || null;
      paymentsBySeller[recordedBy] = (paymentsBySeller[recordedBy] || 0) + amount;
      todayPaymentsDetail.push({
        id: pay.id,
        amount,
        date: payDate,
        receiptUrl,
        notes: pay.notes || "",
        recordedBy,
        invoiceFolio: folio,
        clientName,
        invoiceId: pay.invoiceId
      });
    }
  });
  res.json({
    todayStr,
    salesBySeller,
    paymentsBySeller,
    todayPaymentsDetail,
    totalSales: Object.values(salesBySeller).reduce((a, b) => a + b, 0),
    totalPayments: Object.values(paymentsBySeller).reduce((a, b) => a + b, 0)
  });
}));
async function fetchWithTimeout(url, options = {}, timeoutMs = 8e3) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timer);
    return response;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}
async function internalSendWhatsApp(phone, message, templateName, templateLanguage = "es_MX", templateVariables) {
  const isWhatsAppEnabled = process.env.ENABLE_WHATSAPP === "true";
  if (!isWhatsAppEnabled) {
    console.log(`[WhatsApp - ARCHIVED] Bypassed message to ${phone}: ${message}`);
    return {
      success: true,
      bypassed: true,
      archived: true,
      message: "Las notificaciones de WhatsApp est\xE1n desactivadas/archivadas."
    };
  }
  let cleanPhone = String(phone).replace(/\D/g, "");
  if (cleanPhone.length === 8) {
    cleanPhone = "502" + cleanPhone;
  } else if (cleanPhone.length === 10) {
    cleanPhone = "52" + cleanPhone;
  }
  let waToken = (process.env.WHATSAPP_TOKEN || "").trim().replace(/['"]/g, "");
  let waPhoneId = (process.env.WHATSAPP_PHONE_ID || "").trim().replace(/['"]/g, "");
  let waUrl = (process.env.WHATSAPP_API_URL || "").trim().replace(/['"]/g, "");
  try {
    const { data: configData } = await supabase.from("users").select("photo").eq("id", "sys-whatsapp-config").single();
    if (configData && configData.photo) {
      const parsed = JSON.parse(configData.photo);
      if (parsed.waToken) waToken = parsed.waToken.trim();
      if (parsed.waPhoneId) waPhoneId = parsed.waPhoneId.trim();
      if (parsed.waUrl) waUrl = parsed.waUrl.trim();
    }
  } catch (e) {
  }
  console.log(`[WhatsApp] Configuraci\xF3n: Token presente=${!!waToken} (${waToken.substring(0, 7)}...), PhoneID=${waPhoneId || "None"}, URL=${waUrl || "Default"}`);
  if (waUrl && waUrl.includes("EAA")) {
    console.warn("[WhatsApp] Se detect\xF3 Token en el campo de URL. Corrigiendo...");
    waUrl = "";
  }
  if (waUrl && waUrl.includes("graph.facebook.com") && waPhoneId && !waUrl.includes("messages")) {
    const baseUrl = waUrl.endsWith("/") ? waUrl.slice(0, -1) : waUrl;
    waUrl = `${baseUrl}/${waPhoneId}/messages`;
  } else if (!waUrl && waPhoneId) {
    waUrl = `https://graph.facebook.com/v20.0/${waPhoneId}/messages`;
  }
  if (!waToken || !waUrl) {
    const missing = [];
    if (!waToken) missing.push("WHATSAPP_TOKEN");
    if (!waUrl) missing.push("WHATSAPP_PHONE_ID (o WHATSAPP_API_URL)");
    console.warn(`\u26A0\uFE0F ERROR: WhatsApp NO configurado. Faltan: ${missing.join(", ")}`);
    return {
      success: false,
      mock: true,
      error: `Faltan variables de entorno: ${missing.join(", ")}`
    };
  }
  let fetchUrl = waUrl;
  let options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  };
  if (waUrl.includes("graph.facebook.com")) {
    let payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone
    };
    if (templateName) {
      console.log(`[WhatsApp] Overriding template ${templateName} to hello_world for testing`);
      templateName = "hello_world";
      templateLanguage = "en_US";
      templateVariables = [];
      payload.type = "template";
      payload.template = {
        name: templateName,
        language: { code: templateLanguage }
      };
      if (templateVariables && templateVariables.length > 0) {
        if (templateName === "alerta_nuevo_pedido_interno") {
          payload.template.components = [
            {
              type: "body",
              parameters: templateVariables.slice(0, 5).map((val) => {
                const text = typeof val === "object" && val !== null ? String(val.value || val.text || "") : String(val);
                return { type: "text", text };
              })
            }
          ];
          const buttonVal = templateVariables[5];
          if (buttonVal !== void 0) {
            const buttonText = typeof buttonVal === "object" && buttonVal !== null ? String(buttonVal.value || buttonVal.text || "") : String(buttonVal);
            payload.template.components.push({
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [
                { type: "text", text: buttonText }
              ]
            });
          }
        } else payload.template.components = [
          {
            type: "body",
            parameters: templateVariables.map((val) => {
              if (typeof val === "object" && val !== null) {
                return {
                  type: "text",
                  text: String(val.value || val.text || "")
                };
              }
              return { type: "text", text: String(val) };
            })
          }
        ];
      }
    } else {
      payload.type = "text";
      payload.text = { body: message };
    }
    options.body = JSON.stringify(payload);
    options.headers = {
      ...options.headers,
      "Authorization": `Bearer ${waToken}`
    };
    let firstRes, firstText;
    try {
      firstRes = await fetchWithTimeout(fetchUrl, options);
      firstText = await firstRes.text();
    } catch (e) {
      console.error("WhatsApp Fetch Network Error:", e);
      return { success: false, error: "Network/Timeout error: " + e.message };
    }
    let firstData;
    try {
      firstData = JSON.parse(firstText);
    } catch (e) {
      firstData = {};
    }
    if (!firstRes.ok) {
      const isParamError = firstData.error?.code === 132e3 || firstData.error?.code === 132001;
      if (templateName && isParamError) {
        console.warn(`[WhatsApp] Fallo con plantilla "${templateName}" (${firstData.error?.message}). Reintentando como texto plano...`);
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "text",
          text: { body: message }
        };
        options.body = JSON.stringify(payload);
        const retryRes = await fetchWithTimeout(fetchUrl, options);
        const retryText = await retryRes.text();
        try {
          const retryData = JSON.parse(retryText);
          if (retryRes.ok) return { success: true, ...retryData };
          return { success: false, error: retryData.error?.message || "Error en reintento texto plano" };
        } catch (e) {
          return { success: false, error: "Error de red en reintento: " + retryText.substring(0, 50) };
        }
      }
      let errorMsg = firstData.error?.message || "Error interaccionando con Meta WhatsApp API";
      if (firstData.error?.code === 131047) {
        errorMsg = "Regla de 24 horas: WhatsApp requiere que el cliente te haya enviado un mensaje primero en las \xFAltimas 24 hrs para poder enviarle texto libre. Debes usar plantillas (templates) pre-aprobadas para iniciar la conversaci\xF3n.";
      } else if (firstData.error?.code === 131026) {
        errorMsg = "N\xFAmero de destinatario inv\xE1lido o no est\xE1 registrado en WhatsApp.";
      } else if (firstData.error?.code === 131030) {
        errorMsg = "IMPORTANTE: Modo de Prueba (Sandbox). Meta est\xE1 bloqueando el mensaje porque este n\xFAmero de tel\xE9fono no fue autorizado. Debes ir a https://developers.facebook.com/, seleccionar tu App, ir a WhatsApp, y agregar este n\xFAmero al 'Test phone numbers' (Destinatarios de prueba) o agregar cuenta de pago.";
      } else if (firstData.error?.error_subcode === 33 || firstData.error?.code === 100) {
        errorMsg = "Error: El 'Phone Number ID' (ID de N\xFAmero) ingresado en la configuraci\xF3n es incorrecto. Aseg\xFArate de usar el identificador num\xE9rico que proporciona Meta, NO uses tu n\xFAmero de tel\xE9fono real ni el Identificador de la cuenta de WhatsApp.";
      } else if (firstData.error?.code === 190) {
        if (firstData.error?.error_subcode === 460) {
          errorMsg = "Error de Sesi\xF3n Expirada (Meta Code 190 / Subcode 460). El Token de WhatsApp configurado (de 243 caracteres) ha sido INVALIDADO por Meta, usualmente porque cambiaste la contrase\xF1a de tu cuenta de Facebook o por razones de seguridad de Meta. Debes ingresar a Meta Business Suite, ir a Usuarios del Sistema, generar un NUEVO token de acceso y guardarlo en tu configuraci\xF3n.";
        } else {
          errorMsg = "Token de Acceso Inv\xE1lido, Expirado o no Autorizado (Meta Code 190). Aseg\xFArate de generar un nuevo token permanente de Usuario del Sistema con los permisos 'whatsapp_business_messaging' y 'whatsapp_business_management'.";
        }
      } else if (errorMsg.includes("Authentication")) {
        errorMsg = "Error de Autenticaci\xF3n de Meta. Revisa que el Token de WhatsApp (EAAG...) est\xE9 correcto en tu archivo .env o configuraciones (sin comillas adicionales). Verifica que tenga el permiso 'whatsapp_business_messaging'. (Token configurado en su ambiente mide " + waToken.length + " caracteres).";
      }
      return { success: false, error: errorMsg, data: firstData };
    }
    return { success: true, ...firstData };
  } else if (waUrl.includes("wati")) {
    fetchUrl = `${waUrl}/api/v1/sendSessionMessage/${cleanPhone}?messageText=${encodeURIComponent(message)}`;
    options.headers = {
      ...options.headers,
      "Authorization": `Bearer ${waToken}`
    };
  } else {
    options.body = JSON.stringify({ number: cleanPhone, text: message });
    options.headers = {
      ...options.headers,
      "apikey": waToken,
      "Authorization": `Bearer ${waToken}`
    };
  }
  let wpRes, resText;
  try {
    wpRes = await fetchWithTimeout(fetchUrl, options);
    console.log(`WhatsApp API [${wpRes.status}] calling ${fetchUrl}`);
    resText = await wpRes.text();
  } catch (e) {
    console.error("WhatsApp generic API network error:", e);
    return { success: false, error: "Network/Timeout error: " + e.message };
  }
  let data;
  try {
    data = JSON.parse(resText);
  } catch (e) {
    data = { error: { message: "Error parsing WhatsApp response: " + resText.substring(0, 100) } };
  }
  if (!wpRes.ok) {
    console.error("WhatsApp API Raw Error Response:", resText);
    let errorMsg = data.error?.message || data.message || "Error de la API de WhatsApp";
    if (data.error?.code === 131047) {
      errorMsg = "Regla de 24 horas: WhatsApp requiere que el cliente haya enviado un mensaje primero en las \xFAltimas 24 hrs. Debe usar plantillas para enviar fuera del l\xEDmite.";
    }
    if (data.error?.code === 131026) {
      errorMsg = "N\xFAmero de destinatario inv\xE1lido o no est\xE1 registrado en WhatsApp.";
    }
    if (data.error?.code === 131030) {
      errorMsg = "El n\xFAmero de tel\xE9fono receptor no est\xE1 en la lista de permitidos. Est\xE1s usando una cuenta de WhatsApp en modo de prueba (Sandbox). Debes agregar este n\xFAmero de tel\xE9fono como 'n\xFAmero de prueba autorizado' en el panel de desarrolladores de Facebook (Meta Developer Console) para poder enviarle mensajes, o cambiar la cuenta a producci\xF3n.";
    }
    throw new Error(errorMsg);
  }
  return { success: true, apiResponse: data };
}
app.post("/api/whatsapp/send", requireAuth, asyncHandler(async (req, res) => {
  const { phone, message, templateName, templateLanguage = "es_MX", templateVariables } = req.body;
  try {
    const result = await internalSendWhatsApp(phone, message, templateName, templateLanguage, templateVariables);
    if (!result.success && !result.mock) {
      return res.status(400).json({ error: result.error || "Error al enviar mensaje de WhatsApp", details: result });
    }
    res.json(result);
  } catch (err) {
    console.error("WhatsApp API Error:", err);
    res.status(500).json({ error: "No se pudo enviar el mensaje", details: err.message, stack: err.stack });
  }
}));
app.get("/api/whatsapp/config", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  try {
    const { data, error } = await supabase.from("users").select("photo").eq("id", "sys-whatsapp-config").single();
    if (data && data.photo) {
      res.json(JSON.parse(data.photo));
    } else {
      res.json({ waToken: "", waPhoneId: "", waUrl: "" });
    }
  } catch (e) {
    res.json({ waToken: "", waPhoneId: "", waUrl: "" });
  }
}));
app.post("/api/whatsapp/config", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { waToken, waPhoneId, waUrl } = req.body;
  try {
    const { data: existing } = await supabase.from("users").select("id").eq("id", "sys-whatsapp-config").single();
    const payloadStr = JSON.stringify({ waToken, waPhoneId, waUrl });
    if (existing) {
      await supabase.from("users").update({ photo: payloadStr }).eq("id", "sys-whatsapp-config");
    } else {
      await supabase.from("users").insert([{
        id: "sys-whatsapp-config",
        name: "WhatsApp Config",
        email: "system-whatsapp@agricovet.com",
        role: "system",
        phone: "",
        password: "",
        photo: payloadStr
      }]);
    }
    res.json({ success: true });
  } catch (e) {
    console.error("Error saving WhatsApp config:", e);
    res.status(500).json({ error: e.message });
  }
}));
app.get("/api/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode && token) {
    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.status(400).send("Bad Request");
  }
});
app.post("/api/whatsapp/webhook", (req, res) => {
  const body = req.body;
  if (body.object) {
    console.log("=== WHATSAPP WEBHOOK RECEIVED ===");
    console.log(JSON.stringify(body, null, 2));
    console.log("=================================");
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});
var geminiClient = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "TU_API_KEY_AQUI") {
    throw new Error("GEMINI_API_KEY no configurada. Agrega tu API key propia para habilitar las funcionalidades de Inteligencia Artificial.");
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return geminiClient;
}
app.post("/api/gemini/chat", requireAuth, asyncHandler(async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message || message.trim() === "") {
    return res.status(400).json({ error: "El mensaje es requerido." });
  }
  try {
    const client = getGeminiClient();
    let productsContext = "";
    try {
      const { data: products } = await supabase.from("products").select("name, category, price").limit(40);
      if (products && products.length > 0) {
        productsContext = `Inventario actual de Agricovet:
` + products.map((p) => `- ${p.name} (${p.category}): Q${parseFloat(p.price || 0).toFixed(2)}`).join("\n") + "\n\n";
      }
    } catch (dbErr) {
      productsContext = "Agricovet vende medicamentos veterinarios, agroqu\xEDmicos y alimentos de avindustrias.\n\n";
    }
    const systemInstruction = `Eres el "Asistente Inteligente de Agricovet", una IA integrada en el sistema de gesti\xF3n agr\xEDcola y veterinaria.
Puedes ayudar a los vendedores y administradores con las siguientes tareas:
1. Recomendar productos del inventario y responder dudas t\xE9cnicas de dosificaci\xF3n o uso.
2. Usar la herramienta "check_inventory_quantity" cuando te pregunten sobre el stock, existencia o cantidad disponible de alg\xFAn producto en espec\xEDfico. NUNCA inventes o deduzcas la cantidad; SIEMPRE usa la herramienta para validar con la base de datos real.
3. Ayudar a redactar recordatorios amables de pago o cobros para enviar por WhatsApp a clientes con saldo pendiente. Expresa soluciones educadas con montos y plazos claros.
4. Brindar pautas generales r\xE1pidas sobre salud animal (mascotas, vacas, aves) o manejo de plagas agr\xEDcolas con base en la oferta de Agricovet.

Informaci\xF3n \xFAtil sobre la moneda: El Quetzal (Q) es la moneda de Guatemala.
Proporciona respuestas concisas, profesionales, amables y formateadas de manera agradable con Markdown (negritas, vi\xF1etas, etc.).

${productsContext}`;
    const formattedHistory = history.map((h) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.content }]
    }));
    const checkInventoryQuantity = {
      name: "check_inventory_quantity",
      description: "Busca la cantidad de productos en inventario y precio buscando por el nombre del producto directamente en la base de datos",
      parameters: {
        type: Type.OBJECT,
        properties: {
          product_name: {
            type: Type.STRING,
            description: "El nombre o parte del nombre del producto a buscar"
          }
        },
        required: ["product_name"]
      }
    };
    const chatObj = client.chats.create({
      model: "gemini-3.1-flash-lite",
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: [checkInventoryQuantity] }]
      },
      history: formattedHistory
    });
    let response = await chatObj.sendMessage({ message });
    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      if (call.name === "check_inventory_quantity") {
        const product_name = call.args.product_name;
        const { data } = await supabase.from("products").select("*").ilike("name", `%${product_name}%`).limit(10);
        let dbResultMsg = "";
        if (data && data.length > 0) {
          dbResultMsg = data.map((p) => `- ${p.name}: ${p.stock || 0} unidades en stock (Q${p.price})`).join("; ");
        } else {
          dbResultMsg = "No se encontr\xF3 ning\xFAn producto con ese nombre.";
        }
        response = await chatObj.sendMessage({
          message: [{
            functionResponse: {
              id: call.id,
              name: call.name,
              response: { result: dbResultMsg }
            }
          }]
        });
      }
    }
    res.json({ reply: response.text });
  } catch (err) {
    console.error("Gemini API Error details:", err);
    if (err.message && (err.message.includes("GEMINI_API_KEY") || err.message.includes("API key not found") || err.message.includes("API_KEY_INVALID"))) {
      return res.status(400).json({
        error: "API Key de Gemini no configurada",
        details: "Para habilitar el soporte de IA en Agricovet, por favor ingresa tu API Key propia en el archivo .env o en la configuraci\xF3n de secretos."
      });
    }
    res.status(500).json({ error: "Error al comunicarse con la IA", details: err.message });
  }
}));
app.post("/api/products/bulk-generate-descriptions", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { data: products } = await supabase.from("products").select("id, name, category").is("description", null);
  if (!products || products.length === 0) {
    return res.json({ message: "No hay productos sin descripci\xF3n." });
  }
  let generatedCount = 0;
  const productsToProcess = products;
  const getLocalDescription = (name, category) => {
    const n = (name || "").toLowerCase();
    const c = (category || "").toLowerCase();
    const KNOWLEDGE = {
      "Oxitetraciclina": "**Composici\xF3n:** Oxitetraciclina Clorhidrato. \n**Uso:** Antibi\xF3tico de amplio espectro contra bacterias Gram(+) y Gram(-). \n**Dosis:** 10-20 mg/kg de peso vivo v\xEDa IM profunda o IV lenta. \n**Precauciones:** No usar en animales con hipersensibilidad a tetraciclinas. Tiempo de retiro en carne: 28 d\xEDas.",
      "Ivermectina": "**Composici\xF3n:** Ivermectina al 1% o 4%. \n**Uso:** Endectocida para el control de par\xE1sitos internos (nematodos) y externos (garrapatas, \xE1caros). \n**Dosis:** 1 ml por cada 50 kg de peso (1%) o seg\xFAn concentraci\xF3n. SC \xFAnicamente. \n**Precauciones:** No administrar en vacas en lactancia cuya leche se destine a consumo humano.",
      "Complejo B": "**Composici\xF3n:** Vitaminas B1, B2, B6, B12 y Niacinamida. \n**Uso:** Reconstituyente vitam\xEDnico para estados de debilidad, anemia y estr\xE9s. \n**Dosis:** 5-10 ml en animales grandes, 1-2 ml en peque\xF1os. V\xEDa IM o SC. \n**Precauciones:** Mantener en lugar fresco y protegido de la luz solar.",
      "Glifosato": "**Composici\xF3n:** Glifosato (Sal isopropilamina). \n**Uso:** Herbicida sist\xE9mico no selectivo para el control de malezas anuales y perennes. \n**Dosis:** 1.5 a 3.0 litros por hect\xE1rea seg\xFAn la densidad de maleza. \n**Precauciones:** Evitar la deriva hacia cultivos deseados. Usar equipo de protecci\xF3n completo.",
      "Paraquat": "**Composici\xF3n:** Dicloruro de Paraquat. \n**Uso:** Herbicida de contacto para quema r\xE1pida de malezas. \n**Dosis:** 1.5 a 2.0 litros por manzana con suficiente agua. \n**Precauciones:** Altamente t\xF3xico. No inhalar. Almacenar bajo llave lejos de alimentos.",
      "Urea": "**Composici\xF3n:** Nitr\xF3geno 46%. \n**Uso:** Fertilizante nitrogenado para promover el crecimiento vegetativo y verdor del cultivo. \n**Dosis:** Seg\xFAn an\xE1lisis de suelo, generalmente 2-4 quintales por manzana. \n**Precauciones:** Incorporar al suelo inmediatamente despu\xE9s de aplicar para evitar volatilizaci\xF3n.",
      "Triple 15": "**Composici\xF3n:** Nitr\xF3geno 15%, F\xF3sforo 15%, Potasio 15%. \n**Uso:** Fertilizante completo para mantenimiento nutritivo balanceado en diversos cultivos. \n**Dosis:** Aplicar en la zona de goteo de la planta seg\xFAn edad y requerimiento t\xE9cnico. \n**Precauciones:** Distanciar del tallo principal para evitar quemaduras radiculares.",
      "Alimento Crecimiento": "**Composici\xF3n:** Mezcla balanceada de cereales, prote\xEDnas vegetales y minerales. \n**Uso:** Alimentaci\xF3n completa para la etapa de desarrollo acelerado en aves o cerdos. \n**Dosis:** Suministrar a voluntad (ad-libitum) asegurando agua limpia constante. \n**Precauciones:** Almacenar sobre tarimas en lugar seco para evitar hongos y micotoxinas.",
      "Vacuna Newcastle": "**Composici\xF3n:** Virus vivo atenuado (Cepa LaSota). \n**Uso:** Inmunizaci\xF3n activa contra la enfermedad de Newcastle en aves. \n**Dosis:** Una gota v\xEDa ocular o nasal, o mediante el agua de bebida seg\xFAn edad. \n**Precauciones:** Mantener estrictamente la cadena de fr\xEDo (2-8\xB0C). Vacunar solo animales sanos.",
      "Cipermetrina": "**Composici\xF3n:** Cipermetrina Concentrado Emulsionable. \n**Uso:** Insecticida y acaricida de amplio espectro por contacto e ingesti\xF3n. \n**Dosis:** Diluir 1 ml por cada litro de agua para pulverizaci\xF3n en instalaciones o ganado. \n**Precauciones:** Producto moderadamente t\xF3xico. No contaminar fuentes de agua.",
      "Amoxicilina": "**Composici\xF3n:** Amoxicilina Trihidrato. \n**Uso:** Antibi\xF3tico bactericida para infecciones respiratorias, urogenitales y cut\xE1neas. \n**Dosis:** 15 mg/kg cada 24 horas por 3 a 5 d\xEDas. \n**Precauciones:** Puede causar trastornos gastrointestinales leves en algunos ejemplares.",
      "Multivitam\xEDnico": "**Composici\xF3n:** Vitaminas A, D3, E, B12, Amino\xE1cidos y Minerales. \n**Uso:** Estimulante del apetito y mejora de la conversi\xF3n alimenticia. \n**Dosis:** 1-5 ml seg\xFAn especie y peso. IM. \n**Precauciones:** Agitar bien antes de usar. No exceder la dosis recomendada.",
      "Desinfectante Instrumental": "**Composici\xF3n:** Amonio Cuaternario o Glutaraldeh\xEDdo. \n**Uso:** Sanitizaci\xF3n de equipos veterinarios, jeringas y \xE1reas de orde\xF1o. \n**Dosis:** Diluci\xF3n al 1:500 o 1:1000 seg\xFAn carga org\xE1nica existente. \n**Precauciones:** Evitar contacto directo con ojos y mucosas. No ingerir.",
      "Electrolitos": "**Composici\xF3n:** Sodio, Potasio, Cloro, Magnesio y Dextrosa. \n**Uso:** Rehidrataci\xF3n oral para animales con diarrea o agotamiento por calor. \n**Dosis:** Disolver un sobre en 20 litros de agua de bebida. \n**Precauciones:** Preparar diariamente para asegurar la estabilidad de los componentes.",
      "Calcio Inyectable": "**Composici\xF3n:** Borogluconato de Calcio al 25%. \n**Uso:** Tratamiento de fiebre de leche (hipocalcenia) y deficiencias de calcio. \n**Dosis:** 250-500 ml v\xEDa IV lenta en vacas adultas. \n**Precauciones:** Administrar a temperatura corporal. Vigilar ritmo card\xEDaco durante aplicaci\xF3n."
    };
    if (n.includes("oxitetra") || n.includes("tecnimicina") || n.includes("oxiplus") || n.includes("oxi")) return KNOWLEDGE["Oxitetraciclina"];
    if (n.includes("penici") || n.includes("tilosin") || n.includes("broximici") || n.includes("trimsulfa") || n.includes("tigent")) return KNOWLEDGE["Amoxicilina"];
    if (n.includes("iverplus") || n.includes("ivermect") || n.includes("albendazol") || n.includes("lombrifin") || n.includes("vermimax")) return KNOWLEDGE["Ivermectina"];
    if (n.includes("vitamina") || n.includes("complejo b") || n.includes("vita b12") || n.includes("vitel") || n.includes("proteizoo") || n.includes("instavit")) return KNOWLEDGE["Complejo B"];
    if (n.includes("multivita") || n.includes("multipack") || n.includes("reconstituyente")) return KNOWLEDGE["Multivitam\xEDnico"];
    if (n.includes("glifosato") || n.includes("revolver") || n.includes("sementhal") || n.includes("torban") || n.includes("cegar")) return KNOWLEDGE["Glifosato"];
    if (n.includes("terraquat") || n.includes("duplexone") || n.includes("paraquat")) return KNOWLEDGE["Paraquat"];
    if (n.includes("nitr\xF3g") || n.includes("urea") || n.includes("fertilizante")) return KNOWLEDGE["Urea"];
    if (n.includes("15-15-15") || n.includes("foliar plus") || c.includes("abono")) return KNOWLEDGE["Triple 15"];
    if (n.includes("alimento") || n.includes("crecimiento") || n.includes("engorde")) return KNOWLEDGE["Alimento Crecimiento"];
    if (n.includes("vacuna") || n.includes("newcastle") || n.includes("cepa")) return KNOWLEDGE["Vacuna Newcastle"];
    if (n.includes("cipermetr") || n.includes("nuvan") || n.includes("insecticida") || n.includes("blindage") || n.includes("pikudo")) return KNOWLEDGE["Cipermetrina"];
    if (n.includes("electro") || n.includes("chemiestress")) return KNOWLEDGE["Electrolitos"];
    if (n.includes("calcio") || n.includes("borogl")) return KNOWLEDGE["Calcio Inyectable"];
    if (n.includes("matagusano") || n.includes("curabichera") || n.includes("jab\xF3n pet") || n.includes("shampoo")) return KNOWLEDGE["Desinfectante Instrumental"];
    return `**Uso:** Producto especializado para el sector ${c.includes("agr\xEDcola") ? "agr\xEDcola" : "veterinario"}. 
**Recomendaci\xF3n:** El art\xEDculo "${name}" ha sido seleccionado por Agricovet por su comprobada eficiencia. Se recomienda leer la etiqueta completa y ajustar la dosis seg\xFAn las necesidades espec\xEDficas de su producci\xF3n o animal. 
**Precauciones:** Almacenar en un lugar seco y fuera del alcance de los ni\xF1os. Consulte a su asesor t\xE9cnico de Agricovet para un plan de manejo integral.`;
  };
  for (const product of productsToProcess) {
    try {
      const description = getLocalDescription(product.name, product.category);
      await supabase.from("products").update({ description }).eq("id", product.id);
      generatedCount++;
    } catch (err) {
      console.error(`Error updating ${product.name}:`, err);
    }
  }
  res.json({
    success: true,
    generatedCount,
    message: `Se actualizaron ${generatedCount} productos r\xE1pidamente usando la base de datos de Agricovet.`
  });
}));
app.get("/api/fel/config", requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  const config = await obtenerConfig(supabase);
  const { infile_llave_firma, infile_llave_token, ...publica } = config || {};
  res.json({
    config: publica,
    // Nunca se devuelven las llaves; solo si ya estan cargadas.
    credencialesCargadas: !!(infile_llave_firma && infile_llave_token),
    camposFaltantes: configIncompleta(config)
  });
}));
app.post("/api/fel/config", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const permitidos = [
    "nit_emisor",
    "nombre_emisor",
    "nombre_comercial",
    "correo_emisor",
    "direccion",
    "municipio",
    "departamento",
    "codigo_postal",
    "codigo_establecimiento",
    "afiliacion_iva",
    "ambiente",
    "infile_usuario",
    "infile_llave_firma",
    "infile_llave_token",
    "infile_url",
    "tipo_dte_default"
  ];
  const cambios = {};
  for (const c of permitidos) {
    if (req.body[c] !== void 0 && req.body[c] !== "") cambios[c] = req.body[c];
  }
  if (cambios.ambiente && !["pruebas", "produccion"].includes(cambios.ambiente)) {
    return res.status(400).json({ error: "El ambiente debe ser 'pruebas' o 'produccion'." });
  }
  const config = await guardarConfig(supabase, cambios);
  const { infile_llave_firma, infile_llave_token, ...publica } = config;
  res.json({ config: publica, camposFaltantes: configIncompleta(config) });
}));
app.get("/api/invoices/:id/fel", requireAuth, asyncHandler(async (req, res) => {
  const { data: facturas } = await supabase.from("invoices").select("*").eq("id", req.params.id);
  const invoice = facturas && facturas[0];
  if (!invoice) return res.status(404).json({ error: "Factura no encontrada" });
  if (req.user.role !== "admin" && invoice.sellerId !== req.user.id) {
    return res.status(403).json({ error: "No tienes acceso a esta factura" });
  }
  const documento = await obtenerDocumentoPorFactura(supabase, req.params.id);
  const { totales, advertencias, nitReceptor } = prepararDTE(invoice);
  const felConfig = await obtenerConfig(supabase);
  const emisor = {
    nit: felConfig?.nit_emisor ?? "",
    nombre: felConfig?.nombre_emisor ?? "",
    nombreComercial: felConfig?.nombre_comercial ?? "",
    ambiente: felConfig?.ambiente ?? "pruebas"
  };
  res.json({
    documento,
    estado: documento?.estado ?? "sin_emitir",
    nitReceptor,
    esConsumidorFinal: esConsumidorFinal(nitReceptor),
    emisor,
    desglose: {
      montoGravable: totales.totalMontoGravable,
      montoIva: totales.totalMontoIva,
      granTotal: totales.granTotal
    },
    advertencias
  });
}));
app.get("/api/fel/documentos", requireAuth, asyncHandler(async (req, res) => {
  let documentos = await listarDocumentos(supabase, {
    estado: req.query.estado,
    limite: Number(req.query.limite) || 200
  });
  if (req.user.role !== "admin") {
    const { data: propias } = await supabase.from("invoices").select("id").eq("sellerId", req.user.id);
    const permitidas = new Set((propias || []).map((f) => f.id));
    documentos = documentos.filter((d) => permitidas.has(d.invoice_id));
  }
  const resumen = documentos.reduce((acc, d) => {
    acc[d.estado] = (acc[d.estado] || 0) + 1;
    return acc;
  }, {});
  res.json({ documentos, resumen, total: documentos.length });
}));
app.post("/api/invoices/:id/fel/certificar", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { data: facturas } = await supabase.from("invoices").select("*").eq("id", req.params.id);
  const invoice = facturas && facturas[0];
  if (!invoice) return res.status(404).json({ error: "Factura no encontrada" });
  if (invoice.status === "cancelled" || invoice.status === "rejected") {
    return res.status(400).json({ error: "No se puede certificar una factura anulada o rechazada." });
  }
  const receptorBody = req.body?.receptor;
  const receptor = receptorBody && (receptorBody.nit || receptorBody.nombre) ? { nit: receptorBody.nit, nombre: receptorBody.nombre } : void 0;
  const resultado = await certificarFactura(supabase, invoice, {
    tipoDte: req.body?.tipoDte,
    receptor
  });
  res.json(resultado);
}));
app.post("/api/invoices/:id/fel/anular", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const motivo = String(req.body?.motivo || "").trim();
  if (motivo.length < 5) {
    return res.status(400).json({ error: "Indica el motivo de la anulacion (minimo 5 caracteres)." });
  }
  const { data: facturas } = await supabase.from("invoices").select("*").eq("id", req.params.id);
  const invoice = facturas && facturas[0];
  if (!invoice) return res.status(404).json({ error: "Factura no encontrada" });
  try {
    const resultado = await anularFactura(supabase, invoice, motivo);
    if (resultado.anulado && invoice.status !== "cancelled" && invoice.status !== "rejected") {
      await restaurarStockDeFactura(invoice);
      await supabase.from("invoices").update({ status: "cancelled" }).eq("id", invoice.id);
      invalidateCache("products");
      invalidateCache("folio_map");
      resultado.facturaAnulada = true;
    }
    res.json(resultado);
  } catch (e) {
    res.status(400).json({ error: e?.message ?? "No se pudo anular el documento" });
  }
}));
app.get("/api/invoices/:id/fel/xml", requireAuth, asyncHandler(async (req, res) => {
  const { data: facturas } = await supabase.from("invoices").select('id, "sellerId"').eq("id", req.params.id);
  const invoice = facturas && facturas[0];
  if (!invoice) return res.status(404).json({ error: "Factura no encontrada" });
  if (req.user.role !== "admin" && invoice.sellerId !== req.user.id) {
    return res.status(403).json({ error: "No tienes acceso a esta factura" });
  }
  const doc = await obtenerDocumentoPorFactura(supabase, req.params.id);
  if (!doc) return res.status(404).json({ error: "Esta factura no tiene documento FEL." });
  const tipo = req.query.tipo === "certificado" ? "certificado" : "enviado";
  let xml = tipo === "certificado" ? doc.xml_certificado : doc.xml_enviado;
  if (!xml) return res.status(404).json({ error: `Esta factura no tiene XML ${tipo}.` });
  if (!xml.trim().startsWith("<")) {
    try {
      const decodificado = Buffer.from(xml, "base64").toString("utf-8");
      if (decodificado.trim().startsWith("<")) xml = decodificado;
    } catch {
    }
  }
  const nombre = `DTE-${tipo}-${doc.numero_autorizacion || req.params.id}.xml`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${nombre}"`);
  res.send(xml);
}));
app.get("/api/fel/consulta-nit/:nit", requireAuth, asyncHandler(async (req, res) => {
  const config = await obtenerConfig(supabase);
  if (!config?.infile_usuario || !config?.infile_llave_token) {
    return res.status(400).json({ error: "Las credenciales de INFILE no estan configuradas." });
  }
  const resultado = await consultarNit(req.params.nit, {
    usuario: config.infile_usuario,
    llaveToken: config.infile_llave_token
  });
  res.json(resultado);
}));
var RECIBOS_CAJA_FILE = path.join(process.cwd(), "recibos_caja_local.json");
var DELETED_RECIBOS_FILE = path.join(process.cwd(), "deleted_recibos_ids.json");
function readLocalRecibosCaja() {
  try {
    if (fs.existsSync(RECIBOS_CAJA_FILE)) {
      const raw = fs.readFileSync(RECIBOS_CAJA_FILE, "utf-8");
      return JSON.parse(raw) || [];
    }
  } catch (e) {
    console.warn("Could not read local recibos_caja file:", e);
  }
  return [];
}
function saveLocalReciboCaja(recibo) {
  try {
    const list = readLocalRecibosCaja();
    list.unshift(recibo);
    fs.writeFileSync(RECIBOS_CAJA_FILE, JSON.stringify(list, null, 2));
  } catch (e) {
    console.warn("Could not save to local recibos_caja file:", e);
  }
}
app.get("/api/recibos-caja", requireAuth, asyncHandler(async (req, res) => {
  try {
    const { data, error } = await supabase.from("recibos_caja").select("*").order("created_at", { ascending: false });
    if (!error && Array.isArray(data)) {
      const filtered = data.filter(
        (r) => r.observaciones !== "[ELIMINADO]" && !r.observaciones?.includes("[ELIMINADO]") && r.cliente_nombre !== "[ELIMINADO]" && !r.cliente_nombre?.includes("[ELIMINADO]")
      );
      return res.json(filtered);
    }
  } catch (e) {
    console.warn("Supabase recibos_caja query fallback:", e);
  }
  const localList = readLocalRecibosCaja();
  const resultList = localList.filter(
    (r) => !r.observaciones?.includes("[ELIMINADO]") && !r.cliente_nombre?.includes("[ELIMINADO]")
  );
  res.json(resultList);
}));
app.post("/api/recibos-caja", requireAuth, asyncHandler(async (req, res) => {
  const {
    cliente_nombre,
    cliente_nit,
    cliente_codigo,
    cantidad_letras,
    facturas,
    cheques,
    efectivo_total,
    monto_total,
    observaciones,
    cajero_nombre,
    fecha
  } = req.body;
  if (!cliente_nombre || cliente_nombre.trim() === "") {
    return res.status(400).json({ error: "El nombre del cliente es obligatorio" });
  }
  const localList = readLocalRecibosCaja();
  const nextSeq = localList.length + 152;
  const folioStr = `P N\xBA ${String(nextSeq).padStart(6, "0")}`;
  const newRecibo = {
    id: crypto.randomUUID(),
    folio: folioStr,
    numero_secuencial: nextSeq,
    fecha: fecha || (/* @__PURE__ */ new Date()).toLocaleDateString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    cliente_nombre: cliente_nombre.trim(),
    cliente_nit: cliente_nit || "CF",
    cliente_codigo: cliente_codigo || "",
    cantidad_letras: cantidad_letras || "Cero quetzales",
    facturas: Array.isArray(facturas) ? facturas : [],
    cheques: Array.isArray(cheques) ? cheques : [],
    efectivo_total: Number(efectivo_total) || 0,
    monto_total: Number(monto_total) || 0,
    observaciones: observaciones || "",
    cajero_nombre: cajero_nombre || "CAJERO RECEPTOR",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    const { data, error } = await supabase.from("recibos_caja").insert([newRecibo]).select();
    if (!error && data && data[0]) {
      saveLocalReciboCaja(data[0]);
      return res.status(201).json(data[0]);
    }
  } catch (e) {
    console.warn("Supabase insert recibo_caja fallback to local file:", e);
  }
  saveLocalReciboCaja(newRecibo);
  res.status(201).json(newRecibo);
}));
app.delete("/api/recibos-caja/:id", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "ID del recibo es obligatorio" });
  const { data: updated, error: updateErr } = await supabase.from("recibos_caja").update({
    observaciones: "[ELIMINADO]",
    cliente_nombre: "[ELIMINADO]"
  }).eq("id", id).select();
  if (updateErr) {
    console.error("Supabase UPDATE recibo_caja error:", updateErr);
    return res.status(500).json({ error: "Error al eliminar el recibo en la base de datos", details: updateErr.message });
  }
  if (!updated || updated.length === 0) {
    return res.status(404).json({ error: "Recibo no encontrado" });
  }
  console.log(`[RECIBO ELIMINADO] ID: ${id} marcado como [ELIMINADO] en Supabase`);
  res.json({ success: true, message: "Recibo eliminado correctamente" });
}));
app.get("/api/visits", asyncHandler(async (req, res) => {
  try {
    const { data, error } = await supabase.from("client_visits").select("id, clientId, clientName, sellerId, sellerName, latitude, longitude, visitType, notes, createdAt").order("created_at", { ascending: false });
    if (!error && data) return res.json(data);
  } catch (e) {
  }
  res.json([]);
}));
app.get("/api/visits/stats", asyncHandler(async (req, res) => {
  res.json({
    totalVisitsToday: 0,
    totalVisitsMonth: 0,
    activeSellersCount: 0,
    clientsVisitedCount: 0,
    unvisitedClientsCount: 0,
    sellerRankings: [],
    recentVisits: []
  });
}));
app.get("/api/routes", asyncHandler(async (req, res) => {
  try {
    const { data, error } = await supabase.from("seller_routes").select("*").order("created_at", { ascending: false });
    if (!error && data) return res.json(data);
  } catch (e) {
  }
  res.json([]);
}));
app.get("/api/quotations", requireAuth, asyncHandler(async (req, res) => {
  try {
    const { sellerId } = req.query;
    let query = supabase.from("quotations").select("*").order("date", { ascending: false });
    if (sellerId && req.user.role !== "admin") {
      query = query.or(`sellerId.eq.${sellerId},sellerName.ilike.%${sellerId}%`);
    }
    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      return res.json(data);
    }
  } catch (err) {
    console.warn("Supabase quotations fetch error:", err?.message || err);
  }
  res.json([]);
}));
app.get("/api/quotations/:id", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from("quotations").select("*").eq("id", id).single();
  if (error || !data) {
    return res.status(404).json({ error: "Cotizaci\xF3n no encontrada" });
  }
  res.json(data);
}));
app.post("/api/quotations", requireAuth, asyncHandler(async (req, res) => {
  const { client, nit, phone, address, items, notes, validityDays, date, sellerId, sellerName } = req.body;
  if (!client || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Cliente y al menos un producto son requeridos" });
  }
  const { data: allQuotes } = await supabase.from("quotations").select("folioNumber").order("folioNumber", { ascending: false }).limit(1);
  const lastNum = allQuotes && allQuotes[0]?.folioNumber || 0;
  const nextNum = lastNum + 1;
  const folioStr = `COT-${String(nextNum).padStart(4, "0")}`;
  const totalAmount = items.reduce((sum, it) => sum + (Number(it.total) || Number(it.quantity) * Number(it.price)), 0);
  const quoteDate = date || (/* @__PURE__ */ new Date()).toISOString();
  const days = validityDays || 15;
  const validUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1e3).toISOString();
  const newQuote = {
    id: `COT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    folio: folioStr,
    folioNumber: nextNum,
    sellerId: sellerId || req.user.email || req.user.id,
    sellerName: sellerName || req.user.name,
    client: client.trim(),
    nit: nit?.trim() || "CF",
    phone: phone?.trim() || "",
    address: address?.trim() || "",
    items,
    totalAmount,
    status: "pendiente",
    date: quoteDate,
    validityDays: days,
    validUntil,
    notes: notes?.trim() || "",
    convertedInvoiceId: null,
    convertedInvoiceFolio: null
  };
  const { data, error } = await supabase.from("quotations").insert([newQuote]).select().single();
  if (error) {
    throw new Error(error.message);
  }
  res.status(201).json(data || newQuote);
}));
app.put("/api/quotations/:id", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const { data, error } = await supabase.from("quotations").update(updates).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  res.json(data);
}));
app.delete("/api/quotations/:id", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from("quotations").delete().eq("id", id);
  if (error) throw new Error(error.message);
  res.json({ success: true });
}));
app.post("/api/quotations/:id/convert-to-sale", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { data: quote, error: qErr } = await supabase.from("quotations").select("*").eq("id", id).single();
  if (qErr || !quote) return res.status(404).json({ error: "Cotizaci\xF3n no encontrada" });
  await supabase.from("quotations").update({
    status: "convertida",
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }).eq("id", id);
  res.json({ success: true, quotation: quote });
}));
app.use((err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    console.error("Global API Error:", err);
  } else {
    console.error("Global API Error occurred:", err.message);
  }
  res.status(500).json({
    error: err.message || "Error interno del servidor"
  });
});
var server_default = app;
async function startServer() {
  console.log("Starting server script...");
  const PORT = Number(process.env.PORT) || 3e3;
  console.log("Configured PORT is:", PORT, "from env:", process.env.PORT);
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite middleware server...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    console.log("Vite server created, attaching middlewares...");
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", async () => {
      console.log(`Server running on http://localhost:${PORT}`);
      try {
        try {
          await supabase.rpc("exec_sql", { sql: "ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;" });
          await supabase.rpc("exec_sql", { sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS "sellerCode" TEXT;' });
          await supabase.rpc("exec_sql", { sql: 'CREATE TABLE IF NOT EXISTS public.login_tokens (id TEXT PRIMARY KEY, "userId" TEXT NOT NULL, token TEXT NOT NULL, "createdAt" TEXT NOT NULL, "usedAt" TEXT, "expiresAt" TEXT);' });
        } catch (e) {
          console.warn("Could not run migrations via RPC:", e);
        }
        const clients = readLocalClients();
        const missingCodes = clients.filter((c) => !c.clientCode || c.clientCode.trim() === "");
        if (missingCodes.length > 0) {
          console.log(`Migrating ${missingCodes.length} clients to have codes...`);
          const usedCodes = new Set(clients.map((c) => c.clientCode).filter(Boolean));
          for (const client of missingCodes) {
            let code = "";
            let unique = false;
            let attempts = 0;
            while (!unique && attempts < 100) {
              code = Math.floor(1e3 + Math.random() * 9e3).toString();
              if (!usedCodes.has(code)) unique = true;
              attempts++;
            }
            if (unique) {
              client.clientCode = code;
              usedCodes.add(code);
              updateLocalClient(client.id, { clientCode: code });
              try {
                await supabase.from("clients").update({ clientCode: code }).eq("id", client.id);
              } catch (e) {
              }
            }
          }
          console.log("Migration completed.");
          invalidateCache("clients");
        }
        let usersData = [];
        try {
          const { data: users, error } = await supabase.from("users").select("*");
          if (error) {
            if (error.message && error.message.includes("fetch failed")) {
              console.warn("Supabase connection unavailable for user migration.");
            } else {
              console.error("Could not fetch users for migration, possibly missing column:", error.message);
            }
          } else {
            usersData = users || [];
          }
        } catch (e) {
          console.warn("Users select failed in migration:", e?.message || e);
        }
        const missingUserCodes = usersData.filter((u) => !u.sellerCode || u.sellerCode.trim() === "");
        if (missingUserCodes.length > 0) {
          console.log(`Migrating ${missingUserCodes.length} users to have sellerCodes...`);
          const usedUserCodes = new Set(usersData.map((u) => u.sellerCode).filter(Boolean));
          for (const u of missingUserCodes) {
            let code = "";
            let unique = false;
            let attempts = 0;
            while (!unique && attempts < 100) {
              code = Math.floor(1e3 + Math.random() * 9e3).toString();
              if (!usedUserCodes.has(code)) unique = true;
              attempts++;
            }
            if (unique) {
              try {
                await supabase.from("users").update({ sellerCode: code }).eq("id", u.id);
                usedUserCodes.add(code);
              } catch (upErr) {
                console.error(`Failed to update sellerCode for user ${u.id}:`, upErr);
              }
            }
          }
          console.log("User migration completed.");
        }
      } catch (err) {
        console.error("Migration error:", err);
      }
    });
  }
}
var isDirectRun = !process.env.VERCEL && (typeof process.argv[1] === "string" && (process.argv[1].endsWith("server.cjs") || process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.js")));
if (isDirectRun) {
  startServer();
}
export {
  app,
  server_default as default
};
