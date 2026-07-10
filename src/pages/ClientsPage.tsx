import React, { useState, useEffect } from 'react';
import { User, Client, Invoice } from '../types';
import { api } from '../api';
import { 
  Search, Plus, User as UserIcon, FileText, ChevronRight, 
  CornerDownRight, Users, Edit2, X, Building2, Phone, 
  MapPin, ShoppingBag, ArrowUpDown, TrendingUp, DollarSign, 
  Mail, Calendar, Briefcase, CheckCircle, Clock, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ClientsPageProps {
  user: User;
  isMobile?: boolean;
}

export function ClientsPage({ user, isMobile }: ClientsPageProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'sales' | 'invoices'>('name');
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClient, setNewClient] = useState({ 
    name: '', 
    companyName: '', 
    nit: '', 
    phone: '', 
    address: '', 
    sellerId: user.role === 'admin' ? '' : (user.email || '') 
  });
  const [adding, setAdding] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [suggestEditClient, setSuggestEditClient] = useState<Client | null>(null);
  const [suggestEditText, setSuggestEditText] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [fetchedClients, fetchedInvoices, fetchedUsers] = await Promise.all([
        api.getClients(),
        api.getInvoices(user.role === 'admin' ? undefined : user.email).catch(() => []),
        api.getUsers()
      ]);
      // Deduplicate by name and company just in case
      const uniqueClients = fetchedClients.reduce((acc: Client[], client: Client) => {
        const alreadyExists = acc.find(c => 
          c.name.trim().toLowerCase() === client.name.trim().toLowerCase() && 
          (c.companyName || '').trim().toLowerCase() === (client.companyName || '').trim().toLowerCase()
        );
        if (!alreadyExists) {
          acc.push(client);
        }
        return acc;
      }, []);

      const filteredClients = user.role === 'admin' 
        ? uniqueClients 
        : uniqueClients.filter(c => c.sellerId === user.email || c.sellerId === user.id);

      setClients(filteredClients);
      setInvoices(Array.isArray(fetchedInvoices) ? fetchedInvoices : []);
      setUsers(fetchedUsers.filter(u => u.role === 'admin' || u.role === 'seller'));
    } catch (error) {
      console.error('Error loading clients data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.sellerId) {
      alert('Por favor, ingresa el nombre y selecciona un vendedor asignado.');
      return;
    }
    setAdding(true);
    try {
      const added = await api.addClient(newClient);
      setClients(prev => prev.some(c => c.id === added.id) ? prev : [added, ...prev]);
      setNewClient({ name: '', companyName: '', nit: '', phone: '', address: '', sellerId: '' });
      setShowAddForm(false);
    } catch (err) {
      alert("Error al agregar cliente");
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || !editingClient.name || !editingClient.sellerId) {
      alert('Por favor, ingresa el nombre y selecciona un vendedor.');
      return;
    }
    setAdding(true);
    try {
      const updated = await api.updateClient(editingClient.id, editingClient);
      setClients(clients.map(c => c.id === updated.id ? updated : c));
      setSelectedClient(updated);
      setEditingClient(null);
    } catch (err: any) {
      alert(`Error al actualizar cliente: ${err.message}`);
    } finally {
      setAdding(false);
    }
  };

  const getClientInvoices = (clientName: string) => {
    if (!clientName) return [];
    const clientObj = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
    const company = clientObj ? (clientObj.companyName || '').trim().toLowerCase() : '';
    const normName = clientName.trim().toLowerCase();

    return invoices.filter(inv => {
      if (!inv.client) return false;
      const invClient = inv.client.trim().toLowerCase();
      
      // 1. Exact name match
      if (invClient === normName) return true;
      
      // 2. Exact match with: "Name - Company"
      if (company && invClient === `${normName} - ${company}`) return true;

      // 3. Split parts match (e.g. "Name - Suffix")
      if (invClient.includes(" - ")) {
        const parts = invClient.split(" - ");
        const partName = parts[0].trim();
        const partCompany = parts[1] ? parts[1].trim() : '';

        if (partName === normName) {
          if (!company || partCompany === company) {
            return true;
          }
        }
      }

      // 4. Starts with check
      if (invClient.startsWith(normName)) {
        if (!company) {
          const suffix = invClient.slice(normName.length).trim();
          if (!suffix || suffix.startsWith("-")) {
            return true;
          }
        } else if (invClient.includes(company)) {
          return true;
        }
      }

      return false;
    });
  };

  const getClientStats = (clientName: string) => {
    const clientInvs = getClientInvoices(clientName);
    const validInvs = clientInvs.filter(i => i.status !== 'cancelled' && i.status !== 'rejected');
    const totalSales = validInvs.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const pendingAmount = validInvs.filter(i => i.status === 'pending' || i.status === 'sent').reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const paidAmount = validInvs.filter(i => i.status === 'paid').reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    return {
      totalSales,
      pendingAmount,
      paidAmount,
      invoiceCount: validInvs.length,
      avgTicket: validInvs.length > 0 ? totalSales / validInvs.length : 0
    };
  };

  // Grouped stats for entire portfolio (of processed / filtered data)
  const totalPortfolioClients = clients.length;
  const totalRevenueAll = invoices.filter(i => i.status !== 'cancelled' && i.status !== 'rejected').reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  const totalReceivablesAll = invoices.filter(i => i.status === 'pending' || i.status === 'sent').reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  const totalPaidAll = invoices.filter(i => i.status === 'paid').reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

  const getClientSellerName = (sellerId?: string) => {
    if (!sellerId) return 'No asignado';
    const s = users.find(u => u.email === sellerId || u.id === sellerId);
    return s ? s.name : sellerId;
  };

  const getClientInitials = (name: string) => {
    if (!name) return 'CL';
    const split = name.split(' ');
    if (split.length >= 2) return (split[0][0] + split[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // Sort and filter clients
  const searchedClients = clients.filter(c => 
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.companyName && c.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.nit && c.nit.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sortedClients = [...searchedClients].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'sales') {
      const salesA = getClientStats(a.name).totalSales;
      const salesB = getClientStats(b.name).totalSales;
      return salesB - salesA;
    }
    if (sortBy === 'invoices') {
      const invsA = getClientStats(a.name).invoiceCount;
      const invsB = getClientStats(b.name).invoiceCount;
      return invsB - invsA;
    }
    return 0;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px] bg-slate-50">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-500">Cargando directorio de clientes...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col h-full bg-slate-50/70 min-h-screen">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-teal-100 text-teal-800 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              Módulo de Cartera
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Directorio Premium de Clientes</h1>
          <p className="text-sm text-slate-500 font-medium">Información comercial, asignación de asesores y gestión de facturación en tiempo real.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-md shadow-teal-600/10"
        >
          <Plus size={18} />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* PORTFOLIO ACCUMULATED METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Total Clientes</span>
            <div className="p-2 bg-slate-50 text-slate-500 rounded-xl">
              <Users size={16} />
            </div>
          </div>
          <h4 className="text-2xl font-black text-slate-950">{totalPortfolioClients}</h4>
          <p className="text-xs text-slate-400 mt-1 font-medium">Asociados activos</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Ventas Facturadas</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp size={16} />
            </div>
          </div>
          <h4 className="text-2xl font-black text-emerald-700">Q{totalRevenueAll.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
          <p className="text-xs text-emerald-600/80 mt-1 font-semibold flex items-center gap-1">
            <span>Remuneración total</span>
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Cartera Pendiente</span>
            <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
              <DollarSign size={16} />
            </div>
          </div>
          <h4 className="text-2xl font-black text-orange-700">Q{totalReceivablesAll.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
          <p className="text-xs text-orange-600 font-semibold mt-1">Cuentas por cobrar</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Recaudado</span>
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
              <CheckCircle size={16} />
            </div>
          </div>
          <h4 className="text-2xl font-black text-teal-700">Q{totalPaidAll.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
          <p className="text-xs text-teal-600 mt-1 font-semibold">Liquidaciones exitosas</p>
        </motion.div>
      </div>

      {/* FILTER & OPTION CONTROLS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Search Input */}
        <div className="relative w-full md:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-sm rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 block pl-10 pr-4 py-2.5 outline-none font-medium transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, agro-veterinaria o NIT..."
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <ArrowUpDown size={14} />
            Ordenar por:
          </span>
          <div className="flex rounded-xl bg-slate-50 p-1 border border-slate-200">
            <button
              onClick={() => setSortBy('name')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${sortBy === 'name' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Nombre
            </button>
            <button
              onClick={() => setSortBy('sales')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${sortBy === 'sales' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Ventas Totales
            </button>
            <button
              onClick={() => setSortBy('invoices')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${sortBy === 'invoices' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Facturas
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        
        {/* LEFT COMPONENT: DIRECTORY GRID OF PREMIUM PROFILE CARDS */}
        <div className={`flex flex-col gap-4 ${selectedClient && isMobile ? 'hidden' : 'w-full lg:w-7/12 xl:w-8/12'} overflow-y-auto`}>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
            Clientes Encontrados ({sortedClients.length})
          </div>
          
          <AnimatePresence mode="popLayout">
            {sortedClients.map((client, idx) => {
              const stats = getClientStats(client.name);
              const paidPct = stats.totalSales > 0 ? (stats.paidAmount / stats.totalSales) * 100 : 0;
              const isSelected = selectedClient?.id === client.id;

              return (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.4) }}
                  onClick={() => setSelectedClient(client)}
                  className={`cursor-pointer rounded-2xl bg-white border transition-all p-5 shadow-sm hover:shadow-md hover:border-slate-300 w-full flex flex-col justify-between ${
                    isSelected ? 'ring-2 ring-teal-500/20 border-teal-500 bg-teal-50/10' : 'border-slate-100'
                  }`}
                >
                  {/* Top Row: Name and Quick Controls */}
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                        {getClientInitials(client.name)}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                          {client.name}
                        </h3>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5 flex items-center gap-1">
                          <Building2 size={12} className="text-slate-400" />
                          {client.companyName || 'Sin Registrar Negocio'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          if (user.role === 'admin') {
                            setEditingClient(client);
                          } else {
                            setSuggestEditClient(client);
                          }
                        }}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-teal-600 transition-colors cursor-pointer"
                        title={user.role === 'admin' ? "Editar información" : "Sugerir cambios"}
                      >
                        <Edit2 size={15} />
                      </button>
                      <ChevronRight size={18} className={`text-slate-300 transition-transform ${isSelected ? 'translate-x-1.5 text-teal-500' : ''}`} />
                    </div>
                  </div>

                  {/* Body Content Segmented: Veterinary, Assigned Seller, and Resumen */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 text-sm">
                    
                    {/* Column 1: Agroveterinaria Details & Location */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Datos del Establecimiento</h4>
                      <div className="space-y-1.5 text-xs text-slate-600 font-semibold">
                        <div className="flex items-start gap-1.5">
                          <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                          <span>{client.address || 'Sin dirección registrada'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone size={13} className="text-slate-400 shrink-0" />
                          <span>{client.phone || 'Sin teléfono'}</span>
                        </div>
                        <div className="pt-0.5 text-[11px] text-slate-500">
                          <span className="font-bold text-slate-400 uppercase mr-1">NIT/ID:</span> 
                          {client.nit || 'C/F'}
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Assigned Seller */}
                    <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100/80">
                      <h4 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
                        <Briefcase size={11} className="text-slate-400" />
                        Asesor Comercial Asignado
                      </h4>
                      <div className="space-y-1">
                        <p className="text-xs font-black text-slate-800">
                          {getClientSellerName(client.sellerId)}
                        </p>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                          <Mail size={11} className="shrink-0" />
                          <span className="truncate">{client.sellerId || 'Sin registrar vendedor'}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Summary Footer: Pulcro visual grid with cumulative metrics */}
                  <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100/50 mt-4">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="text-left">
                        <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Total Facturas</p>
                        <p className="text-xs font-black text-slate-700 flex items-center gap-1 mt-0.5">
                          <ShoppingBag size={12} className="text-slate-400" />
                          {stats.invoiceCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Deuda Pendiente</p>
                        <p className="text-xs font-black text-orange-600 mt-0.5">
                          Q{stats.pendingAmount.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Total Ventas</p>
                        <p className="text-sm font-black text-emerald-700 mt-0.5">
                          Q{stats.totalSales.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar for Paid Invoices */}
                    {stats.totalSales > 0 && (
                      <div className="mt-3.5">
                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold mb-1">
                          <span>Progreso de Cobros Liquidados</span>
                          <span className="text-emerald-600 font-bold">{paidPct.toFixed(0)}% pagado</span>
                        </div>
                        <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-300" 
                            style={{ width: `${paidPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                </motion.div>
              );
            })}

            {sortedClients.length === 0 && (
              <div className="bg-white rounded-3xl p-8 border border-slate-100 text-center text-slate-400 shadow-sm">
                <Users size={40} className="mx-auto mb-3 text-slate-300" />
                <p className="font-bold text-sm text-slate-600">No se encontraron clientes</p>
                <p className="text-xs text-slate-400 mt-1">Prueba refinando la búsqueda o registra un nuevo cliente.</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT COMPONENT: IMMERSIVE DETAILED LEDGER PANEL */}
        <div className={`flex flex-col flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[500px] ${
          !selectedClient && isMobile ? 'hidden' : 'flex'
        }`}>
          {selectedClient ? (
            <div className="flex flex-col h-full">
              
              {/* Header profile of selected */}
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                {isMobile && (
                  <button 
                    onClick={() => setSelectedClient(null)} 
                    className="mb-4 text-teal-600 font-bold text-xs flex items-center gap-1 uppercase tracking-wider bg-white px-3 py-1.5 rounded-xl border border-slate-200"
                  >
                    <ChevronRight size={14} className="rotate-180" />
                    Volver a la lista
                  </button>
                )}
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-base">
                      {getClientInitials(selectedClient.name)}
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 tracking-tight">{selectedClient.name}</h2>
                      <p className="text-xs font-semibold text-teal-600">
                        {selectedClient.companyName || 'Establecimiento sin nombre comercial'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      if (user.role === 'admin') {
                        setEditingClient(selectedClient);
                      } else {
                        setSuggestEditClient(selectedClient);
                      }
                    }}
                    className="p-2 hover:bg-slate-100 text-slate-600 hover:text-teal-600 rounded-xl transition-all border border-slate-200 bg-white flex items-center gap-1 text-xs font-bold cursor-pointer"
                  >
                    <Edit2 size={13} />
                    <span>{user.role === 'admin' ? "Editar" : "Sugerir Edición"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5 pt-4 border-t border-slate-100 text-xs font-medium text-slate-600">
                  <div>
                    <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider block mb-1">NIT / ID</span>
                    <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-100 font-mono text-slate-800">
                      {selectedClient.nit || 'No registrado'}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider block mb-1">Teléfono comercial</span>
                    <span className="text-slate-800">{selectedClient.phone || 'No registrado'}</span>
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <span className="font-bold text-slate-400 text-[10px] uppercase tracking-wider block mb-1">Dirección de Entrega</span>
                    <span className="text-slate-800 line-clamp-1" title={selectedClient.address}>
                      {selectedClient.address || 'No registrado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Title Section */}
              <div className="px-6 py-4 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <FileText size={16} className="text-teal-500" />
                  Historial de Facturación ({getClientInvoices(selectedClient.name).length})
                </h3>
                <span className="text-[11px] font-bold text-slate-400 uppercase bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
                  Límites de crédito activo
                </span>
              </div>

              {/* Invoices List scrollable */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-4">
                {getClientInvoices(selectedClient.name).length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <FileText size={24} className="text-slate-300" />
                    </div>
                    <p className="font-bold text-slate-500 text-sm">Sin Facturas Registradas</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Las ventas que se emitan a nombre de este cliente aparecerán automáticamente en esta lista de control.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {getClientInvoices(selectedClient.name).map(inv => {
                      const isActivePending = inv.status === 'pending' && inv.date;
                      const activeDays = isActivePending 
                        ? Math.floor((Date.now() - new Date(inv.date).getTime()) / (1000 * 60 * 60 * 24))
                        : 0;

                      return (
                        <div 
                          key={inv.id} 
                          className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {inv.invoiceType && (
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                  inv.invoiceType === 'agricola' 
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                    : 'bg-teal-100 text-teal-800 border border-teal-200'
                                }`}>
                                  {inv.invoiceType}
                                </span>
                              )}
                              <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                #{inv.id.slice(0, 8)}
                              </span>
                              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                                <Calendar size={12} />
                                {new Date(inv.date).toLocaleDateString('es-GT', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                            <h5 className="font-bold text-slate-800 text-sm">
                              {inv.items.length} {inv.items.length === 1 ? 'producto' : 'productos'} en folio
                            </h5>
                            <p className="text-base font-black text-slate-900">
                              Q{inv.totalAmount.toFixed(2)}
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0 w-full md:w-auto">
                            {inv.status === 'pending' ? (
                              <span className="bg-amber-150 text-amber-800 bg-amber-55/20 px-3 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wider flex items-center gap-1 border border-amber-200/50">
                                <Clock size={11} className="text-amber-600" />
                                Por cobrar
                              </span>
                            ) : inv.status === 'paid' ? (
                              <span className="bg-green-100 text-green-800 px-3 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wider flex items-center gap-1 border border-green-200/50">
                                <CheckCircle size={11} />
                                Cancelado
                              </span>
                            ) : inv.status === 'rejected' ? (
                              <span className="bg-red-100 text-red-800 px-3 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wider flex items-center gap-1 border border-red-200/50">
                                <AlertTriangle size={11} />
                                Rechazado
                              </span>
                            ) : inv.status === 'cancelled' ? (
                              <span className="bg-red-50 text-red-600 px-3 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wider flex items-center gap-1 border border-red-200">
                                <AlertTriangle size={11} />
                                Anulada
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-700 px-3 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wider">
                                {inv.status}
                              </span>
                            )}
                            
                            {isActivePending && (
                              <span className={`text-[11px] font-bold flex items-center gap-1 mt-0.5 ${
                                activeDays > 30 ? 'text-red-600' : 'text-slate-500'
                              }`}>
                                <CornerDownRight size={12}/>
                                {activeDays} {activeDays === 1 ? 'día' : 'días'} activo
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/50">
              <div className="w-16 h-16 bg-white border border-slate-100 rounded-3xl flex items-center justify-center mb-4 shadow-sm">
                <Users size={28} className="text-slate-300" />
              </div>
              <h4 className="font-bold text-slate-700 text-sm">Ningún Cliente Seleccionado</h4>
              <p className="text-xs text-slate-400 max-w-xs mt-1.5 leading-relaxed">
                Elige un perfil para consultar el desglose exacto de sus facturas vigentes, antigüedad de saldos y detalles de contacto.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* MODAL / SLIDE-IN DIALOG: NUEVO CLIENTE */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddForm(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            {/* Modal Body */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25 }}
              className="bg-white rounded-3xl w-full max-w-xl shadow-2xl relative z-10 border border-slate-100 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-teal-600">Formulario Comercial</span>
                  <h3 className="text-lg font-black text-slate-900 mt-0.5">Registrar Nuevo Cliente</h3>
                </div>
                <button 
                  onClick={() => setShowAddForm(false)} 
                  className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddClient} className="p-6 space-y-4">
                
                {/* Vendedor Asignado */}
                {user.role === 'admin' ? (
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                      Vendedor Asignado *
                    </label>
                    <select 
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm font-bold text-slate-800"
                      value={newClient.sellerId} 
                      onChange={e => setNewClient({...newClient, sellerId: e.target.value})}
                    >
                      <option value="" disabled>Seleccionar Vendedor Asignado *</option>
                      {users.map(u => (
                        <option key={u.id} value={u.email}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {/* Nombre de Cliente */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                    Nombre del Cliente *
                  </label>
                  <input 
                    type="text" 
                    placeholder="Ej. Roberto Gómez Cabrera" 
                    required
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm font-medium text-slate-800"
                    value={newClient.name} 
                    onChange={e => setNewClient({...newClient, name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nombre de Negocio */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                      Nombre del Negocio (Agroveterinaria)
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ej. Comercial El Roble"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm font-medium text-slate-800"
                      value={newClient.companyName} 
                      onChange={e => setNewClient({...newClient, companyName: e.target.value})}
                    />
                  </div>

                  {/* NIT/ID */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                      NIT / Identificación
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ej. 1029384-5"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm font-medium text-slate-800"
                      value={newClient.nit} 
                      onChange={e => setNewClient({...newClient, nit: e.target.value})}
                    />
                  </div>

                  {/* Telefono */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                      Teléfono Móvil
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ej. +502 5543-2211"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm font-medium text-slate-800"
                      value={newClient.phone} 
                      onChange={e => setNewClient({...newClient, phone: e.target.value})}
                    />
                  </div>

                  {/* Dirección */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                      Dirección de Entrega
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ej. Barrio El Mirador, Jalapa"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm font-medium text-slate-800"
                      value={newClient.address} 
                      onChange={e => setNewClient({...newClient, address: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-100 mt-6">
                  <button 
                    type="button" 
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all uppercase tracking-wider"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={adding}
                    className="flex-1 py-3 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl hover:shadow-lg hover:shadow-teal-600/10 transition-all uppercase tracking-wider"
                  >
                    {adding ? "Guardando..." : "Guardar Cliente"}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL / SLIDE-IN DIALOG: EDITAR CLIENTE */}
      <AnimatePresence>
        {editingClient && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingClient(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            {/* Modal Body */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25 }}
              className="bg-white rounded-3xl w-full max-w-xl shadow-2xl relative z-10 border border-slate-100 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-teal-600">Actualizar Información</span>
                  <h3 className="text-lg font-black text-slate-900 mt-0.5">Editar Cliente</h3>
                </div>
                <button 
                  onClick={() => setEditingClient(null)} 
                  className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleUpdateClient} className="p-6 space-y-4">
                
                {/* Vendedor Asignado */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                    Vendedor Asignado *
                  </label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm font-bold text-slate-800"
                    value={editingClient.sellerId || ''} 
                    onChange={e => setEditingClient({...editingClient, sellerId: e.target.value})}
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.email}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>

                {/* Nombre de Cliente */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                    Nombre del Cliente *
                  </label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm font-medium text-slate-800"
                    value={editingClient.name} 
                    onChange={e => setEditingClient({...editingClient, name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nombre de Negocio */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                      Nombre del Negocio (Agroveterinaria)
                    </label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm font-medium text-slate-800"
                      value={editingClient.companyName || ''} 
                      onChange={e => setEditingClient({...editingClient, companyName: e.target.value})}
                    />
                  </div>

                  {/* NIT/ID */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                      NIT / Identificación
                    </label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm font-medium text-slate-800"
                      value={editingClient.nit || ''} 
                      onChange={e => setEditingClient({...editingClient, nit: e.target.value})}
                    />
                  </div>

                  {/* Telefono */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                      Teléfono Móvil
                    </label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm font-medium text-slate-800"
                      value={editingClient.phone || ''} 
                      onChange={e => setEditingClient({...editingClient, phone: e.target.value})}
                    />
                  </div>

                  {/* Dirección */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                      Dirección de Entrega
                    </label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-sm font-medium text-slate-800"
                      value={editingClient.address || ''} 
                      onChange={e => setEditingClient({...editingClient, address: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4 border-t border-slate-100 mt-6">
                  <button 
                    type="button" 
                    onClick={() => setEditingClient(null)}
                    className="flex-1 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all uppercase tracking-wider"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={adding}
                    className="flex-1 py-3 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-xl hover:shadow-lg hover:shadow-teal-600/10 transition-all uppercase tracking-wider"
                  >
                    {adding ? "Guardando..." : "Actualizar Cliente"}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: SUGERIR EDICIÓN DE CLIENTE */}
      {suggestEditClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[120] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-800 text-lg">Sugerir Cambios en Cliente</h3>
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Cliente: {suggestEditClient.name}
                </p>
              </div>
              <button onClick={() => { setSuggestEditClient(null); setSuggestEditText(''); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">
                  Especifica los cambios
                </label>
                <textarea
                  value={suggestEditText}
                  onChange={(e) => setSuggestEditText(e.target.value)}
                  className="w-full h-32 p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none animate-none"
                  placeholder="Ej: Modificar número de teléfono, cambiar dirección a Calle Principal, corregir NIT..."
                ></textarea>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Esto abrirá WhatsApp para que envíes tu solicitud de edición al grupo o a los administradores. Esta acción no modificará los datos del cliente hasta que sea aprobada y realizada por un administrador.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => { setSuggestEditClient(null); setSuggestEditText(''); }}
                className="flex-1 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                disabled={!suggestEditText.trim()}
                onClick={() => {
                  const message = `Hola administradores, quisiera editar este cliente (Nombre: *${suggestEditClient.name}* / NIT: *${suggestEditClient.nit || 'S/N'}*).\nPor favor, confirmar si es posible. Aquí está la lista de lo que hay que editar:\n\n${suggestEditText}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                  setSuggestEditClient(null);
                  setSuggestEditText('');
                }}
                className="flex-1 py-3 text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer"
              >
                Enviar Solicitud
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
