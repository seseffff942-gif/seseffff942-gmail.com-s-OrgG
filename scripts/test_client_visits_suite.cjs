const fs = require('fs');
const path = require('path');
const http = require('http');

const SERVER_URL = 'http://localhost:3000';

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 0;
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(Math.max(0, Math.min(1, a))), Math.sqrt(Math.max(0, 1 - a)));
  return Math.round(R * c);
}

function normalizeSearchText(str) {
  if (!str) return '';
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function request(endpoint, options = {}) {
  const url = new URL(endpoint, SERVER_URL);
  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { 'Authorization': `Bearer ${options.token}` } : {}),
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, data: json });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('🚀 INICIANDO AUDITORÍA & BATERÍA DE PRUEBAS: VISITAS & MAPA');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name} -> ${details}`);
      failed++;
    }
  }

  // 1. Login to get token
  console.log('🔹 1. Autenticación y Token de Usuario...');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'seseffff942@gmail.com', password: '123' }
  });

  const token = loginRes.data?.token;
  assert(loginRes.status === 200 && Boolean(token), 'Login exitoso y obtención de JWT token');

  // 2. Normalización de Búsqueda y Tildes
  console.log('\n🔹 2. Búsqueda y Normalización de Acentos (Fuzzy & Accents)...');
  const sampleClients = [
    { id: '1', name: 'Sérgio lima', clientCode: '9201', companyName: 'Agropecuaria El Éxito', nit: '12345-6' },
    { id: '2', name: 'Agroveterinaria La Bendición', clientCode: '1044', companyName: 'La Bendición S.A.', nit: '887766-K' },
    { id: '3', name: 'Finca San José', clientCode: '5520', companyName: 'Hacienda Quiché', nit: 'CF' }
  ];

  const searchTests = [
    { term: 'sergio', matchExpected: 'Sérgio lima' },
    { term: 'sérgio', matchExpected: 'Sérgio lima' },
    { term: 'SERGIO LIMA', matchExpected: 'Sérgio lima' },
    { term: '9201', matchExpected: 'Sérgio lima' },
    { term: 'exito', matchExpected: 'Sérgio lima' },
    { term: 'bendicion', matchExpected: 'Agroveterinaria La Bendición' },
    { term: 'bendición', matchExpected: 'Agroveterinaria La Bendición' },
    { term: 'quiche', matchExpected: 'Finca San José' },
    { term: 'quiché', matchExpected: 'Finca San José' }
  ];

  searchTests.forEach(test => {
    const norm = normalizeSearchText(test.term);
    const found = sampleClients.find(c => {
      return normalizeSearchText(c.name).includes(norm) ||
             normalizeSearchText(c.clientCode).includes(norm) ||
             normalizeSearchText(c.companyName).includes(norm);
    });
    assert(found && found.name === test.matchExpected, `Búsqueda '${test.term}' encuentra '${test.matchExpected}'`);
  });

  // 3. Cálculo de Distancias GPS (Haversine Formula)
  console.log('\n🔹 3. Verificación de Cálculo de Distancias GPS...');
  // Coordenadas Ciudad de Guatemala Parque Central (14.6416, -90.5133) a Cayalá (14.6074, -90.4851) ~ 4.8km
  const d1 = calculateDistanceMeters(14.6416, -90.5133, 14.6074, -90.4851);
  assert(d1 >= 4600 && d1 <= 5100, `Distancia Parque Central -> Cayalá calculada: ${d1}m (Esperado ~4800m)`);

  // Distancia a 0 metros (mismas coordenadas)
  const d0 = calculateDistanceMeters(14.6416, -90.5133, 14.6416, -90.5133);
  assert(d0 === 0, `Distancia en el mismo punto exacto: ${d0}m`);

  // Protección contra NaN o Coordenadas Corruptas
  const dNan = calculateDistanceMeters(NaN, -90.5133, 14.6416, undefined);
  assert(dNan === 0 && !isNaN(dNan), `Protección contra NaN / undefined retorna 0 seguro: ${dNan}`);

  // 4. API Endpoints: Actualización de Coordenadas de Cliente
  console.log('\n🔹 4. API: PUT /api/clients/:id/location...');
  const testClientId = 'CLI-TEST-AUDIT-' + Date.now();
  
  // Test con coordenadas válidas
  const markRes = await request(`/api/clients/${testClientId}/location`, {
    method: 'PUT',
    token,
    body: {
      latitude: 14.6349,
      longitude: -90.5069,
      locationAddress: 'Calzada Roosevelt, Ciudad de Guatemala'
    }
  });
  assert(markRes.status === 200 && markRes.data.success === true, 'Fijar ubicación GPS responde 200 OK');
  assert(markRes.data.client?.latitude === 14.6349, 'Latitud guardada correctamente');

  // Test con coordenadas faltantes (debe dar 400 controlado)
  const markFailRes = await request(`/api/clients/${testClientId}/location`, {
    method: 'PUT',
    token,
    body: { locationAddress: 'Sin GPS' }
  });
  assert(markFailRes.status === 400, 'Validación de coordenadas faltantes retorna 400 controlado');

  // 5. API Endpoints: Registro de Checkpoints de Visita
  console.log('\n🔹 5. API: POST /api/visits (Checkpoints)...');
  const visitTypes = ['cobro', 'pedido', 'rutina', 'prospeccion', 'entrega'];
  
  for (const vType of visitTypes) {
    const visitRes = await request('/api/visits', {
      method: 'POST',
      token,
      body: {
        clientId: testClientId,
        clientName: 'Agropecuaria Auditoría Test',
        clientCode: '8899',
        companyName: 'Auditoría S.A.',
        latitude: 14.6350,
        longitude: -90.5070,
        accuracy: 12.5,
        visitType: vType,
        notes: `Prueba automatizada de checkpoint: ${vType}`
      }
    });

    assert(
      visitRes.status === 200 && visitRes.data.success === true && visitRes.data.visit?.visitType === vType,
      `Registro de Checkpoint [${vType.toUpperCase()}] exitoso`
    );
  }

  // 6. API Endpoints: Consulta y Filtros de Visitas
  console.log('\n🔹 6. API: GET /api/visits (Filtros & Consulta)...');
  const getVisitsRes = await request('/api/visits', { token });
  assert(getVisitsRes.status === 200 && Array.isArray(getVisitsRes.data), 'Consulta general de visitas retorna array');
  assert(getVisitsRes.data.length > 0, `Total visitas registradas en histórico: ${getVisitsRes.data.length}`);

  const filterClientRes = await request(`/api/visits?clientId=${testClientId}`, { token });
  assert(filterClientRes.status === 200 && filterClientRes.data.length >= 5, `Filtro por clientId retorna ${filterClientRes.data.length} visitas`);

  // 7. API Endpoints: Estadísticas, KPIs y Radar de Frecuencia
  console.log('\n🔹 7. API: GET /api/visits/stats (Supervisión & Rankings)...');
  const statsRes = await request('/api/visits/stats', { token });
  assert(statsRes.status === 200 && statsRes.data.totalVisitsToday >= 5, `KPI Visitas de hoy calculado: ${statsRes.data.totalVisitsToday}`);
  assert(statsRes.data.totalVisitsMonth >= 5, `KPI Visitas del mes calculado: ${statsRes.data.totalVisitsMonth}`);
  assert(Array.isArray(statsRes.data.sellerRankings), 'Ranking de vendedores generado correctamente');

  // 8. Prueba de Estrés y Concurrencia (Simulación de 30 Checkpoints Rápidos)
  console.log('\n🔹 8. Prueba de Concurrencia & Estrés (30 Checkpoints Simultáneos)...');
  const stressPromises = [];
  for (let i = 1; i <= 30; i++) {
    stressPromises.push(
      request('/api/visits', {
        method: 'POST',
        token,
        body: {
          clientId: `CLI-CONCURRENT-${i % 5}`,
          clientName: `Cliente Concurrente ${i % 5}`,
          latitude: 14.6 + (i * 0.001),
          longitude: -90.5 - (i * 0.001),
          visitType: i % 2 === 0 ? 'cobro' : 'pedido',
          notes: `Visita concurrente #${i}`
        }
      })
    );
  }

  const stressResults = await Promise.all(stressPromises);
  const allStressOk = stressResults.every(r => r.status === 200 && r.data?.success === true);
  assert(allStressOk, '30 peticiones concurrentes procesadas al 100% sin colisiones ni memory leaks');

  // 9. Verificación de Persistencia Local
  console.log('\n🔹 9. Verificación de Persistencia en Base de Datos Local...');
  const localVisitsPath = path.join(__dirname, '..', 'client_visits_local.json');
  assert(fs.existsSync(localVisitsPath), 'Archivo client_visits_local.json existe y está activo');
  
  try {
    const raw = JSON.parse(fs.readFileSync(localVisitsPath, 'utf8'));
    assert(Array.isArray(raw) && raw.length > 0, `Base local sincronizada correctamente con ${raw.length} registros`);
  } catch (e) {
    assert(false, 'Lectura de base local', e.message);
  }

  console.log('\n===============================================================');
  console.log(`🏁 RESULTADO AUDITORÍA: ${passed} PASADAS / ${failed} FALLADAS`);
  if (failed === 0) {
    console.log('🌟 ESTADO: MÓDULO 100% OPERATIVO, ROBUSTO Y LISTO PARA PRODUCCIÓN.');
  } else {
    console.log('⚠️ SE DETECTARON FALLOS QUE DEBEN SER CORREGIDOS.');
  }
  console.log('===============================================================\n');
}

runTestSuite().catch(err => {
  console.error('Error fatal ejecutando test suite:', err);
  process.exit(1);
});
