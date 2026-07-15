import React, { useEffect, useState, useMemo } from 'react';
import { User, Invoice, Product } from '../types';
import { api } from '../api';
import { Scanner } from '@yudiel/react-qr-scanner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Package, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  ArrowLeft, 
  Printer, 
  Truck, 
  QrCode, 
  X, 
  Plus, 
  Minus, 
  History,
  AlertCircle
} from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { cn } from '../utils';

interface DispatchPageProps {
  user: User;
  isMobile: boolean;
}

const StableScanner = React.memo(({ onScan, disabled, isFlashActive }: { onScan: (id: string) => void, disabled: boolean, isFlashActive: boolean }) => {
  return (
    <div className="aspect-square bg-white/5 rounded-3xl border-2 border-dashed border-white/20 overflow-hidden relative">
      <AnimatePresence>
        {isFlashActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-emerald-500/30 z-20 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {disabled ? (
        <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-center p-6 z-10">
          <AlertCircle size={40} className="text-orange-500 mb-4" />
          <p className="text-white font-black text-sm uppercase">ORDEN CERRADA</p>
          <p className="text-white/40 text-[10px] font-bold mt-1">Ya no se permiten escaneos</p>
        </div>
      ) : (
        <Scanner
          onScan={(result) => {
            if (result?.[0]?.rawValue) onScan(result[0].rawValue);
          }}
          onError={(error) => console.log(error?.message)}
          constraints={{ facingMode: 'environment' }}
          styles={{ container: { width: '100%', height: '100%' } }}
        />
      )}
    </div>
  );
});

export function DispatchPage({ user, isMobile }: DispatchPageProps) {
  const [scannedData, setScannedData] = React.useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatchedItems, setDispatchedItems] = useState<Record<string, number>>({});
  const [pendingProduct, setPendingProduct] = useState<{ productId: string, productName: string, maxQty: number } | null>(null);
  const [quantityInput, setQuantityInput] = useState<number>(1);
  const [isDispatching, setIsDispatching] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'despachado'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [isFlashActive, setIsFlashActive] = useState(false);

  // Use refs to keep handleScan stable and avoid scanner re-renders
  const invoiceRef = React.useRef<Invoice | null>(null);
  const dispatchedRef = React.useRef<Record<string, number>>({});
  const lastScannedRef = React.useRef<{ id: string, time: number } | null>(null);

  useEffect(() => {
    invoiceRef.current = selectedInvoice;
    dispatchedRef.current = dispatchedItems;
  }, [selectedInvoice, dispatchedItems]);

  // Audio feedback helper
  const playBeep = (type: 'success' | 'error' = 'success') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(type === 'success' ? 880 : 220, audioCtx.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      console.warn("Audio feedback failed", e);
    }
  };

  const handleDispatch = async () => {
    if (!selectedInvoice) return;
    if (confirm(`¿Estás seguro de marcar como DESPACHADO el egreso #${selectedInvoice.id.replace('INV-', '')}? Esto bloqueará el registro.`)) {
      try {
        setIsDispatching(true);
        await api.dispatchInvoice(selectedInvoice.id);
        
        // Update local state to reflect change
        setSelectedInvoice(prev => prev ? { ...prev, status: 'despachado' } : null);
        setInvoices(prev => prev.map(inv => inv.id === selectedInvoice.id ? { ...inv, status: 'despachado' } : inv));
        
        alert("Egreso despachado y respaldado correctamente.");
      } catch (err) {
        console.error(err);
        alert("Error al despachar el egreso.");
      } finally {
        setIsDispatching(false);
      }
    }
  };

  useEffect(() => {
    if (selectedInvoice) {
      const saved = localStorage.getItem(`dispatchedItems_${selectedInvoice.id}`);
      setDispatchedItems(saved ? JSON.parse(saved) : {});
    }
  }, [selectedInvoice]);

  useEffect(() => {
    if (selectedInvoice) {
      localStorage.setItem(`dispatchedItems_${selectedInvoice.id}`, JSON.stringify(dispatchedItems));
    }
  }, [dispatchedItems, selectedInvoice]);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setLoading(true);
        const data = await api.getInvoices();
        // Sort by date descending (newest first) and filter out unwanted test users
        const sorted = (Array.isArray(data) ? data : []).sort((a: any, b: any) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        ).filter((inv: any) => 
          !inv.client?.toLowerCase().includes("francisco zepeda") && 
          !inv.client?.toLowerCase().includes("fernando zamora")
        );
        setInvoices(sorted);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  const [logoData, setLogoData] = useState<string>('');

  useEffect(() => {
    // Pre-load logo and convert to Base64 for PDF compatibility
    const loadLogo = async () => {
      const paths = ['/logo_final.jpg', '/logo.png.png', '/agricovet.png', '/logo.png'];
      for (const p of paths) {
        try {
          const res = await fetch(p);
          if (res.ok) {
            const blob = await res.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
              const b64 = reader.result as string;
              if (b64 && b64.length > 100) setLogoData(b64);
            };
            reader.readAsDataURL(blob);
            break;
          }
        } catch (err) {
          console.error("Logo load error:", err);
        }
      }
    };
    loadLogo();
  }, []);

  const filteredInvoices = useMemo(() => {
    return invoices
      .filter(inv => activeTab === 'despachado' ? inv.status === 'despachado' : inv.status !== 'despachado')
      .filter(inv => 
        inv.client?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [invoices, activeTab, searchQuery]);

  const handleScan = React.useCallback((productId: string) => {
    const currentInvoice = invoiceRef.current;
    const currentDispatched = dispatchedRef.current;

    if (!currentInvoice || currentInvoice.status === 'despachado') return;
    
    // Prevent accidental rapid double scans of the same ID (800ms cooldown)
    const now = Date.now();
    if (lastScannedRef.current && lastScannedRef.current.id === productId && (now - lastScannedRef.current.time) < 800) {
      return;
    }

    lastScannedRef.current = { id: productId, time: now };
    setScannedData(productId);
    
    const item = currentInvoice.items.find(i => i.productId === productId);
    if (item) {
      const currentQty = currentDispatched[productId] || 0;
      if (currentQty < item.quantity) {
        setDispatchedItems(prev => ({
          ...prev,
          [productId]: (prev[productId] || 0) + 1
        }));
        
        // Visual feedback
        setIsFlashActive(true);
        setTimeout(() => setIsFlashActive(false), 150);
        
        // Audio feedback
        playBeep('success');
      } else {
        // Already fully dispatched
        playBeep('error');
      }
    } else {
      // Product not in invoice
      playBeep('error');
    }
  }, []); // Truly stable callback to prevent scanner re-renders

  const adjustQuantity = (productId: string, delta: number) => {
    if (selectedInvoice?.status === 'despachado') return;
    
    const item = selectedInvoice?.items.find(i => i.productId === productId);
    if (!item) return;

    setDispatchedItems(prev => {
      const current = prev[productId] || 0;
      const next = Math.max(0, Math.min(item.quantity, current + delta));
      return { ...prev, [productId]: next };
    });
  };

  const confirmQuantity = () => {
    if (pendingProduct) {
      const qty = Math.max(0, Math.min(pendingProduct.maxQty, quantityInput));
      setDispatchedItems(prev => ({
        ...prev,
        [pendingProduct.productId]: qty
      }));
      setPendingProduct(null);
      setQuantityInput(1);
    }
  };

  const generatePDF = async () => {
    if (!selectedInvoice) return;

    try {
      await api.saveDispatch({
        invoiceId: selectedInvoice.id,
        items: selectedInvoice.items,
        client: selectedInvoice.client,
        sellerId: selectedInvoice.sellerId
      });
    } catch (e) {
      console.error("Error saving dispatch:", e);
    }
    
    // Priority 1: Use pre-loaded logo data
    let base64Logo = logoData;
    
    // Priority 2: Try to grab from the UI header image if it's already rendered
    if (!base64Logo) {
      const headerImg = document.querySelector('img[alt="Agricovet Logo"]') as HTMLImageElement;
      if (headerImg && headerImg.complete && headerImg.naturalHeight !== 0) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = headerImg.naturalWidth;
          canvas.height = headerImg.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(headerImg, 0, 0);
            base64Logo = canvas.toDataURL('image/png');
          }
        } catch (e) {
          console.error("Canvas draw error:", e);
        }
      }
    }

    // Priority 3: Fallback fetch (Existing logic but cleaner)
    if (!base64Logo) {
      const logoPaths = ['/logo_final.jpg', '/logo.png.png', '/agricovet.png', '/logo.png'];
      for (const path of logoPaths) {
        try {
          const response = await fetch(path);
          if (response.ok) {
            const blob = await response.blob();
            base64Logo = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            if (base64Logo) break;
          }
        } catch (e) {}
      }
    }

    const totalAmount = selectedInvoice.items.reduce((sum, item) => sum + (dispatchedItems[item.productId] || 0) * (item.price || 0), 0);

    const element = document.createElement('div');
    element.style.width = '750px';
    element.style.padding = '25px 30px';
    element.style.backgroundColor = '#ffffff';
    element.style.fontFamily = "'Arial Black', 'Arial', sans-serif";
    
    const itemsHtml = selectedInvoice.items.map((item) => {
        const qty = dispatchedItems[item.productId] || 0;
        const price = item.price || 0;
        const subtotal = qty * price;
        return `
          <tr style="border-bottom: 1px solid #f1f5f9; page-break-inside: avoid;">
            <td style="padding: 10px 8px; color: #0f172a; font-size: 9pt; font-weight: 900; text-align: left;">${item.productName || 'Producto'}</td>
            <td style="padding: 10px 8px; color: #1e293b; font-size: 9pt; font-weight: 900; text-align: center;">${qty}</td>
            <td style="padding: 10px 8px; color: #64748b; font-size: 8.5pt; text-align: right;">Q ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
            <td style="padding: 10px 8px; color: #1A4D2E; font-size: 9.5pt; text-align: right; font-weight: 900;">Q ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
          </tr>
        `;
    }).join('');

    element.innerHTML = `
      <div style="font-size: 7.5pt; font-weight: 900; color: #cbd5e1; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 2px;">DOCUMENTO INTERNO DE DESPACHO</div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div style="flex: 1;">
          <h1 style="font-size: 26pt; font-weight: 900; color: #1A4D2E; margin: 0; line-height: 0.85; letter-spacing: -1.5px; text-transform: uppercase;">ORDEN DE<br>EGRESO</h1>
          <div style="font-size: 9pt; color: #475569; line-height: 1.3; margin-top: 10px; font-family: Arial, sans-serif;">
            <span style="display: block; margin-bottom: 2px;"><strong>Gerencia:</strong> Agricovetsa@gmail.com</span>
            <span style="display: block; margin-bottom: 2px;"><strong>Teléfono:</strong> +502 3645 0241</span>
            <span style="display: block;">Santa Elena, Petén, Guatemala</span>
          </div>
        </div>
        <div style="border: 2px solid #1A4D2E; padding: 8px; border-radius: 16px; background-color: #ffffff; width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
          ${base64Logo ? `<img id="pdf-logo-final" src="${base64Logo}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />` : '<div style="font-size: 10pt; color: #1A4D2E; font-weight: 900;">AGRICOVET</div>'}
        </div>
      </div>
      
      <div style="background-color: #1A4D2E; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-radius: 8px;">
        <span style="color: #ffffff; font-size: 9pt; font-weight: 900; letter-spacing: 0.5px;">POLÍTICA: DEVOLUCIONES HASTA 8 DÍAS</span>
        <span style="font-size: 9pt; font-weight: 900; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 3px;">AGRICOVET</span>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 30px; font-family: Arial, sans-serif;">
        <div style="width: 48%; border-left: 3px solid #1A4D2E; padding-left: 12px;">
          <div style="font-size: 8pt; font-weight: 900; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1.5px;">DESTINATARIO</div>
          <div style="font-weight: 900; font-size: 12pt; color: #0f172a; margin-bottom: 4px;">${selectedInvoice.client}</div>
          <div style="font-size: 9.5pt; color: #475569; line-height: 1.4;">
            <strong>NIT:</strong> ${selectedInvoice.nit || 'C/F'}<br>
            <strong>Dirección:</strong> ${selectedInvoice.address || 'Ciudad'}<br>
            <strong>Teléfono:</strong> ${selectedInvoice.phone || 'N/A'}
          </div>
        </div>
        <div style="width: 48%; border-left: 3px solid #e2e8f0; padding-left: 12px;">
          <div style="font-size: 8pt; font-weight: 900; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1.5px;">DATOS DEL ENVÍO</div>
          <div style="font-size: 9.5pt; color: #475569; line-height: 1.4;">
            <strong>No. Control:</strong> #${selectedInvoice.id.replace('INV-', '')}<br>
            <strong>Fecha Egreso:</strong> ${new Date().toLocaleDateString()}<br>
            <strong>Pago:</strong> ${selectedInvoice.paymentMethod || 'CREDITO'}<br>
            <strong>Estado:</strong> <span style="color: #ea580c; font-weight: 900;">PENDIENTE</span><br>
            <strong>Responsable:</strong> ${selectedInvoice.seller || 'Sistema'}
          </div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 3px solid #1A4D2E;">
            <th style="padding: 12px 8px; text-align: left; font-size: 9pt; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: 1.5px;">PRODUCTO / DESCRIPCIÓN</th>
            <th style="padding: 12px 8px; text-align: center; font-size: 9pt; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: 1.5px; width: 12%;">CANT.</th>
            <th style="padding: 12px 8px; text-align: right; font-size: 9pt; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: 1.5px; width: 18%;">PRECIO UNIT.</th>
            <th style="padding: 12px 8px; text-align: right; font-size: 9pt; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: 1.5px; width: 18%;">SUBTOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      
      <div style="margin-top: 30px; width: 100%; display: flex; justify-content: flex-end;">
        <table style="width: 320px; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 12px; color: #64748b; text-align: left; font-size: 10pt; font-weight: 900;">VALOR BRUTO</td>
            <td style="padding: 6px 12px; font-weight: 900; color: #0f172a; text-align: right; font-size: 10pt;">Q ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
          </tr>
          <tr>
            <td style="padding: 6px 12px; color: #059669; text-align: left; font-size: 9pt; font-weight: 900;">ABONOS/PAGOS</td>
            <td style="padding: 6px 12px; font-weight: 900; color: #059669; text-align: right; font-size: 9pt;">Q 0.00</td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top: 15px;">
              <div style="background-color: #1A4D2E; border-radius: 16px; padding: 15px 25px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 8px 16px -4px rgba(26, 77, 46, 0.3);">
                <span style="font-weight: 900; font-size: 10pt; color: #ffffff; text-transform: uppercase; letter-spacing: 2px;">TOTAL NETO</span>
                <span style="font-weight: 900; font-size: 20pt; color: #ffffff;">Q ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
              </div>
            </td>
          </tr>
        </table>
      </div>
    `;

    document.body.appendChild(element);
    
    // Explicitly wait for the logo image to load
    const imgElement = element.querySelector('#pdf-logo-final') as HTMLImageElement;
    if (imgElement) {
      await new Promise((resolve) => {
        if (imgElement.complete && imgElement.naturalHeight !== 0) resolve(null);
        else {
          imgElement.onload = () => resolve(null);
          imgElement.onerror = () => resolve(null);
        }
      });
    }
    
    // Safety delay for final layout painting
    await new Promise(r => setTimeout(r, 400));
    
    try {
      await html2pdf().from(element).set({
        margin: 5,
        filename: `orden_egreso_${selectedInvoice.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          letterRendering: true,
          allowTaint: true
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).save();
    } catch (err) {
      console.error("PDF Export error:", err);
    } finally {
      document.body.removeChild(element);
    }




  };

  return (
    <div className="h-screen flex flex-col bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-[#1A4D2E] p-2 rounded-xl shadow-lg shadow-emerald-900/20">
            <Truck className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">DESPACHO</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Gestión de Egresos</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {selectedInvoice && (
            <button 
              onClick={generatePDF}
              className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all"
            >
              <Printer size={16} /> Imprimir
            </button>
          )}
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
            {user.name?.[0] || 'U'}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          {!selectedInvoice ? (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Search and Tabs */}
              <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row gap-4 shrink-0">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                  <button 
                    onClick={() => setActiveTab('pending')}
                    className={cn(
                      "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all",
                      activeTab === 'pending' ? "bg-white text-emerald-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Pendientes
                  </button>
                  <button 
                    onClick={() => setActiveTab('despachado')}
                    className={cn(
                      "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all",
                      activeTab === 'despachado' ? "bg-white text-emerald-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    Despachados
                  </button>
                </div>

                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text"
                    placeholder="Buscar por cliente o ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Invoice List */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 animate-pulse h-40" />
                    ))
                  ) : filteredInvoices.length === 0 ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
                      <div className="bg-slate-100 p-4 rounded-full mb-4">
                        <Package size={32} />
                      </div>
                      <p className="font-bold uppercase tracking-widest text-xs">No se encontraron egresos</p>
                    </div>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <motion.button 
                        key={inv.id} 
                        layoutId={`inv-${inv.id}`}
                        onClick={() => setSelectedInvoice(inv)}
                        className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-emerald-500/30 transition-all text-left relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight size={18} className="text-emerald-500" />
                        </div>
                        
                        <div className="flex items-center gap-2 mb-3">
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter",
                            inv.status === 'despachado' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                          )}>
                            {inv.status === 'despachado' ? 'Completado' : 'Pendiente'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            #{inv.id.replace('INV-', '')}
                          </span>
                        </div>

                        <h3 className="font-black text-slate-900 leading-tight mb-4 group-hover:text-emerald-800 transition-colors">
                          {inv.client}
                        </h3>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <Clock size={14} />
                            <span className="text-[10px] font-bold">
                              {new Date(inv.date).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                            Q {inv.totalAmount?.toLocaleString()}
                          </p>
                        </div>
                      </motion.button>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col md:flex-row overflow-hidden"
            >
              {/* Left Panel: Invoice Detail & Items */}
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className="p-6 border-b border-slate-100 shrink-0 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setSelectedInvoice(null)}
                      className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <div>
                      <h2 className="text-xl font-black text-slate-900">{selectedInvoice.client}</h2>
                      <p className="text-xs text-slate-400 font-mono uppercase tracking-widest mt-0.5">ORDEN #{selectedInvoice.id.replace('INV-', '')}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {selectedInvoice.status === 'despachado' ? (
                      <span className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 size={16} /> DESPACHADO
                      </span>
                    ) : (
                      <span className="bg-orange-100 text-orange-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <Clock size={16} /> EN PROCESO
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                  <div className="max-w-3xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Package size={18} className="text-emerald-500" />
                        Productos en Orden
                      </h3>
                      <div className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                        {selectedInvoice.items.length} ÍTEMS
                      </div>
                    </div>

                    <div className="space-y-3">
                      {selectedInvoice.items.map((item, idx) => {
                        const dispatchedQty = dispatchedItems[item.productId] || 0;
                        const isDone = dispatchedQty >= item.quantity;
                        const progress = (dispatchedQty / item.quantity) * 100;

                        return (
                          <div 
                            key={idx}
                            className={cn(
                              "p-4 rounded-2xl border transition-all flex items-center gap-4",
                              isDone ? "bg-emerald-50/30 border-emerald-100" : "bg-white border-slate-100 hover:border-slate-200 shadow-sm"
                            )}
                          >
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                              isDone ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                            )}>
                              {isDone ? <CheckCircle2 size={24} /> : <Package size={24} />}
                            </div>
                            
                            <div 
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => {
                                if (selectedInvoice.status !== 'despachado') {
                                  setPendingProduct({ 
                                    productId: item.productId, 
                                    productName: item.productName, 
                                    maxQty: item.quantity 
                                  });
                                  setQuantityInput(dispatchedItems[item.productId] || 0);
                                }
                              }}
                            >
                              <h4 className={cn(
                                "font-bold text-sm truncate group-hover:text-emerald-700 transition-colors",
                                isDone ? "text-slate-400 line-through" : "text-slate-900"
                              )}>
                                {item.productName}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.productId}</p>
                              
                              <div className="mt-2 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  className={cn(
                                    "h-full transition-all",
                                    isDone ? "bg-emerald-500" : "bg-emerald-600"
                                  )}
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right mr-2">
                                <p className="text-xs font-black text-slate-900">{dispatchedQty} / {item.quantity}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Cantidad</p>
                              </div>
                              
                              {selectedInvoice.status !== 'despachado' && (
                                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                                  <button 
                                    onClick={() => adjustQuantity(item.productId, -1)}
                                    disabled={dispatchedQty <= 0}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-white text-slate-400 hover:text-slate-900 shadow-sm disabled:opacity-50 transition-all"
                                  >
                                    <Minus size={14} />
                                  </button>
                                  <button 
                                    onClick={() => adjustQuantity(item.productId, 1)}
                                    disabled={dispatchedQty >= item.quantity}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-white text-slate-400 hover:text-slate-900 shadow-sm disabled:opacity-50 transition-all"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-200 grid grid-cols-2 gap-4 shrink-0">
                  <button 
                    onClick={generatePDF}
                    className="flex items-center justify-center gap-2 py-4 bg-white border border-slate-200 text-slate-700 font-black text-sm rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
                  >
                    <Printer size={18} /> GENERAR PDF
                  </button>
                  
                  {selectedInvoice.status !== 'despachado' ? (
                    <button 
                      onClick={handleDispatch}
                      disabled={isDispatching}
                      className="flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white font-black text-sm rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                    >
                      {isDispatching ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 size={18} />
                      )}
                      FINALIZAR DESPACHO
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-4 bg-emerald-100 text-emerald-700 font-black text-sm rounded-2xl">
                      <History size={18} /> DESPACHADO EL {new Date().toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Panel: Scanner (Hidden on small screens when not active) */}
              <div className={cn(
                "w-full md:w-80 lg:w-96 bg-slate-900 shrink-0 flex flex-col transition-all",
                !showScanner && isMobile && "h-0 overflow-hidden"
              )}>
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
                    <QrCode size={18} className="text-emerald-500" />
                    Escáner QR
                  </h3>
                  {isMobile && (
                    <button 
                      onClick={() => setShowScanner(false)}
                      className="text-white/40 hover:text-white"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
                
                <div className="flex-1 p-6 flex flex-col">
                  <StableScanner 
                    onScan={handleScan}
                    disabled={selectedInvoice.status === 'despachado'}
                    isFlashActive={isFlashActive}
                  />
                  
                  <div className="mt-6 bg-white/5 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Último escaneo</p>
                    <p className="text-sm font-bold text-white truncate">
                      {scannedData || 'Esperando producto...'}
                    </p>
                  </div>

                  <div className="mt-auto pt-6 text-center">
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                      Asegúrate de tener buena iluminación
                    </p>
                  </div>
                </div>
              </div>

              {/* Mobile Scanner Toggle */}
              {isMobile && !showScanner && selectedInvoice.status !== 'despachado' && (
                <button 
                  onClick={() => setShowScanner(true)}
                  className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center z-50 animate-bounce"
                >
                  <QrCode size={24} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Manual Quantity Modal */}
      <AnimatePresence>
        {pendingProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 shadow-2xl w-full max-w-sm flex flex-col items-center gap-6"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center text-4xl shadow-inner">
                📦
              </div>
              
              <div className="text-center">
                <h3 className="text-xl font-black text-slate-900 leading-tight">{pendingProduct.productName}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">¿Cuántas unidades despachar?</p>
              </div>

              <div className="flex items-center gap-4 w-full">
                <button 
                  onClick={() => setQuantityInput(prev => Math.max(1, prev - 1))}
                  className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-900 text-2xl font-black hover:bg-slate-200 transition-all"
                >
                  <Minus size={24} />
                </button>
                <div className="flex-1 text-center">
                  <input 
                    type="number" 
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(Math.max(1, Math.min(pendingProduct.maxQty, parseInt(e.target.value) || 1)))}
                    className="w-full text-center text-5xl font-black p-4 border-none focus:outline-none focus:ring-0 text-slate-900"
                    autoFocus
                  />
                  <p className="text-[10px] font-black text-emerald-600 mt-1 uppercase">Max: {pendingProduct.maxQty} unidades</p>
                </div>
                <button 
                  onClick={() => setQuantityInput(prev => Math.min(pendingProduct.maxQty, prev + 1))}
                  className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-900 text-2xl font-black hover:bg-slate-200 transition-all"
                >
                  <Plus size={24} />
                </button>
              </div>

              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => {
                    setPendingProduct(null);
                    setQuantityInput(1);
                  }} 
                  className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all uppercase text-xs tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmQuantity} 
                  className="flex-1 px-6 py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all uppercase text-xs tracking-widest"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
