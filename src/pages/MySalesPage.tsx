import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Invoice, Payment, User } from '../types';
import { Search, Upload, CheckCircle, FileText, ChevronDown, ChevronUp, Printer, Download, X, Edit2, Clock, TrendingUp, Receipt, Leaf, Sparkles, ArrowRight, MessageCircle, Layers, History, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DEFAULT_PRINT_TEMPLATE, compilePrintTemplate, printHtml, downloadHtmlAsPdf, cn, cleanObservations } from '../utils';
import { motion } from 'motion/react';
import { ShippingGuideModal } from '../components/ShippingGuideModal';
import { ImageModal } from '../components/ImageModal';

interface BillingPageProps {
  user: User;
  isMobile?: boolean;
}

export function MySalesPage({ user, isMobile }: BillingPageProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const getLocalDateStr = (d = new Date()) => {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  };
  const [filterDate, setFilterDate] = useState<string>(getLocalDateStr());
  const [showCancelledAndRejected, setShowCancelledAndRejected] = useState(false);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<Invoice | null>(null);
  const [invoicePayments, setInvoicePayments] = useState<Record<string, Payment[]>>({});
  const [dailyStats, setDailyStats] = useState<any>(null);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [shippingModalConfig, setShippingModalConfig] = useState<{ id: string } | null>(null);
  const [viewingImageConfig, setViewingImageConfig] = useState<{ url: string; scanClient?: string; scanDate?: string; trackingNumber?: string } | null>(null);

  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [groupBy, setGroupBy] = useState<'date' | 'client'>('date');
  const [printTemplate, setPrintTemplate] = useState<string>('');
  const [salesViewMode, setSalesViewMode] = useState<'global' | 'mine'>(user.role === 'admin' ? 'global' : 'mine');
  const [isViewModeModalOpen, setIsViewModeModalOpen] = useState(false);
  const [suggestEditInvoice, setSuggestEditInvoice] = useState<Invoice | null>(null);
  const [suggestEditText, setSuggestEditText] = useState('');
  const [isHistoryMode, setIsHistoryMode] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadInvoices();
    api.getUsers().then(setUsers).catch(console.error);
    
    api.getPrintTemplate().then(data => {
      setPrintTemplate(data.template || DEFAULT_PRINT_TEMPLATE);
    }).catch(err => {
      console.error(err);
      setPrintTemplate(DEFAULT_PRINT_TEMPLATE);
    });
  }, [salesViewMode]);

  useEffect(() => {
    api.getDailyStats(filterDate).then(setDailyStats).catch(console.error);
  }, [filterDate]);

  useEffect(() => {
    if (expandedInvoice && !invoicePayments[expandedInvoice]) {
      api.getInvoicePayments(expandedInvoice).then(data => {
        setInvoicePayments(prev => ({ ...prev, [expandedInvoice]: data }));
      }).catch(console.error);
    }
  }, [expandedInvoice]);

  useEffect(() => {
    const targetId = selectedInvoiceForModal?.id;
    if (targetId && !invoicePayments[targetId]) {
      api.getInvoicePayments(targetId).then(data => {
        setInvoicePayments(prev => ({ ...prev, [targetId]: data }));
      }).catch(console.error);
    }
  }, [selectedInvoiceForModal?.id]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      let sellerId: string | undefined = undefined;
      if (user.role !== 'admin' || salesViewMode === 'mine') {
        sellerId = user.email;
      } else {
        sellerId = undefined;
      }
      const data = await api.getInvoices(sellerId);
      setInvoices(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async (invoiceId: string, maxAmount: number) => {
    const amount = parseFloat(paymentAmount);
    if (!amount || isNaN(amount) || amount <= 0) return alert('Ingresa un monto válido.');
    if (amount > maxAmount) return alert(`El monto máximo abonable es Q${maxAmount}`);

    setIsPaying(true);
    try {
      const result = await api.addPayment(invoiceId, amount, paymentFile || undefined);
      setInvoicePayments(prev => ({
        ...prev,
        [invoiceId]: [...(prev[invoiceId] || []), result.payment]
      }));
      setPaymentAmount('');
      setPaymentFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      alert('Abono registrado correctamente');
      loadInvoices(); // Refresh
    } catch (error: any) {
      alert(`Error al registrar abono: ${error.message}`);
    } finally {
      setIsPaying(false);
    }
  };

  const handleAddPaymentAndRefresh = async (invoiceId: string, maxAmount: number) => {
    const amount = parseFloat(paymentAmount);
    if (!amount || isNaN(amount) || amount <= 0) return alert('Ingresa un monto válido.');
    if (amount > maxAmount) return alert(`El monto máximo abonable es Q${maxAmount}`);

    setIsPaying(true);
    try {
      const result = await api.addPayment(invoiceId, amount, paymentFile || undefined);
      setInvoicePayments(prev => ({
        ...prev,
        [invoiceId]: [...(prev[invoiceId] || []), result.payment]
      }));
      setPaymentAmount('');
      setPaymentFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      alert('Abono registrado correctamente');
      
      // Refresh stats
      const localDate = getLocalDateStr();
      api.getDailyStats(localDate).then(setDailyStats).catch(console.error);
      
      const refreshedInvoices = await api.getInvoices(user.email);
      setInvoices(Array.isArray(refreshedInvoices) ? refreshedInvoices : []);
      const updatedInvoice = (refreshedInvoices as Invoice[]).find(v => v.id === invoiceId);
      if (updatedInvoice) {
        setSelectedInvoiceForModal(updatedInvoice);
      }
    } catch (error: any) {
      alert(`Error al registrar abono: ${error.message}`);
    } finally {
      setIsPaying(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: Invoice['status'], predefinedGuide?: string, shippingGuideUrl?: string, clientName?: string, shippingDate?: string) => {
    let guideNumber: string | undefined = predefinedGuide;
    if (status === 'sent' && !predefinedGuide) {
      setShippingModalConfig({ id });
      return;
    }

    try {
      await api.updateInvoiceStatus(id, status, guideNumber, undefined, undefined, shippingGuideUrl, clientName, shippingDate);
      
      if (status === 'rejected') {
          const invoice = invoices.find(i => i.id === id);
          if (invoice) {
              const seller = users.find(u => u.id === invoice.sellerId || u.email === invoice.sellerId);
              if (seller?.phone) {
                  let cleanPhone = String(seller.phone).replace(/\D/g, "");
                  if (cleanPhone.length >= 8) {
                      if (cleanPhone.length === 8) cleanPhone = "502" + cleanPhone;
                      const message = `Hola *${seller.name}*, la factura *${invoice.id}* a nombre de *${invoice.client}* ha sido anulada o *RECHAZADA*. Por favor revisa el sistema.`;
                      fetch('/api/whatsapp/send', {
                          method: 'POST',
                          headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('app_token')}`
                          },
                          body: JSON.stringify({ 
                              phone: cleanPhone, 
                              message,
                              templateName: "pedido_rechazado",
                              templateVariables: [
                                  { name: "w_pedido", value: invoice.id },
                                  { name: "w_vendedor", value: seller.name },
                                  { name: "w_cliente", value: invoice.client }
                              ]
                          })
                      }).catch(() => {});
                  }
              }
          }
      }
      
      loadInvoices();
    } catch(err) {
      alert("Error al actualizar estado");
    }
  };

  const handleCancelInvoice = async (id: string) => {
    if (!window.confirm('¿Anular esta factura permanentemente? (Se mantendrá en el historial pero su saldo no contará)')) return;
    await handleUpdateStatus(id, 'cancelled');
  };

  const handleUpdateItemPrice = async (invoiceId: string, itemIdx: number, quantity: number, currentPriceStr: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (invoice?.status === 'sent') {
      return alert('No se puede editar el pedido porque ya ha sido catalogado como ENVIADO.');
    }
    const newPrice = parseFloat(prompt('Nuevo precio unitario (Q):', currentPriceStr) || '');
    if (isNaN(newPrice) || newPrice < 0) return;
    try {
      await api.updateInvoiceItemPrice(invoiceId, itemIdx, newPrice);
      loadInvoices();
    } catch(err) {
      alert("Error al actualizar el precio");
    }
  };

  const filteredInvoices = invoices.filter(i => {
    // Hide cancelled and rejected invoices if the option is false
    if (!showCancelledAndRejected && (i.status === 'cancelled' || i.status === 'rejected')) {
      return false;
    }

    const matchSearch = (i.client || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (i.sellerId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (String(i.folio || '')).toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchDate = true;
    if (isHistoryMode) {
      matchDate = true;
    } else if (i.date) {
      if (i.date.startsWith(filterDate)) {
        matchDate = true;
      } else {
        try {
          const d = new Date(i.date);
          const adjusted = new Date(d.getTime() - (6 * 60 * 60 * 1000));
          matchDate = adjusted.toISOString().split('T')[0] === filterDate;
        } catch {
          matchDate = false;
        }
      }
    } else {
      matchDate = false;
    }

    return matchSearch && matchDate;
  });

  const totalPending = filteredInvoices.reduce((acc, inv) => {
     if (inv.status === 'cancelled' || inv.status === 'rejected') return acc;
     return acc + (inv.totalAmount - (inv.paidAmount || 0));
  }, 0);

  const totalSalesDay = filteredInvoices.reduce((acc, inv) => {
     if (inv.status === 'cancelled' || inv.status === 'rejected') return acc;
     return acc + (inv.totalAmount || 0);
  }, 0);

  const totalPaymentsDay = filteredInvoices.reduce((acc, inv) => {
     if (inv.status === 'cancelled' || inv.status === 'rejected') return acc;
     return acc + (inv.paidAmount || 0);
  }, 0);

  const isGlobal = salesViewMode === 'global';

  // Get dynamic daily stats calculation from salesBySeller and paymentsBySeller object
  const globalTotalSales = dailyStats?.salesBySeller ? Object.values(dailyStats.salesBySeller).reduce((a, b) => Number(a) + Number(b), 0) : 0;
  const globalTotalPayments = dailyStats?.paymentsBySeller ? Object.values(dailyStats.paymentsBySeller).reduce((a, b) => Number(a) + Number(b), 0) : 0;

  const displayTotalSales = isGlobal ? globalTotalSales : (dailyStats?.salesBySeller?.[user.email] || 0);
  const displayTotalPayments = isGlobal ? globalTotalPayments : (dailyStats?.paymentsBySeller?.[user.email] || 0);

  function getSellerName(email: string) {
    const u = users.find(user => user.email === email);
    return u ? u.name : (email || '').split('@')[0];
  }

  // Grouping logic
  const renderInvoicesList = () => {
    if (groupBy === 'client') {
      const grouped: Record<string, Invoice[]> = {};
      filteredInvoices.forEach(inv => {
        const clientKey = inv.client || 'Desconocido';
        if (!grouped[clientKey]) grouped[clientKey] = [];
        grouped[clientKey].push(inv);
      });
      return Object.entries(grouped).map(([client, invs]) => {
        // Find if any invoice has phone number
        const invWithPhone = invs.find(i => Boolean(i.phone));
        const phone = invWithPhone?.phone || null;
        
        return (
        <div key={client} className="mb-8 p-4 bg-white border border-neutral-200 shadow-sm rounded-xl">
            <div className="mb-4 pb-2 border-b border-neutral-150">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 max-w-full">
                  <h2 className="text-base sm:text-lg font-bold text-neutral-800 tracking-tight break-words">
                    {client}
                  </h2>
                  {phone && (
                    <a 
                      href={`tel:${phone.replace(/\D/g, '')}`} 
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-600 bg-neutral-100 px-3 py-1 rounded-full hover:bg-neutral-200 transition-colors whitespace-nowrap"
                    >
                      📞 Llamar ({phone})
                    </a>
                  )}
                </div>
                <div className="self-start sm:self-center shrink-0">
                  <span className="inline-block text-sm font-medium text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-200 shadow-sm whitespace-nowrap">
                    Q{invs.reduce((sum, inv) => inv.status !== 'cancelled' ? sum + (inv.totalAmount - inv.paidAmount) : sum, 0).toFixed(2)} Deuda Total
                  </span>
                </div>
              </div>
            </div>
          <div className="space-y-4">
            {invs.map(renderInvoice)}
          </div>
        </div>
        );
      });
    } else {
       const todayStr = new Date().toDateString();
       
       const activeInvoices = filteredInvoices.filter(i => 
           i.status === 'pending' || i.status === 'paid'
       );
       
       // Sort descending by date
       activeInvoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
       
       let historyInvoices = filteredInvoices.filter(i => 
           i.status === 'sent' || i.status === 'cancelled' || i.status === 'rejected'
       );
       historyInvoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

       return (
         <div className="space-y-10">
           {/* Section 1: Ventas del Día Seleccionado */}
           <div>
             <h2 className="text-xl font-bold text-neutral-800 mb-4 pb-2 border-b-2 border-neutral-100 flex items-center gap-2 relative">
               Ventas del Día
               <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full z-10 ml-auto">{activeInvoices.length}</span>
                <span className="absolute left-0 bg-white pr-2 text-xl font-bold text-neutral-800 pointer-events-none">{isHistoryMode ? 'Ventas en Historial (Pendientes / Cobradas)' : 'Ventas del Día'}</span>
             </h2>
             {activeInvoices.length > 0 ? (
               <div className="space-y-4">
                 {activeInvoices.map(renderInvoice)}
               </div>
             ) : (
               <p className="text-sm text-neutral-500 italic px-4">{isHistoryMode ? 'No hay ventas activas en el historial para esta búsqueda.' : 'No hay ventas registradas en esta fecha o todas fueron enviadas.'}</p>
             )}
           </div>
           
           {/* Section 3: Historial / Enviadas */}
           <div className="mt-12 pt-8 border-t-4 border-neutral-100 pb-10">
             <h2 className="text-lg font-bold text-neutral-500 mb-4 flex items-center gap-2 relative">
               Historial (Enviadas, Rechazadas, Anuladas)
               <span className="text-xs font-semibold bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded-full z-10 ml-auto">{historyInvoices.length}</span>
                <span className="absolute left-0 bg-white pr-2 text-lg font-bold text-neutral-500 pointer-events-none">{isHistoryMode ? 'Historial Completo (Enviadas, Rechazadas, Anuladas)' : 'Historial (Enviadas, Rechazadas, Anuladas)'}</span>
             </h2>
             {historyInvoices.length > 0 ? (
               <div className="space-y-4 opacity-80">
                 {historyInvoices.slice(0, 30).map(renderInvoice)}
                 {historyInvoices.length > 30 && <p className="text-xs text-center mt-4 text-neutral-400">Mostrando las últimas 30...</p>}
               </div>
             ) : (
               <p className="text-sm text-neutral-400 italic px-4">Historial vacío.</p>
             )}
           </div>
         </div>
       );
    }
  };

  const printInvoice = (invoice: Invoice) => {
    const sellerObj = users.find(u => u.id === invoice.sellerId || u.email === invoice.sellerId);
    const sellerName = sellerObj ? sellerObj.name : (invoice.sellerId || 'Desconocido').split('@')[0];

    const htmlContent = compilePrintTemplate(printTemplate, invoice, sellerName);
    printHtml(htmlContent);
  };

  const downloadInvoicePdf = (invoice: Invoice) => {
    const sellerObj = users.find(u => u.id === invoice.sellerId || u.email === invoice.sellerId);
    const sellerName = sellerObj ? sellerObj.name : (invoice.sellerId || 'Desconocido').split('@')[0];

    const htmlContent = compilePrintTemplate(printTemplate, invoice, sellerName);
    downloadHtmlAsPdf(htmlContent, `factura-${invoice.folio || invoice.id}.pdf`);
  };

  const renderInvoice = (invoice: Invoice) => {
    const pending = invoice.totalAmount - invoice.paidAmount;
    const isExpanded = expandedInvoice === invoice.id;
    const isCancelled = invoice.status === 'cancelled';
    const isPaid = invoice.status === 'paid';
    const needsAuth = invoice.authStatus === 'pending';
    const isRejected = invoice.authStatus === 'rejected';

    const isEdited = false;
    const isActuallyEdited = (invoice as any).isEdited === true;

    const cardMotionProps = isMobile ? {
      initial: { opacity: 1, y: 0, scale: 1 },
      animate: { opacity: 1, y: 0, scale: 1 },
      transition: { duration: 0.1 }
    } : {
      initial: { opacity: 0, y: 30, scale: 0.98 },
      whileInView: { opacity: 1, y: 0, scale: 1 },
      viewport: { once: true, margin: "-20px" },
      transition: { duration: 0.55 },
      whileHover: { y: -4, boxShadow: "0 15px 30px rgba(11, 77, 44, 0.05)", borderColor: "rgba(11, 77, 44, 0.15)" }
    };

    return (
      <motion.div key={invoice.id} {...cardMotionProps} className={`border ${isCancelled ? 'border-red-200 opacity-60' : isRejected ? 'border-red-300 bg-red-50/10' : needsAuth ? 'border-red-400 bg-red-50/20' : isEdited ? 'border-orange-300 shadow-[0_0_10px_rgba(249,115,22,0.2)]' : 'border-slate-200/80'} rounded-3xl overflow-hidden relative bg-white shadow-sm transition-all duration-300`}>
        {isEdited && (
           <div className="absolute top-0 right-0 left-0 bg-gradient-to-r from-orange-400 to-amber-500 text-white text-[10px] uppercase tracking-widest font-black text-center py-0.5">
             Venta Editada
           </div>
        )}
        {needsAuth && (
          <div className="absolute top-0 right-0 left-0 bg-red-500 text-white text-[10px] uppercase tracking-widest font-black text-center py-0.5">
            Autorización Pendiente
          </div>
        )}
        {isRejected && (
          <div className="absolute top-0 right-0 left-0 bg-red-600 text-white text-[10px] uppercase tracking-widest font-black text-center py-0.5">
            Factura Rechazada (No Autorizada)
          </div>
        )}
        
        {/* Header */}
        <div 
          className={`p-4 flex flex-wrap items-center justify-between cursor-pointer hover:bg-neutral-100 transition-colors ${(needsAuth || isRejected) ? 'mt-3 bg-red-50/40' : isCancelled ? 'bg-red-50' : 'bg-neutral-50'}`}
          onClick={() => setSelectedInvoiceForModal(invoice)}
        >
          <div className="flex items-center gap-4 min-w-[200px]">
            <div className={`p-2 rounded-lg ${isCancelled ? 'bg-red-50 text-red-700 font-bold border border-red-100' : isPaid ? 'bg-teal-50 text-teal-700 font-bold border border-teal-100' : isRejected ? 'bg-red-50 text-red-600 border border-red-200' : needsAuth ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-orange-50 text-orange-700 font-bold border border-orange-100'}`}>
              <FileText size={24} />
            </div>
            <div>
              <h3 className={`font-bold ${isCancelled ? 'text-red-800 line-through' : 'text-neutral-800'}`}>{invoice.client}</h3>
              <p className="text-xs text-neutral-500 font-mono">{invoice.id} • {format(new Date(invoice.date), "dd MMM yyyy, HH:mm", { locale: es })}</p>
            </div>
          </div>

          <div className="flex items-center gap-8 mt-4 sm:mt-0">
            <div className="text-right hidden md:block">
              <p className="text-xs text-neutral-500">Vendedor</p>
              <p className="text-sm font-medium">{(invoice.sellerId || 'Desconocido').split('@')[0]}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-500">Total Factura</p>
              <p className={`text-sm font-bold ${isCancelled && 'line-through'}`}>Q{invoice.totalAmount.toFixed(2)}</p>
            </div>
            <div className="text-right w-28 flex flex-col items-end gap-1">
              <p className="text-xs text-neutral-500">Estado</p>
              {invoice.status === 'cancelled' || invoice.status === 'rejected' || isRejected ? (
                <span className="text-red-600 text-sm font-bold bg-red-50 px-2 py-0.5 rounded-md">{isRejected ? 'Rechazada' : invoice.status === 'rejected' ? 'Rechazada' : 'Anulada'}</span>
              ) : invoice.status === 'sent' ? (
                <div className="flex flex-col items-end gap-0.5">
                  <span className="inline-flex items-center gap-1 text-blue-600 text-sm font-bold bg-blue-50 px-2 py-0.5 rounded-md">Enviada</span>
                  {invoice.trackingNumber && (
                    invoice.shippingGuideUrl ? (
                      <button onClick={e => { e.stopPropagation(); setViewingImageConfig({ url: invoice.shippingGuideUrl!, scanClient: invoice.scanClient, scanDate: invoice.scanDate, trackingNumber: invoice.trackingNumber }); }} className="text-[10px] text-blue-500 font-bold underline hover:text-blue-700">Guía: {invoice.trackingNumber}</button>
                    ) : (
                      <span className="text-[10px] text-blue-500 font-bold">Guía: {invoice.trackingNumber}</span>
                    )
                  )}
                  {invoice.deliveryLetterUrl && <a href={invoice.deliveryLetterUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] text-blue-500 font-bold underline hover:text-blue-700">Carta Entregada</a>}
                </div>
              ) : invoice.status === 'paid' ? (
                <div className="flex flex-col items-end gap-0.5">
                  <span className="inline-flex items-center gap-1 text-green-600 text-sm font-bold bg-green-50 px-2 py-0.5 rounded-md"><CheckCircle size={14}/> Pagado</span>
                  {invoice.trackingNumber && (
                    invoice.shippingGuideUrl ? (
                      <button onClick={e => { e.stopPropagation(); setViewingImageConfig({ url: invoice.shippingGuideUrl!, scanClient: invoice.scanClient, scanDate: invoice.scanDate, trackingNumber: invoice.trackingNumber }); }} className="text-[10px] text-blue-500 font-bold underline hover:text-blue-700">Guía: {invoice.trackingNumber}</button>
                    ) : (
                      <span className="text-[10px] text-blue-500 font-bold">Guía: {invoice.trackingNumber}</span>
                    )
                  )}
                  {invoice.deliveryLetterUrl && <a href={invoice.deliveryLetterUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] text-blue-500 font-bold underline hover:text-blue-700">Carta Entregada</a>}
                </div>
              ) : needsAuth ? (
                <span className="text-red-600 text-[11px] uppercase tracking-wider font-bold bg-red-100 border border-red-200 px-1.5 py-0.5 rounded shadow-sm">Review Auth</span>
              ) : (
                <span className="text-orange-600 text-sm font-bold bg-orange-50 px-2 py-0.5 rounded-md">Pendiente</span>
              )}
              {invoice.status === 'pending' && (
                 <span className={`text-[10px] font-bold tracking-tight px-1.5 py-0.5 rounded flex items-center justify-center gap-1 ${
                   (() => {
                      const days = Math.floor((Date.now() - new Date(invoice.date).getTime()) / (1000 * 60 * 60 * 24));
                      const limit = invoice.creditDays || 30;
                      if (days <= limit) return 'bg-green-100 text-green-700';
                      if (days <= limit + 15) return 'bg-orange-100 text-orange-700';
                      return 'bg-red-600 text-white animate-pulse shadow-md';
                   })()
                 }`}>
                   {(() => {
                      const days = Math.floor((Date.now() - new Date(invoice.date).getTime()) / (1000 * 60 * 60 * 24));
                      const limit = invoice.creditDays || 30;
                      const text = `${days} días activo / Límite: ${limit} días`;
                      if (days > limit + 15) return text + ' - REQUERIMIENTO DE PAGO';
                      return text;
                   })()}
                 </span>
              )}
            </div>
            <div className="text-neutral-400">
              {isExpanded ? <ChevronUp /> : <ChevronDown />}
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="p-6 bg-white border-t border-neutral-200 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">Detalle Cliente & Productos</h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadInvoicePdf(invoice)}
                    className="flex items-center gap-1 text-xs font-bold bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg hover:bg-emerald-600 transition"
                  >
                    <Download size={14} /> PDF
                  </button>
                  { user.role === 'admin' && invoice.status !== 'sent' ? (
                    <button
                      onClick={() => {
                          localStorage.setItem('edit_invoice', JSON.stringify(invoice));
                          window.location.hash = 'sales';
                      }}
                      className="flex items-center gap-1 text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1.5 rounded-lg hover:bg-orange-200 transition"
                    >
                      Editar Venta
                    </button>
                  ) : invoice.status !== 'sent' && (
                    <button
                      onClick={() => {
                          setSuggestEditInvoice(invoice);
                      }}
                      className="flex items-center gap-1 text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1.5 rounded-lg hover:bg-orange-200 transition cursor-pointer"
                      title="Sugerir edición a administrador"
                    >
                      <Edit2 size={14} /> Sugerir Edición
                    </button>
                  )}
                  {user.role === 'admin' ? (
                    <>
                      <select 
                          value={invoice.status} 
                          onChange={(e) => handleUpdateStatus(invoice.id, e.target.value as any)}
                          className="text-xs bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-lg px-2 py-1 outline-none"
                      >
                          <option value="pending">Pendiente</option>
                          <option value="paid">Completada</option>
                          <option value="rejected">Rechazada</option>
                      </select>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="mb-4 text-xs text-neutral-600 grid grid-cols-2 gap-2 bg-neutral-50 p-3 rounded-lg">
                <p><span className="font-semibold text-neutral-400">NIT:</span> {invoice.nit || 'N/A'}</p>
                <p><span className="font-semibold text-neutral-400">Tel:</span> {invoice.phone || 'N/A'}</p>
                <p className="col-span-2"><span className="font-semibold text-neutral-400">Dirección:</span> {invoice.address || 'N/A'}</p>
              </div>

              {needsAuth && user.role === 'admin' && (!isActuallyEdited || user?.email === 'seseffff942@gmail.com') && (
                 <div className="mb-4 p-4 border border-red-200 bg-red-50 rounded-xl">
                   <h5 className="text-sm font-bold text-red-800 mb-2">Requiere Autorización</h5>
                   <p className="text-xs text-red-700 mb-3">Esta factura contiene productos vendidos por debajo del precio base. ¿Autorizas este precio especial por única vez?</p>
                   <div className="flex gap-3">
                      <button 
                          onClick={async () => {
                             try {
                                await api.updateInvoiceAuth(invoice.id, 'authorized');
                                alert("Venta autorizada correctamente.");
                                loadInvoices();
                             } catch (err: any) {
                                alert("Error al autorizar: " + err.message);
                             }
                          }}
                          className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                         Autorizar
                      </button>
                      <button 
                          onClick={async () => {
                              try {
                                await api.updateInvoiceAuth(invoice.id, 'rejected');
                                await api.updateInvoiceStatus(invoice.id, 'rejected');
                                alert("Venta rechazada correctamente.");
                                loadInvoices();
                              } catch (err: any) {
                                alert("Error general rechazando: " + err.message);
                              }
                           }}
                          className="px-4 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded-lg transition-colors border border-red-200"
                      >
                         Rechazar
                      </button>
                   </div>
                 </div>
              )}
              
              <ul className="space-y-3">
                {invoice.items.map((item, idx) => (
                  <li key={idx} className="flex justify-between items-center text-sm border-b border-neutral-50 pb-2">
                    <span className="text-neutral-600">
                      <span className="font-medium">{item.quantity}x</span> <span className="notranslate" translate="no">{item.productName}</span>
                      {item.color && item.size && (
                        <span className="block mt-1">
                          <span className="inline-block px-1.5 py-0.5 bg-yellow-100/80 text-yellow-800 border border-yellow-200 text-[10px] font-black uppercase tracking-wider rounded-md">
                            {item.color} - {item.size}
                          </span>
                        </span>
                      )}
                      {(item as any).isStockAlert ? (
                         <span className="block text-[10px] text-orange-600 mt-0.5 font-bold uppercase">
                            ⚠️ Alerta de Inventario: Stock Insuficiente
                         </span>
                      ) : null}
                      {((item.originalPrice && item.price < item.originalPrice && !(item as any).isOfferApplied) || (item as any).isPriceAlert) ? (
                         <span className="block text-[10px] text-red-600 mt-0.5 font-bold uppercase">
                            ⚠️ Alerta de Precio Bajo: {(item as any).isOfferApplied ? 'Unidad en oferta debajo de costo base' : `Q${item.price.toFixed(2)} (Base: Q${item.originalPrice.toFixed(2)})`}
                         </span>
                      ) : null}
                      {(item as any).suggestedPrice ? <span className="block text-[10px] text-orange-500 mt-0.5">Precio Sugerido: Q{(item as any).suggestedPrice.toFixed(2)}</span> : null}
                      {(item as any).isOfferApplied ? <span className="block text-[10px] text-green-600 mt-0.5 font-bold">Oferta Aplicada</span> : null}
                    </span>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`font-medium ${isCancelled ? 'text-neutral-400 line-through' : 'text-neutral-800'}`}>Q{item.total.toFixed(2)}</span>
                      {!isCancelled && invoice.status === 'pending' && user.role === 'admin' && (
                        <button 
                          onClick={() => handleUpdateItemPrice(invoice.id, idx, item.quantity, (item.total / item.quantity).toFixed(2))}
                          className="text-[10px] text-blue-500 hover:text-blue-700 underline font-medium"
                        >
                           Modificar P.U.
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              {isCancelled ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-red-600 bg-red-50 rounded-xl border border-red-100 p-6">
                  <FileText size={48} className="mb-2 opacity-50" />
                  <p className="font-bold text-lg">Factura Anulada</p>
                  <p className="text-sm text-red-700/80 mt-1">Este documento ya no posee validez.</p>
                </div>
              ) : isRejected ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-red-600 bg-red-50/80 rounded-xl border border-red-200 p-6">
                  <FileText size={48} className="mb-3 opacity-80" />
                  <p className="font-black text-xl mb-1">FACTURA RECHAZADA</p>
                  <p className="text-sm text-red-800 font-medium mb-4">La factura fue rechazada por inventario insuficiente o precio de venta no autorizado.</p>
                  <div className="flex flex-col w-full gap-2">
                    {(() => {
                        const message = `Hola *${invoice.client}*, lamentablemente tu compra ha sido rechazada debido a falta de existencias en el inventario o diferencias de precio. Nos comunicaremos contigo a la brevedad para ofrecerte una solución.`;
                        const targetPhone = invoice.phone;
                        let cleanPhone = targetPhone ? String(targetPhone).replace(/\D/g, "") : "";
                        if (cleanPhone.length >= 8) {
                            if (cleanPhone.length === 8) cleanPhone = "502" + cleanPhone;
                            return (
                                <button 
                                  onClick={async () => {
                                      try {
                                        const res = await fetch('/api/whatsapp/send', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('app_token')}` },
                                            body: JSON.stringify({ 
                                                phone: cleanPhone, 
                                                message,
                                                templateName: "pedido_rechazado",
                                                templateVariables: [
                                                    { name: "w_pedido", value: invoice.id },
                                                    { name: "w_vendedor", value: "Ventas" },
                                                    { name: "w_cliente", value: invoice.client }
                                                ]
                                            })
                                        });
                                        const data = await res.json();
                                        if(!res.ok) throw new Error(data.details || data.error || "Error enviando WhatsApp");
                                        if(data.mock) {
                                            alert(data.error || data.message || "Aviso simulación WS");
                                            return;
                                        }
                                        alert("Aviso enviado con éxito al cliente.");
                                      } catch(e: any) { alert(`Error al enviar mensaje: ${e.message}`); }
                                  }}
                                  className="flex justify-center items-center gap-2 w-full py-2.5 bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold rounded-xl shadow-lg transition-all text-sm"
                                >
                                   Notificar al Cliente WhatsApp
                                </button>
                            );
                        } else {
                            return (
                                <button 
                                  onClick={() => alert(`No se pudo enviar el aviso porque el cliente no tiene un número registrado válido.`)}
                                  className="flex justify-center items-center gap-2 w-full py-2.5 bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold rounded-xl shadow-lg transition-all text-sm opacity-60"
                                >
                                   Notificar al Cliente WhatsApp
                                </button>
                            );
                        }
                    })()}
                    {(() => {
                        const seller = users.find(u => u.id === invoice.sellerId || u.email === invoice.sellerId);
                        const sellerName = seller ? seller.name : 'Vendedor';
                        const message = `Hola *${sellerName}*, la factura *${invoice.id}* a nombre de *${invoice.client}* ha sido *RECHAZADA* porque contiene precios por debajo del límite permitido o venta sin existencias. Por favor, comunícate con un administrador o ajusta la factura.`;
                        const targetPhone = seller?.phone;
                        let cleanPhone = targetPhone ? String(targetPhone).replace(/\D/g, "") : "";
                        if (cleanPhone.length >= 8) {
                            if (cleanPhone.length === 8) cleanPhone = "502" + cleanPhone;
                            return (
                                <button 
                                  onClick={async () => {
                                      try {
                                        const res = await fetch('/api/whatsapp/send', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('app_token')}` },
                                            body: JSON.stringify({ 
                                                phone: cleanPhone, 
                                                message,
                                                templateName: "pedido_rechazado",
                                                templateVariables: [
                                                    { name: "w_pedido", value: invoice.id },
                                                    { name: "w_vendedor", value: sellerName },
                                                    { name: "w_cliente", value: invoice.client }
                                                ]
                                            })
                                        });
                                        const data = await res.json();
                                        if(!res.ok) throw new Error(data.details || data.error || "Error enviando WhatsApp");
                                        if(data.mock) {
                                            alert(data.error || data.message || "Aviso simulación WS");
                                            return;
                                        }
                                        alert(`Aviso enviado con éxito a ${sellerName}.`);
                                      } catch(e: any) { alert(`Error al enviar mensaje: ${e.message}`); }
                                  }}
                                  className="flex justify-center items-center gap-2 w-full py-2.5 bg-neutral-800 hover:bg-neutral-900 text-white font-bold rounded-xl shadow-lg transition-all text-sm"
                                >
                                   Notificar al Vendedor WhatsApp
                                </button>
                            );
                        } else {
                            return (
                                <button 
                                  onClick={() => alert(`No se pudo enviar el aviso porque el vendedor (${sellerName}) no tiene un número de WhatsApp válido registrado. Por favor, edita su perfil desde la sección "Equipo".`)}
                                  className="flex justify-center items-center gap-2 w-full py-2.5 bg-neutral-800 hover:bg-neutral-900 text-white font-bold rounded-xl shadow-lg transition-all text-sm opacity-60"
                                >
                                   Notificar al Vendedor WhatsApp
                                </button>
                            );
                        }
                    })()}
                  </div>
                </div>
              ) : (invoice.status === 'pending' || invoice.status === 'sent') ? (
                <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-200">
                  <h4 className="text-sm font-bold text-neutral-800 uppercase tracking-wide mb-4">Registrar Abono</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 mb-1">Monto (Q)</label>
                      <input 
                        type="number" 
                        max={pending}
                        value={paymentAmount}
                        onChange={e => setPaymentAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg outline-none focus:border-green-500"
                        placeholder={`Max: Q${pending.toFixed(2)}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 mb-1">Boleta de Depósito (Foto)</label>
                      <div className="border-2 border-dashed border-neutral-300 rounded-lg px-4 py-3 flex items-center justify-center bg-white cursor-pointer hover:bg-neutral-50 transition-colors">
                        <input 
                          type="file" 
                          ref={fileInputRef}
                          onChange={e => setPaymentFile(e.target.files?.[0] || null)}
                          className="hidden" 
                          id={`file-${invoice.id}`}
                          accept="image/*"
                        />
                        <label htmlFor={`file-${invoice.id}`} className="cursor-pointer flex items-center gap-2 text-sm text-neutral-600">
                          <Upload size={16} /> {paymentFile ? paymentFile.name : 'Subir Imagen de Boleta'}
                        </label>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleAddPayment(invoice.id, pending)}
                      disabled={isPaying || !paymentAmount}
                      className="w-full py-3 bg-gradient-to-r from-teal-400 to-emerald-500 hover:from-teal-500 hover:to-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50 transform hover:-translate-y-0.5"
                    >
                      {isPaying ? 'Procesando...' : 'Aplicar Abono a la Cuenta'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-teal-700 bg-teal-50 rounded-[2rem] border border-teal-100 p-8 shadow-inner">
                  <CheckCircle size={48} className="mb-2 opacity-50" />
                  <p className="font-bold text-lg">Factura Cancelada</p>
                  <p className="text-sm text-green-700/80 mt-1">No hay saldo pendiente.</p>
                </div>
              )}
            </div>

            {/* Payments History (Abonos) */}
            <div className="md:col-span-2 border-t border-neutral-100 pt-6 mt-2">
              <h4 className="text-sm font-bold text-neutral-800 uppercase tracking-wide mb-4">Historial de Abonos Registrados</h4>
              {invoicePayments[invoice.id] && invoicePayments[invoice.id].length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-neutral-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-xs tracking-wider uppercase">Fecha</th>
                        <th className="px-4 py-3 font-semibold text-xs tracking-wider uppercase">Monto Abonado</th>
                        <th className="px-4 py-3 font-semibold text-xs tracking-wider uppercase">Comprobante</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {invoicePayments[invoice.id].map(payment => (
                        <tr key={payment.id} className="hover:bg-neutral-50/50 transition-colors">
                          <td className="px-4 py-3 text-neutral-600 font-medium">
                            {payment.date ? format(new Date(payment.date), "dd MMM yyyy, HH:mm", { locale: es }) : 'N/A'}
                          </td>
                          <td className="px-4 py-3 font-bold text-emerald-600 text-base">
                            Q{payment.amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 flex gap-2">
                            {payment.receiptUrl ? (
                              <>
                                <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors">
                                  <FileText size={14} /> Ver
                                </a>
                                <a href={payment.receiptUrl} download={`boleta_${payment.id}.jpg`} className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors">
                                  <Download size={14} /> Descargar
                                </a>
                              </>
                            ) : (
                              <span className="text-neutral-400 text-xs italic px-3 py-1 bg-neutral-50 rounded-lg border border-neutral-100">Sin comprobante</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-neutral-500 bg-neutral-50 rounded-xl p-4 border border-neutral-200 text-center">
                  Cargando o no hay abonos registrados para esta cuenta.
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    );
  };


  return (
    <div className={`max-w-7xl mx-auto ${isMobile ? 'p-4' : 'p-8'}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-neutral-800">{user.role === 'admin' ? 'Facturación & Créditos' : 'Mis Ventas'}</h1>
          <p className="text-neutral-500">{user.role === 'admin' ? 'Gestión de cuentas por cobrar y abonos' : 'Ventas del día y pendientes'}</p>
        </div>
        
        <div className="flex flex-wrap items-center justify-end gap-3 w-full md:w-auto">
          {user.role === 'admin' && (
            <button
              onClick={() => setIsViewModeModalOpen(true)}
              className="w-full md:w-auto flex items-center justify-center gap-2 bg-white border border-slate-200 px-4 py-3 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-sm transition-all"
            >
              <Layers size={14} className="text-teal-600" />
              Vista: {salesViewMode === 'global' ? 'Global' : 'Mis Ventas'}
            </button>
          )}

          <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-neutral-100 flex flex-col items-end">
            <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
              {salesViewMode === 'global' ? 'Ventas Filtradas' : 'Mis Ventas'}
            </span>
            <span className="text-xl font-black text-slate-800 leading-tight">Q{totalSalesDay.toFixed(2)}</span>
          </div>

          <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-neutral-100 flex flex-col items-end">
            <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Cartera Pendiente</span>
            <span className="text-xl font-black text-orange-600 leading-tight">Q{totalPending.toFixed(2)}</span>
          </div>

          <div 
             onClick={() => setShowSalesModal(true)}
             className="bg-teal-50 border border-teal-100 rounded-xl px-4 py-3 flex flex-col items-end cursor-pointer hover:bg-teal-100 transition-colors shadow-sm ml-auto"
          >
            <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest flex items-center gap-1">
              <TrendingUp size={12} /> {isGlobal ? 'Total General' : 'Mis Ventas'}
            </span>
            <span className="text-xl font-black text-teal-700 leading-tight">Q{Number(displayTotalSales).toFixed(2)}</span>
          </div>
          
          <div 
             onClick={() => setShowPaymentsModal(true)}
             className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex flex-col items-end cursor-pointer hover:bg-blue-100 transition-colors shadow-sm"
          >
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1">
              <Receipt size={12} /> {isGlobal ? 'Cobrado General' : 'Mis Cobros'}
            </span>
            <span className="text-xl font-black text-blue-700 leading-tight">Q{Number(displayTotalPayments).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por cliente, vendedor o No. Factura..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
          
          <div className="flex flex-wrap gap-2 shrink-0 items-center">
            {/* Botón de Historial Completo */}
            <button
              onClick={() => setIsHistoryMode(!isHistoryMode)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all shadow-sm cursor-pointer select-none ${
                isHistoryMode
                  ? 'bg-purple-600 border-purple-600 text-white hover:bg-purple-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title="Buscar en todo el historial sin límite de fecha"
            >
              <History size={14} className={isHistoryMode ? 'text-white' : 'text-purple-600'} />
              <span>{isHistoryMode ? 'Ver por Fecha' : 'Ver Historial Completo'}</span>
            </button>

            {!isHistoryMode ? (
              <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 px-3 py-1.5 rounded-xl transition-all shadow-xs shrink-0">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fecha:</span>
                <input 
                  type="date" 
                  value={filterDate}
                  onChange={(e) => {
                    if (e.target.value) setFilterDate(e.target.value);
                  }}
                  className="text-[12px] font-black text-slate-800 bg-transparent outline-none cursor-pointer"
                />
                <button 
                  onClick={() => setFilterDate(getLocalDateStr())}
                  className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer ml-1"
                >
                  Hoy
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsHistoryMode(false)}
                className="flex items-center gap-1.5 bg-purple-100 hover:bg-purple-200 border border-purple-200 px-3 py-1.5 rounded-xl shrink-0 text-purple-800 text-xs font-bold shadow-xs cursor-pointer select-none transition-colors"
                title="Hacer clic para volver a filtrar por fecha"
              >
                <span>🗓️ Todo el Historial</span>
                <span className="text-[9px] bg-purple-300 text-purple-900 px-1 py-0.2 rounded ml-1 font-black">X</span>
              </button>
            )}

            <label className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 bg-slate-50/50 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors text-xs font-bold text-slate-600 select-none">
              <input
                type="checkbox"
                checked={showCancelledAndRejected}
                onChange={(e) => setShowCancelledAndRejected(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
              />
              Mostrar Anuladas/Rechazadas
            </label>

            <div className="flex border border-neutral-200 rounded-lg overflow-hidden shrink-0">
            <button 
              onClick={() => setGroupBy('date')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${groupBy === 'date' ? 'bg-neutral-800 text-white' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'}`}
            >
              Organizar por Fecha
            </button>
            <button 
              onClick={() => setGroupBy('client')}
              className={`px-4 py-2 text-sm font-medium transition-colors border-l border-neutral-200 ${groupBy === 'client' ? 'bg-neutral-800 text-white' : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'}`}
            >
              Mis Clientes (Deudas)
            </button>
          </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-neutral-400">Cargando facturas...</div>
        ) : (
          <>
            {renderInvoicesList()}
            {filteredInvoices.length === 0 && (
              <div className="text-center py-20 text-neutral-500">
                No hay facturas registradas.
              </div>
            )}
          </>
        )}
      </div>

      {/* Invoice Detail Modal "Como en Inventario" */}
      {/* SALES MODAL */}
      {showSalesModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-teal-50">
              <div>
                <h2 className="text-xl font-black text-teal-800 tracking-tight">Ventas del Día</h2>
                <p className="text-xs text-teal-600 font-bold uppercase tracking-widest mt-0.5">Detalle por Vendedor y Factura</p>
              </div>
              <button onClick={() => setShowSalesModal(false)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-700 transition">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-8">
               {dailyStats?.salesBySeller && Object.keys(dailyStats.salesBySeller).length > 0 ? (
                 Object.entries(dailyStats.salesBySeller)
                   .sort(([, a], [, b]) => (b as number) - (a as number))
                   .map(([sellerEmail, totalAmt]: [string, any]) => {
                      const sellerInvoices = filteredInvoices.filter(inv => 
                        inv.sellerId === sellerEmail && 
                        inv.status !== 'cancelled' && inv.status !== 'rejected'
                      );
                      return (
                        <div key={sellerEmail} className="space-y-3">
                          <div className="flex justify-between items-end border-b-2 border-teal-100 pb-1">
                            <span className="font-black text-slate-800 uppercase text-sm tracking-tight">{getSellerName(sellerEmail)}</span>
                            <span className="font-black text-teal-600 text-lg">Q{totalAmt.toFixed(2)}</span>
                          </div>
                          <div className="space-y-2">
                             {sellerInvoices.map(inv => (
                               <div key={inv.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-teal-50/50 transition-colors cursor-pointer" onClick={() => setSelectedInvoiceForModal(inv)}>
                                 <div className="flex flex-col">
                                   <span className="text-xs font-bold text-slate-700 leading-tight">{inv.clientName || inv.client}</span>
                                   <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[10px] text-slate-400 font-mono">Folio: {inv.folio}</span>
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {inv.status === 'paid' ? 'Contado' : 'Crédito'}
                                      </span>
                                   </div>
                                 </div>
                                 <span className="font-bold text-teal-700">Q{inv.totalAmount.toFixed(2)}</span>
                               </div>
                             ))}
                          </div>
                        </div>
                      );
                   })
               ) : (
                 <div className="text-center py-12">
                   <div className="w-16 h-16 bg-teal-50 text-teal-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <TrendingUp size={32} />
                   </div>
                   <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No hay ventas registradas hoy.</p>
                 </div>
               )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
               <span className="text-sm font-bold text-slate-500">{isGlobal ? 'Total General Vendido:' : 'Total de Mis Ventas:'}</span>
               <span className="text-xl font-black text-teal-700 font-mono">Q{Number(displayTotalSales).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENTS MODAL */}
      {showPaymentsModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-50">
              <div>
                <h2 className="text-xl font-black text-blue-800 tracking-tight">Cobros del Día</h2>
                <p className="text-xs text-blue-600 font-bold uppercase tracking-widest mt-0.5">Detalle por Vendedor y Cliente</p>
              </div>
              <button onClick={() => setShowPaymentsModal(false)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-700 transition">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-8">
               {dailyStats?.paymentsBySeller && Object.keys(dailyStats.paymentsBySeller).length > 0 ? (
                 Object.entries(dailyStats.paymentsBySeller)
                   .sort(([, a], [, b]) => (b as number) - (a as number))
                   .map(([sellerEmail, totalAmt]: [string, any]) => {
                      const sellerPayments = dailyStats?.todayPaymentsDetail?.filter((p: any) => p.recordedBy === sellerEmail) || [];
                      return (
                        <div key={sellerEmail} className="space-y-3">
                          <div className="flex justify-between items-end border-b-2 border-blue-100 pb-1">
                            <span className="font-black text-slate-800 uppercase text-sm tracking-tight">{getSellerName(sellerEmail)}</span>
                            <span className="font-black text-blue-600 text-lg">Q{totalAmt.toFixed(2)}</span>
                          </div>
                          
                          <div className="space-y-2">
                             {sellerPayments.map((p: any) => (
                               <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors">
                                 <div className="flex flex-col">
                                   <span className="text-xs font-bold text-slate-700 leading-tight">{p.clientName}</span>
                                   <span className="text-[10px] text-slate-400 font-mono">Boleta: {p.invoiceFolio || 'N/A'}</span>
                                 </div>
                                 <div className="flex flex-col items-end">
                                    <span className="font-bold text-blue-600">Q{p.amount.toFixed(2)}</span>
                                    {p.receiptUrl && (
                                      <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="text-[9px] text-blue-400 underline uppercase font-black">Ver Boleta</a>
                                    )}
                                 </div>
                               </div>
                             ))}
                             {sellerPayments.length === 0 && (
                               <p className="text-[10px] text-slate-400 italic pl-2">No se encontraron detalles para este vendedor.</p>
                             )}
                          </div>
                        </div>
                      );
                   })
               ) : (
                 <div className="text-center py-12">
                   <div className="w-16 h-16 bg-blue-50 text-blue-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Receipt size={32} />
                   </div>
                   <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No hay cobros registrados hoy.</p>
                 </div>
               )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
               <span className="text-sm font-bold text-slate-500">{isGlobal ? 'Total General Cobrado:' : 'Total de Mis Cobros:'}</span>
               <span className="text-xl font-black text-blue-700 font-mono">Q{Number(displayTotalPayments).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {selectedInvoiceForModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-100"
          >
            {/* Header */}
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-50 text-teal-700 rounded-xl border border-teal-100 shadow-xs">
                  <FileText size={22} />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 block">Detalles de Factura (Mis Ventas)</span>
                  <h3 className="text-xl font-black text-slate-800 leading-none mt-0.5">{selectedInvoiceForModal.client}</h3>
                  <p className="text-xs text-slate-500 font-mono mt-1">ID: {selectedInvoiceForModal.id}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setSelectedInvoiceForModal(null);
                  setPaymentAmount('');
                  setPaymentFile(null);
                }} 
                className="p-2 text-[10px] sm:text-xs font-black text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Panel Left: Client info and products */}
              <div className="space-y-6">
                {selectedInvoiceForModal.sellerPaysShipping && (
                  <div className="bg-[#0b4d2c]/10 border border-[#0b4d2c]/20 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 bg-[#0b4d2c] text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg">
                      <Clock size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#0b4d2c] uppercase tracking-tight">Vendedor Paga Envío</h4>
                      <p className="text-[10px] text-[#0b4d2c]/70 font-bold uppercase">Priorizar despacho - Costo absorbido</p>
                    </div>
                  </div>
                )}
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-2">Información del Cliente</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 font-bold block">NIT o C/F</span>
                      <p className="font-extrabold text-slate-800 mt-0.5">{selectedInvoiceForModal.nit || 'C/F'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block">Teléfono</span>
                      <p className="font-extrabold text-slate-800 mt-0.5">{selectedInvoiceForModal.phone || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 font-bold block">Dirección</span>
                      <p className="font-extrabold text-slate-800 mt-0.5">{selectedInvoiceForModal.address || 'N/A'}</p>
                    </div>
                    {selectedInvoiceForModal.transportMethod && (
                      <div className="col-span-2">
                        <span className="text-slate-400 font-bold block">Medio de Envío</span>
                        <p className="font-black text-[#0b4d2c] mt-0.5 uppercase tracking-widest">{selectedInvoiceForModal.transportMethod}</p>
                      </div>
                    )}
                  </div>
                  {cleanObservations(selectedInvoiceForModal.notes) && (
                    <div className="mt-4 p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 shadow-sm rounded-2xl">
                       <p className="font-black text-amber-900 text-[11px] uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                         <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> 
                         Observaciones Importantes
                       </p>
                       <p className="text-amber-950 font-medium text-sm leading-relaxed whitespace-pre-wrap">{cleanObservations(selectedInvoiceForModal.notes)}</p>
                    </div>
                  )}

                  <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-6">
                    <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Firma Vendedor</p>
                      {selectedInvoiceForModal.sellerSignature ? (
                        <img src={selectedInvoiceForModal.sellerSignature} alt="Firma Vendedor" className="max-h-20 mx-auto" />
                      ) : (
                        <div className="h-20 flex items-center justify-center text-gray-300 italic text-xs">Sin firma</div>
                      )}
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Firma Revisión (Admin)</p>
                      {selectedInvoiceForModal.adminSignature ? (
                        <>
                          <img src={selectedInvoiceForModal.adminSignature} alt="Firma Admin" className="max-h-20 mx-auto" />
                          <p className="text-[9px] font-bold text-green-700 mt-1 uppercase">Revisado por: {selectedInvoiceForModal.reviewedBy}</p>
                        </>
                      ) : (
                        <div className="h-20 flex items-center justify-center text-gray-300 italic text-xs">Pendiente de revisión</div>
                      )}
                    </div>
                  </div>
                </div>

                {selectedInvoiceForModal.authStatus === 'pending' && user.role === 'admin' && (!(selectedInvoiceForModal as any).isEdited || user?.email === 'seseffff942@gmail.com') && (
                  <div className="p-4 border border-red-200 bg-red-50 rounded-2xl animate-pulse">
                    <h5 className="text-sm font-bold text-red-800 mb-2">Autorización de Precio Pendiente</h5>
                    <p className="text-xs text-red-700 mb-3">Esta factura contiene productos vendidos por debajo del precio base. ¿Autorizas este precio especial por única vez?</p>
                    <div className="flex gap-2">
                      <button 
                         onClick={async () => {
                            await api.updateInvoiceAuth(selectedInvoiceForModal.id, 'authorized');
                            const refreshedInvoices = await api.getInvoices(user.email);
                            setInvoices(Array.isArray(refreshedInvoices) ? refreshedInvoices : []);
                            const updatedInvoice = (refreshedInvoices as Invoice[]).find(v => v.id === selectedInvoiceForModal.id);
                            if (updatedInvoice) {
                              setSelectedInvoiceForModal(updatedInvoice);
                            }
                         }}
                         className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors"
                      >
                         Autorizar
                      </button>
                      <button 
                         onClick={async () => {
                             try {
                               await api.updateInvoiceAuth(selectedInvoiceForModal.id, 'rejected');
                               await api.updateInvoiceStatus(selectedInvoiceForModal.id, 'rejected');
                               alert("Venta rechazada correctamente.");
                               const refreshedInvoices = await api.getInvoices(user.email);
                               setInvoices(Array.isArray(refreshedInvoices) ? refreshedInvoices : []);
                               const updatedInvoice = (refreshedInvoices as Invoice[]).find(v => v.id === selectedInvoiceForModal.id);
                               if (updatedInvoice) {
                                 setSelectedInvoiceForModal(updatedInvoice);
                               }
                             } catch (err: any) {
                               alert("Error general rechazando: " + err.message);
                             }
                          }}
                         className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded-xl transition-colors border border-red-200"
                      >
                         Rechazar
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Productos de la Venta</h4>
                    <span className="text-xs bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full font-bold text-teal-700">
                      {selectedInvoiceForModal.items?.length || 0} productos
                    </span>
                  </div>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                    {(selectedInvoiceForModal.items || []).map((item, idx) => {
                      const isStockAlert = (item as any).isStockAlert;
                      const isPriceAlert = (item as any).isPriceAlert || (item.originalPrice && item.price < item.originalPrice && !(item as any).isOfferApplied);
                      return (
                        <div key={idx} className="p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors flex justify-between items-start text-xs">
                          <div className="space-y-1 pr-4">
                            <p className="font-extrabold text-slate-800 notranslate" translate="no">
                              {item.quantity}x {item.productName}
                            </p>
                            {item.color && item.size && (
                              <span className="block mt-1">
                                <span className="inline-block px-1.5 py-0.5 bg-yellow-100/80 text-yellow-800 border border-yellow-200 text-[10px] font-black uppercase tracking-wider rounded-md">
                                  {item.color} - {item.size}
                                </span>
                              </span>
                            )}
                            {isStockAlert && (
                               <span className="block text-[10px] text-orange-600 font-bold uppercase tracking-tight">
                                  ⚠️ Stock Insuficiente en Bodega
                               </span>
                            )}
                            {isPriceAlert && (
                               <span className="block text-[10px] text-rose-600 font-bold uppercase tracking-tight">
                                  ⚠️ Precio bajo costo base: Q{item.price.toFixed(2)} (Base: Q{item.originalPrice?.toFixed(2)})
                                </span>
                            )}
                            
                            {(item as any).requiresAuth && !(item as any).isAuthorized && (
                              <div className="mt-2 p-2 bg-slate-100 border border-slate-200 rounded-lg">
                                <span className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wider">¿Hay en existencia? (Autorización TECUN)</span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={async () => {
                                      if (!confirm('¿Confirmas que SI hay stock y autorizas la venta de este producto?')) return;
                                      try {
                                        let newItems = [...selectedInvoiceForModal.items];
                                        newItems[idx] = { ...newItems[idx], isAuthorized: true };
                                        await api.updateFullInvoice(selectedInvoiceForModal.id, {
                                          client: selectedInvoiceForModal.client,
                                          nit: selectedInvoiceForModal.nit,
                                          phone: selectedInvoiceForModal.phone,
                                          address: selectedInvoiceForModal.address,
                                          notes: selectedInvoiceForModal.notes,
                                          items: newItems,
                                          isOwed: true
                                        });
                                        const refreshedInvoices = await api.getInvoices(user.email);
                                        setInvoices(Array.isArray(refreshedInvoices) ? refreshedInvoices : []);
                                        const updatedInvoice = (refreshedInvoices as Invoice[]).find(v => v.id === selectedInvoiceForModal.id);
                                        if (updatedInvoice) setSelectedInvoiceForModal(updatedInvoice);
                                      } catch(err: any) {
                                        alert("Error al autorizar: " + err.message);
                                      }
                                    }}
                                    className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold rounded-md shadow-sm transition-colors"
                                  >
                                    Sí, autorizar
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!confirm('¿Confirmas que NO hay stock? El producto será retirado de la factura y los totales se reajustarán.')) return;
                                      try {
                                        let newItems = [...selectedInvoiceForModal.items];
                                        newItems.splice(idx, 1);
                                        if (newItems.length === 0) {
                                          alert("No puedes dejar la factura sin productos. Anula la factura en su lugar.");
                                          return;
                                        }
                                        await api.updateFullInvoice(selectedInvoiceForModal.id, {
                                          client: selectedInvoiceForModal.client,
                                          nit: selectedInvoiceForModal.nit,
                                          phone: selectedInvoiceForModal.phone,
                                          address: selectedInvoiceForModal.address,
                                          notes: selectedInvoiceForModal.notes,
                                          items: newItems,
                                          isOwed: true
                                        });
                                        const refreshedInvoices = await api.getInvoices(user.email);
                                        setInvoices(Array.isArray(refreshedInvoices) ? refreshedInvoices : []);
                                        const updatedInvoice = (refreshedInvoices as Invoice[]).find(v => v.id === selectedInvoiceForModal.id);
                                        if (updatedInvoice) setSelectedInvoiceForModal(updatedInvoice);
                                      } catch(err: any) {
                                        alert("Error al retirar: " + err.message);
                                      }
                                    }}
                                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-md shadow-sm transition-colors"
                                  >
                                    No, retirar
                                  </button>
                                </div>
                              </div>
                            )}

                          </div>
                          <div className="text-right flex flex-col items-end gap-1">
                            <span className="font-extrabold text-slate-700 text-sm">Q{item.total.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400">P.U: Q{(item.total / item.quantity).toFixed(2)}</span>
                            {selectedInvoiceForModal.status === 'pending' && user.role === 'admin' && (
                              <button 
                                onClick={async () => {
                                  const currentPriceStr = (item.total / item.quantity).toFixed(2);
                                  const newPrice = parseFloat(prompt('Nuevo precio unitario (Q):', currentPriceStr) || '');
                                  if (isNaN(newPrice) || newPrice < 0) return;
                                  try {
                                    await api.updateInvoiceItemPrice(selectedInvoiceForModal.id, idx, newPrice);
                                    const refreshedInvoices = await api.getInvoices(user.email);
                                    setInvoices(Array.isArray(refreshedInvoices) ? refreshedInvoices : []);
                                    const updatedInvoice = (refreshedInvoices as Invoice[]).find(v => v.id === selectedInvoiceForModal.id);
                                    if (updatedInvoice) {
                                      setSelectedInvoiceForModal(updatedInvoice);
                                    }
                                  } catch(err) {
                                    alert("Error al actualizar el precio");
                                  }
                                }}
                                className="text-[10px] text-blue-500 hover:text-blue-700 underline font-medium mt-1"
                              >
                                 Modificar P.U.
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Panel Right: Payments, Abonos register & balance details */}
              <div className="space-y-6">
                {/* Debt Summary Card */}
                <div className="bg-slate-950 text-white rounded-[1.5rem] p-6 shadow-md space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <span className="text-slate-400 block font-bold">Fecha de Emisión</span>
                      <span className="font-extrabold text-slate-200">
                        {selectedInvoiceForModal.date ? format(new Date(selectedInvoiceForModal.date), "dd MMM yyyy, HH:mm", { locale: es }) : 'N/A'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block font-bold">Vendedor</span>
                      <span className="font-extrabold text-slate-200 font-mono">{(selectedInvoiceForModal.sellerId || '').split('@')[0]}</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-800 pt-4 grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-slate-400 text-[10px] block font-bold">Total Venta</span>
                      <p className="text-sm sm:text-base font-black tracking-tight text-slate-300">Q{selectedInvoiceForModal.totalAmount.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-teal-400 text-[10px] block font-bold">Abonado</span>
                      <p className="text-sm sm:text-base font-black tracking-tight text-teal-400">Q{(selectedInvoiceForModal.paidAmount || 0).toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-rose-400 text-[10px] block font-bold">Saldo Pendiente</span>
                      <p className="text-base sm:text-lg font-black tracking-tight text-rose-500">Q{(selectedInvoiceForModal.totalAmount - (selectedInvoiceForModal.paidAmount || 0)).toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Payments list previous abonos */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Historial de Abonos / Finanzas</h4>
                  
                  {invoicePayments[selectedInvoiceForModal.id] && invoicePayments[selectedInvoiceForModal.id].length > 0 ? (
                    <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100 text-xs overflow-hidden">
                      {invoicePayments[selectedInvoiceForModal.id].map(payment => (
                        <div key={payment.id} className="p-4 bg-slate-50/50 hover:bg-slate-50 transition flex justify-between items-center">
                          <div>
                            <p className="font-bold text-slate-700">Abono certificado</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {payment.date ? format(new Date(payment.date), "dd MMM yyyy, HH:mm", { locale: es }) : 'N/A'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-emerald-600 text-sm">Q{payment.amount.toFixed(2)}</span>
                            {payment.receiptUrl ? (
                              <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer" className="p-1 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[10px] font-bold transition-all border border-blue-100">
                                Ver Recibo
                              </a>
                            ) : (
                              <span className="text-slate-400 italic text-[10px] px-2 py-1 bg-slate-100 rounded">Sin archivo</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200 text-center">
                      No se han registrado abonos de dinero para esta cuenta aún.
                    </p>
                  )}

                  {/* Add payment box */}
                  {selectedInvoiceForModal.status === 'pending' && (
                    <div className="bg-teal-50/30 border border-teal-100 rounded-2xl p-4 gap-3 space-y-3">
                      <span className="text-[10px] font-black text-teal-800 uppercase tracking-wider block">Registrar Abono Dinero</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block mb-1">Monto de Pago (Q)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            value={paymentAmount} 
                            max={selectedInvoiceForModal.totalAmount - (selectedInvoiceForModal.paidAmount || 0)}
                            onChange={e => setPaymentAmount(e.target.value)}
                            placeholder="0.00" 
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block mb-1">Comprobante / Depósito (Imagen)</label>
                          <input 
                            type="file" 
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={e => setPaymentFile(e.target.files?.[0] || null)}
                            className="w-full text-[10px] bg-white border border-slate-200 rounded-xl px-2 py-1.5 focus:ring-1 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={() => handleAddPaymentAndRefresh(selectedInvoiceForModal.id, selectedInvoiceForModal.totalAmount - (selectedInvoiceForModal.paidAmount || 0))}
                        disabled={isPaying}
                        className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold rounded-xl transition text-xs shadow-md shadow-teal-500/10 disabled:opacity-50"
                      >
                        {isPaying ? 'Guardando...' : 'Registrar Abono'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
              <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
                <button
                  onClick={() => downloadInvoicePdf(selectedInvoiceForModal)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white px-3 sm:px-4 py-2.5 rounded-xl transition-all shadow-xs"
                >
                  <Download size={14} /> <span>Descargar PDF</span>
                </button>
                {selectedInvoiceForModal.status !== 'cancelled' && selectedInvoiceForModal.status !== 'rejected' && selectedInvoiceForModal.status !== 'sent' && (
                  user.role === 'admin' ? (
                   <button
                     onClick={() => {
                        localStorage.setItem('edit_invoice', JSON.stringify(selectedInvoiceForModal));
                        window.location.hash = 'sales';
                     }}
                     className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-bold bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 sm:px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
                   >
                     <Edit2 size={14} /> <span>Editar</span>
                   </button>
                  ) : (
                   <button
                     onClick={() => {
                        setSuggestEditInvoice(selectedInvoiceForModal);
                     }}
                     className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-bold bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 sm:px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
                     title="Sugerir edición a administrador"
                   >
                     <Edit2 size={14} /> <span>Sugerir Edición</span>
                   </button>
                  )
                )}
                {selectedInvoiceForModal.phone && (
                  <button
                    onClick={() => {
                      const message = `Hola *${selectedInvoiceForModal.client}*, tu factura *${selectedInvoiceForModal.id}* está en estado *${selectedInvoiceForModal.status === 'paid' ? 'PAGADA' : 'PENDIENTE'}.* Saldo pendiente: Q${(selectedInvoiceForModal.totalAmount - (selectedInvoiceForModal.paidAmount || 0)).toFixed(2)}.`;
                      const targetPhone = selectedInvoiceForModal.phone;
                      let cleanPhone = String(targetPhone).replace(/\D/g, "");
                      if (cleanPhone.length === 8) cleanPhone = '502' + cleanPhone;
                      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-bold bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2.5 rounded-xl transition-all shadow-xs"
                  >
                    <MessageCircle size={14} /> <span>WhatsApp</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 w-full sm:w-auto">
                {user.role === 'admin' && selectedInvoiceForModal.status !== 'cancelled' && selectedInvoiceForModal.status !== 'rejected' && (
                  <div className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold">
                    <span className="text-slate-500">Estado:</span>
                    <select 
                      value={selectedInvoiceForModal.status}
                      onChange={async (e) => {
                        await handleUpdateStatus(selectedInvoiceForModal.id, e.target.value as any);
                        const refreshedInvoices = await api.getInvoices(user.email);
                        setInvoices(Array.isArray(refreshedInvoices) ? refreshedInvoices : []);
                        const currentUpdated = (refreshedInvoices as Invoice[]).find(v => v.id === selectedInvoiceForModal.id);
                        if (currentUpdated) {
                          setSelectedInvoiceForModal(currentUpdated);
                        }
                      }}
                      className="font-bold text-[#116858] outline-none border-none bg-transparent"
                    >
                      <option value="pending">Pendiente</option>
                      <option value="paid">Completada/Pagada</option>
                      <option value="sent">Enviada/Entregada</option>
                    </select>
                  </div>
                )}

                {selectedInvoiceForModal.status !== 'cancelled' && selectedInvoiceForModal.status !== 'rejected' ? (
                  <button
                    onClick={async () => {
                      if (user.role === 'admin' || user.email === selectedInvoiceForModal.sellerId) {
                        if (confirm('¿Anular esta factura permanentemente? (Se restituirá el stock y dejará de contar en las ventas)')) {
                          await handleUpdateStatus(selectedInvoiceForModal.id, 'cancelled');
                          const refreshedInvoices = await api.getInvoices(user.email);
                          setInvoices(Array.isArray(refreshedInvoices) ? refreshedInvoices : []);
                          const currentUpdated = (refreshedInvoices as Invoice[]).find(v => v.id === selectedInvoiceForModal.id);
                          if (currentUpdated) {
                            setSelectedInvoiceForModal(currentUpdated);
                          } else {
                            setSelectedInvoiceForModal(null);
                          }
                        }
                      } else {
                        alert('Solo el administrador o el vendedor de esta factura pueden anularla.');
                      }
                    }}
                    className="flex-1 sm:flex-none text-center justify-center px-4 py-2.5 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl transition-all"
                  >
                    Anular Factura
                  </button>
                ) : (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={async () => {
                        if (confirm('¿Archivar esta factura anulada o rechazada? Ya no aparecerá en sus listados.')) {
                          try {
                            await api.archiveInvoice(selectedInvoiceForModal.id);
                            const refreshedInvoices = await api.getInvoices(user.email);
                            setInvoices(Array.isArray(refreshedInvoices) ? refreshedInvoices : []);
                            setSelectedInvoiceForModal(null);
                            alert('Factura archivada con éxito.');
                          } catch (err: any) {
                            alert(err.message || 'Error al archivar');
                          }
                        }
                      }}
                      className="inline-flex items-center justify-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                    >
                      📥 Archivar
                    </button>
                    {(user.role === 'admin' || user.email === selectedInvoiceForModal.sellerId) && (
                      <button
                        onClick={async () => {
                          if (confirm('⚠️ ¿ELIMINAR PERMANENTEMENTE esta factura de la base de datos? Esta acción es irreversible.')) {
                            try {
                              await api.deleteInvoiceOriginal(selectedInvoiceForModal.id);
                              const refreshedInvoices = await api.getInvoices(user.email);
                              setInvoices(Array.isArray(refreshedInvoices) ? refreshedInvoices : []);
                              setSelectedInvoiceForModal(null);
                              alert('Factura eliminada para siempre de los registros.');
                            } catch (err: any) {
                              alert(err.message || 'Error al eliminar');
                            }
                          }
                        }}
                        className="inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                      >
                        🗑️ Eliminar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* View Mode Modal */}
      {isViewModeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Layers size={16} className="text-teal-600" />
                Vista de Ventas
              </h3>
              <button 
                onClick={() => setIsViewModeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-md hover:bg-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <button
                onClick={() => {
                  setSalesViewMode('global');
                  setIsViewModeModalOpen(false);
                }}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  salesViewMode === 'global' ? 'border-teal-600 bg-teal-50' : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${salesViewMode === 'global' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                    <TrendingUp size={18} />
                  </div>
                  <div className="text-left">
                    <p className={`font-bold text-sm ${salesViewMode === 'global' ? 'text-teal-800' : 'text-slate-700'}`}>Global (Todos)</p>
                    <p className="text-[10px] text-slate-500 font-medium">Ver comparativas de toda la empresa</p>
                  </div>
                </div>
                {salesViewMode === 'global' && <CheckCircle size={18} className="text-teal-600" />}
              </button>
              
              <button
                onClick={() => {
                  setSalesViewMode('mine');
                  setIsViewModeModalOpen(false);
                }}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  salesViewMode === 'mine' ? 'border-teal-600 bg-teal-50' : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${salesViewMode === 'mine' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>
                    <UserIcon size={18} />
                  </div>
                  <div className="text-left">
                    <p className={`font-bold text-sm ${salesViewMode === 'mine' ? 'text-teal-800' : 'text-slate-700'}`}>Mis Ventas</p>
                    <p className="text-[10px] text-slate-500 font-medium">Ver solo mi rendimiento personal</p>
                  </div>
                </div>
                {salesViewMode === 'mine' && <CheckCircle size={18} className="text-teal-600" />}
              </button>
            </div>
          </div>
        </div>
      )}

      <ShippingGuideModal 
        isOpen={!!shippingModalConfig}
        onClose={() => setShippingModalConfig(null)}
        onSubmit={(guide, imageUrl, clientName, shippingDate) => {
          if (shippingModalConfig) {
             handleUpdateStatus(shippingModalConfig.id, 'sent', guide, imageUrl, clientName, shippingDate);
             setShippingModalConfig(null);
          }
        }}
      />
      <ImageModal 
        isOpen={!!viewingImageConfig} 
        onClose={() => setViewingImageConfig(null)} 
        imageUrl={viewingImageConfig?.url || ''} 
        scanClient={viewingImageConfig?.scanClient}
        scanDate={viewingImageConfig?.scanDate}
        trackingNumber={viewingImageConfig?.trackingNumber}
        title="Guía de Envío" 
      />

      {suggestEditInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-800 text-lg">Sugerir Cambios</h3>
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Venta #{suggestEditInvoice.folio || suggestEditInvoice.id.slice(0, 8)}
                </p>
              </div>
              <button onClick={() => { setSuggestEditInvoice(null); setSuggestEditText(''); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">
                  Especifica los cambios
                </label>
                <textarea
                  value={suggestEditText}
                  onChange={(e) => setSuggestEditText(e.target.value)}
                  className="w-full h-32 p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  placeholder="Ej: Cambiar 2 unidades de X a Y, o agregar descuento de Q10"
                ></textarea>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Esto abrirá WhatsApp para que envíes tu solicitud de edición al grupo o a los administradores. Esta acción no modificará el inventario ni la venta hasta que sea aprobada y realizada por un administrador.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => { setSuggestEditInvoice(null); setSuggestEditText(''); }}
                className="flex-1 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                disabled={!suggestEditText.trim()}
                onClick={() => {
                  const message = `Hola administradores, quisiera editar esta venta (Factura: *${suggestEditInvoice.folio || suggestEditInvoice.id.slice(0, 8)}* / Cliente: *${suggestEditInvoice.client}*).\nPor favor, confirmar si es posible. Aquí está la lista de lo que hay que editar:\n\n${suggestEditText}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                  setSuggestEditInvoice(null);
                  setSuggestEditText('');
                }}
                className="flex-1 py-3 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer"
              >
                Enviar Solicitud
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
