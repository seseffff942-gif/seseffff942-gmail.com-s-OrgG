const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const REMOTE_URL = process.env.SUPABASE_URL;
const REMOTE_KEY = process.env.SUPABASE_ANON_KEY;
const remoteSupabase = (REMOTE_URL && REMOTE_KEY) ? createClient(REMOTE_URL, REMOTE_KEY) : null;

// Realistic seller routes:
// 1. Erick Juárez (Vendedor Central / Verapaces / Oriente):
//    - Hoy (2026-08-30): EXACTAMENTE 2 clientes en ruta lógica (Guatemala -> Chimaltenango)
//    - 25 Ago: Cobán -> Izabal
//    - 19 Ago: Zacapa
// 2. Herbert Argueta (Vendedor Costa Sur / Occidente):
//    - 28 Ago: Escuintla -> Suchitepéquez (Mazatenango) -> Retalhuleu
//    - 21 Ago: Quetzaltenango (Xela) -> San Marcos
//    - 16 Ago: Jutiapa -> Santa Rosa (Cuilapa)
//    - 11 Ago: Huehuetenango

const realisticVisits = [
  // ================= ERICK JUÁREZ (HOY: EXACTAMENTE 2 CLIENTES) =================
  {
    id: 'visit_erick_20260830_01',
    clientId: 'cli_gt_guatemala_01',
    client_id: 'cli_gt_guatemala_01',
    clientName: 'AGROSERVICIO EL TRIUNFO S.A.',
    client_name: 'AGROSERVICIO EL TRIUNFO S.A.',
    clientCode: 'GT-1001',
    client_code: 'GT-1001',
    companyName: 'Agroservicio El Triunfo',
    company_name: 'Agroservicio El Triunfo',
    sellerId: 'u_1780897737916',
    seller_id: 'u_1780897737916',
    sellerName: 'Erick Juárez',
    seller_name: 'Erick Juárez',
    sellerEmail: 'jerickottoniel@gmail.com',
    seller_email: 'jerickottoniel@gmail.com',
    latitude: 14.6038,
    longitude: -90.5186,
    accuracy: 5,
    distanceMeters: 12,
    distance_meters: 12,
    visitType: 'pedido',
    visit_type: 'pedido',
    notes: 'Primera visita de la mañana en Ciudad de Guatemala. Levantamiento de pedido de fertilizantes y vitaminas.',
    photoUrl: null,
    photo_url: null,
    createdAt: '2026-08-30T15:30:00.000Z', // 09:30 AM GT
    created_at: '2026-08-30T15:30:00.000Z'
  },
  {
    id: 'visit_erick_20260830_02',
    clientId: 'cli_gt_chimal_10',
    client_id: 'cli_gt_chimal_10',
    clientName: 'AGROVETERINARIA EL CAMPESINO CHIMALTENANGO',
    client_name: 'AGROVETERINARIA EL CAMPESINO CHIMALTENANGO',
    clientCode: 'GT-1010',
    client_code: 'GT-1010',
    companyName: 'El Campesino Chimaltenango',
    company_name: 'El Campesino Chimaltenango',
    sellerId: 'u_1780897737916',
    seller_id: 'u_1780897737916',
    sellerName: 'Erick Juárez',
    seller_name: 'Erick Juárez',
    sellerEmail: 'jerickottoniel@gmail.com',
    seller_email: 'jerickottoniel@gmail.com',
    latitude: 14.6611,
    longitude: -90.8194,
    accuracy: 6,
    distanceMeters: 18,
    distance_meters: 18,
    visitType: 'cobro',
    visit_type: 'cobro',
    notes: 'Segunda parada del día en Chimaltenango. Cobro de saldo pendiente de Q3,200 recibido en efectivo.',
    photoUrl: null,
    photo_url: null,
    createdAt: '2026-08-30T17:45:00.000Z', // 11:45 AM GT
    created_at: '2026-08-30T17:45:00.000Z'
  },

  // Erick Juárez - Rutas anteriores
  {
    id: 'visit_erick_20260825_01',
    clientId: 'cli_gt_coban_04',
    client_id: 'cli_gt_coban_04',
    clientName: 'AGROPECUARIA LA SEMILLA VERAPAZ',
    client_name: 'AGROPECUARIA LA SEMILLA VERAPAZ',
    clientCode: 'GT-1004',
    client_code: 'GT-1004',
    companyName: 'Agropecuaria La Semilla',
    company_name: 'Agropecuaria La Semilla',
    sellerId: 'u_1780897737916',
    seller_id: 'u_1780897737916',
    sellerName: 'Erick Juárez',
    seller_name: 'Erick Juárez',
    sellerEmail: 'jerickottoniel@gmail.com',
    seller_email: 'jerickottoniel@gmail.com',
    latitude: 15.4708,
    longitude: -90.3708,
    accuracy: 5,
    distanceMeters: 10,
    distance_meters: 10,
    visitType: 'rutina',
    visit_type: 'rutina',
    notes: 'Visita técnica en Cobán Alta Verapaz.',
    photoUrl: null,
    photo_url: null,
    createdAt: '2026-08-25T16:00:00.000Z',
    created_at: '2026-08-25T16:00:00.000Z'
  },
  {
    id: 'visit_erick_20260825_02',
    clientId: 'cli_gt_izabal_06',
    client_id: 'cli_gt_izabal_06',
    clientName: 'AGROINSUMOS DEL CARIBE',
    client_name: 'AGROINSUMOS DEL CARIBE',
    clientCode: 'GT-1006',
    client_code: 'GT-1006',
    companyName: 'Agroinsumos del Caribe',
    company_name: 'Agroinsumos del Caribe',
    sellerId: 'u_1780897737916',
    seller_id: 'u_1780897737916',
    sellerName: 'Erick Juárez',
    seller_name: 'Erick Juárez',
    sellerEmail: 'jerickottoniel@gmail.com',
    seller_email: 'jerickottoniel@gmail.com',
    latitude: 15.7278,
    longitude: -88.5944,
    accuracy: 8,
    distanceMeters: 14,
    distance_meters: 14,
    visitType: 'entrega',
    visit_type: 'entrega',
    notes: 'Entrega de producto en Puerto Barrios Izabal.',
    photoUrl: null,
    photo_url: null,
    createdAt: '2026-08-25T20:30:00.000Z',
    created_at: '2026-08-25T20:30:00.000Z'
  },
  {
    id: 'visit_erick_20260819_01',
    clientId: 'cli_gt_zacapa_08',
    client_id: 'cli_gt_zacapa_08',
    clientName: 'AGROSERVICIOS DEL ORIENTE TECUN',
    client_name: 'AGROSERVICIOS DEL ORIENTE TECUN',
    clientCode: 'GT-1008',
    client_code: 'GT-1008',
    companyName: 'Agroservicios del Oriente',
    company_name: 'Agroservicios del Oriente',
    sellerId: 'u_1780897737916',
    seller_id: 'u_1780897737916',
    sellerName: 'Erick Juárez',
    seller_name: 'Erick Juárez',
    sellerEmail: 'jerickottoniel@gmail.com',
    seller_email: 'jerickottoniel@gmail.com',
    latitude: 14.9722,
    longitude: -89.5306,
    accuracy: 5,
    distanceMeters: 11,
    distance_meters: 11,
    visitType: 'pedido',
    visit_type: 'pedido',
    notes: 'Reunión en Zacapa para pedido de insumos ganaderos.',
    photoUrl: null,
    photo_url: null,
    createdAt: '2026-08-19T18:00:00.000Z',
    created_at: '2026-08-19T18:00:00.000Z'
  },

  // ================= HERBERT ARGUETA (RUTA COSTA SUR & OCCIDENTE) =================
  {
    id: 'visit_herbert_20260828_01',
    clientId: 'cli_gt_escuintla_03',
    client_id: 'cli_gt_escuintla_03',
    clientName: 'DISTRIBUIDORA AGRICOLA DEL SUR PACIFICO',
    client_name: 'DISTRIBUIDORA AGRICOLA DEL SUR PACIFICO',
    clientCode: 'GT-1003',
    client_code: 'GT-1003',
    companyName: 'Agrícola del Sur Pacífico',
    company_name: 'Agrícola del Sur Pacífico',
    sellerId: 'u_1780870803300',
    seller_id: 'u_1780870803300',
    sellerName: 'Herbert Argueta',
    seller_name: 'Herbert Argueta',
    sellerEmail: 'gruasytransportesali@gmail.com',
    seller_email: 'gruasytransportesali@gmail.com',
    latitude: 14.3009,
    longitude: -90.785,
    accuracy: 5,
    distanceMeters: 15,
    distance_meters: 15,
    visitType: 'pedido',
    visit_type: 'pedido',
    notes: 'Salida de ruta Costa Sur en Escuintla.',
    photoUrl: null,
    photo_url: null,
    createdAt: '2026-08-28T15:00:00.000Z', // 09:00 AM GT
    created_at: '2026-08-28T15:00:00.000Z'
  },
  {
    id: 'visit_herbert_20260828_02',
    clientId: 'cli_gt_suchi_11',
    client_id: 'cli_gt_suchi_11',
    clientName: 'AGROPECUARIA COSTA SUR MAZATENANGO',
    client_name: 'AGROPECUARIA COSTA SUR MAZATENANGO',
    clientCode: 'GT-1011',
    client_code: 'GT-1011',
    companyName: 'Agropecuaria Costa Sur',
    company_name: 'Agropecuaria Costa Sur',
    sellerId: 'u_1780870803300',
    seller_id: 'u_1780870803300',
    sellerName: 'Herbert Argueta',
    seller_name: 'Herbert Argueta',
    sellerEmail: 'gruasytransportesali@gmail.com',
    seller_email: 'gruasytransportesali@gmail.com',
    latitude: 14.5342,
    longitude: -91.5033,
    accuracy: 6,
    distanceMeters: 18,
    distance_meters: 18,
    visitType: 'cobro',
    visit_type: 'cobro',
    notes: 'Segunda parada en Mazatenango Suchitepéquez.',
    photoUrl: null,
    photo_url: null,
    createdAt: '2026-08-28T18:30:00.000Z', // 12:30 PM GT
    created_at: '2026-08-28T18:30:00.000Z'
  },
  {
    id: 'visit_herbert_20260828_03',
    clientId: 'cli_gt_retal_13',
    client_id: 'cli_gt_retal_13',
    clientName: 'AGROPECUARIA LA HERRADURA RETALHULEU',
    client_name: 'AGROPECUARIA LA HERRADURA RETALHULEU',
    clientCode: 'GT-1013',
    client_code: 'GT-1013',
    companyName: 'La Herradura Retalhuleu',
    company_name: 'La Herradura Retalhuleu',
    sellerId: 'u_1780870803300',
    seller_id: 'u_1780870803300',
    sellerName: 'Herbert Argueta',
    seller_name: 'Herbert Argueta',
    sellerEmail: 'gruasytransportesali@gmail.com',
    seller_email: 'gruasytransportesali@gmail.com',
    latitude: 14.5361,
    longitude: -91.6778,
    accuracy: 5,
    distanceMeters: 20,
    distance_meters: 20,
    visitType: 'rutina',
    visit_type: 'rutina',
    notes: 'Cierre de ruta en Retalhuleu.',
    photoUrl: null,
    photo_url: null,
    createdAt: '2026-08-28T21:00:00.000Z', // 03:00 PM GT
    created_at: '2026-08-28T21:00:00.000Z'
  },

  // Herbert - Rutas anteriores
  {
    id: 'visit_herbert_20260821_01',
    clientId: 'cli_gt_xela_02',
    client_id: 'cli_gt_xela_02',
    clientName: 'AGROVETERINARIA LOS ALTOS DE OCCIDENTE',
    client_name: 'AGROVETERINARIA LOS ALTOS DE OCCIDENTE',
    clientCode: 'GT-1002',
    client_code: 'GT-1002',
    companyName: 'Agroveterinaria Los Altos',
    company_name: 'Agroveterinaria Los Altos',
    sellerId: 'u_1780870803300',
    seller_id: 'u_1780870803300',
    sellerName: 'Herbert Argueta',
    seller_name: 'Herbert Argueta',
    sellerEmail: 'gruasytransportesali@gmail.com',
    seller_email: 'gruasytransportesali@gmail.com',
    latitude: 14.8347,
    longitude: -91.518,
    accuracy: 5,
    distanceMeters: 12,
    distance_meters: 12,
    visitType: 'rutina',
    visit_type: 'rutina',
    notes: 'Visita en Quetzaltenango.',
    photoUrl: null,
    photo_url: null,
    createdAt: '2026-08-21T16:00:00.000Z',
    created_at: '2026-08-21T16:00:00.000Z'
  },
  {
    id: 'visit_herbert_20260821_02',
    clientId: 'cli_gt_sanmarcos_09',
    client_id: 'cli_gt_sanmarcos_09',
    clientName: 'DISTRIBUIDORA AGRICOLA LA UNION SAN MARCOS',
    client_name: 'DISTRIBUIDORA AGRICOLA LA UNION SAN MARCOS',
    clientCode: 'GT-1009',
    client_code: 'GT-1009',
    companyName: 'Distribuidora La Unión',
    company_name: 'Distribuidora La Unión',
    sellerId: 'u_1780870803300',
    seller_id: 'u_1780870803300',
    sellerName: 'Herbert Argueta',
    seller_name: 'Herbert Argueta',
    sellerEmail: 'gruasytransportesali@gmail.com',
    seller_email: 'gruasytransportesali@gmail.com',
    latitude: 14.9639,
    longitude: -91.7944,
    accuracy: 6,
    distanceMeters: 15,
    distance_meters: 15,
    visitType: 'pedido',
    visit_type: 'pedido',
    notes: 'Pedido en San Marcos.',
    photoUrl: null,
    photo_url: null,
    createdAt: '2026-08-21T19:30:00.000Z',
    created_at: '2026-08-21T19:30:00.000Z'
  },
  {
    id: 'visit_herbert_20260816_01',
    clientId: 'cli_gt_jutiapa_12',
    client_id: 'cli_gt_jutiapa_12',
    clientName: 'AGROINSUMOS LA CUNA DEL SOL JUTIAPA',
    client_name: 'AGROINSUMOS LA CUNA DEL SOL JUTIAPA',
    clientCode: 'GT-1012',
    client_code: 'GT-1012',
    companyName: 'La Cuna del Sol',
    company_name: 'La Cuna del Sol',
    sellerId: 'u_1780870803300',
    seller_id: 'u_1780870803300',
    sellerName: 'Herbert Argueta',
    seller_name: 'Herbert Argueta',
    sellerEmail: 'gruasytransportesali@gmail.com',
    seller_email: 'gruasytransportesali@gmail.com',
    latitude: 14.2917,
    longitude: -89.8958,
    accuracy: 5,
    distanceMeters: 14,
    distance_meters: 14,
    visitType: 'cobro',
    visit_type: 'cobro',
    notes: 'Cobro en Jutiapa.',
    photoUrl: null,
    photo_url: null,
    createdAt: '2026-08-16T15:00:00.000Z',
    created_at: '2026-08-16T15:00:00.000Z'
  },
  {
    id: 'visit_herbert_20260816_02',
    clientId: 'cli_gt_santarosa_15',
    client_id: 'cli_gt_santarosa_15',
    clientName: 'AGROPECUARIA EL CAFETAL DE CUILAPA',
    client_name: 'AGROPECUARIA EL CAFETAL DE CUILAPA',
    clientCode: 'GT-1015',
    client_code: 'GT-1015',
    companyName: 'El Cafetal de Cuilapa',
    company_name: 'El Cafetal de Cuilapa',
    sellerId: 'u_1780870803300',
    seller_id: 'u_1780870803300',
    sellerName: 'Herbert Argueta',
    seller_name: 'Herbert Argueta',
    sellerEmail: 'gruasytransportesali@gmail.com',
    seller_email: 'gruasytransportesali@gmail.com',
    latitude: 14.2764,
    longitude: -90.2989,
    accuracy: 6,
    distanceMeters: 12,
    distance_meters: 12,
    visitType: 'rutina',
    visit_type: 'rutina',
    notes: 'Visita en Cuilapa Santa Rosa.',
    photoUrl: null,
    photo_url: null,
    createdAt: '2026-08-16T18:15:00.000Z',
    created_at: '2026-08-16T18:15:00.000Z'
  }
];

