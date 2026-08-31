const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const NATIONAL_CLIENTS = [
  {
    id: 'cli_gt_guatemala_01',
    clientCode: 'GT-1001',
    name: 'AGROSERVICIO EL TRIUNFO S.A.',
    companyName: 'Agroservicio El Triunfo',
    nit: '5489214-7',
    phone: '+502 2478-9900',
    address: '6ta Avenida 4-32 Zona 9, Ciudad de Guatemala',
    locationAddress: 'Zona 9, Ciudad de Guatemala, Guatemala',
    latitude: 14.6038,
    longitude: -90.5186,
    isBlocked: false,
    visit: {
      type: 'pedido',
      notes: 'Pedido mensual de fertilizantes foliares y concentrados para ganadería intensiva.',
      distanceMeters: 45
    }
  },
  {
    id: 'cli_gt_xela_02',
    clientCode: 'GT-1002',
    name: 'AGROVETERINARIA LOS ALTOS DE OCCIDENTE',
    companyName: 'Agroveterinaria Los Altos',
    nit: '3892011-2',
    phone: '+502 7761-4520',
    address: '4ta Calle 12-45 Zona 3, Quetzaltenango',
    locationAddress: 'Zona 3, Quetzaltenango, Quetzaltenango',
    latitude: 14.8347,
    longitude: -91.5180,
    isBlocked: false,
    visit: {
      type: 'rutina',
      notes: 'Revisión de stock en mostrador y exhibición de nuevas líneas de antibióticos.',
      distanceMeters: 12
    }
  },
  {
    id: 'cli_gt_escuintla_03',
    clientCode: 'GT-1003',
    name: 'DISTRIBUIDORA AGRICOLA DEL SUR PACIFICO',
    companyName: 'Agrícola del Sur Pacífico',
    nit: '7812903-4',
    phone: '+502 7888-1234',
    address: 'Km 68 Carretera a Puerto San José, Escuintla',
    locationAddress: 'Escuintla, Escuintla',
    latitude: 14.3009,
    longitude: -90.7850,
    isBlocked: false,
    visit: {
      type: 'cobro',
      notes: 'Cobro de factura pendiente Q4,800 contra entrega de recibo de caja.',
      distanceMeters: 8
    }
  },
  {
    id: 'cli_gt_coban_04',
    clientCode: 'GT-1004',
    name: 'AGROPECUARIA LA SEMILLA VERAPAZ',
    companyName: 'Agropecuaria La Semilla',
    nit: '4591028-9',
    phone: '+502 7951-3321',
    address: '1ra Calle 3-18 Zona 2, Cobán, Alta Verapaz',
    locationAddress: 'Cobán, Alta Verapaz',
    latitude: 15.4708,
    longitude: -90.3708,
    isBlocked: false,
    visit: {
      type: 'pedido',
      notes: 'Toma de pedido de 50 sacos de concentrado y desparasitantes bovinos.',
      distanceMeters: 15
    }
  },
  {
    id: 'cli_gt_peten_05',
    clientCode: 'GT-1005',
    name: 'VETERINARIA Y AGROSERVICIOS EL PETENERO',
    companyName: 'Agroservicios El Petenero',
    nit: '9823410-1',
    phone: '+502 7926-0450',
    address: 'Calle Principal Barrio Central, Santa Elena, Flores',
    locationAddress: 'Santa Elena, Flores, Petén',
    latitude: 16.9180,
    longitude: -89.8967,
    isBlocked: false,
    visit: {
      type: 'entrega',
      notes: 'Entrega conforme de pedido de vitaminas inyectables y sales minerales.',
      distanceMeters: 20
    }
  },
  {
    id: 'cli_gt_izabal_06',
    clientCode: 'GT-1006',
    name: 'AGROINSUMOS DEL CARIBE',
    companyName: 'Agroinsumos del Caribe',
    nit: '6234891-5',
    phone: '+502 7948-2210',
    address: '12 Calle y 7ma Avenida, Puerto Barrios, Izabal',
    locationAddress: 'Puerto Barrios, Izabal',
    latitude: 15.7278,
    longitude: -88.5944,
    isBlocked: false,
    visit: {
      type: 'rutina',
      notes: 'Visita técnica a rancho ganadero asociado y asesoría de pastizales.',
      distanceMeters: 5
    }
  },
  {
    id: 'cli_gt_huehue_07',
    clientCode: 'GT-1007',
    name: 'AGROVETERINARIA LOS CUCHUMATANES',
    companyName: 'Agroveterinaria Los Cuchumatanes',
    nit: '2348901-8',
    phone: '+502 7764-8890',
    address: '5ta Avenida 2-10 Zona 1, Huehuetenango',
    locationAddress: 'Huehuetenango, Huehuetenango',
    latitude: 15.3197,
    longitude: -91.4711,
    isBlocked: false,
    visit: {
      type: 'pedido',
      notes: 'Pedido de antiparasitarios y vacunas contra carbón sintomático.',
      distanceMeters: 18
    }
  },
  {
    id: 'cli_gt_zacapa_08',
    clientCode: 'GT-1008',
    name: 'AGROSERVICIOS DEL ORIENTE TECUN',
    companyName: 'Agroservicios del Oriente',
    nit: '5619283-0',
    phone: '+502 7941-1100',
    address: 'Barrio El Tamarindal, Zacapa',
    locationAddress: 'Zacapa, Zacapa',
    latitude: 14.9722,
    longitude: -89.5306,
    isBlocked: false,
    visit: {
      type: 'cobro',
      notes: 'Gestión y cobro de abono de Q2,500 de cliente ganadero regional.',
      distanceMeters: 10
    }
  },
  {
    id: 'cli_gt_sanmarcos_09',
    clientCode: 'GT-1009',
    name: 'DISTRIBUIDORA AGRICOLA LA UNION SAN MARCOS',
    companyName: 'Distribuidora La Unión',
    nit: '8912304-2',
    phone: '+502 7760-5544',
    address: '3ra Calle 8-12 Zona 1, San Marcos',
    locationAddress: 'San Marcos, San Marcos',
    latitude: 14.9639,
    longitude: -91.7944,
    isBlocked: false,
    visit: {
      type: 'rutina',
      notes: 'Chequeo de rotación de productos veterinarios en estantería.',
      distanceMeters: 14
    }
  },
  {
    id: 'cli_gt_chimal_10',
    clientCode: 'GT-1010',
    name: 'AGROVETERINARIA EL CAMPESINO CHIMALTENANGO',
    companyName: 'El Campesino Chimaltenango',
    nit: '4719283-6',
    phone: '+502 7839-4411',
    address: '1ra Avenida 4-02 Zona 2, Chimaltenango',
    locationAddress: 'Chimaltenango, Chimaltenango',
    latitude: 14.6611,
    longitude: -90.8194,
    isBlocked: false,
    visit: {
      type: 'pedido',
      notes: 'Solicitud de 30 bidones de Terraquat y 15 galones de insecticida agrícola.',
      distanceMeters: 9
    }
  },
  {
    id: 'cli_gt_suchi_11',
    clientCode: 'GT-1011',
    name: 'AGROPECUARIA COSTA SUR MAZATENANGO',
    companyName: 'Agropecuaria Costa Sur',
    nit: '3491820-3',
    phone: '+502 7872-9010',
    address: '3ra Calle 5-20 Zona 1, Mazatenango',
    locationAddress: 'Mazatenango, Suchitepéquez',
    latitude: 14.5342,
    longitude: -91.5033,
    isBlocked: false,
    visit: {
      type: 'entrega',
      notes: 'Entrega de pedido especial de melaza vitaminada y concentrado avícola.',
      distanceMeters: 6
    }
  },
  {
    id: 'cli_gt_jutiapa_12',
    clientCode: 'GT-1012',
    name: 'AGROINSUMOS LA CUNA DEL SOL JUTIAPA',
    companyName: 'La Cuna del Sol',
    nit: '6712093-4',
    phone: '+502 7844-3320',
    address: 'Calzada 15 de Septiembre, Jutiapa',
    locationAddress: 'Jutiapa, Jutiapa',
    latitude: 14.2917,
    longitude: -89.8958,
    isBlocked: false,
    visit: {
      type: 'cobro',
      notes: 'Recuperación de saldo vencido Q3,200 en efectivo.',
      distanceMeters: 11
    }
  },
  {
    id: 'cli_gt_reu_13',
    clientCode: 'GT-1013',
    name: 'AGROVETERINARIA REU AGRO',
    companyName: 'Reu Agro Insumos',
    nit: '1928374-5',
    phone: '+502 7771-8899',
    address: '5ta Calle 7-30 Zona 1, Retalhuleu',
    locationAddress: 'Retalhuleu, Retalhuleu',
    latitude: 14.5361,
    longitude: -91.6778,
    isBlocked: false,
    visit: {
      type: 'rutina',
      notes: 'Presentación de nuevo catálogo de productos y precios promocionales.',
      distanceMeters: 25
    }
  },
  {
    id: 'cli_gt_quiche_14',
    clientCode: 'GT-1014',
    name: 'AGROSERVICIOS QUICHE MAYA',
    companyName: 'Agroservicios Quiché Maya',
    nit: '8392014-9',
    phone: '+502 7755-1200',
    address: '2da Avenida 3-15 Zona 1, Santa Cruz del Quiché',
    locationAddress: 'Santa Cruz del Quiché, Quiché',
    latitude: 15.0306,
    longitude: -91.1486,
    isBlocked: false,
    visit: {
      type: 'pedido',
      notes: 'Pedido de antibióticos de amplio espectro e instrumental veterinario.',
      distanceMeters: 16
    }
  },
  {
    id: 'cli_gt_santarosa_15',
    clientCode: 'GT-1015',
    name: 'AGROPECUARIA EL CAFETAL DE CUILAPA',
    companyName: 'El Cafetal de Cuilapa',
    nit: '5192830-1',
    phone: '+502 7886-4400',
    address: 'Barrio El Calvario, Cuilapa, Santa Rosa',
    locationAddress: 'Cuilapa, Santa Rosa',
    latitude: 14.2764,
    longitude: -90.2989,
    isBlocked: false,
    visit: {
      type: 'entrega',
      notes: 'Entrega de desparasitantes y suplementos minerales para ganado lechero.',
      distanceMeters: 14
    }
  }
];

