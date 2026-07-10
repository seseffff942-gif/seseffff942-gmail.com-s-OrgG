import React, { useState, useEffect, useRef } from 'react';
import { User, Product, AppNotification } from '../types';
import { cn } from '../utils';
import { Leaf, LogOut, Package, ShoppingCart, FileText, Users, BadgeCheck, Menu, X, ClipboardList, Bell, BellOff, AlertTriangle, XCircle, Box, CheckCircle, CreditCard, Volume2, VolumeX, Search, Trash2, Sparkles, ExternalLink, RefreshCw, Clock, Tag, Download, Shield } from 'lucide-react';
import { api } from '../api';
import { motion, AnimatePresence } from 'motion/react';

interface NavigationProps {
  user: User;
  activeUser: User;
  currentTab: string;
  onChangeTab: (tab: string) => void;
  onLogout: () => void;
  onReturnToAdmin: () => void;
  onImpersonate?: (user: User | null) => void;
  isMobile?: boolean;
  onShowInstallGuide?: () => void;
  showInstallButton?: boolean;
}

function NotificationsPopover({ 
  isOpen, 
  onClose, 
  onClearAll, 
  onChangeTab,
  user,
  soundsEnabled,
  setSoundsEnabled
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onClearAll: () => void;
  onChangeTab: (tab: string) => void;
  user: User;
  soundsEnabled: boolean;
  setSoundsEnabled: (v: boolean) => void;
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'inventory' | 'sales'>('all');
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const fetchNotifications = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await api.getNotifications();
      setNotifications(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAll = async () => {
    try {
      await api.clearAllNotifications();
      setNotifications([]);
      onClearAll();
      setShowConfirmClear(false);
    } catch (err) {
      console.error(err);
    }
  };

  const playTestChime = () => {
    try {
      const audio = new Audio('/whatsapp.wav');
      audio.play().catch(() => {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtxClass) return;
        const audioCtx = new AudioCtxClass();
        
        const playTone = (freq: number, start: number, duration: number) => {
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gainNode.gain.setValueAtTime(0, start);
          gainNode.gain.linearRampToValueAtTime(0.15, start + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          osc.start(start);
          osc.stop(start + duration);
        };
        
        const now = audioCtx.currentTime;
        playTone(1395, now, 0.15);
        playTone(1760, now + 0.08, 0.22);
      });
    } catch (e) {
      console.warn("Blocked:", e);
    }
  };

  // Filter criteria
  const filteredNotifications = notifications.filter(n => {
    const matchesSearch = 
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      n.message.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (categoryFilter === 'all') return matchesSearch;
    if (categoryFilter === 'inventory') {
      return matchesSearch && ['out_of_stock', 'low_stock', 'restock', 'price_changed'].includes(n.type);
    }
    if (categoryFilter === 'sales') {
      return matchesSearch && ['new_order', 'sale_authorized', 'sale_rejected', 'payment_received'].includes(n.type);
    }
    return matchesSearch;
  });

  // Count helper
  const stats = {
    total: notifications.length,
    outOfStock: notifications.filter(n => n.type === 'out_of_stock').length,
    lowStock: notifications.filter(n => n.type === 'low_stock').length,
    orders: notifications.filter(n => n.type === 'new_order').length,
    payments: notifications.filter(n => n.type === 'payment_received').length,
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Immersive Dark Backdrop with Blur */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md"
          />

          {/* Sliding Notifications Side Sheet */}
          <motion.div 
            initial={{ x: '100%', opacity: 0.95 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.95 }}
            transition={{ type: 'spring', damping: 30, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-[999] w-full sm:max-w-[460px] md:max-w-[480px] bg-slate-50/98 backdrop-blur-2xl shadow-[0_0_60px_rgba(15,25,44,0.18)] flex flex-col h-full border-l border-slate-200 relative overflow-hidden"
          >
            {/* Cinematic Floating Blobs deep in backdrop */}
            <motion.div 
              animate={{ 
                x: [0, 40, -20, 0], 
                y: [0, -60, 40, 0],
                rotate: [0, 180, 360] 
              }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              className="absolute top-[20%] -right-20 w-48 h-48 bg-emerald-500/5 rounded-full blur-[60px] pointer-events-none"
            />
            <motion.div 
              animate={{ 
                x: [0, -30, 50, 0], 
                y: [0, 40, -40, 0],
                rotate: [360, 180, 0] 
              }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              className="absolute bottom-[10%] -left-20 w-56 h-56 bg-amber-400/5 rounded-full blur-[70px] pointer-events-none"
            />
            <motion.div 
              animate={{ 
                scale: [1, 1.2, 0.9, 1],
                opacity: [0.3, 0.7, 0.3, 0.3] 
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-[45%] left-10 w-2 h-2 bg-emerald-400 rounded-full blur-[1px] pointer-events-none"
            />
            <motion.div 
              animate={{ 
                scale: [1, 0.8, 1.4, 1],
                opacity: [0.2, 0.6, 0.2, 0.2] 
              }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
              className="absolute bottom-[35%] right-20 w-3 h-3 bg-teal-300 rounded-full blur-[2px] pointer-events-none"
            />

            {/* Header with Premium Corporate Emerald-Teal Gradient */}
            <div className="bg-gradient-to-br from-[#0c5c35] to-[#042616] text-white px-6 py-6 flex flex-col gap-4 shadow-md relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-[40px] pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-teal-400/10 rounded-full blur-[30px] pointer-events-none" />
              
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 shadow-inner">
                    <Bell className="text-emerald-300 animate-pulse" size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-1.5 w-1.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      <span className="text-[9px] text-emerald-300 font-extrabold uppercase tracking-widest font-mono">Monitoreo Activo</span>
                    </div>
                    <h3 className="font-sans font-bold text-[20px] tracking-tight text-white leading-tight">Canal de Alertas</h3>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Sound Toggle Button with Testing option */}
                  <div className="flex items-center bg-white/10 backdrop-blur-md rounded-xl border border-white/5 p-0.5">
                    <button 
                      onClick={() => {
                        const val = !soundsEnabled;
                        setSoundsEnabled(val);
                        localStorage.setItem('notifications_sounds_enabled', String(val));
                        if (val) {
                          setTimeout(playTestChime, 150);
                        }
                      }}
                      title={soundsEnabled ? "Silenciar alertas (Haz clic para silenciar)" : "Activar sonido de alertas"}
                      className={cn(
                        "p-2 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center justify-center",
                        soundsEnabled ? "text-emerald-300 bg-white/10 hover:bg-white/15" : "text-white/60 hover:text-white"
                      )}
                    >
                      {soundsEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                    </button>
                    {soundsEnabled && (
                      <button
                        onClick={playTestChime}
                        title="Probar sonido actual de alerta Agricovet"
                        className="px-2 py-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-200 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                      >
                        Probar
                      </button>
                    )}
                  </div>

                  {/* Close button with active rotation */}
                  <button 
                    onClick={onClose} 
                    className="p-2 bg-white/10 hover:bg-white/15 active:scale-95 text-white/90 hover:text-white rounded-xl transition-all cursor-pointer border border-white/5"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Bento Stats Display within Header */}
              <div className="grid grid-cols-3 gap-2.5 mt-2 z-10">
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-3 flex flex-col justify-between transition-all hover:bg-white/10">
                  <span className="text-[9px] font-black text-emerald-300 uppercase tracking-widest block font-sans">Total Activo</span>
                  <span className="text-xl font-bold text-white mt-1 leading-none font-mono">{stats.total}</span>
                </div>
                <div className={cn(
                  "border rounded-xl p-3 flex flex-col justify-between transition-all hover:bg-opacity-20",
                  stats.outOfStock > 0 
                    ? "bg-red-500/15 border-red-500/20 text-red-100" 
                    : "bg-white/5 border-white/10 text-white/40"
                )}>
                  <span className="text-[9px] font-black uppercase tracking-widest block font-sans">Crítico</span>
                  <span className={cn(
                    "text-xl font-bold mt-1 leading-none font-mono",
                    stats.outOfStock > 0 ? "text-red-300 font-extrabold" : "text-white/40"
                  )}>{stats.outOfStock}</span>
                </div>
                <div className={cn(
                  "border rounded-xl p-3 flex flex-col justify-between transition-all hover:bg-opacity-20",
                  stats.lowStock > 0 
                    ? "bg-amber-500/15 border-amber-500/20 text-amber-100" 
                    : "bg-white/5 border-white/10 text-white/40"
                )}>
                  <span className="text-[9px] font-black uppercase tracking-widest block font-sans font-extrabold">Alerta</span>
                  <span className={cn(
                    "text-xl font-bold mt-1 leading-none font-mono",
                    stats.lowStock > 0 ? "text-amber-300 font-extrabold" : "text-white/40"
                  )}>{stats.lowStock}</span>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-5 border-b border-slate-200/50 flex flex-col gap-4 bg-white shadow-sm z-20">
              {/* Search Bar */}
              <div className="relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Filtrar por producto, cliente o folios..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-16 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0c5c35]/20 focus:border-[#0c5c35] transition-all"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#0c5c35] hover:text-[#05301a] transition-colors uppercase tracking-wider"
                  >
                    Borrar
                  </button>
                )}
              </div>

              {/* Category Filters Switches with Animated Highlighting Slider */}
              <div className="flex bg-slate-100/90 p-1 rounded-xl relative">
                {['all', 'inventory', 'sales'].map((tab) => {
                  const isActive = categoryFilter === tab;
                  const label = tab === 'all' ? 'Todas' : tab === 'inventory' ? 'Inventario' : 'Finanzas';
                  return (
                    <button 
                      key={tab}
                      onClick={() => setCategoryFilter(tab as any)}
                      className={cn(
                        "flex-1 py-2 px-2 text-center text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer relative z-10",
                        isActive ? "text-white" : "text-slate-500 hover:text-slate-805"
                      )}
                    >
                      {isActive && (
                        <motion.div 
                          layoutId="category_pill"
                          className="absolute inset-0 bg-[#0c5c35] rounded-lg -z-10 shadow-sm"
                          transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        />
                      )}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List with Animated Cards over a soft, breathing, neutral background */}
            <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4 bg-slate-100/40">
              {loading ? (
                <div className="py-24 text-center flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-[#0c5c35] animate-spin mb-4 shadow-sm" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Sincronizando Alertas Inteligentes...</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center px-1 mb-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                      Visualizando {filteredNotifications.length} de {notifications.length}
                    </span>
                    {notifications.length > 0 && !showConfirmClear && (
                      <button 
                        onClick={() => setShowConfirmClear(true)}
                        className="text-[10px] text-red-650 hover:text-red-700 font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer hover:underline"
                      >
                        <Trash2 size={11} className="text-red-500" /> Limpiar Todo
                      </button>
                    )}
                  </div>

                  {/* Aesthetic Non-Modal Confirmation bar */}
                  <AnimatePresence>
                    {showConfirmClear && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-4 overflow-hidden bg-red-50 border border-red-200 p-4 rounded-2xl flex flex-col gap-2.5 shadow-sm"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={15} />
                          <div className="flex-1">
                            <h4 className="text-xs font-black text-red-900 uppercase">¿Confirmar limpieza general?</h4>
                            <p className="text-[10px] text-red-750 font-bold leading-relaxed mt-0.5">Se eliminarán permanentemente todas las alertas de tu historial de Agricovet.</p>
                          </div>
                        </div>
                        <div className="flex gap-2 self-end">
                          <button 
                            onClick={() => setShowConfirmClear(false)}
                            className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={handleClearAll}
                            className="px-3.5 py-1.5 text-[9px] font-black uppercase tracking-wide bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer shadow-sm"
                          >
                            Sí, Borrar Todo
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </  AnimatePresence>

                  <div className="space-y-4">
                    <AnimatePresence initial={false}>
                      {filteredNotifications.map((n, idx) => {
                        const isOutOfStock = n.type === 'out_of_stock';
                        const isLowStock = n.type === 'low_stock';
                        const isRestock = n.type === 'restock';
                        const isPriceChanged = n.type === 'price_changed';
                        const isRejected = n.type === 'sale_rejected';
                        const isAuthorized = n.type === 'sale_authorized';
                        const isNewOrder = n.type === 'new_order';
                        const isPayment = n.type === 'payment_received';

                        return (
                          <motion.div 
                            key={n.id}
                            layout
                            custom={idx}
                            initial={{ opacity: 0, y: 15, scale: 0.98 }}
                            animate={{ 
                              opacity: 1, 
                              y: 0, 
                              scale: 1,
                              transition: {
                                delay: Math.min(idx * 0.04, 0.4),
                                duration: 0.35,
                                ease: [0.16, 1, 0.3, 1]
                              }
                            }}
                            exit={{ opacity: 0, scale: 0.95, x: 50, transition: { duration: 0.25 } }}
                            whileHover={{ y: -2, scale: 1.01, transition: { duration: 0.15 } }}
                            className={cn(
                              "group relative flex gap-4 p-5 rounded-2xl bg-white border border-slate-100/70 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.04)] transition-all duration-300 relative overflow-hidden",
                              isOutOfStock && "border-l-4 border-l-red-500",
                              isLowStock && "border-l-4 border-l-amber-500",
                              isRestock && "border-l-4 border-l-emerald-500",
                              isPriceChanged && "border-l-4 border-l-violet-500",
                              isNewOrder && "border-l-4 border-l-teal-500",
                              isAuthorized && "border-l-4 border-l-green-500",
                              isRejected && "border-l-4 border-l-rose-500",
                              isPayment && "border-l-4 border-l-sky-500"
                            )}
                          >
                            {/* Ambient Glow Overlay */}
                            <div className="absolute top-0 right-0 w-28 h-28 bg-slate-50/50 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-50/5 transition-colors" />

                            {/* Animated Icon badge with modern glass container */}
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-[0_2px_6px_rgba(0,0,0,0.01)] border transition-transform duration-300 group-hover:scale-105",
                              isOutOfStock && "bg-red-50/80 border-red-100 text-red-600",
                              isLowStock && "bg-amber-50/80 border-amber-100 text-amber-600",
                              isRestock && "bg-emerald-50/80 border-emerald-100 text-emerald-600",
                              isPriceChanged && "bg-violet-50/80 border-violet-100 text-violet-600",
                              isNewOrder && "bg-teal-50/80 border-teal-100 text-[#00696a]",
                              isAuthorized && "bg-green-50/80 border-green-100 text-green-600",
                              isRejected && "bg-rose-50/80 border-rose-100 text-rose-600",
                              isPayment && "bg-sky-50/80 border-sky-100 text-sky-600"
                            )}>
                              {isOutOfStock && <XCircle size={18} className="animate-pulse" />}
                              {isLowStock && <AlertTriangle size={18} />}
                              {isRestock && <Box size={18} />}
                              {isPriceChanged && <Tag size={18} />}
                              {isNewOrder && <ShoppingCart size={18} />}
                              {isAuthorized && <CheckCircle size={18} />}
                              {isRejected && <XCircle size={18} />}
                              {isPayment && <CreditCard size={18} />}
                            </div>

                            <div className="flex-1 min-w-0 pr-4 z-10">
                              <span className="text-[13px] font-bold tracking-tight block text-slate-800 leading-snug">
                                {n.title}
                              </span>
                              <p className="text-[11.5px] text-slate-500 font-medium leading-relaxed mt-1 break-words">
                                {n.message}
                              </p>
                              
                              <div className="flex items-center gap-2 mt-3">
                                <span className="text-[9px] text-slate-400 font-extrabold flex items-center gap-1.5 bg-slate-50 border border-slate-100/50 px-2.5 py-0.5 rounded-lg font-mono">
                                  <Clock size={10} className="text-slate-400 shrink-0" />
                                  {new Date(n.createdAt).toLocaleDateString('es-GT', { month: 'short', day: 'numeric' })}, {new Date(n.createdAt).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              {/* Direct Action Link button */}
                              {(n.productId || n.invoiceId) && (
                                <button
                                  onClick={() => {
                                    if (n.productId) {
                                      localStorage.setItem('highlight_product_id', n.productId);
                                      onChangeTab('inventory');
                                    } else if (n.invoiceId) {
                                      localStorage.setItem('highlight_invoice_id', n.invoiceId);
                                      const tab = user.role === 'admin' ? 'daily-sales' : 'my-sales';
                                      onChangeTab(tab);
                                    }
                                    onClose();
                                  }}
                                  className={cn(
                                    "mt-3 text-[9.5px] font-black uppercase tracking-wider flex items-center gap-1.5 px-3.5 py-2 rounded-xl w-max shadow-sm transition-all active:scale-95 cursor-pointer border",
                                    isOutOfStock || isLowStock || isRestock 
                                      ? "bg-emerald-50 text-[#0c5c35] hover:bg-emerald-100/80 border-emerald-100" 
                                      : "bg-teal-50 text-[#0c5c35] hover:bg-[#0c5c35]/10 border-teal-100"
                                  )}
                                >
                                  {isOutOfStock || isLowStock || isRestock ? 'Editar Stock' : 'Ver Documento'}
                                  <ExternalLink size={9.5} />
                                </button>
                              )}
                            </div>

                            <button 
                              onClick={(e) => handleDelete(n.id, e)}
                              className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 active:scale-90 transition-all rounded-lg cursor-pointer"
                              title="Descartar notificación"
                            >
                              <X size={12} />
                            </button>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {filteredNotifications.length === 0 && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="py-16 px-6 text-center flex flex-col items-center justify-center bg-white border border-slate-100 rounded-3xl shadow-sm max-w-sm mx-auto mt-4"
                    >
                      <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-4 relative">
                        <div className="absolute inset-0 bg-[#0c5c35]/5 rounded-full animate-ping opacity-30" />
                        <Bell size={20} className="text-[#0c5c35] stroke-[1.8]" />
                      </div>
                      <h4 className="text-[13px] font-black text-slate-800 uppercase tracking-widest mb-1.5 leading-none">Buzón Comercial al Día</h4>
                      <p className="text-[11.5px] text-slate-400 font-semibold leading-relaxed max-w-[240px]">
                        No hay alertas que requieran tu atención. Todas las operaciones comerciales fluyen de manera normal.
                      </p>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function Navigation({ user, activeUser, currentTab, onChangeTab, onLogout, onReturnToAdmin, onImpersonate, isMobile, onShowInstallGuide, showInstallButton }: NavigationProps) {
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem('app_logo_url') || '/agricovet.png');

  const [sellers, setSellers] = useState<User[]>([]);
  const [isSellersLoading, setIsSellersLoading] = useState(false);

  useEffect(() => {
    if (user.role === 'admin') {
      setIsSellersLoading(true);
      api.getUsers().then(users => {
        setSellers(users.filter(u => u.role === 'seller'));
      }).catch(() => {}).finally(() => setIsSellersLoading(false));
    }
  }, [user.role]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Estado de conexión del navegador y monitoreo de sincronización de caché (Offline vs Tiempo Real)
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return localStorage.getItem('last_sync_time') || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });
  const [showSyncInfoModal, setShowSyncInfoModal] = useState(false);
  const lastClosedTimeRef = useRef<number>(0);

  const handleOpenSyncModal = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const now = Date.now();
    if (now - lastClosedTimeRef.current < 400) {
      return;
    }
    setShowSyncInfoModal(true);
  };

  const handleCloseSyncModal = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    lastClosedTimeRef.current = Date.now();
    setShowSyncInfoModal(false);
  };

  const [showMobileMoreSheet, setShowMobileMoreSheet] = useState(false);

  // Estados para Notificaciones Push Nativas (Web Push con VBR)
  const [pushStatus, setPushStatus] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');
  const [isSubscribedToPush, setIsSubscribedToPush] = useState(false);
  const [isActivatingPush, setIsActivatingPush] = useState(false);
  const [pushErrorMsg, setPushErrorMsg] = useState('');
  const [isSendingTestPush, setIsSendingTestPush] = useState(false);
  const [isSilentModeActive, setIsSilentModeActive] = useState(false);
  const [isUpdatingSilentMode, setIsUpdatingSilentMode] = useState(false);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  useEffect(() => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushStatus('unsupported');
        return;
      }

      const sw = navigator.serviceWorker;
      if (!sw) {
        setPushStatus('unsupported');
        return;
      }

      if (typeof Notification !== 'undefined') {
        setPushStatus(Notification.permission as any);
      } else {
        setPushStatus('unsupported');
      }

      sw.ready.then((registration) => {
        registration.pushManager.getSubscription().then((subscription) => {
          setIsSubscribedToPush(!!subscription);
        });
      }).catch(err => {
        console.warn("Error al verificar suscripción push en montaje:", err);
      });

      const handlePushMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'PUSH_NOTIFICATION_RECEIVED') {
          const saved = localStorage.getItem('notifications_sounds_enabled');
          const isSoundsEnabled = saved === null ? true : saved === 'true';
          if (isSoundsEnabled) {
            playNotificationChime();
          }
        }
      };

      sw.addEventListener('message', handlePushMessage);
      return () => {
        try {
          sw.removeEventListener('message', handlePushMessage);
        } catch (e) {}
      };
    } catch (err) {
      console.warn("Service worker features are blocked or unsupported:", err);
      setPushStatus('unsupported');
    }
  }, []);

  const handleSubscribePush = async () => {
    setIsActivatingPush(true);
    setPushErrorMsg('');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
        throw new Error('Tu navegador no soporta notificaciones Push directas (modo incógnito o iOS antiguo).');
      }

      const permission = await Notification.requestPermission();
      setPushStatus(permission);

      if (permission !== 'granted') {
        throw new Error('Se denegó el permiso. Por favor, actívalo en los ajustes de tu navegador.');
      }

      const registration = await navigator.serviceWorker.ready;
      const publicKey = await api.getPushPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      await api.sendPushSubscription(subscription);
      setIsSubscribedToPush(true);
      setPushErrorMsg('');
    } catch (err: any) {
      console.error(err);
      setPushErrorMsg(err.message || 'Error al conectar tu dispositivo.');
    } finally {
      setIsActivatingPush(false);
    }
  };

  const handleTestPush = async () => {
    setIsSendingTestPush(true);
    try {
      await api.testPushNotification(
        "Prueba de Agricovet 🔔",
        "¡Sintonizado! Las notificaciones nativas de la aplicación se recibirán al instante."
      );
    } catch (err: any) {
      console.error(err);
      setPushErrorMsg("Error al enviar prueba: " + (err.message || err));
    } finally {
      setIsSendingTestPush(false);
    }
  };

  useEffect(() => {
    if (showSyncInfoModal) {
      api.getWarehouseConfig()
        .then(res => {
          if (res && res.isSilentModeActive !== undefined) {
            setIsSilentModeActive(res.isSilentModeActive);
          }
        })
        .catch(err => console.error("Error al obtener configuración de bodega:", err));
    }
  }, [showSyncInfoModal]);

  const handleToggleSilentMode = async () => {
    if (user.role !== 'admin') return;
    setIsUpdatingSilentMode(true);
    try {
      const nextSilentState = !isSilentModeActive;
      await api.updateWarehouseConfig({ isSilentModeActive: nextSilentState });
      setIsSilentModeActive(nextSilentState);
    } catch (err) {
      console.error("Error al actualizar modo silencioso:", err);
      alert("No se pudo actualizar el modo silencioso de notificaciones.");
    } finally {
      setIsUpdatingSilentMode(false);
    }
  };

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setIsSyncing(true);
      try {
        await api.getMe();
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        localStorage.setItem('last_sync_time', timeStr);
        setLastSyncTime(timeStr);
      } catch (e) {}
      setIsSyncing(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await api.getMe();
      await new Promise(r => setTimeout(r, 650));
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      localStorage.setItem('last_sync_time', timeStr);
      setLastSyncTime(timeStr);
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Advanced notification state management
  const [activeToasts, setActiveToasts] = useState<any[]>([]);
  const [soundsEnabled, setSoundsEnabled] = useState(() => {
    const saved = localStorage.getItem('notifications_sounds_enabled');
    return saved === null ? true : saved === 'true';
  });

  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  const playNotificationChime = () => {
    try {
      const audio = new Audio('/whatsapp.wav');
      audio.play().catch(() => {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtxClass) return;
        const audioCtx = new AudioCtxClass();
        
        const playTone = (freq: number, start: number, duration: number) => {
          const osc = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gainNode.gain.setValueAtTime(0, start);
          gainNode.gain.linearRampToValueAtTime(0.15, start + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.001, start + duration);
          osc.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          osc.start(start);
          osc.stop(start + duration);
        };
        
        const now = audioCtx.currentTime;
        playTone(1395, now, 0.15);
        playTone(1760, now + 0.08, 0.22);
      });
    } catch (err) {
      console.warn("Audio Context sound blocked or not supported:", err);
    }
  };

  const checkNotifications = async () => {
    try {
      const data = await api.getNotifications();
      if (data && data.length > 0) {
        const lastSeen = localStorage.getItem(`lastSeenNotification_${user.id}`);
        const newest = new Date(data[0].createdAt).getTime();
        if (!lastSeen || newest > parseInt(lastSeen)) {
          setHasUnread(true);
        }

        const currentIds = data.map(n => n.id);
        
        if (isFirstLoadRef.current) {
          currentIds.forEach(id => knownNotificationIdsRef.current.add(id));
          isFirstLoadRef.current = false;
        } else {
          // Identify any completely new notifications
          const newNotifications = data.filter(n => !knownNotificationIdsRef.current.has(n.id));
          if (newNotifications.length > 0) {
            // Trigger beautiful audio arpeggio if enabled
            if (soundsEnabled) {
              playNotificationChime();
            }

            // Push into active toasts queue
            newNotifications.forEach(n => {
              const toastId = `toast-${Date.now()}-${Math.random()}`;
              setActiveToasts(prev => [
                { ...n, toastId },
                ...prev
              ]);
              knownNotificationIdsRef.current.add(n.id);

              // Automatically clear from screen after 8 seconds
              setTimeout(() => {
                setActiveToasts(prev => prev.filter(t => t.toastId !== toastId));
              }, 8000);
            });

            setHasUnread(true);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    checkNotifications();
    
    const handleMutation = () => {
      checkNotifications();
    };
    window.addEventListener('agricovet-mutate', handleMutation);

    const interval = setInterval(checkNotifications, 45000); 
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('agricovet-mutate', handleMutation);
    };
  }, [soundsEnabled]);

  useEffect(() => {
    // Instantly poll on tab switches to ensure real-time consistency
    checkNotifications();
  }, [currentTab]);

  useEffect(() => {
    if (showNotifications) {
      setHasUnread(false);
      localStorage.setItem(`lastSeenNotification_${user.id}`, Date.now().toString());
    }
  }, [showNotifications]);

  const navItems = [
    { id: 'home', label: 'Inicio', icon: Leaf, roles: ['admin', 'seller'] },
    { id: 'inventory', label: 'Inventario', icon: Package, roles: ['admin', 'seller'] },
    { id: 'sales', label: 'Ventas', icon: ShoppingCart, roles: ['admin', 'seller'] },
    { id: 'my-sales', label: 'Mis Ventas', icon: FileText, roles: ['seller'] },
    { id: 'billing', label: 'Facturación', icon: FileText, roles: ['admin'] },
    { id: 'daily-sales', label: 'Ventas Diarias', icon: Leaf, roles: ['admin'] },
    { id: 'business-debts', label: 'Compras', icon: CreditCard, roles: ['admin'] },
    { id: 'seller-debts', label: 'Registro Ventas', icon: ClipboardList, roles: ['seller'] },
    { id: 'clients', label: 'Clientes', icon: Users, roles: ['admin', 'seller'] },
    { id: 'team', label: 'Equipo', icon: Users, roles: ['admin', 'seller'] },
  ];

  const userNavItems = navItems.filter(item => {
    if (item.id === 'team' && activeUser?.email === 'limalopez22@gmail.com') {
      return false;
    }
    return item.roles.includes(activeUser.role);
  });
  const majorMobileIds = activeUser.role === 'admin' ? ['home', 'inventory', 'sales', 'daily-sales'] : ['home', 'inventory', 'sales', 'my-sales'];
  const majorMobileItems = userNavItems.filter(item => majorMobileIds.includes(item.id));
  const remainingMobileItems = userNavItems.filter(item => !majorMobileIds.includes(item.id));
  const isMoreActive = remainingMobileItems.some(item => item.id === currentTab);

  return (
    <>
      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-50 bg-white border-b border-slate-200 flex justify-between items-center px-4 h-16 w-full select-none">
        <div className="flex items-center gap-1.5">
          <img src={logoUrl} alt="Agricovet" className="h-8 w-8 object-contain" onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/40?text=Logo'; }} />
          <div className="flex items-center gap-1.5">
            <h1 translate="no" className="notranslate font-sans font-black text-sm sm:text-base text-slate-800 tracking-tight leading-none">Agricovet</h1>
            <button 
              onClick={handleOpenSyncModal}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-xs shrink-0",
                isOnline 
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                  : "bg-amber-50 text-amber-800 border-amber-200"
              )}
              title="Click para ver estado y detalles de datos"
            >
              <span className={cn(
                "w-1.5 h-1.5 rounded-full relative inline-block",
                isOnline ? "bg-emerald-500" : "bg-amber-500"
              )}>
                <span className={cn(
                  "absolute inset-0 rounded-full animate-ping opacity-75 inline-block",
                  isOnline ? "bg-emerald-400" : "bg-amber-400"
                )} />
              </span>
              <span>
                {isOnline ? "Nube" : "Offline"}
              </span>
            </button>
          </div>
        </div>
          <div className="flex items-center gap-2.5 relative">
            {user.role === 'admin' && (
              <div className="hidden sm:flex items-center gap-2">
                <select 
                  value={activeUser.id === user.id ? '' : activeUser.id}
                  onChange={(e) => {
                    const selected = sellers.find(s => s.id === e.target.value);
                    onImpersonate?.(selected || null);
                  }}
                  className="bg-slate-50 border border-slate-200 text-[10px] font-bold px-2 py-1.5 rounded-lg outline-none focus:border-[#00696a] transition-all cursor-pointer text-slate-700"
                >
                  <option value="">Vista: Administrador</option>
                  {sellers.map(s => (
                    <option key={s.id} value={s.id}>Vista: {s.name}</option>
                  ))}
                </select>
              </div>
            )}
            {showInstallButton && onShowInstallGuide && (
            <button 
              onClick={onShowInstallGuide} 
              className="text-[#00696a] bg-teal-50 hover:bg-teal-100 p-1.5 rounded-lg border border-teal-100 relative transition-transform active:scale-95 flex items-center justify-center cursor-pointer"
              title="Instalar Aplicación"
            >
              <Download size={16} />
            </button>
          )}
          <button onClick={() => setShowNotifications(!showNotifications)} className="text-slate-500 hover:text-slate-700 relative p-1.5 hover:bg-slate-50 rounded-lg transition-transform active:scale-95 cursor-pointer" title="Ver notificaciones">
             <Bell size={20} />
             {hasUnread && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#ba1a1a] rounded-full border-2 border-white animate-pulse"></span>}
          </button>
          <div 
            onClick={handleOpenSyncModal}
            className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden border border-slate-200 shadow-xs cursor-pointer active:scale-95"
            title="Soportes & Estado de Datos"
          >
            {user.photo ? (
              <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
            ) : (
               <div className="w-full h-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xs uppercase">
                {user.name.charAt(0)}
              </div>
            )}
          </div>
          <button onClick={() => setShowLogoutConfirm(true)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-slate-50 active:scale-95 transition-all cursor-pointer">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-between items-center px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] bg-white border-t border-slate-100 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] select-none">
        {majorMobileItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onChangeTab(item.id);
                setShowMobileMoreSheet(false);
              }}
              className={cn(
                "flex flex-col items-center justify-between relative h-12 w-16 transition-all duration-300 group",
                isActive ? "text-[#00696a]" : "text-slate-400 hover:text-slate-500"
              )}
            >
              <div className={cn(
                "absolute -top-2 w-8 h-[3.5px] rounded-b-full transition-all duration-300",
                isActive ? "bg-[#00696a] scale-100 opacity-100" : "bg-[#00696a] scale-0 opacity-0"
              )} />
              <div className="relative mt-1">
                <item.icon 
                  size={20} 
                  strokeWidth={isActive ? 2.5 : 1.75} 
                  className={cn(
                    "transition-all duration-300",
                    isActive ? "text-[#00696a] -translate-y-1" : "text-slate-400 group-hover:-translate-y-0.5"
                  )} 
                />
              </div>
              <span className={cn(
                "text-[9px] transition-all duration-300 mt-1 origin-bottom font-semibold",
                isActive ? "font-black text-[#00696a] scale-100" : "font-medium text-inherit scale-95"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}

        {remainingMobileItems.length > 0 && (
          <button
            onClick={() => setShowMobileMoreSheet(!showMobileMoreSheet)}
            className={cn(
              "flex flex-col items-center justify-between relative h-12 w-16 transition-all duration-300 group",
              isMoreActive ? "text-[#00696a]" : "text-slate-400 hover:text-slate-500"
            )}
          >
            <div className={cn(
              "absolute -top-2 w-8 h-[3.5px] rounded-b-full transition-all duration-300",
              isMoreActive ? "bg-[#00696a] scale-100 opacity-100" : "bg-[#00696a] scale-0 opacity-0"
            )} />
            <div className="relative mt-1">
              <Menu 
                size={20} 
                strokeWidth={isMoreActive ? 2.5 : 1.75} 
                className={cn(
                  "transition-all duration-300",
                  isMoreActive ? "text-[#00696a] -translate-y-1" : "text-slate-400 group-hover:-translate-y-0.5",
                  showMobileMoreSheet && "rotate-90 text-[#00696a]"
                )} 
              />
            </div>
            <span className={cn(
              "text-[9px] transition-all duration-300 mt-1 origin-bottom font-semibold",
              isMoreActive ? "font-black text-[#00696a] scale-100" : "font-medium text-inherit scale-95"
            )}>
              {showMobileMoreSheet ? "Cerrar" : "Más"}
            </span>
          </button>
        )}
      </nav>

      {/* Floating Options Bottom Sheet */}
      <AnimatePresence>
        {showMobileMoreSheet && (
          <div className="md:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileMoreSheet(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[60]"
            />
            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 bg-white border-t border-slate-150 rounded-t-2xl px-5 py-5 z-[70] shadow-[0_-10px_40px_rgba(0,0,0,0.08)] flex flex-col gap-4 select-none"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-[10px] font-black uppercase text-[#00696a] tracking-widest">Opciones de Sistema</span>
                <button
                  onClick={() => setShowMobileMoreSheet(false)}
                  className="bg-slate-50 hover:bg-slate-100 p-1.5 rounded-full text-slate-400 hover:text-slate-650 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Mobile Impersonation Panel */}
              {user?.email === 'seseffff942@gmail.com' && (
                <div className="py-1">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Users size={12} className="text-[#0c5c35]" />
                    <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Modo Vista de Vendedor</h4>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-3 px-1 scrollbar-none snap-x">
                    <button
                      onClick={async () => {
                        onReturnToAdmin();
                        setShowMobileMoreSheet(false);
                      }}
                      className={cn(
                        "shrink-0 px-4 py-2 rounded-xl text-[10px] font-bold transition-all border snap-start",
                        activeUser.id === user.id 
                          ? "bg-[#0c5c35] text-white border-[#0c5c35] shadow-sm" 
                          : "bg-slate-50 text-slate-500 border-slate-200"
                      )}
                    >
                      Original
                    </button>
                    {sellers.map((s) => (
                      <button
                        key={s.id}
                        onClick={async () => {
                          try {
                            await api.impersonate(s.id);
                            window.location.href = '/';
                          } catch (err: any) {
                            alert(err.message || 'Error al suplantar');
                          }
                          setShowMobileMoreSheet(false);
                        }}
                        className={cn(
                          "shrink-0 px-4 py-2 rounded-xl text-[10px] font-bold transition-all border snap-start",
                          activeUser.id === s.id 
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-100" 
                            : "bg-slate-50 text-slate-500 border-slate-200"
                        )}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                  <div className="h-px bg-slate-100 w-full mb-1" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                {remainingMobileItems.map(item => {
                  const subActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onChangeTab(item.id);
                        setShowMobileMoreSheet(false);
                      }}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border text-left transition-all active:scale-[0.98] cursor-pointer",
                        subActive 
                          ? "bg-teal-50 border-teal-200 text-[#00696a] font-bold" 
                          : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100 font-medium"
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-lg shrink-0",
                        subActive ? "bg-[#00696a]/10 text-[#00696a]" : "bg-white text-slate-400 border border-slate-150 shadow-3xs"
                      )}>
                        <item.icon size={16} />
                      </div>
                      <span className="text-[11px] font-semibold tracking-tight leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop Navigation Structure (Sidebar + TopAppBar) */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-[260px] bg-[#0f1c2c] text-[#778598] flex-col py-8 z-50">
        <div className="px-6 mb-8">
          <h1 translate="no" className="notranslate font-hanken font-bold text-[24px] text-white tracking-tight leading-tight">Agricovet</h1>
          <p className="text-[12px] text-[#778598] mt-1 uppercase tracking-widest font-hanken font-bold mb-4">Veterinary & AgTech</p>
          <button 
            onClick={handleOpenSyncModal}
            className={cn(
              "w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all text-left hover:scale-98 active:scale-95 cursor-pointer",
              isOnline 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            )}
            title="Ver detalles de sincronización"
          >
            <div className="flex items-center gap-2">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                isOnline ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"
              )} />
              <span className="font-bold text-[10px] tracking-wider uppercase">
                {isOnline ? "En Tiempo Real" : "Caché Local"}
              </span>
            </div>
            <RefreshCw size={10} className={cn("opacity-60", isSyncing && "animate-spin")} />
          </button>
        </div>
        <nav className="flex-1 space-y-1">
          {navItems.filter(item => item.roles.includes(user.role)).map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                className={cn(
                  "w-full flex items-center px-6 py-3 transition-colors duration-200 cursor-pointer text-left",
                  isActive 
                    ? "border-l-4 border-[#9ef1f1] bg-[#3a4859]/10 text-[#9ef1f1] font-bold" 
                    : "text-[#778598] font-medium hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon size={22} className="mr-3" />
                <span className="font-manrope text-[14px]">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Impersonation Section for Admin in Side Navigation */}
        {user?.email === 'seseffff942@gmail.com' && (
          <div className="mt-4 px-4 py-4 border-t border-white/5">
            <div className="mb-3 px-2 flex items-center gap-2">
              <Users size={12} className="text-[#778598]" />
              <span className="text-[10px] font-bold text-[#778598] uppercase tracking-widest">Vista de Vendedores</span>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 pr-1">
              <button
                onClick={() => onReturnToAdmin()}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[12px] font-medium transition-all cursor-pointer",
                  activeUser.id === user.id 
                    ? "bg-[#3a4859]/20 text-white font-bold border border-white/10" 
                    : "text-[#778598] hover:text-white hover:bg-white/5"
                )}
              >
                <div className="w-5 h-5 rounded-full bg-[#00696a] flex items-center justify-center text-[10px] text-white font-black shrink-0">
                  A
                </div>
                <span>Administrador</span>
              </button>
              {sellers.map((s) => (
                <button
                  key={s.id}
                  onClick={async () => {
                    try {
                      await api.impersonate(s.id);
                      window.location.href = '/';
                    } catch (err: any) {
                      alert(err.message || 'Error al suplantar');
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[12px] font-medium transition-all cursor-pointer",
                    activeUser.id === s.id 
                      ? "bg-indigo-500/20 text-indigo-100 font-bold border border-indigo-500/20 shadow-sm" 
                      : "text-[#778598] hover:text-white hover:bg-white/5"
                  )}
                >
                  <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-[10px] overflow-hidden shrink-0 border border-white/10">
                    {s.photo ? <img src={s.photo} alt="" className="w-full h-full object-cover" /> : s.name.charAt(0)}
                  </div>
                  <span className="truncate">{s.name}</span>
                </button>
              ))}
              {isSellersLoading && <div className="animate-pulse h-8 bg-white/5 rounded-lg mx-2" />}
            </div>
          </div>
        )}

        <div className="mt-auto px-6 pt-6 border-t border-white/10 space-y-3 animate-fade-in">
           <div className="flex items-center justify-between text-[11px] text-[#778598] font-semibold border-b border-white/5 pb-2">
             <span>Última Sincronización:</span>
             <span className="font-mono text-white text-[11px] font-bold">{lastSyncTime}</span>
           </div>
           {showInstallButton && onShowInstallGuide && (
             <button 
               onClick={onShowInstallGuide}
               className="w-full bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all text-[13.5px] font-bold border border-teal-500/20 active:scale-95 cursor-pointer"
             >
               <Download size={15} />
               Instalar Aplicación
             </button>
           )}
           <button 
             onClick={() => setShowLogoutConfirm(true)}
             className="w-full text-[#778598] hover:text-red-400 py-2 flex items-center justify-center gap-2 transition-colors text-[14px] font-bold cursor-pointer"
           >
             <LogOut size={16} />
             Cerrar Sesión
           </button>
        </div>
      </aside>

      <header className="hidden md:flex fixed top-0 left-[260px] right-0 h-16 bg-white border-b border-[#e1e3e4] items-center justify-between px-10 z-40">
        <div className="flex items-center flex-1">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Agricovet" className="h-8 w-8 object-contain" onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/32?text=Logo'; }} />
            <span translate="no" className="notranslate font-hanken font-bold text-xl text-[#0f1c2c] leading-tight mr-4">Agricovet</span>
            
            {/* Interactive Data Sync Status Badge */}
            <button 
              onClick={handleOpenSyncModal}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-black tracking-wide uppercase transition-all cursor-pointer hover:opacity-90 active:scale-95 shadow-sm",
                isOnline 
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                  : "bg-amber-50 text-amber-800 border-amber-200"
              )}
              title="Click para ver estado y detalles de los datos"
            >
              <span className={cn(
                "w-2 h-2 rounded-full relative inline-block",
                isOnline ? "bg-emerald-500" : "bg-amber-500"
              )}>
                <span className={cn(
                  "absolute inset-0 rounded-full animate-ping opacity-75 inline-block",
                  isOnline ? "bg-emerald-400" : "bg-amber-400"
                )} />
              </span>
              <span>
                {isOnline ? "Sincronizado (Tiempo Real)" : "Trabajando con Datos Locales (Caché)"}
              </span>
              <RefreshCw size={11} className={cn("text-slate-400 ml-1.5", isSyncing && "animate-spin")} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-6 ml-8 relative">
          <div className="flex items-center gap-4 relative">
            <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 text-[#44474c] hover:text-[#00696a] transition-all relative flex items-center justify-center rounded-xl hover:bg-slate-50 cursor-pointer active:scale-95" title="Ver notificaciones">
              <Bell size={22} />
              {hasUnread && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#ba1a1a] rounded-full border-2 border-white animate-bounce"></span>}
            </button>
          </div>
          <div className="h-8 w-px bg-[#c4c6cc]"></div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-[14px] font-bold text-[#191c1d] leading-none font-manrope">{user.name}</p>
              <p className="text-[12px] uppercase font-bold tracking-[0.05em] text-[#00696a] mt-1 font-hanken">{user.role}</p>
            </div>
            {user.photo ? (
               <img src={user.photo} alt={user.name} className="w-10 h-10 rounded-full border-2 border-[#9ef1f1] object-cover" />
            ) : (
               <div className="w-10 h-10 rounded-full bg-[#e0f2f1] flex items-center justify-center text-[#00696a] font-bold border-2 border-[#9ef1f1]">
                 {user.name.charAt(0)}
               </div>
            )}
          </div>
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <LogOut size={32} className="text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">¿Cerrar Sesión?</h3>
              <p className="text-slate-500 mb-6">Estás a punto de salir de tu cuenta. ¿Estás seguro que deseas continuar?</p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    onLogout();
                  }}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-red-500 hover:bg-red-650 transition-colors shadow-sm shadow-red-200 cursor-pointer"
                >
                  Sí, salir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sincronización y Caché modal info */}
      {showSyncInfoModal && (
        <div 
          id="sync-info-modal" 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in cursor-pointer"
          onClick={handleCloseSyncModal}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] md:max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Rigid Header with persistent close button */}
            <div className="p-6 pb-3 border-b border-slate-100 relative shrink-0">
              <button 
                id="close-sync-modal-btn"
                onClick={handleCloseSyncModal}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 p-2 bg-slate-50 hover:bg-slate-100 rounded-full cursor-pointer transition-colors z-50 flex items-center justify-center"
                title="Cerrar modal"
              >
                <X size={18} />
              </button>

              <div className="text-center">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-none border",
                  isOnline 
                    ? "bg-emerald-50 border-emerald-100 text-emerald-600" 
                    : "bg-amber-50 border-amber-100 text-amber-600 animate-pulse"
                )}>
                  {isOnline ? <Sparkles size={22} className="text-emerald-600 animate-spin" style={{ animationDuration: '8s' }} /> : <Clock size={22} />}
                </div>
                <h3 className="text-lg font-black text-slate-800 leading-tight uppercase tracking-wider">
                  Soportes & Estado de Datos
                </h3>
                <p className="text-[10px] text-slate-400 mt-1 font-bold tracking-wide uppercase">
                  Agricovet Veterinary & AgTech Engine
                </p>
              </div>
            </div>

            {/* Scrollable Modal Content */}
            <div className="p-6 pt-4 overflow-y-auto flex-1 space-y-4">
              <div className={cn(
                "border rounded-xl p-4 transition-all",
                isOnline 
                  ? "bg-emerald-50/50 border-emerald-200" 
                  : "bg-amber-50/50 border-amber-200"
              )}>
                <div className="flex gap-3">
                  <div className="mt-0.5">
                    {isOnline ? (
                      <CheckCircle size={18} className="text-emerald-600" />
                    ) : (
                      <AlertTriangle size={18} className="text-amber-600" />
                    )}
                  </div>
                  <div>
                    <h4 className={cn(
                      "text-xs font-black uppercase tracking-wider",
                      isOnline ? "text-emerald-800" : "text-amber-800"
                    )}>
                      {isOnline ? "Tiempo Real Activo (DB Nube)" : "Modo Offline (Caché Local) Activo"}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed font-medium">
                      {isOnline 
                        ? "Tu dispositivo está conectado de forma sincronizada con el backend central. Toda transacción, precio y modificación de stock se asienta inmediatamente en tiempo real." 
                        : "No se detectó red o estás operando en baja señal. Cada ticket, precio memorizado y registro de cliente se asienta de manera local en el micro motor de caché SQLite/LocalStorage de tu terminal y se sincronizará apenas haya conexión."
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  Componentes e Indexación de Caché
                </h4>

                <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500 font-bold">Listado de Precios y Productos</span>
                  <span className="text-emerald-700 font-extrabold uppercase tracking-widest text-[9px] bg-emerald-50 px-2 py-0.5 rounded-full font-mono">
                    Caché Offline
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500 font-bold">Base de Clientes del Sistema</span>
                  <span className="text-emerald-700 font-extrabold uppercase tracking-widest text-[9px] bg-emerald-50 px-2 py-0.5 rounded-full font-mono">
                    Caché Offline
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-1.5">
                  <span className="text-slate-500 font-bold">Correlativos y Folios</span>
                  <span className="text-teal-700 font-extrabold uppercase tracking-widest text-[9px] bg-teal-50 px-2 py-0.5 rounded-full font-mono">
                    Seguridad DB
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold">Última Sincronización Exitosa</span>
                  <span className="text-slate-700 font-mono text-xs font-black">
                    {lastSyncTime}
                  </span>
                </div>
              </div>

              {/* Notificaciones Push Nativas */}
              {isSilentModeActive ? (
                <div className="bg-red-50/50 border border-red-200 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-rose-700 uppercase tracking-widest leading-none">
                      NOTIFICACIONES BAJO SEGUNDO PLANO
                    </h4>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-red-400"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  </div>

                  <p className="text-[11px] text-red-700 leading-relaxed font-semibold">
                    Las notificaciones y alertas push han sido desactivadas globalmente por el administrador de manera temporal.
                  </p>

                  <div className="pt-1 flex flex-col gap-2">
                    <div className="bg-red-50 text-red-800 text-[11px] font-bold px-2.5 py-2 rounded-lg border border-red-100 flex items-center gap-2 justify-center">
                      <BellOff size={13} className="text-red-600 shrink-0" />
                      <span>Modo Silencioso Activo</span>
                    </div>

                    {user.role === 'admin' && (
                      <button
                        onClick={handleToggleSilentMode}
                        disabled={isUpdatingSilentMode}
                        className="w-full py-1.5 mt-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-[10px] rounded-lg flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                      >
                        <Bell size={11} />
                        {isUpdatingSilentMode ? "Reactivando..." : "Desactivar Modo Silencioso (Admin)"}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-[#00696a] uppercase tracking-widest leading-none">
                      NOTIFICACIONES BAJO SEGUNDO PLANO
                    </h4>
                    <span className="flex h-2 w-2 relative">
                      <span className={cn(
                        "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                        isSubscribedToPush ? "bg-emerald-400" : "bg-amber-400"
                      )}></span>
                      <span className={cn(
                        "relative inline-flex rounded-full h-2 w-2",
                        isSubscribedToPush ? "bg-emerald-500" : "bg-amber-500"
                      )}></span>
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                    Recibe notificaciones nativas en tu celular (ventas, pedidos, stock crítico, cobros, abonados) al instante, como cualquier otra aplicación.
                  </p>

                  {pushErrorMsg && (
                    <div className="space-y-2">
                      <div className="text-[10px] bg-red-50 text-red-650 font-bold p-2.5 rounded-lg border border-red-100 flex gap-1.5 items-start">
                        <div className="shrink-0 mt-0.5">⚠️</div>
                        <div>{pushErrorMsg}</div>
                      </div>

                      {pushStatus === 'denied' && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 text-[10px] space-y-1.5 leading-normal font-semibold">
                          <div className="text-amber-950 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                            ⚠️ ¿CÓMO CORREGIR EL BLOQUEO DEL NAVEGADOR?
                          </div>
                          <p>
                            Tu Android tiene las notificaciones activadas, pero tu navegador <strong className="text-amber-950">Chrome tiene bloqueado el sitio web internamente</strong>. Sigue estos sencillos pasos basados en tu video:
                          </p>
                          <ol className="list-decimal pl-4 space-y-1">
                            <li>Presiona el <strong className="text-amber-950">icono de candado o configuración</strong> arriba a la izquierda del navegador.</li>
                            <li>Entra a <strong className="text-amber-950">"Permisos: Bloqueado"</strong> o <strong className="text-amber-950">"Configuración de sitios"</strong>.</li>
                            <li>Verás la opción <strong className="text-red-700">"Notificaciones: No se permite"</strong>.</li>
                            <li><strong className="text-amber-950">¡El truco está aquí!</strong> Pulsa el botón que tienes justo abajo que dice <strong className="text-emerald-700 font-bold">"Restablecer permisos"</strong> (o <strong className="text-emerald-700 font-bold">"Borrar datos y restablecer permisos"</strong> en la parte inferior).</li>
                            <li>Una vez hecho esto, regresa a esta pestaña y vuelve a pulsar el botón <strong className="text-[#00696a]">"Conectar Alertas Celular"</strong>. ¡Ahora sí te saldrá la casilla flotante de Chrome para presionar <strong className="text-emerald-700">Permitir</strong>!</li>
                          </ol>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-1">
                    {!isSubscribedToPush ? (
                      <button
                        id="subscribe-push-btn"
                        onClick={handleSubscribePush}
                        disabled={isActivatingPush || pushStatus === 'unsupported'}
                        className="w-full py-2 bg-[#00696a] hover:bg-[#004f50] disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] transition-all"
                      >
                        <Bell size={13} />
                        {isActivatingPush ? "Conectando..." : "Conectar Alertas Celular"}
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="bg-emerald-50 text-emerald-800 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-emerald-100 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle size={13} className="text-emerald-600" />
                            Dispositivo Sintonizado
                          </span>
                          <span className="text-[9px] bg-emerald-100 px-1.5 py-0.5 rounded uppercase font-mono text-emerald-700">
                            Push Activado
                          </span>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            id="test-push-btn"
                            onClick={handleTestPush}
                            disabled={isSendingTestPush}
                            className="flex-1 py-1.5 bg-[#00696a] hover:bg-[#004f50] text-white font-bold text-[10px] rounded-lg shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                          >
                            <RefreshCw size={11} className={cn(isSendingTestPush && "animate-spin")} />
                            {isSendingTestPush ? "Transmitiendo..." : "Prueba de Alerta / Vibración"}
                          </button>
                          
                          <button
                            id="resubscribe-push-btn"
                            onClick={handleSubscribePush}
                            disabled={isActivatingPush}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-150 text-slate-700 font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
                            title="Actualizar registro"
                          >
                            Re-vincular
                          </button>
                        </div>
                      </div>
                    )}

                    {user.role === 'admin' && (
                      <button
                        onClick={handleToggleSilentMode}
                        disabled={isUpdatingSilentMode}
                        className="w-full py-1.5 mt-1 bg-slate-205 rounded-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors font-bold text-[10px] flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
                      >
                        <BellOff size={11} className="text-slate-500" />
                        {isUpdatingSilentMode ? "Procesando..." : "Activar Modo Silencioso (Admin)"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Guía de Sonido y Ventana Emergente */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-2 text-[10px] text-slate-500">
                <div className="font-bold text-[#00696a] uppercase tracking-wider text-[9px] flex items-center gap-1">
                  <Shield size={11} className="text-[#00696a]" /> ¿CÓMO HACER QUE SUENE Y APAREZCA ARRIBA FLOTANDO?
                </div>
                <ul className="list-disc pl-3.5 space-y-1.5 font-semibold leading-normal">
                  <li>
                    <strong className="text-slate-700">En iPhone (iOS 16.4+):</strong> Debes instalar la App en tu pantalla de inicio (<strong className="text-slate-700">"Compartir" ⎋ → "Agregar a inicio"</strong>) e iniciarla desde ahí. En pestañas normales de Safari, Apple bloquea el sonido y alertas push en segundo plano.
                  </li>
                  <li>
                    <strong className="text-slate-700">En Android (Samsung, Xiaomi, etc.):</strong> Instala la App en tu pantalla de inicio. Luego ve a los <strong className="text-slate-700">Ajustes de tu celular → Aplicaciones → Chrome (o Agricovet) → Notificaciones → Categorías de notificación</strong> y asegúrate de configurar a <strong className="text-red-650 font-bold">"Alerta" (con Sonido y ventana emergente)</strong> en vez de "Silencioso".
                  </li>
                  <li className="bg-amber-50 text-amber-850 p-2 rounded-lg border border-amber-200 mt-2 list-none">
                    <strong className="text-amber-900">🔔 NOTA DE TU CAPTURA DE PANTALLA:</strong> Si ves <strong className="text-amber-950">"Esta app no publicó ninguna notificación"</strong> bajo canales, significa que aún no has recibido el primer aviso real <em>dentro</em> de la aplicación instalada. Pulsa arriba el botón de <strong>"Enviar Prueba Push"</strong> desde dentro de la App de Inicio de Agricovet; al caer la primera alerta, el canal <strong>"General"</strong> se activará automáticamente en tus ajustes de Android para que lo pongas en modo <strong>"Alerta (con sonido y flotante)"</strong>.
                  </li>
                </ul>
              </div>
            </div>

            {/* Rigid footer action bar, always visible */}
            <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-150 flex gap-3 shrink-0">
              <button
                id="close-sync-modal-footer-btn"
                onClick={handleCloseSyncModal}
                className="flex-1 py-2.5 rounded-xl text-center text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Entendido
              </button>
              <button
                id="manual-sync-action-btn"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="flex-1 py-2.5 rounded-xl text-center text-xs font-black uppercase tracking-wider text-white bg-[#00696a] hover:bg-[#004f50] disabled:opacity-50 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer shadow-md"
              >
                <RefreshCw size={13} className={cn(isSyncing && "animate-spin")} />
                {isSyncing ? "Sincronizando..." : "Sincronizar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Dynamic Toaster Area */}
      <div className="fixed top-20 right-4 left-4 sm:left-auto md:right-6 md:top-20 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {activeToasts.map((toast) => {
            const isOutOfStock = toast.type === 'out_of_stock';
            const isLowStock = toast.type === 'low_stock';
            const isRestock = toast.type === 'restock';
            const isRejected = toast.type === 'sale_rejected';
            const isAuthorized = toast.type === 'sale_authorized';
            const isNewOrder = toast.type === 'new_order';
            const isPayment = toast.type === 'payment_received';

            return (
              <motion.div
                key={toast.toastId}
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.9 }}
                className={cn(
                  "pointer-events-auto w-full bg-white/95 backdrop-blur-md rounded-2xl border-l-[5px] border border-slate-100 shadow-2xl p-4 flex gap-3 relative overflow-hidden transition-all duration-300",
                  isOutOfStock && "border-l-red-500",
                  isLowStock && "border-l-amber-500",
                  isRestock && "border-l-emerald-500",
                  isNewOrder && "border-l-teal-500",
                  isAuthorized && "border-l-green-500",
                  isRejected && "border-l-rose-500",
                  isPayment && "border-l-sky-500"
                )}
              >
                {/* Visual Accent Glow */}
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />

                {/* Left Mini Badge */}
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 shadow-sm",
                  isOutOfStock && "bg-red-50 border-red-100 text-red-500",
                  isLowStock && "bg-amber-50 border-amber-100 text-amber-500",
                  isRestock && "bg-emerald-50 border-emerald-100 text-emerald-500",
                  isNewOrder && "bg-teal-50 border-teal-100 text-teal-600",
                  isAuthorized && "bg-green-50 border-green-100 text-green-500",
                  isRejected && "bg-rose-50 border-rose-100 text-rose-500",
                  isPayment && "bg-sky-50 border-sky-100 text-sky-500"
                )}>
                  {isOutOfStock && <XCircle size={15} />}
                  {isLowStock && <AlertTriangle size={15} />}
                  {isRestock && <Box size={15} />}
                  {isNewOrder && <ShoppingCart size={15} />}
                  {isAuthorized && <CheckCircle size={15} />}
                  {isRejected && <XCircle size={15} />}
                  {isPayment && <CreditCard size={15} />}
                </div>

                <div className="flex-1 min-w-0 pr-6">
                  <span className="text-[11px] font-extrabold tracking-tight block text-slate-800 uppercase font-hanken">
                    {toast.title}
                  </span>
                  <p className="text-[11px] text-slate-500 font-bold leading-relaxed mt-0.5 leading-snug">
                    {toast.message}
                  </p>

                  <div className="flex items-center gap-2 mt-2.5">
                    <button
                      onClick={() => {
                        if (toast.productId) {
                          localStorage.setItem('highlight_product_id', toast.productId);
                          onChangeTab('inventory');
                        } else if (toast.invoiceId) {
                          localStorage.setItem('highlight_invoice_id', toast.invoiceId);
                          const tab = user.role === 'admin' ? 'daily-sales' : 'my-sales';
                          onChangeTab(tab);
                        } else {
                          setShowNotifications(true);
                        }
                        setActiveToasts(prev => prev.filter(t => t.toastId !== toast.toastId));
                      }}
                      className="text-[9px] font-black uppercase tracking-wider bg-[#0c5c35]/5 hover:bg-[#0c5c35]/10 text-[#0c5c35] py-1 px-2.5 rounded-lg cursor-pointer transition-all active:scale-95 border border-[#0c5c35]/10"
                    >
                      Revisar Alerta
                    </button>
                    <button
                      onClick={() => setActiveToasts(prev => prev.filter(t => t.toastId !== toast.toastId))}
                      className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 hover:text-slate-500 py-1 px-2 cursor-pointer transition-all"
                    >
                      Ignorar
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setActiveToasts(prev => prev.filter(t => t.toastId !== toast.toastId))}
                  className="absolute top-2 right-2 p-1 text-slate-350 hover:text-red-500 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X size={11} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Unified Root-Level Notifications Side Panel */}
      <NotificationsPopover 
        isOpen={showNotifications} 
        onClose={() => setShowNotifications(false)} 
        onClearAll={() => setHasUnread(false)} 
        onChangeTab={onChangeTab}
        user={user}
        soundsEnabled={soundsEnabled}
        setSoundsEnabled={setSoundsEnabled}
      />
    </>
  );
}
