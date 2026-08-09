import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, Loader2, Package, Upload, ScanLine, FileText, Download } from 'lucide-react';
import { api } from '../api';

interface ShippingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (guideNumber: string, imageUrl?: string, clientName?: string, shippingDate?: string) => void;
}

export const ShippingGuideModal: React.FC<ShippingGuideModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [guideNumber, setGuideNumber] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScannedData(null);
    try {
      const res = await api.detectShippingGuideText(file);
      if (res.success && res.data) {
        setScannedData(res.data);
        if (res.data.guideNumber) {
          setGuideNumber(res.data.guideNumber);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error escaneando la guía');
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = () => {
    if (!guideNumber.trim()) {
      alert('Por favor ingrese o escanee el número de guía.');
      return;
    }
    onSubmit(guideNumber.trim(), scannedData?.imageUrl, scannedData?.clientName, scannedData?.shippingDate);
    setGuideNumber('');
    setScannedData(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl w-[95vw] max-w-md max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
        >
          <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center text-teal-600">
                <Package size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Registrar Envío</h3>
                <p className="text-xs text-slate-500 font-medium">Ingrese o escanee la guía de paquetería</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            <div className="mb-6">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Número de Guía</label>
              <input
                type="text"
                value={guideNumber}
                onChange={(e) => setGuideNumber(e.target.value)}
                placeholder="Ej. GUIA-123456789"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-bold focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
              />
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-slate-400 font-bold uppercase">Ó ESCANEAR DOCUMENTO</span>
              </div>
            </div>

            <div className="mt-6">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                ref={fileInputRef} 
                className="hidden" 
              />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className="w-full relative group overflow-hidden bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center gap-3"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    <p className="text-sm font-bold text-indigo-700">Analizando documento con IA...</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                      <ScanLine size={24} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-indigo-900">Escanear Guía con IA</p>
                      <p className="text-xs text-indigo-600/70 mt-1 font-medium">Toma una foto o selecciona desde tu galería</p>
                    </div>
                  </>
                )}
              </button>

              {scannedData && (
                <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="text-emerald-600" size={16} />
                    <h4 className="text-sm font-bold text-emerald-800">Datos Extraídos Exitosamente</h4>
                  </div>
                  
                  {scannedData.imageUrl && (
                    <div className="relative group mb-4">
                       <img src={scannedData.imageUrl} alt="Guía escaneada" className="w-full h-40 object-cover rounded-lg border border-emerald-200" />
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <a href={scannedData.imageUrl} download="guia_envio.jpg" target="_blank" rel="noreferrer" className="bg-white text-slate-800 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-100 shadow-sm">
                            <Download size={16} /> Descargar Imagen
                          </a>
                       </div>
                    </div>
                  )}

                  <div className="space-y-3 mt-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Número de Guía Detectado</label>
                      <input 
                        type="text"
                        value={scannedData.guideNumber || ''}
                        onChange={(e) => {
                          setScannedData({...scannedData, guideNumber: e.target.value});
                          setGuideNumber(e.target.value);
                        }}
                        className="w-full bg-white border border-emerald-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none transition-all"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Destinatario / Cliente</label>
                      <input 
                        type="text"
                        value={scannedData.clientName || ''}
                        onChange={(e) => setScannedData({...scannedData, clientName: e.target.value})}
                        placeholder="Nombre del cliente..."
                        className="w-full bg-white border border-emerald-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Fecha de Envío</label>
                      <input 
                        type="text"
                        value={scannedData.shippingDate || ''}
                        onChange={(e) => setScannedData({...scannedData, shippingDate: e.target.value})}
                        placeholder="Ej. 15/10/2023"
                        className="w-full bg-white border border-emerald-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!guideNumber.trim() || isScanning}
              className="px-6 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm shadow-teal-600/20"
            >
              Confirmar Envío
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const Sparkles = ({ className, size }: { className?: string, size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
);
