// @ts-ignore
import html2pdf from 'html2pdf.js';

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function getStartOfCurrentWeek(): Date {
  const today = new Date();
  const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(diffToMonday);
  startOfThisWeek.setHours(0, 0, 0, 0);
  return startOfThisWeek;
}

export function cleanObservations(notes: string | undefined | null): string {
  if (!notes) return '';
  if (!notes.includes('|||')) return notes.trim();
  const parts = notes.split('|||');
  const obsPart = parts.find(p => p.startsWith('OBS:'));
  return obsPart ? obsPart.replace('OBS:', '').trim() : '';
}

export function isCriticalStock(product: { name?: string; category?: string; stock?: number }): boolean {
  if (!product) return false;
  const stock = product.stock || 0;
  
  const nameL = (product.name || '').toLowerCase();
  const catL = (product.category || '').toLowerCase();
  
  // EXENTO DE STOCK: Incubadoras
  if (nameL.includes('incubadora') || catL.includes('incubadora') || catL === 'incubadoras') {
    return false;
  }

  const isSA = nameL.includes('sistemas agropecuarios') || catL.includes('sistemas agropecuarios');
  const isNexlabet = nameL.includes('nexlabet');
  const isOtherCritical = nameL.includes('broncobion max') || nameL.includes('avimdustrias mirex') || nameL.includes('forza');

  if ((isSA && !isNexlabet) || isOtherCritical) {
    return stock < 120;
  }
  
  return stock <= 5;
}

export function doesNotNeedStock(product: { name?: string; category?: string } | null | undefined): boolean {
  if (!product) return false;
  const nameLower = (product.name || '').toLowerCase();
  const categoryLower = (product.category || '').toLowerCase();
  
  // Explicitly exclude INCUBADORAS
  if (categoryLower.includes('incubadora') || nameLower.includes('incubadora') || categoryLower === 'incubadoras') {
    return true;
  }
  
  const keywords = ['bebedero', 'comedero', 'puya', 'arete', 'aretes'];
  return keywords.some(keyword => nameLower.includes(keyword) || categoryLower.includes(keyword));
}

