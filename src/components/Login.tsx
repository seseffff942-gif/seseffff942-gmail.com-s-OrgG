import React, { useState } from 'react';
import { Lock, Mail, User as UserIcon, Monitor, Smartphone, Sparkles, AlertTriangle, CheckCircle, ArrowRight, RefreshCw, Star, ShieldCheck, Key } from 'lucide-react';
import { api } from '../api';
import { motion, AnimatePresence } from 'motion/react';
import { LOGO_PLACEHOLDER } from './ProductImage';

interface LoginProps {
  onLogin: (user: any, device: 'desktop' | 'phone') => void;
}

export function Login({ onLogin }: LoginProps) {
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem('app_logo_url') || '/agricovet.png');

  React.useEffect(() => {
    api.getAppLogo().then(res => {
      if (res && res.logoUrl) {
        setLogoUrl(res.logoUrl);
        localStorage.setItem('app_logo_url', res.logoUrl);
      }
    }).catch(() => {});
  }, []);

  const [mode, setMode] = useState<'login'>('login');
  
  const [sellerCode, setSellerCode] = useState('');
  const [token, setToken] = useState('');
  
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!sellerCode || !token) return setError('Por favor, ingresa tu código de vendedor y token de acceso');
    
    setLoading(true);
    try {
      const user = await api.login(sellerCode, token);
      const isMaintenanceActive = localStorage.getItem('agricovet_maintenance_mode') !== 'false';
      if (isMaintenanceActive && user.email?.toLowerCase() !== 'seseffff942@gmail.com') {
        localStorage.removeItem('app_token');
        localStorage.removeItem('app_user');
        setError('⛔ Acceso denegado: El sistema se encuentra en mantenimiento técnico. Solo el administrador principal (seseffff942@gmail.com) puede ingresar.');
        return;
      }
      onLogin(user, device);
    } catch (err: any) {
      setError(err.message || 'Error de autenticación. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050c09] text-slate-100 flex font-sans relative overflow-hidden select-none">
      
      {/* BACKGROUND REFLECTIVE GLOW EFFECT (Orbs and Dust) */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Deep emerald top-left glowing orb */}
        <motion.div 
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.12, 0.16, 0.12],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-emerald-600/20 blur-[150px]"
        />
        {/* Soft cyan bottom-right glowing orb */}
        <motion.div 
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.08, 0.13, 0.08],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -bottom-40 -right-40 w-[700px] h-[700px] rounded-full bg-[#00696a]/20 blur-[160px]"
        />
        {/* Centered micro dust particles or grid dots overlay */}
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      {/* LEFT SECTION: IMMERSIVE PREMIUM CINEMATIC BRANDING FOR AGRICOLVET (DESKTOP ONLY) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#030906] flex-col justify-between p-12 overflow-hidden border-r border-white/5">
        {/* Background cattle wallpaper with dark cinematic mask */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/vaquitas.jpg?v=2" 
            alt="Agricovet Premium Ganado" 
            className="w-full h-full object-cover opacity-35 scale-105 filter saturate-[0.8] contrast-[1.1]" 
          />
          {/* Advanced reflective glass-gradient mask over image */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#040a07] via-[#040a07]/70 to-[#040a07]/30" />
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/60 to-transparent" />
        </div>

        {/* Corporate branding header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-400/20 backdrop-blur-md flex items-center justify-center shadow-inner">
            <Sparkles className="text-emerald-400 w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span translate="no" className="notranslate font-bold text-xs uppercase tracking-[0.25em] text-emerald-400 font-manrope">Agricovet Premium</span>
            <p className="text-[10px] text-slate-400">Sistema Veterinario Integral</p>
          </div>
        </div>

        {/* Immersive visual highlights / testimonials inside glassmorphic widget */}
        <div className="relative z-10 my-auto max-w-lg space-y-8 pr-4">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-4"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs text-emerald-400 font-bold backdrop-blur-md">
              <Star size={12} className="fill-emerald-400 text-emerald-400" />
              Gestión Veterinaria de Élite
            </span>
            <h2 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-white font-manrope leading-tight">
              Simplifica tu control <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-[#9ef1f1]">médico y comercial</span> en el campo.
            </h2>
            <p className="text-slate-300 text-base font-medium max-w-md leading-relaxed">
              La herramienta premium diseñada para agroveterinarias con sincronización en tiempo real, administración de cartera, inventarios inteligentes y reportes de rentabilidad móvil.
            </p>
          </motion.div>

          {/* Micro stats widgets for premium feel (Anti-AI-slop / Functional real stats indicators) */}
          <div className="grid grid-cols-2 gap-4">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/[0.02] border border-white/[0.05] p-4 rounded-2xl backdrop-blur-md"
            >
              <div className="text-emerald-400 font-black text-2xl font-hanken">100%</div>
              <div className="text-slate-400 text-xs font-semibold mt-1">Sincronización Offline Segura</div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/[0.02] border border-white/[0.05] p-4 rounded-2xl backdrop-blur-md"
            >
              <span className="inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute top-4 right-4" />
              <div className="text-teal-300 font-black text-2xl font-hanken">Activo</div>
              <div className="text-slate-400 text-xs font-semibold mt-1">Soporte Multidispositivo</div>
            </motion.div>
          </div>
        </div>

        {/* Security / Quality badge footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 border-t border-white/[0.05] pt-6">
          <p>© 2026 <span translate="no" className="notranslate">Agricovet</span>. Todos los derechos reservados.</p>
          <span className="flex items-center gap-1 text-emerald-400/70 font-semibold font-mono text-[10px]">
            <ShieldCheck size={14} /> SECURITY ENCRYPTED
          </span>
        </div>
      </div>

      {/* RIGHT SECTION: PREMIUM CRYSTAL FORM HOVER BOARD */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12 z-10 min-h-screen">
        <div className="w-full max-w-[440px]">
          
          {/* Glass Crystal Container */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 80, damping: 20 }}
            className="w-full backdrop-blur-2xl bg-[#091510]/65 border border-white/[0.08] rounded-3xl p-6 sm:p-9 shadow-[0_30px_70px_rgba(0,0,0,0.7)] relative overflow-hidden"
          >
            {/* Top reflective light line (Simulating hand-polished glass highlights) */}
            <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="absolute -left-[50px] -top-[50px] w-44 h-44 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

            {/* Header / Logo Segment */}
            <div className="text-center mb-8 relative">
              {/* Premium Logo Showcase with Elegant Halo & Soft Reflections */}
              <div className="mx-auto w-24 h-24 mb-5 relative flex items-center justify-center">
                {/* Concentric glass rings */}
                <span className="absolute inset-0 rounded-3xl border border-white/10 bg-white/[0.02] rotate-12 scale-105 pointer-events-none" />
                <span className="absolute inset-0 rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.01] -rotate-6 scale-105 pointer-events-none" />
                
                {/* Glowing Backlight Ring */}
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 blur-lg animate-pulse" />

                {/* Core Photo / Logo frame container */}
                <div className="w-20 h-20 rounded-2xl bg-[#030a07] border border-white/20 backdrop-blur-lg p-2.5 flex items-center justify-center shadow-[inset_0_2px_10px_rgba(255,255,255,0.1)] relative overflow-hidden z-10 group">
                  {/* Subtle reflective glass highlight within the slot */}
                  <div className="absolute -inset-y-1 left-[-100%] w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-30 transition-all duration-1000 group-hover:left-[150%]" />
                  
                  {mode === 'login' ? (
                    <img 
                      src={logoUrl} 
                      alt="Agricovet Logo" 
                      className="w-full h-full object-contain" 
                      onError={(e) => { 
                        e.currentTarget.src = 'https://via.placeholder.com/150?text=Agri'; 
                      }} 
                    />
                  ) : (
                    <img 
                      src={logoUrl} 
                      alt="Agricovet Logo" 
                      className="w-full h-full object-contain" 
                      onError={(e) => { 
                        e.currentTarget.src = LOGO_PLACEHOLDER; 
                      }} 
                    />
                  )}
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <h1 className="text-2xl font-black tracking-tight text-white font-manrope">
                    Bienvenido
                  </h1>
                  <p className="text-slate-400 text-xs font-semibold mt-1">
                    Acceso Seguro Corporativo
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* CORE INTERACTIVE FORMS SECTION */}
            <div className="space-y-6">
              
              {/* MODE 1: LOGIN COMPLAINT FORM */}
              {mode === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-5">
                  
                  {/* Login Identifier block */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Código de Vendedor</label>
                    <div className="relative group/input">
                      <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within/input:text-emerald-400" size={16} />
                      <input
                        type="text"
                        value={sellerCode}
                        onChange={(e) => setSellerCode(e.target.value)}
                        placeholder="Ingresa tu código de 4 dígitos"
                        className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-white/10 focus:border-emerald-500/50 outline-none transition-all bg-white/[0.02] hover:bg-white/[0.04] text-white placeholder-slate-500 text-sm font-semibold focus:ring-4 focus:ring-emerald-500/5"
                        required
                      />
                    </div>
                  </div>

                  {/* Token block */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Token de Acceso</label>
                      <button 
                        type="button"
                        onClick={() => window.open('https://wa.me/50248234048?text=Hola, solicito un token de acceso para Agricovet.', '_blank')}
                        className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-tighter cursor-pointer transition-colors underline decoration-emerald-500/30 underline-offset-2"
                      >
                        Solicitalo a un Admin
                      </button>
                    </div>
                    <div className="relative group/input2">
                      <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within/input2:text-emerald-400" size={16} />
                      <input
                        type="text"
                        value={token}
                        onChange={(e) => setToken(e.target.value.toUpperCase())}
                        placeholder="INGRESA TU TOKEN"
                        className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-white/10 focus:border-emerald-500/50 outline-none transition-all bg-white/[0.02] hover:bg-white/[0.04] text-white placeholder-slate-600 text-sm font-black focus:ring-4 focus:ring-emerald-500/5 tracking-[0.2em]"
                        required
                      />
                    </div>
                  </div>

                  {/* Device Configuration selector (highly integrated visual feedback) */}
                  <div className="space-y-2.5 pt-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Modo de Interfaz</label>
                    <div className="flex bg-[#030806] rounded-xl p-1 border border-white/[0.05]">
                      <button
                        type="button"
                        onClick={() => setDevice('desktop')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all text-xs font-bold ${device === 'desktop' ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-emerald-300 shadow-md' : 'text-slate-400 border border-transparent hover:text-white'}`}
                      >
                        <Monitor size={14} />
                        <span>Escritorio</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDevice('phone')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all text-xs font-bold ${device === 'phone' ? 'bg-gradient-to-r from-[#00696a]/15 to-[#077071]/15 border border-[#00696a]/30 text-teal-300 shadow-md' : 'text-slate-400 border border-transparent hover:text-white'}`}
                      >
                        <Smartphone size={14} />
                        <span>Móvil App</span>
                      </button>
                    </div>
                  </div>

                  {/* Submit loading trigger button with beautiful glowing feedback */}
                  <div className="pt-3">
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-500 hover:via-emerald-600 hover:to-teal-600 text-white font-extrabold rounded-xl transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_25px_rgba(52,211,153,0.15)] focus:ring-4 focus:ring-emerald-500/20 group/btn"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="animate-spin w-4 h-4 text-emerald-200" />
                          <span>Verificando Acceso...</span>
                        </>
                      ) : (
                        <>
                          <span>Ingresar al Sistema</span>
                          <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                        </>
                      )}
                    </motion.button>
                  </div>
                </form>
              )}

              {/* DYNAMIC ERROR BOX with elegant micro-icons */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3.5 bg-red-950/20 border border-red-500/30 text-red-200 text-xs rounded-2xl flex items-start gap-2.5 font-medium animate-in fade-in duration-200">
                      <AlertTriangle className="text-red-400 w-4.5 h-4.5 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>

          </motion.div>

          {/* Subtitle footer elements below the main crystal card on mobile */}
          <div className="text-center mt-6 space-y-1.5 text-slate-500 text-xs select-none">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Base de Datos Conectada: Supabase Cloud</span>
            </div>
            <p className="text-slate-400">Agricovet Cloud Security System</p>
            <p className="opacity-60 text-[10px]">Protegido con encriptación SSL de 256 bits</p>
          </div>

        </div>
      </div>

    </div>
  );
}
