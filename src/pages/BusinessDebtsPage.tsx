import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { User } from '../types';
import { 
  Building2, Search, Plus, Calendar, AlertTriangle, Clock, Sparkles, 
  Upload, FileText, CheckCircle2, History, ChevronRight, X, Phone,
  Mail, MapPin, Trash2, Eye, DollarSign, Filter, FileCheck, ArrowUpRight,
  Printer, ImageOff, Download, CheckCircle, Edit
} from 'lucide-react';
import { api } from '../api';

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  category: string;
  creditDays: number;
}

interface PaymentReceipt {
  id: string;
  date: string;
  amount: number;
  reference?: string;
  imageUrl?: string;
  notes?: string;
}

interface BusinessDebt {
  id: string;
  title: string;
  amount: number;
  invoiceDate: string; // YYYY-MM-DD
  creditDays: number;
  dueDate: string;     // YYYY-MM-DD
  supplierId: string | null;
  type: 'ingresa' | 'paga';
  notes?: string;
  isPaid: boolean;
  receipts?: PaymentReceipt[];
  createdAt: string;
  invoiceImageUrl?: string;
  orderReceivedBy?: string;
  status?: 'pedido' | 'entregado' | 'pendiente' | 'cancelado';
  items?: { name: string; quantity: number; price: number }[];
}

interface BusinessDebtsPageProps {
  user: User;
}

