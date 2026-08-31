import React, { useEffect, useRef, useState } from 'react';
import { ClientVisit, Client } from '../types';
import { api } from '../api';
import { 
  X, MapPin, Calendar, Clock, User, Building2, 
  Phone, Tag, ExternalLink, Navigation, CheckCircle2, 
  Maximize2, Image as ImageIcon, Sparkles, AlertCircle, Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, fechaDDMMYYYY } from '../utils';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface VisitDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit: ClientVisit | null;
  client?: Client | null;
}

export function VisitDetailModal({ isOpen, onClose, visit, client }: VisitDetailModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [isPhotoExpanded, setIsPhotoExpanded] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [isLoadingPhoto, setIsLoadingPhoto] = useState<boolean>(false);

  // Fetch visit photo on-demand from Supabase when modal opens
  useEffect(() => {
    if (!isOpen || !visit) {
      setPhotoUrl('');
      setIsLoadingPhoto(false);
      return;
    }

    if (visit.photoUrl && (visit.photoUrl.startsWith('data:') || visit.photoUrl.startsWith('http'))) {
      setPhotoUrl(visit.photoUrl);
      setIsLoadingPhoto(false);
    } else {
      setIsLoadingPhoto(true);
      api.getVisitPhoto(visit.id)
        .then((fetchedPhoto) => {
          if (fetchedPhoto) {
            setPhotoUrl(fetchedPhoto);
          } else {
            setPhotoUrl(visit.photoUrl || '');
          }
        })
        .catch(() => {
          setPhotoUrl(visit.photoUrl || '');
        })
        .finally(() => {
          setIsLoadingPhoto(false);
        });
    }
  }, [isOpen, visit]);

  // Initialize mini leaflet map when modal is open and visit has coordinates
  useEffect(() => {
    if (!isOpen || !visit || !mapContainerRef.current) return;

    const lat = Number(visit.latitude);
    const lng = Number(visit.longitude);

    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

    // Destroy existing map if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      // Custom visit pin
      const visitPinHtml = `
        <div class="flex flex-col items-center">
          <div class="px-2 py-0.5 rounded-full text-[9px] font-bold text-white bg-teal-700 shadow-sm whitespace-nowrap mb-0.5">
            📸 Punto de Visita
          </div>
          <div class="w-7 h-7 rounded-full bg-teal-600 border-2 border-white shadow-md flex items-center justify-center text-white text-xs font-bold">
            📍
          </div>
        </div>
      `;

      const visitIcon = L.divIcon({
        className: 'custom-visit-detail-pin',
        html: visitPinHtml,
        iconSize: [40, 48],
        iconAnchor: [20, 44]
      });

      L.marker([lat, lng], { icon: visitIcon })
        .addTo(map)
        .bindPopup(`<strong>${visit.clientName}</strong><br/>${visit.sellerName || 'Asesor'}`)
        .openPopup();

      // If client has registered location, show client pin too
      if (client?.latitude && client?.longitude && !isNaN(client.latitude) && !isNaN(client.longitude)) {
        const clientPinHtml = `
          <div class="flex flex-col items-center">
            <div class="px-2 py-0.5 rounded-full text-[9px] font-bold text-white bg-emerald-700 shadow-sm whitespace-nowrap mb-0.5">
              🏢 Local Registrado
            </div>
            <div class="w-6 h-6 rounded-full bg-emerald-600 border-2 border-white shadow-md flex items-center justify-center text-white text-[11px] font-bold">
              🏬
            </div>
          </div>
        `;
        const clientIcon = L.divIcon({
          className: 'custom-client-detail-pin',
          html: clientPinHtml,
          iconSize: [40, 48],
          iconAnchor: [20, 44]
        });

        L.marker([client.latitude, client.longitude], { icon: clientIcon }).addTo(map);

        // Draw line between visit and client
        L.polyline([[lat, lng], [client.latitude, client.longitude]], {
          color: '#0d9488',
          weight: 3,
          dashArray: '5, 8'
        }).addTo(map);

        const bounds = L.latLngBounds([[lat, lng], [client.latitude, client.longitude]]);
        map.fitBounds(bounds, { padding: [30, 30] });
      }

      mapInstanceRef.current = map;
    }, 200);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, visit, client]);

  if (!isOpen || !visit) return null;

  const lat = Number(visit.latitude);
  const lng = Number(visit.longitude);
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

  const renderVisitBadge = (type: string) => {
    switch (type) {
      case 'cobro':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">💰 Cobro</span>;
      case 'pedido':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-900 border border-teal-300">🛒 Pedido de Venta</span>;
      case 'prospeccion':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300">🤝 Prospección</span>;
      case 'entrega':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">📦 Entrega de Producto</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">📋 Visita de Rutina</span>;
    }
  };

  const formattedDate = new Date(visit.createdAt).toLocaleDateString('es-GT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formattedTime = new Date(visit.createdAt).toLocaleTimeString('es-GT', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto font-sans">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden z-10 my-auto flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white p-5 sm:p-6 flex items-start justify-between gap-4 shrink-0">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-teal-400/20 text-teal-200 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-teal-300/30">
                  Auditoría de Visita de Campo
                </span>
                {renderVisitBadge(visit.visitType)}
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <span>{visit.clientName}</span>
                {visit.clientCode && (
                  <span className="text-xs font-mono font-bold bg-white/20 text-white px-2 py-0.5 rounded-lg">
                    #{visit.clientCode}
                  </span>
                )}
              </h2>
              <p className="text-xs text-teal-200 font-medium">
                ID de Registro: <span className="font-mono text-teal-100">{visit.id}</span>
              </p>
            </div>

            <button 
              type="button"
              onClick={onClose}
              className="p-2 text-teal-200 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer shrink-0"
              title="Cerrar modal"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Left Column: Photo Evidence */}
              <div className="md:col-span-5 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-teal-600" />
                    Foto de Comprobante
                  </span>
                  {photoUrl && !isLoadingPhoto && (
                    <button 
                      type="button"
                      onClick={() => setIsPhotoExpanded(true)}
                      className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                    >
                      <Maximize2 size={12} /> Ampliar
                    </button>
                  )}
                </div>

                <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 shadow-inner flex items-center justify-center group">
                  {isLoadingPhoto ? (
                    <div className="p-6 text-center text-teal-400 space-y-2">
                      <Loader2 size={32} className="mx-auto animate-spin text-teal-500" />
                      <p className="text-xs font-bold text-slate-300">Cargando fotografía de prueba...</p>
                    </div>
                  ) : photoUrl ? (
                    <img 
                      src={photoUrl} 
                      alt="Foto de Comprobante" 
                      className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                      onClick={() => setIsPhotoExpanded(true)}
                    />
                  ) : (
                    <div className="p-6 text-center text-slate-400 space-y-2">
                      <ImageIcon size={36} className="mx-auto text-slate-600" />
                      <p className="text-xs font-bold text-slate-400">Sin foto de prueba adjunta</p>
                    </div>
                  )}

                  {photoUrl && !isLoadingPhoto && (
                    <div 
                      onClick={() => setIsPhotoExpanded(true)}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold cursor-pointer gap-1.5"
                    >
                      <Maximize2 size={16} /> Ver en Pantalla Completa
                    </div>
                  )}
                </div>

                {photoUrl && !isLoadingPhoto && (
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 font-semibold flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    <span>Fotografía WebP optimizada y certificada con GPS satelital.</span>
                  </div>
                )}
              </div>

              {/* Right Column: Metadata & GPS Map */}
              <div className="md:col-span-7 space-y-5">
                {/* Meta details grid */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    
                    {/* Fecha y Hora */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                        <Calendar size={12} className="text-teal-600" /> Fecha & Hora
                      </span>
                      <p className="font-bold text-slate-900 capitalize">{formattedDate}</p>
                      <p className="text-xs font-black text-teal-800 font-mono flex items-center gap-1">
                        <Clock size={12} /> {formattedTime}
                      </p>
                    </div>

                    {/* Asesor */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                        <User size={12} className="text-teal-600" /> Asesor de Campo
                      </span>
                      <p className="font-bold text-slate-900">{visit.sellerName || 'Asesor'}</p>
                      {visit.sellerEmail && (
                        <p className="text-[11px] text-slate-500 font-mono truncate">{visit.sellerEmail}</p>
                      )}
                    </div>

                    {/* Cliente / Negocio */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                        <Building2 size={12} className="text-teal-600" /> Empresa / Negocio
                      </span>
                      <p className="font-bold text-slate-900 truncate">{visit.companyName || client?.companyName || 'Particular'}</p>
                      {client?.phone && (
                        <p className="text-[11px] text-slate-600 flex items-center gap-1 font-medium">
                          <Phone size={10} /> {client.phone}
                        </p>
                      )}
                    </div>

                    {/* Razón */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                        <Tag size={12} className="text-teal-600" /> Razón de la Visita
                      </span>
                      <div>{renderVisitBadge(visit.visitType)}</div>
                    </div>
                  </div>

                  {/* Notas de Campo */}
                  {visit.notes && (
                    <div className="pt-3 border-t border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        📝 Observaciones & Notas de Campo
                      </span>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-800 font-medium leading-relaxed">
                        "{visit.notes}"
                      </div>
                    </div>
                  )}
                </div>

                {/* GPS Location & Leaflet Map */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <MapPin size={15} className="text-teal-600" />
                      Ubicación GPS Satelital
                    </span>
                    <div className="flex items-center gap-2">
                      <a 
                        href={googleMapsUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-800 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1"
                      >
                        <ExternalLink size={11} /> Google Maps
                      </a>
                      <a 
                        href={wazeUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1"
                      >
                        🚗 Waze
                      </a>
                    </div>
                  </div>

                  {/* Coordenadas & Distancia */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 text-slate-800 font-bold">
                      📍 {lat.toFixed(6)}, {lng.toFixed(6)}
                    </span>
                    {visit.distanceMeters !== undefined && (
                      <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        🎯 a {visit.distanceMeters}m del local registrado
                      </span>
                    )}
                    {visit.accuracy && (
                      <span className="text-[10px] text-slate-500 font-medium">
                        (Precisión ±{Math.round(visit.accuracy)}m)
                      </span>
                    )}
                  </div>

                  {/* Interactive Leaflet Map Container */}
                  <div 
                    ref={mapContainerRef} 
                    className="w-full h-44 rounded-xl overflow-hidden border border-slate-200 z-0 relative"
                  />
                </div>

              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-200 bg-white flex justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
            >
              Cerrar Detalle
            </button>
          </div>
        </motion.div>

        {/* Fullscreen Photo Modal View */}
        {isPhotoExpanded && visit.photoUrl && (
          <div 
            className="fixed inset-0 z-60 bg-black/95 flex flex-col items-center justify-center p-4 cursor-pointer"
            onClick={() => setIsPhotoExpanded(false)}
          >
            <button 
              type="button"
              onClick={() => setIsPhotoExpanded(false)}
              className="absolute top-4 right-4 p-3 text-white/80 hover:text-white bg-white/10 rounded-full hover:bg-white/20 transition-colors"
            >
              <X size={24} />
            </button>
            <img 
              src={visit.photoUrl} 
              alt="Foto de Comprobante Completa" 
              className="max-w-full max-h-[88vh] object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-white/80 text-xs font-bold mt-3">
              {visit.clientName} • {fechaDDMMYYYY(visit.createdAt)} {formattedTime}
            </p>
          </div>
        )}
      </div>
    </AnimatePresence>
  );
}
