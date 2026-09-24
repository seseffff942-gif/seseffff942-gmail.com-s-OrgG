import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Client, ClientVisit, User, SellerRoute } from '../types';
import L from 'leaflet';
import { 
  Navigation, Layers, MapPin, Compass, ExternalLink, 
  Phone, Building2, Clock, CheckCircle2, AlertTriangle, 
  Plus, RefreshCw, ZoomIn, ZoomOut, Search, X, Crosshair,
  Calendar, Maximize2, Minimize2, Eye, EyeOff
} from 'lucide-react';
import { cn, fechaDDMMYYYY, normalizeSearchText, isClientOfSeller, diaGuatemala, getMesPasadoGuatemala, getDiffCalendarDaysGT } from '../utils';

interface ClientVisitsMapProps {
  clients: Client[];
  visits: ClientVisit[];
  currentLocation: { latitude: number; longitude: number; accuracy?: number } | null;
  currentUser: User;
  onSelectClientForVisit: (client: Client) => void;
  onOpenMarkClientModal: () => void;
  onOpenRegisterVisitModal: () => void;
  onRefreshGps: () => void;
  isGpsLoading?: boolean;
  // Route Tracing Props
  routeSellerId?: string;
  routeDate?: string;
  isRouteTraceActive?: boolean;
  onSelectRouteVisit?: (visit: ClientVisit) => void;
  onOpenMarkClientModalForClient?: (client: Client) => void;
  onClearClientLocation?: (client: Client) => void;
  sellerRoutes?: SellerRoute[];
  activeRoute?: SellerRoute | null;
  focusLocation?: { latitude: number; longitude: number; label?: string } | null;
}

interface RegionShortcut {
  id: string;
  name: string;
  coords: [number, number];
  zoom: number;
  icon: string;
}

