# -*- coding: utf-8 -*-
import sys

with open("server.ts", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update closeActiveRouteAndNotify options type to include skipWhatsApp
target1 = """async function closeActiveRouteAndNotify(
  routeInput: any,
  options?: {
    isAutoClosed?: boolean;
    finishedAtIso?: string;
    endLat?: number | null;
    endLng?: number | null;
    notes?: string;
    isTest?: boolean;
  }
) {"""

replace1 = """async function closeActiveRouteAndNotify(
  routeInput: any,
  options?: {
    isAutoClosed?: boolean;
    finishedAtIso?: string;
    endLat?: number | null;
    endLng?: number | null;
    notes?: string;
    isTest?: boolean;
    skipWhatsApp?: boolean;
  }
) {"""

if target1 not in content:
    print("Error: target1 not found")
    sys.exit(1)
content = content.replace(target1, replace1)

# 2. In closeActiveRouteAndNotify, honor skipWhatsApp
target2 = """  if (ROUTE_WHATSAPP_AUTO_ENABLED) {"""
replace2 = """  if (ROUTE_WHATSAPP_AUTO_ENABLED && !options?.skipWhatsApp) {"""

idx_fn = content.find("async function closeActiveRouteAndNotify")
idx_target2 = content.find(target2, idx_fn)
if idx_target2 == -1:
    print("Error: target2 not found inside closeActiveRouteAndNotify")
    sys.exit(1)
content = content[:idx_target2] + replace2 + content[idx_target2 + len(target2):]

# 3. In checkActiveRoutesForRemindersAndAutoClosure, pass skipWhatsApp: true for stale routes
target3 = """          console.log(`[AUTO-ROUTE-CRON] 🏁 Cerrando automáticamente ruta rezagada de ${route.sellerName} (${route.id}) de fecha ${routeDateStr}`);
          await closeActiveRouteAndNotify(route, {
            isAutoClosed: true,
            finishedAtIso: getGuatemala10PmIsoForDate(routeDateStr)
          });"""

replace3 = """          console.log(`[AUTO-ROUTE-CRON] 🏁 Cerrando automáticamente ruta rezagada de ${route.sellerName} (${route.id}) de fecha ${routeDateStr}`);
          await closeActiveRouteAndNotify(route, {
            isAutoClosed: true,
            finishedAtIso: getGuatemala10PmIsoForDate(routeDateStr),
            skipWhatsApp: true // No enviar a las 6 o 7 AM del día siguiente resumen de días pasados
          });"""

if target3 not in content:
    print("Error: target3 not found")
    sys.exit(1)
content = content.replace(target3, replace3)

# 4. In /api/routes/start, check Postgres for active route today first, and pass skipWhatsApp: true if closing stale route
target4 = """  const routes = readLocalRoutes();
  // Check if an active route already exists
  const existingActive = routes.find((r: any) => {
    if (r.status !== 'active') return false;
    const rSellerId = String(r.sellerId || r.seller_id || '').trim();
    const rSellerEmail = String(r.sellerEmail || r.seller_email || '').trim().toLowerCase();
    return (userId && rSellerId === userId) || (userEmail && rSellerEmail === userEmail);
  });

  if (existingActive) {
    const existingDate = getGuatemalaDateString(existingActive.startedAt || existingActive.createdAt);
    const todayDate = getGuatemalaDateString();
    if (existingDate !== todayDate) {
      try {
        await closeActiveRouteAndNotify(existingActive, {
          isAutoClosed: true,
          finishedAtIso: getGuatemala10PmIsoForDate(existingDate)
        });
      } catch (e) { }
    } else {
      if ((existingActive.startLatitude == null || existingActive.startLongitude == null) && startLatitude && startLongitude) {
        existingActive.startLatitude = parseFloat(startLatitude);
        existingActive.startLongitude = parseFloat(startLongitude);
        saveLocalRoutes(routes);
        if (neonPool) {
          try {
            await neonPool.query(`
              UPDATE public.seller_routes 
              SET start_latitude = $1, "startLatitude" = $1,
                  start_longitude = $2, "startLongitude" = $2
              WHERE id = $3;
            `, [existingActive.startLatitude, existingActive.startLongitude, existingActive.id]);
          } catch (e) { }
        }
      }
      return res.json({ success: true, message: "Ya tienes una ruta activa en curso.", route: existingActive });
    }
  }"""

replace4 = """  // Check if an active route already exists (Consultar PostgreSQL primero y luego local)
  let existingActive: any = null;
  if (neonPool) {
    try {
      const dbActive = await neonPool.query(`
        SELECT * FROM public.seller_routes 
        WHERE status = 'active'
          AND (
            ($1 <> '' AND (seller_id = $1 OR "sellerId" = $1)) OR
            ($2 <> '' AND (seller_email ILIKE $2 OR "sellerEmail" ILIKE $2))
          )
        ORDER BY COALESCE(started_at, created_at) DESC
        LIMIT 1;
      `, [userId, userEmail]);
      if (dbActive.rows && dbActive.rows.length > 0) {
        existingActive = dbActive.rows[0];
      }
    } catch (e) { }
  }

  const routes = readLocalRoutes();
  if (!existingActive) {
    existingActive = routes.find((r: any) => {
      if (r.status !== 'active') return false;
      const rSellerId = String(r.sellerId || r.seller_id || '').trim();
      const rSellerEmail = String(r.sellerEmail || r.seller_email || '').trim().toLowerCase();
      return (userId && rSellerId === userId) || (userEmail && rSellerEmail === userEmail);
    });
  }

  if (existingActive) {
    const existingDate = getGuatemalaDateString(existingActive.started_at || existingActive.startedAt || existingActive.created_at || existingActive.createdAt);
    const todayDate = getGuatemalaDateString();
    if (existingDate !== todayDate) {
      try {
        await closeActiveRouteAndNotify(existingActive, {
          isAutoClosed: true,
          finishedAtIso: getGuatemala10PmIsoForDate(existingDate),
          skipWhatsApp: true // No enviar a las 6 o 7 AM del día siguiente resumen de días pasados
        });
      } catch (e) { }
    } else {
      if ((existingActive.startLatitude == null || existingActive.startLongitude == null) && startLatitude && startLongitude) {
        existingActive.startLatitude = parseFloat(startLatitude);
        existingActive.startLongitude = parseFloat(startLongitude);
        saveLocalRoutes(routes);
        if (neonPool) {
          try {
            await neonPool.query(`
              UPDATE public.seller_routes 
              SET start_latitude = $1, "startLatitude" = $1,
                  start_longitude = $2, "startLongitude" = $2
              WHERE id = $3;
            `, [existingActive.startLatitude, existingActive.startLongitude, existingActive.id]);
          } catch (e) { }
        }
      }
      console.log(`[Start Route] Asesor ${userName} ya cuenta con una jornada activa de hoy (${existingActive.id}). Reutilizando para evitar duplicados.`);
      return res.json({ success: true, message: "Ya tienes una ruta activa en curso.", route: existingActive });
    }
  }"""

if target4 not in content:
    print("Error: target4 not found")
    sys.exit(1)
content = content.replace(target4, replace4)

# 5. In /api/routes/start, change insert to upsert on localDb
target5 = """  // 2. Persist in LocalDb
  try {
    await localDb.from("seller_routes").insert([{
      id: newRoute.id,
      seller_id: newRoute.sellerId,
      seller_name: newRoute.sellerName,
      seller_email: newRoute.sellerEmail,
      status: newRoute.status,
      started_at: newRoute.startedAt,
      start_latitude: newRoute.startLatitude,
      start_longitude: newRoute.startLongitude,
      total_stops: 0,
      total_distance_km: 0,
      total_duration_mins: 0,
      notes: newRoute.notes
    }]);
  } catch (e) { }"""

replace5 = """  // 2. Persist in LocalDb (Upsert para prevenir duplicate key constraint error)
  try {
    await localDb.from("seller_routes").upsert([{
      id: newRoute.id,
      seller_id: newRoute.sellerId,
      seller_name: newRoute.sellerName,
      seller_email: newRoute.sellerEmail,
      status: newRoute.status,
      started_at: newRoute.startedAt,
      start_latitude: newRoute.startLatitude,
      start_longitude: newRoute.startLongitude,
      total_stops: 0,
      total_distance_km: 0,
      total_duration_mins: 0,
      notes: newRoute.notes
    }], { onConflict: 'id' });
  } catch (e) { }"""

if target5 not in content:
    print("Error: target5 not found")
    sys.exit(1)
content = content.replace(target5, replace5)

# 6. In /api/routes/:id/finish, skip WhatsApp if duration < 3 min AND stopsCount === 0
target6 = """        const isTest = Boolean(req.body.sendWhatsAppTest || req.body.isTest);

        if (isTest) {"""

replace6 = """        const diffMs = Math.max(0, new Date(targetRoute.finishedAt).getTime() - new Date(targetRoute.startedAt).getTime());
        const durationMins = Math.round(diffMs / 60000);
        const stopsCount = (routeVisits || []).length;
        const isEphemeralCancellation = durationMins < 3 && stopsCount === 0;

        const isTest = Boolean(req.body.sendWhatsAppTest || req.body.isTest);

        if (isEphemeralCancellation) {
          console.log(`[WhatsApp Finish Route] Omitiendo notificación WhatsApp de auditoría: jornada cancelada o cerrada en menos de 3 min sin paradas (${durationMins} min, ${stopsCount} visitas).`);
        } else if (isTest) {"""

if target6 not in content:
    print("Error: target6 not found")
    sys.exit(1)
content = content.replace(target6, replace6)

with open("server.ts", "w", encoding="utf-8", newline="\r\n") as f:
    f.write(content)

print("Successfully patched server.ts!")
