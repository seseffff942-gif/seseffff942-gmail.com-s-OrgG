import { AppNotification } from '../types';

export type NotificationMode = 'all' | 'schedule' | 'silent';

export interface NotificationCategories {
  orders: boolean;     // new_order, sale_authorized, sale_rejected
  payments: boolean;   // payment_received
  stock: boolean;      // low_stock, out_of_stock, restock
  prices: boolean;     // price_changed
}

export interface NotificationSchedule {
  enabled: boolean;
  startHour: string;   // e.g. "07:30"
  endHour: string;     // e.g. "18:30"
  days: number[];      // 0 = Dom, 1 = Lun, 2 = Mar, 3 = Mié, 4 = Jue, 5 = Vie, 6 = Sáb
}

export interface UserNotifPreferences {
  mode: NotificationMode;
  muteUntil: number | null; // Unix timestamp in ms
  schedule: NotificationSchedule;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  toastEnabled: boolean;
  categories: NotificationCategories;
}

export const DEFAULT_NOTIF_PREFERENCES: UserNotifPreferences = {
  mode: 'all',
  muteUntil: null,
  schedule: {
    enabled: true,
    startHour: '07:30',
    endHour: '18:30',
    days: [1, 2, 3, 4, 5, 6], // Lunes a Sábado por defecto
  },
  soundEnabled: true,
  vibrationEnabled: true,
  toastEnabled: true,
  categories: {
    orders: true,
    payments: true,
    stock: true,
    prices: true,
  }
};

export function getPreferencesStorageKey(userId?: string | number): string {
  return `agricovet_notif_prefs_${userId || 'guest'}`;
}

export function loadNotificationPreferences(userId?: string | number): UserNotifPreferences {
  if (typeof window === 'undefined') return DEFAULT_NOTIF_PREFERENCES;
  try {
    const key = getPreferencesStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) {
      // Si existe el antiguo flag simple de sonido, sincronizarlo
      const legacySound = localStorage.getItem('notifications_sounds_enabled');
      const soundVal = legacySound !== null ? legacySound === 'true' : true;
      return { ...DEFAULT_NOTIF_PREFERENCES, soundEnabled: soundVal };
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_NOTIF_PREFERENCES,
      ...parsed,
      schedule: {
        ...DEFAULT_NOTIF_PREFERENCES.schedule,
        ...(parsed.schedule || {})
      },
      categories: {
        ...DEFAULT_NOTIF_PREFERENCES.categories,
        ...(parsed.categories || {})
      }
    };
  } catch (e) {
    console.warn('Error loading notification preferences:', e);
    return DEFAULT_NOTIF_PREFERENCES;
  }
}

export function saveNotificationPreferences(userId: string | number | undefined, prefs: UserNotifPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getPreferencesStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(prefs));
    // Sincronizar también con la clave heredada de sonido para compatibilidad
    localStorage.setItem('notifications_sounds_enabled', String(prefs.soundEnabled));
    // Emitir evento para que cualquier componente o pestaña actualice su estado
    window.dispatchEvent(new CustomEvent('agricovet-notif-prefs-changed', { detail: prefs }));
  } catch (e) {
    console.error('Error saving notification preferences:', e);
  }
}

/**
 * Determina si en este momento actual el horario programado permite notificaciones
 */
