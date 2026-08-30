import React, { useEffect, useRef, useState } from 'react';
import { Client, ClientVisit, User } from '../types';
import L from 'leaflet';
import { 
  Navigation, Layers, MapPin, Compass, ExternalLink, 
  Phone, Building2, Clock, CheckCircle2, AlertTriangle, 
  Plus, RefreshCw, ZoomIn, ZoomOut 
} from 'lucide-react';
import { cn, fechaDDMMYYYY } from '../utils';

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
}

export function ClientVisitsMap({
  clients,
  visits,
  currentLocation,
  currentUser,
  onSelectClientForVisit,
  onOpenMarkClientModal,
  onOpenRegisterVisitModal,
  onRefreshGps,
  isGpsLoading = false
}: ClientVisitsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userAccuracyCircleRef = useRef<L.Circle | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [mapType, setMapType] = useState<'streets' | 'satellite'>('streets');
  const [activeFilter, setActiveFilter] = useState<'all' | 'visited' | 'pending'>('all');

  const GUATEMALA_CENTER: [number, number] = [14.6349, -90.5069];

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialLat = currentLocation?.latitude || GUATEMALA_CENTER[0];
    const initialLng = currentLocation?.longitude || GUATEMALA_CENTER[1];
    const initialZoom = currentLocation ? 13 : 8;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      zoomControl: false
    });

    const streetTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });

    streetTiles.addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch Layer
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

  // User Marker
  useEffect(() => {
    if (!mapInstanceRef.current || !currentLocation) return;
    const map = mapInstanceRef.current;

    const userLatLng: [number, number] = [currentLocation.latitude, currentLocation.longitude];

    const userHtml = `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-8 h-8 rounded-full bg-teal-500/25 animate-ping"></div>
        <div class="w-4 h-4 rounded-full bg-teal-600 border-2 border-white shadow-md flex items-center justify-center">
          <div class="w-1 h-1 rounded-full bg-white"></div>
        </div>
      </div>
    `;

    const userIcon = L.divIcon({
      className: 'custom-map-user-pin',
      html: userHtml,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(userLatLng);
    } else {
      userMarkerRef.current = L.marker(userLatLng, { icon: userIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindPopup(`
          <div class="p-3 text-xs">
            <p class="font-bold text-teal-800 text-sm">📍 Tu Ubicación Actual</p>
            <p class="text-slate-500 text-[11px] font-mono mt-0.5">${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}</p>
            ${currentLocation.accuracy ? `<p class="text-[10px] text-teal-600 mt-1">Precisión: ±${Math.round(currentLocation.accuracy)}m</p>` : ''}
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
          weight: 1
        }).addTo(map);
      }
    }
  }, [currentLocation]);

  // Client Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const markersGroup = markersLayerRef.current;
    markersGroup.clearLayers();

    const clientVisitMap = new Map<string, ClientVisit>();
    visits.forEach(v => {
      if (v.clientId && !clientVisitMap.has(v.clientId)) {
        clientVisitMap.set(v.clientId, v);
      }
    });

    const now = new Date().getTime();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    const filteredClients = clients.filter(c => {
      if (!c.latitude || !c.longitude) return false;
      const lastVisit = clientVisitMap.get(c.id);
      const isRecentlyVisited = lastVisit && (now - new Date(lastVisit.createdAt).getTime() < SEVEN_DAYS_MS);

      if (activeFilter === 'visited') return isRecentlyVisited;
      if (activeFilter === 'pending') return !isRecentlyVisited;
      return true;
    });

    filteredClients.forEach(client => {
      if (!client.latitude || !client.longitude) return;

      const lastVisit = clientVisitMap.get(client.id);
      const daysSinceVisit = lastVisit 
        ? Math.floor((now - new Date(lastVisit.createdAt).getTime()) / (1000 * 60 * 60 * 24))
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
          ${client.companyName ? `<p class="text-slate-400 text-[11px] font-medium mt-0.5">${client.companyName}</p>` : ''}
        </div>

        <div class="space-y-1 text-[11px] text-slate-600">
          ${client.phone ? `<p class="flex items-center gap-1.5">📞 <a href="tel:${client.phone}" class="text-teal-700 font-bold hover:underline">${client.phone}</a></p>` : ''}
          ${client.address ? `<p class="flex items-center gap-1.5 text-slate-500">🏢 ${client.address}</p>` : ''}
          <p class="flex items-center gap-1.5 font-medium ${isVisitedRecently ? 'text-emerald-700' : 'text-slate-600'}">
            🕒 Última Visita: ${lastVisit ? `${daysSinceVisit === 0 ? 'Hoy' : `Hace ${daysSinceVisit} días`} (${fechaDDMMYYYY(lastVisit.createdAt)})` : '<span class="text-slate-400 font-bold">Sin visitas registradas</span>'}
          </p>
        </div>

        <div class="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
          <button id="visit-btn-${client.id}" class="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-center transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer text-xs">
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
        </div>
      `;

      const marker = L.marker([client.latitude, client.longitude], { icon: pinIcon })
        .addTo(markersGroup)
        .bindPopup(popupContent);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`visit-btn-${client.id}`);
        if (btn) {
          btn.onclick = () => {
            onSelectClientForVisit(client);
            marker.closePopup();
          };
        }
      });
    });
  }, [clients, visits, activeFilter]);

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

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  return (
    <div className="relative w-full h-[480px] md:h-[560px] rounded-2xl overflow-hidden shadow-xs border border-slate-200/80 bg-slate-100">
      {/* Leaflet Map DOM */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Top Filter Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-xs border border-slate-200/80 pointer-events-auto">
          <button
            onClick={() => setActiveFilter('all')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeFilter === 'all' ? "bg-teal-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            Todos ({clients.filter(c => c.latitude && c.longitude).length})
          </button>
          <button
            onClick={() => setActiveFilter('visited')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeFilter === 'visited' ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            Visitados
          </button>
          <button
            onClick={() => setActiveFilter('pending')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              activeFilter === 'pending' ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            Pendientes
          </button>
        </div>

        <div className="flex items-center bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-xs border border-slate-200/80 pointer-events-auto">
          <button
            onClick={() => setMapType(mapType === 'streets' ? 'satellite' : 'streets')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
            title="Cambiar capa de mapa"
          >
            <Layers size={14} className="text-teal-600" />
            <span>{mapType === 'streets' ? 'Satélite' : 'Calles'}</span>
          </button>
        </div>
      </div>

      {/* Right Zoom & Location Controls */}
      <div className="absolute right-3 bottom-16 md:bottom-4 z-20 flex flex-col space-y-2 pointer-events-auto">
        <button
          onClick={handleCenterOnUser}
          className="w-10 h-10 bg-white hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm border border-slate-200 flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
          title="Centrar en mi ubicación GPS"
        >
          <Navigation size={16} className={cn(isGpsLoading && "animate-spin text-teal-600")} />
        </button>

        <div className="flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
          <button
            onClick={handleZoomIn}
            className="w-10 h-9 hover:bg-slate-50 text-slate-700 font-bold flex items-center justify-center active:scale-95 cursor-pointer"
            title="Acercar"
          >
            <ZoomIn size={15} />
          </button>
          <button
            onClick={handleZoomOut}
            className="w-10 h-9 hover:bg-slate-50 text-slate-700 font-bold flex items-center justify-center active:scale-95 cursor-pointer"
            title="Alejar"
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
          <span>Registrar Checkpoint</span>
        </button>
      </div>
    </div>
  );
}
