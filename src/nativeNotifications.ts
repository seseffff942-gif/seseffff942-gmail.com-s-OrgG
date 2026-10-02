import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from './api';
import { loadNotificationPreferences, shouldDeliverNotification } from './utils/notificationSettings';

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

export async function initNativeNotifications(onNotificationClick?: (data: any) => void, force = false) {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  // If already initialized and not forced, ensure cached token is synced and return
  if (isInitialized && !force) {
    const cachedToken = localStorage.getItem('agricovet_fcm_token');
    if (cachedToken) {
      api.sendFcmToken(cachedToken).catch(() => {});
    }
    return true;
  }

  try {
    // 1. Delete legacy channels if any to ensure clean OS sound bindings
    try {
      await LocalNotifications.deleteChannel({ id: 'agricovet_orders_channel' });
      await LocalNotifications.deleteChannel({ id: 'agricovet_orders_channel_v2' });
      await LocalNotifications.deleteChannel({ id: 'agricovet_orders_channel_v3' });
    } catch (delErr) {}

    // 2. Create Android Notification Channel on both LocalNotifications and PushNotifications
    const channelConfig = {
      id: 'agricovet_orders_channel_v4',
      name: 'Pedidos y Facturación Agricovet',
      description: 'Notificaciones prioritarias con sonido de pedidos y facturas',
      importance: 5 as const, // 5 = High / Heads-up popup
      visibility: 1 as const, // 1 = Public
      sound: 'whatsapp.wav',
      vibration: true,
      lights: true,
      lightColor: '#16a34a',
    };

    try {
      await LocalNotifications.createChannel(channelConfig);
    } catch (chanErr) {
      console.warn('[Native Notifications] Local Channel creation warning:', chanErr);
    }

    try {
      await PushNotifications.createChannel(channelConfig);
    } catch (pushChanErr) {
      console.warn('[Native Notifications] Push Channel creation warning:', pushChanErr);
    }

    // 3. Request Local Notification Permissions (Android 13+)
    try {
      const permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        console.log('[Native Notifications] Local notification permission result:', req.display);
      }
    } catch (permErr) {
      console.warn('[Native Notifications] Permission request error:', permErr);
    }

    // 4. Attach FCM Device Token Registration & Push Listeners BEFORE calling register()
    try {
      if (force) {
        await PushNotifications.removeAllListeners().catch(() => {});
      }

      PushNotifications.addListener('registration', (token) => {
        console.log('[Native Push] FCM Token received:', token.value);
        if (token?.value) {
          localStorage.setItem('agricovet_fcm_token', token.value);
          api.sendFcmToken(token.value).then(() => {
            console.log('[Native Push] ✅ FCM Token registered on server successfully.');
          }).catch((err) => {
            console.warn('[Native Push] ⚠️ Error sending FCM token to server:', err);
          });
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.warn('[Native Push] Registration error:', error);
      });

      // Listen for incoming push notification while app is active
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Native Push] Notification received in foreground:', notification);
        
        let canNotify = true;
        let canPlaySound = true;
        try {
          const userRaw = localStorage.getItem('app_user');
          const userId = userRaw ? JSON.parse(userRaw)?.id : undefined;
          const prefs = loadNotificationPreferences(userId);
          const check = shouldDeliverNotification(
            { type: notification.data?.type, title: notification.title },
            prefs,
            false
          );
          canNotify = check.canNotify;
          canPlaySound = check.canPlaySound;
        } catch (e) {
          const saved = localStorage.getItem('notifications_sounds_enabled');
          canPlaySound = saved === null ? true : saved === 'true';
        }

        if (canNotify) {
          showNativeAlert(
            {
              title: notification.title || (notification.data && notification.data.title) || 'Agricovet',
              body: notification.body || (notification.data && (notification.data.message || notification.data.body)) || '',
              data: notification.data
            },
            { sound: canPlaySound }
          );
        } else {
          console.log('[Native Push] Silenced by user notification schedule/preferences.');
        }
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Native Push] Action performed:', action);
        if (onNotificationClick && action.notification.data) {
          onNotificationClick(action.notification.data);
        }
      });
    } catch (regErr) {
      console.warn('[Native Push] Listener registration error:', regErr);
    }

    // 5. Check Push Permissions & Register with Firebase Cloud Messaging (FCM)
    try {
      const pushPerm = await PushNotifications.checkPermissions();
      if (pushPerm.receive !== 'granted') {
        const req = await PushNotifications.requestPermissions();
        console.log('[Native Push] Permission request result:', req.receive);
      }
      await PushNotifications.register();
      console.log('[Native Push] PushNotifications.register() invoked successfully.');
    } catch (pushErr) {
      console.warn('[Native Push] Push register warning:', pushErr);
    }

    // 6. Proactively sync any previously saved token to the backend
    const cachedToken = localStorage.getItem('agricovet_fcm_token');
    if (cachedToken) {
      api.sendFcmToken(cachedToken).catch(() => {});
    }

    // 7. Listen to Local Notification Action Clicks
    try {
      LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
        console.log('[Native Notifications] Action clicked:', notificationAction);
        if (onNotificationClick && notificationAction.notification.extra) {
          onNotificationClick(notificationAction.notification.extra);
        }
      });
    } catch (locErr) {}

    isInitialized = true;
    console.log('[Native Notifications] Initialized successfully with FCM background push.');
    return true;
  } catch (err) {
    console.error('[Native Notifications] Initialization failed:', err);
    return false;
  }
}

export interface NativeAlertOptions {
  sound?: boolean;
  silent?: boolean;
}

export async function showNativeAlert(
  notification: {
    id?: string | number;
    title: string;
    body: string;
    data?: any;
  },
  options?: NativeAlertOptions
) {
  // If explicitly silenced or app is silenced, bypass completely
  if (options?.silent || (typeof window !== 'undefined' && localStorage.getItem('agricovet_app_silenced') === 'true')) {
    return false;
  }

  // Play in-app audio only if sounds are enabled
  const soundRequested = options?.sound !== false;
  let soundsEnabled = soundRequested;
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('notifications_sounds_enabled');
    if (saved === 'false') {
      soundsEnabled = false;
    }
  }

  if (soundsEnabled) {
    try {
      const audio = new Audio('/whatsapp.wav');
      audio.volume = 1.0;
      audio.play().catch(() => {});
    } catch (e) {}
  }

  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    if (!isInitialized) {
      await initNativeNotifications().catch(() => {});
    }

    const intId = getNumericNotificationId(notification.id);

    await LocalNotifications.schedule({
      notifications: [
        {
          id: intId,
          title: notification.title || '🌱 Agricovet',
          body: notification.body || '',
          largeBody: notification.body || '',
          summaryText: 'Agricovet Alertas',
          channelId: 'agricovet_orders_channel_v4',
          sound: soundsEnabled ? 'whatsapp.wav' : undefined,
          smallIcon: 'ic_stat_notification',
          iconColor: '#10b981',
          extra: notification.data || {},
          actionTypeId: ''
        }
      ]
    });

    console.log('[Native Notifications] Scheduled notification:', intId, notification.title, soundsEnabled ? 'with sound' : 'silent');
    return true;
  } catch (err) {
    console.error('[Native Notifications] Schedule error:', err);
    return false;
  }
}
