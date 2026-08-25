import { Capacitor } from '@capacitor/core';
import { createClient } from '@supabase/supabase-js';
import { Product, User, Invoice, Payment, Offer, Client, AppNotification, EstadoFacturaFEL, Quotation, ReciboConforme } from './types';
import preloadedData from './data/preloadedData.json';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://vedgedsbuajueynnyvpn.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const SUPABASE_REST_BASE = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1`;

export const fetchSupabaseRest = async (table: string, queryParams: string = 'select=*') => {
  const cleanParams = queryParams.startsWith('?') ? queryParams.substring(1) : queryParams;
  const url = `${SUPABASE_REST_BASE}/${table}?${cleanParams}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) throw new Error(`Supabase REST fetch error (${res.status}): ${res.statusText}`);
  return res.json();
};

export const CUSTOM_FOLIO_OVERRIDES: Record<string, number> = {
  'INV-1783096985871': 881, // Felipe Contreras - Agropecuaria Mardoqueo -> Folio 881
  'INV-1783391385068': 887  // Eliel Betancourt - Agroveterinaria La cumbre -> Folio 887
};

export const parseInvoiceFlags = (inv: any): Invoice => {
  const mappedInv = { ...inv };
  mappedInv.client = inv.client || inv.clientName || inv.customerName || inv.name || 'Cliente sin nombre';
  mappedInv.clientName = mappedInv.client;
  mappedInv.phone = inv.phone || inv.customerPhone || '';
  mappedInv.address = inv.address || inv.deliveryAddress || '';
  const rawNotes = mappedInv.notes || "";

  // 1. Lectura directa desde columnas dedicadas de la base de datos
  if (inv.folio !== undefined && inv.folio !== null && String(inv.folio).trim() !== '') {
    const strVal = String(inv.folio).trim();
    mappedInv.folio = /^\d+$/.test(strVal) ? parseInt(strVal, 10) : strVal;
  }
  if (inv.invoice_type) mappedInv.invoiceType = inv.invoice_type;
  if (inv.credit_days !== undefined && inv.credit_days !== null) mappedInv.creditDays = inv.credit_days;
  if (inv.transport_method) mappedInv.transportMethod = inv.transport_method;
  if (inv.seller_pays_shipping !== undefined) mappedInv.sellerPaysShipping = Boolean(inv.seller_pays_shipping);
  if (inv.auth_status) mappedInv.authStatus = inv.auth_status;
  if (inv.guide_number) mappedInv.trackingNumber = inv.guide_number;
  if (inv.observations) mappedInv.notes = inv.observations;
  if (inv.delivery_letter_url) mappedInv.deliveryLetterUrl = inv.delivery_letter_url;
  if (inv.shipping_guide_url) mappedInv.shippingGuideUrl = inv.shipping_guide_url;
  if (inv.scan_client) mappedInv.scanClient = inv.scan_client;
  if (inv.scan_date) mappedInv.scanDate = inv.scan_date;
  if (inv.reviewed_by) mappedInv.reviewedBy = inv.reviewed_by;

  // 2. Retrocompatibilidad para campos empaquetados en notes
  if (rawNotes.includes("|||")) {
    const flags = rawNotes.split("|||");
    let potentialNit = flags[0].trim();
    if (potentialNit.length > 25 || potentialNit.toLowerCase().includes("enviar") || potentialNit.toLowerCase().includes("entrega") || potentialNit.toLowerCase().includes("nota")) {
      if (!mappedInv.notes) mappedInv.notes = potentialNit;
      mappedInv.nit = mappedInv.nit || "";
    } else {
      mappedInv.nit = mappedInv.nit || potentialNit;
      if (!mappedInv.notes) mappedInv.notes = "";
    }
    flags.slice(1).forEach((flag: string) => {
      const idx = flag.indexOf(':');
      if (idx !== -1) {
        const key = flag.substring(0, idx);
        const value = flag.substring(idx + 1);
        if (key === "AUTH" && !mappedInv.authStatus) {
          mappedInv.authStatus = value;
        } else if (key === "DEBT") {
          mappedInv.hasDebtAlert = value === "true";
        } else if (key === "CREDIT" && mappedInv.creditDays === undefined) {
          const val = parseInt(value, 10);
          if (!isNaN(val)) mappedInv.creditDays = val;
        } else if (key === "TYPE" && !mappedInv.invoiceType) {
          mappedInv.invoiceType = value;
        } else if (key === "TRACKING" && !mappedInv.trackingNumber) {
          mappedInv.trackingNumber = value;
        } else if (key === "DELIVERY_LETTER" && !mappedInv.deliveryLetterUrl) {
          mappedInv.deliveryLetterUrl = value;
        } else if (key === "SHIPPING_GUIDE" && !mappedInv.shippingGuideUrl) {
          mappedInv.shippingGuideUrl = value;
        } else if (key === "SCAN_CLIENT" && !mappedInv.scanClient) {
          mappedInv.scanClient = value;
        } else if (key === "SCAN_DATE" && !mappedInv.scanDate) {
          mappedInv.scanDate = value;
        } else if (key === "OBS" && !mappedInv.notes) {
          mappedInv.notes = value;
        } else if (key === "EDITED") {
          mappedInv.isEdited = value === "true";
        } else if (key === "FOLIO" && mappedInv.folio === undefined) {
          const val = value.trim();
          mappedInv.folio = /^\d+$/.test(val) ? parseInt(val, 10) : val;
        }
      }
    });
  }
  return mappedInv as Invoice;
};

const getApiUrl = (endpoint: string): string => {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const customUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('app_custom_api_url') : null;
  if (customUrl && customUrl.trim() !== '') {
    const baseUrl = customUrl.trim().replace(/\/$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
  }
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
  if (isNative) {
    const baseUrl = (import.meta.env.VITE_API_URL || 'https://www.agricovet.lat').replace(/\/$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
  }
  return endpoint;
};

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
const fetchWithAuth = async (url: string, options: RequestInit = {}, retries = 1): Promise<Response> => {
  const token = localStorage.getItem('app_token');
  const headers: any = { ...options.headers };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (err: any) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 400));
      return fetchWithAuth(url, options, retries - 1);
    }
    const errText = String(err?.message || err || '');
    if (errText.includes('Failed to fetch') || err?.name === 'TypeError') {
      throw new Error('Sin conexión con el servidor (www.agricovet.lat). Revisa tu conexión a internet o intenta de nuevo.');
    }
    throw err;
  }
  
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

// In-memory cache for ultra-fast tab switching and navigation
const apiMemoryCache: Record<string, { timestamp: number; data: any }> = {};
const CLIENT_CACHE_TTL_MS = 2000; // 2 seconds TTL for real-time responsiveness

const getCachedApi = (key: string): any | null => {
  const item = apiMemoryCache[key];
  if (item && (Date.now() - item.timestamp) < CLIENT_CACHE_TTL_MS) {
    return item.data;
  }
  return null;
};

const setCachedApi = (key: string, data: any): void => {
  apiMemoryCache[key] = { timestamp: Date.now(), data };
};

export const clearApiCache = (keyPrefix?: string): void => {
  if (!keyPrefix) {
    Object.keys(apiMemoryCache).forEach(k => delete apiMemoryCache[k]);
  } else {
    Object.keys(apiMemoryCache).forEach(k => {
      if (k.startsWith(keyPrefix)) delete apiMemoryCache[k];
    });
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('agricovet-mutate', () => clearApiCache());
}

export const api = {
  getClients: async (force: boolean = false): Promise<Client[]> => {
    if (!force) {
      const cached = getCachedApi('clients');
      if (cached) return cached;
    }
    try {
      const { data, error } = await supabase.from('clients').select('*').order('name', { ascending: true });
      if (!error && data && Array.isArray(data) && data.length > 0) {
        setCachedApi('clients', data);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('offline_clients', JSON.stringify(data));
        }
        return data as Client[];
      }
    } catch (e) {
      console.warn('Direct Supabase clients fetch fallback:', e);
    }
    try {
      const res = await fetchWithAuth('/api/clients');
      if (!res.ok) throw new Error('Failed to fetch clients');
      const data = await safeJson(res);
      setCachedApi('clients', data);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('offline_clients', JSON.stringify(data));
      }
      return data;
    } catch (err) {
      if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem('offline_clients');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          } catch (e) {}
        }
      }
      return (preloadedData.clients || []) as any[];
    }
  },

  addClient: async (clientData: any): Promise<Client> => {
    clearApiCache('clients');
    try {
      const res = await fetchWithAuth('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to add client');
      clearApiCache('clients');
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('offline_clients');
      }
      return data.client;
    } catch (err: any) {
      const isConnError = err.message?.includes('Sin conexión') || err.message?.includes('Failed to fetch') || err.name === 'TypeError';
      if (isConnError && typeof localStorage !== 'undefined') {
        const localClient: Client = {
          id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: clientData.name || '',
          companyName: clientData.companyName || '',
          nit: clientData.nit || 'C/F',
          phone: clientData.phone || '',
          address: clientData.address || '',
          sellerId: clientData.sellerId || '',
          createdAt: new Date().toISOString(),
          isPendingSync: true
        };
        const rawCached = localStorage.getItem('offline_clients');
        const cachedClients: Client[] = rawCached ? JSON.parse(rawCached) : [];
        cachedClients.unshift(localClient);
        localStorage.setItem('offline_clients', JSON.stringify(cachedClients));

        const rawQueue = localStorage.getItem('offline_clients_queue');
        const queue: any[] = rawQueue ? JSON.parse(rawQueue) : [];
        queue.push(clientData);
        localStorage.setItem('offline_clients_queue', JSON.stringify(queue));

        return localClient;
      }
      throw err;
    }
  },

  updateClient: async (id: string, clientData: any, oldData?: any): Promise<Client> => {
    clearApiCache('clients');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('offline_clients');
    }
    const payload = {
      ...clientData,
      oldName: oldData?.name || clientData.oldName,
      oldClientCode: oldData?.clientCode || clientData.oldClientCode,
      oldNit: oldData?.nit || clientData.oldNit
    };
    const res = await fetchWithAuth(`/api/clients/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res);
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update client');
    }
    clearApiCache('clients');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('offline_clients');
    }
    return data.client;
  },

  deleteClient: async (id: string, name?: string, clientCode?: string, companyName?: string, nit?: string): Promise<{ success: boolean; message?: string }> => {
    clearApiCache('clients');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('offline_clients');
    }
    const params = new URLSearchParams();
    if (name) params.append('name', name);
    if (clientCode) params.append('clientCode', clientCode);
    if (companyName) params.append('companyName', companyName);
    if (nit) params.append('nit', nit);
    const url = `/api/clients/${encodeURIComponent(id)}${params.toString() ? `?${params.toString()}` : ''}`;

    const res = await fetchWithAuth(url, {
      method: 'DELETE'
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Failed to delete client');
    clearApiCache('clients');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('offline_clients');
    }
    return data;
  },

  generateClientCodes: async (): Promise<{ success: boolean; updatedCount: number }> => {
    clearApiCache('clients');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('offline_clients');
    }
    const res = await fetchWithAuth('/api/clients/generate-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.error || 'Error al generar códigos');
    clearApiCache('clients');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('offline_clients');
    }
    return data;
  },

  getMe: async (): Promise<User | null> => {
    const token = localStorage.getItem('app_token');
    if (!token) return null;

    try {
      const res = await fetchWithAuth('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await safeJson(res);
        if (data && data.user) {
          localStorage.setItem('app_user', JSON.stringify(data.user));
          return data.user;
        }
      }
    } catch (e) {
      console.warn('API getMe fallback:', e);
    }

    const rawUser = localStorage.getItem('app_user');
    if (rawUser) {
      try {
        return JSON.parse(rawUser);
      } catch (err) {}
    }
    return null;
  },

  login: async (email: string, password?: string): Promise<User> => {
    try {
      const res = await fetchWithAuth('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await safeJson(res);
      if (res.ok && data && data.user) {
        if (data.token) localStorage.setItem('app_token', data.token);
        if (data.user) localStorage.setItem('app_user', JSON.stringify(data.user));
        return data.user;
      }
      if (res.status === 400 || res.status === 401) {
        throw new Error(data.error || 'Credenciales incorrectas');
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('Credenciales') || err.message.includes('Token') || err.message.includes('desactivado') || err.message.includes('no encontrado'))) {
        throw err;
      }
      console.warn('API login server error, executing direct Supabase fallback...', err);
    }

    // Direct Supabase Fallback
    const identifier = (email || '').trim().toLowerCase();
    const tokenProvided = (password || '').trim();

    if (!identifier || !tokenProvided) {
      throw new Error('Por favor, ingresa tu código de vendedor y token de acceso');
    }

    let foundUser: any = null;

    try {
      // 1. Try by sellerCode
      const { data: usersByCode } = await supabase
        .from('users')
        .select('*')
        .ilike('sellerCode', identifier);
      
      if (usersByCode && usersByCode.length > 0) {
        foundUser = usersByCode[0];
      }

      // 2. Try by email (e.g. seseffff942@gmail.com)
      if (!foundUser) {
        const { data: usersByEmail } = await supabase
          .from('users')
          .select('*')
          .ilike('email', identifier);
        
        if (usersByEmail && usersByEmail.length > 0) {
          foundUser = usersByEmail[0];
        }
      }
    } catch (e) {
      console.warn('Direct Supabase users query failed, checking preloaded data:', e);
    }

    if (!foundUser) {
      const allDefault = [
        { id: 'u1b', name: 'Dueño / CEO', email: 'seseffff942@gmail.com', role: 'admin', photo: 'https://i.pravatar.cc/150?u=9', password: '123' },
        { id: 'u1', name: 'Admin General', email: 'admin2@agricovet.com', role: 'admin', photo: 'https://i.pravatar.cc/150?u=u1', password: '123' },
        { id: 'u4', name: 'Herbert Argueta', sellerCode: '1521', email: 'gruasytransportesali@gmail.com', role: 'seller', password: '123' },
        { id: 'u5', name: 'Erick Juárez', email: 'jerickottoniel@gmail.com', role: 'seller', password: '123' },
        { id: 'u6', name: 'Lima Lopez', email: 'limalopez22@gmail.com', role: 'seller', password: '123' }
      ];
      foundUser = allDefault.find(u => 
        (u.sellerCode?.toLowerCase() === identifier) || 
        (u.email?.toLowerCase() === identifier)
      );
    }

    if (!foundUser) {
      throw new Error('Código de Vendedor / Administrador no encontrado');
    }

    // Verify token / password (supports master password '123' or user password)
    const isValidPass = 
      tokenProvided === '123' || 
      tokenProvided === '1521' || 
      tokenProvided === String(foundUser.password) ||
      tokenProvided === String(foundUser.sellerCode);

    if (!isValidPass) {
      throw new Error('Token de Acceso inválido o incorrecto');
    }

    const userObj: User = {
      id: foundUser.id,
      name: foundUser.name,
      email: foundUser.email,
      role: foundUser.role || 'seller',
      photo: foundUser.photo || 'https://i.pravatar.cc/150',
      sellerCode: foundUser.sellerCode || undefined
    };

    const fallbackToken = `agricovet_session_${btoa(JSON.stringify({ id: userObj.id, role: userObj.role, email: userObj.email, exp: Date.now() + 864000000 }))}`;
    localStorage.setItem('app_token', fallbackToken);
    localStorage.setItem('app_user', JSON.stringify(userObj));
    return userObj;
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
    clearApiCache('products');
    const finalCost = product.costPrice !== undefined ? product.costPrice : (product as any).cost_price;
    const finalHidden = product.hiddenFromSales !== undefined ? product.hiddenFromSales : (product as any).hidden_from_sales;
    const payload = {
      ...product,
      ...(finalCost !== undefined ? { costPrice: finalCost, cost_price: finalCost } : {}),
      ...(finalHidden !== undefined ? { hiddenFromSales: finalHidden, hidden_from_sales: finalHidden } : {})
    };
    const res = await fetchWithAuth('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const resData = await safeJson(res);
    if (!res.ok) {
      throw new Error(resData.error || 'Error al crear producto');
    }
    const normalized: Product = {
      ...resData,
      costPrice: resData.costPrice !== undefined ? Number(resData.costPrice) : (resData.cost_price !== undefined ? Number(resData.cost_price) : 0),
      cost_price: resData.cost_price !== undefined ? Number(resData.cost_price) : (resData.costPrice !== undefined ? Number(resData.costPrice) : 0),
      hiddenFromSales: resData.hiddenFromSales !== undefined ? Boolean(resData.hiddenFromSales) : (resData.hidden_from_sales !== undefined ? Boolean(resData.hidden_from_sales) : false),
      hidden_from_sales: resData.hidden_from_sales !== undefined ? Boolean(resData.hidden_from_sales) : (resData.hiddenFromSales !== undefined ? Boolean(resData.hiddenFromSales) : false),
      variants: typeof resData.variants === 'string' ? JSON.parse(resData.variants) : resData.variants,
      specifications: typeof resData.specifications === 'string' ? JSON.parse(resData.specifications) : resData.specifications,
    };
    return normalized;
  },

  getProducts: async (force: boolean = false): Promise<Product[]> => {
    const mapProduct = (p: any): Product => ({
      ...p,
      costPrice: p.costPrice !== undefined ? Number(p.costPrice) : (p.cost_price !== undefined ? Number(p.cost_price) : 0),
      cost_price: p.cost_price !== undefined ? Number(p.cost_price) : (p.costPrice !== undefined ? Number(p.costPrice) : 0),
      hiddenFromSales: p.hiddenFromSales !== undefined ? Boolean(p.hiddenFromSales) : (p.hidden_from_sales !== undefined ? Boolean(p.hidden_from_sales) : false),
      hidden_from_sales: p.hidden_from_sales !== undefined ? Boolean(p.hidden_from_sales) : (p.hiddenFromSales !== undefined ? Boolean(p.hiddenFromSales) : false),
      variants: typeof p.variants === 'string' ? JSON.parse(p.variants) : p.variants,
      specifications: typeof p.specifications === 'string' ? JSON.parse(p.specifications) : p.specifications,
    });

    if (!force) {
      const cachedMem = getCachedApi('products');
      if (cachedMem && Array.isArray(cachedMem)) return cachedMem.map(mapProduct);
    }
    try {
      const { data, error } = await supabase.from('products').select('*').order('name', { ascending: true });
      if (!error && data && Array.isArray(data) && data.length > 0) {
        const normalized = data.map(mapProduct);
        setCachedApi('products', normalized);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('cached_products', JSON.stringify(normalized));
        }
        return normalized;
      }
    } catch (e) {
      console.warn('Direct Supabase products fetch fallback:', e);
    }
    try {
      const res = await fetchWithAuth('/api/products');
      if (!res.ok) {
        const err = await safeJson(res);
        throw new Error(err.error || 'Failed to fetch products');
      }
      const data = await safeJson(res);
      const normalized = (Array.isArray(data) ? data : []).map(mapProduct);
      setCachedApi('products', normalized);
      localStorage.setItem('cached_products', JSON.stringify(normalized));
      return normalized;
    } catch (err) {
      const cached = localStorage.getItem('cached_products') || localStorage.getItem('offline_products');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(mapProduct);
        } catch (e) {}
      }
      return ((preloadedData.products || []) as any[]).map(mapProduct);
    }
  },

  updateProduct: async (id: string, updates: Partial<Product>): Promise<Product> => {
    clearApiCache('products');
    const finalCost = updates.costPrice !== undefined ? updates.costPrice : (updates as any).cost_price;
    const finalHidden = updates.hiddenFromSales !== undefined ? updates.hiddenFromSales : (updates as any).hidden_from_sales;
    const payload = {
      ...updates,
      ...(finalCost !== undefined ? { costPrice: finalCost, cost_price: finalCost } : {}),
      ...(finalHidden !== undefined ? { hiddenFromSales: finalHidden, hidden_from_sales: finalHidden } : {})
    };
    const res = await fetchWithAuth(`/api/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update product');
    }
    const resData = await res.json();
    return {
      ...resData,
      costPrice: resData.costPrice !== undefined ? Number(resData.costPrice) : (resData.cost_price !== undefined ? Number(resData.cost_price) : 0),
      cost_price: resData.cost_price !== undefined ? Number(resData.cost_price) : (resData.costPrice !== undefined ? Number(resData.costPrice) : 0),
      hiddenFromSales: resData.hiddenFromSales !== undefined ? Boolean(resData.hiddenFromSales) : (resData.hidden_from_sales !== undefined ? Boolean(resData.hidden_from_sales) : false),
      hidden_from_sales: resData.hidden_from_sales !== undefined ? Boolean(resData.hidden_from_sales) : (resData.hiddenFromSales !== undefined ? Boolean(resData.hiddenFromSales) : false),
      variants: typeof resData.variants === 'string' ? JSON.parse(resData.variants) : resData.variants,
      specifications: typeof resData.specifications === 'string' ? JSON.parse(resData.specifications) : resData.specifications,
    };
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

  createInvoice: async (data: { sellerId: string; client: string; nit?: string; phone?: string; address?: string; notes?: string; items: any[]; isOwed: boolean; invoiceType: 'agricola' | 'veterinaria'; creditDays: number; customDate?: string; sellerSignature?: string; idempotencyKey?: string }): Promise<Invoice> => {
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

  updateFullInvoice: async (id: string, data: { client: string; nit?: string; phone?: string; address?: string; notes?: string; items: any[]; isOwed: boolean; sellerId?: string; sellerSignature?: string; customDate?: string }): Promise<Invoice> => {
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

  updateInvoiceStatus: async (id: string, status: string, guideNumber?: string, folio?: number | string, deliveryLetterUrl?: string, shippingGuideUrl?: string, clientName?: string, shippingDate?: string): Promise<void> => {
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

  updateInvoiceReview: async (id: string, adminSignature: string, reviewedBy: string): Promise<void> => {
    const res = await fetchWithAuth(`/api/invoices/${encodeURIComponent(id)}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminSignature, reviewedBy })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al guardar la firma de revisión');
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

  getInvoices: async (sellerId?: string, options?: { limit?: number; offset?: number; search?: string; status?: string }): Promise<Invoice[]> => {
    try {
      const params = new URLSearchParams();
      if (sellerId && sellerId !== 'global' && sellerId !== 'all') params.append('sellerId', sellerId);
      if (options?.limit) params.append('limit', String(options.limit));
      if (options?.offset) params.append('offset', String(options.offset));
      if (options?.search) params.append('search', options.search);
      if (options?.status && options.status !== 'all') params.append('status', options.status);
      params.append('_t', String(Date.now()));

      const url = `/api/invoices${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetchWithAuth(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        if (typeof localStorage !== 'undefined' && !options?.offset) {
          localStorage.setItem('cached_invoices', JSON.stringify(list));
        }
        return list;
      }
    } catch (e) {
      console.warn('Backend invoices fetch fallback:', e);
    }
    try {
      let query = supabase.from('invoices').select('*').order('date', { ascending: false });
      if (sellerId && sellerId !== 'global' && sellerId !== 'all') {
        query = query.eq('sellerId', sellerId);
      }
      if (options?.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }
      if (options?.limit) {
        const offset = options.offset || 0;
        query = query.range(offset, offset + options.limit - 1);
      }
      const { data, error } = await query;
      if (!error && data && Array.isArray(data) && data.length > 0) {
        const parsedList = data.map(inv => parseInvoiceFlags(inv));
        if (typeof localStorage !== 'undefined' && !options?.offset) {
          localStorage.setItem('cached_invoices', JSON.stringify(parsedList));
        }
        return parsedList;
      }
    } catch (e) {
      console.warn('Direct Supabase invoices fetch fallback:', e);
    }
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem('cached_invoices') || localStorage.getItem('offline_invoices');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {}
      }
    }
    return (preloadedData.invoices || []).map(inv => parseInvoiceFlags(inv)) as any[];
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

  addPayment: async (invoiceId: string, amount: number, receiptFile?: File, notes?: string): Promise<{ invoice: Invoice; payment: Payment }> => {
    const formData = new FormData();
    formData.append('amount', amount.toString());
    if (notes) formData.append('notes', notes);
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

  deletePayment: async (invoiceId: string, paymentId: string): Promise<{ success: boolean; invoice?: Invoice; deletedPaymentId: string; restoredAmount?: number }> => {
    const res = await fetchWithAuth(`/api/invoices/${encodeURIComponent(invoiceId)}/payments/${encodeURIComponent(paymentId)}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al eliminar abono');
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
      const { data, error } = await supabase.from('users').select('*').order('name', { ascending: true });
      if (!error && data && Array.isArray(data) && data.length > 0) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('cached_users', JSON.stringify(data));
        }
        return data as User[];
      }
    } catch (e) {
      console.warn('Direct Supabase users fetch fallback:', e);
    }
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

  deleteUser: async (userId: string): Promise<{ success: boolean; message: string }> => {
    const res = await fetchWithAuth(`/api/users/${userId}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al eliminar usuario');
    }
    return res.json();
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

  generateLoginToken: async (userId: string, expiryHours: number = 24): Promise<{ token: string }> => {
    const res = await fetchWithAuth('/api/admin/generate-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, expiryHours }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Error al generar token');
    }
    return res.json();
  },

  forceLogout: async (userId: string): Promise<{ success: boolean }> => {
    const res = await fetchWithAuth('/api/admin/force-logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Error al cerrar sesión');
    }
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

  getExcludedCriticalProducts: async (): Promise<string[]> => {
    try {
      const res = await fetchWithAuth('/api/inventory/excluded-critical');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.excludedIds) ? data.excludedIds : [];
    } catch {
      return [];
    }
  },

  updateExcludedCriticalProducts: async (excludedIds: string[]): Promise<boolean> => {
    try {
      const res = await fetchWithAuth('/api/inventory/excluded-critical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludedIds })
      });
      return res.ok;
    } catch {
      return false;
    }
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

  getBusinessDebts: async (): Promise<any[]> => {
    const res = await fetchWithAuth('/api/business-debts');
    if (!res.ok) throw new Error('Error al obtener compras');
    return res.json();
  },

  createBusinessDebt: async (data: any): Promise<any> => {
    const res = await fetchWithAuth('/api/business-debts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al guardar factura de compra');
    }
    return res.json();
  },

  updateBusinessDebt: async (id: string, data: any): Promise<any> => {
    const res = await fetchWithAuth(`/api/business-debts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar compra');
    }
    return res.json();
  },

  deleteBusinessDebt: async (id: string): Promise<any> => {
    const res = await fetchWithAuth(`/api/business-debts/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error al eliminar de deudas');
    return res.json();
  },

  saveDispatch: async (data: any): Promise<any> => {
    const res = await fetchWithAuth('/api/save-dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Error al guardar el despacho');
    return res.json();
  },

  dispatchInvoice: async (id: string): Promise<any> => {
    const res = await fetchWithAuth(`/api/invoices/${id}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('Error al despachar la factura');
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

  getOfficeInventory: async (): Promise<any[]> => {
    const res = await fetchWithAuth('/api/office-inventory');
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al obtener inventario de oficina');
    }
    return res.json();
  },
  createOfficeItem: async (data: any): Promise<any> => {
    const res = await fetchWithAuth('/api/office-inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al crear artículo');
    }
    return res.json();
  },
  updateOfficeItem: async (id: string, data: any): Promise<any> => {
    const res = await fetchWithAuth(`/api/office-inventory/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar artículo');
    }
    return res.json();
  },
  deleteOfficeItem: async (id: string): Promise<any> => {
    const res = await fetchWithAuth(`/api/office-inventory/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al eliminar artículo');
    }
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
  },

  // ======== FEL (Factura Electronica) ========
  getFelEstado: async (invoiceId: string): Promise<EstadoFacturaFEL> => {
    const res = await fetchWithAuth(`/api/invoices/${encodeURIComponent(invoiceId)}/fel`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'No se pudo consultar el estado FEL');
    return data;
  },

  certificarFel: async (
    invoiceId: string,
    tipoDte?: string,
    receptor?: { nit?: string; nombre?: string }
  ) => {
    const res = await fetchWithAuth(`/api/invoices/${encodeURIComponent(invoiceId)}/fel/certificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipoDte, receptor }),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'No se pudo certificar la factura');
    return data;
  },

  anularFel: async (invoiceId: string, motivo: string) => {
    const res = await fetchWithAuth(`/api/invoices/${encodeURIComponent(invoiceId)}/fel/anular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo }),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'No se pudo anular el documento');
    return data;
  },

  descargarFelXml: async (invoiceId: string, tipo: 'enviado' | 'certificado'): Promise<Blob> => {
    const res = await fetchWithAuth(`/api/invoices/${encodeURIComponent(invoiceId)}/fel/xml?tipo=${tipo}`);
    if (!res.ok) {
      const d = await safeJson(res);
      throw new Error(d?.error || 'No se pudo descargar el XML');
    }
    return res.blob();
  },

  consultarNitFel: async (nit: string): Promise<{ valido: boolean; nit?: string; nombre?: string; mensaje?: string }> => {
    const res = await fetchWithAuth(`/api/fel/consulta-nit/${encodeURIComponent(nit)}`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'No se pudo consultar el NIT');
    return data;
  },

  getFelDocumentos: async (estado?: string) => {
    const url = estado ? `/api/fel/documentos?estado=${encodeURIComponent(estado)}` : '/api/fel/documentos';
    const res = await fetchWithAuth(url);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'No se pudieron listar los documentos FEL');
    return data;
  },

  getFelConfig: async () => {
    const res = await fetchWithAuth('/api/fel/config');
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'No se pudo leer la configuracion FEL');
    return data;
  },

  guardarFelConfig: async (cambios: Record<string, any>) => {
    const res = await fetchWithAuth('/api/fel/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'No se pudo guardar la configuracion FEL');
    return data;
  },

  // ======== RECIBOS DE CAJA ========
  getRecibosCaja: async () => {
    const res = await fetchWithAuth('/api/recibos-caja');
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'No se pudieron consultar los recibos de caja');
    return data;
  },

  createReciboCaja: async (recibo: any) => {
    const res = await fetchWithAuth('/api/recibos-caja', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recibo),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'No se pudo guardar el recibo de caja');
    return data;
  },

  deleteReciboCaja: async (id: string) => {
    const res = await fetchWithAuth(`/api/recibos-caja/${id}`, {
      method: 'DELETE',
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'No se pudo eliminar el recibo de caja');
    return data;
  },

  checkDailySales: async (options?: { sendToWebhook?: boolean; threshold?: number }) => {
    const res = await fetchWithAuth('/api/admin/check-daily-sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sendToWebhook: options?.sendToWebhook ?? false,
        threshold: options?.threshold ?? 8750,
      }),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'Error al verificar ventas diarias');
    return data;
  },

  // ======== COTIZACIONES (QUOTATIONS) ========
  getQuotations: async (sellerId?: string) => {
    const url = sellerId ? `/api/quotations?sellerId=${encodeURIComponent(sellerId)}` : '/api/quotations';
    const res = await fetchWithAuth(url);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'No se pudieron consultar las cotizaciones');
    return data;
  },

  getQuotationById: async (id: string) => {
    const res = await fetchWithAuth(`/api/quotations/${encodeURIComponent(id)}`);
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'No se pudo obtener la cotización');
    return data;
  },

  createQuotation: async (quotation: {
    client: string;
    nit?: string;
    phone?: string;
    address?: string;
    items: any[];
    notes?: string;
    validityDays?: number;
    date?: string;
    sellerId?: string;
  }) => {
    const res = await fetchWithAuth('/api/quotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quotation),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'No se pudo crear la cotización');
    return data;
  },

  updateQuotation: async (id: string, updates: Partial<Quotation> & { validityDays?: number }) => {
    const res = await fetchWithAuth(`/api/quotations/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'No se pudo actualizar la cotización');
    return data;
  },

  deleteQuotation: async (id: string) => {
    const res = await fetchWithAuth(`/api/quotations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'No se pudo eliminar la cotización');
    return data;
  },

  convertQuotationToSale: async (id: string, options?: {
    customDate?: string;
    invoiceType?: 'agricola' | 'veterinaria';
    creditDays?: number;
    transportMethod?: string;
    sellerPaysShipping?: boolean;
    sellerSignature?: string;
  }) => {
    const res = await fetchWithAuth(`/api/quotations/${encodeURIComponent(id)}/convert-to-sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || 'No se pudo convertir la cotización a venta');
    return data;
  },

  getCustomServerUrl: (): string => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('app_custom_api_url') || '';
    }
    return '';
  },

  // ==========================================
  // RECIBOS CONFORMES (SUPABASE)
  // ==========================================
  getRecibosConformes: async (): Promise<ReciboConforme[]> => {
    try {
      const { data, error } = await supabase
        .from('recibos_conformes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && Array.isArray(data)) {
        return data;
      }
    } catch (e) {
      console.warn('Supabase client error for recibos_conformes, trying REST...', e);
    }

    try {
      const data = await fetchSupabaseRest('recibos_conformes', 'order=created_at.desc');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('Error fetching recibos_conformes from REST:', err);
      return [];
    }
  },

  createReciboConforme: async (recibo: Partial<ReciboConforme>): Promise<ReciboConforme> => {
    const payload = {
      invoice_id: String(recibo.invoice_id || ''),
      folio: String(recibo.folio || ''),
      receiver_name: recibo.receiver_name || null,
      receiver_dpi: recibo.receiver_dpi || null,
      receiver_phone: recibo.receiver_phone || null,
      receiver_relationship: recibo.receiver_relationship || null,
      delivery_location: recibo.delivery_location || null,
      delivery_notes: recibo.delivery_notes || null,
      delivered_by: recibo.delivered_by || 'Piloto / Asesor',
      delivery_date: recibo.delivery_date || new Date().toISOString(),
      include_prices: recibo.include_prices !== false,
      signature_data: recibo.signature_data || null,
      pdf_url: recibo.pdf_url || null,
      created_by: recibo.created_by || null,
    };

    try {
      const { data, error } = await supabase
        .from('recibos_conformes')
        .insert([payload])
        .select()
        .single();
      
      if (!error && data) {
        return data;
      }
      if (error) {
        console.warn('Supabase JS insert error, attempting REST...', error);
      }
    } catch (e) {
      console.warn('Supabase JS error inserting recibo_conforme, trying REST...', e);
    }

    // Direct REST fallback
    const res = await fetch(`${SUPABASE_REST_BASE}/recibos_conformes`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Error al guardar Recibo Conforme en Supabase (${res.status}): ${errText}`);
    }

    const resData = await res.json();
    return Array.isArray(resData) ? resData[0] : resData;
  },

  getReciboConformeByInvoice: async (invoiceId: string): Promise<ReciboConforme | null> => {
    try {
      const { data, error } = await supabase
        .from('recibos_conformes')
        .select('*')
        .eq('invoice_id', String(invoiceId))
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!error && Array.isArray(data) && data.length > 0) {
        return data[0];
      }
    } catch (e) {
      console.warn('Error fetching recibo by invoice id:', e);
    }
    return null;
  },

};

