import React, { useState, useEffect, useRef } from 'react';
import { User, Invoice } from '../types';
import { api } from '../api';
import { 
  Clock, 
  Leaf,
  TrendingUp, 
  CheckCircle, 
  Package, 
  X, 
  Edit2, 
  Receipt, 
  ExternalLink, 
  Trash2, 
  ShieldAlert, 
  Database, 
  Search, 
  FileText,
  BarChart2,
  ArrowRight,
  Sparkles,
  Layers,
  Activity,
  TrendingDown,
  DollarSign,
  Award,
  Info,
  ChevronRight,
  RefreshCw,
  Printer,
  ScanLine,
  Download
} from 'lucide-react';
import { cn, generateDeliveryLetterHtml, printHtml, downloadHtmlAsPdf, compilePrintTemplate, DEFAULT_PRINT_TEMPLATE } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import { ShippingGuideModal } from '../components/ShippingGuideModal';
import { ImageModal } from '../components/ImageModal';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend as RechartsLegend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface DailySalesPageProps {
  user: User;
  isMobile?: boolean;
}

export function DailySalesPage({ user, isMobile }: DailySalesPageProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dailyStats, setDailyStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [trackingPromptFor, setTrackingPromptFor] = useState<string | null>(null);
  const [shippingModalConfig, setShippingModalConfig] = useState<{ id: string } | null>(null);
  const [viewingImageConfig, setViewingImageConfig] = useState<{ url: string; scanClient?: string; scanDate?: string; trackingNumber?: string } | null>(null);
  const [trackingGuideValue, setTrackingGuideValue] = useState('');
  const [deliveryLetterFile, setDeliveryLetterFile] = useState<File | null>(null);
  const [isUploadingLetter, setIsUploadingLetter] = useState(false);
  const [trackingMethodOverride, setTrackingMethodOverride] = useState<'guide' | 'personal'>('guide');
  
  // Clean sales/invoices database section state
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearConfirmationText, setClearConfirmationText] = useState('');
  const [clearPasswordInput, setClearPasswordInput] = useState('');
  const [isClearingLoading, setIsClearingLoading] = useState(false);
  const [selectedViewInvoice, setSelectedViewInvoice] = useState<Invoice | null>(null);
  const [manualFolio, setManualFolio] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [printTemplate, setPrintTemplate] = useState<string>(DEFAULT_PRINT_TEMPLATE);

  useEffect(() => {
    if (selectedViewInvoice) {
      setManualFolio(selectedViewInvoice.folio ? String(selectedViewInvoice.folio) : '');
    } else {
      setManualFolio('');
    }
  }, [selectedViewInvoice]);
  function getSellerName(email: string) {
    const u = users.find(user => user.email === email);
    return u ? u.name || email.split('@')[0] : (email || '').split('@')[0];
  }
  const getLocalDateStr = (d = new Date()) => {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  };

  const [filterDate, setFilterDate] = useState<string>(getLocalDateStr());
  const [dateViewMode, setDateViewMode] = useState<'day' | 'all'>('day');
  const [sellerFilter, setSellerFilter] = useState<string>(user.role === 'seller' ? user.email : 'all');
  const [displayMode, setDisplayMode] = useState<'list' | 'seller_cards'>('list');
  const [groupBy, setGroupBy] = useState<'date' | 'client'>('date');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [activeChartTab, setActiveChartTab] = useState<'hourly' | 'sellers' | 'status'>('hourly');
  const [showCharts, setShowCharts] = useState(true);

  useEffect(() => {
    loadData();
    api.getUsers().then(setUsers).catch(console.error);
    api.getPrintTemplate().then(data => setPrintTemplate(data.template || DEFAULT_PRINT_TEMPLATE)).catch(() => {});
    const interval = setInterval(loadData, 120000);
    return () => clearInterval(interval);
  }, [filterDate]);

  const loadData = async () => {
    try {
      const [invData, statsData] = await Promise.all([
        api.getInvoices(),
        api.getDailyStats(filterDate)
      ]);
      setInvoices(invData || []);
      setDailyStats(statsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSales = async () => {
    if (clearPasswordInput !== '123') {
      alert('Contraseña incorrecta. Por favor ingrese la contraseña de seguridad válida (123).');
      return;
    }
    if (clearConfirmationText.trim().toUpperCase() !== 'LIMPIAR') {
      alert('Por favor introduzca la palabra exacta "LIMPIAR" para confirmar la operación.');
      return;
    }
    try {
      setIsClearingLoading(true);
      await api.clearSales();
      alert('Ventas y abonos/boletas limpiados correctamente. ¡La base de datos está lista para producción!');
      setShowClearModal(false);
      setClearConfirmationText('');
      setClearPasswordInput('');
      await loadData();
    } catch (err: any) {
      alert('Error al limpiar facturas: ' + err.message);
    } finally {
      setIsClearingLoading(false);
    }
  };

  const executeMarkAsSent = async (id: string, gnum: string, isPersonal: boolean, shippingGuideUrl?: string, clientName?: string, shippingDate?: string) => {
    if (isPersonal) {
      if (!deliveryLetterFile) {
        alert('Debe subir la carta de entregado firmada por el cliente.');
        return;
      }
      try {
        setIsUploadingLetter(true);
        const { imageUrl } = await api.uploadReceiptFile(deliveryLetterFile);
        await api.updateInvoiceStatus(id, 'sent', undefined, undefined, imageUrl);
        alert('Factura marcada como entregada');
        setTrackingPromptFor(null);
        setDeliveryLetterFile(null);
        loadData();
      } catch(err: any) {
        alert('Error al subir la carta: ' + err.message);
      } finally {
        setIsUploadingLetter(false);
      }
      return;
    }

    if (!gnum || gnum.trim() === '') {
      alert('Debe ingresar un número de guía para etiquetar la factura como enviada.');
      return;
    }
    try {
      await api.updateInvoiceStatus(id, 'sent', gnum.trim(), undefined, undefined, shippingGuideUrl, clientName, shippingDate);
      alert('Factura marcada como enviada');
      setTrackingPromptFor(null);
      setTrackingGuideValue('');
      loadData();
    } catch(err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleMarkAsSent = (invoice: Invoice) => {
     setTrackingGuideValue('');
     setDeliveryLetterFile(null);
     setTrackingMethodOverride(invoice.transportMethod === 'personal' ? 'personal' : 'guide');
     setTrackingPromptFor(invoice.id);
  };

  // Central filter logic same as BillingPage
  const filteredInvoices = invoices.filter(i => {
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

    const matchSeller = sellerFilter === 'all' || i.sellerId === sellerFilter;

    return matchSearch && matchDate && matchSeller;
  });

  const renderInvoiceCard = (invoice: Invoice) => {
    const dateObj = new Date(invoice.date);
    const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = dateObj.toLocaleDateString();
    const isPaid = invoice.totalAmount <= (invoice.paidAmount || 0);

    let statusBadge;
    if (invoice.status === 'cancelled' || invoice.status === 'rejected') {
      statusBadge = <span className="text-red-600 text-xs font-bold bg-red-50 px-2.5 py-1 rounded-xl">Anulada</span>;
    } else if (invoice.status === 'sent') {
      statusBadge = (
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-blue-600 text-xs font-bold bg-blue-50 px-2.5 py-1 rounded-xl">Enviada</span>
          {invoice.trackingNumber && (
            invoice.shippingGuideUrl ? (
              <button onClick={(e) => { e.stopPropagation(); setViewingImageConfig({ url: invoice.shippingGuideUrl!, scanClient: invoice.scanClient, scanDate: invoice.scanDate, trackingNumber: invoice.trackingNumber }); }} className="text-[10px] text-blue-500 font-bold leading-none underline hover:text-blue-700">Guía: {invoice.trackingNumber}</button>
            ) : (
              <span className="text-[10px] text-blue-500 font-bold leading-none">Guía: {invoice.trackingNumber}</span>
            )
          )}
          {invoice.deliveryLetterUrl && (
            <a 
              href={invoice.deliveryLetterUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-[10px] text-blue-500 font-bold leading-none underline hover:text-blue-700 mt-0.5"
              onClick={e => e.stopPropagation()}
            >
              Ver Carta de Entrega
            </a>
          )}
        </div>
      );
    } else if (isPaid || invoice.status === 'paid') {
      statusBadge = (
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-green-600 text-xs font-bold bg-green-50 px-2.5 py-1 rounded-xl flex items-center gap-1"><CheckCircle size={12}/> Pagado</span>
          {invoice.trackingNumber && (
            invoice.shippingGuideUrl ? (
              <button onClick={(e) => { e.stopPropagation(); setViewingImageConfig({ url: invoice.shippingGuideUrl!, scanClient: invoice.scanClient, scanDate: invoice.scanDate, trackingNumber: invoice.trackingNumber }); }} className="text-[10px] text-blue-500 font-bold leading-none underline hover:text-blue-700">Guía: {invoice.trackingNumber}</button>
            ) : (
              <span className="text-[10px] text-blue-500 font-bold leading-none">Guía: {invoice.trackingNumber}</span>
            )
          )}
          {invoice.deliveryLetterUrl && (
            <a 
              href={invoice.deliveryLetterUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-[10px] text-blue-500 font-bold leading-none underline hover:text-blue-700 mt-0.5"
              onClick={e => e.stopPropagation()}
            >
              Ver Carta de Entrega
            </a>
          )}
        </div>
      );
    } else {
      statusBadge = <span className="text-orange-600 text-xs font-bold bg-orange-50 px-2.5 py-1 rounded-xl">Pendiente</span>;
    }

    const cardMotionProps = isMobile ? {
      initial: { opacity: 1, y: 0, scale: 1 },
      animate: { opacity: 1, y: 0, scale: 1 },
      transition: { duration: 0.1 }
    } : {
      initial: { opacity: 0, y: 50, scale: 0.95 },
      whileInView: { opacity: 1, y: 0, scale: 1 },
      viewport: { once: true, margin: "-40px" },
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
      whileHover: { 
        y: -8, 
        scale: 1.02, 
        boxShadow: "0 20px 40px rgba(11, 77, 44, 0.08)",
        borderColor: "rgba(11, 77, 44, 0.3)"
      }
    };

    return (
      <motion.div 
        key={invoice.id} 
        onClick={() => setSelectedViewInvoice(invoice)}
        {...cardMotionProps}
        className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm hover:shadow-2xl transition-all cursor-pointer relative overflow-hidden group/card"
      >
        {/* Glowing Decorative Color Band */}
        <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-[#0b4d2c] via-emerald-500 to-amber-500 group-hover/card:w-2.5 transition-all duration-300"></div>
        
        {/* Subtle Decorative Gold Dot */}
        <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-amber-400 rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <div className="flex justify-between items-start mb-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold text-slate-400 font-mono tracking-wider bg-slate-100/80 px-2 py-0.5 rounded-lg border border-slate-200/50 uppercase group-hover/card:bg-emerald-50 group-hover/card:text-emerald-800 transition-colors">
                #{invoice.folio}
              </span>
              { user.role === 'admin' && invoice.status !== 'sent' && (
                 <button 
                   onClick={(e) => {
                        e.stopPropagation();
                        localStorage.setItem('edit_invoice', JSON.stringify(invoice));
                        window.location.hash = 'sales';
                   }} 
                   className="text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-all p-1.5 rounded-xl border border-transparent hover:border-emerald-100 cursor-pointer active:scale-90"
                   title="Editar Venta"
                 >
                   <Edit2 size={12} />
                 </button>
              )}
            </div>
            <h3 className="font-hanken font-extrabold text-slate-800 line-clamp-1 text-[16px] notranslate group-hover/card:text-[#0b4d2c] transition-colors" translate="no">{invoice.client}</h3>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span>Vendedor:</span>
              <span className="text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{getSellerName(invoice.sellerId || '')}</span>
            </p>
          </div>
          
          <div className="text-right flex flex-col items-end gap-2.5">
			{invoice.status === 'sent' ? (
				<span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-xl">
					{dateString}
				</span>
			) : (
               <span className="text-xs font-black text-emerald-800 bg-emerald-50/80 px-2.5 py-1 rounded-xl flex items-center gap-1.5 font-mono border border-emerald-100">
                 <Clock size={12} className="text-emerald-600 animate-pulse" /> {timeString}
               </span>
			)}
			{statusBadge}
          </div>
        </div>

        {trackingPromptFor === invoice.id && (
          <div className="mb-4 p-4 border border-blue-100 bg-blue-50/50 rounded-2xl flex flex-col gap-3 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex gap-2 mb-1 bg-blue-100/50 p-1 rounded-xl">
              <button 
                onClick={(e) => { e.stopPropagation(); setTrackingMethodOverride('guide'); }}
                className={cn("flex-1 text-[10px] font-bold py-1.5 rounded-lg uppercase tracking-wider transition-all", trackingMethodOverride === 'guide' ? "bg-white text-blue-700 shadow-sm" : "text-blue-600/70 hover:bg-white/50")}
              >Guía / Paquetería</button>
              <button 
                onClick={(e) => { e.stopPropagation(); setTrackingMethodOverride('personal'); }}
                className={cn("flex-1 text-[10px] font-bold py-1.5 rounded-lg uppercase tracking-wider transition-all", trackingMethodOverride === 'personal' ? "bg-white text-blue-700 shadow-sm" : "text-blue-600/70 hover:bg-white/50")}
              >Entrega Personal</button>
            </div>
            {trackingMethodOverride === 'personal' ? (
              <>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <span className="text-xs font-bold text-blue-800">Entrega Personal - Carta de Conformidad:</span>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const seller = typeof invoice.sellerId === 'object' ? (invoice.sellerId as any).name : 'Vendedor';
                        const html = generateDeliveryLetterHtml(invoice, seller);
                        downloadHtmlAsPdf(html, `carta-entrega-${invoice.folio || invoice.id}.pdf`);
                      }}
                      className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all flex-1 sm:flex-initial cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Descargar PDF</span>
                    </button>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full items-center">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={e => setDeliveryLetterFile(e.target.files?.[0] || null)}
                    className="text-xs flex-1 w-full sm:w-auto border border-slate-200 rounded-xl px-2 py-1 bg-white min-w-0"
                  />
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={(e) => { e.stopPropagation(); executeMarkAsSent(invoice.id, '', true); }}
                      disabled={isUploadingLetter || !deliveryLetterFile}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2 px-4 rounded-xl transition cursor-pointer flex-1 sm:flex-none whitespace-nowrap disabled:opacity-50"
                    >
                      {isUploadingLetter ? 'Subiendo...' : 'Confirmar'}
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setTrackingPromptFor(null); setDeliveryLetterFile(null); }}
                      className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold py-2 px-3 rounded-xl transition cursor-pointer flex-shrink-0"
                    >
                      X
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <span className="text-xs font-bold text-blue-800">Ingrese el número de guía:</span>
                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  <div className="flex gap-2 w-full sm:flex-1">
                    <input 
                      type="text" 
                      value={trackingGuideValue}
                      onChange={e => setTrackingGuideValue(e.target.value)}
                      placeholder="Número de guía o boleta..."
                      className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs flex-1 outline-none bg-white font-semibold min-w-0"
                      autoFocus
                    />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShippingModalConfig({ id: invoice.id }); }}
                      className="text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-extrabold py-1.5 px-3 rounded-xl transition cursor-pointer flex-shrink-0 flex items-center justify-center"
                      title="Escanear Guía con IA"
                    >
                      <ScanLine size={16} />
                    </button>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={(e) => { e.stopPropagation(); executeMarkAsSent(invoice.id, trackingGuideValue, false); }}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2 px-4 rounded-xl transition cursor-pointer flex-1 sm:flex-none whitespace-nowrap"
                    >
                      Confirmar
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setTrackingPromptFor(null); }}
                      className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold py-2 px-3 rounded-xl transition cursor-pointer flex-shrink-0"
                    >
                      X
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="space-y-2.5 mt-5">
          <div className="flex flex-col gap-2">
            {invoice.items.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex justify-between text-[13px] items-center py-0.5 border-b border-slate-50 last:border-0">
                <div className="text-slate-600 flex flex-col truncate max-w-[70%]">
                  <div className="flex items-center gap-2 truncate font-medium">
                    <Package size={13} className="text-slate-400 flex-shrink-0 group-hover/card:text-emerald-500 transition-colors" />
                    <span className="truncate flex-1 notranslate text-slate-700 font-medium group-hover/card:text-slate-900 transition-colors" translate="no">
                      <strong className="font-extrabold text-slate-800 mr-1">{item.quantity}x</strong> {item.productName}
                    </span>
                  </div>
                  {item.color && item.size && (
                     <div className="ml-5 mt-0.5 whitespace-nowrap overflow-hidden">
                       <span className="inline-block px-1.5 py-0.5 bg-yellow-50 text-yellow-850 border border-yellow-250 text-[9px] font-black uppercase tracking-wider rounded-lg">
                         {item.color} - {item.size}
                       </span>
                     </div>
                  )}
                </div>
                <span className="font-extrabold text-slate-800 ml-2 font-mono group-hover/card:text-[#0b4d2c] transition-colors">Q{item.total.toFixed(2)}</span>
              </div>
            ))}
            {invoice.items.length > 3 && (
              <div className="text-xs text-slate-400 mt-1 italic pl-5 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                + {invoice.items.length - 3} artículos más
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 pt-3.5 border-t border-slate-100 flex justify-between items-center">
          <div className="flex flex-col gap-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Monto Total</p>
			{user.role === 'admin' && invoice.status === 'pending' && (
				<button 
				  onClick={(e) => { e.stopPropagation(); handleMarkAsSent(invoice); }}
				  className="text-[9px] font-black uppercase tracking-widest text-[#0b4d2c] hover:bg-emerald-50 border border-emerald-2500/20 px-2 py-1 rounded-lg mt-1 cursor-pointer hover:text-emerald-900 transition-all active:scale-95 flex items-center gap-1"
				>
				  <span>Marcar Enviado</span>
                  <ArrowRight size={10} className="group-hover/card:translate-x-1 transition-transform" />
				</button>
			)}
          </div>
          <div className="text-lg font-black text-[#0b4d2c] leading-none font-mono bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100/50 px-3 py-1.5 rounded-2xl group-hover/card:scale-105 group-hover/card:from-[#0b4d2c] group-hover/card:to-emerald-700 group-hover/card:text-white transition-all duration-300">
            Q{invoice.totalAmount.toFixed(2)}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderInvoicesList = () => {
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
          {Object.entries(invoicesBySeller).map(([sellerId, list]) => {
            const totalSellerAmount = list.reduce((sum, inv) => inv.status !== 'cancelled' && inv.status !== 'rejected' ? sum + inv.totalAmount : sum, 0);
            const totalSellerPaid = list.reduce((sum, inv) => inv.status !== 'cancelled' && inv.status !== 'rejected' ? sum + (inv.paidAmount || 0) : sum, 0);
            const totalSellerPending = totalSellerAmount - totalSellerPaid;

            return (
              <div key={sellerId} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col">
                <div className="bg-gradient-to-br from-teal-800 to-slate-900 text-white p-4">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#9ef1f1] bg-[#3a4859]/30 px-2.5 py-1 rounded-md">Vendedor</span>
                  <h3 className="font-black text-lg mt-1 tracking-tight truncate">
                    {getSellerName(sellerId)}
                  </h3>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/10 text-xs">
                    <div>
                      <p className="text-white/60">Pedidos</p>
                      <p className="font-bold text-sm text-[#9ef1f1]">{list.length}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/60">Total Venta</p>
                      <p className="font-bold text-sm text-yellow-300 font-mono">Q{totalSellerAmount.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 flex-1 divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {list.length > 0 ? (
                    list.map(inv => {
                      const isCancelled = inv.status === 'cancelled';
                      const isPaid = inv.status === 'paid' || inv.totalAmount <= (inv.paidAmount || 0);
                      const isRejected = inv.status === 'rejected';
                      const isSent = inv.status === 'sent';
                      const hourStr = inv.date ? new Date(inv.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
                      
                      return (
                        <div 
                          key={inv.id} 
                          onClick={() => setSelectedViewInvoice(inv)}
                          className="py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors duration-200"
                        >
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-black text-slate-400">{hourStr}</span>
                              <span className={`text-xs font-semibold ${isCancelled ? 'text-red-700 font-bold bg-red-50' : 'text-slate-800'} truncate block max-w-[145px] notranslate`} translate="no">
                                {inv.client}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 block truncate">#{inv.folio || inv.id.slice(0,8)}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-xs font-black text-slate-800 ${isCancelled && 'line-through text-red-500'} font-mono`}>
                              Q{inv.totalAmount.toFixed(2)}
                            </p>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide inline-block mt-0.5 ${
                              isCancelled || isRejected ? 'bg-red-50 text-red-600' :
                              isPaid ? 'bg-green-50 text-green-600' :
                              isSent ? 'bg-blue-50 text-blue-600 font-bold' :
                              'bg-orange-50 text-orange-600'
                            }`}>
                              {isCancelled ? 'Anulada' : isRejected ? 'Rechazada' : isPaid ? 'Pagado' : isSent ? 'Enviado' : 'Pendiente'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-6">Sin facturas.</p>
                  )}
                </div>
                
                <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 shrink-0">
                  <span>Pendiente:</span>
                  <span className="text-orange-600 text-sm font-extrabold font-mono">Q{totalSellerPending.toFixed(2)}</span>
                </div>
              </div>
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
      return Object.entries(grouped).map(([client, invs]) => {
        const invWithPhone = invs.find(i => Boolean(i.phone));
        const phone = invWithPhone?.phone || null;
        return (
          <div key={client} className="mb-8 p-6 bg-white border border-slate-200 shadow-sm rounded-2xl animate-in fade-in duration-150">
            <div className="mb-4 pb-2 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 max-w-full">
                  <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight break-words notranslate" translate="no">
                    {client}
                  </h2>
                  {phone && (
                    <a 
                      href={`tel:${phone.replace(/\D/g, '')}`} 
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full hover:bg-slate-200 transition-colors whitespace-nowrap"
                    >
                      📞 Llamar ({phone})
                    </a>
                  )}
                </div>
                <div className="self-start sm:self-center shrink-0">
                  <span className="inline-block text-sm font-medium text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-200 shadow-sm font-mono whitespace-nowrap">
                    Q{invs.reduce((sum, inv) => inv.status !== 'cancelled' && inv.status !== 'rejected' ? sum + (inv.totalAmount - (inv.paidAmount || 0)) : sum, 0).toFixed(2)} Deuda Pendiente
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {invs.map(renderInvoiceCard)}
            </div>
          </div>
        );
      });
    } else {
      // Default: Chronological list of invoice cards
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedInvoices.map(invoice => renderInvoiceCard(invoice))}
        </div>
      );
    }
  };
  // Cinematic and Dynamic stats memoized based on currently filtered invoices
  const computedStats = React.useMemo(() => {
    let sales = 0;
    let payments = 0;
    let pending = 0;
    let totalInvoices = 0;
    let sentCount = 0;
    let cancelledCount = 0;
    
    filteredInvoices.forEach(i => {
      if (i.status === 'cancelled' || i.status === 'rejected') {
        cancelledCount++;
      } else {
        sales += i.totalAmount || 0;
        payments += i.paidAmount || 0;
        pending += (i.totalAmount || 0) - (i.paidAmount || 0);
        totalInvoices++;
        if (i.status === 'sent') {
          sentCount++;
        }
      }
    });

    const commEstimate = sales * 0.025; // 2.5% projected commissions for the seller team
    return {
      sales,
      payments,
      pending,
      totalInvoices,
      sentCount,
      cancelledCount,
      commEstimate
    };
  }, [filteredInvoices]);

  const totalSalesAmount = computedStats.sales;
  const totalPaidAmount = computedStats.payments;

  // Hourly Trend Chart compiler
  const hourlyChartData = React.useMemo(() => {
    return Array.from({ length: 11 }, (_, i) => {
      const hour = i + 8; // 8:00 AM to 6:00 PM
      const displayHour = `${hour.toString().padStart(2, '0')}:00`;
      const amount = filteredInvoices
        .filter(inv => {
          if (!inv.date || inv.status === 'cancelled' || inv.status === 'rejected') return false;
          try {
            const h = new Date(inv.date).getHours();
            return h === hour;
          } catch (e) {
            return false;
          }
        })
        .reduce((sum, inv) => sum + inv.totalAmount, 0);
      return { hora: displayHour, Ventas: Number(amount.toFixed(2)) };
    });
  }, [filteredInvoices]);

  // Sellers Comparison Chart compiler
  const sellersChartData = React.useMemo(() => {
    const dataMap: Record<string, { seller: string, Ventas: number, Cobrado: number }> = {};
    filteredInvoices.forEach(inv => {
      if (inv.status === 'cancelled' || inv.status === 'rejected') return;
      const key = inv.sellerId || 'Desconocido';
      const name = getSellerName(key);
      if (!dataMap[key]) {
        dataMap[key] = { seller: name, Ventas: 0, Cobrado: 0 };
      }
      dataMap[key].Ventas += inv.totalAmount || 0;
      dataMap[key].Cobrado += inv.paidAmount || 0;
    });
    return Object.values(dataMap).map(item => ({
      ...item,
      Ventas: Number(item.Ventas.toFixed(2)),
      Cobrado: Number(item.Cobrado.toFixed(2))
    }));
  }, [filteredInvoices, users]);

  // Invoice Status Chart compiler
  const statusChartData = React.useMemo(() => {
    const dataMap: Record<string, number> = { 'Pagado': 0, 'Pendiente': 0, 'Enviada': 0, 'Anulada': 0 };
    filteredInvoices.forEach(inv => {
      const isPaid = inv.totalAmount <= (inv.paidAmount || 0);
      if (inv.status === 'cancelled' || inv.status === 'rejected') {
        dataMap['Anulada']++;
      } else if (inv.status === 'sent') {
        dataMap['Enviada']++;
      } else if (isPaid || inv.status === 'paid') {
        dataMap['Pagado']++;
      } else {
        dataMap['Pendiente']++;
      }
    });
    return Object.entries(dataMap).map(([name, value]) => ({ name, value }));
  }, [filteredInvoices]);

  const COLORS = ['#00696a', '#f59e0b', '#2563eb', '#ef4444'];

  if (loading && invoices.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 relative min-h-screen overflow-hidden">
        {/* Ambient background particles for loading state too */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-teal-500/10 to-transparent blur-3xl"></div>
        <div className="relative flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-slate-500 font-manrope tracking-widest uppercase animate-pulse">Sincronizando Sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/70 relative pb-[120px] md:pb-8 min-h-screen font-manrope">
      
      {/* Floating Ambient Blobs for Cinematic Depth */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        <motion.div 
          animate={{ y: [0, -25, 0], x: [0, 15, 0] }}
          transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
          className="absolute bg-emerald-400/8 blur-[120px] w-96 h-96 top-10 left-10 rounded-full"
        />
        <motion.div 
          animate={{ y: [0, 30, 0], x: [0, -20, 0] }}
          transition={{ repeat: Infinity, duration: 10, ease: "easeInOut", delay: 1 }}
          className="absolute bg-[#0b4d2c]/6 blur-[140px] w-[500px] h-[500px] bottom-32 right-10 rounded-full"
        />
        <motion.div 
          animate={{ y: [0, -15, 0], rotate: [0, 360, 0] }}
          transition={{ repeat: Infinity, duration: 14, ease: "easeInOut", delay: 0.5 }}
          className="absolute bg-blue-300/8 blur-[100px] w-72 h-72 top-1/2 left-1/3 rounded-full"
        />
        
        {/* Magic Floating Leaf and Sparkle Elements */}
        <motion.div 
          animate={{ 
            y: [0, -40, 0], 
            rotate: [0, 45, 0], 
            scale: [1, 1.15, 1],
            opacity: [0.05, 0.18, 0.05] 
          }}
          transition={{ repeat: Infinity, duration: 12, ease: "easeInOut" }}
          className="absolute top-24 left-[12%] text-emerald-900 pointer-events-none"
        >
          <Leaf size={120} className="blur-[1px]" />
        </motion.div>
        
        <motion.div 
          animate={{ 
            y: [0, 40, 0], 
            rotate: [0, -35, 0], 
            scale: [1, 0.88, 1],
            opacity: [0.04, 0.15, 0.04] 
          }}
          transition={{ repeat: Infinity, duration: 16, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-48 right-[8%] text-emerald-800 pointer-events-none"
        >
          <Sparkles size={140} className="blur-[2px]" />
        </motion.div>
      </div>

      {/* Header with Glassmorphism and Elegant Accents */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200/50 px-6 py-8 relative z-20 sticky top-0 shadow-xs">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 animate-pulse"></span>
              </span>
              <span className="text-[9px] font-black tracking-widest text-[#0b4d2c] uppercase bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-150 font-mono flex items-center gap-1">
                <Sparkles size={10} className="text-amber-500 animate-spin" />
                Panel Premium • Tiempo Real
              </span>
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3 font-hanken">
              <Clock className="text-[#0b4d2c] w-8 h-8 animate-pulse" />
              Ventas Diarias
            </h1>
            <p className="text-slate-400 text-xs font-semibold">
              Gestione registros, analice flujos de ingresos y exporte estados contables hoy ({new Date().toLocaleDateString()})
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <motion.div 
              whileHover={{ scale: 1.05, y: -2, boxShadow: "0 10px 25px rgba(11, 77, 44, 0.12)" }}
              onClick={() => setShowSalesModal(true)}
              className="bg-emerald-50/90 backdrop-blur-sm border border-emerald-100 rounded-2xl px-5 py-3 flex flex-col items-end cursor-pointer hover:bg-emerald-100/50 transition-all shadow-xs relative overflow-hidden group min-w-[130px]"
            >
              <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-[#0b4d2c] to-emerald-400 group-hover:w-2 transition-all"></div>
              <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest mb-1 font-mono">Total Vendido</span>
              <span className="text-xl font-black text-[#0b4d2c] font-mono group-hover:scale-105 transition-transform">Q{totalSalesAmount.toFixed(2)}</span>
            </motion.div>
            
            <motion.div 
              whileHover={{ scale: 1.05, y: -2, boxShadow: "0 10px 25px rgba(37, 99, 235, 0.12)" }}
              onClick={() => setShowPaymentsModal(true)}
              className="bg-blue-50/95 backdrop-blur-sm border border-blue-100 rounded-2xl px-5 py-3 flex flex-col items-end cursor-pointer hover:bg-blue-100/50 transition-all shadow-xs relative overflow-hidden group min-w-[130px]"
            >
              <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-blue-600 to-sky-450 group-hover:w-2 transition-all"></div>
              <span className="text-[9px] font-black text-blue-800 uppercase tracking-widest mb-1 font-mono">Cobrado</span>
              <span className="text-xl font-black text-blue-700 font-mono group-hover:scale-105 transition-transform">Q{totalPaidAmount.toFixed(2)}</span>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8 relative z-10">
        
        {/* Maintenance Alert (Admin-Only) */}
        {user.role === 'admin' && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-amber-50/70 to-orange-50/40 backdrop-blur-md border border-amber-200/80 rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl flex-shrink-0 border border-amber-200">
                <ShieldAlert size={20} className="animate-bounce" />
              </div>
              <div>
                <h3 className="font-extrabold text-amber-900 text-xs uppercase tracking-wide">Mantenimiento de Producción</h3>
                <p className="text-amber-700 text-[11px] mt-0.5 leading-relaxed font-semibold">
                  Elimine facturas y cobros de prueba para empezar de cero sin alterar productos ni clientes.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setClearConfirmationText('');
                setClearPasswordInput('');
                setShowClearModal(true);
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 flex-shrink-0 self-end sm:self-auto cursor-pointer"
            >
              <Trash2 size={12} />
              Limpiar Ventas
            </button>
          </motion.div>
        )}

        {/* 3-Column Bento-Grid Metrics Section - Magnificent Glass Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <motion.div 
            initial={{ opacity: 0, y: 35, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 100 }}
            whileHover={{ y: -8, boxShadow: "0 20px 30px rgba(11, 77, 44, 0.08)" }}
            className="bg-gradient-to-br from-white via-white to-emerald-50/30 backdrop-blur-md border border-slate-200/70 p-6 rounded-3xl shadow-sm relative overflow-hidden group hover:border-[#0b4d2c]/40 transition-all duration-300"
          >
            <div className="absolute top-0 right-0 p-4 text-emerald-850/5 group-hover:text-emerald-500/10 transition-colors pointer-events-none">
              <DollarSign size={55} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Ingreso Neto (Filt.)</p>
            <h4 className="text-2xl md:text-3xl font-black text-slate-800 mt-2 font-mono tracking-tight group-hover:text-[#0b4d2c] transition-colors">Q{computedStats.sales.toFixed(2)}</h4>
            <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold mt-3 bg-emerald-50/80 px-2 py-0.5 rounded-lg border border-emerald-100/30 w-fit">
              <TrendingUp size={12} className="animate-pulse" />
              <span>Venta Real Calculada</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 35, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 100 }}
            whileHover={{ y: -8, boxShadow: "0 20px 30px rgba(0, 105, 106, 0.08)" }}
            className="bg-gradient-to-br from-white via-white to-teal-50/30 backdrop-blur-md border border-slate-200/70 p-6 rounded-3xl shadow-sm relative overflow-hidden group hover:border-teal-500/40 transition-all duration-300"
          >
            <div className="absolute top-0 right-0 p-4 text-teal-850/5 group-hover:text-teal-500/10 transition-colors pointer-events-none">
              <CheckCircle size={55} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Total Cobrado</p>
            <h4 className="text-2xl md:text-3xl font-black text-[#00696a] mt-2 font-mono tracking-tight">Q{computedStats.payments.toFixed(2)}</h4>
            <div className="flex items-center gap-1 text-[10px] text-teal-700 font-bold mt-3 bg-teal-50/80 px-2 py-0.5 rounded-lg border border-teal-100/30 w-fit">
              <Activity size={12} />
              <span>Abonos Recibidos</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 35, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
            whileHover={{ y: -8, boxShadow: "0 20px 30px rgba(249, 115, 22, 0.08)" }}
            className="bg-gradient-to-br from-white via-white to-orange-50/30 backdrop-blur-md border border-slate-200/70 p-6 rounded-3xl shadow-sm relative overflow-hidden group hover:border-orange-500/40 transition-all duration-300"
          >
            <div className="absolute top-0 right-0 p-4 text-orange-850/5 group-hover:text-orange-500/10 transition-colors pointer-events-none">
              <TrendingDown size={55} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Deuda Pendiente</p>
            <h4 className="text-2xl md:text-3xl font-black text-orange-600 mt-2 font-mono tracking-tight">Q{computedStats.pending.toFixed(2)}</h4>
            <div className="flex items-center gap-1 text-[10px] text-orange-700 font-bold mt-3 bg-orange-50/80 px-2 py-0.5 rounded-lg border border-orange-100/30 w-fit">
              <span>Q{(computedStats.sales > 0 ? (computedStats.pending / computedStats.sales * 100) : 0).toFixed(0)}% Por Recaudar</span>
            </div>
          </motion.div>
        </div>

        {/* Cinematic Collapsible Interactive Analytics Panel */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-3xl p-6 shadow-sm overflow-hidden relative"
        >
          {/* Shine effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-teal-500/5 opacity-50 pointer-events-none"></div>
          
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 relative z-15">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-[#0b4d2c] to-emerald-600 text-white rounded-2xl shadow-md">
                <BarChart2 size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-800 tracking-tight font-hanken">Consola de Diagnóstico Comercial</h2>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Gráficas Interactivas de Rentabilidad en Tiempo Real</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowCharts(!showCharts)}
                className="text-xs font-black text-slate-650 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 transition-all cursor-pointer flex items-center gap-1"
              >
                {showCharts ? 'Ocultar Análisis' : 'Revelar Análisis'}
                <ChevronRight size={14} className={cn("transition-transform duration-300", showCharts ? "rotate-90" : "")} />
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {showCharts && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10"
              >
                {/* Graphics Tab Bar */}
                <div className="flex flex-wrap border-b border-slate-100 pb-3 mb-6 gap-2">
                  <button
                    onClick={() => setActiveChartTab('hourly')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-black tracking-wide cursor-pointer transition-all flex items-center gap-2",
                      activeChartTab === 'hourly'
                        ? "bg-[#0b4d2c] text-white shadow-md shadow-emerald-900/10"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent"
                    )}
                  >
                    <Clock size={14} />
                    Fluidez Temporal (Por Hora)
                  </button>
                  
                  <button
                    onClick={() => setActiveChartTab('sellers')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-black tracking-wide cursor-pointer transition-all flex items-center gap-2",
                      activeChartTab === 'sellers'
                        ? "bg-[#0b4d2c] text-white shadow-md shadow-emerald-900/10"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent"
                    )}
                  >
                    <BarChart2 size={14} />
                    Ventas vs Cobros (Por Colaborador)
                  </button>

                  <button
                    onClick={() => setActiveChartTab('status')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-black tracking-wide cursor-pointer transition-all flex items-center gap-2",
                      activeChartTab === 'status'
                        ? "bg-[#0b4d2c] text-white shadow-md shadow-emerald-900/10"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent"
                    )}
                  >
                    <Layers size={14} />
                    Distribución de Estados
                  </button>
                </div>

                {/* Render Selected Graphic */}
                <div className="h-[260px] w-full min-h-[260px] relative">
                  {filteredInvoices.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 italic text-xs gap-2">
                      <TrendingUp size={24} className="text-slate-300 pointer-events-none" />
                      Sin datos disponibles para graficar con los filtros actuales.
                    </div>
                  ) : activeChartTab === 'hourly' ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={hourlyChartData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0b4d2c" stopOpacity={0.65} />
                            <stop offset="95%" stopColor="#0b4d2c" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                        <XAxis dataKey="hora" tickLine={false} axisLine={false} tick={{ fontSize: 10, fontWeight: '700', fill: '#64748b' }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fontWeight: '700', fill: '#64748b' }} />
                        <RechartsTooltip 
                          contentStyle={{ 
                            background: 'rgba(11, 77, 44, 0.96)', 
                            backdropBlur: '8px', 
                            border: '1px solid rgba(255,255,255,0.15)', 
                            borderRadius: '16px', 
                            boxShadow: '0 20px 40px rgba(11, 77, 44, 0.15)' 
                          }}
                          itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: '800' }}
                          labelStyle={{ color: '#fbbf24', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '6px' }}
                          formatter={(value) => [`Q${parseFloat(value as string).toFixed(2)}`, 'Vendido']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="Ventas" 
                          stroke="#0b4d2c" 
                          strokeWidth={4.5} 
                          fillOpacity={1} 
                          fill="url(#colorSales)" 
                          activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff', fill: '#d97706' }} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : activeChartTab === 'sellers' ? (
                    sellersChartData.length === 0 ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 italic text-xs gap-2">
                        Sin datos de colaboradores registrados hoy.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sellersChartData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                          <XAxis dataKey="seller" tickLine={false} axisLine={false} tick={{ fontSize: 10, fontWeight: '700', fill: '#64748b' }} />
                          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fontWeight: '700', fill: '#64748b' }} />
                          <RechartsTooltip
                            contentStyle={{ 
                              background: 'rgba(30, 41, 59, 0.96)', 
                              backdropBlur: '8px', 
                              border: '1px solid rgba(255,255,255,0.1)', 
                              borderRadius: '16px', 
                              boxShadow: '0 20px 30px rgba(0,0,0,0.15)' 
                            }}
                            itemStyle={{ fontSize: '11px', fontWeight: '800', color: '#f1f5f9' }}
                            labelStyle={{ color: '#cbd5e1', fontSize: '10px', fontWeight: '900', marginBottom: '6px' }}
                            formatter={(value, name) => [`Q${parseFloat(value as string).toFixed(2)}`, name]}
                          />
                          <RechartsLegend wrapperStyle={{ fontSize: '11px', fontWeight: '800', fill: '#64748b' }} />
                          <Bar dataKey="Ventas" fill="#0b4d2c" radius={[8, 8, 0, 0]} maxBarSize={38} />
                          <Bar dataKey="Cobrado" fill="#2563eb" radius={[8, 8, 0, 0]} maxBarSize={38} />
                        </BarChart>
                      </ResponsiveContainer>
                    )
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full items-center">
                      <div className="md:col-span-5 h-[230px] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie 
                              data={statusChartData.filter(d => d.value > 0)}
                              cx="50%"
                              cy="50%"
                              innerRadius={65}
                              outerRadius={85}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {statusChartData.filter(d => d.value > 0).map((entry, index) => {
                                const matchedIndex = ['Pagado', 'Pendiente', 'Enviada', 'Anulada'].indexOf(entry.name);
                                const color = matchedIndex !== -1 ? COLORS[matchedIndex] : '#cbd5e1';
                                return <Cell key={`cell-${index}`} fill={color} stroke="none" />;
                              })}
                            </Pie>
                            <RechartsTooltip
                              contentStyle={{ 
                                background: 'rgba(30, 41, 59, 0.96)', 
                                backdropBlur: '8px', 
                                border: 'none', 
                                borderRadius: '16px', 
                                boxShadow: '0 15px 30px rgba(0,0,0,0.15)' 
                              }}
                              itemStyle={{ fontSize: '11px', fontWeight: '800', color: '#fff' }}
                              formatter={(value) => [`${value} Facturas`, 'Cantidad']}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      
                      {/* Interactive Legends & Summary values */}
                      <div className="md:col-span-7 space-y-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono block">Distribución de Boletas hoy</span>
                        <div className="grid grid-cols-2 gap-3">
                          {['Pagado', 'Pendiente', 'Enviada', 'Anulada'].map((statusKey, i) => {
                            const countVal = statusChartData.find(d => d.name === statusKey)?.value || 0;
                            return (
                              <div key={statusKey} className="flex items-center gap-3.5 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-150/60 hover:shadow-md transition-all relative overflow-hidden group/item">
                                <span className="h-5 w-1.5 rounded-full block group-hover/item:scale-y-125 transition-transform" style={{ backgroundColor: COLORS[i] }} />
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{statusKey}</span>
                                  <span className="text-base font-black text-slate-800 leading-none mt-1.5 font-mono">{countVal} <span className="text-[10px] text-slate-400 font-bold tracking-normal uppercase font-sans">facs</span></span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Unified Filters Panel with pristine styling & responsive sizing */}
        <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-sm border border-slate-200/60 p-6 relative">
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
            
            <div className="relative w-full lg:max-w-xs shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por cliente, vendedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-600 outline-none transition-all text-xs font-semibold"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:justify-end">
              
              <div className="flex border border-slate-200 bg-slate-50/50 p-1 rounded-xl shadow-xs">
                <button 
                  type="button"
                  onClick={() => setDateViewMode('day')}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-black rounded-lg transition-all cursor-pointer",
                    dateViewMode === 'day' 
                      ? "bg-slate-800 text-white shadow-sm" 
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  📆 Por Día
                </button>
                <button 
                  type="button"
                  onClick={() => setDateViewMode('all')}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-black rounded-lg transition-all cursor-pointer",
                    dateViewMode === 'all' 
                      ? "bg-slate-800 text-white shadow-sm" 
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  📋 Historial
                </button>
              </div>

              {dateViewMode === 'day' && (
                <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100/50 border border-slate-200 px-3 py-1.5 rounded-xl transition-all shadow-xs">
                  <input 
                    type="date" 
                    value={filterDate}
                    onChange={(e) => {
                      if (e.target.value) setFilterDate(e.target.value);
                    }}
                    className="text-[11px] font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setFilterDate(getLocalDateStr())}
                    className="text-[9px] font-black bg-emerald-55 border border-emerald-100 text-emerald-800 px-2 py-0.5 rounded cursor-pointer"
                  >
                    Hoy
                  </button>
                </div>
              )}

              {dateViewMode === 'all' && (
                <select 
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="px-3 py-1.5 text-[11px] font-extrabold border border-slate-200 rounded-xl bg-slate-50 text-slate-800 outline-none shadow-xs cursor-pointer"
                >
                  <option value="all">Todas las fechas</option>
                  <option value="today">Hoy (24 hrs)</option>
                  <option value="week">Esta Semana</option>
                  <option value="month">Este Mes</option>
                </select>
              )}

              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl shadow-xs">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider select-none">Vendedor:</span>
                <select
                  value={sellerFilter}
                  onChange={(e) => setSellerFilter(e.target.value)}
                  className="text-[11px] font-black text-slate-800 bg-transparent outline-none cursor-pointer pr-1"
                >
                  <option value="all">Todos</option>
                  {users.map(u => (
                    <option key={u.id} value={u.email}>{u.name || u.email.split('@')[0]}</option>
                  ))}
                </select>
              </div>

              <div className="flex border border-slate-200 bg-slate-50/50 p-1 rounded-xl shadow-xs">
                <button 
                  type="button"
                  onClick={() => {
                    setDisplayMode('list');
                    setGroupBy('date');
                  }}
                  className={cn(
                    "px-3 py-1 text-[11px] font-black rounded-lg transition-all cursor-pointer",
                    displayMode === 'list' && groupBy === 'date'
                      ? "bg-[#0b4d2c] text-white shadow-sm" 
                      : "text-slate-500 hover:text-slate-950"
                  )}
                >
                  🕒 Horario
                </button>
                <button 
                  type="button"
                  onClick={() => setDisplayMode('seller_cards')}
                  className={cn(
                    "px-3 py-1 text-[11px] font-black rounded-lg transition-all cursor-pointer",
                    displayMode === 'seller_cards' 
                      ? "bg-[#0b4d2c] text-white shadow-sm" 
                      : "text-slate-500 hover:text-slate-950"
                  )}
                >
                  👥 Vendedor
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setDisplayMode('list');
                    setGroupBy('client');
                  }}
                  className={cn(
                    "px-3 py-1 text-[11px] font-black rounded-lg transition-all cursor-pointer",
                    displayMode === 'list' && groupBy === 'client'
                      ? "bg-[#0b4d2c] text-white shadow-sm" 
                      : "text-slate-500 hover:text-slate-950"
                  )}
                >
                  👤 Cliente
                </button>
              </div>

            </div>
          </div>

          {/* Totals Summary Line */}
          {filteredInvoices.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-50 px-4 py-3.5 rounded-2xl border border-slate-200/50 flex flex-wrap items-center justify-between text-xs text-slate-500 font-bold gap-3 mb-6"
            >
              <div>
                Mostrando <span className="text-[#0b4d2c] font-black">{filteredInvoices.length}</span> ventas
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  Total: <span className="text-slate-900 font-black font-mono">Q{computedStats.sales.toFixed(2)}</span>
                </div>
                <div>
                  Cobrado: <span className="text-emerald-700 font-black font-mono">Q{computedStats.payments.toFixed(2)}</span>
                </div>
                <div>
                  Pendiente: <span className="text-orange-600 font-black font-mono">Q{computedStats.pending.toFixed(2)}</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Render List */}
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-20 text-slate-500 bg-slate-55 rounded-3xl border border-dashed border-slate-200">
              <TrendingUp size={48} className="mx-auto text-slate-350 mb-3" />
              <h3 className="text-base font-black text-slate-700">No hay ventas registradas</h3>
              <p className="text-slate-400 mt-2 text-xs font-semibold leading-relaxed max-w-sm mx-auto">
                Las ventas aparecerán aquí según los criterios de búsqueda, sincronización e intervalos seleccionados.
              </p>
            </div>
          ) : (
            renderInvoicesList()
          )}
        </div>
      </div>

      {showSalesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-teal-50">
              <h2 className="text-xl font-black text-teal-800 tracking-tight">Ventas por Vendedor</h2>
              <button onClick={() => setShowSalesModal(false)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-700 transition">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
               {dailyStats?.salesBySeller && Object.keys(dailyStats.salesBySeller).length > 0 ? (
                 Object.entries(dailyStats.salesBySeller)
                   .sort(([, a], [, b]) => (b as number) - (a as number))
                   .map(([seller, amt]: [string, any]) => (
                      <div key={seller} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="font-bold text-slate-700">{getSellerName(seller)}</span>
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

      {showPaymentsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-50">
              <div>
                <h2 className="text-xl font-black text-blue-800 tracking-tight flex items-center gap-2">
                  <Receipt className="text-blue-600" />
                  Control de Cobros y Boletas
                </h2>
                <p className="text-xs text-blue-600 font-medium mt-0.5">Gestione y verifique quién subió cada boleta, a qué factura corresponde y los acumulados por colaborador.</p>
              </div>
              <button onClick={() => setShowPaymentsModal(false)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-700 transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-8 bg-slate-50/50">
              {/* Left Column: Totales por Vendedor (span 5) */}
              <div className="md:col-span-5 space-y-4">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-blue-500 rounded-full"></span>
                  Cobros por Vendedor
                </h3>
                
                <div className="space-y-3">
                  {dailyStats?.paymentsBySeller && Object.keys(dailyStats.paymentsBySeller).length > 0 ? (
                    Object.entries(dailyStats.paymentsBySeller)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([seller, amt]: [string, any]) => (
                        <div key={seller} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow transition-shadow">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-800">{getSellerName(seller)}</span>
                            <span className="text-[10px] text-slate-400 font-medium block truncate max-w-[200px]">{seller}</span>
                          </div>
                          <span className="font-black text-blue-600 text-lg">Q{amt.toFixed(2)}</span>
                        </div>
                      ))
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-sm">
                      No hay cobros registrados hoy.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Detalle de cada Boleta (span 7) */}
              <div className="md:col-span-7 space-y-4">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-teal-500 rounded-full"></span>
                  Detalle de Boletas / Abonos ({dailyStats?.todayPaymentsDetail?.length || 0})
                </h3>

                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {dailyStats?.todayPaymentsDetail && dailyStats.todayPaymentsDetail.length > 0 ? (
                    dailyStats.todayPaymentsDetail.map((pay: any) => (
                      <div key={pay.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3 hover:border-blue-300 hover:shadow transition">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md font-mono">#{pay.invoiceFolio}</span>
                              <span className="text-slate-700 font-extrabold text-sm line-clamp-1">{pay.clientName}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-2 font-medium">
                              Subido por: <span className="font-black text-slate-700">{getSellerName(pay.recordedBy)}</span>
                            </p>
                          </div>
                          
                          <div className="text-right flex-shrink-0">
                            <span className="font-black text-emerald-600 text-base block">Q{pay.amount.toFixed(2)}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{pay.date ? new Date(pay.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                          </div>
                        </div>

                        {(pay.receiptUrl || pay.notes) && (
                          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-4">
                            <span className="text-xs text-slate-400 font-medium italic truncate max-w-[70%]">
                              {pay.notes || "Abono registrado"}
                            </span>
                            {pay.receiptUrl && (
                              <a 
                                href={pay.receiptUrl} 
                                target="_blank" 
                                referrerPolicy="no-referrer"
                                rel="noopener noreferrer" 
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-white hover:bg-teal-600 transition bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-lg"
                              >
                                <ExternalLink size={11} /> Ver Foto
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-sm">
                      No hay boletas ni fotos de pago subidas hoy.
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-5 bg-slate-100 border-t border-slate-200 text-right flex justify-between items-center px-8">
              <span className="text-sm font-bold text-slate-600">Monto total cobrado el día de hoy:</span>
              <span className="font-black text-blue-700 text-2xl">Q{totalPaidAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col scale-in">
            <div className="p-6 border-b border-rose-100 flex justify-between items-center bg-rose-50/80">
              <div className="flex items-center gap-2 text-rose-800">
                <ShieldAlert className="text-rose-600" size={24} />
                <h2 className="text-lg font-black tracking-tight">¿Limpiar Facturas de Depuración?</h2>
              </div>
              <button 
                onClick={() => {
                  if (!isClearingLoading) setShowClearModal(false);
                }} 
                className="p-1.5 bg-white rounded-full text-slate-400 hover:text-slate-700 transition"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-slate-600 text-sm leading-relaxed font-semibold">
                Esta acción es <span className="text-rose-600 font-extrabold uppercase">permanente e irreversible</span>. 
                Se eliminarán todas las facturas y abonos actuales con el fin de preparar su base de datos para producción.
              </p>
              
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs font-bold text-slate-500 space-y-2">
                <div className="flex gap-2 items-center text-emerald-700">
                  <Database size={14} className="flex-shrink-0" />
                  <span>Se conservará la lista de CLIENTES</span>
                </div>
                <div className="flex gap-2 items-center text-emerald-700">
                  <Database size={14} className="flex-shrink-0" />
                  <span>Se conservará el INVENTARIO y PRODUCTOS</span>
                </div>
                <div className="flex gap-2 items-center text-emerald-700">
                  <Database size={14} className="flex-shrink-0" />
                  <span>Se conservarán los usuarios y configuraciones</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 block uppercase tracking-wider">
                    Contraseña de Seguridad:
                  </label>
                  <input 
                    type="password"
                    placeholder="Contraseña (123)"
                    value={clearPasswordInput}
                    onChange={e => setClearPasswordInput(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold bg-white text-slate-800 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                    disabled={isClearingLoading}
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700 block uppercase tracking-wider">
                    Escriba la palabra <span className="text-rose-600 font-black">"LIMPIAR"</span> abajo:
                  </label>
                  <input 
                    type="text"
                    placeholder="Escriba LIMPIAR aquí..."
                    value={clearConfirmationText}
                    onChange={e => setClearConfirmationText(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold bg-white text-slate-800 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                    disabled={isClearingLoading}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end">
              <button
                onClick={() => {
                  if (!isClearingLoading) setShowClearModal(false);
                }}
                className="px-4 py-2 text-slate-500 text-xs font-extrabold rounded-xl hover:bg-slate-100 transition"
                disabled={isClearingLoading}
              >
                No, Cancelar
              </button>
              <button
                onClick={handleClearSales}
                disabled={isClearingLoading || clearPasswordInput !== '123' || clearConfirmationText.trim().toUpperCase() !== 'LIMPIAR'}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black rounded-xl shadow-sm transition flex items-center gap-2"
              >
                {isClearingLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Trash2 size={14} />
                )}
                {isClearingLoading ? 'Limpiando...' : 'Sí, Eliminar Permanentemente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: View Invoice Details */}
      {selectedViewInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">Detalle de Venta</h2>
                <p className="text-xs text-slate-500 font-medium">#{selectedViewInvoice.folio} • {new Date(selectedViewInvoice.date).toLocaleDateString()}</p>
              </div>
              <button onClick={() => setSelectedViewInvoice(null)} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-700 transition">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Cliente</p>
                <p className="font-bold text-slate-700">{selectedViewInvoice.client}</p>
                <p className="text-xs text-slate-500">NIT o C/F: {selectedViewInvoice.nit || 'C/F'}</p>
              </div>

              {user.role === 'admin' && (
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                  <div>
                    <span className="text-slate-400 font-black text-[10px] block uppercase tracking-wider">Folio Manual (Sobrescribir)</span>
                    <div className="flex gap-2 mt-1">
                      <input 
                        type="number" 
                        value={manualFolio}
                        onChange={(e) => setManualFolio(e.target.value)}
                        placeholder="Folio #"
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                      <button 
                        onClick={async () => {
                           try {
                              await api.updateInvoiceStatus(
                                selectedViewInvoice.id, 
                                selectedViewInvoice.status, 
                                undefined,
                                manualFolio ? parseInt(manualFolio) : undefined
                              );
                              alert("Folio actualizado.");
                              const nF = manualFolio ? parseInt(manualFolio) : selectedViewInvoice.folio;
                              setSelectedViewInvoice(prev => prev ? { ...prev, folio: nF } : null);
                              setInvoices(prev => prev.map(inv => inv.id === selectedViewInvoice.id ? { ...inv, folio: nF } : inv));
                              loadData();
                              return;
                           } catch(err: any) {
                              alert(err.message);
                           }
                        }}
                        className="px-4 py-1.5 bg-[#0b4d2c] text-white text-[10px] font-black uppercase rounded-lg hover:bg-emerald-900 transition-colors whitespace-nowrap"
                      >
                        Guardar Folio
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Artículos</p>
                <div className="space-y-3">
                  {selectedViewInvoice.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-sm font-bold text-slate-700 notranslate leading-tight" translate="no">{item.productName}</p>
                        <p className="text-xs text-slate-500 font-medium">{item.quantity} x Q{item.price.toFixed(2)}</p>
                      </div>
                      <span className="font-black text-slate-800 text-sm">Q{item.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Total</p>
                <p className="text-3xl font-black text-blue-600 leading-none">Q{selectedViewInvoice.totalAmount.toFixed(2)}</p>
              </div>

              {selectedViewInvoice.notes && selectedViewInvoice.notes.trim() && (
                <div className="mt-4 p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 shadow-sm rounded-2xl">
                   <p className="font-black text-amber-900 text-[11px] uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> 
                     Observaciones Importantes
                   </p>
                   <p className="text-amber-950 font-medium text-sm leading-relaxed whitespace-pre-wrap">{selectedViewInvoice.notes.trim()}</p>
                </div>
              )}

            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-2">
              <div>
                {(user.role === 'admin' || user.email === selectedViewInvoice.sellerId) && (
                  <button
                    onClick={async () => {
                      if (confirm('⚠️ ¿ELIMINAR PERMANENTEMENTE esta factura de la base de datos? Esta acción es irreversible y restaurará el stock de los productos.')) {
                        try {
                          await api.deleteInvoiceOriginal(selectedViewInvoice.id);
                          await loadData();
                          setSelectedViewInvoice(null);
                          alert('Factura eliminada para siempre de los registros.');
                        } catch (err: any) {
                          alert(err.message || 'Error al eliminar');
                        }
                      }
                    }}
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>Eliminar Factura</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    const sellerObj = users.find(u => u.id === selectedViewInvoice.sellerId || u.email === selectedViewInvoice.sellerId);
                    const sellerName = sellerObj ? sellerObj.name : (selectedViewInvoice.sellerId || 'Desconocido').split('@')[0];
                    const html = compilePrintTemplate(printTemplate, selectedViewInvoice, sellerName);
                    downloadHtmlAsPdf(html, `factura-${selectedViewInvoice.folio || selectedViewInvoice.id}.pdf`);
                  }}
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={14} /> Descargar PDF (Venta)
                </button>
              </div>
              <button onClick={() => setSelectedViewInvoice(null)} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition cursor-pointer">
                Cerrar
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
             executeMarkAsSent(shippingModalConfig.id, guide, false, imageUrl, clientName, shippingDate);
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
    </div>
  );
}
