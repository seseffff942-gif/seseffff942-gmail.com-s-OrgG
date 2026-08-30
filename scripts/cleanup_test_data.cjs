const fs = require('fs');
const path = require('path');

const clientsFile = path.join(__dirname, '..', 'clients_local.json');
const visitsFile = path.join(__dirname, '..', 'client_visits_local.json');

// 1. Clean client visits local
fs.writeFileSync(visitsFile, '[]', 'utf8');
console.log('✅ client_visits_local.json reiniciado a [] (Limpio para producción)');

// 2. Clean test GPS from clients_local
if (fs.existsSync(clientsFile)) {
  const clients = JSON.parse(fs.readFileSync(clientsFile, 'utf8'));
  const cleaned = clients.filter(c => !c.id.startsWith('CLI-TEST-')).map(c => {
    const { latitude, longitude, locationAddress, geotaggedAt, geotaggedBy, lastVisitAt, ...rest } = c;
    return rest;
  });

  fs.writeFileSync(clientsFile, JSON.stringify(cleaned, null, 2), 'utf8');
  console.log(`✅ clients_local.json limpiado (${cleaned.length} clientes reales sin datos de prueba)`);
}
