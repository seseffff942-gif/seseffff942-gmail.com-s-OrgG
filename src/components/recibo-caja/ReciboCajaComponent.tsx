import React, { useState, useRef, useEffect } from 'react';
import { 
  Printer, 
  Download, 
  Plus, 
  Trash2, 
  DollarSign, 
  Receipt,
  FileText, 
  RefreshCw,
  AlertTriangle,
  X
} from 'lucide-react';
import './ReciboCajaPrint.css';

export interface ItemRecibo {
  id: string;
  cantidad: number;
  descripcion: string;
  precioUnitario: number;
}

export interface DatosRecibo {
  empresaNombre: string;
  empresaSubtítulo: string;
  direccion: string;
  telefono: string;
  nitEmpresa: string;
  folio: string;
  fecha: string;
  clienteNombre: string;
  clienteNit: string;
  clienteCodigo: string;
  concepto: string;
  items: ItemRecibo[];
  efectivoRecibido: number;
  cajeroNombre: string;
  observaciones: string;
}

export interface ReciboCajaProps {
  initialData?: Partial<DatosRecibo>;
  showForm?: boolean;
  onClose?: () => void;
}

const DEFAULT_SAMPLE_RECIBO: DatosRecibo = {
  empresaNombre: 'AGRÍCOLA VETERINARIA DE GUATEMALA',
  empresaSubtítulo: 'AGRICOVET - PETÉN',
  direccion: 'Segunda Lotificación, Santa Elena, Petén',
  telefono: '7755-2445 / Celular: 3645-0241',
  nitEmpresa: '458921-3',
  folio: 'P Nº 000151',
  fecha: new Date().toLocaleDateString('es-GT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }),
  clienteNombre: 'Finca Ganadera La Bendición',
  clienteNit: '7482910-K',
  clienteCodigo: 'CLI-8042',
  concepto: 'Pago de productos veterinarios e insumos agrícolas',
  items: [
    { id: '1', cantidad: 2, descripcion: 'Ivermectina 1% 500ml (Desparasitante)', precioUnitario: 185.00 },
    { id: '2', cantidad: 5, descripcion: 'Saco Alimento Ganado Lechero 40kg', precioUnitario: 210.00 },
    { id: '3', cantidad: 10, descripcion: 'Jeringa Veterinaria Desechable 20ml', precioUnitario: 6.50 },
    { id: '4', cantidad: 1, descripcion: 'Vitamina AD3E Inyectable 250ml', precioUnitario: 145.00 }
  ],
  efectivoRecibido: 1700.00,
  cajeroNombre: 'Juan Carlos Pérez',
  observaciones: 'Pago recibido conforme en efectivo.'
};

export const ReciboCajaComponent: React.FC<ReciboCajaProps> = ({ 
  initialData, 
  showForm = true,
  onClose 
}) => {
  const [recibo, setRecibo] = useState<DatosRecibo>({
    ...DEFAULT_SAMPLE_RECIBO,
    ...initialData
  });

  useEffect(() => {
    if (initialData) {
      setRecibo(prev => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  const [descargando, setDescargando] = useState<boolean>(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  // Cálculos dinámicos
  const totalPagar = recibo.items.reduce(
    (sum, item) => sum + (item.cantidad * item.precioUnitario), 
    0
  );

  const cambioEfectivo = Math.max(0, recibo.efectivoRecibido - totalPagar);
  const esSaldoFaltante = recibo.efectivoRecibido < totalPagar;
  const saldoFaltante = totalPagar - recibo.efectivoRecibido;

  // Handlers para actualizar datos
  const updateField = (field: keyof DatosRecibo, value: any) => {
    setRecibo(prev => ({ ...prev, [field]: value }));
  };

  const handleAddItem = () => {
    const newItem: ItemRecibo = {
      id: Date.now().toString(),
      cantidad: 1,
      descripcion: 'Nuevo Insumo / Servicio',
      precioUnitario: 50.00
    };
    setRecibo(prev => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const handleUpdateItem = (id: string, field: keyof ItemRecibo, value: any) => {
    setRecibo(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  const handleRemoveItem = (id: string) => {
    setRecibo(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const handleCargarEjemplo = () => {
    setRecibo({
      ...DEFAULT_SAMPLE_RECIBO,
      fecha: new Date().toLocaleDateString('es-GT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    });
  };

  const handleImprimir = () => {
    window.print();
  };

  const handleDescargarPDF = async () => {
    if (!ticketRef.current) return;
    setDescargando(true);
    try {
      const html2pdfModule = (await import('html2pdf.js')).default;
      const element = ticketRef.current;

      const opt = {
        margin: [2, 2, 2, 2] as [number, number, number, number],
        filename: `Recibo_Caja_${recibo.folio.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 3, useCORS: true, logging: false, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: [80, Math.max(160, Math.ceil(element.offsetHeight * 0.264583 + 20))] as [number, number], orientation: 'portrait' as const }
      };

      await html2pdfModule().set(opt).from(element).save();
    } catch (err) {
      console.error('Error al generar PDF:', err);
      window.print();
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="w-full bg-slate-100 p-4 lg:p-6 font-sans text-slate-800 rounded-2xl">
      {/* Encabezado del Sub-apartado */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#0c1b47] text-white rounded-xl shadow-md">
              <Receipt className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0c1b47]">
                Recibo de Caja - Agricovet
              </h1>
              <p className="text-xs text-slate-500">
                Formato Térmico Oficial (80mm Ancho / 72mm Imprimible Útil)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showForm && (
              <button
                onClick={handleCargarEjemplo}
                className="px-3 py-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Ejemplo
              </button>
            )}
            <button
              onClick={handleImprimir}
              className="px-4 py-2 text-xs font-semibold bg-[#0c1b47] text-white hover:bg-[#162a66] rounded-lg flex items-center gap-2 shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              Imprimir (80mm)
            </button>
            <button
              onClick={handleDescargarPDF}
              disabled={descargando}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg flex items-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {descargando ? 'Generando...' : 'Descargar PDF'}
            </button>
            {onClose && (
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid Principal */}
      <div className={`max-w-7xl mx-auto grid grid-cols-1 ${showForm ? 'lg:grid-cols-12' : ''} gap-8 items-start`}>
        
        {/* PANEL IZQUIERDO: FORMULARIO DE EDICIÓN */}
        {showForm && (
          <div className="lg:col-span-7 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0c1b47] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0c1b47]" />
                Datos del Recibo
              </h2>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-medium">
                Edición en Vivo
              </span>
            </div>

            {/* Datos Encabezado */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Folio / No. Recibo
                  </label>
                  <input
                    type="text"
                    value={recibo.folio}
                    onChange={(e) => updateField('folio', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-red-600 focus:ring-2 focus:ring-[#0c1b47]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Fecha y Hora
                  </label>
                  <input
                    type="text"
                    value={recibo.fecha}
                    onChange={(e) => updateField('fecha', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0c1b47]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Recibimos de (Cliente)
                  </label>
                  <input
                    type="text"
                    value={recibo.clienteNombre}
                    onChange={(e) => updateField('clienteNombre', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#0c1b47]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      NIT Cliente
                    </label>
                    <input
                      type="text"
                      value={recibo.clienteNit}
                      onChange={(e) => updateField('clienteNit', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0c1b47]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Código
                    </label>
                    <input
                      type="text"
                      value={recibo.clienteCodigo}
                      onChange={(e) => updateField('clienteCodigo', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0c1b47]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Concepto del Pago
                </label>
                <input
                  type="text"
                  value={recibo.concepto}
                  onChange={(e) => updateField('concepto', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0c1b47]"
                />
              </div>
            </div>

            {/* Tabla de Productos */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase text-slate-400">
                  Productos / Servicios
                </h3>
                <button
                  onClick={handleAddItem}
                  className="px-2.5 py-1 bg-[#0c1b47] text-white hover:bg-[#162a66] text-xs font-semibold rounded-lg flex items-center gap-1 shadow-sm transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar Fila
                </button>
              </div>

              <div className="space-y-2">
                {recibo.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <input
                      type="number"
                      min="1"
                      value={item.cantidad}
                      onChange={(e) => handleUpdateItem(item.id, 'cantidad', parseFloat(e.target.value) || 0)}
                      className="w-14 px-2 py-1 border border-slate-300 rounded text-center text-xs font-bold bg-white"
                      title="Cantidad"
                    />

                    <input
                      type="text"
                      value={item.descripcion}
                      onChange={(e) => handleUpdateItem(item.id, 'descripcion', e.target.value)}
                      className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs font-medium bg-white"
                      placeholder="Descripción del ítem"
                    />

                    <input
                      type="number"
                      step="0.5"
                      value={item.precioUnitario}
                      onChange={(e) => handleUpdateItem(item.id, 'precioUnitario', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border border-slate-300 rounded text-right text-xs font-bold bg-white"
                      title="Precio Unitario"
                    />

                    <span className="w-20 text-right text-xs font-extrabold text-[#0c1b47]">
                      Q{(item.cantidad * item.precioUnitario).toFixed(2)}
                    </span>

                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1 text-rose-500 hover:bg-rose-50 rounded transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* SECCIÓN PAGO EN EFECTIVO CON FONDO INVERTIDO #0c1b47 */}
            <div className="bg-[#0c1b47] text-white rounded-xl p-4 space-y-3 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-xs uppercase tracking-wider text-white">
                    Pago en Efectivo (Fondo Invertido #0c1b47)
                  </span>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-bold">
                  Efectivo Directo
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 items-center">
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                  <div className="text-[10px] text-slate-300 font-semibold uppercase">TOTAL</div>
                  <div className="text-base font-extrabold text-white">Q{totalPagar.toFixed(2)}</div>
                </div>

                <div className="bg-slate-800/80 p-2.5 rounded-lg border-2 border-emerald-500">
                  <div className="text-[10px] text-emerald-300 font-semibold uppercase">EFECTIVO RECIBIDO</div>
                  <div className="relative mt-0.5">
                    <span className="absolute left-2 top-0.5 text-xs text-slate-400 font-bold">Q</span>
                    <input
                      type="number"
                      step="5"
                      value={recibo.efectivoRecibido}
                      onChange={(e) => updateField('efectivoRecibido', parseFloat(e.target.value) || 0)}
                      className="w-full pl-6 pr-1 bg-transparent text-emerald-400 font-black text-sm border-none focus:outline-none"
                    />
                  </div>
                </div>

                <div className={`p-2.5 rounded-lg border ${
                  esSaldoFaltante 
                    ? 'bg-rose-950/60 text-rose-300 border-rose-800' 
                    : 'bg-slate-800/80 text-emerald-400 border-slate-700'
                }`}>
                  <div className="text-[10px] font-semibold uppercase opacity-80">
                    {esSaldoFaltante ? 'PENDIENTE' : 'CAMBIO'}
                  </div>
                  <div className="text-base font-black">
                    Q{(esSaldoFaltante ? saldoFaltante : cambioEfectivo).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Cajero y Notas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Cajero Receptor
                </label>
                <input
                  type="text"
                  value={recibo.cajeroNombre}
                  onChange={(e) => updateField('cajeroNombre', e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Observaciones
                </label>
                <input
                  type="text"
                  value={recibo.observaciones}
                  onChange={(e) => updateField('observaciones', e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* PANEL DERECHO: TICKET TÉRMICO (72MM ÚTIL) */}
        <div className={`${showForm ? 'lg:col-span-5' : 'max-w-md mx-auto'} w-full space-y-3`}>
          <div className="bg-slate-800 text-white rounded-t-xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-bold">
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
              Vista Previa (72mm Útil / 80mm Rollo)
            </div>
            <span className="font-mono text-[9px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">
              203 DPI / 576px
            </span>
          </div>

          <div className="recibo-preview-wrapper bg-slate-200 p-4 rounded-b-xl shadow-inner min-h-[480px]">
            {/* CONTENEDOR TÉRMICO DE 72MM EXACTOS */}
            <div 
              id="printable-receipt" 
              ref={ticketRef} 
              className="recibo-ticket-container"
            >
              {/* Encabezado Agricovet */}
              <div className="recibo-header">
                <div className="recibo-company-title">
                  {recibo.empresaNombre}
                </div>
                <div className="recibo-company-sub">
                  {recibo.empresaSubtítulo}
                </div>
                <div className="text-[9px] text-slate-700 mt-1">
                  {recibo.direccion}
                </div>
                <div className="text-[8.5px] text-slate-600 font-semibold">
                  Tel: {recibo.telefono}
                </div>
                <div className="recibo-tag">
                  RECIBO PROVISIONAL DE CAJA
                </div>
              </div>

              {/* Folio y Fecha */}
              <div className="recibo-meta-box">
                <div>
                  <span className="font-bold text-slate-600">FOLIO: </span>
                  <span className="recibo-folio-num">{recibo.folio}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-600">FECHA: </span>
                  <span className="font-bold">{recibo.fecha}</span>
                </div>
              </div>

              {/* Cliente y Concepto */}
              <div className="recibo-section-grid">
                <div className="recibo-field-row">
                  <span className="recibo-field-label">RECIBIMOS DE:</span>
                  <span className="recibo-field-value">{recibo.clienteNombre}</span>
                </div>
                <div className="recibo-field-row">
                  <span className="recibo-field-label">NIT / CÓDIGO:</span>
                  <span className="recibo-field-value">{recibo.clienteNit} | {recibo.clienteCodigo}</span>
                </div>
                <div className="recibo-field-row mt-1">
                  <span className="recibo-field-label">CONCEPTO:</span>
                  <span className="recibo-field-value text-[9.5px] italic">{recibo.concepto}</span>
                </div>
              </div>

              {/* Tabla de Productos */}
              <table className="recibo-table">
                <thead>
                  <tr>
                    <th style={{ width: '15%' }}>CANT</th>
                    <th style={{ width: '55%' }}>DESCRIPCIÓN</th>
                    <th style={{ width: '30%' }} className="text-right">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {recibo.items.map((item) => (
                    <tr key={item.id}>
                      <td className="font-bold text-center">{item.cantidad}</td>
                      <td>
                        <div className="recibo-item-desc">{item.descripcion}</div>
                        <div className="recibo-item-unit">
                          Q{item.precioUnitario.toFixed(2)} c/u
                        </div>
                      </td>
                      <td className="text-right font-bold">
                        Q{(item.cantidad * item.precioUnitario).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totales */}
              <div className="recibo-totals-box">
                <div className="recibo-total-row">
                  <span>SUBTOTAL ITEMS:</span>
                  <span className="font-bold">Q{totalPagar.toFixed(2)}</span>
                </div>
                <div className="recibo-total-row recibo-grand-total">
                  <span>TOTAL A PAGAR:</span>
                  <span>Q{totalPagar.toFixed(2)}</span>
                </div>
              </div>

              {/* APARTADO EXCLUSIVO CON FONDO INVERTIDO #0c1b47 */}
              <div className="recibo-cash-section">
                <div className="recibo-cash-header">
                  <span className="recibo-cash-title">
                    💵 PAGO EN EFECTIVO
                  </span>
                  <span className="recibo-cash-badge">
                    {esSaldoFaltante ? 'PARCIAL' : 'CANCELADO'}
                  </span>
                </div>

                <div className="recibo-cash-row">
                  <span className="recibo-cash-label">TOTAL RECIBO:</span>
                  <span className="recibo-cash-amount">Q{totalPagar.toFixed(2)}</span>
                </div>

                <div className="recibo-cash-row">
                  <span className="recibo-cash-label">EFECTIVO RECIBIDO:</span>
                  <span className="recibo-cash-amount">Q{recibo.efectivoRecibido.toFixed(2)}</span>
                </div>

                <div className="recibo-cash-row highlight-change" style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.18)',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  marginTop: '4px'
                }}>
                  <span className="recibo-cash-label" style={{ fontSize: '11px', fontWeight: 900 }}>
                    {esSaldoFaltante ? 'SALDO PENDIENTE:' : 'CAMBIO / VUELTAS:'}
                  </span>
                  <span className="recibo-cash-amount change-val">
                    Q{(esSaldoFaltante ? saldoFaltante : cambioEfectivo).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Observaciones y Pie */}
              {recibo.observaciones && (
                <div className="text-[9px] border-b border-dashed border-slate-300 pb-2 mb-2">
                  <span className="font-bold">OBS: </span>{recibo.observaciones}
                </div>
              )}

              <div className="recibo-signature-space"></div>
              <div className="recibo-signature-text text-center">
                (F) {recibo.cajeroNombre || 'CAJERO RECEPTOR'}
              </div>

              <div className="recibo-footer">
                <div className="font-bold text-[#0c1b47] text-[9.5px]">
                  ¡GRACIAS POR SU COMPRA EN AGRICOBET!
                </div>
                <div className="recibo-notice">
                  Todo cheque rechazado tendrá un recargo automático del 3%. Conservar este recibo para cualquier reclamo o devolución.
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ReciboCajaComponent;
