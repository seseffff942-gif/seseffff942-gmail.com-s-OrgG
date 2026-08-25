import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  Printer, 
  Download, 
  PenTool, 
  FileText, 
  CheckCircle2, 
  User as UserIcon, 
  Hash, 
  DollarSign, 
  Calendar, 
  ShieldCheck, 
  Trash2,
  ChevronDown,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Invoice, User } from '../types';
import { api } from '../api';
import { 
  cn, 
  generateReciboConformeHtml, 
  ReciboConformeOptions, 
  printHtml, 
  downloadHtmlAsPdf,
  formatDateSafe,
  formatMoney
} from '../utils';
import SignaturePad from './SignaturePad';

interface ReciboConformeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialInvoice?: Invoice | null;
  initialFolio?: string | number;
  invoicesList?: Invoice[];
  currentUser?: User;
}

export const ReciboConformeModal: React.FC<ReciboConformeModalProps> = ({
  isOpen,
  onClose,
  initialInvoice,
  initialFolio,
  invoicesList,
  currentUser
}) => {
  const [allInvoices, setAllInvoices] = useState<Invoice[]>(invoicesList || []);
  const [loadingInvoices, setLoadingInvoices] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(initialInvoice || null);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // Receiver Form State (Starts empty so recipient can write it or user can type)
  const [receiverName, setReceiverName] = useState<string>('');
  const [receiverDpi, setReceiverDpi] = useState<string>('');
  const [receiverPhone, setReceiverPhone] = useState<string>('');
  const [receiverRelationship, setReceiverRelationship] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');
  const [includePrices, setIncludePrices] = useState<boolean>(true);

  // Delivery / Pilot State
  const [deliveryType, setDeliveryType] = useState<string>('seller');
  const [customDeliveryName, setCustomDeliveryName] = useState<string>('');
  const [teamUsers, setTeamUsers] = useState<User[]>([]);

  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load invoices and users if not supplied
  useEffect(() => {
    if (isOpen) {
      if (!invoicesList || invoicesList.length === 0) {
        setLoadingInvoices(true);
        api.getInvoices()
          .then((data) => {
            setAllInvoices(data || []);
          })
          .catch((err) => console.error('Error fetching invoices for Recibo Conforme:', err))
          .finally(() => setLoadingInvoices(false));
      } else {
        setAllInvoices(invoicesList);
      }

      api.getUsers().then(u => setTeamUsers(u || [])).catch(() => {});
    }
  }, [isOpen, invoicesList]);

  // Handle initial invoice / initial folio
  useEffect(() => {
    if (isOpen) {
      if (initialInvoice) {
        setSelectedInvoice(initialInvoice);
      } else if (initialFolio && allInvoices.length > 0) {
        const found = allInvoices.find(inv => 
          String(inv.folio) === String(initialFolio) || 
          String(inv.id).startsWith(String(initialFolio))
        );
        if (found) {
          setSelectedInvoice(found);
        }
      }
    }
  }, [isOpen, initialInvoice, initialFolio, allInvoices]);

  // When invoice changes, recipient fields start blank
  useEffect(() => {
    if (selectedInvoice) {
      setReceiverName('');
      setReceiverDpi('');
      setReceiverPhone('');
      setReceiverRelationship('');
      setDeliveryNotes(selectedInvoice.notes || (selectedInvoice as any).observations || '');
      setSignatureImage(null); // Reset signature for new selection
    }
  }, [selectedInvoice]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute effective delivery person name
  const effectiveDeliveredBy = useMemo(() => {
    if (deliveryType === 'driver_custom') {
      return customDeliveryName.trim() || 'Piloto / Repartidor';
    }
    if (deliveryType === 'current_user') {
      return currentUser?.name || 'Asesor Comercial';
    }
    if (deliveryType === 'seller') {
      if (selectedInvoice) {
        const sName = (selectedInvoice as any).sellerName || selectedInvoice.seller || (selectedInvoice as any).createdByName;
        if (sName && sName !== 'desconocido') return sName;
        const found = teamUsers.find(u => u.id === selectedInvoice.sellerId || u.email === selectedInvoice.sellerId);
        if (found) return found.name;
      }
      return currentUser?.name || 'Asesor Comercial';
    }
    const userFound = teamUsers.find(u => u.id === deliveryType);
    if (userFound) return userFound.name;
    return customDeliveryName.trim() || currentUser?.name || 'Asesor / Piloto';
  }, [deliveryType, customDeliveryName, selectedInvoice, currentUser, teamUsers]);

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

  // Generate HTML for preview and print/export
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

  // Update preview iframe
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

  const handlePrint = async () => {
    if (!receiptHtml) return;
    await printHtml(receiptHtml);
  };

  const handleDownloadPdf = async () => {
    if (!receiptHtml || !selectedInvoice) return;
    setIsGeneratingPdf(true);
    try {
      const folioStr = selectedInvoice.folio || (selectedInvoice.id ? selectedInvoice.id.substring(0, 8) : 'sin-folio');
      const filename = `recibo-conforme-folio-${folioStr}.pdf`;
      await downloadHtmlAsPdf(receiptHtml, filename);
    } catch (err) {
      console.error('Error generando PDF:', err);
      alert('Hubo un error al generar el PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="bg-white rounded-3xl w-full max-w-6xl h-[94vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200"
        >
          {/* TOP BAR */}
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-900 to-teal-900 text-white shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                <FileText size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-wide text-white">Recibo Conforme de Entrega</h2>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                    Constancia de Recepción
                  </span>
                </div>
                <p className="text-xs text-emerald-200/80">
                  Documento formal de entrega y firma de satisfacción del receptor
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* MAIN CONTENT: 2-PANE WORKSPACE */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-100/70">
            {/* LEFT PANE: FOLIO SELECTOR & RECIPIENT SETTINGS */}
            <div className="w-full lg:w-[420px] bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto p-4 sm:p-5 space-y-5 shrink-0 shadow-sm">
              {/* 1. FOLIO SEARCH & SELECTOR */}
              <div className="relative" ref={dropdownRef}>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5 flex items-center justify-between">
                  <span>1. Seleccionar Folio o Venta</span>
                  {selectedInvoice?.folio && (
                    <span className="text-emerald-700 font-bold font-mono">
                      Folio #{selectedInvoice.folio}
                    </span>
                  )}
                </label>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search size={16} />
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="Escribe el Folio (ej. 890), cliente o NIT..."
                    className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Dropdown list */}
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 max-h-60 overflow-y-auto p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                    {loadingInvoices ? (
                      <div className="p-4 text-center text-xs text-slate-500 font-medium">
                        Cargando folios...
                      </div>
                    ) : filteredInvoices.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500 font-medium">
                        No se encontraron ventas con el folio "{searchTerm}"
                      </div>
                    ) : (
                      filteredInvoices.map((inv) => {
                        const isSelected = selectedInvoice?.id === inv.id;
                        const folioNum = inv.folio ? `#${inv.folio}` : `#${(inv.id || '').substring(0, 6)}`;
                        const clientName = inv.client || inv.clientName || (inv as any).customerName || (inv as any).name || 'Sin nombre';
                        const total = inv.totalAmount ?? (inv as any).total ?? 0;
                        const dateStr = inv.date ? formatDateSafe(inv.date) : '';

                        return (
                          <button
                            key={inv.id}
                            type="button"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setSearchTerm(inv.folio ? String(inv.folio) : clientName);
                              setIsDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between cursor-pointer group",
                              isSelected 
                                ? "bg-emerald-50 text-emerald-950 border border-emerald-200 font-bold" 
                                : "hover:bg-slate-50 text-slate-700"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <span className={cn(
                                "px-2 py-0.5 rounded-lg text-[11px] font-mono font-black shrink-0",
                                isSelected ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-800 group-hover:bg-emerald-100 group-hover:text-emerald-800"
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
                      <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-mono text-[11px] font-black flex items-center justify-center">
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
                      <span className="font-bold text-slate-500">Teléfono:</span> {selectedInvoice.phone || 'N/A'}
                    </div>
                    <div className="col-span-2">
                      <span className="font-bold text-slate-500">Productos:</span> {selectedInvoice.items?.length || 0} items registrados
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center text-slate-500">
                  <Hash className="mx-auto mb-2 text-slate-400" size={28} />
                  <p className="text-xs font-bold text-slate-700">Ningún folio seleccionado</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Selecciona o busca un folio en el campo superior para cargar los datos de entrega.
                  </p>
                </div>
              )}

              {/* 2. DELIVERY PERSON / DRIVER FORM */}
              {selectedInvoice && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600">
                    2. ¿Quién Entrega? (Asesor / Piloto)
                  </label>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Responsable del Despacho:
                    </label>
                    <select
                      value={deliveryType}
                      onChange={(e) => setDeliveryType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                    >
                      <option value="seller">
                        Asesor de la Venta ({selectedInvoice ? ((selectedInvoice as any).sellerName || selectedInvoice.seller || 'Asignado') : 'Venta'})
                      </option>
                      <option value="current_user">
                        Yo ({currentUser?.name || 'Usuario Actual'})
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
                  </div>

                  {deliveryType === 'driver_custom' && (
                    <div className="animate-in fade-in zoom-in-95 duration-150">
                      <label className="block text-[11px] font-bold text-emerald-800 mb-1">
                        Nombre del Piloto / Chofer:
                      </label>
                      <input
                        type="text"
                        value={customDeliveryName}
                        onChange={(e) => setCustomDeliveryName(e.target.value)}
                        placeholder="Ej. Piloto Don Carlos Morales / Transportes Guate"
                        className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  )}

                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                    <span className="font-bold text-slate-500">Aparecerá como:</span>
                    <span className="font-extrabold text-emerald-900">{effectiveDeliveredBy}</span>
                  </div>
                </div>
              )}

              {/* 3. RECEPTOR DATA FORM (BLANK BY DEFAULT) */}
              {selectedInvoice && (
                <div className="space-y-4 pt-3 border-t border-slate-200">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600">
                    3. Datos de Quien Recibe la Mercadería
                  </label>

                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                    💡 <strong>Nota:</strong> Estos campos están en blanco para que la persona que recibe los llene con lapicero al recibir, o puedes escribirlos aquí si ya los tienes.
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Nombre del Receptor (Opcional):
                      </label>
                      <input
                        type="text"
                        value={receiverName}
                        onChange={(e) => setReceiverName(e.target.value)}
                        placeholder="Dejar en blanco para línea de firma o escribir"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          No. DPI / CUI:
                        </label>
                        <input
                          type="text"
                          value={receiverDpi}
                          onChange={(e) => setReceiverDpi(e.target.value)}
                          placeholder="Dejar en blanco o escribir"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Teléfono Receptor:
                        </label>
                        <input
                          type="text"
                          value={receiverPhone}
                          onChange={(e) => setReceiverPhone(e.target.value)}
                          placeholder="Dejar en blanco o escribir"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Relación / Cargo de quien recibe:
                      </label>
                      <input
                        type="text"
                        value={receiverRelationship}
                        onChange={(e) => setReceiverRelationship(e.target.value)}
                        placeholder="Ej. Encargado de Finca, Bodeguero, Chofer, Familiar..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Observaciones de Entrega:
                      </label>
                      <textarea
                        rows={2}
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        placeholder="Ej. Entregado en bodega principal, empaque sellado..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                      />
                    </div>

                    {/* TOGGLE INCLUDE PRICES */}
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-700">Incluir Precios y Totales:</span>
                      <button
                        type="button"
                        onClick={() => setIncludePrices(!includePrices)}
                        className={cn(
                          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                          includePrices ? "bg-emerald-600" : "bg-slate-300"
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                            includePrices ? "translate-x-5" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>

                    {/* DIGITAL SIGNATURE OPTION */}
                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                        Firma del Receptor:
                      </label>
                      {signatureImage ? (
                        <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <img src={signatureImage} alt="Firma" className="h-10 w-24 object-contain bg-white rounded border border-emerald-100 p-1" />
                            <span className="text-xs font-bold text-emerald-800">Firma Capturada</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSignatureImage(null)}
                            className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                            title="Borrar firma"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowSignaturePad(true)}
                            className="flex-1 py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                          >
                            <PenTool size={14} />
                            <span>Firmar en Pantalla</span>
                          </button>
                          <div className="text-[11px] text-slate-500 self-center font-medium">
                            (O en blanco para firmar con lapicero)
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT PANE: INTERACTIVE LIVE PREVIEW */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-200/80 p-3 sm:p-5">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Vista Previa del Documento
                  </span>
                  {selectedInvoice && (
                    <span className="text-[11px] font-mono font-bold bg-white text-emerald-800 px-2 py-0.5 rounded-lg border border-slate-300">
                      Tamaño Carta (8.5" x 11")
                    </span>
                  )}
                </div>

                {selectedInvoice && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow cursor-pointer"
                    >
                      <Printer size={15} />
                      <span>Imprimir</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={isGeneratingPdf}
                      className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow disabled:opacity-50 cursor-pointer"
                    >
                      <Download size={15} />
                      <span>{isGeneratingPdf ? 'Generando...' : 'Descargar PDF'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* DOCUMENT FRAME */}
              <div className="flex-1 bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-300 flex flex-col relative">
                {selectedInvoice ? (
                  <iframe
                    ref={iframeRef}
                    srcDoc={receiptHtml}
                    title="Vista Previa Recibo Conforme"
                    className="w-full h-full border-0 bg-white"
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-100 flex items-center justify-center text-emerald-700 mb-4 shadow-inner">
                      <FileText size={32} />
                    </div>
                    <h3 className="text-base font-extrabold text-slate-800">
                      Selecciona un folio para previsualizar el recibo
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      Elige el folio de venta (por ejemplo folio #890) en el panel izquierdo para cargar automáticamente los productos, montos y datos del cliente.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* FOOTER ACTIONS BAR */}
          <div className="px-6 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600" />
              <span>Constancia física de recepción a satisfacción conforme a la legislación mercantil de Guatemala.</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cerrar
              </button>
              {selectedInvoice && (
                <>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer"
                  >
                    <Printer size={14} />
                    <span>Imprimir Recibo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPdf}
                    className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-700/20 disabled:opacity-50 cursor-pointer"
                  >
                    <Download size={14} />
                    <span>{isGeneratingPdf ? 'Generando PDF...' : 'Descargar PDF'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* SIGNATURE CANVAS MODAL */}
      {showSignaturePad && (
        <SignaturePad
          title="Firma de Conformidad del Receptor"
          onClose={() => setShowSignaturePad(false)}
          onSave={(dataUrl) => {
            setSignatureImage(dataUrl);
            setShowSignaturePad(false);
          }}
        />
      )}
    </AnimatePresence>
  );
};
