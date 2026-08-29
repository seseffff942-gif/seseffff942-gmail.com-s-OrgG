import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Wrench, 
  RefreshCw, 
  Activity,
  LogOut,
  Clock,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { api } from '../api';
import { User } from '../types';

interface MaintenancePageProps {
  currentUser?: User | null;
  onGoToLogin?: () => void;
  onLogout?: () => void;
}

export function MaintenancePage({ currentUser, onGoToLogin, onLogout }: MaintenancePageProps) {
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem('app_logo_url') || '/agricovet.png');
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    api.getAppLogo().then(res => {
      if (res && res.logoUrl) {
        setLogoUrl(res.logoUrl);
        localStorage.setItem('app_logo_url', res.logoUrl);
      }
    }).catch(() => {});
  }, []);

  const handleRefresh = () => {
    setCheckingStatus(true);
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#040907] text-slate-100 flex flex-col items-center justify-between font-sans relative overflow-hidden select-none p-4 sm:p-6 md:p-8">
      
      {/* GLOWING ORBS BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <motion.div 
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.15, 0.22, 0.15],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-32 -left-32 w-[550px] h-[550px] rounded-full bg-emerald-600/25 blur-[140px]"
        />
        <motion.div 
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.18, 0.1],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full bg-[#00696a]/25 blur-[150px]"
        />
        <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      {/* TOP HEADER */}
      <header className="relative z-10 w-full max-w-5xl flex items-center justify-between py-2">
        <button 
          onClick={onGoToLogin}
          title="Iniciar Sesión"
          className="flex items-center gap-3 bg-transparent border-0 cursor-pointer text-left group"
        >
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md flex items-center justify-center p-1.5 shadow-lg shadow-emerald-950/40 group-hover:border-emerald-500/40 transition-all">
            <img 
              src={logoUrl} 
              alt="Agricovet Logo" 
              className="w-full h-full object-contain filter drop-shadow"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              AGRICOVET
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                PRO
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Plataforma Empresarial</p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {currentUser && currentUser.email?.toLowerCase() !== 'seseffff942@gmail.com' ? (
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-semibold transition-all cursor-pointer"
            >
              <LogOut size={14} />
              <span>Cerrar Sesión ({currentUser.name?.split(' ')[0]})</span>
            </button>
          ) : (
            <button
              onClick={onGoToLogin}
              className="text-xs text-slate-500 hover:text-slate-300 transition px-3 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer font-medium"
            >
              Acceso
            </button>
          )}
        </div>
      </header>

      {/* MAIN MAINTENANCE CARD */}
      <main className="relative z-10 w-full max-w-xl my-auto py-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative rounded-3xl bg-[#09140f]/90 border border-emerald-500/20 p-6 sm:p-10 shadow-2xl shadow-black/80 backdrop-blur-2xl text-center overflow-hidden"
        >
          {/* Subtle top light highlight */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
          
          {/* Icon Badge */}
          <div className="relative mx-auto mb-6 w-24 h-24 rounded-3xl bg-gradient-to-b from-emerald-500/20 to-teal-500/5 border border-emerald-400/30 flex items-center justify-center shadow-xl shadow-emerald-950/50">
            <motion.div
              animate={{ rotate: [0, 12, -12, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Wrench className="w-11 h-11 text-emerald-400" />
            </motion.div>
            
            {/* Pulsing indicator */}
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-[#09140f]"></span>
            </span>
          </div>

          {/* Maintenance Tag */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Activity size={14} className="animate-pulse text-amber-400" />
            Mantenimiento Técnico en Curso
          </div>

          {/* Headline */}
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
            Estamos Mejorando la Web
          </h2>

          {/* Description */}
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-md mx-auto mb-8">
            El sistema se encuentra temporalmente en labores de actualización y mantenimiento programado. 
            El servicio se restablecerá en breve.
          </p>

          {/* Status Breakdown Grid */}
          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-8 text-left">
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <Clock size={14} />
                <span>Tiempo</span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium">Actualización activa</p>
              <span className="text-[10px] text-emerald-400 font-semibold mt-auto">Reanudación en breve</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                <ShieldAlert size={14} />
                <span>Estado</span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium">Mantenimiento de Servidores</p>
              <span className="text-[10px] text-amber-400 font-semibold mt-auto">En proceso</span>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-center justify-center">
            <button
              onClick={handleRefresh}
              disabled={checkingStatus}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={16} className={checkingStatus ? 'animate-spin' : ''} />
              <span>{checkingStatus ? 'Verificando estado...' : 'Verificar Disponibilidad'}</span>
            </button>
          </div>

          {currentUser && currentUser.email?.toLowerCase() !== 'seseffff942@gmail.com' && (
            <div className="mt-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex items-center justify-center gap-2">
              <span>Sesión activa como <strong>{currentUser.email}</strong>. Sistema temporalmente restringido por mantenimiento.</span>
            </div>
          )}
        </motion.div>
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 w-full max-w-5xl text-center py-3 text-slate-500 text-xs flex items-center justify-center border-t border-white/5">
        <p>© {new Date().getFullYear()} Agricovet - Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
