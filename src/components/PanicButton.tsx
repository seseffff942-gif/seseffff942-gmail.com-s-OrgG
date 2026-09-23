import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, RefreshCw, CheckCircle, X } from 'lucide-react';
import { api } from '../api';

interface PanicButtonProps {
  variant?: 'compact' | 'full' | 'floating';
  onModeChanged?: (mode: string) => void;
}

export const PanicButton: React.FC<PanicButtonProps> = ({ variant = 'compact', onModeChanged }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    healthy: boolean;
    server: string;
    details?: string;
  }>({
    healthy: true,
    server: 'PostgreSQL Local',
    details: 'Conexión activa y verificada'
  });
  const [msg, setMsg] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await api.getDbStatus();
      if (data) {
        setStatus({
          healthy: data.healthy !== false,
          server: 'PostgreSQL Local',
          details: 'Base de datos operativa (agricovet_db)'
        });
      }
    } catch (err: any) {
      setStatus({
        healthy: false,
        server: 'PostgreSQL Local',
        details: err?.message || 'Error de conexión'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Botón visual de acceso rápido */}
      {variant === 'compact' && (
        <button
          onClick={() => { setIsOpen(true); fetchStatus(); }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md cursor-pointer border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
          title="Estado del Servidor y Base de Datos Local"
        >
          <span className={`w-2 h-2 rounded-full ${status.healthy ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
          <Database className="w-3.5 h-3.5" />
          <span>Servidor Local</span>
        </button>
      )}

      {variant === 'full' && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-slate-200">
                Base de Datos Local (PostgreSQL)
              </p>
              <p className="text-[10px] text-slate-400">
                {status.healthy ? 'Operando con normalidad' : 'Comprobando conexión...'}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setIsOpen(true); fetchStatus(); }}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs rounded-xl transition border border-slate-600 cursor-pointer"
          >
            Estado
          </button>
        </div>
      )}

      {/* Modal de Control y Estado */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl p-6 shadow-2xl text-slate-100 relative space-y-5">
            
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-teal-500/20 text-teal-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Servidor y Base de Datos</h3>
                  <p className="text-xs text-slate-400">Infraestructura 100% Local</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {msg && (
              <div className="p-3 bg-slate-800 rounded-xl text-xs font-semibold text-teal-300 border border-teal-500/30 animate-in fade-in">
                {msg}
              </div>
            )}

            {/* Estado del servidor */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Servidor Principal</span>
                <button
                  onClick={fetchStatus}
                  disabled={loading}
                  className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  Comprobar
                </button>
              </div>

              {/* Tarjeta PostgreSQL */}
              <div className="p-3.5 rounded-2xl border bg-emerald-950/30 border-emerald-500/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${status.healthy ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'}`} />
                  <div>
                    <p className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      PostgreSQL Local
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md font-bold">Activo</span>
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {status.healthy ? '🟢 En línea y respondiendo' : '🔴 Sin respuesta'}
                    </p>
                  </div>
                </div>
                <div className="text-xs font-semibold text-emerald-400">
                  {status.healthy ? 'Conectado' : 'Error'}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              ✅ El sistema opera con base de datos PostgreSQL local y almacenamiento S3 local de alta velocidad.
            </p>

          </div>
        </div>
      )}
    </>
  );
};
