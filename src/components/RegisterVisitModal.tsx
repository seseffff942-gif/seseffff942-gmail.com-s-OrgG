import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Client, User, VisitType, ClientVisit } from '../types';
import { api } from '../api';
import { 
  Search, MapPin, X, Check, Building2, Phone, 
  ShoppingCart, DollarSign, UserPlus, Package, 
  ClipboardCheck, Camera, AlertCircle, Sparkles, Navigation,
  Tag, Image as ImageIcon, Trash2, Box, RefreshCw, Upload,
  WifiOff, Compass, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, normalizeSearchText, validateAndSanitizeImageFile, isClientOfSeller } from '../utils';

interface RegisterVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  currentLocation: { latitude: number; longitude: number; accuracy?: number } | null;
  currentUser: User;
  onVisitRegistered: (visit: ClientVisit) => void;
  preselectedClient?: Client | null;
  onRefreshGps?: () => void;
}

const VISIT_TYPES: { id: VisitType; label: string; icon: any; color: string; bg: string; border: string }[] = [
  { id: 'cobro', label: 'Cobro de Factura', icon: DollarSign, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200/80' },
  { id: 'pedido', label: 'Toma de Pedido', icon: ShoppingCart, color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200/80' },
  { id: 'rutina', label: 'Visita de Rutina', icon: ClipboardCheck, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200/80' },
  { id: 'prospeccion', label: 'Prospección', icon: UserPlus, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200/80' },
  { id: 'entrega', label: 'Entrega Producto', icon: Package, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200/80' },
];

const QUICK_OBSERVATION_CHIPS = [
  "🛒 Pedido tomado y confirmado",
  "💰 Cobro recibido en efectivo",
  "💰 Cheque recibido para depósito",
  "📋 Stock verificado y en orden",
  "🤝 Muestras de producto entregadas",
  "⚠️ Cliente solicita visita técnica",
  "🏬 Local cerrado temporalmente"
];

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 0;
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(Math.max(0, Math.min(1, a))), Math.sqrt(Math.max(0, 1 - a)));
  const dist = Math.round(R * c);
  return isNaN(dist) ? 0 : Math.max(0, dist);
}

export function RegisterVisitModal({
  isOpen,
  onClose,
  clients,
  currentLocation,
  currentUser,
  onVisitRegistered,
  preselectedClient,
  onRefreshGps
}: RegisterVisitModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(preselectedClient || null);
  const [visitType, setVisitType] = useState<VisitType>('rutina');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successSaved, setSuccessSaved] = useState(false);
  const [gpsSourceChoice, setGpsSourceChoice] = useState<'device' | 'client_saved' | 'last_known'>('device');
  const [isManualGpsLoading, setIsManualGpsLoading] = useState(false);
  const [localDeviceGps, setLocalDeviceGps] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(currentLocation);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Sync external currentLocation with localDeviceGps
  useEffect(() => {
    if (currentLocation) {
      setLocalDeviceGps(currentLocation);
      try {
        localStorage.setItem('last_known_gps_coords', JSON.stringify({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          accuracy: currentLocation.accuracy,
          timestamp: Date.now()
        }));
      } catch (e) {}
    }
  }, [currentLocation]);

  // RESET TOTAL DEL ESTADO AL ABRIR O CERRAR (Evita fugas de clientes o fotos entre visitas)
  const resetAllState = (preselected?: Client | null) => {
    setSelectedClient(preselected || null);
    setSearchTerm('');
    setVisitType('rutina');
    setNotes('');
    setPhotoUrl('');
    setIsProcessingPhoto(false);
    setIsSubmitting(false);
    setErrorMsg('');
    setSuccessSaved(false);
    setGpsSourceChoice('device');
    setIsManualGpsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      resetAllState(preselectedClient);
      // Auto-trigger GPS acquisition if location is not yet ready
      if (!currentLocation && !localDeviceGps) {
        requestDirectGps();
      }
    } else {
      resetAllState(null);
    }
  }, [isOpen, preselectedClient]);

  const requestDirectGps = () => {
    if (!navigator.geolocation) return;
    setIsManualGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const fresh = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        setLocalDeviceGps(fresh);
        try {
          localStorage.setItem('last_known_gps_coords', JSON.stringify({
            ...fresh,
            timestamp: Date.now()
          }));
        } catch (e) {}
        setIsManualGpsLoading(false);
        setErrorMsg('');
      },
      (err) => {
        console.warn('Direct GPS check failed:', err);
        setIsManualGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 35000, maximumAge: 15000 }
    );
  };

  // Last known GPS from storage
  const lastKnownGps = useMemo(() => {
    try {
      const stored = localStorage.getItem('last_known_gps_coords');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}
    return null;
  }, [isOpen, localDeviceGps]);

  // Active GPS to use
  const activeGps = useMemo(() => {
    if (gpsSourceChoice === 'client_saved' && selectedClient?.latitude && selectedClient?.longitude) {
      return {
        latitude: selectedClient.latitude,
        longitude: selectedClient.longitude,
        accuracy: 10,
        source: 'client_saved'
      };
    }
    if (localDeviceGps) {
      return {
        latitude: localDeviceGps.latitude,
        longitude: localDeviceGps.longitude,
        accuracy: localDeviceGps.accuracy,
        source: 'device'
      };
    }
    if (lastKnownGps && lastKnownGps.latitude && lastKnownGps.longitude) {
      return {
        latitude: lastKnownGps.latitude,
        longitude: lastKnownGps.longitude,
        accuracy: lastKnownGps.accuracy,
        source: 'last_known'
      };
    }
    if (selectedClient?.latitude && selectedClient?.longitude) {
      return {
        latitude: selectedClient.latitude,
        longitude: selectedClient.longitude,
        accuracy: 15,
        source: 'client_saved'
      };
    }
    return null;
  }, [gpsSourceChoice, localDeviceGps, lastKnownGps, selectedClient]);

  const sellerClients = useMemo(() => {
    if (currentUser.role === 'admin') return clients;
    return clients.filter(c => isClientOfSeller(c, currentUser));
  }, [clients, currentUser]);

  const nearbyClients = useMemo(() => {
    if (!activeGps) return [];
    return sellerClients
      .filter(c => c.latitude && c.longitude && !isNaN(c.latitude) && !isNaN(c.longitude))
      .map(c => {
        const dist = calculateDistanceMeters(
          activeGps.latitude,
          activeGps.longitude,
          c.latitude!,
          c.longitude!
        );
        return { ...c, distanceMeters: dist };
      })
      .filter(c => c.distanceMeters <= 1500)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [sellerClients, activeGps]);

  const filteredClients = useMemo(() => {
    const term = normalizeSearchText(searchTerm);
    if (!term) return sellerClients.slice(0, 20);

    return sellerClients.filter(c => {
      if (!c) return false;
      const name = normalizeSearchText(c.name);
      const code = normalizeSearchText(c.clientCode);
      const company = normalizeSearchText(c.companyName);
      const phone = normalizeSearchText(c.phone);
      const nit = normalizeSearchText(c.nit);
      const address = normalizeSearchText(c.address);

      return (
        name.includes(term) ||
        code.includes(term) ||
        company.includes(term) ||
        phone.includes(term) ||
        nit.includes(term) ||
        address.includes(term)
      );
    }).slice(0, 25);
  }, [sellerClients, searchTerm]);

  const distanceToSelected = useMemo(() => {
    if (!activeGps || !selectedClient?.latitude || !selectedClient?.longitude) return null;
    return calculateDistanceMeters(
      activeGps.latitude,
      activeGps.longitude,
      selectedClient.latitude,
      selectedClient.longitude
    );
  }, [activeGps, selectedClient]);

  // Manejador seguro de fotos (Anti-ataques, anti-malware, re-codificación en Canvas)
  const handlePhotoFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // Limpiar para permitir volver a seleccionar el mismo archivo
    if (!file) return;

    setIsProcessingPhoto(true);
    setErrorMsg('');

    try {
      const result = await validateAndSanitizeImageFile(file, 1000, 1000, 0.72);
      if (!result.ok || !result.webpBase64) {
        setErrorMsg(result.error || 'Archivo rechazado por seguridad. Solo fotos reales.');
        return;
      }
      setPhotoUrl(result.webpBase64);
      setErrorMsg('');
    } catch (err: any) {
      setErrorMsg('Error al validar la foto: ' + (err.message || 'Formato no soportado'));
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleAddChipToNotes = (chipText: string) => {
    setNotes(prev => {
      if (!prev.trim()) return chipText;
      if (prev.includes(chipText)) return prev;
      return `${prev}. ${chipText}`;
    });
  };

  // Guardar Visita con COORDENADAS CONGELADAS OFFLINE Y SINCRONIZACIÓN AUTOMÁTICA
  const handleSaveVisit = async () => {
    if (!selectedClient) {
      setErrorMsg('Selecciona el cliente que estás visitando.');
      return;
    }
    // FOTO OBLIGATORIA
    if (!photoUrl) {
      setErrorMsg('⚠️ La foto de comprobante o fachada es OBLIGATORIA para validar y registrar la visita.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    // Congelar coordenadas y timestamp EXACTOS en el momento y lugar de la visita
    const capturedTimestamp = new Date().toISOString();
    const finalLat = activeGps?.latitude ?? (selectedClient.latitude || 0);
    const finalLng = activeGps?.longitude ?? (selectedClient.longitude || 0);
    const finalAcc = activeGps?.accuracy ?? (selectedClient.latitude ? 15 : undefined);
    const finalGpsSource = activeGps?.source || (finalLat !== 0 ? 'client_saved' : 'offline_provisional');

    const offlineId = `visit_offline_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const visitPayload: any = {
      id: offlineId,
      offlineId: offlineId,
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      clientCode: selectedClient.clientCode,
      companyName: selectedClient.companyName,
      sellerId: currentUser.id,
      sellerName: currentUser.name || currentUser.email || 'Vendedor',
      sellerEmail: currentUser.email || '',
      latitude: finalLat,
      longitude: finalLng,
      accuracy: finalAcc,
      distanceMeters: distanceToSelected ?? undefined,
      visitType,
      notes: notes.trim(),
      photoUrl,
      capturedAt: capturedTimestamp,
      createdAt: capturedTimestamp,
      gpsSource: finalGpsSource,
      isOffline: !navigator.onLine
    };

    // 1. Guardar de forma inmediata e indeleble en la cola offline local
    try {
      const storedQueue = JSON.parse(localStorage.getItem('offline_client_visits') || '[]');
      storedQueue.unshift(visitPayload);
      localStorage.setItem('offline_client_visits', JSON.stringify(storedQueue));
    } catch (storageErr) {
      console.warn('Could not store in offline_client_visits:', storageErr);
    }

    // 2. Si hay conexión a internet, intentar enviar al servidor en vivo
    let serverRes: any = null;
    let savedOnline = false;

    if (navigator.onLine) {
      try {
        serverRes = await api.createVisit(visitPayload);
        if (serverRes && (serverRes.success || serverRes.visit)) {
          savedOnline = true;
          // Retirar de la cola offline ya que fue sincronizada
          try {
            const currentQueue = JSON.parse(localStorage.getItem('offline_client_visits') || '[]');
            const updatedQueue = currentQueue.filter((v: any) => v.offlineId !== offlineId && v.id !== offlineId);
            localStorage.setItem('offline_client_visits', JSON.stringify(updatedQueue));
          } catch (e) {}
        }
      } catch (networkErr: any) {
        console.warn('Network submit failed, visit remains safely in offline queue:', networkErr);
      }
    }

    setSuccessSaved(true);

    setTimeout(() => {
      // Disparar evento para actualizar mapa y lista de visitas en la UI
      onVisitRegistered((serverRes?.visit || visitPayload) as ClientVisit);
      
      // LIMPIEZA INMEDIATA Y RIGUROSA: No dejar datos en memoria para la siguiente visita
      resetAllState(null);
      onClose();
    }, 700);
  };

  if (!isOpen) return null;

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-teal-50 text-teal-600 rounded-2xl border border-teal-100 shadow-2xs">
              <ClipboardCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 tracking-tight font-manrope">Registrar Visita en Terreno</h3>
                {isOffline && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                    <WifiOff size={11} /> Sin Señal (Offline)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">Captura reporte, foto y coordenadas congeladas en sitio</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => {
              resetAllState(null);
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* GPS Live Header Badge & Offline Safety Banner */}
        <div className="bg-slate-900 text-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between text-xs border-b border-slate-800 gap-2">
          <div className="flex items-center space-x-2">
            <div className={cn(
              "w-2.5 h-2.5 rounded-full ring-4",
              activeGps ? "bg-emerald-400 ring-emerald-400/20" : "bg-amber-400 animate-pulse ring-amber-400/20"
            )} />
            <span className="font-medium text-slate-300">Coordenadas del Sitio:</span>
            {activeGps ? (
              <span className="font-mono text-[11px] text-emerald-400 font-bold">
                {activeGps.latitude.toFixed(5)}, {activeGps.longitude.toFixed(5)}
                {activeGps.accuracy && <span className="text-[10px] text-slate-400 font-normal ml-1">(±{Math.round(activeGps.accuracy)}m)</span>}
              </span>
            ) : (
              <span className="text-amber-400 font-medium flex items-center gap-1.5">
                {isManualGpsLoading ? 'Buscando satélites GPS...' : 'GPS en espera'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={requestDirectGps}
              disabled={isManualGpsLoading}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-slate-700 transition cursor-pointer"
              title="Actualizar o forzar lectura GPS de satélites"
            >
              <RefreshCw size={11} className={cn(isManualGpsLoading && "animate-spin text-teal-400")} />
              <span>{isManualGpsLoading ? 'Buscando...' : 'Reintentar GPS'}</span>
            </button>

            {distanceToSelected !== null && (
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                distanceToSelected <= 150 
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" 
                  : distanceToSelected <= 1500
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-slate-700 text-slate-300 border-slate-600"
              )}>
                {distanceToSelected <= 150 ? '🎯 En local' : '📍 A'} {distanceToSelected > 1000 ? `${(distanceToSelected / 1000).toFixed(1)} km` : `${distanceToSelected} m`}
              </span>
            )}
          </div>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* GPS Fallback Selector (Si no hay señal en zona remota) */}
          {!localDeviceGps && selectedClient?.latitude && selectedClient?.longitude && (
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-2xl flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="font-bold text-teal-950 flex items-center gap-1.5">
                  <MapPin size={13} className="text-teal-600" />
                  Ubicación guardada del cliente disponible:
                </span>
                <p className="text-[11px] text-teal-700">
                  {selectedClient.latitude.toFixed(5)}, {selectedClient.longitude.toFixed(5)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGpsSourceChoice('client_saved')}
                className={cn(
                  "px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer border shadow-2xs",
                  gpsSourceChoice === 'client_saved'
                    ? "bg-teal-700 text-white border-teal-800"
                    : "bg-white text-teal-800 border-teal-300 hover:bg-teal-100"
                )}
              >
                {gpsSourceChoice === 'client_saved' ? '✓ Usando este punto' : 'Usar este punto'}
              </button>
            </div>
          )}

          {/* 1. Client Selection */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              1. Cliente que estás visitando *
            </label>

            {selectedClient ? (
              <div className="p-3.5 bg-teal-50/80 border border-teal-300 rounded-2xl flex items-center justify-between shadow-2xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-teal-950">{selectedClient.name}</span>
                    {selectedClient.clientCode && (
                      <span className="text-[10px] font-bold bg-teal-200/70 text-teal-900 px-1.5 py-0.5 rounded">
                        #{selectedClient.clientCode}
                      </span>
                    )}
                  </div>
                  {selectedClient.companyName && (
                    <p className="text-[11px] text-teal-700 font-medium">{selectedClient.companyName}</p>
                  )}
                  {selectedClient.address && (
                    <p className="text-[10px] text-slate-500 truncate max-w-xs">{selectedClient.address}</p>
                  )}
                </div>
                <button 
                  type="button"
                  onClick={() => setSelectedClient(null)}
                  className="text-xs font-bold text-teal-800 hover:text-teal-950 underline px-2 py-1 cursor-pointer"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {nearbyClients.length > 0 && !searchTerm && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-1.5">
                    <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                      <Sparkles size={13} className="text-amber-600" />
                      Clientes detectados cerca de ti (&lt;1.5km):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {nearbyClients.slice(0, 4).map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedClient(c)}
                          className="px-2.5 py-1 bg-white border border-amber-200 rounded-xl text-xs font-bold text-amber-950 hover:bg-amber-100 flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                        >
                          <span>{c.name}</span>
                          <span className="text-[10px] text-amber-700 font-mono">({c.distanceMeters}m)</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input 
                    type="text"
                    placeholder="Buscar por Nombre, Código (ej: 1234), Empresa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium placeholder:text-slate-400"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white shadow-2xs">
                  {filteredClients.map(c => (
                    <div 
                      key={c.id}
                      onClick={() => setSelectedClient(c)}
                      className="p-2.5 hover:bg-teal-50/60 cursor-pointer flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{c.name}</span>
                        {c.companyName && <span className="text-slate-400 ml-1.5">({c.companyName})</span>}
                      </div>
                      {c.clientCode && (
                        <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold">
                          #{c.clientCode}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Visit Type Selection */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              2. Motivo o Tipo de Visita *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {VISIT_TYPES.map(type => {
                const isSelected = visitType === type.id;
                const IconComponent = type.icon;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setVisitType(type.id)}
                    className={cn(
                      "p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1.5",
                      isSelected
                        ? `${type.bg} ${type.border} ring-2 ring-teal-600 shadow-2xs`
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div className={cn("p-1.5 rounded-lg w-fit", isSelected ? "bg-white shadow-2xs" : "bg-slate-100")}>
                      <IconComponent size={16} className={type.color} />
                    </div>
                    <span className={cn("text-xs font-bold leading-tight", isSelected ? type.color : "text-slate-700")}>
                      {type.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. FOTO DE PRUEBA (OBLIGATORIA CON VALIDACIÓN ESTRICTA Y SUBIDA DESDE GALERÍA O CÁMARA) */}
          <div className="space-y-2 p-4 bg-slate-50 border border-slate-200/90 rounded-2xl">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <Camera size={14} className="text-teal-700" />
                <span>3. Foto de Comprobante / Fachada</span>
                <span className="bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase">
                  Obligatoria
                </span>
              </label>
              {photoUrl ? (
                <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <Check size={12} strokeWidth={3} /> Foto Validada
                </span>
              ) : (
                <span className="text-[10px] font-bold text-rose-600">
                  * Requerida para guardar
                </span>
              )}
            </div>

            <p className="text-[10px] text-slate-500 font-medium">
              Toma una foto en directo o sube una imagen de la galería de tu dispositivo (procesamiento seguro con escudo anti-malware).
            </p>

            {/* Hidden file inputs */}
            <input 
              ref={cameraInputRef}
              type="file" 
              accept="image/*" 
              capture="environment" 
              onChange={handlePhotoFileSelected} 
              className="hidden" 
            />
            <input 
              ref={galleryInputRef}
              type="file" 
              accept="image/jpeg,image/png,image/webp,image/jpg,image/heic,image/heif" 
              onChange={handlePhotoFileSelected} 
              className="hidden" 
            />

            {/* Photo Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {/* Option A: Direct Camera */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isProcessingPhoto}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 border shadow-2xs",
                  photoUrl 
                    ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    : "bg-[#0b4d2c] hover:bg-[#083820] text-white border-[#0b4d2c]"
                )}
              >
                <Camera size={15} />
                <span>📸 Tomar Foto</span>
              </button>

              {/* Option B: Choose from Gallery / Device */}
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={isProcessingPhoto}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs"
              >
                <Upload size={15} className="text-teal-700" />
                <span>🖼️ Subir de Galería</span>
              </button>

              {/* Photo Preview & Delete */}
              {photoUrl && (
                <div className="relative group w-14 h-14 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-2xs shrink-0 ml-auto">
                  <img src={photoUrl} alt="Comprobante" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    className="absolute inset-0 bg-rose-600/85 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Eliminar foto"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            {isProcessingPhoto && (
              <div className="flex items-center gap-2 text-xs text-teal-700 font-bold animate-pulse pt-1">
                <ShieldCheck size={14} />
                <span>Validando y sanitizando archivo de imagen...</span>
              </div>
            )}
          </div>

          {/* 4. Quick Chips & Notes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                4. Notas / Observaciones
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Toca para agregar rápido:</span>
            </div>

            {/* Tap-to-add common observation chips */}
            <div className="flex flex-wrap gap-1 mb-1">
              {QUICK_OBSERVATION_CHIPS.map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleAddChipToNotes(chip)}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-teal-50 hover:text-teal-900 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer"
                >
                  + {chip}
                </button>
              ))}
            </div>

            <textarea 
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Se entregó catálogo, prometió pago para el martes..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-4 sm:mx-5 mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-700">
            <AlertCircle size={15} className="text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
          <button 
            type="button"
            onClick={() => {
              resetAllState(null);
              onClose();
            }}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSaveVisit}
            disabled={!selectedClient || !photoUrl || isSubmitting || isProcessingPhoto}
            className={cn(
              "px-5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer",
              successSaved
                ? "bg-emerald-600 text-white"
                : selectedClient && photoUrl && !isSubmitting
                  ? "bg-[#0b4d2c] hover:bg-[#083820] text-white active:scale-95 shadow-emerald-900/10"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
            )}
          >
            {successSaved ? (
              <>
                <Check size={15} />
                <span>{isOffline ? '¡Guardada Offline en Sitio!' : '¡Visita Guardada con Éxito!'}</span>
              </>
            ) : isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <ClipboardCheck size={15} />
                <span>{isOffline ? 'Guardar Visita Offline' : 'Guardar Visita con Foto'}</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
