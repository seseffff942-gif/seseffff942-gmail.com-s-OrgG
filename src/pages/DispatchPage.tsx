import React, { useEffect, useState } from 'react';
import { User, Invoice, Product } from '../types';
import { api } from '../api';
import { Scanner } from '@yudiel/react-qr-scanner';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface DispatchPageProps {
  user: User;
  isMobile: boolean;
}

export function DispatchPage({ user, isMobile }: DispatchPageProps) {
  const [scannedData, setScannedData] = React.useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatchedItems, setDispatchedItems] = useState<Record<string, number>>({});
  const [pendingProduct, setPendingProduct] = useState<{ productId: string, productName: string } | null>(null);
  const [quantityInput, setQuantityInput] = useState<number>(1);
  const [isDispatching, setIsDispatching] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'despachado'>('pending');

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

  const handleScan = (productId: string) => {
    if (selectedInvoice?.status === 'despachado') return; // Lock scan if already dispatched
    setScannedData(productId);
    
    // Logic to dispatch: find product in invoice and mark
    if (selectedInvoice) {
      const item = selectedInvoice.items.find(i => i.productId === productId);
      if (item) {
        setPendingProduct({ productId, productName: item.productName });
      }
    }
  };

  const confirmQuantity = () => {
    if (pendingProduct) {
      const qty = Math.max(1, quantityInput || 1);
      setDispatchedItems(prev => ({
        ...prev,
        [pendingProduct.productId]: (prev[pendingProduct.productId] || 0) + qty
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
            <td style="padding: 10px 8px; color: #64748b; font-size: 8.5pt; text-align: right;">Q ${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
            <td style="padding: 10px 8px; color: #1A4D2E; font-size: 9.5pt; text-align: right; font-weight: 900;">Q ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
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
            <td style="padding: 6px 12px; font-weight: 900; color: #0f172a; text-align: right; font-size: 10pt;">Q ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td style="padding: 6px 12px; color: #059669; text-align: left; font-size: 9pt; font-weight: 900;">ABONOS/PAGOS</td>
            <td style="padding: 6px 12px; font-weight: 900; color: #059669; text-align: right; font-size: 9pt;">Q 0.00</td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top: 15px;">
              <div style="background-color: #1A4D2E; border-radius: 16px; padding: 15px 25px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 8px 16px -4px rgba(26, 77, 46, 0.3);">
                <span style="font-weight: 900; font-size: 10pt; color: #ffffff; text-transform: uppercase; letter-spacing: 2px;">TOTAL NETO</span>
                <span style="font-weight: 900; font-size: 20pt; color: #ffffff;">Q ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
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
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      {/* Visual Verification Header with Logo */}
      <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
            <img 
              src="/logo_final.jpg" 
              crossOrigin="anonymous"
              className="w-12 h-12 object-contain" 
              onError={(e) => { e.currentTarget.src = "/logo.png.png" }}
              alt="Agricovet Logo"
            />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">AGRICOVET</h1>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Módulo de Despacho</p>
          </div>
        </div>
        {selectedInvoice && (
          <button 
            onClick={generatePDF}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-100"
          >
            <span>🖨️</span> IMPRIMIR
          </button>
        )}
      </div>

      {/* Tabs de Filtro */}
      <div className="bg-white border-b border-slate-200 px-4 flex gap-8">
        <button 
          onClick={() => setActiveTab('pending')}
          className={`py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'pending' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-400'}`}
        >
          Pendientes ({invoices.filter(i => i.status !== 'despachado').length})
        </button>
        <button 
          onClick={() => setActiveTab('despachado')}
          className={`py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'despachado' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-400'}`}
        >
          Despachados ({invoices.filter(i => i.status === 'despachado').length})
        </button>
      </div>

      {/* 1. Contenedor del Escáner (Tamaño fijo) */}
      <div className="h-[250px] shrink-0 p-4 md:p-6 bg-white border-b border-slate-200 shadow-sm z-10">
        <div className="h-full flex flex-col">
          <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
            <span className="p-1.5 bg-sky-100 text-sky-600 rounded-lg text-sm">📸</span>
            Escáner de Productos
          </h2>
          <div className="flex-1 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-slate-300 relative">
            {selectedInvoice?.status === 'despachado' ? (
              <div className="absolute inset-0 bg-slate-50/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-center p-6">
                <span className="text-4xl mb-2">🔒</span>
                <p className="text-slate-900 font-black text-sm uppercase">Egreso Bloqueado</p>
                <p className="text-slate-400 text-[10px] font-bold">Este egreso ya ha sido despachado</p>
              </div>
            ) : (
              <Scanner
                onScan={(result) => {
                  if (result && result.length > 0) {
                    handleScan(result[0].rawValue);
                  }
                }}
                onError={(error) => console.log(error?.message)}
                constraints={{ facingMode: 'environment' }}
              />
            )}
          </div>
          <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
            Escaneado: <span className="text-sky-600 font-black">{scannedData || 'Esperando...'}</span>
          </p>
        </div>
      </div>

      {/* 2. Contenedor de Venta Seleccionada / Listado (Contenido principal que hace scroll) */}
      <div className="flex-1 overflow-y-auto pb-20 custom-scrollbar p-4 md:p-6">
        {selectedInvoice ? (
          <div className="max-w-4xl mx-auto flex flex-col gap-6">
            {/* Cabecera del Detalle */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Cliente</p>
                        {selectedInvoice.status === 'despachado' && (
                          <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1">
                            <span>✅</span> DESPACHADO
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl font-black text-slate-900 leading-tight">{selectedInvoice.client}</h2>
                      <div className="flex gap-4 mt-2">
                        <p className="text-xs text-slate-400 font-mono">ID: {selectedInvoice.id}</p>
                        <p className="text-xs text-sky-600 font-bold">Total: Q {selectedInvoice.totalAmount?.toLocaleString()}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedInvoice(null)}
                      className="bg-slate-50 text-slate-400 hover:text-slate-600 px-4 py-2 rounded-xl text-xs font-bold border border-slate-100 transition-colors"
                    >
                      Cambiar Factura
                    </button>
                  </div>
            </div>

            {/* Listado de Productos */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-left text-[10px] text-slate-400 font-black uppercase tracking-widest">
                    <th className="py-4 px-6">Producto</th>
                    <th className="py-4 px-6 text-center">Estado</th>
                    <th className="py-4 px-6 text-right">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {selectedInvoice.items.map((item: any, idx: number) => {
                    const dispatchedQty = dispatchedItems[item.productId] || 0;
                    const isDone = dispatchedQty >= item.quantity;
                    const progress = Math.min(100, (dispatchedQty / item.quantity) * 100);
                    
                    return (
                      <tr key={idx} className={`group ${isDone ? 'bg-slate-50/50' : ''}`}>
                        <td className="py-5 px-6">
                          <p className={`font-bold ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                            {item.productName || 'Producto'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">{item.productId}</p>
                        </td>
                        <td className="py-5 px-6">
                          <div className="w-24 h-1.5 bg-slate-100 rounded-full mx-auto overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${isDone ? 'bg-emerald-500' : 'bg-sky-500'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className={`text-[9px] text-center mt-1.5 font-black uppercase ${isDone ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {isDone ? 'Despachado' : `${progress.toFixed(0)}%`}
                          </p>
                        </td>
                        <td className="py-5 px-6 text-right">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black ${
                            isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
                          }`}>
                            {dispatchedQty} / {item.quantity}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Acciones */}
            <div className="sticky bottom-4 flex flex-col gap-3">
              <button 
                onClick={generatePDF}
                className="w-full py-5 bg-emerald-600 text-white font-black text-lg rounded-[2rem] hover:bg-emerald-700 shadow-2xl shadow-emerald-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-4"
              >
                <span>🖨️</span>
                GENERAR COMPROBANTE DE VENTA
              </button>

              {selectedInvoice.status !== 'despachado' && (
                <button 
                  onClick={handleDispatch}
                  disabled={isDispatching}
                  className={`w-full py-5 bg-slate-900 text-white font-black text-lg rounded-[2rem] hover:bg-slate-800 shadow-2xl shadow-slate-900/30 active:scale-[0.98] transition-all flex items-center justify-center gap-4 ${isDispatching ? 'opacity-50' : ''}`}
                >
                  {isDispatching ? (
                    <span className="animate-spin">🔄</span>
                  ) : (
                    <span>🚚</span>
                  )}
                  MARCAR COMO DESPACHADO
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span className="p-2 bg-emerald-100 text-emerald-600 rounded-lg text-sm">📋</span>
              Ventas Pendientes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading ? (
                <div className="col-span-full text-center py-20 text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando datos...</div>
              ) : invoices.length === 0 ? (
                <div className="col-span-full text-center py-20 text-slate-400 font-bold uppercase tracking-widest text-xs">No hay facturas pendientes</div>
              ) : (
                invoices
                  .filter(inv => activeTab === 'despachado' ? inv.status === 'despachado' : inv.status !== 'despachado')
                  .map(inv => (
                  <button 
                    key={inv.id} 
                    onClick={() => setSelectedInvoice(inv)}
                    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:border-sky-500 hover:shadow-xl hover:-translate-y-1 transition-all text-left"
                  >
                    <p className="font-black text-slate-900 leading-tight mb-2">{inv.client}</p>
                    <div className="flex justify-between items-center mt-4">
                      <p className="text-[10px] text-slate-400 font-mono">#{inv.id.replace('INV-', '')}</p>
                      <p className="text-xs font-black text-sky-600 bg-sky-50 px-2 py-1 rounded-lg">Q {inv.totalAmount?.toLocaleString()}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Cantidad (Z-index alto) */}
      {pendingProduct && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl w-full max-w-sm flex flex-col items-center gap-6">
            <div className="w-16 h-16 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center text-3xl">📦</div>
            <div className="text-center">
              <h3 className="text-xl font-black text-slate-900">{pendingProduct.productName}</h3>
              <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Ingresa la cantidad</p>
            </div>
            <input 
              type="number" 
              value={quantityInput || ''}
              onChange={(e) => setQuantityInput(parseInt(e.target.value) || 0)}
              className="w-full text-center text-5xl font-black p-6 border-2 border-slate-100 rounded-3xl focus:border-sky-500 focus:outline-none transition-all"
              min="1"
              autoFocus
            />
            <div className="flex gap-3 w-full">
              <button onClick={() => setPendingProduct(null)} className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all">CANCELAR</button>
              <button onClick={confirmQuantity} className="flex-1 px-6 py-4 bg-sky-600 text-white font-black rounded-2xl hover:bg-sky-700 shadow-lg shadow-sky-600/20 transition-all">ACEPTAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
