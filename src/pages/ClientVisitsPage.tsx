import React, { useState, useEffect, useMemo } from 'react';
import { Client, ClientVisit, User, VisitStats, VisitType } from '../types';
import { api } from '../api';
import { ClientVisitsMap } from '../components/ClientVisitsMap';
import { MarkClientModal } from '../components/MarkClientModal';
import { RegisterVisitModal } from '../components/RegisterVisitModal';
import { 
  MapPin, Navigation, Compass, Calendar, Clock, 
  Users, CheckCircle2, AlertTriangle, RefreshCw, 
  Search, Filter, ExternalLink, Phone, Building2, 
  DollarSign, ShoppingCart, UserPlus, Package, 
  ClipboardCheck, Sparkles, ChevronRight, ArrowUpRight, ArrowRight, TrendingUp, AlertCircle, Plus, Layers, Activity,
  Download, FileSpreadsheet, Check, ShieldAlert, ArrowDownRight, Tag, Share2
} from 'lucide-react';
import { cn, fechaDDMMYYYY, normalizeSearchText, isTodayGuatemala, getGuatemalaTodayIso } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

interface ClientVisitsPageProps {
  user: User;
  isMobile?: boolean;
}

export function ClientVisitsPage({ user, isMobile }: ClientVisitsPageProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [visits, setVisits] = useState<ClientVisit[]>([]);
  const [stats, setStats] = useState<VisitStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // GPS State
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Modals State
  const [isMarkModalOpen, setIsMarkModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedClientForVisit, setSelectedClientForVisit] = useState<Client | null>(null);

  // Active View Tabs & Filters
  const [activeTab, setActiveTab] = useState<'my_portfolio' | 'timeline' | 'frequency' | 'sellers'>('my_portfolio');
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>(user.role === 'seller' ? user.email || user.id : 'all');
  const [selectedVisitTypeFilter, setSelectedVisitTypeFilter] = useState<string>('all');
  const [selectedDateRangeFilter, setSelectedDateRangeFilter] = useState<'all' | 'today' | '7days' | 'month'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState<'all' | 'urgent' | 'regular' | 'never'>('all');
  const [portfolioScope, setPortfolioScope] = useState<'mine' | 'all'>(user.role === 'seller' ? 'mine' : 'all');

  // Request & Watch GPS Location
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Tu dispositivo no soporta geolocalización GPS.');
      return;
    }

    setIsGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setIsGpsLoading(false);
      },
      (error) => {
        let msg = 'No se pudo obtener la ubicación GPS.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Permiso de ubicación denegado. Activa el GPS en los ajustes de tu navegador.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Señal GPS no disponible temporalmente.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Tiempo de espera agotado al obtener el GPS.';
        }
        setGpsError(msg);
        setIsGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000
      }
    );
  };

  // Initial Data Fetch
  const loadData = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    try {
      const [clientsData, visitsData, statsData] = await Promise.all([
        api.getClients(),
        api.getVisits(),
        api.getVisitStats()
      ]);

      setClients(clientsData || []);
      setVisits(visitsData || []);
      setStats(statsData || null);
    } catch (e) {
      console.error('Error loading visits data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    requestLocation();

    let watchId: number | null = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setCurrentLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000 }
      );
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const handleClientMarked = (updatedClient: Client) => {
    setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
    loadData(true);
  };

  const handleVisitRegistered = (newVisit: ClientVisit) => {
    setVisits(prev => [newVisit, ...prev]);
    loadData(true);
  };

  const handleSelectClientForVisit = (client: Client) => {
    setSelectedClientForVisit(client);
    setIsRegisterModalOpen(true);
  };

  // Frequency and Client Portfolio Analysis
  const clientPortfolioWithStatus = useMemo(() => {
    const now = new Date().getTime();
    const map = new Map<string, ClientVisit>();

    visits.forEach(v => {
      if (v.clientId && !map.has(v.clientId)) {
        map.set(v.clientId, v);
      }
    });

    const term = normalizeSearchText(searchTerm);

    return clients.map(client => {
      const lastVisit = map.get(client.id);
      const daysElapsed = lastVisit 
        ? Math.max(0, Math.floor((now - new Date(lastVisit.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      let status: 'today' | 'recent' | 'attention' | 'urgent' | 'never' = 'never';
      if (daysElapsed === null) status = 'never';
      else if (daysElapsed === 0 || (lastVisit && isTodayGuatemala(lastVisit.createdAt))) status = 'today';
      else if (daysElapsed <= 7) status = 'recent';
      else if (daysElapsed <= 15) status = 'attention';
      else status = 'urgent';

      // Distance calculation to current GPS
      let distanceKm: number | null = null;
      if (currentLocation && client.latitude && client.longitude) {
        const R = 6371; // km
        const dLat = ((client.latitude - currentLocation.latitude) * Math.PI) / 180;
        const dLon = ((client.longitude - currentLocation.longitude) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos((currentLocation.latitude * Math.PI) / 180) * 
                  Math.cos((client.latitude * Math.PI) / 180) * 
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distanceKm = Math.round(R * c * 10) / 10;
      }

      // Check if assigned to current user
      const isAssignedToUser = 
        client.sellerId === user.id || 
        client.sellerId === user.email || 
        (client as any).sellerEmail === user.email ||
        (user.role === 'admin');

      return {
        ...client,
        lastVisit,
        daysElapsed,
        status,
        distanceKm,
        isAssignedToUser
      };
    }).filter(c => {
      // Filter by portfolio scope (mine vs all)
      if (portfolioScope === 'mine' && user.role === 'seller' && !c.isAssignedToUser) {
        return false;
      }

      if (term) {
        const matches = normalizeSearchText(c.name || '').includes(term) ||
                        normalizeSearchText(c.clientCode || '').includes(term) ||
                        normalizeSearchText(c.phone || '').includes(term) ||
                        normalizeSearchText(c.address || '').includes(term) ||
                        normalizeSearchText(c.companyName || '').includes(term);
        if (!matches) return false;
      }

      if (frequencyFilter === 'urgent') return c.status === 'urgent';
      if (frequencyFilter === 'regular') return c.status === 'today' || c.status === 'recent';
      if (frequencyFilter === 'never') return c.status === 'never';

      return true;
    }).sort((a, b) => {
      // Urgent and unvisited clients first
      if (a.daysElapsed === null && b.daysElapsed === null) return 0;
      if (a.daysElapsed === null) return -1;
      if (b.daysElapsed === null) return 1;
      return b.daysElapsed - a.daysElapsed;
    });
  }, [clients, visits, searchTerm, frequencyFilter, portfolioScope, currentLocation, user]);

  // Filtered Visits
  const filteredVisits = useMemo(() => {
    const term = normalizeSearchText(searchTerm);
    const now = new Date().getTime();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const todayIso = getGuatemalaTodayIso();
    const monthPrefix = todayIso.substring(0, 7);

    return visits.filter(v => {
      if (selectedSellerFilter !== 'all') {
        const matchesSeller = v.sellerId === selectedSellerFilter || v.sellerEmail === selectedSellerFilter || v.sellerName === selectedSellerFilter;
        if (!matchesSeller) return false;
      }

      if (selectedVisitTypeFilter !== 'all' && v.visitType !== selectedVisitTypeFilter) {
        return false;
      }

      if (selectedDateRangeFilter === 'today' && !isTodayGuatemala(v.createdAt)) {
        return false;
      }

      if (selectedDateRangeFilter === '7days') {
        const vTime = new Date(v.createdAt).getTime();
        if (now - vTime > SEVEN_DAYS_MS) return false;
      }

      if (selectedDateRangeFilter === 'month') {
        const vDate = (v.createdAt || '').split('T')[0];
        if (!vDate.startsWith(monthPrefix)) return false;
      }

      if (term) {
        const matchesTerm = normalizeSearchText(v.clientName || '').includes(term) ||
                            normalizeSearchText(v.clientCode || '').includes(term) ||
                            normalizeSearchText(v.sellerName || '').includes(term) ||
                            normalizeSearchText(v.notes || '').includes(term);
        if (!matchesTerm) return false;
      }
      return true;
    });
  }, [visits, selectedSellerFilter, selectedVisitTypeFilter, selectedDateRangeFilter, searchTerm]);

  const availableSellers = useMemo(() => {
    const set = new Map<string, string>();
    visits.forEach(v => {
      if (v.sellerId && v.sellerName) set.set(v.sellerId, v.sellerName);
    });
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [visits]);

  // Export to Excel handler
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Checkpoints
    const visitsData = filteredVisits.map(v => ({
      'ID Visita': v.id,
      'Cliente': v.clientName,
      'Código Cliente': v.clientCode || 'N/A',
      'Empresa': v.companyName || 'N/A',
      'Vendedor': v.sellerName,
      'Tipo de Visita': v.visitType ? v.visitType.toUpperCase() : 'RUTINA',
      'Distancia al Local': v.distanceMeters !== undefined ? `${v.distanceMeters} metros` : 'No registrada',
      'Fecha': fechaDDMMYYYY(v.createdAt),
      'Hora': new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      'Foto Comprobante': v.photoUrl ? 'SÍ' : 'NO',
      'Notas / Observaciones': v.notes || '',
      'Latitud': v.latitude,
      'Longitud': v.longitude,
      'Enlace Google Maps': `https://www.google.com/maps/search/?api=1&query=${v.latitude},${v.longitude}`
    }));
    const wsVisits = XLSX.utils.json_to_sheet(visitsData);
    XLSX.utils.book_append_sheet(wb, wsVisits, 'Checkpoints_Visitas');

    // Sheet 2: Cartera de Clientes & Frecuencia
    const portfolioData = clientPortfolioWithStatus.map(c => ({
      'Cliente': c.name,
      'Código': c.clientCode || 'N/A',
      'Empresa': c.companyName || 'N/A',
      'Teléfono': c.phone || 'N/A',
      'Ubicación / Dirección': c.address || 'N/A',
      'Estado de Visita': c.status === 'today' ? 'Visitado Hoy' : c.status === 'recent' ? 'Al día (<7d)' : c.status === 'attention' ? 'Atención (8-15d)' : c.status === 'urgent' ? 'Urgente (>15d)' : 'Nunca Visitado',
      'Días sin Visita': c.daysElapsed !== null ? c.daysElapsed : 'Nunca Visitado',
      'Fecha Última Visita': c.lastVisit ? fechaDDMMYYYY(c.lastVisit.createdAt) : 'Sin registro',
      'Tiene Coordenadas GPS': (c.latitude && c.longitude) ? 'SÍ' : 'NO',
      'Latitud': c.latitude || '',
      'Longitud': c.longitude || '',
      'Distancia a mi Posición (km)': c.distanceKm !== null ? `${c.distanceKm} km` : 'Sin GPS'
    }));
    const wsPortfolio = XLSX.utils.json_to_sheet(portfolioData);
    XLSX.utils.book_append_sheet(wb, wsPortfolio, 'Cartera_Clientes_Frecuencia');

    // Download File
    const todayStr = getGuatemalaTodayIso();
    XLSX.writeFile(wb, `Reporte_Visitas_Y_Cartera_Agricovet_${todayStr}.xlsx`);
  };

  const renderVisitBadge = (type: string) => {
    switch (type) {
      case 'cobro':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">💰 Cobro</span>;
      case 'pedido':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200/60">🛒 Pedido</span>;
      case 'prospeccion':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/60">🤝 Prospección</span>;
      case 'entrega':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60">📦 Entrega</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">📋 Rutina</span>;
    }
  };

  const geotaggedCount = clients.filter(c => c.latitude && c.longitude).length;
  const geotaggedPercentage = clients.length > 0 ? Math.round((geotaggedCount / clients.length) * 100) : 0;
  const todayVisitsCount = stats?.totalVisitsToday ?? visits.filter(v => isTodayGuatemala(v.createdAt)).length;
  const urgentClientsCount = clientPortfolioWithStatus.filter(c => c.status === 'urgent' || c.status === 'never').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[450px] bg-slate-50 font-sans">
        <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-500 font-manrope">Cargando rutas, cartera y productos...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col space-y-6 bg-slate-50/70 min-h-screen pb-24 font-sans">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-teal-100 text-teal-800 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              Módulo de Campo & Rutas
            </span>
            <span className="text-xs font-semibold text-slate-400">Guatemala</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight font-manrope">
            Visitas a Clientes & Checkpoints
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Seguimiento de visitas en tiempo real, cartera de clientes con ubicación, supervisión de frecuencia y recomendación de productos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 active:scale-95 px-3.5 py-3 rounded-xl font-bold transition-all shadow-xs text-xs cursor-pointer"
            title="Exportar reporte de visitas y cartera a Excel"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" />
            <span>Excel</span>
          </button>

          <button 
            type="button"
            onClick={() => setIsMarkModalOpen(true)}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 active:scale-95 px-4 py-3 rounded-xl font-bold transition-all shadow-xs text-xs cursor-pointer"
            title="Marcar coordenadas GPS del cliente donde estás parado"
          >
            <MapPin size={16} className="text-teal-600" />
            <span>Marcar Cliente Aquí</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              setSelectedClientForVisit(null);
              setIsRegisterModalOpen(true);
            }}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-md shadow-teal-600/10 text-xs cursor-pointer"
          >
            <Plus size={18} />
            <span>Registrar Checkpoint</span>
          </button>

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer shadow-xs active:scale-95"
            title="Actualizar datos"
          >
            <RefreshCw size={16} className={cn(refreshing && "animate-spin text-teal-600")} />
          </button>
        </div>
      </div>

      {/* GPS LIVE STATUS BAR */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center">
            <div className={cn(
              "w-3 h-3 rounded-full",
              currentLocation ? "bg-emerald-500" : gpsError ? "bg-rose-500" : "bg-amber-500 animate-ping"
            )} />
            {currentLocation && (
              <div className="absolute w-6 h-6 rounded-full bg-emerald-500/20 animate-ping" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800">
              {currentLocation ? "GPS Conectado:" : gpsError ? "Alerta GPS:" : "Sincronizando GPS..."}
            </span>
            {currentLocation ? (
              <span className="font-mono text-[11px] bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-200 text-slate-700">
                {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                {currentLocation.accuracy && <span className="text-teal-700 font-semibold ml-1.5">(±{Math.round(currentLocation.accuracy)}m)</span>}
              </span>
            ) : (
              <span className="text-slate-500">{gpsError || "Buscando coordenadas satelitales..."}</span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={requestLocation}
          disabled={isGpsLoading}
          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <Navigation size={13} className={cn(isGpsLoading && "animate-spin text-teal-600")} />
          <span>{isGpsLoading ? "Obteniendo..." : "Actualizar GPS"}</span>
        </button>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 lg:gap-5">
        {/* Card 1 */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Visitas de Hoy</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Calendar size={16} />
            </div>
          </div>
          <h4 className="text-2xl font-black text-slate-950">{todayVisitsCount}</h4>
          <p className="text-xs text-emerald-600 mt-1 font-semibold flex items-center gap-1">
            <Sparkles size={12} /> Checkpoints registrados
          </p>
        </motion.div>

        {/* Card 2 */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Clientes con GPS</span>
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
              <MapPin size={16} />
            </div>
          </div>
          <h4 className="text-2xl font-black text-slate-950">
            {geotaggedCount} <span className="text-sm font-semibold text-slate-400">/ {clients.length}</span>
          </h4>
          <p className="text-xs text-teal-600 mt-1 font-semibold">
            {geotaggedPercentage}% de cobertura fijada
          </p>
        </motion.div>

        {/* Card 3 */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Radar &gt;15 Días</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <AlertTriangle size={16} />
            </div>
          </div>
          <h4 className="text-2xl font-black text-rose-600">{urgentClientsCount}</h4>
          <p className="text-xs text-rose-500 mt-1 font-semibold">
            Requieren atención prioritaria
          </p>
        </motion.div>
      </div>

      {/* MAP SECTION */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-teal-600" />
            <h2 className="text-base font-black text-slate-900 font-manrope">Mapa Satelital de Rutas</h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">Toca cualquier pin para ver opciones y navegación</span>
        </div>

        <ClientVisitsMap
          clients={clients}
          visits={visits}
          currentLocation={currentLocation}
          currentUser={user}
          onSelectClientForVisit={handleSelectClientForVisit}
          onOpenMarkClientModal={() => setIsMarkModalOpen(true)}
          onOpenRegisterVisitModal={() => {
            setSelectedClientForVisit(null);
            setIsRegisterModalOpen(true);
          }}
          onRefreshGps={requestLocation}
          isGpsLoading={isGpsLoading}
        />
      </div>

      {/* CONTROL & SUPERVISION TABS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Navigation Tabs Bar */}
        <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          {/* Segmented Tab Buttons */}
          <div className="flex items-center bg-slate-200/70 p-1 rounded-xl flex-nowrap overflow-x-auto hide-scrollbar gap-1 max-w-full shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('my_portfolio')}
              className={cn(
                "px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0",
                activeTab === 'my_portfolio' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              👥 Cartera & Frecuencia ({clientPortfolioWithStatus.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={cn(
                "px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0",
                activeTab === 'timeline' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              🕒 Checkpoints ({filteredVisits.length})
            </button>
            {user.role === 'admin' && (
              <button
                type="button"
                onClick={() => setActiveTab('sellers')}
                className={cn(
                  "px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0",
                  activeTab === 'sellers' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                📊 Vendedores & Ranking
              </button>
            )}
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Buscar cliente, código, dirección..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium placeholder:text-slate-400"
              />
            </div>

            {/* Scope Filter for Sellers (My Clients vs All) */}
            {activeTab === 'my_portfolio' && user.role === 'seller' && (
              <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPortfolioScope('mine')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                    portfolioScope === 'mine' ? "bg-teal-600 text-white" : "text-slate-600"
                  )}
                >
                  Mis Asignados
                </button>
                <button
                  type="button"
                  onClick={() => setPortfolioScope('all')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-colors cursor-pointer",
                    portfolioScope === 'all' ? "bg-teal-600 text-white" : "text-slate-600"
                  )}
                >
                  Toda la Cartera
                </button>
              </div>
            )}

            {/* Date Range Filter */}
            {activeTab === 'timeline' && (
              <select
                value={selectedDateRangeFilter}
                onChange={(e) => setSelectedDateRangeFilter(e.target.value as any)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
              >
                <option value="all">Todas las Fechas</option>
                <option value="today">Solo Hoy</option>
                <option value="7days">Últimos 7 Días</option>
                <option value="month">Este Mes</option>
              </select>
            )}

            {user.role === 'admin' && availableSellers.length > 0 && (
              <select
                value={selectedSellerFilter}
                onChange={(e) => setSelectedSellerFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
              >
                <option value="all">Todos los Asesores</option>
                {availableSellers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}

            {activeTab === 'my_portfolio' && (
              <select
                value={frequencyFilter}
                onChange={(e) => setFrequencyFilter(e.target.value as any)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
              >
                <option value="all">Todo el Estado</option>
                <option value="urgent">🔴 Urgentes (&gt;15 días)</option>
                <option value="regular">🟢 Al día (&lt;7 días)</option>
                <option value="never">⚪ Sin visitas registradas</option>
              </select>
            )}
          </div>
        </div>

        {/* TAB 1: MY PORTFOLIO WITH LOCATION & TIME SINCE LAST VISIT */}
        {activeTab === 'my_portfolio' && (
          <div className="p-4 md:p-5 divide-y divide-slate-100">
            {clientPortfolioWithStatus.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Users className="mx-auto text-slate-300 mb-2" size={36} />
                <p className="font-bold text-slate-700 text-sm">No se encontraron clientes coincidentes</p>
                <p className="text-xs text-slate-400 mt-0.5">Ajusta los filtros de búsqueda</p>
              </div>
            ) : (
              clientPortfolioWithStatus.map((client) => {
                const hasGps = client.latitude && client.longitude;
                const mapsLink = hasGps 
                  ? `https://www.google.com/maps/dir/?api=1&destination=${client.latitude},${client.longitude}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address || client.name)}`;
                const wazeLink = hasGps
                  ? `https://waze.com/ul?ll=${client.latitude},${client.longitude}&navigate=yes`
                  : null;

                return (
                  <div key={client.id} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 px-2 rounded-xl transition-colors">
                    {/* Client Main Info & Location */}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{client.name}</span>
                        {client.clientCode && (
                          <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            #{client.clientCode}
                          </span>
                        )}
                        {hasGps ? (
                          <span className="text-[9px] font-bold bg-teal-50 text-teal-700 border border-teal-200/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <MapPin size={10} /> Con GPS Fijado
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">
                            Sin GPS
                          </span>
                        )}
                        {client.distanceKm !== null && (
                          <span className="text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                            📍 a {client.distanceKm} km de ti
                          </span>
                        )}
                      </div>

                      {/* Physical Address & Location */}
                      <div className="text-xs text-slate-600 space-y-0.5">
                        {client.companyName && (
                          <p className="font-medium text-slate-700 flex items-center gap-1.5">
                            <Building2 size={12} className="text-slate-400" />
                            {client.companyName}
                          </p>
                        )}
                        {client.address && (
                          <p className="text-slate-500 flex items-center gap-1.5">
                            <MapPin size={12} className="text-teal-600 shrink-0" />
                            <span className="font-medium text-slate-700">{client.address}</span>
                          </p>
                        )}
                      </div>

                      {/* Phone Dialer */}
                      {client.phone && (
                        <div className="flex items-center gap-2 text-xs">
                          <Phone size={12} className="text-slate-400" />
                          <a href={`tel:${client.phone}`} className="text-teal-700 font-bold hover:underline">
                            {client.phone}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Time Since Last Visit Status & Direct Actions */}
                    <div className="flex flex-wrap items-center gap-3 self-start md:self-center shrink-0">
                      {/* Urgency Badge */}
                      <div className="text-right">
                        {client.daysElapsed === null ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            ⚪ Nunca visitado
                          </span>
                        ) : client.daysElapsed === 0 ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            🟢 Visitado hoy
                          </span>
                        ) : client.daysElapsed <= 7 ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                            🟢 Hace {client.daysElapsed} días
                          </span>
                        ) : client.daysElapsed <= 15 ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            🟡 Hace {client.daysElapsed} días
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-800 border border-rose-200 animate-pulse">
                            🔴 ¡Hace {client.daysElapsed} días!
                          </span>
                        )}
                      </div>

                      {/* Action: Register Visit */}
                      <button
                        type="button"
                        onClick={() => handleSelectClientForVisit(client)}
                        className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 flex items-center gap-1"
                      >
                        <ClipboardCheck size={14} />
                        <span>Visitar</span>
                      </button>

                      {/* Action: Open in Maps */}
                      <a
                        href={mapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs transition-colors"
                        title="Abrir ruta en Google Maps"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: LIVE CHECKPOINTS FEED */}
        {activeTab === 'timeline' && (
          <div>
            {/* Visit Type Filter Pills */}
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/30 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Tipo:</span>
              {[
                { id: 'all', label: 'Todos' },
                { id: 'cobro', label: '💰 Cobros' },
                { id: 'pedido', label: '🛒 Pedidos' },
                { id: 'rutina', label: '📋 Rutina' },
                { id: 'prospeccion', label: '🤝 Prospección' },
                { id: 'entrega', label: '📦 Entregas' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedVisitTypeFilter(f.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    selectedVisitTypeFilter === f.id
                      ? "bg-teal-600 text-white shadow-2xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Timeline List */}
            <div className="p-4 md:p-5 divide-y divide-slate-100">
              {filteredVisits.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <Clock className="mx-auto text-slate-300" size={36} />
                  <p className="font-bold text-slate-700 text-sm">No hay checkpoints registrados con los filtros seleccionados</p>
                  <p className="text-xs text-slate-400">Registra el primer checkpoint de visita tocando "Registrar Checkpoint"</p>
                </div>
              ) : (
                filteredVisits.map((visit) => {
                  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${visit.latitude},${visit.longitude}`;
                  return (
                    <div key={visit.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors">
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-teal-50 text-teal-700 rounded-xl shrink-0 mt-0.5">
                          <MapPin size={17} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{visit.clientName}</span>
                            {visit.clientCode && (
                              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                #{visit.clientCode}
                              </span>
                            )}
                            {renderVisitBadge(visit.visitType)}
                            {visit.distanceMeters !== undefined && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                                📍 a {visit.distanceMeters}m del local
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span className="font-medium text-slate-700">👤 {visit.sellerName}</span>
                            <span className="flex items-center gap-1 text-slate-400">
                              <Clock size={12} />
                              {fechaDDMMYYYY(visit.createdAt)} {new Date(visit.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">
                              {visit.latitude.toFixed(5)}, {visit.longitude.toFixed(5)}
                            </span>
                          </div>

                          {visit.notes && (
                            <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl mt-1 border border-slate-100 font-medium">
                              📝 {visit.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        {visit.photoUrl && (
                          <a 
                            href={visit.photoUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-10 h-10 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-2xs hover:scale-105 transition-transform"
                            title="Ver foto de comprobante"
                          >
                            <img src={visit.photoUrl} alt="Foto" className="w-full h-full object-cover" />
                          </a>
                        )}
                        <a
                          href={googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-800 rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-200 transition-colors"
                        >
                          <ExternalLink size={13} />
                          <span>Ver en Maps</span>
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 4: SELLERS RANKING */}
        {activeTab === 'sellers' && user.role === 'admin' && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats?.sellerRankings && stats.sellerRankings.length > 0 ? (
              stats.sellerRankings.map((seller, idx) => (
                <div 
                  key={seller.sellerId}
                  className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-teal-300 transition-all shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-600 text-white font-black flex items-center justify-center text-sm shadow-xs">
                        #{idx + 1}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{seller.sellerName}</h4>
                        <p className="text-[11px] text-slate-400">Asesor de Campo</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-center">
                    <div className="p-2 bg-white rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Hoy</span>
                      <span className="text-lg font-black text-emerald-700">{seller.todayVisits}</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Este Mes</span>
                      <span className="text-lg font-black text-teal-800">{seller.monthVisits}</span>
                    </div>
                  </div>

                  {seller.lastVisitAt && (
                    <p className="text-[10px] text-slate-400 text-center">
                      Último checkpoint: {fechaDDMMYYYY(seller.lastVisitAt)} {new Date(seller.lastVisitAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-slate-400">
                <p className="font-bold text-sm">Sin datos de ranking aún</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <MarkClientModal
        isOpen={isMarkModalOpen}
        onClose={() => setIsMarkModalOpen(false)}
        clients={clients}
        currentLocation={currentLocation}
        currentUser={user}
        onClientMarked={handleClientMarked}
      />

      <RegisterVisitModal
        isOpen={isRegisterModalOpen}
        onClose={() => {
          setIsRegisterModalOpen(false);
          setSelectedClientForVisit(null);
        }}
        clients={clients}
        currentLocation={currentLocation}
        currentUser={user}
        onVisitRegistered={handleVisitRegistered}
        preselectedClient={selectedClientForVisit}
      />
    </div>
  );
}
