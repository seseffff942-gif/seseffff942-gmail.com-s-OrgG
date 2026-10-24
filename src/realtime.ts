import { io, Socket } from 'socket.io-client';
import { clearApiCache } from './api';
import { Capacitor } from '@capacitor/core';

let socket: Socket | null = null;
let isInitialized = false;

export const getRealtimeServerUrl = (): string => {
  if (typeof window === 'undefined') return '';

  const customUrl = localStorage.getItem('app_custom_api_url');
  if (customUrl && customUrl.trim() !== '') {
    return customUrl.trim().replace(/\/$/, '');
  }

  const isCapacitorNative = Capacitor.isNativePlatform();
  const isLocalOriginWithoutDevPort = (
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && (!window.location.port || window.location.port === '80' || window.location.port === '443')) ||
    (window.location.origin.includes('localhost') && (!window.location.port || window.location.port === '80' || window.location.port === '443'))
  );

  if (isCapacitorNative || isLocalOriginWithoutDevPort) {
    return (import.meta.env.VITE_API_URL || 'https://agricovet.lat').replace(/\/$/, '');
  }

  return window.location.origin;
};

export const initRealtime = (): Socket | null => {
  if (typeof window === 'undefined') return null;
  if (socket && socket.connected) return socket;
  if (isInitialized && socket) return socket;

  const serverUrl = getRealtimeServerUrl();
  console.log('[Realtime] 🔌 Inicializando conexión WebSocket con:', serverUrl);

  try {
    socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      forceNew: false
    });

    isInitialized = true;

    socket.on('connect', () => {
      console.log('[Realtime] ✅ Conectado en tiempo real al servidor ID:', socket?.id);
      window.dispatchEvent(new CustomEvent('agricovet-socket-status', { detail: { connected: true, id: socket?.id } }));
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Realtime] ⚠️ Conexión WebSocket desconectada. Razón:', reason);
      window.dispatchEvent(new CustomEvent('agricovet-socket-status', { detail: { connected: false, reason } }));
    });

    socket.on('connect_error', (err) => {
      // Fallback silencioso sin spamear error en UI
      console.warn('[Realtime] Conexión en reintento automático:', err.message);
    });

    // Evento de sincronización de entidades de datos (ventas, inventario, clientes, etc.)
    socket.on('sync', (payload: { entity: string; data?: any; timestamp?: number }) => {
      const entity = payload?.entity;
      if (!entity) return;

      console.log(`[Realtime] ⚡ Evento recibido: '${entity}' modificado en el servidor`);
      
      // 1. Limpiar caché en memoria de esa entidad
      clearApiCache(entity);

      // 2. Disparar evento global para que las páginas activas se actualicen de inmediato
      window.dispatchEvent(new CustomEvent('agricovet-mutate', {
        detail: {
          key: entity,
          data: payload?.data,
          timestamp: payload?.timestamp || Date.now(),
          fromRealtime: true
        }
      }));
    });

    // Evento de notificaciones instantáneas
    socket.on('notification', (ntf: any) => {
      console.log('[Realtime] 🔔 Nueva notificación en tiempo real:', ntf?.title);
      
      // Limpiar caché de notificaciones
      clearApiCache('notifications');

      // Disparar evento para banner y alerta sonora
      window.dispatchEvent(new CustomEvent('agricovet-notification', {
        detail: ntf
      }));

      // Disparar evento general de mutación
      window.dispatchEvent(new CustomEvent('agricovet-mutate', {
        detail: {
          key: 'notifications',
          data: ntf,
          fromRealtime: true
        }
      }));
    });

    // Manejar reconexión cuando la pantalla vuelve o el celular recupera señal
    const handleRecheck = () => {
      if (socket && !socket.connected) {
        socket.connect();
      }
      // Al volver, disparar un refresco global preventivo
      window.dispatchEvent(new CustomEvent('agricovet-mutate', { detail: { key: 'all', fromResume: true } }));
    };

    window.addEventListener('online', handleRecheck);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) handleRecheck();
    });

    return socket;
  } catch (err) {
    console.error('[Realtime] Error inicializando Socket.IO:', err);
    return null;
  }
};

export const getRealtimeSocket = (): Socket | null => {
  if (!socket) return initRealtime();
  return socket;
};
