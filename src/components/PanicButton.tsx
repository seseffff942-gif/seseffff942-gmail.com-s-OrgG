import React, { useState, useEffect } from 'react';
import { Database, AlertTriangle, ShieldCheck, RefreshCw, CheckCircle, AlertCircle, ArrowRightLeft, X } from 'lucide-react';
import { api, clearApiCache } from '../api';

interface PanicButtonProps {
  variant?: 'compact' | 'full' | 'floating';
  onModeChanged?: (mode: 'supabase' | 'neon') => void;
}

export const PanicButton: React.FC<PanicButtonProps> = ({ variant = 'compact', onModeChanged }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    activeMode: 'supabase' | 'neon';
    supabaseHealthy: boolean;
    neonHealthy: boolean;
    neonConfigured: boolean;
  }>({
    activeMode: 'supabase',
    supabaseHealthy: true,
    neonHealthy: true,
    neonConfigured: true
  });
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await api.getDbStatus();
      if (data) {
        setStatus(data);
      }
    } catch (err) {
      console.error('Error al obtener estado de base de datos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSwitch = async (targetMode: 'supabase' | 'neon') => {
    setLoading(true);
    try {
      const res = await api.switchDb(targetMode);
      localStorage.setItem('app_db_mode', targetMode);
      setStatus(prev => ({ ...prev, activeMode: targetMode }));
      clearApiCache();
      window.dispatchEvent(new CustomEvent('agricovet-panic-mode-changed', { detail: { mode: targetMode } }));
      window.dispatchEvent(new CustomEvent('agricovet-mutate'));
      if (onModeChanged) onModeChanged(targetMode);
      setSyncMsg(`🚨 BASE DE DATOS CAMBIADA PARA TODA LA WEB A: ${targetMode === 'neon' ? 'NEON RESPALDO' : 'SUPABASE PRINCIPAL'}`);
      setTimeout(() => setSyncMsg(null), 5000);
    } catch (err: any) {
      setSyncMsg(`❌ Error: ${err.message}`);
      setTimeout(() => setSyncMsg(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      const res = await api.syncNeon();
      setSyncMsg(`🎉 Sincronizados ${res.usersSynced || 0} usuarios y ${res.productsSynced || 0} productos en Neon.`);
      setTimeout(() => setSyncMsg(null), 5000);
    } catch (err: any) {
      setSyncMsg(`❌ Error al sincronizar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isNeon = status.activeMode === 'neon';

  return (
    <>
      {/* Botón visual de acceso rápido */}
      {variant === 'compact' && (
        <button
          onClick={() => { setIsOpen(true); fetchStatus(); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md cursor-pointer border ${
            isNeon
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 animate-pulse'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
          }`}
          title="Estado del Servidor y Base de Datos (Botón de Pánico)"
        >
          <span className={`w-2 h-2 rounded-full ${isNeon ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
          <Database className="w-3.5 h-3.5" />
          <span>{isNeon ? 'Respaldo Neon Activo' : 'Supabase Principal'}</span>
        </button>
      )}

      {variant === 'full' && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isNeon ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              <Database className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-slate-200">
                {isNeon ? 'Base de Datos de Respaldo (Neon)' : 'Base de Datos Principal (Supabase)'}
              </p>
              <p className="text-[10px] text-slate-400">
                {isNeon ? 'Operando en modo contingencia' : 'Operando con normalidad'}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setIsOpen(true); fetchStatus(); }}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs rounded-xl transition border border-slate-600 cursor-pointer"
          >
            Gestionar
          </button>
        </div>
      )}

      {/* Modal de Control y Botón de Pánico */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl p-6 shadow-2xl text-slate-100 relative space-y-5">
            
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-2xl ${isNeon ? 'bg-amber-500/20 text-amber-400' : 'bg-teal-500/20 text-teal-400'}`}>
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Centro de Contingencia</h3>
                  <p className="text-xs text-slate-400">Control de Bases de Datos y Botón de Pánico</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mensaje de estado de sincronización */}
            {syncMsg && (
              <div className="p-3 bg-slate-800 rounded-xl text-xs font-semibold text-teal-300 border border-teal-500/30 animate-in fade-in">
                {syncMsg}
              </div>
            )}

            {/* Estado en tiempo real de los servidores */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estado de Servidores</span>
                <button
                  onClick={fetchStatus}
                  disabled={loading}
                  className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  Comprobar
                </button>
              </div>

              {/* Tarjeta Supabase */}
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                !isNeon 
                  ? 'bg-emerald-950/30 border-emerald-500/40' 
                  : 'bg-slate-800/40 border-slate-700/50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${status.supabaseHealthy ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'}`} />
                  <div>
                    <p className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      Supabase Cloud
                      {!isNeon && <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md font-bold">Activo</span>}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {status.supabaseHealthy ? '🟢 En línea y respondiendo' : '🔴 Sin respuesta o con fallas'}
                    </p>
                  </div>
                </div>
                {isNeon && (
                  <button
                    onClick={() => handleSwitch('supabase')}
                    disabled={loading}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow cursor-pointer"
                  >
                    Usar Supabase
                  </button>
                )}
              </div>

              {/* Tarjeta Neon */}
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                isNeon 
                  ? 'bg-amber-950/30 border-amber-500/40' 
                  : 'bg-slate-800/40 border-slate-700/50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${status.neonHealthy ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'}`} />
                  <div>
                    <p className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      Neon Respaldo (Postgres)
                      {isNeon && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-bold">Activo</span>}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {status.neonHealthy ? '🟢 Conectado y listo' : '🔴 Desconectado'}
                    </p>
                  </div>
                </div>
                {!isNeon && (
                  <button
                    onClick={() => handleSwitch('neon')}
                    disabled={loading}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition shadow cursor-pointer flex items-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Activar Respaldo
                  </button>
                )}
              </div>
            </div>

            {/* Acciones de Emergencia / Botón de Pánico */}
            <div className="pt-2 border-t border-slate-800 space-y-2.5">
              {!isNeon ? (
                <button
                  onClick={() => handleSwitch('neon')}
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-extrabold text-xs rounded-2xl shadow-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4" />
                  🚨 BOTÓN DE PÁNICO: Conectar a Neon Respaldo
                </button>
              ) : (
                <button
                  onClick={() => handleSwitch('supabase')}
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-2xl shadow-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  🔄 Restaurar a Supabase Principal
                </button>
              )}

              <button
                onClick={handleSync}
                disabled={loading}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Sincronizar Datos Actuales hacia Neon
              </button>
            </div>

            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              💡 Si Supabase experimenta caídas globales, activar Neon Respaldo permite continuar operando el sistema sin interrupciones.
            </p>

          </div>
        </div>
      )}
    </>
  );
};
