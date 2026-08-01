import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Receipt, 
  Plus, 
  Search, 
  Printer, 
  Download, 
  FileText, 
  CheckCircle2, 
  Trash2, 
  Calendar, 
  User as UserIcon, 
  DollarSign, 
  Building, 
  CreditCard,
  X,
  RefreshCw,
  ArrowUpDown,
  FileSpreadsheet,
  Check,
  ChevronDown,
  Loader2
} from 'lucide-react';
import './ReciboCajaPrint.css';
import { ReciboCajaDB, FacturaDetalle, ChequeDetalle } from './types';
import { api } from '../../api';
import { Client } from '../../types';

interface ReciboCajaModuloProps {
  user?: { name: string; email?: string | null; role: string };
  isMobile?: boolean;
}

// Helper para convertir número a letras en Quetzales de Guatemala
export function numeroALetrasGuatemala(monto: number): string {
  if (isNaN(monto) || monto <= 0) return 'Cero quetzales exactos';

  const enteros = Math.floor(monto);
  const centavos = Math.round((monto - enteros) * 100);

  const unidades = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const decenas = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const especiales: Record<number, string> = {
    11: 'once', 12: 'doce', 13: 'trece', 14: 'catorce', 15: 'quince',
    16: 'dieciséis', 17: 'diecisiete', 18: 'dieciocho', 19: 'diecinueve',
    21: 'veintiún', 22: 'veintidós', 23: 'veintitrés', 24: 'veinticuarro',
    25: 'veinticinco', 26: 'veintiséis', 27: 'veintisiete', 28: 'veintiocho', 29: 'veintinueve'
  };
  const cientos = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecentos'];

  function convertirGrupo(n: number): string {
    if (n === 0) return '';
    if (n === 100) return 'cien';

    let res = '';
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;
    const du = n % 100;

    if (c > 0) res += cientos[c] + ' ';

    if (especiales[du]) {
      res += especiales[du];
    } else {
      if (d > 0) {
        res += decenas[d];
        if (u > 0) res += ' y ' + unidades[u];
      } else if (u > 0) {
        res += unidades[u];
      }
    }
    return res.trim();
  }

  let letras = '';
  const miles = Math.floor(enteros / 1000);
  const resto = enteros % 1000;

  if (miles === 1) {
    letras += 'un mil ';
  } else if (miles > 1) {
    letras += convertirGrupo(miles) + ' mil ';
  }

  if (resto > 0 || miles === 0) {
    letras += convertirGrupo(resto);
  }

  letras = letras.trim();
  if (!letras) letras = 'cero';

  const strCentavos = centavos > 0 ? ` con ${centavos}/100 centavos` : ' exactos';
  return letras.charAt(0).toUpperCase() + letras.slice(1) + ' quetzales' + strCentavos;
}

