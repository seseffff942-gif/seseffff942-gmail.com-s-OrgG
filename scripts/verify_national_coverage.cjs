const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

async function verifyNationalCoverage() {
  console.log('🇬🇹 COBERTURA NACIONAL Y CHECKPOINTS DE VISITAS:');
  console.log('========================================================================');

  let rows = [];
  let totalClientsCount = 0;
  let totalVisitsCount = 0;
  let source = '';

  // 1. Intentar Docker local PG si está activo
  let dockerSuccess = false;
  try {
    const pgClient = new Client({
      connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
      connectionTimeoutMillis: 1000
    });
    await pgClient.connect();
    const res = await pgClient.query(`
      SELECT 
        COALESCE(client_code, clientcode) as client_code, 
        COALESCE(client_name, clientname) as client_name, 
        COALESCE(company_name, companyname) as company_name, 
        latitude, 
        longitude, 
        COALESCE(visit_type, visittype, 'rutina') as visit_type, 
        notes
      FROM public.client_visits 
      ORDER BY id DESC;
    `);
    rows = res.rows;
    const totalClients = await pgClient.query('SELECT count(*) FROM public.clients WHERE latitude IS NOT NULL;');
    const totalVisits = await pgClient.query('SELECT count(*) FROM public.client_visits;');
    totalClientsCount = totalClients.rows[0].count;
    totalVisitsCount = totalVisits.rows[0].count;
    source = 'DOCKER LOCAL POSTGRES (Puerto 54322)';
    dockerSuccess = true;
    await pgClient.end();
  } catch (e) {}

  // 2. Si Docker no está activo, consultar Supabase Producción
  if (!dockerSuccess) {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://vedgedsbuajueynnyvpn.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: visits, error: vErr } = await supabase
      .from('client_visits')
      .select('*');

    if (vErr) console.error('Error fetching visits:', vErr);

    rows = (visits || []).map(v => ({
      client_code: v.clientCode || v.client_code || 'S/C',
      client_name: v.clientName || v.client_name || 'Cliente sin nombre',
      company_name: v.companyName || v.company_name || '',
      latitude: v.latitude,
      longitude: v.longitude,
      visit_type: v.visitType || v.visit_type || 'rutina',
      notes: v.notes || ''
    }));


    const { count: cCount } = await supabase.from('clients').select('*', { count: 'exact', head: true }).not('latitude', 'is', null);
    const { count: vCount } = await supabase.from('client_visits').select('*', { count: 'exact', head: true });

    totalClientsCount = cCount || 0;
    totalVisitsCount = vCount || 0;
    source = 'SUPABASE CLOUD PRODUCCIÓN';
  }

  console.log(`📡 BASE DE DATOS: ${source}`);
  console.log('========================================================================\n');

  if (rows.length === 0) {
    console.log('ℹ️ No hay checkpoints de visitas registrados en este momento.');
  } else {
    rows.forEach((r, idx) => {
      console.log(`${idx + 1}. [Código: ${r.client_code}] ${r.client_name} ${r.company_name ? '🏢 (' + r.company_name + ')' : ''}`);
      console.log(`   📍 GPS: (${r.latitude}, ${r.longitude}) | Tipo Visita: ${String(r.visit_type).toUpperCase()}`);
      console.log(`   📝 Nota: "${r.notes}"\n`);
    });
  }

  console.log('========================================================================');
  console.log(`🎯 Total Clientes Geoposicionados en Mapa: ${totalClientsCount}`);
  console.log(`📌 Total Checkpoints de Visitas Registrados: ${totalVisitsCount}`);
  console.log('========================================================================');
}

verifyNationalCoverage().catch(console.error);


