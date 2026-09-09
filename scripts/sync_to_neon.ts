import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const neonUrl = process.env.NEON_DATABASE_URL;
const sbUrl = process.env.SUPABASE_URL || 'https://vedgedsbuajueynnyvpn.supabase.co';
const sbKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';

const supabase = createClient(sbUrl, sbKey);
const pool = new pg.Pool({
  connectionString: neonUrl,
  ssl: { rejectUnauthorized: false }
});

async function syncAllData() {
  console.log('🔄 Iniciando sincronización de respaldo hacia Neon...');
  const client = await pool.connect();
  
  try {
    // 1. Sincronizar Usuarios
    const { data: users, error: uErr } = await supabase.from('users').select('*');
    if (!uErr && users && users.length > 0) {
      console.log(`👤 Sincronizando ${users.length} usuarios...`);
      for (const u of users) {
        await client.query(`
          INSERT INTO public.users (id, name, email, role, password, photo, phone, "sellerCode")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            role = EXCLUDED.role,
            password = EXCLUDED.password,
            photo = EXCLUDED.photo,
            phone = EXCLUDED.phone,
            "sellerCode" = EXCLUDED."sellerCode";
        `, [u.id, u.name, u.email, u.role, u.password || '123', u.photo, u.phone, u.sellerCode]);
      }
      console.log('✅ Usuarios sincronizados.');
    }

    // 2. Sincronizar Productos
    const { data: products, error: pErr } = await supabase.from('products').select('*');
    if (!pErr && products && products.length > 0) {
      console.log(`📦 Sincronizando ${products.length} productos...`);
      for (const p of products) {
        await client.query(`
          INSERT INTO public.products (id, name, category, stock, price, description, image, variants, specifications)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            stock = EXCLUDED.stock,
            price = EXCLUDED.price,
            description = EXCLUDED.description,
            image = EXCLUDED.image,
            variants = EXCLUDED.variants,
            specifications = EXCLUDED.specifications;
        `, [p.id, p.name, p.category, p.stock, p.price, p.description, p.image, JSON.stringify(p.variants || null), JSON.stringify(p.specifications || null)]);
      }
      console.log('✅ Productos sincronizados.');
    }

    // 3. Asegurar columnas de Clientes y Sincronizar
    await client.query(`
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "sellerId" TEXT;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "seller_id" TEXT;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "department" TEXT;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "municipality" TEXT;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "village" TEXT;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "contactName" TEXT;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "contact_name" TEXT;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "companyName" TEXT;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "clientCode" TEXT;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN DEFAULT FALSE;
      ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "createdAt" TEXT;
    `);

    const { data: clients, error: cErr } = await supabase.from('clients').select('*');
    if (!cErr && clients && clients.length > 0) {
      console.log(`👥 Sincronizando ${clients.length} clientes...`);
      for (const c of clients) {
        await client.query(`
          INSERT INTO public.clients (id, name, phone, department, municipality, village, "sellerId", nit, address, "contactName")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            phone = EXCLUDED.phone,
            department = EXCLUDED.department,
            municipality = EXCLUDED.municipality,
            village = EXCLUDED.village,
            "sellerId" = EXCLUDED."sellerId",
            nit = EXCLUDED.nit,
            address = EXCLUDED.address,
            "contactName" = EXCLUDED."contactName";
        `, [c.id, c.name, c.phone, c.department || c.departamento || '', c.municipality || c.municipio || '', c.village || c.aldea || '', c.sellerId || c.seller_id, c.nit, c.address, c.contactName || c.contact_name]);
      }
      console.log('✅ Clientes sincronizados.');
    }


    console.log('\n🎉 ¡Respaldo completado! Neon tiene todos tus datos al día.');
  } catch (err: any) {
    console.error('❌ Error sincronizando:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

syncAllData();
