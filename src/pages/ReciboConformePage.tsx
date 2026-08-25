import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../api';
import { Invoice, User, ReciboConforme } from '../types';
import { generateReciboConformeHtml, ReciboConformeOptions, printHtml, downloadHtmlAsPdf, formatDateSafe, formatMoney, cn } from '../utils';
import SignaturePad from '../components/SignaturePad';
import { 
  FileText, 
  Printer, 
  Download, 
  Search, 
  UserCheck, 
  PenTool, 
  FileSpreadsheet, 
  ShieldCheck, 
  RefreshCw, 
  Check, 
  Truck,
  Info,
  User as UserIcon,
  ChevronDown,
  FolderCheck,
  Eye,
  Calendar
} from 'lucide-react';

interface ReciboConformePageProps {
  user: User;
  isMobile?: boolean;
}

export function ReciboConformePage({ user, isMobile }: ReciboConformePageProps) {
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [teamUsers, setTeamUsers] = useState<User[]>([]);
  const [savedRecibos, setSavedRecibos] = useState<ReciboConforme[]>([]);
  const [activeTab, setActiveTab] = useState<'editor' | 'historial'>('editor');
  const [historialSearch, setHistorialSearch] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // Recipient form state (Empty by default so recipient fills it physically or user fills manually)
  const [receiverName, setReceiverName] = useState<string>('');
  const [receiverDpi, setReceiverDpi] = useState<string>('');
  const [receiverPhone, setReceiverPhone] = useState<string>('');
  const [receiverRelationship, setReceiverRelationship] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');
  const [includePrices, setIncludePrices] = useState<boolean>(true);

  // Delivery Person / Driver state
  const [deliveryType, setDeliveryType] = useState<string>('seller'); // 'seller' | 'current_user' | 'driver_custom' | 'user_id'
  const [customDeliveryName, setCustomDeliveryName] = useState<string>('');

  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load all invoices, users & saved receipts on mount
  const loadData = async () => {
    setLoading(true);
    try {
      const [invData, usersData, recibosData] = await Promise.all([
        api.getInvoices(user.role === 'admin' ? undefined : user.email).catch(() => []),
        api.getUsers().catch(() => []),
        api.getRecibosConformes().catch(() => [])
      ]);
      const list = Array.isArray(invData) ? invData : [];
      setAllInvoices(list);
      setTeamUsers(Array.isArray(usersData) ? usersData : []);
      setSavedRecibos(Array.isArray(recibosData) ? recibosData : []);
      if (list.length > 0 && !selectedInvoice) {
        setSelectedInvoice(list[0]);
      }
    } catch (e) {
      console.warn('Error loading data in ReciboConformePage:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // When selected invoice changes, recipient fields start blank
  useEffect(() => {
    if (selectedInvoice) {
      setReceiverName('');
      setReceiverDpi('');
      setReceiverPhone('');
      setReceiverRelationship('');
      setDeliveryNotes(selectedInvoice.notes || (selectedInvoice as any).observations || '');
      setSignatureImage(null);
    }
  }, [selectedInvoice]);

  // Handle outside click for dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute the effective name of who is delivering the merchandise
  const effectiveDeliveredBy = useMemo(() => {
    if (deliveryType === 'driver_custom') {
      return customDeliveryName.trim() || 'Piloto / Repartidor';
    }
    if (deliveryType === 'current_user') {
      return user?.name || 'Asesor Comercial';
    }
    if (deliveryType === 'seller') {
      if (selectedInvoice) {
        const sName = (selectedInvoice as any).sellerName || selectedInvoice.seller || (selectedInvoice as any).createdByName;
        if (sName && sName !== 'desconocido') return sName;
        // Try finding user by sellerId
        const found = teamUsers.find(u => u.id === selectedInvoice.sellerId || u.email === selectedInvoice.sellerId);
        if (found) return found.name;
      }
      return user?.name || 'Asesor Comercial';
    }
    // Specific team user selected
    const userFound = teamUsers.find(u => u.id === deliveryType);
    if (userFound) return userFound.name;
    return customDeliveryName.trim() || user?.name || 'Asesor / Piloto';
  }, [deliveryType, customDeliveryName, selectedInvoice, user, teamUsers]);

  // Filter invoices for folio selector
  const filteredInvoices = useMemo(() => {
    if (!searchTerm.trim()) {
      return allInvoices.slice(0, 30);
    }
    const s = searchTerm.toLowerCase().trim();
    return allInvoices.filter(inv => {
      const folio = String(inv.folio || '').toLowerCase();
      const id = String(inv.id || '').toLowerCase();
      const client = String(inv.client || inv.clientName || (inv as any).name || '').toLowerCase();
      const nit = String(inv.nit || '').toLowerCase();
      return folio.includes(s) || id.includes(s) || client.includes(s) || nit.includes(s);
    }).slice(0, 30);
  }, [allInvoices, searchTerm]);

  // Generate HTML
  const receiptHtml = useMemo(() => {
    if (!selectedInvoice) return '';
    const options: ReciboConformeOptions = {
      receiverName: receiverName.trim() || undefined,
      receiverDpi: receiverDpi.trim() || undefined,
      receiverPhone: receiverPhone.trim() || undefined,
      receiverRelationship: receiverRelationship.trim() || undefined,
      deliveryNotes: deliveryNotes.trim() || undefined,
      includePrices,
      signatureImage: signatureImage || undefined,
      deliveredBy: effectiveDeliveredBy,
      companyName: 'AGRICOVET DE GUATEMALA'
    };
    return generateReciboConformeHtml(selectedInvoice, options);
  }, [selectedInvoice, receiverName, receiverDpi, receiverPhone, receiverRelationship, deliveryNotes, includePrices, signatureImage, effectiveDeliveredBy]);

  // Update iframe preview
  useEffect(() => {
    if (iframeRef.current && receiptHtml) {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(receiptHtml);
        doc.close();
      }
    }
  }, [receiptHtml]);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleSaveToSupabase = async () => {
    if (!selectedInvoice) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const saved = await api.createReciboConforme({
        invoice_id: String(selectedInvoice.id),
        folio: String(selectedInvoice.folio || selectedInvoice.id.slice(0, 6)),
        receiver_name: receiverName.trim() || undefined,
        receiver_dpi: receiverDpi.trim() || undefined,
        receiver_phone: receiverPhone.trim() || undefined,
        receiver_relationship: receiverRelationship.trim() || undefined,
        delivery_location: selectedInvoice.address || undefined,
        delivery_notes: deliveryNotes.trim() || undefined,
        delivered_by: effectiveDeliveredBy,
        include_prices: includePrices,
        signature_data: signatureImage || undefined,
        created_by: user.name || user.email
      });
      if (saved) {
        setSavedRecibos(prev => [saved, ...prev.filter(r => r.id !== saved.id)]);
      }
      setSaveStatus('¡Recibo Conforme guardado en Supabase con éxito!');
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error al guardar en Supabase');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadSavedRecibo = (recibo: ReciboConforme) => {
    const matchedInv = allInvoices.find(i => String(i.id) === String(recibo.invoice_id) || String(i.folio) === String(recibo.folio));
    if (matchedInv) {
      setSelectedInvoice(matchedInv);
    }
    setReceiverName(recibo.receiver_name || '');
    setReceiverDpi(recibo.receiver_dpi || '');
    setReceiverPhone(recibo.receiver_phone || '');
    setReceiverRelationship(recibo.receiver_relationship || '');
    setDeliveryNotes(recibo.delivery_notes || '');
    setIncludePrices(recibo.include_prices !== false);
    if (recibo.signature_data) {
      setSignatureImage(recibo.signature_data);
    }
    if (recibo.delivered_by) {
      setDeliveryType('driver_custom');
      setCustomDeliveryName(recibo.delivered_by);
    }
    setActiveTab('editor');
  };

  const filteredSavedRecibos = useMemo(() => {
    if (!historialSearch.trim()) return savedRecibos;
    const term = historialSearch.toLowerCase();
    return savedRecibos.filter(r => 
      (r.folio && r.folio.toLowerCase().includes(term)) ||
      (r.receiver_name && r.receiver_name.toLowerCase().includes(term)) ||
      (r.receiver_dpi && r.receiver_dpi.toLowerCase().includes(term)) ||
      (r.delivered_by && r.delivered_by.toLowerCase().includes(term))
    );
  }, [savedRecibos, historialSearch]);

  const handlePrint = () => {
    if (receiptHtml) {
      printHtml(receiptHtml);
    }
  };

  const handleDownloadPdf = () => {
    if (receiptHtml && selectedInvoice) {
      const folioNum = selectedInvoice.folio || selectedInvoice.id.slice(0, 6);
      downloadHtmlAsPdf(receiptHtml, `Recibo-Conforme-Folio-${folioNum}.pdf`);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-emerald-800 text-xs font-black uppercase tracking-wider mb-1">
            <ShieldCheck size={16} className="text-emerald-700" />
            <span>Documentos Oficiales de Despacho</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Recibo Conforme de Entrega
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium mt-0.5">
            Genera la constancia de entrega con selector de folios, asignación de piloto y firma física/digital para <strong className="text-emerald-900">AGRICOVET DE GUATEMALA</strong>
          </p>
          {saveStatus && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-300 animate-in fade-in">
              <Check size={14} />
              <span>{saveStatus}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
            title="Recargar folios"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-emerald-700" : ""} />
            <span>Actualizar</span>
          </button>
          {activeTab === 'editor' && (
            <>
              <button
                onClick={handleSaveToSupabase}
                disabled={!selectedInvoice || isSaving}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <Check size={14} />
                <span>{isSaving ? 'Guardando...' : 'Guardar en Supabase'}</span>
              </button>
              <button
                onClick={handlePrint}
                disabled={!selectedInvoice}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <Printer size={14} className="text-emerald-700" />
                <span>Imprimir</span>
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={!selectedInvoice}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <Download size={14} />
                <span>Descargar PDF</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* TABS SWITCHER */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('editor')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer",
            activeTab === 'editor'
              ? "bg-emerald-700 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          <PenTool size={14} />
          <span>Generar / Imprimir Recibo</span>
        </button>

        <button
          onClick={() => setActiveTab('historial')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer",
            activeTab === 'historial'
              ? "bg-emerald-700 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          )}
        >
          <FolderCheck size={14} />
          <span>Historial Guardado en Supabase</span>
          <span className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-black",
            activeTab === 'historial' ? "bg-emerald-900 text-white" : "bg-emerald-100 text-emerald-800"
          )}>
            {savedRecibos.length}
          </span>
        </button>
      </div>

      {activeTab === 'historial' ? (
        /* HISTORIAL VIEW */
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <FolderCheck size={20} className="text-emerald-700" />
                <span>Historial de Recibos Guardados en Supabase</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Consulta los recibos conformes registrados en la base de datos con su piloto, receptor y firma digital.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por folio, receptor o piloto..."
                value={historialSearch}
                onChange={(e) => setHistorialSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-emerald-600 focus:bg-white transition-all"
              />
            </div>
          </div>

          {filteredSavedRecibos.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                <FolderCheck size={32} />
              </div>
              <h3 className="text-sm font-black text-slate-800">
                {savedRecibos.length === 0 ? "Aún no hay recibos guardados en Supabase" : "No se encontraron recibos con esa búsqueda"}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {savedRecibos.length === 0 
                  ? "Para guardar un recibo conforme, selecciona un Folio en la pestaña 'Generar / Imprimir Recibo', llena los datos de entrega y haz clic en 'Guardar en Supabase'."
                  : "Prueba buscando por otro término de Folio, DPI o nombre de receptor."}
              </p>
              {savedRecibos.length === 0 && (
                <button
                  onClick={() => setActiveTab('editor')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <PenTool size={14} />
                  <span>Ir al Generador de Recibos</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-black uppercase tracking-wider text-[10px] bg-slate-50/70">
                    <th className="py-3 px-4 rounded-l-xl">Fecha Registro</th>
                    <th className="py-3 px-4">Folio Venta</th>
                    <th className="py-3 px-4">Receptor Físico</th>
                    <th className="py-3 px-4">DPI / CUI</th>
                    <th className="py-3 px-4">Teléfono</th>
                    <th className="py-3 px-4">Despachó (Piloto / Asesor)</th>
                    <th className="py-3 px-4 text-center">Firma Digital</th>
                    <th className="py-3 px-4 text-right rounded-r-xl">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSavedRecibos.map((recibo) => {
                    const dateStr = recibo.created_at || recibo.delivery_date 
                      ? formatDateSafe(recibo.created_at || recibo.delivery_date) 
                      : 'N/A';
                    return (
                      <tr key={recibo.id || Math.random()} className="hover:bg-emerald-50/40 transition-colors group">
                        <td className="py-3.5 px-4 font-medium text-slate-500 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-slate-400" />
                            <span>{dateStr}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-mono font-black text-[11px]">
                            Folio #{recibo.folio}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          {recibo.receiver_name || <span className="text-slate-400 italic font-normal">Por llenar a mano</span>}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-mono">
                          {recibo.receiver_dpi || <span className="text-slate-400 italic font-normal font-sans">N/A</span>}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-mono">
                          {recibo.receiver_phone || <span className="text-slate-400 italic font-normal font-sans">N/A</span>}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                            <Truck size={13} className="text-emerald-700" />
                            <span>{recibo.delivered_by || 'Piloto / Asesor'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {recibo.signature_data ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Check size={11} />
                              <span>Firmado</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                              <span>Firma en papel</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleLoadSavedRecibo(recibo)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
                          >
                            <Eye size={13} />
                            <span>Ver / Imprimir</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* MAIN TWO COLUMN WORKSPACE (EDITOR) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: CONTROLS & FOLIO SELECTOR */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* 1. FOLIO SELECTOR CARD */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <label className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                  <Search size={14} className="text-emerald-700" />
                  <span>1. Seleccionar Folio / Venta</span>
                </label>
                <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
                  {allInvoices.length} ventas
                </span>
              </div>

              {/* SEARCH & DROPDOWN */}
              <div className="relative" ref={dropdownRef}>
                <div 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="px-2 py-1 bg-emerald-700 text-white font-mono text-xs font-black rounded-lg shrink-0">
                      {selectedInvoice ? `#${selectedInvoice.folio || selectedInvoice.id.substring(0, 5)}` : 'Folio'}
                    </span>
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {selectedInvoice 
                        ? `Folio #${selectedInvoice.folio || selectedInvoice.id.slice(0, 6)} · Q ${formatMoney(selectedInvoice.totalAmount ?? (selectedInvoice as any).total ?? 0)}`
                        : 'Elige un folio...'}
                    </span>
                  </div>
                  <ChevronDown size={16} className={cn("text-slate-400 transition-transform", isDropdownOpen && "rotate-180")} />
                </div>

                {/* DROPDOWN POPUP */}
                {isDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-72 overflow-y-auto p-2 space-y-1">
                    <div className="p-1 pb-2 border-b border-slate-100">
                      <input
                        type="text"
                        placeholder="Escribe número de folio..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-emerald-600 focus:bg-white"
                        autoFocus
                      />
                    </div>
                    {filteredInvoices.length === 0 ? (
                      <div className="text-center py-4 text-xs text-slate-400 font-bold">
                        No se encontraron folios
                      </div>
                    ) : (
                      filteredInvoices.map((inv) => {
                        const isSelected = selectedInvoice?.id === inv.id;
                        const folioNum = `#${inv.folio || inv.id.substring(0, 5)}`;
                        const total = inv.totalAmount ?? (inv as any).total ?? 0;
                        const dateStr = inv.date ? formatDateSafe(inv.date) : 'N/A';
                        return (
                          <button
                            key={inv.id}
                            type="button"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setIsDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full text-left p-2.5 rounded-xl flex items-center justify-between gap-2 transition-all cursor-pointer group",
                              isSelected ? "bg-emerald-50 text-emerald-950 font-bold" : "hover:bg-slate-50 text-slate-700"
                            )}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className={cn(
                                "px-2 py-0.5 rounded-lg text-[11px] font-mono font-black shrink-0",
                                isSelected ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-800 group-hover:bg-emerald-100 group-hover:text-emerald-800"
                              )}>
                                {folioNum}
                              </span>
                              <div className="truncate">
                                <div className="text-xs font-bold truncate text-slate-900">Folio {folioNum} ({inv.items?.length || 0} productos)</div>
                                <div className="text-[10px] text-slate-500">{dateStr}</div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-extrabold text-emerald-700">Q {formatMoney(total)}</span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* SALE SUMMARY SUMMARY CHIP */}
              {selectedInvoice ? (
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between border-b border-emerald-200/50 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-700 text-white font-mono text-[11px] font-black flex items-center justify-center">
                        #{selectedInvoice.folio || selectedInvoice.id.substring(0, 5)}
                      </span>
                      <span className="text-xs font-black text-emerald-950 truncate max-w-[190px]">
                        Folio #{selectedInvoice.folio || selectedInvoice.id.substring(0, 5)}
                      </span>
                    </div>
                    <span className="text-xs font-black text-emerald-800 font-mono">
                      Q {formatMoney(selectedInvoice.totalAmount ?? (selectedInvoice as any).total ?? 0)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div>
                      <span className="font-bold text-slate-500">Fecha Venta:</span> {selectedInvoice.date ? formatDateSafe(selectedInvoice.date) : 'N/A'}
                    </div>
                    <div>
                      <span className="font-bold text-slate-500">Destino:</span> {selectedInvoice.address || 'Guatemala'}
                    </div>
                    <div className="col-span-2">
                      <span className="font-bold text-slate-500">Productos:</span> {selectedInvoice.items?.length || 0} items registrados
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* 2. QUIÉN ENTREGA / PILOTO CARD */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <label className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                  <Truck size={14} className="text-emerald-700" />
                  <span>2. Responsable de la Entrega (Piloto / Asesor)</span>
                </label>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Seleccionar quién entrega la mercadería:
                  </label>
                  <select
                    value={deliveryType}
                    onChange={(e) => setDeliveryType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-emerald-600 focus:bg-white"
                  >
                    <option value="seller">Vendedor asignado a la venta</option>
                    <option value="current_user">Yo ({user.name || user.email})</option>
                    <optgroup label="Colaboradores del Equipo">
                      {teamUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role === 'admin' ? 'Admin' : 'Ventas'})</option>
                      ))}
                    </optgroup>
                    <option value="driver_custom">Otro piloto o transportista (Escribir nombre)...</option>
                  </select>
                </div>

                {deliveryType === 'driver_custom' && (
                  <div className="animate-in fade-in space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">
                      Nombre del Piloto o Empresa de Transporte:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Don Carlos Morales (Piloto) / Transportes Guate"
                      value={customDeliveryName}
                      onChange={(e) => setCustomDeliveryName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-emerald-600 focus:bg-white"
                    />
                  </div>
                )}

                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2 text-xs text-slate-600">
                  <Info size={14} className="text-emerald-700 shrink-0" />
                  <span>En el documento aparecerá: <strong className="text-slate-900">{effectiveDeliveredBy}</strong></span>
                </div>
              </div>
            </div>

            {/* 3. RECIPIENT INFORMATION CARD */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <label className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                  <UserCheck size={14} className="text-emerald-700" />
                  <span>3. Datos de Quien Recibe la Mercadería</span>
                </label>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg">
                  Llenado físico o digital
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Nombre Completo de Quien Recibe:
                  </label>
                  <input
                    type="text"
                    placeholder="Dejar en blanco para llenar a mano, o escribir nombre..."
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-emerald-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    No. de DPI / CUI:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 2450 18920 0101"
                    value={receiverDpi}
                    onChange={(e) => setReceiverDpi(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-emerald-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Teléfono de Contacto:
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 5544-3322"
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-emerald-600 focus:bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Relación / Cargo (Ej: Encargado de Finca, Chofer, Bodeguero):
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Encargado de granja / Mayordomo / Familiar"
                    value={receiverRelationship}
                    onChange={(e) => setReceiverRelationship(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-emerald-600 focus:bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Observaciones / Notas de Entrega:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Notas sobre el estado de la carga, bultos sellados, etc..."
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-emerald-600 focus:bg-white resize-none"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePrices}
                    onChange={(e) => setIncludePrices(e.target.checked)}
                    className="rounded text-emerald-700 focus:ring-emerald-600"
                  />
                  <span>Mostrar Precios y Totales en el Recibo</span>
                </label>
              </div>
            </div>

            {/* 4. DIGITAL SIGNATURE */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <label className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                  <PenTool size={14} className="text-emerald-700" />
                  <span>4. Firma Digital de Quien Recibe (Opcional)</span>
                </label>
                {signatureImage && (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    <Check size={12} />
                    <span>Firma capturada</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500">
                Si estás en un celular o tablet frente al cliente, puedes presionar para que firme con el dedo; de lo contrario, deja el documento listo para firmar con lapicero.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSignaturePad(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <PenTool size={14} />
                  <span>{signatureImage ? 'Cambiar Firma en Pantalla' : 'Firmar con el Dedo en Pantalla'}</span>
                </button>

                {signatureImage && (
                  <button
                    type="button"
                    onClick={() => setSignatureImage(null)}
                    className="px-3 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all cursor-pointer"
                  >
                    Limpiar Firma
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: REAL-TIME PREVIEW */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="bg-slate-900 text-white px-5 py-3.5 rounded-t-3xl flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-wider">
                  Vista Previa del Documento (Carta / Letter)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  disabled={!selectedInvoice}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Printer size={13} />
                  <span>Imprimir</span>
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={!selectedInvoice}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Download size={13} />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-100 p-2 md:p-4 rounded-b-3xl border border-slate-300 shadow-inner flex-1 min-h-[580px] flex justify-center">
              {selectedInvoice ? (
                <iframe
                  ref={iframeRef}
                  srcDoc={receiptHtml}
                  title="Vista Previa Recibo Conforme"
                  className="w-full h-full min-h-[600px] bg-white rounded-2xl shadow-md border border-slate-200"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 py-20">
                  <FileSpreadsheet size={40} className="text-slate-300" />
                  <p className="text-xs font-bold">Selecciona una venta para ver la hoja de entrega</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* SIGNATURE PAD MODAL */}
      {showSignaturePad && (
        <SignaturePad
          title="Firma de Recibido Conforme (Receptor)"
          onSave={(dataUrl) => {
            setSignatureImage(dataUrl);
            setShowSignaturePad(false);
          }}
          onClose={() => setShowSignaturePad(false)}
        />
      )}
    </div>
  );
}
