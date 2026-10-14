import React, { useState, useEffect, useMemo } from 'react';
import { User, AuditLogEntry, AuditStats } from '../types';
import { api } from '../api';
import { 
  Shield, 
  ShieldAlert, 
  Activity, 
  Search, 
  RefreshCw, 
  Download, 
  Printer, 
  Package, 
  Users, 
  ShoppingCart, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Database, 
  Eye, 
  Lock, 
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileText,
  Calendar,
  X
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
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<AuditLogEntry | null>(null);

  const isOwner = user?.email?.toLowerCase().trim() === 'seseffff942@gmail.com';

  const fetchAuditData = async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const res = await api.getAuditLogs({
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: searchTerm || undefined,
        limit: 300
      });

      if (res && res.logs) {
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

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchAuditData(true);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchAuditData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedCategory, searchTerm]);

  // Client-side date filter
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (dateFilter === 'all') return true;
      const logDate = new Date(log.createdAt);
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
          bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
          icon: Package
        };
      case 'clientes':
        return {
          label: 'Clientes',
          bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
          icon: Users
        };
      case 'ventas':
        return {
          label: 'Ventas & Facturas',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
          icon: ShoppingCart
        };
      case 'rutas':
        return {
          label: 'Rutas & GPS',
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
          icon: MapPin
        };
      case 'seguridad':
        return {
          label: 'Seguridad & Alertas',
          bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
          icon: ShieldAlert
        };
      default:
        return {
          label: 'Sistema',
          bg: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-800',
          icon: Activity
        };
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CREATED') || action.includes('PINNED')) {
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300';
    }
    if (action.includes('DELETED') || action.includes('CLEANUP') || action.includes('UNPINNED')) {
      return 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300';
    }
    if (action.includes('STOCK')) {
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300';
    }
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
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
      `"${new Date(l.createdAt).toLocaleString('es-GT')}"`,
      `"${l.category}"`,
      `"${l.action}"`,
      `"${(l.entityName || '').replace(/"/g, '""')}"`,
      `"${(l.userName || '').replace(/"/g, '""')}"`,
      `"${l.userEmail || ''}"`,
      `"${(l.description || '').replace(/"/g, '""')}"`,
      `"${l.ipAddress || ''}"`
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
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 p-3 sm:p-6 lg:p-8 space-y-6">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <Shield className="w-3.5 h-3.5" />
                Control Maestro & Seguridad Exclusivo
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Database className="w-3 h-3 text-emerald-600" />
                PostgreSQL + Copia Espejo
              </span>
              {isOwner && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  <Lock className="w-3 h-3" />
                  Dueño / CEO ({user.email})
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Bitácora de Auditoría & Trazabilidad
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
              Registro inmutable de cada movimiento en tiempo real: creación de clientes (manuales o de prueba), ajustes de stock (±1 unidad), ventas emitidas, fijaciones GPS y auditoría de seguridad forense.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border shadow-xs",
                autoRefresh 
                  ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700" 
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50"
              )}
              title="Actualización automática cada 10 segundos"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", autoRefresh && "animate-spin")} />
              {autoRefresh ? 'En Vivo (10s)' : 'Activar En Vivo'}
            </button>

            <button
              onClick={() => fetchAuditData()}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition-all shadow-xs"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin text-emerald-600")} />
              Actualizar
            </button>

            <button
              onClick={exportToCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition-all shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              Exportar CSV
            </button>

            <button
              onClick={handlePrintReport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir Informe
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Logs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1.5">
            <span>Total Movimientos</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {stats.totalLogs.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-600 font-semibold">+{stats.logs24h}</span> últimas 24h
          </div>
        </div>

        {/* Stock */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1.5">
            <span>Ajustes de Stock</span>
            <Package className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {stats.totalStock.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            ±1 unidad y ventas
          </div>
        </div>

        {/* Clients */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1.5">
            <span>Clientes & Pruebas</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {stats.totalClientes.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Altas, bajas y tests
          </div>
        </div>

        {/* Sales */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1.5">
            <span>Ventas / Folios</span>
            <ShoppingCart className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {stats.totalVentas.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Emisiones y crédito
          </div>
        </div>

        {/* GPS / Routes */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1.5">
            <span>Rutas & Pines GPS</span>
            <MapPin className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {stats.totalRutas.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Checkpoints & fijación
          </div>
        </div>

        {/* Security & Forensic */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1.5">
            <span>Seguridad & Auditoría</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {stats.totalSeguridad.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Previsión GT-1013
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, producto, usuario (ej. ventas1, admin), acción o palabra clave..."
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Date Quick Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setDateFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all",
                dateFilter === 'all' 
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              Histórico
            </button>
            <button
              onClick={() => setDateFilter('today')}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all",
                dateFilter === 'today' 
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              Hoy
            </button>
            <button
              onClick={() => setDateFilter('week')}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all",
                dateFilter === 'week' 
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              Últimos 7 días
            </button>
          </div>
        </div>

        {/* Category Filter Chips */}
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
                "whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border",
                selectedCategory === tab.id
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100"
              )}
            >
              <span>{tab.label}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px]",
                selectedCategory === tab.id
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Events List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Cargando bitácora de auditoría inmutable...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
            <Shield className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">No se encontraron movimientos</h3>
            <p className="text-sm text-slate-500 mt-1">Prueba cambiando los filtros o la búsqueda.</p>
          </div>
        ) : (
          filteredLogs.map(log => {
            const catBadge = getCategoryBadge(log.category);
            const CatIcon = catBadge.icon;
            const isExpanded = expandedLogId === log.id;
            const hasDiff = Boolean(log.previousData || log.newData);

            return (
              <div 
                key={log.id}
                className={cn(
                  "bg-white dark:bg-slate-900 border rounded-2xl transition-all shadow-xs hover:border-slate-300 dark:hover:border-slate-700 overflow-hidden",
                  log.category === 'seguridad' ? "border-rose-200 dark:border-rose-900/50" : "border-slate-200/90 dark:border-slate-800"
                )}
              >
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Left details */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Category Icon */}
                      <div className={cn(
                        "p-2.5 rounded-xl border flex-shrink-0 mt-0.5",
                        catBadge.bg
                      )}>
                        <CatIcon className="w-5 h-5" />
                      </div>

                      {/* Content */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Action Badge */}
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase",
                            getActionBadgeColor(log.action)
                          )}>
                            {log.action}
                          </span>

                          {/* Category Tag */}
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            • {catBadge.label}
                          </span>

                          {/* Entity Name */}
                          {log.entityName && (
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                              [{log.entityName}]
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                          {log.description}
                        </p>

                        {/* Metadata row: User, IP, Timestamp */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-1">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            {log.userName || log.userEmail || 'Sistema'}
                            {log.userRole && (
                              <span className="text-[10px] text-slate-400">({log.userRole})</span>
                            )}
                          </span>

                          {log.userEmail && log.userEmail !== log.userName && (
                            <span>{log.userEmail}</span>
                          )}

                          {log.ipAddress && (
                            <span className="text-slate-400">IP: {log.ipAddress}</span>
                          )}

                          <span className="inline-flex items-center gap-1 text-slate-400 ml-auto sm:ml-0">
                            <Clock className="w-3.5 h-3.5" />
                            <span title={new Date(log.createdAt).toLocaleString('es-GT')}>
                              {formatRelativeTime(log.createdAt)}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right side expand/detail button */}
                    {hasDiff && (
                      <div className="flex sm:flex-col items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0">
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{isExpanded ? 'Ocultar Detalle' : 'Ver Detalle'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Expandable Technical Diff */}
                  {isExpanded && hasDiff && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {/* Previous State */}
                        <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3.5">
                          <div className="text-rose-700 dark:text-rose-400 font-bold mb-1.5 flex items-center justify-between">
                            <span>Estado Anterior</span>
                            <span className="text-[10px] bg-rose-200/60 dark:bg-rose-900 px-1.5 py-0.5 rounded">Antes</span>
                          </div>
                          {log.previousData ? (
                            <pre className="text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto p-2 bg-white/70 dark:bg-slate-900/80 rounded-lg max-h-48 scrollbar-thin">
                              {JSON.stringify(log.previousData, null, 2)}
                            </pre>
                          ) : (
                            <span className="text-slate-400 italic">No existía registro previo (Creación inicial)</span>
                          )}
                        </div>

                        {/* New State */}
                        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-3.5">
                          <div className="text-emerald-700 dark:text-emerald-400 font-bold mb-1.5 flex items-center justify-between">
                            <span>Nuevo Estado</span>
                            <span className="text-[10px] bg-emerald-200/60 dark:bg-emerald-900 px-1.5 py-0.5 rounded">Después</span>
                          </div>
                          {log.newData ? (
                            <pre className="text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto p-2 bg-white/70 dark:bg-slate-900/80 rounded-lg max-h-48 scrollbar-thin">
                              {JSON.stringify(log.newData, null, 2)}
                            </pre>
                          ) : (
                            <span className="text-slate-400 italic">Registro eliminado definitivamente</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span>ID Forense: <code className="font-mono text-slate-600 dark:text-slate-300">{log.id}</code></span>
                        <span>Registrado: {new Date(log.createdAt).toISOString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Printable Report Footer (only visible when printing) */}
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