async function runNationalRegistration() {
  const pgClient = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });

  await pgClient.connect();
  console.log('✅ Conectado a Docker PostgreSQL (54322)');

  const nowIso = new Date().toISOString();
  const createdVisits = [];
  const createdClients = [];

  for (const c of NATIONAL_CLIENTS) {
    // 1. Insertar / Actualizar Cliente en BD PostgreSQL Docker
    await pgClient.query(`
      INSERT INTO public.clients (
        id, name, "companyName", nit, phone, address, "createdAt", 
        "clientCode", "isBlocked", latitude, longitude, 
        "locationAddress", location_address, "geotaggedAt", "geotaggedBy",
        "lastVisitAt", last_visit_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17
      ) ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        "companyName" = EXCLUDED."companyName",
        nit = EXCLUDED.nit,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        "clientCode" = EXCLUDED."clientCode",
        "isBlocked" = EXCLUDED."isBlocked",
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        "locationAddress" = EXCLUDED."locationAddress",
        location_address = EXCLUDED.location_address,
        "geotaggedAt" = EXCLUDED."geotaggedAt",
        "geotaggedBy" = EXCLUDED."geotaggedBy",
        "lastVisitAt" = EXCLUDED."lastVisitAt",
        last_visit_at = EXCLUDED.last_visit_at;
    `, [
      c.id, c.name, c.companyName, c.nit, c.phone, c.address, nowIso,
      c.clientCode, c.isBlocked, c.latitude, c.longitude,
      c.locationAddress, c.locationAddress, nowIso, 'Admin Central',
      nowIso, nowIso
    ]);

    createdClients.push({
      id: c.id,
      name: c.name,
      companyName: c.companyName,
      nit: c.nit,
      phone: c.phone,
      address: c.address,
      createdAt: nowIso,
      clientCode: c.clientCode,
      isBlocked: c.isBlocked,
      latitude: c.latitude,
      longitude: c.longitude,
      locationAddress: c.locationAddress,
      geotaggedAt: nowIso,
      geotaggedBy: 'Admin Central',
      lastVisitAt: nowIso
    });

    // 2. Insertar Checkpoint de Visita en BD PostgreSQL Docker
    const visitId = `visit_${c.id}_${Date.now()}`;
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
      ) ON CONFLICT (id) DO NOTHING;
    `, [
      visitId, c.id, c.id, c.name, c.name, c.clientCode, c.clientCode, c.companyName, c.companyName,
      'admin_user_01', 'admin_user_01', 'Equipo de Ruta Agricovet', 'Equipo de Ruta Agricovet', 'seseffff942@gmail.com', 'seseffff942@gmail.com',
      c.latitude, c.longitude, 5.0, c.visit.distanceMeters, c.visit.distanceMeters,
      c.visit.type, c.visit.type, c.visit.notes, null, null, nowIso, nowIso
    ]);

    createdVisits.push({
      id: visitId,
      clientId: c.id,
      client_id: c.id,
      clientName: c.name,
      client_name: c.name,
      clientCode: c.clientCode,
      client_code: c.clientCode,
      companyName: c.companyName,
      company_name: c.companyName,
      sellerId: 'admin_user_01',
      seller_id: 'admin_user_01',
      sellerName: 'Equipo de Ruta Agricovet',
      seller_name: 'Equipo de Ruta Agricovet',
      sellerEmail: 'seseffff942@gmail.com',
      seller_email: 'seseffff942@gmail.com',
      latitude: c.latitude,
      longitude: c.longitude,
      accuracy: 5.0,
      distanceMeters: c.visit.distanceMeters,
      distance_meters: c.visit.distanceMeters,
      visitType: c.visit.type,
      visit_type: c.visit.type,
      notes: c.visit.notes,
      photoUrl: null,
      photo_url: null,
      createdAt: nowIso,
      created_at: nowIso
    });

    console.log(`📍 [${c.clientCode}] ${c.name} (${c.locationAddress}) -> Registrado con éxito.`);
  }

  // 3. Actualizar archivos locales JSON
  const clientsFilePath = path.join(__dirname, '..', 'clients_local.json');
  let currentClients = fs.existsSync(clientsFilePath) ? JSON.parse(fs.readFileSync(clientsFilePath, 'utf8')) : [];
  // Reemplazar o agregar
  for (const newClient of createdClients) {
    const idx = currentClients.findIndex(c => c.id === newClient.id || c.clientCode === newClient.clientCode);
    if (idx >= 0) {
      currentClients[idx] = { ...currentClients[idx], ...newClient };
    } else {
      currentClients.push(newClient);
    }
  }
  fs.writeFileSync(clientsFilePath, JSON.stringify(currentClients, null, 2), 'utf8');
  console.log(`\n💾 clients_local.json actualizado con ${currentClients.length} clientes totales.`);

  const visitsFilePath = path.join(__dirname, '..', 'client_visits_local.json');
  let currentVisits = fs.existsSync(visitsFilePath) ? JSON.parse(fs.readFileSync(visitsFilePath, 'utf8')) : [];
  for (const v of createdVisits) {
    if (!currentVisits.some(item => item.id === v.id)) {
      currentVisits.push(v);
    }
  }
  fs.writeFileSync(visitsFilePath, JSON.stringify(currentVisits, null, 2), 'utf8');
  console.log(`💾 client_visits_local.json actualizado con ${currentVisits.length} checkpoints totales.`);

  // Notificar schema
  await pgClient.query("NOTIFY pgrst, 'reload schema';");
  await pgClient.end();

  console.log('\n🇬🇹 ¡15 Clientes Nacionales de Guatemala registrados y mapeados al 100% en Docker!');
}

runNationalRegistration().catch(console.error);
