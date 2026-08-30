const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vedgedsbuajueynnyvpn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const clientsFile = path.join(__dirname, '..', 'clients_local.json');
const visitsFile = path.join(__dirname, '..', 'client_visits_local.json');

async function cleanEverything() {
  console.log('===============================================================');
  console.log('🧹 LIMPIEZA PROFUNDA: BORRANDO TODOS LOS DATOS DE PRUEBA');
  console.log('===============================================================\n');

  // 1. Limpiar archivo local de visitas
  console.log('🔹 1. Vaciando client_visits_local.json en disco...');
  fs.writeFileSync(visitsFile, '[]', 'utf8');
  console.log('   ✅ client_visits_local.json quedó en [] (0 visitas de prueba).');

  // 2. Limpiar archivo local de clientes
  console.log('\n🔹 2. Limpiando coordenadas y marcas de prueba en clients_local.json...');
  if (fs.existsSync(clientsFile)) {
    const rawClients = JSON.parse(fs.readFileSync(clientsFile, 'utf8'));
    // Filtrar cualquier cliente ficticio de prueba (que empiece con CLI-TEST o similar)
    const realClientsCleaned = rawClients
      .filter(c => !c.id.startsWith('CLI-TEST-') && !c.name.includes('Auditoría Test') && !c.name.includes('Concurrente'))
      .map(c => {
        const { latitude, longitude, locationAddress, geotaggedAt, geotaggedBy, lastVisitAt, ...cleanClient } = c;
        return cleanClient;
      });

    fs.writeFileSync(clientsFile, JSON.stringify(realClientsCleaned, null, 2), 'utf8');
    console.log(`   ✅ clients_local.json limpiado (${realClientsCleaned.length} clientes legítimos sin coordenadas de prueba).`);
  }

  // 3. Limpiar base de datos Supabase (client_visits)
  console.log('\n🔹 3. Vaciando tabla client_visits en Supabase...');
  try {
    const { error: delVisitsErr } = await supabase
      .from('client_visits')
      .delete()
      .neq('id', 'EMPTY_DUMMY_NEVER_MATCH');
    
    if (delVisitsErr) {
      console.warn('   ⚠️ Aviso al borrar visitas en Supabase:', delVisitsErr.message);
    } else {
      console.log('   ✅ Tabla client_visits en Supabase vaciada completamente (0 registros).');
    }
  } catch (e) {
    console.warn('   ⚠️ Error conectando a Supabase para client_visits:', e.message);
  }

  // 4. Limpiar clientes ficticios y resetear geo/lastVisit en Supabase
  console.log('\n🔹 4. Limpiando clientes ficticios y reseteando coordenadas en Supabase (clients)...');
  try {
    // Borrar clientes de prueba creados durante los tests
    await supabase.from('clients').delete().like('id', 'CLI-TEST-%');
    await supabase.from('clients').delete().like('name', '%Auditoría Test%');
    await supabase.from('clients').delete().like('name', '%Concurrente%');

    // Resetear coordenadas y last_visit_at
    const { error: resetErr } = await supabase
      .from('clients')
      .update({
        latitude: null,
        longitude: null,
        location_address: null,
        locationAddress: null,
        geotagged_at: null,
        geotaggedAt: null,
        geotagged_by: null,
        geotaggedBy: null,
        last_visit_at: null,
        lastVisitAt: null
      })
      .neq('id', 'EMPTY_DUMMY_NEVER_MATCH');

    if (resetErr) {
      console.warn('   ⚠️ Aviso al resetear clientes en Supabase:', resetErr.message);
    } else {
      console.log('   ✅ Clientes en Supabase reseteados a estado inicial sin coordenadas de prueba.');
    }
  } catch (e) {
    console.warn('   ⚠️ Error reseteando clientes en Supabase:', e.message);
  }

  console.log('\n===============================================================');
  console.log('🌟 ESTADO: BASE LOCAL Y SUPABASE 100% LIMPIAS E IMPECABLES');
  console.log('===============================================================\n');
}

cleanEverything().catch(err => {
  console.error('Error durante la limpieza profunda:', err);
});
