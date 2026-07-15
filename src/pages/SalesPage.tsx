import React, { useState, useEffect, useMemo } from 'react';
// AGRICOLAS INTEGRATION: Added draft auto-save persistence via localStorage to prevent losing elements upon browser refresh.
import { api } from '../api';
import { Product, User, Offer, Invoice } from '../types';
import SignaturePad from '../components/SignaturePad';
import { ShoppingCart, Plus, Minus, Trash2, Tag, CheckCircle, Edit2, X, Search, AlertTriangle, AlertCircle, FileText, Send, MessageCircle, Upload, Phone, WifiOff, RefreshCw, Download, Printer, ArrowLeft, Clock } from 'lucide-react';
import { cn, DEFAULT_PRINT_TEMPLATE, compilePrintTemplate, doesNotNeedStock, printHtml, downloadHtmlAsPdf, formatMoney } from '../utils';
import { motion } from 'motion/react';

interface SalesPageProps {
  user: User;
  isMobile?: boolean;
}

export function SalesPage({ user, isMobile }: SalesPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const categories = ['Todos', 'Veterinaria', 'Agroquímicos', 'Semillas', 'Herramientas', 'Otros'];
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(!isMobile);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalQuantity, setModalQuantity] = useState<string>('1');
  const [modalPrice, setModalPrice] = useState<string>('');
  const [isPriceManuallyEdited, setIsPriceManuallyEdited] = useState<boolean>(false);
  const [isCustomOffer, setIsCustomOffer] = useState(false);
  const [customOfferBuy, setCustomOfferBuy] = useState<string>('');
  const [customOfferFree, setCustomOfferFree] = useState<string>('');
  const [customOfferUnitPrice, setCustomOfferUnitPrice] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');

  const [showSearchClientModal, setShowSearchClientModal] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientSearchFilter, setClientSearchFilter] = useState<'all' | 'mine'>(user.role === 'admin' ? 'all' : 'mine');
  const [clientModalTab, setClientModalTab] = useState<'search' | 'create'>('search');
  const [newClientName, setNewClientName] = useState('');
  const [newClientCompanyName, setNewClientCompanyName] = useState('');
  const [newClientNit, setNewClientNit] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientSellerId, setNewClientSellerId] = useState('');

  // Client Debt States
  const [clientInvoices, setClientInvoices] = useState<Invoice[]>([]);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [isCheckingDebt, setIsCheckingDebt] = useState(false);
  const [debtType, setDebtType] = useState<'none' | 'yellow' | 'red'>('none');
  const [isDebtAuthorized, setIsDebtAuthorized] = useState(false);
  const [showQuickPaymentModal, setShowQuickPaymentModal] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    setIsCartOpen(!isMobile);
  }, [isMobile]);

  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);

  useEffect(() => {
    const queue = JSON.parse(localStorage.getItem('offline_invoices') || '[]');
    setOfflineQueue(queue);

    const handleOnline = () => {
      syncOfflineInvoices();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const syncOfflineInvoices = async () => {
    let queue = JSON.parse(localStorage.getItem('offline_invoices') || '[]');
    if (queue.length === 0) return;
    
    setIsSubmitting(true);
    let successCount = 0;
    const remainingQueue = [];

    for (const inv of queue) {
      try {
        await api.createInvoice({
          sellerId: inv.sellerId,
          client: inv.client,
          nit: inv.nit,
          phone: inv.phone,
          address: inv.address,
          items: inv.items,
          isOwed: inv.isOwed,
          invoiceType: inv.invoiceType,
          creditDays: inv.creditDays,
          debtAlert: inv.debtAlert,
          customDate: inv.customDate
        } as any);
        successCount++;
      } catch (err: any) {
        remainingQueue.push(inv);
      }
    }

    localStorage.setItem('offline_invoices', JSON.stringify(remainingQueue));
    setOfflineQueue(remainingQueue);
    setIsSubmitting(false);

    if (successCount > 0) {
      setSuccessMsg(`Se sincronizaron ${successCount} venta(s) guardada(s) sin conexión.`);
      setTimeout(() => setSuccessMsg(''), 8000);
      
      api.getProducts().then(newProducts => {
         setProducts(newProducts.map(item => ({ ...item, stock: Number(item.stock) || 0, price: Number(item.price) || 0 })));
      });
      api.getClients().then(updatedClients => {
         setClients(updatedClients);
      }).catch(() => {});
    }
  };

  const getFallbackImage = (category: string) => {
    if (category && category.toLowerCase().includes('agro')) return '/bottle.png';
    return '/box.png';
  };
  
  const [client, setClient] = useState(() => localStorage.getItem('draft_client') || '');
  const [nit, setNit] = useState(() => localStorage.getItem('draft_nit') || '');
  const [phone, setPhone] = useState(() => localStorage.getItem('draft_phone') || '');
  const [address, setAddress] = useState(() => localStorage.getItem('draft_address') || '');
  const [notes, setNotes] = useState(() => localStorage.getItem('draft_notes') || '');
  const [invoiceType, setInvoiceType] = useState<'agricola'>((localStorage.getItem('draft_invoiceType') as any) || 'agricola');
  const [cart, setCart] = useState<{ 
    product: Product; 
    quantity: number; 
    overridePrice?: number; 
    suggestedPrice?: number; 
    appliedCustomOffer?: { buyQty: number, freeQty: number }; 
    variant?: { id: string; color: string; size: string };
    requiresAuth?: boolean;
    isAuthorized?: boolean;
  }[]>(() => {
    try {
      const saved = localStorage.getItem('draft_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [sellerSignature, setSellerSignature] = useState<string | null>(() => {
    return localStorage.getItem('last_seller_signature');
  });
  const [pendingCheckout, setPendingCheckout] = useState<{ isOwed: boolean; sellerId: string } | null>(null);
  const [lastSavedClientPhone, setLastSavedClientPhone] = useState<string>('');
  const [lastCreatedInvoice, setLastCreatedInvoice] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(() => localStorage.getItem('draft_edit_invoice_id') || null);
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  const [usersList, setUsersList] = useState<User[]>([]);
  const [showNewClientSellerModal, setShowNewClientSellerModal] = useState(false);
  const [selectedSellerForNewClient, setSelectedSellerForNewClient] = useState('');
  const [checkoutIsOwed, setCheckoutIsOwed] = useState<boolean>(() => localStorage.getItem('draft_checkoutIsOwed') === 'true');
  const [printTemplate, setPrintTemplate] = useState<string>('');
  const [autoPrint, setAutoPrint] = useState(false); // DEFAULT FALSE to prevent freezing on mobile!
  const [transportMethod, setTransportMethod] = useState<'bus' | 'paqueteria' | 'personal' | ''>(() => (localStorage.getItem('draft_transportMethod') as any) || '');
  const [shippingHandled, setShippingHandled] = useState(() => localStorage.getItem('draft_shippingHandled') === 'true');
  const [customDate, setCustomDate] = useState<string>(() => {
    const saved = localStorage.getItem('draft_customDate');
    if (saved) return saved;
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  });

  useEffect(() => {
    localStorage.setItem('draft_client', client);
    localStorage.setItem('draft_nit', nit);
    localStorage.setItem('draft_phone', phone);
    localStorage.setItem('draft_address', address);
    localStorage.setItem('draft_notes', notes);
    localStorage.setItem('draft_cart', JSON.stringify(cart));
    localStorage.setItem('draft_checkoutIsOwed', String(checkoutIsOwed));
    localStorage.setItem('draft_transportMethod', transportMethod);
    localStorage.setItem('draft_shippingHandled', String(shippingHandled));
    localStorage.setItem('draft_customDate', customDate);
    localStorage.setItem('draft_invoiceType', invoiceType);
    if (editingInvoiceId) {
      localStorage.setItem('draft_edit_invoice_id', editingInvoiceId);
    } else {
      localStorage.removeItem('draft_edit_invoice_id');
    }
  }, [client, nit, phone, address, notes, cart, checkoutIsOwed, transportMethod, shippingHandled, customDate, invoiceType, editingInvoiceId]);


  useEffect(() => {
    const fetchRealTimeProducts = async () => {
      try {
        const cachedProducts = localStorage.getItem('offline_products');
        const cachedClients = localStorage.getItem('offline_clients');
        if (cachedProducts) setProducts(JSON.parse(cachedProducts));
        if (cachedClients) setClients(JSON.parse(cachedClients));
        if (!navigator.onLine && cachedProducts) {
          setLoading(false);
        }

        const [p, c, u, tempRes] = await Promise.all([
          api.getProducts().catch((e) => {
             if (cachedProducts) return JSON.parse(cachedProducts);
             throw e;
          }),
          api.getClients().catch(() => cachedClients ? JSON.parse(cachedClients) : []),
          api.getUsers().catch(() => []),
          api.getPrintTemplate().catch(() => ({ template: DEFAULT_PRINT_TEMPLATE }))
        ]);
        const mappedProducts = p.map((item: any) => ({ ...item, stock: Number(item.stock) || 0, price: Number(item.price) || 0 }));
        setProducts(mappedProducts);
        const uniqueClients = (Array.isArray(c) ? c : []).reduce((acc: any[], client: any) => {
          const alreadyExists = acc.find(curr => 
            (curr.name || '').trim().toLowerCase() === (client.name || '').trim().toLowerCase() && 
            (curr.companyName || '').trim().toLowerCase() === (client.companyName || '').trim().toLowerCase()
          );
          if (!alreadyExists) {
            acc.push(client);
          }
          return acc;
        }, []);
        
        setClients(uniqueClients);
        setUsersList(u);
        setPrintTemplate(tempRes.template || DEFAULT_PRINT_TEMPLATE);
        
        localStorage.setItem('offline_products', JSON.stringify(mappedProducts));
        localStorage.setItem('offline_clients', JSON.stringify(uniqueClients));

        setLoading(false);
      } catch (err) {
        setLoading(false);
      }
    };
    
    fetchRealTimeProducts();
    
    const storedEdit = localStorage.getItem('edit_invoice');
    if (storedEdit) {
      if (user.role !== 'admin') {
        alert('No tienes permisos de administrador para editar ventas.');
        localStorage.removeItem('edit_invoice');
        return;
      }
      try {
        const inv = JSON.parse(storedEdit);
        if (inv.status === 'sent') {
          alert('No se puede editar un pedido que ya ha sido marcado como ENVIADO.');
          localStorage.removeItem('edit_invoice');
          return;
        }
        setEditingInvoiceId(inv.id);
        
        // Keep the full client name intact (with company if present) so it matches correctly
        setClient(inv.client || '');
        setNit(inv.nit || '');
        setPhone(inv.phone || '');
        setAddress(inv.address || '');
        if (inv.notes) {
          setNotes(inv.notes);
        }

        // Robust parsing of items list
        let parsedItems = inv.items;
        if (typeof parsedItems === 'string') {
          try {
            parsedItems = JSON.parse(parsedItems);
          } catch (e) {
            parsedItems = [];
          }
        }
        if (!Array.isArray(parsedItems)) {
          parsedItems = [];
        }

        setCart(parsedItems.map((i: any) => {
           const prodPrice = i.originalPrice !== undefined ? Number(i.originalPrice) : (Number(i.price) || 0);
           return {
             product: { 
               id: i.productId, 
               name: i.productName || 'Producto', 
               price: prodPrice, 
               sku: i.sku || '', 
               category: i.category || '' 
             },
             quantity: Number(i.quantity) || 1,
             overridePrice: Number(i.price) || 0,
             suggestedPrice: undefined,
             appliedCustomOffer: undefined
           };
        }));
        
        localStorage.removeItem('edit_invoice');
      } catch (e) {
        console.error("Error loading edit invoice:", e);
        alert("Ocurrió un error al cargar la venta para su edición.");
        localStorage.removeItem('edit_invoice');
      }
    }
    // Sync check - version 2026.06.15.0100
    const interval = setInterval(async () => {
      if (document.hidden) return; // Don't sync if tab is hidden
      try {
        const p = await api.getProducts();
        setProducts(prev => {
          const mappedProducts = p.map(item => ({ ...item, stock: Number(item.stock) || 0, price: Number(item.price) || 0 }));
          
          // Complete heuristic: If lengths differ or if any product's stock or price changed
          const hasChanged = prev.length !== mappedProducts.length || 
                             prev.some((item, idx) => {
                               const other = mappedProducts[idx];
                               return !other || item.id !== other.id || item.stock !== other.stock || item.price !== other.price || item.image !== other.image;
                             });
          if (hasChanged) {
             return mappedProducts;
          }
          return prev;
        });
      } catch (err) {}
    }, 10000); // 10 seconds is enough for real-time inventory
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Dynamic rule of 1,000 for shipping cost
    const shippingItem = cart.find(i => i.product.name === 'COSTO DE ENVIO');
    if (!shippingItem) return;

    const subtotal = cart.reduce((acc, item) => {
      if (item.product.name === 'COSTO DE ENVIO') return acc;
      let unitPrice = item.overridePrice ?? item.product.price;
      if (item.appliedCustomOffer) {
         const packages = item.quantity / (item.appliedCustomOffer.buyQty + item.appliedCustomOffer.freeQty);
         return acc + (packages * item.appliedCustomOffer.buyQty * unitPrice);
      }
      return acc + unitPrice * item.quantity;
    }, 0);

    const targetPrice = subtotal >= 1000 ? 0 : 26;

    if (shippingItem.overridePrice !== targetPrice) {
      setCart(prev => prev.map(i => {
        if (i.product.name === 'COSTO DE ENVIO') {
          return { ...i, product: { ...i.product, price: targetPrice }, overridePrice: targetPrice };
        }
        return i;
      }));
    }
  }, [cart]);

  const addToCart = (product: Product, quantityToAdd?: number, priceOverride?: number, customOffer?: { buyQty: number, freeQty: number }, variant?: { id: string; color: string; size: string }) => {
    let baseQty = quantityToAdd !== undefined ? quantityToAdd : 1;
    const existingInCart = cart.find(i => 
        i.product.id === product.id && 
        i.variant?.id === variant?.id &&
        JSON.stringify(i.appliedCustomOffer) === JSON.stringify(customOffer)
    );
    const totalNewQty = (existingInCart ? existingInCart.quantity : 0) + baseQty;
    
    let variantStock = undefined;
    if (variant?.id && product.variants) {
      variantStock = product.variants.find(v => v.id === variant.id)?.stock;
    }
    const maxStock = variantStock !== undefined ? variantStock : product.stock;

    let requiresAuth = false;
    if (totalNewQty > maxStock && !doesNotNeedStock(product)) {
      if ((product.category || '').toUpperCase() === 'TECUN') {
        requiresAuth = true;
        setErrorMsg(`"${product.name}" de la sección TECUN no tiene suficiente stock. Quedará a espera de autorización en la venta.`);
        setTimeout(() => setErrorMsg(''), 6000);
      } else {
        setErrorMsg(`Stock insuficiente para "${product.name}"${variant ? ` (${variant.color} - ${variant.size})` : ''} (Disponible: ${maxStock}).`);
        setTimeout(() => setErrorMsg(''), 5000);
        return;
      }
    }

    setCart(prev => {
      const existing = prev.find(i => 
        i.product.id === product.id && 
        i.variant?.id === variant?.id &&
        JSON.stringify(i.appliedCustomOffer) === JSON.stringify(customOffer)
      );
      
      if (existing) {
        return prev.map(i => i === existing ? { ...i, quantity: i.quantity + baseQty, overridePrice: priceOverride, requiresAuth: i.requiresAuth || requiresAuth } : i);
      }
      return [...prev, { product, quantity: baseQty, overridePrice: priceOverride, appliedCustomOffer: customOffer, variant, requiresAuth }];
    });
  };

  const checkClientDebt = async (clientName: string, silente = false) => {
    if (!silente) setIsCheckingDebt(true);
    if (!navigator.onLine) {
       if (!silente) setIsCheckingDebt(false);
       setDebtType('none');
       return 'none';
    }
    try {
      const invoices = await api.getClientInvoices(clientName);
      setClientInvoices(invoices);
      
      const pendingInvoices = invoices.filter(inv => {
         const total = Number(inv.totalAmount);
         const paid = Number(inv.paidAmount || 0);
         const statusMatch = inv.status === 'pending' || inv.status === 'sent';
         return statusMatch && (total - paid) > 0.1; 
      });
      
      let type: 'none' | 'yellow' | 'red' = 'none';
      
      const oneDay = 1000 * 60 * 60 * 24;
      const today = new Date();
      
      for (const inv of pendingInvoices) {
        const invDate = new Date(inv.date);
        const invTime = invDate.getTime();
        if (isNaN(invTime)) continue; // Skip invalid dates

        const diffDays = Math.floor((today.getTime() - invTime) / oneDay);
        const limit = Number(inv.creditDays) || (inv.invoiceType === 'agricola' ? 60 : 30);
        
        console.log(`Checking invoice ${inv.id}: diff=${diffDays}, limit=${limit}`);

        if (diffDays > limit) {
          if (diffDays >= limit + 15) {
             type = 'red';
             break; 
          } else {
             type = 'yellow';
          }
        }
      }
      
      setDebtType(type);
      if (type !== 'none') {
        setIsDebtAuthorized(false);
        if (!silente) setShowDebtModal(true);
      } else {
        setIsDebtAuthorized(true);
      }
      return type;
    } catch (err) {
      console.error("Debt check failed:", err);
      return 'none';
    } finally {
      if (!silente) setIsCheckingDebt(false);
    }
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setModalQuantity('1');
    setModalPrice(product.price.toString());
    setIsCustomOffer(false);
    setCustomOfferBuy('');
    setCustomOfferFree('');
    setCustomOfferUnitPrice(product.price.toString());
    setSelectedColor('');
    setSelectedSize('');
    setSelectedVariantId(null);
    setIsPriceManuallyEdited(false);
  };

  const setSuggestedPrice = (productId: string, price: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        return { ...item, suggestedPrice: price >= 0 ? price : 0 };
      }
      return item;
    }));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQ = Math.max(1, item.quantity + delta);

        let variantStock = undefined;
        if (item.variant?.id && item.product.variants) {
          variantStock = item.product.variants.find(v => v.id === item.variant?.id)?.stock;
        }
        const maxStock = variantStock !== undefined ? variantStock : item.product.stock;

        if (newQ > maxStock && !doesNotNeedStock(item.product)) {
           setErrorMsg(`Stock insuficiente para "${item.product.name}"${item.variant ? ` (${item.variant.color} - ${item.variant.size})` : ''} (Disponible: ${maxStock}).`);
           setTimeout(() => setErrorMsg(''), 5000);
           return { ...item, quantity: maxStock };
        }
        return { ...item, quantity: newQ };
      }
      return item;
    }));
  };

  const updatePrice = (productId: string, newPrice: number) => {
    if (user.role !== 'admin') return;
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        return { ...item, overridePrice: newPrice >= 0 ? newPrice : 0 };
      }
      return item;
    }));
  };

  const handleUpdateGlobalPrice = async (product: Product) => {
    if (user.role !== 'admin') return;
    const newPriceStr = prompt(`Actualizar precio base en inventario para ${product.name}:`, product.price.toString());
    if (newPriceStr === null) return;
    const newPrice = parseFloat(newPriceStr);
    if (isNaN(newPrice) || newPrice < 0) return;

    try {
      const updated = await api.updateProduct(product.id, { price: newPrice });
      setProducts(products.map(p => p.id === updated.id ? updated : p));
      
      setCart(prev => prev.map(item => {
        if (item.product.id === updated.id) {
          return { ...item, product: updated };
        }
        return item;
      }));
    } catch (err) {
      alert("Error actualizando precio base");
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const printTicket = async (invoice: any) => {
    const sellerObj = usersList.find((u: any) => u.id === invoice.sellerId || u.email === invoice.sellerId);
    const sellerName = sellerObj ? sellerObj.name : (invoice.sellerId || 'Desconocido').split('@')[0];

    const htmlContent = compilePrintTemplate(printTemplate, invoice, sellerName);
    await printHtml(htmlContent);
  };

  const downloadTicketPdf = async (invoice: any) => {
    const sellerObj = usersList.find((u: any) => u.id === invoice.sellerId || u.email === invoice.sellerId);
    const sellerName = sellerObj ? sellerObj.name : (invoice.sellerId || 'Desconocido').split('@')[0];

    const htmlContent = compilePrintTemplate(printTemplate, invoice, sellerName);
    await downloadHtmlAsPdf(htmlContent, `factura-${invoice.folio || invoice.id || 'venta'}.pdf`);
  };

  const getWhatsAppTextReceipt = (invoice: any) => {
    const dateStr = invoice.date ? new Date(invoice.date).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    let msg = `*📋 COMPROBANTE DE COMPRA - Agricovet*\n`;
    msg += `---------------------------------------\n`;
    msg += `*Cliente:* ${invoice.client || 'C/F'}\n`;
    if (invoice.nit) msg += `*NIT:* ${invoice.nit}\n`;
    if (invoice.folio || invoice.id) msg += `*Folio:* #${invoice.folio || invoice.id}\n`;
    if (dateStr) msg += `*Fecha:* ${dateStr}\n`;
    msg += `*Tipo de venta:* CRÉDITO\n`;
    msg += `---------------------------------------\n`;
    msg += `*DETALLE DE PRODUCTOS:*\n`;
    
    const items = invoice.items || [];
    items.forEach((item: any) => {
      const variantStr = (item.color || item.size) ? ` (${[item.color, item.size].filter(Boolean).join(' - ')})` : '';
      const quantity = item.quantity || 0;
      const price = item.price || 0;
      const itemTotal = quantity * price;
      msg += `• ${quantity}x ${item.productName || item.name}${variantStr} a ${formatMoney(price)} = *${formatMoney(itemTotal)}*\n`;
    });
    
    msg += `---------------------------------------\n`;
    const total = invoice.totalAmount ?? invoice.total ?? 0;
    msg += `*TOTAL COMPRA:* *${formatMoney(total)}*\n`;
    if (invoice.isOwed !== false) {
      const paid = invoice.paidAmount || 0;
      msg += `*Monto Pagado:* ${formatMoney(paid)}\n`;
      msg += `*Saldo Pendiente:* *${formatMoney(total - paid)}*\n`;
    }
    msg += `---------------------------------------\n`;
    msg += `¡Muchas gracias por su preferencia! 🐾🌾\n`;
    return msg;
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.overridePrice ?? item.product.price) || 0;
      
      if (item.appliedCustomOffer) {
         const offerSize = (Number(item.appliedCustomOffer.buyQty) || 0) + (Number(item.appliedCustomOffer.freeQty) || 0);
         if (offerSize > 0) {
           const packages = Math.floor(quantity / offerSize);
           const remainder = quantity % offerSize;
           return acc + (packages * (Number(item.appliedCustomOffer.buyQty) || 0) * unitPrice) + (remainder * unitPrice);
         }
      }
      return acc + (unitPrice * quantity);
    }, 0);
  }, [cart]);

  const handleAddQuickPayment = async () => {
    if (!selectedInvoiceForPayment || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return alert('Monto inválido');
    
    setIsPaying(true);
    try {
      await api.addPayment(selectedInvoiceForPayment.id, amount, paymentFile || undefined);
      alert('Abono registrado con éxito. Se ha actualizado la cuenta del cliente.');
      setShowQuickPaymentModal(false);
      setPaymentAmount('');
      setPaymentFile(null);
      // Re-check debt
      if (client) checkClientDebt(client);
    } catch (err: any) {
      alert(`Error al registrar abono: ${err.message}`);
    } finally {
      setIsPaying(false);
    }
  };

  const proceedWithCheckout = async (isOwed: boolean, sellerIdToUse: string, signature?: string) => {
    if (!signature && !sellerSignature) {
      setPendingCheckout({ isOwed, sellerId: sellerIdToUse });
      setShowSignaturePad(true);
      return;
    }

    const finalSignature = signature || sellerSignature || undefined;
    isOwed = true; // Forzar crédito siempre (las ventas solo se pueden ir a crédito)
    setIsSubmitting(true);
    try {
      const items = cart.map(i => {
        let price = i.overridePrice ?? i.product.price;
        let effectivePrice = price;
        
        if (i.appliedCustomOffer) {
           effectivePrice = (price * i.appliedCustomOffer.buyQty) / (i.appliedCustomOffer.buyQty + i.appliedCustomOffer.freeQty);
        }

        return {
          productId: i.product.id,
          productName: i.product.name,
          quantity: i.quantity,
          price: effectivePrice,
          suggestedPrice: i.suggestedPrice,
          isOfferApplied: !!i.appliedCustomOffer,
          isPriceAlert: price < i.product.price,
          variantId: i.variant?.id,
          color: i.variant?.color,
          size: i.variant?.size,
          requiresAuth: i.requiresAuth
        };
      });

      let newInvoice: any;
      if (editingInvoiceId) {
         newInvoice = await api.updateFullInvoice(editingInvoiceId, {
            client,
            nit,
            phone,
            address,
            items,
            isOwed,
            notes
         });
         setEditingInvoiceId(null);
      } else {
         const invoicePayload = {
          sellerId: sellerIdToUse,
          client,
          nit,
          phone,
          address,
          notes,
          items,
          isOwed,
          invoiceType: invoiceType as 'agricola' | 'veterinaria',
          creditDays: invoiceType === 'agricola' ? 60 : 30,
          debtAlert: debtType !== 'none',
          customDate: user?.email === 'seseffff942@gmail.com' ? (customDate || undefined) : undefined,
          transportMethod: transportMethod || undefined,
          sellerSignature: finalSignature || undefined
        };

        if (!navigator.onLine) {
          const offlineInvoice = {
            ...invoicePayload,
            id: `offline-${Date.now()}`,
            status: 'pending',
            date: invoicePayload.customDate ? new Date(invoicePayload.customDate).toISOString() : new Date().toISOString(),
            authStatus: debtType !== 'none' || invoicePayload.items.some(i => i.isPriceAlert) ? 'pending' : 'approved',
            total: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            isOffline: true
          };
          const storedOffline = JSON.parse(localStorage.getItem('offline_invoices') || '[]');
          storedOffline.push(offlineInvoice);
          localStorage.setItem('offline_invoices', JSON.stringify(storedOffline));
          setOfflineQueue(storedOffline);
          newInvoice = offlineInvoice;
        } else {
          try {
            newInvoice = await api.createInvoice(invoicePayload as any);
          } catch (createErr: any) {
            if (createErr.message.includes('fetch') || createErr.message.includes('Network') || !navigator.onLine) {
               const offlineInvoice = {
                 ...invoicePayload,
                 id: `offline-${Date.now()}`,
                 status: 'pending',
                 date: invoicePayload.customDate ? new Date(invoicePayload.customDate).toISOString() : new Date().toISOString(),
                 authStatus: debtType !== 'none' || invoicePayload.items.some(i => i.isPriceAlert) ? 'pending' : 'approved',
                 total: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                 isOffline: true
               };
               const storedOffline = JSON.parse(localStorage.getItem('offline_invoices') || '[]');
               storedOffline.push(offlineInvoice);
               localStorage.setItem('offline_invoices', JSON.stringify(storedOffline));
               setOfflineQueue(storedOffline);
               newInvoice = offlineInvoice;
            } else {
               throw createErr;
            }
          }
        }
      }

      // Early Reset: Clear UI immediately so user sees it's done
      const originalClient = client;
      const originalPhone = phone;
      setCart([]);
      setClient('');
      setNit('');
      setPhone('');
      setAddress('');
      setIsEditingAddress(false);
      setNotes('');
      setInvoiceType('agricola');
      setTransportMethod('');
      setShippingHandled(false);
      const d = new Date();
      setCustomDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]);
      setDebtType('none');
      setIsDebtAuthorized(false);
      setIsSubmitting(false);

      if (isMobile) {
         setIsCartOpen(false);
      }

      setLastCreatedInvoice(newInvoice);

      if (newInvoice.authStatus === 'pending') {
         const reason = debtType !== 'none' ? 'por DEUDA pendiente del cliente' : 'por precio de oferta/rebajado';
         alert(`${newInvoice.isOffline ? '[OFFLINE] Venta guardada sin conexión' : 'Venta registrada'} a ${originalClient}, PERO REQUIERE AUTORIZACIÓN ${reason}.`);
         setSuccessMsg(`${newInvoice.isOffline ? '📡 Guardada sin internet (Pendiente)' : '⚠️ Venta en revisión'} (${debtType !== 'none' ? 'Deuda Cliente' : 'Precio Especial'})`);
      } else {
         setSuccessMsg(`${newInvoice.isOffline ? '📡 Venta guardada pendiente de conexión para: ' : '¡Venta registrada exitosamente a '} ${originalClient}!`);
      }
      setLastSavedClientPhone(originalPhone);
      setTimeout(() => { 
         setSuccessMsg(''); 
         setLastSavedClientPhone(''); 
         setLastCreatedInvoice(null);
      }, 15000);
      
      // Background reload (NON-BLOCKING)
      api.getProducts().then(newProducts => {
         setProducts(newProducts.map(item => ({ ...item, stock: Number(item.stock) || 0, price: Number(item.price) || 0 })));
      });
      api.getClients().then(updatedClients => {
         const uniqueClients = (updatedClients || []).reduce((acc: any[], client: any) => {
           const alreadyExists = acc.find(curr => 
             (curr.name || '').trim().toLowerCase() === (client.name || '').trim().toLowerCase() && 
             (curr.companyName || '').trim().toLowerCase() === (client.companyName || '').trim().toLowerCase()
           );
           if (!alreadyExists) {
             acc.push(client);
           }
           return acc;
         }, []);
         setClients(uniqueClients);
      }).catch(() => {});
      
      return; 
    } catch (err: any) {
      alert(`Error procesando venta: ${err.message}`);
    } finally {
      setIsSubmitting(false);
      setPendingCheckout(null);
    }
  };

  const handleSaveSignature = (sig: string) => {
    setSellerSignature(sig);
    localStorage.setItem('last_seller_signature', sig);
    setShowSignaturePad(false);
    if (pendingCheckout) {
      proceedWithCheckout(pendingCheckout.isOwed, pendingCheckout.sellerId, sig);
    }
  };

  const handleCheckout = async (isOwed: boolean) => {
    isOwed = true; // Forzar crédito siempre (las ventas solo se pueden ir a crédito)
    if (isSubmitting) return;

    if (!client.trim()) {
      setErrorMsg('Por favor ingresa el nombre del cliente');
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }
    if (cart.length === 0) {
      setErrorMsg('El carrito está vacío');
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }
    // Prohibir números negativos y validar mínimos en carrito
    for (const item of cart) {
      if (item.quantity <= 0) {
        setErrorMsg('La cantidad de productos en el carrito debe ser mayor a cero.');
        setTimeout(() => setErrorMsg(''), 5000);
        return;
      }
      
      let variantStock = undefined;
      if (item.variant?.id && item.product.variants) {
        variantStock = item.product.variants.find(v => v.id === item.variant?.id)?.stock;
      }
      const maxStock = variantStock !== undefined ? variantStock : item.product.stock;

      if (item.quantity > maxStock && !doesNotNeedStock(item.product)) {
        setErrorMsg(`Stock insuficiente para "${item.product.name}"${item.variant ? ` (${item.variant.color} - ${item.variant.size})` : ''} (Disponible: ${maxStock}).`);
        setTimeout(() => setErrorMsg(''), 5000);
        return;
      }
      const itemPrice = item.overridePrice !== undefined ? item.overridePrice : item.product.price;
      if (itemPrice < 0) {
        setErrorMsg('El precio de venta de los productos no puede ser negativo.');
        setTimeout(() => setErrorMsg(''), 5000);
        return;
      }
    }

    if (editingInvoiceId) {
      setIsSubmitting(true);
      try {
        await proceedWithCheckout(isOwed, user.email || '');
      } catch (err: any) {
        setIsSubmitting(false);
        alert(`Error al actualizar la venta: ${err.message}`);
      }
      return;
    }
    
    const clientNameLower = client.toLowerCase().trim();
    const existingClient = clients.find(c => {
      const dbName = (c.name || '').toLowerCase().trim();
      const dbCompany = c.companyName ? c.companyName.toLowerCase().trim() : '';
      const combined = c.companyName ? `${c.name} - ${c.companyName}`.toLowerCase().trim() : '';
      const nameWithCompany = c.companyName ? `${dbName} ${dbCompany}` : dbName;
      
      return dbName === clientNameLower || 
             dbCompany === clientNameLower || 
             combined === clientNameLower ||
             nameWithCompany === clientNameLower ||
             (clientNameLower.includes(dbName) && dbName.length > 3 && (dbCompany ? clientNameLower.includes(dbCompany) : true));
    });

    if (!existingClient) {
      // Es un cliente nuevo. Exigir elegir vendedor antes de tirar la venta
      setCheckoutIsOwed(isOwed);
      // Colocar por defecto el vendedor actual
      setSelectedSellerForNewClient(user.email || '');
      setShowNewClientSellerModal(true);
      return;
    }

    setIsSubmitting(true);
    try {
      if (debtType === 'none' || !isDebtAuthorized) {
         const type = await checkClientDebt(client, true);
         if (type !== 'none' && !isDebtAuthorized) {
           setShowDebtModal(true);
           setIsSubmitting(false);
           return;
         }
      }

      await proceedWithCheckout(isOwed, existingClient.sellerId || user.email);
    } catch (err: any) {
      setIsSubmitting(false);
      alert(`Error comprobando deuda: ${err.message}`);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-[#f4f7f5] overflow-hidden">
      
      {/* Offline Queue Notification */}
      {offlineQueue.length > 0 && (
        <div className="fixed top-6 md:top-24 right-4 left-4 md:left-auto md:w-[380px] p-4.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-[1.25rem] shadow-2xl flex items-center justify-between gap-4 font-bold z-[95] animate-in slide-in-from-top-6 duration-300 border border-amber-500/20">
          <div className="flex items-center gap-3 text-xs sm:text-sm">
            <div className="p-2 bg-white/10 rounded-xl">
              <WifiOff size={18} className="shrink-0 text-amber-150 animate-pulse" />
            </div>
            <div>
              <p className="font-extrabold uppercase tracking-wide text-[11px] text-amber-200">Modo Fuera de Línea</p>
              <p className="text-white font-semibold mt-0.5">{offlineQueue.length} {offlineQueue.length === 1 ? 'venta guardada' : 'ventas guardadas'} sin conexión.</p>
            </div>
          </div>
          <button 
             onClick={syncOfflineInvoices}
             disabled={isSubmitting}
             className="px-3.5 py-2 bg-white text-amber-900 text-[10px] font-black rounded-xl hover:bg-amber-50 transition-all flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95 cursor-pointer"
          >
             <RefreshCw size={12} className={cn(isSubmitting && "animate-spin")} />
             Sincronizar
          </button>
        </div>
      )}

      {/* Floating success/alert Toast Notification */}
      {successMsg && (
        <div className="fixed top-24 left-4 right-4 md:left-auto md:right-8 md:w-[420px] p-5 bg-gradient-to-r from-[#0b4d2c] to-[#07361e] text-white rounded-[1.5rem] shadow-[0_20px_50px_rgba(9,54,30,0.3)] flex items-center justify-between gap-4 font-medium z-[100] animate-in slide-in-from-top-6 duration-300 border border-emerald-500/20">
          <div className="flex items-start gap-3.5">
             <div className="p-2.5 bg-white/15 rounded-xl text-emerald-200 shrink-0">
               <CheckCircle size={20} className="shrink-0" />
             </div>
             <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-widest text-emerald-300">¡Registro Exitoso!</p>
                <p className="text-xs sm:text-sm font-bold text-white leading-tight mt-0.5">{successMsg}</p>
             </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lastCreatedInvoice && (
              <button 
                onClick={() => downloadTicketPdf(lastCreatedInvoice)}
                className="bg-[#1A4D2E] hover:bg-[#226F3E] text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95 whitespace-nowrap cursor-pointer border border-emerald-400/20"
              >
                <FileText size={12} /> Descargar PDF
              </button>
            )}
            {lastSavedClientPhone && lastSavedClientPhone.replace(/\D/g, '').length >= 8 && (
              <a 
                href={`https://wa.me/${lastSavedClientPhone.replace(/\D/g, '')}?text=${encodeURIComponent("Hola, gracias por tu compra en Agricovet. Tu pedido ha sido procesado exitosamente.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95 whitespace-nowrap"
              >
                <MessageCircle size={12} /> WhatsApp
              </a>
            )}
            <button onClick={() => { setSuccessMsg(''); setLastCreatedInvoice(null); }} className="p-1.5 hover:bg-white/15 rounded-full text-white/70 hover:text-white transition-all cursor-pointer">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      
      {errorMsg && (
        <div className="fixed top-24 left-4 right-4 md:left-auto md:right-8 md:w-[420px] p-5 bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-[1.5rem] shadow-[0_20px_50px_rgba(225,29,72,0.25)] flex items-center gap-4.5 font-medium z-[100] animate-in slide-in-from-top-6 duration-300 border border-red-500/25">
          <div className="p-2.5 bg-white/15 rounded-xl text-rose-100 shrink-0">
            <AlertCircle size={20} className="shrink-0" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black uppercase tracking-widest text-rose-200">Atención / Error</p>
            <p className="text-xs sm:text-sm font-bold leading-snug mt-0.5">{errorMsg}</p>
          </div>
          <button onClick={() => setErrorMsg('')} className="p-1.5 hover:bg-white/15 rounded-full text-white/70 hover:text-white transition-all cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}
      
      {/* Product Selection Area */}
      <section className={`flex-1 flex flex-col min-w-0 min-h-0 bg-[#f4f7f5] ${isMobile ? 'pb-32' : ''}`}>
        
        {/* Header / Search & Interactive Branding bar */}
        <div className="flex flex-col gap-4.5 p-5 md:p-6 bg-white border-b border-emerald-900/10 z-10 shrink-0 shadow-sm">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <span className="w-2.5 h-6 rounded-full bg-[#0b4d2c] block" />
                Catálogo de Productos
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-wider">
                Selecciona insumos veterianarios y agrícolas para procesar la venta
              </p>
            </div>
            
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por código SKU, nombre de producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-2xl focus:bg-white focus:border-[#0b4d2c] focus:ring-2 focus:ring-[#0b4d2c]/10 outline-none text-[#07361e] font-semibold transition-all text-xs sm:text-sm shadow-inner"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-all"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Dynamic & Beautiful Products Catalog Grid */}
        <div className="flex-1 overflow-y-auto min-h-0 p-5 md:p-6 scrollbar-hide hide-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2rem] border border-slate-100 shadow-sm animate-pulse space-y-4 max-w-lg mx-auto">
              <div className="w-10 h-10 border-4 border-[#0b4d2c] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cargando catálogo centralizado...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 max-w-xl mx-auto space-y-4">
              <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-350">
                <Search size={28} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">Sin coincidencias</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium max-w-md mx-auto leading-relaxed">
                  No pudimos encontrar productos con el término de búsqueda o categoría seleccionada. Intente buscar otro término.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-5">
              {filteredProducts.map((product) => {
                const isExempt = doesNotNeedStock(product);
                let displayStock = product.stock;
                if (product.variants && product.variants.length > 0) {
                   displayStock = product.variants.reduce((sum, v) => sum + (v.stock !== undefined ? v.stock : product.stock), 0);
                }
                const hasNoStock = displayStock === 0 && !product.is_external && !isExempt;
                
                const cardMotionProps = isMobile ? {
                  initial: { opacity: 1, y: 0, scale: 1 },
                  animate: { opacity: 1, y: 0, scale: 1 },
                  transition: { duration: 0.1 }
                } : {
                  initial: { opacity: 0, y: 30, scale: 0.98 },
                  whileInView: { opacity: 1, y: 0, scale: 1 },
                  viewport: { once: true, margin: "-20px" },
                  transition: { duration: 0.55 },
                  whileHover: { 
                    y: -6, 
                    scale: 1.025,
                    boxShadow: "0 20px 40px rgba(11, 77, 44, 0.08)",
                    borderColor: "rgba(11, 77, 44, 0.25)"
                  }
                };

                return (
                  <motion.div 
                    key={`prod-${product.id}`} 
                    onClick={() => handleProductClick(product)} 
                    {...cardMotionProps}
                    className="group bg-white rounded-[2rem] border border-slate-200/80 overflow-hidden transition-all duration-300 flex flex-col cursor-pointer active:scale-98 relative shadow-sm"
                  >
                    
                    {/* Badge Pill status */}
                    <div className="absolute top-3 left-3 z-10">
                      <span className={cn(
                        "text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider border shadow-sm",
                        product.is_external 
                          ? "bg-amber-500 border-amber-400 text-white" 
                          : (isExempt 
                              ? "bg-[#16a34a] border-[#15803d] text-white"
                              : (displayStock > 10 
                                  ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                                  : (displayStock > 0 
                                      ? "bg-amber-50 border-amber-100 text-amber-800 animate-pulse" 
                                      : "bg-red-50 border-red-100 text-red-700")))
                      )}>
                        {product.is_external ? 'BAJO PEDIDO' : (isExempt ? 'STOCK ILIMITADO' : (displayStock > 10 ? <span>Disponibles: {displayStock}</span> : (displayStock > 0 ? <span>BAJO STOCK: {displayStock}</span> : 'AGOTADO')))}
                      </span>
                    </div>

                    {/* Image space */}
                    <div className="relative h-36 sm:h-44 overflow-hidden bg-slate-50/60 border-b border-slate-100 flex items-center justify-center p-5 group-hover:bg-slate-50 transition-colors">
                      <img 
                        src={product.image || getFallbackImage(product.category)} 
                        alt={product.name} 
                        className={cn(
                          "max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500 drop-shadow-sm",
                          hasNoStock && "opacity-40"
                        )} 
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getFallbackImage(product.category); }}
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Plus icon triggers options modal */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleProductClick(product); }}
                        className="absolute bottom-3 right-3 w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-[#0b4d2c] text-white shadow-lg flex items-center justify-center transition-all hover:bg-[#07361e] transform hover:scale-110 active:scale-95 group-hover:translate-x-0 z-10 cursor-pointer"
                        title="Seleccionar opciones del producto"
                      >
                        <Plus size={18} strokeWidth={2.5} />
                      </button>

                      {hasNoStock && (
                        <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center p-2">
                          <span className="bg-red-650 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-md">
                            No disponible
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content text */}
                    <div className="p-4 flex flex-col justify-between flex-1 space-y-3">
                      <div className="space-y-1">
                        <p className="text-[9px] text-[#0b4d2c] font-black uppercase tracking-widest"><span className="notranslate" translate="no">{product.category}</span></p>
                        <h3 
                          className="font-black text-slate-800 text-xs sm:text-sm leading-snug line-clamp-2 notranslate group-hover:text-[#0b4d2c] transition-colors" 
                          translate="no" 
                          title={product.name}
                        >
                          {product.name}
                        </h3>
                      </div>
                      
                      <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                        <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">SKU: <span className="notranslate" translate="no">{(product.id || '').split('-')[0]}</span></span>
                        <p className="font-black text-[#0b4d2c] text-sm sm:text-[15px] bg-emerald-50/50 px-2.5 py-0.5 rounded-lg border border-emerald-100/50"><span className="notranslate" translate="no">{formatMoney(product.price)}</span></p>
                      </div>
                    </div>

                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Cart Floating Summary Bar for mobile screens */}
      {isMobile && !isCartOpen && (
        <div className="fixed bottom-20 left-4 right-4 z-40">
          <div className="bg-[#07361e] text-white rounded-[2rem] p-4.5 shadow-[0_15px_30px_rgba(7,54,30,0.3)] flex items-center justify-between border border-emerald-800/40 backdrop-blur-md">
            <div className="flex items-center gap-3.5">
              <div className="relative p-2 rounded-xl bg-white/10 text-emerald-300">
                <ShoppingCart size={22} />
                {cart.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-600 border border-[#07361e] text-white text-[9px] w-5 h-5 flex items-center justify-center rounded-full font-black shadow-md animate-bounce">
                    <span className="notranslate" translate="no">{cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)}</span>
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                <p className="text-[9px] uppercase font-black text-emerald-300 tracking-widest leading-none">
                  <span className="notranslate" translate="no">{cart.length}</span> {cart.length === 1 ? 'PRODUCTO' : 'PRODUCTOS'}
                </p>
                <p className="text-lg font-black leading-none mt-1"><span className="notranslate" translate="no">{formatMoney(cartTotal)}</span></p>
              </div>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsCartOpen(true); }}
              className="bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-3 rounded-2xl font-black flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all text-xs uppercase tracking-wider cursor-pointer active:scale-95"
            >
                VER COMPRA
                <span className="text-base leading-none shrink-0 font-bold">›</span>
            </button>
          </div>
        </div>
      )}

      {/* Cart Container Backdrop overlay for mobile */}
      {isMobile && isCartOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[55] transition-opacity animate-in fade-in duration-300" onClick={() => setIsCartOpen(false)} />
      )}

      {/* Main Cart Side Drawer Panel */}
      {(isCartOpen || !isMobile) && (
      <div 
        className={cn(
          "w-full flex flex-col bg-white overflow-hidden shrink-0 shadow-2xl md:shadow-none border-l border-emerald-950/5",
          isMobile 
            ? "fixed inset-0 z-[60] transition-transform translate-y-0" 
            : "md:w-[410px] h-full relative"
        )}
      >
        {/* Header container */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 shrink-0 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isMobile ? (
                <button 
                  onClick={() => setIsCartOpen(false)} 
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 text-[#0b4d2c] rounded-xl transition-all cursor-pointer mr-1 flex items-center justify-center border border-slate-200 active:scale-95"
                  title="Cerrar y seguir agregando productos"
                >
                  <ArrowLeft size={18} />
                </button>
              ) : (
                <div className="p-2 bg-emerald-50 text-[#0b4d2c] rounded-xl border border-emerald-100">
                  <ShoppingCart size={18} />
                </div>
              )}
              <h2 className="font-black text-slate-800 text-sm sm:text-base uppercase tracking-wider">Carrito de Compra</h2>
            </div>
            <button 
              onClick={() => { if(confirm('¿Seguro que deseas vaciar el carrito actual?')) { setCart([]); setClient(''); setNit(''); setPhone(''); setAddress(''); setIsEditingAddress(false); setNotes(''); setCheckoutIsOwed(false); setTransportMethod(''); setShippingHandled(false); setInvoiceType('agricola'); setEditingInvoiceId(null); } }} 
              className="text-red-650 hover:text-red-700 font-bold text-[10px] uppercase tracking-widest flex items-center gap-1 transition-colors bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl cursor-pointer"
            >
               <Trash2 size={12} /> Vaciar
            </button>
          </div>
        </div>
        
        {/* Body forms / items list list container */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 scrollbar-thin">
          
          {/* Customer Selection Block */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200/50 pb-1.5 flex items-center gap-1.5">
              <span>👤</span> Información del Cliente
            </h3>

            <div className="space-y-3">
              <div className="w-full">
                <div className="flex justify-between items-end mb-1.5">
                   <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Nombre del Cliente / Negocio</label>
                   {phone && (
                       <a href={`tel:${phone.replace(/\D/g, '')}`} className="flex items-center gap-1 text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full hover:bg-emerald-100 transition-colors">
                           📞 Llamar
                       </a>
                   )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={client}
                    readOnly
                    onClick={() => {
                      setClientSearchQuery('');
                      setClientModalTab('search');
                      setNewClientName('');
                      setNewClientCompanyName('');
                      setNewClientNit('');
                      setNewClientPhone('');
                      setNewClientAddress('');
                      setNewClientSellerId(user.email || '');
                      setShowSearchClientModal(true);
                    }}
                    placeholder="Buscar o registrar cliente..."
                    className={cn(
                      "w-full pl-4.5 pr-10 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl focus:border-[#0b4d2c] outline-none font-bold text-slate-800 transition-all cursor-pointer text-xs sm:text-sm shadow-sm",
                      isCheckingDebt && "animate-pulse border-[#0b4d2c]/50 bg-emerald-50/10"
                    )}
                  />
                  {isCheckingDebt ? (
                     <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-teal-750 rounded-lg animate-pulse">
                        <AlertCircle size={10} className="animate-spin text-teal-650" />
                        <span className="text-[8px] font-black uppercase tracking-wider">Verificando...</span>
                     </div>
                  ) : client ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClient('');
                        setNit('');
                        setPhone('');
                        setAddress('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-red-50 hover:bg-red-100 rounded-full text-red-650 transition-colors cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  ) : (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Search size={14} />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">NIT</label>
                  <input
                    type="text"
                    value={nit}
                    onChange={(e) => setNit(e.target.value)}
                    placeholder="C/F"
                    className="w-full px-3.5 py-2 sm:py-2.5 bg-white border border-slate-200 rounded-xl focus:border-[#0b4d2c] focus:ring-1 focus:ring-[#0b4d2c] outline-none font-bold text-slate-800 transition-all text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Teléfono</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Sin teléfono"
                    className="w-full px-3.5 py-2 sm:py-2.5 bg-white border border-slate-200 rounded-xl focus:border-[#0b4d2c] focus:ring-1 focus:ring-[#0b4d2c] outline-none font-bold text-slate-800 transition-all text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Delivery address */}
            <div className="border-t border-slate-200/60 pt-3">
              <div className="flex justify-between items-center mb-1.5">
                 <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Dirección de Envío</label>
                 <button 
                   type="button"
                   onClick={() => setIsEditingAddress(!isEditingAddress)}
                   className="text-emerald-700 font-extrabold text-[10px] bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1 cursor-pointer"
                 >
                   <Edit2 size={10} /> {isEditingAddress ? 'Cerrar' : 'Editar'}
                 </button>
              </div>
              
              {isEditingAddress ? (
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ingrese dirección de entrega específica..."
                  className="w-full px-3.5 py-2.5 bg-white border border-emerald-200 rounded-xl focus:border-[#0b4d2c] outline-none font-bold text-slate-800 transition-all text-xs shadow-inner"
                />
              ) : (
                <div className="text-xs text-slate-500 bg-white px-3 py-2 rounded-xl border border-slate-200/50 min-h-[38px] flex items-center italic">
                  {address || 'Dirección de fábrica / predeterminada'}
                </div>
              )}
            </div>

            {/* Shipment details */}
            <div className="border-t border-slate-200/60 pt-3 space-y-3">
              {user?.email === 'seseffff942@gmail.com' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Fecha de la Venta</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-[#0b4d2c] outline-none font-bold text-slate-800 transition-all text-xs"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Clock size={14} />
                    </div>
                  </div>
                </div>
              )}

              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Transporte de Envío</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTransportMethod(transportMethod === 'bus' ? '' : 'bus')}
                  className={cn(
                    "flex items-center justify-center py-2.5 px-3 rounded-xl border-2 transition-all gap-1.5 text-xs font-black uppercase tracking-wider cursor-pointer",
                    transportMethod === 'bus' 
                      ? "bg-[#0b4d2c] border-[#0b4d2c] text-white shadow-md shadow-emerald-950/20" 
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-350"
                  )}
                >
                  <span className="text-[13px]">🚌</span>
                  <span>BUS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTransportMethod(transportMethod === 'paqueteria' ? '' : 'paqueteria')}
                  className={cn(
                    "flex items-center justify-center py-2.5 px-3 rounded-xl border-2 transition-all gap-1.5 text-xs font-black uppercase tracking-wider cursor-pointer",
                    transportMethod === 'paqueteria' 
                      ? "bg-[#0b4d2c] border-[#0b4d2c] text-white shadow-md shadow-emerald-950/20" 
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-350"
                  )}
                >
                  <span className="text-[13px]">📦</span>
                  <span className="truncate max-w-full">PAQUETERÍA</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTransportMethod(transportMethod === 'personal' ? '' : 'personal')}
                  className={cn(
                    "flex items-center justify-center py-2.5 px-3 rounded-xl border-2 transition-all gap-1.5 text-xs font-black uppercase tracking-wider cursor-pointer",
                    transportMethod === 'personal' 
                      ? "bg-[#0b4d2c] border-[#0b4d2c] text-white shadow-md shadow-emerald-950/20" 
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-350"
                  )}
                >
                  <span className="text-[13px]">🤝</span>
                  <span className="truncate max-w-full">PERSONAL</span>
                </button>
              </div>
            </div>

            {/* Shipping Cost switch toggle */}
            <div className="border-t border-slate-200/60 pt-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Incluir costo de envío (Q26.00)</span>
                  <span className="text-[9px] text-slate-400">Gratuito para pedidos superiores a Q1,000</span>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    const hasShipping = cart.some(i => i.product.name === 'COSTO DE ENVIO');
                    if (hasShipping) {
                      setCart(prev => prev.filter(i => i.product.name !== 'COSTO DE ENVIO'));
                    } else {
                      const shippingProduct = products.find(p => p.name === 'COSTO DE ENVIO') || {
                        id: `shipping-${Date.now()}`,
                        name: 'COSTO DE ENVIO',
                        price: 26,
                        stock: 999999,
                        is_external: false,
                        category: 'Servicios',
                        description: 'Costo de envío'
                      };
                      addToCart(shippingProduct as Product, 1);
                    }
                    setShippingHandled(!hasShipping);
                  }}
                  className={cn(
                    "w-11 h-6 rounded-full transition-all relative flex items-center cursor-pointer shadow-inner",
                    shippingHandled ? "bg-[#0b4d2c]" : "bg-slate-200"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full bg-white shadow-md transition-all absolute",
                    shippingHandled ? "left-6" : "left-1"
                  )} />
                </button>
              </div>
            </div>

            {/* Observations */}
            <div className="border-t border-slate-200/60 pt-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Observaciones adicionales (Opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Direcciones del piloto, facturación especial..."
                rows={2}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-[#0b4d2c] outline-none text-xs text-[#07361e] font-semibold resize-none shadow-inner"
              />
            </div>

          </div>

          {/* Cart Products List */}
          <div className="space-y-3.5">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
              <span>🛒 Productos en Carrito</span>
              <span className="font-bold text-emerald-800 bg-[#0b4d2c]/10 px-2 py-0.5 rounded-full"><span className="notranslate" translate="no">{cart.length}</span> únicos</span>
            </h3>

            {cart.length === 0 ? (
              <div className="text-center text-slate-405 py-12 border-2 border-dashed border-slate-200 rounded-2xl mx-1 flex flex-col items-center justify-center space-y-2">
                <ShoppingCart size={24} className="text-slate-300" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tu carrito está vacío</p>
                <p className="text-[10px] text-slate-405 leading-none">Haz click en los productos del catálogo para sumarlos</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item, idx) => {
                  const itemPrice = item.overridePrice !== undefined ? item.overridePrice : item.product.price;
                  const isDiscounted = itemPrice < item.product.price;
                  
                  return (
                    <div 
                      key={`${item.product.id}-${idx}`} 
                      className="p-3.5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-600/20 transition-all duration-200 space-y-3"
                    >
                      <div className="flex justify-between items-start gap-2.5">
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-xs text-slate-800 leading-tight notranslate" translate="no">
                            {item.product.name}
                          </h4>
                          {item.variant && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-slate-50 text-[9px] text-[#0b4d2c] font-black rounded-lg border border-slate-100">
                              Variante: {item.variant.color} / {item.variant.size}
                            </span>
                          )}
                        </div>
                        
                        <button 
                          onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))} 
                          className="text-slate-400 hover:text-red-650 p-1 rounded-full hover:bg-red-50 transition-colors cursor-pointer"
                          title="Eliminar del carrito"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="flex items-end justify-between gap-2.5 pt-2 border-t border-slate-100">
                        {/* Price Area */}
                        <div>
                          {user.role === 'admin' ? (
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-wide block">Precio Ajustado (Q)</label>
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] font-bold text-slate-500">Q</span>
                                <input 
                                  type="number" 
                                  value={item.overridePrice ?? item.product.price}
                                  onChange={(e) => {
                                      const newPrice = parseFloat(e.target.value);
                                      setCart(prev => prev.map((it, i) => i === idx ? { ...it, overridePrice: newPrice >= 0 ? newPrice : 0 } : it));
                                  }}
                                  className={cn(
                                    "w-20 px-2 py-1 text-xs font-black text-slate-800 bg-slate-50 border rounded-lg focus:bg-white focus:ring-1 focus:ring-[#0b4d2c] outline-none shadow-sm",
                                    isDiscounted ? "border-amber-400 text-amber-700 bg-amber-50/20" : "border-slate-200"
                                  )}
                                  min="0"
                                  step="0.01"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <p className="text-[11px] font-black text-[#0b4d2c]"><span className="notranslate" translate="no">{formatMoney(itemPrice)}</span> <span className="text-[9px] text-slate-400 font-bold">c/u</span></p>
                              {isDiscounted && (
                                <p className="text-[8px] text-amber-600 font-black uppercase tracking-wide">Descuento aplicado base: {formatMoney(item.product.price)}</p>
                              )}
                            </div>
                          )}

                          {item.appliedCustomOffer && (
                            <div className="mt-1 flex items-center">
                              <span className="text-[9px] font-black uppercase bg-amber-500 text-white px-2 py-0.5 rounded-lg border border-amber-400 shadow-sm leading-none tracking-wider">
                                Oferta: {item.appliedCustomOffer.buyQty}+{item.appliedCustomOffer.freeQty}
                              </span>
                            </div>
                          )}

                          {isDiscounted && (
                            <div className="text-[8px] text-red-650 font-black uppercase tracking-wider mt-1.5 max-w-[200px] leading-tight">
                              ⚠️ ALERTA: ABAJO DEL MÍNIMO ({formatMoney(item.product.price)})
                            </div>
                          )}
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1 border border-slate-200 max-h-[36px]">
                          <button 
                            type="button"
                            onClick={() => {
                              setCart(prev => prev.map((it, i) => {
                                 if (i === idx) {
                                    let step = 1;
                                    if (it.appliedCustomOffer) {
                                       step = it.appliedCustomOffer.buyQty + it.appliedCustomOffer.freeQty;
                                    }
                                    const newQ = Math.max(step, it.quantity - step);
                                    return { ...it, quantity: newQ };
                                 }
                                 return it;
                              }));
                            }} 
                            className="p-1 hover:bg-slate-200 rounded-lg transition-colors text-slate-600 cursor-pointer"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-xs font-black w-7 text-center text-slate-800"><span className="notranslate" translate="no">{item.quantity}</span></span>
                          <button 
                            type="button"
                            onClick={() => {
                              setCart(prev => prev.map((it, i) => {
                                 if (i === idx) {
                                    let step = 1;
                                    if (it.appliedCustomOffer) {
                                       step = it.appliedCustomOffer.buyQty + it.appliedCustomOffer.freeQty;
                                    }
                                    const newQ = Math.max(step, it.quantity + step);
                                    let variantStock = undefined;
                                    if (it.variant?.id && it.product.variants) {
                                      variantStock = it.product.variants.find(v => v.id === it.variant?.id)?.stock;
                                    }
                                    const maxStock = variantStock !== undefined ? variantStock : it.product.stock;
                                    
                                    if (newQ > maxStock && !doesNotNeedStock(it.product)) {
                                      setErrorMsg(`Falta de stock disponible para "${it.product.name}"${it.variant ? ` (${it.variant.color})` : ''}`);
                                      setTimeout(() => setErrorMsg(''), 4000);
                                      return it;
                                    }
                                    return { ...it, quantity: newQ };
                                 }
                                 return it;
                              }));
                            }} 
                            className="p-1 hover:bg-slate-200 rounded-lg transition-colors text-slate-600 cursor-pointer"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>

        {/* Footer actions total invoice block */}
        <div className="bg-slate-50 p-6 border-t border-slate-200 z-10 shrink-0">
          
          <div className="flex justify-between items-center mb-5">
             <span className="font-extrabold text-slate-500 text-sm uppercase tracking-widest">Total del Pedido</span>
             <span className="font-black text-[#0b4d2c] text-2xl sm:text-3xl bg-white border border-emerald-950/5 px-4.5 py-1.5 rounded-2xl shadow-sm">
                <span className="notranslate" translate="no">{formatMoney(cartTotal)}</span>
             </span>
          </div>

          <div className="flex flex-col gap-2.5">
            <button 
              disabled={isSubmitting || cart.length === 0}
              onClick={() => handleCheckout(true)}
              className="w-full bg-gradient-to-r from-[#0b4d2c] to-[#07361e] text-white py-4 rounded-2xl font-black hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100 text-xs sm:text-sm uppercase tracking-wider cursor-pointer"
            >
              <CheckCircle size={16} />
              {editingInvoiceId ? 'ACTUALIZAR PEDIDO S/CRÉDITO' : (navigator.onLine ? 'REGISTRAR AL CRÉDITO Y FIRMAR' : 'REGISTRAR AL CRÉDITO OFFLINE Y FIRMAR')}
            </button>
            {isMobile && (
              <button 
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="w-full bg-[#f4f7f5] hover:bg-slate-200 text-[#0b4d2c] border border-slate-200/80 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer shadow-xs mt-1"
              >
                ➕ SEGUIR AGREGANDO PRODUCTOS
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 bg-[#07361e]/40 backdrop-blur-md z-[100] flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-[0_25px_60px_rgba(7,54,30,0.35)] overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-emerald-900/10">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/50 to-white">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-4.5 rounded-full bg-[#0b4d2c] block" />
                <h3 className="font-extrabold text-slate-800 text-base uppercase tracking-wider">Opciones de Compra</h3>
              </div>
              <button 
                onClick={() => setSelectedProduct(null)} 
                className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                title="Cerrar modal"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 space-y-5 max-h-[75vh] overflow-auto">
              <div className="space-y-1">
                <h4 className="font-black text-slate-800 text-base leading-tight notranslate" translate="no">{selectedProduct.name}</h4>
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  <span className="text-[10px] bg-emerald-50 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-md border border-emerald-100 uppercase tracking-wider">
                    Stock: {(() => {
                      if (selectedProduct.is_external) return 'Bajo Pedido (Externo)';
                      if (doesNotNeedStock(selectedProduct)) return 'Sin Límite (Exento)';
                      if (selectedProduct.variants && selectedProduct.variants.length > 0) {
                        return selectedProduct.variants.reduce((sum, v) => sum + (v.stock !== undefined ? v.stock : selectedProduct.stock), 0);
                      }
                      return selectedProduct.stock;
                    })()}
                  </span>
                  <span className="text-[10px] bg-slate-50 text-slate-600 font-extrabold px-2.5 py-0.5 rounded-md border border-slate-100">
                    Precio Base: {formatMoney(selectedProduct.price)}
                  </span>
                </div>
              </div>

              {/* Variant Selection if exists */}
              {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <div className="space-y-4.5 p-4.5 bg-emerald-50/20 rounded-2xl border border-emerald-700/10">
                  <h5 className="text-[10px] font-black text-[#0b4d2c] uppercase tracking-widest flex items-center gap-1">
                     <span>🎨</span> Seleccionar Variante y Talla
                  </h5>
                  
                  {/* Step 1: Color */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">1. Seleccionar Variante / Color</label>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set(selectedProduct.variants.map(v => v.color))).map(color => {
                        const variantsInColor = selectedProduct.variants!.filter(v => v.color === color);
                        const isColorExempt = selectedProduct.is_external || doesNotNeedStock(selectedProduct);
                        
                        // A color is blocked/out-of-stock if ALL variants under this color are blocked/out-of-stock
                        const isColorAllBlocked = variantsInColor.every(v => v.isBlocked);
                        const isColorOutOfStock = !isColorExempt && variantsInColor.every(v => (v.stock !== undefined ? v.stock : selectedProduct.stock) <= 0);
                        const isColorUnavailable = isColorAllBlocked || isColorOutOfStock;
                        
                        return (
                          <button
                            key={color}
                            type="button"
                            disabled={isColorUnavailable}
                            onClick={() => {
                              setSelectedColor(color);
                              if (variantsInColor.length === 1) {
                                setSelectedSize(variantsInColor[0].size);
                                setSelectedVariantId(variantsInColor[0].id);
                                if (!isPriceManuallyEdited) {
                                  setModalPrice(variantsInColor[0].price.toString());
                                  setCustomOfferUnitPrice(variantsInColor[0].price.toString());
                                }
                              } else {
                                setSelectedSize('');
                                setSelectedVariantId(null);
                              }
                            }}
                            className={cn(
                              "px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border flex items-center gap-1.5",
                              isColorUnavailable
                                ? "bg-slate-150 border-slate-200 text-slate-400 cursor-not-allowed line-through opacity-55"
                                : selectedColor === color 
                                  ? "bg-[#0b4d2c] border-[#0b4d2c] text-white shadow-md shadow-emerald-900/20 cursor-pointer" 
                                  : "bg-white border-slate-200 text-slate-650 hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer"
                            )}
                          >
                            <span className="shadow-sm">{color}</span>
                            {isColorAllBlocked ? (
                              <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-150 font-bold uppercase tracking-normal">Bloqueado</span>
                            ) : isColorOutOfStock ? (
                              <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-150 font-bold uppercase tracking-normal">Agotado</span>
                            ) : variantsInColor.length === 1 && (
                              <span className="opacity-80 border-l border-current pl-1.5 ml-1.5 flex items-center">
                                {variantsInColor[0].stock !== undefined ? <span className="mr-1.5 text-[10px] uppercase font-bold normal-case">{variantsInColor[0].stock} disp.</span> : null}
                                {formatMoney(variantsInColor[0].price)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: Size */}
                  {selectedColor && selectedProduct.variants!.filter(v => v.color === selectedColor).length > 1 && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-1.5 pt-2">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">2. Seleccionar Medida / Talla</label>
                      <div className="flex flex-wrap gap-2">
                        {selectedProduct.variants!.filter(v => v.color === selectedColor).map(v => {
                          const isSizeExempt = selectedProduct.is_external || doesNotNeedStock(selectedProduct);
                          const isSizeBlocked = v.isBlocked;
                          const isSizeOutOfStock = !isSizeExempt && (v.stock !== undefined ? v.stock : selectedProduct.stock) <= 0;
                          const isSizeUnavailable = isSizeBlocked || isSizeOutOfStock;
                          
                          return (
                            <button
                              key={v.id}
                              type="button"
                              disabled={isSizeUnavailable}
                              onClick={() => {
                                setSelectedSize(v.size);
                                setSelectedVariantId(v.id);
                                if (!isPriceManuallyEdited) {
                                  setModalPrice(v.price.toString());
                                  setCustomOfferUnitPrice(v.price.toString());
                                }
                              }}
                              className={cn(
                                "px-4 py-2.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1.5",
                                isSizeUnavailable
                                  ? "bg-slate-150 border-slate-200 text-slate-400 cursor-not-allowed line-through opacity-55"
                                  : selectedSize === v.size 
                                    ? "bg-[#0b4d2c] border-[#0b4d2c] text-white shadow-md shadow-emerald-900/20 cursor-pointer" 
                                    : "bg-white border-slate-200 text-slate-650 hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer"
                              )}
                            >
                              <span className="shadow-sm">{v.size}</span>
                              {isSizeBlocked ? (
                                <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-150 font-bold uppercase tracking-normal">Bloqueado</span>
                              ) : isSizeOutOfStock ? (
                                <span className="text-[9px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-150 font-bold uppercase tracking-normal">Agotado</span>
                              ) : (
                                <span className="opacity-80 border-l border-current pl-1.5">
                                  {v.stock !== undefined ? <span className="mr-1.5 text-[10px] uppercase font-bold">{v.stock} disp.</span> : null}
                                  {formatMoney(v.price)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                  
                  {selectedColor && selectedProduct.variants!.filter(v => v.color === selectedColor).length === 1 && selectedProduct.variants!.find(v => v.color === selectedColor)?.size !== 'Única' && (
                    <div className="pt-2">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Talla: <span className="text-[#0b4d2c] font-black">{selectedProduct.variants!.find(v => v.color === selectedColor)?.size}</span> seleccionada automáticamente</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input 
                  type="checkbox" 
                  id="venderEnOferta" 
                  checked={isCustomOffer}
                  onChange={e => setIsCustomOffer(e.target.checked)}
                  className="w-4.5 h-4.5 text-[#0b4d2c] rounded-md border-slate-300 focus:ring-[#0b4d2c] accent-[#0b4d2c] cursor-pointer"
                />
                <label htmlFor="venderEnOferta" className="text-xs sm:text-sm font-bold text-slate-700 cursor-pointer select-none">
                  Vender en oferta (Ajuste promocional manual)
                </label>
              </div>

              {!isCustomOffer ? (
                <div className="w-full p-4.5 border border-slate-205 rounded-[1.5rem] flex flex-col gap-3.5 transition-all text-left bg-gradient-to-b from-slate-50 to-white shadow-sm">
                  <div className="font-extrabold text-slate-800 border-b border-slate-100 pb-2 uppercase tracking-wider text-xs flex items-center gap-1.5">
                    <span className="w-1.5 h-3 rounded-full bg-[#0b4d2c]" /> Venta Normal Directa
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider mb-1">Cantidad</label>
                        <input 
                           type="number" 
                           min="1" 
                           value={modalQuantity} 
                           onChange={e => setModalQuantity(e.target.value)} 
                           className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-extrabold text-[#07361e] outline-none focus:ring-2 focus:ring-[#0b4d2c] focus:border-[#0b4d2c] transition-all bg-white" 
                        />
                     </div>
                     <div>
                        <label className="text-[10px] font-extrabold text-slate-400 block uppercase tracking-wider mb-1">Precio c/u (Q)</label>
                        <input 
                           type="number" 
                           min="0" 
                           step="0.01"
                           value={modalPrice} 
                           onChange={e => {
                               setModalPrice(e.target.value);
                               setIsPriceManuallyEdited(true);
                           }}
                           className={`w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 bg-white font-extrabold transition-all duration-250 ${
                             parseFloat(modalPrice) < selectedProduct.price 
                               ? 'border-red-300 focus:ring-red-500 focus:border-red-500 text-red-700 bg-red-50/20' 
                               : 'border-slate-200 focus:ring-[#0b4d2c] focus:border-[#0b4d2c] text-[#07361e]'
                           }`} 
                        />
                        {parseFloat(modalPrice) < selectedProduct.price && (
                           <p className="text-[9px] text-red-650 font-black mt-1 uppercase tracking-tight leading-normal">⚠️ BAJO PRECIO BASE ({formatMoney(selectedProduct.price)})</p>
                        )}
                     </div>
                  </div>
                  
                  <button 
                    onClick={() => {
                      const qty = parseInt(modalQuantity);
                      const price = parseFloat(modalPrice);
                      if (isNaN(qty) || qty < 1) return alert("Cantidad inválida");
                      if (isNaN(price) || price < 0) return alert("Precio inválido");

                      if (selectedProduct?.variants && selectedProduct.variants.length > 0) {
                        if (!selectedVariantId) {
                          return alert("Por favor selecciona color y talla.");
                        }
                        const v = selectedProduct.variants.find(varObj => varObj.id === selectedVariantId);
                        if (v?.isBlocked) {
                          return alert("Esta variante está bloqueada y no se puede vender.");
                        }
                      }

                      const variantData = selectedVariantId ? {
                        id: selectedVariantId,
                        color: selectedColor,
                        size: selectedSize
                      } : undefined;
                      
                      addToCart(selectedProduct, qty, price, undefined, variantData);
                      setSelectedProduct(null);
                    }}
                    className="w-full mt-2.5 bg-[#0b4d2c] hover:bg-[#07361e] text-white font-extrabold py-3.5 rounded-2xl transition-all cursor-pointer text-xs uppercase tracking-wider shadow-md shadow-emerald-950/10 active:scale-[0.98]"
                  >
                     Agregar a la Venta
                  </button>
                </div>
              ) : (
                <div className="w-full p-4.5 border border-emerald-200 bg-emerald-50/10 rounded-[1.5rem] flex flex-col gap-3.5 transition-all text-left shadow-sm">
                  <div className="font-extrabold text-[#0b4d2c] border-b border-emerald-100 pb-2.5 flex gap-1.5 items-center uppercase tracking-wider text-xs">
                    <span className="text-[#0b4d2c] text-sm leading-none">🏷️</span> Promoción Especial (X + Y)
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label className="text-[10px] font-extrabold text-emerald-800/80 block uppercase tracking-wider mb-1">Paga (Cant.)</label>
                        <input 
                           type="number" 
                           min="1" 
                           value={customOfferBuy} 
                           onChange={e => {
                               setCustomOfferBuy(e.target.value);
                               const buyQty = parseInt(e.target.value) || 0;
                               const up = parseFloat(customOfferUnitPrice) || (selectedProduct?.price || 0);
                               setModalPrice((up * buyQty).toFixed(4));
                           }} 
                           placeholder="Ej: 12"
                           className="w-full border border-emerald-200/60 rounded-xl px-3 py-2 text-sm font-extrabold outline-none focus:ring-2 focus:ring-[#0b4d2c] focus:border-[#0b4d2c] bg-white transition-all text-[#07361e]" 
                        />
                     </div>
                     <div>
                        <label className="text-[10px] font-extrabold text-emerald-800/80 block uppercase tracking-wider mb-1">Gratis (Cant.)</label>
                        <input 
                           type="number" 
                           min="1" 
                           value={customOfferFree} 
                           onChange={e => setCustomOfferFree(e.target.value)} 
                           placeholder="Ej: 1"
                           className="w-full border border-emerald-200/60 rounded-xl px-3 py-2 text-sm font-extrabold outline-none focus:ring-2 focus:ring-[#0b4d2c] focus:border-[#0b4d2c] bg-white transition-all text-[#07361e]" 
                        />
                     </div>
                  </div>

                  <div>
                     <p className="text-[10px] font-extrabold text-emerald-800/80 uppercase tracking-wider mb-1">Precio Unitario Aplicado (Unidades Pagadas)</p>
                     <input 
                        type="number" 
                        step="0.01"
                        value={customOfferUnitPrice} 
                        onChange={e => {
                           setCustomOfferUnitPrice(e.target.value);
                           const up = parseFloat(e.target.value) || 0;
                           const buyQty = parseInt(customOfferBuy) || 0;
                           setModalPrice((up * buyQty).toFixed(4));
                           setIsPriceManuallyEdited(true);
                        }} 
                        className={`w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 bg-white font-extrabold transition-all duration-250 ${
                          selectedProduct && parseFloat(customOfferUnitPrice || '0') < selectedProduct.price 
                            ? 'border-red-300 focus:ring-red-500 focus:border-red-500 text-red-700 bg-red-50/20' 
                            : 'border-emerald-200/60 focus:ring-[#0b4d2c] focus:border-[#0b4d2c] text-[#07361e]'
                        }`} 
                     />
                     {selectedProduct && parseFloat(customOfferUnitPrice || '0') < selectedProduct.price && (
                        <p className="text-[9px] text-red-650 font-black mt-1 uppercase tracking-tight leading-normal">
                           ⚠️ BAJO PRECIO BASE ({formatMoney(selectedProduct.price)})
                        </p>
                     )}
                  </div>

                  <div>
                     <p className="text-[10px] font-extrabold text-emerald-800/80 uppercase tracking-wider mb-1">
                       Precio Total del Paquete (Las {(parseInt(customOfferBuy) || 0) + (parseInt(customOfferFree) || 0)} unidades)
                     </p>
                     <input 
                        type="number" 
                        step="0.01"
                        value={modalPrice} 
                        onChange={e => {
                           setModalPrice(e.target.value);
                           const buyQty = parseInt(customOfferBuy) || 0;
                           const total = parseFloat(e.target.value) || 0;
                           if (buyQty > 0) {
                              setCustomOfferUnitPrice((total / buyQty).toFixed(4));
                           }
                           setIsPriceManuallyEdited(true);
                        }} 
                        className="w-full border border-emerald-200/60 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0b4d2c] focus:border-[#0b4d2c] bg-white font-extrabold transition-all text-[#07361e]" 
                     />
                  </div>
                  
                  <button 
                    onClick={() => {
                      const buyQty = parseInt(customOfferBuy);
                      const freeQty = parseInt(customOfferFree);
                      let totalPrice = parseFloat(modalPrice);
                      
                      if (isNaN(buyQty) || buyQty < 1) return alert("Cantidad 'Paga' inválida");
                      if (isNaN(freeQty) || freeQty < 1) return alert("Cantidad 'Gratis' inválida");

                      if (selectedProduct?.variants && selectedProduct.variants.length > 0) {
                        if (!selectedVariantId) {
                          return alert("Por favor selecciona color y talla.");
                        }
                        const v = selectedProduct.variants.find(varObj => varObj.id === selectedVariantId);
                        if (v?.isBlocked) {
                          return alert("Esta variante está bloqueada y no se puede vender.");
                        }
                      }
                      
                      const totalQty = buyQty + freeQty;
                      
                      if (isNaN(totalPrice) || totalPrice < 0) {
                         return alert("Precio de paquete inválido");
                      }
                      
                      const variantData = selectedVariantId ? {
                        id: selectedVariantId,
                        color: selectedColor,
                        size: selectedSize
                      } : undefined;

                      const displayUnitPrice = parseFloat(customOfferUnitPrice) || (selectedProduct?.price || 0);
                      
                      addToCart(selectedProduct, totalQty, displayUnitPrice, { buyQty, freeQty }, variantData);
                      setSelectedProduct(null);
                    }}
                    className="w-full mt-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold py-2.5 rounded-xl transition-all shadow-md shadow-orange-500/20"
                  >
                     Confirmar Promoción
                  </button>
                </div>
              )}

              {selectedProduct.specifications && selectedProduct.specifications.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Especificaciones Técnicas</p>
                   <div className="grid grid-cols-2 gap-2">
                      {selectedProduct.specifications.map((spec, idx) => (
                        <div key={idx} className="bg-slate-50 p-2 rounded-lg border border-slate-100 border-dashed">
                          <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">{spec.key}</p>
                          <p className="text-xs font-bold text-slate-700 truncate">{spec.value}</p>
                        </div>
                      ))}
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showNewClientSellerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-black text-slate-800 text-lg">Cliente Nuevo Detectado</h3>
              <button 
                onClick={() => setShowNewClientSellerModal(false)} 
                className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                type="button"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold leading-relaxed">
                El cliente <strong className="text-slate-950 font-black">"{client}"</strong> no está registrado en el área de clientes. Para completar la venta, debes asignarlo a un vendedor para agregarlo directamente al sistema.
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                  Vendedor Asignado
                </label>
                <select
                  value={selectedSellerForNewClient}
                  onChange={(e) => setSelectedSellerForNewClient(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500 outline-none font-bold text-slate-800 transition-all shadow-sm"
                >
                  <option value="" disabled>-- Selecciona un Vendedor --</option>
                  {usersList.map((u) => (
                    <option key={u.id || u.email} value={u.email}>
                      {u.name} ({u.role === 'admin' ? 'Administrador' : 'Vendedor'})
                    </option>
                  ))}
                  {!usersList.some(u => u.email === user.email) && (
                    <option value={user.email}>{user.name} (Tú)</option>
                  )}
                </select>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl space-y-1.5 border border-slate-100 text-xs text-slate-600">
                <p><strong>NIT:</strong> {nit || 'C/F'}</p>
                <p><strong>Teléfono:</strong> {phone || 'N/A'}</p>
                <p><strong>Dirección:</strong> {address || 'N/A'}</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewClientSellerModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!selectedSellerForNewClient || isSubmitting}
                  onClick={async () => {
                    if (!selectedSellerForNewClient) {
                      return alert('Por favor selecciona el vendedor asignado.');
                    }
                    try {
                      let newCli;
                      if (!navigator.onLine) {
                        newCli = {
                          id: `CLI-OFFLINE-${Date.now()}`,
                          name: client,
                          companyName: '',
                          nit: nit || '',
                          phone: phone || '',
                          address: address || '',
                          sellerId: selectedSellerForNewClient
                        };
                      } else {
                        // 1. Agregar el cliente formalmente al backend y guardarlo de forma local/remota
                        // Try to split if it looks like "Name - Company"
                        let nameToSave = client;
                        let companyToSave = '';
                        if (client.includes(' - ')) {
                          const parts = client.split(' - ');
                          nameToSave = parts[0].trim();
                          companyToSave = parts[1].trim();
                        }

                        newCli = await api.addClient({
                          name: nameToSave,
                          companyName: companyToSave,
                          nit: nit || '',
                          phone: phone || '',
                          address: address || '',
                          sellerId: selectedSellerForNewClient
                        });
                      }

                      // 2. Actualizar nuestra lista de clientes
                      setClients(prev => prev.some(c => c.id === newCli.id) ? prev : [...prev, newCli]);

                      // 3. Cerrar el modal
                      setShowNewClientSellerModal(false);

                      // 4. Continuar con la venta usando el vendedor seleccionado
                      await proceedWithCheckout(checkoutIsOwed, selectedSellerForNewClient);
                    } catch (err: any) {
                      alert(`Error al registrar cliente y continuar venta: ${err.message}`);
                    }
                  }}
                  className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold rounded-xl transition-all shadow-md text-sm disabled:opacity-50"
                >
                  Registrar y Vender
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSearchClientModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200 text-left">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                  👥 Clientes del Sistema
                </h3>
                <p className="text-xs text-slate-500 font-medium">Busca un cliente registrado o agrega uno nuevo directamente.</p>
              </div>
              <button 
                onClick={() => setShowSearchClientModal(false)} 
                className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-150 bg-slate-100/55">
              <button
                type="button"
                onClick={() => setClientModalTab('search')}
                className={cn(
                  "flex-1 py-3 text-center text-xs font-black uppercase tracking-wider transition-all border-b-2",
                  clientModalTab === 'search'
                    ? "border-teal-500 text-teal-650 bg-white shadow-sm"
                    : "border-transparent text-slate-500 hover:text-slate-700 bg-slate-50/50"
                )}
              >
                🔍 Buscar Cliente Existente
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewClientName(clientSearchQuery);
                  setNewClientCompanyName('');
                  setNewClientNit('');
                  setNewClientPhone('');
                  setNewClientAddress('');
                  setNewClientSellerId(user.email || '');
                  setClientModalTab('create');
                }}
                className={cn(
                  "flex-1 py-3 text-center text-xs font-black uppercase tracking-wider transition-all border-b-2",
                  clientModalTab === 'create'
                    ? "border-teal-500 text-teal-650 bg-white shadow-sm"
                    : "border-transparent text-slate-500 hover:text-slate-700 bg-slate-50/55"
                )}
              >
                ➕ Registrar Cliente Nuevo
              </button>
            </div>

            {clientModalTab === 'search' ? (
              <>
                {/* Filters and Search Input */}
                <div className="p-5 bg-slate-50/50 border-b border-slate-100 space-y-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      placeholder="Escribe el nombre, empresa, NIT o teléfono..."
                      className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500 outline-none font-bold text-slate-900 transition-all shadow-sm text-sm"
                      autoFocus
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Search size={18} />
                    </div>
                    {clientSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setClientSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 p-1 rounded-full hover:bg-slate-100"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Sellers vs All filter tabs */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setClientSearchFilter('mine')}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-black tracking-wide transition-all",
                        clientSearchFilter === 'mine'
                          ? "bg-teal-500 text-white shadow-sm"
                          : "bg-slate-200 hover:bg-slate-300 text-slate-600"
                      )}
                    >
                      Mis Clientes Asignados
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientSearchFilter('all')}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-black tracking-wide transition-all",
                        clientSearchFilter === 'all'
                          ? "bg-teal-500 text-white shadow-sm"
                          : "bg-slate-200 hover:bg-slate-300 text-slate-600"
                      )}
                    >
                      Todos los Clientes ({clients.length})
                    </button>
                  </div>
                </div>

                {/* List of matches */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/20">
                  {(() => {
                    const queryLower = clientSearchQuery.toLowerCase().trim();
                    const filtered = clients.filter(c => {
                      if (clientSearchFilter === 'mine' && c.sellerId !== user.email) {
                        return false;
                      }
                      
                      if (!queryLower) return true;
                      const nameMatch = (c.name || '').toLowerCase().includes(queryLower);
                      const companyMatch = (c.companyName || '').toLowerCase().includes(queryLower);
                      const nitMatch = (c.nit || '').toLowerCase().includes(queryLower);
                      const phoneMatch = (c.phone || '').toLowerCase().includes(queryLower);
                      
                      return nameMatch || companyMatch || nitMatch || phoneMatch;
                    });

                    return (
                      <>
                        {/* Option to create a new client using search query at top of matching list (if query isn't empty) */}
                        {clientSearchQuery.trim().length > 1 && (
                          <div className="p-4 bg-teal-50 border border-teal-100 hover:border-teal-300 rounded-2xl flex items-center justify-between text-left transition-all mb-1">
                            <div>
                              <p className="font-extrabold text-teal-950 text-sm">¿Es un cliente nuevo?</p>
                              <p className="text-xs text-teal-700 font-bold">Registrar "{clientSearchQuery}" directamente en el sistema.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setNewClientName(clientSearchQuery);
                                setNewClientCompanyName('');
                                setNewClientNit('');
                                setNewClientPhone('');
                                setNewClientAddress('');
                                setNewClientSellerId(user.email || '');
                                setClientModalTab('create');
                              }}
                              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl text-xs tracking-wide transition-all shadow-sm"
                            >
                              Registrar y Usar ➡️
                            </button>
                          </div>
                        )}

                        {filtered.length === 0 ? (
                          <div className="py-12 px-4 text-center space-y-4">
                            <div className="text-4xl text-center">👥</div>
                            <div className="space-y-1 text-center">
                              <p className="font-extrabold text-slate-800 text-base">No se encontraron clientes</p>
                              <p className="text-xs text-slate-500 max-w-md mx-auto">
                                No hay clientes que coincidan con la búsqueda. Puedes registrarlo directamente llenando un formulario rápido:
                              </p>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => {
                                setNewClientName(clientSearchQuery);
                                setNewClientCompanyName('');
                                setNewClientNit('');
                                setNewClientPhone('');
                                setNewClientAddress('');
                                setNewClientSellerId(user.email || '');
                                setClientModalTab('create');
                              }}
                              className="py-3 px-6 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-black tracking-wide transition-all shadow-md inline-block"
                            >
                              Registrar y Usar Cliente Nuevo ➕
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {filtered.map(c => {
                              const isAssignedToMe = c.sellerId === user.email;
                              return (
                                <div
                                  key={c.id}
                                  onClick={() => {
                                    const cName = c.companyName ? `${c.name} - ${c.companyName}` : c.name;
                                    setClient(cName);
                                    setNit(c.nit || '');
                                    setPhone(c.phone || '');
                                    setAddress(c.address || '');
                                    setIsEditingAddress(false);
                                    setShowSearchClientModal(false);
                                    checkClientDebt(cName);
                                  }}
                                  className="p-4 bg-white border border-slate-100 hover:border-teal-400 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer text-left space-y-2 relative group"
                                >
                                  <div className="flex justify-between items-start gap-2">
                                    <div>
                                      <h4 className="font-black text-slate-850 text-sm group-hover:text-teal-600 transition-colors">
                                        {c.name}
                                      </h4>
                                      {c.companyName && (
                                        <p className="text-xs text-teal-600 font-bold">{c.companyName}</p>
                                      )}
                                    </div>
                                    
                                    {isAssignedToMe ? (
                                      <span className="text-[9px] bg-emerald-50 text-emerald-600 font-black px-2 py-0.5 rounded-full whitespace-nowrap">
                                        Mío
                                      </span>
                                    ) : (
                                      <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                                        Vendedor
                                      </span>
                                    )}
                                  </div>

                                  {/* Rest of info is kept 'as is' in the data selection but hidden from preview card for clarity as requested */}
                                  <div className="hidden">
                                     <p>NIT: {c.nit}</p>
                                  </div>

                                  {(user.role === 'admin' || !isAssignedToMe) && c.sellerId && (
                                    <div className="text-[9px] text-slate-400 font-bold flex items-center gap-1 border-t border-slate-50 pt-1">
                                      👤 Asignado: <span className="text-slate-600 truncate max-w-[150px]">{c.sellerId}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Search Tab Bottom Actions */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2 justify-between items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setClient('');
                      setNit('');
                      setPhone('');
                      setAddress('');
                      setShowSearchClientModal(false);
                    }}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-black text-slate-700 transition-colors"
                  >
                    Limpiar Datos del Cliente actual
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSearchClientModal(false)}
                    className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-black transition-colors"
                  >
                    Listo (Cerrar)
                  </button>
                </div>
              </>
            ) : (
              /* TAB: REGISTER NEW CLIENT DIRECTLY - COMPLETELY SECURE/RELIABLE INLINE COMPONENT */
              <div className="flex-grow overflow-y-auto p-6 space-y-4 bg-slate-50/10 max-h-[50vh] touch-auto">
                {/* Row 1: Nombre */}
                <div className="w-full">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                    Nombre del Cliente <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Ej. Finca Las Margaritas o Juan Pérez"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm font-bold text-slate-800"
                  />
                </div>

                {/* Row 2: Empresa & NIT */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 w-full">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                      Nombre del Negocio
                    </label>
                    <input
                      type="text"
                      value={newClientCompanyName}
                      onChange={(e) => setNewClientCompanyName(e.target.value)}
                      placeholder="Ej. Distribuidora S.A. (opcional)"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm font-medium text-slate-800"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                      NIT / Identificación
                    </label>
                    <input
                      type="text"
                      value={newClientNit}
                      onChange={(e) => setNewClientNit(e.target.value)}
                      placeholder="Ej. 123456-7 (C/F por defecto)"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm font-medium text-slate-800"
                    />
                  </div>
                </div>

                {/* Row 3: Teléfono & Vendedor */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 w-full">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                      Teléfono de contacto
                    </label>
                    <input
                      type="text"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      placeholder="Ej. 5555-4444"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm font-medium text-slate-800"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                      Asignar Vendedor (Exigido) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newClientSellerId}
                      onChange={(e) => setNewClientSellerId(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-teal-500 outline-none font-bold text-slate-800 transition-all text-sm"
                    >
                      <option value="" disabled>-- Seleccione Vendedor --</option>
                      {usersList.map((u) => (
                        <option key={u.id || u.email} value={u.email}>
                          {u.name} ({u.role === 'admin' ? 'Admin' : 'Vendedor'})
                        </option>
                      ))}
                      {!usersList.some(u => u.email === user.email) && (
                        <option value={user.email}>{user.name} (Tú)</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Row 4: Dirección */}
                <div className="w-full">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                    Dirección de Entrega
                  </label>
                  <input
                    type="text"
                    value={newClientAddress}
                    onChange={(e) => setNewClientAddress(e.target.value)}
                    placeholder="Ej. Km 22 Ruta al Atlántico..."
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm font-medium text-slate-800"
                  />
                </div>

                {/* Create tab bottom actions */}
                <div className="pt-4 flex gap-3 border-t border-slate-100 mt-2">
                  <button
                    type="button"
                    onClick={() => setClientModalTab('search')}
                    className="flex-1 py-3 bg-slate-200 hover:bg-slate-350 text-slate-700 font-bold rounded-xl transition-all text-xs uppercase tracking-wider"
                  >
                    Volver a Buscador
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newClientName.trim()) {
                        return alert('Por favor ingresa el nombre del nuevo cliente.');
                      }
                      if (!newClientSellerId) {
                        return alert('Por favor asigna un vendedor para el cliente.');
                      }

                      setIsSubmitting(true);
                      try {
                        const savedCli = await api.addClient({
                          name: newClientName.trim(),
                          companyName: newClientCompanyName.trim(),
                          nit: newClientNit.trim() || 'C/F',
                          phone: newClientPhone.trim(),
                          address: newClientAddress.trim(),
                          sellerId: newClientSellerId
                        });

                        // Add to local client pool
                        setClients(prev => prev.some(c => c.id === savedCli.id) ? prev : [...prev, savedCli]);

                        // Populate the SalesPage client state fields with selected client
                        setClient(savedCli.companyName ? `${savedCli.name} - ${savedCli.companyName}` : savedCli.name);
                        setNit(savedCli.nit || 'C/F');
                        setPhone(savedCli.phone || '');
                        setAddress(savedCli.address || '');
                        setIsEditingAddress(false);

                        // Close Modal
                        setShowSearchClientModal(false);
                      } catch (err: any) {
                        alert(`Error registrando cliente: ${err.message}`);
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-black rounded-xl transition-all shadow-md text-xs uppercase tracking-wider disabled:opacity-50"
                  >
                    {isSubmitting ? 'Registrando...' : 'Registrar y Seleccionar ☑y'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {showDebtModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className={cn(
              "p-8 text-center",
              debtType === 'red' ? "bg-red-50" : "bg-amber-50"
            )}>
              <div className={cn(
                "w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg",
                debtType === 'red' ? "bg-red-600 text-white" : "bg-amber-500 text-white"
              )}>
                {debtType === 'red' ? <AlertCircle size={40} /> : <AlertTriangle size={40} />}
              </div>
              <h3 className={cn(
                "text-2xl font-black mb-2",
                debtType === 'red' ? "text-red-900" : "text-amber-900"
              )}>
                {debtType === 'red' ? 'BLOQUEO POR DEUDA CRÍTICA' : 'ALERTA DE MORA'}
              </h3>
              <p className="text-slate-600 font-medium leading-relaxed">
                El cliente <strong>{client}</strong> tiene facturas vencidas. 
                {debtType === 'red' ? ' El sistema requiere autorización obligatoria del administrador para continuar.' : ' Se recomienda regularizar su saldo antes de procesar un nuevo pedido.'}
              </p>
            </div>

            <div className="p-8 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center border border-teal-100">
                    <Phone size={18} className="text-teal-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contacto Cliente</p>
                    <p className="text-sm font-bold text-slate-800">{phone || 'Sin teléfono'}</p>
                  </div>
                </div>
                {phone && (
                   <a 
                    href={`https://wa.me/${phone.replace(/\D/g, '').length === 8 ? '502' + phone.replace(/\D/g, '') : phone.replace(/\D/g, '')}?text=${encodeURIComponent('Hola ' + client + ', te saludo de Agroservicios. Te escribo porque tenemos una factura pendiente de pago en el sistema. ¿Podrías apoyarnos con el comprobante?')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#1ebd5a] text-white rounded-xl font-bold text-xs transition-all shadow-md active:scale-95"
                   >
                     <MessageCircle size={16} /> WhatsApp
                   </a>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => {
                    setIsDebtAuthorized(true);
                    setShowDebtModal(false);
                    alert("Autorización solicitada. La venta se registrará en estado Pendiente para aprobación del administrador.");
                  }}
                  className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-sm transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95"
                >
                  <Send size={18} className="text-teal-400" /> 
                  SOLICITAR AUTORIZACIÓN (Venta Pendiente)
                </button>
                
                <button
                  onClick={() => {
                    setShowQuickPaymentModal(true);
                  }}
                  className="w-full py-4 bg-teal-50 hover:bg-teal-100 text-teal-700 border-2 border-teal-100 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  <Upload size={18} />
                  ADJUNTAR BOLETA / CANCELAR DEUDA
                </button>

                <button
                  onClick={() => setShowDebtModal(false)}
                  className="w-full py-4 bg-white hover:bg-slate-50 text-slate-400 font-bold text-sm transition-all rounded-2xl border border-slate-100"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showQuickPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
           <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 animate-in slide-in-from-bottom-4 duration-300 text-left">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                 <h3 className="font-black text-slate-800 text-lg">Actualizar Saldo de {client}</h3>
                 <button onClick={() => setShowQuickPaymentModal(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
                    <X size={20} />
                 </button>
              </div>
              <div className="p-6 space-y-6">
                 <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Factura a Abonar</label>
                    <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2">
                       {clientInvoices.filter(inv => inv.status === 'pending' || inv.status === 'sent').map(inv => (
                          <div 
                            key={inv.id} 
                            onClick={() => setSelectedInvoiceForPayment(inv)}
                            className={cn(
                              "p-3 rounded-xl border-2 transition-all cursor-pointer flex justify-between items-center",
                              selectedInvoiceForPayment?.id === inv.id 
                                ? "border-teal-500 bg-teal-50" 
                                : "border-slate-200 hover:border-slate-300 bg-white"
                            )}
                          >
                             <div className="text-left">
                                <p className="text-xs font-bold text-slate-800">{inv.id}</p>
                                <p className="text-[10px] text-slate-500 font-medium">{new Date(inv.date).toLocaleDateString()}</p>
                             </div>
                             <div className="text-right">
                                <p className="text-sm font-black text-teal-700">{formatMoney(inv.totalAmount - (inv.paidAmount || 0))}</p>
                             </div>
                          </div>
                       ))}
                       {clientInvoices.filter(inv => inv.status === 'pending' || inv.status === 'sent').length === 0 && (
                          <p className="text-sm text-slate-400 text-center py-4">No hay facturas pendientes.</p>
                       )}
                    </div>
                 </div>

                 {selectedInvoiceForPayment && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                       <div>
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block text-left">Monto a Abonar (Q)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            value={paymentAmount}
                            onChange={e => setPaymentAmount(e.target.value)}
                            placeholder={`Máximo ${formatMoney(selectedInvoiceForPayment.totalAmount - (selectedInvoiceForPayment.paidAmount || 0))}`}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-teal-500 outline-none font-bold text-slate-700"
                          />
                       </div>
                       
                       <div>
                          <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block text-left">Foto de la Boleta</label>
                          <div className="relative border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center cursor-pointer">
                             <input 
                              type="file" 
                              accept="image/*"
                              onChange={e => setPaymentFile(e.target.files?.[0] || null)}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                             />
                             <Upload className="text-slate-400 mb-2" size={24} />
                             <span className="text-xs font-black text-slate-500">{paymentFile ? paymentFile.name : 'Click para subir foto de boleta'}</span>
                          </div>
                       </div>

                       <button
                        disabled={isPaying || !paymentAmount}
                        onClick={handleAddQuickPayment}
                        className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-teal-600/20 disabled:opacity-50"
                       >
                          {isPaying ? 'Guardando Abono...' : 'Guardar Abono y Liberar Cuenta'}
                       </button>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {lastCreatedInvoice && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300 text-center text-left">
            
            {/* Header branding / Success Checkmark */}
            <div className="p-8 pb-3 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#0b4d2c] mb-4 shadow-xs relative">
                <CheckCircle size={32} className="text-emerald-600" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-ping" />
              </div>
              <h3 className="font-black text-slate-800 text-xl tracking-tight">¡Venta Registrada!</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1 text-center">El pedido se procesó exitosamente</p>
            </div>

            {/* Quick Details Box */}
            <div className="mx-6 p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-2.5 text-left">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold uppercase tracking-wider">Cliente:</span>
                <span className="font-extrabold text-slate-700">{lastCreatedInvoice.client}</span>
              </div>
              
              {lastCreatedInvoice.folio || lastCreatedInvoice.id ? (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider">Factura / Folio:</span>
                  <span className="font-mono font-extrabold text-[#0b4d2c]">#{lastCreatedInvoice.folio || lastCreatedInvoice.id}</span>
                </div>
              ) : null}

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold uppercase tracking-wider">Tipo Venta:</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-50 text-rose-600">
                  Crédito
                </span>
              </div>

              {lastCreatedInvoice.authStatus === 'pending' && (
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-200/50 flex gap-2 items-start text-[10px] text-amber-700 font-semibold leading-normal">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                  <span>Esta venta requiere aprobación porque tiene descuento especial o el cliente tiene deudas.</span>
                </div>
              )}

              <div className="pt-2 border-t border-neutral-200/60 flex justify-between items-center">
                <span className="text-xs text-slate-500 font-extrabold uppercase tracking-wider">Total:</span>
                <span className="text-lg font-black text-slate-800">{formatMoney(lastCreatedInvoice.totalAmount ?? lastCreatedInvoice.total ?? 0)}</span>
              </div>
            </div>

            {/* Print & Share Options */}
            <div className="p-6 space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Opciones de Entrega / Comprobante</p>
              
              <div className="grid grid-cols-1 gap-2">
                {/* 1. PDF Standard Download */}
                <button
                  onClick={() => downloadTicketPdf(lastCreatedInvoice)}
                  className="w-full py-3.5 bg-[#0b4d2c] hover:bg-[#07361e] text-white rounded-2xl font-black text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/10"
                >
                  <Download size={15} /> DESCARGAR COMPROBANTE (PDF)
                </button>

                {/* 2. Full Share on WhatsApp with product list! */}
                {lastCreatedInvoice.phone && lastCreatedInvoice.phone.replace(/\D/g, '').length >= 8 ? (
                  <a
                    href={`https://wa.me/${lastCreatedInvoice.phone.replace(/\D/g, '').length === 8 ? '502' + lastCreatedInvoice.phone.replace(/\D/g, '') : lastCreatedInvoice.phone.replace(/\D/g, '')}?text=${encodeURIComponent(getWhatsAppTextReceipt(lastCreatedInvoice))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 bg-[#25D366] hover:bg-[#1ebd5a] text-white rounded-2xl font-black text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 text-center"
                  >
                    <MessageCircle size={15} /> ENVIAR DETALLES POR WHATSAPP
                  </a>
                ) : (
                  <button
                    onClick={() => {
                      const phoneNumber = prompt("Ingrese el teléfono del cliente (WhatsApp), por ejemplo: 55443322", lastSavedClientPhone || "");
                      if (phoneNumber && phoneNumber.replace(/\D/g, '').length >= 8) {
                        const formattedPhone = phoneNumber.replace(/\D/g, '');
                        const fullPhone = formattedPhone.length === 8 ? '502' + formattedPhone : formattedPhone;
                        const receiptText = getWhatsAppTextReceipt(lastCreatedInvoice);
                        window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(receiptText)}`, '_blank');
                      }
                    }}
                    className="w-full py-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-2 border-emerald-100 rounded-2xl font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageCircle size={15} /> COMPARTIR POR WHATSAPP
                  </button>
                )}
              </div>

              <div className="pt-3.5 border-t border-slate-100">
                <button
                  onClick={() => setLastCreatedInvoice(null)}
                  className="w-full py-3 bg-neutral-900 hover:bg-black text-white font-black text-xs tracking-wider uppercase rounded-2xl transition-all cursor-pointer"
                >
                  Nueva Venta
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Final closing area for modals */}
      {showSignaturePad && (
        <SignaturePad 
          onSave={handleSaveSignature}
          onClose={() => setShowSignaturePad(false)}
          title="Firma del Vendedor"
        />
      )}
    </div>
  );
}
