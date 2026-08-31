import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Client, ClientVisit, User } from '../types';
import L from 'leaflet';
import { 
  Navigation, Layers, MapPin, Compass, ExternalLink, 
  Phone, Building2, Clock, CheckCircle2, AlertTriangle, 
  Plus, RefreshCw, ZoomIn, ZoomOut, Search, X, Crosshair
} from 'lucide-react';
import { cn, fechaDDMMYYYY, normalizeSearchText } from '../utils';

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
  onClearClientLocation
}: ClientVisitsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const clientMarkersMapRef = useRef<Map<string, L.Marker>>(new Map());

  const [mapType, setMapType] = useState<'streets' | 'satellite'>('streets');
  // Handler to clear all client pins from the map
  const handleClearAllPins = () => {
    // Remove all client markers from the layer group
    if (clientMarkersMapRef.current && markersLayerRef.current) {
      clientMarkersMapRef.current.forEach((marker) => {
        markersLayerRef.current?.removeLayer(marker);
      });
      clientMarkersMapRef.current.clear();
    }
  };
  const [activeFilter, setActiveFilter] = useState<'all' | 'visited' | 'pending'>('all');
  const [mapSearchTerm, setMapSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');

  const GUATEMALA_CENTER: [number, number] = [15.2, -90.35];

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
      zoomControl: false
    });

    // Add Clear All Pins control button
    const clearBtn = L.control({ position: 'topright' });
    clearBtn.onAdd = function () {
      const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control leaflet-touch');
      btn.title = 'Clear All Pins';
      btn.style.width = '30px';
      btn.style.height = '30px';
      btn.style.backgroundColor = 'white';
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 5h4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0V6H6v6.5a.5.5 0 0 1-1 0v-7z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1 0-2h3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3a.5.5 0 0 0-.5.5V4h12v-.5a.5.5 0 0 0-.5-.5h-11z"/></svg>';
      L.DomEvent.on(btn, 'click', (e) => {
        L.DomEvent.stopPropagation(e);
        handleClearAllPins();
      });
      return btn;
    };
    clearBtn.addTo(map);

    const streetTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });

    streetTiles.addTo(map);

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

  // Switch Layer (Streets vs Satellite)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    if (mapType === 'satellite') {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '&copy; Esri World Imagery'
      }).addTo(map);
    } else {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
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

  // Client Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const markersGroup = markersLayerRef.current;
    markersGroup.clearLayers();
    clientMarkersMapRef.current.clear();

    const clientVisitMap = new Map<string, ClientVisit>();
    visits.forEach(v => {
      const cId = String(v.clientId || (v as any).client_id || '').trim();
      const cName = String(v.clientName || (v as any).client_name || '').trim().toLowerCase();
      const cCode = String(v.clientCode || (v as any).client_code || '').trim().toLowerCase();
      if (cId && !clientVisitMap.has(cId)) clientVisitMap.set(cId, v);
      if (cName && !clientVisitMap.has(cName)) clientVisitMap.set(cName, v);
      if (cCode && !clientVisitMap.has(cCode)) clientVisitMap.set(cCode, v);
    });

    const now = new Date().getTime();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const searchTermNorm = normalizeSearchText(mapSearchTerm);

    const filteredClients = clients.filter(c => {
      if (!c.latitude || !c.longitude || isNaN(c.latitude) || isNaN(c.longitude)) return false;
      
      const cIdKey = String(c.id || '').trim();
      const cNameKey = String(c.name || '').trim().toLowerCase();
      const cCodeKey = String(c.clientCode || '').trim().toLowerCase();
      const lastVisit = clientVisitMap.get(cIdKey) || clientVisitMap.get(cNameKey) || (cCodeKey ? clientVisitMap.get(cCodeKey) : undefined);
      const isRecentlyVisited = lastVisit && (now - new Date(lastVisit.createdAt).getTime() < SEVEN_DAYS_MS);

      if (activeFilter === 'visited' && !isRecentlyVisited) return false;
      if (activeFilter === 'pending' && isRecentlyVisited) return false;

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
      const daysSinceVisit = lastVisit 
        ? Math.max(0, Math.floor((now - new Date(lastVisit.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      const isVisitedRecently = daysSinceVisit !== null && daysSinceVisit <= 7;
      const isUrgent = daysSinceVisit !== null && daysSinceVisit > 15;

      const pinColor = isVisitedRecently ? '#10b981' : isUrgent ? '#ef4444' : '#00696a';
      const badgeText = daysSinceVisit === null 
        ? 'Sin Visita' 
        : daysSinceVisit === 0 
          ? 'Hoy' 
          : `${daysSinceVisit}d`;

      const pinHtml = `
        <div class="flex flex-col items-center group cursor-pointer">
          <div class="px-2 py-0.5 rounded-full text-[9px] font-bold text-white shadow-sm transition-transform transform group-hover:scale-110 whitespace-nowrap mb-0.5 font-sans" style="background-color: ${pinColor}">
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
          <p class="flex items-center gap-1.5 font-medium ${isVisitedRecently ? 'text-emerald-700' : 'text-slate-600'}">
            🕒 Última Visita: ${lastVisit ? `${daysSinceVisit === 0 ? 'Hoy' : `Hace ${daysSinceVisit} días`} (${fechaDDMMYYYY(lastVisit.createdAt)})` : '<span class="text-slate-400 font-bold">Sin visitas registradas</span>'}
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
  }, [clients, visits, activeFilter, mapSearchTerm, onOpenMarkClientModalForClient, onClearClientLocation]);

  // Draw Sequential Route Polyline & Stops (Admin Route Audit)
  useEffect(() => {
    if (!mapInstanceRef.current || !routeLayerRef.current) return;
    const routeGroup = routeLayerRef.current;
    routeGroup.clearLayers();

    if (!isRouteTraceActive) return;

    // Do NOT draw a single criss-crossing line if no seller or date is selected
    if ((!routeSellerId || routeSellerId === 'all') && (!routeDate || routeDate === 'all')) {
      return;
    }

    // Filter and sort visits chronologically
    const routeVisits = visits.filter(v => {
      if (!v.latitude || !v.longitude || isNaN(v.latitude) || isNaN(v.longitude)) return false;
      if (routeSellerId && routeSellerId !== 'all') {
        const match = v.sellerId === routeSellerId || v.sellerEmail === routeSellerId || v.sellerName === routeSellerId;
        if (!match) return false;
      }
      if (routeDate && routeDate !== 'all') {
        const vDate = (v.createdAt || '').split('T')[0];
        if (vDate !== routeDate) return false;
      }
      return true;
    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (routeVisits.length === 0) return;

    const latLngs: [number, number][] = routeVisits.map(v => [v.latitude, v.longitude]);

    // 1. Background glow line
    L.polyline(latLngs, {
      color: '#0d9488',
      weight: 8,
      opacity: 0.35,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(routeGroup);

    // 2. Dynamic route line
    const polyline = L.polyline(latLngs, {
      color: '#0f766e',
      weight: 4,
      dashArray: '8, 8',
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(routeGroup);

    if (latLngs.length > 1) {
      try {
        mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [60, 60], maxZoom: 14 });
      } catch (e) {}
    }

    // Add Stop Numbers and Step Badges
    routeVisits.forEach((v, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === routeVisits.length - 1;
      const stepNum = idx + 1;
      
      const prevVisit = idx > 0 ? routeVisits[idx - 1] : null;
      let timeFromPrev = '';
      let distFromPrev = '';

      if (prevVisit) {
        const diffMs = Math.max(0, new Date(v.createdAt).getTime() - new Date(prevVisit.createdAt).getTime());
        const diffMins = Math.round(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        timeFromPrev = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

        const R = 6371; // km
        const dLat = ((v.latitude - prevVisit.latitude) * Math.PI) / 180;
        const dLon = ((v.longitude - prevVisit.longitude) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos((prevVisit.latitude * Math.PI) / 180) * 
                  Math.cos((v.latitude * Math.PI) / 180) * 
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distKm = Math.round(R * c * 10) / 10;
        distFromPrev = `${distKm} km`;
      }

      const stopColor = isStart ? '#10b981' : isEnd ? '#f59e0b' : '#0f766e';
      const stopIcon = isStart ? '🚩' : isEnd ? '🏁' : `#${stepNum}`;

      const stopHtml = `
        <div class="flex flex-col items-center group cursor-pointer animate-fade-in">
          <div class="px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow-md transition-transform transform group-hover:scale-115 whitespace-nowrap mb-0.5 font-sans flex items-center gap-1" style="background-color: ${stopColor}">
            <span>${isStart ? 'Inicio' : isEnd ? 'Final' : `Parada ${stepNum}`}</span>
            <span class="opacity-90 font-mono">(${new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
          </div>
          <div class="w-7 h-7 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-[12px] font-black transition-transform group-hover:scale-115" style="background-color: ${stopColor}">
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
              ${isStart ? '🚩 Salida / Inicio de Ruta' : isEnd ? '🏁 Destino / Cierre de Ruta' : `📍 Parada #${stepNum}`}
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

          ${prevVisit ? `
            <div class="bg-teal-50/80 p-2 rounded-xl border border-teal-100 text-[11px] text-teal-900 space-y-0.5">
              <p class="font-bold flex items-center gap-1">⏱️ Traslado desde parada #${idx}: <span class="text-teal-700 font-black">${timeFromPrev}</span></p>
              <p class="font-medium text-slate-600 flex items-center gap-1">🚗 Distancia entre puntos: <span class="font-bold text-slate-800">${distFromPrev}</span></p>
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

    if (latLngs.length > 1 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(polyline.getBounds(), { padding: [60, 60], maxZoom: 14 });
    }
  }, [visits, routeSellerId, routeDate, isRouteTraceActive]);

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

  const geotaggedTotal = clients.filter(c => c.latitude && c.longitude).length;

  return (
    <div className="relative w-full h-[360px] sm:h-[460px] md:h-[580px] rounded-2xl overflow-hidden shadow-xs border border-slate-200/80 bg-slate-100 flex flex-col">
      {/* Leaflet Map DOM */}
      <div ref={mapContainerRef} className="w-full h-full flex-1" />

      {/* Top Floating Bar: Search, Filters & Regions */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5 pointer-events-none">
        
        {/* Left: Filter Pills & Search */}
        <div className="flex items-center gap-1.5 flex-wrap pointer-events-auto">
          {/* Status Filters */}
          <div className="flex items-center bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-xs border border-slate-200/80">
            <button
              onClick={() => setActiveFilter('all')}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeFilter === 'all' ? "bg-teal-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
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

          {/* Quick Map Client Search */}
          <div className="relative">
            <div className="flex items-center bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-xl shadow-xs border border-slate-200/80">
              <Search size={14} className="text-slate-400 shrink-0 mr-1.5" />
              <input
                type="text"
                placeholder="Buscar pin de cliente..."
                value={mapSearchTerm}
                onChange={(e) => setMapSearchTerm(e.target.value)}
                className="bg-transparent text-xs text-slate-800 placeholder:text-slate-400 font-medium focus:outline-none w-32 md:w-44"
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

        {/* Right: Regions & Satellite Toggle */}
        <div className="flex items-center gap-1.5 self-end md:self-auto pointer-events-auto">
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

          {/* Layer Toggle */}
          <div className="flex items-center bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-xs border border-slate-200/80">
            <button
              onClick={() => setMapType(mapType === 'streets' ? 'satellite' : 'streets')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
              title="Alternar entre Satélite y Calles"
            >
              <Layers size={14} className="text-teal-600" />
              <span>{mapType === 'streets' ? 'Satélite' : 'Calles'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Zoom & Location Controls */}
      <div className="absolute right-3 bottom-16 md:bottom-4 z-20 flex flex-col space-y-2 pointer-events-auto">
        <button
          onClick={handleCenterOnUser}
          className="w-10 h-10 bg-white hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm border border-slate-200 flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
          title="Centrar en mi ubicación GPS en vivo"
        >
          <Crosshair size={17} className={cn("text-teal-700", isGpsLoading && "animate-spin text-teal-600")} />
        </button>

        <div className="flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
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
      <div className="absolute bottom-3 left-3 right-16 md:right-3 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
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
    </div>
  );
}
