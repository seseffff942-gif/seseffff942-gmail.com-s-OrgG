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
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  photo?: string;
  phone?: string;
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
  folio?: number;
  client: string;
  nit?: string;
  phone?: string;
  address?: string;
  items: InvoiceItem[];
  totalAmount: number;
  paidAmount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'sent' | 'rejected';
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
