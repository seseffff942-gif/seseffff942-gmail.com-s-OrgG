import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import SignatureCanvas from 'react-signature-canvas';
import { 
  X, 
  PenTool, 
  Eraser, 
  Check, 
  Loader2, 
  Package, 
  User as UserIcon, 
  FileText, 
  Download, 
  ShieldCheck, 
  Calendar,
  Phone,
  MapPin,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Invoice, User } from '../types';
import { api } from '../api';
import { 
  generateDeliveryLetterHtml, 
  downloadHtmlAsPdf, 
  formatDateSafe, 
  formatMoney, 
  cn 
} from '../utils';

interface DeliverySignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  currentUser?: User;
  onSuccess: () => void;
}

/**
 * Recorta el espacio vacio alrededor del trazo para evitar errores con paquetes CommonJS
 */
function recortarCanvas(origen: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = origen.getContext('2d');
  if (!ctx) return origen;

  const { width, height } = origen;
  if (!width || !height) return origen;

  const pixeles = ctx.getImageData(0, 0, width, height).data;
  let arriba = height, abajo = 0, izq = width, der = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixeles[(y * width + x) * 4 + 3] !== 0) {
        if (y < arriba) arriba = y;
        if (y > abajo) abajo = y;
        if (x < izq) izq = x;
        if (x > der) der = x;
      }
    }
  }

  if (der < izq || abajo < arriba) return origen;

  const margen = 4;
  izq = Math.max(0, izq - margen);
  arriba = Math.max(0, arriba - margen);
  der = Math.min(width - 1, der + margen);
  abajo = Math.min(height - 1, abajo + margen);

  const recorte = document.createElement('canvas');
  recorte.width = der - izq + 1;
  recorte.height = abajo - arriba + 1;
  recorte.getContext('2d')?.drawImage(
    origen, izq, arriba, recorte.width, recorte.height,
    0, 0, recorte.width, recorte.height
  );
  return recorte;
}

