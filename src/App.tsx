import React, { useState } from 'react';
// Agricovet PWA App - Soporte iOS e Instalación optimizada detectando Standalone
import { User } from './types';
import { Login } from './components/Login';
import { Navigation } from './components/Navigation';
import { InventoryPage } from './pages/InventoryPage';
import { SalesPage } from './pages/SalesPage';
import { BillingPage } from './pages/BillingPage';
import { MySalesPage } from './pages/MySalesPage';
import { TeamPage } from './pages/TeamPage';
import { ClientsPage } from './pages/ClientsPage';
import { SellerDebtsPage } from './pages/SellerDebtsPage';
import { DailySalesPage } from './pages/DailySalesPage';
import { DispatchPage } from './pages/DispatchPage';
import { HomePage } from './pages/HomePage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { BusinessDebtsPage } from './pages/BusinessDebtsPage';
import CreditApplicationPage from './pages/CreditApplicationPage';
import { api } from './api';
import { Download, X, Smartphone, Share, CheckCircle2, HelpCircle } from 'lucide-react';

// ... (in App component) ...

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  React.useEffect(() => {
    if (!navigator.onLine) {
      const cached = localStorage.getItem('app_user');
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch (e) {}
      }
      setAuthLoading(false);
      return;
    }

    api.getMe().then(signedInUser => {
      if (signedInUser) {
        setUser(signedInUser);
        localStorage.setItem('app_user', JSON.stringify(signedInUser));
      } else {
        const cached = localStorage.getItem('app_user');
        if (cached) {
          try {
            setUser(JSON.parse(cached));
          } catch (e) {}
        }
      }
      setAuthLoading(false);
    }).catch(() => {
      const cached = localStorage.getItem('app_user');
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch (e) {}
      }
      setAuthLoading(false);
    });
  }, []);

  const [currentTab, setCurrentTab] = useState<string>(() => {
    const hash = window.location.hash.replace('#', '');
    return hash && ['home', 'inventory', 'sales', 'dispatch', 'billing', 'seller-debts', 'business-debts', 'daily-sales', 'my-sales', 'team', 'clients', 'terms', 'privacy', 'credit-app'].includes(hash.split('?')[0]) ? hash.split('?')[0] : 'home';
  });

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  React.useEffect(() => {
    window.location.hash = currentTab;
  }, [currentTab]);

  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const cleanHash = hash.split('?')[0];
      if (['home', 'inventory', 'sales', 'dispatch', 'billing', 'seller-debts', 'business-debts', 'daily-sales', 'my-sales', 'team', 'clients', 'terms', 'privacy', 'credit-app'].includes(cleanHash)) {
        setCurrentTab(cleanHash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  React.useEffect(() => {
    if (user?.email === 'limalopez22@gmail.com' && currentTab === 'team') {
      setCurrentTab('home');
    }
  }, [user, currentTab]);

  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSInstallHelper, setShowIOSInstallHelper] = useState(false);
  const [showGeneralInstallHelper, setShowGeneralInstallHelper] = useState(false);

  React.useEffect(() => {
    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Detect standalone mode (already installed on homescreen)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Prompt iOS users after 3 seconds if they haven't dismissed it previously
    if (ios && !standalone) {
      const dismissed = localStorage.getItem('agricovet_pwa_ios_dismissed');
      if (!dismissed) {
        const timer = setTimeout(() => {
          setShowIOSInstallHelper(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const [device, setDevice] = useState<'desktop' | 'phone'>(() => {
    const saved = localStorage.getItem('app_device');
    return (saved as 'desktop' | 'phone') || 'desktop';
  });

  const [isMobileScreen, setIsMobileScreen] = useState(window.innerWidth < 768);
  React.useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogin = (loggedInUser: User, selectedDevice: 'desktop' | 'phone') => {
    setUser(loggedInUser);
    setDevice(selectedDevice);
    localStorage.setItem('app_user', JSON.stringify(loggedInUser));
    localStorage.setItem('app_device', selectedDevice);
    setCurrentTab('home'); // default view
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('app_user');
    localStorage.removeItem('app_device');
    localStorage.removeItem('app_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_token');
  };

  const returnToAdmin = () => {
    const adminToken = localStorage.getItem('admin_token');
    const adminUser = localStorage.getItem('admin_user');
    
    if (adminToken && adminUser) {
      localStorage.setItem('app_token', adminToken);
      localStorage.setItem('app_user', adminUser);
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/';
    }
  };

  const handleImpersonate = async (targetUser: User | null) => {
    if (!targetUser) return;
    try {
      await api.impersonate(targetUser.id);
      window.location.href = '/';
    } catch (err) {
      console.error("Error al suplantar:", err);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-teal-600">Verificando sesión...</div>;
  }

  if (!isOffline && !user) {
    return <Login onLogin={handleLogin} />;
  }

  const activeUser = user || {
    id: 'offline-guest',
    name: 'Usuario Offline',
    email: 'offline@agricovet.com',
    role: 'seller'
  };

  const isMobile = device === 'phone' || isMobileScreen;
  const isImpersonating = !!localStorage.getItem('admin_token');

  const appContent = (
    <div className={`flex flex-col min-h-screen bg-surface font-sans h-screen overflow-hidden`}>
      {isOffline && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium text-xs md:text-sm px-4 py-2.5 flex items-center justify-between shadow-md z-50">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
            <span>Sin conexión a internet. Cambios se guardarán de forma local.</span>
          </span>
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0">Modo Offline</span>
        </div>
      )}
      {isImpersonating && (
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold text-[10px] md:text-xs px-4 py-1.5 flex items-center justify-between shadow-lg z-[60] animate-in slide-in-from-top duration-300 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <p>Sesión de Suplantación Activa: <span className="uppercase">{user?.name}</span> ({user?.email})</p>
          </div>
          <button 
            onClick={returnToAdmin}
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-[10px] transition-all active:scale-95 cursor-pointer uppercase tracking-tighter"
          >
            Volver a mi Admin
          </button>
        </div>
      )}
      <Navigation 
        user={user!} 
        activeUser={activeUser as User}
        currentTab={currentTab} 
        onChangeTab={setCurrentTab} 
        onLogout={handleLogout} 
        onReturnToAdmin={returnToAdmin}
        onImpersonate={handleImpersonate}
        isMobile={isMobile}
        showInstallButton={!isStandalone}
        onShowInstallGuide={() => {
          if (isIOS) {
            setShowIOSInstallHelper(true);
          } else if (deferredPrompt) {
            handleInstallClick();
          } else {
            setShowGeneralInstallHelper(true);
          }
        }}
      />
      <main className={`flex-1 overflow-auto relative md:ml-[260px] md:pt-16`}>
        {currentTab === 'home' && <HomePage user={activeUser as User} onChangeTab={setCurrentTab} onLogout={handleLogout} isMobile={isMobile} />}
        {currentTab === 'dispatch' && activeUser.role === 'admin' && <DispatchPage user={activeUser as User} isMobile={isMobile} />}
        {currentTab === 'inventory' && <InventoryPage user={activeUser as User} isMobile={isMobile} />}
        {currentTab === 'sales' && <SalesPage user={activeUser as User} isMobile={isMobile} />}
        {currentTab === 'billing' && <BillingPage user={activeUser as User} isMobile={isMobile} />}
        {currentTab === 'my-sales' && <MySalesPage user={activeUser as User} isMobile={isMobile} />}
        {currentTab === 'daily-sales' && <DailySalesPage user={activeUser as User} isMobile={isMobile} />}
        {currentTab === 'seller-debts' && <SellerDebtsPage user={activeUser as User} isMobile={isMobile} />}
        {currentTab === 'business-debts' && <BusinessDebtsPage user={activeUser as User} />}
        {currentTab === 'clients' && <ClientsPage user={activeUser as User} isMobile={isMobile} />}
        {currentTab === 'team' && <TeamPage user={user!} isMobile={isMobile} />}
        {currentTab === 'terms' && <TermsPage user={activeUser as User} isMobile={isMobile} />}
        {currentTab === 'privacy' && <PrivacyPage user={activeUser as User} isMobile={isMobile} />}
        {currentTab === 'credit-app' && <CreditApplicationPage />}
        
        {/* Floating Download Button (Android & Desktop Chrome support) */}
        {deferredPrompt && (
          <button 
            onClick={handleInstallClick} 
            className="fixed top-4 right-4 z-50 bg-[#00696a] text-white px-4 py-2 rounded-full shadow-lg hover:bg-[#004f50] flex items-center space-x-2 transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            <Download size={18} />
            <span className="font-bold text-sm font-manrope">Descargar App</span>
          </button>
        )}

        {/* Floating Download Button (iOS Safari support) */}
        {isIOS && !isStandalone && (
          <button 
            onClick={() => setShowIOSInstallHelper(true)} 
            className="fixed bottom-20 md:top-4 right-4 z-40 bg-[#00696a] text-white px-4 py-2.5 rounded-full shadow-lg hover:bg-[#004f50] flex items-center space-x-2 transition-all cursor-pointer hover:scale-105 active:scale-95 animate-bounce"
            style={{ animationDuration: '3s' }}
          >
            <Download size={18} />
            <span className="font-bold text-sm font-manrope">Instalar App (iOS)</span>
          </button>
        )}

        {/* MODAL DE INSTALACIÓN PARA iOS */}
        {showIOSInstallHelper && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
              <div className="p-6 relative">
                <button 
                  onClick={() => setShowIOSInstallHelper(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 bg-slate-50 rounded-full cursor-pointer"
                >
                  <X size={18} />
                </button>

                <div className="flex items-center gap-3.5 mb-5 mt-2">
                  <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center border border-teal-100 shadow-sm shrink-0">
                    <img src="/agricovet.png" alt="Agricovet App" className="w-9 h-9 object-contain" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 leading-tight">Instalar Agricovet App</h3>
                    <p className="text-xs text-teal-600 font-bold mt-0.5">Acceso rápido • Soporte Offline</p>
                  </div>
                </div>

                <div className="space-y-4 text-slate-650 text-sm mb-6">
                  <p className="text-slate-500 text-xs">
                    Sigue estas simples instrucciones para añadir Agricovet a tu iPhone o iPad como una aplicación nativa.
                  </p>

                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex gap-3">
                    <span className="w-6 h-6 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">1</span>
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-800 leading-none">
                        Abre en Safari
                      </span>
                      <p className="text-xs text-slate-500">
                        Asegúrate de estar navegando desde el navegador <strong className="text-slate-700">Safari</strong> de Apple.
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex gap-3">
                    <span className="w-6 h-6 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">2</span>
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-800 leading-none">
                        Toca el botón Compartir
                      </span>
                      <p className="text-xs text-slate-500">
                        Toca el icono de Compartir (un cuadro con una flecha apuntando arriba <Share size={12} className="inline text-teal-600" />) en Safari.
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex gap-3">
                    <span className="w-6 h-6 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">3</span>
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-800 leading-none">
                        Selecciona "Agregar al inicio"
                      </span>
                      <p className="text-xs text-slate-500">
                        En las opciones, desplázate y pulsa <strong className="text-slate-700">"Agregar al inicio"</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex gap-3">
                    <span className="w-6 h-6 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">4</span>
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-800 leading-none">
                        Confirma la adición
                      </span>
                      <p className="text-xs text-slate-500">
                        Presiona <strong className="text-[#00696a]">"Agregar"</strong> arriba a la derecha y ¡listo!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => setShowIOSInstallHelper(false)}
                    className="flex-1 py-2.5 px-4 rounded-xl font-bold text-white bg-[#00696a] hover:bg-[#004f50] transition-colors cursor-pointer text-center text-xs shadow-md"
                  >
                    Entendido, ¡lo haré!
                  </button>
                  <button
                    onClick={() => {
                      localStorage.setItem('agricovet_pwa_ios_dismissed', 'true');
                      setShowIOSInstallHelper(false);
                    }}
                    className="py-2.5 px-4 rounded-xl font-bold text-slate-500 hover:text-slate-750 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-center text-xs"
                  >
                    No volver a mostrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE INSTALACIÓN GENERAL */}
        {showGeneralInstallHelper && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
              <div className="p-6 relative">
                <button 
                  onClick={() => setShowGeneralInstallHelper(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 p-1 bg-slate-50 rounded-full cursor-pointer"
                >
                  <X size={18} />
                </button>

                <div className="text-center mb-5 mt-2">
                  <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                    <Download size={28} className="text-[#00696a]" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Descargar Agricovet</h3>
                  <p className="text-xs text-slate-500 mt-1">Sigue el proceso desde tu navegador</p>
                </div>

                <ul className="space-y-4 mb-6 text-xs text-slate-600">
                  <li className="flex gap-3">
                    <CheckCircle2 size={16} className="text-teal-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-800 block font-bold">1. Menú del navegador</strong>
                      <span className="text-slate-500">Toca los tres puntos de opciones (generalmente arriba a la derecha).</span>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 size={16} className="text-teal-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-800 block font-bold">2. Agregar/Instalar</strong>
                      <span className="text-slate-500">Busca la opción "Instalar aplicación" o "Agregar a pantalla principal".</span>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 size={16} className="text-teal-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-800 block font-bold">3. Confirmar</strong>
                      <span className="text-slate-500">Acepta la instalación para crear un icono de acceso directo en tu dispositivo.</span>
                    </div>
                  </li>
                </ul>

                <button
                  onClick={() => setShowGeneralInstallHelper(false)}
                  className="w-full py-2.5 rounded-xl font-bold text-white bg-[#00696a] hover:bg-[#004f50] transition-colors cursor-pointer text-center text-xs shadow-md"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );

  return appContent;
}