async function syncRealisticVisits() {
  const visitsFile = path.join(__dirname, '..', 'client_visits_local.json');
  fs.writeFileSync(visitsFile, JSON.stringify(realisticVisits, null, 2), 'utf8');
  console.log(`📁 client_visits_local.json actualizado con ${realisticVisits.length} visitas por vendedor.`);

  // 1. Docker PostgreSQL
  const pgClient = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });

  await pgClient.connect();
  await pgClient.query('DELETE FROM public.client_visits;');
  console.log('🧹 Tabla client_visits vaciada en Docker.');

  for (const v of realisticVisits) {
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
      v.id, v.clientId, v.clientId, v.clientName, v.clientName,
      v.clientCode, v.clientCode, v.companyName, v.companyName,
      v.sellerId, v.sellerId, v.sellerName, v.sellerName,
      v.sellerEmail, v.sellerEmail,
      v.latitude, v.longitude, v.accuracy, v.distanceMeters, v.distanceMeters,
      v.visitType, v.visitType, v.notes, v.photoUrl, v.photoUrl,
      v.createdAt, v.createdAt
    ]);
  }

  const todayCount = await pgClient.query("SELECT count(*) FROM public.client_visits WHERE \"createdAt\"::text LIKE '2026-08-30%';");
  console.log(`✅ Docker: Total ${realisticVisits.length} visitas. Visitas de HOY: ${todayCount.rows[0].count}`);

  await pgClient.query("NOTIFY pgrst, 'reload schema';");
  await pgClient.end();

  // 2. Supabase remoto
  if (remoteSupabase) {
    try {
      console.log('🌐 Sincronizando con Supabase remoto...');
      await remoteSupabase.from('client_visits').delete().neq('id', '0_none');
      for (const v of realisticVisits) {
        await remoteSupabase.from('client_visits').insert([v]);
      }
      console.log('✅ Supabase remoto actualizado.');
    } catch (e) {
      console.warn('⚠️ Supabase remoto:', e.message);
    }
  }

  console.log('🎉 Rutas realistas configuradas con éxito.');
}

syncRealisticVisits().catch(console.error);
