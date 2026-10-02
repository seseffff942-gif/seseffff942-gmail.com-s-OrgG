import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, RefreshCw, X } from 'lucide-react';

// Build version empacada en el código local de la app
export const LOCAL_APP_VERSION = "1.0.1";
export const LOCAL_BUILD_TIME = 1759360000000;

interface VersionInfo {
  version: string;
  buildTime: number;
  message?: string;
  critical?: boolean;
}

export function UpdateNotificationBanner() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  const checkVersion = async () => {
    try {
      const res = await fetch(`/version.json?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) return;
      const data: VersionInfo = await res.json();
      const dismissed = localStorage.getItem('agricovet_dismissed_version');
      if (dismissed === data.version) return;
      
      // Si la versión o el buildTime del servidor es más reciente
      if (data && (data.version !== LOCAL_APP_VERSION || (data.buildTime && data.buildTime > LOCAL_BUILD_TIME))) {
        setUpdateInfo(data);
        setHasUpdate(true);
      }
    } catch (err) {
      // Ignorar errores de red temporales
    }
  };

  useEffect(() => {
    // 1. Chequeo inicial rápido a los 2 segundos
    const initialTimer = setTimeout(checkVersion, 2000);

    // 2. Chequeo periódico cada 10 segundos
    const interval = setInterval(checkVersion, 10000);

    // 3. Chequeo cuando el usuario regresa a la app (cambio de ventana/pestaña)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleApplyUpdate = () => {
    setIsReloading(true);
    if (updateInfo) {
      localStorage.setItem('agricovet_dismissed_version', updateInfo.version);
    }
    setTimeout(() => {
      // Forzar recarga sin caché
      window.location.reload();
    }, 400);
  };

  if (!hasUpdate || isDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 50, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="fixed bottom-20 left-3 right-3 sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-md z-[99999] pointer-events-auto"
      >
        <div className="bg-slate-950/90 backdrop-blur-2xl border border-white/10 ring-1 ring-emerald-500/20 rounded-2xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_20px_rgba(16,185,129,0.15)] flex items-center justify-between gap-3 text-white">
          
          {/* Indicador con pulso */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 shadow-inner">
              <Sparkles size={17} className="animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-black tracking-tight text-white leading-none">
                  Actualización lista
                </p>
                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold rounded-md border border-emerald-500/30 uppercase">
                  {updateInfo?.version || 'v.nueva'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5 font-medium">
                {updateInfo?.message || 'Toca actualizar para aplicar mejoras'}
              </p>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleApplyUpdate}
              disabled={isReloading}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
            >
              <RefreshCw size={13} className={isReloading ? "animate-spin" : ""} />
              {isReloading ? "Aplicando..." : "Actualizar"}
            </button>

            {!updateInfo?.critical && (
              <button
                onClick={() => setIsDismissed(true)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Descartar por ahora"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
