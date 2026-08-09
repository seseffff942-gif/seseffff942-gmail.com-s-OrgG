import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, User, Calendar, Hash } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
  scanClient?: string;
  scanDate?: string;
  trackingNumber?: string;
}

export const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, imageUrl, title, scanClient, scanDate, trackingNumber }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800">{title || 'Imagen Adjunta'}</h3>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
              <X size={20} />
            </button>
          </div>

          {(scanClient || scanDate || trackingNumber) && (
            <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
               {trackingNumber && (
                 <div className="flex items-center gap-2">
                   <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                      <Hash size={16} />
                   </div>
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Guía</p>
                     <p className="text-sm font-bold text-slate-800">{trackingNumber}</p>
                   </div>
                 </div>
               )}
               {scanClient && (
                 <div className="flex items-center gap-2">
                   <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                      <User size={16} />
                   </div>
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Destinatario</p>
                     <p className="text-sm font-bold text-slate-800 line-clamp-1" title={scanClient}>{scanClient}</p>
                   </div>
                 </div>
               )}
               {scanDate && (
                 <div className="flex items-center gap-2">
                   <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                      <Calendar size={16} />
                   </div>
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Fecha Envío</p>
                     <p className="text-sm font-bold text-slate-800">{scanDate}</p>
                   </div>
                 </div>
               )}
            </div>
          )}

          <div className="p-4 bg-slate-100 flex items-center justify-center min-h-[300px] max-h-[60vh] overflow-y-auto">
            <img src={imageUrl} alt={title || "Imagen"} className="max-w-full h-auto rounded-lg shadow-sm" />
          </div>

          <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
            <a 
              href={imageUrl} 
              download="imagen.jpg" 
              target="_blank" 
              rel="noreferrer" 
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm"
            >
              <Download size={18} /> Descargar Imagen
            </a>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