export function BusinessDebtsPage({ user }: BusinessDebtsPageProps) {
  if (user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full min-h-[70vh] p-8">
        <div className="text-center max-w-md bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <X size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Acceso Denegado</h2>
          <p className="text-slate-500">Esta sección administrativa de Compras y Cuentas por Pagar es de acceso exclusivo para administradores.</p>
        </div>
      </div>
    );
  }

  // STATES
  const [activeTab, setActiveTab] = useState<'invoices' | 'suppliers' | 'history'>('invoices');
  const [debts, setDebts] = useState<BusinessDebt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('Todos');

  // MODALS
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showUploadReceiptModal, setShowUploadReceiptModal] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [selectedDebtForReceipts, setSelectedDebtForReceipts] = useState<BusinessDebt | null>(null);
  const [selectedDebtForDetails, setSelectedDebtForDetails] = useState<BusinessDebt | null>(null);
  const [lightBoxImage, setLightBoxImage] = useState<string | null>(null);

  // MANAGE FORMS
  const [invoiceFormData, setInvoiceFormData] = useState({
    title: '',
    amount: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    creditDays: '0',
    type: 'paga' as 'ingresa' | 'paga',
    supplierId: '',
    notes: '',
    invoiceImageUrl: '',
    orderReceivedBy: user?.name || '',
    status: 'pendiente' as 'pedido' | 'entregado' | 'pendiente' | 'cancelado',
    items: [] as { name: string; quantity: number; price: number }[]
  });

  // MANUAL ITEM LOGISTICS STATE
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemPrice, setNewItemPrice] = useState('0');

  const [supplierFormData, setSupplierFormData] = useState({
    id: '', // Empty means creating new
    name: '',
    phone: '',
    email: '',
    address: '',
    category: 'Medicamentos',
    creditDays: '30'
  });

  const [receiptFormData, setReceiptFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    reference: '',
    notes: '',
    file: null as File | null,
    previewUrl: ''
  });

  // OCR STATES
  const [ocrStep, setOcrStep] = useState<'idle' | 'scanning' | 'review'>('idle');
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState('');
  const [ocrScannerProgress, setOcrScannerProgress] = useState(0);
  const [ocrExtractedData, setOcrExtractedData] = useState<any>(null);

  // EFFECTS
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [debtsData, suppliersData] = await Promise.all([
        fetch('/api/business-debts', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('app_token')}` }
        }).then(r => r.ok ? r.json() : []),
        api.getSuppliers().catch(() => [])
      ]);
      setDebts(debtsData);
      setSuppliers(suppliersData);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // AUTOMATE DUE DATE CALCULATION
  const calculateDueDate = (invDateStr: string, daysStr: string): string => {
    if (!invDateStr) return '';
    const days = parseInt(daysStr || '0', 10);
    const date = new Date(invDateStr + 'T12:00:00'); // Prevent timezone issues
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const handleAddManualItem = () => {
    if (!newItemName.trim()) return;
    const qty = parseInt(newItemQty) || 1;
    const prc = parseFloat(newItemPrice) || 0;

    const updatedItems = [...invoiceFormData.items, {
      name: newItemName.trim(),
      quantity: qty,
      price: prc
    }];

    // Autosum total
    const newTotal = updatedItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);

    setInvoiceFormData({
      ...invoiceFormData,
      items: updatedItems,
      amount: newTotal.toFixed(2)
    });

    setNewItemName('');
    setNewItemQty('1');
    setNewItemPrice('0');
  };

  const handleRemoveManualItem = (index: number) => {
    const updatedItems = invoiceFormData.items.filter((_, idx) => idx !== index);
    const newTotal = updatedItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    setInvoiceFormData({
      ...invoiceFormData,
      items: updatedItems,
      amount: newTotal.toFixed(2)
    });
  };

  // CLIENT-SIDE INVOICE TXT FILE GENERATOR
  const handleDownloadInvoice = () => {
    const d = selectedDebtForDetails;
    if (!d) return;
    const supplier = suppliers.find(s => s.id === d.supplierId);
    
    // Calculate totals
    const paidAmount = calculatePaidAmount(d);
    const remainingAmount = d.amount - paidAmount;

    // Build the beautiful digital print text representation
    const textContent = `====================================================
           AGRO-VETERINARIA EL SOL - FACTURA DIGITAL
====================================================
ID DE REGISTRO:  ${d.id}
TÍTULO GENERAL:  ${d.title}
F. DE EMISIÓN:   ${d.invoiceDate}
F. REQUERIDA:    ${d.dueDate} (${d.creditDays} días plazo)
ESTADO ORDEN:    ${(d.status || 'pendiente').toUpperCase()}
ENTREGADO POR:   ${d.orderReceivedBy || 'Administrador General'}
RESPALDO CLOUD:  Sincronizado Premium y Salvaguardado en Supabase
----------------------------------------------------
DATOS GENERALES DEL PROVEEDOR:
----------------------------------------------------
Nombre Empresa:   ${supplier?.name || 'Distribuidor Independiente (No Catalogado)'}
Giro / Categoría: ${supplier?.category || 'General Insumos'}
Teléfono:         ${supplier?.phone || 'No registrado'}
E-mail / Contacto: ${supplier?.email || 'No registrado'}
Dirección Física: ${supplier?.address || 'No registrada'}
----------------------------------------------------
LISTADO Y COMPILACIÓN DE ARTÍCULOS ADQUIRIDOS:
----------------------------------------------------
${d.items && d.items.length > 0 
? d.items.map((it, idx) => `[${idx + 1}] ${it.name.padEnd(25)} | Cant: ${it.quantity.toString().padEnd(3)} | P.Unit: Q${it.price.toFixed(2).padEnd(8)} | Subt: Q${(it.quantity * it.price).toFixed(2)}`).join('\n')
: `[-] ${d.title.padEnd(25)}  | Cant: 1   | P.Unit: Q${d.amount.toFixed(2).padEnd(8)} | Subt: Q${d.amount.toFixed(2)}`
}
----------------------------------------------------
BALANCES METROLÓGICOS DE FINANZAS:
----------------------------------------------------
SUMA BRUTA / TOTAL FACTURA: Q${d.amount.toFixed(2)}
MONTO COMPENSADO / ABONOS:  Q${paidAmount.toFixed(2)}
SALDO LIQUIDO / RESTANTE:   Q${remainingAmount.toFixed(2)}
====================================================
* Estas boletas amparan compras de inventario veterinario y agrario.
* RESPALDADO Y ENCRIPTADO EN LA RED ADMINISTRATIVA DE FORMA EXCLUSIVA.
* No afecta los reportes fiscales de cobro de clientes estándar (Ventas).
====================================================`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Factura_Digital_${d.title.replace(/\s+/g, '_')}_${d.invoiceDate}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // HANDLE SUPPLIER CHANGE IN MANUAL REGISTRY
  const handleSupplierChangeInForm = (supplierId: string) => {
    const s = suppliers.find(x => x.id === supplierId);
    if (s) {
      const pDays = s.creditDays.toString();
      setInvoiceFormData(prev => ({
        ...prev,
        supplierId,
        creditDays: pDays,
        title: prev.title || `Factura de ${s.name}`
      }));
    } else {
      setInvoiceFormData(prev => ({ ...prev, supplierId }));
    }
  };

  // SAVE MANUAL OR OCR CONFIRMED DEBT
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const calculatedDue = calculateDueDate(invoiceFormData.invoiceDate, invoiceFormData.creditDays);
      
      // Auto-populate single fallback item matching total if items list is empty
      const itemsPayload = invoiceFormData.items && invoiceFormData.items.length > 0 
        ? invoiceFormData.items 
        : [{ name: invoiceFormData.title || "Compra General", quantity: 1, price: parseFloat(invoiceFormData.amount) || 0 }];

      const payload = {
        title: invoiceFormData.title || "Gasto sin título",
        amount: parseFloat(invoiceFormData.amount) || 0,
        invoiceDate: invoiceFormData.invoiceDate,
        creditDays: parseInt(invoiceFormData.creditDays) || 0,
        dueDate: calculatedDue,
        supplierId: invoiceFormData.supplierId || null,
        type: invoiceFormData.type,
        notes: invoiceFormData.notes,
        isPaid: invoiceFormData.status === 'entregado' || invoiceFormData.status === 'cancelado',
        receipts: [],
        invoiceImageUrl: invoiceFormData.invoiceImageUrl || null,
        orderReceivedBy: invoiceFormData.orderReceivedBy || user?.name || '',
        status: invoiceFormData.status || 'pendiente',
        items: itemsPayload
      };

      const res = await fetch('/api/business-debts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('app_token')}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setShowInvoiceModal(false);
        setShowOcrModal(false);
        setOcrStep('idle');
        setOcrFile(null);
        setOcrPreviewUrl('');
        setOcrScannerProgress(0);
        setOcrExtractedData(null);
        setInvoiceFormData({
          title: '',
          amount: '',
          invoiceDate: new Date().toISOString().split('T')[0],
          creditDays: '0',
          type: 'paga',
          supplierId: '',
          notes: '',
          invoiceImageUrl: '',
          orderReceivedBy: user?.name || '',
          status: 'pendiente',
          items: []
        });
        loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Error al guardar");
      }
    } catch(err: any) {
      alert("Error al guardar: " + err.message);
    }
  };

  // SAVE OR UPDATE SUPPLIER
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: supplierFormData.name,
        phone: supplierFormData.phone,
        email: supplierFormData.email,
        address: supplierFormData.address,
        category: supplierFormData.category,
        creditDays: parseInt(supplierFormData.creditDays) || 0
      };

      if (supplierFormData.id) {
        // Edit
        await api.updateSupplier(supplierFormData.id, payload);
      } else {
        // Create
        await api.createSupplier(payload);
      }
      setShowSupplierModal(false);
      setSupplierFormData({ id: '', name: '', phone: '', email: '', address: '', category: 'Medicamentos', creditDays: '30' });
      loadData();
    } catch (err: any) {
      alert("Error con el proveedor: " + err.message);
    }
  };

  const handleEditSupplierClick = (s: Supplier) => {
    setSupplierFormData({
      id: s.id,
      name: s.name,
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      category: s.category,
      creditDays: s.creditDays.toString()
    });
    setShowSupplierModal(true);
  };

  const handleDeleteSupplierClick = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar al proveedor "${name}"?`)) {
      try {
        await api.deleteSupplier(id);
        loadData();
      } catch(err: any) {
        alert(err.message);
      }
    }
  };

  const handleDeleteDebtClick = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar el registro de deuda "${name}"?`)) {
      try {
        await api.deleteBusinessDebt(id);
        loadData();
      } catch(err: any) {
        alert(err.message);
      }
    }
  };

  // PAYMENTS (BOLETAS DE PAGO) ACTIONS
  const handleOpenUploadReceipt = (debt: BusinessDebt) => {
    setSelectedDebtForReceipts(debt);
    setReceiptFormData({
      amount: (debt.amount - calculatePaidAmount(debt)).toString(),
      date: new Date().toISOString().split('T')[0],
      reference: '',
      notes: '',
      file: null,
      previewUrl: ''
    });
    setShowUploadReceiptModal(true);
  };

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFormData(prev => ({
        ...prev,
        file: file,
        previewUrl: URL.createObjectURL(file)
      }));
    }
  };

  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtForReceipts) return;

    try {
      let boletaUrl = '';
      if (receiptFormData.file) {
        // Run actual backend upload
        const uploadRes = await api.uploadReceiptFile(receiptFormData.file);
        boletaUrl = uploadRes.imageUrl;
      }

      const newReceipt: PaymentReceipt = {
        id: `rec_${Date.now()}`,
        date: receiptFormData.date,
        amount: parseFloat(receiptFormData.amount) || 0,
        reference: receiptFormData.reference,
        imageUrl: boletaUrl || undefined,
        notes: receiptFormData.notes
      };

      const existingReceipts = selectedDebtForReceipts.receipts || [];
      const updatedReceipts = [...existingReceipts, newReceipt];

      // Calculate total paid with this new slip
      const totalPaid = updatedReceipts.reduce((acc, r) => acc + r.amount, 0);
      const isPaidNow = totalPaid >= selectedDebtForReceipts.amount;

      // Update debt record
      const res = await fetch(`/api/business-debts/${selectedDebtForReceipts.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('app_token')}`
        },
        body: JSON.stringify({
          receipts: updatedReceipts,
          isPaid: isPaidNow
        })
      });

      if (res.ok) {
        setShowUploadReceiptModal(false);
        setSelectedDebtForReceipts(null);
        alert(isPaidNow ? "¡Pago liquidado! La factura se transfirió a la sección de respaldos históricos." : "Boleta de pago guardada de forma exitosa.");
        loadData();
      } else {
        alert("Error al registrar abono/boleta");
      }
    } catch(err: any) {
      alert("Error: " + err.message);
    }
  };

  const calculatePaidAmount = (debt: BusinessDebt): number => {
    if (!debt.receipts) return 0;
    return debt.receipts.reduce((acc, r) => acc + r.amount, 0);
  };

  // OCR ACTIONS
  const handleOcrFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setOcrFile(file);
      setOcrPreviewUrl(URL.createObjectURL(file));
      setOcrStep('scanning');
      setOcrScannerProgress(10);
      
      // Simulate scanning bar progression
      const interval = setInterval(() => {
        setOcrScannerProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 20;
        });
      }, 350);

      // Invoke backend integration
      api.detectInvoiceText(file).then(res => {
        clearInterval(interval);
        setOcrScannerProgress(100);
        setTimeout(() => {
          setOcrExtractedData(res.data);
          
          // Match with existing supplier
          const matchedSupplier = suppliers.find(s => 
            s.name.toLowerCase().includes(res.data.supplierName?.toLowerCase() || '') ||
            (res.data.supplierName || '').toLowerCase().includes(s.name.toLowerCase())
          );

          setInvoiceFormData({
            title: `Factura: ${res.data.supplierName || "Gasto Escaneado"}`,
            amount: (res.data.amount || 0).toString(),
            invoiceDate: res.data.invoiceDate || new Date().toISOString().split('T')[0],
            creditDays: (matchedSupplier ? matchedSupplier.creditDays : (res.data.creditDays || 30)).toString(),
            type: 'paga',
            supplierId: matchedSupplier ? matchedSupplier.id : '',
            notes: `${res.data.notes || ''} (Escaneado digitalmente)`.trim(),
            invoiceImageUrl: res.data.imageUrl || '',
            orderReceivedBy: user?.name || '',
            status: 'pendiente',
            items: res.data.items || []
          });

          setOcrStep('review');
        }, 300);
      }).catch(err => {
        clearInterval(interval);
        alert("Error escaneando factura: " + err.message);
        setOcrStep('idle');
      });
    }
  };

  // ALERTS COMPILATION (Invoice due date <= 5 days away or already passed)
  const getDaysDiff = (dateStr: string): number => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(dateStr + 'T12:00:00');
    due.setHours(0,0,0,0);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const invoiceAlerts = debts
    .filter(d => d.type === 'paga' && !d.isPaid)
    .map(d => {
      const days = getDaysDiff(d.dueDate);
      const s = suppliers.find(x => x.id === d.supplierId);
      return {
        debt: d,
        days,
        supplierName: s ? s.name : "Proveedor Desconocido",
        dueDate: d.dueDate
      };
    })
    .filter(alertItem => alertItem.days <= 5)
    .sort((a, b) => a.days - b.days);

  // SEARCH AND FILTER
  const filteredDebts = debts
    .filter(d => {
      const supplierName = suppliers.find(s => s.id === d.supplierId)?.name || '';
      const matchesSearch = d.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (d.notes && d.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            supplierName.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;
      
      // Categorize tab views
      if (activeTab === 'invoices') {
        return !d.isPaid; // Active outstanding invoices only
      } else if (activeTab === 'history') {
        return d.isPaid; // Paid historic backups only
      }
      return true;
    })
    // Chronological date sort by due date (closest to due date / overdue first)
    .sort((a,b) => {
      if (activeTab === 'history') {
        // Show recently paid/completed first
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (s.phone && s.phone.includes(searchTerm)) ||
                          (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (selectedCategoryFilter !== 'Todos') {
      return matchesSearch && s.category === selectedCategoryFilter;
    }
    return matchesSearch;
  });

  const totalOutstanding = debts
    .filter(d => d.type === 'paga' && !d.isPaid)
    .reduce((acc, d) => acc + (d.amount - calculatePaidAmount(d)), 0);

  const totalPaidInHistory = debts
    .filter(d => d.type === 'paga' && d.isPaid)
    .reduce((acc, d) => acc + d.amount, 0);

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafbfc] min-h-screen">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4.5 p-5 md:p-6 bg-white border-b border-emerald-900/10 z-10 shrink-0 shadow-sm relative overflow-hidden">
        <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-6 rounded-full bg-[#0b4d2c] block" />
              Compras Internas y Proveedores
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-wider">
              Control de compras Agricovet, plazos de crédito, alertas de vencimiento y registro de boletas
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setOcrStep('idle');
                setOcrFile(null);
                setOcrPreviewUrl('');
                setShowOcrModal(true);
              }}
              className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-colors"
            >
              <Sparkles size={18} /> ESCANER OCR
            </motion.button>
            
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setInvoiceFormData({
                  title: '',
                  amount: '',
                  invoiceDate: new Date().toISOString().split('T')[0],
                  creditDays: '0',
                  type: 'paga',
                  supplierId: '',
                  notes: '',
                  invoiceImageUrl: '',
                  orderReceivedBy: user?.name || '',
                  status: 'pendiente',
                  items: []
                });
                setShowInvoiceModal(true);
              }}
              className="w-full sm:w-auto px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-2xl flex items-center justify-center gap-2 border border-slate-200 transition-colors shadow-sm"
            >
              <Plus size={18} strokeWidth={2.5} /> REGISTRO MANUAL
            </motion.button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* SUMMARY METRICS & STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div whileHover={{ y: -5 }} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl group-hover:bg-orange-500/10 transition-colors" />
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Pendiente General</span>
              <p className="text-3xl font-black text-slate-800 tracking-tight">Q{totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-slate-500 font-medium">Deudas activas a proveedores</p>
            </div>
            <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl z-10 shadow-inner">
              <Clock size={28} strokeWidth={2.5} />
            </div>
          </motion.div>
          
          <motion.div whileHover={{ y: -5 }} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-colors" />
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atención Inmediata</span>
              <p className="text-3xl font-black text-rose-600 tracking-tight">{invoiceAlerts.length}</p>
              <p className="text-xs text-rose-500 font-bold">Vencidas o prontas a vencer</p>
            </div>
            <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl z-10 shadow-inner">
              <AlertTriangle size={28} strokeWidth={2.5} />
            </div>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pagos Históricos Realizados</span>
              <p className="text-3xl font-black text-emerald-600 tracking-tight">Q{totalPaidInHistory.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-slate-500 font-medium">Historial solventado</p>
            </div>
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl z-10 shadow-inner">
              <FileCheck size={28} strokeWidth={2.5} />
            </div>
          </motion.div>
        </div>

        {/* ACTIVE ALERT CENTER BANNER CARD */}
        {invoiceAlerts.length > 0 && (
          <div className="bg-amber-50/75 border border-amber-200/60 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="animate-bounce" size={20} />
              <h2 className="text-base font-black uppercase tracking-wider">Centro de Alertas de Pago Inmediato</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invoiceAlerts.map(alert => (
                <div key={alert.debt.id} className="bg-white rounded-2xl p-4 border border-amber-200 shadow-xs flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-amber-700 uppercase tracking-tight">{alert.supplierName}</p>
                    <p className="text-sm font-bold text-slate-800">{alert.debt.title}</p>
                    <p className="text-xs text-slate-500">Monto Restante: Q{(alert.debt.amount - calculatePaidAmount(alert.debt)).toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    {alert.days < 0 ? (
                      <span className="px-2.5 py-1.5 bg-rose-100 text-rose-700 text-xs font-black rounded-lg inline-block border border-rose-200">
                        ¡VENCIDA HACE {-alert.days} DÍAS!
                      </span>
                    ) : alert.days === 0 ? (
                      <span className="px-2.5 py-1.5 bg-amber-100 text-amber-700 text-xs font-black rounded-lg inline-block border border-amber-200">
                        ¡VENCE HOY!
                      </span>
                    ) : (
                      <span className="px-2.5 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg inline-block">
                        Vence en {alert.days} días
                      </span>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">F. de pago: {alert.dueDate}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TABS SELECTOR */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setActiveTab('invoices'); setSearchTerm(''); }}
              className={cn(
                "px-5 py-3 rounded-full font-black text-[13px] transition-all flex items-center gap-2 uppercase tracking-wide",
                activeTab === 'invoices' 
                  ? 'bg-[#0b4d2c] text-white shadow-lg shadow-emerald-500/30' 
                  : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
              )}
            >
              <FileText size={16} /> Facturas Abiertas
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px]", 
                activeTab === 'invoices' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              )}>{debts.filter(d=>!d.isPaid).length}</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setActiveTab('suppliers'); setSearchTerm(''); }}
              className={cn(
                "px-5 py-3 rounded-full font-black text-[13px] transition-all flex items-center gap-2 uppercase tracking-wide",
                activeTab === 'suppliers' 
                  ? 'bg-[#116858] text-white shadow-lg shadow-teal-500/30' 
                  : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
              )}
            >
              <Building2 size={16} /> Proveedores
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px]", 
                activeTab === 'suppliers' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              )}>{suppliers.length}</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setActiveTab('history'); setSearchTerm(''); }}
              className={cn(
                "px-5 py-3 rounded-full font-black text-[13px] transition-all flex items-center gap-2 uppercase tracking-wide",
                activeTab === 'history' 
                  ? 'bg-slate-800 text-white shadow-lg shadow-slate-500/30' 
                  : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
              )}
            >
              <History size={16} /> Historial
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px]", 
                activeTab === 'history' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              )}>{debts.filter(d=>d.isPaid).length}</span>
            </motion.button>
          </div>

          <div className="w-full sm:w-80 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder={activeTab === 'suppliers' ? "Buscar proveedor..." : "Buscar factura por notas, título..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-full focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition shadow-sm text-sm font-bold placeholder-slate-400"
            />
          </div>
        </div>

        {/* RENDER INVOICES (ACTIVE OUTSTANDING PURCHASES) */}
        {activeTab === 'invoices' && (
          <div className="space-y-6">
            {loading ? (
              <div className="p-12 text-center text-slate-500 font-bold flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent flex items-center justify-center rounded-full animate-spin" />
                Cargando historial activo...
              </div>
            ) : filteredDebts.length === 0 ? (
              <div className="p-16 bg-white border border-slate-100 rounded-[2rem] text-center text-slate-400 italic shadow-sm">
                <span className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300 mb-4">
                  <CheckCircle size={32} />
                </span>
                <p className="font-bold text-slate-500">Todo al lio.</p>
                No hay facturas pendientes registradas en esta sección.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDebts.map(d => {
                  const s = suppliers.find(sup => sup.id === d.supplierId);
                  const paidAmount = calculatePaidAmount(d);
                  const remainingAmount = d.amount - paidAmount;
                  const daysLeft = getDaysDiff(d.dueDate);
                  const isLate = daysLeft < 0;
                  const isWarning = daysLeft >= 0 && daysLeft <= 5;
                  
                  return (
                    <motion.div 
                      key={d.id} 
                      whileHover={{ y: -6, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "bg-white rounded-[2rem] p-6 border transition-all shadow-sm overflow-hidden relative group cursor-pointer",
                        isLate ? "border-rose-200 shadow-rose-100" : isWarning ? "border-amber-200 shadow-amber-100" : "border-slate-100 hover:border-slate-200 hover:shadow-xl"
                      )}
                      onClick={() => setSelectedDebtForDetails(d)}
                    >
                      {/* Accent top border */}
                      <div className={cn(
                        "absolute top-0 left-0 right-0 h-1.5 transition-colors group-hover:h-2",
                        isLate ? "bg-rose-500" : isWarning ? "bg-amber-400" : "bg-[#0b4d2c]"
                      )} />
                      
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                          <p className="font-black text-slate-800 text-lg leading-tight line-clamp-1">{d.title}</p>
                          {s ? (
                            <p className="text-[11px] font-bold text-teal-600 uppercase tracking-wider">{s.name}</p>
                          ) : (
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">No catalogado</p>
                          )}
                        </div>
                        
                        <div className={cn(
                          "px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-xl text-center min-w-[70px] shrink-0 border",
                          isLate ? "bg-rose-50 text-rose-700 border-rose-200" : isWarning ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-500 border-slate-200"
                        )}>
                          {daysLeft < 0 ? `Atraso ${-daysLeft}d` : daysLeft === 0 ? 'Expira Hoy' : `${daysLeft}d rest`}
                        </div>
                      </div>

                      <div className="flex items-end justify-between py-4 border-t border-b border-slate-50">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400">Restante a pagar</p>
                          <p className={cn(
                            "text-2xl font-black tabular-nums tracking-tight",
                            isLate ? "text-rose-600" : "text-slate-800"
                          )}>
                            Q{remainingAmount.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Total orig.</p>
                          <p className="text-sm font-bold text-slate-600 tabular-nums">
                            Q{Number(d.amount).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenUploadReceipt(d); }}
                            className="w-10 h-10 rounded-full bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-500 flex items-center justify-center transition-colors border border-slate-200"
                            title="Abonar"
                          >
                            <Upload size={16} />
                          </button>
                          {d.receipts && d.receipts.length > 0 && (
                            <button
                               onClick={(e) => { e.stopPropagation(); setSelectedDebtForReceipts(d); }} 
                               className="px-3 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-black text-slate-600 flex items-center gap-1 transition-colors"
                            >
                              <FileCheck size={14} /> {d.receipts.length} Pagos
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm("¿Marcar liquidada completamente?")) {
                                const res = await fetch(`/api/business-debts/${d.id}`, {
                                  method: 'PUT',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${localStorage.getItem('app_token')}`
                                  },
                                  body: JSON.stringify({ isPaid: true })
                                });
                                if (res.ok) {
                                  alert("Liquidada");
                                  loadData();
                                }
                              }
                            }}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[11px] uppercase font-black tracking-wider transition-colors shadow-sm"
                          >
                            Liquidar
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteDebtClick(d.id, d.title); }}
                            className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* RENDER SUPPLIERS CATALOG (PROVEEDORES) */}
        {activeTab === 'suppliers' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select 
                  value={selectedCategoryFilter} 
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="w-full sm:w-auto bg-slate-50 border-none rounded-xl px-4 py-3 text-sm text-slate-700 font-bold focus:ring-2 focus:ring-teal-500/20 active:scale-95 transition-all outline-none"
                >
                  <option value="Todos">Todas las Categorías</option>
                  <option value="Medicamentos">Medicamentos</option>
                  <option value="Agroquímicos">Agroquímicos</option>
                  <option value="Concentrados">Concentrados</option>
                  <option value="Instrumental">Instrumental</option>
                  <option value="Servicios">Servicios / Otros</option>
                </select>
              </div>

              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSupplierFormData({ id: '', name: '', phone: '', email: '', address: '', category: 'Medicamentos', creditDays: '30' });
                  setShowSupplierModal(true);
                }}
                className="w-full sm:w-auto px-6 py-3 bg-[#116858] hover:bg-[#0c4e42] text-white rounded-xl text-[13px] uppercase font-black tracking-widest flex items-center justify-center gap-2 transition-colors shadow-lg shadow-teal-500/20"
              >
                <Plus size={18} strokeWidth={2.5} /> Añadir Marca/Proveedor
              </motion.button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {loading ? (
                <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400 gap-4">
                  <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent animate-spin rounded-full" />
                  <p className="font-bold">Cargando directorio de proveedores...</p>
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="col-span-full p-16 text-center shadow-sm bg-white rounded-[2rem] border border-slate-100">
                  <Building2 size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="font-black text-lg text-slate-600">Directorio vacío</p>
                  <p className="text-slate-400 font-medium">No hay proveedores registrados bajo esta búsqueda.</p>
                </div>
              ) : (
                filteredSuppliers.map(s => {
                  // Count total outstanding debts for this vendor
                  const providerDebts = debts.filter(d => d.supplierId === s.id && !d.isPaid);
                  const providerOutstanding = providerDebts.reduce((acc, d) => acc + (d.amount - calculatePaidAmount(d)), 0);

                  return (
                    <motion.div 
                      key={s.id} 
                      whileHover={{ y: -5, scale: 1.02 }}
                      className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between space-y-5 relative overflow-hidden group"
                    >
                      {/* Decorative brand background circle */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full blur-[40px] group-hover:bg-teal-50 transition-colors pointer-events-none" />
                      
                      <div className="space-y-4 relative z-10">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-widest">{s.category}</span>
                            <h3 className="font-black text-slate-800 text-xl mt-3 line-clamp-2 leading-tight group-hover:text-[#116858] transition-colors">{s.name}</h3>
                          </div>
                        </div>

                        <div className="space-y-2 text-[11px] font-bold text-slate-500 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          {s.phone && (
                            <p className="flex items-center gap-2">
                              <Phone size={14} className="text-[#116858]" /> {s.phone}
                            </p>
                          )}
                          {s.email && (
                            <p className="flex items-center gap-2">
                              <Mail size={14} className="text-[#116858]" /> {s.email}
                            </p>
                          )}
                          {s.address && (
                            <p className="flex items-center gap-2 line-clamp-1" title={s.address}>
                              <MapPin size={14} className="text-[#116858]" /> {s.address}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex flex-col gap-3 relative z-10">
                        <div className="flex justify-between items-center">
                          <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Deuda Vigente</p>
                          {providerOutstanding > 0 ? (
                            <p className="font-black text-red-600 text-lg">Q{providerOutstanding.toFixed(2)}</p>
                          ) : (
                            <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-full">Al día</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <div className="text-[10px] text-slate-400 font-bold">
                            Crédito: {s.creditDays} días
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditSupplierClick(s)}
                              className="p-2.5 bg-slate-100 hover:bg-[#116858] text-slate-600 hover:text-white rounded-xl transition-colors"
                              title="Editar proveedor"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteSupplierClick(s.id, s.name)}
                              className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* RENDER COMPILADOS HISTORY (RESPALDO ESPECIAL SECCIÓN) */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="bg-emerald-500 rounded-[2rem] p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden text-white shadow-lg shadow-emerald-500/20">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400 rounded-full blur-[80px] opacity-50 translate-x-1/2 -translate-y-1/2 pointer-events-none" />
              <div className="space-y-2 relative z-10 max-w-xl">
                <span className="inline-block px-3 py-1 bg-black/10 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
                  Archivo Histórico
                </span>
                <h3 className="font-extrabold text-2xl lg:text-3xl flex items-center gap-2">
                  <CheckCircle2 size={32} /> Historial Liquidado
                </h3>
                <p className="text-emerald-50 text-sm font-medium leading-relaxed">
                  Aquí se almacenan de forma permanente todas las facturas completamente saldadas. Ninguna factura de proveedor se borra a menos que sea eliminada manualmente.
                </p>
              </div>
              <div className="bg-white text-emerald-900 rounded-[1.5rem] px-8 py-5 shadow-inner relative z-10 w-full md:w-auto shrink-0 flex flex-col items-center md:items-end">
                <span className="text-[11px] text-emerald-600/80 uppercase font-black tracking-widest block mb-1">Monto Histórico</span>
                <span className="font-black text-3xl">Q{totalPaidInHistory.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="space-y-4">
              {filteredDebts.length === 0 ? (
                <div className="p-16 text-center shadow-sm bg-white rounded-[2rem] border border-slate-100">
                  <History className="mx-auto text-slate-200 mb-4" size={48} />
                  <p className="font-black text-lg text-slate-600">Historial vacío</p>
                  <p className="text-slate-400 font-medium">Aún no hay facturas completamente canceladas registradas en el respaldo.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredDebts.map(d => {
                    const s = suppliers.find(sup => sup.id === d.supplierId);
                    
                    return (
                      <motion.div 
                        key={d.id} 
                        whileHover={{ y: -5 }}
                        className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-lg transition-all relative overflow-hidden group cursor-pointer"
                        onClick={() => setSelectedDebtForDetails(d)}
                      >
                        {/* Status bar left */}
                        <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-emerald-500" />
                        
                        <div className="flex justify-between items-start mb-4">
                          <div className="space-y-1">
                            <p className="font-black text-slate-800 text-lg leading-tight line-clamp-1">{d.title}</p>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider block w-max">{s ? s.name : "N/A"}</span>
                          </div>
                          
                          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
                            <CheckCircle size={20} strokeWidth={2.5} />
                          </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400">Total Liquidado</p>
                            <p className="text-xl font-black text-emerald-600">Q{d.amount.toFixed(2)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase font-bold text-slate-400">Cancelada O./A.</p>
                            <p className="text-sm font-bold text-slate-700">{d.dueDate}</p>
                          </div>
                        </div>

                         <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center gap-1.5 text-[11px] font-black text-[#116858] bg-teal-50 border border-teal-100 px-3 py-1.5 rounded-xl">
                              <FileCheck size={14} /> {d.receipts?.length || 0} COMPROBANTES
                            </div>
                            
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteDebtClick(d.id, d.title); }}
                              className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
                              title="Eliminar registro"
                            >
                              <Trash2 size={14} />
                            </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: CREATE / EDIT MANUAL TRANSACTION */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <FileText className="text-teal-600" /> Registro Manual de Factura / Compra
              </h2>
              <button onClick={() => setShowInvoiceModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Concepto o Título</label>
                <input 
                  required 
                  type="text" 
                  value={invoiceFormData.title} 
                  placeholder="Ej: Factura de antibióticos #5231"
                  onChange={e => setInvoiceFormData({...invoiceFormData, title: e.target.value})} 
                  className="w-full px-4 py-3 border rounded-xl text-sm" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Monto de la Factura (Q)</label>
                  <input 
                    required 
                    type="number" 
                    step="0.01" 
                    value={invoiceFormData.amount} 
                    placeholder="Q 0.00"
                    onChange={e => setInvoiceFormData({...invoiceFormData, amount: e.target.value})} 
                    className="w-full px-4 py-3 border rounded-xl text-sm" 
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Asociar Proveedor</label>
                  <select 
                    value={invoiceFormData.supplierId} 
                    onChange={e => handleSupplierChangeInForm(e.target.value)} 
                    className="w-full px-4 py-3 border rounded-xl text-sm text-slate-700 bg-white"
                  >
                    <option value="">-- Ninguno (No catalogado) --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Fecha de la Factura</label>
                  <input 
                    required 
                    type="date" 
                    value={invoiceFormData.invoiceDate} 
                    onChange={e => setInvoiceFormData({...invoiceFormData, invoiceDate: e.target.value})} 
                    className="w-full px-4 py-3 border rounded-xl text-sm" 
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Plazo de Crédito (Días)</label>
                  <input 
                    type="number" 
                    value={invoiceFormData.creditDays} 
                    placeholder="30 días"
                    onChange={e => setInvoiceFormData({...invoiceFormData, creditDays: e.target.value})} 
                    className="w-full px-4 py-3 border rounded-xl text-sm" 
                  />
                </div>
              </div>

              {/* DYNAMIC DUE DATE PREVIEW */}
              <div className="p-4 bg-teal-50/50 border border-teal-100 rounded-2xl flex items-center justify-between text-xs">
                <span className="font-bold text-teal-800 uppercase tracking-wider">Fecha de Pago Calculada:</span>
                <span className="font-black text-sm text-teal-800 font-mono bg-white px-3 py-1 rounded-xl border border-teal-100 shadow-xs">
                  {calculateDueDate(invoiceFormData.invoiceDate, invoiceFormData.creditDays) || 'S/N'}
                </span>
              </div>

               <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Pedido a Nombre de (Encargado)</label>
                  <input 
                    required 
                    type="text" 
                    value={invoiceFormData.orderReceivedBy} 
                    placeholder="Quien ordenó / recibe"
                    onChange={e => setInvoiceFormData({...invoiceFormData, orderReceivedBy: e.target.value})} 
                    className="w-full px-4 py-3 border rounded-xl text-sm" 
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Estado actual del pedido</label>
                  <select 
                    value={invoiceFormData.status} 
                    onChange={e => setInvoiceFormData({...invoiceFormData, status: e.target.value as any})} 
                    className="w-full px-4 py-3 border rounded-xl text-sm bg-white text-slate-700"
                  >
                    <option value="pedido">Pedido (En Espera)</option>
                    <option value="pendiente">Pendiente de Pago</option>
                    <option value="entregado">Entregado (Recibido)</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              {/* INTERACTIVE MANUAL ITEMS BUILDER */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-3">
                <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">Desglose de Líneas de Productos / Artículos</span>
                
                {/* List of currently added items */}
                {invoiceFormData.items && invoiceFormData.items.length > 0 ? (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {invoiceFormData.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white px-3 py-2 rounded-xl border text-xs text-slate-600">
                        <span className="font-bold truncate max-w-[150px]">{item.name}</span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {item.quantity} x Q{item.price.toFixed(2)} = Q{(item.quantity * item.price).toFixed(2)}
                        </span>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveManualItem(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                          title="Quitar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-[11px] italic">No se han registrado productos aún. (Se generará una línea genérica para la Factura Digital por el total si se deja vacío).</p>
                )}

                {/* Sub-form inputs to add new product */}
                <div className="grid grid-cols-12 gap-2 pt-2 border-t border-slate-200">
                  <div className="col-span-6">
                    <input 
                      type="text" 
                      placeholder="Nombre del Producto" 
                      value={newItemName}
                      onChange={e => setNewItemName(e.target.value)}
                      className="w-full px-2 py-1.5 border rounded-lg text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="number" 
                      placeholder="Cant" 
                      min="1"
                      value={newItemQty}
                      onChange={e => setNewItemQty(e.target.value)}
                      className="w-full px-1.5 py-1.5 border rounded-lg text-xs text-center"
                    />
                  </div>
                  <div className="col-span-3">
                    <input 
                      type="number" 
                      placeholder="Precio Unit." 
                      step="0.01"
                      value={newItemPrice}
                      onChange={e => setNewItemPrice(e.target.value)}
                      className="w-full px-1.5 py-1.5 border rounded-lg text-xs text-right"
                    />
                  </div>
                  <div className="col-span-1">
                    <button 
                      type="button" 
                      onClick={handleAddManualItem}
                      className="w-full h-full bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center justify-center font-bold"
                      title="Agregar"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Notas correspondientes</label>
                <textarea 
                  value={invoiceFormData.notes} 
                  rows={2}
                  placeholder="Detalles sobre el inventario recibido o lote..."
                  onChange={e => setInvoiceFormData({...invoiceFormData, notes: e.target.value})} 
                  className="w-full px-4 py-3 border rounded-xl text-sm resize-none" 
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowInvoiceModal(false)} 
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl transition text-sm shadow-md"
                >
                  Confirmar e Insertar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTER / EDIT SUPPLIER (CATALOGO DE PROVEEDORES) */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800">
                {supplierFormData.id ? 'Modificar Proveedor' : 'Registrar Proveedor'}
              </h2>
              <button onClick={() => setShowSupplierModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Nombre Comercial de Empresa</label>
                <input required type="text" value={supplierFormData.name} onChange={e => setSupplierFormData({...supplierFormData, name: e.target.value})} className="w-full px-4 py-3 border rounded-xl text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Categoría del Catálogo</label>
                  <select 
                    value={supplierFormData.category} 
                    onChange={e => setSupplierFormData({...supplierFormData, category: e.target.value})} 
                    className="w-full px-4 py-3 border rounded-xl text-sm text-slate-700 bg-white"
                  >
                    <option value="Medicamentos">Medicamentos</option>
                    <option value="Agroquímicos">Agroquímicos</option>
                    <option value="Concentrados">Concentrados</option>
                    <option value="Instrumental">Instrumental</option>
                    <option value="Servicios/Otros">Servicios / Otros</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Días Plazo por Defecto</label>
                  <input type="number" value={supplierFormData.creditDays} onChange={e => setSupplierFormData({...supplierFormData, creditDays: e.target.value})} className="w-full px-4 py-3 border rounded-xl text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Teléfono de Contacto</label>
                <input type="text" placeholder="+502 " value={supplierFormData.phone} onChange={e => setSupplierFormData({...supplierFormData, phone: e.target.value})} className="w-full px-4 py-3 border rounded-xl text-sm" />
              </div>

              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Correo Electrónico</label>
                <input type="email" placeholder="ejemplo@proveedor.com" value={supplierFormData.email} onChange={e => setSupplierFormData({...supplierFormData, email: e.target.value})} className="w-full px-4 py-3 border rounded-xl text-sm" />
              </div>

              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Dirección Física / Oficina</label>
                <input type="text" value={supplierFormData.address} onChange={e => setSupplierFormData({...supplierFormData, address: e.target.value})} className="w-full px-4 py-3 border rounded-xl text-sm" />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowSupplierModal(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl text-sm shadow-md">Guardar Proveedor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: UPLOAD BOLETA DE PAGO (RECIBO) */}
      {showUploadReceiptModal && selectedDebtForReceipts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-xl font-black text-slate-800">Subir Boleta de Pago</h2>
                <span className="text-[10px] bg-teal-50 text-teal-700 px-2 py-0.5 border rounded-full font-bold inline-block mt-0.5">Abono a: {selectedDebtForReceipts.title}</span>
              </div>
              <button onClick={() => { setShowUploadReceiptModal(false); setSelectedDebtForReceipts(null); }} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveReceipt} className="space-y-4">
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Deuda Total:</span>
                  <span className="font-extrabold text-[#116858] text-sm">Q{selectedDebtForReceipts.amount.toFixed(2)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block font-medium">Restante actual:</span>
                  <span className="font-black text-rose-600 text-sm">Q{(selectedDebtForReceipts.amount - calculatePaidAmount(selectedDebtForReceipts)).toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Monto de la Boleta / Recibo (Q)</label>
                <input required type="number" step="0.01" value={receiptFormData.amount} onChange={e => setReceiptFormData({...receiptFormData, amount: e.target.value})} className="w-full px-4 py-3 border rounded-xl text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Fecha de Pago</label>
                  <input required type="date" value={receiptFormData.date} onChange={e => setReceiptFormData({...receiptFormData, date: e.target.value})} className="w-full px-4 py-3 border rounded-xl text-sm" />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">№ de Referencia / Banco</label>
                  <input type="text" placeholder="Código de boleta" value={receiptFormData.reference} onChange={e => setReceiptFormData({...receiptFormData, reference: e.target.value})} className="w-full px-4 py-3 border rounded-xl text-sm" />
                </div>
              </div>

              {/* FILE UPLOAD BOX */}
              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Comprobante de Pago Física / Imagen o PDF de Boleta</label>
                {!receiptFormData.previewUrl ? (
                  <div className="border-2 border-dashed border-slate-200 hover:border-teal-400 rounded-2xl p-6 text-center cursor-pointer relative bg-slate-50 group hover:bg-teal-50/25 transition">
                    <input 
                      type="file" 
                      accept="image/*,application/pdf" 
                      onChange={handleReceiptFileChange} 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                    />
                    <Upload className="mx-auto text-slate-400 group-hover:text-teal-600 mb-2" size={28} />
                    <p className="text-xs text-slate-500 group-hover:text-slate-700 font-medium">Haz click o arrastra una foto o PDF de la boleta de banco</p>
                    <p className="text-[10px] text-slate-400 mt-1">Imágenes (.jpeg, .png) y Documentos (.pdf) de hasta 20MB</p>
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden border bg-slate-900 border-slate-200 h-40 flex items-center justify-center p-4">
                    {receiptFormData.file?.type === 'application/pdf' ? (
                      <div className="flex flex-col items-center justify-center text-slate-300 gap-2">
                        <FileText size={48} className="text-rose-500 animate-pulse" />
                        <span className="text-xs font-mono font-bold truncate max-w-[250px]">{receiptFormData.file.name}</span>
                        <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">Documento PDF del abono</span>
                      </div>
                    ) : (
                      <img src={receiptFormData.previewUrl} className="w-full h-full object-contain" alt="Preview Boleta" />
                    )}
                    <button 
                      type="button" 
                      onClick={() => setReceiptFormData(p=>({...p, file: null, previewUrl: ''}))} 
                      className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full transition"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-wide block mb-1">Notas correspondientes</label>
                <input type="text" placeholder="ej. Transferencia Banrural..." value={receiptFormData.notes} onChange={e => setReceiptFormData({...receiptFormData, notes: e.target.value})} className="w-full px-4 py-3 border rounded-xl text-sm" />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => { setShowUploadReceiptModal(false); setSelectedDebtForReceipts(null); }} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl text-sm shadow-md">Registrar Boleta de Pago</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ESCANEO DIGITAL DE FACTURA INTELIGENTE (OCR) AI WIZARD */}
      {showOcrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <div>
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <Sparkles className="text-teal-600 animate-pulse" /> Escaneo Inteligente Digital (AI OCR)
                </h2>
                <p className="text-slate-500 text-xs mt-0.5 font-medium">Extrae automáticamente datos de facturas físicas con el modelo Gemini de Agricovet</p>
              </div>
              <button onClick={() => { setShowOcrModal(false); setOcrStep('idle'); setOcrFile(null); setOcrPreviewUrl(''); setOcrScannerProgress(0); setOcrExtractedData(null); }} className="p-2 text-slate-400 hover:text-slate-650 rounded-xl hover:bg-slate-50">
                <X size={20} />
              </button>
            </div>

            {/* STEP 1: IDLE / FILE LOADING BOX */}
            {ocrStep === 'idle' && (
              <div className="p-12 text-center border-3 border-dashed border-slate-200 hover:border-teal-500 rounded-3xl bg-slate-50 hover:bg-teal-50/10 cursor-pointer transition relative group">
                <input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  onChange={ocrFile ? undefined : handleOcrFileSelect} 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                />
                <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition duration-300">
                  <Upload size={32} />
                </div>
                <h3 className="text-lg font-extrabold text-slate-800 mb-2">Seleccionar o Arrastrar Recibo o Factura</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mb-1">Carga cualquier recibo, ticket o factura de compra en formato de imagen o PDF. Nuestro motor de IA analizará de forma segura las imágenes y rellenará la ficha para compras.</p>
                <p className="text-xs text-slate-400 font-mono mt-4">La analítica de Agricovet procesará marcas de medicamentos de Ganado, Agro-nutrientes e Insumos.</p>
              </div>
            )}

            {/* STEP 2: SCANNING PROGRESS BAR */}
            {ocrStep === 'scanning' && (
              <div className="py-16 text-center space-y-6">
                <div className="relative w-72 h-44 mx-auto border border-slate-200 bg-slate-900 rounded-2xl overflow-hidden shadow-xs flex items-center justify-center p-4">
                  {ocrPreviewUrl && (
                    ocrFile?.type === 'application/pdf' ? (
                      <div className="flex flex-col items-center justify-center text-slate-300 gap-1">
                        <FileText size={48} className="text-rose-500 animate-pulse" />
                        <span className="text-[11px] font-mono font-bold truncate max-w-[200px]">{ocrFile.name}</span>
                      </div>
                    ) : (
                      <img src={ocrPreviewUrl} className="w-full h-full object-cover opacity-60" alt="Preview OCR" />
                    )
                  )}
                  {/* Laser Beam Scanner Lines Animation */}
                  <div className="absolute left-0 right-0 h-1 bg-teal-500/80 shadow-lg shadow-teal-500 animate-bounce" style={{ animationDuration: '2.5s' }} />
                </div>
                
                <div className="max-w-md mx-auto space-y-3">
                  <h3 className="font-extrabold text-slate-800 text-lg flex items-center justify-center gap-2">
                    <Sparkles className="animate-spin text-teal-500" size={18} /> Procesando por Inteligencia Artificial...
                  </h3>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-600 rounded-full transition-all duration-300" style={{ width: `${ocrScannerProgress}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 italic">"Analizando montos, marcas, catalogando proveedurías, deudas y calculando automáticamente fechas líquidas de crédito..."</p>
                </div>
              </div>
            )}

            {/* STEP 3: DIGITIZED EXTRACTION BILL DETAILS REVIEW & CONFIRM */}
            {ocrStep === 'review' && ocrExtractedData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Visualizer Frame */}
                <div className="space-y-4">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">Original Escaneado</span>
                  <div className="rounded-2xl border bg-slate-900 border-slate-200 overflow-hidden h-72 relative flex items-center justify-center p-4 text-center">
                    {ocrPreviewUrl && (
                      ocrFile?.type === 'application/pdf' ? (
                        <div className="flex flex-col items-center justify-center text-slate-300 gap-2">
                          <FileText size={64} className="text-rose-500" />
                          <span className="text-xs font-mono font-bold truncate max-w-[250px]">{ocrFile.name}</span>
                          <span className="text-[10px] text-slate-400">Documento PDF cargado</span>
                        </div>
                      ) : (
                        <img src={ocrPreviewUrl} className="w-full h-full object-contain" alt="Original scanned bill" />
                      )
                    )}
                    <div className="absolute bottom-3 left-3 bg-black/75 px-3 py-1 text-[10px] text-teal-400 font-bold rounded-lg border border-teal-500/30">
                      Lector de Documento Digital Calibrado
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 border rounded-2xl space-y-2 text-xs">
                    <span className="font-extrabold text-[#116858] block">Artículos detectados en la hoja:</span>
                    <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-slate-100 pr-1">
                      {ocrExtractedData.items && ocrExtractedData.items.length > 0 ? (
                        ocrExtractedData.items.map((item: any, id: number) => (
                          <div key={id} className="pt-1.5 flex justify-between items-center text-slate-600 font-medium">
                            <span className="truncate max-w-[200px]">{item.name}</span>
                            <span className="font-mono text-slate-500">x{item.quantity} (Q{(item.price || 0).toFixed(2)})</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-slate-400 italic">No se leyeron artículos específicos individualmente.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form Editor For Control */}
                <div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-4">Información Digitalizada Controlable</span>
                  
                  <form onSubmit={handleSaveInvoice} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-[#116858] uppercase tracking-wide block mb-1">Nombre Comercial Proveedor</label>
                      <input 
                        required 
                        type="text" 
                        value={invoiceFormData.title.replace('Factura: ', '')} 
                        onChange={e => setInvoiceFormData({...invoiceFormData, title: `Factura: ${e.target.value}`})} 
                        className="w-full px-4 py-2 text-sm border-teal-300 bg-teal-50/20 rounded-xl focus:ring-teal-500" 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Empresa en Catálogo</label>
                        <select 
                          value={invoiceFormData.supplierId} 
                          onChange={e => handleSupplierChangeInForm(e.target.value)} 
                          className="w-full px-3 py-2 border rounded-xl text-xs text-slate-700 bg-white"
                        >
                          <option value="">-- Ninguno (No catalogar) --</option>
                          {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Monto Escaneado (Q)</label>
                        <input 
                          required 
                          type="number" 
                          step="0.01" 
                          value={invoiceFormData.amount} 
                          onChange={e => setInvoiceFormData({...invoiceFormData, amount: e.target.value})} 
                          className="w-full px-3 py-2 text-xs border rounded-xl" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Fecha de Factura</label>
                        <input 
                          required 
                          type="date" 
                          value={invoiceFormData.invoiceDate} 
                          onChange={e => setInvoiceFormData({...invoiceFormData, invoiceDate: e.target.value})} 
                          className="w-full px-3 py-2 text-xs border rounded-xl" 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Días Plazo para pagar</label>
                        <input 
                          type="number" 
                          value={invoiceFormData.creditDays} 
                          onChange={e => setInvoiceFormData({...invoiceFormData, creditDays: e.target.value})} 
                          className="w-full px-3 py-2 text-xs border rounded-xl" 
                        />
                      </div>
                    </div>

                    {/* TARGET DATE HIGHLIGHT */}
                    <div className="p-3 bg-amber-50 border border-amber-200/50 rounded-xl flex justify-between items-center text-xs">
                      <span className="font-extrabold text-amber-800 uppercase tracking-wider">Fecha límite de liquidación:</span>
                      <span className="font-black text-amber-800 font-mono bg-white px-2 py-0.5 rounded border border-amber-200">
                        {calculateDueDate(invoiceFormData.invoiceDate, invoiceFormData.creditDays) || 'S/N'}
                      </span>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Notas del Gasto extraídas</label>
                      <textarea 
                        value={invoiceFormData.notes} 
                        rows={2}
                        onChange={e => setInvoiceFormData({...invoiceFormData, notes: e.target.value})} 
                        className="w-full px-3 py-2 text-xs border rounded-xl resize-none" 
                      />
                    </div>

                    <div className="pt-4 flex gap-3 border-t">
                      <button 
                        type="button" 
                        onClick={() => setOcrStep('idle')} 
                        className="flex-1 py-3 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition"
                      >
                        Escanear Otra Imagen
                      </button>
                      <button 
                        type="submit" 
                        className="flex-1 py-3 bg-gradient-to-r from-teal-700 to-[#116858] hover:opacity-95 text-white font-black rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5"
                      >
                        <FileCheck size={14} /> Registrar en Cuentas por Pagar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 5: DETALLADO DE COMPROBANTES DE ABONOS EN UN FACTURA */}
      {selectedDebtForReceipts && !showUploadReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl p-6">
            <div className="flex justify-between items-center mb-6 pb-2 border-b">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <History className="text-teal-600" /> Registro y Respaldos de Abonos
                </h2>
                <p className="text-slate-500 text-xs mt-0.5 font-medium">Factura: {selectedDebtForReceipts.title}</p>
              </div>
              <button onClick={() => setSelectedDebtForReceipts(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Stats overview of invoice */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-slate-50 border rounded-2xl">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Valor Total</span>
                  <span className="font-extrabold text-slate-800 text-sm">Q{selectedDebtForReceipts.amount.toFixed(2)}</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
                  <span className="text-[10px] text-emerald-600 uppercase font-bold block">Abonado</span>
                  <span className="font-black text-emerald-700 text-sm">Q{calculatePaidAmount(selectedDebtForReceipts).toFixed(2)}</span>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl">
                  <span className="text-[10px] text-rose-500 uppercase font-bold block">Saldo Pendiente</span>
                  <span className="font-black text-rose-600 text-sm">Q{(selectedDebtForReceipts.amount - calculatePaidAmount(selectedDebtForReceipts)).toFixed(2)}</span>
                </div>
              </div>

              {/* Invoices slips lists */}
              <div className="space-y-4">
                <span className="text-xs font-black text-slate-400 uppercase tracking-wide block">Boletas Cargadas</span>
                
                {!selectedDebtForReceipts.receipts || selectedDebtForReceipts.receipts.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 italic py-6">No hay boletas de pago asociadas a este registro.</p>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {selectedDebtForReceipts.receipts.map((rec) => (
                      <div key={rec.id} className="p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-150 flex items-center justify-between gap-4 transition">
                        <div className="flex items-center gap-3">
                          {rec.imageUrl ? (
                            <div 
                              className="w-12 h-12 bg-black rounded-lg overflow-hidden cursor-zoom-in shrink-0 relative group"
                              onClick={() => setLightBoxImage(rec.imageUrl || null)}
                            >
                              <img src={rec.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition" alt="Slip Mini" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-slate-200 text-slate-500 rounded-lg flex items-center justify-center shrink-0">
                              <FileText size={20} />
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-black text-slate-700">Abono: Q{rec.amount.toFixed(2)}</p>
                            <p className="text-[10px] text-slate-400 font-medium">Fecha: {rec.date} {rec.reference && `| REF: ${rec.reference}`}</p>
                            {rec.notes && <p className="text-[10px] italic text-slate-400 mt-0.5">Note: {rec.notes}</p>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {rec.imageUrl && (
                            <button 
                              onClick={() => setLightBoxImage(rec.imageUrl || null)}
                              className="p-2 border bg-white rounded-lg hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition"
                              title="Visualizar Comprobante"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              if (confirm("¿Estás seguro de quitar esta boleta de pago de este registro? El saldo de la factura se re-calculará.")) {
                                const list = selectedDebtForReceipts.receipts || [];
                                const filtered = list.filter(r => r.id !== rec.id);
                                const newPaid = filtered.reduce((acc, r) => acc + r.amount, 0);
                                const res = await fetch(`/api/business-debts/${selectedDebtForReceipts.id}`, {
                                  method: 'PUT',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${localStorage.getItem('app_token')}`
                                  },
                                  body: JSON.stringify({
                                    receipts: filtered,
                                    isPaid: newPaid >= selectedDebtForReceipts.amount
                                  })
                                });
                                if (res.ok) {
                                  alert("Comprobante eliminado con éxito.");
                                  loadData();
                                  setSelectedDebtForReceipts(null);
                                }
                              }
                            }}
                            className="p-2 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition"
                            title="Desasociar Boleta"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const d = selectedDebtForReceipts;
                    setSelectedDebtForReceipts(null);
                    handleOpenUploadReceipt(d);
                  }}
                  className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition shadow-md"
                >
                  <Plus size={16} /> Subir Nueva Boleta de Abono
                </button>
                <button 
                  onClick={() => setSelectedDebtForReceipts(null)}
                  className="w-32 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: DETALLE COMPLETO DE FACTURA Y ESTADO */}
      {selectedDebtForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl p-6 relative">
            <div className="flex justify-between items-center mb-6 pb-2 border-b">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <FileText className="text-teal-600" /> Detalle de Documento de Compra
                </h2>
                <p className="text-slate-500 text-xs mt-0.5 font-medium">Visualización premium con sincronización multi-dispositivo</p>
              </div>
              <button onClick={() => setSelectedDebtForDetails(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto pr-1">
              
              {/* LEFT SIDE: DIGITAL INVOICE GENERATOR */}
              <div className="space-y-4">
                <div className="border border-dashed border-slate-300 rounded-2xl p-5 bg-slate-50/50 space-y-4 font-sans text-slate-700 relative overflow-hidden" id="digital-invoice-printable">
                  {/* Decorative waterstamp */}
                  <div className="absolute top-2 right-2 text-[10px] items-center text-teal-600 font-bold bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full flex gap-1">
                    <Sparkles size={10} /> Sincronizada Premium
                  </div>

                  <div className="text-center pb-3 border-b border-slate-200">
                    <h3 className="font-extrabold text-slate-900 tracking-wide uppercase text-sm">Agro-Veterinaria El Sol</h3>
                    <p className="text-[10px] text-slate-400">Guatemala - Control de Abastecimiento Interno</p>
                    <span className="text-[9px] bg-white text-slate-500 px-3 py-1 rounded-full font-mono mt-1.5 inline-block border">REGISTRO: #{selectedDebtForDetails.id}</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {/* Supplier details info */}
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Proveedor</span>
                      <p className="font-bold text-slate-800">{suppliers.find(s => s.id === selectedDebtForDetails.supplierId)?.name || 'Distribuidora Independiente (No Catalogado)'}</p>
                      {suppliers.find(s => s.id === selectedDebtForDetails.supplierId) && (
                        <p className="text-[10px] text-slate-500">
                          Tel: {suppliers.find(s => s.id === selectedDebtForDetails.supplierId)?.phone} | Email: {suppliers.find(s => s.id === selectedDebtForDetails.supplierId)?.email}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Pedido a Nombre de</span>
                        <p className="font-semibold text-slate-800">{selectedDebtForDetails.orderReceivedBy || 'Administrador General'}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Fecha Registro</span>
                        <p className="font-semibold font-mono text-slate-800">{selectedDebtForDetails.invoiceDate}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Plazo de Pago</span>
                        <p className="font-semibold text-slate-800 font-mono">{selectedDebtForDetails.creditDays} días</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Fecha Vencimiento</span>
                        <p className="font-semibold text-slate-800 font-mono">{selectedDebtForDetails.dueDate}</p>
                      </div>
                    </div>
                  </div>

                  {/* ITEMS BREAKDOWN TABLE */}
                  <div className="pt-3 border-t border-slate-200">
                    <span className="text-[10px] uppercase font-extrabold text-slate-400 block mb-2">Desglose de Productos / Servicios</span>
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[10px] text-slate-400 font-bold uppercase border-b border-slate-200">
                            <th className="p-2">Art.</th>
                            <th className="p-2 text-center">Cant</th>
                            <th className="p-2 text-right">Precio</th>
                            <th className="p-2 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                          {selectedDebtForDetails.items && selectedDebtForDetails.items.length > 0 ? (
                            selectedDebtForDetails.items.map((it, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="p-2 font-semibold truncate max-w-[120px]">{it.name}</td>
                                <td className="p-2 text-center font-mono">{it.quantity}</td>
                                <td className="p-2 text-right font-mono">Q{Number(it.price).toFixed(2)}</td>
                                <td className="p-2 text-right font-mono text-slate-800 font-bold">Q{(it.quantity * it.price).toFixed(2)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="p-2 font-semibold">{selectedDebtForDetails.title}</td>
                              <td className="p-2 text-center font-mono">1</td>
                              <td className="p-2 text-right font-mono">Q{selectedDebtForDetails.amount.toFixed(2)}</td>
                              <td className="p-2 text-right font-mono text-slate-800 font-bold">Q{selectedDebtForDetails.amount.toFixed(2)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* SUMS AND TOTALS */}
                  <div className="pt-2 border-t border-slate-200 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Facturado:</span>
                      <span className="font-bold text-slate-700 font-mono">Q{selectedDebtForDetails.amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Monto Abonado:</span>
                      <span className="font-bold text-emerald-600 font-mono">Q{calculatePaidAmount(selectedDebtForDetails).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-dashed text-sm">
                      <span className="font-extrabold text-slate-800">Saldo Pendiente:</span>
                      <span className="font-black text-rose-600 font-mono">Q{(selectedDebtForDetails.amount - calculatePaidAmount(selectedDebtForDetails)).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 text-center italic pt-2 border-t border-slate-100">
                    * Este comprobante de proveedor no afecta la sección de ventas (ventas cobradas) en sus estadísticas de ingresos de productos terminados.
                  </div>
                </div>

                {/* DOWNLOAD AND PRINT ACTIONS */}
                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadInvoice}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Download size={13} /> Descargar Archivo Digital
                  </button>
                </div>
              </div>

              {/* RIGHT SIDE: STATUS SELECTOR / DOCUMENT IMAGERY ACCREDITATION */}
              <div className="space-y-4">
                {/* 1. STATE AND AUDITING PICKER */}
                <div className="bg-slate-50 border p-4 rounded-2xl space-y-3">
                  <span className="text-xs font-black text-slate-500 uppercase block">Estado actual y Logística</span>
                  
                  <div>
                    <label className="text-[10px] font-black text-slate-400 block mb-1 uppercase">Estado Administrativo del Insumo</label>
                    <select
                      value={selectedDebtForDetails.status || 'pendiente'}
                      onChange={async (e) => {
                        const newStatus = e.target.value as any;
                        const markAsPaid = newStatus === 'entregado' || newStatus === 'cancelado'; 
                        try {
                          const res = await fetch(`/api/business-debts/${selectedDebtForDetails.id}`, {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${localStorage.getItem('app_token')}`
                            },
                            body: JSON.stringify({ 
                              status: newStatus,
                              isPaid: markAsPaid ? true : selectedDebtForDetails.isPaid
                            })
                          });
                          if (res.ok) {
                            // Update local states in real time
                            const updatedDebt = { 
                              ...selectedDebtForDetails, 
                              status: newStatus,
                              isPaid: markAsPaid ? true : selectedDebtForDetails.isPaid
                            };
                            setSelectedDebtForDetails(updatedDebt);
                            loadData();
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="w-full px-3 py-2 text-xs border rounded-xl bg-white font-bold text-slate-700 capitalize"
                    >
                      <option value="pedido">📦 Pedido (Espera de Arribo)</option>
                      <option value="pendiente">⏳ Pendiente de Pago</option>
                      <option value="entregado">✅ Entregado e Ingresado</option>
                      <option value="cancelado">❌ Cancelado</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] font-black text-slate-400 block mb-1 uppercase">Responsable de Recepción / Pedido</span>
                    <p className="text-xs font-bold text-slate-700 bg-white border px-3 py-1.5 rounded-xl">{selectedDebtForDetails.orderReceivedBy || 'No asignado'}</p>
                  </div>
                </div>

                {/* 2. INVOICE ORIGINAL SCAN PIC */}
                <div className="bg-slate-50 border p-4 rounded-2xl space-y-3">
                  <span className="text-xs font-black text-slate-500 uppercase block">Imagen de Respaldo Fiscal (Fotografía)</span>
                  
                  {selectedDebtForDetails.invoiceImageUrl ? (
                    <div className="relative group rounded-xl overflow-hidden border bg-white aspect-[4/3] flex items-center justify-center">
                      <img 
                        src={selectedDebtForDetails.invoiceImageUrl} 
                        className="w-full h-full object-cover transition-transform group-hover:scale-105 animate-fade-in" 
                        alt="Original Scanned Invoice" 
                        referrerPolicy="no-referrer"
                      />
                      <button
                        onClick={() => setLightBoxImage(selectedDebtForDetails.invoiceImageUrl || null)}
                        className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span className="px-3 py-2 bg-white text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md">
                          <Eye size={13} /> Ver Pantalla Completa
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-8 border border-dashed text-center rounded-xl bg-white text-slate-400 flex flex-col items-center justify-center min-h-[160px]">
                      <ImageOff className="text-slate-300 mb-2" size={32} />
                      <p className="text-xs font-semibold">Fotografía de Factura No Disponible</p>
                      <p className="text-[10px] mt-1">Este registro se insertó manualmente sin archivo de escáner. Puedes respaldarla subiendo boletas de abono.</p>
                    </div>
                  )}

                  {/* Show abonos list if any exists */}
                  {selectedDebtForDetails.receipts && selectedDebtForDetails.receipts.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide block">Boletas de Transacción / Abono (Respaldos)</span>
                      <div className="grid grid-cols-4 gap-2">
                        {selectedDebtForDetails.receipts.map((rec) => (
                          rec.imageUrl && (
                            <button
                              key={rec.id}
                              onClick={() => setLightBoxImage(rec.imageUrl || null)}
                              className="aspect-square border rounded-xl overflow-hidden bg-white hover:opacity-80 transition relative group border-teal-100"
                            >
                              <img src={rec.imageUrl} className="w-full h-full object-cover" alt="Abono slip" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye size={12} className="text-white" />
                              </div>
                            </button>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. CLOUD BACKUP ASSURANCE METRICS (Premium syncer badge list) */}
                <div className="p-3 bg-emerald-50 border border-emerald-200/50 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-emerald-800">Copia de Seguridad Premium Activa</h4>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                      Esta boleta está encriptada y respaldada en su almacenamiento remoto de Supabase. Sincronizada en todos sus dispositivos administrativos.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: LIGHTBOX IMAGE OVERLAY (FULL SCREEN VIEW) */}
      {lightBoxImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 transition-opacity duration-300">
          <button 
            onClick={() => setLightBoxImage(null)} 
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition shadow-lg"
          >
            <X size={24} />
          </button>
          
          <div className="max-w-4xl max-h-[85vh] overflow-hidden flex items-center justify-center rounded-2xl bg-slate-900 border border-white/10 relative shadow-2xl">
            <img src={lightBoxImage} className="max-w-full max-h-[80vh] object-contain" alt="Lightbox Receipt expanded" />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60 font-mono bg-black/60 px-4 py-2 rounded-full border border-white/5">
              Visualizador de Auditoría de Comprobantes
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
