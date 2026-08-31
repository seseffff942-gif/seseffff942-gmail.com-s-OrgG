const { Client } = require('pg');

async function verifyNationalCoverage() {
  const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });

  await client.connect();
  console.log('🇬🇹 COBERTURA NACIONAL EN LA BASE DE DATOS DOCKER:');
  console.log('========================================================================');

  const res = await client.query(`
    SELECT 
      client_code, 
      client_name, 
      company_name, 
      latitude, 
      longitude, 
      visit_type, 
      notes
    FROM public.client_visits 
    WHERE client_code LIKE 'GT-%'
    ORDER BY client_code;
  `);

  res.rows.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.client_code}] ${r.client_name}`);
    console.log(`   📍 GPS: (${r.latitude}, ${r.longitude}) | Tipo Visita: ${r.visit_type.toUpperCase()}`);
    console.log(`   📝 Nota: "${r.notes}"\n`);
  });

  const totalClients = await client.query('SELECT count(*) FROM public.clients WHERE latitude IS NOT NULL;');
  const totalVisits = await client.query('SELECT count(*) FROM public.client_visits;');

  console.log('========================================================================');
  console.log(`🎯 Total Clientes Geoposicionados en Mapa Docker: ${totalClients.rows[0].count}`);
  console.log(`📌 Total Checkpoints de Visita en Docker: ${totalVisits.rows[0].count}`);
  console.log('========================================================================');

  await client.end();
}

verifyNationalCoverage().catch(console.error);
