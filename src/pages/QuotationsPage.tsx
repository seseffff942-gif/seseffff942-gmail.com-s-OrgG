import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { Product, User, Quotation, QuotationItem, Client } from '../types';
import { 
  FileSpreadsheet, Plus, Minus, Trash2, CheckCircle2, X, Search, 
  AlertTriangle, AlertCircle, Send, MessageCircle, Download, 
  Printer, ArrowLeft, Clock, Eye, Check, RefreshCw, ShoppingCart,
  Building2, Phone, MapPin, Calendar, Tag, ShieldAlert, ArrowRight,
  DollarSign, FileText, CheckCircle, Copy, ExternalLink, Sparkles, Edit2
} from 'lucide-react';
import { cn, printHtml, downloadHtmlAsPdf, formatMoney, compileQuotationTemplate, doesNotNeedStock } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import { ProductImage, getFallbackImage, LOGO_PLACEHOLDER } from '../components/ProductImage';

interface QuotationsPageProps {
  user: User;
  isMobile?: boolean;
}

export function QuotationsPage({ user, isMobile }: QuotationsPageProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Search & Filters for Catalog
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const categories = ['Todos', 'Veterinaria', 'Agroquímicos', 'Semillas', 'Herramientas', 'Otros'];

  // Client Selection
  const [client, setClient] = useState('');
  const [nit, setNit] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientModalTab, setClientModalTab] = useState<'search' | 'create'>('search');
  const [newClientName, setNewClientName] = useState('');
  const [newClientCompanyName, setNewClientCompanyName] = useState('');
  const [newClientNit, setNewClientNit] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [consultandoNit, setConsultandoNit] = useState(false);
  const [nitResultado, setNitResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  // Cart & Quotation Form State
  const [cart, setCart] = useState<QuotationItem[]>([]);
  const [validityDays, setValidityDays] = useState<number>(15);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState<string>(user?.email || user?.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(!isMobile);

  // Product Selection Modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalQuantity, setModalQuantity] = useState<string>('1');
  const [modalPrice, setModalPrice] = useState<string>('');
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [modalError, setModalError] = useState<string>('');

  // Success Modal State
  const [createdQuotation, setCreatedQuotation] = useState<Quotation | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Stock Warning Modal State (for 0 stock items)
  const [stockWarningModal, setStockWarningModal] = useState<{ show: boolean; productName: string; currentStock: number; requestedQty: number } | null>(null);

  // View / Preview Modal State
  const [previewQuotation, setPreviewQuotation] = useState<Quotation | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Convert to Sale Modal State
  const [convertingQuote, setConvertingQuote] = useState<Quotation | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [convertSuccessMsg, setConvertSuccessMsg] = useState<string>('');
  const [convertErrorMsg, setConvertErrorMsg] = useState<string>('');

  // Edit Quotation Modal State
  const [editingQuote, setEditingQuote] = useState<Quotation | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAdvisorId, setEditAdvisorId] = useState('');
  const [editClient, setEditClient] = useState('');
  const [editNit, setEditNit] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editValidityDays, setEditValidityDays] = useState(15);
  const [editNotes, setEditNotes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // History Search & Filter State
  const [historySearch, setHistorySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendiente' | 'aceptada' | 'convertida' | 'rechazada' | 'vencida'>('all');

  // Load initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, clis, usersList] = await Promise.all([
        api.getProducts().catch(() => []),
        api.getClients().catch(() => []),
        api.getUsers().catch(() => [])
      ]);
      setProducts(prods.map((p: any) => ({ ...p, stock: Number(p.stock) || 0, price: Number(p.price) || 0 })));
      setClients(clis);

      const isHuman = (u: any) => {
        if (!u || !u.name) return false;
        if (u.role === 'system') return false;
        const id = String(u.id || '').toLowerCase();
        const email = String(u.email || '').toLowerCase();
        const name = String(u.name || '').toLowerCase();
        if (id.startsWith('sys-') || id.startsWith('system-') || email.startsWith('system-')) return false;
        if (name.includes('config') || name.includes('store') || name.includes('critical') || name.includes('system') || name.includes('exclusion')) return false;
        return true;
      };
      const filteredTeam = (usersList || []).filter(isHuman);
      setTeamMembers(filteredTeam);
      if (!selectedAdvisorId && filteredTeam.length > 0) {
        setSelectedAdvisorId(user.email || user.id || filteredTeam[0].id);
      }
    } catch (err) {
      console.error("Error loading products/clients:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadQuotations = async () => {
    setHistoryLoading(true);
    try {
      const data = await api.getQuotations(user.role === 'admin' ? undefined : user.id);
      setQuotations(data || []);
    } catch (err) {
      console.error("Error loading quotations:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadQuotations();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadQuotations();
    }
  }, [activeTab]);

  // Consultar NIT en SAT
  const consultarNitSAT = async () => {
    const n = newClientNit.trim();
    if (!n) {
      setNitResultado({ ok: false, texto: 'Ingresa un NIT primero.' });
      return;
    }
    setConsultandoNit(true);
    setNitResultado(null);
    try {
      const r = await api.consultarNitFel(n);
      if (r.valido && r.nombre) {
        setNewClientName(prev => (!prev.trim() || prev === r.nombre) ? (r.nombre || prev) : prev);
        if (r.nit) setNewClientNit(r.nit);
        setNitResultado({ ok: true, texto: `Encontrado en SAT: ${r.nombre}` });
      } else {
        setNitResultado({ ok: false, texto: r.mensaje || 'NIT no encontrado en SAT.' });
      }
    } catch (err: any) {
      setNitResultado({ ok: false, texto: err?.message || 'No se pudo consultar el NIT.' });
    } finally {
      setConsultandoNit(false);
    }
  };

  const handleSelectClient = (c: Client) => {
    setClient(c.name + (c.companyName ? ` - ${c.companyName}` : ''));
    setNit(c.nit || 'CF');
    setPhone(c.phone || '');
    setAddress(c.address || '');
    if (c.sellerId) {
      setSelectedAdvisorId(c.sellerId);
    }
    setShowClientModal(false);
  };

  const handleCreateNewClient = async () => {
    if (!newClientName.trim()) {
      alert("Por favor ingresa al menos el nombre del cliente");
      return;
    }
    try {
      const created = await api.addClient({
        name: newClientName.trim(),
        companyName: newClientCompanyName.trim(),
        nit: newClientNit.trim() || 'CF',
        phone: newClientPhone.trim(),
        address: newClientAddress.trim(),
        sellerId: user.id
      });
      setClients(prev => [created, ...prev]);
      handleSelectClient(created);
      setNewClientName('');
      setNewClientCompanyName('');
      setNewClientNit('');
      setNewClientPhone('');
      setNewClientAddress('');
      setNitResultado(null);
    } catch (err: any) {
      alert(err.message || "Error al crear cliente");
    }
  };

  // Product Selection & Stock Checking
  const handleOpenProductModal = (product: Product) => {
    setSelectedProduct(product);
    setModalQuantity('1');
    setModalPrice(String(product.price || ''));
    setModalError('');

    if (product.variants && product.variants.length > 0) {
      const firstAvailable = product.variants[0];
      setSelectedVariantId(firstAvailable.id);
      setSelectedColor(firstAvailable.color || '');
      setSelectedSize(firstAvailable.size || '');
    } else {
      setSelectedVariantId(null);
      setSelectedColor('');
      setSelectedSize('');
    }
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    const qty = parseFloat(modalQuantity);
    const price = parseFloat(modalPrice);

    if (isNaN(qty) || qty <= 0) {
      setModalError('Ingresa una cantidad válida mayor a 0');
      return;
    }

    if (isNaN(price) || price < 0) {
      setModalError('Ingresa un precio válido');
      return;
    }

    const isExempt = doesNotNeedStock(selectedProduct) || selectedProduct.is_external;
    let availableStock = Number(selectedProduct.stock) || 0;
    let variantObj = null;

    if (selectedVariantId && selectedProduct.variants) {
      variantObj = selectedProduct.variants.find(v => v.id === selectedVariantId);
      if (variantObj && variantObj.stock !== undefined) {
        availableStock = Number(variantObj.stock) || 0;
      }
    }

    // Si el producto no tiene stock suficiente, mostrar modal de aviso pero permitir cotizarlo
    if (!isExempt && (availableStock <= 0 || qty > availableStock)) {
      setStockWarningModal({
        show: true,
        productName: selectedProduct.name + (variantObj ? ` (${variantObj.color || ''} ${variantObj.size || ''})` : ''),
        currentStock: availableStock,
        requestedQty: qty
      });
    }

    const itemTotal = qty * price;
    const newItem: QuotationItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: qty,
      price: price,
      originalPrice: selectedProduct.price,
      total: itemTotal,
      variantId: selectedVariantId || undefined,
      color: selectedColor || undefined,
      size: selectedSize || undefined
    };

    setCart(prev => {
      // Check if same item already in cart
      const existingIdx = prev.findIndex(item => 
        item.productId === newItem.productId && 
        item.variantId === newItem.variantId &&
        item.price === newItem.price
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + qty;
        if (!isExempt && newQty > availableStock) {
          alert(`⚠️ No puedes agregar más unidades. El total en la cotización superaría el stock disponible de ${availableStock}.`);
          return prev;
        }
        updated[existingIdx].quantity = newQty;
        updated[existingIdx].total = newQty * updated[existingIdx].price;
        return updated;
      }
      return [...prev, newItem];
    });

    setSelectedProduct(null);
  };

  const handleUpdateCartQty = (index: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev];
      const item = updated[index];
      const newQty = item.quantity + delta;

      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }

      // Check stock limit
      const prod = products.find(p => p.id === item.productId);
      if (prod && !doesNotNeedStock(prod) && !prod.is_external) {
        let maxStock = Number(prod.stock) || 0;
        if (item.variantId && prod.variants) {
          const v = prod.variants.find(vr => vr.id === item.variantId);
          if (v && v.stock !== undefined) maxStock = Number(v.stock) || 0;
        }
        if (newQty > maxStock) {
          alert(`⚠️ Cantidad máxima disponible en stock: ${maxStock}`);
          return prev;
        }
      }

      item.quantity = newQty;
      item.total = newQty * item.price;
      return updated;
    });
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.total || (item.quantity * item.price)), 0);
  }, [cart]);

  // Submit Quotation (NO STOCK DEDUCTION)
  const handleSubmitQuotation = async () => {
    if (!client.trim()) {
      alert("Por favor selecciona o ingresa el nombre del cliente para la cotización.");
      setShowClientModal(true);
      return;
    }

    if (cart.length === 0) {
      alert("Por favor agrega al menos un producto a la cotización.");
      return;
    }

    setIsSubmitting(true);
    try {
      const advisor = teamMembers.find(t => t.id === selectedAdvisorId || t.email === selectedAdvisorId || (t.name && selectedAdvisorId.includes(t.name)));
      const advisorName = advisor ? advisor.name : user.name;
      const advisorId = selectedAdvisorId || user.email || user.id;

      const quotePayload = {
        client: client.trim(),
        nit: nit.trim() || 'CF',
        phone: phone.trim(),
        address: address.trim(),
        items: cart,
        notes: customNotes.trim(),
        validityDays: validityDays,
        sellerId: advisorId,
        sellerName: advisorName
      };

      const result = await api.createQuotation(quotePayload);
      setCreatedQuotation(result);
      setShowSuccessModal(true);
      
      // Clear Cart Form
      setCart([]);
      setClient('');
      setNit('');
      setPhone('');
      setAddress('');
      setCustomNotes('');

      // Refresh Quotations list
      loadQuotations();
    } catch (err: any) {
      console.error("Error creating quotation:", err);
      alert(err.message || "Error al generar la cotización");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Quotation Handlers
  const handleOpenEditModal = (quote: Quotation) => {
    setEditingQuote(quote);
    setEditAdvisorId(quote.sellerId || quote.sellerName || '');
    setEditClient(quote.client || '');
    setEditNit(quote.nit || 'CF');
    setEditPhone(quote.phone || '');
    setEditAddress(quote.address || '');
    setEditValidityDays(quote.validityDays || 15);
    setEditNotes(quote.notes || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingQuote) return;
    if (!editClient.trim()) {
      alert("Por favor ingresa el nombre del cliente.");
      return;
    }

    setIsSavingEdit(true);
    try {
      const advisor = teamMembers.find(t => t.id === editAdvisorId || t.email === editAdvisorId || (t.name && editAdvisorId.includes(t.name)));
      const advisorName = advisor ? advisor.name : (editAdvisorId || editingQuote.sellerName || user.name);
      const advisorId = advisor ? (advisor.email || advisor.id) : editAdvisorId;

      const updates = {
        client: editClient.trim(),
        nit: editNit.trim() || 'CF',
        phone: editPhone.trim(),
        address: editAddress.trim(),
        validityDays: editValidityDays,
        notes: editNotes.trim(),
        sellerId: advisorId,
        sellerName: advisorName
      };

      const updated = await api.updateQuotation(editingQuote.id, updates);
      
      setQuotations(prev => prev.map(q => q.id === editingQuote.id ? { ...q, ...updates, ...updated } : q));
      
      if (previewQuotation?.id === editingQuote.id) {
        setPreviewQuotation(prev => prev ? { ...prev, ...updates, ...updated } : null);
      }

      setShowEditModal(false);
      setEditingQuote(null);
      alert(`✅ Cotización ${editingQuote.folio} actualizada. Asesor asignado: ${advisorName}`);
    } catch (err: any) {
      console.error("Error updating quotation:", err);
      alert(err.message || 'Error al guardar los cambios de la cotización');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete Quotation
  const handleDeleteQuotation = async (quote: Quotation) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la cotización ${quote.folio} de ${quote.client}?`)) {
      return;
    }
    try {
      await api.deleteQuotation(quote.id);
      setQuotations(prev => prev.filter(q => q.id !== quote.id));
      if (previewQuotation?.id === quote.id) {
        setShowPreviewModal(false);
        setPreviewQuotation(null);
      }
      alert(`Cotización ${quote.folio} eliminada correctamente.`);
    } catch (err: any) {
      alert(err.message || 'Error al eliminar cotización');
    }
  };

  // Convert Quotation to Formal Sale
  const handleConvertToSale = async (quote: Quotation) => {
    setConvertingQuote(quote);
    setConvertSuccessMsg('');
    setConvertErrorMsg('');
    setIsConverting(true);

    try {
      const res = await api.convertQuotationToSale(quote.id, {
        invoiceType: 'agricola',
        creditDays: 30
      });

      setConvertSuccessMsg(`¡Éxito! Cotización convertida en Venta #${res.invoice?.folio || res.invoice?.id}. El inventario ha sido actualizado correctamente.`);
      
      // Refresh list
      loadQuotations();
      loadData(); // reload product stocks
    } catch (err: any) {
      setConvertErrorMsg(err.message || 'No se pudo convertir la cotización a venta.');
    } finally {
      setIsConverting(false);
    }
  };

  // Print & PDF Helpers
  const handlePrintQuotation = async (quote: Quotation) => {
    const html = compileQuotationTemplate(quote, quote.sellerName || user.name);
    await printHtml(html);
  };

  const handleDownloadPdf = async (quote: Quotation) => {
    const html = compileQuotationTemplate(quote, quote.sellerName || user.name);
    const filename = `Cotizacion-${quote.folio || quote.id}-${quote.client.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    await downloadHtmlAsPdf(html, filename);
  };

  const handleShareWhatsApp = (quote: Quotation) => {
    const formatGT = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    let msg = `📄 *COTIZACIÓN FORMAL - AGRICOVET*\n`;
    msg += `Folio: *${quote.folio}*\n`;
    msg += `Cliente: *${quote.client}*\n`;
    if (quote.nit && quote.nit !== 'CF') msg += `NIT: ${quote.nit}\n`;
    msg += `Fecha: ${new Date(quote.date).toLocaleDateString('es-GT')}\n`;
    msg += `Vigencia: ${quote.validityDays || 15} días\n`;
    msg += `--------------------------------\n`;
    msg += `*DETALLE DE PRODUCTOS:*\n`;

    quote.items.forEach((it, idx) => {
      const variant = it.color || it.size ? ` (${it.color || ''} ${it.size || ''})` : '';
      msg += `${idx + 1}. ${it.productName}${variant}\n`;
      msg += `   ${it.quantity} x Q${formatGT(it.price)} = *Q${formatGT(it.total)}*\n`;
    });

    msg += `--------------------------------\n`;
    msg += `💰 *TOTAL COTIZADO: Q ${formatGT(quote.totalAmount)}*\n\n`;
    msg += `🏦 *Cuentas Bancarias Agricovet:*\n`;
    msg += `• Banco Industrial: 035-015252-6 (Monetaria)\n`;
    msg += `• Banrural: 3580029532 (Monetaria)\n\n`;
    msg += `_Precios incluyen IVA. Cotización sujeta a disponibilidad de existencias._`;

    const cleanPhone = (quote.phone || '').replace(/\D/g, '');
    const waUrl = cleanPhone.length >= 8 
      ? `https://wa.me/502${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(waUrl, '_blank');
  };

  // Filtered Catalog
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // Filtered History
  const filteredQuotations = useMemo(() => {
    return quotations.filter(q => {
      const matchesSearch = 
        q.client.toLowerCase().includes(historySearch.toLowerCase()) ||
        q.folio.toLowerCase().includes(historySearch.toLowerCase()) ||
        (q.sellerName && q.sellerName.toLowerCase().includes(historySearch.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [quotations, historySearch, statusFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const totalCount = quotations.length;
    const pendingCount = quotations.filter(q => q.status === 'pendiente').length;
    const convertedCount = quotations.filter(q => q.status === 'convertida').length;
    const totalAmount = quotations.reduce((sum, q) => sum + Number(q.totalAmount || 0), 0);
    return { totalCount, pendingCount, convertedCount, totalAmount };
  }, [quotations]);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-12">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 md:top-16 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#00696a] shrink-0 shadow-xs">
              <FileSpreadsheet size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight font-hanken">Cotizaciones Formales</h1>
                <span className="text-[10px] bg-teal-100/70 text-[#00696a] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-teal-200">
                  Sin Descuento de Stock
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Genera presupuestos oficiales con logo, folios independientes y correlatividad protegida.</p>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto self-stretch sm:self-auto">
            <button
              onClick={() => setActiveTab('create')}
              className={cn(
                "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === 'create'
                  ? "bg-white text-[#00696a] shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Plus size={16} />
              <span>Nueva Cotización</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={cn(
                "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer relative",
                activeTab === 'history'
                  ? "bg-white text-[#00696a] shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <FileText size={16} />
              <span>Historial ({quotations.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'create' ? (
          /* ================= NUEVA COTIZACIÓN ================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Client & Product Catalog */}
            <div className="lg:col-span-8 space-y-6">
              {/* Client Selection Card */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-[#00696a]" />
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Cliente de la Cotización</h2>
                  </div>
                  {client && (
                    <button
                      onClick={() => { setClient(''); setNit(''); setPhone(''); setAddress(''); }}
                      className="text-[11px] text-slate-400 hover:text-red-500 font-bold transition-colors cursor-pointer"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {client ? (
                  <div className="bg-teal-50/70 border border-teal-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-sm">{client}</span>
                        <span className="text-[10px] bg-[#00696a] text-white px-2 py-0.5 rounded-md font-bold">NIT: {nit || 'CF'}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 mt-1">
                        {phone && <span className="flex items-center gap-1"><Phone size={12} /> {phone}</span>}
                        {address && <span className="flex items-center gap-1"><MapPin size={12} /> {address}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowClientModal(true)}
                      className="text-xs text-[#00696a] hover:bg-teal-100/50 font-bold px-3 py-1.5 rounded-lg border border-teal-200 transition-all cursor-pointer shrink-0 text-center"
                    >
                      Cambiar Cliente
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      onClick={() => { setClientModalTab('search'); setShowClientModal(true); }}
                      className="flex-1 py-3 px-4 rounded-xl border border-dashed border-slate-300 hover:border-[#00696a] bg-slate-50 hover:bg-teal-50/40 text-slate-600 hover:text-[#00696a] text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Search size={16} />
                      <span>Buscar Cliente Existente</span>
                    </button>
                    <button
                      onClick={() => { setClientModalTab('create'); setShowClientModal(true); }}
                      className="py-3 px-4 rounded-xl bg-[#00696a] hover:bg-[#004f50] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                    >
                      <Plus size={16} />
                      <span>Nuevo Cliente Rápido</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Product Catalog Card */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Catálogo de Productos</h2>
                    <p className="text-xs text-slate-500">Haz clic en un producto con stock disponible para cotizarlo</p>
                  </div>
                  {/* Search bar */}
                  <div className="relative min-w-[240px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar producto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-2 rounded-xl text-xs outline-none focus:border-[#00696a] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Categories Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                        selectedCategory === cat
                          ? "bg-[#00696a] text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Products Grid */}
                {loading ? (
                  <div className="py-16 text-center text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
                    <RefreshCw size={24} className="animate-spin text-teal-600" />
                    <span>Cargando productos y existencias...</span>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-xs font-bold border border-dashed border-slate-200 rounded-xl">
                    No se encontraron productos coincidentes
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 max-h-[580px] overflow-y-auto pr-1 scrollbar-thin">
                    {filteredProducts.map(prod => {
                      const isExempt = doesNotNeedStock(prod) || prod.is_external;
                      const isOutOfStock = !isExempt && prod.stock <= 0;

                      return (
                        <div
                          key={prod.id}
                          onClick={() => handleOpenProductModal(prod)}
                          className={cn(
                            "group border rounded-xl p-3 flex flex-col justify-between transition-all select-none relative bg-white cursor-pointer active:scale-98",
                            isOutOfStock 
                              ? "border-amber-200 hover:border-amber-400 hover:shadow-md" 
                              : "border-slate-200 hover:border-[#00696a] hover:shadow-md"
                          )}
                        >
                          <div>
                            {/* Product Image */}
                            <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden mb-2 relative">
                              <ProductImage 
                                src={prod.image} 
                                alt={prod.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                              />
                              {isOutOfStock && (
                                <div className="absolute top-2 left-2">
                                  <span className="bg-amber-600/90 backdrop-blur-xs text-white font-extrabold text-[8.5px] px-1.5 py-0.5 rounded uppercase tracking-wider shadow-xs">
                                    Por Arribar (0)
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Title & Category */}
                            <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">{prod.category || 'General'}</p>
                            <h3 className="font-bold text-slate-800 text-xs line-clamp-2 leading-tight mt-0.5" title={prod.name}>
                              {prod.name}
                            </h3>
                          </div>

                          {/* Price & Stock Badge */}
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                            <span className="font-extrabold text-[#00696a] text-xs">
                              {formatMoney(prod.price)}
                            </span>
                            {isExempt ? (
                              <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">Servicio</span>
                            ) : (
                              <span className={cn(
                                "text-[9px] font-extrabold px-1.5 py-0.5 rounded",
                                prod.stock > 10 ? "bg-emerald-50 text-emerald-700" :
                                prod.stock > 0 ? "bg-amber-50 text-amber-700" : "bg-amber-100 text-amber-900 border border-amber-300"
                              )}>
                                {prod.stock > 0 ? `${prod.stock} disp.` : '0 (Por arribar)'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Quotation Summary & Cart */}
            <div className="lg:col-span-4 sticky top-24 space-y-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col h-full">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <ShoppingCart size={18} className="text-[#00696a]" />
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Productos Cotizados ({cart.length})</h2>
                  </div>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setCart([])}
                      className="text-[11px] text-slate-400 hover:text-red-500 font-bold transition-colors cursor-pointer"
                    >
                      Vaciar
                    </button>
                  )}
                </div>

                {/* Items in Cart */}
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                    <FileSpreadsheet size={36} className="text-slate-200 stroke-[1.5]" />
                    <p className="font-bold">No hay productos en la cotización</p>
                    <p className="text-[11px] text-slate-400 max-w-[200px]">Selecciona productos del catálogo para armar la cotización formal.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin my-2">
                    {cart.map((item, index) => (
                      <div key={`${item.productId}-${item.variantId || 'base'}-${index}`} className="py-3 flex items-start justify-between gap-3 group">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-xs text-slate-800 truncate" title={item.productName}>
                            {item.productName}
                          </h4>
                          {(item.color || item.size) && (
                            <p className="text-[10px] text-slate-500 font-medium">
                              🎨 {item.color || ''} {item.size ? `· 📏 ${item.size}` : ''}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-[11px] text-slate-600 mt-1">
                            <span className="font-bold text-[#00696a]">Q{item.price.toFixed(2)}</span>
                            <span>&times;</span>
                            <div className="flex items-center bg-slate-100 rounded-md border border-slate-200">
                              <button
                                onClick={() => handleUpdateCartQty(index, -1)}
                                className="px-1.5 py-0.5 hover:bg-slate-200 text-slate-600 rounded-l cursor-pointer"
                              >
                                <Minus size={10} />
                              </button>
                              <span className="px-2 font-bold text-xs text-slate-800">{item.quantity}</span>
                              <button
                                onClick={() => handleUpdateCartQty(index, 1)}
                                className="px-1.5 py-0.5 hover:bg-slate-200 text-slate-600 rounded-r cursor-pointer"
                              >
                                <Plus size={10} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <span className="font-black text-xs text-slate-900">
                            Q{item.total.toFixed(2)}
                          </span>
                          <button
                            onClick={() => handleRemoveFromCart(index)}
                            className="text-slate-300 hover:text-red-500 transition-colors p-1 cursor-pointer"
                            title="Eliminar de cotización"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Form Controls: Validity, Advisor & Notes */}
                <div className="pt-3 border-t border-slate-100 space-y-3 mt-auto">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      👤 Asesor Comercial / Vendedor
                    </label>
                    <select
                      value={selectedAdvisorId}
                      onChange={(e) => setSelectedAdvisorId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#00696a] bg-white cursor-pointer"
                    >
                      {teamMembers.map((tm) => (
                        <option key={tm.id || tm.email} value={tm.email || tm.id}>
                          {tm.name} ({tm.role === 'admin' ? 'Administración' : 'Ventas'})
                        </option>
                      ))}
                      {teamMembers.length === 0 && (
                        <option value={user.email || user.id}>{user.name} (Actual)</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Vigencia de la Cotización
                    </label>
                    <select
                      value={validityDays}
                      onChange={(e) => setValidityDays(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-[#00696a]"
                    >
                      <option value={7}>7 días de validez</option>
                      <option value={15}>15 días de validez (Recomendado)</option>
                      <option value={30}>30 días de validez</option>
                      <option value={60}>60 días de validez</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                      Observaciones / Condiciones Especiales
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ej: Precios válidos por pago de contado o entrega en bodega..."
                      value={customNotes}
                      onChange={(e) => setCustomNotes(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#00696a] resize-none"
                    />
                  </div>

                  {/* Totals Box */}
                  <div className="bg-teal-50/80 border border-teal-200 rounded-xl p-3.5">
                    <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                      <span>Subtotal Productos:</span>
                      <span className="font-bold">Q{cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm font-black text-[#00696a] pt-1 border-t border-teal-200">
                      <span>TOTAL COTIZADO:</span>
                      <span className="text-base">Q{cartTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmitQuotation}
                    disabled={isSubmitting || cart.length === 0}
                    className={cn(
                      "w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer",
                      cart.length > 0 && !isSubmitting
                        ? "bg-[#00696a] hover:bg-[#004f50] text-white active:scale-98"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Generando Cotización...</span>
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet size={16} />
                        <span>Guardar y Emitir Cotización</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ================= HISTORIAL DE COTIZACIONES ================= */
          <div className="space-y-6">
            {/* KPI Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Total Cotizaciones</p>
                <h3 className="text-xl font-black text-slate-900 mt-1">{metrics.totalCount}</h3>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                <p className="text-[11px] font-bold text-amber-600 uppercase">Activas / Pendientes</p>
                <h3 className="text-xl font-black text-amber-600 mt-1">{metrics.pendingCount}</h3>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                <p className="text-[11px] font-bold text-teal-700 uppercase">Convertidas a Venta</p>
                <h3 className="text-xl font-black text-[#00696a] mt-1">{metrics.convertedCount}</h3>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Monto Total Cotizado</p>
                <h3 className="text-xl font-black text-slate-900 mt-1">Q{metrics.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, folio (COT-0001) o vendedor..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-2 rounded-xl text-xs outline-none focus:border-[#00696a]"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {[
                  { id: 'all', label: 'Todas' },
                  { id: 'pendiente', label: 'Pendientes' },
                  { id: 'aceptada', label: 'Aceptadas' },
                  { id: 'convertida', label: 'Convertidas' },
                  { id: 'rechazada', label: 'Rechazadas' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id as any)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                      statusFilter === tab.id
                        ? "bg-[#00696a] text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quotations List */}
            {historyLoading ? (
              <div className="py-16 text-center text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
                <RefreshCw size={24} className="animate-spin text-teal-600" />
                <span>Cargando historial de cotizaciones...</span>
              </div>
            ) : filteredQuotations.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-bold border border-dashed border-slate-200 rounded-2xl bg-white">
                No se encontraron cotizaciones con los filtros actuales
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredQuotations.map(quote => {
                  const isConverted = quote.status === 'convertida';
                  const isPending = quote.status === 'pendiente';
                  const isAccepted = quote.status === 'aceptada';
                  const dateStr = new Date(quote.date).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
                  const validUntilStr = quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

                  return (
                    <div
                      key={quote.id}
                      className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Header: Folio & Status Badge */}
                        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-sm text-[#00696a]">{quote.folio}</span>
                            <span className="text-[10px] text-slate-400 font-bold">&middot; {dateStr}</span>
                          </div>
                          <span className={cn(
                            "text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider",
                            isConverted ? "bg-purple-100 text-purple-800 border border-purple-200" :
                            isAccepted ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                            isPending ? "bg-amber-100 text-amber-800 border border-amber-200" :
                            "bg-slate-100 text-slate-600"
                          )}>
                            {quote.status}
                          </span>
                        </div>

                        {/* Client & Seller */}
                        <div className="mt-3">
                          <h3 className="font-black text-slate-900 text-sm leading-tight">{quote.client}</h3>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                            <span>Vendedor:</span>
                            <strong className="text-slate-700">{quote.sellerName || 'Asesor'}</strong>
                          </p>
                        </div>

                        {/* Items preview */}
                        <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs">
                          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                            {quote.items?.length || 0} Producto(s)
                          </div>
                          <div className="space-y-1 max-h-[80px] overflow-y-auto pr-1 scrollbar-thin">
                            {quote.items?.map((it, idx) => (
                              <div key={idx} className="flex justify-between text-slate-700 text-[11px]">
                                <span className="truncate pr-2">{it.quantity}x {it.productName}</span>
                                <span className="font-bold shrink-0">Q{it.total.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between items-center text-xs font-black text-[#00696a]">
                            <span>TOTAL:</span>
                            <span className="text-sm">Q{Number(quote.totalAmount || 0).toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Converted to Sale notice */}
                        {isConverted && (
                          <div className="mt-2.5 bg-purple-50 border border-purple-100 rounded-lg p-2 text-[11px] text-purple-800 font-bold flex items-center gap-1.5">
                            <CheckCircle2 size={14} className="text-purple-600 shrink-0" />
                            <span>Venta Formal #{quote.convertedInvoiceFolio || 'Generada'}</span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setPreviewQuotation(quote); setShowPreviewModal(true); }}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-[#00696a] text-slate-600 transition-all cursor-pointer"
                            title="Ver / Previsualizar"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(quote)}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-600 transition-all cursor-pointer"
                            title="Editar Asesor / Datos"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handlePrintQuotation(quote)}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-[#00696a] text-slate-600 transition-all cursor-pointer"
                            title="Imprimir"
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(quote)}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-[#00696a] text-slate-600 transition-all cursor-pointer"
                            title="Descargar PDF"
                          >
                            <Download size={15} />
                          </button>
                          <button
                            onClick={() => handleShareWhatsApp(quote)}
                            className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-all cursor-pointer"
                            title="Enviar por WhatsApp"
                          >
                            <MessageCircle size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteQuotation(quote)}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-all cursor-pointer"
                            title="Eliminar Cotización"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        {!isConverted && (
                          <button
                            onClick={() => handleConvertToSale(quote)}
                            className="bg-[#00696a] hover:bg-[#004f50] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                          >
                            <ShoppingCart size={13} />
                            <span>Convertir a Venta</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= MODAL DE SELECCIÓN DE PRODUCTO Y CANTIDAD ================= */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Agregar a la Cotización</h3>
                  <p className="text-xs text-slate-500">{selectedProduct.name}</p>
                </div>
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Variant selection */}
                {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Variante (Color / Medida)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedProduct.variants.map((v) => {
                        const vStock = Number(v.stock) || 0;
                        const isSelected = selectedVariantId === v.id;
                        const isAvail = vStock > 0;

                        return (
                          <button
                            key={v.id}
                            disabled={!isAvail}
                            onClick={() => {
                              setSelectedVariantId(v.id);
                              setSelectedColor(v.color || '');
                              setSelectedSize(v.size || '');
                              if (v.price) setModalPrice(String(v.price));
                              setModalError('');
                            }}
                            className={cn(
                              "p-2 rounded-xl text-left border text-xs transition-all cursor-pointer flex flex-col justify-between",
                              isSelected ? "border-[#00696a] bg-teal-50 text-[#00696a] font-bold" :
                              isAvail ? "border-slate-200 hover:border-slate-300 bg-white text-slate-700" :
                              "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed opacity-50"
                            )}
                          >
                            <span className="font-bold truncate">{v.color} {v.size ? `· ${v.size}` : ''}</span>
                            <span className="text-[10px] mt-1">{vStock > 0 ? `${vStock} disp.` : 'Agotado'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quantity & Price Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={modalQuantity}
                      onChange={(e) => { setModalQuantity(e.target.value); setModalError(''); }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-[#00696a]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Precio Unit. (Q)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={modalPrice}
                      onChange={(e) => { setModalPrice(e.target.value); setModalError(''); }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-[#00696a] outline-none focus:border-[#00696a]"
                    />
                  </div>
                </div>

                {/* Subtotal Preview */}
                <div className="bg-slate-50 rounded-xl p-3 flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold">Subtotal Estimado:</span>
                  <span className="font-black text-base text-[#00696a]">
                    Q{((parseFloat(modalQuantity) || 0) * (parseFloat(modalPrice) || 0)).toFixed(2)}
                  </span>
                </div>

                {/* Error Banner */}
                {modalError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddToCart}
                  className="flex-1 py-2.5 rounded-xl bg-[#00696a] hover:bg-[#004f50] text-white font-bold text-xs shadow-md cursor-pointer"
                >
                  Agregar a Cotización
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MODAL DE SELECCIÓN / CREACIÓN DE CLIENTES ================= */}
      <AnimatePresence>
        {showClientModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Asignar Cliente</h3>
                  <p className="text-xs text-slate-500">Selecciona o crea un cliente para la cotización formal</p>
                </div>
                <button
                  onClick={() => setShowClientModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-2">
                <button
                  onClick={() => setClientModalTab('search')}
                  className={cn(
                    "px-4 py-2 text-xs font-bold border-b-2 cursor-pointer transition-all",
                    clientModalTab === 'search'
                      ? "border-[#00696a] text-[#00696a]"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  )}
                >
                  Buscar Existente
                </button>
                <button
                  onClick={() => setClientModalTab('create')}
                  className={cn(
                    "px-4 py-2 text-xs font-bold border-b-2 cursor-pointer transition-all",
                    clientModalTab === 'create'
                      ? "border-[#00696a] text-[#00696a]"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  )}
                >
                  Nuevo Cliente Rápido
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 space-y-4">
                {clientModalTab === 'search' ? (
                  <>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, empresa o NIT..."
                        value={clientSearchQuery}
                        onChange={(e) => setClientSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 pl-9 pr-3 py-2.5 rounded-xl text-xs outline-none focus:border-[#00696a]"
                      />
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                      {clients
                        .filter(c => 
                          c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) ||
                          (c.companyName && c.companyName.toLowerCase().includes(clientSearchQuery.toLowerCase())) ||
                          (c.nit && c.nit.toLowerCase().includes(clientSearchQuery.toLowerCase()))
                        )
                        .slice(0, 30)
                        .map(c => (
                          <div
                            key={c.id}
                            onClick={() => handleSelectClient(c)}
                            className="p-3 rounded-xl border border-slate-100 hover:border-[#00696a] hover:bg-teal-50/40 transition-all cursor-pointer flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-xs text-slate-900">{c.name}</div>
                              {c.companyName && <div className="text-[11px] text-[#00696a] font-medium">{c.companyName}</div>}
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                NIT: {c.nit || 'CF'} {c.phone ? `· Tel: ${c.phone}` : ''}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-[#00696a]">Seleccionar &rarr;</span>
                          </div>
                        ))}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    {/* NIT with SAT Lookup */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">NIT / DPI</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Ej: 10482914-9 o CF"
                          value={newClientNit}
                          onChange={(e) => setNewClientNit(e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#00696a]"
                        />
                        <button
                          type="button"
                          onClick={consultarNitSAT}
                          disabled={consultandoNit || !newClientNit.trim()}
                          className="px-3 py-2 bg-slate-100 hover:bg-teal-50 text-[#00696a] font-bold text-xs rounded-xl border border-slate-200 flex items-center gap-1 cursor-pointer"
                        >
                          {consultandoNit ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                          <span>Consultar SAT</span>
                        </button>
                      </div>
                      {nitResultado && (
                        <p className={cn("text-[11px] mt-1 font-bold", nitResultado.ok ? "text-emerald-700" : "text-amber-700")}>
                          {nitResultado.texto}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo *</label>
                      <input
                        type="text"
                        placeholder="Nombre de la persona o contacto"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-[#00696a]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Empresa / Finca (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Nombre comercial o razón social"
                        value={newClientCompanyName}
                        onChange={(e) => setNewClientCompanyName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#00696a]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono</label>
                        <input
                          type="text"
                          placeholder="Número celular"
                          value={newClientPhone}
                          onChange={(e) => setNewClientPhone(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#00696a]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Dirección</label>
                        <input
                          type="text"
                          placeholder="Ubicación de entrega"
                          value={newClientAddress}
                          onChange={(e) => setNewClientAddress(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#00696a]"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCreateNewClient}
                      className="w-full py-2.5 bg-[#00696a] hover:bg-[#004f50] text-white font-bold text-xs rounded-xl shadow-xs mt-2 cursor-pointer"
                    >
                      Guardar y Asignar a la Cotización
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MODAL DE ÉXITO AL CREAR COTIZACIÓN ================= */}
      <AnimatePresence>
        {showSuccessModal && createdQuotation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden text-center p-6 space-y-4"
            >
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={36} className="stroke-[2.5]" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900">¡Cotización Emitida con Éxito!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Se ha generado formalmente el folio <strong className="text-[#00696a] font-mono">{createdQuotation.folio}</strong> para <strong className="text-slate-800">{createdQuotation.client}</strong>.
                </p>
                <div className="mt-3 bg-teal-50 border border-teal-200 rounded-xl p-2.5 text-xs font-black text-[#00696a]">
                  Total Cotizado: Q{Number(createdQuotation.totalAmount || 0).toFixed(2)}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => handlePrintQuotation(createdQuotation)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#00696a] hover:bg-[#004f50] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Printer size={16} />
                  <span>Imprimir Cotización</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleDownloadPdf(createdQuotation)}
                    className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download size={15} />
                    <span>Descargar PDF</span>
                  </button>
                  <button
                    onClick={() => handleShareWhatsApp(createdQuotation)}
                    className="py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <MessageCircle size={15} />
                    <span>WhatsApp</span>
                  </button>
                </div>

                <button
                  onClick={() => { setShowSuccessModal(false); setActiveTab('history'); }}
                  className="w-full py-2 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer"
                >
                  Ver en el Historial &rarr;
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MODAL DE PREVISUALIZACIÓN ================= */}
      <AnimatePresence>
        {showPreviewModal && previewQuotation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={18} className="text-[#00696a]" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    Vista Previa: {previewQuotation.folio} - {previewQuotation.client}
                  </h3>
                </div>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content iframe/HTML display */}
              <div className="p-6 overflow-y-auto flex-1 bg-white">
                <div 
                  className="border border-slate-200 rounded-xl p-4 shadow-inner"
                  dangerouslySetInnerHTML={{ __html: compileQuotationTemplate(previewQuotation, previewQuotation.sellerName || user.name) }} 
                />
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEditModal(previewQuotation)}
                    className="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Edit2 size={14} />
                    <span>Editar Asesor</span>
                  </button>
                  <button
                    onClick={() => handlePrintQuotation(previewQuotation)}
                    className="py-2 px-3 bg-[#00696a] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Printer size={14} />
                    <span>Imprimir</span>
                  </button>
                  <button
                    onClick={() => handleDownloadPdf(previewQuotation)}
                    className="py-2 px-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download size={14} />
                    <span>PDF</span>
                  </button>
                  <button
                    onClick={() => handleShareWhatsApp(previewQuotation)}
                    className="py-2 px-3 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <MessageCircle size={14} />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    onClick={() => handleDeleteQuotation(previewQuotation)}
                    className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>Eliminar</span>
                  </button>
                </div>

                {previewQuotation.status !== 'convertida' && (
                  <button
                    onClick={() => {
                      setShowPreviewModal(false);
                      handleConvertToSale(previewQuotation);
                    }}
                    className="py-2 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <ShoppingCart size={14} />
                    <span>Convertir a Venta Formal</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stock Warning Modal (Single non-blocking alert modal for 0 stock items) */}
      <AnimatePresence>
        {stockWarningModal?.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-amber-200 text-center space-y-4"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <AlertTriangle size={28} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Producto sin Stock Inmediato</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Has agregado <strong className="text-slate-900">"{stockWarningModal.productName}"</strong> a la cotización con 
                  <strong className="text-amber-700"> {stockWarningModal.requestedQty} unidad(es)</strong> (Stock en bodega actual: {stockWarningModal.currentStock}).
                </p>
                <div className="mt-3 bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-900 font-semibold text-left">
                  ℹ️ Se incluye en la cotización formal como pedido para próximo ingreso / arribo de mercadería. El inventario actual no se verá afectado.
                </div>
              </div>
              <button
                onClick={() => setStockWarningModal(null)}
                className="w-full py-3 bg-[#00696a] hover:bg-[#004f50] text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-98"
              >
                Entendido, Continuar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MODAL DE EDICIÓN DE COTIZACIÓN / ASESOR ================= */}
      <AnimatePresence>
        {showEditModal && editingQuote && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-slate-200"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-[#00696a]">
                    <Edit2 size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Editar Cotización {editingQuote.folio}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">Modifica el asesor responsable o los datos del cliente</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    👤 Asesor Comercial / Vendedor Responsable
                  </label>
                  <select
                    value={editAdvisorId}
                    onChange={(e) => setEditAdvisorId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#00696a] bg-white cursor-pointer"
                  >
                    {teamMembers.map((tm) => (
                      <option key={tm.id || tm.email} value={tm.email || tm.id}>
                        {tm.name} ({tm.role === 'admin' ? 'Administración' : 'Ventas'})
                      </option>
                    ))}
                    {teamMembers.length === 0 && (
                      <option value={user.email || user.id}>{user.name}</option>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Nombre del Cliente
                    </label>
                    <input
                      type="text"
                      value={editClient}
                      onChange={(e) => setEditClient(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#00696a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      NIT
                    </label>
                    <input
                      type="text"
                      value={editNit}
                      onChange={(e) => setEditNit(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#00696a]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#00696a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Vigencia (Días)
                    </label>
                    <select
                      value={editValidityDays}
                      onChange={(e) => setEditValidityDays(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#00696a]"
                    >
                      <option value={7}>7 días de validez</option>
                      <option value={15}>15 días de validez (Recomendado)</option>
                      <option value={30}>30 días de validez</option>
                      <option value={60}>60 días de validez</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-[#00696a]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Observaciones / Condiciones Especiales
                  </label>
                  <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#00696a] resize-none"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="px-5 py-2 text-xs font-black bg-[#00696a] hover:bg-[#004f50] text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingEdit ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Guardar Cambios</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
