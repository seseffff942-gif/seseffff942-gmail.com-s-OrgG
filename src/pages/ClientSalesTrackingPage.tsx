import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User } from '../types';
import { api } from '../api';
import { resolveClientLocation } from '../utils/guatemalaGeo';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Map as MapIcon, Search, Filter, Calendar, Users, ShoppingBag, 
  TrendingUp, Clock, AlertTriangle, CheckCircle2, ChevronRight, 
  X, RefreshCw, Layers, Phone, Building2, FileText, ArrowRight,
  MapPin, Compass, ShieldAlert, Award, ArrowUpDown, Eye, ExternalLink,
  DollarSign
} from 'lucide-react';
import { cn } from '../utils';

interface SaleItem {
  id: string;
  folio: string;
  sellerId: string;
  sellerName: string;
  date: string;
  totalAmount: number;
  status: string;
  invoiceType?: string;
}

interface ClientTrackingItem {
  id: string;
  name: string;
  companyName: string | null;
  nit: string | null;
  phone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  locationAddress: string | null;
  sellerId: string | null;
  sellerName: string;
  clientCode: string | null;
  geotaggedAt: string | null;
  createdAt: string;
  lastVisitAt: string | null;
  totalSales: number;
  totalRevenue: number;
  firstPurchaseDate: string | null;
  lastPurchaseDate: string | null;
  avgFrequencyDays: number;
  daysSinceLastPurchase: number;
  uniqueSellers: string[];
  sales: SaleItem[];
  resolvedGeo?: {
    latitude: number;
    longitude: number;
    isExact: boolean;
    source: string;
    locationLabel: string;
  } | null;
}

interface ClientSalesTrackingPageProps {
  user: User;
  isMobile?: boolean;
  embedded?: boolean;
  onCoordinatesUpdated?: (clientId: string, lat: number, lng: number) => void;
}