export const DeliverySignatureModal: React.FC<DeliverySignatureModalProps> = ({
  isOpen,
  onClose,
  invoice,
  currentUser,
  onSuccess
}) => {
  const [deliveredByName, setDeliveredByName] = useState<string>('');
  const [receiverName, setReceiverName] = useState<string>('');
  const [receiverDpi, setReceiverDpi] = useState<string>('');
  const [receiverPhone, setReceiverPhone] = useState<string>('');
  const [showItemsList, setShowItemsList] = useState<boolean>(false);

  const [hasDelivererSigned, setHasDelivererSigned] = useState<boolean>(false);
  const [hasReceiverSigned, setHasReceiverSigned] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  const delivererCanvasRef = useRef<SignatureCanvas>(null);
  const receiverCanvasRef = useRef<SignatureCanvas>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (invoice && isOpen) {
      const defaultDeliverer = 
        currentUser?.name || 
        (invoice as any).sellerName || 
        (typeof invoice.sellerId === 'object' ? (invoice.sellerId as any).name : '') || 
        'Asesor Agricovet';
      setDeliveredByName(defaultDeliverer);

      const defaultReceiver = 
        invoice.clientName || 
        invoice.client || 
        (invoice as any).customerName || 
        'Cliente';
      setReceiverName(defaultReceiver);
      setReceiverDpi('');
      setReceiverPhone(invoice.phone || '');

      setHasDelivererSigned(false);
      setHasReceiverSigned(false);
    }
  }, [invoice, isOpen, currentUser]);

  if (!isOpen || !invoice) return null;

  const handleClearDeliverer = () => {
    delivererCanvasRef.current?.clear();
    setHasDelivererSigned(false);
  };

  const handleClearReceiver = () => {
    receiverCanvasRef.current?.clear();
    setHasReceiverSigned(false);
  };

  const getSignatureDataUrl = (padRef: React.RefObject<SignatureCanvas | null>): string | null => {
    if (!padRef.current || padRef.current.isEmpty()) return null;
    try {
      return recortarCanvas(padRef.current.getCanvas()).toDataURL('image/png');
    } catch {
      return padRef.current.getCanvas().toDataURL('image/png');
    }
  };

  const handleSaveAndDeliver = async () => {
    if (isSubmitting) return;

    const receiverSig = getSignatureDataUrl(receiverCanvasRef);
    if (!receiverSig) {
      alert('Por favor solicita la firma de quien recibe la mercadería antes de confirmar.');
      return;
    }

    const delivererSig = getSignatureDataUrl(delivererCanvasRef);
    if (!delivererSig) {
      const proceed = confirm('¿Deseas confirmar la entrega sin tu firma de entrega? Es recomendable firmar ambos.');
      if (!proceed) return;
    }

    try {
      setIsSubmitting(true);

      // 1. Generar HTML de la carta oficial con las firmas estampadas
      const fullHtml = generateDeliveryLetterHtml(invoice, deliveredByName, {
        deliveredBy: deliveredByName.trim(),
        receiverName: receiverName.trim() || invoice.client,
        receiverDpi: receiverDpi.trim() || undefined,
        receiverPhone: receiverPhone.trim() || invoice.phone,
        delivererSignature: delivererSig || undefined,
        receiverSignature: receiverSig,
        deliveryDate: new Date().toLocaleDateString('es-GT', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }) + ' a las ' + new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })
      });

      // 2. Renderizar a canvas con html2canvas para crear la imagen de comprobante
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'fixed';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '0';
      tempDiv.style.width = '800px';
      tempDiv.style.background = '#ffffff';
      tempDiv.innerHTML = fullHtml;
      document.body.appendChild(tempDiv);

      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(tempDiv, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      document.body.removeChild(tempDiv);

      // 3. Convertir el canvas a Blob y crear File
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.90));
      if (!blob) throw new Error('No se pudo generar la imagen de la hoja de entrega.');

      const file = new File(
        [blob], 
        `carta-entrega-folio-${invoice.folio || invoice.id}.jpg`, 
        { type: 'image/jpeg' }
      );

      // 4. Subir la imagen de la carta de entrega al servidor
      const uploadRes = await api.uploadReceiptFile(file);
      if (!uploadRes || !uploadRes.imageUrl) {
        throw new Error('Error al subir el comprobante firmado al servidor.');
      }

      // 5. Actualizar el estado de la factura a 'sent' (Enviada / Entregada) con el comprobante adjunto
      await api.updateInvoiceStatus(invoice.id, 'sent', undefined, undefined, uploadRes.imageUrl);

      alert('✅ ¡Hoja de entrega firmada y venta marcada como ENTREGADA exitosamente!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error al registrar la entrega firmada:', err);
      alert('Error al guardar la entrega: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (isDownloadingPdf) return;
    try {
      setIsDownloadingPdf(true);
      const delivererSig = getSignatureDataUrl(delivererCanvasRef);
      const receiverSig = getSignatureDataUrl(receiverCanvasRef);

      const fullHtml = generateDeliveryLetterHtml(invoice, deliveredByName, {
        deliveredBy: deliveredByName.trim(),
        receiverName: receiverName.trim() || invoice.client,
        receiverDpi: receiverDpi.trim() || undefined,
        receiverPhone: receiverPhone.trim() || invoice.phone,
        delivererSignature: delivererSig || undefined,
        receiverSignature: receiverSig || undefined,
        deliveryDate: new Date().toLocaleDateString('es-GT', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })
      });

      const folioStr = invoice.folio || (invoice.id ? invoice.id.substring(0, 8) : 'S-F');
      await downloadHtmlAsPdf(fullHtml, `carta-entrega-folio-${folioStr}.pdf`);
    } catch (err: any) {
      console.error('Error al generar PDF:', err);
      alert('Error generando el PDF: ' + (err.message || 'Error'));
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const totalItemsCount = (invoice.items || []).reduce((acc: number, it: any) => acc + (Number(it.quantity) || 1), 0);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl w-full max-w-2xl max-h-[96vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200 my-auto"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#0b4d2c] via-emerald-800 to-teal-800 text-white shrink-0 shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-emerald-200">
                <PenTool size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-black text-white">Firma de Entrega en Pantalla</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                    S-Pen / Táctil
                  </span>
                </div>
                <p className="text-[11px] text-emerald-200/80">
                  Folio #{invoice.folio || (invoice.id ? invoice.id.substring(0, 8) : '')} • Carta de Entrega Oficial
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          {/* SCROLLABLE BODY */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-slate-800">
            {/* 1. RESUMEN DE LA VENTA / PEDIDO */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-lg bg-[#0b4d2c] text-white font-mono font-black text-xs">
                    #{invoice.folio || (invoice.id ? invoice.id.substring(0, 6) : '')}
                  </span>
                  <span className="text-xs font-black text-slate-900 truncate max-w-[200px] sm:max-w-[300px]">
                    {invoice.clientName || invoice.client}
                  </span>
                </div>
                <span className="text-xs font-black text-emerald-800 font-mono">
                  Q {formatMoney(invoice.totalAmount ?? (invoice as any).total ?? 0)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-slate-600 pt-1 border-t border-slate-200/70">
                <div className="flex items-center gap-1.5 truncate">
                  <Phone size={11} className="text-slate-400 shrink-0" />
                  <span className="truncate">{invoice.phone || 'Sin teléfono'}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <Calendar size={11} className="text-slate-400 shrink-0" />
                  <span>{invoice.date ? formatDateSafe(invoice.date) : 'Hoy'}</span>
                </div>
                {invoice.address && (
                  <div className="col-span-2 flex items-center gap-1.5 truncate">
                    <MapPin size={11} className="text-slate-400 shrink-0" />
                    <span className="truncate">{invoice.address}</span>
                  </div>
                )}
              </div>

              {/* Botón para desplegar lista de productos */}
              <button
                type="button"
                onClick={() => setShowItemsList(!showItemsList)}
                className="w-full mt-1 pt-1.5 border-t border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-600 hover:text-[#0b4d2c] transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Package size={12} className="text-[#0b4d2c]" />
                  <span>{totalItemsCount} unidades a entregar ({invoice.items?.length || 0} artículos)</span>
                </span>
                {showItemsList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {/* Lista desplegable de productos */}
              {showItemsList && (
                <div className="mt-2 bg-white rounded-xl border border-slate-200 max-h-40 overflow-y-auto p-2 space-y-1.5 animate-in fade-in duration-150">
                  {(invoice.items || []).map((it: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="font-extrabold text-[#0b4d2c] font-mono shrink-0">{it.quantity}x</span>
                        <span className="font-semibold text-slate-800 truncate">{it.productName}</span>
                      </div>
                      <span className="font-bold text-slate-700 font-mono text-[11px] shrink-0">
                        Q {formatMoney(it.total || (Number(it.quantity) * Number(it.price)) || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. CAMPOS DE NOMBRES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  1. ¿Quién Entrega? (Tu nombre):
                </label>
                <input
                  type="text"
                  value={deliveredByName}
                  onChange={(e) => setDeliveredByName(e.target.value)}
                  placeholder="Ej. Sergio Lima / Asesor Agricovet"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  2. ¿Quién Recibe? (Cliente / Encargado):
                </label>
                <input
                  type="text"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="Nombre de la persona que recibe"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  DPI o Identificación de quien recibe (Opcional):
                </label>
                <input
                  type="text"
                  value={receiverDpi}
                  onChange={(e) => setReceiverDpi(e.target.value)}
                  placeholder="Ej. 1234 56789 0101 (opcional)"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* 3. BLOQUES DE FIRMA TÁCTIL (S-Pen / Táctil) */}
            <div className="space-y-4 pt-1">
              {/* FIRMA DE QUIEN ENTREGA */}
              <div className="border border-slate-300 rounded-2xl p-3 bg-slate-50/60 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#0b4d2c] text-white text-[10px] font-black flex items-center justify-center">1</span>
                    <span className="text-xs font-black text-slate-800">
                      Firma de Quien Entrega ({deliveredByName || 'Tú'})
                    </span>
                    {hasDelivererSigned && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <Check size={10} /> Lista
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleClearDeliverer}
                    className="text-[11px] font-bold text-slate-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                  >
                    <Eraser size={12} />
                    <span>Borrar</span>
                  </button>
                </div>

                <div 
                  className="border-2 border-dashed border-slate-300 rounded-xl bg-white overflow-hidden relative cursor-crosshair touch-none"
                  style={{ touchAction: 'none' }}
                >
                  <SignatureCanvas
                    ref={delivererCanvasRef}
                    penColor="#0f172a"
                    minWidth={1.2}
                    maxWidth={2.8}
                    onEnd={() => setHasDelivererSigned(!delivererCanvasRef.current?.isEmpty())}
                    canvasProps={{
                      className: "w-full h-36 sm:h-40 cursor-crosshair block",
                      style: { width: '100%', height: '150px', touchAction: 'none' }
                    }}
                  />
                  <div className="absolute bottom-3 left-4 right-4 pointer-events-none flex justify-center border-t border-slate-200 pt-1">
                    <span className="text-[10px] text-slate-400 font-medium">
                      Firma aquí con el lápiz S-Pen o dedo
                    </span>
                  </div>
                </div>
              </div>

              {/* FIRMA DE QUIEN RECIBE */}
              <div className="border-2 border-emerald-300/80 rounded-2xl p-3 bg-emerald-50/40 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">2</span>
                    <span className="text-xs font-black text-emerald-950">
                      Firma de Quien Recibe ({receiverName || 'Cliente'}) *
                    </span>
                    {hasReceiverSigned && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1">
                        <Check size={10} /> Lista
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleClearReceiver}
                    className="text-[11px] font-bold text-slate-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/80 transition-colors cursor-pointer"
                  >
                    <Eraser size={12} />
                    <span>Borrar</span>
                  </button>
                </div>

                <div 
                  className="border-2 border-dashed border-emerald-300 rounded-xl bg-white overflow-hidden relative cursor-crosshair touch-none"
                  style={{ touchAction: 'none' }}
                >
                  <SignatureCanvas
                    ref={receiverCanvasRef}
                    penColor="#000000"
                    minWidth={1.4}
                    maxWidth={3.2}
                    onEnd={() => setHasReceiverSigned(!receiverCanvasRef.current?.isEmpty())}
                    canvasProps={{
                      className: "w-full h-36 sm:h-40 cursor-crosshair block",
                      style: { width: '100%', height: '160px', touchAction: 'none' }
                    }}
                  />
                  <div className="absolute bottom-3 left-4 right-4 pointer-events-none flex justify-center border-t border-emerald-100 pt-1">
                    <span className="text-[10px] text-emerald-600 font-bold">
                      ✍️ Pásale el teléfono o S-Pen al cliente para que firme aquí
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isSubmitting || isDownloadingPdf}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              {isDownloadingPdf ? (
                <>
                  <Loader2 size={14} className="animate-spin text-slate-500" />
                  <span>Generando PDF...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Descargar Copia PDF</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-1/3 sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSaveAndDeliver}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0b4d2c] to-emerald-700 hover:from-emerald-900 hover:to-emerald-800 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-white" />
                    <span>Guardando Entrega...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Confirmar y Completar Entrega</span>
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

