import React, { useState, useEffect, useMemo } from 'react';
import { User, AuditLogEntry, AuditStats } from '../types';
import { api } from '../api';
import { 
  Shield, 
  ShieldAlert, 
  Activity, 
  Search, 
  RefreshCw, 
  Printer, 
  Package, 
  Users, 
  ShoppingCart, 
  MapPin, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Eye, 
  X,
  FileSpreadsheet,
  Sparkles
} from 'lucide-react';
import { cn } from '../utils';

interface MasterAuditPageProps {
  user: User;
  isMobile?: boolean;
}

export function MasterAuditPage({ user, isMobile }: MasterAuditPageProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    totalLogs: 0,
    logs24h: 0,
    totalStock: 0,
    totalClientes: 0,
    totalVentas: 0,
    totalRutas: 0,
    totalSeguridad: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week'>('all');

  const isOwner = user?.email?.toLowerCase().trim() === 'seseffff942@gmail.com';

  const fetchAuditData = async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const res = await api.getAuditLogs({
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: searchTerm || undefined,
        limit: 300
      });

      if (res && res.logs && res.logs.length > 0) {
        setLogs(res.logs);
      }
      if (res && res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, [selectedCategory]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchAuditData(true);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchAuditData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedCategory, searchTerm]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (dateFilter === 'all') return true;
      const logDate = new Date(log.createdAt || (log as any).created_at);
      const now = new Date();
      if (dateFilter === 'today') {
        return logDate.toDateString() === now.toDateString();
      }
      if (dateFilter === 'week') {
        const diffDays = (now.getTime() - logDate.getTime()) / (1000 * 3600 * 24);
        return diffDays <= 7;
      }
      return true;
    });
  }, [logs, dateFilter]);

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'stock':
        return {
          label: 'Inventario / Stock',
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: Package
        };
      case 'clientes':
        return {
          label: 'Clientes',
          bg: 'bg-teal-50 text-teal-800 border-teal-200',
          icon: Users
        };
      case 'ventas':
        return {
          label: 'Ventas & Facturas',
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: ShoppingCart
        };
      case 'rutas':
        return {
          label: 'Rutas & GPS',
          bg: 'bg-teal-50 text-teal-900 border-teal-200',
          icon: MapPin
        };
      case 'seguridad':
        return {
          label: 'Seguridad / Forense',
          bg: 'bg-rose-50 text-rose-800 border-rose-200',
          icon: ShieldAlert
        };
      default:
        return {
          label: 'Sistema',
          bg: 'bg-slate-100 text-slate-800 border-slate-200',
          icon: Activity
        };
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CREATED') || action.includes('PINNED')) {
      return 'bg-teal-100 text-teal-900 border border-teal-200 font-bold';
    }
    if (action.includes('DELETED') || action.includes('CLEANUP') || action.includes('UNPINNED')) {
      return 'bg-rose-100 text-rose-900 border border-rose-200 font-bold';
    }
    if (action.includes('STOCK')) {
      return 'bg-amber-100 text-amber-900 border border-amber-200 font-bold';
    }
    return 'bg-slate-100 text-slate-800 border border-slate-200 font-bold';
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMin < 1) return 'Justo ahora';
      if (diffMin < 60) return `Hace ${diffMin} min`;
      if (diffHours < 24) return `Hace ${diffHours} h`;
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 7) return `Hace ${diffDays} días`;
      return date.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return isoString;
    }
  };

  const exportToCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['Fecha/Hora', 'Categoría', 'Acción', 'Entidad', 'Usuario', 'Email', 'Descripción', 'IP'];
    const rows = filteredLogs.map(l => [
      `"${new Date(l.createdAt || (l as any).created_at).toLocaleString('es-GT')}"`,
      `"${l.category}"`,
      `"${l.action}"`,
      `"${(l.entityName || (l as any).entity_name || '').replace(/"/g, '""')}"`,
      `"${(l.userName || (l as any).user_name || '').replace(/"/g, '""')}"`,
      `"${l.userEmail || (l as any).user_email || ''}"`,
      `"${(l.description || '').replace(/"/g, '""')}"`,
      `"${l.ipAddress || (l as any).ip_address || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `auditoria_movimientos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col space-y-6 bg-slate-50/70 min-h-screen pb-24 font-sans">
      
      {/* 1. HEADER SECTION (Matches ClientVisitsPage) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-teal-100 text-teal-800 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              Módulo de Auditoría & Control
            </span>
            <span className="text-xs font-semibold text-slate-400">Guatemala</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight font-manrope">
            Bitácora de Auditoría & Trazabilidad
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Registro inmutable de cada movimiento en tiempo real: clientes, ajustes de stock (±1 unidad), ventas emitidas, fijaciones GPS y control forense.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            type="button"
            onClick={exportToCSV}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 active:scale-95 px-3.5 py-3 rounded-xl font-bold transition-all shadow-xs text-xs cursor-pointer"
            title="Exportar reporte de movimientos a Excel"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" />
            <span>Excel</span>
          </button>

          <button 
            type="button"
            onClick={handlePrintReport}
            className="flex items-center gap-2 bg-[#00696a] hover:bg-[#004f50] active:scale-95 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-md shadow-teal-600/10 text-xs cursor-pointer"
          >
            <Printer size={16} />
            <span>Imprimir Informe</span>
          </button>

          <button
            type="button"
            onClick={() => fetchAuditData()}
            disabled={refreshing}
            className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer shadow-xs active:scale-95"
            title="Actualizar datos"
          >
            <RefreshCw size={16} className={cn(refreshing && "animate-spin text-teal-600")} />
          </button>
        </div>
      </div>

      {/* 2. LIVE STATUS BAR (Matches GPS Live Status Bar) */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <div className="absolute w-6 h-6 rounded-full bg-emerald-500/20 animate-ping" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800">
              Trazabilidad Inmutable:
            </span>
            <span className="font-mono text-[11px] bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-200 text-slate-700">
              PostgreSQL + Copia Espejo Local
            </span>
            {isOwner && (
              <span className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-[10px] font-bold">
                🔒 Dueño / CEO ({user.email})
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={cn(
            "px-3 py-1.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95",
            autoRefresh 
              ? "bg-[#00696a] text-white" 
              : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700"
          )}
        >
          <RefreshCw size={13} className={cn(autoRefresh && "animate-spin text-white")} />
          <span>{autoRefresh ? "En Vivo Activo (10s)" : "Activar En Vivo"}</span>
        </button>
      </div>

      {/* 3. ACTIVE SUPERVISION BANNER (Matches Green Route Card in Image 2) */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 border border-emerald-500/30 text-white px-4 py-3 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Shield size={18} className="text-white animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-300 text-emerald-950 uppercase tracking-wider">
                🟢 Escudo Activo
              </span>
              <span className="text-xs font-black text-white truncate">
                Supervisión y Auditoría Forense en Tiempo Real
              </span>
              <span className="text-[11px] text-emerald-200 font-medium">
                · Incidente GT-1013 Resuelto & Facturas Desvinculadas
              </span>
            </div>
            <p className="text-[11px] text-emerald-100 font-medium truncate mt-0.5">
              📍 Cada alta de cliente, cambio de stock (±1 unidad) o venta queda registrada de forma permanente
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <span className="text-xs font-bold bg-white/15 px-3 py-1.5 rounded-lg text-white">
            Total Auditado: {stats.totalLogs} movimientos
          </span>
        </div>
      </div>

      {/* 4. METRICS ROW (Matches Image 2 bottom cards exactly) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 lg:gap-5">
        {/* Card 1: Total Movimientos */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Total Movimientos</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Activity size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h4 className="text-3xl font-black text-slate-950">{stats.totalLogs}</h4>
              <span className="text-xs font-bold text-slate-500">registros auditados</span>
            </div>
            <p className="text-xs text-emerald-600 mt-1 font-semibold flex items-center gap-1">
              <Sparkles size={12} /> +{stats.logs24h} en las últimas 24 horas
            </p>
          </div>
        </div>

        {/* Card 2: Stock */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Ajustes de Stock</span>
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
              <Package size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h4 className="text-3xl font-black text-slate-950">{stats.totalStock}</h4>
              <span className="text-xs font-bold text-slate-500">modificaciones</span>
            </div>
            <p className="text-xs text-teal-600 mt-1 font-semibold">
              Deducciones por venta y ajustes ±1
            </p>
          </div>
        </div>

        {/* Card 3: Seguridad / GT-1013 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Seguridad & Clientes</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <ShieldAlert size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <h4 className="text-3xl font-black text-rose-600">{stats.totalSeguridad + stats.totalClientes}</h4>
              <span className="text-xs font-bold text-slate-500">eventos críticos</span>
            </div>
            <p className="text-xs text-rose-500 mt-1 font-semibold">
              Auditoría preventiva GT-1013 y cartera
            </p>
          </div>
        </div>
      </div>

      {/* 5. FILTER & SEARCH BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, producto, usuario (ej. ventas1, admin), acción o palabra clave..."
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#00696a] focus:bg-white transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setDateFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                dateFilter === 'all' 
                  ? "bg-white text-[#00696a] shadow-xs font-bold" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Histórico
            </button>
            <button
              onClick={() => setDateFilter('today')}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                dateFilter === 'today' 
                  ? "bg-white text-[#00696a] shadow-xs font-bold" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Hoy
            </button>
            <button
              onClick={() => setDateFilter('week')}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                dateFilter === 'week' 
                  ? "bg-white text-[#00696a] shadow-xs font-bold" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Últimos 7 días
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {[
            { id: 'all', label: 'Todos los Movimientos', count: stats.totalLogs },
            { id: 'stock', label: 'Stock / Inventario', count: stats.totalStock },
            { id: 'clientes', label: 'Clientes & Pruebas', count: stats.totalClientes },
            { id: 'ventas', label: 'Ventas & Facturas', count: stats.totalVentas },
            { id: 'rutas', label: 'Rutas & GPS', count: stats.totalRutas },
            { id: 'seguridad', label: 'Seguridad / Forense', count: stats.totalSeguridad }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={cn(
                "whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer",
                selectedCategory === tab.id
                  ? "bg-[#00696a] text-white border-[#00696a] shadow-xs"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-teal-50 hover:text-[#00696a] hover:border-teal-200"
              )}
            >
              <span>{tab.label}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px]",
                selectedCategory === tab.id
                  ? "bg-[#004f50] text-teal-50"
                  : "bg-slate-200 text-slate-600"
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 6. TIMELINE EVENTS LIST (Clean white cards) */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-3" />
            <p className="text-sm font-semibold text-slate-600">Cargando bitácora inmutable...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <Shield className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800">No se encontraron movimientos</h3>
            <p className="text-sm text-slate-500 mt-1">Prueba cambiando los filtros o la búsqueda.</p>
          </div>
        ) : (
          filteredLogs.map(log => {
            const catBadge = getCategoryBadge(log.category);
            const CatIcon = catBadge.icon;
            const isExpanded = expandedLogId === log.id;
            const previousData = log.previousData || (log as any).previous_data;
            const newData = log.newData || (log as any).new_data;
            const hasDiff = Boolean(previousData || newData);
            const entityName = log.entityName || (log as any).entity_name;
            const userName = log.userName || (log as any).user_name;
            const userEmail = log.userEmail || (log as any).user_email;
            const userRole = log.userRole || (log as any).user_role;
            const ipAddress = log.ipAddress || (log as any).ip_address;
            const createdAt = log.createdAt || (log as any).created_at;

            return (
              <div 
                key={log.id}
                className={cn(
                  "bg-white rounded-2xl border p-4 sm:p-5 shadow-xs transition-all hover:border-teal-200",
                  log.category === 'seguridad' ? "border-rose-200" : "border-slate-200/90"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className={cn(
                      "p-2.5 rounded-xl border flex-shrink-0 mt-0.5",
                      catBadge.bg
                    )}>
                      <CatIcon className="w-5 h-5" />
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-md text-[11px] tracking-wide uppercase",
                          getActionBadgeColor(log.action)
                        )}>
                          {log.action}
                        </span>

                        <span className="text-xs font-semibold text-slate-500">
                          • {catBadge.label}
                        </span>

                        {entityName && (
                          <span className="text-xs font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                            [{entityName}]
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                        {log.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 pt-1">
                        <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                          {userName || userEmail || 'Sistema'}
                          {userRole && (
                            <span className="text-[10px] text-slate-400 font-normal">({userRole})</span>
                          )}
                        </span>

                        {userEmail && userEmail !== userName && (
                          <span>{userEmail}</span>
                        )}

                        {ipAddress && (
                          <span className="text-slate-400">IP: {ipAddress}</span>
                        )}

                        <span className="inline-flex items-center gap-1 text-slate-400 ml-auto sm:ml-0 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span title={new Date(createdAt).toLocaleString('es-GT')}>
                            {formatRelativeTime(createdAt)}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {hasDiff && (
                    <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0">
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-teal-50 hover:text-teal-900 text-slate-700 transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-teal-600" />
                        <span>{isExpanded ? 'Ocultar Detalle' : 'Ver Detalle'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>

                {isExpanded && hasDiff && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* Estado Anterior */}
                      <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5">
                        <div className="text-rose-800 font-bold mb-1.5 flex items-center justify-between">
                          <span>Estado Anterior</span>
                          <span className="text-[10px] bg-rose-200/80 text-rose-900 px-1.5 py-0.5 rounded font-black">Antes</span>
                        </div>
                        {previousData ? (
                          <pre className="text-[11px] font-mono text-slate-700 overflow-x-auto p-2 bg-white/90 rounded-lg max-h-48 scrollbar-thin border border-rose-100">
                            {JSON.stringify(previousData, null, 2)}
                          </pre>
                        ) : (
                          <span className="text-slate-400 italic">No existía registro previo (Creación inicial)</span>
                        )}
                      </div>

                      {/* Nuevo Estado */}
                      <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3.5">
                        <div className="text-teal-900 font-bold mb-1.5 flex items-center justify-between">
                          <span>Nuevo Estado</span>
                          <span className="text-[10px] bg-teal-200/80 text-teal-950 px-1.5 py-0.5 rounded font-black">Después</span>
                        </div>
                        {newData ? (
                          <pre className="text-[11px] font-mono text-slate-700 overflow-x-auto p-2 bg-white/90 rounded-lg max-h-48 scrollbar-thin border border-teal-100">
                            {JSON.stringify(newData, null, 2)}
                          </pre>
                        ) : (
                          <span className="text-slate-400 italic">Registro eliminado definitivamente</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>ID Forense: <code className="font-mono text-slate-600">{log.id}</code></span>
                      <span>Registrado: {new Date(createdAt).toISOString()}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 7. PRINTABLE REPORT FOOTER */}
      <div className="hidden print:block text-xs text-slate-500 pt-8 border-t border-slate-300 mt-8">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-bold text-slate-800">AGRICOVET GUATEMALA - REPORTE DE AUDITORÍA & SEGURIDAD FORENSE</p>
            <p>Generado exclusivamente para el Dueño / CEO Emanuel Lima ({user.email})</p>
            <p>Fecha de emisión: {new Date().toLocaleString('es-GT')}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">Firma de Conformidad / Auditoría:</p>
            <div className="w-48 border-b border-slate-700 mt-8 mb-1" />
            <p>Dirección General & Auditoría</p>
          </div>
        </div>
      </div>
    </div>
  );
}
