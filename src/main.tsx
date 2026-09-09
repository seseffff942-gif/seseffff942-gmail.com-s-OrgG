// Entry point for the React application - Sync: 2026-06-18

// Safe LocalStorage & SessionStorage fallback polyfill for sandboxed iframe environments
(() => {
  const testStorage = (type: 'localStorage' | 'sessionStorage') => {
    try {
      const storage = window[type];
      if (!storage) return false;
      const testKey = '__storage_test__';
      storage.setItem(testKey, testKey);
      storage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  };

  const createMemoryStorage = () => {
    let store: Record<string, string> = {};
    return {
      getItem(key: string): string | null {
        return key in store ? store[key] : null;
      },
      setItem(key: string, value: string): void {
        store[key] = String(value);
      },
      removeItem(key: string): void {
        delete store[key];
      },
      clear(): void {
        store = {};
      },
      get length(): number {
        return Object.keys(store).length;
      },
      key(index: number): string | null {
        const keys = Object.keys(store);
        return index >= 0 && index < keys.length ? keys[index] : null;
      }
    };
  };

  if (!testStorage('localStorage')) {
    console.warn("localStorage is blocked or unsupported in this context. Using in-memory fallback.");
    try {
      Object.defineProperty(window, 'localStorage', {
        value: createMemoryStorage(),
        writable: true,
        configurable: true
      });
    } catch (e) {
      try {
        (window as any).__proto__.localStorage = createMemoryStorage();
      } catch (err) {}
    }
  }

  if (!testStorage('sessionStorage')) {
    console.warn("sessionStorage is blocked or unsupported in this context. Using in-memory fallback.");
    try {
      Object.defineProperty(window, 'sessionStorage', {
        value: createMemoryStorage(),
        writable: true,
        configurable: true
      });
    } catch (e) {
      try {
        (window as any).__proto__.sessionStorage = createMemoryStorage();
      } catch (err) {}
    }
  }
})();

import React, { StrictMode, Component, ReactNode } from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import * as Sentry from "@sentry/react";

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

// Initialize Sentry conditionally if DSN is provided
const dsn = import.meta.env.VITE_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0, // Capture 100% of the transactions
    // Session Replay
    replaysSessionSampleRate: 0.1, // Sample 10% of sessions
    replaysOnErrorSampleRate: 1.0, // Save replays on errors
  });
} else {
  console.log("[Sentry] No DSN configured in surroundings. SDK tracking is inactive.");
}

// Initialize Google Analytics 4 (GA4) dynamically if Measurement ID is provided
const gaId = import.meta.env.VITE_GA_ID;
if (gaId) {
  const script1 = document.createElement("script");
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(script1);

  const script2 = document.createElement("script");
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function _gtag(){window.dataLayer.push(arguments);}
    window.gtag = _gtag;
    _gtag('js', new Date());
    _gtag('config', '${gaId}', { 'anonymize_ip': true });
  `;
  document.head.appendChild(script2);
  console.log(`[Google Analytics] Dynamic tracker initialized with ID: ${gaId}`);
} else {
  console.log("[Google Analytics] No measurement ID VITE_GA_ID configured. Analytics are inactive.");
}

const isLocalhost = Boolean(
  typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
  )
);

if (import.meta.env.DEV || isLocalhost) {
  // En localhost o desarrollo, desregistrar absolutamente todo Service Worker y vaciar caches
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {});
  }
  if (typeof window !== 'undefined' && 'caches' in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        caches.delete(name);
      }
    }).catch(() => {});
  }
} else {
  try {
    if ("serviceWorker" in navigator) {
      registerSW({ 
        immediate: true,
        onRegisterError(error) {
          console.warn("Service worker registration failed:", error);
        }
      });
    }
  } catch (e) {
    console.warn("Service worker is disabled or failed to register:", e);
  }
}

class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("[Agricovet Root Error]:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', backgroundColor: '#050c09', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', fontFamily: 'sans-serif', color: '#f8fafc' }}>
          <div style={{ backgroundColor: '#0d1f17', border: '1px solid #10b98133', padding: '2rem', borderRadius: '1.5rem', maxWidth: '420px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ width: '3.5rem', height: '3.5rem', backgroundColor: '#10b9811a', color: '#34d399', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.5rem' }}>🌱</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', color: '#ffffff' }}>Agricovet</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              {this.state.error?.message || 'Se ha detectado una actualización en la aplicación.'}
            </p>
            <button 
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.hash = '';
                window.location.reload();
              }}
              style={{ width: '100%', padding: '0.85rem', backgroundColor: '#059669', color: '#ffffff', fontWeight: 700, border: 'none', borderRadius: '0.75rem', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.2s' }}
            >
              🔄 Actualizar y Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
