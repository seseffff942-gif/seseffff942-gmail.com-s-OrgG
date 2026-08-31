const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const REMOTE_URL = process.env.SUPABASE_URL;
const REMOTE_KEY = process.env.SUPABASE_ANON_KEY;

const remoteSupabase = (REMOTE_URL && REMOTE_KEY) ? createClient(REMOTE_URL, REMOTE_KEY) : null;

async function checkAndSyncToDocker() {
  const pgClient = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  });

  await pgClient.connect();
  console.log('✅ Conectado a Docker PostgreSQL (54322)\n');

  // Asegurar columnas completas en invoices
  await pgClient.query(`
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS client TEXT;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "clientName" TEXT;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS nit TEXT;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS items JSONB;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "totalAmount" NUMERIC;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total_amount NUMERIC;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "paidAmount" NUMERIC;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "sellerId" TEXT;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS seller_id TEXT;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "sellerName" TEXT;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS seller_name TEXT;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS status TEXT;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS date TEXT;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN DEFAULT FALSE;
  `);

  // Asegurar columnas completas en clients
  await pgClient.query(`
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "companyName" TEXT;
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "clientCode" TEXT;
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS latitude NUMERIC;
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS longitude NUMERIC;
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "locationAddress" TEXT;
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS location_address TEXT;
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "geotaggedAt" TEXT;
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS geotagged_at TEXT;
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS "geotaggedBy" TEXT;
    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS geotagged_by TEXT;
  `);

  // 1. Clientes
  const clientsFile = path.join(__dirname, '..', 'clients_local.json');
  if (fs.existsSync(clientsFile)) {
    const clients = JSON.parse(fs.readFileSync(clientsFile, 'utf8'));
    for (const c of clients) {
      await pgClient.query(`
        INSERT INTO public.clients (id, name, "companyName", nit, phone, address, "createdAt", "clientCode", "isBlocked", latitude, longitude, "locationAddress", location_address, "geotaggedAt", "geotaggedBy")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          "companyName" = EXCLUDED."companyName",
          nit = EXCLUDED.nit,
          phone = EXCLUDED.phone,
          address = EXCLUDED.address,
          "clientCode" = EXCLUDED."clientCode",
          "isBlocked" = EXCLUDED."isBlocked",
          latitude = COALESCE(EXCLUDED.latitude, public.clients.latitude),
          longitude = COALESCE(EXCLUDED.longitude, public.clients.longitude),
          "locationAddress" = COALESCE(EXCLUDED."locationAddress", public.clients."locationAddress"),
          location_address = COALESCE(EXCLUDED.location_address, public.clients.location_address),
          "geotaggedAt" = COALESCE(EXCLUDED."geotaggedAt", public.clients."geotaggedAt"),
          "geotaggedBy" = COALESCE(EXCLUDED."geotaggedBy", public.clients."geotaggedBy");
      `, [
        c.id, c.name, c.companyName || null, c.nit || null, c.phone || null, c.address || null, c.createdAt || new Date().toISOString(),
        c.clientCode || null, c.isBlocked || false, c.latitude || null, c.longitude || null, c.locationAddress || null, c.locationAddress || null,
        c.geotaggedAt || null, c.geotaggedBy || null
      ]);
    }
    const countRes = await pgClient.query(`SELECT count(*) FROM public.clients;`);
    console.log(`✅ Clientes en Docker: ${countRes.rows[0].count} registros.`);
  }

  // 2. Visitas
  const visitsFile = path.join(__dirname, '..', 'client_visits_local.json');
  if (fs.existsSync(visitsFile)) {
    const visits = JSON.parse(fs.readFileSync(visitsFile, 'utf8'));
    for (const v of visits) {
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
        v.id, v.clientId || v.client_id, v.clientId || v.client_id, v.clientName || v.client_name, v.clientName || v.client_name,
        v.clientCode || v.client_code, v.clientCode || v.client_code, v.companyName || v.company_name, v.companyName || v.company_name,
        v.sellerId || v.seller_id, v.sellerId || v.seller_id, v.sellerName || v.seller_name, v.sellerName || v.seller_name,
        v.sellerEmail || v.seller_email, v.sellerEmail || v.seller_email,
        v.latitude || 0, v.longitude || 0, v.accuracy || 0, v.distanceMeters || v.distance_meters || 0, v.distanceMeters || v.distance_meters || 0,
        v.visitType || v.visit_type || 'rutina', v.visitType || v.visit_type || 'rutina', v.notes || '', v.photoUrl || v.photo_url || null, v.photoUrl || v.photo_url || null,
        v.createdAt || v.created_at || new Date().toISOString(), v.createdAt || v.created_at || new Date().toISOString()
      ]);
    }
    const countVisits = await pgClient.query(`SELECT count(*) FROM public.client_visits;`);
    console.log(`✅ Visitas en Docker: ${countVisits.rows[0].count} checkpoints.`);
  }

  // 3. Sync from Remote Supabase
  if (remoteSupabase) {
    console.log('\n🌐 Sincronizando productos, facturas, pagos y usuarios desde Supabase remoto...');
    
    // Productos
    const { data: remoteProducts } = await remoteSupabase.from('products').select('*');
    if (remoteProducts && remoteProducts.length > 0) {
      for (const p of remoteProducts) {
        await pgClient.query(`
          INSERT INTO public.products (id, name, category, stock, price, description, image, variants, specifications, is_external)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            stock = EXCLUDED.stock,
            price = EXCLUDED.price,
            description = EXCLUDED.description,
            image = EXCLUDED.image,
            variants = EXCLUDED.variants,
            specifications = EXCLUDED.specifications,
            is_external = EXCLUDED.is_external;
        `, [p.id, p.name, p.category, p.stock, p.price, p.description, p.image, JSON.stringify(p.variants || null), JSON.stringify(p.specifications || null), p.is_external || false]);
      }
      console.log(`✅ Productos: ${remoteProducts.length} sincronizados.`);
    }

    // Facturas
    const { data: remoteInvoices } = await remoteSupabase.from('invoices').select('*');
    if (remoteInvoices && remoteInvoices.length > 0) {
      for (const inv of remoteInvoices) {
        await pgClient.query(`
          INSERT INTO public.invoices (id, client, "clientName", nit, phone, address, items, "totalAmount", total_amount, "paidAmount", paid_amount, "sellerId", seller_id, status, date, notes, is_archived)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO UPDATE SET
            client = EXCLUDED.client,
            "clientName" = EXCLUDED."clientName",
            nit = EXCLUDED.nit,
            phone = EXCLUDED.phone,
            address = EXCLUDED.address,
            items = EXCLUDED.items,
            "totalAmount" = EXCLUDED."totalAmount",
            total_amount = EXCLUDED.total_amount,
            "paidAmount" = EXCLUDED."paidAmount",
            paid_amount = EXCLUDED.paid_amount,
            "sellerId" = EXCLUDED."sellerId",
            seller_id = EXCLUDED.seller_id,
            status = EXCLUDED.status,
            date = EXCLUDED.date,
            notes = EXCLUDED.notes,
            is_archived = EXCLUDED.is_archived;
        `, [
          inv.id, inv.client || inv.clientName || '', inv.clientName || inv.client || '', inv.nit || '', inv.phone || '', inv.address || '', JSON.stringify(inv.items || []),
          inv.totalAmount || inv.total_amount || 0, inv.totalAmount || inv.total_amount || 0,
          inv.paidAmount || inv.paid_amount || 0, inv.paidAmount || inv.paid_amount || 0,
          inv.sellerId || inv.seller_id || null, inv.sellerId || inv.seller_id || null,
          inv.status || 'pendiente', inv.date || new Date().toISOString(), inv.notes || '', inv.is_archived || false
        ]);
      }
      const countInvoices = await pgClient.query(`SELECT count(*) FROM public.invoices;`);
      console.log(`✅ Facturas: ${countInvoices.rows[0].count} facturas sincronizadas en Docker.`);
    }

    // Pagos
    const { data: remotePayments } = await remoteSupabase.from('payments').select('*');
    if (remotePayments && remotePayments.length > 0) {
      await pgClient.query(`
        ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;
        ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS invoice_id TEXT;
        ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS "receiptUrl" TEXT;
        ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_url TEXT;
      `);
      for (const pay of remotePayments) {
        await pgClient.query(`
          INSERT INTO public.payments (id, "invoiceId", invoice_id, amount, date, "receiptUrl", receipt_url, is_archived)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            "invoiceId" = EXCLUDED."invoiceId",
            invoice_id = EXCLUDED.invoice_id,
            amount = EXCLUDED.amount,
            date = EXCLUDED.date,
            "receiptUrl" = EXCLUDED."receiptUrl",
            receipt_url = EXCLUDED.receipt_url,
            is_archived = EXCLUDED.is_archived;
        `, [
          pay.id, pay.invoiceId || pay.invoice_id, pay.invoiceId || pay.invoice_id,
          pay.amount, pay.date, pay.receiptUrl || pay.receipt_url || null, pay.receiptUrl || pay.receipt_url || null,
          pay.is_archived || false
        ]);
      }
      const countPayments = await pgClient.query(`SELECT count(*) FROM public.payments;`);
      console.log(`✅ Pagos: ${countPayments.rows[0].count} pagos sincronizados en Docker.`);
    }

    // Usuarios
    const { data: remoteUsers } = await remoteSupabase.from('users').select('*');
    if (remoteUsers && remoteUsers.length > 0) {
      for (const u of remoteUsers) {
        await pgClient.query(`
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
        `, [u.id, u.name, u.email, u.role, u.password, u.photo, u.phone || null, u.sellerCode || u.seller_code || null]);
      }
      const countUsers = await pgClient.query(`SELECT count(*) FROM public.users;`);
      console.log(`✅ Usuarios: ${countUsers.rows[0].count} usuarios en Docker.`);
    }
  }

  await pgClient.query("NOTIFY pgrst, 'reload schema';");
  console.log('\n🎉 Sincronización completa y exitosa en Supabase Docker.');
  await pgClient.end();
}

checkAndSyncToDocker().catch(console.error);
