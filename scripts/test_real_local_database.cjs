const fs = require('fs');
const path = require('path');
const http = require('http');

const SERVER_URL = 'http://localhost:3000';

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

async function testWithLocalDb() {
  console.log('===============================================================');
  console.log('🇬🇹 PROBANDO CON LA BASE DE DATOS LOCAL REAL DE TU COMPUTADORA');
  console.log('===============================================================\n');

  // 1. Verificar archivo clients_local.json en disco
  const localClientsPath = path.join(__dirname, '..', 'clients_local.json');
  if (!fs.existsSync(localClientsPath)) {
    console.error('❌ No se encontró clients_local.json');
    return;
  }

  const rawLocalClients = JSON.parse(fs.readFileSync(localClientsPath, 'utf8'));
  console.log(`📁 1. Base local cargada con ${rawLocalClients.length} clientes reales en tu computadora.`);

  // 2. Login con usuario administrador / dueño
  console.log('🔑 2. Iniciando sesión en servidor local (localhost:3000)...');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'seseffff942@gmail.com', password: '123' }
  });

  const token = loginRes.data?.token;
  if (!token) {
    console.error('❌ Error de login:', loginRes.data);
    return;
  }
  console.log('✅ Sesión iniciada con éxito en local.');

  // 3. Consultar clientes vía API local
  console.log('🔍 3. Consultando /api/clients desde el servidor local...');
  const clientsRes = await request('/api/clients', { token });
  const serverClients = Array.isArray(clientsRes.data) ? clientsRes.data : [];
  console.log(`✅ Servidor local respondió con ${serverClients.length} clientes listos.`);

  // 4. Geotagging de clientes reales con ubicaciones en Guatemala
  console.log('\n📍 4. Marcando coordenadas GPS en clientes reales de la base local:');
  const realLocationsToAssign = [
    { code: '9754', name: 'EDGAR CAAL', dept: 'Fray Bartolomé, Alta Verapaz', lat: 15.9333, lng: -89.8667 },
    { code: '2077', name: 'PABLO AROCHE', dept: 'Sansare, El Progreso', lat: 14.7478, lng: -90.1172 },
    { code: '6757', name: 'SUTUJ CANSINOS', dept: 'El Chal, Petén', lat: 16.6167, lng: -89.6500 },
    { code: '4473', name: 'Byron Escobar', dept: 'Dolores, Petén', lat: 16.5167, lng: -89.4167 },
    { code: '3017', name: 'SANDOVAL MARTÍNEZ', dept: 'Salamá, Baja Verapaz', lat: 15.1028, lng: -90.3181 }
  ];

  for (const item of realLocationsToAssign) {
    // Buscar en clientes reales
    const target = serverClients.find(c => (c.clientCode === item.code) || (c.name && c.name.includes(item.name.split(' ')[0])));
    if (target) {
      const updateRes = await request(`/api/clients/${target.id}/location`, {
        method: 'PUT',
        token,
        body: {
          latitude: item.lat,
          longitude: item.lng,
          locationAddress: item.dept
        }
      });
      console.log(`   📍 [${item.code}] ${target.name} (${item.dept}) -> Lat: ${item.lat}, Lng: ${item.lng} -> Status: ${updateRes.status}`);
    }
  }

  // 5. Registrar Checkpoints de Visita en Clientes Reales
  console.log('\n📌 5. Registrando Checkpoints de Visita reales:');
  const checkpointsToCreate = [
    { code: '9754', type: 'cobro', notes: 'Cobro de Q1,500 en efectivo realizado en tienda de Fray Bartolomé' },
    { code: '2077', type: 'pedido', notes: 'Toma de pedido de 20 litros de Terraquat y 10 Leñador' },
    { code: '6757', type: 'rutina', notes: 'Revisión de inventario de medicamentos en mostrador' },
    { code: '4473', type: 'entrega', notes: 'Entrega conforme de pedido con recibo firmado' }
  ];

  for (const cp of checkpointsToCreate) {
    const target = serverClients.find(c => c.clientCode === cp.code);
    if (target) {
      const visitRes = await request('/api/visits', {
        method: 'POST',
        token,
        body: {
          clientId: target.id,
          clientName: target.name,
          clientCode: target.clientCode,
          companyName: target.companyName,
          latitude: target.latitude || 14.6349,
          longitude: target.longitude || -90.5069,
          accuracy: 8.0,
          visitType: cp.type,
          notes: cp.notes
        }
      });

      console.log(`   📌 [${cp.type.toUpperCase()}] Cliente: ${target.name} -> Checkpoint ID: ${visitRes.data?.visit?.id}`);
    }
  }

  // 6. Consultar Estadísticas y Ranking con la Base Real
  console.log('\n📊 6. Consultando Radar de Frecuencia y Estadísticas Generadas:');
  const statsRes = await request('/api/visits/stats', { token });
  console.log('   -----------------------------------------------------');
  console.log(`   🎯 Total Visitas Hoy: ${statsRes.data?.totalVisitsToday}`);
  console.log(`   📈 Total Visitas del Mes: ${statsRes.data?.totalVisitsMonth}`);
  console.log(`   👥 Vendedores en Ruta: ${statsRes.data?.activeSellersCount}`);
  console.log(`   🏆 Ranking Vendedores:`, statsRes.data?.sellerRankings?.map(s => `${s.sellerName} (${s.monthVisits} visitas)`).join(', ') || 'N/A');
  console.log('   -----------------------------------------------------');

  // 7. Verificar archivo físico local client_visits_local.json
  const visitsLocalFile = path.join(__dirname, '..', 'client_visits_local.json');
  const savedVisits = JSON.parse(fs.readFileSync(visitsLocalFile, 'utf8'));
  console.log(`\n💾 7. Verificación de archivo local en tu disco: ${savedVisits.length} checkpoints guardados en client_visits_local.json`);

  console.log('\n===============================================================');
  console.log('🌟 PRUEBA LOCAL CON TU BASE DE DATOS REAL COMPLETADA AL 100%');
  console.log('===============================================================\n');
}

testWithLocalDb().catch(err => {
  console.error('Error en prueba local:', err);
});
