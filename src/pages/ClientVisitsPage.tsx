import React, { useState, useEffect, useMemo } from 'react';
import { Client, ClientVisit, User, VisitStats, VisitType, SellerRoute } from '../types';
import { api } from '../api';
import { ClientVisitsMap } from '../components/ClientVisitsMap';
import { MarkClientModal } from '../components/MarkClientModal';
import { RegisterVisitModal } from '../components/RegisterVisitModal';
import { VisitDetailModal } from '../components/VisitDetailModal';
import { ClientSalesTrackingPage } from './ClientSalesTrackingPage';
import { 
  MapPin, Navigation, Compass, Calendar, Clock, 
  Users, CheckCircle2, AlertTriangle, RefreshCw, 
  Search, Filter, ExternalLink, Phone, Building2, 
  DollarSign, ShoppingCart, UserPlus, Package, 
  ClipboardCheck, Sparkles, ChevronRight, ArrowUpRight, ArrowRight, TrendingUp, AlertCircle, Plus, Layers, Activity,
  Download, FileSpreadsheet, Check, Shield, ShieldAlert, ArrowDownRight, Tag, Share2,
  Route, Milestone, Timer, Car, Repeat, Flag, Hourglass, Trash2, Play, History, CheckCircle, Image as ImageIcon,
  BarChart3, X, WifiOff
} from 'lucide-react';
import { cn, fechaDDMMYYYY, normalizeSearchText, isTodayGuatemala, getGuatemalaTodayIso, diaGuatemala, getMesActualGuatemala, getMesPasadoGuatemala, getNombreMesGuatemala, isClientOfSeller, getDiffCalendarDaysGT } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

interface ClientVisitsPageProps {
  user: User;
  isMobile?: boolean;
  initialTab?: 'my_portfolio' | 'routes' | 'timeline' | 'sellers' | 'control';
}

