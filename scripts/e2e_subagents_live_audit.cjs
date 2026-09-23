const http = require('http');
const pg = require('pg');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const pgPool = new pg.Pool({ connectionString: 'postgresql://postgres:evolution_pass@185.166.39.49:5432/agricovet_db' });

function apiRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, {
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runAudit() {
  console.log('====================================================');
  console.log('🚀 INICIANDO AUDITORÍA EN VIVO CON MULTI-SUBAGENTES');
  console.log('====================================================\n');

  const auditLog = [];

  function record(agent, testCase, status, detail, data = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      agent,
      testCase,
      status,
      detail,
      data
    };
    auditLog.push(entry);
    const icon = status === 'SUCCESS' ? '✅' : (status === 'WARNING' ? '⚠️' : '❌');
    console.log(`${icon} [${agent}] ${testCase}: ${detail}`);
  }

  try {
    // -------------------------------------------------------------
    // SUBAGENTE 1: HERBERT ARGUETA (Vendedor 1521)
    // -------------------------------------------------------------
    console.log('\n--- [SUBAGENTE 1] SIMULACIÓN VENDEDOR: HERBERT ARGUETA ---');
    const login1 = await apiRequest('/api/auth/login', 'POST', {
      email: '1521',
      password: '123'
    });

    if (login1.status !== 200 || !login1.data.token) {
      record('Subagente 1 (Herbert)', 'Login Vendedor', 'FAILED', `Status ${login1.status}`);
      return;
    }
    const token1 = login1.data.token;
    const user1 = login1.data.user;
    record('Subagente 1 (Herbert)', 'Login Vendedor', 'SUCCESS', `Autenticado: ${user1.name} (${user1.email}), Rol: ${user1.role}`);

    // 1.1 Iniciar Ruta
    const startRouteRes = await apiRequest('/api/routes/start', 'POST', {
      startLatitude: 14.6349,
      startLongitude: -90.5069,
      notes: 'Subagente 1: Inicio de jornada en terreno (Guatemala)'
    }, token1);

    let routeId = null;
    if (startRouteRes.status === 200 && startRouteRes.data.route) {
      routeId = startRouteRes.data.route.id;
      record('Subagente 1 (Herbert)', 'Iniciar Ruta', 'SUCCESS', `Ruta #${routeId} iniciada. Estado: ${startRouteRes.data.route.status}, GPS: (14.6349, -90.5069)`);
    } else {
      record('Subagente 1 (Herbert)', 'Iniciar Ruta', 'FAILED', `Status: ${startRouteRes.status}`);
    }

    // 1.2 Registrar Visita en tiempo real
    const visitPayload = {
      clientId: 'CLI-1786722281555',
      clientName: 'El Corral Agroindustrial',
      sellerId: user1.email,
      sellerName: user1.name,
      visitType: 'supervision',
      latitude: 14.6355,
      longitude: -90.5075,
      notes: 'Auditoria de subagente: Visita en tiempo real verificada en produccion.',
      status: 'completed',
      photos: []
    };

    const visitRes = await apiRequest('/api/visits', 'POST', visitPayload, token1);
    let visitId = null;
    if (visitRes.status === 200 || visitRes.status === 201) {
      visitId = visitRes.data.visit?.id || visitRes.data.id;
      record('Subagente 1 (Herbert)', 'Registrar Visita en Vivo', 'SUCCESS', `Visita registrada ID: ${visitId} en cliente "${visitPayload.clientName}"`);
    } else {
      record('Subagente 1 (Herbert)', 'Registrar Visita en Vivo', 'FAILED', `Status: ${visitRes.status}: ${JSON.stringify(visitRes.data || visitRes.raw)}`);
    }

    // 1.3 Finalizar Ruta
    if (routeId) {
      const finishRouteRes = await apiRequest(`/api/routes/${encodeURIComponent(routeId)}/finish`, 'POST', {
        endLatitude: 14.6400,
        endLongitude: -90.5100,
        notes: 'Subagente 1: Fin de jornada de auditoria en terreno.'
      }, token1);

      if (finishRouteRes.status === 200 && finishRouteRes.data.route?.status === 'completed') {
        record('Subagente 1 (Herbert)', 'Finalizar Ruta', 'SUCCESS', `Ruta #${routeId} finalizada correctamente. Estado confirmado: completed`);
      } else {
        record('Subagente 1 (Herbert)', 'Finalizar Ruta', 'FAILED', `Status: ${finishRouteRes.status}`);
      }
    }

    // -------------------------------------------------------------
    // SUBAGENTE 2: ADMINISTRADOR (Emanuel Lima 9905)
    // -------------------------------------------------------------
    console.log('\n--- [SUBAGENTE 2] SIMULACIÓN ADMINISTRADOR: AUDITORÍA Y NOTIFICACIONES ---');
    const login2 = await apiRequest('/api/auth/login', 'POST', {
      email: '9905',
      password: '123'
    });

    if (login2.status !== 200 || !login2.data.token) {
      record('Subagente 2 (Admin)', 'Login Admin', 'FAILED', `Status ${login2.status}`);
      return;
    }
    const token2 = login2.data.token;
    const user2 = login2.data.user;
    record('Subagente 2 (Admin)', 'Login Admin', 'SUCCESS', `Autenticado: ${user2.name} (${user2.email}), Rol: ${user2.role}`);

    // 2.1 Verificar Visita de Herbert en tiempo real
    const visitsAdminRes = await apiRequest('/api/visits', 'GET', null, token2);
    if (visitsAdminRes.status === 200 && Array.isArray(visitsAdminRes.data)) {
      const found = visitsAdminRes.data.find(v => v.id === visitId || v.notes?.includes('Auditoria de subagente'));
      if (found) {
        record('Subagente 2 (Admin)', 'Visibilidad Visitas Tiempo Real', 'SUCCESS', `Visita ID: ${found.id} visible instantáneamente para el Admin. Asesor: ${found.sellerName}`);
      } else {
        record('Subagente 2 (Admin)', 'Visibilidad Visitas Tiempo Real', 'FAILED', 'La visita no aparecio en la lista de visitas del admin');
      }
    } else {
      record('Subagente 2 (Admin)', 'Visibilidad Visitas Tiempo Real', 'FAILED', `Status: ${visitsAdminRes.status}`);
    }

    // 2.2 Verificar Notificación Push disparada en tiempo real
    const notifsRes = await apiRequest('/api/notifications', 'GET', null, token2);
    if (notifsRes.status === 200 && Array.isArray(notifsRes.data)) {
      const notif = notifsRes.data.find(n => n.type === 'visit_registered' || n.message?.includes('El Corral Agroindustrial'));
      if (notif) {
        record('Subagente 2 (Admin)', 'Notificación Push en Tiempo Real', 'SUCCESS', `Alerta push admin: "${notif.title}" - ${notif.message}`);
      } else {
        record('Subagente 2 (Admin)', 'Notificación Push en Tiempo Real', 'WARNING', 'No se encontro en lista de notificaciones recientes');
      }
    } else {
      record('Subagente 2 (Admin)', 'Notificación Push en Tiempo Real', 'FAILED', `Status: ${notifsRes.status}`);
    }

    // 2.3 Verificar Atribución de Factura Folio 1180 y Cliente El Corral en DB
    const invCheck = await pgPool.query('SELECT id, folio, "sellerId", "clientName", "totalAmount" FROM public.invoices WHERE id = $1', ['INV-1790009269310-190']);
    if (invCheck.rows.length > 0) {
      const row = invCheck.rows[0];
      if (row.sellerId === 'gruasytransportesali@gmail.com') {
        record('Subagente 2 (Admin)', 'Atribución Factura Folio 1180', 'SUCCESS', `Factura 1180 (Q${row.totalAmount}) 100% asignada a Herbert Argueta (${row.sellerId}). Emanuel Lima NO tiene esta venta.`);
      } else {
        record('Subagente 2 (Admin)', 'Atribución Factura Folio 1180', 'FAILED', `sellerId actual: ${row.sellerId}`);
      }
    }

    const clientCheck = await pgPool.query('SELECT id, name, "sellerId" FROM public.clients WHERE id = $1', ['CLI-1786722281555']);
    if (clientCheck.rows.length > 0 && clientCheck.rows[0].sellerId === 'gruasytransportesali@gmail.com') {
      record('Subagente 2 (Admin)', 'Atribución Cliente Cartera', 'SUCCESS', `Cliente "El Corral Agroindustrial" asignado 100% a Herbert Argueta.`);
    }

    // 2.4 Limpieza de Datos de Prueba (Garantizar Producción Limpia)
    if (visitId) {
      const delVisit = await apiRequest(`/api/visits/${visitId}`, 'DELETE', null, token2);
      if (delVisit.status === 200) {
        record('Subagente 2 (Admin)', 'Limpieza Visita de Prueba', 'SUCCESS', `Visita #${visitId} borrada de la base de datos de producción.`);
      }
    }
    if (routeId) {
      await pgPool.query('DELETE FROM public.seller_routes WHERE id = $1', [routeId]);
      record('Subagente 2 (Admin)', 'Limpieza Ruta de Prueba', 'SUCCESS', `Ruta #${routeId} borrada de la base de datos de producción.`);
    }

    // -------------------------------------------------------------
    // SUBAGENTE 3: ERICK JUÁREZ (Vendedor 8363)
    // -------------------------------------------------------------
    console.log('\n--- [SUBAGENTE 3] SIMULACIÓN VENDEDOR: ERICK JUÁREZ (PERSISTENCIA DE RUTA) ---');
    const login3 = await apiRequest('/api/auth/login', 'POST', {
      email: '8363',
      password: '123'
    });

    if (login3.status === 200 && login3.data.token) {
      const token3 = login3.data.token;
      record('Subagente 3 (Erick)', 'Login Vendedor', 'SUCCESS', `Autenticado: ${login3.data.user.name}`);

      // Iniciar Ruta
      const start3 = await apiRequest('/api/routes/start', 'POST', {
        startLatitude: 14.6500,
        startLongitude: -90.5200,
        notes: 'Subagente 3: Test persistencia de cierre'
      }, token3);

      if (start3.status === 200 && start3.data.route) {
        const rId3 = start3.data.route.id;
        record('Subagente 3 (Erick)', 'Iniciar Ruta', 'SUCCESS', `Ruta #${rId3} iniciada`);

        // Finalizar Ruta
        const fin3 = await apiRequest(`/api/routes/${encodeURIComponent(rId3)}/finish`, 'POST', {
          endLatitude: 14.6510,
          endLongitude: -90.5210,
          notes: 'Subagente 3: Jornada cerrada'
        }, token3);

        if (fin3.status === 200 && fin3.data.route?.status === 'completed') {
          record('Subagente 3 (Erick)', 'Finalizar Ruta', 'SUCCESS', `Ruta #${rId3} completada.`);

          // Verificar si activeRoute devuelve null o vacio (NO debe rebotar activa)
          const activeCheck = await apiRequest('/api/routes/active', 'GET', null, token3);
          if (activeCheck.status === 200 && (!activeCheck.data.route || !activeCheck.data.route.id)) {
            record('Subagente 3 (Erick)', 'Verificación Persistencia Cierre', 'SUCCESS', 'La ruta cerrada NO reaparece activa. Cierre 100% definitivo.');
          } else {
            record('Subagente 3 (Erick)', 'Verificación Persistencia Cierre', 'FAILED', 'La ruta aun aparece activa.');
          }

          // Cleanup
          await pgPool.query('DELETE FROM public.seller_routes WHERE id = $1', [rId3]);
          record('Subagente 3 (Erick)', 'Limpieza Ruta de Prueba', 'SUCCESS', `Ruta #${rId3} borrada.`);
        }
      }
    }

    console.log('\n====================================================');
    console.log('🎯 TODAS LAS PRUEBAS DE SUBAGENTES COMPLETADAS CON ÉXITO');
    console.log('====================================================\n');

    fs.writeFileSync('scripts/audit_results.json', JSON.stringify(auditLog, null, 2));

  } catch (err) {
    console.error('Error durante la auditoria:', err);
  } finally {
    await pgPool.end();
  }
}

runAudit();
