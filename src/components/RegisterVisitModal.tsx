import React, { useState, useMemo } from 'react';
import { Client, User, VisitType, ClientVisit } from '../types';
import { api } from '../api';
import { 
  Search, MapPin, X, Check, Building2, Phone, 
  ShoppingCart, DollarSign, UserPlus, Package, 
  ClipboardCheck, Camera, AlertCircle, Sparkles, Navigation,
  Tag, Image as ImageIcon, Trash2, Box
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn, normalizeSearchText } from '../utils';

interface RegisterVisitModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  currentLocation: { latitude: number; longitude: number; accuracy?: number } | null;
  currentUser: User;
  onVisitRegistered: (visit: ClientVisit) => void;
  preselectedClient?: Client | null;
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
  preselectedClient
}: RegisterVisitModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(preselectedClient || null);
  const [visitType, setVisitType] = useState<VisitType>('rutina');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successSaved, setSuccessSaved] = useState(false);

  React.useEffect(() => {
    if (preselectedClient) {
      setSelectedClient(preselectedClient);
    }
  }, [preselectedClient, isOpen]);

  const nearbyClients = useMemo(() => {
    if (!currentLocation) return [];
    return clients
      .filter(c => c.latitude && c.longitude && !isNaN(c.latitude) && !isNaN(c.longitude))
      .map(c => {
        const dist = calculateDistanceMeters(
          currentLocation.latitude,
          currentLocation.longitude,
          c.latitude!,
          c.longitude!
        );
        return { ...c, distanceMeters: dist };
      })
      .filter(c => c.distanceMeters <= 1500)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [clients, currentLocation]);

  const filteredClients = useMemo(() => {
    const term = normalizeSearchText(searchTerm);
    if (!term) return clients.slice(0, 20);

    return clients.filter(c => {
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
  }, [clients, searchTerm]);

  const distanceToSelected = useMemo(() => {
    if (!currentLocation || !selectedClient?.latitude || !selectedClient?.longitude) return null;
    return calculateDistanceMeters(
      currentLocation.latitude,
      currentLocation.longitude,
      selectedClient.latitude,
      selectedClient.longitude
    );
  }, [currentLocation, selectedClient]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('La imagen es demasiado pesada. El tamaño máximo es 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoUrl(reader.result as string);
        setErrorMsg('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddChipToNotes = (chipText: string) => {
    setNotes(prev => {
      if (!prev.trim()) return chipText;
      if (prev.includes(chipText)) return prev;
      return `${prev}. ${chipText}`;
    });
  };

  const handleSaveVisit = async () => {
    if (!selectedClient) {
      setErrorMsg('Selecciona el cliente que estás visitando.');
      return;
    }
    if (!currentLocation) {
      setErrorMsg('No se ha podido obtener tu ubicación GPS. Asegúrate de tener permisos activos.');
      return;
    }
    // FOTO OBLIGATORIA
    if (!photoUrl) {
      setErrorMsg('⚠️ La foto de comprobante o fachada es OBLIGATORIA para validar y registrar la visita.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await api.createVisit({
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        clientCode: selectedClient.clientCode,
        companyName: selectedClient.companyName,
        sellerId: currentUser.id,
        sellerName: currentUser.name || currentUser.email || 'Vendedor',
        sellerEmail: currentUser.email || '',
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        accuracy: currentLocation.accuracy,
        visitType,
        notes: notes.trim(),
        photoUrl
      });

      setSuccessSaved(true);
      setTimeout(() => {
        if (res.visit) {
          onVisitRegistered(res.visit);
        }
        setSuccessSaved(false);
        setSelectedClient(null);
        setNotes('');
        setPhotoUrl('');
        setSearchTerm('');
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar la visita');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
              <ClipboardCheck size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 tracking-tight font-manrope">Registrar Visita en Terreno</h3>
              <p className="text-xs text-slate-500 font-medium">Guarda tu reporte de visita comercial con GPS en tiempo real</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* GPS Live Header Badge */}
        <div className="bg-slate-900 text-slate-200 px-5 py-2.5 flex items-center justify-between text-xs border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-400/20" />
            <span className="font-medium text-slate-300">GPS Vendedor:</span>
            {currentLocation ? (
              <span className="font-mono text-[11px] text-emerald-400 font-bold">
                {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
              </span>
            ) : (
              <span className="text-amber-400 font-medium animate-pulse">Buscando satélites...</span>
            )}
          </div>
          {distanceToSelected !== null && (
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
              distanceToSelected <= 150 
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" 
                : distanceToSelected <= 1500
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-slate-700 text-slate-300 border-slate-600"
            )}>
              {distanceToSelected <= 150 ? '🎯 En sitio' : '📍 A'} {distanceToSelected > 1000 ? `${(distanceToSelected / 1000).toFixed(1)} km` : `${distanceToSelected} m`}
            </span>
          )}
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 1. Client Selection */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              1. Cliente que estás visitando *
            </label>

            {selectedClient ? (
              <div className="p-3.5 bg-teal-50/80 border border-teal-300 rounded-xl flex items-center justify-between shadow-2xs">
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
                  onClick={() => setSelectedClient(null)}
                  className="text-xs font-bold text-teal-800 hover:text-teal-950 underline px-2 py-1 cursor-pointer"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {nearbyClients.length > 0 && !searchTerm && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1.5">
                    <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                      <Sparkles size={13} className="text-amber-600" />
                      Clientes detectados cerca de ti (&lt;1.5km):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {nearbyClients.slice(0, 4).map(c => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedClient(c)}
                          className="px-2.5 py-1 bg-white border border-amber-200 rounded-lg text-xs font-bold text-amber-950 hover:bg-amber-100 flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
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
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium placeholder:text-slate-400"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-2xs">
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

          {/* 3. FOTO DE PRUEBA (OBLIGATORIA) */}
          <div className="space-y-1.5 p-3.5 bg-rose-50/50 border border-rose-200/70 rounded-2xl">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                <Camera size={14} className="text-rose-600" />
                <span>3. Foto de Comprobante / Fachada</span>
                <span className="bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase">
                  Obligatoria
                </span>
              </label>
              {photoUrl ? (
                <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                  <Check size={12} strokeWidth={3} /> Foto Cargada
                </span>
              ) : (
                <span className="text-[10px] font-bold text-rose-600 animate-pulse">
                  * Requerida para guardar
                </span>
              )}
            </div>

            <p className="text-[10px] text-slate-500">
              Toma una foto de la fachada del negocio, mostrador o cliente para validar la visita.
            </p>

            <div className="flex items-center gap-3 pt-1">
              <label className={cn(
                "flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 border",
                photoUrl
                  ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  : "bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-sm shadow-rose-600/20"
              )}>
                <Camera size={16} />
                <span>{photoUrl ? "Cambiar Foto" : "📸 Tomar Foto Ahora"}</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  onChange={handlePhotoUpload} 
                  className="hidden" 
                />
              </label>

              {photoUrl && (
                <div className="relative group w-14 h-14 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-2xs">
                  <img src={photoUrl} alt="Comprobante" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    className="absolute inset-0 bg-rose-600/85 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Eliminar foto"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
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
          <div className="mx-5 mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-700">
            <AlertCircle size={15} className="text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSaveVisit}
            disabled={!selectedClient || !currentLocation || !photoUrl || isSubmitting}
            className={cn(
              "px-5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer",
              successSaved
                ? "bg-emerald-600 text-white"
                : selectedClient && currentLocation && photoUrl && !isSubmitting
                  ? "bg-teal-600 hover:bg-teal-700 text-white active:scale-95 shadow-teal-600/10"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
            )}
          >
            {successSaved ? (
              <>
                <Check size={15} />
                <span>¡Visita Guardada con Éxito!</span>
              </>
            ) : isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Registrando...</span>
              </>
            ) : (
              <>
                <ClipboardCheck size={15} />
                <span>Guardar Visita con Foto</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