export function ClientVisitsPage({ user, isMobile, initialTab }: ClientVisitsPageProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [visits, setVisits] = useState<ClientVisit[]>([]);
  const [stats, setStats] = useState<VisitStats | null>(null);
  const [sellerRoutes, setSellerRoutes] = useState<SellerRoute[]>([]);
  const [activeRoute, setActiveRoute] = useState<SellerRoute | null>(null);
  const [teamUsers, setTeamUsers] = useState<User[]>([]);
  const [salesTrackingClients, setSalesTrackingClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Route Session Actions State
  const [isStartingRoute, setIsStartingRoute] = useState(false);
  const [isFinishingRoute, setIsFinishingRoute] = useState(false);
  const [showFinishRouteModal, setShowFinishRouteModal] = useState(false);
  const [routeToFinish, setRouteToFinish] = useState<SellerRoute | null>(null);
  const [finishNotes, setFinishNotes] = useState('');
  const [focusLocation, setFocusLocation] = useState<{ latitude: number; longitude: number; label?: string } | null>(null);

  // GPS State
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Offline Visits Queue State
  const [offlineVisitsQueue, setOfflineVisitsQueue] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('offline_client_visits') || '[]');
    } catch (e) {
      return [];
    }
  });
  const [isSyncingVisits, setIsSyncingVisits] = useState(false);
  const [syncVisitsMsg, setSyncVisitsMsg] = useState('');

  // Sincronizar visitas offline acumuladas en terreno con coordenadas congeladas del sitio
  const handleSyncOfflineVisits = async () => {
    if (!navigator.onLine || isSyncingVisits) return;
    setIsSyncingVisits(true);
    try {
      const res = await api.syncOfflineVisits();
      const currentQueue = JSON.parse(localStorage.getItem('offline_client_visits') || '[]');
      setOfflineVisitsQueue(currentQueue);
      if (res.synced > 0) {
        setSyncVisitsMsg(`✅ Se sincronizaron exitosamente ${res.synced} visita(s) guardadas sin conexión.`);
        setTimeout(() => setSyncVisitsMsg(''), 8000);
        await loadData(true);
      }
    } catch (e) {
      console.warn('Error syncing offline visits:', e);
    } finally {
      setIsSyncingVisits(false);
    }
  };

  // Modals State
  const [isMarkModalOpen, setIsMarkModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedClientForVisit, setSelectedClientForVisit] = useState<Client | null>(null);
  const [selectedClientForMark, setSelectedClientForMark] = useState<Client | null>(null);
  const [selectedVisitForDetail, setSelectedVisitForDetail] = useState<ClientVisit | null>(null);

  // Active View Tabs & Filters
  const [activeTab, setActiveTab] = useState<'my_portfolio' | 'timeline' | 'routes' | 'sellers' | 'control'>(initialTab || 'my_portfolio');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>(user.role === 'seller' ? user.email || user.id : 'all');
  const [selectedVisitTypeFilter, setSelectedVisitTypeFilter] = useState<string>('all');
  const [selectedDateRangeFilter, setSelectedDateRangeFilter] = useState<'all' | 'today' | '7days' | 'month' | 'last_month'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState<'all' | 'urgent' | 'regular' | 'never'>('all');
  const [locationFilter, setLocationFilter] = useState<'with_location' | 'no_gps' | 'all'>('all');
  const [portfolioScope, setPortfolioScope] = useState<'mine' | 'all'>(user.role === 'seller' ? 'mine' : 'all');

  // Route Tracing & Time Audit (Admin Feature)
  const [routeSellerId, setRouteSellerId] = useState<string>('all');
  const [routeDate, setRouteDate] = useState<string>(getGuatemalaTodayIso());
  const [isRouteTraceActive, setIsRouteTraceActive] = useState<boolean>(false);

  // Request & Watch GPS Location (Optimizado para zonas remotas con satellite fallback)
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Tu dispositivo no soporta geolocalización GPS.');
      return;
    }

    setIsGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const fresh = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        setCurrentLocation(fresh);
        try {
          localStorage.setItem('last_known_gps_coords', JSON.stringify({
            ...fresh,
            timestamp: Date.now()
          }));
        } catch (e) {}
        setIsGpsLoading(false);
      },
      (error) => {
        let msg = 'No se pudo obtener la ubicación GPS.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Permiso de ubicación denegado. Activa el GPS en los ajustes de tu navegador.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Señal GPS no disponible temporalmente en esta zona.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Tiempo de espera agotado al obtener el GPS satelital.';
        }
        setGpsError(msg);
        setIsGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 35000,
        maximumAge: 15000
      }
    );
  };

  // Initial Data Fetch
  const loadData = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    try {
      const [clientsData, visitsData, routesData, activeRouteData, usersData] = await Promise.all([
        api.getClients(),
        api.getVisits(),
        api.getSellerRoutes(),
        api.getActiveRoute({
          sellerId: user?.id,
          sellerEmail: user?.email,
          sellerName: user?.name
        }),
        api.getUsers().catch(() => [])
      ]);
      const statsData = await api.getVisitStats(visitsData);

      if (clientsData && clientsData.length > 0) {
        try {
          localStorage.setItem('offline_clients_map', JSON.stringify(clientsData));
        } catch (e) {}
      }

      setClients(clientsData || []);
      setVisits(visitsData || []);
      setStats(statsData || null);
      setSellerRoutes(routesData || []);
      const myActiveRoute = activeRouteData && activeRouteData.status === 'active' && (
        user.role === 'seller' ||
        (user.id && activeRouteData.sellerId === user.id) ||
        (user.email && activeRouteData.sellerEmail?.toLowerCase() === user.email.toLowerCase()) ||
        (user.name && activeRouteData.sellerName?.toLowerCase() === user.name.toLowerCase())
      ) ? activeRouteData : null;
      setActiveRoute(myActiveRoute);
      setTeamUsers(usersData || []);

      if (user.role === 'admin') {
        api.getClientSalesTracking({ sellerId: 'all' })
          .then(res => {
            if (res?.clients) setSalesTrackingClients(res.clients);
          })
          .catch(() => {});
      }
    } catch (e) {
      console.error('Error loading visits data:', e);
      // Fallback a caché local si estamos sin internet
      if (typeof localStorage !== 'undefined') {
        try {
          const cachedClients = localStorage.getItem('offline_clients_map');
          if (cachedClients) {
            setClients(JSON.parse(cachedClients));
          }
        } catch (cacheErr) {}
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const clientSalesMap = useMemo(() => {
    const map = new Map<string, any>();
    salesTrackingClients.forEach(stc => {
      if (stc.id) map.set(String(stc.id).toLowerCase().trim(), stc);
      if (stc.clientCode) map.set(String(stc.clientCode).toLowerCase().trim(), stc);
      if (stc.name) map.set(normalizeSearchText(stc.name), stc);
    });
    return map;
  }, [salesTrackingClients]);

  useEffect(() => {
    loadData();
    requestLocation();

    // 1. Silent Background Auto-Polling (Cada 25 segundos para balance óptimo de red y batería)
    const syncInterval = setInterval(() => {
      loadData(true);
    }, 25000);

    // 2. Monitoreo y auto-sincronización de cola de visitas offline al recuperar señal
    window.addEventListener('online', handleSyncOfflineVisits);
    const offlineCheckInterval = setInterval(() => {
      try {
        const q = JSON.parse(localStorage.getItem('offline_client_visits') || '[]');
        setOfflineVisitsQueue(q);
        if (q.length > 0 && navigator.onLine) {
          handleSyncOfflineVisits();
        }
      } catch (e) {}
    }, 15000);

    let watchId: number | null = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const fresh = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          };
          setCurrentLocation(fresh);
          try {
            localStorage.setItem('last_known_gps_coords', JSON.stringify({
              ...fresh,
              timestamp: Date.now()
            }));
          } catch (e) {}
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 15000 }
      );
    }

    return () => {
      clearInterval(syncInterval);
      clearInterval(offlineCheckInterval);
      window.removeEventListener('online', handleSyncOfflineVisits);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const handleClientMarked = (updatedClient: Client) => {
    setClients(prev => {
      const exists = prev.some(c => c.id === updatedClient.id || (c.name && updatedClient.name && c.name.trim().toLowerCase() === updatedClient.name.trim().toLowerCase()));
      if (exists) {
        return prev.map(c => {
          if (c.id === updatedClient.id || (c.name && updatedClient.name && c.name.trim().toLowerCase() === updatedClient.name.trim().toLowerCase())) {
            return { ...c, ...updatedClient };
          }
          return c;
        });
      }
      return [updatedClient, ...prev];
    });
    loadData(true);
  };

  const isAdmin = user.role === 'admin';

  const handleClearClientLocation = async (client: Client) => {
    const confirmMsg = `¿Estás seguro de que deseas borrar la ubicación GPS guardada para "${client.name}"?\n\nEl cliente quedará sin coordenadas hasta que le asignes una nueva.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.clearClientLocation(client.id, client.name, client.clientCode);
      setClients(prev => prev.map(c => {
        if (c.id === client.id || (c.name && client.name && c.name.toLowerCase().trim() === client.name.toLowerCase().trim())) {
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
      await loadData(true);
      alert(`Ubicación GPS de "${client.name}" eliminada correctamente.`);
    } catch (err: any) {
      alert(err.message || 'Error al borrar la ubicación del cliente.');
    }
  };

  const handleDeleteClient = async (client: Client) => {
    const confirmMsg = `¿Estás seguro de que deseas eliminar permanentemente al cliente "${client.name}"?\n\nEsta acción borrará el cliente de la base de datos y de todo el sistema.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.deleteClient(client.id, client.name, client.clientCode, client.companyName, client.nit);
      setClients(prev => prev.filter(c => c.id !== client.id && (!client.name || c.name?.toLowerCase().trim() !== client.name.toLowerCase().trim())));
      await loadData(true);
      alert(`Cliente "${client.name}" eliminado correctamente.`);
    } catch (err: any) {
      alert(err.message || 'Error al eliminar el cliente.');
    }
  };

  const handleDeleteVisit = async (visit: ClientVisit) => {
    const confirmMsg = `¿Estás seguro de que deseas eliminar permanentemente esta visita de "${visit.clientName}"?\n\nEsta acción borrará el registro de la base de datos.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.deleteVisit(visit.id);
      setVisits(prev => prev.filter(v => v.id !== visit.id));
      await loadData(true);
      alert(`Visita de "${visit.clientName}" eliminada correctamente.`);
    } catch (err: any) {
      alert(err.message || 'Error al eliminar la visita.');
    }
  };

  const handleVisitRegistered = (newVisit: ClientVisit) => {
    setVisits(prev => [newVisit, ...prev.filter(v => v.id !== newVisit.id)]);
    try {
      const q = JSON.parse(localStorage.getItem('offline_client_visits') || '[]');
      setOfflineVisitsQueue(q);
    } catch (e) {}
    loadData(true);
  };

  const handleSelectClientForVisit = (client: Client) => {
    setSelectedClientForVisit(client);
    setIsRegisterModalOpen(true);
  };

  const getFreshCoordinates = (): Promise<{ latitude: number; longitude: number; accuracy?: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(currentLocation || null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const fresh = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          };
          setCurrentLocation(fresh);
          resolve(fresh);
        },
        (err) => {
          console.warn('getCurrentPosition error:', err);
          resolve(currentLocation || null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handleStartRoute = async () => {
    try {
      setIsStartingRoute(true);
      const freshLoc = await getFreshCoordinates();
      const res = await api.startRoute({
        startLatitude: freshLoc?.latitude || currentLocation?.latitude,
        startLongitude: freshLoc?.longitude || currentLocation?.longitude,
        notes: 'Jornada iniciada en terreno.'
      });
      setActiveRoute(res.route);
      await loadData(true);
      if (res.route.startLatitude && res.route.startLongitude) {
        alert('🟢 Jornada iniciada con éxito. Se guardó tu ubicación GPS de inicio.');
      } else {
        alert('🟢 Jornada iniciada. No se detectó señal GPS precisa; se actualizará automáticamente con tu primera visita.');
      }
    } catch (e: any) {
      alert(e.message || 'Error al iniciar la jornada.');
    } finally {
      setIsStartingRoute(false);
    }
  };

  const handleUpdateActiveRouteGps = async () => {
    if (!activeRoute) return;
    try {
      setIsStartingRoute(true);
      const freshLoc = await getFreshCoordinates();
      if (!freshLoc?.latitude || !freshLoc?.longitude) {
        alert('No se pudo obtener la posición GPS actual de tu dispositivo.');
        return;
      }
      await api.updateRouteLocation(activeRoute.id, freshLoc.latitude, freshLoc.longitude);
      await loadData(true);
      alert('📍 Tu ubicación de ruta fue actualizada correctamente.');
    } catch (e: any) {
      alert(e.message || 'Error al actualizar ubicación de la ruta.');
    } finally {
      setIsStartingRoute(false);
    }
  };

  const handleFinishRoute = async () => {
    const target = routeToFinish || activeRoute;
    if (!target) return;
    try {
      setIsFinishingRoute(true);
      const freshLoc = await getFreshCoordinates();
      const endLat = freshLoc?.latitude ?? currentLocation?.latitude;
      const endLng = freshLoc?.longitude ?? currentLocation?.longitude;
      const nowIso = new Date().toISOString();

      // Immediate optimistic update to prevent UI flicker
      setSellerRoutes(prev => {
        const targetId = String(target.id || '').trim();
        const targetSeller = String(target.sellerId || target.sellerName || '').trim().toLowerCase();
        let found = false;
        const updated = prev.map(r => {
          const rId = String(r.id || '').trim();
          const rSeller = String(r.sellerId || r.sellerName || '').trim().toLowerCase();
          if (rId === targetId || (r.status === 'active' && (rSeller === targetSeller || rId === targetId))) {
            found = true;
            return {
              ...r,
              status: 'completed' as const,
              finishedAt: nowIso,
              endLatitude: endLat,
              endLongitude: endLng,
              notes: finishNotes || r.notes
            };
          }
          return r;
        });
        if (!found) {
          updated.unshift({
            id: target.id,
            sellerId: target.sellerId,
            sellerName: target.sellerName,
            status: 'completed' as const,
            startedAt: target.startedAt || nowIso,
            finishedAt: nowIso,
            startLatitude: target.startLatitude,
            startLongitude: target.startLongitude,
            endLatitude: endLat,
            endLongitude: endLng,
            totalDistanceKm: target.totalDistanceKm || 0,
            notes: finishNotes || target.notes
          });
        }
        return updated;
      });

      if (activeRoute?.id === target.id || (activeRoute && (activeRoute.sellerId === target.sellerId || activeRoute.sellerName === target.sellerName))) {
        setActiveRoute(null);
      }

      await api.finishRoute(target.id, {
        sellerId: target.sellerId,
        sellerName: target.sellerName,
        endLatitude: endLat,
        endLongitude: endLng,
        notes: finishNotes || undefined
      });

      setShowFinishRouteModal(false);
      setFinishNotes('');
      setRouteToFinish(null);
      await loadData(true);
      alert(`🏁 Jornada ${target.sellerName ? 'de ' + target.sellerName : ''} finalizada con éxito y archivada en el historial de rutas.`);
    } catch (e: any) {
      alert(e.message || 'Error al finalizar la jornada.');
    } finally {
      setIsFinishingRoute(false);
    }
  };

  const handleViewRouteClosure = (r: any) => {
    const endLat = r.endLatitude !== undefined ? r.endLatitude : (r as any).end_latitude;
    const endLng = r.endLongitude !== undefined ? r.endLongitude : (r as any).end_longitude;
    if (!endLat || !endLng) {
      alert('Esta ruta no tiene registradas coordenadas de cierre.');
      return;
    }
    setRouteSellerId(r.sellerId);
    setRouteDate(r.date || (r.startedAt ? r.startedAt.split('T')[0] : 'today'));
    setIsRouteTraceActive(true);
    setActiveTab('routes');
    setFocusLocation({ latitude: Number(endLat), longitude: Number(endLng), label: `Cierre: ${r.sellerName}` });
    setTimeout(() => {
      const mapEl = document.getElementById('client-visits-map-section');
      if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleViewRouteStart = (r: any) => {
    const startLat = r.startLatitude !== undefined ? r.startLatitude : (r as any).start_latitude;
    const startLng = r.startLongitude !== undefined ? r.startLongitude : (r as any).start_longitude;
    if (!startLat || !startLng) {
      alert('Esta ruta no tiene registradas coordenadas de inicio.');
      return;
    }
    setRouteSellerId(r.sellerId);
    setRouteDate(r.date || (r.startedAt ? r.startedAt.split('T')[0] : 'today'));
    setIsRouteTraceActive(true);
    setActiveTab('routes');
    setFocusLocation({ latitude: Number(startLat), longitude: Number(startLng), label: `Inicio: ${r.sellerName}` });
    setTimeout(() => {
      const mapEl = document.getElementById('client-visits-map-section');
      if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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

  // Available Sellers for filtering and supervision
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
    
    // Add registered sellers/team members
    teamUsers.filter(u => u.role === 'seller' || u.role === 'admin').forEach(u => {
      const id = u.id || u.email || u.name;
      map.set(id, {
        id,
        name: u.name || u.email || 'Asesor',
        email: u.email,
        todayVisits: 0,
        totalVisits: 0
      });
    });

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
  }, [visits, scopedVisits, teamUsers, user]);

  // Frequency and Client Portfolio Analysis
  const clientPortfolioWithStatus = useMemo(() => {
    const todayGT = diaGuatemala();
    const map = new Map<string, ClientVisit>();

    scopedVisits.forEach(v => {
      if (!v.createdAt) return;
      const cId = String(v.clientId || (v as any).client_id || '').trim();
      const cName = String(v.clientName || (v as any).client_name || '').trim().toLowerCase();
      const cCode = String(v.clientCode || (v as any).client_code || '').trim().toLowerCase();

      const updateIfNewer = (key: string) => {
        const existing = map.get(key);
        if (!existing || new Date(v.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
          map.set(key, v);
        }
      };

      if (cId) updateIfNewer(cId);
      if (cName) updateIfNewer(cName);
      if (cCode) updateIfNewer(cCode);
    });

    const term = normalizeSearchText(searchTerm);
    const userClients = user.role === 'seller' ? clients.filter(c => isClientOfSeller(c, user)) : clients;

    return userClients.map(client => {
      const cIdKey = String(client.id || '').trim();
      const cNameKey = String(client.name || '').trim().toLowerCase();
      const cCodeKey = String(client.clientCode || '').trim().toLowerCase();
      const lastVisit = map.get(cIdKey) || map.get(cNameKey) || (cCodeKey ? map.get(cCodeKey) : undefined);
      const daysElapsed = lastVisit 
        ? getDiffCalendarDaysGT(lastVisit.createdAt, todayGT)
        : null;

      let status: 'today' | 'recent' | 'attention' | 'urgent' | 'never' = 'never';
      if (daysElapsed === null) status = 'never';
      else if (daysElapsed === 0) status = 'today';
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

      // Check if assigned to or geotagged by current user
      const isAssignedToUser = isClientOfSeller(client, user);

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

      // Strict Seller Isolation: Sellers ONLY see the clients they geotagged or are assigned to them
      if (user.role === 'seller' && !c.isAssignedToUser) {
        return false;
      }

      // Filter by selected seller dropdown in Cartera & Frecuencia
      if (selectedSellerFilter !== 'all') {
        const targetSeller = availableSellers.find(s => s.id === selectedSellerFilter);
        const sId = selectedSellerFilter.toLowerCase();
        const sEmail = targetSeller?.email?.toLowerCase() || '';
        const sName = targetSeller?.name?.toLowerCase() || '';

        const matchesSeller = 
          isClientOfSeller(c, targetSeller) ||
          (c.sellerId && c.sellerId.toLowerCase() === sId) ||
          (c.geotaggedBy && (c.geotaggedBy.toLowerCase() === sName || c.geotaggedBy.toLowerCase() === sId)) ||
          (c.lastVisit && (
            (c.lastVisit.sellerId && c.lastVisit.sellerId.toLowerCase() === sId) ||
            (c.lastVisit.sellerEmail && c.lastVisit.sellerEmail.toLowerCase() === sEmail) ||
            (c.lastVisit.sellerName && c.lastVisit.sellerName.toLowerCase() === sName)
          ));
        if (!matchesSeller) return false;
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
  }, [clients, scopedVisits, searchTerm, frequencyFilter, locationFilter, portfolioScope, selectedSellerFilter, availableSellers, currentLocation, user]);

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
        const vDate = diaGuatemala(v.createdAt);
        if (vDate.slice(0, 7) !== getMesActualGuatemala()) return false;
      }

      if (selectedDateRangeFilter === 'last_month') {
        const vDate = diaGuatemala(v.createdAt);
        if (vDate.slice(0, 7) !== getMesPasadoGuatemala()) return false;
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

  // Available unique dates with recorded visits (filtered by selected seller if applicable)
  const availableVisitDates = useMemo(() => {
    const datesMap = new Map<string, number>();
    const todayIso = getGuatemalaTodayIso();
    datesMap.set(todayIso, 0);

    scopedVisits.forEach(v => {
      if (!v.createdAt) return;
      if (routeSellerId !== 'all' && user.role === 'admin') {
        const eff = routeSellerId.toLowerCase();
        const vId = String(v.sellerId || '').toLowerCase();
        const vEmail = String(v.sellerEmail || '').toLowerCase();
        const vName = String(v.sellerName || '').toLowerCase();
        if (vId !== eff && vEmail !== eff && vName !== eff) return;
      }
      const datePart = diaGuatemala(v.createdAt);
      datesMap.set(datePart, (datesMap.get(datePart) || 0) + 1);
    });

    (sellerRoutes || []).forEach(r => {
      const rDate = r.date || diaGuatemala(r.startedAt || r.createdAt);
      if (rDate && !datesMap.has(rDate)) {
        datesMap.set(rDate, 0);
      }
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
  }, [scopedVisits, sellerRoutes, routeSellerId, user]);

  // Distinct seller routes for admin route dashboard & seller history
  const distinctSellerRoutes = useMemo(() => {
    // 1. Process all explicit routes from database and state (sorted latest first)
    const sortedExplicit = [...sellerRoutes].sort((a, b) => 
      new Date(b.startedAt || b.createdAt || 0).getTime() - new Date(a.startedAt || a.createdAt || 0).getTime()
    );
    const seenActiveSellers = new Set<string>();

    const mappedExplicit = sortedExplicit.map(r => {
      const datePart = diaGuatemala(r.startedAt || r.createdAt || r.date || '');
      const isRouteToday = isTodayGuatemala(datePart);
      const stops = scopedVisits.filter(v => {
        if (v.routeId) return v.routeId === r.id;
        const vDate = diaGuatemala(v.createdAt);
        const matchSeller = v.sellerId === r.sellerId || 
          (r.sellerEmail && v.sellerEmail?.toLowerCase() === r.sellerEmail.toLowerCase()) ||
          (r.sellerName && v.sellerName?.toLowerCase() === r.sellerName.toLowerCase());
        return matchSeller && vDate === datePart;
      }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Only the latest route per seller can be active; older ones or routes from previous days are completed
      let resolvedStatus = r.status;
      if (resolvedStatus === 'active') {
        if (!isRouteToday) {
          resolvedStatus = 'completed';
        } else {
          const sKey = String(r.sellerId || r.sellerEmail || r.sellerName || '').trim().toLowerCase();
          if (sKey) {
            if (seenActiveSellers.has(sKey)) {
              resolvedStatus = 'completed';
            } else {
              seenActiveSellers.add(sKey);
            }
          }
        }
      }

      let durationMins = r.totalDurationMins || 0;
      if (!durationMins && r.startedAt && r.finishedAt) {
        const ms = new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime();
        durationMins = Math.max(1, Math.round(ms / 60000));
      } else if (!durationMins && stops.length > 1) {
        const ms = new Date(stops[stops.length - 1].createdAt).getTime() - new Date(stops[0].createdAt).getTime();
        durationMins = Math.max(1, Math.round(ms / 60000));
      }

      return {
        id: r.id,
        key: r.id,
        sellerId: r.sellerId,
        sellerName: r.sellerName,
        date: datePart,
        status: resolvedStatus,
        isToday: isRouteToday,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        startLatitude: r.startLatitude !== undefined && r.startLatitude !== null ? r.startLatitude : (r as any).start_latitude,
        startLongitude: r.startLongitude !== undefined && r.startLongitude !== null ? r.startLongitude : (r as any).start_longitude,
        endLatitude: r.endLatitude !== undefined && r.endLatitude !== null ? r.endLatitude : (r as any).end_latitude,
        endLongitude: r.endLongitude !== undefined && r.endLongitude !== null ? r.endLongitude : (r as any).end_longitude,
        totalDistanceKm: r.totalDistanceKm || 0,
        totalDurationMins: durationMins,
        notes: r.notes,
        visitsCount: resolvedStatus === 'active' ? stops.length : (stops.length > 0 ? stops.length : (r.totalStops || (r as any).total_stops || 0)),
        stops
      };
    });

    // Set of covered seller sessions by ID and Name to avoid resurrecting completed routes as active
    const coveredSessions = new Set<string>();
    mappedExplicit.forEach(r => {
      if (r.sellerId && r.date) coveredSessions.add(`${String(r.sellerId).trim().toLowerCase()}_${r.date}`);
      if (r.sellerName && r.date) coveredSessions.add(`${String(r.sellerName).trim().toLowerCase()}_${r.date}`);
      // Also register today's date if route is today
      if (r.isToday) {
        if (r.sellerId) coveredSessions.add(`${String(r.sellerId).trim().toLowerCase()}_today`);
        if (r.sellerName) coveredSessions.add(`${String(r.sellerName).trim().toLowerCase()}_today`);
      }
    });

    // 2. Only synthesize fallback routes for visits that do NOT already belong to an explicit session
    const fallbackGroups = new Map<string, any>();

    scopedVisits.forEach(v => {
      if (!v.createdAt || !v.latitude || !v.longitude) return;
      const sId = String(v.sellerId || v.sellerEmail || v.sellerName || 'vendedor').trim().toLowerCase();
      const sName = v.sellerName || 'Asesor';
      const datePart = diaGuatemala(v.createdAt);
      const key = `${sId}_${datePart}`;
      const nameKey = `${String(sName).trim().toLowerCase()}_${datePart}`;
      const todayKey = isTodayGuatemala(datePart) ? `${sId}_today` : '';
      const todayNameKey = isTodayGuatemala(datePart) ? `${String(sName).trim().toLowerCase()}_today` : '';

      // If an explicit route session already exists for this seller/date (whether completed or active), NEVER synthesize a duplicate active route
      if (
        coveredSessions.has(key) || 
        coveredSessions.has(nameKey) || 
        (todayKey && coveredSessions.has(todayKey)) || 
        (todayNameKey && coveredSessions.has(todayNameKey))
      ) {
        return;
      }

      if (!fallbackGroups.has(key)) {
        fallbackGroups.set(key, {
          id: key,
          key,
          sellerId: v.sellerId || sId,
          sellerName: sName,
          date: datePart,
          status: isTodayGuatemala(datePart) ? 'active' : 'completed',
          isToday: isTodayGuatemala(datePart),
          startedAt: v.createdAt,
          startLatitude: v.latitude,
          startLongitude: v.longitude,
          visitsCount: 0,
          stops: []
        });
      }

      const group = fallbackGroups.get(key)!;
      group.visitsCount++;
      group.stops.push(v);
    });

    const mappedFallback = Array.from(fallbackGroups.values()).map(g => {
      const sortedStops = g.stops.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const lastStop = sortedStops[sortedStops.length - 1];
      return {
        ...g,
        endLatitude: g.endLatitude ?? lastStop?.latitude,
        endLongitude: g.endLongitude ?? lastStop?.longitude,
        finishedAt: g.finishedAt ?? (g.status === 'completed' ? lastStop?.createdAt : null),
        stops: sortedStops
      };
    });

    return [...mappedExplicit, ...mappedFallback].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return new Date(b.startedAt || b.date).getTime() - new Date(a.startedAt || a.date).getTime();
    });
  }, [sellerRoutes, scopedVisits]);

  const activeRoutes = useMemo(() => {
    return distinctSellerRoutes.filter(r => r.status === 'active');
  }, [distinctSellerRoutes]);

  const myActiveRoute = useMemo(() => {
    if (activeRoute && activeRoute.status === 'active') {
      const isMine = user.role === 'seller' ||
        (user.id && activeRoute.sellerId === user.id) ||
        (user.email && activeRoute.sellerEmail?.toLowerCase() === user.email.toLowerCase()) ||
        (user.name && activeRoute.sellerName?.toLowerCase() === user.name.toLowerCase());
      if (isMine) return activeRoute;
    }

    const uId = String(user.id || '').trim();
    const uEmail = String(user.email || '').trim().toLowerCase();
    const uName = String(user.name || '').trim().toLowerCase();

    const matched = activeRoutes.find(r => {
      const rId = String(r.sellerId || '').trim();
      const rEmail = String(r.sellerEmail || '').trim().toLowerCase();
      const rName = String(r.sellerName || '').trim().toLowerCase();
      return (
        (uId && rId === uId) ||
        (uEmail && (rEmail === uEmail || rId === uEmail)) ||
        (uName && rName === uName)
      );
    });

    if (matched) return matched;

    if (user.role === 'seller' && activeRoutes.length > 0) {
      return activeRoutes[0];
    }

    return null;
  }, [activeRoute, activeRoutes, user]);

  const teamActiveRoutes = useMemo(() => {
    if (user.role !== 'admin') return [];
    const sellerActiveMap = new Map<string, SellerRoute>();
    activeRoutes.forEach(r => {
      if (myActiveRoute && (r.id === myActiveRoute.id || r.sellerId === myActiveRoute.sellerId)) return;
      const rSellerId = String(r.sellerId || '').trim();
      const rSellerEmail = String(r.sellerEmail || '').trim().toLowerCase();
      const rSellerName = String(r.sellerName || '').trim().toLowerCase();
      const uId = String(user.id || '').trim();
      const uEmail = String(user.email || '').trim().toLowerCase();
      if (uId && rSellerId === uId) return;
      if (uEmail && rSellerEmail === uEmail) return;

      const sellerKey = rSellerId || rSellerEmail || rSellerName;
      if (!sellerKey) return;

      if (!sellerActiveMap.has(sellerKey)) {
        sellerActiveMap.set(sellerKey, r);
      } else {
        const existing = sellerActiveMap.get(sellerKey)!;
        const exTime = new Date(existing.startedAt || existing.date || 0).getTime();
        const curTime = new Date(r.startedAt || r.date || 0).getTime();
        if (curTime > exTime) {
          sellerActiveMap.set(sellerKey, r);
        }
      }
    });
    return Array.from(sellerActiveMap.values());
  }, [activeRoutes, myActiveRoute, user]);

  const handleInspectActiveRoute = (r: SellerRoute) => {
    setRouteSellerId(r.sellerId || r.sellerEmail || r.sellerName || 'all');
    const rDate = r.date || (r.startedAt ? r.startedAt.split('T')[0] : getGuatemalaTodayIso());
    setRouteDate(rDate);
    setIsRouteTraceActive(true);
    setActiveTab('routes');
    const mapEl = document.getElementById('client-visits-map-section');
    if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth' });
  };

  const historicalRoutes = useMemo(() => {
    return distinctSellerRoutes.filter(r => r.status === 'completed');
  }, [distinctSellerRoutes]);

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
      // Prioritize an active route session so admin tracks the ongoing seller
      if (routeSellerId === 'all' && user.role === 'admin') {
        const activeRouteSession = sellerRoutes.find(r => r.status === 'active');
        if (activeRouteSession) {
          setRouteSellerId(activeRouteSession.sellerId);
          setRouteDate(activeRouteSession.date || diaGuatemala(activeRouteSession.startedAt) || getGuatemalaTodayIso());
        } else {
          const sellerWithTodayVisits = availableSellers.find(s => s.todayVisits > 0) || availableSellers[0];
          if (sellerWithTodayVisits) {
            setRouteSellerId(sellerWithTodayVisits.id);
            const todayDate = getGuatemalaTodayIso();
            setRouteDate(todayDate);
          }
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
    const effectiveSeller = activeTab === 'routes' 
      ? routeSellerId 
      : (selectedSellerFilter !== 'all' ? selectedSellerFilter : routeSellerId);

    // Determine the exact target date for the route
    // If routeDate is 'all', default to today if there are active routes, or the latest route date
    let targetDate = routeDate;
    if (!targetDate || targetDate === 'all') {
      const activeOrLatest = activeRoutes[0] || distinctSellerRoutes[0];
      targetDate = activeOrLatest?.date || getGuatemalaTodayIso();
    }

    // Find the matching route session for this date & seller
    const matchedRoute = distinctSellerRoutes.find(r => {
      const rDate = r.date || diaGuatemala(r.startedAt || r.createdAt);
      if (rDate !== targetDate) return false;
      if (effectiveSeller !== 'all') {
        const eff = effectiveSeller.toLowerCase();
        const rId = String(r.sellerId || '').toLowerCase();
        const rEmail = String(r.sellerEmail || '').toLowerCase();
        const rName = String(r.sellerName || '').toLowerCase();
        return rId === eff || rEmail === eff || rName === eff;
      }
      return true;
    });

    const isRouteActive = matchedRoute ? (matchedRoute.status === 'active' && isTodayGuatemala(targetDate)) : false;

    // Filter scoped visits strictly belonging to this targetDate and seller
    const filtered = scopedVisits.filter(v => {
      if (!v.latitude || !v.longitude || isNaN(v.latitude) || isNaN(v.longitude)) return false;
      
      // Strict date match using Guatemala calendar date (never mix days!)
      const vDate = diaGuatemala(v.createdAt);
      if (vDate !== targetDate) return false;

      if (effectiveSeller !== 'all' && user.role === 'admin') {
        const eff = effectiveSeller.toLowerCase();
        const vId = String(v.sellerId || '').toLowerCase();
        const vEmail = String(v.sellerEmail || '').toLowerCase();
        const vName = String(v.sellerName || '').toLowerCase();
        if (vId !== eff && vEmail !== eff && vName !== eff) return false;
      }
      return true;
    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (filtered.length === 0 && !matchedRoute?.startedAt) {
      return {
        stops: [],
        totalDistanceKm: 0,
        totalDurationMins: 0,
        avgTimeBetweenStopsMins: 0,
        firstStopAt: null,
        lastStopAt: null,
        isOngoing: false,
        returnCycleDays: 14
      };
    }

    let totalDistanceKm = 0;
    const stops = filtered.map((v, idx) => {
      const prev = idx > 0 ? filtered[idx - 1] : null;
      let distFromPrevKm = 0;
      let minsFromPrev = 0;

      // Only connect consecutive stops if they belong to the SAME seller
      const isSameSeller = prev && (
        (prev.sellerId && v.sellerId && prev.sellerId === v.sellerId) ||
        (prev.sellerEmail && v.sellerEmail && prev.sellerEmail.toLowerCase() === v.sellerEmail.toLowerCase()) ||
        (prev.sellerName && v.sellerName && prev.sellerName.toLowerCase() === v.sellerName.toLowerCase())
      );

      if (prev && isSameSeller) {
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

    // Determine initial departure time (firstStopAt)
    let firstStopAt: string | null = null;
    if (matchedRoute?.startedAt && diaGuatemala(matchedRoute.startedAt) === targetDate) {
      if (firstStop && new Date(firstStop.createdAt).getTime() < new Date(matchedRoute.startedAt).getTime()) {
        firstStopAt = firstStop.createdAt;
      } else {
        firstStopAt = matchedRoute.startedAt;
      }
    } else {
      firstStopAt = firstStop?.createdAt || null;
    }

    // Determine end time of the route (lastStopAt)
    let lastStopAt: string | null = null;
    let isOngoing = false;

    if (isRouteActive) {
      lastStopAt = new Date().toISOString();
      isOngoing = true;
    } else if (matchedRoute?.finishedAt && diaGuatemala(matchedRoute.finishedAt) === targetDate) {
      lastStopAt = matchedRoute.finishedAt;
      isOngoing = false;
    } else if (lastStop) {
      lastStopAt = lastStop.createdAt;
      isOngoing = false;
    } else if (firstStopAt) {
      lastStopAt = firstStopAt;
      isOngoing = false;
    }

    let totalDurationMins = 0;
    if (firstStopAt && lastStopAt) {
      const startMs = new Date(firstStopAt).getTime();
      const endMs = new Date(lastStopAt).getTime();
      totalDurationMins = Math.max(0, Math.round((endMs - startMs) / 60000));
    }
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
      firstStopAt,
      lastStopAt,
      isOngoing,
      returnCycleDays
    };
  }, [visits, scopedVisits, distinctSellerRoutes, routeSellerId, selectedSellerFilter, activeTab, routeDate, user]);

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
    ? clients.filter(c => isClientOfSeller(c, user))
    : clients;
  const geotaggedCount = userClients.filter(c => c.latitude && c.longitude).length;
  const geotaggedPercentage = userClients.length > 0 ? Math.round((geotaggedCount / userClients.length) * 100) : 0;
  
  const todayVisits = scopedVisits.filter(v => isTodayGuatemala(v.createdAt));
  const todayVisitedClientsCount = new Set(todayVisits.map(v => v.clientId || v.clientName)).size;
  const todayTotalVisitsCount = todayVisits.length;

  const sellersTodayList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; clientCount: number; visitsCount: number }>();
    todayVisits.forEach(v => {
      const sId = v.sellerId || v.sellerEmail || v.sellerName || 'vendedor';
      const sName = v.sellerName || 'Asesor';
      if (!map.has(sId)) {
        map.set(sId, { id: sId, name: sName, clientCount: 0, visitsCount: 0 });
      }
      const entry = map.get(sId)!;
      entry.visitsCount++;
    });
    map.forEach((entry, sId) => {
      const clientsForSeller = new Set(todayVisits.filter(v => (v.sellerId || v.sellerEmail || v.sellerName) === sId).map(v => v.clientId || v.clientName));
      entry.clientCount = clientsForSeller.size;
    });
    return Array.from(map.values());
  }, [todayVisits]);

  const selectedVisitClient = useMemo(() => {
    if (!selectedVisitForDetail) return null;
    const cId = String(selectedVisitForDetail.clientId || '').trim();
    const cName = String(selectedVisitForDetail.clientName || '').trim().toLowerCase();
    const cCode = String(selectedVisitForDetail.clientCode || '').trim().toLowerCase();
    return clients.find(c => 
      String(c.id) === cId || 
      (c.name && c.name.trim().toLowerCase() === cName) || 
      (c.clientCode && c.clientCode.trim().toLowerCase() === cCode)
    ) || null;
  }, [selectedVisitForDetail, clients]);

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

      {/* OFFLINE VISITS QUEUE SYNC BANNER */}
      {offlineVisitsQueue.length > 0 && (
        <div className="bg-amber-600 text-white px-4 py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2.5 text-xs font-bold shadow-md animate-in fade-in">
          <div className="flex items-center gap-2">
            <WifiOff size={16} className="text-amber-200 shrink-0" />
            <span>
              Tienes {offlineVisitsQueue.length} {offlineVisitsQueue.length === 1 ? 'visita guardada' : 'visitas guardadas'} en terreno sin conexión (con coordenadas congeladas del sitio).
            </span>
          </div>
          <button
            type="button"
            onClick={handleSyncOfflineVisits}
            disabled={isSyncingVisits || !navigator.onLine}
            className="px-3 py-1 bg-white text-amber-950 rounded-xl text-xs font-black hover:bg-amber-50 active:scale-95 transition shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw size={12} className={cn(isSyncingVisits && "animate-spin text-amber-800")} />
            <span>{isSyncingVisits ? 'Sincronizando...' : (!navigator.onLine ? 'Esperando señal...' : 'Sincronizar Ahora')}</span>
          </button>
        </div>
      )}

      {syncVisitsMsg && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-md animate-in fade-in flex items-center gap-2">
          <Check size={16} />
          <span>{syncVisitsMsg}</span>
        </div>
      )}

      {activeTab !== 'control' && (
        <>
          {/* ACTIVE ROUTE / JORNADA STATUS BANNER */}
          <div className="space-y-2">
          {myActiveRoute && (
            <div className="bg-gradient-to-r from-emerald-700/90 to-teal-800/90 border border-emerald-500/30 text-white px-3.5 py-2.5 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Car size={16} className="text-white animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-300 text-emerald-950 uppercase tracking-wider">
                      🟢 En Ruta Activa
                    </span>
                    <span className="text-xs font-black text-white truncate">
                      👤 {user.role === 'admin' ? `Mi Ruta (Administrador: ${user.name || 'Tú'})` : `Mi Ruta (${user.name || myActiveRoute.sellerName || 'Asesor'})`}
                    </span>
                    <span className="text-[11px] text-emerald-200 font-medium">
                      · 🕒 {myActiveRoute.startedAt ? new Date(myActiveRoute.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hoy'}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-100 font-medium truncate mt-0.5">
                    📍 {scopedVisits.filter(v => isTodayGuatemala(v.createdAt) && (v.routeId === myActiveRoute.id || v.sellerId === myActiveRoute.sellerId || (myActiveRoute.sellerName && v.sellerName?.toLowerCase() === myActiveRoute.sellerName.toLowerCase()))).length} clientes visitados hoy en esta ruta
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => handleInspectActiveRoute(myActiveRoute)}
                  className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Route size={13} />
                  <span>Ver Recorrido</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRouteToFinish(myActiveRoute);
                    setShowFinishRouteModal(true);
                  }}
                  className="px-3 py-1.5 bg-white text-emerald-950 hover:bg-emerald-50 rounded-lg text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1"
                >
                  <Flag size={13} className="text-emerald-700" />
                  <span>🏁 Finalizar Ruta</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. If Admin and there are TEAM sellers in active route */}
          {user.role === 'admin' && teamActiveRoutes.length > 0 && (
            <div className="space-y-1.5">
              {teamActiveRoutes.map((r) => {
                const sellerVisitsToday = visits.filter(v => {
                  if (!isTodayGuatemala(v.createdAt)) return false;
                  if (v.routeId) {
                    return v.routeId === r.id;
                  }
                  const vSellerId = String(v.sellerId || '').trim();
                  const vSellerEmail = String(v.sellerEmail || '').trim().toLowerCase();
                  const vSellerName = String(v.sellerName || '').trim().toLowerCase();
                  const rSellerId = String(r.sellerId || '').trim();
                  const rSellerEmail = String(r.sellerEmail || '').trim().toLowerCase();
                  const rSellerName = String(r.sellerName || '').trim().toLowerCase();
                  return (
                    (rSellerId && vSellerId === rSellerId) ||
                    (rSellerEmail && vSellerEmail === rSellerEmail) ||
                    (rSellerName && vSellerName === rSellerName)
                  );
                }).length;

                return (
                  <div 
                    key={r.id || r.sellerId} 
                    className="bg-gradient-to-r from-emerald-900/90 to-teal-950/90 border border-emerald-500/30 text-white px-3.5 py-2 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                        <Car size={16} className="text-emerald-300 animate-pulse" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-400 text-emerald-950 uppercase tracking-wider">
                            🟢 Ruta Activa
                          </span>
                          <span className="text-xs font-black text-white bg-white/10 px-2 py-0.5 rounded border border-white/15">
                            👤 Asesor: {r.sellerName || 'Vendedor'}
                          </span>
                          <span className="text-[11px] text-emerald-200 font-medium">
                            · 🕒 Iniciada: {r.startedAt ? new Date(r.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hoy'}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-200/90 font-medium truncate mt-0.5">
                          📍 {sellerVisitsToday} {sellerVisitsToday === 1 ? 'cliente visitado' : 'clientes visitados'} hoy en esta ruta
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleInspectActiveRoute(r)}
                        className="px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Route size={13} />
                        <span>Ver Recorrido</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRouteToFinish(r);
                          setShowFinishRouteModal(true);
                        }}
                        className="px-2.5 py-1.5 bg-white/10 hover:bg-rose-500/20 text-rose-200 hover:text-white border border-white/10 hover:border-rose-400/30 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        title="Finalizar ruta de este asesor"
                      >
                        <Flag size={12} className="text-rose-400" />
                        <span>Finalizar</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {!myActiveRoute && (
                <div className="flex items-center justify-between text-xs px-3 py-1 text-slate-400 bg-slate-900/60 rounded-lg border border-slate-800/80">
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                    <Shield size={12} className="text-teal-400" />
                    <span>Supervisión activa ({teamActiveRoutes.length} {teamActiveRoutes.length === 1 ? 'asesor en campo' : 'asesores en campo'})</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleStartRoute}
                    disabled={isStartingRoute}
                    className="px-2.5 py-1 bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Car size={12} />
                    <span>{isStartingRoute ? 'Iniciando...' : '▶️ Iniciar Mi Ruta (Admin)'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. If NO active routes at all */}
          {!myActiveRoute && teamActiveRoutes.length === 0 && (
            user.role === 'seller' ? (
              <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    <Car size={16} className="text-slate-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        ⚪ Sin Jornada en Curso
                      </span>
                      <span className="text-[11px] font-bold text-slate-300">
                        · 👤 Asesor: {user.name || 'Tú'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Inicia tu ruta antes de salir a campo, o se iniciará automáticamente con tu primera visita registrada.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartRoute}
                  disabled={isStartingRoute}
                  className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0 self-end sm:self-center"
                >
                  <Car size={13} />
                  <span>{isStartingRoute ? 'Iniciando...' : '▶️ Iniciar Ruta de Hoy'}</span>
                </button>
              </div>
            ) : (
              <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    <Route size={16} className="text-teal-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-teal-400 uppercase tracking-wider">
                        🛡️ Panel de Rutas (Administración)
                      </span>
                      <span className="text-[11px] font-bold text-slate-400">
                        · ⚪ Sin rutas activas en campo hoy
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Supervisa dónde inician y cierran ruta tus vendedores, o inicia tu propia jornada si sales a visitas.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('routes');
                      const el = document.getElementById('routes-tab-control');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer border border-slate-700 flex items-center gap-1.5"
                  >
                    <Navigation size={12} className="text-teal-400" />
                    <span>Ver Rutas</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStartRoute}
                    disabled={isStartingRoute}
                    className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5"
                  >
                    <Car size={13} />
                    <span>{isStartingRoute ? 'Iniciando...' : '▶️ Iniciar Mi Ruta'}</span>
                  </button>
                </div>
              </div>
            )
          )}
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
          <div>
            <div className="flex items-baseline gap-2">
              <h4 className="text-3xl font-black text-slate-950">{todayVisitedClientsCount}</h4>
              <span className="text-xs font-bold text-slate-500">
                {todayVisitedClientsCount === 1 ? 'cliente visitado' : 'clientes visitados'}
              </span>
            </div>
            <p className="text-xs text-emerald-600 mt-1 font-semibold flex items-center gap-1">
              <Sparkles size={12} /> {todayTotalVisitsCount} {todayTotalVisitsCount === 1 ? 'parada registrada' : 'paradas registradas'}
            </p>
          </div>

          {sellersTodayList.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
              {sellersTodayList.map(s => (
                <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-teal-50 text-teal-900 border border-teal-100">
                  👤 {s.name}: <span className="text-teal-700 font-black">{s.clientCount} {s.clientCount === 1 ? 'cliente' : 'clientes'}</span> ({s.visitsCount} {s.visitsCount === 1 ? 'parada' : 'paradas'})
                </span>
              ))}
            </div>
          )}
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
            {geotaggedCount} <span className="text-sm font-semibold text-slate-400">/ {userClients.length}</span>
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
          clients={userClients}
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
          sellerRoutes={sellerRoutes}
          activeRoute={activeRoute}
          focusLocation={focusLocation}
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
                {routeAnalysis.firstStopAt ? new Date(routeAnalysis.firstStopAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''} - {routeAnalysis.isOngoing ? 'En curso' : (routeAnalysis.lastStopAt ? new Date(routeAnalysis.lastStopAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}
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
    </>
  )}

      {/* CONTROL & SUPERVISION TABS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Navigation Tabs Bar - Full Width Scrollable, Never squished */}
        <div className="p-3 sm:p-3.5 border-b border-slate-100 bg-slate-50/70 overflow-x-auto hide-scrollbar">
          {/* Segmented Tab Buttons */}
          <div className="flex items-center bg-slate-200/70 p-1 rounded-xl flex-nowrap gap-1 w-max">
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
                if (routeDate === 'all' || !routeDate) {
                  setRouteDate(getGuatemalaTodayIso());
                }
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
                <span>📸 Auditoría de Fotos & Ranking</span>
              </button>
            )}
            {user.role === 'admin' && (
              <button
                type="button"
                onClick={() => setActiveTab('control')}
                className={cn(
                  "px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5",
                  activeTab === 'control' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <BarChart3 size={14} className="text-teal-600" />
                <span>📊 Control Comercial & Lealtad</span>
              </button>
            )}
          </div>
        </div>

        {/* Search and Filters Dedicated Toolbar - Fully visible, responsive, zero overflow */}
        {activeTab !== 'control' && activeTab !== 'routes' && (
          <div className="p-3 sm:p-4 border-b border-slate-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder={activeTab === 'my_portfolio' ? "Buscar cliente, código o dirección..." : "Buscar cliente, notas o asesor..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium placeholder:text-slate-400 transition-all shadow-2xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  title="Borrar búsqueda"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Scope Badge for Sellers */}
              {activeTab === 'my_portfolio' && user.role === 'seller' && (
                <div className="flex items-center bg-teal-50 border border-teal-200/80 rounded-xl px-3 py-2 text-xs font-bold text-teal-800 shadow-2xs">
                  <span>👤 Mi Cartera Asignada</span>
                </div>
              )}

              {/* Date Range Filter */}
              {activeTab === 'timeline' && (
                <select
                  value={selectedDateRangeFilter}
                  onChange={(e) => setSelectedDateRangeFilter(e.target.value as any)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer shadow-2xs hover:border-slate-300"
                >
                  <option value="all">📅 Todas las Fechas</option>
                  <option value="today">📅 Solo Hoy</option>
                  <option value="7days">📅 Últimos 7 Días</option>
                  <option value="month">📅 Este Mes ({getNombreMesGuatemala(getMesActualGuatemala())})</option>
                  <option value="last_month">📅 Mes Pasado ({getNombreMesGuatemala(getMesPasadoGuatemala())})</option>
                </select>
              )}

              {/* Seller Filter for Admin */}
              {user.role === 'admin' && availableSellers.length > 0 && activeTab !== 'routes' && (
                <select
                  value={selectedSellerFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedSellerFilter(val);
                    setRouteSellerId(val);
                  }}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer shadow-2xs hover:border-slate-300"
                >
                  <option value="all">👤 Todos los Asesores</option>
                  {availableSellers.map(s => (
                    <option key={s.id} value={s.id}>👤 {s.name}</option>
                  ))}
                </select>
              )}

              {activeTab === 'my_portfolio' && (
                <>
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value as any)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer shadow-2xs hover:border-slate-300"
                  >
                    <option value="all">📍 Estado GPS: Todos</option>
                    <option value="with_location">📍 Con GPS Fijado</option>
                    <option value="no_gps">⚪ Sin GPS</option>
                  </select>

                  <select
                    value={frequencyFilter}
                    onChange={(e) => setFrequencyFilter(e.target.value as any)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer shadow-2xs hover:border-slate-300"
                  >
                    <option value="all">⏱️ Frecuencia: Todas</option>
                    <option value="urgent">🔴 Sin visita reciente (&gt;15 días)</option>
                    <option value="regular">🟢 Al día (&lt;7 días)</option>
                    <option value="never">⚪ Sin visitas</option>
                  </select>
                </>
              )}

              {/* Reset button if any filter is active */}
              {(searchTerm || selectedSellerFilter !== (user.role === 'seller' ? user.email || user.id : 'all') || locationFilter !== 'all' || frequencyFilter !== 'all' || (activeTab === 'timeline' && selectedDateRangeFilter !== 'all')) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    if (user.role === 'admin') {
                      setSelectedSellerFilter('all');
                      setRouteSellerId('all');
                    }
                    setLocationFilter('all');
                    setFrequencyFilter('all');
                    setSelectedDateRangeFilter('all');
                  }}
                  className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1 active:scale-95"
                  title="Restablecer filtros"
                >
                  <X size={13} />
                  <span>Limpiar</span>
                </button>
              )}
            </div>
          </div>
        )}

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

                      {/* Commercial Analytics Strip (Lealtad, Promedio de Compra, Frecuencia) */}
                      {(() => {
                        const sInfo = clientSalesMap.get(String(client.id).toLowerCase().trim()) 
                          || (client.clientCode ? clientSalesMap.get(String(client.clientCode).toLowerCase().trim()) : null) 
                          || clientSalesMap.get(normalizeSearchText(client.name));
                        if (!sInfo) return null;

                        return (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1.5 mt-1 border-t border-slate-100 text-[11px]">
                            {sInfo.totalSales > 0 ? (
                              <>
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 border",
                                  sInfo.daysSinceLastPurchase <= 15 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                  sInfo.daysSinceLastPurchase <= 45 ? "bg-amber-50 text-amber-700 border-amber-200" :
                                  "bg-rose-50 text-rose-700 border-rose-200"
                                )}>
                                  {sInfo.daysSinceLastPurchase <= 15 ? '🟢 Compra Frecuente' : sInfo.daysSinceLastPurchase <= 45 ? '🟡 Compra Moderada' : '🔴 Cliente En Riesgo'}
                                </span>

                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]" title="Ticket promedio de compra">
                                  🛒 Promedio: <strong>Q{sInfo.totalSales > 0 ? Math.round(sInfo.totalRevenue / sInfo.totalSales).toLocaleString('es-GT') : 0}</strong>
                                </span>

                                {sInfo.avgFrequencyDays > 0 && (
                                  <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 font-semibold text-[10px]" title="Frecuencia media de compra">
                                    ⏱️ Cada <strong>{sInfo.avgFrequencyDays} días</strong>
                                  </span>
                                )}

                                <span className="text-slate-500 text-[10px]">
                                  Última compra: <strong className={sInfo.daysSinceLastPurchase > 45 ? "text-rose-600 font-bold" : "text-slate-700 font-medium"}>
                                    {sInfo.daysSinceLastPurchase === 0 ? 'Hoy' : `hace ${sInfo.daysSinceLastPurchase}d`}
                                  </strong> ({sInfo.totalSales} {sInfo.totalSales === 1 ? 'pedido' : 'pedidos'})
                                </span>
                              </>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                                ⚪ Sin historial de facturas
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* View Last Visit Photo & Audit Button */}
                      {client.lastVisit && (
                        <button
                          type="button"
                          onClick={() => setSelectedVisitForDetail(client.lastVisit!)}
                          className="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                          title="Ver fotografía de comprobante y posición en el mapa de la última visita"
                        >
                          <span>📸 Ver Foto Visita</span>
                        </button>
                      )}

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
                          className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                          title="Borrar ubicación GPS guardada para este cliente"
                        >
                          <Trash2 size={13} />
                          <span>Borrar GPS</span>
                        </button>
                      )}

                      {/* Delete Client Completely (Admin) */}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteClient(client)}
                          className="p-2 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-95"
                          title="Eliminar cliente del sistema permanentemente"
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
                                  {r.startLatitude && r.startLongitude ? (
                                    <div className="text-[11px] text-teal-800 bg-teal-100/70 px-2 py-1 rounded-lg border border-teal-200/80 font-bold flex items-center gap-1 mt-1.5 shadow-2xs">
                                      <MapPin size={12} className="text-teal-600 shrink-0" />
                                      <span>Inicio: {r.startLatitude.toFixed(5)}, {r.startLongitude.toFixed(5)}</span>
                                      <a
                                        href={`https://www.google.com/maps?q=${r.startLatitude},${r.startLongitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-auto text-teal-700 hover:text-teal-900 underline text-[10px]"
                                        title="Abrir en Google Maps"
                                      >
                                        Maps
                                      </a>
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-amber-800 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 font-medium flex items-center justify-between gap-1 mt-1.5">
                                      <span>⚠️ Sin GPS inicial</span>
                                      {user.role === 'seller' && (
                                        <button
                                          type="button"
                                          onClick={handleUpdateActiveRouteGps}
                                          className="text-[10px] font-bold text-teal-800 underline cursor-pointer"
                                        >
                                          Fijar mi GPS actual
                                        </button>
                                      )}
                                    </div>
                                  )}
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

                                <button
                                  type="button"
                                  onClick={() => {
                                    setRouteToFinish(r);
                                    setShowFinishRouteModal(true);
                                  }}
                                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-emerald-950 border border-emerald-300 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                                  title="Cerrar y archivar esta jornada activa"
                                >
                                  <Flag size={13} className="text-emerald-600" />
                                  <span>Finalizar</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <span>No hay ninguna jornada activa en este momento. Puedes iniciar tu ruta para comenzar el día.</span>
                        <button
                          type="button"
                          onClick={handleStartRoute}
                          disabled={isStartingRoute}
                          className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition-all cursor-pointer shrink-0"
                        >
                          ▶️ Iniciar Ruta de Hoy
                        </button>
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
                        Rutas archivadas con puntos exactos de inicio y cierre
                      </span>
                    </div>

                    {historicalRoutes.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {historicalRoutes.map(r => {
                          const isSelected = (routeSellerId === r.sellerId || routeSellerId === 'all') && routeDate === r.date && isRouteTraceActive;
                          const hasClosureGps = Boolean(r.endLatitude && r.endLongitude);
                          const hasStartGps = Boolean(r.startLatitude && r.startLongitude);

                          return (
                            <div
                              key={r.key}
                              className={cn(
                                "p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2.5 shadow-2xs group",
                                isSelected 
                                  ? "bg-teal-50/90 border-teal-500 ring-2 ring-teal-500/20 shadow-sm" 
                                  : "bg-white hover:bg-slate-50/80 border-slate-200/80 hover:border-slate-300"
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
                                  🏁 Cerrada
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

                              {/* Puntos de GPS: Inicio y Cierre */}
                              <div className="space-y-1.5 text-[10px] bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs">
                                <div className="flex items-center justify-between text-emerald-800">
                                  <span className="font-black flex items-center gap-1">
                                    🟢 Inicio:
                                  </span>
                                  <span className="font-mono text-[9.5px] text-slate-600">
                                    {hasStartGps ? `${Number(r.startLatitude).toFixed(4)}, ${Number(r.startLongitude).toFixed(4)}` : 'Sin GPS'}
                                    {r.startedAt && ` • ${new Date(r.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-slate-900">
                                  <span className="font-black flex items-center gap-1">
                                    🏁 Cierre:
                                  </span>
                                  <span className="font-mono text-[9.5px] text-slate-600">
                                    {hasClosureGps ? `${Number(r.endLatitude).toFixed(4)}, ${Number(r.endLongitude).toFixed(4)}` : 'Última visita'}
                                    {r.finishedAt && ` • ${new Date(r.finishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                  </span>
                                </div>

                                {r.notes && (
                                  <div className="text-slate-600 text-[9.5px] italic pt-1 border-t border-slate-100">
                                    📝 "{r.notes}"
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100">
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {r.totalDurationMins ? `⏱️ ~${Math.floor(r.totalDurationMins / 60)}h ${r.totalDurationMins % 60}m` : 'Archivada'}
                                </span>

                                <div className="flex items-center gap-1">
                                  {hasClosureGps && (
                                    <button
                                      type="button"
                                      onClick={() => handleViewRouteClosure(r)}
                                      className="px-2 py-1 bg-slate-900 hover:bg-black text-white rounded-lg text-[10px] font-black transition-all cursor-pointer shadow-2xs flex items-center gap-1 active:scale-95"
                                      title="Centrar mapa en el punto exacto donde el vendedor finalizó su jornada"
                                    >
                                      <span>🏁 Ver Cierre</span>
                                    </button>
                                  )}
                                  {hasStartGps && (
                                    <button
                                      type="button"
                                      onClick={() => handleViewRouteStart(r)}
                                      className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer active:scale-95"
                                      title="Centrar mapa en el punto de inicio de la ruta"
                                    >
                                      <span>🟢 Inicio</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleSelectSpecificRoute(r.sellerId, r.date)}
                                    className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer active:scale-95"
                                    title="Trazar ruta completa con paradas en el mapa"
                                  >
                                    <span>Trazar ➔</span>
                                  </button>
                                </div>
                              </div>
                            </div>
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
                          <button 
                            type="button"
                            onClick={() => setSelectedVisitForDetail(visit)}
                            className="w-11 h-11 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-2xs hover:scale-105 transition-transform cursor-pointer"
                            title="Ver foto de comprobante"
                          >
                            <img src={visit.photoUrl} alt="Foto" className="w-full h-full object-cover" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedVisitForDetail(visit)}
                          className="px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold flex items-center gap-1 border border-teal-200 transition-colors cursor-pointer shadow-2xs"
                        >
                          <span>📸 Ver Detalle</span>
                        </button>
                        <a
                          href={googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-200 transition-colors"
                        >
                          <ExternalLink size={13} />
                          <span>Maps</span>
                        </a>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteVisit(visit)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold border border-rose-200 transition-colors cursor-pointer shadow-2xs active:scale-95"
                            title="Eliminar registro de visita"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 4: SELLERS RANKING & AUDITORÍA DE FOTOS */}
        {activeTab === 'sellers' && user.role === 'admin' && (
          <div className="p-6 space-y-8">
            {/* Ranking Cards */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="p-1.5 bg-teal-100 text-teal-800 rounded-lg">
                  <TrendingUp size={16} />
                </span>
                <h3 className="text-base font-black text-slate-900">Ranking de Rendimiento por Asesor</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <div className="col-span-full py-6 text-center text-slate-400">
                    <p className="font-bold text-sm">Sin datos de ranking aún</p>
                  </div>
                )}
              </div>
            </div>

            {/* Historial de Auditoría con Fotos & Modal */}
            <div className="pt-6 border-t border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <ImageIcon size={18} className="text-teal-600" />
                    Historial & Auditoría de Visitas con Fotografía de Prueba
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Haz clic en cualquier visita para ver en modal la fotografía, hora exacta, razón y posición GPS en el mapa.
                  </p>
                </div>
                <span className="text-xs font-bold bg-teal-50 text-teal-800 px-3 py-1 rounded-xl border border-teal-200 self-start sm:self-auto">
                  {filteredVisits.length} {filteredVisits.length === 1 ? 'visita registrada' : 'visitas registradas'}
                </span>
              </div>

              {/* Grid de Visitas con Foto */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVisits.map((visit) => (
                  <div
                    key={visit.id}
                    onClick={() => setSelectedVisitForDetail(visit)}
                    className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group space-y-3"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        {renderVisitBadge(visit.visitType)}
                        <span className="text-[11px] font-mono text-slate-500 font-bold flex items-center gap-1">
                          <Clock size={11} />
                          {new Date(visit.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-black text-sm text-slate-900 group-hover:text-teal-700 transition-colors leading-tight">
                          {visit.clientName}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                          <span>👤 {visit.sellerName || 'Asesor'}</span>
                          <span>•</span>
                          <span>{fechaDDMMYYYY(visit.createdAt)}</span>
                        </div>
                      </div>

                      {/* Photo Thumbnail Box */}
                      <div className="w-full h-40 rounded-xl bg-slate-900 overflow-hidden relative border border-slate-100 flex items-center justify-center">
                        {visit.photoUrl ? (
                          <img 
                            src={visit.photoUrl} 
                            alt={visit.clientName} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="text-center text-slate-400 p-3 space-y-1">
                            <ImageIcon size={24} className="mx-auto text-slate-600" />
                            <span className="text-[10px] font-bold block">Sin foto adjunta</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-teal-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-[1px]">
                          <span>🔍 Ver Foto & Mapa</span>
                        </div>
                      </div>

                      {visit.notes && (
                        <p className="text-[11px] text-slate-600 line-clamp-2 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                          "{visit.notes}"
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedVisitForDetail(visit);
                      }}
                      className="w-full py-2 bg-slate-50 group-hover:bg-teal-600 group-hover:text-white text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 border border-slate-200 group-hover:border-teal-600 cursor-pointer"
                    >
                      <span>📸 Abrir Auditoría & Mapa</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CONTROL COMERCIAL, LEALTAD & SEGUIMIENTO DE CLIENTES */}
        {activeTab === 'control' && user.role === 'admin' && (
          <div className="p-2 sm:p-4">
            <ClientSalesTrackingPage
              user={user}
              isMobile={isMobile}
              embedded={true}
              onCoordinatesUpdated={() => {
                loadData(true);
              }}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <VisitDetailModal
        isOpen={Boolean(selectedVisitForDetail)}
        onClose={() => setSelectedVisitForDetail(null)}
        visit={selectedVisitForDetail}
        client={selectedVisitClient}
        onDeleteVisit={handleDeleteVisit}
        isAdmin={isAdmin}
      />
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
        teamUsers={teamUsers}
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
        onRefreshGps={requestLocation}
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

            {(() => {
              const targetToClose = routeToFinish || activeRoute;
              const targetSeller = targetToClose?.sellerName || user.name || 'Asesor';
              const targetStops = targetToClose 
                ? scopedVisits.filter(v => v.routeId === targetToClose.id || (v.sellerId === targetToClose.sellerId && isTodayGuatemala(v.createdAt))).length
                : scopedVisits.filter(v => isTodayGuatemala(v.createdAt)).length;
              return (
                <>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">¿Finalizar Jornada de Ruta?</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Al finalizar, la jornada de <strong>{targetSeller}</strong> se cerrará con las paradas registradas y su ubicación GPS de cierre pasará automáticamente al <strong>Historial de Rutas</strong>.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Asesor:</span>
                      <span className="font-bold text-slate-900">👤 {targetSeller}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Clientes visitados hoy:</span>
                      <span className="font-bold text-slate-800">{targetStops} paradas</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Hora de inicio:</span>
                      <span className="font-mono text-slate-800">{targetToClose?.startedAt ? new Date(targetToClose.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hoy'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Hora de cierre:</span>
                      <span className="font-mono text-emerald-700 font-bold">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200/60 pt-1.5">
                      <span className="text-slate-500 font-medium">GPS de Cierre:</span>
                      <span className="font-mono text-slate-700 text-[11px]">
                        {currentLocation ? `${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}` : 'Se registrará ubicación actual'}
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}

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
                onClick={() => {
                  setShowFinishRouteModal(false);
                  setRouteToFinish(null);
                }}
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
