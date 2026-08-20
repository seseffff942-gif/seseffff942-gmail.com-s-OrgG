import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Supplier, BusinessDebt, PurchasePaymentReceipt, PurchaseInvoiceType, PurchasePaymentMethod, BusinessDebtItem } from '../types';
import { 
  Building2, Search, Plus, Calendar, AlertTriangle, Clock, Sparkles, 
  Upload, FileText, CheckCircle2, History, ChevronRight, X, Phone,
  Mail, MapPin, Trash2, Eye, DollarSign, Filter, FileCheck, ArrowUpRight,
  Printer, ImageOff, Download, CheckCircle, Edit, CreditCard, Landmark,
  Receipt, ArrowDownLeft, ShieldCheck, Tag, HelpCircle, RefreshCw, ArrowUp
} from 'lucide-react';
import { api } from '../api';
import { formatMoney } from '../utils';

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

interface BusinessDebtsPageProps {
  user: User;
}

const GUATEMALA_BANKS = [
  'Banrural',
  'Banco Industrial (BI)',
  'Banco G&T Continental',
  'BAC Credomatic',
  'Banco Agromercantil (BAM)',
  'Banco Interbanco',
  'Crédito Hipotecario Nacional (CHN)',
  'Banco Promerica',
  'Banco Inmobiliario',
  'Banco Azteca',
  'Caja de Ahorro / Cooperativa',
  'Otro Banco / Caja Chica'
];

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

  // ACTIVE TAB
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments' | 'suppliers' | 'history'>('invoices');
  const [debts, setDebts] = useState<BusinessDebt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // FILTERS
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('Todos');
  const [selectedInvoiceTypeFilter, setSelectedInvoiceTypeFilter] = useState<string>('Todos');
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('Todos');
  const [selectedPaymentMethodFilter, setSelectedPaymentMethodFilter] = useState<string>('Todos');

  // MODALS
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showUploadReceiptModal, setShowUploadReceiptModal] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [selectedDebtForReceipts, setSelectedDebtForReceipts] = useState<BusinessDebt | null>(null);
  const [selectedDebtForDetails, setSelectedDebtForDetails] = useState<BusinessDebt | null>(null);
  const [selectedPaymentForVoucher, setSelectedPaymentForVoucher] = useState<{
    receipt: PurchasePaymentReceipt;
    debt?: BusinessDebt;
  } | null>(null);
  const [lightBoxImage, setLightBoxImage] = useState<string | null>(null);

  // MANAGE INVOICE FORM
  const [invoiceFormData, setInvoiceFormData] = useState({
    id: '',
    title: '',
    invoiceNumber: '',
    invoiceSeries: '',
    invoiceType: 'factura_normal' as PurchaseInvoiceType,
    dte: '',
    supplierId: '',
    supplierNit: '',
    supplierNitName: '',
    supplierCommercialName: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    creditDays: '30',
    subtotal: '0',
    iva: '0',
    amount: '0',
    type: 'paga' as 'ingresa' | 'paga',
    notes: '',
    invoiceImageUrl: '',
    orderReceivedBy: user?.name || '',
    status: 'pendiente' as 'pedido' | 'entregado' | 'pendiente' | 'cancelado',
    items: [] as BusinessDebtItem[],
    isExemptIva: false
  });

  // MANUAL ITEM LOGISTICS STATE
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemPrice, setNewItemPrice] = useState('0');

  // SUPPLIER FORM
  const [supplierFormData, setSupplierFormData] = useState({
    id: '',
    name: '',
    legalName: '',
    nit: '',
    phone: '',
    email: '',
    address: '',
    category: 'Medicamentos',
    creditDays: '30',
    bankName: 'Banrural',
    bankAccount: ''
  });

  // PAYMENT FORM
  const [paymentFormData, setPaymentFormData] = useState({
    debtId: '',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'boleta' as PurchasePaymentMethod,
    bankName: 'Banrural',
    authNumber: '',
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

  // SCROLL & STICKY REF
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // EFFECTS
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const mainEl = document.querySelector('main');
    const handleScroll = () => {
      const scrollPos = mainEl ? mainEl.scrollTop : window.scrollY;
      setShowScrollTop(scrollPos > 150);
    };
    if (mainEl) {
      mainEl.addEventListener('scroll', handleScroll);
    }
    window.addEventListener('scroll', handleScroll);
    return () => {
      if (mainEl) mainEl.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [debtsData, suppliersData] = await Promise.all([
        api.getBusinessDebts().catch(() => []),
        api.getSuppliers().catch(() => [])
      ]);
      setDebts(Array.isArray(debtsData) ? debtsData : []);
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
    } catch(err) {
      console.error("Error al cargar datos:", err);
    } finally {
      setLoading(false);
    }
  };

  // AUTOMATE DUE DATE CALCULATION
  const calculateDueDate = (invDateStr: string, daysStr: string): string => {
    if (!invDateStr) return '';
    const days = parseInt(daysStr || '0', 10);
    const date = new Date(invDateStr + 'T12:00:00');
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  // RECALCULATE AMOUNTS (SUBTOTAL / IVA / TOTAL)
  const handleAmountChange = (valStr: string) => {
    const total = parseFloat(valStr) || 0;
    if (invoiceFormData.isExemptIva) {
      setInvoiceFormData(prev => ({
        ...prev,
        amount: valStr,
        subtotal: total.toFixed(2),
        iva: '0.00'
      }));
    } else {
      const sub = total / 1.12;
      const iva = total - sub;
      setInvoiceFormData(prev => ({
        ...prev,
        amount: valStr,
        subtotal: sub.toFixed(2),
        iva: iva.toFixed(2)
      }));
    }
  };

  const handleSubtotalChange = (valStr: string) => {
    const sub = parseFloat(valStr) || 0;
    if (invoiceFormData.isExemptIva) {
      setInvoiceFormData(prev => ({
        ...prev,
        subtotal: valStr,
        iva: '0.00',
        amount: sub.toFixed(2)
      }));
    } else {
      const iva = sub * 0.12;
      const total = sub + iva;
      setInvoiceFormData(prev => ({
        ...prev,
        subtotal: valStr,
        iva: iva.toFixed(2),
        amount: total.toFixed(2)
      }));
    }
  };

  const handleToggleExemptIva = (isExempt: boolean) => {
    const total = parseFloat(invoiceFormData.amount) || 0;
    if (isExempt) {
      setInvoiceFormData(prev => ({
        ...prev,
        isExemptIva: true,
        subtotal: total.toFixed(2),
        iva: '0.00'
      }));
    } else {
      const sub = total / 1.12;
      const iva = total - sub;
      setInvoiceFormData(prev => ({
        ...prev,
        isExemptIva: false,
        subtotal: sub.toFixed(2),
        iva: iva.toFixed(2)
      }));
    }
  };

  // MANUAL ITEMS MANAGEMENT
  const handleAddManualItem = () => {
    if (!newItemName.trim()) return;
    const qty = parseInt(newItemQty) || 1;
    const prc = parseFloat(newItemPrice) || 0;
    const itemSub = qty * prc;

    const updatedItems = [...invoiceFormData.items, {
      name: newItemName.trim(),
      quantity: qty,
      price: prc,
      subtotal: itemSub
    }];

    const newTotal = updatedItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    const sub = invoiceFormData.isExemptIva ? newTotal : newTotal / 1.12;
    const iva = invoiceFormData.isExemptIva ? 0 : newTotal - sub;

    setInvoiceFormData(prev => ({
      ...prev,
      items: updatedItems,
      amount: newTotal.toFixed(2),
      subtotal: sub.toFixed(2),
      iva: iva.toFixed(2)
    }));

    setNewItemName('');
    setNewItemQty('1');
    setNewItemPrice('0');
  };

  const handleRemoveManualItem = (index: number) => {
    const updatedItems = invoiceFormData.items.filter((_, idx) => idx !== index);
    const newTotal = updatedItems.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    const sub = invoiceFormData.isExemptIva ? newTotal : newTotal / 1.12;
    const iva = invoiceFormData.isExemptIva ? 0 : newTotal - sub;

    setInvoiceFormData(prev => ({
      ...prev,
      items: updatedItems,
      amount: newTotal.toFixed(2),
      subtotal: sub.toFixed(2),
      iva: iva.toFixed(2)
    }));
  };

  // HANDLE SUPPLIER CHANGE IN MANUAL REGISTRY
  const handleSupplierChangeInForm = (supplierId: string) => {
    const s = suppliers.find(x => x.id === supplierId);
    if (s) {
      setInvoiceFormData(prev => ({
        ...prev,
        supplierId: s.id,
        supplierNit: s.nit || prev.supplierNit || '',
        supplierNitName: s.legalName || s.name || prev.supplierNitName || '',
        supplierCommercialName: s.name || prev.supplierCommercialName || '',
        creditDays: (s.creditDays ?? 30).toString(),
        title: prev.title || `Factura de ${s.name}`
      }));
    } else {
      setInvoiceFormData(prev => ({ ...prev, supplierId }));
    }
  };

  // SAVE MANUAL OR OCR CONFIRMED INVOICE
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const calculatedDue = calculateDueDate(invoiceFormData.invoiceDate, invoiceFormData.creditDays);
      const totalAmount = parseFloat(invoiceFormData.amount) || 0;
      const subtotalAmount = parseFloat(invoiceFormData.subtotal) || (totalAmount / 1.12);
      const ivaAmount = parseFloat(invoiceFormData.iva) || (totalAmount - subtotalAmount);

      const itemsPayload = invoiceFormData.items && invoiceFormData.items.length > 0 
        ? invoiceFormData.items 
        : [{ 
            name: invoiceFormData.title || "Compra de Insumos", 
            quantity: 1, 
            price: totalAmount, 
            subtotal: totalAmount 
          }];

      const supplierName = invoiceFormData.supplierCommercialName || 
        (suppliers.find(s => s.id === invoiceFormData.supplierId)?.name) || 
        "Proveedor no registrado";

      const payload: Partial<BusinessDebt> = {
        title: invoiceFormData.title || `Factura ${invoiceFormData.invoiceSeries ? invoiceFormData.invoiceSeries + '-' : ''}${invoiceFormData.invoiceNumber || supplierName}`,
        invoiceNumber: invoiceFormData.invoiceNumber.trim(),
        invoiceSeries: invoiceFormData.invoiceSeries.trim().toUpperCase(),
        invoiceType: invoiceFormData.invoiceType,
        dte: invoiceFormData.dte.trim(),
        supplierId: invoiceFormData.supplierId || null,
        supplierNit: invoiceFormData.supplierNit.trim(),
        supplierNitName: invoiceFormData.supplierNitName.trim(),
        supplierCommercialName: invoiceFormData.supplierCommercialName.trim() || supplierName,
        invoiceDate: invoiceFormData.invoiceDate,
        creditDays: parseInt(invoiceFormData.creditDays, 10) || 0,
        dueDate: calculatedDue,
        subtotal: parseFloat(subtotalAmount.toFixed(2)),
        iva: parseFloat(ivaAmount.toFixed(2)),
        amount: parseFloat(totalAmount.toFixed(2)),
        type: invoiceFormData.type,
        notes: invoiceFormData.notes,
        isPaid: invoiceFormData.status === 'entregado' || invoiceFormData.status === 'cancelado',
        receipts: invoiceFormData.id ? (debts.find(d => d.id === invoiceFormData.id)?.receipts || []) : [],
        invoiceImageUrl: invoiceFormData.invoiceImageUrl || undefined,
        orderReceivedBy: invoiceFormData.orderReceivedBy || user?.name || '',
        status: invoiceFormData.status || 'pendiente',
        items: itemsPayload
      };

      if (invoiceFormData.id) {
        // Edit existing
        await api.updateBusinessDebt(invoiceFormData.id, payload);
      } else {
        // Create new
        await api.createBusinessDebt(payload);
      }

      setShowInvoiceModal(false);
      setShowOcrModal(false);
      setOcrStep('idle');
      setOcrFile(null);
      setOcrPreviewUrl('');
      setOcrScannerProgress(0);
      setOcrExtractedData(null);
      resetInvoiceForm();
      await loadData();
    } catch(err: any) {
      alert("Error al guardar factura: " + err.message);
    }
  };

  const resetInvoiceForm = () => {
    setInvoiceFormData({
      id: '',
      title: '',
      invoiceNumber: '',
      invoiceSeries: '',
      invoiceType: 'factura_normal',
      dte: '',
      supplierId: '',
      supplierNit: '',
      supplierNitName: '',
      supplierCommercialName: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      creditDays: '30',
      subtotal: '0',
      iva: '0',
      amount: '0',
      type: 'paga',
      notes: '',
      invoiceImageUrl: '',
      orderReceivedBy: user?.name || '',
      status: 'pendiente',
      items: [],
      isExemptIva: false
    });
  };

  const handleEditInvoiceClick = (d: BusinessDebt) => {
    setInvoiceFormData({
      id: d.id,
      title: d.title,
      invoiceNumber: d.invoiceNumber || '',
      invoiceSeries: d.invoiceSeries || '',
      invoiceType: d.invoiceType || 'factura_normal',
      dte: d.dte || '',
      supplierId: d.supplierId || '',
      supplierNit: d.supplierNit || '',
      supplierNitName: d.supplierNitName || '',
      supplierCommercialName: d.supplierCommercialName || '',
      invoiceDate: d.invoiceDate,
      creditDays: (d.creditDays ?? 30).toString(),
      subtotal: (d.subtotal ?? (d.amount / 1.12)).toFixed(2),
      iva: (d.iva ?? (d.amount - (d.subtotal ?? (d.amount / 1.12)))).toFixed(2),
      amount: d.amount.toString(),
      type: d.type || 'paga',
      notes: d.notes || '',
      invoiceImageUrl: d.invoiceImageUrl || '',
      orderReceivedBy: d.orderReceivedBy || user?.name || '',
      status: d.status || 'pendiente',
      items: d.items || [],
      isExemptIva: d.iva === 0
    });
    setSelectedDebtForDetails(null);
    setShowInvoiceModal(true);
  };

  // SAVE OR UPDATE SUPPLIER
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: supplierFormData.name.trim(),
        legalName: supplierFormData.legalName.trim() || supplierFormData.name.trim(),
        nit: supplierFormData.nit.trim(),
        phone: supplierFormData.phone.trim(),
        email: supplierFormData.email.trim(),
        address: supplierFormData.address.trim(),
        category: supplierFormData.category,
        creditDays: parseInt(supplierFormData.creditDays, 10) || 0,
        bankName: supplierFormData.bankName,
        bankAccount: supplierFormData.bankAccount.trim()
      };

      if (supplierFormData.id) {
        await api.updateSupplier(supplierFormData.id, payload);
      } else {
        await api.createSupplier(payload);
      }
      setShowSupplierModal(false);
      setSupplierFormData({
        id: '',
        name: '',
        legalName: '',
        nit: '',
        phone: '',
        email: '',
        address: '',
        category: 'Medicamentos',
        creditDays: '30',
        bankName: 'Banrural',
        bankAccount: ''
      });
      await loadData();
    } catch (err: any) {
      alert("Error con el proveedor: " + err.message);
    }
  };

  const handleEditSupplierClick = (s: Supplier) => {
    setSupplierFormData({
      id: s.id,
      name: s.name,
      legalName: s.legalName || s.name || '',
      nit: s.nit || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      category: s.category || 'Medicamentos',
      creditDays: (s.creditDays ?? 30).toString(),
      bankName: s.bankName || 'Banrural',
      bankAccount: s.bankAccount || ''
    });
    setShowSupplierModal(true);
  };

  const handleDeleteSupplierClick = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar al proveedor "${name}"?`)) {
      try {
        await api.deleteSupplier(id);
        await loadData();
      } catch(err: any) {
        alert(err.message);
      }
    }
  };

  const handleDeleteDebtClick = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar el registro de factura "${name}"?`)) {
      try {
        await api.deleteBusinessDebt(id);
        await loadData();
      } catch(err: any) {
        alert(err.message);
      }
    }
  };

  // PAYMENTS ACTIONS
  const handleOpenUploadReceipt = (debt?: BusinessDebt) => {
    const targetDebt = debt || debts.find(d => !d.isPaid);
    setSelectedDebtForReceipts(targetDebt || null);

    const initialAmount = targetDebt 
      ? (targetDebt.amount - calculatePaidAmount(targetDebt)).toFixed(2)
      : '';

    setPaymentFormData({
      debtId: targetDebt?.id || '',
      amount: initialAmount,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'boleta',
      bankName: 'Banrural',
      authNumber: '',
      notes: '',
      file: null,
      previewUrl: ''
    });
    setShowUploadReceiptModal(true);
  };

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPaymentFormData(prev => ({
        ...prev,
        file: file,
        previewUrl: URL.createObjectURL(file)
      }));
    }
  };

  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetDebt = debts.find(d => d.id === paymentFormData.debtId);
    if (!targetDebt) {
      return alert("Selecciona la factura a la que corresponde este pago.");
    }

    const payAmount = parseFloat(paymentFormData.amount) || 0;
    if (payAmount <= 0) {
      return alert("Ingresa un monto de pago válido mayor a 0.");
    }

    try {
      let boletaUrl = '';
      if (paymentFormData.file) {
        const uploadRes = await api.uploadReceiptFile(paymentFormData.file);
        boletaUrl = uploadRes.imageUrl;
      }

      const supplierObj = suppliers.find(s => s.id === targetDebt.supplierId);

      const newReceipt: PurchasePaymentReceipt = {
        id: `pay_${Date.now()}`,
        debtId: targetDebt.id,
        paymentDate: paymentFormData.paymentDate,
        amount: payAmount,
        paymentMethod: paymentFormData.paymentMethod,
        authNumber: paymentFormData.authNumber.trim(),
        bankName: paymentFormData.bankName,
        supplierName: targetDebt.supplierCommercialName || supplierObj?.name || 'Proveedor General',
        supplierLegalName: targetDebt.supplierNitName || supplierObj?.legalName || '',
        supplierNit: targetDebt.supplierNit || supplierObj?.nit || '',
        invoiceNumber: targetDebt.invoiceNumber || '',
        invoiceSeries: targetDebt.invoiceSeries || '',
        invoiceDte: targetDebt.dte || '',
        invoiceTitle: targetDebt.title,
        imageUrl: boletaUrl || undefined,
        reference: paymentFormData.authNumber.trim() ? `${paymentFormData.bankName} - Aut #${paymentFormData.authNumber.trim()}` : undefined,
        notes: paymentFormData.notes,
        createdAt: new Date().toISOString()
      };

      const existingReceipts = targetDebt.receipts || [];
      const updatedReceipts = [...existingReceipts, newReceipt];

      const totalPaid = updatedReceipts.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
      const isPaidNow = totalPaid >= targetDebt.amount;

      await api.updateBusinessDebt(targetDebt.id, {
        receipts: updatedReceipts,
        isPaid: isPaidNow,
        status: isPaidNow ? 'entregado' : targetDebt.status
      });

      setShowUploadReceiptModal(false);
      setSelectedDebtForReceipts(null);
      alert(isPaidNow 
        ? "¡Factura liquidada completamente! Ha sido transferida a la sección de Historial de Compras." 
        : `Boleta registrada exitosamente. Saldo restante: Q${(targetDebt.amount - totalPaid).toFixed(2)}`
      );
      await loadData();
    } catch(err: any) {
      alert("Error al registrar pago: " + err.message);
    }
  };

  const calculatePaidAmount = (debt: BusinessDebt): number => {
    if (!debt.receipts || !Array.isArray(debt.receipts)) return 0;
    return debt.receipts.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  };

  // OCR ACTIONS
  const handleOcrFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setOcrFile(file);
      setOcrPreviewUrl(URL.createObjectURL(file));
      setOcrStep('scanning');
      setOcrScannerProgress(15);
      
      const interval = setInterval(() => {
        setOcrScannerProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 25;
        });
      }, 300);

      api.detectInvoiceText(file).then(res => {
        clearInterval(interval);
        setOcrScannerProgress(100);
        setTimeout(() => {
          const data = res.data || {};
          setOcrExtractedData(data);
          
          const rawSupplier = (data.supplierCommercialName || data.supplierName || '').toLowerCase();
          const matchedSupplier = suppliers.find(s => 
            s.name.toLowerCase().includes(rawSupplier) || 
            rawSupplier.includes(s.name.toLowerCase()) ||
            (s.nit && data.supplierNit && s.nit.replace(/[^0-9kK]/g, '') === data.supplierNit.replace(/[^0-9kK]/g, ''))
          );

          const totalVal = parseFloat(data.amount || 0);
          const subVal = parseFloat(data.subtotal || (totalVal / 1.12));
          const ivaVal = parseFloat(data.iva || (totalVal - subVal));

          setInvoiceFormData({
            id: '',
            title: `Factura: ${data.supplierCommercialName || data.supplierName || 'Proveedor Escaneado'}`,
            invoiceNumber: data.invoiceNumber || '',
            invoiceSeries: (data.invoiceSeries || '').toUpperCase(),
            invoiceType: data.invoiceType === 'factura_cambiaria' ? 'factura_cambiaria' : 'factura_normal',
            dte: data.dte || '',
            supplierId: matchedSupplier ? matchedSupplier.id : '',
            supplierNit: data.supplierNit || matchedSupplier?.nit || '',
            supplierNitName: data.supplierNitName || matchedSupplier?.legalName || '',
            supplierCommercialName: data.supplierCommercialName || matchedSupplier?.name || data.supplierName || '',
            invoiceDate: data.invoiceDate || new Date().toISOString().split('T')[0],
            creditDays: (matchedSupplier ? matchedSupplier.creditDays : (data.creditDays || 30)).toString(),
            subtotal: subVal.toFixed(2),
            iva: ivaVal.toFixed(2),
            amount: totalVal.toFixed(2),
            type: 'paga',
            notes: `${data.notes || ''} (Escaneado digitalmente con IA)`.trim(),
            invoiceImageUrl: data.imageUrl || '',
            orderReceivedBy: user?.name || '',
            status: 'pendiente',
            items: data.items || [],
            isExemptIva: ivaVal === 0
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

  // ALERTS COMPILATION
  const getDaysDiff = (dateStr: string): number => {
    if (!dateStr) return 0;
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(dateStr + 'T12:00:00');
    due.setHours(0,0,0,0);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const invoiceAlerts = useMemo(() => {
    return debts
      .filter(d => d.type === 'paga' && !d.isPaid)
      .map(d => {
        const days = getDaysDiff(d.dueDate);
        const s = suppliers.find(x => x.id === d.supplierId);
        return {
          debt: d,
          days,
          supplierName: d.supplierCommercialName || (s ? s.name : "Proveedor Desconocido"),
          dueDate: d.dueDate
        };
      })
      .filter(alertItem => alertItem.days <= 5)
      .sort((a, b) => a.days - b.days);
  }, [debts, suppliers]);

  // ALL PAYMENTS COMPILATION (FLATTENED FROM ALL DEBTS FOR THE PAYMENTS TAB)
  const allPaymentsList = useMemo(() => {
    const list: { receipt: PurchasePaymentReceipt; debt: BusinessDebt }[] = [];
    debts.forEach(debt => {
      if (debt.receipts && Array.isArray(debt.receipts)) {
        debt.receipts.forEach(rec => {
          list.push({
            receipt: rec,
            debt: debt
          });
        });
      }
    });
    // Sort descending by payment date
    return list.sort((a, b) => {
      const dateA = new Date(a.receipt.paymentDate || a.receipt.date || a.receipt.createdAt || 0).getTime();
      const dateB = new Date(b.receipt.paymentDate || b.receipt.date || b.receipt.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [debts]);

  // FILTERED PAYMENTS
  const filteredPayments = useMemo(() => {
    return allPaymentsList.filter(({ receipt, debt }) => {
      const matchesSearch = 
        (receipt.authNumber && receipt.authNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (receipt.reference && receipt.reference.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (receipt.bankName && receipt.bankName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (receipt.supplierName && receipt.supplierName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (receipt.supplierNit && receipt.supplierNit.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (receipt.invoiceNumber && receipt.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (receipt.invoiceSeries && receipt.invoiceSeries.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (receipt.invoiceDte && receipt.invoiceDte.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (debt.title && debt.title.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (selectedBankFilter !== 'Todos' && receipt.bankName !== selectedBankFilter) {
        return false;
      }

      if (selectedPaymentMethodFilter !== 'Todos' && receipt.paymentMethod !== selectedPaymentMethodFilter) {
        return false;
      }

      return true;
    });
  }, [allPaymentsList, searchTerm, selectedBankFilter, selectedPaymentMethodFilter]);

  // FILTERED DEBTS (INVOICES & HISTORY)
  const filteredDebts = useMemo(() => {
    return debts
      .filter(d => {
        const supplierName = d.supplierCommercialName || suppliers.find(s => s.id === d.supplierId)?.name || '';
        const nitStr = d.supplierNit || '';
        const invNumStr = d.invoiceNumber || '';
        const seriesStr = d.invoiceSeries || '';
        const dteStr = d.dte || '';

        const rawTerm = searchTerm.trim().toLowerCase();
        const cleanDigits = rawTerm.replace(/^(?:f|fac|folio|#|\-|\s)+/i, '').trim();

        const matchInvoiceNo = invNumStr && (
          invNumStr.toLowerCase() === rawTerm ||
          `f${invNumStr}`.toLowerCase() === rawTerm ||
          `f-${invNumStr}`.toLowerCase() === rawTerm ||
          `#${invNumStr}`.toLowerCase() === rawTerm ||
          `fac${invNumStr}`.toLowerCase() === rawTerm ||
          `fac-${invNumStr}`.toLowerCase() === rawTerm ||
          (cleanDigits && /^\d+$/.test(cleanDigits) && invNumStr.toLowerCase().includes(cleanDigits)) ||
          invNumStr.toLowerCase().includes(rawTerm)
        );

        const matchCombined = seriesStr && invNumStr && (
          `${seriesStr}${invNumStr}`.toLowerCase().includes(rawTerm) ||
          `${seriesStr}-${invNumStr}`.toLowerCase().includes(rawTerm)
        );

        const matchesSearch = !rawTerm ||
          d.title.toLowerCase().includes(rawTerm) || 
          (d.notes && d.notes.toLowerCase().includes(rawTerm)) ||
          supplierName.toLowerCase().includes(rawTerm) ||
          nitStr.toLowerCase().includes(rawTerm) ||
          matchInvoiceNo ||
          matchCombined ||
          seriesStr.toLowerCase().includes(rawTerm) ||
          dteStr.toLowerCase().includes(rawTerm);
        
        if (!matchesSearch) return false;

        if (selectedInvoiceTypeFilter !== 'Todos' && (d.invoiceType || 'factura_normal') !== selectedInvoiceTypeFilter) {
          return false;
        }
        
        if (activeTab === 'invoices') {
          return !d.isPaid;
        } else if (activeTab === 'history') {
          return d.isPaid;
        }
        return true;
      })
      .sort((a,b) => {
        if (activeTab === 'history') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }, [debts, suppliers, searchTerm, selectedInvoiceTypeFilter, activeTab]);

  // FILTERED SUPPLIERS
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const matchesSearch = 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.legalName && s.legalName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.nit && s.nit.toLowerCase().includes(searchTerm.toLowerCase())) ||
        s.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.phone && s.phone.includes(searchTerm)) ||
        (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()));
      
      if (selectedCategoryFilter !== 'Todos') {
        return matchesSearch && s.category === selectedCategoryFilter;
      }
      return matchesSearch;
    });
  }, [suppliers, searchTerm, selectedCategoryFilter]);

  // METRICS
  const totalOutstanding = useMemo(() => {
    return debts
      .filter(d => d.type === 'paga' && !d.isPaid)
      .reduce((acc, d) => acc + (d.amount - calculatePaidAmount(d)), 0);
  }, [debts]);

  const totalPaidInHistory = useMemo(() => {
    return debts
      .filter(d => d.type === 'paga' && d.isPaid)
      .reduce((acc, d) => acc + d.amount, 0);
  }, [debts]);

  const totalPaymentsAllTime = useMemo(() => {
    return allPaymentsList.reduce((acc, item) => acc + (Number(item.receipt.amount) || 0), 0);
  }, [allPaymentsList]);

  // DOWNLOAD DIGITAL INVOICE TXT
  const handleDownloadInvoice = (d: BusinessDebt) => {
    const supplier = suppliers.find(s => s.id === d.supplierId);
    const paidAmount = calculatePaidAmount(d);
    const remainingAmount = d.amount - paidAmount;

    const textContent = `====================================================
           AGRO-VETERINARIA EL SOL - COMPROBANTE DE COMPRA
====================================================
ID REGISTRO:       ${d.id}
TIPO DE DOCUMENTO: ${(d.invoiceType || 'factura_normal').toUpperCase().replace('_', ' ')}
NÚMERO DE FACTURA: ${d.invoiceNumber || 'S/N'}
SERIE FACTURA:     ${d.invoiceSeries || 'S/S'}
AUTORIZACIÓN DTE:  ${d.dte || 'No especificado (Física)'}
FECHA EMISIÓN:     ${d.invoiceDate}
PLAZO / VIGENCIA:  ${d.creditDays} días
FECHA VENCIMIENTO: ${d.dueDate}
ESTADO LOGÍSTICO:  ${(d.status || 'pendiente').toUpperCase()}
ENCARGADO / ORDEN: ${d.orderReceivedBy || 'Administrador General'}
----------------------------------------------------
DATOS DEL PROVEEDOR:
----------------------------------------------------
Nombre Comercial:  ${d.supplierCommercialName || supplier?.name || 'Distribuidor Independiente'}
Razón Social:      ${d.supplierNitName || supplier?.legalName || 'No registrada'}
NIT Proveedor:     ${d.supplierNit || supplier?.nit || 'CF'}
Teléfono:          ${supplier?.phone || 'No registrado'}
Email:             ${supplier?.email || 'No registrado'}
Dirección:         ${supplier?.address || 'No registrada'}
----------------------------------------------------
DESGLOSE DE ARTÍCULOS ADQUIRIDOS:
----------------------------------------------------
${d.items && d.items.length > 0 
? d.items.map((it, idx) => `[${idx + 1}] ${it.name.padEnd(25)} | Cant: ${it.quantity.toString().padEnd(3)} | P.Unit: Q${it.price.toFixed(2).padEnd(8)} | Subt: ${formatMoney((it.quantity * it.price))}`).join('\n')
: `[-] ${d.title.padEnd(25)}  | Cant: 1   | P.Unit: Q${d.amount.toFixed(2).padEnd(8)} | Subt: ${formatMoney(d.amount)}`
}
----------------------------------------------------
BALANCE CONTABLE:
----------------------------------------------------
MONTO BASE / SUBTOTAL:  ${formatMoney(d.subtotal ?? (d.amount / 1.12))}
MONTO IVA (12%):        ${formatMoney(d.iva ?? (d.amount - (d.subtotal ?? (d.amount / 1.12))))}
TOTAL FACTURADO:        ${formatMoney(d.amount)}
TOTAL ABONADO / PAGADO: ${formatMoney(paidAmount)}
SALDO RESTANTE:         ${formatMoney(remainingAmount)}
====================================================
* Comprobante administrativo interno de compras y gastos de inventario.
* Respaldo digital encriptado en Agro-Veterinaria El Sol.
====================================================`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Compra_${d.invoiceSeries || 'FAC'}_${d.invoiceNumber || d.id}_${d.invoiceDate}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PRINT PAYMENT RECEIPT VOUCHER
  const handlePrintPaymentVoucher = () => {
    window.print();
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-[#fafbfc] pb-32 relative">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4.5 p-5 md:p-6 bg-white border-b border-emerald-900/10 z-20 shrink-0 shadow-sm relative overflow-hidden">
        <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-6">
          <div className="space-y-0.5">
            <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-6 rounded-full bg-[#0b4d2c] block" />
              Gestión de Compras y Cuentas por Pagar
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Control de facturas, facturas cambiarias, boletas y pagos
            </p>
          </div>

          {/* BUSCADOR PRINCIPAL EN CABECERA */}
          <div className="w-full lg:w-80 relative flex items-center shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder={
                activeTab === 'suppliers' 
                  ? "Buscar por NIT, nombre..." 
                  : activeTab === 'payments'
                  ? "Buscar por no. boleta, banco..."
                  : "Buscar por no. factura, serie, NIT, DTE..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-100/80 hover:bg-slate-100 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 focus:bg-white transition text-xs font-bold placeholder-slate-400 shadow-inner text-slate-800"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition"
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setOcrStep('idle');
                setOcrFile(null);
                setOcrPreviewUrl('');
                setShowOcrModal(true);
              }}
              className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-black rounded-2xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all text-xs"
            >
              <Sparkles size={15} /> ESCANER IA
            </motion.button>
            
            <motion.button 
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleOpenUploadReceipt()}
              className="px-3.5 py-2.5 bg-[#116858] hover:bg-[#0c4e42] text-white font-black rounded-2xl flex items-center justify-center gap-1.5 shadow-md shadow-teal-700/20 transition-all text-xs"
            >
              <Landmark size={15} /> REGISTRAR PAGO
            </motion.button>

            <motion.button 
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                resetInvoiceForm();
                setShowInvoiceModal(true);
              }}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-2xl flex items-center justify-center gap-1.5 border border-slate-200 transition-all shadow-xs text-xs"
            >
              <Plus size={15} strokeWidth={2.5} /> NUEVA FACTURA
            </motion.button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">
        
        {/* SUMMARY METRICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <motion.div whileHover={{ y: -4 }} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-28 h-28 bg-orange-500/5 rounded-full blur-2xl group-hover:bg-orange-500/10 transition-colors" />
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo Pendiente</span>
              <p className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{formatMoney(totalOutstanding)}</p>
              <p className="text-xs text-slate-500 font-medium">Deudas por liquidar</p>
            </div>
            <div className="p-3.5 bg-orange-50 text-orange-600 rounded-2xl z-10 shadow-inner">
              <Clock size={24} strokeWidth={2.5} />
            </div>
          </motion.div>
          
          <motion.div whileHover={{ y: -4 }} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-28 h-28 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-colors" />
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alertas de Pago</span>
              <p className="text-2xl md:text-3xl font-black text-rose-600 tracking-tight">{invoiceAlerts.length}</p>
              <p className="text-xs text-rose-500 font-bold">Vencidas o próximas</p>
            </div>
            <div className="p-3.5 bg-rose-50 text-rose-600 rounded-2xl z-10 shadow-inner">
              <AlertTriangle size={24} strokeWidth={2.5} />
            </div>
          </motion.div>

          <motion.div whileHover={{ y: -4 }} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-28 h-28 bg-teal-500/5 rounded-full blur-2xl group-hover:bg-teal-500/10 transition-colors" />
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Pagado en Boletas</span>
              <p className="text-2xl md:text-3xl font-black text-[#116858] tracking-tight">{formatMoney(totalPaymentsAllTime)}</p>
              <p className="text-xs text-teal-700 font-medium">{allPaymentsList.length} transacciones registradas</p>
            </div>
            <div className="p-3.5 bg-teal-50 text-[#116858] rounded-2xl z-10 shadow-inner">
              <Receipt size={24} strokeWidth={2.5} />
            </div>
          </motion.div>

          <motion.div whileHover={{ y: -4 }} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Facturas Liquidadas</span>
              <p className="text-2xl md:text-3xl font-black text-emerald-600 tracking-tight">{debts.filter(d => d.isPaid).length}</p>
              <p className="text-xs text-slate-500 font-medium">{formatMoney(totalPaidInHistory)} archivado</p>
            </div>
            <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl z-10 shadow-inner">
              <FileCheck size={24} strokeWidth={2.5} />
            </div>
          </motion.div>
        </div>

        {/* ALERTS BANNER */}
        {invoiceAlerts.length > 0 && (
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-900">
                <AlertTriangle className="animate-bounce" size={20} />
                <h3 className="text-sm md:text-base font-black uppercase tracking-wider">Centro de Alertas: Facturas por Vencer / Vencidas</h3>
              </div>
              <span className="text-xs font-bold text-amber-800 bg-amber-200/60 px-3 py-1 rounded-full">
                {invoiceAlerts.length} pendientes
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {invoiceAlerts.map(alert => {
                const remaining = alert.debt.amount - calculatePaidAmount(alert.debt);
                return (
                  <div key={alert.debt.id} className="bg-white rounded-2xl p-4 border border-amber-200 shadow-xs flex flex-col justify-between gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] font-black uppercase",
                            alert.debt.invoiceType === 'factura_cambiaria' 
                              ? "bg-purple-100 text-purple-800" 
                              : "bg-blue-50 text-blue-800"
                          )}>
                            {alert.debt.invoiceType === 'factura_cambiaria' ? 'Cambiaria' : 'Normal'}
                          </span>
                          {alert.debt.invoiceSeries && (
                            <span className="text-[10px] font-mono font-bold text-slate-500">
                              Serie {alert.debt.invoiceSeries}-{alert.debt.invoiceNumber || 'S/N'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-black text-slate-800 mt-1 line-clamp-1">{alert.supplierName}</p>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{alert.debt.title}</p>
                      </div>
                      <div className="text-right">
                        {alert.days < 0 ? (
                          <span className="px-2 py-1 bg-rose-100 text-rose-700 text-[10px] font-black rounded-lg inline-block border border-rose-200">
                            ¡Vencida hace {-alert.days}d!
                          </span>
                        ) : alert.days === 0 ? (
                          <span className="px-2 py-1 bg-amber-100 text-amber-800 text-[10px] font-black rounded-lg inline-block border border-amber-200">
                            ¡Vence Hoy!
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-lg inline-block border border-amber-100">
                            En {alert.days} días
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase font-bold block">Saldo Restante</span>
                        <span className="font-black text-rose-600 text-sm">{formatMoney(remaining)}</span>
                      </div>
                      <button
                        onClick={() => handleOpenUploadReceipt(alert.debt)}
                        className="px-3 py-1.5 bg-[#0b4d2c] hover:bg-[#07321d] text-white text-xs font-black rounded-xl flex items-center gap-1 shadow-xs transition"
                      >
                        <Landmark size={12} /> Pagar / Abonar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TABS SELECTOR & STICKY SEARCH BAR */}
        <div className="sticky top-2 z-30 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl md:rounded-3xl border border-slate-200/90 shadow-md shadow-slate-900/5 transition-all">
          <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <button
              onClick={() => { setActiveTab('invoices'); setSearchTerm(''); }}
              className={cn(
                "px-4 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 uppercase tracking-wide shrink-0",
                activeTab === 'invoices' 
                  ? 'bg-[#0b4d2c] text-white shadow-md shadow-emerald-700/20' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              )}
            >
              <FileText size={15} /> Facturas Abiertas
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px]", 
                activeTab === 'invoices' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
              )}>{debts.filter(d=>!d.isPaid).length}</span>
            </button>

            <button
              onClick={() => { setActiveTab('payments'); setSearchTerm(''); }}
              className={cn(
                "px-4 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 uppercase tracking-wide shrink-0",
                activeTab === 'payments' 
                  ? 'bg-[#116858] text-white shadow-md shadow-teal-700/20' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              )}
            >
              <Landmark size={15} /> Gestión de Pagos & Boletas
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px]", 
                activeTab === 'payments' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
              )}>{allPaymentsList.length}</span>
            </button>

            <button
              onClick={() => { setActiveTab('suppliers'); setSearchTerm(''); }}
              className={cn(
                "px-4 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 uppercase tracking-wide shrink-0",
                activeTab === 'suppliers' 
                  ? 'bg-slate-800 text-white shadow-md shadow-slate-700/20' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              )}
            >
              <Building2 size={15} /> Proveedores
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px]", 
                activeTab === 'suppliers' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
              )}>{suppliers.length}</span>
            </button>

            <button
              onClick={() => { setActiveTab('history'); setSearchTerm(''); }}
              className={cn(
                "px-4 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 uppercase tracking-wide shrink-0",
                activeTab === 'history' 
                  ? 'bg-slate-700 text-white shadow-md' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              )}
            >
              <History size={15} /> Historial Liquidado
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px]", 
                activeTab === 'history' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
              )}>{debts.filter(d=>d.isPaid).length}</span>
            </button>
          </div>

          <div className="w-full lg:w-80 relative flex items-center shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder={
                activeTab === 'suppliers' 
                  ? "Buscar por NIT, nombre, teléfono..." 
                  : activeTab === 'payments'
                  ? "Buscar por no. boleta, banco, NIT..."
                  : "Buscar por no. factura, serie, NIT, DTE..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition shadow-inner text-xs font-bold placeholder-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition"
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: FACTURAS ABIERTAS (PURCHASE INVOICES) */}
        {activeTab === 'invoices' && (
          <div className="space-y-6">
            {/* INVOICE FILTERS BAR */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 uppercase tracking-wide">Tipo de Documento:</span>
                <select
                  value={selectedInvoiceTypeFilter}
                  onChange={(e) => setSelectedInvoiceTypeFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-700 text-xs outline-none"
                >
                  <option value="Todos">Todos los Tipos</option>
                  <option value="factura_normal">Factura Normal</option>
                  <option value="factura_cambiaria">Factura Cambiaria</option>
                  <option value="recibo_compra">Recibo de Compra</option>
                </select>
              </div>

              <div className="text-slate-500 text-xs font-medium">
                Mostrando <span className="font-bold text-slate-800">{filteredDebts.length}</span> facturas pendientes
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500 font-bold flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent flex items-center justify-center rounded-full animate-spin" />
                Cargando facturas de compras...
              </div>
            ) : filteredDebts.length === 0 ? (
              <div className="p-16 bg-white border border-slate-100 rounded-[2rem] text-center text-slate-400 shadow-sm">
                <span className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-4">
                  <CheckCircle size={32} />
                </span>
                <p className="font-black text-base text-slate-700">Sin facturas pendientes</p>
                <p className="text-xs text-slate-400 mt-1">No hay compras por pagar con los filtros seleccionados.</p>
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
                  const supplierDisplayName = d.supplierCommercialName || (s ? s.name : "Proveedor No Catalogado");
                  const progressPct = d.amount > 0 ? Math.min(100, Math.round((paidAmount / d.amount) * 100)) : 0;
                  
                  return (
                    <motion.div 
                      key={d.id} 
                      whileHover={{ y: -4 }}
                      className={cn(
                        "bg-white rounded-[2rem] p-6 border transition-all shadow-sm overflow-hidden relative flex flex-col justify-between gap-4 cursor-pointer group",
                        isLate ? "border-rose-200 shadow-rose-100" : isWarning ? "border-amber-200 shadow-amber-100" : "border-slate-100 hover:border-slate-200 hover:shadow-md"
                      )}
                      onClick={() => setSelectedDebtForDetails(d)}
                    >
                      {/* Top Accent Strip */}
                      <div className={cn(
                        "absolute top-0 left-0 right-0 h-1.5 transition-all group-hover:h-2",
                        isLate ? "bg-rose-500" : isWarning ? "bg-amber-400" : d.invoiceType === 'factura_cambiaria' ? "bg-purple-600" : "bg-[#0b4d2c]"
                      )} />

                      <div>
                        {/* Header Badges */}
                        <div className="flex justify-between items-start gap-2 mb-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={cn(
                              "px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border",
                              d.invoiceType === 'factura_cambiaria'
                                ? "bg-purple-50 text-purple-800 border-purple-200"
                                : "bg-blue-50 text-blue-800 border-blue-200"
                            )}>
                              {d.invoiceType === 'factura_cambiaria' ? 'Factura Cambiaria' : 'Factura Normal'}
                            </span>

                            {d.invoiceSeries && (
                              <span className="px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-lg border border-slate-200">
                                Ser: {d.invoiceSeries}
                              </span>
                            )}

                            {d.invoiceNumber && (
                              <span className="px-2 py-1 bg-slate-100 text-slate-800 text-[10px] font-mono font-bold rounded-lg border border-slate-200">
                                No. {d.invoiceNumber}
                              </span>
                            )}
                          </div>

                          <div className={cn(
                            "px-2.5 py-1 text-[10px] font-black uppercase rounded-xl text-center shrink-0 border",
                            isLate ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse" : isWarning ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-slate-50 text-slate-600 border-slate-200"
                          )}>
                            {isLate ? `Atraso ${-daysLeft}d` : daysLeft === 0 ? 'Vence Hoy' : `${daysLeft}d vigencia`}
                          </div>
                        </div>

                        {/* Supplier and Title */}
                        <div className="space-y-1">
                          <h4 className="font-black text-slate-800 text-base leading-snug line-clamp-1 group-hover:text-[#116858] transition">
                            {supplierDisplayName}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium line-clamp-1">{d.title}</p>
                          
                          {(d.supplierNit || d.dte) && (
                            <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] text-slate-400 font-mono">
                              {d.supplierNit && <span>NIT: {d.supplierNit}</span>}
                              {d.dte && <span className="truncate max-w-[140px]" title={d.dte}>DTE: {d.dte}</span>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Amounts and Progress */}
                      <div className="space-y-3 pt-2">
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                          <div className="flex justify-between items-baseline">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">Saldo por Pagar</span>
                            <span className={cn(
                              "text-xl font-black tabular-nums",
                              isLate ? "text-rose-600" : "text-slate-800"
                            )}>
                              {formatMoney(remainingAmount)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                            <span>Subtotal: {formatMoney(d.subtotal ?? (d.amount / 1.12))}</span>
                            <span>IVA: {formatMoney(d.iva ?? (d.amount - (d.subtotal ?? (d.amount / 1.12))))}</span>
                            <span className="font-bold text-slate-700">Total: {formatMoney(d.amount)}</span>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1 pt-1">
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-[#116858] h-full rounded-full transition-all" 
                                style={{ width: `${progressPct}%` }} 
                              />
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                              <span>Abonado: {formatMoney(paidAmount)} ({progressPct}%)</span>
                              <span>F. Vence: {d.dueDate}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenUploadReceipt(d); }}
                              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#0b4d2c] rounded-xl text-xs font-black flex items-center gap-1 border border-emerald-200 transition"
                              title="Registrar boleta o abono"
                            >
                              <Landmark size={14} /> Abonar
                            </button>
                            
                            {d.receipts && d.receipts.length > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setSelectedDebtForReceipts(d); }}
                                className="px-2.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[11px] font-bold border border-slate-200 flex items-center gap-1"
                                title="Ver boletas cargadas"
                              >
                                <Receipt size={13} /> {d.receipts.length}
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEditInvoiceClick(d); }}
                              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                              title="Editar factura"
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteDebtClick(d.id, d.title); }}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                              title="Eliminar registro"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: NUEVA SECCIÓN DE GESTIÓN DE PAGOS & BOLETAS */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            {/* PAYMENTS FILTER & ACTIONS BAR */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Banco:</span>
                  <select
                    value={selectedBankFilter}
                    onChange={(e) => setSelectedBankFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value="Todos">Todos los Bancos</option>
                    {GUATEMALA_BANKS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Método:</span>
                  <select
                    value={selectedPaymentMethodFilter}
                    onChange={(e) => setSelectedPaymentMethodFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none capitalize"
                  >
                    <option value="Todos">Todos los Métodos</option>
                    <option value="boleta">Boleta Bancaria</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="cheque">Cheque</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleOpenUploadReceipt()}
                className="w-full md:w-auto px-5 py-2.5 bg-[#116858] hover:bg-[#0c4e42] text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-teal-700/20"
              >
                <Plus size={16} /> Subir Nueva Boleta
              </motion.button>
            </div>

            {/* PAYMENTS LIST TABLE / CARDS */}
            {filteredPayments.length === 0 ? (
              <div className="p-16 bg-white border border-slate-100 rounded-[2rem] text-center text-slate-400 shadow-sm">
                <Receipt size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="font-black text-base text-slate-700">No hay pagos registrados</p>
                <p className="text-xs text-slate-400 mt-1">Sube comprobantes de boletas o transferencias asociadas a facturas de compras.</p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <th className="p-4">Fecha Pago</th>
                        <th className="p-4">Banco / Método</th>
                        <th className="p-4">No. Boleta / Autorización</th>
                        <th className="p-4">Proveedor & NIT</th>
                        <th className="p-4">Factura / Serie / DTE</th>
                        <th className="p-4 text-right">Monto Pagado</th>
                        <th className="p-4 text-center">Comprobante</th>
                        <th className="p-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                      {filteredPayments.map(({ receipt, debt }) => (
                        <tr key={receipt.id} className="hover:bg-slate-50/60 transition">
                          {/* Date */}
                          <td className="p-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                            {receipt.paymentDate || receipt.date || 'S/F'}
                          </td>

                          {/* Bank & Method */}
                          <td className="p-4">
                            <div className="space-y-0.5">
                              <span className="font-black text-slate-800 block">{receipt.bankName || 'Banrural'}</span>
                              <span className="inline-block px-2 py-0.5 bg-teal-50 text-[#116858] text-[9px] font-bold rounded-md uppercase">
                                {receipt.paymentMethod || 'Boleta'}
                              </span>
                            </div>
                          </td>

                          {/* Authorization Number */}
                          <td className="p-4">
                            <div className="font-mono text-slate-800 font-bold bg-slate-100 px-2.5 py-1 rounded-lg w-max">
                              {receipt.authNumber || receipt.reference || 'S/N'}
                            </div>
                            {receipt.notes && (
                              <p className="text-[10px] text-slate-400 mt-1 italic truncate max-w-[160px]">{receipt.notes}</p>
                            )}
                          </td>

                          {/* Supplier and NIT */}
                          <td className="p-4">
                            <p className="font-black text-slate-800 line-clamp-1">{receipt.supplierName || debt.supplierCommercialName || 'Proveedor'}</p>
                            <p className="text-[10px] font-mono text-slate-400">NIT: {receipt.supplierNit || debt.supplierNit || 'CF'}</p>
                          </td>

                          {/* Invoice, Series & DTE */}
                          <td className="p-4">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-700">
                                  {debt.invoiceSeries ? `Ser: ${debt.invoiceSeries}-` : ''}{debt.invoiceNumber || debt.title}
                                </span>
                              </div>
                              {debt.dte && (
                                <p className="text-[10px] font-mono text-slate-400 truncate max-w-[130px]" title={debt.dte}>
                                  DTE: {debt.dte}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="p-4 text-right">
                            <span className="text-sm font-black text-emerald-600 font-mono block">
                              {formatMoney(receipt.amount)}
                            </span>
                            <span className="text-[9px] text-slate-400">Total fac: {formatMoney(debt.amount)}</span>
                          </td>

                          {/* Receipt Image / Thumbnail */}
                          <td className="p-4 text-center">
                            {receipt.imageUrl ? (
                              <button
                                onClick={() => setLightBoxImage(receipt.imageUrl || null)}
                                className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 inline-flex items-center justify-center bg-slate-900 group hover:opacity-90 transition relative"
                                title="Ver comprobante"
                              >
                                <img src={receipt.imageUrl} alt="Boleta" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                  <Eye size={14} className="text-white" />
                                </div>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Sin imagen</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedPaymentForVoucher({ receipt, debt })}
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                                title="Imprimir Comprobante de Egreso"
                              >
                                <Printer size={14} />
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`¿Estás seguro de desasociar este pago de ${formatMoney(receipt.amount)} de la factura?`)) {
                                    const list = debt.receipts || [];
                                    const filtered = list.filter(r => r.id !== receipt.id);
                                    const newPaid = filtered.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
                                    try {
                                      await api.updateBusinessDebt(debt.id, {
                                        receipts: filtered,
                                        isPaid: newPaid >= debt.amount
                                      });
                                      await loadData();
                                    } catch(err: any) {
                                      alert(err.message);
                                    }
                                  }
                                }}
                                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition"
                                title="Eliminar pago"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PROVEEDORES (SUPPLIERS DIRECTORY) */}
        {activeTab === 'suppliers' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select 
                  value={selectedCategoryFilter} 
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="w-full sm:w-auto bg-slate-50 border-none rounded-xl px-4 py-3 text-xs text-slate-700 font-bold focus:ring-2 focus:ring-teal-500/20 active:scale-95 transition-all outline-none"
                >
                  <option value="Todos">Todas las Categorías</option>
                  <option value="Medicamentos">Medicamentos</option>
                  <option value="Agroquímicos">Agroquímicos</option>
                  <option value="Concentrados">Concentrados</option>
                  <option value="Instrumental">Instrumental</option>
                  <option value="Servicios/Otros">Servicios / Otros</option>
                </select>
              </div>

              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setSupplierFormData({
                    id: '',
                    name: '',
                    legalName: '',
                    nit: '',
                    phone: '',
                    email: '',
                    address: '',
                    category: 'Medicamentos',
                    creditDays: '30',
                    bankName: 'Banrural',
                    bankAccount: ''
                  });
                  setShowSupplierModal(true);
                }}
                className="w-full sm:w-auto px-6 py-3 bg-[#116858] hover:bg-[#0c4e42] text-white rounded-2xl text-xs uppercase font-black tracking-widest flex items-center justify-center gap-2 transition-colors shadow-lg shadow-teal-500/20"
              >
                <Plus size={16} strokeWidth={2.5} /> Añadir Proveedor
              </motion.button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400 gap-4">
                  <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent animate-spin rounded-full" />
                  <p className="font-bold">Cargando directorio de proveedores...</p>
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="col-span-full p-16 text-center shadow-sm bg-white rounded-[2rem] border border-slate-100">
                  <Building2 size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="font-black text-lg text-slate-600">Directorio vacío</p>
                  <p className="text-slate-400 font-medium">No hay proveedores que coincidan con la búsqueda.</p>
                </div>
              ) : (
                filteredSuppliers.map(s => {
                  const providerDebts = debts.filter(d => d.supplierId === s.id && !d.isPaid);
                  const providerOutstanding = providerDebts.reduce((acc, d) => acc + (d.amount - calculatePaidAmount(d)), 0);

                  return (
                    <motion.div 
                      key={s.id} 
                      whileHover={{ y: -4 }}
                      className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 relative overflow-hidden group"
                    >
                      <div className="space-y-3 relative z-10">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                              {s.category}
                            </span>
                            <h3 className="font-black text-slate-800 text-lg mt-2 line-clamp-1 group-hover:text-[#116858] transition">
                              {s.name}
                            </h3>
                            {s.legalName && s.legalName !== s.name && (
                              <p className="text-xs text-slate-500 line-clamp-1 italic">{s.legalName}</p>
                            )}
                          </div>
                          {s.nit && (
                            <span className="px-2.5 py-1 bg-teal-50 text-[#116858] text-[10px] font-mono font-black rounded-lg border border-teal-100">
                              NIT: {s.nit}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                          {s.phone && (
                            <p className="flex items-center gap-2">
                              <Phone size={13} className="text-[#116858]" /> {s.phone}
                            </p>
                          )}
                          {s.email && (
                            <p className="flex items-center gap-2 truncate">
                              <Mail size={13} className="text-[#116858]" /> {s.email}
                            </p>
                          )}
                          {s.address && (
                            <p className="flex items-center gap-2 line-clamp-1" title={s.address}>
                              <MapPin size={13} className="text-[#116858]" /> {s.address}
                            </p>
                          )}
                          {s.bankName && (
                            <p className="flex items-center gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 font-mono">
                              <Landmark size={13} className="text-slate-400" /> {s.bankName} {s.bankAccount ? `| Cta: ${s.bankAccount}` : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex flex-col gap-2 relative z-10">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] uppercase font-black text-slate-400">Deuda Pendiente</span>
                          {providerOutstanding > 0 ? (
                            <span className="font-black text-rose-600 text-base">{formatMoney(providerOutstanding)}</span>
                          ) : (
                            <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-full border border-emerald-100">Al día</span>
                          )}
                        </div>

                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[10px] text-slate-400 font-bold">
                            Crédito: {s.creditDays} días
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleEditSupplierClick(s)}
                              className="p-2 bg-slate-100 hover:bg-[#116858] text-slate-600 hover:text-white rounded-xl transition"
                              title="Editar proveedor"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteSupplierClick(s.id, s.name)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
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

        {/* TAB 4: HISTORIAL LIQUIDADO */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="bg-emerald-600 rounded-[2rem] p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-white shadow-lg shadow-emerald-600/20 relative overflow-hidden">
              <div className="space-y-2 relative z-10 max-w-xl">
                <span className="inline-block px-3 py-1 bg-black/15 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
                  Archivo Permanente
                </span>
                <h3 className="font-extrabold text-2xl lg:text-3xl flex items-center gap-2">
                  <CheckCircle2 size={32} /> Historial de Facturas Liquidadas
                </h3>
                <p className="text-emerald-100 text-xs md:text-sm font-medium">
                  Registro histórico de todas las compras solventadas con su respaldo de boletas de pago y comprobantes fiscales.
                </p>
              </div>
              <div className="bg-white text-emerald-950 rounded-2xl px-6 py-4 shadow-inner relative z-10 flex flex-col items-center md:items-end">
                <span className="text-[10px] text-emerald-700 uppercase font-black tracking-wider block mb-0.5">Total Liquidado</span>
                <span className="font-black text-2xl md:text-3xl">{formatMoney(totalPaidInHistory)}</span>
              </div>
            </div>

            {filteredDebts.length === 0 ? (
              <div className="p-16 text-center shadow-sm bg-white rounded-[2rem] border border-slate-100">
                <History className="mx-auto text-slate-200 mb-4" size={48} />
                <p className="font-black text-lg text-slate-600">Historial vacío</p>
                <p className="text-slate-400 font-medium">Aún no hay facturas completamente canceladas registradas en el archivo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDebts.map(d => {
                  const s = suppliers.find(sup => sup.id === d.supplierId);
                  
                  return (
                    <motion.div 
                      key={d.id} 
                      whileHover={{ y: -4 }}
                      className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group cursor-pointer"
                      onClick={() => setSelectedDebtForDetails(d)}
                    >
                      <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-emerald-500" />
                      
                      <div className="flex justify-between items-start mb-3">
                        <div className="space-y-1">
                          <span className={cn(
                            "px-2 py-0.5 text-[9px] font-black uppercase rounded",
                            d.invoiceType === 'factura_cambiaria' ? "bg-purple-50 text-purple-800" : "bg-blue-50 text-blue-800"
                          )}>
                            {d.invoiceType === 'factura_cambiaria' ? 'Factura Cambiaria' : 'Factura Normal'}
                          </span>
                          <h4 className="font-black text-slate-800 text-base line-clamp-1 mt-1">
                            {d.supplierCommercialName || (s ? s.name : d.title)}
                          </h4>
                          <p className="text-xs text-slate-500 line-clamp-1">{d.title}</p>
                        </div>
                        
                        <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <CheckCircle size={18} strokeWidth={2.5} />
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3.5 rounded-2xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400">Total Liquidado</p>
                          <p className="text-lg font-black text-emerald-600">{formatMoney(d.amount)}</p>
                        </div>
                        <div className="text-right text-xs">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Fecha Emisión</p>
                          <p className="font-bold text-slate-700">{d.invoiceDate}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-1.5 text-[11px] font-black text-[#116858] bg-teal-50 border border-teal-100 px-3 py-1 rounded-xl">
                          <FileCheck size={13} /> {d.receipts?.length || 0} COMPROBANTES
                        </div>
                        
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteDebtClick(d.id, d.title); }}
                          className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition"
                          title="Eliminar del archivo"
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
        )}
      </div>

      {/* MODAL 1: REGISTRO / EDICIÓN MANUAL DE FACTURA DE COMPRA */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <FileText className="text-[#116858]" /> 
                  {invoiceFormData.id ? 'Modificar Factura de Compra' : 'Ingreso de Factura de Compra'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">Registro fiscal y administrativo para cuentas por pagar de compras</p>
              </div>
              <button 
                onClick={() => { setShowInvoiceModal(false); resetInvoiceForm(); }} 
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="space-y-4">
              
              {/* SUPPLIER & DOCUMENT TYPE */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/60 space-y-3">
                <span className="text-[11px] font-black text-[#0b4d2c] uppercase tracking-wider block">1. Datos del Proveedor y Tipo de Documento</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Proveedor en Catálogo</label>
                    <select 
                      value={invoiceFormData.supplierId} 
                      onChange={e => handleSupplierChangeInForm(e.target.value)} 
                      className="w-full px-3 py-2 border rounded-xl text-xs text-slate-700 bg-white font-bold"
                    >
                      <option value="">-- Seleccionar o Escribir Manual --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} (NIT: {s.nit || 'CF'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Tipo de Factura</label>
                    <select 
                      value={invoiceFormData.invoiceType} 
                      onChange={e => setInvoiceFormData({...invoiceFormData, invoiceType: e.target.value as PurchaseInvoiceType})} 
                      className="w-full px-3 py-2 border rounded-xl text-xs text-slate-700 bg-white font-black"
                    >
                      <option value="factura_normal">Factura Normal</option>
                      <option value="factura_cambiaria">Factura Cambiaria</option>
                      <option value="recibo_compra">Recibo de Compra / Ticket</option>
                      <option value="otro">Otro Comprobante</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Nombre Comercial de la Empresa</label>
                    <input 
                      required 
                      type="text" 
                      placeholder="Ej: Agroquímicos del Pacífico"
                      value={invoiceFormData.supplierCommercialName} 
                      onChange={e => setInvoiceFormData({...invoiceFormData, supplierCommercialName: e.target.value})} 
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white" 
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Nombre en NIT (Razón Social)</label>
                    <input 
                      type="text" 
                      placeholder="Ej: Agroquímicos, S.A."
                      value={invoiceFormData.supplierNitName} 
                      onChange={e => setInvoiceFormData({...invoiceFormData, supplierNitName: e.target.value})} 
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white" 
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">NIT del Proveedor</label>
                    <input 
                      type="text" 
                      placeholder="Ej: 1234567-8"
                      value={invoiceFormData.supplierNit} 
                      onChange={e => setInvoiceFormData({...invoiceFormData, supplierNit: e.target.value})} 
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white font-mono" 
                    />
                  </div>
                </div>
              </div>

              {/* INVOICE NUMBER, SERIES, DTE, DATES */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/60 space-y-3">
                <span className="text-[11px] font-black text-[#0b4d2c] uppercase tracking-wider block">2. Identificación del Documento & Plazos</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Número de Serie</label>
                    <input 
                      type="text" 
                      placeholder="Ej: A, FC, 39B..."
                      value={invoiceFormData.invoiceSeries} 
                      onChange={e => setInvoiceFormData({...invoiceFormData, invoiceSeries: e.target.value})} 
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white uppercase font-mono" 
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Número de Factura</label>
                    <input 
                      type="text" 
                      placeholder="Ej: 104928"
                      value={invoiceFormData.invoiceNumber} 
                      onChange={e => setInvoiceFormData({...invoiceFormData, invoiceNumber: e.target.value})} 
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white font-mono" 
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">DTE / No. Autorización SAT</label>
                    <input 
                      type="text" 
                      placeholder="Código DTE / UUID"
                      value={invoiceFormData.dte} 
                      onChange={e => setInvoiceFormData({...invoiceFormData, dte: e.target.value})} 
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white font-mono" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Fecha de Emisión</label>
                    <input 
                      required 
                      type="date" 
                      value={invoiceFormData.invoiceDate} 
                      onChange={e => setInvoiceFormData({...invoiceFormData, invoiceDate: e.target.value})} 
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white font-bold" 
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Tiempo de Vigencia / Plazo (Días)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={invoiceFormData.creditDays} 
                      onChange={e => setInvoiceFormData({...invoiceFormData, creditDays: e.target.value})} 
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white text-center font-bold" 
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Fecha Vencimiento (Calculada)</label>
                    <div className="px-3 py-2 bg-white border rounded-xl text-xs font-mono font-black text-emerald-800 flex items-center justify-between">
                      <span>{calculateDueDate(invoiceFormData.invoiceDate, invoiceFormData.creditDays) || 'S/F'}</span>
                      <Calendar size={13} className="text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* FINANCIAL BREAKDOWN (SUBTOTAL, IVA, TOTAL) */}
              <div className="p-4 bg-teal-50/40 rounded-2xl border border-teal-200/60 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-black text-[#116858] uppercase tracking-wider block">3. Desglose Económico de la Factura</span>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 font-bold cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={invoiceFormData.isExemptIva}
                      onChange={e => handleToggleExemptIva(e.target.checked)}
                      className="rounded text-teal-600 focus:ring-teal-500" 
                    />
                    Exento de IVA
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Monto Base / Subtotal (Q)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={invoiceFormData.subtotal} 
                      onChange={e => handleSubtotalChange(e.target.value)} 
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white text-right font-mono" 
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">IVA (12%) (Q)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={invoiceFormData.iva} 
                      onChange={e => setInvoiceFormData({...invoiceFormData, iva: e.target.value})} 
                      disabled={invoiceFormData.isExemptIva}
                      className="w-full px-3 py-2 border rounded-xl text-xs bg-white text-right font-mono disabled:bg-slate-100 text-slate-600" 
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-wide block mb-1">Total Factura (Q)</label>
                    <input 
                      required 
                      type="number" 
                      step="0.01" 
                      value={invoiceFormData.amount} 
                      onChange={e => handleAmountChange(e.target.value)} 
                      className="w-full px-3 py-2 border-2 border-teal-500 rounded-xl text-sm bg-white text-right font-black font-mono text-[#116858]" 
                    />
                  </div>
                </div>
              </div>

              {/* PRODUCTS BREAKDOWN (OPTIONAL) */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/60 space-y-3">
                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">4. Líneas de Artículos o Insumos (Opcional)</span>
                
                {invoiceFormData.items && invoiceFormData.items.length > 0 && (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {invoiceFormData.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white px-3 py-1.5 rounded-xl border text-xs text-slate-600">
                        <span className="font-bold truncate max-w-[200px]">{item.name}</span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {item.quantity} x {formatMoney(item.price)} = {formatMoney(item.quantity * item.price)}
                        </span>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveManualItem(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-12 gap-2 pt-2 border-t border-slate-200">
                  <div className="col-span-6">
                    <input 
                      type="text" 
                      placeholder="Descripción de artículo" 
                      value={newItemName}
                      onChange={e => setNewItemName(e.target.value)}
                      className="w-full px-2.5 py-1.5 border rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="number" 
                      placeholder="Cant" 
                      min="1"
                      value={newItemQty}
                      onChange={e => setNewItemQty(e.target.value)}
                      className="w-full px-2.5 py-1.5 border rounded-lg text-xs text-center bg-white"
                    />
                  </div>
                  <div className="col-span-3">
                    <input 
                      type="number" 
                      placeholder="P. Unit" 
                      step="0.01"
                      value={newItemPrice}
                      onChange={e => setNewItemPrice(e.target.value)}
                      className="w-full px-2.5 py-1.5 border rounded-lg text-xs text-right bg-white"
                    />
                  </div>
                  <div className="col-span-1">
                    <button 
                      type="button" 
                      onClick={handleAddManualItem}
                      className="w-full h-full bg-[#116858] hover:bg-[#0c4e42] text-white rounded-lg flex items-center justify-center font-bold"
                      title="Añadir línea"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* RECEPTION & NOTES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Encargado de Orden / Recepción</label>
                  <input 
                    type="text" 
                    value={invoiceFormData.orderReceivedBy} 
                    onChange={e => setInvoiceFormData({...invoiceFormData, orderReceivedBy: e.target.value})} 
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-white" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Estado del Insumo</label>
                  <select 
                    value={invoiceFormData.status} 
                    onChange={e => setInvoiceFormData({...invoiceFormData, status: e.target.value as any})} 
                    className="w-full px-3 py-2 border rounded-xl text-xs bg-white text-slate-700 font-bold"
                  >
                    <option value="pendiente">⏳ Pendiente de Pago</option>
                    <option value="pedido">📦 Pedido en Camino</option>
                    <option value="entregado">✅ Entregado e Ingresado</option>
                    <option value="cancelado">❌ Cancelado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Notas / Observaciones del Gasto</label>
                <textarea 
                  value={invoiceFormData.notes} 
                  rows={2}
                  placeholder="Detalles sobre número de lote, uso en bodega o referencias..."
                  onChange={e => setInvoiceFormData({...invoiceFormData, notes: e.target.value})} 
                  className="w-full px-3 py-2 border rounded-xl text-xs resize-none bg-white" 
                />
              </div>

              <div className="pt-3 flex gap-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => { setShowInvoiceModal(false); resetInvoiceForm(); }} 
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition text-xs"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-[#0b4d2c] hover:bg-[#07321d] text-white font-black rounded-2xl transition text-xs shadow-md"
                >
                  {invoiceFormData.id ? 'Guardar Cambios' : 'Confirmar e Ingresar Factura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTRO / EDICIÓN DE PROVEEDOR */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6">
            <div className="flex justify-between items-center mb-5 pb-2 border-b">
              <div>
                <h3 className="text-xl font-black text-slate-800">
                  {supplierFormData.id ? 'Modificar Proveedor' : 'Registrar Proveedor'}
                </h3>
                <p className="text-xs text-slate-400">Directorio de marcas y distribuidores autorizados</p>
              </div>
              <button onClick={() => setShowSupplierModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3.5">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Nombre Comercial de la Empresa</label>
                <input required type="text" placeholder="Ej: Droguería El Sol" value={supplierFormData.name} onChange={e => setSupplierFormData({...supplierFormData, name: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Razón Social en NIT</label>
                  <input type="text" placeholder="Droguería El Sol, S.A." value={supplierFormData.legalName} onChange={e => setSupplierFormData({...supplierFormData, legalName: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">NIT Proveedor</label>
                  <input type="text" placeholder="1234567-8" value={supplierFormData.nit} onChange={e => setSupplierFormData({...supplierFormData, nit: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl text-xs font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Categoría</label>
                  <select 
                    value={supplierFormData.category} 
                    onChange={e => setSupplierFormData({...supplierFormData, category: e.target.value})} 
                    className="w-full px-3 py-2.5 border rounded-xl text-xs text-slate-700 bg-white"
                  >
                    <option value="Medicamentos">Medicamentos</option>
                    <option value="Agroquímicos">Agroquímicos</option>
                    <option value="Concentrados">Concentrados</option>
                    <option value="Instrumental">Instrumental</option>
                    <option value="Servicios/Otros">Servicios / Otros</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Días Plazo por Defecto</label>
                  <input type="number" min="0" value={supplierFormData.creditDays} onChange={e => setSupplierFormData({...supplierFormData, creditDays: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl text-xs text-center" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Banco para Transferencias</label>
                  <select 
                    value={supplierFormData.bankName} 
                    onChange={e => setSupplierFormData({...supplierFormData, bankName: e.target.value})} 
                    className="w-full px-3 py-2.5 border rounded-xl text-xs text-slate-700 bg-white font-bold"
                  >
                    {GUATEMALA_BANKS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">No. de Cuenta Bancaria</label>
                  <input type="text" placeholder="Monetaria / Ahorros" value={supplierFormData.bankAccount} onChange={e => setSupplierFormData({...supplierFormData, bankAccount: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl text-xs font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Teléfono</label>
                  <input type="text" placeholder="+502 " value={supplierFormData.phone} onChange={e => setSupplierFormData({...supplierFormData, phone: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Correo Electrónico</label>
                  <input type="email" placeholder="contacto@proveedor.com" value={supplierFormData.email} onChange={e => setSupplierFormData({...supplierFormData, email: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl text-xs" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Dirección Física / Despacho</label>
                <input type="text" placeholder="Ciudad / Municipio" value={supplierFormData.address} onChange={e => setSupplierFormData({...supplierFormData, address: e.target.value})} className="w-full px-3 py-2.5 border rounded-xl text-xs" />
              </div>

              <div className="pt-3 flex gap-3">
                <button type="button" onClick={() => setShowSupplierModal(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-[#116858] hover:bg-[#0c4e42] text-white font-black rounded-2xl text-xs shadow-md">Guardar Proveedor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REGISTRO DE PAGO / BOLETA BANCARIA */}
      {showUploadReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-2 border-b">
              <div>
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <Landmark className="text-[#116858]" /> Registrar Pago / Boleta de Banco
                </h3>
                <p className="text-xs text-slate-400">Abono bancario a compras de insumos</p>
              </div>
              <button 
                onClick={() => { setShowUploadReceiptModal(false); setSelectedDebtForReceipts(null); }} 
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveReceipt} className="space-y-4">
              {/* SELECT TARGET INVOICE */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Factura a Pagar</label>
                <select
                  required
                  value={paymentFormData.debtId}
                  onChange={(e) => {
                    const found = debts.find(d => d.id === e.target.value);
                    setSelectedDebtForReceipts(found || null);
                    if (found) {
                      const rem = (found.amount - calculatePaidAmount(found)).toFixed(2);
                      setPaymentFormData(prev => ({
                        ...prev,
                        debtId: found.id,
                        amount: rem
                      }));
                    } else {
                      setPaymentFormData(prev => ({ ...prev, debtId: e.target.value }));
                    }
                  }}
                  className="w-full px-3 py-2.5 border rounded-xl text-xs bg-white font-bold text-slate-800"
                >
                  <option value="">-- Seleccionar Factura Pendiente --</option>
                  {debts.filter(d => !d.isPaid).map(d => {
                    const rem = d.amount - calculatePaidAmount(d);
                    const sup = d.supplierCommercialName || suppliers.find(s => s.id === d.supplierId)?.name || 'Proveedor';
                    return (
                      <option key={d.id} value={d.id}>
                        {sup} | Ser: {d.invoiceSeries || 'S/S'}-{d.invoiceNumber || 'S/N'} | Saldo: Q{rem.toFixed(2)}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* TARGET DEBT BALANCE CARD */}
              {selectedDebtForReceipts && (
                <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-2xl flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Factura Total:</span>
                    <span className="font-extrabold text-slate-700 text-sm">{formatMoney(selectedDebtForReceipts.amount)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Saldo Pendiente:</span>
                    <span className="font-black text-rose-600 text-sm">
                      {formatMoney(selectedDebtForReceipts.amount - calculatePaidAmount(selectedDebtForReceipts))}
                    </span>
                  </div>
                </div>
              )}

              {/* PAYMENT AMOUNT & METHOD */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Monto a Pagar (Q)</label>
                  <input 
                    required 
                    type="number" 
                    step="0.01" 
                    value={paymentFormData.amount} 
                    onChange={e => setPaymentFormData({...paymentFormData, amount: e.target.value})} 
                    className="w-full px-3 py-2.5 border-2 border-teal-500 rounded-xl text-sm font-black font-mono text-[#116858] bg-white text-right" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Tipo de Pago</label>
                  <select 
                    value={paymentFormData.paymentMethod} 
                    onChange={e => setPaymentFormData({...paymentFormData, paymentMethod: e.target.value as PurchasePaymentMethod})} 
                    className="w-full px-3 py-2.5 border rounded-xl text-xs bg-white font-bold capitalize"
                  >
                    <option value="boleta">Boleta Bancaria</option>
                    <option value="transferencia">Transferencia Bancaria</option>
                    <option value="cheque">Cheque</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta Débito/Crédito</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              {/* BANK & AUTH NUMBER */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Banco de Origen / Transacción</label>
                  <select 
                    value={paymentFormData.bankName} 
                    onChange={e => setPaymentFormData({...paymentFormData, bankName: e.target.value})} 
                    className="w-full px-3 py-2.5 border rounded-xl text-xs bg-white font-bold"
                  >
                    {GUATEMALA_BANKS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">No. Boleta / Autorización</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Código o número de boleta" 
                    value={paymentFormData.authNumber} 
                    onChange={e => setPaymentFormData({...paymentFormData, authNumber: e.target.value})} 
                    className="w-full px-3 py-2.5 border rounded-xl text-xs font-mono font-bold bg-white" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Fecha del Pago</label>
                <input 
                  required 
                  type="date" 
                  value={paymentFormData.paymentDate} 
                  onChange={e => setPaymentFormData({...paymentFormData, paymentDate: e.target.value})} 
                  className="w-full px-3 py-2.5 border rounded-xl text-xs bg-white font-bold" 
                />
              </div>

              {/* FILE UPLOAD BOX */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">
                  Foto o PDF del Comprobante / Boleta
                </label>
                {!paymentFormData.previewUrl ? (
                  <div className="border-2 border-dashed border-slate-200 hover:border-teal-400 rounded-2xl p-5 text-center cursor-pointer relative bg-slate-50 hover:bg-teal-50/20 transition">
                    <input 
                      type="file" 
                      accept="image/*,application/pdf" 
                      onChange={handleReceiptFileChange} 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                    />
                    <Upload className="mx-auto text-slate-400 mb-1.5" size={24} />
                    <p className="text-xs text-slate-600 font-bold">Haz clic o arrastra foto o PDF de la boleta de banco</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Formatos .jpg, .png, .pdf</p>
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden border bg-slate-900 border-slate-200 h-36 flex items-center justify-center p-3">
                    {paymentFormData.file?.type === 'application/pdf' ? (
                      <div className="flex flex-col items-center justify-center text-slate-300 gap-1">
                        <FileText size={36} className="text-rose-500 animate-pulse" />
                        <span className="text-xs font-mono font-bold truncate max-w-[220px]">{paymentFormData.file.name}</span>
                        <span className="text-[9px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Documento PDF</span>
                      </div>
                    ) : (
                      <img src={paymentFormData.previewUrl} className="w-full h-full object-contain" alt="Preview Boleta" />
                    )}
                    <button 
                      type="button" 
                      onClick={() => setPaymentFormData(p=>({...p, file: null, previewUrl: ''}))} 
                      className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full transition"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide block mb-1">Notas del Pago</label>
                <input 
                  type="text" 
                  placeholder="ej. Transferencia desde cuenta de ahorro..." 
                  value={paymentFormData.notes} 
                  onChange={e => setPaymentFormData({...paymentFormData, notes: e.target.value})} 
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-white" 
                />
              </div>

              <div className="pt-3 flex gap-3 border-t">
                <button 
                  type="button" 
                  onClick={() => { setShowUploadReceiptModal(false); setSelectedDebtForReceipts(null); }} 
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-[#116858] hover:bg-[#0c4e42] text-white font-black rounded-2xl text-xs shadow-md flex items-center justify-center gap-1.5"
                >
                  <Landmark size={15} /> Registrar Boleta de Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ESCANEO DIGITAL INTELIGENTE OCR CON GEMINI */}
      {showOcrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-3 border-b">
              <div>
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <Sparkles className="text-teal-600 animate-pulse" /> Escaneo Inteligente de Facturas (IA)
                </h3>
                <p className="text-slate-500 text-xs mt-0.5 font-medium">
                  Extrae automáticamente NIT, Razón Social, Serie, No. Factura, DTE, Subtotal, IVA y artículos
                </p>
              </div>
              <button 
                onClick={() => { 
                  setShowOcrModal(false); 
                  setOcrStep('idle'); 
                  setOcrFile(null); 
                  setOcrPreviewUrl(''); 
                  setOcrScannerProgress(0); 
                  setOcrExtractedData(null); 
                }} 
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

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
                <h4 className="text-lg font-extrabold text-slate-800 mb-2">Seleccionar o Arrastrar Factura de Compra</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-1">
                  Carga cualquier factura física, electrónica o cambiaria. El motor de IA analizará la imagen y completará la ficha automáticamente.
                </p>
                <p className="text-[10px] text-slate-400 font-mono mt-4">
                  Soporta imágenes (.jpg, .png) y documentos PDF
                </p>
              </div>
            )}

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
                  <div className="absolute left-0 right-0 h-1 bg-teal-500/80 shadow-lg shadow-teal-500 animate-bounce" style={{ animationDuration: '2.5s' }} />
                </div>
                
                <div className="max-w-md mx-auto space-y-3">
                  <h4 className="font-extrabold text-slate-800 text-base flex items-center justify-center gap-2">
                    <Sparkles className="animate-spin text-teal-500" size={18} /> Procesando datos fiscales y contables con Gemini...
                  </h4>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-600 rounded-full transition-all duration-300" style={{ width: `${ocrScannerProgress}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 italic">"Detectando NIT, Razón Social, No. de Factura, Serie, DTE e Impuestos..."</p>
                </div>
              </div>
            )}

            {ocrStep === 'review' && ocrExtractedData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Visualizer Frame */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Original Escaneado</span>
                  <div className="rounded-2xl border bg-slate-900 border-slate-200 overflow-hidden h-64 relative flex items-center justify-center p-3 text-center">
                    {ocrPreviewUrl && (
                      ocrFile?.type === 'application/pdf' ? (
                        <div className="flex flex-col items-center justify-center text-slate-300 gap-2">
                          <FileText size={56} className="text-rose-500" />
                          <span className="text-xs font-mono font-bold truncate max-w-[220px]">{ocrFile.name}</span>
                        </div>
                      ) : (
                        <img src={ocrPreviewUrl} className="w-full h-full object-contain" alt="Original scanned bill" />
                      )
                    )}
                  </div>

                  <div className="bg-slate-50 p-3.5 border rounded-2xl space-y-2 text-xs">
                    <span className="font-black text-[#116858] block">Artículos detectados:</span>
                    <div className="max-h-32 overflow-y-auto space-y-1 divide-y divide-slate-100 pr-1">
                      {ocrExtractedData.items && ocrExtractedData.items.length > 0 ? (
                        ocrExtractedData.items.map((item: any, id: number) => (
                          <div key={id} className="pt-1 flex justify-between items-center text-slate-600">
                            <span className="truncate max-w-[180px] font-medium">{item.name}</span>
                            <span className="font-mono text-slate-500">x{item.quantity} ({formatMoney(item.price || 0)})</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-slate-400 italic text-[11px]">Líneas no individualizadas.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form Editor For Confirmation */}
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Revisión y Ajuste de Datos Extraídos</span>
                  
                  <form onSubmit={handleSaveInvoice} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Nombre Comercial Empresa</label>
                        <input 
                          required 
                          type="text" 
                          placeholder="Ej. Agroquímicos del Pacífico"
                          value={invoiceFormData.supplierCommercialName} 
                          onChange={e => setInvoiceFormData({...invoiceFormData, supplierCommercialName: e.target.value})} 
                          className="w-full px-3 py-2 text-xs border rounded-xl bg-white font-bold" 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Nombre en NIT / Razón Social</label>
                        <input 
                          type="text" 
                          placeholder="Ej. Agroquímicos del Pacífico, S.A."
                          value={invoiceFormData.supplierNitName} 
                          onChange={e => setInvoiceFormData({...invoiceFormData, supplierNitName: e.target.value})} 
                          className="w-full px-3 py-2 text-xs border rounded-xl bg-white font-medium text-slate-700" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">NIT Proveedor</label>
                        <input 
                          type="text" 
                          placeholder="Ej. 3491028-1"
                          value={invoiceFormData.supplierNit} 
                          onChange={e => setInvoiceFormData({...invoiceFormData, supplierNit: e.target.value})} 
                          className="w-full px-3 py-2 text-xs border rounded-xl font-mono font-bold" 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Tipo de Factura</label>
                        <select 
                          value={invoiceFormData.invoiceType} 
                          onChange={e => setInvoiceFormData({...invoiceFormData, invoiceType: e.target.value as any})} 
                          className={cn(
                            "w-full px-3 py-2 text-xs border rounded-xl font-black",
                            invoiceFormData.invoiceType === 'factura_cambiaria' ? "bg-purple-50 text-purple-800 border-purple-300" : "bg-blue-50 text-blue-800 border-blue-300"
                          )}
                        >
                          <option value="factura_normal">📄 Factura Normal</option>
                          <option value="factura_cambiaria">📜 Factura Cambiaria</option>
                          <option value="recibo_compra">🧾 Recibo de Compra</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Serie</label>
                        <input 
                          type="text" 
                          placeholder="Ej. A, FC, F39B"
                          value={invoiceFormData.invoiceSeries} 
                          onChange={e => setInvoiceFormData({...invoiceFormData, invoiceSeries: e.target.value})} 
                          className="w-full px-3 py-2 text-xs border rounded-xl font-mono uppercase font-bold" 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">No. Factura</label>
                        <input 
                          type="text" 
                          placeholder="Ej. 85921"
                          value={invoiceFormData.invoiceNumber} 
                          onChange={e => setInvoiceFormData({...invoiceFormData, invoiceNumber: e.target.value})} 
                          className="w-full px-3 py-2 text-xs border rounded-xl font-mono font-bold" 
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">DTE / Autorización SAT</label>
                      <input 
                        type="text" 
                        value={invoiceFormData.dte} 
                        onChange={e => setInvoiceFormData({...invoiceFormData, dte: e.target.value})} 
                        className="w-full px-3 py-2 text-xs border rounded-xl font-mono" 
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Subtotal (Q)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          value={invoiceFormData.subtotal} 
                          onChange={e => handleSubtotalChange(e.target.value)} 
                          className="w-full px-2.5 py-1.5 text-xs border rounded-xl font-mono text-right" 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">IVA (Q)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          value={invoiceFormData.iva} 
                          onChange={e => setInvoiceFormData({...invoiceFormData, iva: e.target.value})} 
                          className="w-full px-2.5 py-1.5 text-xs border rounded-xl font-mono text-right" 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-700 uppercase block mb-1">Total (Q)</label>
                        <input 
                          required 
                          type="number" 
                          step="0.01" 
                          value={invoiceFormData.amount} 
                          onChange={e => handleAmountChange(e.target.value)} 
                          className="w-full px-2.5 py-1.5 text-xs border-2 border-teal-500 rounded-xl font-black font-mono text-right text-[#116858]" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Fecha Emisión</label>
                        <input 
                          type="date" 
                          value={invoiceFormData.invoiceDate} 
                          onChange={e => setInvoiceFormData({...invoiceFormData, invoiceDate: e.target.value})} 
                          className="w-full px-2.5 py-1.5 text-xs border rounded-xl font-bold" 
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Plazo (Días)</label>
                        <input 
                          type="number" 
                          value={invoiceFormData.creditDays} 
                          onChange={e => setInvoiceFormData({...invoiceFormData, creditDays: e.target.value})} 
                          className="w-full px-2.5 py-1.5 text-xs border rounded-xl text-center" 
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex gap-2 border-t">
                      <button 
                        type="button" 
                        onClick={() => setOcrStep('idle')} 
                        className="flex-1 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50" 
                      >
                        Escanear Otra
                      </button>
                      <button 
                        type="submit" 
                        className="flex-1 py-2.5 bg-[#116858] hover:bg-[#0c4e42] text-white font-black rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5"
                      >
                        <FileCheck size={14} /> Guardar en Facturas
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 5: DETALLE COMPLETO DE FACTURA DE COMPRA */}
      {selectedDebtForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl p-6 relative max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5 pb-3 border-b">
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2.5 py-0.5 text-[10px] font-black uppercase rounded-md",
                    selectedDebtForDetails.invoiceType === 'factura_cambiaria' ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                  )}>
                    {selectedDebtForDetails.invoiceType === 'factura_cambiaria' ? 'Factura Cambiaria' : 'Factura Normal'}
                  </span>
                  <h3 className="text-xl font-black text-slate-800">Detalle de Factura de Compra</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Visualización fiscal y auditoría de pagos</p>
              </div>
              <button onClick={() => setSelectedDebtForDetails(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LEFT: DIGITAL VOUCHER SHEET */}
              <div className="space-y-4">
                <div className="border border-dashed border-slate-300 rounded-2xl p-5 bg-slate-50/70 space-y-3.5 text-slate-700 text-xs">
                  <div className="text-center pb-3 border-b border-slate-200">
                    <h4 className="font-extrabold text-slate-900 uppercase text-sm">Agro-Veterinaria El Sol</h4>
                    <p className="text-[10px] text-slate-400">Control de Abastecimiento & Cuentas por Pagar</p>
                    <span className="text-[9px] bg-white text-slate-500 px-3 py-0.5 rounded-full font-mono mt-1 inline-block border">
                      REG: #{selectedDebtForDetails.id}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Proveedor</span>
                      <p className="font-black text-slate-800 text-sm">
                        {selectedDebtForDetails.supplierCommercialName || suppliers.find(s => s.id === selectedDebtForDetails.supplierId)?.name || 'Distribuidor General'}
                      </p>
                      {selectedDebtForDetails.supplierNitName && (
                        <p className="text-[11px] text-slate-500 italic">Razón Social: {selectedDebtForDetails.supplierNitName}</p>
                      )}
                      <p className="text-[10px] font-mono text-slate-500">
                        NIT: {selectedDebtForDetails.supplierNit || suppliers.find(s => s.id === selectedDebtForDetails.supplierId)?.nit || 'CF'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Serie / Factura</span>
                        <p className="font-bold text-slate-800 font-mono">
                          {selectedDebtForDetails.invoiceSeries ? `Ser. ${selectedDebtForDetails.invoiceSeries} - ` : ''}No. {selectedDebtForDetails.invoiceNumber || 'S/N'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">DTE / Autorización</span>
                        <p className="font-mono text-slate-800 truncate" title={selectedDebtForDetails.dte}>
                          {selectedDebtForDetails.dte || 'Física / S/DTE'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Fecha Emisión</span>
                        <p className="font-semibold text-slate-800 font-mono">{selectedDebtForDetails.invoiceDate}</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Fecha Vencimiento</span>
                        <p className="font-semibold text-slate-800 font-mono">{selectedDebtForDetails.dueDate} ({selectedDebtForDetails.creditDays}d)</p>
                      </div>
                    </div>
                  </div>

                  {/* ITEMS TABLE */}
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[10px] uppercase font-extrabold text-slate-400 block mb-1.5">Artículos de la Factura</span>
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[9px] text-slate-400 font-bold uppercase border-b">
                            <th className="p-2">Desc.</th>
                            <th className="p-2 text-center">Cant</th>
                            <th className="p-2 text-right">P. Unit</th>
                            <th className="p-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600">
                          {selectedDebtForDetails.items && selectedDebtForDetails.items.length > 0 ? (
                            selectedDebtForDetails.items.map((it, idx) => (
                              <tr key={idx}>
                                <td className="p-2 font-medium truncate max-w-[120px]">{it.name}</td>
                                <td className="p-2 text-center font-mono">{it.quantity}</td>
                                <td className="p-2 text-right font-mono">{formatMoney(it.price)}</td>
                                <td className="p-2 text-right font-mono font-bold text-slate-800">{formatMoney(it.quantity * it.price)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td className="p-2 font-medium">{selectedDebtForDetails.title}</td>
                              <td className="p-2 text-center font-mono">1</td>
                              <td className="p-2 text-right font-mono">{formatMoney(selectedDebtForDetails.amount)}</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-800">{formatMoney(selectedDebtForDetails.amount)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* FINANCIAL BALANCES */}
                  <div className="pt-2 border-t border-slate-200 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Monto Base / Subtotal:</span>
                      <span className="font-mono">{formatMoney(selectedDebtForDetails.subtotal ?? (selectedDebtForDetails.amount / 1.12))}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Monto IVA (12%):</span>
                      <span className="font-mono">{formatMoney(selectedDebtForDetails.iva ?? (selectedDebtForDetails.amount - (selectedDebtForDetails.subtotal ?? (selectedDebtForDetails.amount / 1.12))))}</span>
                    </div>
                    <div className="flex justify-between font-black text-slate-800 pt-1 border-t">
                      <span>Total Factura:</span>
                      <span className="font-mono">{formatMoney(selectedDebtForDetails.amount)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Total Abonado:</span>
                      <span className="font-mono">{formatMoney(calculatePaidAmount(selectedDebtForDetails))}</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-rose-600 pt-1 border-t border-dashed">
                      <span>Saldo Pendiente:</span>
                      <span className="font-mono">{formatMoney(selectedDebtForDetails.amount - calculatePaidAmount(selectedDebtForDetails))}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownloadInvoice(selectedDebtForDetails)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Download size={13} /> Descargar Archivo TXT
                  </button>
                  <button
                    onClick={() => {
                      const d = selectedDebtForDetails;
                      setSelectedDebtForDetails(null);
                      handleOpenUploadReceipt(d);
                    }}
                    className="flex-1 py-2.5 bg-[#0b4d2c] hover:bg-[#07321d] text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Landmark size={13} /> Abonar / Pagar
                  </button>
                </div>
              </div>

              {/* RIGHT: INVOICE BACKUPS & RECEIPT LIST */}
              <div className="space-y-4">
                {/* 1. ORIGINAL INVOICE PICTURE */}
                <div className="bg-slate-50 border p-4 rounded-2xl space-y-2">
                  <span className="text-xs font-black text-slate-500 uppercase block">Fotografía / Respaldo de Factura</span>
                  {selectedDebtForDetails.invoiceImageUrl ? (
                    <div className="relative group rounded-xl overflow-hidden border bg-slate-900 aspect-[4/3] flex items-center justify-center">
                      <img src={selectedDebtForDetails.invoiceImageUrl} className="w-full h-full object-cover" alt="Factura escaneada" />
                      <button
                        onClick={() => setLightBoxImage(selectedDebtForDetails.invoiceImageUrl || null)}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                      >
                        <span className="px-3 py-1.5 bg-white text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md">
                          <Eye size={13} /> Pantalla Completa
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-6 border border-dashed text-center rounded-xl bg-white text-slate-400">
                      <ImageOff className="mx-auto mb-1.5 text-slate-300" size={24} />
                      <p className="text-xs font-bold">Sin foto de factura adjunta</p>
                    </div>
                  )}
                </div>

                {/* 2. ASSOCIATED PAYMENTS / SLIPS */}
                <div className="bg-slate-50 border p-4 rounded-2xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-700 uppercase">Boletas de Pago Amparadas ({selectedDebtForDetails.receipts?.length || 0})</span>
                  </div>

                  {!selectedDebtForDetails.receipts || selectedDebtForDetails.receipts.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 italic py-4">No se han registrado boletas de pago aún.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {selectedDebtForDetails.receipts.map(rec => (
                        <div key={rec.id} className="p-3 bg-white rounded-xl border flex items-center justify-between gap-3 text-xs">
                          <div className="space-y-0.5">
                            <span className="font-black text-[#116858] block">{formatMoney(rec.amount)}</span>
                            <p className="text-[10px] text-slate-500">
                              {rec.paymentDate || rec.date} | {rec.bankName || 'Banrural'} {rec.authNumber ? `(Aut #${rec.authNumber})` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {rec.imageUrl && (
                              <button
                                onClick={() => setLightBoxImage(rec.imageUrl || null)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                                title="Ver comprobante"
                              >
                                <Eye size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedPaymentForVoucher({ receipt: rec, debt: selectedDebtForDetails })}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                              title="Imprimir Comprobante"
                            >
                              <Printer size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: RECIBO OFICIAL DE EGRESO / COMPROBANTE DE PAGO A PROVEEDOR IMPRIMIBLE */}
      {selectedPaymentForVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl p-6 md:p-8 relative">
            <div className="flex justify-between items-center mb-6 pb-2 border-b print:hidden">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Receipt className="text-[#116858]" /> Comprobante Oficial de Pago de Compras
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handlePrintPaymentVoucher}
                  className="px-3.5 py-1.5 bg-[#0b4d2c] hover:bg-[#07321d] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Printer size={14} /> Imprimir Recibo
                </button>
                <button onClick={() => setSelectedPaymentForVoucher(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* PRINTABLE VOUCHER CONTENT */}
            <div className="border-2 border-slate-800 rounded-2xl p-6 space-y-4 font-sans text-slate-800 bg-white" id="payment-voucher-printable">
              <div className="text-center pb-3 border-b-2 border-slate-800">
                <h2 className="text-xl font-black uppercase tracking-wide">Agro-Veterinaria El Sol</h2>
                <p className="text-xs font-bold text-slate-600">Comprobante de Egreso / Recibo de Pago a Proveedor</p>
                <p className="text-[10px] text-slate-500">Guatemala C.A. - Abastecimiento y Control Financiero</p>
                <div className="mt-2 inline-block px-3 py-0.5 bg-slate-100 rounded-full text-xs font-mono font-black border border-slate-300">
                  COMPROBANTE NO: {selectedPaymentForVoucher.receipt.id}
                </div>
              </div>

              {/* DATE & DETAILS */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Fecha de Pago:</span>
                  <span className="font-mono font-bold text-sm">{selectedPaymentForVoucher.receipt.paymentDate || selectedPaymentForVoucher.receipt.date}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Método / Banco:</span>
                  <span className="font-black text-sm text-[#0b4d2c]">{selectedPaymentForVoucher.receipt.bankName} ({selectedPaymentForVoucher.receipt.paymentMethod || 'Boleta'})</span>
                </div>
              </div>

              {/* SUPPLIER INFO */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase block">Proveedor Beneficiario:</span>
                <p className="font-black text-sm text-slate-900">{selectedPaymentForVoucher.receipt.supplierName || selectedPaymentForVoucher.debt?.supplierCommercialName}</p>
                {selectedPaymentForVoucher.receipt.supplierLegalName && (
                  <p className="text-xs text-slate-600">Razón Social: {selectedPaymentForVoucher.receipt.supplierLegalName}</p>
                )}
                <p className="text-xs font-mono font-bold text-slate-700">NIT: {selectedPaymentForVoucher.receipt.supplierNit || selectedPaymentForVoucher.debt?.supplierNit || 'CF'}</p>
              </div>

              {/* INVOICE REFERENCE INFO */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase block">Documento de Factura Amparado:</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500">Serie / No. Factura:</span>
                    <span className="font-bold font-mono ml-1">
                      {selectedPaymentForVoucher.debt?.invoiceSeries ? `Ser. ${selectedPaymentForVoucher.debt.invoiceSeries}-` : ''}{selectedPaymentForVoucher.receipt.invoiceNumber || selectedPaymentForVoucher.debt?.invoiceNumber || 'S/N'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Tipo Factura:</span>
                    <span className="font-bold capitalize ml-1">
                      {selectedPaymentForVoucher.debt?.invoiceType === 'factura_cambiaria' ? 'Factura Cambiaria' : 'Factura Normal'}
                    </span>
                  </div>
                </div>
                {selectedPaymentForVoucher.debt?.dte && (
                  <p className="text-[11px] font-mono text-slate-600">
                    <span className="text-slate-400">Autorización DTE:</span> {selectedPaymentForVoucher.debt.dte}
                  </p>
                )}
              </div>

              {/* TRANSACTION INFO */}
              <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t">
                <div>
                  <span className="text-slate-500 block">No. de Autorización / Boleta:</span>
                  <span className="font-mono font-black text-base text-slate-900">
                    {selectedPaymentForVoucher.receipt.authNumber || selectedPaymentForVoucher.receipt.reference || 'S/N'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Monto Pagado:</span>
                  <span className="font-mono font-black text-xl text-[#0b4d2c]">
                    {formatMoney(selectedPaymentForVoucher.receipt.amount)}
                  </span>
                </div>
              </div>

              {selectedPaymentForVoucher.receipt.notes && (
                <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border">
                  <span className="font-bold">Observaciones:</span> {selectedPaymentForVoucher.receipt.notes}
                </div>
              )}

              {/* SIGNATURE BOXES */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
                <div>
                  <div className="border-b border-slate-400 pb-2 mb-1" />
                  <p className="font-bold text-slate-800">Entregado / Pagado por</p>
                  <p className="text-[10px] text-slate-400">Agro-Veterinaria El Sol</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-2 mb-1" />
                  <p className="font-bold text-slate-800">Recibido Conforme / Proveedor</p>
                  <p className="text-[10px] text-slate-400">Firma o Sello de Depósito</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: LIGHTBOX IMAGE OVERLAY */}
      {lightBoxImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 transition-opacity">
          <button 
            onClick={() => setLightBoxImage(null)} 
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition"
          >
            <X size={24} />
          </button>
          
          <div className="max-w-4xl max-h-[85vh] overflow-hidden flex items-center justify-center rounded-2xl bg-slate-900 border border-white/10 relative shadow-2xl">
            <img src={lightBoxImage} className="max-w-full max-h-[80vh] object-contain" alt="Comprobante ampliado" />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/75 font-mono bg-black/70 px-4 py-1.5 rounded-full border border-white/10">
              Visor de Comprobantes de Pago y Facturas
            </div>
          </div>
        </div>
      )}

      {/* FLOATING PERSISTENT SEARCH & ACTION DOCK */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-xl bg-slate-900/95 backdrop-blur-xl text-white p-2 sm:p-2.5 rounded-2xl md:rounded-3xl shadow-2xl border border-slate-700/80 flex items-center gap-2.5"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-400" size={16} />
              <input
                type="text"
                placeholder={
                  activeTab === 'suppliers' 
                    ? "🔍 Buscar proveedor por NIT o nombre..." 
                    : activeTab === 'payments'
                    ? "🔍 Buscar boleta, banco, NIT..."
                    : "🔍 Buscar factura, serie, NIT, DTE..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-slate-800/90 text-white placeholder-slate-400 rounded-xl md:rounded-2xl text-xs font-bold border border-slate-700 focus:border-teal-400 focus:bg-slate-800 outline-none shadow-inner transition-all"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-full hover:bg-slate-700 transition"
                  title="Limpiar búsqueda"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              onClick={scrollToTop}
              className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-xl md:rounded-2xl transition flex items-center gap-1.5 text-xs font-black shrink-0 cursor-pointer shadow-md active:scale-95"
              title="Volver arriba"
            >
              <ArrowUp size={16} />
              <span className="hidden sm:inline">Inicio</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
