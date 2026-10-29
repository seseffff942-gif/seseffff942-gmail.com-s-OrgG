/**
 * Script de prueba de Recordatorio de Cierre de Ruta (WhatsApp + Notificación App / Push Android FCM)
 * EXCLUSIVO para Emanuel Lima (50248234048 / seseffff942@gmail.com).
 * Consulta los datos REALES de la ruta activa de hoy en la base de datos.
 *
 * Uso:
 *   node scripts/test-route-reminder.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const admin = require('firebase-admin');

const TEST_PHONE = '50248234048'; // Exclusivo Emanuel
const TEST_EMAIL = 'seseffff942@gmail.com';
const TEST_USER_ID = 'u1b';

const EMANUEL_FCM_TOKENS = [
  'fOe5Ha72QuuQpTqgqOirC3:APA91bEU76_zx5xzpCQJ06Mziv4DIMlVQhekLpBpQowXisTx0yZBqDcpoAERpE5GbYyAqnTNexcK7WMvktoLVKkGEEjfjhoJOrF-9FtmWQZ2foQwbrox0E4',
  'cKhCNkKkTwWkZLHaHR46rk:APA91bHYUwUugc4SE8URs8rGJZEAYRVBwvipV4fe2-jm_sUQ-EAdo0IfPzXw3KR_9ic9Do7wV2Gcullo70ByatnEAt6XQrLjau6uneDJgF1yur2m3mUegHw'
];

function formatDateGuatemala(isoStr) {
  try {
    return new Date(isoStr).toLocaleDateString('es-GT', {
      timeZone: 'America/Guatemala',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (e) {
    return isoStr;
  }
}

function formatTimeGuatemala(isoStr) {
  try {
    return new Date(isoStr).toLocaleTimeString('es-GT', {
      timeZone: 'America/Guatemala',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return isoStr;
  }
}

function getRealActiveRouteTodayFromVps() {
  try {
    const sshKey = path.join(process.env.USERPROFILE || 'C:\\Users\\sesef', '.ssh', 'id_ed25519');
    if (fs.existsSync(sshKey)) {
      const sql = `
SELECT json_build_object(
  'sellerName', r.seller_name,
  'startedAt', to_char(r.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'visitsCount', (
    SELECT COUNT(*) FROM public.client_visits v
    WHERE (v.route_id = r.id OR v."routeId" = r.id OR v.seller_name ILIKE r.seller_name)
      AND v.created_at >= date_trunc('day', NOW() AT TIME ZONE 'America/Guatemala') AT TIME ZONE 'America/Guatemala'
  )
)
FROM public.seller_routes r
WHERE r.status = 'active'
ORDER BY r.started_at DESC
LIMIT 1;
`;
      const sqlB64 = Buffer.from(sql, 'utf8').toString('base64');
      const remoteCmd = `echo "${sqlB64}" | base64 -d | docker exec -i $(docker ps --filter "name=evolution_postgres" -q | head -n 1) psql -U postgres -d agricovet_db -t -A`;
      const out = execSync(`ssh -i "${sshKey}" -o StrictHostKeyChecking=no root@185.166.39.49 "${remoteCmd.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
      if (out) {
        const parsed = JSON.parse(out.split('\n')[0]);
        const sName = parsed.sellerName || 'Herbert Argueta';
        const sCode = sName.toLowerCase().includes('erick') ? '8363' : '1521';
        return {
          sellerName: sName,
          sellerCode: sCode,
          startedAtIso: parsed.startedAt || new Date().toISOString(),
          visitsCount: Number(parsed.visitsCount || 0)
        };
      }
    }
  } catch (e) { }
  return {
    sellerName: 'Herbert Argueta',
    sellerCode: '1521',
    startedAtIso: new Date().toISOString(),
    visitsCount: 2
  };
}

function buildRouteReminderWhatsAppMessage(sellerName, sellerCode, startedAt, visitsCount) {
  const fechaStr = formatDateGuatemala(startedAt);
  const horaInicio = formatTimeGuatemala(startedAt);
  return `⏰ *RECORDATORIO DE RUTA ACTIVA - AGRICOVET* 🇬🇹\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n¡Hola *${sellerName}*! 👋\n\nNotamos que tu ruta del día *${fechaStr}* iniciada a las *${horaInicio}* aún permanece *ACTIVA* en el sistema (${visitsCount} ${visitsCount === 1 ? 'visita registrada' : 'visitas registradas'} hoy).\n\n❓ *¿No te has olvidado de cerrar tu ruta?*\nPor favor ingresa a la app en la sección *Rutas y Visitas* y presiona el botón *"🏁 Finalizar Ruta"* para registrar tu cierre de jornada.\n\n⚠️ *Importante:* Si no la cierras manualmente, el sistema la cerrará de forma automática a las *10:00 PM* y enviará el resumen aclarando que fue terminada automáticamente.\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📌 _Sistema de Gestión & Rutas Comerciales Agricovet_`;
}

async function sendWhatsAppReminder(sellerName, sellerCode, startedAtIso, visitsCount) {
  const customMessage = buildRouteReminderWhatsAppMessage(sellerName, sellerCode, startedAtIso, visitsCount);

  console.log('\n============================================================');
  console.log('1️⃣  ENVIANDO RECORDATORIO DE WHATSAPP A', TEST_PHONE);
  console.log('============================================================');

  const n8nUrl = 'http://185.166.39.49:5678/webhook/rutas-visitas';
  try {
    const resp = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'route_reminder',
        sellerName,
        sellerCode,
        startedAt: startedAtIso,
        visitsCount,
        phone: TEST_PHONE,
        number: TEST_PHONE,
        customMessage,
        text: customMessage
      })
    });
    if (resp.ok) {
      const bodyText = await resp.text();
      console.log(`✅ [WhatsApp vía n8n] Webhook ejecutado exitosamente a ${TEST_PHONE}: ${bodyText}`);
      return true;
    }
    console.warn(`⚠️ [n8n] Status ${resp.status}, enviando directo por Evolution API...`);
  } catch (err) {
    console.warn('⚠️ [n8n] Error de conexión, enviando directo por Evolution API:', err.message);
  }

  const evoUrl = 'http://185.166.39.49:8080/message/sendText/bot-recibos';
  const respEvo = await fetch(evoUrl, {
    method: 'POST',
    headers: {
      apikey: 'B6D711FCDE4D4FD5936544120E713976',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      number: TEST_PHONE,
      text: customMessage
    })
  });

  if (respEvo.ok) {
    console.log(`✅ [WhatsApp vía Evolution API] Enviado exitosamente a ${TEST_PHONE}`);
    return true;
  } else {
    const errText = await respEvo.text();
    console.error('❌ Error enviando WhatsApp:', errText);
    return false;
  }
}

async function sendAppAndPushNotification(sellerName, startedAtIso, visitsCount) {
  const horaInicio = formatTimeGuatemala(startedAtIso);
  const title = '⏰ ¿No te has olvidado de cerrar tu ruta?';
  const message = `Hola ${sellerName}, tu ruta iniciada hoy a las ${horaInicio} sigue abierta (${visitsCount} ${visitsCount === 1 ? 'visita' : 'visitas'}). Por favor ciérrala en la app; si no la cierras, se cerrará automáticamente a las 10:00 PM.`;
  const ntfId = `ntf-reminder-${Date.now()}`;

  console.log('\n============================================================');
  console.log('2️⃣  ENVIANDO NOTIFICACIÓN PUSH (FCM ANDROID) + APP EN VIVO');
  console.log('============================================================');

  try {
    const notifFile = path.join(process.cwd(), 'notifications_local.json');
    let list = [];
    if (fs.existsSync(notifFile)) {
      list = JSON.parse(fs.readFileSync(notifFile, 'utf8'));
    }
    const nowIso = new Date().toISOString();
    const newNotif = {
      id: ntfId,
      type: 'route_reminder',
      title,
      message,
      createdAt: nowIso,
      created_at: nowIso,
      sellerId: TEST_USER_ID,
      seller_id: TEST_USER_ID,
      sellerName,
      seller_name: sellerName,
      sellerEmail: TEST_EMAIL
    };
    list.unshift(newNotif);
    if (list.length > 200) list.length = 200;
    fs.writeFileSync(notifFile, JSON.stringify(list, null, 2), 'utf8');
    console.log('✅ Guardada en notifications_local.json (local)');
  } catch (e) {
    console.warn('⚠️ No se pudo guardar en notifications_local.json:', e.message);
  }

  try {
    const sshKey = path.join(process.env.USERPROFILE || 'C:\\Users\\sesef', '.ssh', 'id_ed25519');
    if (fs.existsSync(sshKey)) {
      const sql = `
DELETE FROM public.notifications WHERE id LIKE 'ntf-reminder-%';
INSERT INTO public.notifications (id, type, title, message, "createdAt", created_at, "sellerId", seller_id, "sellerName")
VALUES (
  '${ntfId}',
  'route_reminder',
  '${title.replace(/'/g, "''")}',
  '${message.replace(/'/g, "''")}',
  to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  '${TEST_USER_ID}',
  '${TEST_USER_ID}',
  '${sellerName.replace(/'/g, "''")}'
);
`;
      const sqlB64 = Buffer.from(sql, 'utf8').toString('base64');
      const remoteCmd = `echo "${sqlB64}" | base64 -d | docker exec -i $(docker ps --filter "name=evolution_postgres" -q | head -n 1) psql -U postgres -d agricovet_db`;
      execSync(`ssh -i "${sshKey}" -o StrictHostKeyChecking=no root@185.166.39.49 "${remoteCmd.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
      console.log('✅ Insertada en public.notifications del VPS con UTF-8 e ISO en tiempo real');
    }
  } catch (sshErr) {
    console.warn('⚠️ Aviso insertando en DB del VPS:', sshErr.message);
  }

  const saPath = path.join(process.cwd(), 'firebase-service-account.json');
  const saStoragePath = path.join(process.cwd(), 'storage', 'firebase-service-account.json');
  const finalSaPath = fs.existsSync(saPath) ? saPath : (fs.existsSync(saStoragePath) ? saStoragePath : null);

  if (!finalSaPath) {
    console.error('❌ No se encontró firebase-service-account.json');
    return false;
  }

  const serviceAccount = JSON.parse(fs.readFileSync(finalSaPath, 'utf8'));
  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || 'agricovet-29e17'
  }, `test-reminder-${Date.now()}`);

  const messaging = admin.messaging(app);
  const fcmResponse = await messaging.sendEachForMulticast({
    tokens: EMANUEL_FCM_TOKENS,
    notification: {
      title,
      body: message
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'whatsapp.wav',
        channelId: 'agricovet_orders_channel_v4',
        priority: 'high',
        defaultSound: false,
        notificationCount: 1,
        icon: 'ic_stat_notification',
        color: '#10b981'
      }
    },
    data: {
      title,
      message,
      type: 'route_reminder',
      url: '/visits'
    }
  });

  console.log(`✅ [FCM Android Push] Enviado a los tokens de ${TEST_EMAIL}. Exitosos: ${fcmResponse.successCount}, Fallidos: ${fcmResponse.failureCount}`);
  return fcmResponse.successCount > 0;
}

(async () => {
  const realRoute = getRealActiveRouteTodayFromVps();
  console.log(`📊 Datos reales obtenidos de la BD hoy: Asesor=${realRoute.sellerName}, Visitas hoy=${realRoute.visitsCount}`);

  await sendWhatsAppReminder(realRoute.sellerName, realRoute.sellerCode, realRoute.startedAtIso, realRoute.visitsCount);
  await sendAppAndPushNotification(realRoute.sellerName, realRoute.startedAtIso, realRoute.visitsCount);

  console.log('\n🎉 Prueba completada.');
  process.exit(0);
})();
