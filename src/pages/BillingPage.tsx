import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Invoice, Payment, User } from '../types';
import SignaturePad from '../components/SignaturePad';
import { Search, Upload, CheckCircle, FileText, ChevronDown, ChevronUp, Printer, Download, Settings, RefreshCcw, X, TrendingUp, Receipt, Clock, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DEFAULT_PRINT_TEMPLATE, compilePrintTemplate, cn, printHtml, downloadHtmlAsPdf, cleanObservations } from '../utils';
import { motion } from 'motion/react';
import { ShippingGuideModal } from '../components/ShippingGuideModal';
import { ImageModal } from '../components/ImageModal';

interface BillingPageProps {
  user: User;
  isMobile?: boolean;
}

export function BillingPage({ user, isMobile }: BillingPageProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCancelledAndRejected, setShowCancelledAndRejected] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<Invoice | null>(null);
  const [shippingModalConfig, setShippingModalConfig] = useState<{ id: string } | null>(null);
  const [viewingImageConfig, setViewingImageConfig] = useState<{ url: string; scanClient?: string; scanDate?: string; trackingNumber?: string } | null>(null);
  const [manualFolio, setManualFolio] = useState<string>('');
  const [invoicePayments, setInvoicePayments] = useState<Record<string, Payment[]>>({});
  const [dailyStats, setDailyStats] = useState<any>(null);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [groupBy, setGroupBy] = useState<'date' | 'seller' | 'client'>('date');

  const getLocalDateStr = (d = new Date()) => {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  };

  const [filterDate, setFilterDate] = useState<string>(getLocalDateStr());
  const [dateViewMode, setDateViewMode] = useState<'day' | 'all'>('day');
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [displayMode, setDisplayMode] = useState<'list' | 'seller_cards'>('list');
  
  // Folio reset configuration states
  const [showFolioModal, setShowFolioModal] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [pendingReviewInvoiceId, setPendingReviewInvoiceId] = useState<string | null>(null);
  const [folioConfig, setFolioConfig] = useState<{ resetDate: string | null; startFrom: number }>({ resetDate: null, startFrom: 1 });
  const [resetDateInput, setResetDateInput] = useState('');
  const [startFromInput, setStartFromInput] = useState(1);
  const [savingFolio, setSavingFolio] = useState(false);

  // Print template states
  const [printTemplate, setPrintTemplate] = useState<string>('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [editingTemplateText, setEditingTemplateText] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadInvoices();
    api.getUsers().then(setUsers).catch(console.error);
    api.getDailyStats().then(setDailyStats).catch(console.error);
    api.getPrintTemplate().then(data => {
      setPrintTemplate(data.template || DEFAULT_PRINT_TEMPLATE);
      setEditingTemplateText(data.template || DEFAULT_PRINT_TEMPLATE);
    }).catch(err => {
      console.error(err);
      setPrintTemplate(DEFAULT_PRINT_TEMPLATE);
      setEditingTemplateText(DEFAULT_PRINT_TEMPLATE);
    });
    if (user.role === 'admin') {
      api.getFolioConfig().then(config => {
        setFolioConfig(config);
        setResetDateInput(config.resetDate ? new Date(config.resetDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16));
        setStartFromInput(config.startFrom);
      }).catch(console.error);
    }
  }, []);

  const handleReviewSignature = async (sig: string) => {
    if (!pendingReviewInvoiceId) return;
    try {
      await api.updateInvoiceReview(pendingReviewInvoiceId, sig, user.name);
      setShowSignaturePad(false);
      setPendingReviewInvoiceId(null);
      await loadInvoices();
      // Update modal if open
      if (selectedInvoiceForModal && selectedInvoiceForModal.id === pendingReviewInvoiceId) {
        const refreshed = await api.getInvoices(user.role === 'admin' ? undefined : user.email);
        const current = refreshed.find(v => v.id === pendingReviewInvoiceId);
        if (current) setSelectedInvoiceForModal(current);
      }
      alert('Revisión guardada con éxito.');
    } catch (err: any) {
      alert('Error al guardar revisión: ' + err.message);
    }
  };

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
  
  useEffect(() => {
    if (selectedInvoiceForModal) {
      setManualFolio(selectedInvoiceForModal.folio ? String(selectedInvoiceForModal.folio) : '');
    } else {
      setManualFolio('');
    }
  }, [selectedInvoiceForModal]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const data = await api.getInvoices(user.role === 'admin' ? undefined : user.email);
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
      
      const refreshedInvoices = await api.getInvoices(user.role === 'admin' ? undefined : user.email);
      setInvoices(refreshedInvoices);
      const updatedInvoice = refreshedInvoices.find(v => v.id === invoiceId);
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
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('app_token')}` },
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
      (i.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.sellerId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (getSellerName(i.sellerId || '') || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchDate = true;
    if (dateViewMode === 'day') {
      if (!i.date) return false;
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
      const invDate = new Date(i.date);
      const now = new Date();
      if (dateFilter === 'today') {
        matchDate = invDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchDate = invDate >= oneWeekAgo;
      } else if (dateFilter === 'month') {
        const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        matchDate = invDate >= oneMonthAgo;
      }
    }

    let matchSeller = true;
    if (sellerFilter !== 'all') {
      matchSeller = i.sellerId === sellerFilter;
    }

    return matchSearch && matchDate && matchSeller;
  });

  const totalPending = filteredInvoices.reduce((acc, inv) => {
     if (inv.status === 'cancelled' || inv.status === 'rejected') return acc;
     return acc + (inv.totalAmount - (inv.paidAmount || 0));
  }, 0);

  function getSellerName(email: string) {
    const u = users.find(user => user.email === email);
    return u ? u.name : (email || '').split('@')[0];
  }

  // Grouping and list rendering
  const renderInvoicesList = () => {
    // Sort all selected invoices chronologically (newest first, by hour)
    const sortedInvoices = [...filteredInvoices].sort((a, b) => {
      const folioA = a.folio || 0;
      const folioB = b.folio || 0;
      if (folioA !== folioB) return folioB - folioA;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    if (displayMode === 'seller_cards') {
      const invoicesBySeller: Record<string, Invoice[]> = {};
      sortedInvoices.forEach(inv => {
        const sellerKey = inv.sellerId || 'Desconocido';
        if (!invoicesBySeller[sellerKey]) invoicesBySeller[sellerKey] = [];
        invoicesBySeller[sellerKey].push(inv);
      });

      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(invoicesBySeller).map(([sellerId, list], groupIdx) => {
            const totalSellerAmount = list.reduce((sum, inv) => inv.status !== 'cancelled' && inv.status !== 'rejected' ? sum + inv.totalAmount : sum, 0);
            const totalSellerPaid = list.reduce((sum, inv) => inv.status !== 'cancelled' && inv.status !== 'rejected' ? sum + (inv.paidAmount || 0) : sum, 0);
            const totalSellerPending = totalSellerAmount - totalSellerPaid;

            const cardMotionProps = isMobile ? {
              initial: { opacity: 1, y: 0, scale: 1 },
              animate: { opacity: 1, y: 0, scale: 1 },
              transition: { duration: 0.1 }
            } : {
              initial: { opacity: 0, y: 40, scale: 0.98 },
              whileInView: { opacity: 1, y: 0, scale: 1 },
              viewport: { once: true, margin: "-20px" },
              transition: { duration: 0.55, delay: Math.min(groupIdx * 0.08, 0.4) },
              whileHover: { y: -6, boxShadow: "0 22px 45px rgba(11, 77, 44, 0.07)", borderColor: "rgba(11, 77, 44, 0.15)" }
            };

            return (
              <motion.div 
                key={sellerId} 
                {...cardMotionProps}
                className="bg-white border border-slate-200/80 rounded-[2rem] shadow-sm transition-all duration-300 overflow-hidden flex flex-col relative"
              >
                {/* Header card with branded emerald gradient */}
                <div className="bg-gradient-to-br from-[#0c5c35] to-[#042616] text-white p-5 relative overflow-hidden shrink-0">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300/90 bg-white/10 px-2.5 py-1 rounded-full backdrop-blur-xs">VENDEDOR</span>
                  <h3 className="font-extrabold text-lg mt-2 tracking-tight truncate notranslate" translate="no">
                    {getSellerName(sellerId)}
                  </h3>
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/10 text-xs">
                    <div>
                      <p className="text-white/60 text-[10px] uppercase font-bold tracking-wider">Pedidos</p>
                      <p className="font-black text-sm text-emerald-300">{list.length}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/60 text-[10px] uppercase font-bold tracking-wider">Total Venta</p>
                      <p className="font-black text-sm text-amber-300">Q{totalSellerAmount.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                
                {/* Scrollable list client cards */}
                <div className="p-4 flex-1 divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {list.length > 0 ? (
                    list.map(inv => {
                      const isCancelled = inv.status === 'cancelled';
                      const isPaid = inv.status === 'paid';
                      const isRejected = inv.status === 'rejected';
                      const isSent = inv.status === 'sent';
                      const hourStr = inv.date ? format(new Date(inv.date), "HH:mm") : '--:--';
                      
                      return (
                        <div 
                          key={inv.id} 
                          onClick={() => setSelectedInvoiceForModal(inv)}
                          className="py-3.5 flex items-center justify-between cursor-pointer hover:bg-emerald-50/20 rounded-xl px-2 -mx-2 transition-all duration-200"
                        >
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-150 px-1 py-0.5 rounded-md">{hourStr}</span>
                              <span className={`text-xs font-bold ${isCancelled ? 'text-red-700 font-bold bg-red-50' : 'text-slate-800'} truncate block max-w-[145px]`}>
                                {inv.client}
                              </span>
                            </div>
                            <span className="text-[9px] font-mono text-slate-400 block truncate mt-0.5">{inv.id}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-xs font-extrabold text-slate-800 ${isCancelled && 'line-through text-red-550'}`}>
                              Q{inv.totalAmount.toFixed(2)}
                            </p>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg uppercase tracking-wider inline-block mt-1 ${
                              isCancelled || isRejected ? 'bg-red-50 text-red-650 border border-red-100' :
                              isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              isSent ? 'bg-blue-50 text-blue-700 border border-blue-100 font-bold' :
                              'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {isCancelled ? 'Anulada' : isRejected ? 'Rechazada' : isPaid ? 'Cobrado' : isSent ? 'Enviado' : 'Pendiente'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-8">Sin facturas.</p>
                  )}
                </div>
                
                <div className="bg-slate-50/80 px-5 py-3.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500 shrink-0">
                  <span>Por Cobrar:</span>
                  <span className="text-orange-600 text-sm font-black">Q{totalSellerPending.toFixed(2)}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      );
    } else if (groupBy === 'client') {
      const grouped: Record<string, Invoice[]> = {};
      sortedInvoices.forEach(inv => {
        const clientKey = inv.client || 'Desconocido';
        if (!grouped[clientKey]) grouped[clientKey] = [];
        grouped[clientKey].push(inv);
      });
      return Object.entries(grouped).map(([client, invs], grIdx) => {
        const invWithPhone = invs.find(i => Boolean(i.phone));
        const phone = invWithPhone?.phone || null;
        const groupMotionProps = isMobile ? {
          initial: { opacity: 1, y: 0, scale: 1 },
          animate: { opacity: 1, y: 0, scale: 1 },
          transition: { duration: 0.1 }
        } : {
          initial: { opacity: 0, y: 35, scale: 0.99 },
          whileInView: { opacity: 1, y: 0, scale: 1 },
          viewport: { once: true, margin: "-10px" },
          transition: { duration: 0.5, delay: Math.min(grIdx * 0.06, 0.45) }
        };

        return (
          <motion.div 
            key={client} 
            {...groupMotionProps}
            className="mb-8 p-6 bg-white border border-slate-200/80 shadow-sm rounded-3xl"
          >
            <div className="mb-5 pb-3 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 max-w-full">
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-800 tracking-tight break-words">
                    {client}
                  </h2>
                  {phone && (
                    <a 
                      href={`tel:${phone.replace(/\D/g, '')}`} 
                      className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#0b4d2c] bg-emerald-50 border border-emerald-100/50 px-3 py-1 rounded-full hover:bg-emerald-100 transition-all shadow-xs whitespace-nowrap"
                    >
                      📞 Llamar ({phone})
                    </a>
                  )}
                </div>
                <div className="self-start sm:self-center shrink-0">
                  <span className="inline-block text-xs font-extrabold text-orange-650 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100/80 shadow-xs whitespace-nowrap">
                    Q{invs.reduce((sum, inv) => inv.status !== 'cancelled' ? sum + (inv.totalAmount - inv.paidAmount) : sum, 0).toFixed(2)} Cartera Pendiente
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {invs.map(renderInvoice)}
            </div>
          </motion.div>
        );
      });
    } else {
      // Default chronological hour-ordered layout
      return (
        <div className="space-y-4">
          <div className="space-y-3">
            {sortedInvoices.map((inv, index) => {
              const isCancelled = inv.status === 'cancelled';
              const isPaid = inv.status === 'paid';
              const isRejected = inv.status === 'rejected';
              const isSent = inv.status === 'sent';
              const needsAuth = inv.authStatus === 'pending';
              const isEdited = false;
              const pending = inv.totalAmount - (inv.paidAmount || 0);
              const hourStr = inv.date ? format(new Date(inv.date), "HH:mm") : '--:--';

              const cardMotionProps = isMobile ? {
                initial: { opacity: 1, y: 0, scale: 1 },
                animate: { opacity: 1, y: 0, scale: 1 },
                transition: { duration: 0.1 }
              } : {
                initial: { opacity: 0, y: 30, scale: 0.98 },
                whileInView: { opacity: 1, y: 0, scale: 1 },
                viewport: { once: true, margin: "-20px" },
                transition: { duration: 0.45, delay: Math.min(index * 0.035, 0.4) },
                whileHover: { 
                  y: -5, 
                  boxShadow: "0 15px 30px rgba(11, 77, 44, 0.05)", 
                  borderColor: "rgba(11, 77, 44, 0.15)" 
                }
              };

              return (
                <motion.div 
                  key={inv.id} 
                  {...cardMotionProps}
                  onClick={() => setSelectedInvoiceForModal(inv)}
                  className={cn(
                    "border rounded-2xl p-4 sm:p-5 transition-all duration-300 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 select-none relative overflow-hidden cursor-pointer shadow-sm",
                    isCancelled ? "border-red-155 opacity-65 bg-red-50/10" :
                    isRejected ? "border-red-200 bg-red-50/5" :
                    needsAuth ? "border-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.08)] animate-pulse" :
                    isEdited ? "border-orange-200 shadow-[0_0_12px_rgba(249,115,22,0.06)]" : "border-slate-200/80"
                  )}
                >
                  {isEdited && (
                    <div className="absolute top-0 right-0 left-0 bg-gradient-to-r from-orange-400 to-amber-500 text-white text-[9px] uppercase tracking-widest font-black text-center py-0.5 z-10">
                      Venta Editada
                    </div>
                  )}
                  {needsAuth && (
                    <div className="absolute top-0 right-0 left-0 bg-rose-600 text-white text-[9px] uppercase tracking-widest font-black text-center py-0.5 z-10">
                      Autorización Pendiente
                    </div>
                  )}

                  <div className="flex items-center gap-4 min-w-[200px] flex-1">
                    <div className={cn(
                      "p-3 rounded-2xl shrink-0 transition-transform duration-300 group-hover:scale-110",
                      isCancelled ? "bg-red-50 text-red-650 border border-red-100" :
                      isPaid ? "bg-emerald-50 text-emerald-700 border border-emerald-100/50" :
                      isRejected ? "bg-red-50 text-red-600 border border-red-200" :
                      needsAuth ? "bg-rose-50 text-rose-600 border border-rose-200" :
                      "bg-[#0b4d2c]/5 text-[#0b4d2c] border border-[#0b4d2c]/10"
                    )}>
                      <FileText size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={cn(
                          "font-extrabold text-slate-800 text-sm sm:text-base truncate tracking-tight",
                          isCancelled && "text-red-800 line-through"
                        )}>
                          {inv.client}
                        </h3>
                        {inv.folio && (
                          <span className="text-[10px] font-mono font-black bg-emerald-50/50 text-[#0b4d2c] border border-emerald-100/50 px-1.5 py-0.5 rounded-md">
                            FOLIO {inv.folio}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-1.5 flex-wrap">
                        <span className="font-semibold text-slate-550">{inv.id}</span>
                        <span>•</span>
                        <span className="font-bold text-[#0b4d2c] flex items-center gap-1">
                          <Clock size={12} className="text-slate-400" />
                          Hora: {hourStr}
                        </span>
                        <span>•</span>
                        <span className="bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 text-[10px] text-slate-650 font-sans notranslate" translate="no">
                          Vendedor: {getSellerName(inv.sellerId || '')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 md:gap-8 justify-between md:justify-end shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-left md:text-right">
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Monto</p>
                      <p className={cn("text-sm font-bold text-slate-700 font-mono", isCancelled && "line-through text-slate-400")}>
                        Q{inv.totalAmount.toFixed(2)}
                      </p>
                    </div>
                    
                    <div className="text-left md:text-right">
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Abonado</p>
                      <p className="text-sm font-bold text-teal-600 font-mono">
                        Q{(inv.paidAmount || 0).toFixed(2)}
                      </p>
                    </div>

                    <div className="text-left md:text-right">
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Restante</p>
                      <p className={cn(
                        "text-sm font-black font-mono",
                        pending > 0 && !isCancelled && !isRejected ? "text-orange-600" : "text-slate-500"
                      )}>
                        Q{isCancelled || isRejected ? "0.00" : pending.toFixed(2)}
                      </p>
                    </div>

                    <div className="text-right min-w-[110px] flex flex-col items-end justify-center gap-1.5">
                      {isCancelled || isRejected ? (
                        <span className="text-red-650 text-xs font-bold bg-red-50 border border-red-100 px-2.5 py-1 rounded-xl">
                          {isRejected ? 'Rechazada' : 'Anulada'}
                        </span>
                      ) : isPaid ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-bold bg-emerald-50 border border-emerald-100/50 px-2.5 py-1 rounded-xl">
                            <CheckCircle size={12}/> Pagado
                          </span>
                          {inv.trackingNumber && (
                            inv.shippingGuideUrl ? (
                              <button onClick={e => { e.stopPropagation(); setViewingImageConfig({ url: inv.shippingGuideUrl!, scanClient: inv.scanClient, scanDate: inv.scanDate, trackingNumber: inv.trackingNumber }); }} className="text-[9px] font-mono text-blue-500 font-bold bg-blue-50 px-1.5 py-0.5 rounded underline hover:text-blue-700">Guía: {inv.trackingNumber}</button>
                            ) : (
                              <span className="text-[9px] font-mono text-blue-500 font-bold bg-blue-50 px-1.5 py-0.5 rounded">Guía: {inv.trackingNumber}</span>
                            )
                          )}
                          {inv.deliveryLetterUrl && (
                            <a href={inv.deliveryLetterUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[9px] font-mono text-blue-500 font-bold bg-blue-550/10 px-1.5 py-0.5 rounded underline hover:text-blue-700">Carta Entregada</a>
                          )}
                        </div>
                      ) : isSent ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="inline-flex items-center gap-1 text-blue-700 text-xs font-bold bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-xl">
                            Enviada
                          </span>
                          {inv.trackingNumber && (
                            inv.shippingGuideUrl ? (
                              <button onClick={e => { e.stopPropagation(); setViewingImageConfig({ url: inv.shippingGuideUrl!, scanClient: inv.scanClient, scanDate: inv.scanDate, trackingNumber: inv.trackingNumber }); }} className="text-[9px] font-mono text-blue-500 font-bold bg-blue-50 px-1.5 py-0.5 rounded underline hover:text-blue-700">Guía: {inv.trackingNumber}</button>
                            ) : (
                              <span className="text-[9px] font-mono text-blue-500 font-bold bg-blue-50 px-1.5 py-0.5 rounded">Guía: {inv.trackingNumber}</span>
                            )
                          )}
                          {inv.deliveryLetterUrl && (
                            <a href={inv.deliveryLetterUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[9px] font-mono text-blue-500 font-bold bg-blue-550/10 px-1.5 py-0.5 rounded underline hover:text-blue-700">Carta Entregada</a>
                          )}
                        </div>
                      ) : needsAuth ? (
                        <span className="text-red-600 text-[10px] uppercase font-bold bg-red-50 border border-red-200 px-2.5 py-1 rounded-xl shadow-xs">
                          Alerta Costo
                        </span>
                      ) : (
                        <span className="text-orange-600 text-xs font-bold bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-xl">
                          Pendiente
                        </span>
                      )}

                      {!isCancelled && !isRejected && !isPaid && (
                        <span className={cn(
                          "text-[9px] font-black px-2 py-0.5 rounded-lg tracking-tight inline-block border",
                          (() => {
                            const days = Math.floor((Date.now() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24));
                            const limit = inv.creditDays || 30;
                            if (days <= limit) return 'bg-emerald-50/50 text-emerald-700 border-emerald-100';
                            if (days <= limit + 15) return 'bg-orange-50 text-orange-700 border-orange-100';
                            return 'bg-red-600 text-white border-red-700 shadow-sm';
                          })()
                        )}>
                          {(() => {
                            const days = Math.floor((Date.now() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24));
                            const limit = inv.creditDays || 30;
                            if (days > limit) return `Vencido +${days - limit}d`;
                            return `${days}d activo / Lím: ${limit}d`;
                          })()}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
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

    return (
      <div key={invoice.id} className={`border ${isCancelled ? 'border-red-200 opacity-60' : isRejected ? 'border-red-300 bg-red-50/10' : needsAuth ? 'border-red-400 bg-red-50/20' : isEdited ? 'border-orange-300 shadow-[0_0_10px_rgba(249,115,22,0.2)]' : 'border-neutral-200'} rounded-xl overflow-hidden relative`}>
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
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={`font-bold ${isCancelled ? 'text-red-800 line-through' : 'text-neutral-800'}`}>{invoice.client}</h3>
                {invoice.folio && (
                  <span className="text-[10px] font-mono font-black bg-emerald-50/50 text-[#0b4d2c] border border-emerald-100/50 px-1.5 py-0.5 rounded-md">
                    FOLIO {invoice.folio}
                  </span>
                )}
              </div>
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
                  {!isRejected && (
                    <>
                      <button
                        onClick={() => downloadInvoicePdf(invoice)}
                        className="flex items-center gap-1 text-xs font-bold bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg hover:bg-emerald-600 transition"
                      >
                        <Download size={14} /> PDF
                      </button>
                    </>
                  )}
                  {user.role === 'admin' ? (
                    <>
                      <select 
                          value={isRejected ? 'rejected' : invoice.status} 
                          disabled={isRejected}
                          onChange={(e) => handleUpdateStatus(invoice.id, e.target.value as any)}
                          className={cn(
                            "text-xs bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-lg px-2 py-1 outline-none",
                            isRejected && "opacity-50 cursor-not-allowed"
                          )}
                      >
                          {isRejected ? (
                            <option value="rejected">Rechazada</option>
                          ) : (
                            <>
                              <option value="pending">Pendiente</option>
                              <option value="paid">Completada</option>
                              <option value="rejected">Rechazada</option>
                            </>
                          )}
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
                            await api.updateInvoiceAuth(invoice.id, 'authorized');
                            setPendingReviewInvoiceId(invoice.id);
                            setShowSignaturePad(true);
                          }}
                          className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                         Autorizar y Firmar
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
                    {user.role === 'admin' && (
                       <button 
                         onClick={async () => {
                           if (!window.confirm('¿Revertir esta factura a estado Pendiente para intentar autorizarla de nuevo o editarla?')) return;
                           try {
                             await api.updateInvoiceAuth(invoice.id, 'pending');
                             await api.updateInvoiceStatus(invoice.id, 'pending');
                             alert("Factura restablecida a pendiente.");
                             loadInvoices();
                           } catch (err: any) {
                             alert("Error restableciendo: " + err.message);
                           }
                         }}
                         className="flex justify-center items-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all text-sm mb-2"
                       >
                          <RefreshCcw size={16} /> Restablecer a Pendiente
                       </button>
                    )}
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
              ) : (invoice.status === 'pending' || invoice.status === 'sent') && !isRejected ? (
                user.role === 'admin' ? (
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
                  <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-200 border-dashed text-center flex flex-col items-center justify-center min-h-[150px]">
                    <p className="text-sm font-semibold text-neutral-500">Solo los administradores están autorizados para registrar abonos.</p>
                  </div>
                )
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
                                {(user.role === 'admin' || user.role === 'seller') && (
                                  <a href={payment.receiptUrl} download={`boleta_${payment.id}.jpg`} className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-colors">
                                    <Download size={14} /> Descargar
                                  </a>
                                )}
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
      </div>
    );
  };


  return (
    <div className={`max-w-7xl mx-auto relative overflow-hidden ${isMobile ? 'p-4' : 'p-8'}`}>
      {/* Background Cinematic Floating Blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none -z-10">
        <motion.div
          animate={{
            x: [0, 45, -30, 0],
            y: [0, -50, 30, 0],
            scale: [1, 1.15, 0.95, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[15%] -left-[10%] w-[35rem] h-[35rem] bg-emerald-500/[0.04] rounded-full blur-[110px]"
        />
        <motion.div
          animate={{
            x: [0, -35, 40, 0],
            y: [0, 45, -60, 0],
            scale: [1, 0.9, 1.1, 1],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[40%] -right-[15%] w-[40rem] h-[40rem] bg-amber-500/[0.035] rounded-full blur-[130px]"
        />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <span className="hidden sm:inline">📊</span> {user.role === 'admin' ? 'Facturación & Créditos' : 'Mis Ventas'}
          </h1>
          <p className="text-slate-400 mt-1 font-medium text-sm">
            {user.role === 'admin' ? 'Gestión avanzada de cuentas por cobrar, abonos y folios' : 'Monitoreo de ventas diarias y créditos'}
          </p>
        </div>
        
        {/* Statistical Bento Deck */}
        <div className="flex flex-wrap items-center gap-4">
          <motion.div 
             whileHover={{ y: -3, scale: 1.02 }}
             onClick={() => setShowSalesModal(true)}
             className="relative overflow-hidden bg-[#0c5c35]/[0.02] hover:bg-[#0c5c35]/[0.05] border border-emerald-500/15 hover:border-emerald-500/30 rounded-2xl px-5 py-3.5 flex flex-col cursor-pointer transition-all shadow-xs shrink-0"
          >
            <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1.5 mb-1">
              <TrendingUp size={11} className="text-emerald-600 animate-pulse" /> Venta Directa
            </span>
            <span className="text-lg font-black text-[#0c5c35] leading-tight">Q{(dailyStats?.totalSales || 0).toFixed(2)}</span>
          </motion.div>
          
          <motion.div 
             whileHover={{ y: -3, scale: 1.02 }}
             onClick={() => setShowPaymentsModal(true)}
             className="relative overflow-hidden bg-teal-500/[0.02] hover:bg-teal-500/[0.05] border border-teal-500/15 hover:border-teal-500/30 rounded-2xl px-5 py-3.5 flex flex-col cursor-pointer transition-all shadow-xs shrink-0"
          >
            <span className="text-[9px] font-black text-teal-700 uppercase tracking-widest flex items-center gap-1.5 mb-1">
              <Receipt size={11} className="text-teal-600" /> Total Cobrado
            </span>
            <span className="text-lg font-black text-teal-700 leading-tight">Q{(dailyStats?.totalPayments || 0).toFixed(2)}</span>
          </motion.div>

          <motion.div 
             whileHover={{ y: -3, scale: 1.02 }}
             className="relative overflow-hidden bg-amber-500/[0.02] hover:bg-amber-500/[0.05] border border-amber-550/15 hover:border-amber-550/35 rounded-2xl px-5 py-3.5 flex flex-col transition-all shadow-xs shrink-0"
          >
            <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1.5 mb-1">
              <Clock size={11} className="text-amber-550" /> Cartera Pendiente
            </span>
            <span className="text-lg font-black text-amber-700 leading-tight">Q{totalPending.toFixed(2)}</span>
          </motion.div>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-[0_20px_50px_rgba(11,77,44,0.04)] border border-slate-200/70 p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-8 pb-8 border-b border-slate-100">
          
          {/* Enhanced Search Input */}
          <div className="relative w-full max-w-sm shrink-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Buscar por cliente, vendedor o ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50/50 hover:bg-slate-50/90 focus:bg-white border border-slate-200/80 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-[#0c5c35] outline-none transition-all text-sm font-semibold text-slate-800 placeholder:text-slate-400 shadow-sm"
            />
          </div>

          {/* Controls Shelf */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:justify-end">
            <label className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 bg-slate-50/50 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors text-xs font-bold text-slate-600 select-none">
              <input
                type="checkbox"
                checked={showCancelledAndRejected}
                onChange={(e) => setShowCancelledAndRejected(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
              />
              Mostrar Anuladas/Rechazadas
            </label>
            
            <div className="flex border border-slate-200 bg-slate-50 p-1 rounded-xl shadow-xs shrink-0">
              <button 
                type="button"
                onClick={() => setDateViewMode('day')}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all",
                  dateViewMode === 'day' 
                    ? "bg-[#0c5c35] text-white shadow-sm font-black" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                📆 Por Día
              </button>
              <button 
                type="button"
                onClick={() => setDateViewMode('all')}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all",
                  dateViewMode === 'all' 
                    ? "bg-[#0c5c35] text-white shadow-sm font-black" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                📋 Historial
              </button>
            </div>

            {dateViewMode === 'day' && (
              <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 px-3 py-2 rounded-xl transition-all shadow-xs">
                <input 
                  type="date" 
                  value={filterDate}
                  onChange={(e) => {
                    if (e.target.value) setFilterDate(e.target.value);
                  }}
                  className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setFilterDate(getLocalDateStr())}
                  className="text-[9px] font-black bg-[#0c5c35]/10 hover:bg-[#0c5c35]/20 text-[#0c5c35] px-2 py-1 rounded-md"
                >
                  Hoy
                </button>
              </div>
            )}

            {dateViewMode === 'all' && (
              <select 
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50 text-slate-800 outline-none shadow-xs cursor-pointer focus:border-[#0c5c35]"
              >
                <option value="all">Todas las fechas</option>
                <option value="today">Hoy (24 hrs)</option>
                <option value="week">Esta Semana</option>
                <option value="month">Este Mes</option>
              </select>
            )}

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider select-none">Vendedor:</span>
              <select
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
                className="text-xs font-extrabold text-slate-800 bg-transparent outline-none cursor-pointer pr-1"
              >
                <option value="all">Todos</option>
                {users.map(u => (
                  <option key={u.id} value={u.email} className="notranslate" translate="no">{u.name || u.email.split('@')[0]}</option>
                ))}
              </select>
            </div>

            {/* View Mode Segment Controllers */}
            <div className="flex border border-slate-200 bg-slate-50 p-1 rounded-xl shadow-xs shrink-0">
              <button 
                type="button"
                onClick={() => {
                  setDisplayMode('list');
                  setGroupBy('date');
                }}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                  displayMode === 'list' && groupBy === 'date'
                    ? "bg-[#0c5c35] text-white shadow-sm font-black" 
                    : "text-slate-500 hover:text-slate-800"
                )}
                title="Lista original en orden de hora"
              >
                🕒 Por Hora
              </button>
              <button 
                type="button"
                onClick={() => setDisplayMode('seller_cards')}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                  displayMode === 'seller_cards' 
                    ? "bg-[#0c5c35] text-white shadow-sm font-black" 
                    : "text-slate-500 hover:text-slate-800"
                )}
                title="Dividido por vendedores (Tarjetas)"
              >
                👥 Por Vendedor
              </button>
              <button 
                type="button"
                onClick={() => {
                  setDisplayMode('list');
                  setGroupBy('client');
                }}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                  displayMode === 'list' && groupBy === 'client'
                    ? "bg-[#0c5c35] text-white shadow-sm font-black" 
                    : "text-slate-500 hover:text-slate-800"
                )}
                title="Agrupado por Cliente"
              >
                👤 Por Cliente
              </button>
            </div>

          </div>
        </div>

        {loading ? (
          <div className="text-center py-24 text-slate-400 font-medium italic">Cargando facturas...</div>
        ) : (
          <>
            {filteredInvoices.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-50/40 border border-emerald-500/15 px-5 py-3.5 rounded-2xl flex flex-wrap items-center justify-between text-xs text-slate-500 font-semibold gap-3 mb-6"
              >
                <div>
                  Mostrando <span className="text-[#0c5c35] font-black">{filteredInvoices.length}</span> facturas filtradas
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    Venta: <span className="text-slate-800 font-extrabold font-mono">Q{filteredInvoices.reduce((sum, i) => i.status !== 'cancelled' && i.status !== 'rejected' ? sum + i.totalAmount : sum, 0).toFixed(2)}</span>
                  </div>
                  <div>
                    Cobrado: <span className="text-[#0c5c35] font-extrabold font-mono">Q{filteredInvoices.reduce((sum, i) => i.status !== 'cancelled' && i.status !== 'rejected' ? sum + (i.paidAmount || 0) : sum, 0).toFixed(2)}</span>
                  </div>
                  <div>
                    Cartera Pendiente: <span className="text-orange-650 font-black font-mono animate-pulse">Q{filteredInvoices.reduce((sum, i) => i.status !== 'cancelled' && i.status !== 'rejected' ? sum + (i.totalAmount - (i.paidAmount || 0)) : sum, 0).toFixed(2)}</span>
                  </div>
                </div>
              </motion.div>
            )}
            {renderInvoicesList()}
            {filteredInvoices.length === 0 && (
              <div className="text-center py-20 text-neutral-500">
                No hay facturas registradas.
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL CONFIGURACION DE PLANTILLA DE IMPRESION */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-neutral-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-neutral-800 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Settings size={20} className="text-green-400" />
                <h3 className="font-bold text-lg">Configuración de Plantilla de Factura (HTML)</h3>
              </div>
              <button 
                onClick={() => setShowTemplateModal(false)}
                className="text-neutral-400 hover:text-white text-lg font-bold outline-none"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="bg-blue-50 text-blue-800 text-xs p-4 rounded-xl border border-blue-100 space-y-2">
                <span className="font-bold block text-sm text-blue-900">💡 Guía de Personalización de Impresión:</span>
                <p>
                  Puedes personalizar el diseño de impresión usando código HTML y estilos CSS directamente. Utiliza los siguientes placeholders que el sistema reemplazará dinámicamente con los datos de cada factura:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono mt-2 bg-white/60 p-2.5 rounded-lg border border-blue-100 text-[11px]">
                  <div><strong>{"{{id}}"}</strong>: ID de venta</div>
                  <div><strong>{"{{client}}"}</strong>: Cliente</div>
                  <div><strong>{"{{phone}}"}</strong>: Teléfono</div>
                  <div><strong>{"{{address}}"}</strong>: Dirección</div>
                  <div><strong>{"{{folio}}"}</strong>: Folio #</div>
                  <div><strong>{"{{date}}"}</strong>: Fecha</div>
                  <div><strong>{"{{paymentForm}}"}</strong>: Forma Pago</div>
                  <div><strong>{"{{status}}"}</strong>: Estado</div>
                  <div><strong>{"{{sellerName}}"}</strong>: Vendedor</div>
                  <div><strong>{"{{totalAmount}}"}</strong>: Monto Total</div>
                  <div><strong>{"{{paidAmount}}"}</strong>: Monto Pagado</div>
                  <div><strong>{"{{dueAmount}}"}</strong>: Restante</div>
                  <div className="col-span-2"><strong>{"{{itemsTableRows}}"}</strong>: Filas de productos</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-neutral-700">Contenido HTML / CSS de la Plantilla:</label>
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded px-2.5 py-1 cursor-pointer flex items-center gap-1">
                      <Upload size={12} />
                      Subir archivo (.html o .txt)
                      <input
                        type="file"
                        accept=".html,.txt"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              const text = evt.target?.result as string;
                              if (text) {
                                setEditingTemplateText(text);
                              }
                            };
                            reader.readAsText(file);
                          }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('¿Seguro que deseas restablecer la plantilla al diseño por defecto? Se perderán las modificaciones locales.')) {
                          setEditingTemplateText(DEFAULT_PRINT_TEMPLATE);
                        }
                      }}
                      className="text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded"
                    >
                      Restablecer por Defecto
                    </button>
                  </div>
                </div>
                <textarea
                  value={editingTemplateText}
                  onChange={(e) => setEditingTemplateText(e.target.value)}
                  placeholder="Escribe o pega aquí el código HTML..."
                  className="w-full h-96 p-4 font-mono text-xs bg-neutral-950 text-green-400 border border-neutral-800 rounded-xl outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="bg-neutral-50 px-6 py-4 flex gap-3 justify-end border-t border-neutral-100 shrink-0">
              <button
                type="button"
                disabled={savingTemplate}
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-100 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingTemplate}
                onClick={async () => {
                  setSavingTemplate(true);
                  try {
                    await api.savePrintTemplate(editingTemplateText);
                    setPrintTemplate(editingTemplateText);
                    setShowTemplateModal(false);
                    alert('Plantilla de factura guardada correctamente y sincronizada en todo el sistema.');
                  } catch (err: any) {
                    alert(err.message || 'Error al guardar la plantilla');
                  } finally {
                    setSavingTemplate(false);
                  }
                }}
                className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5"
              >
                {savingTemplate ? 'Guardando...' : 'Guardar Plantilla'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal "Como en Inventario" */}
      {/* SALES MODAL */}
      {showSalesModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm shadow-2xl">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-teal-50">
              <h2 className="text-xl font-black text-teal-800 tracking-tight">Ventas por Vendedor (Hoy)</h2>
              <button onClick={() => setShowSalesModal(false)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-700 transition">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
               {dailyStats?.salesBySeller && Object.keys(dailyStats.salesBySeller).length > 0 ? (
                 Object.entries(dailyStats.salesBySeller)
                   .sort(([, a], [, b]) => (b as number) - (a as number))
                   .map(([sellerEmail, amt]: [string, any]) => (
                      <div key={sellerEmail} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="font-bold text-slate-700">{getSellerName(sellerEmail)}</span>
                        <span className="font-black text-teal-600 text-xl">Q{amt.toFixed(2)}</span>
                      </div>
                   ))
               ) : (
                 <p className="text-center text-slate-500 py-8">No hay ventas registradas hoy.</p>
               )}
            </div>
          </div>
        </div>
      )}

      {/* PAYMENTS MODAL */}
      {showPaymentsModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150 shadow-2xl">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-50">
              <h2 className="text-xl font-black text-blue-800 tracking-tight">Cobrado por Vendedor (Hoy)</h2>
              <button onClick={() => setShowPaymentsModal(false)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-700 transition">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
               {dailyStats?.paymentsBySeller && Object.keys(dailyStats.paymentsBySeller).length > 0 ? (
                 Object.entries(dailyStats.paymentsBySeller)
                   .sort(([, a], [, b]) => (b as number) - (a as number))
                   .map(([sellerEmail, amt]: [string, any]) => (
                      <div key={sellerEmail} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="font-bold text-slate-700">{getSellerName(sellerEmail)}</span>
                        <span className="font-black text-blue-600 text-xl">Q{amt.toFixed(2)}</span>
                      </div>
                   ))
               ) : (
                 <p className="text-center text-slate-500 py-8">No hay cobros registrados hoy.</p>
               )}
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
                  <span className="text-[10px] uppercase tracking-widest font-black text-slate-400 block">Detalles de Factura</span>
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
                    {user.role === 'admin' && (
                       <div className="col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <span className="text-slate-400 font-bold block">Folio Manual</span>
                            <p className="text-[9px] text-slate-400 uppercase font-black mb-1">Sobrescribe el correlativo automático</p>
                            <div className="flex gap-2">
                              <input 
                                type="number" 
                                value={manualFolio}
                                onChange={(e) => setManualFolio(e.target.value)}
                                placeholder="Folio #"
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1 text-xs font-bold focus:ring-1 focus:ring-teal-500 outline-none"
                              />
                              <button 
                                onClick={async () => {
                                   try {
                                      await api.updateInvoiceStatus(
                                        selectedInvoiceForModal.id, 
                                        selectedInvoiceForModal.status, 
                                        undefined,
                                        manualFolio ? parseInt(manualFolio) : undefined
                                      );
                                      alert("Folio actualizado.");
                                      loadInvoices();
                                      const refreshed = await api.getInvoices(user.role === 'admin' ? undefined : user.email);
                                      const current = refreshed.find(v => v.id === selectedInvoiceForModal.id);
                                      if (current) setSelectedInvoiceForModal(current);
                                   } catch(err: any) {
                                      alert(err.message);
                                   }
                                }}
                                className="px-3 py-1 bg-[#116858] text-white text-[10px] font-black uppercase rounded-lg hover:bg-[#0b4d2c] transition-colors whitespace-nowrap"
                              >
                                Guardar Folio
                              </button>
                            </div>
                          </div>
                       </div>
                    )}
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
                    <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-100 relative group">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Firma Revisión (Admin)</p>
                      {selectedInvoiceForModal.adminSignature ? (
                        <>
                          <img src={selectedInvoiceForModal.adminSignature} alt="Firma Admin" className="max-h-20 mx-auto" />
                          <p className="text-[9px] font-bold text-green-700 mt-1 uppercase">Revisado por: {selectedInvoiceForModal.reviewedBy}</p>
                        </>
                      ) : (
                        <div className="h-20 flex flex-col items-center justify-center gap-2">
                          <span className="text-gray-300 italic text-xs">Pendiente de revisión</span>
                          {user.role === 'admin' && (
                            <button 
                              onClick={() => {
                                setPendingReviewInvoiceId(selectedInvoiceForModal.id);
                                setShowSignaturePad(true);
                              }}
                              className="text-[10px] font-black text-blue-600 hover:text-blue-800 underline uppercase transition-colors"
                            >
                              Firmar Ahora
                            </button>
                          )}
                        </div>
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
                            setPendingReviewInvoiceId(selectedInvoiceForModal.id);
                            setShowSignaturePad(true);
                         }}
                         className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors"
                      >
                         Autorizar y Firmar
                      </button>
                      <button 
                         onClick={async () => {
                             try {
                               await api.updateInvoiceAuth(selectedInvoiceForModal.id, 'rejected');
                               await api.updateInvoiceStatus(selectedInvoiceForModal.id, 'rejected');
                               alert("Venta rechazada correctamente.");
                               const refreshedInvoices = await api.getInvoices(user.role === 'admin' ? undefined : user.email);
                               setInvoices(refreshedInvoices);
                               const updatedInvoice = refreshedInvoices.find(v => v.id === selectedInvoiceForModal.id);
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
                                        const refreshedInvoices = await api.getInvoices(user.role === 'admin' ? undefined : user.email);
                                        setInvoices(refreshedInvoices);
                                        const updatedInvoice = refreshedInvoices.find(v => v.id === selectedInvoiceForModal.id);
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
                                        const refreshedInvoices = await api.getInvoices(user.role === 'admin' ? undefined : user.email);
                                        setInvoices(refreshedInvoices);
                                        const updatedInvoice = refreshedInvoices.find(v => v.id === selectedInvoiceForModal.id);
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
                                    const refreshedInvoices = await api.getInvoices(user.role === 'admin' ? undefined : user.email);
                                    setInvoices(refreshedInvoices);
                                    const updatedInvoice = refreshedInvoices.find(v => v.id === selectedInvoiceForModal.id);
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
                      <span className="font-extrabold text-slate-200">{(selectedInvoiceForModal.sellerId || '').split('@')[0]}</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-800 pt-4 grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-slate-400 text-[10px] block font-bold">Total Factura</span>
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
                  {(selectedInvoiceForModal.status === 'pending' || user.role === 'admin') && (
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
                        const refreshedInvoices = await api.getInvoices(user.role === 'admin' ? undefined : user.email);
                        setInvoices(refreshedInvoices);
                        const currentUpdated = refreshedInvoices.find(v => v.id === selectedInvoiceForModal.id);
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
                          const refreshedInvoices = await api.getInvoices(user.role === 'admin' ? undefined : user.email);
                          setInvoices(refreshedInvoices);
                          const currentUpdated = refreshedInvoices.find(v => v.id === selectedInvoiceForModal.id);
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
                            const refreshedInvoices = await api.getInvoices(user.role === 'admin' ? undefined : user.email);
                            setInvoices(refreshedInvoices);
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
                              const refreshedInvoices = await api.getInvoices(user.role === 'admin' ? undefined : user.email);
                              setInvoices(refreshedInvoices);
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
      {showSignaturePad && (
        <SignaturePad 
          onSave={handleReviewSignature}
          onClose={() => setShowSignaturePad(false)}
          title="Firma de Revisión (Admin)"
        />
      )}
    </div>
  );
}
