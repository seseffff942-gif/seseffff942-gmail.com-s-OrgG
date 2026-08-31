import { biSealBase64, banruralSealBase64, defaultLogoBase64 } from './sealsBase64';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatDateSafe(dateStr?: string | Date | null, formatPattern = "dd/MM/yyyy"): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return format(d, formatPattern, { locale: es });
  } catch {
    return 'N/A';
  }
}

export function normalizeSearchText(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function getGuatemalaTodayIso(): string {
  // Guatemala is UTC-6
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const gtDate = new Date(utc - (6 * 3600000));
  return gtDate.toISOString().split('T')[0];
}

export function isTodayGuatemala(dateStr?: string | Date | null): boolean {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const gtD = new Date(utc - (6 * 3600000)).toISOString().split('T')[0];
    return gtD === getGuatemalaTodayIso();
  } catch {
    return false;
  }
}

export interface SlowMovingProduct {
  id: string;
  name: string;
  category?: string;
  stock: number;
  price: number;
  image?: string;
  daysWithoutSale: number | null;
  neverSold: boolean;
  lastSaleDate?: string;
  totalSoldLast30Days: number;
  recommendationReason: string;
  suggestedAction: string;
}

export function calculateSlowMovingProducts(products: any[], invoices: any[], daysThreshold = 15): SlowMovingProduct[] {
  if (!products || products.length === 0) return [];
  const now = new Date().getTime();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  // Map each product to its sales history
  const salesMap = new Map<string, { lastSaleDate?: string; totalSold30d: number }>();

  (invoices || []).forEach(inv => {
    if (inv.isCancelled || inv.status === 'anulada') return;
    const invDate = inv.date || inv.createdAt;
    if (!invDate) return;
    const invTime = new Date(invDate).getTime();
    const isWithin30d = now - invTime <= THIRTY_DAYS_MS;

    (inv.items || []).forEach((item: any) => {
      const pId = item.productId || item.id;
      const pName = item.productName || item.name;
      const key = pId || pName;
      if (!key) return;

      const current = salesMap.get(key) || { lastSaleDate: undefined, totalSold30d: 0 };
      if (!current.lastSaleDate || invTime > new Date(current.lastSaleDate).getTime()) {
        current.lastSaleDate = invDate;
      }
      if (isWithin30d) {
        current.totalSold30d += (Number(item.quantity) || 1);
      }
      salesMap.set(key, current);

      if (pName) {
        salesMap.set(pName.toLowerCase().trim(), current);
      }
    });
  });

  const slowProducts: SlowMovingProduct[] = [];

  products.forEach(p => {
    if (!p || (p.stock !== undefined && p.stock <= 0)) return; // Only products with available stock
    const pNameKey = (p.name || '').toLowerCase().trim();
    const sales = salesMap.get(p.id) || salesMap.get(pNameKey);

    let daysWithoutSale: number | null = null;
    let neverSold = true;
    let lastSaleDate: string | undefined = undefined;
    let totalSoldLast30Days = 0;

    if (sales && sales.lastSaleDate) {
      lastSaleDate = sales.lastSaleDate;
      totalSoldLast30Days = sales.totalSold30d;
      const lastTime = new Date(sales.lastSaleDate).getTime();
      daysWithoutSale = Math.max(0, Math.floor((now - lastTime) / (1000 * 60 * 60 * 24)));
      neverSold = false;
    }

    if (neverSold || (daysWithoutSale !== null && daysWithoutSale >= daysThreshold) || totalSoldLast30Days === 0) {
      let reason = "Sin ventas en los últimos 30 días";
      let action = "Ofrecer promoción o descuento por volumen";
      if (neverSold) {
        reason = "Sin ventas registradas (Stock disponible en bodega)";
        action = "Presentar al cliente como producto recomendado";
      } else if (daysWithoutSale !== null && daysWithoutSale > 45) {
        reason = `Lleva ${daysWithoutSale} días sin movimiento`;
        action = "Priorizar para rotación rápida o descuento comercial";
      } else if (daysWithoutSale !== null && daysWithoutSale >= 15) {
        reason = `Baja rotación (${daysWithoutSale} días sin venta)`;
        action = "Sugerir como compra complementaria";
      }

      slowProducts.push({
        id: p.id,
        name: p.name || 'Producto',
        category: p.category,
        stock: p.stock ?? 0,
        price: p.price ?? 0,
        image: p.image || p.imageUrl,
        daysWithoutSale,
        neverSold,
        lastSaleDate,
        totalSoldLast30Days,
        recommendationReason: reason,
        suggestedAction: action
      });
    }
  });

  return slowProducts.sort((a, b) => {
    if (a.neverSold !== b.neverSold) {
      return a.neverSold ? -1 : 1;
    }
    const aDays = a.daysWithoutSale ?? 0;
    const bDays = b.daysWithoutSale ?? 0;
    if (bDays !== aDays) {
      return bDays - aDays;
    }
    return b.stock - a.stock;
  });
}

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

export function isTecunProduct(product: { id?: string; productId?: string; name?: string; productName?: string; category?: string } | null | undefined): boolean {
  if (!product) return false;
  const nameL = (product.name || product.productName || '').toLowerCase().trim();
  const catL = (product.category || '').toLowerCase().trim();
  
  if (catL.includes('tecun') || catL.includes('tecún') || nameL.includes('tecun') || nameL.includes('tecún')) {
    return true;
  }

  // Lista de marcas y productos exclusivos de la línea TECÚN
  const tecunKeywords = [
    'paraquat',
    'yerbatron',
    '2,4d',
    '2.4d',
    '2 4d',
    '24d',
    'killer 36',
    'nocaut',
    'poter 90',
    'glufosin',
    'cpf 48',
    'cpf 2dp',
    'titan 80',
    'semevin',
    'vereta',
    'certero',
    'cipermetrina 25',
    'vayego',
    'blindage'
  ];

  return tecunKeywords.some(keyword => nameL.includes(keyword));
}

export function calculateTecunStockBreakdown(product: { name?: string; category?: string; stock?: number } | null | undefined, requestedQty: number) {
  const isTecun = isTecunProduct(product);
  const rawStock = Number(product?.stock) || 0;
  const physicalStock = Math.max(0, rawStock);
  const requested = Math.max(0, Number(requestedQty) || 0);
  const fromWarehouse = Math.min(physicalStock, requested);
  const toOrderFromCompany = isTecun ? Math.max(0, requested - physicalStock) : 0;
  const hasShortage = isTecun && toOrderFromCompany > 0;
  return {
    isTecun,
    rawStock,
    physicalStock,
    requested,
    fromWarehouse,
    toOrderFromCompany,
    hasShortage
  };
}

export function is100gProduct(product: { name?: string; category?: string } | null | undefined): boolean {
  if (!product) return false;
  const nameL = (product.name || '').toLowerCase();
  const catL = (product.category || '').toLowerCase();
  const combined = `${nameL} ${catL}`;
  return /100\s*(g|gr|gram|gramos)\b/i.test(combined) ||
    combined.includes('100g') ||
    combined.includes('100 g') ||
    combined.includes('100gr') ||
    combined.includes('100 gr') ||
    combined.includes('100gramos') ||
    combined.includes('100 gramos');
}

export function getCriticalStockThreshold(product: { name?: string; category?: string } | null | undefined): number {
  if (!product) return 5;
  const nameL = (product.name || '').toLowerCase();
  const catL = (product.category || '').toLowerCase();

  const isSA = nameL.includes('sistemas agropecuarios') || catL.includes('sistemas agropecuarios');
  const isNexlabet = nameL.includes('nexlabet');
  const isOtherCritical = nameL.includes('broncobion max') || nameL.includes('avimdustrias mirex') || nameL.includes('forza');

  if ((isSA && !isNexlabet) || isOtherCritical) {
    return 120;
  }

  if (is100gProduct(product)) {
    return 25;
  }

  return 5;
}

