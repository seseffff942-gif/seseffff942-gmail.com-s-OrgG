const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const now = new Date();

function getDateIso(daysAgo, hours, minutes) {
  const d = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

// Rutas diarias estructuradas por vendedor y fecha
const MULTI_STOP_ROUTES = [
  // ==========================================
  // RUTA 1: HOY (Ruta Central / Altiplano - Vendedor: Emanuel Lima / Admin)
  // ==========================================
  {
    clientCode: 'GT-1001', // Agroservicio El Triunfo (Zona 9)
    daysAgo: 0,
    hours: 8,
    minutes: 30,
    type: 'pedido',
    notes: 'Inicio de ruta: Toma de pedido mensual de concentrados y fertilizantes foliares.'
  },
  {
    clientCode: 'GT-1010', // Agroveterinaria El Campesino (Chimaltenango)
    daysAgo: 0,
    hours: 10,
    minutes: 45,
    type: 'entrega',
    notes: 'Segunda parada: Entrega conforme de 30 bidones de Terraquat.'
  },
  {
    clientCode: 'GT-1004', // Agropecuaria La Semilla (Cobán)
    daysAgo: 0,
    hours: 14,
    minutes: 15,
    type: 'cobro',
    notes: 'Tercera parada: Cobro de factura pendiente Q3,400 con recibo firmado.'
  },

  // ==========================================
  // RUTA 2: HACE 2 DÍAS (Ruta Occidente - Xela / San Marcos / Reu)
  // ==========================================
  {
    clientCode: 'GT-1002', // Agroveterinaria Los Altos (Xela)
    daysAgo: 2,
    hours: 9,
    minutes: 0,
    type: 'rutina',
    notes: 'Inicio de ruta occidente: Auditoría de vitrina y exhibición de antibióticos.'
  },
  {
    clientCode: 'GT-1009', // Distribuidora La Unión (San Marcos)
    daysAgo: 2,
    hours: 11,
    minutes: 30,
    type: 'pedido',
    notes: 'Segunda parada: Pedido de 25 frascos de antiparasitarios inyectables.'
  },
  {
    clientCode: 'GT-1013', // Agroveterinaria Reu Agro (Retalhuleu)
    daysAgo: 2,
    hours: 14,
    minutes: 40,
    type: 'cobro',
    notes: 'Tercera parada: Cobro de saldo comercial Q5,200 en efectivo.'
  },

  // ==========================================
  // RUTA 3: HACE 5 DÍAS (Ruta Oriente - Zacapa / Izabal / Jutiapa)
  // ==========================================
  {
    clientCode: 'GT-1008', // Agroservicios del Oriente (Zacapa)
    daysAgo: 5,
    hours: 9,
    minutes: 15,
    type: 'cobro',
    notes: 'Inicio ruta oriente: Cobro de factura y revisión de cartera.'
  },
  {
    clientCode: 'GT-1006', // Agroinsumos del Caribe (Puerto Barrios)
    daysAgo: 5,
    hours: 12,
    minutes: 30,
    type: 'rutina',
    notes: 'Segunda parada: Visita a rancho ganadero y asesoría de pastos.'
  },
  {
    clientCode: 'GT-1012', // Agroinsumos La Cuna del Sol (Jutiapa)
    daysAgo: 5,
    hours: 16,
    minutes: 0,
    type: 'pedido',
    notes: 'Tercera parada: Levantamiento de pedido de melaza y sales minerales.'
  },

  // ==========================================
  // RUTA 4: HACE 12 DÍAS (Ruta Costa Sur - Escuintla / Mazatenango / Cuilapa)
  // ==========================================
  {
    clientCode: 'GT-1003', // Agrícola del Sur (Escuintla)
    daysAgo: 12,
    hours: 9,
    minutes: 0,
    type: 'pedido',
    notes: 'Inicio ruta sur: Pedido de agroquímicos de temporada.'
  },
  {
    clientCode: 'GT-1011', // Agropecuaria Costa Sur (Mazatenango)
    daysAgo: 12,
    hours: 11,
    minutes: 45,
    type: 'entrega',
    notes: 'Segunda parada: Entrega de concentrado avícola conforme.'
  },
  {
    clientCode: 'GT-1015', // Agropecuaria El Cafetal (Cuilapa)
    daysAgo: 12,
    hours: 15,
    minutes: 10,
    type: 'cobro',
    notes: 'Tercera parada: Cobro de abono de Q4,000 en caja.'
  },

  // ==========================================
  // RUTA 5: HACE 18 DÍAS (Ruta Norte - Huehue / Quiché / Petén)
  // ==========================================
  {
    clientCode: 'GT-1007', // Los Cuchumatanes (Huehuetenango)
    daysAgo: 18,
    hours: 10,
    minutes: 0,
    type: 'pedido',
    notes: 'Inicio ruta norte: Vacunas bovinas solicitadas.'
  },
  {
    clientCode: 'GT-1014', // Quiché Maya (Santa Cruz del Quiché)
    daysAgo: 18,
    hours: 13,
    minutes: 15,
    type: 'rutina',
    notes: 'Segunda parada: Presentación de instrumental veterinario.'
  },
  {
    clientCode: 'GT-1005', // El Petenero (Flores Petén)
    daysAgo: 18,
    hours: 17,
    minutes: 0,
    type: 'entrega',
    notes: 'Tercera parada: Entrega de suplementos minerales en Petén.'
  }
];

async function setupMultiStopRoutes() {
  const pgClient = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });

  await pgClient.connect();
  console.log('✅ Conectado a Docker PostgreSQL (54322)\n');

  await pgClient.query('TRUNCATE TABLE public.client_visits;');
  console.log('🧹 client_visits vaciado.');

  const clientsFile = path.join(__dirname, '..', 'clients_local.json');
  const allClients = JSON.parse(fs.readFileSync(clientsFile, 'utf8'));

  const generatedVisits = [];

  for (const item of MULTI_STOP_ROUTES) {
    const client = allClients.find(c => c.clientCode === item.clientCode);
    if (!client) continue;

    const visitDate = getDateIso(item.daysAgo, item.hours, item.minutes);
    const visitId = `visit_${item.clientCode.toLowerCase()}_${new Date(visitDate).getTime()}`;

    await pgClient.query(`
      INSERT INTO public.client_visits (
        id, client_id, "clientId", client_name, "clientName", client_code, "clientCode", company_name, "companyName",
        seller_id, "sellerId", seller_name, "sellerName", seller_email, "sellerEmail",
        latitude, longitude, accuracy, distance_meters, "distanceMeters",
        visit_type, "visitType", notes, photo_url, "photoUrl", created_at, "createdAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27
      );
    `, [
      visitId, client.id, client.id, client.name, client.name, client.clientCode, client.clientCode, client.companyName || client.name, client.companyName || client.name,
      'admin_user_01', 'admin_user_01', 'Equipo de Ruta Agricovet', 'Equipo de Ruta Agricovet', 'seseffff942@gmail.com', 'seseffff942@gmail.com',
      client.latitude, client.longitude, 5.0, 15.0, 15.0,
      item.type, item.type, item.notes, null, null, visitDate, visitDate
    ]);

    // Actualizar lastVisitAt en cliente
    await pgClient.query(`
      UPDATE public.clients 
      SET "lastVisitAt" = $1, last_visit_at = $1 
      WHERE id = $2;
    `, [visitDate, client.id]);

    client.lastVisitAt = visitDate;

    generatedVisits.push({
      id: visitId,
      clientId: client.id,
      client_id: client.id,
      clientName: client.name,
      client_name: client.name,
      clientCode: client.clientCode,
      client_code: client.clientCode,
      companyName: client.companyName || client.name,
      company_name: client.companyName || client.name,
      sellerId: 'admin_user_01',
      seller_id: 'admin_user_01',
      sellerName: 'Equipo de Ruta Agricovet',
      seller_name: 'Equipo de Ruta Agricovet',
      sellerEmail: 'seseffff942@gmail.com',
      seller_email: 'seseffff942@gmail.com',
      latitude: client.latitude,
      longitude: client.longitude,
      accuracy: 5.0,
      distanceMeters: 15.0,
      distance_meters: 15.0,
      visitType: item.type,
      visit_type: item.type,
      notes: item.notes,
      photoUrl: null,
      photo_url: null,
      createdAt: visitDate,
      created_at: visitDate
    });

    console.log(`📌 Parada [${item.clientCode}] ${client.name} -> Hace ${item.daysAgo === 0 ? 'HOY' : item.daysAgo + ' días'} a las ${item.hours}:${item.minutes < 10 ? '0' + item.minutes : item.minutes}`);
  }

  // Guardar en archivos locales
  const visitsFile = path.join(__dirname, '..', 'client_visits_local.json');
  fs.writeFileSync(visitsFile, JSON.stringify(generatedVisits, null, 2), 'utf8');
  fs.writeFileSync(clientsFile, JSON.stringify(allClients, null, 2), 'utf8');

  console.log(`\n💾 Archivos locales actualizados.`);
  console.log(`🚗 Total Visitas HOY: ${generatedVisits.filter(v => v.createdAt.startsWith(now.toISOString().split('T')[0])).length} paradas en la ruta de hoy.`);
  console.log(`📈 Total Rutas registradas: ${generatedVisits.length} paradas distribuidas en 5 fechas.`);

  await pgClient.query("NOTIFY pgrst, 'reload schema';");
  await pgClient.end();
}

setupMultiStopRoutes().catch(console.error);