const GUATEMALA_REGIONS: RegionShortcut[] = [
  { id: 'all', name: 'Todo el País', coords: [15.2, -90.35], zoom: 8, icon: '🇬🇹' },
  { id: 'capital', name: 'Central / Capital', coords: [14.6349, -90.5069], zoom: 12, icon: '🏛️' },
  { id: 'peten', name: 'Petén', coords: [16.6500, -89.7500], zoom: 9, icon: '🌲' },
  { id: 'verapaces', name: 'Verapaces (Cobán/Salama)', coords: [15.4700, -90.3700], zoom: 10, icon: '⛰️' },
  { id: 'occidente', name: 'Occidente (Xela)', coords: [14.8347, -91.5181], zoom: 11, icon: '🌄' },
  { id: 'oriente', name: 'Oriente (Zacapa/Chiquimula)', coords: [14.9722, -89.5306], zoom: 10, icon: '☀️' },
  { id: 'sur', name: 'Sur (Escuintla/Costa)', coords: [14.3009, -90.7850], zoom: 10, icon: '🌴' }
];
export function ClientVisitsMap({
  clients,
  visits,
  currentLocation,
  currentUser,
  onSelectClientForVisit,
  onOpenMarkClientModal,
  onOpenRegisterVisitModal,
  onRefreshGps,
  isGpsLoading = false,
  routeSellerId = 'all',
  routeDate = 'all',
  isRouteTraceActive = true,
  onSelectRouteVisit,
  onOpenMarkClientModalForClient,
  onClearClientLocation,
  sellerRoutes,
  activeRoute,
  focusLocation
}: ClientVisitsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const clientMarkersMapRef = useRef<Map<string, L.Marker>>(new Map());

  const [mapType, setMapType] = useState<'satellite' | 'earth' | 'streets' | 'terrain' | 'esri'>('satellite');
  const [activeFilter, setActiveFilter] = useState<'all' | 'visited' | 'pending'>('all');
  const [mapDateFilter, setMapDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last_month'>('all');
  const [mapSearchTerm, setMapSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');

  // Fullscreen & Clean View Controls
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const GUATEMALA_CENTER: [number, number] = [15.2, -90.35];

  // Handler to clear all client pins from the map
  const handleClearAllPins = () => {
    if (clientMarkersMapRef.current && markersLayerRef.current) {
      clientMarkersMapRef.current.forEach((marker) => {
        markersLayerRef.current?.removeLayer(marker);
      });
      clientMarkersMapRef.current.clear();
    }
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  // Keep map dimensions responsive to fullscreen and window changes
  useEffect(() => {
    const t1 = setTimeout(() => mapInstanceRef.current?.invalidateSize(), 80);
    const t2 = setTimeout(() => mapInstanceRef.current?.invalidateSize(), 250);
    const t3 = setTimeout(() => mapInstanceRef.current?.invalidateSize(), 500);

    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  // Handle Esc key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Toggle visibility of clear-pins button based on showControls
  useEffect(() => {
    const clearBtnEl = document.getElementById('leaflet-clear-pins-btn');
    if (clearBtnEl) {
      clearBtnEl.style.display = showControls ? 'flex' : 'none';
    }
  }, [showControls]);

  // Compute visits stats by date range for filter dropdown
  const userClients = useMemo(() => {
    return currentUser.role === 'seller' ? clients.filter(c => isClientOfSeller(c, currentUser)) : clients;
  }, [clients, currentUser]);

  const dateCounts = useMemo(() => {
    let today = 0;
    let yesterday = 0;
    let week = 0;
    let month = 0;
    const todayGT = diaGuatemala();
    const currentMonthGT = todayGT.slice(0, 7);

    // Build client latest visit map
    const cMap = new Map<string, ClientVisit>();
    visits.forEach(v => {
      if (!v.createdAt) return;
      const cId = String(v.clientId || (v as any).client_id || '').trim();
      const cName = String(v.clientName || (v as any).client_name || '').trim().toLowerCase();
      const cCode = String(v.clientCode || (v as any).client_code || '').trim().toLowerCase();
      const checkAndSet = (k: string) => {
        const ex = cMap.get(k);
        if (!ex || new Date(v.createdAt).getTime() > new Date(ex.createdAt).getTime()) {
          cMap.set(k, v);
        }
      };
      if (cId) checkAndSet(cId);
      if (cName) checkAndSet(cName);
      if (cCode) checkAndSet(cCode);
    });

    userClients.forEach(c => {
      if (!c.latitude || !c.longitude) return;
      const cIdKey = String(c.id || '').trim();
      const cNameKey = String(c.name || '').trim().toLowerCase();
      const cCodeKey = String(c.clientCode || '').trim().toLowerCase();
      const lv = cMap.get(cIdKey) || cMap.get(cNameKey) || (cCodeKey ? cMap.get(cCodeKey) : undefined);
      if (!lv) return;
      const diff = getDiffCalendarDaysGT(lv.createdAt, todayGT);
      if (diff === 0) today++;
      if (diff === 1) yesterday++;
      if (diff !== null && diff >= 0 && diff <= 7) week++;
      if (diaGuatemala(lv.createdAt).slice(0, 7) === currentMonthGT) month++;
    });

    return { today, yesterday, week, month };
  }, [userClients, visits]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = currentLocation?.latitude || GUATEMALA_CENTER[0];
    const initialLng = currentLocation?.longitude || GUATEMALA_CENTER[1];
    const initialZoom = currentLocation ? 12 : 8;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false,
      maxZoom: 21
    });

    // Custom clear pins control
    const clearBtn = new (L as any).Control({ position: 'topright' });
    clearBtn.onAdd = () => {
      const btn = L.DomUtil.create('button', 'hidden');
      btn.id = 'leaflet-clear-pins-btn';
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleClearAllPins();
      };
      return btn;
    };
    clearBtn.addTo(map);

    const initialTiles = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      subdomains: '0123',
      maxZoom: 21,
      maxNativeZoom: 20,
      attribution: '&copy; Google Maps'
    });

    initialTiles.addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;

    const routeGroup = L.layerGroup().addTo(map);
    routeLayerRef.current = routeGroup;

    mapInstanceRef.current = map;

    // Trigger invalidateSize after container mounts
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch Layer (Satellite vs Streets vs Terrain vs NASA)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    if (mapType === 'satellite') {
      L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        subdomains: '0123',
        maxZoom: 21,
        maxNativeZoom: 20,
        attribution: '&copy; Google Maps'
      }).addTo(map);
    } else if (mapType === 'earth') {
      L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        subdomains: '0123',
        maxZoom: 21,
        maxNativeZoom: 20,
        attribution: '&copy; Google Earth'
      }).addTo(map);
    } else if (mapType === 'streets') {
      L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        subdomains: '0123',
        maxZoom: 21,
        maxNativeZoom: 20,
        attribution: '&copy; Google Maps'
      }).addTo(map);
    } else if (mapType === 'terrain') {
      L.tileLayer('https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
        subdomains: '0123',
        maxZoom: 21,
        maxNativeZoom: 20,
        attribution: '&copy; Google Terrain'
      }).addTo(map);
    } else if (mapType === 'esri') {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '&copy; Esri World Imagery'
      }).addTo(map);
    }
  }, [mapType]);

  // User GPS Pin & Accuracy Circle
  useEffect(() => {
    if (!mapInstanceRef.current || !currentLocation) return;
    const map = mapInstanceRef.current;

    const userLatLng: [number, number] = [currentLocation.latitude, currentLocation.longitude];

    const userHtml = `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-9 h-9 rounded-full bg-teal-500/25 animate-ping"></div>
        <div class="w-5 h-5 rounded-full bg-teal-700 border-2 border-white shadow-lg flex items-center justify-center text-white">
          <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
        </div>
      </div>
    `;

    const userIcon = L.divIcon({
      className: 'custom-map-user-pin',
      html: userHtml,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(userLatLng);
    } else {
      userMarkerRef.current = L.marker(userLatLng, { icon: userIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup(`
          <div class="p-3.5 text-xs font-sans">
            <p class="font-bold text-teal-900 text-sm flex items-center gap-1">📍 Tu Posición Actual</p>
            <p class="text-slate-500 text-[11px] font-mono mt-1">${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}</p>
            ${currentLocation.accuracy ? `<p class="text-[10px] text-teal-700 font-bold mt-1 bg-teal-50 px-2 py-0.5 rounded border border-teal-100 w-fit">Precisión GPS: ±${Math.round(currentLocation.accuracy)}m</p>` : ''}
          </div>
        `);
    }

    if (currentLocation.accuracy && currentLocation.accuracy < 1000) {
      if (userAccuracyCircleRef.current) {
        userAccuracyCircleRef.current.setLatLng(userLatLng);
        userAccuracyCircleRef.current.setRadius(currentLocation.accuracy);
      } else {
        userAccuracyCircleRef.current = L.circle(userLatLng, {
          radius: currentLocation.accuracy,
          color: '#00696a',
          fillColor: '#00696a',
          fillOpacity: 0.08,
          weight: 1.5
        }).addTo(map);
      }
    }
  }, [currentLocation]);

  // Center/Fly to focused location when requested (e.g., viewing route start or closure point)
  useEffect(() => {
    if (focusLocation && mapInstanceRef.current) {
      mapInstanceRef.current.setView([focusLocation.latitude, focusLocation.longitude], 16, { animate: true });
    }
  }, [focusLocation]);

  // Client Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const markersGroup = markersLayerRef.current;
    markersGroup.clearLayers();
    clientMarkersMapRef.current.clear();

    // Map each client to their truly latest visit chronologically
    const clientVisitMap = new Map<string, ClientVisit>();
    visits.forEach(v => {
      if (!v.createdAt) return;
      const cId = String(v.clientId || (v as any).client_id || '').trim();
      const cName = String(v.clientName || (v as any).client_name || '').trim().toLowerCase();
      const cCode = String(v.clientCode || (v as any).client_code || '').trim().toLowerCase();

      const updateIfNewer = (key: string) => {
        const existing = clientVisitMap.get(key);
        if (!existing || new Date(v.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
          clientVisitMap.set(key, v);
        }
      };

      if (cId) updateIfNewer(cId);
      if (cName) updateIfNewer(cName);
      if (cCode) updateIfNewer(cCode);
    });

    const todayGT = diaGuatemala();
    const currentMonthGT = todayGT.slice(0, 7);
    const lastMonthGT = getMesPasadoGuatemala();
    const searchTermNorm = normalizeSearchText(mapSearchTerm);

    const userClients = currentUser.role === 'seller' ? clients.filter(c => isClientOfSeller(c, currentUser)) : clients;

    const filteredClients = userClients.filter(c => {
      if (!c.latitude || !c.longitude || isNaN(c.latitude) || isNaN(c.longitude)) return false;
      
      const cIdKey = String(c.id || '').trim();
      const cNameKey = String(c.name || '').trim().toLowerCase();
      const cCodeKey = String(c.clientCode || '').trim().toLowerCase();
      const lastVisit = clientVisitMap.get(cIdKey) || clientVisitMap.get(cNameKey) || (cCodeKey ? clientVisitMap.get(cCodeKey) : undefined);
      
      const diffDays = lastVisit ? getDiffCalendarDaysGT(lastVisit.createdAt, todayGT) : null;
      const isRecentlyVisited = diffDays !== null && diffDays <= 7;

      // Status Filter
      if (activeFilter === 'visited' && !lastVisit) return false;
      if (activeFilter === 'pending' && isRecentlyVisited) return false;

      // Date Range Filter (Estilo Ventas)
      if (mapDateFilter !== 'all') {
        if (!lastVisit) return false;
        const vDia = diaGuatemala(lastVisit.createdAt);
        if (mapDateFilter === 'today' && diffDays !== 0) return false;
        if (mapDateFilter === 'yesterday' && diffDays !== 1) return false;
        if (mapDateFilter === 'week' && (diffDays === null || diffDays > 7 || diffDays < 0)) return false;
        if (mapDateFilter === 'month' && vDia.slice(0, 7) !== currentMonthGT) return false;
        if (mapDateFilter === 'last_month' && vDia.slice(0, 7) !== lastMonthGT) return false;
      }

      if (searchTermNorm) {
        const matchName = normalizeSearchText(c.name).includes(searchTermNorm);
        const matchCode = normalizeSearchText(c.clientCode).includes(searchTermNorm);
        const matchCompany = normalizeSearchText(c.companyName).includes(searchTermNorm);
        const matchDept = normalizeSearchText(c.address).includes(searchTermNorm);
        if (!matchName && !matchCode && !matchCompany && !matchDept) return false;
      }

      return true;
    });

    filteredClients.forEach(client => {
      if (!client.latitude || !client.longitude) return;

      const cIdKey = String(client.id || '').trim();
      const cNameKey = String(client.name || '').trim().toLowerCase();
      const cCodeKey = String(client.clientCode || '').trim().toLowerCase();
      const lastVisit = clientVisitMap.get(cIdKey) || clientVisitMap.get(cNameKey) || (cCodeKey ? clientVisitMap.get(cCodeKey) : undefined);
      
      // Calculate exact Guatemala calendar day difference
      const diffDays = lastVisit ? getDiffCalendarDaysGT(lastVisit.createdAt, todayGT) : null;
      const isToday = diffDays === 0;
      const isYesterday = diffDays === 1;
      const isVisitedRecently = diffDays !== null && diffDays <= 7;
      const isUrgent = diffDays !== null && diffDays > 15;

      const pinColor = isToday 
        ? '#10b981' // Verde esmeralda vivo para HOY
        : isYesterday 
          ? '#0284c7' // Azul cielo para AYER
          : isVisitedRecently 
            ? '#0d9488' // Teal para esta semana (<7d)
            : isUrgent 
              ? '#ef4444' // Rojo para urgente (>15d)
              : lastVisit 
                ? '#00696a' // Verde azulado estándar
                : '#64748b'; // Slate para clientes sin visita

      const badgeText = diffDays === null 
        ? 'Sin Visita' 
        : isToday 
          ? 'Hoy' 
          : isYesterday 
            ? 'Ayer' 
            : `${diffDays}d`;

      const badgeStyle = isToday
        ? 'background: linear-gradient(135deg, #059669, #10b981); box-shadow: 0 2px 6px rgba(16,185,129,0.45);'
        : isYesterday
          ? 'background: linear-gradient(135deg, #0284c7, #38bdf8); box-shadow: 0 2px 6px rgba(2,132,199,0.45);'
          : `background-color: ${pinColor};`;

      const pinHtml = `
        <div class="flex flex-col items-center group cursor-pointer">
          <div class="px-2 py-0.5 rounded-full text-[9px] font-black text-white transition-transform transform group-hover:scale-110 whitespace-nowrap mb-0.5 font-sans" style="${badgeStyle}">
            ${badgeText}
          </div>
          <div class="w-6 h-6 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white text-[11px] font-bold transition-transform group-hover:scale-110" style="background-color: ${pinColor}">
            📍
          </div>
        </div>
      `;

      const pinIcon = L.divIcon({
        className: 'custom-map-client-pin',
        html: pinHtml,
        iconSize: [40, 48],
        iconAnchor: [20, 44],
        popupAnchor: [0, -42]
      });

      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${client.latitude},${client.longitude}`;
      const wazeUrl = `https://waze.com/ul?ll=${client.latitude},${client.longitude}&navigate=yes`;

      const popupContent = document.createElement('div');
      popupContent.className = 'p-3.5 text-slate-800 text-xs max-w-xs space-y-2.5 font-sans';
      popupContent.innerHTML = `
        <div class="border-b border-slate-100 pb-2">
          <div class="flex items-center justify-between gap-2">
            <h4 class="font-bold text-sm text-slate-900 leading-snug">${client.name}</h4>
            ${client.clientCode ? `<span class="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">#${client.clientCode}</span>` : ''}
          </div>
          ${client.companyName ? `<p class="text-slate-500 text-[11px] font-medium mt-0.5">${client.companyName}</p>` : ''}
        </div>

        <div class="space-y-1 text-[11px] text-slate-600">
          ${client.phone ? `<p class="flex items-center gap-1.5">📞 <a href="tel:${client.phone}" class="text-teal-700 font-bold hover:underline">${client.phone}</a></p>` : ''}
          ${client.address ? `<p class="flex items-center gap-1.5 text-slate-500">🏢 ${client.address}</p>` : ''}
          <p class="flex items-center gap-1.5 font-medium">
            🕒 Última Visita: ${
              !lastVisit 
                ? '<span class="text-slate-400 font-bold">Sin visitas registradas</span>' 
                : isToday 
                  ? `<span class="text-emerald-700 font-black bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Hoy · ${new Date(lastVisit.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`
                  : isYesterday
                    ? `<span class="text-sky-700 font-black bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">Ayer · ${new Date(lastVisit.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`
                    : `<span class="${isUrgent ? 'text-rose-700 font-black' : 'text-slate-700 font-bold'}">Hace ${diffDays} días (${fechaDDMMYYYY(lastVisit.createdAt)})</span>`
            }
          </p>
        </div>

        <div class="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
          <button id="visit-btn-${client.id}" class="w-full py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold rounded-xl text-center transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer text-xs">
            📌 Registrar Visita Aquí
          </button>
          <div class="flex gap-1.5">
            <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="flex-1 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-center transition-colors flex items-center justify-center gap-1 text-[10px]">
              🗺️ Google Maps
            </a>
            <a href="${wazeUrl}" target="_blank" rel="noopener noreferrer" class="flex-1 py-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200/60 text-sky-800 font-bold rounded-xl text-center transition-colors flex items-center justify-center gap-1 text-[10px]">
              🚗 Waze
            </a>
          </div>
          <div class="flex gap-1.5 pt-1 border-t border-slate-100/80">
            <button id="remark-btn-${client.id}" class="flex-1 py-1 px-2 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold rounded-lg text-center text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors">
              📍 Refijar GPS
            </button>
            <button id="clear-gps-btn-${client.id}" class="py-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-center text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors" title="Borrar ubicación guardada">
              🗑️ Borrar GPS
            </button>
          </div>
        </div>
      `;

      const marker = L.marker([client.latitude, client.longitude], { icon: pinIcon })
        .addTo(markersGroup)
        .bindPopup(popupContent);

      clientMarkersMapRef.current.set(client.id, marker);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`visit-btn-${client.id}`);
        if (btn) {
          btn.onclick = () => {
            onSelectClientForVisit(client);
            marker.closePopup();
          };
        }

        const remarkBtn = document.getElementById(`remark-btn-${client.id}`);
        if (remarkBtn) {
          remarkBtn.onclick = () => {
            if (onOpenMarkClientModalForClient) {
              onOpenMarkClientModalForClient(client);
            } else {
              onOpenMarkClientModal();
            }
            marker.closePopup();
          };
        }

        const clearGpsBtn = document.getElementById(`clear-gps-btn-${client.id}`);
        if (clearGpsBtn) {
          clearGpsBtn.onclick = () => {
            if (onClearClientLocation) {
              onClearClientLocation(client);
            }
            marker.closePopup();
          };
        }
      });
    });
  }, [clients, visits, activeFilter, mapDateFilter, mapSearchTerm, onOpenMarkClientModalForClient, onClearClientLocation]);

  // Draw Sequential Route Polyline & Stops (Admin Route Audit)
  useEffect(() => {
    if (!mapInstanceRef.current || !routeLayerRef.current) return;
    const routeGroup = routeLayerRef.current;
    routeGroup.clearLayers();

    if (!isRouteTraceActive) return;

    if ((!routeSellerId || routeSellerId === 'all') && (!routeDate || routeDate === 'all')) {
      return;
    }

    let targetDate = routeDate;
    if (!targetDate || targetDate === 'all') {
      const activeOrLatest = (sellerRoutes || []).find(r => r.status === 'active') || activeRoute || (sellerRoutes || [])[0];
      targetDate = activeOrLatest?.date || diaGuatemala(activeOrLatest?.startedAt || activeOrLatest?.createdAt) || diaGuatemala();
    }

    const routeVisits = visits.filter(v => {
      if (!v.latitude || !v.longitude || isNaN(v.latitude) || isNaN(v.longitude)) return false;
      if (routeSellerId && routeSellerId !== 'all') {
        const eff = routeSellerId.toLowerCase();
        const vId = String(v.sellerId || '').toLowerCase();
        const vEmail = String(v.sellerEmail || '').toLowerCase();
        const vName = String(v.sellerName || '').toLowerCase();
        if (vId !== eff && vEmail !== eff && vName !== eff) return false;
      }
      // Strict Guatemala date filter: never connect visits across different days!
      const vDate = diaGuatemala(v.createdAt);
      if (vDate !== targetDate) return false;
      return true;
    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const matchedRoute = (sellerRoutes || []).find(r => {
      if (routeVisits[0] && (r.id === (routeVisits[0] as any)?.routeId)) return true;
      const rDate = r.date || diaGuatemala(r.startedAt || r.createdAt);
      const matchSeller = routeSellerId !== 'all' ? (
        r.sellerId === routeSellerId || 
        r.sellerEmail?.toLowerCase() === routeSellerId.toLowerCase() ||
        r.sellerName?.toLowerCase() === routeSellerId.toLowerCase()
      ) : true;
      const matchDate = rDate === targetDate;
      return matchSeller && matchDate;
    }) || activeRoute;

    const hasRouteStart = Boolean(matchedRoute?.startLatitude && matchedRoute?.startLongitude);
    const hasRouteEnd = Boolean(matchedRoute?.endLatitude && matchedRoute?.endLongitude);

    if (routeVisits.length === 0 && !hasRouteStart && !hasRouteEnd) return;

    const latLngs: [number, number][] = [];
    const startPoint: [number, number] | null = hasRouteStart ? [matchedRoute!.startLatitude!, matchedRoute!.startLongitude!] : null;
    const endPoint: [number, number] | null = hasRouteEnd ? [matchedRoute!.endLatitude!, matchedRoute!.endLongitude!] : null;

    if (startPoint) latLngs.push(startPoint);
    routeVisits.forEach(v => latLngs.push([v.latitude, v.longitude]));
    if (endPoint) latLngs.push(endPoint);

    if (latLngs.length > 1) {
      const polyline = L.polyline(latLngs, {
        color: '#00696a',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: '10, 10'
      }).addTo(routeGroup);

      if (!focusLocation) {
        mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [60, 60], maxZoom: 14 });
      }
    }

    let startMarkerInstance: L.Marker | null = null;
    let endMarkerInstance: L.Marker | null = null;

    if (startPoint && matchedRoute) {
      const startTime = matchedRoute.startedAt ? new Date(matchedRoute.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const startHtml = `
        <div class="flex flex-col items-center group cursor-pointer">
          <div class="px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow-md mb-0.5 whitespace-nowrap font-mono tracking-tight bg-emerald-600">
            🟢 INICIO DE RUTA ${startTime ? `· ${startTime}` : ''}
          </div>
          <div class="w-8 h-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-white text-sm font-black bg-emerald-600 transition-transform group-hover:scale-125">
            🏁
          </div>
        </div>
      `;
      const startIcon = L.divIcon({
        className: 'custom-map-route-start-pin',
        html: startHtml,
        iconSize: [52, 58],
        iconAnchor: [26, 54],
        popupAnchor: [0, -50]
      });

      startMarkerInstance = L.marker(startPoint, { icon: startIcon, zIndexOffset: 2500 })
        .addTo(routeGroup)
        .bindPopup(`
          <div class="p-3 text-slate-800 text-xs font-sans space-y-1.5">
            <span class="text-[10px] font-black px-2 py-0.5 rounded-full text-white bg-emerald-600">
              🏁 Punto de Partida / Apertura
            </span>
            <h4 class="font-black text-slate-900 text-sm mt-1">${matchedRoute.sellerName || 'Asesor'}</h4>
            ${matchedRoute.startAddress ? `<p class="text-slate-600 text-[11px]">📍 ${matchedRoute.startAddress}</p>` : ''}
            <p class="text-slate-400 text-[10px]">Hora: ${startTime || 'Inicio de jornada'}</p>
          </div>
        `);
    }

    if (endPoint && matchedRoute) {
      const endTime = matchedRoute.endedAt ? new Date(matchedRoute.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const endHtml = `
        <div class="flex flex-col items-center group cursor-pointer">
          <div class="px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow-md mb-0.5 whitespace-nowrap font-mono tracking-tight bg-rose-600">
            🔴 CIERRE DE RUTA ${endTime ? `· ${endTime}` : ''}
          </div>
          <div class="w-8 h-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-white text-sm font-black bg-rose-600 transition-transform group-hover:scale-125">
            🛑
          </div>
        </div>
      `;
      const endIcon = L.divIcon({
        className: 'custom-map-route-end-pin',
        html: endHtml,
        iconSize: [52, 58],
        iconAnchor: [26, 54],
        popupAnchor: [0, -50]
      });

      endMarkerInstance = L.marker(endPoint, { icon: endIcon, zIndexOffset: 2600 })
        .addTo(routeGroup)
        .bindPopup(`
          <div class="p-3 text-slate-800 text-xs font-sans space-y-1.5">
            <span class="text-[10px] font-black px-2 py-0.5 rounded-full text-white bg-rose-600">
              🛑 Cierre de Jornada / Fin de Ruta
            </span>
            <h4 class="font-black text-slate-900 text-sm mt-1">${matchedRoute.sellerName || 'Asesor'}</h4>
            ${matchedRoute.endAddress ? `<p class="text-slate-600 text-[11px]">📍 ${matchedRoute.endAddress}</p>` : ''}
            <p class="text-slate-400 text-[10px]">Hora cierre: ${endTime || 'Cierre registrado'}</p>
            ${matchedRoute.closureNotes ? `<p class="italic text-slate-600 bg-slate-50 p-1 rounded border">"${matchedRoute.closureNotes}"</p>` : ''}
          </div>
        `);
    }

    routeVisits.forEach((v, idx) => {
      const stepNum = idx + 1;
      const isStart = idx === 0 && !hasRouteStart;
      const isEnd = idx === routeVisits.length - 1 && !hasRouteEnd;

      const stopColor = isStart ? '#10b981' : isEnd ? '#f59e0b' : '#00696a';
      const stopIcon = isStart ? '🚀' : isEnd ? '🏁' : stepNum;

      const prevVisit = idx > 0 ? routeVisits[idx - 1] : null;
      const prevPoint = prevVisit ? [prevVisit.latitude, prevVisit.longitude] : startPoint;
      let timeFromPrev = '';
      let distFromPrev = '';

      if (prevVisit) {
        const diffMs = Math.max(0, new Date(v.createdAt).getTime() - new Date(prevVisit.createdAt).getTime());
        const mins = Math.round(diffMs / 60000);
        timeFromPrev = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
      } else if (matchedRoute?.startedAt) {
        const diffMs = Math.max(0, new Date(v.createdAt).getTime() - new Date(matchedRoute.startedAt).getTime());
        const mins = Math.round(diffMs / 60000);
        timeFromPrev = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m (desde inicio)` : `${mins} min (desde inicio)`;
      }

      if (prevPoint) {
        const R = 6371;
        const dLat = ((v.latitude - prevPoint[0]) * Math.PI) / 180;
        const dLon = ((v.longitude - prevPoint[1]) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos((prevPoint[0] * Math.PI) / 180) * 
                  Math.cos((v.latitude * Math.PI) / 180) * 
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const dKm = Math.round(R * c * 10) / 10;
        distFromPrev = `${dKm} km`;
      }

      const stopHtml = `
        <div class="flex flex-col items-center group cursor-pointer">
          <div class="px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow-md mb-0.5 whitespace-nowrap font-mono tracking-tight" style="background-color: ${stopColor}">
            #${stepNum} · ${new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div class="w-7 h-7 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-black transition-transform group-hover:scale-125" style="background-color: ${stopColor}">
            ${stopIcon}
          </div>
        </div>
      `;

      const customStopIcon = L.divIcon({
        className: 'custom-map-route-stop-pin',
        html: stopHtml,
        iconSize: [48, 54],
        iconAnchor: [24, 50],
        popupAnchor: [0, -48]
      });

      const popupHtml = `
        <div class="p-3.5 text-slate-800 text-xs max-w-xs space-y-2 font-sans">
          <div class="border-b border-slate-100 pb-1.5 flex items-center justify-between">
            <span class="text-[10px] font-black px-2 py-0.5 rounded-full text-white" style="background-color: ${stopColor}">
              ${isStart ? '🚀 Salida / Inicio de Visitas' : isEnd ? '🏁 Última Visita' : `📍 Parada #${stepNum}`}
            </span>
            <span class="text-[11px] font-bold text-slate-500 font-mono">
              ${new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div>
            <h4 class="font-black text-sm text-slate-950">${v.clientName}</h4>
            ${v.companyName ? `<p class="text-slate-500 text-[11px]">${v.companyName}</p>` : ''}
            <p class="text-slate-400 text-[10px] mt-0.5">Asesor: <strong class="text-slate-700">${v.sellerName}</strong></p>
          </div>

          ${prevPoint ? `
            <div class="bg-teal-50/80 p-2 rounded-xl border border-teal-100 text-[11px] text-teal-900 space-y-0.5">
              <p class="font-bold flex items-center gap-1">⏱️ Traslado: <span class="text-teal-700 font-black">${timeFromPrev || 'Registrado'}</span></p>
              ${distFromPrev ? `<p class="font-medium text-slate-600 flex items-center gap-1">🚗 Distancia tramo: <span class="font-bold text-slate-800">${distFromPrev}</span></p>` : ''}
            </div>
          ` : ''}

          <div class="text-[11px] text-slate-600 space-y-1">
            <p><strong>Gestión:</strong> <span class="capitalize font-bold text-teal-800">${v.visitType || 'Rutina'}</span></p>
            ${v.notes ? `<p class="italic text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100">"${v.notes}"</p>` : ''}
          </div>
        </div>
      `;

      L.marker([v.latitude, v.longitude], { icon: customStopIcon, zIndexOffset: 1500 + idx })
        .addTo(routeGroup)
        .bindPopup(popupHtml);
    });

    if (focusLocation && hasRouteEnd && endPoint && Math.abs(focusLocation.latitude - endPoint[0]) < 0.0001 && Math.abs(focusLocation.longitude - endPoint[1]) < 0.0001) {
      setTimeout(() => endMarkerInstance?.openPopup(), 400);
    } else if (focusLocation && hasRouteStart && startPoint && Math.abs(focusLocation.latitude - startPoint[0]) < 0.0001 && Math.abs(focusLocation.longitude - startPoint[1]) < 0.0001) {
      setTimeout(() => startMarkerInstance?.openPopup(), 400);
    }
  }, [visits, routeSellerId, routeDate, isRouteTraceActive, sellerRoutes, activeRoute, focusLocation]);

  const handleCenterOnUser = () => {
    if (!mapInstanceRef.current) return;
    if (currentLocation) {
      mapInstanceRef.current.flyTo([currentLocation.latitude, currentLocation.longitude], 15, {
        duration: 1.2
      });
    } else {
      onRefreshGps();
    }
  };

  const handleSelectRegion = (regionId: string) => {
    setSelectedRegion(regionId);
    const region = GUATEMALA_REGIONS.find(r => r.id === regionId);
    if (region && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(region.coords, region.zoom, { duration: 1.2 });
    }
  };

  const handleFlyToClient = (client: Client) => {
    if (!client.latitude || !client.longitude || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([client.latitude, client.longitude], 16, { duration: 1.2 });
    const marker = clientMarkersMapRef.current.get(client.id);
    if (marker) {
      setTimeout(() => marker.openPopup(), 1300);
    }
  };

  const matchingSearchClients = useMemo(() => {
    if (!mapSearchTerm.trim()) return [];
    const term = normalizeSearchText(mapSearchTerm);
    return clients
      .filter(c => c.latitude && c.longitude && (
        normalizeSearchText(c.name).includes(term) ||
        normalizeSearchText(c.clientCode).includes(term) ||
        normalizeSearchText(c.companyName).includes(term)
      ))
      .slice(0, 5);
  }, [clients, mapSearchTerm]);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  const geotaggedTotal = userClients.filter(c => c.latitude && c.longitude).length;

  return (
    <div 
      className={cn(
        "relative w-full overflow-hidden flex flex-col transition-all duration-300",
        isFullscreen
          ? "fixed inset-0 z-[99999] w-screen h-[100dvh] rounded-none border-0 shadow-none bg-slate-900"
          : "h-[380px] sm:h-[480px] md:h-[600px] rounded-2xl shadow-xs border border-slate-200/80 bg-slate-100"
      )}
    >
      {/* Leaflet Map DOM */}
      <div ref={mapContainerRef} className="w-full h-full flex-1" />

      {/* Floating Pill when Controls are Hidden (Clean Mode) */}
      {!showControls && (
        <div className="absolute top-3 left-3 z-30 flex items-center gap-2 pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200">
          <button
            onClick={() => setShowControls(true)}
            className="px-3.5 py-2 bg-slate-900/90 hover:bg-slate-950 text-white rounded-xl text-xs font-bold shadow-lg backdrop-blur-md flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 border border-white/20 cursor-pointer"
            title="Mostrar todos los controles, filtros y búsqueda"
          >
            <Eye size={15} className="text-teal-400" />
            <span>Mostrar Botones</span>
          </button>

          {isFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="px-3.5 py-2 bg-white/95 hover:bg-white text-slate-800 rounded-xl text-xs font-bold shadow-lg backdrop-blur-md flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 border border-slate-200 cursor-pointer"
              title="Salir de pantalla completa (Esc)"
            >
              <Minimize2 size={15} className="text-rose-600" />
              <span className="hidden sm:inline">Salir Pantalla Completa</span>
            </button>
          )}

          {mapDateFilter !== 'all' && (
            <div className="px-3 py-1.5 bg-teal-800/90 text-teal-100 rounded-xl text-[11px] font-bold shadow-md backdrop-blur-md border border-teal-600/40 flex items-center gap-1.5">
              <span>Filtro: {mapDateFilter === 'today' ? 'Hoy' : mapDateFilter === 'yesterday' ? 'Ayer' : mapDateFilter === 'week' ? 'Semana' : 'Mes'}</span>
            </div>
          )}
        </div>
      )}

      {/* Top Floating Bar: Search, Filters, Date Range, Regions & View Toggles */}
      {showControls && (
        <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Left: Filter Pills, Date Range (Estilo Ventas) & Search */}
          <div className="flex items-center gap-1.5 flex-wrap pointer-events-auto">
            {/* Status Filters */}
            <div className="flex items-center bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-xs border border-slate-200/80">
              <button
                onClick={() => {
                  setActiveFilter('all');
                  setMapDateFilter('all');
                }}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  activeFilter === 'all' && mapDateFilter === 'all' ? "bg-teal-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                Todos ({geotaggedTotal})
              </button>
              <button
                onClick={() => setActiveFilter('visited')}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  activeFilter === 'visited' ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                Visitados
              </button>
              <button
                onClick={() => setActiveFilter('pending')}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  activeFilter === 'pending' ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                Pendientes
              </button>
            </div>

            {/* Date Range Filter Dropdown (Estilo Ventas: Hoy, Ayer, Semana, Mes) */}
            <div className="flex items-center bg-white/95 backdrop-blur-md px-2 py-1 rounded-xl shadow-xs border border-slate-200/80 gap-1.5">
              <Calendar size={13} className="text-teal-600 shrink-0" />
              <select
                value={mapDateFilter}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setMapDateFilter(val);
                  if (val !== 'all') {
                    setActiveFilter('visited');
                  }
                }}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer pr-1"
                title="Filtrar visitas en el mapa por fecha (como en ventas)"
              >
                <option value="all">📅 Todas las fechas</option>
                <option value="today">☀️ Hoy ({dateCounts.today})</option>
                <option value="yesterday">⛅ Ayer ({dateCounts.yesterday})</option>
                <option value="week">📆 Esta Semana ({dateCounts.week})</option>
                <option value="month">🗓️ Este Mes ({dateCounts.month})</option>
                <option value="last_month">⏮️ Mes Anterior</option>
              </select>
            </div>

            {/* Quick Map Client Search */}
            <div className="relative">
              <div className="flex items-center bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-xl shadow-xs border border-slate-200/80">
                <Search size={14} className="text-slate-400 shrink-0 mr-1.5" />
                <input
                  type="text"
                  placeholder="Buscar pin de cliente..."
                  value={mapSearchTerm}
                  onChange={(e) => setMapSearchTerm(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 placeholder:text-slate-400 font-medium focus:outline-none w-28 md:w-36"
                />
                {mapSearchTerm && (
                  <button onClick={() => setMapSearchTerm('')} className="text-slate-400 hover:text-slate-600">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Quick Search Autocomplete Dropdown */}
              {matchingSearchClients.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white/98 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 p-1.5 space-y-1 z-30">
                  {matchingSearchClients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        handleFlyToClient(c);
                        setMapSearchTerm('');
                      }}
                      className="w-full text-left p-2 hover:bg-teal-50 rounded-lg text-xs font-bold text-slate-900 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="text-[10px] text-teal-700 font-mono shrink-0 ml-1">📍 Volar</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Regions, Layer Selector, Clean Mode & Fullscreen */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto pointer-events-auto flex-wrap">
            {/* Region Shortcuts Dropdown */}
            <div className="flex items-center bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-xs border border-slate-200/80">
              <select
                value={selectedRegion}
                onChange={(e) => handleSelectRegion(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none px-2 py-1 cursor-pointer"
              >
                {GUATEMALA_REGIONS.map(r => (
                  <option key={r.id} value={r.id}>{r.icon} {r.name}</option>
                ))}
              </select>
            </div>

            {/* Layer Selector (Google Hybrid, Earth, Streets, Terrain, Esri) */}
            <div className="flex items-center bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl shadow-xs border border-slate-200/80 gap-1.5">
              <Layers size={14} className="text-teal-600 shrink-0" />
              <select
                value={mapType}
                onChange={(e) => setMapType(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer pr-1"
                title="Seleccionar capa de mapa"
              >
                <option value="satellite">🛰️ Satélite Híbrido (Google)</option>
                <option value="earth">🌎 Google Earth (Satélite Limpio)</option>
                <option value="streets">🗺️ Calles y Rutas (Google Maps)</option>
                <option value="terrain">⛰️ Relieve / Fincas (Google)</option>
                <option value="esri">🛰️ Satélite HD (Esri / Maxar)</option>
              </select>
            </div>

            {/* Clean Mode Button (Ocultar Botones) */}
            <div className="flex items-center bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-xs border border-slate-200/80">
              <button
                onClick={() => setShowControls(false)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
                title="Ocultar botones y filtros para despejar la vista de la ruta y los pines"
              >
                <EyeOff size={14} className="text-amber-600" />
                <span className="hidden md:inline">Ocultar Botones</span>
              </button>
            </div>

            {/* Fullscreen Button */}
            <div className="flex items-center bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-xs border border-slate-200/80">
              <button
                onClick={toggleFullscreen}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
                title={isFullscreen ? "Salir de pantalla completa (Esc)" : "Ver mapa en pantalla completa"}
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 size={14} className="text-rose-600" />
                    <span>Salir</span>
                  </>
                ) : (
                  <>
                    <Maximize2 size={14} className="text-teal-600" />
                    <span className="hidden md:inline">Pantalla Completa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Right Floating Controls: Fullscreen, Clean View Toggle, GPS & Zoom */}
      <div className="absolute right-3 bottom-16 md:bottom-4 z-20 flex flex-col space-y-2 pointer-events-auto">
        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className={cn(
            "w-10 h-10 rounded-xl shadow-md border flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md",
            isFullscreen 
              ? "bg-teal-600 hover:bg-teal-700 text-white border-teal-500 shadow-teal-600/30" 
              : "bg-white/95 hover:bg-white text-slate-700 border-slate-200 shadow-xs"
          )}
          title={isFullscreen ? "Salir de pantalla completa (Esc)" : "Pantalla completa"}
        >
          {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>

        {/* Clean Mode Toggle (Ocultar/Mostrar Botones) */}
        <button
          onClick={() => setShowControls(prev => !prev)}
          className={cn(
            "w-10 h-10 rounded-xl shadow-md border flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md",
            !showControls 
              ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-500/30 ring-2 ring-amber-400/50" 
              : "bg-white/95 hover:bg-white text-slate-700 border-slate-200 shadow-xs"
          )}
          title={showControls ? "Ocultar botones (Vista limpia de la ruta)" : "Mostrar botones"}
        >
          {showControls ? <EyeOff size={17} className="text-slate-600" /> : <Eye size={17} className="text-white animate-pulse" />}
        </button>

        {/* Center GPS on user */}
        <button
          onClick={handleCenterOnUser}
          className="w-10 h-10 bg-white/95 hover:bg-white text-slate-700 rounded-xl shadow-xs border border-slate-200 flex items-center justify-center transition-transform active:scale-95 cursor-pointer backdrop-blur-md"
          title="Centrar en mi ubicación GPS en vivo"
        >
          <Crosshair size={17} className={cn("text-teal-700", isGpsLoading && "animate-spin text-teal-600")} />
        </button>

        {/* Zoom In/Out */}
        <div className="flex flex-col bg-white/95 backdrop-blur-md rounded-xl shadow-xs border border-slate-200 overflow-hidden divide-y divide-slate-100">
          <button
            onClick={handleZoomIn}
            className="w-10 h-9 hover:bg-slate-50 text-slate-700 font-bold flex items-center justify-center active:scale-95 cursor-pointer"
            title="Acercar mapa"
          >
            <ZoomIn size={15} />
          </button>
          <button
            onClick={handleZoomOut}
            className="w-10 h-9 hover:bg-slate-50 text-slate-700 font-bold flex items-center justify-center active:scale-95 cursor-pointer"
            title="Alejar mapa"
          >
            <ZoomOut size={15} />
          </button>
        </div>
      </div>

      {/* Bottom Floating Quick Actions */}
      {showControls && (
        <div className="absolute bottom-3 left-3 right-16 md:right-3 z-20 flex flex-wrap items-center gap-2 pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            onClick={onOpenMarkClientModal}
            className="px-3.5 py-2 bg-white/95 hover:bg-white text-slate-800 rounded-xl shadow-xs border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-102 active:scale-95 backdrop-blur-md cursor-pointer"
          >
            <MapPin size={15} className="text-teal-600" />
            <span>Marcar Cliente</span>
          </button>

          <button
            onClick={onOpenRegisterVisitModal}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm text-xs font-bold flex items-center gap-1.5 transition-all hover:scale-102 active:scale-95 shadow-teal-600/10 cursor-pointer"
          >
            <Plus size={15} />
            <span>Registrar Visita</span>
          </button>
        </div>
      )}
    </div>
  );
}