export const DEFAULT_PRINT_TEMPLATE = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <base href="{{origin}}/" />
  <style>
    @page { size: A4; margin: 14mm 15mm; }
    * { box-sizing: border-box; font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif; }
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
    body { margin: 0; color: #1f2937; font-size: 10pt; line-height: 1.45; }
    .muted { color: #6b7280; }
    .num { color: #b91c1c; font-weight: 700; }

    /* Encabezado */
    .doc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; padding-bottom: 12px; border-bottom: 2px solid #1A4D2E; }
    .brand { display: flex; gap: 12px; align-items: center; }
    .brand img { width: 62px; height: 62px; object-fit: contain; }
    .em-name { font-size: 14pt; font-weight: 700; color: #111827; letter-spacing: -0.2px; }
    .em-meta { font-size: 8.4pt; color: #6b7280; margin-top: 2px; line-height: 1.45; }
    .doc-box { min-width: 218px; border: 1px solid #1A4D2E; border-radius: 6px; padding: 8px 12px; text-align: center; }
    .doc-box .t { font-size: 9pt; font-weight: 800; color: #1A4D2E; line-height: 1.25; }
    .doc-box .r { font-size: 8.6pt; color: #374151; margin-top: 4px; }

    /* Partes */
    .parties { display: flex; gap: 26px; margin: 14px 0 4px; }
    .parties .col { flex: 1; }
    .lbl { font-size: 7.4pt; text-transform: uppercase; letter-spacing: 0.09em; color: #9ca3af; font-weight: 700; margin-bottom: 4px; padding-bottom: 2px; border-bottom: 1px solid #e5e7eb; }
    .cli-name { font-weight: 700; font-size: 10.5pt; color: #111827; }
    .kv { font-size: 9pt; margin-top: 2px; }
    .kv b { color: #374151; }

    /* Tabla de items */
    table.items { width: 100%; border-collapse: collapse; margin-top: 12px; }
    table.items thead th { font-size: 7.8pt; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; text-align: left; padding: 7px 8px; border-bottom: 1.5px solid #d1d5db; }
    table.items thead th.r { text-align: right; }
    table.items tbody td { font-size: 9.4pt; padding: 6px 8px; border-bottom: 1px solid #f0f1f2; vertical-align: top; }
    table.items tbody td.r { text-align: right; }
    table.items tbody tr:nth-child(even) td { background: #fafafa; }

    /* Totales */
    .totals { width: 46%; margin-left: auto; margin-top: 10px; border-collapse: collapse; }
    .totals td { padding: 4px 6px; font-size: 9.6pt; }
    .totals td.r { text-align: right; }
    .totals tr.grand td { border-top: 1.5px solid #1A4D2E; font-weight: 800; font-size: 11.5pt; color: #1A4D2E; padding-top: 8px; }

    /* Bloque legal FEL */
    .fel-legend { margin-top: 14px; border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 12px; font-size: 7.5pt; color: #4b5563; text-align: justify; line-height: 1.45; page-break-inside: avoid; }
    .foot-note { margin-top: 8px; font-size: 8pt; color: #1A4D2E; font-weight: 600; }
  </style>
</head>
<body>
  <div class="doc-head">
    <div class="brand">
      <img src="{{logoUrl}}" alt="Logo" />
      <div>{{FEL_EMISOR}}</div>
    </div>
    <div class="doc-box">
      <div class="t">{{FEL_DOCTYPE}}</div>
      <div class="r"><b>Folio:</b> #{{folio}}</div>
      {{FEL_SERIE_NUM}}
    </div>
  </div>

  <div class="parties">
    <div class="col">
      <div class="lbl">Cliente</div>
      <div class="cli-name notranslate" translate="no">{{customerName}}</div>
      <div class="kv"><b>NIT:</b> {{customerNit}}</div>
      <div class="kv"><b>Dirección:</b> {{customerAddress}}</div>
      <div class="kv"><b>Teléfono:</b> {{phone}}</div>
    </div>
    <div class="col">
      <div class="lbl">Detalles del Documento</div>
      <div class="kv"><b>Fecha:</b> {{date}}</div>
      <div class="kv"><b>Forma de pago:</b> {{paymentForm}}</div>
      <div class="kv"><b>Estado:</b> {{status}}</div>
      <div class="kv"><b>Vendedor:</b> {{sellerName}}</div>
      {{FEL_DOC_DETAILS}}
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:52%;">Producto</th>
        <th class="r" style="width:14%;">Cantidad</th>
        <th class="r" style="width:16%;">Precio</th>
        <th class="r" style="width:18%;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr>
        <td class="notranslate" translate="no">{{this.productName}}</td>
        <td class="r">{{this.quantity}}</td>
        <td class="r">Q {{this.price}}</td>
        <td class="r">Q {{this.subtotal}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <table class="totals">
    <tr><td class="muted">Total Bruto</td><td class="r">Q {{totalAmount}}</td></tr>
    {{FEL_IVA_ROWS}}
    <tr><td class="muted">Pagos Recibidos</td><td class="r">Q {{paidAmount}}</td></tr>
    <tr class="grand"><td>Total a Pagar</td><td class="r">Q {{dueAmount}}</td></tr>
  </table>

  {{FEL_LEYENDA}}
  <div class="foot-note">Cambio o devoluciones tienen vigencia de 8 días.</div>
</body>
</html>`;

export const formatMoney = (num: number | undefined | string) => {
  if (num === undefined || num === null) return 'Q0.00';
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return 'Q0.00';
  return 'Q' + n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  });
};

/**
 * Datos FEL para la representacion grafica (factura impresa).
 * Cuando la factura esta certificada, SAT exige que el documento impreso
 * muestre el numero de autorizacion, serie, numero, fecha y el desglose de IVA.
 */
export interface FelPrintData {
  documento?: {
    estado?: string;
    numero_autorizacion?: string | null;
    serie?: string | null;
    numero?: string | null;
    fecha_certificacion?: string | null;
    tipo_dte?: string | null;
    monto_gravable?: number | null;
    monto_iva?: number | null;
    gran_total?: number | null;
  } | null;
  emisor?: { nit?: string; nombre?: string; nombreComercial?: string; ambiente?: string };
  /** Dias de credito de la factura (para la fecha de vencimiento del abono). */
  creditDays?: number;
}

/** Texto oficial de la frase segun tipo/escenario configurado (Tipo 1, Esc 1). */
const FRASE_FEL = 'Sujeto a pagos trimestrales ISR.';

/** Formatea una fecha como dd/mm/yyyy. */
function fechaDDMMYYYY(fecha: any, conHora = false): string {
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  const base = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  return conHora ? `${base} ${p(d.getHours())}:${p(d.getMinutes())}` : base;
}

/**
 * Fragmentos FEL para incrustar en distintas secciones de la factura, en vez
 * de un bloque grande al final (que empujaba a una segunda pagina). Asi el
 * documento mantiene un formato unificado en una sola pagina:
 *   - emisorLinea  -> encabezado (razon social + NIT del emisor)
 *   - detalles     -> columna "Detalles del Documento" (tipo, serie, numero, UUID)
 *   - ivaRows      -> tabla de totales (monto gravable, IVA)
 *   - leyenda      -> franja compacta al final (leyenda cambiaria + frase)
 *   - tagline      -> reemplazo del "Comprobante de Venta" del encabezado
 */
interface FragmentosFel {
  emisorLinea: string;
  detalles: string;
  ivaRows: string;
  leyenda: string;
  tagline: string;
  bloqueFallback: string;
}

function construirFragmentosFel(fel?: FelPrintData): FragmentosFel | null {
  const doc = fel?.documento;
  if (!doc || doc.estado !== 'certificado' || !doc.numero_autorizacion) return null;

  const fmt = (n: any) => {
    const v = Number(n);
    return isNaN(v) ? '0.00' : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const esFcam = doc.tipo_dte === 'FCAM';
  const razon = fel?.emisor?.nombre || '';
  const comercial = fel?.emisor?.nombreComercial || '';
  const dias = Number(fel?.creditDays || 0);
  const fechaCert = fechaDDMMYYYY(doc.fecha_certificacion, true);
  const tipoTexto = esFcam ? 'Factura Cambiaria Electrónica (Libre de Protesto)' : 'Factura Electrónica';
  const esPrueba = String(doc.serie || '').toUpperCase().includes('PRUEBA') || fel?.emisor?.ambiente === 'pruebas';

  const emisorLinea =
    (razon ? `<div class="meta-info-text" style="margin-top:3px;"><strong>Razón social:</strong> ${razon}</div>` : '') +
    (comercial && comercial !== razon ? `<div class="meta-info-text"><strong>Nombre comercial:</strong> ${comercial}</div>` : '') +
    (fel?.emisor?.nit ? `<div class="meta-info-text"><strong>NIT Emisor:</strong> ${fel.emisor.nit}</div>` : '');

  const detalles = `
                    <div class="info-detail-item" style="margin-top:6px; border-top:1px dashed #E2E8F0; padding-top:6px;"><strong>Documento:</strong> ${tipoTexto}</div>
                    <div class="info-detail-item"><strong>Serie:</strong> ${doc.serie || ''} &nbsp;·&nbsp; <strong>Número:</strong> <span style="color:#b91c1c; font-weight:bold;">${doc.numero || ''}</span></div>
                    <div class="info-detail-item"><strong>No. Autorización:</strong><br/><span style="font-family:monospace; font-size:8pt; word-break:break-all;">${doc.numero_autorizacion}</span></div>
                    <div class="info-detail-item"><strong>Certificación:</strong> ${fechaCert} · INFILE, S.A.</div>`;

  const ivaRows = `
            <tr>
                <td class="lbl" style="font-weight:normal; color:#555;">Monto Gravable</td>
                <td class="val" style="color:#555;">Q ${fmt(doc.monto_gravable)}</td>
            </tr>
            <tr>
                <td class="lbl" style="font-weight:normal; color:#555;">IVA (12%)</td>
                <td class="val" style="color:#555;">Q ${fmt(doc.monto_iva)}</td>
            </tr>`;

  const leyendaCambiaria = esFcam
    ? `Por esta <strong>FACTURA CAMBIARIA girada LIBRE DE PROTESTO</strong>, a ${dias > 0 ? dias + ' días' : 'la vista'} se servirá(n) usted(es) pagar a la orden o endoso de <strong>${razon}</strong> el valor total de <strong>Q ${fmt(doc.gran_total)}</strong> por lo que aquí se extiende. El comprador declara haber recibido la mercadería a su entera satisfacción, da por bueno el valor total de este título de crédito y se compromete a pagarlo en la fecha de vencimiento. Esta factura no se considera cancelada si no la ampara el recibo de caja correspondiente. `
    : '';

  const bannerPrueba = esPrueba
    ? `<span style="color:#92400e; font-weight:800;">DOCUMENTO DE PRUEBA · SIN VALIDEZ FISCAL. </span>`
    : '';

  const leyenda = `
    <div style="margin-top:8px; padding:7px 11px; border:1px solid #1A4D2E; border-radius:6px; font-size:7.4pt; color:#333; text-align:justify; line-height:1.4; page-break-inside:avoid;">
      ${bannerPrueba}${leyendaCambiaria}<span style="font-style:italic; color:#666;">Frase: ${FRASE_FEL} Representación gráfica de un DTE generado y certificado electrónicamente ante la SAT.</span>
    </div>`;

  // Bloque de respaldo (si la plantilla es personalizada y faltan las anclas):
  // se agrega todo junto al final, compacto.
  const bloqueFallback = `
    <div style="margin-top:16px; border:1.5px solid #1A4D2E; border-radius:8px; padding:12px 16px; font-size:8.5pt; color:#333; page-break-inside:avoid;">
      <div style="font-weight:800; color:#1A4D2E; margin-bottom:6px;">${tipoTexto.toUpperCase()}</div>
      <div><strong>Emisor:</strong> ${razon} · <strong>NIT:</strong> ${fel?.emisor?.nit || ''}</div>
      <div><strong>Serie:</strong> ${doc.serie || ''} · <strong>Número:</strong> ${doc.numero || ''}</div>
      <div><strong>No. Autorización:</strong> <span style="font-family:monospace;">${doc.numero_autorizacion}</span></div>
      <div><strong>Certificación:</strong> ${fechaCert} · INFILE, S.A.</div>
      <div style="margin-top:4px;"><strong>Gravable:</strong> Q ${fmt(doc.monto_gravable)} · <strong>IVA:</strong> Q ${fmt(doc.monto_iva)} · <strong>Total:</strong> Q ${fmt(doc.gran_total)}</div>
      ${leyenda}
    </div>`;

  return { emisorLinea, detalles, ivaRows, leyenda, tagline: tipoTexto, bloqueFallback };
}

export function compilePrintTemplate(templateText: string, invoice: any, sellerName: string, fel?: FelPrintData): string {
  try {
    const formatGT = (num: number) => {
      const n = Number(num);
      return isNaN(n) ? '0' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    };
    const isCredit = true; // Forzar crédito siempre (las ventas solo se pueden ir a crédito)
    const phoneVal = invoice.phone || invoice.customerPhone || 'N/A';
    const addressVal = invoice.address || 'Ciudad';

    const clientPhoneLine = phoneVal ? ('<div class="metadata-line">' + phoneVal + '</div>') : '';
    const clientAddressLine = addressVal ? ('<div class="metadata-line">' + addressVal + '</div>') : '';

    const itemsTableRows = (invoice.items || []).map((item: any) => {
      const getVariantString = (item: any) => {
        let c = item.color || item.variant?.color;
        let s = item.size || item.variant?.size;
        if (!c && !s) return '';
        if (s === 'Única' || !s) return ` (${c || ''})`;
        return ` (${c || ''} / ${s || ''})`;
      };
      const variantStr = getVariantString(item);
      return '<tr>' +
        '<td class="col-producto notranslate" translate="no">' + (item.productName || '') + '<br/><small>' + variantStr + '</small></td>' +
        '<td class="col-cant">' + formatGT(item.quantity || 0) + '</td>' +
        '<td class="col-precio">' + formatGT(item.price || 0) + '</td>' +
        '<td class="col-subtotal">' + formatGT(item.total || 0) + '</td>' +
      '</tr>';
    }).join('');

    let t = templateText || DEFAULT_PRINT_TEMPLATE;

    // ---- Inyeccion FEL distribuida (antes de sustituir variables, porque
    // algunas anclas usan {{sellerName}}). Reparte los datos fiscales en las
    // secciones existentes para no empujar a una segunda pagina. ----
    if (t.includes('{{FEL_EMISOR}}') || t.includes('{{FEL_LEYENDA}}')) {
      // ---- Plantilla profesional nueva: reemplazo de marcadores FEL ----
      const felDoc: any = fel?.documento;
      const felCert = !!(felDoc && felDoc.estado === 'certificado' && felDoc.numero_autorizacion);
      const esFcam = felDoc?.tipo_dte === 'FCAM';
      const fmtQ = (n: any) => { const v = Number(n); return isNaN(v) ? '0.00' : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
      const razon = fel?.emisor?.nombre || '';
      const comercial = fel?.emisor?.nombreComercial || '';
      const emNombre = comercial || razon || 'AGRICOVET';
      const meta: string[] = [];
      if (razon && razon !== emNombre) meta.push(razon);
      if (fel?.emisor?.nit) meta.push('NIT: ' + fel.emisor.nit);
      const felEmisor = `<div class="em-name">${emNombre}</div>` + (meta.length ? `<div class="em-meta">${meta.join(' &middot; ')}</div>` : '');
      const tipoTexto = esFcam ? 'Factura Cambiaria Electrónica' : 'Factura Electrónica';
      const felDoctype = felCert ? (esFcam ? 'FACTURA CAMBIARIA ELECTRÓNICA<br/>LIBRE DE PROTESTO' : 'FACTURA ELECTRÓNICA') : 'COMPROBANTE DE VENTA';
      const felSerieNum = felCert ? `<div class="r"><b>Serie:</b> ${felDoc.serie || ''} &nbsp; <b>No.:</b> <span class="num">${felDoc.numero || ''}</span></div>` : '';
      const felDocDetails = felCert
        ? `<div class="kv" style="margin-top:6px; border-top:1px dashed #e5e7eb; padding-top:5px;"><b>Documento:</b> ${tipoTexto}</div><div class="kv"><b>No. Autorización:</b><br/><span style="font-family:monospace; font-size:8pt; word-break:break-all;">${felDoc.numero_autorizacion}</span></div><div class="kv"><b>Certificación:</b> ${fechaDDMMYYYY(felDoc.fecha_certificacion, true)} &middot; INFILE, S.A.</div>`
        : '';
      const felIvaRows = felCert
        ? `<tr><td class="muted">Monto Gravable</td><td class="r muted">Q ${fmtQ(felDoc.monto_gravable)}</td></tr><tr><td class="muted">IVA (12%)</td><td class="r muted">Q ${fmtQ(felDoc.monto_iva)}</td></tr>`
        : '';
      let felLeyenda = '';
      if (felCert) {
        const dias = Number(fel?.creditDays || 0);
        const esPrueba = String(felDoc.serie || '').toUpperCase().includes('PRUEBA') || fel?.emisor?.ambiente === 'pruebas';
        const banner = esPrueba ? `<span style="color:#92400e; font-weight:800;">DOCUMENTO DE PRUEBA &middot; SIN VALIDEZ FISCAL. </span>` : '';
        const camb = esFcam
          ? `Por esta <strong>FACTURA CAMBIARIA girada LIBRE DE PROTESTO</strong>, a ${dias > 0 ? dias + ' días' : 'la vista'} se servirá(n) usted(es) pagar a la orden o endoso de <strong>${razon || emNombre}</strong> el valor total de <strong>Q ${fmtQ(felDoc.gran_total)}</strong> por lo que aquí se extiende. El comprador declara haber recibido la mercadería a su entera satisfacción, da por bueno el valor total de este título de crédito y se compromete a pagarlo en la fecha de vencimiento. Esta factura no se considera cancelada si no la ampara el recibo de caja correspondiente. `
          : '';
        felLeyenda = `<div class="fel-legend">${banner}${camb}<span style="font-style:italic;">Frase: ${FRASE_FEL} Representación gráfica de un DTE generado y certificado electrónicamente ante la SAT.</span></div>`;
      }

      t = t.replace(/\{\{FEL_EMISOR\}\}/g, felEmisor)
           .replace(/\{\{FEL_DOCTYPE\}\}/g, felDoctype)
           .replace(/\{\{FEL_SERIE_NUM\}\}/g, felSerieNum)
           .replace(/\{\{FEL_DOC_DETAILS\}\}/g, felDocDetails)
           .replace(/\{\{FEL_IVA_ROWS\}\}/g, felIvaRows)
           .replace(/\{\{FEL_LEYENDA\}\}/g, felLeyenda);
    } else {
      // ---- Plantilla antigua: inyeccion por anclas (compatibilidad) ----
      const frag = construirFragmentosFel(fel);
      if (frag) {
        let ok = false;

        // Modo compacto: el bloque fiscal agrega contenido; se recupera espacio
        // ajustando margenes para mantener el documento en una sola pagina.
        const estiloCompacto = `
      <style id="fel-compacto">
        .header-container { margin-bottom: 8px !important; }
        /* Logo mas pequeño para ganar espacio vertical en el encabezado */
        .logo-details img { max-width: 95px !important; max-height: 85px !important; }
        .tagline { margin-bottom: 2px !important; font-size: 8.5pt !important; }
        .company-title { margin-bottom: 2px !important; font-size: 19pt !important; }
        .meta-info-text { margin-bottom: 0 !important; font-size: 8.8pt !important; line-height: 1.25 !important; }
        .policy-banner { margin-top: 5px !important; font-size: 8pt !important; padding: 3px 9px !important; }
        .info-grid { margin-bottom: 8px !important; }
        .section-heading { margin-bottom: 5px !important; }
        .info-profile-name { font-size: 11pt !important; margin-bottom: 3px !important; }
        .info-detail-item { margin-bottom: 1px !important; font-size: 9.3pt !important; }
        .modern-table { margin-bottom: 6px !important; }
        .modern-table td, .modern-table th { padding-top: 4px !important; padding-bottom: 4px !important; font-size: 9.5pt !important; }
        .totals-wrapper { margin-top: 6px !important; }
        .totals-subtable td { padding: 4px 14px !important; font-size: 10pt !important; }
      </style>`;
        t = t.replace(/<\/head>/i, estiloCompacto + '\n</head>');

        // 1) Encabezado: reemplazar tagline por el tipo de documento + emisor
        const taglineAntes = t;
        t = t.replace(/<div class="tagline">Comprobante de Venta ⚽<\/div>/, `<div class="tagline">${frag.tagline}</div>`);
        t = t.replace(/<div class="tagline">Comprobante de Venta<\/div>/, `<div class="tagline">${frag.tagline}</div>`);
        t = t.replace(/(<h1 class="company-title">[^<]*<\/h1>)/, `$1${frag.emisorLinea}`);

        // 2) Detalles del Documento: agregar tipo, serie, numero, autorizacion
        if (/<strong>Vendedor:<\/strong>\s*\{\{sellerName\}\}<\/div>/.test(t)) {
          t = t.replace(/(<strong>Vendedor:<\/strong>\s*\{\{sellerName\}\}<\/div>)/, `$1${frag.detalles}`);
          ok = true;
        }

        // 3) Totales: agregar monto gravable e IVA antes del gran total
        if (t.includes('grand-total')) {
          t = t.replace(/(<tr class="grand-total">)/, `${frag.ivaRows}$1`);
          ok = true;
        }

        // Quitar la leyenda de futbol (si existe) — no va en documento fiscal
        t = t.replace(/⚽ ¡VIVIENDO LA PASIÓN DEL FÚTBOL CON AGRICOVET! 🥅/g, '');

        // 4) Leyenda compacta al final. Si las anclas principales existieron, solo
        // la leyenda; si la plantilla es personalizada y no matchearon, el bloque
        // de respaldo completo.
        if (ok || t !== taglineAntes) {
          t = t.replace(/<\/body>/i, frag.leyenda + '\n</body>');
        } else {
          t = t.replace(/<\/body>/i, frag.bloqueFallback + '\n</body>');
        }
      }
    }

    // Support both types of loop: {{#each items}} ... {{/each}} and old {{itemsTableRows}}
    const loopRegex = /\{\{#each items\}\}([\s\S]*?)\{\{\/each\}\}/g;
    t = t.replace(loopRegex, (_, loopBody) => {
      return (invoice.items || []).map((item: any) => {
        let row = loopBody;
        
        const getVariantInfo = (item: any) => {
          let c = item.color || item.variant?.color;
          let s = item.size || item.variant?.size;
          if (!c && !s) return '';
          if (s === 'Única' || !s) return c || '';
          return `${c || ''} / ${s || ''}`;
        };
        const variantInfo = getVariantInfo(item);
        row = row.replace(/\{\{this\.variantInfo\}\}/g, variantInfo);
        row = row.replace(/\{\{variantInfo\}\}/g, variantInfo);

        let finalProductName = String(item.productName || '');
        if (variantInfo && !loopBody.includes('variantInfo')) {
            finalProductName += `<br/><span style="font-size: 8.5pt; color: #555555; font-weight: normal; display: block; margin-top: 2px;">${variantInfo}</span>`;
        }

        row = row.replace(/\{\{this\.productName\}\}/g, '<span class="notranslate" translate="no">' + finalProductName + '</span>');
        row = row.replace(/\{\{productName\}\}/g, '<span class="notranslate" translate="no">' + finalProductName + '</span>');
        
        row = row.replace(/\{\{this\.quantity\}\}/g, formatGT(item.quantity || 0));
        row = row.replace(/\{\{quantity\}\}/g, formatGT(item.quantity || 0));
        
        row = row.replace(/\{\{this\.price\}\}/g, formatGT(item.price || 0));
        row = row.replace(/\{\{price\}\}/g, formatGT(item.price || 0));
        
        row = row.replace(/\{\{this\.subtotal\}\}/g, formatGT(item.total || 0));
        row = row.replace(/\{\{subtotal\}\}/g, formatGT(item.total || 0));
        
        return row;
      }).join('\n');
    });

    // Base substitutions
    t = t.replace(/\{\{id\}\}/g, String(invoice.id || ''));
    t = t.replace(/\{\{client\}\}/g, String(invoice.client || ''));
    t = t.replace(/\{\{customerName\}\}/g, String(invoice.client || ''));
    t = t.replace(/\{\{customerNit\}\}/g, String(invoice.nit || 'CF'));
    t = t.replace(/\{\{customerAddress\}\}/g, String(invoice.address || 'Ciudad'));
    t = t.replace(/\{\{clientPhoneLine\}\}/g, clientPhoneLine);
    t = t.replace(/\{\{clientAddressLine\}\}/g, clientAddressLine);
    t = t.replace(/\{\{phone\}\}/g, phoneVal);
    t = t.replace(/\{\{address\}\}/g, addressVal);
    t = t.replace(/\{\{folio\}\}/g, String(invoice.folio || 1));
    t = t.replace(/\{\{date\}\}/g, invoice.date ? fechaDDMMYYYY(invoice.date) : '');
    t = t.replace(/\{\{paymentForm\}\}/g, isCredit ? 'CREDITO' : 'CONTADO');
    t = t.replace(/\{\{status\}\}/g, isCredit ? 'POR COBRAR' : (invoice.status === 'cancelled' || invoice.status === 'rejected' ? 'ANULADA' : 'PAGADO'));
    t = t.replace(/\{\{sellerName\}\}/g, sellerName);
    t = t.replace(/\{\{itemsTableRows\}\}/g, itemsTableRows);
    t = t.replace(/\{\{totalAmount\}\}/g, formatGT(invoice.totalAmount || 0));
    t = t.replace(/\{\{paidAmount\}\}/g, formatGT(invoice.paidAmount || 0));
    t = t.replace(/\{\{dueAmount\}\}/g, formatGT((invoice.totalAmount || 0) - (invoice.paidAmount || 0)));
    
    // Signatures
    t = t.replace(/\{\{sellerSignature\}\}/g, invoice.sellerSignature || '');
    t = t.replace(/\{\{adminSignature\}\}/g, invoice.adminSignature || '');
    t = t.replace(/\{\{reviewedBy\}\}/g, invoice.reviewedBy || '');

    t = t.replace(/\{\{#if sellerSignature\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, inner) => {
        return invoice.sellerSignature ? inner.replace(/\{\{sellerSignature\}\}/g, invoice.sellerSignature) : '';
    });
    t = t.replace(/\{\{#if adminSignature\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, inner) => {
        return invoice.adminSignature ? inner.replace(/\{\{adminSignature\}\}/g, invoice.adminSignature).replace(/\{\{reviewedBy\}\}/g, invoice.reviewedBy || '') : '';
    });
    const storedLogo = localStorage.getItem('app_logo_url');
    const logoUrl = storedLogo && (storedLogo.startsWith('http') || storedLogo.startsWith('data:')) ? storedLogo : `${window.location.origin}/agricovet.png`;
    t = t.replace(/\{\{logoUrl\}\}/g, logoUrl);
    t = t.replace(/\{\{origin\}\}\/agricovet\.png/g, logoUrl);
    t = t.replace(/\{\{origin\}\}/g, window.location.origin);

    return t;
  } catch (e) {
    console.error('Error compiling template:', e);
    return `<h1>Error al generar ticket</h1><p>${String(e)}</p>`;
  }
}

export function generateDeliveryLetterHtml(invoice: any, sellerName: string): string {
  const dateStr = new Date().toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const logoUrl = localStorage.getItem('app_logo_url') || `${window.location.origin}/agricovet.png`;
  
  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; line-height: 1.6;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #0b4d2c; padding-bottom: 20px;">
        <div>
          <img src="${logoUrl}" alt="Agricovet Logo" style="max-width: 150px; max-height: 80px; object-fit: contain;" />
          <h1 style="color: #0b4d2c; margin: 10px 0 5px 0; font-size: 24px;">Carta de Entrega de Mercadería</h1>
          <p style="margin: 0; color: #666; font-size: 14px;">Folio de Venta: #${invoice.folio || invoice.id.substring(0,8)}</p>
        </div>
        <div style="text-align: right; font-size: 14px;">
          <p style="margin: 0;">Fecha de Emisión: ${dateStr}</p>
          <p style="margin: 0;">Vendedor: ${sellerName}</p>
        </div>
      </div>

      <div style="margin-bottom: 30px;">
        <h3 style="color: #0b4d2c; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Datos del Cliente</h3>
        <table style="width: 100%; font-size: 14px;">
          <tr>
            <td style="padding: 5px 0; width: 120px;"><strong>Nombre/Razón:</strong></td>
            <td>${invoice.client}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>NIT/CF:</strong></td>
            <td>${invoice.nit || 'C/F'}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Teléfono:</strong></td>
            <td>${invoice.phone || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0;"><strong>Dirección:</strong></td>
            <td>${invoice.address || 'N/A'}</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom: 40px;">
        <h3 style="color: #0b4d2c; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Detalle de Mercadería Entregada</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background-color: #f8fafc;">
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Cant.</th>
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Descripción</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.map((item: any) => {
              const c = item.color || item.variant?.color;
              const s = item.size || item.variant?.size;
              let varStr = '';
              if (c || s) {
                if (s === 'Única' || !s) varStr = ` (${c || ''})`;
                else if (!c) varStr = ` (${s})`;
                else varStr = ` (${c} / ${s})`;
              }
              return `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.quantity}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.productName}${varStr}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 60px; font-size: 14px;">
        <p>Por medio de la presente, confirmo que he recibido de conformidad la mercadería detallada anteriormente, en las cantidades y condiciones indicadas, por parte de <strong>Agricovet</strong>.</p>
        
        <div style="margin-top: 80px; display: flex; justify-content: space-around;">
          <div style="text-align: center; width: 250px;">
            <div style="border-bottom: 1px solid #333; height: 1px; margin-bottom: 10px;"></div>
            <p style="margin: 0;"><strong>Firma de Recibido (Cliente)</strong></p>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">Nombre: ______________________</p>
            <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">DPI: _________________________</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function printHtml(html: string) {
  // 1. Create or retrieve the print container directly under body
  let printSec = document.getElementById('print-receipt-section');
  if (!printSec) {
    printSec = document.createElement('div');
    printSec.id = 'print-receipt-section';
    document.body.appendChild(printSec);
  }

  // 2. Set the entire compiled HTML as the print container's content.
  // This imports the full head, style tags, and body of the receipt template inside it.
  printSec.innerHTML = html;

  // 3. Inject our global print stylesheet to control display and responsive tables
  let printStyle = document.getElementById('print-receipt-style');
  if (!printStyle) {
    printStyle = document.createElement('style');
    printStyle.id = 'print-receipt-style';
    document.head.appendChild(printStyle);
  }

  printStyle.innerHTML = `
    /* Hiding rules for screen (when we are NOT printing, this section is completely invisible) */
    #print-receipt-section {
      display: none !important;
    }

    @media print {
      html, body {
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
        position: static !important;
        display: block !important;
        background: white !important;
        color: black !important;
        padding: 0 !important;
        margin: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      #print-receipt-section {
        display: block !important;
        position: static !important;
        overflow: visible !important;
        width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        color: black !important;
        visibility: visible !important;
      }

      #print-receipt-section * {
        visibility: visible !important;
      }

      /* Force standard CSS tables to layout properly during print pagination */
      #print-receipt-section table {
        display: table !important;
        width: 100% !important;
      }
      #print-receipt-section tr {
        display: table-row !important;
      }
      #print-receipt-section th, #print-receipt-section td {
        display: table-cell !important;
      }
    }
  `;

  // 4. Force hide all siblings of printSec directly under body using direct inline JavaScript styles.
  // This bypasses any flaky media queries or browser bugs that ignore parent display: none container rules.
  const otherBodyChildren: { element: HTMLElement; display: string; visibility: string }[] = [];
  Array.from(document.body.children).forEach((child) => {
    if (child instanceof HTMLElement && child !== printSec && child.tagName !== 'SCRIPT' && child.tagName !== 'STYLE') {
      otherBodyChildren.push({
        element: child,
        display: child.style.display,
        visibility: child.style.visibility
      });
      child.style.setProperty('display', 'none', 'important');
      child.style.setProperty('visibility', 'hidden', 'important');
    }
  });

  // Make the print container visible
  printSec.style.setProperty('display', 'block', 'important');
  printSec.style.setProperty('visibility', 'visible', 'important');

  // Helper function to restore original system state
  const restoreApp = () => {
    // Restore siblings' original style attributes
    otherBodyChildren.forEach(({ element, display, visibility }) => {
      if (display) {
        element.style.setProperty('display', display);
      } else {
        element.style.removeProperty('display');
      }
      if (visibility) {
        element.style.setProperty('visibility', visibility);
      } else {
        element.style.removeProperty('visibility');
      }
    });

    // Reset print elements
    if (printSec) {
      printSec.innerHTML = '';
      printSec.style.setProperty('display', 'none', 'important');
      printSec.style.setProperty('visibility', 'hidden', 'important');
    }
    if (printStyle) {
      printStyle.innerHTML = `#print-receipt-section { display: none !important; }`;
    }
  };

  // 5. Wait for all images inside printSec to load before triggering window.print()
  const images = printSec.querySelectorAll('img');
  let loadedCount = 0;
  const totalImages = images.length;

  const triggerPrint = () => {
    try {
      window.print();
    } catch (e) {
      console.error('Window print dialog error:', e);
    }
  };

  if (totalImages === 0) {
    setTimeout(triggerPrint, 350);
  } else {
    let printTriggered = false;
    const onImageLoaded = () => {
      loadedCount++;
      if (loadedCount === totalImages && !printTriggered) {
        printTriggered = true;
        triggerPrint();
      }
    };

    // Safety timeout in case an image fails to load or hangs
    const safetyTimeout = setTimeout(() => {
      if (!printTriggered) {
        printTriggered = true;
        triggerPrint();
      }
    }, 1500);

    images.forEach((img) => {
      if (img.complete) {
        onImageLoaded();
      } else {
        img.addEventListener('load', onImageLoaded);
        img.addEventListener('error', onImageLoaded);
      }
    });
  }

  // 6. Bind print completion or cancel event to restore original application state
  window.addEventListener('afterprint', restoreApp, { once: true });
  
  // Safety fallback in case afterprint does not fire on specific client webviews
  setTimeout(restoreApp, 20000);
}

export function downloadHtmlAsPdf(html: string, filename: string = 'factura.pdf') {
  const opt = {
    margin: [0.3, 0.3, 0.3, 0.3],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] }
  };
  
  const element = document.createElement('div');
  element.innerHTML = html;
  
  // @ts-ignore
  html2pdf().from(element).set(opt).save();
}

