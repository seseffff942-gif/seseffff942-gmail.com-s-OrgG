import React, { useState, useEffect, useMemo } from 'react';
import { Client, User } from '../types';
import { api } from '../api';
import { Search, MapPin, X, Check, Building2, Phone, Hash, AlertCircle, Navigation, ShieldCheck, Wifi, Trash2, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, normalizeSearchText } from '../utils';

interface MarkClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  currentLocation: { latitude: number; longitude: number; accuracy?: number } | null;
  currentUser: User;
  onClientMarked: (client: Client) => void;
  preselectedClient?: Client | null;
}

export function MarkClientModal({
  isOpen,
  onClose,
  clients,
  currentLocation,
  currentUser,
  onClientMarked,
  preselectedClient
}: MarkClientModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(preselectedClient || null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successSaved, setSuccessSaved] = useState(false);
  const [successActionType, setSuccessActionType] = useState<'save' | 'clear'>('save');

  useEffect(() => {
    if (isOpen) {
      if (preselectedClient) {
        setSelectedClient(preselectedClient);
        setSearchTerm(preselectedClient.name || '');
      } else {
        setSelectedClient(null);
        setSearchTerm('');
      }
      setErrorMsg('');
      setSuccessSaved(false);
    }
  }, [isOpen, preselectedClient]);

  // Filter clients with multi-attribute accent-insensitive fuzzy search
  const filteredClients = useMemo(() => {
    const term = normalizeSearchText(searchTerm);
    if (!term) return clients.slice(0, 25);

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
    }).slice(0, 35);
  }, [clients, searchTerm]);

  const handleConfirmMark = async () => {
    if (!selectedClient) {
      setErrorMsg('Por favor selecciona un cliente de la lista.');
      return;
    }
    if (!currentLocation) {
      setErrorMsg('No se ha podido obtener tu ubicación GPS actual. Verifica los permisos.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      await api.updateClientLocation(
        selectedClient.id,
        currentLocation.latitude,
        currentLocation.longitude,
        selectedClient.address || ''
      );

      const updatedClient: Client = {
        ...selectedClient,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        geotaggedAt: new Date().toISOString(),
        geotaggedBy: currentUser.name || currentUser.email || 'Vendedor'
      };

      setSuccessActionType('save');
      setSuccessSaved(true);
      setTimeout(() => {
        onClientMarked(updatedClient);
        setSuccessSaved(false);
        setSelectedClient(null);
        setSearchTerm('');
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar ubicación del cliente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearLocation = async () => {
    if (!selectedClient) return;
    const confirmMsg = `¿Deseas borrar la ubicación GPS guardada para "${selectedClient.name}"?\n\nEl cliente quedará sin coordenadas hasta que le asignes una nueva ubicación.`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      await api.clearClientLocation(selectedClient.id);

      const resetClient: Client = {
        ...selectedClient,
        latitude: undefined,
        longitude: undefined,
        locationAddress: undefined,
        geotaggedAt: undefined,
        geotaggedBy: undefined
      };

      setSuccessActionType('clear');
      setSuccessSaved(true);
      setTimeout(() => {
        onClientMarked(resetClient);
        setSuccessSaved(false);
        setSelectedClient(null);
        setSearchTerm('');
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al borrar la ubicación del cliente.');
    } finally {
      setIsSaving(false);
    }
  };

  const getGpsQuality = () => {
    if (!currentLocation?.accuracy) return { label: 'Detectando', color: 'text-slate-500', bg: 'bg-slate-100' };
    const acc = currentLocation.accuracy;
    if (acc <= 10) return { label: `Excelente (±${Math.round(acc)}m)`, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
    if (acc <= 30) return { label: `Buena (±${Math.round(acc)}m)`, color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200' };
    return { label: `Aproximada (±${Math.round(acc)}m)`, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
  };

  const gpsQuality = getGpsQuality();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[88vh]"
      >
        {/* Clean Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
              <MapPin size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 tracking-tight font-manrope">Marcar Cliente Aquí</h3>
              <p className="text-xs text-slate-500 font-medium">Asigna tus coordenadas GPS actuales al cliente</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* GPS Coordinates Ribbon */}
        <div className="bg-teal-50/70 border-b border-teal-100/80 px-5 py-2.5 flex items-center justify-between text-xs text-teal-900">
          <div className="flex items-center space-x-2">
            <Navigation size={13} className="text-teal-600 shrink-0" />
            <span className="font-semibold text-slate-700">GPS Actual:</span>
            {currentLocation ? (
              <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded-md border border-teal-200 text-teal-800 font-bold">
                {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              </span>
            ) : (
              <span className="text-amber-600 font-medium animate-pulse">Obteniendo coordenadas...</span>
            )}
          </div>

          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", gpsQuality.bg, gpsQuality.color)}>
            {gpsQuality.label}
          </span>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Buscar por Nombre, Código (ej: 1234), Empresa, Teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 shadow-2xs transition-all placeholder:text-slate-400 font-medium"
            />
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Client List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[320px] divide-y divide-slate-50">
          {filteredClients.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <Building2 className="mx-auto text-slate-300 mb-2" size={28} />
              <p className="text-xs font-semibold text-slate-600">No se encontraron clientes</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Prueba con otro término de búsqueda</p>
            </div>
          ) : (
            filteredClients.map((client) => {
              const isSelected = selectedClient?.id === client.id;
              const hasExistingGps = client.latitude && client.longitude;

              return (
                <div
                  key={client.id}
                  onClick={() => setSelectedClient(client)}
                  className={cn(
                    "p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group",
                    isSelected 
                      ? "bg-teal-50/90 border-teal-500 shadow-2xs ring-1 ring-teal-500/20" 
                      : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/70"
                  )}
                >
                  <div className="space-y-0.5 flex-1 pr-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-slate-900 group-hover:text-teal-900 transition-colors">
                        {client.name}
                      </span>
                      {client.clientCode && (
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                          #{client.clientCode}
                        </span>
                      )}
                      {hasExistingGps && (
                        <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <MapPin size={9} /> Con GPS
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                      {client.companyName && (
                        <span className="flex items-center gap-1 font-medium text-slate-600">
                          <Building2 size={11} className="text-slate-400" />
                          {client.companyName}
                        </span>
                      )}
                      {client.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={11} className="text-slate-400" />
                          {client.phone}
                        </span>
                      )}
                      {client.address && (
                        <span className="text-slate-400 truncate max-w-xs">{client.address}</span>
                      )}
                    </div>
                  </div>

                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center border transition-all shrink-0",
                    isSelected 
                      ? "bg-teal-600 border-teal-600 text-white" 
                      : "border-slate-200 group-hover:border-slate-300 text-transparent"
                  )}>
                    <Check size={12} strokeWidth={3} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Existing Location Warning Notice */}
        {selectedClient && selectedClient.latitude && selectedClient.longitude && (
          <div className="mx-4 mb-2 p-3 bg-amber-50/90 border border-amber-200/80 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-900">
            <div className="space-y-0.5">
              <span className="font-bold flex items-center gap-1 text-amber-950">
                <MapPin size={13} className="text-amber-600" />
                <span>Ubicación GPS ya registrada</span>
              </span>
              <p className="text-[11px] text-amber-800 font-mono">
                {selectedClient.latitude.toFixed(6)}, {selectedClient.longitude.toFixed(6)}
              </p>
            </div>

            <button
              type="button"
              onClick={handleClearLocation}
              disabled={isSaving}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-xl transition-colors flex items-center gap-1 text-xs shrink-0 cursor-pointer shadow-2xs active:scale-95"
              title="Borrar ubicación GPS guardada"
            >
              <Trash2 size={13} className="text-rose-600" />
              <span>Borrar GPS</span>
            </button>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="mx-4 mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-700">
            <AlertCircle size={15} className="text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            {selectedClient && selectedClient.latitude && selectedClient.longitude && (
              <button
                type="button"
                onClick={handleClearLocation}
                disabled={isSaving}
                className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
              >
                <Trash2 size={14} />
                <span>Borrar Ubicación</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleConfirmMark}
              disabled={!selectedClient || !currentLocation || isSaving}
              className={cn(
                "px-5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer",
                successSaved
                  ? "bg-emerald-600 text-white"
                  : selectedClient && currentLocation && !isSaving
                    ? "bg-teal-600 hover:bg-teal-700 text-white active:scale-95 shadow-teal-600/10"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
              )}
            >
              {successSaved ? (
                <>
                  <Check size={15} />
                  <span>{successActionType === 'clear' ? '¡Ubicación Borrada!' : '¡Ubicación Guardada!'}</span>
                </>
              ) : isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <MapPin size={15} />
                  <span>{selectedClient?.latitude ? 'Reasignar / Fijar Nueva Ubicación' : 'Fijar Ubicación Aquí'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
