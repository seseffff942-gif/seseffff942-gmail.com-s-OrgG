import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../api';
import { Invoice, User } from '../types';
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
  ChevronDown
} from 'lucide-react';

interface ReciboConformePageProps {
  user: User;
  isMobile?: boolean;
}

export function ReciboConformePage({ user, isMobile }: ReciboConformePageProps) {
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [teamUsers, setTeamUsers] = useState<User[]>([]);
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

  // Load all invoices & users on mount
  const loadData = async () => {
    setLoading(true);
    try {
      const [invData, usersData] = await Promise.all([
        api.getInvoices(user.role === 'admin' ? undefined : user.email).catch(() => []),
        api.getUsers().catch(() => [])
      ]);
      const list = Array.isArray(invData) ? invData : [];
      setAllInvoices(list);
      setTeamUsers(Array.isArray(usersData) ? usersData : []);
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
      await api.createReciboConforme({
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
      setSaveStatus('¡Recibo Conforme guardado en Supabase!');
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error al guardar en Supabase');
    } finally {
      setIsSaving(false);
    }
  };

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
        </div>
      </div>

      {/* MAIN TWO COLUMN WORKSPACE */}
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
              <span className="text-[10px] font-bold text-slate-400">
                {allInvoices.length} disponibles
              </span>
            </div>

            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Escribe el Folio (ej. 890), cliente o NIT..."
                  className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all shadow-inner"
                />
                <Search size={15} className="absolute left-3 top-3 text-slate-400" />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setIsDropdownOpen(true);
                    }}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* DROPDOWN MENU */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-40 max-h-64 overflow-y-auto p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                  {loading ? (
                    <div className="p-4 text-center text-xs text-slate-500 font-medium">
                      Cargando folios...
                    </div>
                  ) : filteredInvoices.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 font-medium">
                      No se encontraron folios coincidentes con "{searchTerm}"
                    </div>
                  ) : (
                    filteredInvoices.map((inv) => {
                      const isSelected = selectedInvoice?.id === inv.id;
                      const folioNum = inv.folio ? `#${inv.folio}` : `#${(inv.id || '').substring(0, 6)}`;
                      const itemsCount = inv.items?.length || 0;
                      const total = inv.totalAmount ?? (inv as any).total ?? 0;
                      const dateStr = inv.date ? formatDateSafe(inv.date) : '';

                      return (
                        <button
                          key={inv.id}
                          type="button"
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setSearchTerm(inv.folio ? String(inv.folio) : folioNum);
                            setIsDropdownOpen(false);
                          }}
                          className={cn(
                            "w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between cursor-pointer group",
                            isSelected 
                              ? "bg-emerald-50 text-emerald-950 border border-emerald-300 font-bold" 
                              : "hover:bg-slate-50 text-slate-700"
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <span className={cn(
                              "px-2 py-0.5 rounded-lg text-[11px] font-mono font-black shrink-0",
                              isSelected ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-800 group-hover:bg-emerald-100 group-hover:text-emerald-800"
                            )}>
                              {folioNum}
                            </span>
                            <div className="truncate">
                              <div className="text-xs font-bold truncate text-slate-900">Folio {folioNum} ({itemsCount} productos)</div>
                              <div className="text-[10px] text-slate-500">{dateStr}</div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-black text-emerald-700">Q {formatMoney(total)}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* SUMMARY CARD OF SELECTED FOLIO */}
            {selectedInvoice ? (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-emerald-700 text-white font-mono text-xs font-black flex items-center justify-center shadow-xs">
                      #{selectedInvoice.folio || selectedInvoice.id.substring(0, 5)}
                    </span>
                    <div>
                      <span className="text-xs font-black text-emerald-950 block truncate max-w-[200px]">
                        Folio #{selectedInvoice.folio || selectedInvoice.id.substring(0, 5)}
                      </span>
                      <span className="text-[10px] text-emerald-800 font-medium">
                        {selectedInvoice.items?.length || 0} producto(s) registrados
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-emerald-900 font-mono block">
                      Q {formatMoney(selectedInvoice.totalAmount ?? (selectedInvoice as any).total ?? 0)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {selectedInvoice.date ? formatDateSafe(selectedInvoice.date) : ''}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 space-y-0.5">
                  <p><strong className="text-slate-700">Lugar / Dirección:</strong> {selectedInvoice.address || 'Ciudad'}</p>
                  <p><strong className="text-slate-700">Artículos:</strong> {selectedInvoice.items?.length || 0} producto(s)</p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500">
                Selecciona un folio para cargar sus artículos y generar el recibo
              </div>
            )}
          </div>

          {/* 2. DELIVERY PERSON / DRIVER SELECTOR CARD */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <label className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                <Truck size={14} className="text-emerald-700" />
                <span>2. ¿Quién Entrega? (Asesor / Piloto)</span>
              </label>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Seleccionar Responsable de Entrega
                </label>
                <div className="relative">
                  <select
                    value={deliveryType}
                    onChange={(e) => setDeliveryType(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all appearance-none cursor-pointer pr-8"
                  >
                    <option value="seller">
                      Asesor de la Venta ({selectedInvoice ? ((selectedInvoice as any).sellerName || selectedInvoice.seller || 'Asignado en Venta') : 'Venta'})
                    </option>
                    <option value="current_user">
                      Yo ({user.name})
                    </option>
                    <optgroup label="Equipo Agricovet">
                      {teamUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role === 'admin' ? 'Admin' : 'Asesor'})
                        </option>
                      ))}
                    </optgroup>
                    <option value="driver_custom">
                      ✏️ Otro Piloto / Chofer / Transporte...
                    </option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {deliveryType === 'driver_custom' && (
                <div className="animate-in fade-in zoom-in-95 duration-150">
                  <label className="block text-[11px] font-bold text-emerald-800 mb-1">
                    Nombre del Piloto / Chofer / Transporte:
                  </label>
                  <input
                    type="text"
                    value={customDeliveryName}
                    onChange={(e) => setCustomDeliveryName(e.target.value)}
                    placeholder="Ej. Piloto Don Carlos Morales / Transportes Guate"
                    className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
                  />
                </div>
              )}

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 text-[11px] text-slate-600 flex items-center justify-between">
                <span className="font-bold text-slate-500">Aparecerá en el documento como:</span>
                <span className="font-extrabold text-emerald-900">{effectiveDeliveredBy}</span>
              </div>
            </div>
          </div>

          {/* 3. RECIPIENT DATA CARD (BLANK BY DEFAULT) */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <label className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                <UserCheck size={14} className="text-emerald-700" />
                <span>3. Datos de Quien Recibe (Receptor)</span>
              </label>
            </div>

            <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
              <Info size={16} className="text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>Nota:</strong> Estos campos están en blanco para que la persona que recibe los llene con lapicero al recibir, o puedes escribirlos aquí si ya los tienes.
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Nombre de quien Recibe (Opcional si llena a mano)
                </label>
                <input
                  type="text"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="Dejar en blanco para línea de firma o escribir nombre"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    No. DPI / CUI
                  </label>
                  <input
                    type="text"
                    value={receiverDpi}
                    onChange={(e) => setReceiverDpi(e.target.value)}
                    placeholder="Dejar en blanco o escribir"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Teléfono Receptor
                  </label>
                  <input
                    type="text"
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    placeholder="Dejar en blanco o escribir"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Relación / Cargo de quien recibe
                </label>
                <input
                  type="text"
                  value={receiverRelationship}
                  onChange={(e) => setReceiverRelationship(e.target.value)}
                  placeholder="Ej. Encargado de Finca, Bodeguero, Chofer, Familiar..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Observaciones de Entrega (Opcional)
                </label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  rows={2}
                  placeholder="Detalles sobre lugar de entrega, condición de bultos o notas especiales..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-all resize-none"
                />
              </div>

              {/* OPTIONS TOGGLE */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includePrices}
                    onChange={(e) => setIncludePrices(e.target.checked)}
                    className="w-4 h-4 text-emerald-700 rounded border-slate-300 focus:ring-emerald-600 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">Incluir precios y montos totales</span>
                </label>
              </div>
            </div>
          </div>

          {/* 4. SIGNATURE SECTION CARD */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <label className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                <PenTool size={14} className="text-emerald-700" />
                <span>4. Firma en Pantalla (Opcional)</span>
              </label>
              {signatureImage && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <Check size={12} /> Firma capturada
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
