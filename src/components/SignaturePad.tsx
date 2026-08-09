import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, Eraser, Check } from 'lucide-react';

interface SignaturePadProps {
  onSave: (signature: string) => void;
  onClose: () => void;
  title?: string;
}

/**
 * Recorta el espacio vacio alrededor del trazo.
 *
 * Reemplaza a `getTrimmedCanvas()` de react-signature-canvas, que depende de
 * `trim-canvas` (paquete solo CommonJS, sin build para modulos ES). Vite no
 * puede resolver su export por defecto y falla en tiempo de ejecucion con
 * "import_trim_canvas.default is not a function", justo al guardar la firma.
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
      // Canal alfa: si no es transparente, forma parte del trazo.
      if (pixeles[(y * width + x) * 4 + 3] !== 0) {
        if (y < arriba) arriba = y;
        if (y > abajo) abajo = y;
        if (x < izq) izq = x;
        if (x > der) der = x;
      }
    }
  }

  // Lienzo en blanco: devolverlo tal cual evita dimensiones negativas.
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

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onClose, title = "Firma Requerida" }) => {
  const sigPad = useRef<SignatureCanvas>(null);

  const clear = () => {
    sigPad.current?.clear();
  };

  const save = () => {
    if (!sigPad.current || sigPad.current.isEmpty()) {
      alert("Por favor, firma antes de guardar.");
      return;
    }

    let signatureData: string | undefined;
    try {
      signatureData = recortarCanvas(sigPad.current.getCanvas()).toDataURL('image/png');
    } catch (err) {
      // Si el recorte falla por cualquier motivo, guardar la firma completa
      // es preferible a perder lo que el usuario acaba de trazar.
      console.warn('No se pudo recortar la firma, se guarda completa:', err);
      signatureData = sigPad.current.getCanvas().toDataURL('image/png');
    }

    if (signatureData) {
      onSave(signatureData);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 overflow-hidden mb-4">
            <SignatureCanvas 
              ref={sigPad}
              penColor="black"
              canvasProps={{
                className: "w-full h-64 cursor-crosshair",
                style: { width: '100%', height: '256px' }
              }}
            />
          </div>
          
          <p className="text-sm text-gray-500 text-center mb-6">
            Usa tu dedo o mouse para firmar dentro del recuadro
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={clear}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Eraser size={18} />
              Limpiar
            </button>
            <button
              onClick={save}
              className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-200"
            >
              <Check size={18} />
              Guardar Firma
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignaturePad;
