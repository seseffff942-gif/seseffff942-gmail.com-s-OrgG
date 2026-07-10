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

import {StrictMode} from 'react';
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
