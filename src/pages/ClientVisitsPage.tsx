import React, { useState, useEffect, useMemo } from 'react';
import { Client, ClientVisit, User, VisitStats } from '../types';
import { api } from '../api';
import { ClientVisitsMap } from '../components/ClientVisitsMap';
import { MarkClientModal } from '../components/MarkClientModal';
import { RegisterVisitModal } from '../components/RegisterVisitModal';
import { 
  MapPin, Navigation, Compass, Calendar, Clock, 
  Users, CheckCircle2, AlertTriangle, RefreshCw, 
  Search, Filter, ExternalLink, Phone, Building2, 
  DollarSign, ShoppingCart, UserPlus, Package, 
  ClipboardCheck, Sparkles, ChevronRight, ArrowUpRight, TrendingUp, AlertCircle, Plus, Layers, Activity
} from 'lucide-react';
import { cn, fechaDDMMYYYY, normalizeSearchText, isTodayGuatemala } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

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
  const [activeTab, setActiveTab] = useState<'timeline' | 'frequency' | 'sellers'>('timeline');
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState<'all' | 'urgent' | 'regular' | 'never'>('all');

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

  // Filtered Visits
  const filteredVisits = useMemo(() => {
    const term = normalizeSearchText(searchTerm);
    return visits.filter(v => {
      if (selectedSellerFilter !== 'all') {
        const matchesSeller = v.sellerId === selectedSellerFilter || v.sellerEmail === selectedSellerFilter || v.sellerName === selectedSellerFilter;
        if (!matchesSeller) return false;
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
  }, [visits, selectedSellerFilter, searchTerm]);

  // Frequency Analysis
  const clientFrequencyList = useMemo(() => {
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

      return {
        ...client,
        lastVisit,
        daysElapsed,
        status
      };
    }).filter(c => {
      if (term) {
        const matches = normalizeSearchText(c.name || '').includes(term) ||
                        normalizeSearchText(c.clientCode || '').includes(term) ||
                        normalizeSearchText(c.phone || '').includes(term) ||
                        normalizeSearchText(c.companyName || '').includes(term);
        if (!matches) return false;
      }
      if (frequencyFilter === 'urgent') return c.status === 'urgent';
      if (frequencyFilter === 'regular') return c.status === 'today' || c.status === 'recent';
      if (frequencyFilter === 'never') return c.status === 'never';
      return true;
    }).sort((a, b) => {
      if (a.daysElapsed === null && b.daysElapsed === null) return 0;
      if (a.daysElapsed === null) return -1;
      if (b.daysElapsed === null) return 1;
      return b.daysElapsed - a.daysElapsed;
    });
  }, [clients, visits, searchTerm, frequencyFilter]);

  const availableSellers = useMemo(() => {
    const set = new Map<string, string>();
    visits.forEach(v => {
      if (v.sellerId && v.sellerName) set.set(v.sellerId, v.sellerName);
    });
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [visits]);

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
  const todayVisitsCount = stats?.totalVisitsToday ?? visits.filter(v => (v.createdAt || '').startsWith(new Date().toISOString().split('T')[0])).length;
  const urgentClientsCount = clientFrequencyList.filter(c => c.status === 'urgent' || c.status === 'never').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[450px] bg-slate-50">
        <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-500 font-manrope">Cargando rutas y mapa de visitas...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col space-y-6 bg-slate-50/70 min-h-screen pb-24">
      
      {/* HEADER SECTION (Matching ClientsPage & DailySalesPage style) */}
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
            Seguimiento de visitas en tiempo real, geolocalización satelital y supervisión de frecuencia.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setIsMarkModalOpen(true)}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 active:scale-95 px-4 py-3 rounded-xl font-bold transition-all shadow-xs text-xs cursor-pointer"
            title="Marcar coordenadas GPS del cliente donde estás parado"
          >
            <MapPin size={16} className="text-teal-600" />
            <span>Marcar Cliente Aquí</span>
          </button>

          <button 
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
          onClick={requestLocation}
          disabled={isGpsLoading}
          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <Navigation size={13} className={cn(isGpsLoading && "animate-spin text-teal-600")} />
          <span>{isGpsLoading ? "Obteniendo..." : "Actualizar GPS"}</span>
        </button>
      </div>

      {/* METRICS ROW (Matching Portfolio Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Visitas del Mes</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingUp size={16} />
            </div>
          </div>
          <h4 className="text-2xl font-black text-slate-950">
            {stats?.totalVisitsMonth ?? visits.length}
          </h4>
          <p className="text-xs text-blue-600 mt-1 font-semibold">
            {stats?.activeSellersCount ?? availableSellers.length} vendedores en ruta
          </p>
        </motion.div>

        {/* Card 4 */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
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
          <div className="flex items-center bg-slate-200/70 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('timeline')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === 'timeline' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              🕒 Checkpoints en Vivo ({filteredVisits.length})
            </button>
            <button
              onClick={() => setActiveTab('frequency')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === 'frequency' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              🎯 Radar de Frecuencia ({clientFrequencyList.length})
            </button>
            {user.role === 'admin' && (
              <button
                onClick={() => setActiveTab('sellers')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
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
                placeholder="Buscar cliente o vendedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium placeholder:text-slate-400"
              />
            </div>

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

            {activeTab === 'frequency' && (
              <select
                value={frequencyFilter}
                onChange={(e) => setFrequencyFilter(e.target.value as any)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
              >
                <option value="all">Toda la Cartera</option>
                <option value="urgent">🔴 Urgentes (&gt;15 días)</option>
                <option value="regular">🟢 Al día (&lt;7 días)</option>
                <option value="never">⚪ Sin visitas</option>
              </select>
            )}
          </div>
        </div>

        {/* Tab 1: Live Timeline Feed */}
        {activeTab === 'timeline' && (
          <div className="p-4 md:p-5 divide-y divide-slate-100">
            {filteredVisits.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Clock className="mx-auto text-slate-300" size={36} />
                <p className="font-bold text-slate-700 text-sm">No hay checkpoints registrados</p>
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
                          className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 hover:scale-105 transition-transform"
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
        )}

        {/* Tab 2: Frequency Radar */}
        {activeTab === 'frequency' && (
          <div className="p-4 md:p-5 divide-y divide-slate-100">
            {clientFrequencyList.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Users className="mx-auto text-slate-300 mb-2" size={36} />
                <p className="font-bold text-slate-700 text-sm">No hay clientes coincidentes</p>
              </div>
            ) : (
              clientFrequencyList.map((client) => {
                const hasGps = client.latitude && client.longitude;
                const mapsLink = hasGps 
                  ? `https://www.google.com/maps/dir/?api=1&destination=${client.latitude},${client.longitude}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address || client.name)}`;

                return (
                  <div key={client.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{client.name}</span>
                        {client.clientCode && (
                          <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            #{client.clientCode}
                          </span>
                        )}
                        {hasGps ? (
                          <span className="text-[9px] font-bold bg-teal-50 text-teal-700 border border-teal-200/60 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <MapPin size={9} /> GPS Listo
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">
                            Sin GPS
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        {client.companyName && (
                          <span className="font-medium text-slate-700">🏢 {client.companyName}</span>
                        )}
                        {client.phone && (
                          <span>📞 {client.phone}</span>
                        )}
                        {client.address && (
                          <span className="text-slate-400 truncate max-w-xs">{client.address}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-right">
                        {client.daysElapsed === null ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            ⚪ Nunca visitado
                          </span>
                        ) : client.daysElapsed === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            🟢 Visitado hoy
                          </span>
                        ) : client.daysElapsed <= 7 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                            🟢 Hace {client.daysElapsed} días
                          </span>
                        ) : client.daysElapsed <= 15 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            🟡 Hace {client.daysElapsed} días
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            🔴 ¡{client.daysElapsed} días sin visita!
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleSelectClientForVisit(client)}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        📌 Visitar
                      </button>

                      <a
                        href={mapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs transition-colors"
                        title="Abrir en Google Maps"
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

        {/* Tab 3: Sellers Ranking */}
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
