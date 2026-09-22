import React, { useState, useEffect, useMemo } from 'react';
import { Client, User } from '../types';
import { api } from '../api';
import { 
  Search, 
  MapPin, 
  X, 
  Check, 
  Building2, 
  Phone, 
  Hash, 
  AlertCircle, 
  Navigation, 
  Trash2, 
  Plus, 
  UserPlus, 
  RefreshCw, 
  Store, 
  FileText, 
  CheckCircle2, 
  User as UserIcon,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, normalizeSearchText } from '../utils';

interface MarkClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  currentLocation: { latitude: number; longitude: number; accuracy?: number } | null;
  currentUser: User;
  onClientMarked: (client: Client) => void;
  preselectedClient?: Client | null;
  teamUsers?: User[];
}

export function MarkClientModal({
  isOpen,
  onClose,
  clients,
  currentLocation,
  currentUser,
  onClientMarked,
  preselectedClient,
  teamUsers = []
}: MarkClientModalProps) {
  // Mode: 'search' (select existing client) or 'create' (register brand new client with GPS)
  const [activeTab, setActiveTab] = useState<'search' | 'create'>('search');

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(preselectedClient || null);

  // New Client Form State
  const [newClientName, setNewClientName] = useState('');
  const [newClientCompanyName, setNewClientCompanyName] = useState('');
  const [newClientNit, setNewClientNit] = useState('C/F');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientCode, setNewClientCode] = useState('');
  const [newClientSellerId, setNewClientSellerId] = useState('');

  // SAT NIT search state
  const [isConsultingNit, setIsConsultingNit] = useState(false);
  const [nitLookupResult, setNitLookupResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Action status
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successSaved, setSuccessSaved] = useState(false);
  const [successActionType, setSuccessActionType] = useState<'save' | 'create' | 'clear'>('save');

  // Random 4-digit code generator
  const generateRandom4DigitCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const resetForm = () => {
    setSearchTerm('');
    setSelectedClient(null);
    setNewClientName('');
    setNewClientCompanyName('');
    setNewClientNit('C/F');
    setNewClientPhone('');
    setNewClientAddress('');
    setNewClientCode(generateRandom4DigitCode());
    setNewClientSellerId(currentUser.role === 'seller' ? (currentUser.id || currentUser.email || '') : (currentUser.id || ''));
    setIsConsultingNit(false);
    setNitLookupResult(null);
    setErrorMsg('');
    setSuccessSaved(false);
    setActiveTab('search');
  };

  useEffect(() => {
    if (isOpen) {
      if (preselectedClient) {
        setSelectedClient(preselectedClient);
        setSearchTerm(preselectedClient.name || '');
        setActiveTab('search');
      } else {
        resetForm();
      }
    }
  }, [isOpen, preselectedClient]);

  // Filter existing clients
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

  // Available sellers for admin selection
  const sellerOptions = useMemo(() => {
    const list = teamUsers.filter(u => u.role === 'seller' || u.role === 'admin');
    if (list.length === 0) {
      return [{ id: currentUser.id || currentUser.email || 'seller', name: currentUser.name || currentUser.email || 'Mi Usuario' }];
    }
    return list;
  }, [teamUsers, currentUser]);

  // Consult NIT SAT FEL lookup
  const handleConsultarSat = async () => {
    const cleanNit = newClientNit.trim();
    if (!cleanNit || cleanNit.toUpperCase() === 'C/F' || cleanNit.toUpperCase() === 'CF') {
      setNitLookupResult({ ok: false, message: 'Ingresa un NIT válido para consultar en SAT (ej: 12345678 o 1234567-K).' });
      return;
    }

    setIsConsultingNit(true);
    setNitLookupResult(null);
    setErrorMsg('');

    try {
      const res = await api.consultarNitFel(cleanNit);
      if (res && res.valido && res.nombre) {
        // If client name is empty or default, autofill it
        if (!newClientName.trim()) {
          setNewClientName(res.nombre);
        }
        if (res.nit) {
          setNewClientNit(res.nit);
        }
        setNitLookupResult({
          ok: true,
          message: `Encontrado en SAT: ${res.nombre}`
        });
      } else {
        setNitLookupResult({
          ok: false,
          message: res?.mensaje || 'No se encontró información en SAT para este NIT.'
        });
      }
    } catch (err: any) {
      setNitLookupResult({
        ok: false,
        message: err.message || 'No se pudo consultar el NIT en SAT.'
      });
    } finally {
      setIsConsultingNit(false);
    }
  };

  // Switch to create tab pre-filling search term as name
  const handleSwitchToCreate = (initialName = '') => {
    setNewClientName(initialName || searchTerm);
    setNewClientCode(generateRandom4DigitCode());
    setNewClientSellerId(currentUser.role === 'seller' ? (currentUser.id || currentUser.email || '') : (currentUser.id || ''));
    setErrorMsg('');
    setActiveTab('create');
  };

  // Handle assigning GPS to existing client
  const handleConfirmMarkExisting = async () => {
    if (!selectedClient) {
      setErrorMsg('Por favor selecciona un cliente de la lista.');
      return;
    }
    if (!currentLocation) {
      setErrorMsg('No se ha podido obtener tu ubicación GPS actual. Activa los permisos de ubicación en tu navegador.');
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
        locationAddress: selectedClient.address || '',
        geotaggedAt: new Date().toISOString(),
        geotaggedBy: currentUser.name || currentUser.email || 'Vendedor'
      };

      setSuccessActionType('save');
      setSuccessSaved(true);
      setTimeout(() => {
        onClientMarked(updatedClient);
        setSuccessSaved(false);
        resetForm();
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la ubicación del cliente.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle creating a brand new client with GPS
  const handleCreateNewClient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const name = newClientName.trim();
    if (!name) {
      setErrorMsg('El nombre completo del cliente es obligatorio.');
      return;
    }

    if (!currentLocation) {
      setErrorMsg('Esperando coordenadas GPS actuales... Asegúrate de tener el GPS activado.');
      return;
    }

    // Duplicate NIT check (if not CF)
    const normNit = (v: any) => String(v ?? '').replace(/[\s\-\/\.]/g, '').toUpperCase();
    const cleanNit = normNit(newClientNit);
    if (cleanNit && cleanNit !== 'CF' && cleanNit !== 'CONSUMIDORFINAL') {
      const dup = clients.find(c => normNit(c.nit) === cleanNit);
      if (dup) {
        setErrorMsg(`Ya existe un cliente con el NIT ${newClientNit}: "${dup.name}". No se puede duplicar.`);
        return;
      }
    }

    setIsSaving(true);
    setErrorMsg('');

    const effectiveSellerId = currentUser.role === 'seller'
      ? (currentUser.email || currentUser.id || '')
      : (newClientSellerId || currentUser.id || currentUser.email || '');

    const effectiveGeotaggedBy = currentUser.name || currentUser.email || 'Vendedor';

    try {
      const payload = {
        name,
        companyName: newClientCompanyName.trim(),
        nit: newClientNit.trim() || 'C/F',
        phone: newClientPhone.trim(),
        address: newClientAddress.trim(),
        clientCode: newClientCode.trim() || generateRandom4DigitCode(),
        sellerId: effectiveSellerId,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        locationAddress: newClientAddress.trim() || undefined,
        geotaggedAt: new Date().toISOString(),
        geotaggedBy: effectiveGeotaggedBy
      };

      const createdClient = await api.addClient(payload);

      // Assure GPS coordinates are attached in local returned object
      const fullClient: Client = {
        ...createdClient,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        locationAddress: newClientAddress.trim() || undefined,
        geotaggedAt: new Date().toISOString(),
        geotaggedBy: effectiveGeotaggedBy,
        sellerId: effectiveSellerId
      };

      setSuccessActionType('create');
      setSuccessSaved(true);

      setTimeout(() => {
        onClientMarked(fullClient);
        setSuccessSaved(false);
        resetForm();
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar el nuevo cliente con ubicación GPS.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle clearing GPS location of selected client
  const handleClearLocation = async () => {
    if (!selectedClient) return;
    const confirmMsg = `¿Deseas borrar la ubicación GPS guardada para "${selectedClient.name}"?\n\nEl cliente quedará sin coordenadas hasta que le asignes una nueva ubicación.`;
    if (!window.confirm(confirmMsg)) return;

    setIsSaving(true);
    setErrorMsg('');

    try {
      await api.clearClientLocation(selectedClient.id, selectedClient.name, selectedClient.clientCode);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
              <MapPin size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 tracking-tight font-manrope">
                {activeTab === 'search' ? 'Fijar GPS a Cliente' : 'Registrar Nuevo Cliente con GPS'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {activeTab === 'search' 
                  ? 'Asigna tu ubicación actual a un cliente existente' 
                  : 'Crea un cliente nuevo en toda la app con tu ubicación GPS actual'}
              </p>
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

        {/* GPS Ribbon */}
        <div className="bg-teal-50/80 border-b border-teal-100/90 px-4 sm:px-5 py-2 flex items-center justify-between text-xs text-teal-950">
          <div className="flex items-center space-x-2 truncate mr-2">
            <Navigation size={13} className="text-teal-600 shrink-0" />
            <span className="font-semibold text-slate-700 shrink-0">GPS Actual:</span>
            {currentLocation ? (
              <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded-md border border-teal-200 text-teal-900 font-bold truncate">
                {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              </span>
            ) : (
              <span className="text-amber-700 font-semibold animate-pulse text-[11px]">Detectando satélites...</span>
            )}
          </div>

          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0", gpsQuality.bg, gpsQuality.color)}>
            {gpsQuality.label}
          </span>
        </div>

        {/* Navigation Tabs Switcher */}
        <div className="p-2.5 bg-slate-100/80 border-b border-slate-200/80 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('search');
              setErrorMsg('');
            }}
            className={cn(
              "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs",
              activeTab === 'search'
                ? "bg-white text-teal-900 shadow-xs font-black border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <Search size={14} className={activeTab === 'search' ? "text-teal-600" : "text-slate-400"} />
            <span>Buscar Existente</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchToCreate()}
            className={cn(
              "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs",
              activeTab === 'create'
                ? "bg-teal-600 text-white shadow-xs font-black"
                : "bg-teal-50 text-teal-800 border border-teal-200/80 hover:bg-teal-100/70"
            )}
          >
            <UserPlus size={14} />
            <span>+ Agregar Nuevo Cliente</span>
          </button>
        </div>

        {/* TAB 1: BUSCAR CLIENTE EXISTENTE */}
        {activeTab === 'search' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search Input Bar */}
            <div className="p-3 sm:p-4 border-b border-slate-100 bg-white">
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

              {/* Quick suggestion to create new client */}
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 px-1">
                <span>¿No encuentras el cliente en tu lista?</span>
                <button
                  type="button"
                  onClick={() => handleSwitchToCreate(searchTerm)}
                  className="text-teal-700 font-bold hover:text-teal-800 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} strokeWidth={3} />
                  <span>Crear nuevo aquí</span>
                </button>
              </div>
            </div>

            {/* Client List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 max-h-[300px] divide-y divide-slate-50">
              {filteredClients.length === 0 ? (
                <div className="py-8 text-center px-4">
                  <Building2 className="mx-auto text-slate-300 mb-2" size={32} />
                  <p className="text-xs font-bold text-slate-700">No se encontraron clientes coincidentes</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 mb-4">
                    {searchTerm ? `No hay resultados para "${searchTerm}".` : 'No hay clientes registrados en esta sección.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSwitchToCreate(searchTerm)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <UserPlus size={14} />
                    <span>Registrar &quot;{searchTerm.trim() || 'Nuevo Cliente'}&quot; con este GPS</span>
                  </button>
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
          </div>
        )}

        {/* TAB 2: REGISTRAR NUEVO CLIENTE */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateNewClient} className="flex-1 overflow-y-auto p-4 space-y-3.5 max-h-[360px]">
            {/* Context Badge */}
            <div className="p-3 bg-teal-50/90 border border-teal-200/80 rounded-xl text-xs text-teal-950 flex items-start gap-2.5">
              <Sparkles size={16} className="text-teal-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-teal-900">Nuevo Cliente con Coordenadas GPS</p>
                <p className="text-[11px] text-teal-800 leading-relaxed">
                  Este cliente se guardará en toda la aplicación (disponible de inmediato en <strong>Ventas</strong>, <strong>Cotizaciones</strong> y <strong>Visitas</strong>) vinculado a tu ubicación GPS actual.
                </p>
              </div>
            </div>

            {/* Nombre del Cliente (Obligatorio) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Nombre Completo del Cliente / Titular <span className="text-rose-500">*</span>
              </label>
              <input 
                type="text"
                placeholder="Ej: Juan Pérez / Finca San José"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                autoFocus
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 shadow-2xs font-medium"
              />
            </div>

            {/* Nombre de la Empresa / Agroveterinaria */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Nombre Comercial / Agroveterinaria / Negocio <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <div className="relative">
                <Store size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Ej: Agroveterinaria El Granero"
                  value={newClientCompanyName}
                  onChange={(e) => setNewClientCompanyName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 shadow-2xs font-medium"
                />
              </div>
            </div>

            {/* NIT & SAT FEL Lookup */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                NIT / Identificación <span className="text-slate-400 font-normal">(Default C/F)</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="C/F o número de NIT"
                    value={newClientNit}
                    onChange={(e) => setNewClientNit(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 shadow-2xs font-medium"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleConsultarSat}
                  disabled={isConsultingNit || !newClientNit.trim() || newClientNit.toUpperCase() === 'C/F' || newClientNit.toUpperCase() === 'CF'}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs",
                    isConsultingNit || !newClientNit.trim() || newClientNit.toUpperCase() === 'C/F' || newClientNit.toUpperCase() === 'CF'
                      ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      : "bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 active:scale-95"
                  )}
                  title="Consultar nombre en SAT FEL"
                >
                  {isConsultingNit ? (
                    <RefreshCw size={13} className="animate-spin text-teal-600" />
                  ) : (
                    <Search size={13} />
                  )}
                  <span>SAT</span>
                </button>
              </div>

              {nitLookupResult && (
                <div className={cn(
                  "mt-1.5 p-2 rounded-lg text-[11px] font-medium flex items-center gap-1.5",
                  nitLookupResult.ok 
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-800" 
                    : "bg-amber-50 border border-amber-200 text-amber-800"
                )}>
                  {nitLookupResult.ok ? <CheckCircle2 size={13} className="text-emerald-600 shrink-0" /> : <AlertCircle size={13} className="text-amber-600 shrink-0" />}
                  <span>{nitLookupResult.message}</span>
                </div>
              )}
            </div>

            {/* Teléfono & Código de Cliente en 2 columnas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Teléfono Móvil
                </label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="tel"
                    placeholder="Ej: 5544-3322"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 shadow-2xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Código de Cliente (4 dígitos)
                </label>
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      maxLength={6}
                      placeholder="1234"
                      value={newClientCode}
                      onChange={(e) => setNewClientCode(e.target.value)}
                      className="w-full pl-9 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 shadow-2xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewClientCode(generateRandom4DigitCode())}
                    className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
                    title="Generar código aleatorio"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Dirección / Referencia de Ubicación */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Dirección Física o Referencia Comercial
              </label>
              <input 
                type="text"
                placeholder="Ej: Km 45 Carretera al Atlántico, frente a gasolinera"
                value={newClientAddress}
                onChange={(e) => setNewClientAddress(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 shadow-2xs font-medium"
              />
            </div>

            {/* Asignación de Vendedor */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Vendedor Asignado
              </label>
              {currentUser.role === 'seller' ? (
                <div className="p-2.5 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-slate-800">
                    <UserIcon size={14} className="text-teal-600" />
                    <span>{currentUser.name || currentUser.email}</span>
                  </span>
                  <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-md">
                    Tu Cartera (Aislado)
                  </span>
                </div>
              ) : (
                <select
                  value={newClientSellerId}
                  onChange={(e) => setNewClientSellerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 shadow-2xs font-medium"
                >
                  <option value={currentUser.id || currentUser.email || ''}>
                    {currentUser.name || currentUser.email} (Tú - Admin)
                  </option>
                  {sellerOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role === 'admin' ? 'Admin' : 'Vendedor'})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </form>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="mx-4 my-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-700">
            <AlertCircle size={15} className="text-rose-500 shrink-0" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
        )}

        {/* Action Buttons Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2.5">
          {activeTab === 'search' ? (
            <>
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
                  onClick={handleConfirmMarkExisting}
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
                      <Check size={15} strokeWidth={3} />
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
                      <span>{selectedClient?.latitude ? 'Reasignar / Fijar Nueva' : 'Fijar Ubicación Aquí'}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <button 
                type="button"
                onClick={() => {
                  setActiveTab('search');
                  setErrorMsg('');
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Volver a Buscar
              </button>

              <button
                type="button"
                onClick={() => handleCreateNewClient()}
                disabled={!newClientName.trim() || !currentLocation || isSaving}
                className={cn(
                  "px-5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer",
                  successSaved
                    ? "bg-emerald-600 text-white"
                    : newClientName.trim() && currentLocation && !isSaving
                      ? "bg-teal-600 hover:bg-teal-700 text-white active:scale-95 shadow-teal-600/10"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                )}
              >
                {successSaved ? (
                  <>
                    <Check size={15} strokeWidth={3} />
                    <span>¡Cliente Creado con GPS!</span>
                  </>
                ) : isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Guardando Cliente...</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={15} />
                    <span>Guardar y Fijar GPS</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
