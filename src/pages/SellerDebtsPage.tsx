import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Invoice, Payment, User } from '../types';
import { Search, Upload, CheckCircle, FileText, Download, User as UserIcon, ChevronDown, ChevronUp, PhoneCall, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SellerDebtsPageProps {
  user: User;
  isMobile?: boolean;
}

export function SellerDebtsPage({ user, isMobile }: SellerDebtsPageProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);
  const [invoicePayments, setInvoicePayments] = useState<Record<string, Payment[]>>({});

  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [suggestEditInvoice, setSuggestEditInvoice] = useState<Invoice | null>(null);
  const [suggestEditText, setSuggestEditText] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    if (expandedInvoice && !invoicePayments[expandedInvoice]) {
      api.getInvoicePayments(expandedInvoice).then(data => {
        setInvoicePayments(prev => ({ ...prev, [expandedInvoice]: data }));
      }).catch(console.error);
    }
  }, [expandedInvoice]);

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
      loadInvoices(); 
    } catch (error: any) {
      alert(`Error al registrar abono: ${error.message}`);
    } finally {
      setIsPaying(false);
    }
  };

  const pendingInvoices = invoices.filter(inv => inv.status === 'pending');
  const filteredInvoices = pendingInvoices.filter(inv => 
    (inv.id || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (inv.client || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (inv.sellerId || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPending = filteredInvoices.reduce((acc, inv) => acc + (inv.totalAmount - inv.paidAmount), 0);

  const renderInvoiceList = () => {
    const grouped: Record<string, Invoice[]> = {};
    filteredInvoices.forEach(inv => {
      const sellerKey = (inv.sellerId || 'Desconocido').split('@')[0];
      if (!grouped[sellerKey]) grouped[sellerKey] = [];
      grouped[sellerKey].push(inv);
    });

    return (
      <div className="space-y-4">
        {Object.entries(grouped).map(([seller, invs]) => {
          const isSellerExpanded = expandedSeller === seller;
          const totalDebt = invs.reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0);
          
          return (
            <div key={seller} className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
              <div 
                onClick={() => setExpandedSeller(isSellerExpanded ? null : seller)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-50 transition-colors bg-white"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-50 text-teal-600 font-bold border border-teal-100">
                    <UserIcon size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-neutral-800 capitalize leading-tight">{seller}</h2>
                    <p className="text-sm text-neutral-500 font-medium">
                      {invs.length} factura{invs.length !== 1 ? 's' : ''} pendiente{invs.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-sm font-black text-orange-600">
                      Q{totalDebt.toFixed(2)}
                    </span>
                    <p className="text-xs text-neutral-500 font-medium">Deuda Total</p>
                  </div>
                  <div className="text-neutral-400 bg-neutral-50 p-1.5 rounded-lg border border-neutral-100">
                    {isSellerExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>
              </div>

              {isSellerExpanded && (
                <div className="p-4 pt-0 border-t border-neutral-100 bg-neutral-50/50">
                  <div className="space-y-3 mt-4">
                    {invs.map(invoice => {
                      const pending = invoice.totalAmount - invoice.paidAmount;
                      const isExpanded = expandedInvoice === invoice.id;
                      
                      return (
                        <div key={invoice.id} className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
                          <div 
                            className="p-4 flex flex-wrap items-center justify-between cursor-pointer hover:bg-neutral-50 transition-colors bg-white"
                            onClick={(e) => {
                               e.stopPropagation();
                               setExpandedInvoice(isExpanded ? null : invoice.id);
                            }}
                          >
                            <div className="flex items-center gap-4 min-w-[200px]">
                              <div className="p-2 rounded-lg bg-orange-50 text-orange-700 font-bold border border-orange-100">
                                <FileText size={20} />
                              </div>
                              <div>
                                <div className="font-bold text-neutral-800">{invoice.client}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="text-xs text-neutral-500 font-mono">Factura: {invoice.id}</div>
                                  {invoice.phone && (
                                    <a 
                                      href={`tel:${String(invoice.phone).replace(/\D/g, '')}`} 
                                      onClick={e => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-[10px] font-bold transition-colors"
                                    >
                                      <PhoneCall size={10} /> Llamar
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
        
                            <div className="flex items-center gap-6 mt-4 sm:mt-0 w-full sm:w-auto">
                              <div className="text-left sm:text-right flex-1">
                                <div className="text-xs text-neutral-500 uppercase tracking-wider font-bold mb-0.5">Pendiente</div>
                                <div className="text-lg font-black text-orange-600">Q{pending.toFixed(2)}</div>
                              </div>
                              <div className="text-neutral-400">
                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                              </div>
                            </div>
                          </div>

                  {isExpanded && (
                    <div className="p-4 border-t border-neutral-200 bg-white">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Registrar Abono */}
                        {user.role === 'admin' || invoice.sellerId === user.email || invoice.sellerId === user.id ? (
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
                                  <label className="flex items-center gap-2 cursor-pointer w-full justify-center">
                                    <Upload size={18} className="text-teal-600" />
                                    <span className="text-sm font-medium text-neutral-600">
                                      {paymentFile ? paymentFile.name : 'Seleccionar archivo...'}
                                    </span>
                                    <input 
                                      ref={fileInputRef}
                                      type="file" 
                                      accept="image/*" 
                                      className="hidden"
                                      onChange={e => {
                                        if (e.target.files && e.target.files[0]) {
                                          setPaymentFile(e.target.files[0]);
                                        }
                                      }}
                                    />
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
                          <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-200 border-dashed flex flex-col items-center justify-center text-center">
                            <p className="text-sm font-semibold text-neutral-500 mb-3">Solo administradores autorizados pueden registrar abonos directos.</p>
                            <button
                              onClick={() => setSuggestEditInvoice(invoice)}
                              className="px-4 py-2.5 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                              Sugerir Abono / Edición
                            </button>
                          </div>
                        )}

                        {/* Abonos Previos */}
                        <div className="border-t border-neutral-100 md:border-t-0 pt-6 md:pt-0">
                           <h4 className="text-sm font-bold text-neutral-800 uppercase tracking-wide mb-4">Boletas Subidas</h4>
                           {invoicePayments[invoice.id] && invoicePayments[invoice.id].length > 0 ? (
                            <div className="overflow-x-auto rounded-xl border border-neutral-200">
                              <table className="w-full text-left text-sm">
                                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500">
                                  <tr>
                                    <th className="px-4 py-3 font-semibold text-xs tracking-wider uppercase">Fecha</th>
                                    <th className="px-4 py-3 font-semibold text-xs tracking-wider uppercase">Abonado</th>
                                    <th className="px-4 py-3 font-semibold text-xs tracking-wider uppercase">Boleta</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                  {invoicePayments[invoice.id].map(payment => (
                                    <tr key={payment.id} className="hover:bg-neutral-50/50 transition-colors">
                                      <td className="px-4 py-3 text-neutral-600 font-medium">
                                        {payment.date ? format(new Date(payment.date), "dd MMM, HH:mm", { locale: es }) : 'N/A'}
                                      </td>
                                      <td className="px-4 py-3 font-bold text-emerald-600">
                                        Q{payment.amount.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 flex gap-2">
                                        {payment.receiptUrl ? (
                                          <>
                                            <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-xs font-bold transition-colors">
                                              Ver
                                            </a>
                                            {(user.role === 'admin' || user.role === 'seller') && (
                                              <a href={payment.receiptUrl} download={`boleta_${payment.id}.jpg`} className="px-2 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded text-xs font-bold transition-colors">
                                                Descargar
                                              </a>
                                            )}
                                          </>
                                        ) : (
                                          <span className="text-neutral-400 text-xs italic">Sin comprobante</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                           ) : (
                             <div className="text-sm text-neutral-500 bg-neutral-50 rounded-xl p-4 border border-neutral-200 text-center">
                               No hay abonos registrados para esta cuenta.
                             </div>
                           )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`max-w-7xl mx-auto ${isMobile ? 'p-4' : 'p-8'}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800">Registro de Ventas y Deudas</h1>
          <p className="text-neutral-500">Comprueba deudas y sube boletas de pago</p>
        </div>
        
        <div className="bg-white px-6 py-4 rounded-xl shadow-sm border border-neutral-100 flex flex-col items-end">
          <span className="text-sm text-neutral-500 font-medium">
            {user.role === 'admin' ? 'Deuda Total de Vendedores' : 'Mi Deuda Pendiente'}
          </span>
          <span className="text-3xl font-black text-orange-600 block mt-1">Q{totalPending.toFixed(2)}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6">
        <div className="mb-6 relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por cliente, vendedor o No. Factura..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none"
          />
        </div>

        {loading ? (
          <div className="text-center py-20 text-neutral-400">Cargando registros...</div>
        ) : (
          <>
            {renderInvoiceList()}
            {filteredInvoices.length === 0 && (
              <div className="text-center py-20 text-neutral-500">
                No hay deudas registradas.
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL: SUGERIR ABONO / EDICIÓN */}
      {suggestEditInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[120] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-800 text-lg">Sugerir Abono o Edición</h3>
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Factura #{suggestEditInvoice.folio || suggestEditInvoice.id.slice(0, 8)}
                </p>
              </div>
              <button onClick={() => { setSuggestEditInvoice(null); setSuggestEditText(''); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">
                  Detalles del Abono o Cambio
                </label>
                <textarea
                  value={suggestEditText}
                  onChange={(e) => setSuggestEditText(e.target.value)}
                  className="w-full h-32 p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none animate-none"
                  placeholder="Ej: Deseo reportar abono de Q500 con boleta adjunta, o modificar datos de crédito..."
                ></textarea>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Esto abrirá WhatsApp para que envíes tu solicitud de abono o edición al grupo o a los administradores. Esta acción no modificará el estado de la deuda hasta que sea aprobada y realizada por un administrador.
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
                  const message = `Hola administradores, quisiera registrar un abono o editar esta venta (Factura: *${suggestEditInvoice.folio || suggestEditInvoice.id.slice(0, 8)}* / Cliente: *${suggestEditInvoice.client}*).\nPor favor, confirmar si es posible. Aquí están los detalles:\n\n${suggestEditText}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                  setSuggestEditInvoice(null);
                  setSuggestEditText('');
                }}
                className="flex-1 py-3 text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer"
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
