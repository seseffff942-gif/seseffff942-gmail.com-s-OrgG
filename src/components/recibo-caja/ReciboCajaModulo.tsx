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
  Loader2,
  Hash,
  Upload, 
  FileCheck, 
  CheckSquare, 
  Building2 
} from 'lucide-react';
import './ReciboCajaPrint.css';
import { downloadHtmlAsPdf, printHtml, formatMoney } from '../../utils';
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

// Helper para formatear cualquier fecha (ISO, string, date) a YYYY-MM-DD para <input type="date">
export function formatDateForInput(dateInput?: any): string {
  if (!dateInput) return new Date().toISOString().split('T')[0];
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (trimmed.includes('T')) return trimmed.split('T')[0];
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
        if (parts[2].length === 4) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }
  }
  const d = new Date(dateInput);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

export const ReciboCajaModulo: React.FC<ReciboCajaModuloProps> = ({ user, isMobile }) => {
  const [recibos, setRecibos] = useState<ReciboCajaDB[]>([]);
  const [dbClients, setDbClients] = useState<Client[]>([]);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
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
  const [generatingCodes, setGeneratingCodes] = useState<boolean>(false);

  const handleGenerateAllCodes = async () => {
    if (!confirm('¿Deseas generar automáticamente códigos de 4 dígitos para todos los clientes que no tengan uno?')) return;
    setGeneratingCodes(true);
    try {
      const res = await api.generateClientCodes();
      alert(`¡Éxito! Se generaron/actualizaron códigos para ${res.updatedCount || 0} clientes.`);
      await cargarDatos();
    } catch (err: any) {
      alert(`Error al generar códigos: ${err.message || 'Intente de nuevo'}`);
    } finally {
      setGeneratingCodes(false);
    }
  };

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
    { no_factura: 'F-001', fecha_factura: new Date().toISOString().split('T')[0], valor: 0 }
  ]);
  const [formCheques, setFormCheques] = useState<ChequeDetalle[]>([]);
  const [formEfectivoTotal, setFormEfectivoTotal] = useState<number>(0);
  const [formDepositoTotal, setFormDepositoTotal] = useState<number>(0);
  const [formBoletaRef, setFormBoletaRef] = useState<string>('');
  const [boletaFile, setBoletaFile] = useState<File | null>(null);
  const [boletaPreview, setBoletaPreview] = useState<string | null>(null);
  const [formObservaciones, setFormObservaciones] = useState<string>('');
  const [formCajeroNombre, setFormCajeroNombre] = useState<string>(user?.name || 'Juan Carlos Pérez');

  // Cargar clientes, recibos y facturas desde la API
  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [recibosData, clientesData, invoicesData] = await Promise.all([
        api.getRecibosCaja().catch(() => []),
        api.getClients().catch(() => []),
        api.getInvoices().catch(() => [])
      ]);
      setRecibos(Array.isArray(recibosData) ? recibosData : []);
      setDbClients(Array.isArray(clientesData) ? clientesData : []);
      setAllInvoices(Array.isArray(invoicesData) ? invoicesData : []);
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
    if (!debouncedClientQuery.trim()) {
      return dbClients.slice(0, 30);
    }
    const q = debouncedClientQuery.toLowerCase();
    return dbClients.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.companyName || '').toLowerCase().includes(q) ||
      (c.nit || '').toLowerCase().includes(q) ||
      (c.clientCode || '').toLowerCase().includes(q)
    );
  }, [dbClients, debouncedClientQuery]);

  // Búsqueda de Ventas/Facturas pendientes para el cliente seleccionado
  const clientPendingInvoices = useMemo(() => {
    const qName = (formClienteNombre || clientSearchQuery).trim().toLowerCase();
    if (!qName) return [];
    const qCode = (formClienteCodigo || '').trim().toLowerCase();

    return allInvoices.filter(inv => {
      const invClientName = (inv.client || '').trim().toLowerCase();
      const invClientCode = (inv.clientCode || '').trim().toLowerCase();
      const matchClient = invClientName.includes(qName) || qName.includes(invClientName) || (qCode && invClientCode === qCode);
      const isNotCancelled = inv.status !== 'cancelled' && inv.status !== 'rejected';
      const pendingBalance = (inv.totalAmount || 0) - (inv.paidAmount || 0);
      return matchClient && isNotCancelled && pendingBalance > 0;
    });
  }, [allInvoices, formClienteNombre, clientSearchQuery, formClienteCodigo]);

  // Seleccionar un cliente del buscador visual
  const handleSelectClient = (client: Client) => {
    setFormClienteNombre(client.name);
    setFormClienteNit(client.nit || 'CF');
    setFormClienteCodigo(client.clientCode || '');
    setClientSearchQuery(client.name);
    setShowClientDropdown(false);
  };

  // Totales y cálculos contables
  // 1. Valor Deuda Total de las Facturas / Folios seleccionados
  const totalDeudaFolio = useMemo(() => {
    return formFacturas.reduce((sum, f) => sum + (Number(f.valor) || 0), 0);
  }, [formFacturas]);

  // 2. Suma de pagos/abonos ingresados (Cheques + Depósito + Efectivo)
  const totalCheques = useMemo(() => {
    return formCheques.reduce((sum, c) => sum + (Number(c.valor) || 0), 0);
  }, [formCheques]);

  const totalAbonado = useMemo(() => {
    return (Number(formEfectivoTotal) || 0) + totalCheques + (Number(formDepositoTotal) || 0);
  }, [formEfectivoTotal, totalCheques, formDepositoTotal]);

  // 3. Saldo Restante del Folio (Se resta el pago abonado del total debido del folio)
  const saldoRestanteFolio = useMemo(() => {
    return Math.max(0, totalDeudaFolio - totalAbonado);
  }, [totalDeudaFolio, totalAbonado]);

  // 4. Cambio / Excedente si se abonó de más
  const cambioEfectivo = useMemo(() => {
    return Math.max(0, totalAbonado - totalDeudaFolio);
  }, [totalAbonado, totalDeudaFolio]);

  const totalReciboCalculado = totalAbonado;

  // Auto-generación de Cantidad en letras basada en lo abonado
  useEffect(() => {
    if (totalAbonado > 0) {
      setFormCantidadLetras(numeroALetrasGuatemala(totalAbonado));
    }
  }, [totalAbonado]);

  // Handlers Facturas
  const handleAddFactura = () => {
    setFormFacturas(prev => [
      ...prev,
      { no_factura: `F-00${prev.length + 1}`, fecha_factura: new Date().toISOString().split('T')[0], valor: 0 }
    ]);
  };

  const handleUpdateFactura = (index: number, field: keyof FacturaDetalle, val: any) => {
    setFormFacturas(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: val };

      // Si el usuario cambia el no_factura/folio, buscar automáticamente la fecha y saldo del folio
      if (field === 'no_factura' && typeof val === 'string' && val.trim().length > 0) {
        const cleanDigits = val.replace(/\D/g, '');
        if (cleanDigits) {
          const match = allInvoices.find(inv => 
            String(inv.folio) === cleanDigits || 
            String(inv.id) === val.trim() ||
            String(inv.id).slice(0, 8) === cleanDigits
          );
          if (match) {
            const rawDate = match.date || match.fecha || match.created_at || match.createdAt;
            updated.fecha_factura = formatDateForInput(rawDate);
            const saldo = (match.totalAmount || 0) - (match.paidAmount || 0);
            if (!updated.valor || updated.valor === 0) {
              updated.valor = saldo > 0 ? saldo : (match.totalAmount || 0);
            }
          }
        }
      }
      return updated;
    }));
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
    setFormDepositoTotal(0);
    setFormBoletaRef('');
    setBoletaFile(null);
    setBoletaPreview(null);
    setFormObservaciones('');
    setFormCajeroNombre(user?.name || 'CAJERO RECEPTOR');
  };

  // Guardar Recibo de Caja
  const handleGuardarRecibo = async (e: React.FormEvent) => {
    e.preventDefault();
    const clienteNombreFinal = formClienteNombre.trim() || clientSearchQuery.trim();
    if (!clienteNombreFinal) {
      alert('Por favor, ingresa o selecciona un cliente.');
      return;
    }
    if (totalAbonado <= 0 && totalDeudaFolio <= 0) {
      alert('El recibo debe contener al menos el valor del folio o un abono (efectivo, cheque o depósito).');
      return;
    }

    setSaving(true);
    try {
      const fechaFormatted = formFechaRecibo
        ? new Date(formFechaRecibo + 'T12:00:00').toLocaleDateString('es-GT', {
            day: '2-digit', month: '2-digit', year: 'numeric'
          })
        : new Date().toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });

      const obsDetallada = `DEUDA FOLIO: Q${totalDeudaFolio.toFixed(2)} | ABONADO: Q${totalAbonado.toFixed(2)} | RESTANTE: Q${saldoRestanteFolio.toFixed(2)}${formBoletaRef ? ` | BOLETA: ${formBoletaRef}` : ''}${formObservaciones ? ` | ${formObservaciones}` : ''}`;

      const nuevoRecibo: Partial<ReciboCajaDB> = {
        cliente_nombre: clienteNombreFinal,
        cliente_nit: formClienteNit || 'CF',
        cliente_codigo: formClienteCodigo || '',
        cantidad_letras: formCantidadLetras || numeroALetrasGuatemala(totalAbonado),
        facturas: formFacturas.filter(f => f.valor > 0 || f.no_factura.trim() !== ''),
        cheques: formCheques.filter(c => c.valor > 0 || c.no_cheque.trim() !== ''),
        efectivo_total: Number(formEfectivoTotal) || 0,
        monto_total: totalAbonado,
        observaciones: obsDetallada,
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

  // Acceso libre para todo el equipo


  // Impresión nativa limpia sin congelamiento
  const handleImprimirSeguro = async () => {
    if (!ticketRef.current || isPrinting) return;
    setIsPrinting(true);
    try {
      await printHtml(ticketRef.current.outerHTML);
    } catch (err) {
      console.error('Error durante la impresión:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  // Descargar PDF Térmico sin congelar la pantalla
  const handleDescargarPDF = async () => {
    if (!ticketRef.current || descargandoPDF) return;
    setDescargandoPDF(true);
    try {
      const folioName = selectedReciboForPrint?.folio || 'Recibo';
      await downloadHtmlAsPdf(
        ticketRef.current.outerHTML, 
        `Recibo_Agricovet_${folioName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
      );
    } catch (err) {
      console.error('Error al generar PDF:', err);
      handleImprimirSeguro();
    } finally {
      setDescargandoPDF(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-4 lg:p-8 font-sans text-slate-800">
      
      {/* CABECERA SIMPLE Y LIMPIA */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                  Panel Contable
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                  Documentos Permanentes
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
                Gestión de Recibos de Caja
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Agricovet • Control histórico inmutable e impresión térmica de 80mm
              </p>
            </div>
          </div>

          {/* Estadísticas rápidas */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center min-w-[70px]">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Hoy</div>
              <div className="text-lg font-black text-slate-900">{statsHoy.count}</div>
              <div className="text-[10px] text-slate-500 font-bold">Q{statsHoy.monto.toFixed(0)}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center min-w-[70px]">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Mes</div>
              <div className="text-lg font-black text-slate-900">{statsMes.count}</div>
              <div className="text-[10px] text-slate-500 font-bold">Q{statsMes.monto.toFixed(0)}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center min-w-[70px]">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total</div>
              <div className="text-lg font-black text-slate-900">{recibos.length}</div>
              <div className="text-[10px] text-slate-500 font-bold">recibos</div>
            </div>
            <button
              onClick={handleGenerateAllCodes}
              disabled={generatingCodes}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl border border-slate-300 flex items-center gap-1.5 transition active:scale-95 cursor-pointer text-xs disabled:opacity-50"
              title="Generar un código de 4 dígitos a todos los clientes que no tengan uno"
            >
              <Hash className="w-3.5 h-3.5 text-slate-600" />
              <span>{generatingCodes ? 'Generando...' : 'Generar Códigos a Clientes'}</span>
            </button>
            <button
              onClick={() => { resetForm(); setShowFormModal(true); }}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs flex items-center gap-2 transition active:scale-95 cursor-pointer text-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              Emitir Nuevo Recibo
            </button>
          </div>
        </div>
      </div>

      {/* CONTENEDOR DE LA PANTALLA PRINCIPAL */}
      <div className="max-w-7xl mx-auto space-y-5">
        
        {/* BARRA DE BÚSQUEDA Y FILTROS */}
        <div className="bg-white rounded-2xl p-3.5 shadow-xs border border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar por cliente, NIT o folio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-slate-400 transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl">
              {(['todos', 'hoy', 'semana', 'mes'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFiltroFecha(f)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    filtroFecha === f
                      ? 'bg-white text-slate-900 shadow-xs'
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
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* TABLA HISTÓRICA INMUTABLE */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-xs font-bold tracking-wider uppercase text-slate-700 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              Historial de Recibos Guardados ({recibosFiltrados.length})
            </h2>
            <span className="text-[10px] bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full font-mono font-medium">
              Documentos Permanentes
            </span>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400 font-medium space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-600" />
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
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition"
                  >
                    Emitir Recibo
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
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
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedReciboForPrint(recibo)}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {recibo.folio}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {recibo.fecha}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {recibo.cliente_nombre}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px] hidden sm:table-cell">
                        {recibo.cliente_nit}{recibo.cliente_codigo ? ` | ${recibo.cliente_codigo}` : ''}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm">
                        Q{(Number(recibo.monto_total) || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedReciboForPrint(recibo); }}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-[11px] flex items-center gap-1.5 border border-slate-200 transition"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-600" />
                            <span>Ver</span>
                          </button>
                          {(!user?.role || ['admin', 'dueño', 'dueno', 'ceo', 'owner'].includes(String(user.role).toLowerCase().trim())) && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm(`¿Eliminar recibo ${recibo.folio} de ${recibo.cliente_nombre}?\n\nEsta acción NO se puede deshacer.`)) return;
                                try {
                                  await api.deleteReciboCaja(recibo.id!);
                                  await cargarDatos();
                                } catch (err: any) {
                                  alert(`Error al eliminar: ${err.message || 'Intente de nuevo'}`);
                                }
                              }}
                              className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-[11px] flex items-center gap-1 border border-red-200 transition cursor-pointer"
                              title="Eliminar recibo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
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
                        value={clientSearchQuery}
                        onChange={e => {
                          const val = e.target.value;
                          setFormClienteNombre('');
                          setClientSearchQuery(val);
                          setShowClientDropdown(true);
                        }}
                        onFocus={() => setShowClientDropdown(true)}
                        placeholder="Escribe el nombre, NIT o código del cliente..."
                        className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:border-slate-500 focus:outline-none"
                      />
                      {searchingClients ? (
                        <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      )}
                    </div>

                    {/* DROPDOWN CON RESULTADOS DE BÚSQUEDA */}
                    {showClientDropdown && filteredClientsForTypeahead.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto divide-y divide-slate-100">
                        {filteredClientsForTypeahead.map(client => (
                          <div
                            key={client.id}
                            onMouseDown={e => { e.preventDefault(); handleSelectClient(client); }}
                            className="p-2.5 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors"
                          >
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">
                                {client.name} {client.companyName ? `(${client.companyName})` : ''}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                NIT: {client.nit || 'CF'}{client.clientCode ? ` | Cód: ${client.clientCode}` : ''}
                              </span>
                            </div>
                            <Check className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
                      {totalAbonado > 0 && (
                        <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">auto</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={formCantidadLetras}
                      onChange={e => setFormCantidadLetras(e.target.value)}
                      placeholder="Se genera automáticamente al ingresar pagos..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-slate-50 focus:border-emerald-500 focus:outline-none transition"
                    />
                  </div>
                </div>

                {/* TARJETA DE VENTAS / FACTURAS PENDIENTES DEL CLIENTE SELECCIONADO */}
                {clientPendingInvoices.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200/90 p-3 rounded-2xl space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                        <span>📋</span> Ventas / Folios Pendientes de {formClienteNombre} ({clientPendingInvoices.length})
                      </span>
                      <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2.5 py-0.5 rounded-full font-bold">
                        Haz clic para abonar
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                      {clientPendingInvoices.map((inv: any) => {
                        const folioDisplay = `Folio #${inv.folio || inv.id?.slice(0, 8)}`;
                        const saldo = (inv.totalAmount || 0) - (inv.paidAmount || 0);
                        const rawInvoiceDate = inv.date || inv.fecha || inv.created_at || inv.createdAt;
                        const formattedInvoiceDate = formatDateForInput(rawInvoiceDate);
                        return (
                          <div 
                            key={inv.id}
                            className="p-2 bg-white border border-amber-200 rounded-xl flex items-center justify-between shadow-2xs hover:border-amber-400 transition"
                          >
                            <div>
                              <span className="text-xs font-black text-slate-800 block">{folioDisplay}</span>
                              <span className="text-[10px] text-slate-500 font-medium">
                                {rawInvoiceDate || 'Sin fecha'} • Deuda: Q{inv.totalAmount?.toFixed(2)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setFormFacturas([
                                  { no_factura: folioDisplay, fecha_factura: formattedInvoiceDate, valor: saldo }
                                ]);
                              }}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded-lg transition shrink-0"
                            >
                              Cargar Folio (Q{saldo.toFixed(2)})
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* BLOQUE 2: FACTURAS / FOLIOS */}
              <div className="space-y-2">
                <div className="flex justify-between items-center border-b pb-1">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    2. En Pago de lo Siguiente (Factura / Folio a Pagar)
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddFactura}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-200 flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Folio
                  </button>
                </div>

                <div className="space-y-2">
                  {formFacturas.map((fac, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition">
                      <div className="w-36">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">No. Factura / Folio</label>
                        <input
                          type="text"
                          value={fac.no_factura}
                          onChange={e => handleUpdateFactura(idx, 'no_factura', e.target.value)}
                          placeholder="Ej. Folio 803"
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
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">Valor Deuda (Q)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={fac.valor || ''}
                          onFocus={e => e.target.select()}
                          onChange={e => handleUpdateFactura(idx, 'valor', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
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

              {/* BLOQUE 3: FORMAS DE PAGO / ABONOS */}
              <div className="space-y-3 pt-2">
                <div className="border-b pb-1">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    3. Formas de Pago / Abonos (Cheques, Depósitos, Efectivo)
                  </h3>
                </div>

                {/* CHEQUES */}
                <div className="space-y-2 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-slate-500" /> Cheques
                    </span>
                    <button
                      type="button"
                      onClick={handleAddCheque}
                      className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 flex items-center gap-1 transition"
                    >
                      <Plus className="w-3 h-3" />
                      Agregar Cheque
                    </button>
                  </div>

                  {formCheques.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">Sin cheques agregados.</p>
                  ) : (
                    formCheques.map((ch, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-lg">
                        <div className="w-28">
                          <label className="block text-[9px] text-slate-400 font-bold uppercase">No. Cheque</label>
                          <input
                            type="text"
                            value={ch.no_cheque}
                            onChange={e => handleUpdateCheque(idx, 'no_cheque', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-bold"
                          />
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <label className="block text-[9px] text-slate-400 font-bold uppercase">Banco</label>
                          <input
                            type="text"
                            value={ch.banco}
                            onChange={e => handleUpdateCheque(idx, 'banco', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                          />
                        </div>
                        <div className="w-28">
                          <label className="block text-[9px] text-slate-400 font-bold uppercase">Valor (Q)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={ch.valor || ''}
                            onFocus={e => e.target.select()}
                            onChange={e => handleUpdateCheque(idx, 'valor', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-right text-xs font-bold text-slate-900"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCheque(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded mt-3"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* DEPÓSITO / BOLETA DE PAGO */}
                <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-slate-500" /> Depósito o Transferencia Bancaria (Boleta)
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Monto Depósito (Q)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formDepositoTotal === 0 ? '' : formDepositoTotal}
                        onFocus={e => e.target.select()}
                        onChange={e => {
                          const raw = e.target.value;
                          setFormDepositoTotal(raw === '' ? 0 : (parseFloat(raw) || 0));
                        }}
                        placeholder="0.00"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-right text-xs font-bold bg-white text-slate-900 focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">No. Boleta / Transacción</label>
                      <input
                        type="text"
                        value={formBoletaRef}
                        onChange={e => setFormBoletaRef(e.target.value)}
                        placeholder="Ej. B-984210"
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold bg-white text-slate-900 focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Subir Comprobante / Boleta</label>
                      <label className="flex items-center justify-between px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition">
                        <span className="truncate flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          {boletaFile ? boletaFile.name : 'Adjuntar boleta'}
                        </span>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setBoletaFile(file);
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setBoletaPreview(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* EFECTIVO */}
                <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-emerald-600" /> Efectivo Recibido (Q)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formEfectivoTotal === 0 ? '' : formEfectivoTotal}
                    onFocus={e => e.target.select()}
                    onChange={e => {
                      const raw = e.target.value;
                      setFormEfectivoTotal(raw === '' ? 0 : (parseFloat(raw) || 0));
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-base font-bold bg-white text-slate-900 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              </div>

              {/* BLOQUE 4: RESUMEN CONTABLE DE FOLIO Y ABONOS */}
              <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3 shadow-md">
                <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
                  4. Resumen del Folio y Abono Total
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                  <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Deuda Total Folio</span>
                    <p className="text-base font-black text-amber-400 mt-0.5">Q{totalDeudaFolio.toFixed(2)}</p>
                  </div>

                  <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Cheques + Depósito</span>
                    <p className="text-base font-bold text-teal-400 mt-0.5">Q{(totalCheques + (Number(formDepositoTotal) || 0)).toFixed(2)}</p>
                  </div>

                  <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">TOTAL ABONADO</span>
                    <p className="text-lg font-black text-white mt-0.5">Q{totalAbonado.toFixed(2)}</p>
                  </div>

                  <div className={`p-2.5 rounded-xl border ${
                    saldoRestanteFolio > 0 
                      ? 'bg-rose-950/80 border-rose-700 text-rose-300' 
                      : 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                  }`}>
                    <span className="text-[10px] uppercase font-bold block opacity-80">
                      {saldoRestanteFolio > 0 ? 'SALDO RESTANTE' : 'CAMBIO / CANCELADO'}
                    </span>
                    <p className="text-lg font-black mt-0.5">
                      Q{(saldoRestanteFolio > 0 ? saldoRestanteFolio : cambioEfectivo).toFixed(2)}
                    </p>
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
                  disabled={saving || (totalAbonado <= 0 && totalDeudaFolio <= 0)}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-2"
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
                {(!user?.role || ['admin', 'dueño', 'dueno', 'ceo', 'owner'].includes(String(user.role).toLowerCase().trim())) && (
                  <button
                    onClick={async () => {
                      if (!confirm(`¿Eliminar permanentemente el recibo ${selectedReciboForPrint.folio} de ${selectedReciboForPrint.cliente_nombre}?\n\nEsta acción NO se puede deshacer.`)) return;
                      try {
                        await api.deleteReciboCaja(selectedReciboForPrint.id!);
                        setSelectedReciboForPrint(null);
                        await cargarDatos();
                        alert('Recibo eliminado con éxito.');
                      } catch (err: any) {
                        alert(`Error al eliminar: ${err.message || 'Intente de nuevo'}`);
                      }
                    }}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-red-200 transition cursor-pointer"
                    title="Eliminar este recibo"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Eliminar</span>
                  </button>
                )}
                <button
                  onClick={handleDescargarPDF}
                  disabled={descargandoPDF}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {descargandoPDF ? 'Generando PDF...' : 'Descargar PDF'}
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
