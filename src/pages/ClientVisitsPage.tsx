import React, { useState, useEffect, useMemo } from 'react';
import { Client, ClientVisit, User, VisitStats, VisitType, SellerRoute } from '../types';
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
  Download, FileSpreadsheet, Check, ShieldAlert, ArrowDownRight, Tag, Share2,
  Route, Milestone, Timer, Car, Repeat, Flag, Hourglass, Trash2, Play, History, CheckCircle,
  Eye, Map as MapIcon, ListFilter, Award
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
  const [sellerRoutes, setSellerRoutes] = useState<SellerRoute[]>([]);
  const [activeRoute, setActiveRoute] = useState<SellerRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Route Session Actions State
  const [isStartingRoute, setIsStartingRoute] = useState(false);
  const [isFinishingRoute, setIsFinishingRoute] = useState(false);
  const [showFinishRouteModal, setShowFinishRouteModal] = useState(false);
  const [finishNotes, setFinishNotes] = useState('');

  // GPS State
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Modals State
  const [isMarkModalOpen, setIsMarkModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedClientForVisit, setSelectedClientForVisit] = useState<Client | null>(null);
  const [selectedClientForMark, setSelectedClientForMark] = useState<Client | null>(null);

  // Active View Tab: 'portfolio' | 'map' | 'timeline' | 'ranking'
  const [activeTab, setActiveTab] = useState<'portfolio' | 'map' | 'timeline' | 'ranking'>('portfolio');

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [portfolioScope, setPortfolioScope] = useState<'mine' | 'all'>(user.role === 'seller' ? 'mine' : 'all');
  const [locationFilter, setLocationFilter] = useState<'with_location' | 'no_gps' | 'all'>('all');
  const [frequencyFilter, setFrequencyFilter] = useState<'all' | 'today' | 'urgent' | 'regular' | 'never'>('all');
  const [selectedVisitTypeFilter, setSelectedVisitTypeFilter] = useState<string>('all');
  const [selectedDateRangeFilter, setSelectedDateRangeFilter] = useState<'all' | 'today' | '7days' | 'month'>('all');
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>(user.role === 'seller' ? user.email || user.id : 'all');

  // Route Tracing & Supervision State
  const [routeSellerId, setRouteSellerId] = useState<string>('all');
  const [routeDate, setRouteDate] = useState<string>('all');
  const [isRouteTraceActive, setIsRouteTraceActive] = useState<boolean>(true);

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
      const [clientsData, visitsData, statsData, routesData, activeRouteData] = await Promise.all([
        api.getClients(),
        api.getVisits(),
        api.getVisitStats(),
        api.getSellerRoutes(),
        api.getActiveRoute()
      ]);

      setClients(clientsData || []);
      setVisits(visitsData || []);
      setStats(statsData || null);
      setSellerRoutes(routesData || []);
      setActiveRoute(activeRouteData || null);
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
    setClients(prev => prev.map(c => {
      if (c.id === updatedClient.id || (c.name && updatedClient.name && c.name.trim().toLowerCase() === updatedClient.name.trim().toLowerCase())) {
        return { ...c, ...updatedClient };
      }
      return c;
    }));
    loadData(true);
  };

  const handleClearClientLocation = async (client: Client) => {
    const confirmMsg = `¿Estás seguro de que deseas borrar la ubicación GPS guardada para "${client.name}"?\n\nEl cliente quedará sin coordenadas hasta que le asignes una nueva.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.clearClientLocation(client.id);
      setClients(prev => prev.map(c => {
        if (c.id === client.id) {
          return {
            ...c,
            latitude: undefined,
            longitude: undefined,
            locationAddress: undefined,
            geotaggedAt: undefined,
            geotaggedBy: undefined
          };
        }
        return c;
      }));
      loadData(true);
    } catch (err: any) {
      alert(err.message || 'Error al borrar la ubicación del cliente.');
    }
  };

  const handleVisitRegistered = (newVisit: ClientVisit) => {
    setVisits(prev => [newVisit, ...prev]);
    loadData(true);
  };

  const handleSelectClientForVisit = (client: Client) => {
    setSelectedClientForVisit(client);
    setIsRegisterModalOpen(true);
  };

  const handleStartRoute = async () => {
    try {
      setIsStartingRoute(true);
      const res = await api.startRoute({
        startLatitude: currentLocation?.latitude,
        startLongitude: currentLocation?.longitude,
        notes: 'Jornada iniciada en terreno.'
      });
      setActiveRoute(res.route);
      await loadData(true);
    } catch (e: any) {
      alert(e.message || 'Error al iniciar la jornada.');
    } finally {
      setIsStartingRoute(false);
    }
  };

  const handleFinishRoute = async () => {
    if (!activeRoute) return;
    try {
      setIsFinishingRoute(true);
      await api.finishRoute(activeRoute.id, {
        endLatitude: currentLocation?.latitude,
        endLongitude: currentLocation?.longitude,
        notes: finishNotes || undefined
      });
      setShowFinishRouteModal(false);
      setFinishNotes('');
      setActiveRoute(null);
      await loadData(true);
    } catch (e: any) {
      alert(e.message || 'Error al finalizar la jornada.');
    } finally {
      setIsFinishingRoute(false);
    }
  };

  // Strict Multi-Role Isolation: Sellers ONLY see their own visits
  const scopedVisits = useMemo(() => {
    if (user.role !== 'seller') return visits;
    const uId = String(user.id || '').trim();
    const uEmail = String(user.email || '').trim().toLowerCase();
    const uName = String(user.name || '').trim().toLowerCase();

    return visits.filter(v => {
      const vId = String(v.sellerId || '').trim();
      const vEmail = String(v.sellerEmail || '').trim().toLowerCase();
      const vName = String(v.sellerName || '').trim().toLowerCase();

      return (
        (uId && vId === uId) ||
        (uEmail && (vEmail === uEmail || vId === uEmail)) ||
        (uName && vName === uName)
      );
    });
  }, [visits, user]);

  // Frequency and Client Portfolio Analysis
  const clientPortfolioWithStatus = useMemo(() => {
    const now = new Date().getTime();
    const map = new Map<string, ClientVisit>();

    scopedVisits.forEach(v => {
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

      const isAssignedToUser = 
        client.sellerId === user.id || 
        client.sellerId === user.email || 
        (client as any).sellerEmail === user.email ||
        (client.sellerId && user.name && client.sellerId.toLowerCase() === user.name.toLowerCase()) ||
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
      const hasEstablishedGps = Boolean(c.latitude && c.longitude && !isNaN(Number(c.latitude)) && !isNaN(Number(c.longitude)));

      if (locationFilter === 'with_location' && !hasEstablishedGps) return false;
      if (locationFilter === 'no_gps' && hasEstablishedGps) return false;

      if (portfolioScope === 'mine' && user.role === 'seller' && !c.isAssignedToUser) return false;

      if (term) {
        const matches = normalizeSearchText(c.name || '').includes(term) ||
                        normalizeSearchText(c.clientCode || '').includes(term) ||
                        normalizeSearchText(c.phone || '').includes(term) ||
                        normalizeSearchText(c.address || '').includes(term) ||
                        normalizeSearchText(c.companyName || '').includes(term);
        if (!matches) return false;
      }

      if (frequencyFilter === 'today') return c.status === 'today';
      if (frequencyFilter === 'urgent') return c.status === 'urgent' || c.status === 'attention';
      if (frequencyFilter === 'regular') return c.status === 'recent';
      if (frequencyFilter === 'never') return c.status === 'never';

      return true;
    }).sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      if (a.daysElapsed === null && b.daysElapsed === null) return 0;
      if (a.daysElapsed === null) return -1;
      if (b.daysElapsed === null) return 1;
      return b.daysElapsed - a.daysElapsed;
    });
  }, [clients, scopedVisits, searchTerm, frequencyFilter, locationFilter, portfolioScope, currentLocation, user]);

  // Filtered Visits for Timeline
  const filteredVisits = useMemo(() => {
    const term = normalizeSearchText(searchTerm);
    const now = new Date().getTime();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const todayIso = getGuatemalaTodayIso();
    const monthPrefix = todayIso.substring(0, 7);

    return scopedVisits.filter(v => {
      if (selectedSellerFilter !== 'all') {
        const matchesSeller = v.sellerId === selectedSellerFilter || v.sellerEmail === selectedSellerFilter || v.sellerName === selectedSellerFilter;
        if (!matchesSeller) return false;
      }

      if (selectedVisitTypeFilter !== 'all' && v.visitType !== selectedVisitTypeFilter) return false;
      if (selectedDateRangeFilter === 'today' && !isTodayGuatemala(v.createdAt)) return false;
      if (selectedDateRangeFilter === '7days') {
        if (now - new Date(v.createdAt).getTime() > SEVEN_DAYS_MS) return false;
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
  }, [scopedVisits, selectedSellerFilter, selectedVisitTypeFilter, selectedDateRangeFilter, searchTerm]);

  const availableSellers = useMemo(() => {
    if (user.role === 'seller') {
      return [{
        id: user.id || user.email || 'me',
        name: user.name || 'Mi Perfil',
        email: user.email,
        totalVisits: scopedVisits.length,
        todayVisits: scopedVisits.filter(v => isTodayGuatemala(v.createdAt)).length
      }];
    }

    const sellerMap = new Map<string, { id: string; name: string; email?: string; totalVisits: number; todayVisits: number }>();
    visits.forEach(v => {
      const sId = v.sellerId || v.sellerEmail || v.sellerName || 'desconocido';
      const sName = v.sellerName || 'Asesor de Campo';
      if (!sellerMap.has(sId)) {
        sellerMap.set(sId, { id: sId, name: sName, email: v.sellerEmail, totalVisits: 0, todayVisits: 0 });
      }
      const item = sellerMap.get(sId)!;
      item.totalVisits++;
      if (isTodayGuatemala(v.createdAt)) {
        item.todayVisits++;
      }
    });

    return Array.from(sellerMap.values()).sort((a, b) => b.todayVisits - a.todayVisits || b.totalVisits - a.totalVisits);
  }, [visits, scopedVisits, user]);

  const availableVisitDates = useMemo(() => {
    const datesMap = new Map<string, number>();
    scopedVisits.forEach(v => {
      if (!v.createdAt) return;
      if (routeSellerId !== 'all' && user.role === 'admin') {
        const match = v.sellerId === routeSellerId || v.sellerEmail === routeSellerId || v.sellerName === routeSellerId;
        if (!match) return false;
      }
      const d = v.createdAt.split('T')[0];
      datesMap.set(d, (datesMap.get(d) || 0) + 1);
    });

    return Array.from(datesMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, count]) => ({
        date,
        count,
        label: isTodayGuatemala(date) 
          ? `📅 Hoy (${fechaDDMMYYYY(date)} • ${count} ${count === 1 ? 'visita' : 'visitas'})`
          : `📅 ${fechaDDMMYYYY(date)} (${count} ${count === 1 ? 'visita' : 'visitas'})`
      }));
  }, [scopedVisits, routeSellerId, user]);

  // Route Analysis for the selected seller and date
  const routeAnalysis = useMemo(() => {
    const filtered = scopedVisits.filter(v => {
      if (!v.latitude || !v.longitude || isNaN(v.latitude) || isNaN(v.longitude)) return false;
      if (routeSellerId !== 'all' && user.role === 'admin') {
        const match = v.sellerId === routeSellerId || v.sellerEmail === routeSellerId || v.sellerName === routeSellerId;
        if (!match) return false;
      }
      if (routeDate !== 'all') {
        const vDate = (v.createdAt || '').split('T')[0];
        if (vDate !== routeDate) return false;
      }
      return true;
    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (filtered.length === 0) {
      return {
        stops: [],
        totalDistanceKm: 0,
        totalDurationMins: 0,
        firstStopAt: null,
        lastStopAt: null
      };
    }

    let totalDistanceKm = 0;
    const stops = filtered.map((v, idx) => {
      const prev = idx > 0 ? filtered[idx - 1] : null;
      let distFromPrevKm = 0;
      let minsFromPrev = 0;

      if (prev) {
        const R = 6371; // km
        const dLat = ((v.latitude - prev.latitude) * Math.PI) / 180;
        const dLon = ((v.longitude - prev.longitude) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos((prev.latitude * Math.PI) / 180) * 
                  Math.cos((v.latitude * Math.PI) / 180) * 
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distFromPrevKm = Math.round(R * c * 10) / 10;
        totalDistanceKm += distFromPrevKm;

        const diffMs = Math.max(0, new Date(v.createdAt).getTime() - new Date(prev.createdAt).getTime());
        minsFromPrev = Math.round(diffMs / 60000);
      }

      return {
        ...v,
        stepNumber: idx + 1,
        distFromPrevKm,
        minsFromPrev
      };
    });

    const firstStop = filtered[0];
    const lastStop = filtered[filtered.length - 1];
    const totalDurationMs = Math.max(0, new Date(lastStop.createdAt).getTime() - new Date(firstStop.createdAt).getTime());
    const totalDurationMins = Math.round(totalDurationMs / 60000);

    return {
      stops,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      totalDurationMins,
      firstStopAt: firstStop.createdAt,
      lastStopAt: lastStop.createdAt
    };
  }, [scopedVisits, routeSellerId, routeDate]);

  // Export to Excel handler
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const visitsData = filteredVisits.map(v => ({
      'ID Visita': v.id,
      'Cliente': v.clientName,
      'Código Cliente': v.clientCode || 'N/A',
      'Empresa': v.companyName || 'N/A',
      'Vendedor': v.sellerName,
      'Tipo de Visita': v.visitType ? v.visitType.toUpperCase() : 'RUTINA',
      'Fecha': fechaDDMMYYYY(v.createdAt),
      'Hora': new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      'Notas / Observaciones': v.notes || '',
      'Latitud': v.latitude,
      'Longitud': v.longitude
    }));
    const wsVisits = XLSX.utils.json_to_sheet(visitsData);
    XLSX.utils.book_append_sheet(wb, wsVisits, 'Registro_Visitas');

    const portfolioData = clientPortfolioWithStatus.map(c => ({
      'Cliente': c.name,
      'Código': c.clientCode || 'N/A',
      'Empresa': c.companyName || 'N/A',
      'Teléfono': c.phone || 'N/A',
      'Dirección': c.address || 'N/A',
      'Estado Visita': c.status === 'today' ? 'Visitado Hoy' : c.status === 'recent' ? 'Al día (<7d)' : c.status === 'attention' ? 'Atención (8-15d)' : c.status === 'urgent' ? 'Urgente (>15d)' : 'Nunca Visitado',
      'Días sin Visita': c.daysElapsed !== null ? c.daysElapsed : 'Nunca Visitado',
      'Tiene GPS': (c.latitude && c.longitude) ? 'SÍ' : 'NO'
    }));
    const wsPortfolio = XLSX.utils.json_to_sheet(portfolioData);
    XLSX.utils.book_append_sheet(wb, wsPortfolio, 'Cartera_Clientes');

    const todayStr = getGuatemalaTodayIso();
    XLSX.writeFile(wb, `Reporte_Visitas_Agricovet_${todayStr}.xlsx`);
  };

  const renderVisitBadge = (type: string) => {
    switch (type) {
      case 'cobro':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">💰 Cobro</span>;
      case 'pedido':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">🛒 Pedido</span>;
      case 'prospeccion':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">🤝 Prospección</span>;
      case 'entrega':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">📦 Entrega</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">📋 Rutina</span>;
    }
  };

  const userClients = user.role === 'seller' 
    ? clients.filter(c => c.sellerId === user.id || c.sellerId === user.email || (c as any).sellerEmail === user.email || (c.sellerId && user.name && c.sellerId.toLowerCase() === user.name.toLowerCase()))
    : clients;
  const geotaggedCount = userClients.filter(c => c.latitude && c.longitude).length;
  const todayVisitsCount = user.role === 'seller' 
    ? scopedVisits.filter(v => isTodayGuatemala(v.createdAt)).length 
    : (stats?.totalVisitsToday ?? visits.filter(v => isTodayGuatemala(v.createdAt)).length);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[450px] bg-slate-50 font-sans">
        <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-500 font-manrope">Cargando rutas y visitas...</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-7xl mx-auto flex flex-col space-y-5 bg-slate-50/70 min-h-screen pb-28 font-sans">
      
      {/* 1. TOP HEADER & QUICK ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-teal-100 text-teal-800 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              📍 Módulo de Campo
            </span>
            <span className="text-xs font-semibold text-slate-400">Guatemala</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-manrope">
            Visitas & Rutas GPS
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Seguimiento en tiempo real de clientes, trazado de rutas diarias y registro ágil de visitas.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button 
            type="button"
            onClick={() => {
              setSelectedClientForVisit(null);
              setIsRegisterModalOpen(true);
            }}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm text-xs cursor-pointer"
          >
            <Plus size={16} />
            <span>Registrar Visita</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              setSelectedClientForMark(null);
              setIsMarkModalOpen(true);
            }}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 active:scale-95 px-3.5 py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer"
            title="Guardar coordenadas GPS del cliente actual"
          >
            <MapPin size={15} className="text-teal-600" />
            <span>Fijar GPS</span>
          </button>

          <button 
            type="button"
            onClick={handleExportExcel}
            className="p-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl transition-all text-xs font-bold cursor-pointer"
            title="Descargar reporte en Excel"
          >
            <FileSpreadsheet size={16} className="text-emerald-700" />
          </button>

          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
            title="Actualizar datos"
          >
            <RefreshCw size={15} className={cn(refreshing && "animate-spin text-teal-600")} />
          </button>
        </div>
      </div>

      {/* 2. JORNADA DEL DÍA / ESTADO ACTIVO */}
      {user.role === 'seller' ? (
        activeRoute && activeRoute.status === 'active' ? (
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-700 text-white p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <Car size={22} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-300 text-emerald-950 uppercase tracking-wider">
                    🟢 Jornada en Curso
                  </span>
                  <span className="text-xs text-emerald-100">
                    Inició: {activeRoute.startedAt ? new Date(activeRoute.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hoy'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {todayVisitsCount} {todayVisitsCount === 1 ? 'visita registrada hoy' : 'visitas registradas hoy'}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('map');
                  setIsRouteTraceActive(true);
                }}
                className="px-3.5 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Route size={14} />
                <span>Ver Mi Ruta</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFinishRouteModal(true)}
                className="px-4 py-2 bg-white text-emerald-950 hover:bg-emerald-50 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Flag size={14} className="text-emerald-700" />
                <span>Finalizar Jornada</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <Car size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">¿Listo para salir a campo?</h4>
                <p className="text-xs text-slate-500">Inicia tu jornada para registrar la ruta y tus paradas del día.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartRoute}
              disabled={isStartingRoute}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
            >
              <Play size={13} />
              <span>{isStartingRoute ? 'Iniciando...' : 'Iniciar Jornada de Hoy'}</span>
            </button>
          </div>
        )
      ) : null}

      {/* 3. METRIC CHIPS SUMMARY */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 block">Visitas de Hoy</span>
          <span className="text-xl font-black text-slate-900 mt-0.5 block">{todayVisitsCount}</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 block">Clientes con GPS</span>
          <span className="text-xl font-black text-teal-700 mt-0.5 block">
            {geotaggedCount} <span className="text-xs font-semibold text-slate-400">/ {userClients.length}</span>
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-400 block">Clientes Pendientes</span>
          <span className="text-xl font-black text-rose-600 mt-0.5 block">
            {clientPortfolioWithStatus.filter(c => c.status === 'urgent' || c.status === 'never').length}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/70 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-400 block">Tu Posición GPS</span>
          <div className="flex items-center justify-between mt-0.5">
            <span className={cn("text-xs font-bold flex items-center gap-1", currentLocation ? "text-emerald-700" : "text-amber-600")}>
              <span className={cn("w-2 h-2 rounded-full inline-block", currentLocation ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
              {currentLocation ? "GPS Listo" : "Buscando..."}
            </span>
            <button 
              type="button"
              onClick={requestLocation}
              disabled={isGpsLoading}
              className="text-[10px] font-bold text-teal-700 hover:underline cursor-pointer"
            >
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* 4. MAIN INTERACTIVE TABS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        
        {/* Navigation Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/50">
          
          {/* Tabs Selector */}
          <div className="flex items-center bg-slate-200/70 p-1 rounded-xl gap-1 overflow-x-auto hide-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('portfolio')}
              className={cn(
                "px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                activeTab === 'portfolio' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Users size={14} className="text-teal-600" />
              <span>Cartera de Clientes ({clientPortfolioWithStatus.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('map');
                setIsRouteTraceActive(true);
              }}
              className={cn(
                "px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                activeTab === 'map' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <MapIcon size={14} className="text-teal-600" />
              <span>Mapa & Rutas GPS</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={cn(
                "px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                activeTab === 'timeline' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Clock size={14} className="text-teal-600" />
              <span>Historial de Visitas ({filteredVisits.length})</span>
            </button>

            {user.role === 'admin' && (
              <button
                type="button"
                onClick={() => setActiveTab('ranking')}
                className={cn(
                  "px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                  activeTab === 'ranking' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Award size={14} className="text-teal-600" />
                <span>Ranking Asesores</span>
              </button>
            )}
          </div>

          {/* Realtime Search Input */}
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Buscar cliente, teléfono, código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
            />
          </div>
        </div>

        {/* ----------------- TAB 1: CARTERA DE CLIENTES ----------------- */}
        {activeTab === 'portfolio' && (
          <div>
            {/* Filter Pills */}
            <div className="px-4 py-3 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Filtrar:</span>
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'today', label: '🟢 Visitados Hoy' },
                  { id: 'urgent', label: '🔴 Por Visitar / Pendientes' },
                  { id: 'regular', label: '🟡 Al Día (<7d)' },
                  { id: 'never', label: '⚪ Sin Visitas' }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFrequencyFilter(f.id as any)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer text-xs",
                      frequencyFilter === f.id
                        ? "bg-teal-600 text-white shadow-2xs"
                        : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* GPS Filter Toggle */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setLocationFilter('all')}
                  className={cn("px-2 py-1 rounded-md transition-colors cursor-pointer", locationFilter === 'all' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500")}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setLocationFilter('with_location')}
                  className={cn("px-2 py-1 rounded-md transition-colors cursor-pointer", locationFilter === 'with_location' ? "bg-white text-teal-800 shadow-2xs" : "text-slate-500")}
                >
                  📍 Con GPS
                </button>
                <button
                  type="button"
                  onClick={() => setLocationFilter('no_gps')}
                  className={cn("px-2 py-1 rounded-md transition-colors cursor-pointer", locationFilter === 'no_gps' ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500")}
                >
                  ⚪ Sin GPS
                </button>
              </div>
            </div>

            {/* Clients List */}
            <div className="p-4 divide-y divide-slate-100">
              {clientPortfolioWithStatus.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Users className="mx-auto text-slate-300 mb-2" size={36} />
                  <p className="font-bold text-slate-700 text-sm">No se encontraron clientes</p>
                  <p className="text-xs text-slate-400 mt-0.5">Prueba cambiando los filtros o el texto de búsqueda</p>
                </div>
              ) : (
                clientPortfolioWithStatus.map((client) => {
                  const hasGps = Boolean(client.latitude && client.longitude);
                  const googleMapsUrl = hasGps 
                    ? `https://www.google.com/maps/dir/?api=1&destination=${client.latitude},${client.longitude}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address || client.name)}`;
                  const wazeUrl = hasGps 
                    ? `https://waze.com/ul?ll=${client.latitude},${client.longitude}&navigate=yes` 
                    : null;

                  return (
                    <div key={client.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{client.name}</span>
                          {client.clientCode && (
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              #{client.clientCode}
                            </span>
                          )}
                          {hasGps ? (
                            <span className="text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <MapPin size={10} /> Con GPS
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">
                              Sin GPS
                            </span>
                          )}
                          {client.distanceKm !== null && (
                            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                              📍 a {client.distanceKm} km de ti
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          {client.phone && (
                            <a href={`tel:${client.phone}`} className="text-teal-700 font-bold hover:underline flex items-center gap-1">
                              📞 {client.phone}
                            </a>
                          )}
                          {client.address && <span className="truncate max-w-xs">🏢 {client.address}</span>}
                          <span className="font-medium text-slate-600">
                            🕒 Última visita: {client.lastVisit ? `${client.daysElapsed === 0 ? 'Hoy' : `Hace ${client.daysElapsed} días`} (${fechaDDMMYYYY(client.lastVisit.createdAt)})` : <strong className="text-slate-400">Sin registrar</strong>}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSelectClientForVisit(client)}
                          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <Plus size={13} />
                          <span>Visitar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClientForMark(client);
                            setIsMarkModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          title={hasGps ? "Actualizar ubicación GPS" : "Guardar ubicación GPS"}
                        >
                          <MapPin size={13} className="text-teal-600" />
                        </button>

                        {hasGps && (
                          <>
                            <a
                              href={googleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold"
                              title="Abrir en Google Maps"
                            >
                              🗺️
                            </a>
                            {wazeUrl && (
                              <a
                                href={wazeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl text-sky-800 text-xs font-bold"
                                title="Abrir en Waze"
                              >
                                🚗
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleClearClientLocation(client)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-colors cursor-pointer"
                              title="Borrar ubicación GPS guardada"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ----------------- TAB 2: MAPA & RUTAS GPS ----------------- */}
        {activeTab === 'map' && (
          <div className="p-4 space-y-4" id="client-visits-map-section">
            
            {/* Map Controls & Route Selector Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {user.role === 'admin' && availableSellers.length > 0 && (
                  <select
                    value={routeSellerId}
                    onChange={(e) => setRouteSellerId(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="all">👤 Todos los Asesores</option>
                    {availableSellers.map(s => (
                      <option key={s.id} value={s.id}>
                        👤 {s.name} {s.todayVisits > 0 ? `(${s.todayVisits} hoy)` : ''}
                      </option>
                    ))}
                  </select>
                )}

                <select
                  value={routeDate}
                  onChange={(e) => setRouteDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">📅 Toda la Trayectoria</option>
                  {availableVisitDates.map(d => (
                    <option key={d.date} value={d.date}>{d.label}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setIsRouteTraceActive(!isRouteTraceActive)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5",
                    isRouteTraceActive ? "bg-teal-600 text-white" : "bg-white border border-slate-200 text-slate-700"
                  )}
                >
                  <Route size={13} />
                  <span>{isRouteTraceActive ? '🛣️ Ocultar Línea de Ruta' : '🛣️ Trazar Línea de Ruta'}</span>
                </button>
              </div>

              {/* Route Summary Telemetry */}
              {isRouteTraceActive && routeAnalysis.stops.length > 0 && (
                <div className="flex items-center gap-3 font-medium text-slate-600">
                  <span>📍 <strong>{routeAnalysis.stops.length}</strong> paradas</span>
                  <span>•</span>
                  <span>🚗 <strong>{routeAnalysis.totalDistanceKm} km</strong> recorridos</span>
                  <span>•</span>
                  <span>⏱️ <strong>{routeAnalysis.totalDurationMins} min</strong> en campo</span>
                </div>
              )}
            </div>

            {/* Interactive Leaflet Map */}
            <ClientVisitsMap
              clients={clients}
              visits={scopedVisits}
              currentLocation={currentLocation}
              currentUser={user}
              onSelectClientForVisit={handleSelectClientForVisit}
              onOpenMarkClientModal={() => {
                setSelectedClientForMark(null);
                setIsMarkModalOpen(true);
              }}
              onOpenRegisterVisitModal={() => {
                setSelectedClientForVisit(null);
                setIsRegisterModalOpen(true);
              }}
              onRefreshGps={requestLocation}
              isGpsLoading={isGpsLoading}
              routeSellerId={routeSellerId}
              routeDate={routeDate}
              isRouteTraceActive={isRouteTraceActive}
              onOpenMarkClientModalForClient={(c) => {
                setSelectedClientForMark(c);
                setIsMarkModalOpen(true);
              }}
              onClearClientLocation={handleClearClientLocation}
            />
          </div>
        )}

        {/* ----------------- TAB 3: HISTORIAL DE VISITAS ----------------- */}
        {activeTab === 'timeline' && (
          <div>
            {/* Filter Pills */}
            <div className="px-4 py-3 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Tipo:</span>
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
                      "px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer",
                      selectedVisitTypeFilter === f.id
                        ? "bg-teal-600 text-white shadow-2xs"
                        : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Date Range Selector */}
              <select
                value={selectedDateRangeFilter}
                onChange={(e) => setSelectedDateRangeFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">📅 Todas las Fechas</option>
                <option value="today">Solo Hoy</option>
                <option value="7days">Últimos 7 Días</option>
                <option value="month">Este Mes</option>
              </select>
            </div>

            {/* Visits Feed */}
            <div className="p-4 divide-y divide-slate-100">
              {filteredVisits.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <Clock className="mx-auto text-slate-300 mb-2" size={36} />
                  <p className="font-bold text-slate-700 text-sm">No hay visitas registradas</p>
                  <p className="text-xs text-slate-400 mt-0.5">Toca "Registrar Visita" para guardar una nueva visita en terreno</p>
                </div>
              ) : (
                filteredVisits.map((visit) => {
                  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${visit.latitude},${visit.longitude}`;
                  return (
                    <div key={visit.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{visit.clientName}</span>
                          {visit.clientCode && (
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              #{visit.clientCode}
                            </span>
                          )}
                          {renderVisitBadge(visit.visitType)}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="font-medium text-slate-700">👤 {visit.sellerName}</span>
                          <span>🕒 {fechaDDMMYYYY(visit.createdAt)} - {new Date(visit.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {visit.notes && <span className="text-slate-700 italic bg-slate-100 px-2 py-0.5 rounded-lg">"{visit.notes}"</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {visit.photoUrl && (
                          <a 
                            href={visit.photoUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-9 h-9 rounded-xl overflow-hidden border border-emerald-500 shadow-2xs hover:scale-105 transition-transform"
                            title="Ver foto del local"
                          >
                            <img src={visit.photoUrl} alt="Foto" className="w-full h-full object-cover" />
                          </a>
                        )}
                        <a
                          href={googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1"
                        >
                          <ExternalLink size={12} />
                          <span>Ver en Mapa</span>
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ----------------- TAB 4: RANKING ASESORES (ADMIN) ----------------- */}
        {activeTab === 'ranking' && user.role === 'admin' && (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats?.sellerRankings && stats.sellerRankings.length > 0 ? (
              stats.sellerRankings.map((seller, idx) => (
                <div key={seller.sellerId} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-600 text-white font-black flex items-center justify-center text-sm">
                      #{idx + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{seller.sellerName}</h4>
                      <p className="text-[11px] text-slate-400">Asesor de Campo</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-center">
                    <div className="p-2 bg-white rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Hoy</span>
                      <span className="text-lg font-black text-emerald-700">{seller.todayVisits}</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Este Mes</span>
                      <span className="text-lg font-black text-teal-800">{seller.monthVisits}</span>
                    </div>
                  </div>
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

      {/* MODALS */}
      <MarkClientModal
        isOpen={isMarkModalOpen}
        onClose={() => {
          setIsMarkModalOpen(false);
          setSelectedClientForMark(null);
        }}
        clients={clients}
        currentLocation={currentLocation}
        currentUser={user}
        onClientMarked={handleClientMarked}
        preselectedClient={selectedClientForMark}
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

      {/* MODAL: FINALIZAR JORNADA */}
      {showFinishRouteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Flag size={24} />
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">¿Finalizar Jornada de Ruta?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Al finalizar, tu ruta actual se cerrará con las paradas registradas hoy.
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Clientes visitados hoy:</span>
                <span className="font-bold text-slate-800">{todayVisitsCount} paradas</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Hora de inicio:</span>
                <span className="font-mono text-slate-800">{activeRoute?.startedAt ? new Date(activeRoute.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hoy'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Hora de cierre:</span>
                <span className="font-mono text-emerald-700 font-bold">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Notas u observaciones de cierre (opcional):</label>
              <textarea
                value={finishNotes}
                onChange={(e) => setFinishNotes(e.target.value)}
                placeholder="Ej. Jornada completada con éxito..."
                rows={2}
                className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowFinishRouteModal(false)}
                disabled={isFinishingRoute}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleFinishRoute}
                disabled={isFinishingRoute}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
              >
                <Flag size={14} />
                <span>{isFinishingRoute ? 'Finalizando...' : 'Confirmar y Finalizar'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
