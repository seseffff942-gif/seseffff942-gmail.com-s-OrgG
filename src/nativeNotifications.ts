import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

let isInitialized = false;

// Convert arbitrary string ID to valid positive 32-bit integer for Android notifications
function getNumericNotificationId(idStr?: string | number): number {
  if (!idStr) return Math.floor(Math.random() * 2000000000);
  if (typeof idStr === 'number') return Math.abs(idStr) % 2000000000;
  
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
    hash = (hash << 5) - hash + idStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2000000000;
}

export async function initNativeNotifications(onNotificationClick?: (data: any) => void) {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  if (isInitialized) {
    return true;
  }

  try {
    // 1. Create Android Notification Channel with custom sound & MAX importance
    try {
      await LocalNotifications.createChannel({
        id: 'agricovet_orders_channel',
        name: 'Pedidos y Facturación Agricovet',
        description: 'Notificaciones prioritarias con sonido de pedidos y facturas',
        importance: 5, // 5 = High / Heads-up popup
        visibility: 1, // 1 = Public
        sound: 'whatsapp.wav',
        vibration: true,
        lights: true,
        lightColor: '#16a34a',
      });
    } catch (chanErr) {
      console.warn('[Native Notifications] Channel creation warning:', chanErr);
    }

    // 2. Request Local Notification Permissions (Android 13+)
    try {
      const permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        console.log('[Native Notifications] Local notification permission result:', req.display);
      }
    } catch (permErr) {
      console.warn('[Native Notifications] Permission request error:', permErr);
    }

    // 3. Listen to Local Notification Action Clicks
    LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
      console.log('[Native Notifications] Action clicked:', notificationAction);
      if (onNotificationClick && notificationAction.notification.extra) {
        onNotificationClick(notificationAction.notification.extra);
      }
    });

    isInitialized = true;
    console.log('[Native Notifications] Initialized successfully for native platform.');
    return true;
  } catch (err) {
    console.error('[Native Notifications] Initialization failed:', err);
    return false;
  }
}

export async function showNativeAlert(notification: {
  id?: string | number;
  title: string;
  body: string;
  data?: any;
}) {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    if (!isInitialized) {
      await initNativeNotifications();
    }

    const intId = getNumericNotificationId(notification.id);

    await LocalNotifications.schedule({
      notifications: [
        {
          id: intId,
          title: notification.title || 'Agricovet',
          body: notification.body || '',
          channelId: 'agricovet_orders_channel',
          sound: 'whatsapp.wav',
          smallIcon: 'ic_launcher',
          iconColor: '#16a34a',
          extra: notification.data || {},
          actionTypeId: '',
          schedule: { at: new Date(Date.now() + 100) }
        }
      ]
    });

    console.log('[Native Notifications] Scheduled notification:', intId, notification.title);
    return true;
  } catch (err) {
    console.error('[Native Notifications] Schedule error:', err);
    return false;
  }
}
