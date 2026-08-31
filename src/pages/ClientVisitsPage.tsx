import React, { useState, useEffect, useMemo } from 'react';
import { Client, ClientVisit, User, VisitStats, VisitType, SellerRoute } from '../types';
import { api, supabase } from '../api';
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
  Route, Milestone, Timer, Car, Repeat, Flag, Hourglass, Trash2, Play, History, CheckCircle
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

  // Active View Tabs & Filters
  const [activeTab, setActiveTab] = useState<'my_portfolio' | 'timeline' | 'routes' | 'sellers'>('my_portfolio');
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>(user.role === 'seller' ? user.email || user.id : 'all');
  const [selectedVisitTypeFilter, setSelectedVisitTypeFilter] = useState<string>('all');
  const [selectedDateRangeFilter, setSelectedDateRangeFilter] = useState<'all' | 'today' | '7days' | 'month'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState<'all' | 'urgent' | 'regular' | 'never'>('all');
  const [locationFilter, setLocationFilter] = useState<'with_location' | 'no_gps' | 'all'>('with_location');
  const [portfolioScope, setPortfolioScope] = useState<'mine' | 'all'>(user.role === 'seller' ? 'mine' : 'all');

  // Route Tracing & Time Audit (Admin Feature)
  const [routeSellerId, setRouteSellerId] = useState<string>('all');
  const [routeDate, setRouteDate] = useState<string>('all');
  const [isRouteTraceActive, setIsRouteTraceActive] = useState<boolean>(false);

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

    // 1. Silent Background Auto-Polling (Cada 4 segundos para actualización en vivo garantizada)
    const syncInterval = setInterval(() => {
      loadData(true);
    }, 4000);

    // 2. Supabase Realtime Live Subscription (Transmisión instantánea de visitas entre todos los dispositivos)
    const channel = supabase
      .channel('client_visits_live_feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'client_visits' },
        (payload) => {
          console.log('[Live Visitas] Cambio detectado en tiempo real:', payload);
          loadData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seller_routes' },
        () => {
          loadData(true);
        }
      )
      .subscribe();

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
      clearInterval(syncInterval);
      supabase.removeChannel(channel);
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
      alert('🟢 Jornada iniciada con éxito. Ya puedes registrar las visitas a tus clientes.');
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
      alert('🏁 Jornada finalizada con éxito y archivada en el historial de rutas.');
    } catch (e: any) {
      alert(e.message || 'Error al finalizar la jornada.');
    } finally {
      setIsFinishingRoute(false);
    }
  };

  // Strict Multi-Role Isolation: Sellers ONLY see their own visits/checkpoints/routes
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
      const cId = String(v.clientId || (v as any).client_id || '').trim();
      const cName = String(v.clientName || (v as any).client_name || '').trim().toLowerCase();
      const cCode = String(v.clientCode || (v as any).client_code || '').trim().toLowerCase();
      if (cId && !map.has(cId)) map.set(cId, v);
      if (cName && !map.has(cName)) map.set(cName, v);
      if (cCode && !map.has(cCode)) map.set(cCode, v);
    });

    const term = normalizeSearchText(searchTerm);

    return clients.map(client => {
      const cIdKey = String(client.id || '').trim();
      const cNameKey = String(client.name || '').trim().toLowerCase();
      const cCodeKey = String(client.clientCode || '').trim().toLowerCase();
      const lastVisit = map.get(cIdKey) || map.get(cNameKey) || (cCodeKey ? map.get(cCodeKey) : undefined);
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
      // Strict filter by established GPS location (Con GPS Fijado)
      const hasEstablishedGps = Boolean(c.latitude && c.longitude && !isNaN(Number(c.latitude)) && !isNaN(Number(c.longitude)));

      if (locationFilter === 'with_location' && !hasEstablishedGps) {
        return false;
      }
      if (locationFilter === 'no_gps' && hasEstablishedGps) {
        return false;
      }

      // Filter by portfolio scope (mine vs all)
      if (portfolioScope === 'mine' && user.role === 'seller' && !c.isAssignedToUser) {
        return false;
      }

      if (term) {
        const matches = normalizeSearchText(c.name || '').includes(term) ||
                        normalizeSearchText(c.clientCode || '').includes(term) ||
                        normalizeSearchText(c.phone || '').includes(term) ||
                        normalizeSearchText(c.address || '').includes(term) ||
                        normalizeSearchText(c.locationAddress || '').includes(term) ||
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
  }, [clients, scopedVisits, searchTerm, frequencyFilter, locationFilter, portfolioScope, currentLocation, user]);

  // Filtered Visits
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
  }, [scopedVisits, selectedSellerFilter, selectedVisitTypeFilter, selectedDateRangeFilter, searchTerm]);

  const availableSellers = useMemo(() => {
    if (user.role === 'seller') {
      return [{
        id: user.id || user.email || 'me',
        name: user.name || 'Mi Perfil',
        email: user.email,
        todayVisits: scopedVisits.filter(v => isTodayGuatemala(v.createdAt)).length,
        totalVisits: scopedVisits.length
      }];
    }

    const map = new Map<string, { id: string; name: string; email?: string; todayVisits: number; totalVisits: number }>();
    visits.forEach(v => {
      const sId = v.sellerId || v.sellerEmail || v.sellerName;
      if (!sId) return;
      if (!map.has(sId)) {
        map.set(sId, {
          id: sId,
          name: v.sellerName || 'Asesor',
          email: v.sellerEmail,
          todayVisits: 0,
          totalVisits: 0
        });
      }
      const entry = map.get(sId)!;
      entry.totalVisits++;
      if (isTodayGuatemala(v.createdAt)) {
        entry.todayVisits++;
      }
    });
    return Array.from(map.values());
  }, [visits, scopedVisits, user]);

  // Available unique dates with recorded visits (filtered by selected seller if applicable)
  const availableVisitDates = useMemo(() => {
    const datesMap = new Map<string, number>();
    scopedVisits.forEach(v => {
      if (!v.createdAt) return;
      if (routeSellerId !== 'all' && user.role === 'admin') {
        const match = v.sellerId === routeSellerId || v.sellerEmail === routeSellerId || v.sellerName === routeSellerId;
        if (!match) return;
      }
      const datePart = v.createdAt.split('T')[0];
      datesMap.set(datePart, (datesMap.get(datePart) || 0) + 1);
    });

    return Array.from(datesMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, count]) => ({
        date,
        count,
        label: isTodayGuatemala(date) 
          ? `📅 ${fechaDDMMYYYY(date)} (Hoy • ${count} ${count === 1 ? 'cliente' : 'clientes'})`
          : `📅 ${fechaDDMMYYYY(date)} (${count} ${count === 1 ? 'cliente' : 'clientes'})`
      }));
  }, [scopedVisits, routeSellerId, user]);

  // Distinct seller routes for admin route dashboard & seller history
  const distinctSellerRoutes = useMemo(() => {
    if (sellerRoutes.length > 0) {
      return sellerRoutes.map(r => {
        const datePart = (r.startedAt || r.createdAt || '').split('T')[0];
        const stops = scopedVisits.filter(v => 
          v.routeId === r.id || 
          (v.sellerId === r.sellerId && (v.createdAt || '').startsWith(datePart))
        ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        return {
          id: r.id,
          key: r.id,
          sellerId: r.sellerId,
          sellerName: r.sellerName,
          date: datePart,
          status: r.status,
          isToday: isTodayGuatemala(datePart),
          startedAt: r.startedAt,
          finishedAt: r.finishedAt,
          totalDistanceKm: r.totalDistanceKm || 0,
          totalDurationMins: r.totalDurationMins || 0,
          notes: r.notes,
          visitsCount: stops.length,
          stops
        };
      }).sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return new Date(b.startedAt || b.date).getTime() - new Date(a.startedAt || a.date).getTime();
      });
    }

    const routeGroups = new Map<string, any>();

    scopedVisits.forEach(v => {
      if (!v.createdAt || !v.latitude || !v.longitude) return;
      const sId = v.sellerId || v.sellerEmail || v.sellerName || 'vendedor';
      const sName = v.sellerName || 'Asesor';
      const datePart = v.createdAt.split('T')[0];
      const key = `${sId}_${datePart}`;

      if (!routeGroups.has(key)) {
        routeGroups.set(key, {
          id: key,
          key,
          sellerId: sId,
          sellerName: sName,
          date: datePart,
          status: isTodayGuatemala(datePart) ? 'active' : 'completed',
          isToday: isTodayGuatemala(datePart),
          startedAt: v.createdAt,
          visitsCount: 0,
          stops: []
        });
      }

      const group = routeGroups.get(key)!;
      group.visitsCount++;
      group.stops.push(v);
    });

    return Array.from(routeGroups.values())
      .map(g => ({
        ...g,
        stops: g.stops.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      }))
      .sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return b.date.localeCompare(a.date);
      });
  }, [sellerRoutes, scopedVisits]);

  // Helper to select and inspect a specific route
  const handleSelectSpecificRoute = (sellerId: string, date: string) => {
    setRouteSellerId(sellerId);
    setRouteDate(date);
    setIsRouteTraceActive(true);
    // Smooth scroll to map
    const mapEl = document.getElementById('client-visits-map-section');
    if (mapEl) {
      mapEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleToggleRouteTrace = () => {
    if (!isRouteTraceActive) {
      // If no specific seller/date selected, default to first seller with visits today (e.g. Erick Juárez)
      if (routeSellerId === 'all' && user.role === 'admin') {
        const sellerWithTodayVisits = availableSellers.find(s => s.todayVisits > 0) || availableSellers[0];
        if (sellerWithTodayVisits) {
          setRouteSellerId(sellerWithTodayVisits.id);
          const todayDate = getGuatemalaTodayIso();
          setRouteDate(todayDate);
        }
      } else if (user.role === 'seller') {
        setRouteSellerId(user.id || user.email || 'me');
        const todayDate = getGuatemalaTodayIso();
        setRouteDate(todayDate);
      }
      setIsRouteTraceActive(true);
    } else {
      setIsRouteTraceActive(false);
    }
  };

  // Comprehensive Route & Time Audit Analysis (Admin Route Tracer)
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
        avgTimeBetweenStopsMins: 0,
        firstStopAt: null,
        lastStopAt: null,
        returnCycleDays: 14
      };
    }

    let totalDistanceKm = 0;
    const stops = filtered.map((v, idx) => {
      const prev = idx > 0 ? filtered[idx - 1] : null;
      let distFromPrevKm = 0;
      let minsFromPrev = 0;

      if (prev) {
        // Haversine distance
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
    const avgTimeBetweenStopsMins = stops.length > 1 ? Math.round(totalDurationMins / (stops.length - 1)) : 0;

    // Calculate Return Cycle (average days between recurring visits to same client)
    const clientVisitsMap = new Map<string, string[]>();
    visits.forEach(v => {
      const cKey = v.clientId || v.clientCode || v.clientName;
      if (!cKey) return;
      if (!clientVisitsMap.has(cKey)) clientVisitsMap.set(cKey, []);
      clientVisitsMap.get(cKey)!.push(v.createdAt);
    });

    let cycleDiffsSum = 0;
    let cycleCount = 0;
    clientVisitsMap.forEach(dateList => {
      if (dateList.length > 1) {
        const sorted = dateList.map(d => new Date(d).getTime()).sort((a, b) => a - b);
        for (let i = 1; i < sorted.length; i++) {
          const days = (sorted[i] - sorted[i-1]) / (1000 * 60 * 60 * 24);
          if (days >= 1) {
            cycleDiffsSum += days;
            cycleCount++;
          }
        }
      }
    });

    const returnCycleDays = cycleCount > 0 ? Math.round((cycleDiffsSum / cycleCount) * 10) / 10 : 14;

    return {
      stops,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      totalDurationMins,
      avgTimeBetweenStopsMins,
      firstStopAt: firstStop.createdAt,
      lastStopAt: lastStop.createdAt,
      returnCycleDays
    };
  }, [visits, routeSellerId, routeDate]);

  // Export to Excel handler
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Registro de Visitas
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
    XLSX.utils.book_append_sheet(wb, wsVisits, 'Registro_Visitas');

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

  const userClients = user.role === 'seller' 
    ? clients.filter(c => c.sellerId === user.id || c.sellerId === user.email || (c as any).sellerEmail === user.email || (c.sellerId && user.name && c.sellerId.toLowerCase() === user.name.toLowerCase()))
    : clients;
  const geotaggedCount = userClients.filter(c => c.latitude && c.longitude).length;
  const geotaggedPercentage = userClients.length > 0 ? Math.round((geotaggedCount / userClients.length) * 100) : 0;
  const todayVisitsCount = user.role === 'seller' 
    ? scopedVisits.filter(v => isTodayGuatemala(v.createdAt)).length 
    : (stats?.totalVisitsToday ?? visits.filter(v => isTodayGuatemala(v.createdAt)).length);
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
            Visitas a Clientes & Rutas GPS
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Seguimiento de visitas en terreno en tiempo real, cartera de clientes con ubicación GPS satelital y control de frecuencia comercial.
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
            <span>Fijar GPS Cliente</span>
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
            <span>Registrar Visita GPS</span>
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

      {/* ACTIVE ROUTE / JORNADA STATUS BANNER */}
      {user.role === 'seller' && (
        activeRoute && activeRoute.status === 'active' ? (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Car size={20} className="text-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-300 text-emerald-950 uppercase tracking-wider">
                    🟢 En Ruta Activa
                  </span>
                  <span className="text-xs text-emerald-100 font-medium">
                    Iniciada a las {activeRoute.startedAt ? new Date(activeRoute.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hoy'}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mt-0.5">
                  {scopedVisits.filter(v => isTodayGuatemala(v.createdAt)).length} clientes visitados hoy en esta ruta
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('routes');
                  setIsRouteTraceActive(true);
                  const mapEl = document.getElementById('client-visits-map-section');
                  if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-3.5 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Route size={14} />
                <span>Ver Mi Recorrido</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFinishRouteModal(true)}
                className="px-4 py-2 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5"
              >
                <Flag size={14} className="text-emerald-700" />
                <span>🏁 Finalizar Ruta</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                <Car size={18} className="text-slate-400" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  ⚪ Sin Jornada en Curso
                </span>
                <p className="text-xs text-slate-300 font-medium">
                  Inicia tu ruta antes de salir a campo, o se iniciará automáticamente con tu primera visita registrada.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartRoute}
              disabled={isStartingRoute}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <Car size={14} />
              <span>{isStartingRoute ? 'Iniciando...' : '▶️ Iniciar Ruta de Hoy'}</span>
            </button>
          </div>
        )
      )}

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
            <Sparkles size={12} /> Visitas registradas
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

      {/* MAP & ROUTE TRACER SECTION */}
      <div id="client-visits-map-section" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
              <Route size={18} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 font-manrope flex items-center gap-2">
                <span>Rutas GPS & Auditoría de Tiempos</span>
                {isRouteTraceActive && routeAnalysis.stops.length > 0 && (
                  <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
                    {routeAnalysis.stops.length} Paradas Trazadas
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 font-medium">Trazado secuencial de ruta y cálculo de tiempos en terreno</p>
            </div>
          </div>

          {/* Route Tracing Controls (Admin / Supervisors vs Seller) */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {user.role === 'admin' ? (
              availableSellers.length > 0 && (
                <select
                  value={routeSellerId}
                  onChange={(e) => {
                    setRouteSellerId(e.target.value);
                    if (e.target.value !== 'all' && !isRouteTraceActive) {
                      setIsRouteTraceActive(true);
                    }
                  }}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer shadow-2xs"
                  title="Filtrar ruta por asesor"
                >
                  <option value="all">👤 Todos los Asesores</option>
                  {availableSellers.map(s => (
                    <option key={s.id} value={s.id}>
                      👤 {s.name} {s.todayVisits > 0 ? `(${s.todayVisits} hoy)` : `(${s.totalVisits} visitas)`}
                    </option>
                  ))}
                </select>
              )
            ) : (
              <div className="px-3 py-1.5 bg-teal-50 border border-teal-200 text-teal-900 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                <span>👤 Mi Ruta: {user.name || 'Asesor'}</span>
              </div>
            )}

            <select
              value={routeDate}
              onChange={(e) => {
                setRouteDate(e.target.value);
                if (e.target.value !== 'all' && !isRouteTraceActive) {
                  setIsRouteTraceActive(true);
                }
              }}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer shadow-2xs"
              title="Seleccionar fecha de la ruta"
            >
              <option value="all">📅 Toda la Trayectoria</option>
              {availableVisitDates.map(d => (
                <option key={d.date} value={d.date}>
                  {d.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleToggleRouteTrace}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95",
                isRouteTraceActive 
                  ? "bg-teal-600 text-white hover:bg-teal-700 shadow-teal-600/10 ring-2 ring-teal-500/30" 
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              )}
              title="Activar o desactivar trazado de línea de ruta en el mapa"
            >
              <Route size={14} />
              <span>{isRouteTraceActive ? '🛣️ Ocultar Ruta' : '🛣️ Trazar Ruta'}</span>
            </button>
          </div>
        </div>

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

        {/* Route Metrics Summary Strip */}
        {isRouteTraceActive && routeAnalysis.stops.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-teal-950 text-white p-3.5 sm:p-4 rounded-2xl shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border border-teal-800/40"
          >
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-teal-300 flex items-center gap-1">
                <Timer size={12} /> Jornada en Ruta
              </span>
              <p className="text-base sm:text-lg font-black text-white">
                {routeAnalysis.totalDurationMins >= 60
                  ? `${Math.floor(routeAnalysis.totalDurationMins / 60)}h ${routeAnalysis.totalDurationMins % 60}m`
                  : `${routeAnalysis.totalDurationMins} min`}
              </p>
              <p className="text-[10px] text-teal-200 truncate">
                {routeAnalysis.firstStopAt ? new Date(routeAnalysis.firstStopAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''} - {routeAnalysis.lastStopAt ? new Date(routeAnalysis.lastStopAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-teal-300 flex items-center gap-1">
                <Car size={12} /> Distancia Total
              </span>
              <p className="text-base sm:text-lg font-black text-white">
                {routeAnalysis.totalDistanceKm} <span className="text-xs font-semibold text-teal-300">km</span>
              </p>
              <p className="text-[10px] text-teal-200">
                {routeAnalysis.stops.length} Checkpoints GPS
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-teal-300 flex items-center gap-1">
                <Clock size={12} /> Tiempo / Parada
              </span>
              <p className="text-base sm:text-lg font-black text-white">
                ~{routeAnalysis.avgTimeBetweenStopsMins} <span className="text-xs font-semibold text-teal-300">min</span>
              </p>
              <p className="text-[10px] text-teal-200">
                Promedio entre puntos
              </p>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-teal-300 flex items-center gap-1">
                <Repeat size={12} /> Ciclo de Retorno
              </span>
              <p className="text-base sm:text-lg font-black text-white">
                Cada {routeAnalysis.returnCycleDays} <span className="text-xs font-semibold text-teal-300">días</span>
              </p>
              <p className="text-[10px] text-teal-200">
                Frecuencia de repetición
              </p>
            </div>
          </motion.div>
        )}
      </div>

      {/* CONTROL & SUPERVISION TABS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Navigation Tabs Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70">
          {/* Segmented Tab Buttons */}
          <div className="flex items-center bg-slate-200/70 p-1 rounded-xl flex-nowrap overflow-x-auto hide-scrollbar gap-1 max-w-full shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('my_portfolio')}
              className={cn(
                "px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5",
                activeTab === 'my_portfolio' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Users size={14} className="text-teal-600" />
              <span>Cartera & Frecuencia ({clientPortfolioWithStatus.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('routes');
                setIsRouteTraceActive(true);
              }}
              className={cn(
                "px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5",
                activeTab === 'routes' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Route size={14} className="text-teal-600" />
              <span>Auditoría de Rutas ({routeAnalysis.stops.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={cn(
                "px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5",
                activeTab === 'timeline' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Clock size={14} className="text-teal-600" />
              <span>Bitácora de Visitas ({filteredVisits.length})</span>
            </button>
            {user.role === 'admin' && (
              <button
                type="button"
                onClick={() => setActiveTab('sellers')}
                className={cn(
                  "px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5",
                  activeTab === 'sellers' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <TrendingUp size={14} className="text-teal-600" />
                <span>Vendedores & Ranking</span>
              </button>
            )}
          </div>


          {/* Search and Filters Contextual to Active Tab */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Buscar cliente, código o dirección..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium placeholder:text-slate-400 w-48 sm:w-64"
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
                  Todos
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
                <option value="all">📅 Todas las Fechas</option>
                <option value="today">Solo Hoy</option>
                <option value="7days">Últimos 7 Días</option>
                <option value="month">Este Mes</option>
              </select>
            )}

            {user.role === 'admin' && availableSellers.length > 0 && activeTab !== 'routes' && (
              <select
                value={selectedSellerFilter}
                onChange={(e) => setSelectedSellerFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
              >
                <option value="all">👤 Todos los Asesores</option>
                {availableSellers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}

            {activeTab === 'my_portfolio' && (
              <>
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value as any)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
                >
                  <option value="all">📍 Estado GPS: Todos</option>
                  <option value="with_location">📍 Con GPS Fijado</option>
                  <option value="no_gps">⚪ Sin GPS</option>
                </select>

                <select
                  value={frequencyFilter}
                  onChange={(e) => setFrequencyFilter(e.target.value as any)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer"
                >
                  <option value="all">Frecuencia: Todas</option>
                  <option value="urgent">🔴 Sin visita reciente (&gt;15 días)</option>
                  <option value="regular">🟢 Al día (&lt;7 días)</option>
                  <option value="never">⚪ Sin visitas</option>
                </select>
              </>
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
                <p className="text-xs text-slate-400 mt-0.5">Ajusta los filtros o prueba otro término de búsqueda</p>
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
                      </div>

                      {/* Physical Address & Location */}
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
                        {client.address && (
                          <span className="flex items-center gap-1">
                            <Building2 size={12} className="text-slate-400 shrink-0" />
                            {client.address}
                          </span>
                        )}
                        {client.phone && (
                          <a href={`tel:${client.phone}`} className="text-teal-600 hover:underline flex items-center gap-1">
                            <Phone size={12} />
                            {client.phone}
                          </a>
                        )}
                        {client.sellerName && user.role === 'admin' && (
                          <span className="text-slate-400">
                            Asesor: <strong className="text-slate-600">{client.sellerName}</strong>
                          </span>
                        )}
                      </div>

                      {/* Last Visit Status Badge */}
                      <div className="flex items-center gap-2 pt-0.5">
                        {client.status === 'today' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <CheckCircle2 size={11} /> Visitado Hoy
                          </span>
                        )}
                        {client.status === 'recent' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                            🟢 Visitado hace {client.daysElapsed} días
                          </span>
                        )}
                        {client.status === 'attention' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            🟡 Hace {client.daysElapsed} días sin visita
                          </span>
                        )}
                        {client.status === 'urgent' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                            <AlertTriangle size={11} /> Requiere Visita ({client.daysElapsed} días)
                          </span>
                        )}
                        {client.status === 'never' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                            ⚪ Sin visitas registradas
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Register Visit Button */}
                      <button
                        type="button"
                        onClick={() => handleSelectClientForVisit(client)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Registrar Visita</span>
                      </button>

                      {/* Fix / Update GPS Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClientForMark(client);
                          setIsMarkModalOpen(true);
                        }}
                        className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        title={hasGps ? "Actualizar ubicación GPS del cliente" : "Fijar coordenadas GPS del cliente"}
                      >
                        <MapPin size={13} className="text-teal-600" />
                        <span>{hasGps ? 'Cambiar GPS' : 'Fijar GPS'}</span>
                      </button>

                      {/* Clear GPS Button (if established) */}
                      {hasGps && (
                        <button
                          type="button"
                          onClick={() => handleClearClientLocation(client)}
                          className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition-all cursor-pointer"
                          title="Borrar ubicación GPS guardada"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}

                      {/* External Navigation Links */}
                      {hasGps && (
                        <div className="flex items-center gap-1">
                          <a
                            href={mapsLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition-colors"
                            title="Abrir en Google Maps"
                          >
                            <Navigation size={13} />
                          </a>
                          {wazeLink && (
                            <a
                              href={wazeLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 rounded-xl text-[11px] font-bold transition-colors"
                              title="Navegar con Waze"
                            >
                              Waze
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: AUDITORÍA DE RUTAS & TIEMPOS EN TERRENO */}
        {activeTab === 'routes' && (
          <div className="p-4 md:p-6 space-y-6">
            {/* 1. SECCIÓN: JORNADA EN CURSO / RUTA ACTIVA */}
            {(() => {
              const activeRoutes = distinctSellerRoutes.filter(r => r.status === 'active');
              const historicalRoutes = distinctSellerRoutes.filter(r => r.status !== 'active');

              return (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Activity size={15} className="text-emerald-600 animate-pulse" />
                        <span>Jornada Activa en Curso ({activeRoutes.length}):</span>
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        Solo existe 1 ruta activa a la vez por vendedor
                      </span>
                    </div>

                    {activeRoutes.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {activeRoutes.map(r => {
                          const isSelected = (routeSellerId === r.sellerId || routeSellerId === 'all') && routeDate === r.date && isRouteTraceActive;
                          return (
                            <div
                              key={r.key}
                              className={cn(
                                "p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 shadow-sm bg-gradient-to-br from-emerald-50/70 to-teal-50/30 border-emerald-300 ring-2 ring-emerald-500/20",
                                isSelected && "ring-emerald-600 shadow-md"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-600 text-white uppercase tracking-wider flex items-center gap-1">
                                      🟢 En Curso
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-900">
                                      👤 {r.sellerName}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 font-medium mt-1">
                                    Iniciada: {r.startedAt ? new Date(r.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hoy'}
                                  </p>
                                </div>

                                <span className="text-sm font-black text-emerald-800 bg-white/80 px-2.5 py-1 rounded-xl border border-emerald-200 shadow-2xs">
                                  {r.visitsCount} {r.visitsCount === 1 ? 'visita' : 'visitas'}
                                </span>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-emerald-200/60 gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSelectSpecificRoute(r.sellerId, r.date)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                                >
                                  <Route size={13} />
                                  <span>Trazar en Mapa</span>
                                </button>

                                {user.role === 'seller' && (
                                  <button
                                    type="button"
                                    onClick={() => setShowFinishRouteModal(true)}
                                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-emerald-950 border border-emerald-300 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                                  >
                                    <Flag size={13} className="text-emerald-600" />
                                    <span>Finalizar</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <span>No hay ninguna jornada activa en este momento. Puedes iniciar tu ruta para comenzar el día.</span>
                        {user.role === 'seller' && (
                          <button
                            type="button"
                            onClick={handleStartRoute}
                            disabled={isStartingRoute}
                            className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-all cursor-pointer shrink-0"
                          >
                            ▶️ Iniciar Ruta de Hoy
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2. SECCIÓN: HISTORIAL DE RUTAS FINALIZADAS */}
                  <div className="space-y-3 pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <History size={15} className="text-teal-600" />
                        <span>Historial de Rutas Finalizadas ({historicalRoutes.length}):</span>
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        Rutas archivadas con distancias y tiempos consolidados
                      </span>
                    </div>

                    {historicalRoutes.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {historicalRoutes.map(r => {
                          const isSelected = (routeSellerId === r.sellerId || routeSellerId === 'all') && routeDate === r.date && isRouteTraceActive;
                          return (
                            <button
                              key={r.key}
                              type="button"
                              onClick={() => handleSelectSpecificRoute(r.sellerId, r.date)}
                              className={cn(
                                "p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2.5 shadow-2xs group active:scale-98",
                                isSelected 
                                  ? "bg-teal-50/90 border-teal-500 ring-2 ring-teal-500/20 shadow-sm" 
                                  : "bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300"
                              )}
                            >
                              <div className="flex items-start justify-between gap-1.5">
                                <div>
                                  <span className="font-bold text-xs text-slate-900 group-hover:text-teal-900 transition-colors flex items-center gap-1">
                                    👤 {r.sellerName}
                                  </span>
                                  <span className="text-[11px] font-mono text-slate-500 font-medium">
                                    📅 {fechaDDMMYYYY(r.date)}
                                  </span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  Cerrada
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50/70 p-2 rounded-xl border border-slate-100">
                                <div>
                                  <span className="text-slate-400 text-[10px] block">Paradas</span>
                                  <span className="font-bold text-slate-800">📍 {r.visitsCount} clientes</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 text-[10px] block">Distancia</span>
                                  <span className="font-bold text-slate-800">🚗 {r.totalDistanceKm || 0} km</span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {r.totalDurationMins ? `⏱️ ~${Math.floor(r.totalDurationMins / 60)}h ${r.totalDurationMins % 60}m` : 'Ruta archivada'}
                                </span>
                                <span className="text-[10px] font-bold text-teal-600 group-hover:underline flex items-center gap-0.5">
                                  Ver Trazado ➔
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        No hay rutas finalizadas en el historial todavía.
                      </div>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Header / Instructions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Route size={16} className="text-teal-600" />
                  <span>{user.role === 'seller' ? 'Mi Trayectoria de Ruta Cronológica' : 'Trayectoria de Ruta Cronológica & Auditoría de Tiempos'}</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Desglose secuencial de paradas con cálculo de traslados, distancias y tiempos de permanencia entre clientes.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <span className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
                  {routeDate === 'all' ? 'Toda la historia' : `Fecha: ${fechaDDMMYYYY(routeDate)}`}
                </span>
                <span className="px-2.5 py-1 bg-teal-50 text-teal-800 rounded-lg border border-teal-200 shadow-2xs">
                  {routeAnalysis.stops.length} Checkpoints
                </span>
              </div>
            </div>

            {/* If no stops found */}
            {routeAnalysis.stops.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Route className="mx-auto text-slate-300" size={40} />
                <p className="font-bold text-slate-700 text-sm">No hay paradas registradas para los filtros seleccionados</p>
                <p className="text-xs text-slate-400">Selecciona otro asesor o fecha en la barra superior</p>
              </div>
            ) : (
              <div className="relative pl-4 md:pl-6 space-y-6 before:absolute before:left-8 md:before:left-10 before:top-4 before:bottom-4 before:w-0.5 before:bg-teal-200/60">
                {routeAnalysis.stops.map((stop, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === routeAnalysis.stops.length - 1;
                  const stopColorClass = isFirst 
                    ? "bg-emerald-600 text-white" 
                    : isLast 
                      ? "bg-amber-600 text-white" 
                      : "bg-teal-700 text-white";

                  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}`;
                  const wazeUrl = `https://waze.com/ul?ll=${stop.latitude},${stop.longitude}&navigate=yes`;

                  return (
                    <motion.div 
                      key={stop.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="relative flex items-start gap-4 group"
                    >
                      {/* Step Badge */}
                      <div className={cn(
                        "w-9 h-9 md:w-10 md:h-10 rounded-2xl flex items-center justify-center font-black text-xs md:text-sm shadow-md shrink-0 z-10 transition-transform group-hover:scale-105",
                        stopColorClass
                      )}>
                        {isFirst ? '🚩' : isLast ? '🏁' : `#${stop.stepNumber}`}
                      </div>

                      {/* Stop Detail Card */}
                      <div className="flex-1 bg-slate-50/80 hover:bg-white p-4 md:p-5 rounded-2xl border border-slate-200/80 transition-all shadow-xs hover:shadow-sm space-y-3">
                        {/* Top: Header & Time */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full",
                              isFirst ? "bg-emerald-100 text-emerald-800" : isLast ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800"
                            )}>
                              {isFirst ? '🚩 Punto de Partida' : isLast ? '🏁 Punto de Cierre' : `Parada #${stop.stepNumber}`}
                            </span>
                            <span className="font-bold text-sm text-slate-900">{stop.clientName}</span>
                            {stop.clientCode && (
                              <span className="text-[10px] font-mono font-bold bg-white text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                #{stop.clientCode}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 font-mono">
                            <Clock size={13} className="text-slate-400" />
                            <span>{new Date(stop.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="text-slate-400 font-sans font-normal text-[11px]">({fechaDDMMYYYY(stop.createdAt)})</span>
                          </div>
                        </div>

                        {/* Transition info from previous stop */}
                        {!isFirst && (
                          <div className="flex flex-wrap items-center gap-3 text-xs bg-teal-50/90 text-teal-950 p-2.5 rounded-xl border border-teal-200/60 font-medium">
                            <span className="flex items-center gap-1.5 font-bold text-teal-800">
                              <Timer size={13} />
                              <span>Tiempo desde Parada #{idx}:</span>
                              <strong className="text-teal-950 underline font-black">
                                {stop.minsFromPrev >= 60
                                  ? `${Math.floor(stop.minsFromPrev / 60)}h ${stop.minsFromPrev % 60}m`
                                  : `${stop.minsFromPrev} min`}
                              </strong>
                            </span>
                            <span className="text-teal-400">•</span>
                            <span className="flex items-center gap-1 font-semibold text-slate-700">
                              <Car size={13} className="text-teal-700" />
                              <span>Distancia en ruta: <strong>{stop.distFromPrevKm} km</strong></span>
                            </span>
                          </div>
                        )}

                        {/* Bottom: Notes, Seller & Actions */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">
                          <div className="space-y-1 text-slate-600 flex-1">
                            <div className="flex items-center gap-2">
                              <span>Asesor: <strong className="text-slate-900">{stop.sellerName}</strong></span>
                              <span>•</span>
                              {renderVisitBadge(stop.visitType)}
                            </div>
                            {stop.notes && (
                              <p className="italic text-slate-700 bg-white p-2 rounded-xl border border-slate-200 text-xs font-medium">
                                "{stop.notes}"
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            <a
                              href={googleMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl text-center transition-colors flex items-center gap-1 text-xs shadow-2xs"
                            >
                              🗺️ Google Maps
                            </a>
                            <a
                              href={wazeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 font-bold rounded-xl text-center transition-colors flex items-center gap-1 text-xs shadow-2xs"
                            >
                              🚗 Waze
                            </a>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LIVE CHECKPOINTS FEED */}
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
                  <p className="font-bold text-slate-700 text-sm">No hay visitas registradas con los filtros seleccionados</p>
                  <p className="text-xs text-slate-400">Registra la primera visita en terreno tocando "Registrar Visita GPS"</p>
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
                      Última visita: {fechaDDMMYYYY(seller.lastVisitAt)} {new Date(seller.lastVisitAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

      {/* FINALIZAR RUTA MODAL */}
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
                Al finalizar, tu ruta actual se cerrará con las paradas registradas y pasará automáticamente al <strong>Historial de Rutas</strong>.
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Clientes visitados hoy:</span>
                <span className="font-bold text-slate-800">{scopedVisits.filter(v => isTodayGuatemala(v.createdAt)).length} paradas</span>
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
                placeholder="Ej. Ruta completada satisfactoriamente con 2 pedidos..."
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
                <span>{isFinishingRoute ? 'Finalizando...' : 'Confirmar y Archivar'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