export function isCriticalStock(product: { name?: string; category?: string; stock?: number }): boolean {
  if (!product) return false;
  if (isTecunProduct(product)) return false;

  const stock = product.stock || 0;

  const nameL = (product.name || '').toLowerCase();
  const catL = (product.category || '').toLowerCase();

  // EXENTO DE STOCK: Incubadoras
  if (nameL.includes('incubadora') || catL.includes('incubadora') || catL === 'incubadoras') {
    return false;
  }

  const threshold = getCriticalStockThreshold(product);

  return stock <= threshold;
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
    /* Al partirse el documento en varias paginas, el encabezado de la tabla se
       repite arriba de cada pagina: sin esto, la pagina 2 muestra cifras sin
       saber a que columna corresponden. */
    table.items thead { display: table-header-group; }
    table.items tfoot { display: table-footer-group; }
    table.items thead th { font-size: 7.8pt; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; text-align: left; padding: 7px 8px; border-bottom: 1.5px solid #d1d5db; }
    table.items thead th.r { text-align: right; }
    /* Identificacion fiscal repetida en cada pagina. Va DENTRO del <thead>:
       Chrome repite el encabezado de tabla al imprimir, y al ir en el flujo
       normal no puede montarse sobre la primera fila (un elemento fijo si lo
       hacia). */
    table.items thead th.doc-id { font-size: 7pt; text-transform: none; letter-spacing: 0; color: #1A4D2E; font-weight: 700; text-align: left; padding: 0 8px 5px; border-bottom: none; }
    table.items tbody td { font-size: 9.4pt; padding: 6px 8px; border-bottom: 1px solid #f0f1f2; vertical-align: top; }
    table.items tbody td.r { text-align: right; }
    table.items tbody tr:nth-child(even) td { background: #fafafa; }
    /* Una linea de producto nunca se parte a la mitad entre dos paginas. */
    table.items tbody tr { page-break-inside: avoid; }

    /* Totales */
    .totals { width: 46%; margin-left: auto; margin-top: 10px; border-collapse: collapse; page-break-inside: avoid; }
    .totals td { padding: 4px 6px; font-size: 9.6pt; }
    .totals td.r { text-align: right; }
    .totals tr.grand td { border-top: 1.5px solid #1A4D2E; font-weight: 800; font-size: 11.5pt; color: #1A4D2E; padding-top: 8px; }

    /* Bloque legal FEL */
    .fel-legend { margin-top: 14px; border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 12px; font-size: 7.5pt; color: #4b5563; text-align: justify; line-height: 1.45; page-break-inside: avoid; }
    /* padding-top + break-inside:avoid evitan que el corte de pagina (html2pdf
       rebana la imagen) parta esta linea por la mitad. */
    .foot-note { margin-top: 8px; padding: 8px 12px; font-size: 8pt; color: #1A4D2E; font-weight: 600; page-break-inside: avoid; break-inside: avoid; }

    /* Cuentas para deposito. Compacto a proposito: cuanto mas bajo el bloque
       de cierre, mas facturas caben en una sola hoja. page-break-inside:avoid
       hace que se mueva entero a la pagina siguiente en vez de partirse. */
    .banks { width: 100%; margin-top: 8px; border-collapse: collapse; page-break-inside: avoid; break-inside: avoid; }
    .banks td { width: 48%; text-align: center; vertical-align: middle; padding: 1px 4px; }
    .banks td.gap { width: 4%; }
    .bank-title { font-size: 7.5pt; font-weight: 800; color: #1A4D2E; text-transform: uppercase; }
    .bank-acct { font-size: 9.5pt; font-weight: 900; color: #000; }
    .bank-owner { font-size: 7.5pt; font-weight: 700; color: #555; text-align: center; padding-top: 1px; }
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
      {{FEL_CONT}}
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

  {{FEL_COMPLEMENTO}}
  {{FEL_LEYENDA}}

  <table class="banks">
    <tr>
      <td><span class="bank-title">Depositar a: Banco Industrial</span> <span class="bank-acct">035-015252-6</span></td>
      <td class="gap">&nbsp;</td>
      <td><span class="bank-title">Depositar a: Banrural</span> <span class="bank-acct">3580029532</span></td>
    </tr>
    <tr><td class="bank-owner" colspan="3">Ambas cuentas a nombre de Agricovet de Guatemala</td></tr>
  </table>

  <div class="foot-note">Cambio o devoluciones tienen vigencia de 8 días.</div>
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
async function getBase64Image(url: string, timeoutMs: number = 2000): Promise<string> {
  if (!url || url.startsWith('data:')) return url;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
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

/**
 * Convierte y comprime cualquier imagen (File o Base64) a formato WebP optimizado (~30KB - 50KB).
 * Reduce la resolución máxima a 900x900 y calidad a 0.70 WebP para almacenamiento ultra liviano y carga instantánea.
 */
export async function compressImageToWebP(
  input: File | Blob | string,
  maxWidth: number = 900,
  maxHeight: number = 900,
  quality: number = 0.70
): Promise<string> {
  return new Promise((resolve) => {
    let src = '';
    if (typeof input === 'string') {
      src = input;
    } else {
      src = URL.createObjectURL(input);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // 1. Convertir a WebP
          const webpData = canvas.toDataURL('image/webp', quality);
          if (webpData && webpData.startsWith('data:image/webp')) {
            if (typeof input !== 'string') URL.revokeObjectURL(src);
            return resolve(webpData);
          }

          // 2. Fallback a JPEG si WebP no fuera soportado
          const jpegData = canvas.toDataURL('image/jpeg', quality);
          if (typeof input !== 'string') URL.revokeObjectURL(src);
          return resolve(jpegData);
        }
      } catch (err) {
        console.warn('WebP compression canvas error:', err);
      }

      if (typeof input !== 'string') URL.revokeObjectURL(src);
      resolve(typeof input === 'string' ? input : '');
    };

    img.onerror = () => {
      if (typeof input !== 'string') URL.revokeObjectURL(src);
      resolve(typeof input === 'string' ? input : '');
    };

    img.src = src;
  });
}

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

/** NIT del certificador (INFILE, S.A.), que aparece en la representacion grafica. */
const NIT_CERTIFICADOR = '12521337';

/**
 * Plazo de la factura cambiaria, en dias. Por regla del negocio la leyenda
 * siempre indica 30 dias (debe coincidir con el vencimiento del abono que
 * server/fel calcula para el XML).
 */
const DIAS_CREDITO_FCAM = 30;

/** Formatea una fecha como dd/mm/yyyy. */
/** Zona horaria del negocio. Guatemala es UTC-6 (sin horario de verano). */
export const TZ_GUATEMALA = 'America/Guatemala';

/**
 * Dia calendario en Guatemala (YYYY-MM-DD) de una fecha/timestamp.
 *
 * Se calcula SIEMPRE en hora de Guatemala, no en la del dispositivo: asi la
 * fecha que ve el usuario y el filtro de "folios de hoy" coinciden aunque el
 * timestamp se guarde en UTC o el equipo tenga otra zona. Sin esto, entre las
 * 18:00 y medianoche de Guatemala el dia en UTC ya cambio y la factura salia
 * con la fecha del dia anterior / no aparecia en los folios del dia.
 */
export function diaGuatemala(fecha?: any): string {
  if (fecha === undefined || fecha === null || fecha === '') {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_GUATEMALA }).format(new Date());
  }
  if (typeof fecha === 'string') {
    const trimmed = fecha.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_GUATEMALA }).format(d);
}

export function parseFolioNumber(folioVal: any): number {
  if (folioVal === undefined || folioVal === null || folioVal === '') return 0;
  const str = String(folioVal).trim();
  const match = str.match(/^(\d+)(?:[-._/\s]([0-9a-zA-Z]+))?$/);
  if (match) {
    const base = parseFloat(match[1]);
    if (match[2]) {
      const subNum = parseFloat(match[2]);
      if (!isNaN(subNum)) {
        return base + (subNum / 100);
      } else {
        const charCode = match[2].toLowerCase().charCodeAt(0) - 96;
        return base + (Math.max(1, charCode) / 100);
      }
    }
    return base;
  }
  const val = parseFloat(str.replace(/[^\d.]/g, ''));
  return isNaN(val) ? 0 : val;
}

export function fechaDDMMYYYY(fecha: any, conHora = false): string {
  if (!fecha) return '';
  if (typeof fecha === 'string') {
    const trimmed = fecha.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
    if (match) {
      const [_, y, m, dStr, h, min] = match;
      const base = `${parseInt(dStr, 10)}/${parseInt(m, 10)}/${y}`;
      if (conHora && h !== undefined && min !== undefined) {
        return `${base} ${h}:${min}`;
      }
      return base;
    }
  }
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return '';
  const day = d.getUTCDate();
  const month = d.getUTCMonth() + 1;
  const year = d.getUTCFullYear();
  const base = `${day}/${month}/${year}`;
  if (!conHora) return base;
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${base} ${h}:${min}`;
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

/**
 * Bloque "COMPLEMENTO FACTURA CAMBIARIA" para el PDF: los mismos abonos que se
 * envian en el complemento del XML. Solo aplica a un FCAM ya certificado.
 *
 * El vencimiento y el monto se derivan con la MISMA formula del XML
 * (fecha de la factura + 30 dias; monto = gran total), asi la representacion
 * grafica coincide con lo certificado ante SAT.
 */
function complementoCambiariaHtml(felDoc: any, invoice: any): string {
  const cert = !!(felDoc && felDoc.estado === 'certificado' && felDoc.numero_autorizacion);
  const esFcam = felDoc?.tipo_dte === 'FCAM';
  if (!cert || !esFcam) return '';

  const fechaBase = new Date(invoice?.date || Date.now());
  const venc = new Date(fechaBase.getTime() + DIAS_CREDITO_FCAM * 86400000).toISOString().slice(0, 10);
  const monto = Number(felDoc.gran_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `<div style="margin-top:10px; border:1px solid #1A4D2E; border-radius:6px; overflow:hidden; page-break-inside:avoid; break-inside:avoid; font-size:8.5pt; color:#333;">
    <div style="background:#1A4D2E; color:#fff; text-align:center; font-weight:700; letter-spacing:0.04em; padding:4px 6px; font-size:8pt;">COMPLEMENTO FACTURA CAMBIARIA</div>
    <table style="width:100%; border-collapse:collapse;">
      <tr>
        <td style="padding:4px 10px;"><b>NÚMERO DE ABONO:</b> 1</td>
        <td style="padding:4px 10px;"><b>FECHA DE VENCIMIENTO:</b> ${venc}</td>
      </tr>
      <tr>
        <td style="padding:4px 10px;" colspan="2"><b>MONTO DE ABONO:</b> Q ${monto}</td>
      </tr>
    </table>
  </div>`;
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
                    <div class="info-detail-item"><strong>Frase:</strong> ${FRASE_FEL}</div>
                    <div class="info-detail-item"><strong>Certificación:</strong> ${fechaCert} · INFILE, S.A. · NIT: ${NIT_CERTIFICADOR}</div>`;

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
    ? `Por esta <strong>FACTURA CAMBIARIA girada LIBRE DE PROTESTO</strong>, a ${DIAS_CREDITO_FCAM} días se servirá(n) usted(es) pagar a la orden o endoso de <strong>${razon}</strong> el valor total de <strong>Q ${fmt(doc.gran_total)}</strong> por lo que aquí se extiende. El comprador declara haber recibido la mercadería a su entera satisfacción, da por bueno el valor total de este título de crédito y se compromete a pagarlo en la fecha de vencimiento. Esta factura no se considera cancelada si no la ampara el recibo de caja correspondiente. `
    : '';

  const bannerPrueba = esPrueba
    ? `<span style="color:#92400e; font-weight:800;">DOCUMENTO DE PRUEBA · SIN VALIDEZ FISCAL. </span>`
    : '';

  const leyenda = `
    <div style="margin-top:8px; padding:7px 11px; border:1px solid #1A4D2E; border-radius:6px; font-size:7.4pt; color:#333; text-align:justify; line-height:1.4; page-break-inside:avoid;">
      ${bannerPrueba}${leyendaCambiaria}<span style="font-style:italic; color:#666;">Representación gráfica de un DTE generado y certificado electrónicamente ante la SAT.</span>
    </div>`;

  // Bloque de respaldo (si la plantilla es personalizada y faltan las anclas):
  // se agrega todo junto al final, compacto.
  const bloqueFallback = `
    <div style="margin-top:16px; border:1.5px solid #1A4D2E; border-radius:8px; padding:12px 16px; font-size:8.5pt; color:#333; page-break-inside:avoid;">
      <div style="font-weight:800; color:#1A4D2E; margin-bottom:6px;">${tipoTexto.toUpperCase()}</div>
      <div><strong>Emisor:</strong> ${razon} · <strong>NIT:</strong> ${fel?.emisor?.nit || ''}</div>
      <div><strong>Serie:</strong> ${doc.serie || ''} · <strong>Número:</strong> ${doc.numero || ''}</div>
      <div><strong>No. Autorización:</strong> <span style="font-family:monospace;">${doc.numero_autorizacion}</span></div>
      <div><strong>Frase:</strong> ${FRASE_FEL}</div>
      <div><strong>Certificación:</strong> ${fechaCert} · INFILE, S.A. · NIT: ${NIT_CERTIFICADOR}</div>
      <div style="margin-top:4px;"><strong>Gravable:</strong> Q ${fmt(doc.monto_gravable)} · <strong>IVA:</strong> Q ${fmt(doc.monto_iva)} · <strong>Total:</strong> Q ${fmt(doc.gran_total)}</div>
      ${leyenda}
    </div>`;

  return { emisorLinea, detalles, ivaRows, leyenda, tagline: tipoTexto, bloqueFallback };
}

export function compilePrintTemplate(templateText: string, invoice: any, sellerName?: string, fel?: FelPrintData): string {
  try {
    const formatGT = (num: number) => {
      const n = Number(num);
      return isNaN(n) ? '0' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    };
    const isCredit = true; // Forzar crédito siempre (las ventas solo se pueden ir a crédito)
    const phoneVal = invoice.phone || invoice.customerPhone || 'N/A';
    const addressVal = invoice.address || 'Ciudad';

    // Búsqueda exhaustiva del nombre del vendedor (incluye invoice.name) para evitar que aparezca como "desconocido"
    const effectiveSellerName =
      (sellerName && sellerName.toLowerCase() !== 'desconocido' && sellerName.toLowerCase() !== 'sin vendedor' ? sellerName : '') ||
      invoice.sellerName ||
      invoice.seller ||
      invoice.createdByName ||
      invoice.userName ||
      invoice.user ||
      invoice.name ||
      'vendedor';

    const clientPhoneLine = phoneVal ? ('<div class="metadata-line">' + phoneVal + '</div>') : '';
    const clientAddressLine = addressVal ? ('<div class="metadata-line">' + addressVal + '</div>') : '';

    const itemsTableRows = (invoice.items || []).map((item: any) => {
      const getVariantString = (item: any) => {
        const c = item.color || item.variant?.color;
        const s = item.size || item.variant?.size;
        if (!c && !s) return '';
        if (s === 'Única' || !s) return `<br/><small style="color: #555;">🎨 ${c || ''}</small>`;
        return `<br/><small style="color: #555;">🎨 ${c || ''} - ${s || ''}</small>`;
      };
      const variantStr = getVariantString(item);
      return '<tr>' +
        '<td class="col-producto notranslate" translate="no">' + (item.productName || '') + variantStr + '</td>' +
        '<td class="col-cant">' + formatGT(item.quantity || 0) + '</td>' +
        '<td class="col-precio">' + formatGT(item.price || 0) + '</td>' +
        '<td class="col-subtotal">' + formatGT(item.total || 0) + '</td>' +
        '</tr>';
    }).join('');

    let t = templateText || DEFAULT_PRINT_TEMPLATE;

    // Plantillas personalizadas (guardadas en sys-print-template) que aun no
    // traen las cuentas de deposito: se inyectan al final. La plantilla por
    // defecto ya las incluye via <table class="banks">, de ahi el guard.
    if (!t.includes('Cuenta BANCO INDUSTRIAL') && !t.includes('Depositar a: BANCO INDUSTRIAL')
      && !t.includes('class="banks"') && !t.includes('biSealUrl')) {
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
        ? `<div class="kv" style="margin-top:6px; border-top:1px dashed #e5e7eb; padding-top:5px;"><b>Documento:</b> ${tipoTexto}</div><div class="kv"><b>No. Autorización:</b><br/><span style="font-family:monospace; font-size:8pt; word-break:break-all;">${felDoc.numero_autorizacion}</span></div><div class="kv"><b>Frase:</b> ${FRASE_FEL}</div><div class="kv"><b>Certificación:</b> ${fechaDDMMYYYY(felDoc.fecha_certificacion, true)} &middot; INFILE, S.A. &middot; NIT: ${NIT_CERTIFICADOR}</div>`
        : '';
      const felIvaRows = felCert
        ? `<tr><td class="muted">Monto Gravable</td><td class="r muted">Q ${fmtQ(felDoc.monto_gravable)}</td></tr><tr><td class="muted">IVA (12%)</td><td class="r muted">Q ${fmtQ(felDoc.monto_iva)}</td></tr>`
        : '';
      let felLeyenda = '';
      if (felCert) {
        const esPrueba = String(felDoc.serie || '').toUpperCase().includes('PRUEBA') || fel?.emisor?.ambiente === 'pruebas';
        const banner = esPrueba ? `<span style="color:#92400e; font-weight:800;">DOCUMENTO DE PRUEBA &middot; SIN VALIDEZ FISCAL. </span>` : '';
        const camb = esFcam
          ? `Por esta <strong>FACTURA CAMBIARIA girada LIBRE DE PROTESTO</strong>, a ${DIAS_CREDITO_FCAM} días se servirá(n) usted(es) pagar a la orden o endoso de <strong>${razon || emNombre}</strong> el valor total de <strong>Q ${fmtQ(felDoc.gran_total)}</strong> por lo que aquí se extiende. El comprador declara haber recibido la mercadería a su entera satisfacción, da por bueno el valor total de este título de crédito y se compromete a pagarlo en la fecha de vencimiento. Esta factura no se considera cancelada si no la ampara el recibo de caja correspondiente. `
          : '';
        felLeyenda = `<div class="fel-legend">${banner}${camb}<span style="font-style:italic;">Representación gráfica de un DTE generado y certificado electrónicamente ante la SAT.</span></div>`;
      }

      // Fila dentro del <thead>: Chrome repite el encabezado de la tabla en
      // cada pagina impresa, asi que una hoja 2 suelta sigue identificando al
      // DTE (serie, numero y autorizacion). Al ir en el flujo normal no puede
      // montarse sobre la primera fila, como si pasaba con un elemento fijo.
      const felCont = felCert
        ? `<tr><th class="doc-id" colspan="4">${emNombre} &middot; ${tipoTexto} &middot; Serie ${felDoc.serie || ''} &middot; No. ${felDoc.numero || ''} &middot; Autorización ${felDoc.numero_autorizacion}</th></tr>`
        : '';

      const felComplemento = complementoCambiariaHtml(felDoc, invoice);

      t = t.replace(/\{\{FEL_EMISOR\}\}/g, felEmisor)
        .replace(/\{\{FEL_CONT\}\}/g, felCont)
        .replace(/\{\{FEL_DOCTYPE\}\}/g, felDoctype)
        .replace(/\{\{FEL_SERIE_NUM\}\}/g, felSerieNum)
        .replace(/\{\{FEL_DOC_DETAILS\}\}/g, felDocDetails)
        .replace(/\{\{FEL_IVA_ROWS\}\}/g, felIvaRows)
        .replace(/\{\{FEL_COMPLEMENTO\}\}/g, felComplemento)
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

        // 4) Complemento cambiario (abonos) + leyenda al final. Si las anclas
        // principales existieron, se agrega el complemento y la leyenda; si la
        // plantilla es personalizada y no matchearon, el bloque de respaldo.
        const felComplemento = complementoCambiariaHtml(fel?.documento, invoice);
        if (ok || t !== taglineAntes) {
          t = t.replace(/<\/body>/i, felComplemento + frag.leyenda + '\n</body>');
        } else {
          t = t.replace(/<\/body>/i, frag.bloqueFallback + felComplemento + '\n</body>');
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
          if (s === 'Única' || !s) return `🎨 ${c || ''}`;
          return `🎨 ${c || ''} - ${s || ''}`;
        };
        const variantInfo = getVariantInfo(item);
        row = row.replace(/\{\{this\.variantInfo\}\}/g, variantInfo);
        row = row.replace(/\{\{variantInfo\}\}/g, variantInfo);

        let finalProductName = String(item.productName || '').replace(/\*/g, '');
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

    // Nombre del cliente con fallbacks: invoice.client, customerName o name.
    // Sin esto la factura impresa salia con el cliente vacio segun el origen.
    const clientName = String(invoice.client || invoice.customerName || invoice.name || '').replace(/\*/g, '');

    // Receptor: si el DTE se certifico con datos ajustados (nombre/NIT distintos
    // a los de la venta), la representacion grafica debe mostrar EXACTAMENTE lo
    // certificado ante SAT, no el cliente original de la factura.
    const felDocRec: any = fel?.documento;
    const felCertRec = !!(felDocRec && felDocRec.estado === 'certificado');
    const custName = (felCertRec && felDocRec.receptor_nombre) ? String(felDocRec.receptor_nombre).replace(/\*/g, '') : clientName;
    const custNit = (felCertRec && felDocRec.receptor_nit) ? felDocRec.receptor_nit : (invoice.nit || 'CF');

    // Base substitutions
    t = t.replace(/\{\{id\}\}/g, String(invoice.id || '').replace(/\*/g, ''));
    t = t.replace(/\{\{folio\}\}/g, String(invoice.folio || '').replace(/\*/g, ''));
    t = t.replace(/\{\{client\}\}/g, String(custName));
    t = t.replace(/\{\{customerName\}\}/g, String(custName));
    t = t.replace(/\{\{customerNit\}\}/g, String(custNit));
    t = t.replace(/\{\{customerAddress\}\}/g, String(invoice.address || 'Ciudad'));
    t = t.replace(/\{\{clientPhoneLine\}\}/g, clientPhoneLine);
    t = t.replace(/\{\{clientAddressLine\}\}/g, clientAddressLine);
    t = t.replace(/\{\{phone\}\}/g, phoneVal);
    t = t.replace(/\{\{address\}\}/g, addressVal);
    t = t.replace(/\{\{folio\}\}/g, String(invoice.folio || 1));
    t = t.replace(/\{\{date\}\}/g, invoice.date ? fechaDDMMYYYY(invoice.date) : '');
    t = t.replace(/\{\{paymentForm\}\}/g, isCredit ? 'CREDITO' : 'CONTADO');
    t = t.replace(/\{\{status\}\}/g, isCredit ? 'POR COBRAR' : (invoice.status === 'cancelled' || invoice.status === 'rejected' ? 'ANULADA' : 'PAGADO'));
    t = t.replace(/\{\{sellerName\}\}/g, effectiveSellerName);
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

    // Red de seguridad: si una plantilla guardada trae un marcador FEL que esta
    // rama no sustituyo, se elimina. Nunca debe imprimirse "{{FEL_...}}" literal
    // en la representacion grafica de un documento fiscal.
    t = t.replace(/\{\{FEL_[A-Z_]+\}\}/g, '');

    return t;
  } catch (e) {
    console.error('Error compiling template:', e);
    return `<h1>Error al generar ticket</h1><p>${String(e)}</p>`;
  }
}

export function generateDeliveryLetterHtml(invoice: any, sellerName?: string): string {
  const dateStr = new Date().toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const logoUrl = localStorage.getItem('app_logo_url') || `${window.location.origin}/agricovet.png`;

  const effectiveSellerName =
    (sellerName && sellerName.toLowerCase() !== 'desconocido' && sellerName.toLowerCase() !== 'sin vendedor' ? sellerName : '') ||
    invoice.sellerName ||
    invoice.seller ||
    invoice.createdByName ||
    invoice.userName ||
    invoice.user ||
    invoice.name ||
    'vendedor';

  const clientName = invoice.client || invoice.customerName || invoice.name || 'N/A';

  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; line-height: 1.6;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #0b4d2c; padding-bottom: 20px;">
        <div>
          <img src="${logoUrl}" alt="Agricovet Logo" style="max-width: 150px; max-height: 80px; object-fit: contain;" />
          <h1 style="color: #0b4d2c; margin: 10px 0 5px 0; font-size: 24px;">Carta de Entrega de Mercadería</h1>
          <p style="margin: 0; color: #666; font-size: 14px;">Folio de Venta: #${invoice.folio || invoice.id.substring(0, 8)}</p>
        </div>
        <div style="text-align: right; font-size: 14px;">
          <p style="margin: 0;">Fecha de Emisión: ${dateStr}</p>
          <p style="margin: 0;">Vendedor: ${effectiveSellerName}</p>
        </div>
      </div>

      <div style="margin-bottom: 30px;">
        <h3 style="color: #0b4d2c; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Datos del Cliente</h3>
        <table style="width: 100%; font-size: 14px;">
          <tr>
            <td style="padding: 5px 0; width: 120px;"><strong>Nombre/Razón:</strong></td>
            <td>${clientName}</td>
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
            ${(invoice.items || []).map((item: any) => {
    const c = item.color || item.variant?.color;
    const s = item.size || item.variant?.size;
    let varStr = '';
    if (c || s) {
      if (s === 'Única' || !s) varStr = `<br/><small style="color: #666;">🎨 ${c || ''}</small>`;
      else if (!c) varStr = `<br/><small style="color: #666;">🎨 ${s}</small>`;
      else varStr = `<br/><small style="color: #666;">🎨 ${c} - ${s}</small>`;
    }
    return `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.quantity}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                  <div style="font-weight: bold;">${item.productName}</div>
                  ${varStr}
                </td>
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

export interface ReciboConformeOptions {
  receiverName?: string;
  receiverDpi?: string;
  receiverPhone?: string;
  receiverRelationship?: string;
  deliveryNotes?: string;
  includePrices?: boolean;
  signatureImage?: string;
  deliveredBy?: string;
  companyName?: string;
  deliveryDate?: string;
}

export function generateReciboConformeHtml(invoice: any, options: ReciboConformeOptions = {}): string {
  if (!invoice) return '<h1>No hay datos de venta para generar el recibo</h1>';

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const logoUrl = localStorage.getItem('app_logo_url') || `${origin}/agricovet.png`;
  const companyName = options.companyName || 'AGRICOVET DE GUATEMALA';

  const formatGT = (num: number | string | undefined) => {
    const n = Number(num);
    return isNaN(n) ? '0.00' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const invoiceDate = invoice.date ? formatDateSafe(invoice.date) : 'N/A';
  const currentDateStr = options.deliveryDate || new Date().toLocaleDateString('es-GT', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const effectiveSeller =
    options.deliveredBy ||
    (invoice.sellerName && invoice.sellerName !== 'desconocido' ? invoice.sellerName : '') ||
    invoice.seller ||
    invoice.createdByName ||
    invoice.userName ||
    'Piloto / Asesor de Entrega';

  const billedClient = invoice.client || invoice.clientName || invoice.customerName || invoice.name || 'Cliente sin nombre';
  const clientNit = invoice.nit || 'C/F';
  const clientPhone = invoice.phone || invoice.customerPhone || 'N/A';
  const clientAddress = invoice.address || invoice.deliveryAddress || 'Ciudad';

  // Receptor should NOT automatically be the billed client unless explicitly set
  const receiverName = options.receiverName ? options.receiverName : '________________________________';
  const receiverDpi = options.receiverDpi ? options.receiverDpi : '___________________________';
  const receiverPhone = options.receiverPhone ? options.receiverPhone : '___________________________';
  const receiverRel = options.receiverRelationship ? options.receiverRelationship : '___________________________';
  const deliveryNotes = options.deliveryNotes || cleanObservations(invoice.notes || invoice.observations || '');

  const folioStr = invoice.folio ? String(invoice.folio) : (invoice.id ? String(invoice.id).substring(0, 8) : 'S/N');
  
  const calcTotal = Number(invoice.total || 0) > 0 
    ? Number(invoice.total) 
    : (invoice.items || []).reduce((acc: number, it: any) => acc + (Number(it.total) || (Number(it.price || 0) * Number(it.quantity || 0))), 0);
  
  const totalFormatted = formatGT(calcTotal);
  const includePrices = options.includePrices !== false;

  const itemsRows = (invoice.items || []).map((item: any, idx: number) => {
    const c = item.color || item.variant?.color;
    const s = item.size || item.variant?.size;
    let varStr = '';
    if (c || s) {
      if (s === 'Única' || !s) varStr = `<div style="font-size:10px; color:#555; margin-top:2px;">🎨 ${c || ''}</div>`;
      else if (!c) varStr = `<div style="font-size:10px; color:#555; margin-top:2px;">🎨 ${s}</div>`;
      else varStr = `<div style="font-size:10px; color:#555; margin-top:2px;">🎨 ${c} &middot; ${s}</div>`;
    }
    const q = Number(item.quantity || 0);
    const p = Number(item.price || 0);
    const tot = Number(item.total || (q * p));

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #fafbfc;' : ''}">
        <td style="padding: 9px 12px; font-weight: bold; text-align: center; color: #1e293b; font-size: 12px; width: 65px;">${q}</td>
        <td style="padding: 9px 12px; color: #1e293b; font-size: 12px;">
          <div style="font-weight: 700; color: #0f172a;">${item.productName || 'Producto'}</div>
          ${varStr}
        </td>
        ${includePrices ? `
          <td style="padding: 9px 12px; text-align: right; color: #475569; font-size: 12px; width: 100px;">Q ${formatGT(p)}</td>
          <td style="padding: 9px 12px; text-align: right; font-weight: 700; color: #15803d; font-size: 12px; width: 110px;">Q ${formatGT(tot)}</td>
        ` : ''}
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Recibo Conforme - Folio #${folioStr}</title>
      <style>
        @page {
          size: letter;
          margin: 14mm 16mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 0;
          background: #fff;
          font-size: 12px;
          line-height: 1.45;
        }
        .container {
          max-width: 780px;
          margin: 0 auto;
          padding: 10px 0;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2.5px solid #1A4D2E;
          padding-bottom: 14px;
          margin-bottom: 16px;
        }
        .logo-box {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .logo-img {
          max-width: 140px;
          max-height: 65px;
          object-fit: contain;
        }
        .doc-title {
          font-size: 17px;
          font-weight: 900;
          color: #1A4D2E;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          margin: 0 0 3px 0;
        }
        .doc-subtitle {
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0;
        }
        .meta-card {
          text-align: right;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 8px 14px;
        }
        .folio-badge {
          display: inline-block;
          background: #1A4D2E;
          color: #ffffff;
          font-weight: 800;
          font-size: 13px;
          padding: 3px 10px;
          border-radius: 6px;
          margin-bottom: 5px;
          letter-spacing: 0.03em;
        }
        .meta-line {
          font-size: 10.5px;
          color: #475569;
          margin: 2px 0;
        }
        .two-cols {
          display: flex;
          gap: 14px;
          margin-bottom: 16px;
        }
        .info-card {
          flex: 1;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          overflow: hidden;
          background: #ffffff;
        }
        .card-header {
          background: #f1f5f9;
          color: #1A4D2E;
          font-weight: 800;
          font-size: 10.5px;
          padding: 5px 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 1px solid #cbd5e1;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .card-body {
          padding: 8px 10px;
          font-size: 11px;
        }
        .kv-row {
          display: flex;
          margin-bottom: 4px;
        }
        .kv-label {
          width: 100px;
          color: #64748b;
          font-weight: 700;
          flex-shrink: 0;
        }
        .kv-val {
          color: #0f172a;
          font-weight: 600;
          flex: 1;
        }
        .table-items {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          overflow: hidden;
        }
        .table-items thead tr {
          background: #1A4D2E;
          color: #ffffff;
        }
        .table-items th {
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .totals-box {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 16px;
        }
        .totals-table {
          width: 280px;
          border-collapse: collapse;
        }
        .totals-table td {
          padding: 5px 10px;
          font-size: 12px;
        }
        .totals-total {
          background: #f1f5f9;
          font-weight: 900;
          font-size: 14px;
          color: #1A4D2E;
          border-top: 2px solid #1A4D2E;
        }
        .disclaimer-box {
          border: 1.5px solid #1A4D2E;
          background: #fdfefe;
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 22px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .disclaimer-title {
          font-weight: 900;
          color: #1A4D2E;
          font-size: 11px;
          text-transform: uppercase;
          margin-bottom: 5px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .disclaimer-text {
          font-size: 9.5pt;
          color: #1e293b;
          text-align: justify;
          line-height: 1.45;
          margin: 0;
        }
        .signatures {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-top: 20px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .sig-col {
          flex: 1;
          border: 1px dashed #94a3b8;
          border-radius: 8px;
          padding: 12px 14px;
          background: #fafafa;
          text-align: center;
          min-height: 125px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        .sig-line {
          border-bottom: 1.5px solid #334155;
          margin-bottom: 8px;
          width: 85%;
          margin-left: auto;
          margin-right: auto;
        }
        .sig-title {
          font-weight: 800;
          color: #0f172a;
          font-size: 11.5px;
          text-transform: uppercase;
          margin: 0 0 3px 0;
        }
        .sig-meta {
          font-size: 10px;
          color: #475569;
          margin: 2px 0;
        }
        .sig-img {
          max-height: 60px;
          max-width: 190px;
          object-fit: contain;
          margin: 0 auto 5px auto;
          display: block;
        }
        .obs-box {
          margin-bottom: 14px;
          padding: 7px 12px;
          background: #fffbeb;
          border: 1px solid #fef08a;
          border-radius: 6px;
          font-size: 10.5px;
          color: #854d0e;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- HEADER -->
        <div class="header">
          <div class="logo-box">
            <img src="${logoUrl}" alt="Agricovet de Guatemala" class="logo-img" />
            <div>
              <div style="font-size: 11px; font-weight: 800; color: #1A4D2E; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">AGRICOVET DE GUATEMALA</div>
              <h1 class="doc-title">Recibo Conforme de Entrega</h1>
              <p class="doc-subtitle">Constancia de Recepción a Entera Satisfacción</p>
            </div>
          </div>
          <div class="meta-card">
            <div class="folio-badge">FOLIO #${folioStr}</div>
            <div class="meta-line"><strong>Fecha Venta:</strong> ${invoiceDate}</div>
            <div class="meta-line"><strong>Fecha Entrega:</strong> ${currentDateStr}</div>
            <div class="meta-line"><strong>Despachó:</strong> ${effectiveSeller}</div>
          </div>
        </div>

        <!-- FULL WIDTH RECEPTOR DE LA MERCADERIA -->
        <div class="info-card" style="border: 1.5px solid #1A4D2E; margin-bottom: 16px; border-radius: 8px; overflow: hidden;">
          <div class="card-header" style="background: #1A4D2E; color: #ffffff; padding: 6px 12px; font-size: 11px;">
            <span>✍️ Datos de Quien Recibe la Mercadería</span>
          </div>
          <div class="card-body" style="padding: 10px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px;">
            <div class="kv-row"><span class="kv-label">Nombre Receptor:</span><span class="kv-val" style="color:#1A4D2E; font-weight:800;">${receiverName}</span></div>
            <div class="kv-row"><span class="kv-label">No. DPI / CUI:</span><span class="kv-val">${receiverDpi}</span></div>
            <div class="kv-row"><span class="kv-label">Teléfono Receptor:</span><span class="kv-val">${receiverPhone}</span></div>
            <div class="kv-row"><span class="kv-label">Relación / Cargo:</span><span class="kv-val">${receiverRel}</span></div>
            ${clientAddress && clientAddress !== 'Ciudad' ? `
              <div class="kv-row" style="grid-column: span 2;"><span class="kv-label">Lugar de Entrega:</span><span class="kv-val">${clientAddress}</span></div>
            ` : ''}
          </div>
        </div>

        ${deliveryNotes ? `
          <div class="obs-box">
            <strong>Observaciones de Entrega:</strong> ${deliveryNotes}
          </div>
        ` : ''}

        <!-- ITEMS TABLE -->
        <table class="table-items">
          <thead>
            <tr>
              <th style="text-align: center; width: 65px;">Cant.</th>
              <th style="text-align: left;">Descripción del Producto / Variantes</th>
              ${includePrices ? `
                <th style="text-align: right; width: 100px;">Precio Unit.</th>
                <th style="text-align: right; width: 110px;">Subtotal</th>
              ` : ''}
            </tr>
          </thead>
          <tbody>
            ${itemsRows || '<tr><td colspan="4" style="text-align:center; padding:15px; color:#666;">No se registraron productos en esta venta</td></tr>'}
          </tbody>
        </table>

        <!-- TOTALS (IF PRICES INCLUDED) -->
        ${includePrices ? `
          <div class="totals-box">
            <table class="totals-table">
              <tr>
                <td style="text-align: right; color: #475569; font-weight: 600;">Total Venta:</td>
                <td style="text-align: right; font-weight: 800; font-size: 13px; color: #0f172a;">Q ${totalFormatted}</td>
              </tr>
              <tr class="totals-total">
                <td style="text-align: right; padding-top:6px; padding-bottom:6px;">VALOR TOTAL:</td>
                <td style="text-align: right; padding-top:6px; padding-bottom:6px; font-size:14px;">Q ${totalFormatted}</td>
              </tr>
            </table>
          </div>
        ` : ''}

        <!-- ADAPTED DISCLAIMER SECTION -->
        <div class="disclaimer-box">
          <div class="disclaimer-title">
            <span>🛡️ Declaración de Recepción y Conformidad</span>
          </div>
          <p class="disclaimer-text">
            Por medio del presente <strong>RECIBO CONFORME</strong>, la persona que recibe la mercadería declara haber revisado y recibido a su <strong>entera satisfacción y conformidad</strong> todos los productos y cantidades detallados en este documento, correspondientes a la venta bajo el <strong>Folio #${folioStr}</strong>${includePrices ? ` por un valor total de <strong>Q ${totalFormatted}</strong>` : ''} despachada por <strong>AGRICOVET DE GUATEMALA</strong>. Quien recibe confirma que los productos fueron entregados completos, en perfecto estado y con empaque cerrado.
          </p>
        </div>

        <!-- SIGNATURES -->
        <div class="signatures">
          <div class="sig-col">
            ${options.signatureImage ? `
              <img src="${options.signatureImage}" alt="Firma Receptor" class="sig-img" />
            ` : `
              <div style="height: 45px;"></div>
            `}
            <div class="sig-line"></div>
            <div class="sig-title">Firma de Recibido Conforme</div>
            <div class="sig-meta"><strong>Nombre:</strong> ${receiverName}</div>
            <div class="sig-meta"><strong>DPI:</strong> ${receiverDpi}</div>
          </div>

          <div class="sig-col">
            <div style="height: 45px;"></div>
            <div class="sig-line"></div>
            <div class="sig-title">Entregado Por</div>
            <div class="sig-meta"><strong>Asesor / Piloto:</strong> ${effectiveSeller}</div>
            <div class="sig-meta"><strong>Empresa:</strong> AGRICOVET DE GUATEMALA</div>
          </div>
        </div>

      </div>
    </body>
    </html>
  `;
}

export function compileQuotationTemplate(quote: any, sellerName?: string): string {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const logoUrl = localStorage.getItem('app_logo_url') || `${origin}/agricovet.png`;

    const formatGT = (num: number | string | undefined) => {
      const n = Number(num);
      return isNaN(n) ? '0.00' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const effectiveSeller = (sellerName && sellerName !== 'desconocido' ? sellerName : '') ||
      quote.sellerName ||
      quote.seller ||
      'Asesor Comercial';

    const clientName = quote.client || quote.clientName || 'Cliente Particular';
    const clientNit = quote.nit || 'CF';
    const clientPhone = quote.phone || 'N/A';
    const clientAddress = quote.address || 'Ciudad de Guatemala';
    const folioStr = quote.folio || `#COT-${String(quote.folioNumber || 1).padStart(4, '0')}`;

    const dateObj = quote.date ? new Date(quote.date) : new Date();
    const dateFormatted = dateObj.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const validDays = quote.validityDays || 15;
    const validUntilObj = quote.validUntil ? new Date(quote.validUntil) : new Date(dateObj.getTime() + validDays * 24 * 60 * 60 * 1000);
    const validUntilFormatted = validUntilObj.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const itemsRows = (quote.items || []).map((item: any, idx: number) => {
      const c = item.color || item.variant?.color;
      const s = item.size || item.variant?.size;
      let variantStr = '';
      if (c || s) {
        if (s === 'Única' || !s) variantStr = `<br/><small style="color: #64748b; font-weight: 500;">🎨 ${c || ''}</small>`;
        else if (!c) variantStr = `<br/><small style="color: #64748b; font-weight: 500;">📏 ${s}</small>`;
        else variantStr = `<br/><small style="color: #64748b; font-weight: 500;">🎨 ${c} &middot; 📏 ${s}</small>`;
      }

      return `
        <tr style="border-bottom: 1px solid #f1f5f9; page-break-inside: avoid;">
          <td style="padding: 8px 10px; font-size: 9pt; color: #64748b; text-align: center; width: 5%;">${idx + 1}</td>
          <td style="padding: 8px 10px; font-size: 9.5pt; font-weight: 600; color: #1e293b;">
            ${item.productName || item.name || 'Producto'}
            ${variantStr}
          </td>
          <td style="padding: 8px 10px; font-size: 9.5pt; text-align: center; color: #334155; width: 12%; font-weight: 700;">
            ${item.quantity || 1}
          </td>
          <td style="padding: 8px 10px; font-size: 9.5pt; text-align: right; color: #334155; width: 18%;">
            Q ${formatGT(item.price || 0)}
          </td>
          <td style="padding: 8px 10px; font-size: 9.5pt; text-align: right; font-weight: 700; color: #00696a; width: 20%;">
            Q ${formatGT(item.total || (item.quantity * item.price) || 0)}
          </td>
        </tr>
      `;
    }).join('');

    const totalNum = Number(quote.totalAmount || 0);

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <base href="${origin}/" />
  <title>Cotización ${folioStr} - ${clientName}</title>
  <style>
    @page { size: A4; margin: 12mm 14mm; }
    * { box-sizing: border-box; font-family: 'Segoe UI', system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif; }
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
    body { margin: 0; padding: 0; color: #1e293b; font-size: 9.5pt; line-height: 1.45; background: #fff; }
    .doc-container { width: 100%; max-width: 800px; margin: 0 auto; }
    
    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; padding-bottom: 12px; border-bottom: 2.5px solid #00696a; }
    .brand-section { display: flex; gap: 14px; align-items: center; }
    .brand-logo { width: 68px; height: 68px; object-fit: contain; }
    .company-title { font-size: 15pt; font-weight: 900; color: #00696a; letter-spacing: -0.3px; margin: 0; }
    .company-tagline { font-size: 8pt; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 1px; }
    .company-info { font-size: 8pt; color: #475569; margin-top: 3px; line-height: 1.35; }
    
    /* Quote Box */
    .quote-box { min-width: 230px; border: 2px solid #00696a; border-radius: 8px; padding: 8px 14px; text-align: center; background: #f0fdfa; }
    .quote-badge { font-size: 11pt; font-weight: 900; color: #00696a; text-transform: uppercase; letter-spacing: 0.05em; }
    .quote-folio { font-size: 12pt; font-weight: 900; color: #ba1a1a; margin-top: 2px; }
    .quote-meta-row { font-size: 8.2pt; color: #334155; margin-top: 3px; display: flex; justify-content: space-between; }
    .quote-meta-row b { color: #0f172a; }

    /* Parties Section */
    .parties-grid { display: flex; gap: 20px; margin: 14px 0 10px; }
    .party-col { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
    .section-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.08em; color: #00696a; font-weight: 800; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 6px; }
    .client-name { font-size: 11pt; font-weight: 800; color: #0f172a; margin-bottom: 3px; }
    .info-line { font-size: 8.8pt; color: #334155; margin-top: 2px; }
    .info-line b { color: #475569; font-weight: 600; }

    /* Items Table */
    table.items-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    table.items-table thead th { background: #00696a; color: #ffffff; font-size: 8pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 10px; border: none; text-align: left; }
    table.items-table thead th.r { text-align: right; }
    table.items-table thead th.c { text-align: center; }
    table.items-table thead tr th:first-child { border-top-left-radius: 6px; }
    table.items-table thead tr th:last-child { border-top-right-radius: 6px; }
    table.items-table tbody tr:nth-child(even) { background-color: #f8fafc; }

    /* Totals */
    .totals-wrapper { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-top: 12px; page-break-inside: avoid; }
    .terms-box { flex: 1.2; font-size: 7.8pt; color: #475569; line-height: 1.45; background: #fff; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 8px 12px; }
    .terms-title { font-weight: 800; color: #00696a; text-transform: uppercase; margin-bottom: 3px; }
    .totals-table { width: 280px; border-collapse: collapse; }
    .totals-table td { padding: 4px 8px; font-size: 9.5pt; }
    .totals-table td.r { text-align: right; }
    .grand-total-row td { border-top: 2px solid #00696a; border-bottom: 2px solid #00696a; font-weight: 900; font-size: 13pt; color: #00696a; padding: 6px 8px; background: #f0fdfa; }

    /* Banks */
    .banks-table { width: 100%; margin-top: 14px; border-collapse: collapse; page-break-inside: avoid; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
    .banks-table td { width: 48%; text-align: center; vertical-align: middle; padding: 6px 10px; }
    .banks-table td.gap { width: 4%; }
    .bank-title { font-size: 8pt; font-weight: 800; color: #00696a; text-transform: uppercase; }
    .bank-acct { font-size: 10.5pt; font-weight: 900; color: #0f172a; margin: 1px 0; }
    .bank-owner { font-size: 7.5pt; font-weight: 700; color: #64748b; }

    /* Signatures */
    .signatures-row { display: flex; justify-content: space-around; margin-top: 28px; padding-top: 12px; page-break-inside: avoid; }
    .sign-box { width: 220px; text-align: center; font-size: 8pt; color: #475569; }
    .sign-line { border-bottom: 1.5px solid #94a3b8; height: 35px; margin-bottom: 6px; }
    .sign-name { font-weight: 700; color: #0f172a; }
  </style>
</head>
<body>
  <div class="doc-container">
    <!-- Header -->
    <div class="header">
      <div class="brand-section">
        <img src="${logoUrl}" alt="Agricovet Logo" class="brand-logo" />
        <div>
          <h1 class="company-title">Agricovet de Guatemala</h1>
          <div class="company-info">
            Tel / WhatsApp: +(502) 3645-0241<br/>
            Email: agricovetsa@gmail.com &middot; NIT: 120894769<br/>
            Guatemala, Centroamérica
          </div>
        </div>
      </div>
      <div class="quote-box">
        <div class="quote-badge">Cotización Formal</div>
        <div class="quote-folio">${folioStr}</div>
        <div class="quote-meta-row" style="margin-top: 6px;">
          <span>Emisión:</span>
          <b>${dateFormatted}</b>
        </div>
        <div class="quote-meta-row">
          <span>Vigencia:</span>
          <b>${validDays} días (${validUntilFormatted})</b>
        </div>
      </div>
    </div>

    <!-- Parties Grid -->
    <div class="parties-grid">
      <div class="party-col">
        <div class="section-label">Información del Cliente</div>
        <div class="client-name">${clientName}</div>
        <div class="info-line"><b>NIT:</b> ${clientNit}</div>
        <div class="info-line"><b>Teléfono:</b> ${clientPhone}</div>
        <div class="info-line"><b>Dirección:</b> ${clientAddress}</div>
      </div>
      <div class="party-col">
        <div class="section-label">Detalles Comerciales</div>
        <div class="info-line"><b>Asesor Comercial:</b> ${effectiveSeller}</div>
        <div class="info-line"><b>Moneda:</b> Quetzales (GTQ)</div>
        <div class="info-line"><b>Estado:</b> Presupuesto Activo</div>
        <div class="info-line"><b>Condiciones:</b> Precios especiales de cotización</div>
      </div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th class="c" style="width: 5%;">#</th>
          <th>Descripción del Producto</th>
          <th class="c" style="width: 12%;">Cant.</th>
          <th class="r" style="width: 18%;">Precio Unit.</th>
          <th class="r" style="width: 20%;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Totals & Terms -->
    <div class="totals-wrapper">
      <div class="terms-box">
        <div class="terms-title">Términos y Condiciones</div>
        &bull; Los precios cotizados están expresados en Quetzales e incluyen el Impuesto al Valor Agregado (IVA).<br/>
        &bull; Oferta válida hasta el <strong>${validUntilFormatted}</strong>. Posterior a esta fecha los precios y disponibilidad quedan sujetos a confirmación.<br/>
        &bull; Esta cotización formal no reserva existencias en bodega hasta que se convierta o confirme como venta formal.<br/>
        ${quote.notes ? `&bull; <strong>Observaciones:</strong> ${quote.notes}` : ''}
      </div>

      <table class="totals-table">
        <tr>
          <td style="color: #64748b;">Subtotal</td>
          <td class="r" style="font-weight: 600;">Q ${formatGT(totalNum)}</td>
        </tr>
        <tr>
          <td style="color: #64748b;">Descuentos Aplicados</td>
          <td class="r" style="font-weight: 600; color: #16a34a;">Q 0.00</td>
        </tr>
        <tr class="grand-total-row">
          <td>TOTAL</td>
          <td class="r">Q ${formatGT(totalNum)}</td>
        </tr>
      </table>
    </div>

    <!-- Bank Accounts -->
    <table class="banks-table">
      <tr>
        <td>
          <div class="bank-title">Depositar a: BANCO INDUSTRIAL</div>
          <div class="bank-acct">035-015252-6</div>
          <div class="bank-owner">Agricovet de Guatemala (Monetaria)</div>
        </td>
        <td class="gap">&nbsp;</td>
        <td>
          <div class="bank-title">Depositar a: BANRURAL</div>
          <div class="bank-acct">3580029532</div>
          <div class="bank-owner">Agricovet de Guatemala (Monetaria)</div>
        </td>
      </tr>
    </table>

    <!-- Signatures -->
    <div class="signatures-row">
      <div class="sign-box">
        <div class="sign-line"></div>
        <div class="sign-name">${effectiveSeller}</div>
        <div>Asesor Comercial / Agricovet</div>
      </div>
      <div class="sign-box">
        <div class="sign-line"></div>
        <div class="sign-name">${clientName}</div>
        <div>Aceptación del Cliente</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  } catch (e) {
    console.error('Error compiling quotation template:', e);
    return `<h1>Error al generar cotización</h1><p>${String(e)}</p>`;
  }
}


export async function printHtml(html: string) {
  // Remove any existing print iframe
  const oldIframe = document.getElementById('print-receipt-iframe');
  if (oldIframe && document.body.contains(oldIframe)) {
    document.body.removeChild(oldIframe);
  }

  // Create isolated iframe for clean printing
  const iframe = document.createElement('iframe');
  iframe.id = 'print-receipt-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    console.error('No se pudo acceder al documento del iframe de impresión');
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Convert images inside iframe body to Base64
  await convertAllImagesToBase64(doc.body);

  // Trigger print directly on iframe window
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Error al lanzar impresión en iframe:', err);
    }
  }, 250);

  // Cleanup after print
  const cleanup = () => {
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  };

  iframe.contentWindow?.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(cleanup, 10000);
}

/**
 * Reparte las filas de items en paginas para el PDF descargado.
 *
 * FUNCION PURA (sin DOM): recibe las alturas ya medidas y devuelve que filas
 * van en cada pagina. Se separa asi del navegador para poder probarla sola,
 * porque html2pdf.js no se puede ejecutar fuera del navegador.
 *
 * html2pdf rasteriza el HTML en una imagen larga y la corta en paginas: NO
 * repite el <thead> como si hace la impresion nativa. Por eso paginamos a mano
 * y repetimos el encabezado de la tabla al inicio de cada pagina.
 *
 * Solo se ocupa de los items. El cierre (totales, complemento cambiario,
 * leyenda, cuentas y pie) se deja fluir: cada uno de esos bloques lleva
 * page-break-inside:avoid, asi que html2pdf mueve entero el que no quepa en
 * lugar de partirlo. Antes se forzaba un salto para mandar TODO el cierre a
 * una pagina propia, pero eso desperdiciaba hasta media hoja en blanco.
 */
export function planificarPaginasItems(
  alturas: number[],
  o: { pageHeight: number; preTableTop: number; theadH: number; safety: number }
): number[][] {
  const paginas: number[][] = [[]];
  // La primera pagina arranca ya ocupada por el encabezado del documento
  // (emisor, cliente…) mas el encabezado de la tabla.
  let usado = o.preTableTop + o.theadH;

  for (let i = 0; i < alturas.length; i++) {
    const h = alturas[i];
    const disponible = o.pageHeight - usado - o.safety;
    const actual = paginas[paginas.length - 1];
    // Si la fila no cabe y la pagina ya tiene al menos una fila, se abre una
    // pagina nueva que arranca solo con el encabezado de tabla repetido.
    if (actual.length > 0 && h > disponible) {
      paginas.push([]);
      usado = o.theadH;
    }
    paginas[paginas.length - 1].push(i);
    usado += h;
  }

  return paginas;
}

/**
 * Toma el HTML compilado y, midiendo las alturas reales en el navegador,
 * reparte la tabla de items en varias tablas (una por pagina) repitiendo el
 * <thead> en cada una. Devuelve el HTML ya paginado. Si no encuentra la tabla
 * de items o cabe todo, devuelve el HTML sin cambios.
 */
function paginarItemsParaPdf(
  html: string,
  geometria: { contentWidthIn: number; contentHeightIn: number }
): string {
  const PX_POR_PULGADA = 96;
  const anchoPx = geometria.contentWidthIn * PX_POR_PULGADA;

  const cont = document.createElement('div');
  cont.style.cssText = `position:absolute; left:-99999px; top:0; width:${anchoPx}px; visibility:hidden;`;
  cont.innerHTML = html;
  document.body.appendChild(cont);

  try {
    const tabla = cont.querySelector('table.items') as HTMLTableElement | null;
    const thead = tabla?.querySelector('thead');
    const filas = tabla ? Array.from(tabla.querySelectorAll('tbody > tr')) as HTMLElement[] : [];
    if (!tabla || !thead || filas.length === 0) return html;

    const contTop = cont.getBoundingClientRect().top;
    const tablaRect = tabla.getBoundingClientRect();
    // La altura de una pagina en px de layout: el mismo ancho en px equivale al
    // ancho de contenido del PDF, asi que la regla de tres da la altura util.
    const pageHeight = (geometria.contentHeightIn / geometria.contentWidthIn) * anchoPx;
    const preTableTop = tablaRect.top - contTop;
    const theadH = (thead as HTMLElement).offsetHeight;
    const alturas = filas.map((f) => f.getBoundingClientRect().height);

    const paginas = planificarPaginasItems(alturas, {
      pageHeight, preTableTop, theadH, safety: 10,
    });

    // Los items caben en una sola tabla: no hay <thead> que repetir, y el
    // cierre lo reparte html2pdf con las reglas de page-break del CSS.
    if (paginas.length <= 1) return html;

    const theadHTML = thead.outerHTML;
    const filasHTML = filas.map((f) => f.outerHTML);
    const parent = tabla.parentNode!;
    const marcador = document.createComment('items-paginados');
    parent.insertBefore(marcador, tabla);
    tabla.remove();

    const nuevoSalto = () => {
      const pb = document.createElement('div');
      pb.className = 'html2pdf__page-break';
      pb.style.pageBreakBefore = 'always';
      return pb;
    };

    paginas.forEach((indices, idx) => {
      if (idx > 0) parent.insertBefore(nuevoSalto(), marcador);
      const tbl = document.createElement('table');
      tbl.className = 'items';
      tbl.innerHTML = theadHTML + '<tbody>' + indices.map((i) => filasHTML[i]).join('') + '</tbody>';
      parent.insertBefore(tbl, marcador);
    });

    parent.removeChild(marcador);

    return cont.innerHTML;
  } finally {
    document.body.removeChild(cont);
  }
}

const PDF_ESCALA = 2;           // 2x para que el texto no salga pixelado
const PDF_CALIDAD_JPEG = 0.95;

/** Medidas de pagina en pulgadas, que es la unidad en la que trabaja el armado. */
const PDF_FORMATOS = {
  letter: { ancho: 8.5, alto: 11 },
  a4: { ancho: 8.27, alto: 11.69 },
} as const;

export interface OpcionesPdf {
  formato?: keyof typeof PDF_FORMATOS;
  margenIn?: number;
  /** Ancho de render del contenido en px. Define cuanto "cabe" a lo ancho. */
  anchoRenderPx?: number;
}

/**
 * Arma un PDF a partir de un elemento YA montado en el DOM y lo devuelve como Blob.
 */
export async function pdfBlobDesdeElemento(
  element: HTMLElement,
  opciones: OpcionesPdf = {}
): Promise<Blob> {
  const formato = opciones.formato ?? 'letter';
  const margenIn = opciones.margenIn ?? 0.3;
  const { ancho: anchoPagIn, alto: altoPagIn } = PDF_FORMATOS[formato];
  const anchoUtilIn = anchoPagIn - 2 * margenIn;
  const altoUtilIn = altoPagIn - 2 * margenIn;

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const canvas = await html2canvas(element, {
    scale: PDF_ESCALA,
    useCORS: true,
    logging: false,
    allowTaint: true,
    backgroundColor: '#ffffff',
    imageTimeout: 2000,
  });

  const topElemento = element.getBoundingClientRect().top;
  const cortes = Array.from(element.querySelectorAll('.html2pdf__page-break'))
    .map((n) => (n as HTMLElement).getBoundingClientRect().top - topElemento)
    .filter((y) => y > 0)
    .map((y) => Math.round(y * PDF_ESCALA))
    .sort((a, b) => a - b);

  const pxPorPagina = Math.floor((altoUtilIn / anchoUtilIn) * canvas.width);
  if (!pxPorPagina || pxPorPagina <= 0) {
    throw new Error('Dimensiones de canvas inválidas para generar el PDF');
  }

  const limites = [0, ...cortes, canvas.height];

  const pdf = new jsPDF({ unit: 'in', format: formato, orientation: 'portrait' });
  let primera = true;

  for (let i = 0; i < limites.length - 1; i++) {
    let desde = limites[i];
    const hasta = limites[i + 1];
    while (desde < hasta) {
      const alto = Math.min(pxPorPagina, hasta - desde);
      if (alto < 1) break;

      const trozo = document.createElement('canvas');
      trozo.width = canvas.width;
      trozo.height = alto;
      const ctx = trozo.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, trozo.width, trozo.height);
      ctx.drawImage(canvas, 0, desde, canvas.width, alto, 0, 0, canvas.width, alto);

      if (!primera) pdf.addPage();
      pdf.addImage(
        trozo.toDataURL('image/jpeg', PDF_CALIDAD_JPEG),
        'JPEG',
        margenIn,
        margenIn,
        anchoUtilIn,
        (alto * anchoUtilIn) / canvas.width
      );
      primera = false;
      desde += alto;
    }
  }

  return pdf.output('blob');
}

/** Renderiza el HTML fuera de pantalla y devuelve el PDF como Blob. */
export async function generarPdfBlob(html: string, opciones: OpcionesPdf = {}): Promise<Blob> {
  const formato = opciones.formato ?? 'letter';
  const margenIn = opciones.margenIn ?? 0.3;
  const { ancho: anchoPagIn, alto: altoPagIn } = PDF_FORMATOS[formato];

  let htmlFinal = html;
  try {
    htmlFinal = paginarItemsParaPdf(html, {
      contentWidthIn: anchoPagIn - 2 * margenIn,
      contentHeightIn: altoPagIn - 2 * margenIn,
    });
  } catch (e) {
    console.error('No se pudo paginar la tabla de items; se genera sin paginar:', e);
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.width = `${opciones.anchoRenderPx ?? 800}px`;
  iframe.style.height = '1000px';
  iframe.style.zIndex = '-99999';
  iframe.style.opacity = '0.01';
  iframe.style.pointerEvents = 'none';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) throw new Error('No se pudo crear iframe de renderizado');

  doc.open();
  doc.write(htmlFinal);
  doc.close();

  try {
    await convertAllImagesToBase64(doc.body);
    const scrollHeight = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
    iframe.style.height = `${scrollHeight}px`;
    return await pdfBlobDesdeElemento(doc.body, opciones);
  } finally {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }
}

/** Dispara la descarga de un Blob con el nombre indicado. */
export function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const activePdfDownloads = new Set<string>();

// Pre-warm PDF rendering modules in background for faster first click
if (typeof window !== 'undefined') {
  setTimeout(() => {
    Promise.all([import('html2canvas'), import('jspdf')]).catch(() => { });
  }, 2000);
}

export async function downloadHtmlAsPdf(html: string, filename: string = 'factura.pdf') {
  const lockKey = filename || 'pdf-export';
  if (activePdfDownloads.has(lockKey)) {
    console.warn(`[PDF Lock] Descarga en progreso para "${lockKey}". Clics adicionales ignorados.`);
    return;
  }

  activePdfDownloads.add(lockKey);
  try {
    // Yield to main UI thread so browser repaints immediately on click
    await new Promise((resolve) => setTimeout(resolve, 30));

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('PDF generation timeout')), 3500)
    );

    const blob = await Promise.race([generarPdfBlob(html), timeoutPromise]);
    if (!blob || blob.size === 0) throw new Error('El PDF se genero vacio');
    descargarBlob(blob, filename);
  } catch (err) {
    console.error('Error o timeout al generar PDF, usando vista de impresión rápida:', err);
    await printHtml(html);
  } finally {
    setTimeout(() => {
      activePdfDownloads.delete(lockKey);
    }, 1200);
  }
}

/**
 * Búsqueda inteligente y precisa para facturas y folios.
 * - Si se busca un folio explícito ('f984', 'F984', '#984', 'folio 984', '984'):
 *   Coincide ÚNICAMENTE con el número de folio correspondiente, evitando falsos positivos con UUIDs.
 * - Si se busca texto: Coincide con Cliente, Vendedor, Productos, Serie o Notas.
 */
export function matchInvoiceSearch(
  invoice: any,
  searchTerm: string,
  sellerName?: string
): boolean {
  if (!searchTerm || !searchTerm.trim()) return true;
  if (!invoice) return false;

  const rawTerm = searchTerm.trim().toLowerCase();

  // 1. Detección de Búsqueda Explícita de Folio (ej. 'f984', 'F984', '#984', 'f-984', 'fac984', 'folio 984', 'folio984')
  const explicitFolioMatch = rawTerm.match(/^(?:f|fac|folio|#)[\s\-_]*(\d+)$/i);
  if (explicitFolioMatch) {
    const targetFolio = explicitFolioMatch[1]; // ej. '984'
    const invFolio = invoice.folio !== undefined && invoice.folio !== null ? String(invoice.folio).trim() : '';
    return invFolio === targetFolio || invFolio.startsWith(targetFolio);
  }

  // 2. Si el término es puramente numérico (ej. '984' o '1013')
  if (/^\d+$/.test(rawTerm)) {
    const invFolio = invoice.folio !== undefined && invoice.folio !== null ? String(invoice.folio).trim() : '';
    if (invFolio === rawTerm || invFolio.startsWith(rawTerm)) {
      return true;
    }
    // Verificar teléfono o NIT del cliente si coinciden
    const phoneClean = String(invoice.phone || invoice.customerPhone || '').replace(/\D/g, '');
    if (phoneClean && phoneClean.includes(rawTerm)) return true;

    const nitClean = String(invoice.nit || invoice.customerNit || invoice.supplierNit || '').replace(/\D/g, '');
    if (nitClean && nitClean.includes(rawTerm)) return true;

    const invNum = String(invoice.invoiceNumber || invoice.correlative || '').trim();
    if (invNum && (invNum === rawTerm || invNum.startsWith(rawTerm))) return true;

    return false;
  }

  // 3. Búsqueda general de texto (por Cliente, Vendedor, Producto, Serie, Notas)
  const clientStr = String(invoice.client || invoice.clientName || invoice.customerName || '').toLowerCase();
  if (clientStr.includes(rawTerm)) return true;

  const nitStr = String(invoice.nit || invoice.customerNit || invoice.supplierNit || '').toLowerCase();
  if (nitStr.includes(rawTerm)) return true;

  const sellerIdStr = String(invoice.sellerId || '').toLowerCase();
  if (sellerIdStr.includes(rawTerm)) return true;

  if (sellerName && sellerName.toLowerCase().includes(rawTerm)) return true;

  // Productos en el pedido
  if (Array.isArray(invoice.items)) {
    const hasProductMatch = invoice.items.some((item: any) =>
      (item.productName || item.name || '').toLowerCase().includes(rawTerm)
    );
    if (hasProductMatch) return true;
  }

  // Serie / correlativo de documento
  const seriesStr = String(invoice.invoiceSeries || invoice.series || '').toLowerCase();
  const invoiceNumStr = String(invoice.invoiceNumber || invoice.correlative || '').toLowerCase();
  if (seriesStr && seriesStr.includes(rawTerm)) return true;
  if (invoiceNumStr && invoiceNumStr.includes(rawTerm)) return true;
  if (seriesStr && invoiceNumStr && `${seriesStr}-${invoiceNumStr}`.includes(rawTerm)) return true;

  // DTE / UUID solo si la búsqueda empieza por inv- o tiene formato DTE
  const dteStr = String(invoice.dte || invoice.uuid || invoice.felUuid || '').toLowerCase();
  if (dteStr && dteStr.includes(rawTerm) && rawTerm.length >= 6) return true;

  const idStr = String(invoice.id || '').toLowerCase();
  if (rawTerm.startsWith('inv-') && idStr.includes(rawTerm)) return true;

  return false;
}