export function ClientSalesTrackingPage({ user, isMobile = false, embedded = false, onCoordinatesUpdated }: ClientSalesTrackingPageProps) {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientTrackingItem[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filters (Date from empty by default so it shows all historical sales)
  const [selectedSeller, setSelectedSeller] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'moderate' | 'inactive' | 'no-sales'>('all');
  const [locationFilter, setLocationFilter] = useState<'all' | 'exact' | 'approx' | 'missing'>('exact');

  // Selected client for detail drawer
  const [selectedClient, setSelectedClient] = useState<ClientTrackingItem | null>(null);

  // Pin placing mode
  const [pinningClient, setPinningClient] = useState<ClientTrackingItem | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);

  // Map state
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const clientMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const [mapType, setMapType] = useState<'satellite' | 'streets' | 'terrain'>('satellite');

  // Load tracking data from API
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getClientSalesTracking({
        sellerId: selectedSeller,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      });

      if (res && res.clients) {
        const clientsWithGeo = res.clients.map((c: any) => {
          const resolved = resolveClientLocation({
            id: c.id,
            name: c.name,
            companyName: c.companyName,
            address: c.address,
            latitude: c.latitude,
            longitude: c.longitude
          });
          return {
            ...c,
            resolvedGeo: resolved
          };
        });

        setClients(clientsWithGeo);
        setSellers(res.sellers || []);

        if (selectedClient) {
          const updated = clientsWithGeo.find((c: any) => c.id === selectedClient.id);
          if (updated) setSelectedClient(updated);
        }
      }
    } catch (err: any) {
      console.error('Error loading client sales tracking:', err);
      setError(err.message || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedSeller, dateFrom, dateTo]);

  // Live real-time coordinate synchronization when sellers register GPS in field visits
  useEffect(() => {
    const handleMutate = (e: any) => {
      if (!e?.detail?.key || e.detail.key === 'clients') {
        loadData();
      }
    };
    window.addEventListener('agricovet-mutate', handleMutate);
    return () => window.removeEventListener('agricovet-mutate', handleMutate);
  }, []);

  // Filtered clients list
  const filteredClients = useMemo(() => {
    const hasSearch = Boolean(searchTerm.trim());
    return clients.filter(c => {
      if (hasSearch) {
        const term = searchTerm.toLowerCase().trim();
        const matchName = c.name?.toLowerCase().includes(term);
        const matchCompany = c.companyName?.toLowerCase().includes(term);
        const matchCode = c.clientCode?.toLowerCase().includes(term);
        const matchAddress = c.address?.toLowerCase().includes(term);
        const matchFolio = c.sales?.some(s => s.folio?.toLowerCase().includes(term));
        if (!matchName && !matchCompany && !matchCode && !matchAddress && !matchFolio) return false;
      }

      if (statusFilter === 'active' && (c.totalSales === 0 || c.daysSinceLastPurchase > 15)) return false;
      if (statusFilter === 'moderate' && (c.totalSales === 0 || c.daysSinceLastPurchase <= 15 || c.daysSinceLastPurchase > 45)) return false;
      if (statusFilter === 'inactive' && (c.totalSales === 0 || c.daysSinceLastPurchase <= 45)) return false;
      if (statusFilter === 'no-sales' && c.totalSales > 0) return false;

      // When searching, allow finding ANY client so the user can look them up right there
      if (!hasSearch) {
        if (locationFilter === 'exact' && (!c.resolvedGeo || !c.resolvedGeo.isExact)) return false;
        if (locationFilter === 'approx' && (!c.resolvedGeo || c.resolvedGeo.isExact)) return false;
        if (locationFilter === 'missing' && c.resolvedGeo) return false;
      }

      return true;
    });
  }, [clients, searchTerm, statusFilter, locationFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = clients.length;
    const withSales = clients.filter(c => c.totalSales > 0).length;
    const exactGeo = clients.filter(c => c.resolvedGeo?.isExact).length;
    const approxGeo = clients.filter(c => c.resolvedGeo && !c.resolvedGeo.isExact).length;
    const missingGeo = clients.filter(c => !c.resolvedGeo).length;
    const totalRevenue = clients.reduce((acc, c) => acc + (c.totalRevenue || 0), 0);
    const activeClients = clients.filter(c => c.totalSales > 0 && c.daysSinceLastPurchase <= 15).length;
    const moderateClients = clients.filter(c => c.totalSales > 0 && c.daysSinceLastPurchase > 15 && c.daysSinceLastPurchase <= 45).length;
    const inactiveClients = clients.filter(c => c.totalSales > 0 && c.daysSinceLastPurchase > 45).length;
    const avgTicket = withSales > 0 ? totalRevenue / withSales : 0;
    const clientsWithFreq = clients.filter(c => c.avgFrequencyDays > 0);
    const avgFreq = clientsWithFreq.length > 0 ? Math.round(clientsWithFreq.reduce((acc, c) => acc + c.avgFrequencyDays, 0) / clientsWithFreq.length) : 0;

    return { total, withSales, exactGeo, approxGeo, missingGeo, totalRevenue, activeClients, moderateClients, inactiveClients, avgTicket, avgFreq };
  }, [clients]);

  // Initialize Leaflet Map (Guaranteed tiles + resize observer)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [15.2, -90.35],
      zoom: 8,
      zoomControl: true
    });

    // Default satellite tile layer
    const initialTiles = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      subdomains: '0123',
      maxZoom: 21,
      maxNativeZoom: 20,
      attribution: '&copy; Google Maps'
    });
    initialTiles.addTo(map);
    tileLayerRef.current = initialTiles;

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    // Invalidate size on mount and container resize
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

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

  // Update Map Tile Layer when mapType changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let newTileLayer: L.TileLayer;
    if (mapType === 'satellite') {
      newTileLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        subdomains: '0123',
        maxZoom: 21,
        maxNativeZoom: 20,
        attribution: '&copy; Google Maps'
      });
    } else if (mapType === 'terrain') {
      newTileLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
        subdomains: '0123',
        maxZoom: 20,
        attribution: '&copy; Google Maps'
      });
    } else {
      newTileLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        subdomains: '0123',
        maxZoom: 21,
        attribution: '&copy; Google Maps'
      });
    }

    newTileLayer.addTo(map);
    tileLayerRef.current = newTileLayer;
  }, [mapType]);

  // Click handler for manual pin placing
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const onMapClick = async (e: L.LeafletMouseEvent) => {
      if (pinningClient) {
        await handleSavePinLocation(pinningClient.id, e.latlng.lat, e.latlng.lng);
      }
    };

    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
    };
  }, [pinningClient]);

  // Render client markers on map
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const markersGroup = markersLayerRef.current;
    markersGroup.clearLayers();
    clientMarkersRef.current.clear();

    const bounds = L.latLngBounds([]);

    filteredClients.forEach(client => {
      // ONLY plot clients with exact/registered GPS coordinates (no approximate clutter)
      if (!client.resolvedGeo || !client.resolvedGeo.isExact) return;

      const { latitude, longitude } = client.resolvedGeo;
      bounds.extend([latitude, longitude]);

      let pinColor = '#94a3b8'; // gray
      if (client.totalSales > 0) {
        if (client.daysSinceLastPurchase <= 15) {
          pinColor = '#10b981'; // green
        } else if (client.daysSinceLastPurchase <= 45) {
          pinColor = '#f59e0b'; // yellow
        } else {
          pinColor = '#ef4444'; // red
        }
      }

      const markerHtml = `
        <div class="relative group cursor-pointer" style="transform: translate3d(0,0,0);">
          <div class="w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white ring-2 ring-emerald-400 transition-transform group-hover:scale-125" style="background-color: ${pinColor}">
            <span class="text-white text-[10px] font-black">${client.totalSales}</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-client-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(markersGroup);
      clientMarkersRef.current.set(client.id, marker);

      const popupHtml = `
        <div class="p-3 text-xs font-sans max-w-xs text-slate-900">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${isExact ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
              ${isExact ? '📍 GPS Exacto' : '📍 ' + locationLabel}
            </span>
            <span class="ml-auto text-[10px] text-slate-500 font-mono">${client.clientCode || ''}</span>
          </div>
          
          <h4 class="font-bold text-slate-900 text-sm leading-tight">${client.name}</h4>
          ${client.companyName ? `<p class="text-slate-600 text-[11px] font-medium mt-0.5">🏢 ${client.companyName}</p>` : ''}
          <p class="text-slate-500 text-[10px] mt-1 truncate">📌 ${client.address || 'Sin dirección'}</p>
          
          <div class="grid grid-cols-2 gap-1.5 my-2.5 p-2 bg-slate-100 rounded-lg border border-slate-200">
            <div>
              <p class="text-[9px] text-slate-400 font-semibold uppercase">Ventas</p>
              <p class="text-xs font-bold text-slate-800">${client.totalSales} facturas</p>
            </div>
            <div>
              <p class="text-[9px] text-slate-400 font-semibold uppercase">Total Facturado</p>
              <p class="text-xs font-bold text-emerald-700">Q${client.totalRevenue.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p class="text-[9px] text-slate-400 font-semibold uppercase">Frecuencia</p>
              <p class="text-xs font-bold text-slate-700">${client.avgFrequencyDays > 0 ? `Cada ${client.avgFrequencyDays} días` : 'Compra única'}</p>
            </div>
            <div>
              <p class="text-[9px] text-slate-400 font-semibold uppercase">Última compra</p>
              <p class="text-xs font-bold ${client.daysSinceLastPurchase > 45 ? 'text-rose-600' : 'text-slate-700'}">${client.totalSales > 0 ? `Hace ${client.daysSinceLastPurchase}d` : 'Nunca'}</p>
            </div>
          </div>

          <div class="text-[10px] text-slate-500 mb-2">
            👤 Vendedor: <strong class="text-slate-700">${client.sellerName}</strong>
          </div>

          <button id="btn-view-client-${client.id}" class="w-full py-1.5 px-3 bg-[#00696a] hover:bg-[#004f50] text-white rounded font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-1 cursor-pointer">
            <span>Ver Historial Detallado</span>
          </button>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-view-client-${client.id}`);
        if (btn) {
          btn.onclick = () => {
            setSelectedClient(client);
            marker.closePopup();
          };
        }
      });
    });

    if (bounds.isValid() && filteredClients.length > 0 && !pinningClient) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      mapInstanceRef.current.invalidateSize();
    }
  }, [filteredClients, pinningClient]);

  const centerOnClient = (client: ClientTrackingItem) => {
    if (!client.resolvedGeo || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo(
      [client.resolvedGeo.latitude, client.resolvedGeo.longitude],
      client.resolvedGeo.isExact ? 16 : 13,
      { duration: 1.2 }
    );
    const marker = clientMarkersRef.current.get(client.id);
    if (marker) {
      setTimeout(() => marker.openPopup(), 1300);
    }
  };

  const handleSavePinLocation = async (clientId: string, lat: number, lng: number) => {
    setSavingLocation(true);
    try {
      const res = await api.updateClientLocation(clientId, lat, lng, `Fijado en mapa por admin (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
      if (res.success) {
        setPinningClient(null);
        onCoordinatesUpdated?.(clientId, lat, lng);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('agricovet-mutate', { detail: { key: 'clients' } }));
        }
        await loadData();
      }
    } catch (err: any) {
      alert(`Error al guardar coordenadas: ${err.message}`);
    } finally {
      setSavingLocation(false);
    }
  };

  const renderSalesTimeline = (client: ClientTrackingItem) => {
    if (!client.sales || client.sales.length === 0) {
      return (
        <div className="text-center py-8 bg-slate-800/60 rounded-xl border border-slate-700">
          <ShoppingBag className="w-10 h-10 text-slate-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-300">Sin historial de ventas</p>
          <p className="text-xs text-slate-400 mt-1">Este cliente no registra facturas emitidas en el periodo seleccionado.</p>
        </div>
      );
    }

    const sortedSales = [...client.sales].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-teal-950/60 to-emerald-950/60 border border-teal-700/60 rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-teal-400" />
            <h5 className="text-xs font-bold text-teal-200 uppercase tracking-wider">Análisis de Frecuencia y Fidelidad</h5>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-900/80 p-2 rounded-lg border border-teal-800/60 shadow-xs">
              <span className="text-[10px] text-slate-400 block font-semibold">Total Compras</span>
              <span className="text-sm font-black text-white">{sortedSales.length} facturas</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-teal-800/60 shadow-xs">
              <span className="text-[10px] text-slate-400 block font-semibold">Frecuencia Media</span>
              <span className="text-sm font-black text-teal-300">
                {client.avgFrequencyDays > 0 ? `Cada ${client.avgFrequencyDays} días` : 'Compra única'}
              </span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-teal-800/60 shadow-xs">
              <span className="text-[10px] text-slate-400 block font-semibold">Último Pedido</span>
              <span className={cn("text-sm font-black", client.daysSinceLastPurchase > 45 ? "text-rose-400" : "text-emerald-400")}>
                {client.daysSinceLastPurchase === 0 ? 'Hoy' : `Hace ${client.daysSinceLastPurchase} días`}
              </span>
            </div>
          </div>
        </div>

        <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-700">
          {sortedSales.map((sale, idx) => {
            let daysFromPrevious: number | null = null;
            if (idx > 0) {
              const prevDate = new Date(sortedSales[idx - 1].date).getTime();
              const currDate = new Date(sale.date).getTime();
              daysFromPrevious = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
            }

            return (
              <div key={sale.id || idx} className="relative group">
                <div className="absolute -left-[27px] top-1.5 w-4 h-4 rounded-full bg-slate-900 border-2 border-teal-400 flex items-center justify-center shadow-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400"></div>
                </div>

                <div className="bg-slate-800/90 p-3 rounded-xl border border-slate-700 shadow-xs hover:border-teal-500 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-slate-900 text-teal-300 font-mono font-bold text-[11px] rounded border border-slate-700">
                          Folio: {sale.folio || 'S/F'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-semibold">
                          {new Date(sale.date).toLocaleDateString('es-GT', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 flex items-center gap-1">
                        👤 Vendedor: <strong className="text-white">{sale.sellerName || sale.sellerId}</strong>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-black text-emerald-400">
                        Q{sale.totalAmount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="block text-[10px] text-slate-400 capitalize">
                        {sale.status === 'paid' ? 'Pagada' : sale.status}
                      </span>
                    </div>
                  </div>

                  {daysFromPrevious !== null && (
                    <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center gap-1 text-[11px] text-teal-300 font-bold bg-teal-950/40 px-2 py-1 rounded">
                      <Clock className="w-3 h-3 text-teal-400" />
                      <span>{daysFromPrevious} días transcurridos desde el pedido anterior</span>
                    </div>
                  )}

                  {idx === 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                      <span>🏁 Primer pedido registrado en el periodo</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={cn(
      "w-full flex flex-col bg-slate-900 text-slate-100 overflow-hidden select-none",
      embedded ? "h-[calc(100vh-160px)] min-h-[700px] rounded-2xl border border-slate-700/80 shadow-sm" : "h-[calc(100vh-64px)]"
    )}>
      {/* Top Header */}
      <header className="bg-slate-800/95 border-b border-slate-700 px-4 py-2.5 shrink-0 z-20 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shrink-0">
              <MapIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-black text-white tracking-tight">Control de Clientes & Analítica Comercial</h1>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Solo Admin
                </span>
                {embedded && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    Sincronizado con Visitas
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">Coordenadas en terreno, ticket promedio, frecuencia y lealtad</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-600 cursor-pointer"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin text-teal-400")} />
              <span>Actualizar</span>
            </button>

            {pinningClient && (
              <div className="bg-amber-500/20 border border-amber-500 text-amber-200 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-2 animate-pulse">
                <span>📍 Haz clic en el mapa para ubicar a: <strong>{pinningClient.name}</strong></span>
                <button
                  onClick={() => setPinningClient(null)}
                  className="p-0.5 hover:bg-amber-600 rounded text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* KPI Stats Ribbon with Ticket Promedio and Frecuencia */}
      <section className="bg-slate-850/80 border-b border-slate-700/80 px-4 py-2 shrink-0">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
          <div className="bg-slate-800 p-2 rounded-lg border border-slate-700/80">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Clientes</span>
            <span className="text-sm font-black text-white">{stats.total}</span>
          </div>

          <div className="bg-slate-800 p-2 rounded-lg border border-slate-700/80">
            <span className="text-[9px] text-teal-400 font-bold uppercase block">Con Compras</span>
            <span className="text-sm font-black text-teal-300">{stats.withSales}</span>
          </div>

          <div className="bg-slate-800 p-2 rounded-lg border border-slate-700/80">
            <span className="text-[9px] text-emerald-400 font-bold uppercase block">Ticket Promedio</span>
            <span className="text-sm font-black text-emerald-400">Q{stats.avgTicket.toLocaleString('es-GT', { maximumFractionDigits: 0 })}</span>
          </div>

          <div className="bg-slate-800 p-2 rounded-lg border border-slate-700/80">
            <span className="text-[9px] text-teal-300 font-bold uppercase block">Frecuencia Media</span>
            <span className="text-sm font-black text-teal-300">{stats.avgFreq > 0 ? `Cada ${stats.avgFreq}d` : 'N/A'}</span>
          </div>

          <div className="bg-slate-800 p-2 rounded-lg border border-slate-700/80">
            <span className="text-[9px] text-emerald-400 font-bold uppercase block">Frecuentes (&le;15d)</span>
            <span className="text-sm font-black text-emerald-400">{stats.activeClients}</span>
          </div>

          <div className="bg-slate-800 p-2 rounded-lg border border-slate-700/80">
            <span className="text-[9px] text-rose-400 font-bold uppercase block">En Riesgo (&gt;45d)</span>
            <span className="text-sm font-black text-rose-400">{stats.inactiveClients}</span>
          </div>

          <div className="bg-slate-800 p-2 rounded-lg border border-slate-700/80">
            <span className="text-[9px] text-emerald-300 font-bold uppercase block">GPS Fijado</span>
            <span className="text-sm font-black text-emerald-300">{stats.exactGeo}</span>
          </div>

          <div className="bg-slate-800 p-2 rounded-lg border border-slate-700/80">
            <span className="text-[9px] text-teal-200 font-bold uppercase block">Venta Global</span>
            <span className="text-sm font-black text-white">Q{stats.totalRevenue.toLocaleString('es-GT', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      </section>

      {/* Main Content Area: Split View (Map on Left, Directory on Right) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
        
        {/* Left Side: Filter Bar + Map View */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          
          {/* Filter Ribbon */}
          <div className="bg-slate-800/90 p-2 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2 z-10 shrink-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                <Users className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <select
                  value={selectedSeller}
                  onChange={(e) => setSelectedSeller(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 font-bold focus:outline-hidden cursor-pointer"
                >
                  <option value="all" className="bg-slate-800">Todos los Vendedores</option>
                  {sellers.map((s) => (
                    <option key={s.id || s.email} value={s.email || s.id} className="bg-slate-800">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                <Calendar className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span className="text-[10px] text-slate-400 font-bold">Desde:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 focus:outline-hidden cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                <Filter className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 font-medium focus:outline-hidden cursor-pointer"
                >
                  <option value="all" className="bg-slate-800">Todos los Estados</option>
                  <option value="active" className="bg-slate-800">🟢 Activos (&le;15 días)</option>
                  <option value="moderate" className="bg-slate-800">🟡 Moderados (15-45d)</option>
                  <option value="inactive" className="bg-slate-800">🔴 Inactivos (&gt;45d)</option>
                  <option value="no-sales" className="bg-slate-800">⚪ Sin Compras</option>
                </select>
              </div>
            </div>

            {/* Map Layer Switcher */}
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-700 text-xs">
              <button
                onClick={() => setMapType('satellite')}
                className={cn("px-2 py-1 rounded font-bold transition-all cursor-pointer", mapType === 'satellite' ? "bg-teal-600 text-white shadow-xs" : "text-slate-400 hover:text-white")}
              >
                Satélite
              </button>
              <button
                onClick={() => setMapType('streets')}
                className={cn("px-2 py-1 rounded font-bold transition-all cursor-pointer", mapType === 'streets' ? "bg-teal-600 text-white shadow-xs" : "text-slate-400 hover:text-white")}
              >
                Calles
              </button>
              <button
                onClick={() => setMapType('terrain')}
                className={cn("px-2 py-1 rounded font-bold transition-all cursor-pointer", mapType === 'terrain' ? "bg-teal-600 text-white shadow-xs" : "text-slate-400 hover:text-white")}
              >
                Relieve
              </button>
            </div>
          </div>

          {/* Leaflet Map Canvas */}
          <div ref={mapContainerRef} className="flex-1 w-full h-full min-h-[300px] z-0 relative bg-slate-950" />

          {/* Map Legend */}
          <div className="absolute bottom-4 left-4 z-10 bg-slate-900/90 backdrop-blur-md p-2 rounded-xl border border-slate-700 shadow-xl text-[10px] space-y-1 hidden sm:block">
            <span className="font-bold text-slate-300 block text-[9px] uppercase">Leyenda de Clientes</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-xs"></span>
              <span className="text-slate-300">Activo (Compra en &le;15 días)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-xs"></span>
              <span className="text-slate-300">Moderado (15-45 días)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-xs"></span>
              <span className="text-slate-300">Inactivo (&gt;45 días)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block shadow-xs"></span>
              <span className="text-slate-300">Sin compras registradas</span>
            </div>
          </div>
        </div>

        {/* Right Side: Client Directory */}
        <aside className="w-full lg:w-[440px] bg-slate-800/95 border-t lg:border-t-0 lg:border-l border-slate-700 flex flex-col h-[380px] lg:h-full z-10 shrink-0">
          
          <div className="p-2.5 border-b border-slate-700 space-y-1.5 bg-slate-850">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar cliente, folio, empresa, municipio..."
                className="w-full pl-9 pr-8 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-teal-500"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-2 text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 rounded-lg text-[10px] font-bold text-center">
              <button
                onClick={() => setLocationFilter('exact')}
                className={cn("py-1 rounded transition-colors cursor-pointer", locationFilter === 'exact' ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-emerald-300")}
              >
                Con GPS ({stats.exactGeo})
              </button>
              <button
                onClick={() => setLocationFilter('all')}
                className={cn("py-1 rounded transition-colors cursor-pointer", locationFilter === 'all' ? "bg-teal-600 text-white" : "text-slate-400 hover:text-white")}
              >
                Todos ({clients.length})
              </button>
              <button
                onClick={() => setLocationFilter('approx')}
                className={cn("py-1 rounded transition-colors cursor-pointer", locationFilter === 'approx' ? "bg-amber-600 text-white" : "text-slate-400 hover:text-amber-300")}
              >
                Aprox ({stats.approxGeo})
              </button>
              <button
                onClick={() => setLocationFilter('missing')}
                className={cn("py-1 rounded transition-colors cursor-pointer", locationFilter === 'missing' ? "bg-rose-600 text-white" : "text-slate-400 hover:text-rose-300")}
              >
                Sin GPS ({stats.missingGeo})
              </button>
            </div>
          </div>

          {/* Client Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-700/60 p-2 space-y-1">
            {loading ? (
              <div className="py-16 text-center">
                <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400">Cargando base de datos de clientes...</p>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                No se encontraron clientes con los filtros aplicados.
              </div>
            ) : (
              filteredClients.map((client) => {
                const isExact = client.resolvedGeo?.isExact;
                const isApprox = client.resolvedGeo && !isExact;
                const isMissing = !client.resolvedGeo;

                return (
                  <div
                    key={client.id}
                    onClick={() => {
                      if (client.resolvedGeo?.isExact) {
                        centerOnClient(client);
                      } else {
                        setSelectedClient(client);
                      }
                    }}
                    className={cn(
                      "p-2.5 rounded-xl transition-all cursor-pointer border group hover:border-teal-500/50",
                      selectedClient?.id === client.id ? "bg-teal-950/40 border-teal-500/60" : "bg-slate-800/80 border-slate-700/60 hover:bg-slate-750"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-white text-xs truncate group-hover:text-teal-300">
                            {client.name}
                          </h4>
                          {client.clientCode && (
                            <span className="text-[9px] font-mono text-slate-400 bg-slate-900 px-1 rounded">
                              {client.clientCode}
                            </span>
                          )}
                        </div>

                        {client.companyName && (
                          <p className="text-[11px] text-teal-300/80 font-medium truncate mt-0.5">
                            🏢 {client.companyName}
                          </p>
                        )}

                        <p className="text-[10px] text-slate-400 truncate mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0 text-slate-500" />
                          <span>{client.address || 'Sin dirección registrada'}</span>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-emerald-400 block">
                          Q{client.totalRevenue.toLocaleString('es-GT', { maximumFractionDigits: 0 })}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold block">
                          {client.totalSales} fact. · Ticket: Q{client.totalSales > 0 ? Math.round(client.totalRevenue / client.totalSales) : 0}
                        </span>
                        {client.avgFrequencyDays > 0 && (
                          <span className="text-[9px] text-teal-300 font-medium block">
                            Cada {client.avgFrequencyDays}d
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-700/40 flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1 flex-wrap">
                        {isExact && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                            📍 GPS Exacto
                          </span>
                        )}
                        {isApprox && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30 truncate max-w-[130px]" title={client.resolvedGeo?.locationLabel}>
                            {client.resolvedGeo?.locationLabel}
                          </span>
                        )}
                        {isMissing && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                            ⚠️ Sin Coordenadas
                          </span>
                        )}

                        {client.totalSales > 0 && (
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-bold border",
                            client.daysSinceLastPurchase <= 15 ? "bg-emerald-950 text-emerald-300 border-emerald-700" :
                            client.daysSinceLastPurchase <= 45 ? "bg-amber-950 text-amber-300 border-amber-700" :
                            "bg-rose-950 text-rose-300 border-rose-700"
                          )}>
                            {client.daysSinceLastPurchase <= 15 ? '🟢 Frecuente' : client.daysSinceLastPurchase <= 45 ? '🟡 Moderado' : '🔴 Inactivo'}
                          </span>
                        )}

                        <span className="text-slate-400 truncate max-w-[100px]">
                          👤 {client.sellerName}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClient(client);
                          }}
                          className="px-2 py-0.5 bg-teal-600/30 hover:bg-teal-600 text-teal-200 hover:text-white rounded font-bold text-[10px] transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Historial</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPinningClient(client);
                          }}
                          className="p-1 hover:bg-slate-700 text-slate-400 hover:text-amber-300 rounded cursor-pointer transition-colors"
                          title="Fijar pin exacto en el mapa"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>

      {/* Detail Modal for Client History */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            
            <div className="p-4 border-b border-slate-800 bg-slate-850 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base md:text-lg font-black text-white">{selectedClient.name}</h3>
                  {selectedClient.clientCode && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-900/60 text-teal-300 border border-teal-700/50">
                      Código: {selectedClient.clientCode}
                    </span>
                  )}
                </div>
                {selectedClient.companyName && (
                  <p className="text-xs text-teal-400 font-semibold mt-0.5">🏢 {selectedClient.companyName}</p>
                )}
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>{selectedClient.address || 'Sin dirección descriptiva'}</span>
                </p>
              </div>

              <button
                onClick={() => setSelectedClient(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 text-center">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Total Facturado</span>
                  <span className="text-sm font-black text-emerald-400">
                    Q{selectedClient.totalRevenue.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 text-center">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Total Facturas</span>
                  <span className="text-sm font-black text-white">{selectedClient.totalSales}</span>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 text-center">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Frecuencia Media</span>
                  <span className="text-sm font-black text-teal-400">
                    {selectedClient.avgFrequencyDays > 0 ? `${selectedClient.avgFrequencyDays} días` : 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 text-center">
                  <span className="text-[9px] text-slate-400 font-bold uppercase block">Vendedor Asignado</span>
                  <span className="text-xs font-bold text-slate-200 truncate block mt-1" title={selectedClient.sellerName}>
                    {selectedClient.sellerName}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="font-bold text-slate-300 block">Estado de Ubicación:</span>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    {selectedClient.resolvedGeo?.isExact 
                      ? '✅ Coordenadas exactas guardadas en la base de datos' 
                      : selectedClient.resolvedGeo 
                        ? `ℹ️ ${selectedClient.resolvedGeo.locationLabel}` 
                        : '⚠️ Sin coordenadas ni municipio identificado'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const c = selectedClient;
                    setSelectedClient(null);
                    setPinningClient(c);
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-xs flex items-center gap-1"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Fijar / Cambiar Pin</span>
                </button>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-teal-400" />
                  <span>Historial Cronológico de Compras (Folios y Días entre Pedidos)</span>
                </h4>
                {renderSalesTimeline(selectedClient)}
              </div>
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-850 flex justify-end">
              <button
                onClick={() => setSelectedClient(null)}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