export const ReciboCajaModulo: React.FC<ReciboCajaModuloProps> = ({ user, isMobile }) => {
  const [recibos, setRecibos] = useState<ReciboCajaDB[]>([]);
  const [dbClients, setDbClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filtroFecha, setFiltroFecha] = useState<string>('todos');
  const [orden, setOrden] = useState<'desc' | 'asc'>('desc');
  const [formFechaRecibo, setFormFechaRecibo] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Modales
  const [showFormModal, setShowFormModal] = useState<boolean>(false);
  const [selectedReciboForPrint, setSelectedReciboForPrint] = useState<ReciboCajaDB | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [descargandoPDF, setDescargandoPDF] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // Typeahead state con DEBOUNCE
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [debouncedClientQuery, setDebouncedClientQuery] = useState<string>('');
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);
  const [searchingClients, setSearchingClients] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const ticketRef = useRef<HTMLDivElement>(null);

  // Form State
  const [formClienteNombre, setFormClienteNombre] = useState<string>('');
  const [formClienteNit, setFormClienteNit] = useState<string>('CF');
  const [formClienteCodigo, setFormClienteCodigo] = useState<string>('');
  const [formCantidadLetras, setFormCantidadLetras] = useState<string>('');
  const [formFacturas, setFormFacturas] = useState<FacturaDetalle[]>([
    { no_factura: 'F-001', fecha_factura: new Date().toLocaleDateString('es-GT'), valor: 0 }
  ]);
  const [formCheques, setFormCheques] = useState<ChequeDetalle[]>([]);
  const [formEfectivoTotal, setFormEfectivoTotal] = useState<number>(0);
  const [formObservaciones, setFormObservaciones] = useState<string>('');
  const [formCajeroNombre, setFormCajeroNombre] = useState<string>(user?.name || 'Juan Carlos Pérez');

  // Cargar clientes y recibos desde Supabase
  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [recibosData, clientesData] = await Promise.all([
        api.getRecibosCaja().catch(() => []),
        api.getClients().catch(() => [])
      ]);
      setRecibos(Array.isArray(recibosData) ? recibosData : []);
      setDbClients(Array.isArray(clientesData) ? clientesData : []);
    } catch (err) {
      console.error('Error al cargar datos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // IMPLEMENTACIÓN DE DEBOUNCE PARA LA BÚSQUEDA DE CLIENTES
  useEffect(() => {
    setSearchingClients(true);
    const timer = setTimeout(() => {
      setDebouncedClientQuery(clientSearchQuery);
      setSearchingClients(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [clientSearchQuery]);

  // Cerrar el dropdown de autocompletado si se hace clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clientes filtrados para el Dropdown Flotante con Debounce
  const filteredClientsForTypeahead = useMemo(() => {
    if (!debouncedClientQuery.trim()) return dbClients.slice(0, 6);
    const q = debouncedClientQuery.toLowerCase();
    return dbClients.filter(c => 
      (c.name || '').toLowerCase().includes(q) ||
      (c.companyName || '').toLowerCase().includes(q) ||
      (c.nit || '').toLowerCase().includes(q) ||
      (c.clientCode || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [dbClients, debouncedClientQuery]);

  // Seleccionar un cliente del buscador visual
  const handleSelectClient = (client: Client) => {
    setFormClienteNombre(client.name);
    setFormClienteNit(client.nit || 'CF');
    setFormClienteCodigo(client.clientCode || client.id || '');
    setClientSearchQuery(client.name);
    setShowClientDropdown(false);
  };

  // Totales calculados
  const totalFacturas = formFacturas.reduce((sum, f) => sum + (Number(f.valor) || 0), 0);
  const totalCheques = formCheques.reduce((sum, c) => sum + (Number(c.valor) || 0), 0);
  const totalReciboCalculado = totalFacturas + totalCheques + (Number(formEfectivoTotal) || 0);

  // Auto-generación de Cantidad en letras
  useEffect(() => {
    if (totalReciboCalculado > 0) {
      setFormCantidadLetras(numeroALetrasGuatemala(totalReciboCalculado));
    }
  }, [totalReciboCalculado]);

  // Handlers Facturas
  const handleAddFactura = () => {
    setFormFacturas(prev => [
      ...prev,
      { no_factura: `F-00${prev.length + 1}`, fecha_factura: new Date().toLocaleDateString('es-GT'), valor: 0 }
    ]);
  };

  const handleUpdateFactura = (index: number, field: keyof FacturaDetalle, val: any) => {
    setFormFacturas(prev => prev.map((item, i) => i === index ? { ...item, [field]: val } : item));
  };

  const handleRemoveFactura = (index: number) => {
    setFormFacturas(prev => prev.filter((_, i) => i !== index));
  };

  // Handlers Cheques
  const handleAddCheque = () => {
    setFormCheques(prev => [
      ...prev,
      { no_cheque: '', banco: 'BI (Banco Industrial)', valor: 0 }
    ]);
  };

  const handleUpdateCheque = (index: number, field: keyof ChequeDetalle, val: any) => {
    setFormCheques(prev => prev.map((item, i) => i === index ? { ...item, [field]: val } : item));
  };

  const handleRemoveCheque = (index: number) => {
    setFormCheques(prev => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setFormClienteNombre('');
    setFormClienteNit('CF');
    setFormClienteCodigo('');
    setClientSearchQuery('');
    setShowClientDropdown(false);
    setFormCantidadLetras('');
    setFormFechaRecibo(new Date().toISOString().split('T')[0]);
    setFormFacturas([{ no_factura: 'F-001', fecha_factura: new Date().toISOString().split('T')[0], valor: 0 }]);
    setFormCheques([]);
    setFormEfectivoTotal(0);
    setFormObservaciones('');
    setFormCajeroNombre(user?.name || 'CAJERO RECEPTOR');
  };

  // Guardar en Supabase
  const handleGuardarRecibo = async (e: React.FormEvent) => {
    e.preventDefault();
    const clienteNombreFinal = formClienteNombre.trim() || clientSearchQuery.trim();
    if (!clienteNombreFinal) {
      alert('Por favor, ingresa o selecciona un cliente.');
      return;
    }
    if (totalReciboCalculado <= 0) {
      alert('El recibo debe contener al menos un valor de factura, cheque o efectivo.');
      return;
    }

    setSaving(true);
    try {
      // Construir la fecha del recibo desde el campo del formulario
      const fechaFormatted = formFechaRecibo
        ? new Date(formFechaRecibo + 'T12:00:00').toLocaleDateString('es-GT', {
            day: '2-digit', month: '2-digit', year: 'numeric'
          })
        : new Date().toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });

      const nuevoRecibo: Partial<ReciboCajaDB> = {
        cliente_nombre: clienteNombreFinal,
        cliente_nit: formClienteNit || 'CF',
        cliente_codigo: formClienteCodigo || '',
        cantidad_letras: formCantidadLetras || numeroALetrasGuatemala(totalReciboCalculado),
        facturas: formFacturas.filter(f => f.valor > 0 || f.no_factura.trim() !== ''),
        cheques: formCheques.filter(c => c.valor > 0 || c.no_cheque.trim() !== ''),
        efectivo_total: Number(formEfectivoTotal) || 0,
        monto_total: totalReciboCalculado,
        observaciones: formObservaciones,
        cajero_nombre: formCajeroNombre || user?.name || 'CAJERO RECEPTOR',
        fecha: fechaFormatted
      };

      const guardado = await api.createReciboCaja(nuevoRecibo);
      setShowFormModal(false);
      resetForm();
      cargarDatos();
      setSelectedReciboForPrint(guardado);
    } catch (err: any) {
      console.error('Error al guardar recibo:', err);
      alert(`Error al guardar recibo: ${err.message || 'Intente de nuevo.'}`);
    } finally {
      setSaving(false);
    }
  };

  // Filtro de recibos históricos
  const recibosFiltrados = useMemo(() => {
    return recibos
      .filter(r => {
        const q = searchTerm.toLowerCase();
        const matchName = (r.cliente_nombre || '').toLowerCase().includes(q);
        const matchFolio = (r.folio || '').toLowerCase().includes(q);
        const matchNit = (r.cliente_nit || '').toLowerCase().includes(q);
        const matchSearch = matchName || matchFolio || matchNit;

        if (!matchSearch) return false;

        if (filtroFecha === 'hoy') {
          const hoyStr = new Date().toLocaleDateString('es-GT');
          return (r.fecha || '').includes(hoyStr);
        }
        if (filtroFecha === 'semana') {
          const now = new Date();
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const recFecha = new Date(r.created_at || r.fecha);
          return recFecha >= weekAgo;
        }
        if (filtroFecha === 'mes') {
          const now = new Date();
          const recFecha = new Date(r.created_at || r.fecha);
          return recFecha.getMonth() === now.getMonth() && recFecha.getFullYear() === now.getFullYear();
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.created_at || a.fecha).getTime();
        const timeB = new Date(b.created_at || b.fecha).getTime();
        return orden === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [recibos, searchTerm, filtroFecha, orden]);

  // Estadísticas rápidas
  const statsHoy = useMemo(() => {
    const hoyStr = new Date().toLocaleDateString('es-GT');
    const recibosHoy = recibos.filter(r => (r.fecha || '').includes(hoyStr.split('/')[0]));
    const montoHoy = recibosHoy.reduce((sum, r) => sum + (Number(r.monto_total) || 0), 0);
    return { count: recibosHoy.length, monto: montoHoy };
  }, [recibos]);

  const statsMes = useMemo(() => {
    const now = new Date();
    const recMes = recibos.filter(r => {
      const f = new Date(r.created_at || r.fecha);
      return f.getMonth() === now.getMonth() && f.getFullYear() === now.getFullYear();
    });
    const montoMes = recMes.reduce((sum, r) => sum + (Number(r.monto_total) || 0), 0);
    return { count: recMes.length, monto: montoMes };
  }, [recibos]);

  // SI EL USUARIO NO ES SESEFFFF942@GMAIL.COM, MOSTRAR MENSAJE AMIGABLE DE "ESTAMOS TRABAJANDO EN ESTA SECCIÓN"
  if ((user?.email || '').toLowerCase().trim() !== 'seseffff942@gmail.com') {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 bg-slate-50 font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xl text-center space-y-6 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative inline-flex items-center justify-center">
            <div className="w-20 h-20 bg-amber-50 border border-amber-200 text-amber-600 rounded-3xl flex items-center justify-center shadow-inner">
              <RefreshCw className="w-10 h-10 animate-spin text-amber-600" style={{ animationDuration: '8s' }} />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-teal-600 text-white p-1.5 rounded-full border-2 border-white shadow-sm">
              <Receipt className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-2">
            <span className="inline-block text-[11px] font-black uppercase tracking-widest text-amber-700 bg-amber-100/90 px-3.5 py-1 rounded-full border border-amber-200/70">
              🚧 Módulo en Desarrollo
            </span>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
              Estamos trabajando en esta sección
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              El módulo contable de <strong>Recibos de Caja</strong> se encuentra actualmente en fase de construcción y optimización. Muy pronto estará disponible para todo el equipo.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-xs text-slate-500 flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-2xs text-amber-600 shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <span className="text-left font-medium leading-normal">
              Si necesitas emitir o verificar un recibo de caja urgente, por favor comunícate con la administración principal.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // SOLUCIÓN ASÍNCRONA / IFRAME PARA EVITAR CONGELAMIENTO EN IMPRESIÓN
  const handleImprimirSeguro = () => {
    if (!ticketRef.current || isPrinting) return;
    setIsPrinting(true);

    setTimeout(() => {
      try {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = '0px';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (!doc) {
          setIsPrinting(false);
          return;
        }

        const ticketHTML = ticketRef.current?.outerHTML || '';

        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Imprimir Recibo - Agricovet</title>
              <style>
                @page { size: 80mm auto; margin: 0mm; }
                body { margin: 0; padding: 2mm; font-family: 'Courier New', Courier, monospace; background: #ffffff; color: #000000; }
                .recibo-ticket-container { width: 72mm; margin: 0 auto; box-shadow: none; border: none; }
                .recibo-header { text-align: center; border-bottom: 1.5px dashed #000; padding-bottom: 6px; margin-bottom: 8px; }
                .recibo-company-title { font-weight: 900; font-size: 13px; text-transform: uppercase; }
                .recibo-company-sub { font-size: 9px; margin-top: 2px; font-weight: 700; }
                .recibo-tag { display: inline-block; border: 1px solid #000; font-size: 9px; font-weight: 800; padding: 1px 6px; margin-top: 4px; }
                .recibo-meta-box { display: flex; justify-content: space-between; border: 1px solid #000; padding: 4px; margin-bottom: 8px; font-size: 10px; }
                .recibo-folio-num { color: #dc2626; font-weight: 900; font-size: 12px; }
                .recibo-section-grid { border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 8px; font-size: 10.5px; }
                .recibo-field-row { display: flex; justify-content: space-between; }
                .recibo-field-label { font-weight: 700; }
                .recibo-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10px; }
                .recibo-table th { border-bottom: 1.5px solid #000; font-size: 8.5px; text-align: left; padding: 3px 2px; }
                .recibo-table td { padding: 4px 2px; border-bottom: 1px solid #e2e8f0; }
                .recibo-cash-section { border: 1.5px solid #000; padding: 6px; margin: 8px 0; }
                .recibo-cash-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; }
                .recibo-signature-space { margin: 22px auto 6px auto; width: 75%; border-bottom: 1px solid #000; }
                .recibo-footer { text-align: center; margin-top: 8px; border-top: 1px dashed #000; padding-top: 6px; font-size: 9px; }
              </style>
            </head>
            <body>
              ${ticketHTML}
            </body>
          </html>
        `);
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.warn('Print iframe execution error:', e);
          } finally {
            setTimeout(() => {
              if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
              }
              setIsPrinting(false);
            }, 500);
          }
        }, 150);

      } catch (err) {
        console.error('Error durante la impresión iframe:', err);
        setIsPrinting(false);
      }
    }, 50);
  };

  // Descargar PDF Térmico sin congelar la pantalla
  const handleDescargarPDF = async () => {
    if (!ticketRef.current || !selectedReciboForPrint || descargandoPDF) return;
    setDescargandoPDF(true);

    setTimeout(async () => {
      try {
        const html2pdfModule = (await import('html2pdf.js')).default;
        const element = ticketRef.current;
        if (!element) return;

        const opt = {
          margin: [2, 2, 2, 2] as [number, number, number, number],
          filename: `Recibo_Agricovet_${selectedReciboForPrint.folio.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
          image: { type: 'jpeg' as const, quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
          jsPDF: { unit: 'mm', format: [80, Math.max(160, Math.ceil(element.offsetHeight * 0.264583 + 20))] as [number, number], orientation: 'portrait' as const }
        };

        const pdfPromise = html2pdfModule().set(opt).from(element).save();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Generación de PDF agotó el tiempo de espera')), 5000)
        );

        await Promise.race([pdfPromise, timeoutPromise]);
      } catch (err) {
        console.error('Error al generar PDF:', err);
        handleImprimirSeguro();
      } finally {
        setDescargandoPDF(false);
      }
    }, 50);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8 font-sans text-slate-800">
      
      {/* CABECERA CON GRADIENTE CORPORATIVO */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-gradient-to-br from-emerald-900 via-teal-800 to-emerald-700 rounded-2xl p-6 shadow-lg text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '10px 10px' }} />
          <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/15 rounded-2xl border border-white/20 backdrop-blur-sm">
                <Receipt className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase font-black tracking-widest text-emerald-200 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                    Panel Contable
                  </span>
                  <span className="text-[10px] uppercase font-black tracking-widest text-emerald-200 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                    Documentos Permanentes
                  </span>
                </div>
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
                  Recibos de Caja
                </h1>
                <p className="text-xs text-emerald-200 font-medium mt-0.5">
                  AGRICOVET — Control histórico inmutable e impresión térmica 80mm
                </p>
              </div>
            </div>

            {/* Estadísticas rápidas */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl px-4 py-3 text-center min-w-[90px]">
                <div className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider">Hoy</div>
                <div className="text-xl font-black text-white">{statsHoy.count}</div>
                <div className="text-[10px] text-emerald-300 font-bold">Q{statsHoy.monto.toFixed(0)}</div>
              </div>
              <div className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl px-4 py-3 text-center min-w-[90px]">
                <div className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider">Este Mes</div>
                <div className="text-xl font-black text-white">{statsMes.count}</div>
                <div className="text-[10px] text-emerald-300 font-bold">Q{statsMes.monto.toFixed(0)}</div>
              </div>
              <div className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl px-4 py-3 text-center min-w-[90px]">
                <div className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider">Total</div>
                <div className="text-xl font-black text-white">{recibos.length}</div>
                <div className="text-[10px] text-emerald-300 font-bold">recibos</div>
              </div>
              <button
                onClick={() => { resetForm(); setShowFormModal(true); }}
                className="px-5 py-3 bg-white text-emerald-900 hover:bg-emerald-50 font-black rounded-xl shadow-md flex items-center gap-2 transition active:scale-95 cursor-pointer text-sm border border-white/80"
              >
                <Plus className="w-4 h-4" />
                Nuevo Recibo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENEDOR DE LA PANTALLA PRINCIPAL */}
      <div className="max-w-7xl mx-auto space-y-5">
        
        {/* BARRA DE BÚSQUEDA Y FILTROS MEJORADOS */}
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por cliente, NIT o folio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-emerald-400 transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl">
              {(['todos', 'hoy', 'semana', 'mes'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFiltroFecha(f)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition capitalize ${
                    filtroFecha === f
                      ? 'bg-white text-emerald-800 shadow-sm border border-emerald-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f === 'todos' ? 'Todos' : f === 'hoy' ? 'Hoy' : f === 'semana' ? '7 Días' : 'Este Mes'}
                </button>
              ))}
            </div>

            <button
              onClick={() => setOrden(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <span>{orden === 'desc' ? 'Más Recientes' : 'Más Antiguos'}</span>
            </button>

            <button
              onClick={cargarDatos}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl transition"
              title="Recargar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* TABLA HISTÓRICA INMUTABLE - DISEÑO MEJORADO */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-xs font-bold tracking-wider uppercase text-slate-700 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Historial de Recibos ({recibosFiltrados.length})
            </h2>
            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
              Documentos Permanentes
            </span>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400 font-medium space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
                <p className="text-xs font-bold">Cargando recibos contables...</p>
              </div>
            ) : recibosFiltrados.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <Receipt className="w-12 h-12 mx-auto text-slate-200" />
                <p className="text-sm font-bold text-slate-500">No se encontraron recibos.</p>
                <p className="text-xs text-slate-400">{searchTerm ? 'Prueba con otro término de búsqueda.' : 'Emite el primer recibo de caja.'}</p>
                {!searchTerm && (
                  <button
                    onClick={() => { resetForm(); setShowFormModal(true); }}
                    className="px-4 py-2 bg-emerald-800 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition"
                  >
                    Emitir Recibo
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-200">
                    <th className="py-3 px-4">No. Recibo</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4 hidden sm:table-cell">NIT / Código</th>
                    <th className="py-3 px-4 text-right">Monto</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {recibosFiltrados.map((recibo) => (
                    <tr
                      key={recibo.id || recibo.folio}
                      className="hover:bg-emerald-50/40 transition-colors cursor-pointer group"
                      onClick={() => setSelectedReciboForPrint(recibo)}
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg text-[11px]">
                          {recibo.folio}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-medium">
                        {recibo.fecha}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{recibo.cliente_nombre}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px] hidden sm:table-cell">
                        {recibo.cliente_nit}{recibo.cliente_codigo ? ` | ${recibo.cliente_codigo}` : ''}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-black text-slate-900 text-sm">
                          Q{(Number(recibo.monto_total) || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedReciboForPrint(recibo); }}
                          className="px-3 py-1.5 bg-white hover:bg-emerald-800 hover:text-white text-emerald-800 rounded-xl font-bold text-[11px] flex items-center gap-1.5 mx-auto border border-emerald-200 transition shadow-sm group-hover:border-emerald-400"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Ver / Imprimir</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* FORMULARIO CON DEBOUNCE Y BUSCADOR VISUAL FLOTANTE (DROPDOWN TYPEAHEAD) */}
      {/* ========================================================================= */}
      {showFormModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 relative border border-slate-200">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-100 text-slate-800 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Emitir Recibo de Caja
                  </h2>
                  <p className="text-xs text-slate-500">
                    Documento contable permanente
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowFormModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarRecibo} className="space-y-5">
              
              {/* BLOQUE 1: BUSCADOR VISUAL DE CLIENTE CON CAJA DROPDOWN FLOTANTE */}
              <div className="space-y-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b pb-1">
                  1. Cliente (Buscador Visual con Debounce)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative">
                  
                  {/* INPUT TYPEAHEAD BUSCADOR DE CLIENTES CON CAJA DE DROPDOWN FLOTANTE */}
                  <div className="sm:col-span-2 relative" ref={dropdownRef}>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nombre del Cliente *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={formClienteNombre || clientSearchQuery}
                        onChange={e => {
                          const val = e.target.value;
                          setFormClienteNombre(val);
                          setClientSearchQuery(val);
                          setShowClientDropdown(true);
                        }}
                        onFocus={() => setShowClientDropdown(true)}
                        placeholder="Comienza a escribir para desplegar coincidencias..."
                        className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:border-slate-500 focus:outline-none"
                      />
                      {searchingClients ? (
                        <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      )}
                    </div>

                    {/* CAJA O MENÚ FLOTANTE (DROPDOWN VISUAL OBLIGATORIO) */}
                    {showClientDropdown && filteredClientsForTypeahead.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto divide-y divide-slate-100">
                        {filteredClientsForTypeahead.map(client => (
                          <div
                            key={client.id}
                            onClick={() => handleSelectClient(client)}
                            className="p-2.5 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors"
                          >
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">
                                {client.name} {client.companyName ? `(${client.companyName})` : ''}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                NIT: {client.nit || 'CF'} | Código: {client.clientCode || client.id}
                              </span>
                            </div>
                            <Check className="w-4 h-4 text-slate-700 opacity-0 hover:opacity-100 shrink-0" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      NIT Cliente
                    </label>
                    <input
                      type="text"
                      value={formClienteNit}
                      onChange={e => setFormClienteNit(e.target.value)}
                      placeholder="CF o NIT"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Código de Cliente
                    </label>
                    <input
                      type="text"
                      value={formClienteCodigo}
                      onChange={e => setFormClienteCodigo(e.target.value)}
                      placeholder="Ej. CLI-9042"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:border-emerald-500 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Fecha del Recibo
                    </label>
                    <input
                      type="date"
                      value={formFechaRecibo}
                      onChange={e => setFormFechaRecibo(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:border-emerald-500 focus:outline-none transition bg-white cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      Cantidad en Letras
                      {totalReciboCalculado > 0 && (
                        <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">auto</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={formCantidadLetras}
                      onChange={e => setFormCantidadLetras(e.target.value)}
                      placeholder="Se genera automáticamente al ingresar montos..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-slate-50 focus:border-emerald-500 focus:outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {/* BLOQUE 2: FACTURAS */}
              <div className="space-y-2">
                <div className="flex justify-between items-center border-b pb-1">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    2. En Pago de lo Siguiente (Facturas)
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddFactura}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-200 flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Factura
                  </button>
                </div>

                <div className="space-y-2">
                  {formFacturas.map((fac, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition">
                      <div className="w-32">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">No. Factura</label>
                        <input
                          type="text"
                          value={fac.no_factura}
                          onChange={e => handleUpdateFactura(idx, 'no_factura', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                      <div className="w-36">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">De Fecha</label>
                        <input
                          type="date"
                          value={fac.fecha_factura}
                          onChange={e => handleUpdateFactura(idx, 'fecha_factura', e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-emerald-400 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1 min-w-[100px]">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">Valor (Q)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={fac.valor}
                          onChange={e => handleUpdateFactura(idx, 'valor', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-right text-xs font-bold bg-white text-slate-900 focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFactura(idx)}
                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition mt-4"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* BLOQUE 3: CHEQUES */}
              <div className="space-y-2">
                <div className="flex justify-between items-center border-b pb-1">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    3. Pago con Cheques (Por Q.)
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddCheque}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-200 flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Cheque
                  </button>
                </div>

                <div className="space-y-2">
                  {formCheques.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-1">Sin cheques agregados (opcional).</p>
                  ) : (
                    formCheques.map((ch, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                        <div className="w-32">
                          <label className="block text-[10px] text-slate-400 font-bold uppercase">No. Cheque</label>
                          <input
                            type="text"
                            value={ch.no_cheque}
                            onChange={e => handleUpdateCheque(idx, 'no_cheque', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold bg-white"
                          />
                        </div>
                        <div className="flex-1 min-w-[140px]">
                          <label className="block text-[10px] text-slate-400 font-bold uppercase">Banco</label>
                          <input
                            type="text"
                            value={ch.banco}
                            onChange={e => handleUpdateCheque(idx, 'banco', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-[10px] text-slate-400 font-bold uppercase">Valor (Q)</label>
                          <input
                            type="number"
                            step="0.5"
                            value={ch.valor}
                            onChange={e => handleUpdateCheque(idx, 'valor', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-right text-xs font-bold bg-white text-slate-900"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCheque(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded mt-3"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* BLOQUE 4: EFECTIVO Y RESUMEN LIMPIO */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  4. Resumen y Efectivo Total
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Efectivo (Q)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={formEfectivoTotal}
                      onChange={e => setFormEfectivoTotal(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-base font-bold bg-white text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Total Cheques</span>
                    <p className="text-base font-bold text-slate-800 mt-0.5">Q{totalCheques.toFixed(2)}</p>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-300">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">TOTAL RECIBO</span>
                    <p className="text-lg font-black text-slate-900 mt-0.5">Q{totalReciboCalculado.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Observaciones y Cajero */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Observaciones
                  </label>
                  <input
                    type="text"
                    value={formObservaciones}
                    onChange={e => setFormObservaciones(e.target.value)}
                    placeholder="Notas contables opcionales"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cajero Receptor
                  </label>
                  <input
                    type="text"
                    value={formCajeroNombre}
                    onChange={e => setFormCajeroNombre(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold"
                  />
                </div>
              </div>

              {/* Resumen live del recibo */}
              {totalReciboCalculado > 0 && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                  <div className="text-xs text-emerald-700 font-bold">
                    Total calculado del recibo
                  </div>
                  <div className="text-xl font-black text-emerald-900">
                    Q{totalReciboCalculado.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || totalReciboCalculado <= 0}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-700 rounded-xl shadow-sm transition disabled:opacity-40 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {saving ? 'Guardando...' : 'Guardar e Imprimir Recibo'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IMPRESIÓN ASÍNCRONA / IFRAME QUE EVITA EL CONGELAMIENTO DE LA PÁGINA */}
      {/* ========================================================================= */}
      {selectedReciboForPrint && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-4 sm:p-5 relative border border-slate-200">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Vista Previa - Recibo {selectedReciboForPrint.folio}
                </h3>
                <p className="text-xs text-slate-500">Impresión térmica de 80mm aislada</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleImprimirSeguro}
                  disabled={isPrinting}
                  className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {isPrinting ? 'Imprimiendo...' : 'Imprimir Ticket'}
                </button>
                <button
                  onClick={handleDescargarPDF}
                  disabled={descargandoPDF}
                  className="px-3 py-1.5 bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  {descargandoPDF ? 'PDF...' : 'PDF'}
                </button>
                <button
                  onClick={() => setSelectedReciboForPrint(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* CONTENEDOR DE TICKET IMPRESO EN IFRAME/PANTALLA */}
            <div className="recibo-preview-wrapper">
              <div 
                id="printable-receipt" 
                ref={ticketRef} 
                className="recibo-ticket-container"
              >
                {/* Encabezado Agricovet */}
                <div className="recibo-header">
                  <div className="recibo-company-title">
                    AGRÍCOLA VETERINARIA DE GUATEMALA
                  </div>
                  <div className="recibo-company-sub">
                    AGRICOVET — PETÉN
                  </div>
                  <div className="text-[9px] text-slate-700 mt-1">
                    Segunda Lotificación, Santa Elena, Petén
                  </div>
                  <div className="text-[8.5px] text-slate-600 font-bold">
                    Tel: 7755-2445 / Cel: 3645-0241
                  </div>
                  <div className="recibo-tag">
                    RECIBO PROVISIONAL DE CAJA
                  </div>
                </div>

                {/* Folio BD */}
                <div className="recibo-meta-box">
                  <div>
                    <span className="font-bold text-slate-600">FOLIO: </span>
                    <span className="recibo-folio-num">{selectedReciboForPrint.folio}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-600">FECHA: </span>
                    <span className="font-bold">{selectedReciboForPrint.fecha}</span>
                  </div>
                </div>

                {/* Datos del Cliente */}
                <div className="recibo-section-grid">
                  <div className="recibo-field-row">
                    <span className="recibo-field-label">RECIBIMOS DE:</span>
                    <span className="recibo-field-value">{selectedReciboForPrint.cliente_nombre}</span>
                  </div>
                  <div className="recibo-field-row">
                    <span className="recibo-field-label">CANTIDAD DE:</span>
                    <span className="recibo-field-value text-[9.5px] italic">{selectedReciboForPrint.cantidad_letras}</span>
                  </div>
                  <div className="recibo-field-row">
                    <span className="recibo-field-label">NIT / CÓDIGO:</span>
                    <span className="recibo-field-value">{selectedReciboForPrint.cliente_nit} | {selectedReciboForPrint.cliente_codigo}</span>
                  </div>
                </div>

                {/* Tabla Facturas */}
                {selectedReciboForPrint.facturas && selectedReciboForPrint.facturas.length > 0 && (
                  <div className="mb-2">
                    <div className="text-[9px] font-bold uppercase text-slate-800 border-b border-slate-300 mb-1">
                      EN PAGO DE LO SIGUIENTE (FACTURAS):
                    </div>
                    <table className="recibo-table">
                      <thead>
                        <tr>
                          <th>NO. FACTURA</th>
                          <th>DE FECHA</th>
                          <th style={{ textAlign: 'right' }}>VALOR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReciboForPrint.facturas.map((f, i) => (
                          <tr key={i}>
                            <td className="font-bold">{f.no_factura}</td>
                            <td>{f.fecha_factura}</td>
                            <td className="text-right font-bold">Q{(Number(f.valor) || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Tabla Cheques */}
                {selectedReciboForPrint.cheques && selectedReciboForPrint.cheques.length > 0 && (
                  <div className="mb-2">
                    <div className="text-[9px] font-bold uppercase text-slate-800 border-b border-slate-300 mb-1">
                      POR Q. (CHEQUES):
                    </div>
                    <table className="recibo-table">
                      <thead>
                        <tr>
                          <th>NO. CHEQUE</th>
                          <th>BANCO</th>
                          <th style={{ textAlign: 'right' }}>VALOR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReciboForPrint.cheques.map((c, i) => (
                          <tr key={i}>
                            <td className="font-bold">{c.no_cheque}</td>
                            <td>{c.banco}</td>
                            <td className="text-right font-bold">Q{(Number(c.valor) || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Totales Resumen */}
                <div className="recibo-cash-section">
                  <div className="recibo-cash-header">
                    <span className="recibo-cash-title">
                      RESUMEN DE PAGO
                    </span>
                  </div>

                  {(Number(selectedReciboForPrint.efectivo_total) || 0) > 0 && (
                    <div className="recibo-cash-row">
                      <span>EFECTIVO:</span>
                      <span className="font-bold">Q{(Number(selectedReciboForPrint.efectivo_total) || 0).toFixed(2)}</span>
                    </div>
                  )}

                  {selectedReciboForPrint.cheques && selectedReciboForPrint.cheques.length > 0 && (
                    <div className="recibo-cash-row">
                      <span>TOTAL CHEQUES:</span>
                      <span className="font-bold">Q{selectedReciboForPrint.cheques.reduce((s, c) => s + (Number(c.valor) || 0), 0).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="recibo-cash-row mt-1 pt-1 border-t border-slate-300">
                    <span style={{ fontSize: '11px', fontWeight: 900 }}>
                      MONTO TOTAL RECIBO:
                    </span>
                    <span className="recibo-cash-amount change-val">
                      Q{(Number(selectedReciboForPrint.monto_total) || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {selectedReciboForPrint.observaciones && (
                  <div className="text-[9px] border-b border-dashed border-slate-300 pb-2 mb-2">
                    <span className="font-bold">OBSERVACIONES: </span>{selectedReciboForPrint.observaciones}
                  </div>
                )}

                {/* Firmas */}
                <div className="mt-4 pt-2 text-center text-[9px] font-bold">
                  <div>POR: AGRÍCOLA VETERINARIA DE GUATEMALA</div>
                  <div className="recibo-signature-space"></div>
                  <div>(F) {selectedReciboForPrint.cajero_nombre || 'CAJERO RECEPTOR'}</div>
                </div>

                {/* Nota Legal */}
                <div className="recibo-footer">
                  <div className="font-bold text-slate-800 text-[9.5px]">
                    ¡GRACIAS POR SU COMPRA EN AGRICOVET!
                  </div>
                  <div className="recibo-notice">
                    Todo cheque rechazado tendrá recargo automático del 3%.
                  </div>
                  <div className="text-[8px] text-slate-500 mt-1">
                    Emitido por: {selectedReciboForPrint.cajero_nombre || 'CAJERO RECEPTOR'}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default ReciboCajaModulo;
