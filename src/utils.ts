// @ts-ignore
import html2pdf from 'html2pdf.js';
import { biSealBase64, banruralSealBase64, defaultLogoBase64 } from './sealsBase64';

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
    <meta charset="UTF-8">
    <title>Recibo de Venta Profesional - AGRICOVET</title>
    <base href="{{origin}}/" />
    <style>
        @page {
            size: A4;
            margin: 15mm 15mm;
            background-color: #ffffff;
        }
        
        @media print {
            body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color: #000000 !important;
                background-color: #ffffff !important;
            }
            /* Clean black text with zero halftoning for superb readability and sharp printing */
            .info-detail-item, .meta-info-text, .tagline {
                color: #000000 !important;
                font-weight: 500 !important;
            }
            .totals-subtable .lbl {
                color: #000000 !important;
                font-weight: bold !important;
            }
            .modern-table td {
                color: #000000 !important;
                font-weight: 500 !important;
            }
            .info-profile-name {
                color: #000000 !important;
                font-weight: 800 !important;
            }
            .section-heading {
                color: #000000 !important;
                font-weight: 800 !important;
                border-bottom: 2px solid #000000 !important;
                display: block !important;
                padding-bottom: 3px !important;
            }
            /* Prevent blurry fonts on print rendering */
            body, p, td, th, div, span {
                text-shadow: none !important;
                box-shadow: none !important;
            }
        }

        * {
            box-sizing: border-box;
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
        }

        body {
            margin: 0;
            padding: 0;
            font-size: 11pt;
            line-height: 1.5;
            color: #111111; /* Clean high-contrast almost-black for screen and print */
        }

        tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }

        /* Encabezado */
        .header-container {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }

        .header-container td {
            vertical-align: middle;
            padding: 0;
        }

        .company-details {
            width: 70%;
        }

        .logo-details {
            width: 30%;
            text-align: right;
        }

        .tagline {
            font-size: 9.5pt;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #111111;
            font-weight: 700;
            margin-bottom: 4px;
        }

        .company-title {
            font-size: 26pt;
            font-weight: 800;
            color: #1A4D2E;
            margin: 0 0 8px 0;
            letter-spacing: -0.5px;
        }

        .meta-info-text {
            font-size: 10pt;
            color: #111111;
            margin-bottom: 3px;
        }

        .policy-banner {
            margin-top: 12px;
            display: inline-block;
            background-color: #F0FDF4;
            border-left: 3.5px solid #16A34A;
            padding: 6px 12px;
            font-size: 9.5pt;
            font-weight: 700;
            color: #14532D;
            border-radius: 0 4px 4px 0;
        }

        /* Bloques informativos de dos columnas */
        .info-grid {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }

        .info-grid td {
            width: 50%;
            vertical-align: top;
            padding: 0;
        }

        .info-card-left {
            padding-right: 15px;
        }

        .info-card-right {
            padding-left: 15px;
            border-left: 2px solid #E2E8F0;
        }

        .section-heading {
            font-size: 10.5pt;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #1A4D2E;
            font-weight: 800;
            margin-bottom: 10px;
            border-bottom: 1.5px solid #E2E8F0;
            padding-bottom: 2px;
        }

        .info-profile-name {
            font-size: 12.5pt;
            font-weight: 800;
            color: #000000;
            margin-bottom: 6px;
        }

        .info-detail-item {
            font-size: 10.5pt;
            color: #111111;
            margin-bottom: 4px;
        }

        /* Tabla Moderna */
        .modern-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
        }

        .modern-table th {
            background-color: #1A4D2E;
            color: #ffffff;
            font-weight: 700;
            font-size: 10pt;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 12px 14px;
            border: none;
        }

        .modern-table th.align-left { text-align: left; border-radius: 6px 0 0 6px; }
        .modern-table th.align-center { text-align: center; }
        .modern-table th.align-right { text-align: right; border-radius: 0 6px 6px 0; }

        .modern-table td {
            padding: 12px 14px;
            font-size: 11pt;
            border-bottom: 1px solid #E2E8F0;
            color: #000000;
        }

        .modern-table tr:nth-child(even) td {
            background-color: #F8FAFC;
        }

        /* Firmas */
        .signature-section {
            margin-top: 40px;
            width: 100%;
            border-collapse: collapse;
            page-break-inside: avoid;
        }
        .signature-box {
            width: 50%;
            text-align: center;
            padding: 10px;
            vertical-align: bottom;
        }
        .signature-line {
            border-top: 1.5px solid #000;
            margin-top: 50px;
            padding-top: 6px;
            font-size: 10pt;
            font-weight: 800;
            text-transform: uppercase;
            color: #000;
        }
        .signature-img {
            max-width: 160px;
            max-height: 80px;
            display: block;
            margin: 0 auto -45px auto;
        }

        .text-left { text-align: left; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }

        /* Estructura de Totales */
        .totals-wrapper {
            width: 100%;
            margin-top: 20px;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }

        .totals-subtable {
            width: 45%;
            margin-left: 55%;
            border-collapse: collapse;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }

        .totals-subtable td {
            padding: 9px 14px;
            font-size: 11pt;
        }

        .totals-subtable tr.border-top td {
            border-top: 2px solid #E2E8F0;
        }

        .totals-subtable .lbl {
            color: #333333;
            text-align: right;
            font-weight: 700;
        }

        .totals-subtable .val {
            text-align: right;
            font-weight: 750;
            color: #000000;
            width: 45%;
        }

        .totals-subtable tr.grand-total td {
            background-color: #1A4D2E;
            padding: 11px 14px;
            border-radius: 6px;
        }

        .totals-subtable tr.grand-total .lbl {
            color: #ffffff;
            font-weight: 700;
        }

        .totals-subtable tr.grand-total .val {
            color: #ffffff;
            font-size: 13pt;
            font-weight: 800;
        }

        .logo-svg {
            width: 130px;
            height: 130px;
        }
    </style>
