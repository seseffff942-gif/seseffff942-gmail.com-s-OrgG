import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, User, Calendar, Hash, Share2, Check, Loader2 } from 'lucide-react';
import { useModalBackHandler } from '../utils/modalBackHandler';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title?: string;
  scanClient?: string;
  scanDate?: string;
  trackingNumber?: string;
}

export const ImageModal: React.FC<ImageModalProps> = ({ 
  isOpen, 
  onClose, 
  imageUrl, 
  title, 
  scanClient, 
  scanDate, 
  trackingNumber 
}) => {
  // Manejo del botón atrás y gesto de deslizamiento en Android / APK
  useModalBackHandler(isOpen, onClose, 'image_modal');

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  // Convierte cualquier imageUrl (base64 data URI o URL remota/local) a un Blob real
  const getBlobFromImageUrl = async (): Promise<{ blob: Blob; mime: string }> => {
    if (imageUrl.startsWith('data:')) {
      const parts = imageUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return { blob: new Blob([u8arr], { type: mime }), mime };
    } else {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      return { blob, mime: blob.type || 'image/jpeg' };
    }
  };

  const getCleanFilename = (extension = 'jpg') => {
    const rawTitle = title || 'carta_entrega';
    const clean = rawTitle
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `${clean}_${Date.now()}.${extension}`;
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const { blob } = await getBlobFromImageUrl();
      const filename = getCleanFilename('jpg');

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 3000);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('[ImageModal] Error al descargar imagen:', err);
      // Fallback: abrir en nueva ventana
      try {
        const w = window.open();
        if (w) {
          w.document.write(`<img src="${imageUrl}" style="max-width:100%"/>`);
        } else {
          window.location.href = imageUrl;
        }
      } catch (e2) {
        alert('No se pudo descargar automáticamente. Mantén presionada la imagen para guardarla en tu teléfono.');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    try {
      setIsDownloading(true);
      const { blob, mime } = await getBlobFromImageUrl();
      const filename = getCleanFilename('jpg');
      const file = new File([blob], filename, { type: mime });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title || 'Carta de Entrega',
          text: `Carta de Entrega: ${title || ''} ${trackingNumber ? `(Guía: ${trackingNumber})` : ''}`
        });
      } else if (navigator.share) {
        await navigator.share({
          title: title || 'Carta de Entrega',
          url: imageUrl.startsWith('http') ? imageUrl : undefined
        });
      } else {
        await handleDownload();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[ImageModal] Error al compartir:', err);
        // Fallback a descarga normal
        await handleDownload();
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const canShareFiles = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm" 
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800 text-sm sm:text-base truncate pr-2">
              {title || 'Imagen Adjunta'}
            </h3>
            <button 
              onClick={onClose} 
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors shrink-0"
              title="Cerrar (o desliza atrás)"
            >
              <X size={20} />
            </button>
          </div>

          {/* Metadata banner si existe */}
          {(scanClient || scanDate || trackingNumber) && (
            <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-xs">
               {trackingNumber && (
                 <div className="flex items-center gap-2">
                   <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                      <Hash size={14} />
                   </div>
                   <div className="min-w-0">
                     <p className="text-[9px] font-black uppercase tracking-wider text-emerald-700">Guía</p>
                     <p className="text-xs font-bold text-slate-800 truncate">{trackingNumber}</p>
                   </div>
                 </div>
               )}
               {scanClient && (
                 <div className="flex items-center gap-2">
                   <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                      <User size={14} />
                   </div>
                   <div className="min-w-0">
                     <p className="text-[9px] font-black uppercase tracking-wider text-emerald-700">Destinatario</p>
                     <p className="text-xs font-bold text-slate-800 truncate" title={scanClient}>{scanClient}</p>
                   </div>
                 </div>
               )}
               {scanDate && (
                 <div className="flex items-center gap-2">
                   <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                      <Calendar size={14} />
                   </div>
                   <div className="min-w-0">
                     <p className="text-[9px] font-black uppercase tracking-wider text-emerald-700">Fecha Envío</p>
                     <p className="text-xs font-bold text-slate-800 truncate">{scanDate}</p>
                   </div>
                 </div>
               )}
            </div>
          )}

          {/* Contenedor de la Imagen */}
          <div className="p-3 sm:p-4 bg-slate-900/5 flex items-center justify-center min-h-[260px] max-h-[65vh] overflow-auto">
            <img 
              src={imageUrl} 
              alt={title || "Imagen"} 
              className="max-w-full h-auto max-h-[60vh] object-contain rounded-lg shadow-md select-none" 
            />
          </div>

          {/* Footer de Acciones */}
          <div className="p-3 sm:p-4 border-t border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Tip: Puedes deslizar atrás en tu teléfono para cerrar.
            </p>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {canShareFiles && (
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={isDownloading}
                  className="flex-1 sm:flex-none px-3.5 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  title="Compartir o Guardar en Galería / WhatsApp"
                >
                  <Share2 size={16} /> <span>Compartir / Guardar</span>
                </button>
              )}
              <button 
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                {isDownloading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> <span>Descargando...</span>
                  </>
                ) : downloadSuccess ? (
                  <>
                    <Check size={16} className="text-emerald-300" /> <span>¡Descargada!</span>
                  </>
                ) : (
                  <>
                    <Download size={16} /> <span>Descargar Imagen</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