export function isCurrentlyInsideSchedule(schedule: NotificationSchedule): boolean {
  if (!schedule.enabled) return true;
  const now = new Date();
  const day = now.getDay(); // 0=Dom ... 6=Sab
  if (!schedule.days.includes(day)) {
    return false;
  }

  const [startH, startM] = (schedule.startHour || '07:30').split(':').map(Number);
  const [endH, endM] = (schedule.endHour || '18:30').split(':').map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Horario nocturno que cruza medianoche (ej: 22:00 a 06:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

export interface DeliveryCheckResult {
  canNotify: boolean;       // Si se muestra al usuario (alerta nativa, notificación push/sistema)
  canPlaySound: boolean;    // Si emite audio / timbre WhatsApp
  canShowToast: boolean;    // Si despliega banner flotante
  reason?: string;          // Motivo si fue silenciado
}

/**
 * Evaluación estricta y blindada de si una notificación debe alertar al usuario
 */
export function shouldDeliverNotification(
  notification: AppNotification | { type?: string; title?: string },
  prefs: UserNotifPreferences,
  isGlobalAdminSilent: boolean = false
): DeliveryCheckResult {
  // 1. Silencio Global de Bodega / Admin activo
  if (isGlobalAdminSilent) {
    return {
      canNotify: false,
      canPlaySound: false,
      canShowToast: false,
      reason: 'Silencio global de empresa activo (Admin)'
    };
  }

  // 2. Modo silencio permanente
  if (prefs.mode === 'silent') {
    return {
      canNotify: false,
      canPlaySound: false,
      canShowToast: false,
      reason: 'Modo silencioso activado por el usuario'
    };
  }

  // 3. Silencio temporal con temporizador (Mute Until)
  if (prefs.muteUntil && prefs.muteUntil > Date.now()) {
    const remainingMin = Math.ceil((prefs.muteUntil - Date.now()) / 60000);
    return {
      canNotify: false,
      canPlaySound: false,
      canShowToast: false,
      reason: `Silenciado temporalmente (${remainingMin}m restantes)`
    };
  }

  // 4. Horario Programado
  if (prefs.mode === 'schedule') {
    const inside = isCurrentlyInsideSchedule(prefs.schedule);
    if (!inside) {
      return {
        canNotify: false,
        canPlaySound: false,
        canShowToast: false,
        reason: 'Fuera del horario programado de trabajo'
      };
    }
  }

  // 5. Filtro por categoría
  const type = notification.type || '';
  let categoryAllowed = true;
  if (type === 'new_order' || type === 'sale_authorized' || type === 'sale_rejected') {
    categoryAllowed = prefs.categories.orders;
  } else if (type === 'payment_received') {
    categoryAllowed = prefs.categories.payments;
  } else if (type === 'low_stock' || type === 'out_of_stock' || type === 'restock') {
    categoryAllowed = prefs.categories.stock;
  } else if (type === 'price_changed') {
    categoryAllowed = prefs.categories.prices;
  }

  if (!categoryAllowed) {
    return {
      canNotify: false,
      canPlaySound: false,
      canShowToast: false,
      reason: `Categoría "${type}" desactivada en tus preferencias`
    };
  }

  // Si pasó todos los filtros, está permitido
  return {
    canNotify: true,
    canPlaySound: prefs.soundEnabled,
    canShowToast: prefs.toastEnabled
  };
}

/**
 * Obtiene una descripción amigable del estado de entrega actual
 */
export function getNotificationStatusBadge(
  prefs: UserNotifPreferences,
  isGlobalAdminSilent: boolean = false
): { label: string; sublabel: string; color: 'emerald' | 'amber' | 'rose' | 'slate'; isSilenced: boolean } {
  if (isGlobalAdminSilent) {
    return {
      label: 'Silencio Global',
      sublabel: 'Desactivado para toda la empresa',
      color: 'rose',
      isSilenced: true
    };
  }

  if (prefs.muteUntil && prefs.muteUntil > Date.now()) {
    const remainingMs = prefs.muteUntil - Date.now();
    const hours = Math.floor(remainingMs / 3600000);
    const minutes = Math.ceil((remainingMs % 3600000) / 60000);
    const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    return {
      label: 'Pausado',
      sublabel: `Silenciado por ${timeStr}`,
      color: 'amber',
      isSilenced: true
    };
  }

  if (prefs.mode === 'silent') {
    return {
      label: 'Silenciado',
      sublabel: 'Alertas desactivadas',
      color: 'rose',
      isSilenced: true
    };
  }

  if (prefs.mode === 'schedule') {
    const inside = isCurrentlyInsideSchedule(prefs.schedule);
    if (inside) {
      return {
        label: 'En Horario',
        sublabel: `${prefs.schedule.startHour} - ${prefs.schedule.endHour}`,
        color: 'emerald',
        isSilenced: false
      };
    } else {
      return {
        label: 'Fuera de Horario',
        sublabel: `Reanuda a las ${prefs.schedule.startHour}`,
        color: 'slate',
        isSilenced: true
      };
    }
  }

  return {
    label: prefs.soundEnabled ? 'Alertas Activas' : 'Alertas Sin Sonido',
    sublabel: prefs.soundEnabled ? 'Sonido y avisos 24/7' : 'Solo avisos visuales',
    color: 'emerald',
    isSilenced: false
  };
}
