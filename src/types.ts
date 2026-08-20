export type Role = 'admin' | 'seller';

export interface Client {
  id: string;
  sellerId?: string; // Add sellerId
  name: string;
  companyName?: string;
  nit?: string;
  phone?: string;
  address?: string;
  createdAt?: string;
  clientCode?: string;
  isBlocked?: boolean;
  isPendingSync?: boolean;
}

export interface User {
  id: string;
  name: string;
  email?: string | null;
  role: Role;
  photo?: string;
  phone?: string;
  sellerCode?: string;
  password?: string;
}

export interface AppNotification {
  id: string;
  type: 'out_of_stock' | 'low_stock' | 'restock' | 'sale_rejected' | 'sale_authorized' | 'new_order' | 'payment_received' | 'price_changed';
  title: string;
  message: string;
  productId?: string;
  invoiceId?: string;
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  color: string;
  size: string;
  price: number;
  stock?: number;
  isBlocked?: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  image?: string;
  description?: string;
  variants?: ProductVariant[];
  specifications?: { key: string; value: string }[];
  is_external?: boolean;
  costPrice?: number;
  cost_price?: number;
  hiddenFromSales?: boolean;
  hidden_from_sales?: boolean;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  suggestedPrice?: number;
  isOfferApplied?: boolean;
  total: number;
  variantId?: string;
  color?: string;
  size?: string;
  requiresAuth?: boolean;
  isAuthorized?: boolean;
}

export interface Invoice {
  id: string;
  sellerId: string;
  folio?: number | string;
  client: string;
  nit?: string;
  phone?: string;
  address?: string;
  items: InvoiceItem[];
  totalAmount: number;
  paidAmount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'sent' | 'rejected' | 'despachado';
  authStatus?: 'pending' | 'authorized' | 'rejected';
  date: string;
  notes?: string;
  trackingNumber?: string;
  deliveryLetterUrl?: string;
  shippingGuideUrl?: string;
  scanClient?: string;
  scanDate?: string;
  invoiceType?: 'agricola' | 'veterinaria';
  creditDays?: number;
  transportMethod?: 'bus' | 'paqueteria' | 'personal';
  paymentMethod?: string;
  seller?: string;
  sellerPaysShipping?: boolean;
  clientName?: string;
  sellerSignature?: string;
  adminSignature?: string;
  reviewedBy?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  receiptUrl?: string | null;
  date: string;
}

export interface Offer {
  id: string;
  name: string;
  buyQty: number;
  freeQty: number;
  productId: string;
  price?: number;
  sellerPrices?: Record<string, number>;
}

export type EstadoFEL = 'sin_emitir' | 'pendiente' | 'enviado' | 'certificado' | 'error' | 'anulado';

export interface DocumentoFEL {
  id: string;
  invoice_id: string;
  tipo_dte: string;
  estado: Exclude<EstadoFEL, 'sin_emitir'>;
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

export interface EstadoFacturaFEL {
  documento: DocumentoFEL | null;
  estado: EstadoFEL;
  nitReceptor: string;
  esConsumidorFinal: boolean;
  emisor?: { nit?: string; nombre?: string; nombreComercial?: string; ambiente?: string };
  desglose: { montoGravable: number; montoIva: number; granTotal: number };
  advertencias: string[];
}

export interface QuotationItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  suggestedPrice?: number;
  isOfferApplied?: boolean;
  total: number;
  variantId?: string;
  color?: string;
  size?: string;
}

export interface Quotation {
  id: string;
  folio: string; // ej: "COT-0001"
  folioNumber: number;
  sellerId: string;
  sellerName?: string;
  client: string;
  nit?: string;
  phone?: string;
  address?: string;
  items: QuotationItem[];
  totalAmount: number;
  status: 'pendiente' | 'aceptada' | 'convertida' | 'rechazada' | 'vencida';
  date: string;
  validityDays: number;
  validUntil: string;
  notes?: string;
  invoiceId?: string;
  convertedInvoiceFolio?: number | string;
  createdAt: string;
}

export type PurchaseInvoiceType = 'factura_normal' | 'factura_cambiaria' | 'recibo_compra' | 'otro';
export type PurchasePaymentMethod = 'boleta' | 'transferencia' | 'cheque' | 'efectivo' | 'tarjeta' | 'otro';

export interface Supplier {
  id: string;
  name: string; // Nombre comercial
  legalName?: string; // Nombre que aparece en el NIT / Razón Social
  nit?: string;
  phone?: string;
  email?: string;
  address?: string;
  category: string;
  creditDays: number;
  bankName?: string;
  bankAccount?: string;
  createdAt?: string;
}

export interface PurchasePaymentReceipt {
  id: string;
  debtId?: string;
  paymentDate: string; // YYYY-MM-DD
  amount: number;
  paymentMethod: PurchasePaymentMethod;
  authNumber: string; // Número de autorización / número de boleta / transacción
  bankName: string; // Banco (Banrural, Banco Industrial, G&T Continental, BAC, etc.)
  supplierName?: string; // Nombre comercial
  supplierLegalName?: string; // Nombre en NIT / Razón Social
  supplierNit?: string; // NIT del proveedor
  invoiceNumber?: string; // Número de factura pagada
  invoiceSeries?: string; // Número de serie de la factura
  invoiceDte?: string; // Número de DTE / Autorización
  invoiceTitle?: string;
  imageUrl?: string;
  reference?: string; // Compatibilidad con registros previos
  date?: string; // Compatibilidad con registros previos
  notes?: string;
  createdAt?: string;
}

export interface BusinessDebtItem {
  name: string;
  quantity: number;
  price: number;
  subtotal?: number;
}

export interface BusinessDebt {
  id: string;
  title: string;
  invoiceNumber?: string; // Número de factura
  invoiceSeries?: string; // Número de serie
  invoiceType?: PurchaseInvoiceType; // 'factura_normal' | 'factura_cambiaria' | 'recibo_compra' | 'otro'
  dte?: string; // Número de DTE / Autorización SAT
  supplierId: string | null;
  supplierNit?: string; // NIT del proveedor
  supplierNitName?: string; // Nombre que aparece en el NIT ante SAT (Razón Social)
  supplierCommercialName?: string; // Nombre de la empresa o nombre comercial
  invoiceDate: string; // YYYY-MM-DD Fecha de emisión
  creditDays: number; // Tiempo de vigencia / plazo de crédito en días
  dueDate: string; // YYYY-MM-DD Fecha límite calculada
  subtotal?: number; // Monto base gravable (sin IVA)
  iva?: number; // Monto IVA (12%)
  amount: number; // Total de la factura
  type: 'ingresa' | 'paga';
  notes?: string;
  isPaid: boolean;
  receipts?: PurchasePaymentReceipt[];
  createdAt: string;
  invoiceImageUrl?: string;
  orderReceivedBy?: string;
  status?: 'pedido' | 'entregado' | 'pendiente' | 'cancelado';
  items?: BusinessDebtItem[];
}