</head>
<body>

    <table class="header-container">
        <tr>
            <td class="company-details">
                <div class="tagline">Comprobante de Venta ⚽</div>
                <h1 class="company-title">AGRICOVET</h1>
                <div class="meta-info-text"><strong>Gerencia:</strong> Agricovetsa@gmail.com</div>
                <div class="meta-info-text"><strong>Teléfono:</strong> +502 3645 0241</div>
                <div class="meta-info-text">Barrio Segunda Lotificación, Santa Elena, Petén</div>
                <div class="policy-banner">CAMBIO O DEVOLUCIONES TIENE VIGENCIA DE 8 DÍAS 🏆</div>
            </td>
            <td class="logo-details">
                <!-- Logotipo Oficial del Usuario -->
                <img src="{{logoUrl}}" alt="AGRICOVET Logo" style="max-width: 160px; max-height: 140px; object-fit: contain;" />
            </td>
        </tr>
    </table>

    <table class="info-grid">
        <tr>
            <td>
                <div class="info-card-left">
                    <div class="section-heading">Cliente</div>
                    <div class="info-profile-name">{{customerName}}</div>
                    <div class="info-detail-item"><strong>NIT:</strong> {{customerNit}}</div>
                    <div class="info-detail-item"><strong>Dirección:</strong> {{customerAddress}}</div>
                    <div class="info-detail-item"><strong>Teléfono:</strong> {{phone}}</div>
                </div>
            </td>
            <td>
                <div class="info-card-right">
                    <div class="section-heading">Detalles del Documento</div>
                    <div class="info-detail-item"><strong>Folio:</strong> <span style="color: #1A4D2E; font-weight: bold;">#{{folio}}</span></div>
                    <div class="info-detail-item"><strong>Fecha:</strong> {{date}}</div>
                    <div class="info-detail-item"><strong>Forma de Pago:</strong> {{paymentForm}}</div>
                    <div class="info-detail-item"><strong>Estado:</strong> {{status}}</div>
                    <div class="info-detail-item"><strong>Vendedor:</strong> {{sellerName}}</div>
                </div>
            </td>
        </tr>
    </table>

    <table class="modern-table">
        <thead>
            <tr>
                <th class="align-left" style="width: 50%;">Producto</th>
                <th class="align-center" style="width: 15%;">Cantidad</th>
                <th class="align-right" style="width: 15%;">Precio</th>
                <th class="align-right" style="width: 20%;">Subtotal</th>
            </tr>
        </thead>
        <tbody>
            {{#each items}}
            <tr>
                <td class="text-left" style="font-weight: 500;">
                    {{this.productName}}
                    <div style="font-size: 8.5pt; color: #555555; font-weight: normal; margin-top: 2px;">{{this.variantInfo}}</div>
                </td>
                <td class="text-center">{{this.quantity}}</td>
                <td class="text-right">Q {{this.price}}</td>
                <td class="text-right" style="font-weight: 600;">Q {{this.subtotal}}</td>
            </tr>
            {{/each}}
        </tbody>
    </table>

    <div class="totals-wrapper">
        <table class="totals-subtable">
            <tr>
                <td class="lbl">Total Bruto</td>
                <td class="val">Q {{totalAmount}}</td>
            </tr>
            <tr class="border-top">
                <td class="lbl">Pagos Recibidos</td>
                <td class="val" style="color: #16A34A;">Q {{paidAmount}}</td>
            </tr>
            <tr class="grand-total">
                <td class="lbl">Total a Pagar</td>
                <td class="val">Q {{dueAmount}}</td>
            </tr>
        </table>
    </div>

    <table class="signature-section" style="margin-top: 20px;">
        <tr>
            <td class="signature-box">
                {{#if sellerSignature}}
                    <img src="{{sellerSignature}}" class="signature-img" />
                {{/if}}
                <div class="signature-line">Firma Vendedor</div>
            </td>
            <td class="signature-box">
                {{#if adminSignature}}
                    <img src="{{adminSignature}}" class="signature-img" />
                    <div style="font-size: 8pt; margin-top: 4px; font-weight: bold; color: #1A4D2E;">Revisado por: {{reviewedBy}}</div>
                {{/if}}
                <div class="signature-line">Revisado por (Admin)</div>
            </td>
        </tr>
    </table>

    <table style="width: 100%; margin-top: 25px; border-collapse: collapse; page-break-inside: avoid;">
        <tr>
            <td style="width: 48%; text-align: center; vertical-align: middle; padding: 5px;">
                <div style="border: none; padding: 0;">
                    <div style="font-size: 9pt; font-weight: 800; color: #1A4D2E; text-transform: uppercase; margin-bottom: 4px;">Depositar a: BANCO INDUSTRIAL</div>
                    <div style="font-size: 11pt; font-weight: 900; color: #000; margin: 2px 0;">035-015252-6</div>
                    <div style="font-size: 9pt; font-weight: 700; color: #555555; margin: 2px 0;">Agricovet de Guatemala</div>
                </div>
            </td>
            <td style="width: 4%;">&nbsp;</td>
            <td style="width: 48%; text-align: center; vertical-align: middle; padding: 5px;">
                <div style="border: none; padding: 0;">
                    <div style="font-size: 9pt; font-weight: 800; color: #1A4D2E; text-transform: uppercase; margin-bottom: 4px;">Depositar a: BANRURAL</div>
                    <div style="font-size: 11pt; font-weight: 900; color: #000; margin: 2px 0;">3580029532</div>
                    <div style="font-size: 9pt; font-weight: 700; color: #555555; margin: 2px 0;">Agricovet de Guatemala</div>
                </div>
            </td>
        </tr>
    </table>
    <div style="text-align: center; margin-top: 20px; padding-bottom: 20px;">
        <img src="{{logoUrl}}" alt="Agricovet Logo" style="width: 80px; height: 80px; object-fit: contain; opacity: 0.9;" />
    </div>
</body>
</html>`;

export function formatMoney(num: number | undefined | string) {
  if (num === undefined || num === null) return 'Q0.00';
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return 'Q0.00';
  return 'Q' + n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  });
}

/**
 * Converts an image URL to a Base64 string.
 * This is crucial for html2pdf.js and window.print() to correctly render images
 * without CORS or loading race condition issues.
 */
async function getBase64Image(url: string): Promise<string> {
  if (!url || url.startsWith('data:')) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return url;
  }
}

async function convertAllImagesToBase64(container: HTMLElement) {
  const imgs = Array.from(container.querySelectorAll('img'));
  const promises = imgs.map(async (img) => {
    const originalSrc = img.getAttribute('src');
    if (originalSrc && !originalSrc.startsWith('data:')) {
      const b64 = await getBase64Image(originalSrc);
      if (b64.startsWith('data:')) {
        img.src = b64;
      }
    }
  });
  await Promise.allSettled(promises);
}

export function compilePrintTemplate(templateText: string, invoice: any, sellerName: string): string {
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

    if (!t.includes('Cuenta BANCO INDUSTRIAL') && !t.includes('biSealUrl')) {
        const sealsHtml = `
    <table style="width: 100%; margin-top: 25px; border-collapse: collapse; page-break-inside: avoid;">
        <tr>
            <td style="width: 48%; text-align: center; vertical-align: middle; padding: 5px;">
                <div style="border: none; padding: 0;">
                    <div style="font-size: 9pt; font-weight: 800; color: #1A4D2E; text-transform: uppercase; margin-bottom: 4px;">Depositar a: BANCO INDUSTRIAL</div>
                    <div style="font-size: 11pt; font-weight: 900; color: #000; margin: 2px 0;">035-015252-6</div>
                    <div style="font-size: 9pt; font-weight: 700; color: #555555; margin: 2px 0;">Agricovet de Guatemala</div>
                </div>
            </td>
            <td style="width: 4%;">&nbsp;</td>
            <td style="width: 48%; text-align: center; vertical-align: middle; padding: 5px;">
                <div style="border: none; padding: 0;">
                    <div style="font-size: 9pt; font-weight: 800; color: #1A4D2E; text-transform: uppercase; margin-bottom: 4px;">Depositar a: BANRURAL</div>
                    <div style="font-size: 11pt; font-weight: 900; color: #000; margin: 2px 0;">3580029532</div>
                    <div style="font-size: 9pt; font-weight: 700; color: #555555; margin: 2px 0;">Agricovet de Guatemala</div>
                </div>
            </td>
        </tr>
    </table>
`;
        t = t.replace('</body>', sealsHtml + '</body>');
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
    t = t.replace(/\{\{date\}\}/g, invoice.date ? (isNaN(new Date(invoice.date).getTime()) ? '' : new Date(invoice.date).toISOString().split('T')[0]) : '');
    t = t.replace(/\{\{paymentForm\}\}/g, isCredit ? 'CREDITO' : 'CONTADO');
    t = t.replace(/\{\{status\}\}/g, isCredit ? 'POR COBRAR' : (invoice.status === 'cancelled' || invoice.status === 'rejected' ? 'ANULADA' : 'PAGADO'));
    t = t.replace(/\{\{sellerName\}\}/g, sellerName);
    t = t.replace(/\{\{itemsTableRows\}\}/g, itemsTableRows);
    t = t.replace(/\{\{totalAmount\}\}/g, formatGT(invoice.totalAmount || 0));
    t = t.replace(/\{\{paidAmount\}\}/g, formatGT(invoice.paidAmount || 0));
    t = t.replace(/\{\{dueAmount\}\}/g, formatGT((invoice.totalAmount || 0) - (invoice.paidAmount || 0)));
    
    // Signatures and Seals
    t = t.replace(/\{\{sellerSignature\}\}/g, invoice.sellerSignature || '');
    t = t.replace(/\{\{adminSignature\}\}/g, invoice.adminSignature || '');
    t = t.replace(/\{\{reviewedBy\}\}/g, invoice.reviewedBy || '');
    
    const origin = window.location.origin;
    const storedLogo = localStorage.getItem('app_logo_url');
    let finalLogoUrl = storedLogo || `${origin}/agricovet.png`;
    
    if (finalLogoUrl && !finalLogoUrl.startsWith('http') && !finalLogoUrl.startsWith('data:')) {
      const cleanPath = finalLogoUrl.startsWith('/') ? finalLogoUrl : `/${finalLogoUrl}`;
      finalLogoUrl = `${origin}${cleanPath}`;
    }
    
    // Replace all logo placeholders
    if (finalLogoUrl === `${origin}/agricovet.png` || finalLogoUrl === '/agricovet.png') {
        t = t.replace(/\{\{logoUrl\}\}/g, defaultLogoBase64);
        t = t.replace(/\{\{origin\}\}\/agricovet\.png/g, defaultLogoBase64);
    } else {
        t = t.replace(/\{\{logoUrl\}\}/g, finalLogoUrl);
        t = t.replace(/\{\{origin\}\}\/agricovet\.png/g, finalLogoUrl);
    }
    
    // Signatures
    t = t.replace(/\{\{#if sellerSignature\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, inner) => {
        return invoice.sellerSignature ? inner.replace(/\{\{sellerSignature\}\}/g, invoice.sellerSignature) : '';
    });
    t = t.replace(/\{\{#if adminSignature\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, inner) => {
        return invoice.adminSignature ? inner.replace(/\{\{adminSignature\}\}/g, invoice.adminSignature).replace(/\{\{reviewedBy\}\}/g, invoice.reviewedBy || '') : '';
    });
    
    // Use absolute URLs for seals
    t = t.replace(/\{\{biSealUrl\}\}/g, biSealBase64);
    t = t.replace(/\{\{banruralSealUrl\}\}/g, banruralSealBase64);
    
    // Finally replace origin for any other relative links
    t = t.replace(/\{\{origin\}\}/g, origin);

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

export async function printHtml(html: string) {
  // 1. Create or retrieve the print container directly under body
  let printSec = document.getElementById('print-receipt-section');
  if (!printSec) {
    printSec = document.createElement('div');
    printSec.id = 'print-receipt-section';
    document.body.appendChild(printSec);
  }

  // 2. Set content and convert images to Base64
  printSec.innerHTML = html;
  await convertAllImagesToBase64(printSec);

  // 3. Inject global print stylesheet
  let printStyle = document.getElementById('print-receipt-style');
  if (!printStyle) {
    printStyle = document.createElement('style');
    printStyle.id = 'print-receipt-style';
    document.head.appendChild(printStyle);
  }
  printStyle.innerHTML = `
    @media print {
      body > *:not(#print-receipt-section) { display: none !important; }
      #print-receipt-section { 
        display: block !important;
        position: absolute !important; 
        left: 0 !important; 
        top: 0 !important; 
        width: 100% !important; 
        margin: 0 !important;
        padding: 0 !important;
      }
      @page { size: auto; margin: 0; }
    }
    #print-receipt-section { display: none; }
  `;

  // 4. Wait for all images to load
  const images = Array.from(printSec.querySelectorAll('img'));
  let loadedCount = 0;
  let printTriggered = false;

  const triggerPrint = () => {
    if (printTriggered) return;
    printTriggered = true;
    window.print();
  };

  const onImageLoaded = () => {
    loadedCount++;
    if (loadedCount >= images.length) {
      setTimeout(triggerPrint, 500);
    }
  };

  if (images.length === 0) {
    setTimeout(triggerPrint, 500);
  } else {
    images.forEach((img) => {
      if (img.complete && img.naturalWidth > 0) {
        onImageLoaded();
      } else {
        img.addEventListener('load', onImageLoaded);
        img.addEventListener('error', onImageLoaded);
      }
    });
    // Safety timeout
    setTimeout(triggerPrint, 6000);
  }

  // 5. Cleanup after print
  const restoreApp = () => {
    if (printSec) {
      printSec.innerHTML = '';
      printSec.style.display = 'none';
    }
  };
  window.addEventListener('afterprint', restoreApp, { once: true });
  setTimeout(restoreApp, 20000);
}

export async function downloadHtmlAsPdf(html: string, filename: string = 'factura.pdf') {
  const opt = {
    margin: [0.3, 0.3, 0.3, 0.3],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true,
      logging: false,
      allowTaint: true
    },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] }
  };
  
  const element = document.createElement('div');
  element.innerHTML = html;
  
  // Convert images to base64 before passing to html2pdf
  await convertAllImagesToBase64(element);
  
  // @ts-ignore
  html2pdf().from(element).set(opt).save();
}

