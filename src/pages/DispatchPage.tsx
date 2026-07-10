import React, { useEffect, useState } from 'react';
import { User, Invoice, Product } from '../types';
import { api } from '../api';
import { QrReader } from 'react-qr-reader';

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

  const handleScan = (result: any, error: any) => {
    if (result) {
      const productId = result.getText();
      setScannedData(productId);
      
      // Logic to dispatch: find product in invoice and mark
      if (selectedInvoice) {
        const item = selectedInvoice.items.find(i => i.productId === productId);
        if (item) {
          setDispatchedItems(prev => ({
            ...prev,
            [productId]: (prev[productId] || 0) + 1
          }));
        }
      }
    }
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col md:flex-row gap-6">
      {/* Izquierda: Despacho / Escáner */}
      <div className="flex-1 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Sección de Despacho</h2>
        <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
            <QrReader
              onResult={handleScan}
              constraints={{ facingMode: 'environment' }}
            />
        </div>
        <p className="mt-4 text-sm text-slate-600">Escaneando ID: {scannedData || 'Esperando escaneo...'}</p>
      </div>

      {/* Derecha: Ventas / Lista */}
      <div className="flex-1 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 overflow-auto">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Venta Seleccionada</h2>
        {selectedInvoice ? (
          <div>
            <p className="font-semibold text-lg">{selectedInvoice.client}</p>
            <p className="text-sm text-slate-500 mb-4">ID: {selectedInvoice.id}</p>
            <ul className="space-y-2">
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
          </div>
        ) : (
          <div className="space-y-2">
            {loading ? <p>Cargando ventas...</p> : invoices.map(inv => (
              <button 
                key={inv.id} 
                onClick={() => {
                    setSelectedInvoice(inv);
                    setDispatchedItems({}); // Reset dispatched items on new selection
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
    </div>
  );
}
