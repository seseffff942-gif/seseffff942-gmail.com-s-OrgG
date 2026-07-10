import React, { useEffect, useState } from 'react';
import { User, Invoice, Product } from '../types';
import { api } from '../api';
import { Scanner } from '@yudiel/react-qr-scanner';

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
        const data = await api.getInvoices();
        setInvoices(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  const handleScan = (productId: string) => {
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

  return (
    <div className="p-4 md:p-6 h-screen flex flex-col md:flex-row gap-6 overflow-hidden">
      {/* Izquierda: Despacho / Escáner */}
      <div className="h-[250px] shrink-0 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Sección de Despacho</h2>
        <div className="h-full bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
            <Scanner
              onScan={(result) => {
                if (result && result.length > 0) {
                  handleScan(result[0].rawValue);
                }
              }}
              onError={(error) => console.log(error?.message)}
              constraints={{ facingMode: 'environment' }}
            />
        </div>
        <p className="mt-4 text-sm text-slate-600">Escaneando ID: {scannedData || 'Esperando escaneo...'}</p>
      </div>

      {/* Derecha: Ventas / Lista */}
      <div className="flex-1 overflow-y-auto pb-20 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Venta Seleccionada</h2>
        {selectedInvoice ? (
          <div>
            <p className="font-semibold text-lg">{selectedInvoice.client}</p>
            <p className="text-sm text-slate-500 mb-4">ID: {selectedInvoice.id}</p>
            <ul className="space-y-2 mb-6">
                {selectedInvoice.items.map((item: any, idx: number) => {
                  const dispatchedQty = dispatchedItems[item.productId] || 0;
                  const isDone = dispatchedQty >= item.quantity;
                  return (
                    <li key={idx} className={`flex justify-between items-center p-2 border-b ${isDone ? 'text-red-500 line-through' : 'text-slate-800'}`}>
                        <span>{item.productName ?? 'Producto sin nombre'}</span>
                        <span>{dispatchedQty} / {item.quantity}</span>
                    </li>
                  );
                })}
            </ul>
            <button 
              onClick={() => window.print()}
              className="w-full py-3 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-700 transition-colors"
            >
              Generar Orden de Egreso (PDF)
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {loading ? <p>Cargando ventas...</p> : invoices.map(inv => (
              <button 
                key={inv.id} 
                onClick={() => {
                    setSelectedInvoice(inv);
                }}
                className="w-full text-left p-3 rounded-lg hover:bg-slate-50 border border-slate-100"
              >
                <p className="font-medium">{inv.client}</p>
                <p className="text-xs text-slate-500">{inv.id}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Modal de Cantidad */}
      {pendingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 shadow-2xl w-full max-w-sm flex flex-col items-center gap-6">
            <h3 className="text-xl font-bold text-slate-800 text-center">Cantidad para {pendingProduct.productName}</h3>
            <input 
              type="number" 
              value={quantityInput || ''}
              onChange={(e) => setQuantityInput(parseInt(e.target.value) || 0)}
              className="w-full text-center text-3xl font-bold p-4 border border-slate-200 rounded-xl"
              min="1"
            />
            <div className="flex gap-3 w-full">
              <button onClick={() => setPendingProduct(null)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Cancelar</button>
              <button onClick={confirmQuantity} className="flex-1 px-4 py-3 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-700 transition-colors">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
