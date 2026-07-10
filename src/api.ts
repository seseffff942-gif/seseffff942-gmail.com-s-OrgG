import { Product, User, Invoice, Payment, Offer, Client, AppNotification } from './types';

// Safe JSON parser to handle non-JSON responses from proxy or rate limters
const safeJson = async (res: Response) => {
  const text = await res.text().catch(() => '');
  try {
    return JSON.parse(text);
  } catch (err) {
    if (res.status === 429) {
      return { error: 'Demasiadas solicitudes. Por favor, realiza menos peticiones o inténtalo de nuevo en 15 minutos.' };
    }
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      return { error: `Servidor y base de datos con alta latencia (Error ${res.status}). Por favor, espera unos segundos y reintenta.` };
    }
    return { error: `Error de respuesta (${res.status}): ${text.substring(0, 120) || res.statusText || 'Respuesta no válida'}` };
  }
};

const compressImage = (file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.75): Promise<File> => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return resolve(file);
    }

    const isImage = (file.type && file.type.startsWith('image/')) || 
                    /\.(jpe?g|png|webp|heic|heif|gif|tiff)$/i.test(file.name || '');

    if (!isImage) {
      return resolve(file);
    }

    // Skip small images (under 150KB) to save CPU
    if (file.size < 150 * 1024) {
      return resolve(file);
    }

    let objectUrl: string | null = null;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch (err) {
      console.warn("createObjectURL has failed, falling back to FileReader", err);
    }

    if (objectUrl) {
      const img = new Image();
      
      img.onload = () => {
        try {
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

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(objectUrl!);
            return resolve(file);
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(objectUrl!);
              if (!blob) {
                return resolve(file);
              }
              const extension = file.name ? file.name.substring(file.name.lastIndexOf('.')) : '.jpg';
              const baseName = file.name ? file.name.substring(0, file.name.lastIndexOf('.')) : 'image';
              const resizedFile = new File([blob], `${baseName}-resized.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });

              // If the compressed file is indeed smaller, return it
              if (resizedFile.size < file.size) {
                resolve(resizedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            quality
          );
        } catch (canvasErr) {
          console.error("Canvas draw/toBlob error:", canvasErr);
          URL.revokeObjectURL(objectUrl!);
          resolve(file);
        }
      };

      img.onerror = (err) => {
        console.warn("Image load failed via objectUrl:", err);
        URL.revokeObjectURL(objectUrl!);
        
        // Final guard size limit
        if (file.size > 4.2 * 1024 * 1024) {
          reject(new Error(`La imagen "${file.name}" es demasiado grande (${(file.size / (1024 * 1024)).toFixed(1)} MB) y tu dispositivo o formato (HEIC) no permite comprimirla aquí. Por favor, toma la foto con menor resolución, envíala por WhatsApp primero para reducirla automáticamente, o selecciona "Tamaño más pequeño" al cargarla.`));
        } else {
          resolve(file);
        }
      };

      img.src = objectUrl;
    } else {
      // Fallback with FileReader if createObjectURL is not available
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          try {
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

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(file);

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                if (!blob) return resolve(file);
                const resizedFile = new File([blob], file.name ? file.name.substring(0, file.name.lastIndexOf('.')) + "-resized.jpg" : 'image.jpg', {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });
                if (resizedFile.size < file.size) {
                  resolve(resizedFile);
                } else {
                  resolve(file);
                }
              },
              'image/jpeg',
              quality
            );
          } catch (e) {
            resolve(file);
          }
        };
        img.onerror = () => {
          if (file.size > 4.2 * 1024 * 1024) {
            reject(new Error(`La imagen "${file.name}" es demasiado grande (${(file.size / (1024 * 1024)).toFixed(1)} MB). Por favor, intenta de nuevo con una foto de menor resolución o envíala por WhatsApp primero.`));
          } else {
            resolve(file);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        if (file.size > 4.2 * 1024 * 1024) {
          reject(new Error(`Error al leer archivo de imagen. Es demasiado grande (${(file.size / (1024 * 1024)).toFixed(1)} MB). Por favor, usa una foto más pequeña.`));
        } else {
          resolve(file);
        }
      };
    }
  });
};

// Simple api wrapper
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('app_token');
  const headers: any = { ...options.headers };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(url, { ...options, headers });
  
  // If mutating and successful, notify standard notification listener to poll
  const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method || '');
  if (isMutating && response.ok) {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('agricovet-mutate'));
    }, 1000);
  }

  if (response.status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/auth/me')) {
    localStorage.removeItem('app_token');
    localStorage.removeItem('app_user');
    if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
        // Wait forever so we don't throw an error while redirecting
        await new Promise(() => {});
    }
  }
  return response;
};

export const api = {
  getClients: async (): Promise<Client[]> => {
    const res = await fetchWithAuth('/api/clients');
    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(err.error || 'Failed to fetch clients');
    }
    return safeJson(res);
  },

  addClient: async (clientData: any): Promise<Client> => {
    const res = await fetchWithAuth('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clientData)
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to add client');
    return data.client;
  },

  updateClient: async (id: string, clientData: any): Promise<Client> => {
    const res = await fetchWithAuth(`/api/clients/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clientData)
    });
    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update client');
    }
    return data.client;
  },

  getMe: async (): Promise<User | null> => {
    const token = localStorage.getItem('app_token');
    if (!token) return null;
    const res = await fetchWithAuth('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      localStorage.removeItem('app_token');
      localStorage.removeItem('app_user');
      return null;
    }
    const data = await safeJson(res);
    return data.user;
  },

  login: async (email: string, password?: string): Promise<User> => {
    const res = await fetchWithAuth('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to login');
    }
    if (data.token) localStorage.setItem('app_token', data.token);
    return data.user;
  },

  registerIntent: async (email: string): Promise<any> => {
    const res = await fetchWithAuth('/api/auth/register-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await safeJson(res);
    if (!res.ok) {
        throw new Error(data.error || 'Error enviando código');
    }
    return data;
  },

  register: async (data: any): Promise<User> => {
    const res = await fetchWithAuth('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const resData = await safeJson(res);
    if (!res.ok) {
        throw new Error(resData.error || 'Failed to register');
    }
    if (resData.token) localStorage.setItem('app_token', resData.token);
    return resData.user;
  },

  createProduct: async (product: Omit<Product, 'id' | 'image'>): Promise<Product> => {
    const res = await fetchWithAuth('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    const resData = await safeJson(res);
    if (!res.ok) {
      throw new Error(resData.error || 'Error al crear producto');
    }
    return resData;
  },

  getProducts: async (): Promise<Product[]> => {
    try {
      const res = await fetchWithAuth('/api/products');
      if (!res.ok) {
        const err = await safeJson(res);
        throw new Error(err.error || 'Failed to fetch products');
      }
      const data = await safeJson(res);
      localStorage.setItem('cached_products', JSON.stringify(data));
      return data;
    } catch (err) {
      const cached = localStorage.getItem('cached_products');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {}
      }
      throw err;
    }
  },

  updateProduct: async (id: string, updates: Partial<Product>): Promise<Product> => {
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update product');
    }
    return res.json();
  },

  deleteProduct: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete product');
    }
    return res.json();
  },

  bulkGenerateDescriptions: async (): Promise<{ success: boolean; generatedCount: number; remaining: number; message: string }> => {
    const res = await fetchWithAuth('/api/products/bulk-generate-descriptions', { method: 'POST' });
    if (!res.ok) throw new Error('Error al generar descripciones masivas');
    return res.json();
  },

  uploadProductImage: async (id: string, file: File): Promise<{ success: boolean; image: string }> => {
    const compressedFile = await compressImage(file, 1024, 1024, 0.75);
    const formData = new FormData();
    formData.append('image', compressedFile);
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(id)}/image`, {
      method: 'POST',
      body: formData
    });
    const resData = await safeJson(res);
    if (!res.ok) {
        throw new Error(resData.error || 'Error al subir imagen');
    }
    return resData;
  },

  getOffers: async (): Promise<Offer[]> => {
    const res = await fetchWithAuth('/api/offers');
    if (!res.ok) throw new Error('Failed to fetch offers');
    return res.json();
  },

  createOffer: async (offer: Omit<Offer, 'id'>): Promise<Offer> => {
    const res = await fetchWithAuth('/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(offer)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create offer');
    }
    return res.json();
  },

  createInvoice: async (data: { sellerId: string; client: string; nit?: string; phone?: string; address?: string; notes?: string; items: any[]; isOwed: boolean; invoiceType: 'agricola' | 'veterinaria'; creditDays: number; customDate?: string }): Promise<Invoice> => {
    const res = await fetchWithAuth('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to generate invoice');
    }
    return res.json();
  },

  updateInvoiceCreditDays: async (invoiceId: string, creditDays: number): Promise<void> => {
    const res = await fetchWithAuth(`/api/invoices/${encodeURIComponent(invoiceId)}/credit-days`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creditDays })
    });
    if (!res.ok) {
      throw new Error('Failed to update credit days');
    }
  },

  updateFullInvoice: async (id: string, data: { client: string; nit?: string; phone?: string; address?: string; notes?: string; items: any[]; isOwed: boolean }): Promise<Invoice> => {
    const res = await fetchWithAuth(`/api/invoices/${id}/full`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update invoice');
    }
    return res.json();
  },

  updateInvoiceStatus: async (id: string, status: string, guideNumber?: string, folio?: number, deliveryLetterUrl?: string, shippingGuideUrl?: string, clientName?: string, shippingDate?: string): Promise<void> => {
    const res = await fetchWithAuth(`/api/invoices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, guideNumber, folio, deliveryLetterUrl, shippingGuideUrl, clientName, shippingDate })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
  },

  archiveInvoice: async (id: string): Promise<void> => {
    const res = await fetchWithAuth(`/api/invoices/${id}/archive`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al archivar la factura');
    }
  },

  deleteInvoiceOriginal: async (id: string): Promise<void> => {
    const res = await fetchWithAuth(`/api/invoices/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al eliminar la factura');
    }
  },

  updateInvoiceItemPrice: async (id: string, itemIndex: number, newPrice: number): Promise<void> => {
    const res = await fetchWithAuth(`/api/invoices/${id}/price`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIndex, newPrice })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
  },

  getDailyStats: async (date?: string): Promise<any> => {
    const url = date ? `/api/daily-stats?today=${date}` : '/api/daily-stats';
    const res = await fetchWithAuth(url);
    if (!res.ok) throw new Error('Failed to fetch daily stats');
    return res.json();
  },

  getAllPayments: async (): Promise<any[]> => {
    const res = await fetchWithAuth('/api/payments');
    if (!res.ok) throw new Error('Failed to fetch payments');
    return res.json();
  },

  getInvoices: async (sellerId?: string): Promise<Invoice[]> => {
    const url = sellerId ? `/api/invoices?sellerId=${encodeURIComponent(sellerId)}` : '/api/invoices';
    const res = await fetchWithAuth(url);
    if (!res.ok) throw new Error('Failed to fetch invoices');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  getClientInvoices: async (clientName: string): Promise<Invoice[]> => {
    const url = `/api/invoices?client=${encodeURIComponent(clientName)}`;
    const res = await fetchWithAuth(url);
    if (!res.ok) throw new Error('Failed to fetch client invoices');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  getInvoicePayments: async (invoiceId: string): Promise<Payment[]> => {
    const res = await fetchWithAuth(`/api/invoices/${encodeURIComponent(invoiceId)}/payments`);
    if (!res.ok) throw new Error('Failed to fetch invoice payments');
    return res.json();
  },

  addPayment: async (invoiceId: string, amount: number, receiptFile?: File): Promise<{ invoice: Invoice; payment: Payment }> => {
    const formData = new FormData();
    formData.append('amount', amount.toString());
    if (receiptFile) {
      const compressedReceipt = await compressImage(receiptFile, 1200, 1200, 0.75);
      formData.append('receipt', compressedReceipt);
    }

    const res = await fetchWithAuth(`/api/invoices/${invoiceId}/payments`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Payment failed');
    }
    return res.json();
  },

  updateInvoiceAuth: async (invoiceId: string, status: 'authorized' | 'rejected' | 'pending'): Promise<any> => {
    const res = await fetchWithAuth(`/api/invoices/${encodeURIComponent(invoiceId)}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Error al actualizar autorización');
    return res.json();
  },

  getNotifications: async (): Promise<AppNotification[]> => {
    try {
      const res = await fetchWithAuth('/api/notifications');
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const data = await res.json();
      localStorage.setItem('cached_notifications', JSON.stringify(data));
      return data;
    } catch (err) {
      console.warn('Failed to fetch notifications online, trying local cache:', err);
      const cached = localStorage.getItem('cached_notifications');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {}
      }
      return [];
    }
  },

  deleteNotification: async (id: string): Promise<void> => {
    const res = await fetchWithAuth(`/api/notifications/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete notification');
  },

  clearAllNotifications: async (): Promise<void> => {
    const res = await fetchWithAuth('/api/notifications', {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to clear notifications');
  },

  getUsers: async (): Promise<User[]> => {
    try {
      const res = await fetchWithAuth('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      localStorage.setItem('cached_users', JSON.stringify(data));
      return data;
    } catch (err) {
      const cached = localStorage.getItem('cached_users');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {}
      }
      throw err;
    }
  },

  createUser: async (user: Partial<User>): Promise<User> => {
    const res = await fetchWithAuth('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create user');
    }
    return res.json();
  },

  updateUser: async (userId: string, updates: Partial<User>): Promise<User> => {
    const res = await fetchWithAuth(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update user');
    }
    const data = await res.json();
    return data.user;
  },

  updateUserPhoto: async (userId: string, file: File): Promise<{ success: boolean; photo: string }> => {
    const compressedFile = await compressImage(file, 400, 400, 0.75);
    const formData = new FormData();
    formData.append('image', compressedFile);
    const res = await fetchWithAuth(`/api/users/${userId}/photo`, {
      method: 'PUT',
      body: formData
    });
    if (!res.ok) throw new Error('Error al actualizar foto');
    return res.json();
  },

  askGemini: async (message: string, history: Array<{ role: 'user' | 'model'; content: string }> = []): Promise<{ reply: string }> => {
    const res = await fetchWithAuth('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history })
    });
    const data = await res.json();
    if (!res.ok) {
      const errMsg = data.error || 'Failed to communicate with AI';
      const exc = new Error(errMsg);
      (exc as any).details = data.details || '';
      throw exc;
    }
    return data;
  },

  getFolioConfig: async (): Promise<{ resetDate: string | null; startFrom: number }> => {
    const res = await fetchWithAuth('/api/invoices/folio-config');
    if (!res.ok) throw new Error('Error al obtener configuración de folios');
    return res.json();
  },

  testWhatsApp: async (phone: string) => {
    const res = await fetchWithAuth('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        message: "¡Hola! Este es un mensaje de prueba automática de Agricovet."
      })
    });
    if (!res.ok) {
        let errStr = "Error desconocido";
        try { const d = await res.json(); errStr = d.error || JSON.stringify(d); } catch(e){}
        throw new Error(errStr);
    }
    return res.json();
  },

  resetFolio: async (resetDate?: string, startFrom?: number): Promise<{ success: boolean; config: { resetDate: string; startFrom: number } }> => {
    const res = await fetchWithAuth('/api/invoices/reset-folio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetDate, startFrom })
    });
    if (!res.ok) throw new Error('Error al reiniciar folios');
    return res.json();
  },

  getPrintTemplate: async (): Promise<{ template: string }> => {
    const res = await fetchWithAuth('/api/invoices/print-template');
    if (!res.ok) throw new Error('Error al obtener la plantilla de impresión');
    return res.json();
  },

  savePrintTemplate: async (template: string): Promise<{ success: boolean }> => {
    const res = await fetchWithAuth('/api/invoices/print-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template })
    });
    if (!res.ok) throw new Error('Error al guardar la plantilla de impresión');
    return res.json();
  },
  
  getWarehouseConfig: async (): Promise<{ location: string; isSilentModeActive?: boolean; logoUrl?: string; signatureUrl?: string }> => {
    const res = await fetchWithAuth('/api/warehouse-config');
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'Error al obtener configuración de bodega');
    return data;
  },

  getWhatsAppConfig: async () => {
    const res = await fetchWithAuth('/api/whatsapp/config');
    if (!res.ok) throw new Error('Error al obtener configuración de whatsapp');
    return res.json();
  },

  updateWhatsAppConfig: async (config: any) => {
    const res = await fetchWithAuth('/api/whatsapp/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error('Error al actualizar configuración de whatsapp');
    return res.json();
  },

  verifyWarehousePassword: async (password: string): Promise<{ success: boolean; location: string; signatureUrl?: string; logoUrl?: string }> => {
    const res = await fetchWithAuth('/api/warehouse-config/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data?.error || 'Contraseña incorrecta');
    }
    return data;
  },

  updateWarehouseConfig: async (data: { location?: string; password?: string; isSilentModeActive?: boolean; logoUrl?: string; signatureUrl?: string }): Promise<{ success: boolean }> => {
    const res = await fetchWithAuth('/api/warehouse-config/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const resData = await safeJson(res);
    if (!res.ok) throw new Error(resData?.error || 'Error al actualizar configuración de bodega');
    return resData;
  },

  notifyWarehouseShare: async (): Promise<void> => {
    await fetchWithAuth('/api/warehouse-config/notify-share', {
      method: 'POST'
    });
  },

  getSuppliers: async (): Promise<any[]> => {
    const res = await fetchWithAuth('/api/suppliers');
    if (!res.ok) throw new Error('Error al obtener proveedores');
    return res.json();
  },

  createSupplier: async (data: any): Promise<any> => {
    const res = await fetchWithAuth('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al crear proveedor');
    return res.json();
  },

  updateSupplier: async (id: string, data: any): Promise<any> => {
    const res = await fetchWithAuth(`/api/suppliers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al actualizar proveedor');
    return res.json();
  },

  deleteSupplier: async (id: string): Promise<any> => {
    const res = await fetchWithAuth(`/api/suppliers/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error al eliminar proveedor');
    return res.json();
  },

  uploadReceiptFile: async (file: File): Promise<{ success: boolean; imageUrl: string }> => {
    const compressedFile = await compressImage(file, 1200, 1200, 0.75);
    const formData = new FormData();
    formData.append('receipt', compressedFile);
    const res = await fetchWithAuth('/api/business-debts/upload-receipt', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Error al subir boleta de pago');
    return res.json();
  },

  detectShippingGuideText: async (file: File): Promise<any> => {
    const compressedFile = await compressImage(file, 1200, 1200, 0.75);
    const formData = new FormData();
    formData.append('guide', compressedFile);
    const res = await fetchWithAuth('/api/sales/detect-shipping-guide', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Error al escanear la guía por OCR');
    return res.json();
  },

  detectInvoiceText: async (file: File): Promise<any> => {
    const compressedFile = await compressImage(file, 1200, 1200, 0.75);
    const formData = new FormData();
    formData.append('invoice', compressedFile);
    const res = await fetchWithAuth('/api/business-debts/detect-invoice-text', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Error al escanear la factura por OCR');
    return res.json();
  },

  deleteBusinessDebt: async (id: string): Promise<any> => {
    const res = await fetchWithAuth(`/api/business-debts/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error al eliminar de deudas');
    return res.json();
  },

  clearSales: async (): Promise<any> => {
    const res = await fetchWithAuth('/api/sales/clear', {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error al limpiar las ventas');
    return res.json();
  },

  getPushPublicKey: async (): Promise<string> => {
    const res = await fetchWithAuth('/api/push/public-key');
    if (!res.ok) throw new Error('Error al obtener la llave pública push');
    const data = await res.json();
    return data.publicKey;
  },

  sendPushSubscription: async (subscription: any): Promise<any> => {
    const res = await fetchWithAuth('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });
    if (!res.ok) throw new Error('Error al guardar la suscripción push');
    return res.json();
  },

  testPushNotification: async (title?: string, message?: string): Promise<any> => {
    const res = await fetchWithAuth('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message })
    });
    if (!res.ok) throw new Error('Error al enviar el push de prueba');
    return res.json();
  },

  getAppLogo: async (): Promise<{ logoUrl: string }> => {
    try {
      const res = await fetch('/api/app-logo');
      if (res.ok) {
        return res.json();
      }
    } catch (e) {
      console.warn("Error fetching app logo:", e);
    }
    return { logoUrl: '/agricovet.png' };
  },

  uploadAppLogo: async (file: File): Promise<{ success: boolean; logoUrl: string }> => {
    const formData = new FormData();
    formData.append('logo', file);
    const token = localStorage.getItem('app_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch('/api/app-logo/upload', {
      method: 'POST',
      headers,
      body: formData
    });
    if (!res.ok) throw new Error('Error al subir el logo corporativo');
    return res.json();
  },

  uploadAppSignature: async (file: File): Promise<{ success: boolean; signatureUrl: string }> => {
    const formData = new FormData();
    formData.append('signature', file);
    const token = localStorage.getItem('app_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch('/api/app-signature/upload', {
      method: 'POST',
      headers,
      body: formData
    });
    if (!res.ok) throw new Error('Error al subir la firma');
    return res.json();
  },

  impersonate: async (userId: string): Promise<User> => {
    const res = await fetchWithAuth('/api/auth/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to impersonate');
    }
    
    // Backup current admin if not already in an impersonation session
    if (!localStorage.getItem('admin_token')) {
      localStorage.setItem('admin_token', localStorage.getItem('app_token') || '');
      localStorage.setItem('admin_user', localStorage.getItem('app_user') || '');
    }
    
    // Set new impersonated user
    localStorage.setItem('app_token', data.token);
    localStorage.setItem('app_user', JSON.stringify(data.user));
    
    return data.user;
  }
};
