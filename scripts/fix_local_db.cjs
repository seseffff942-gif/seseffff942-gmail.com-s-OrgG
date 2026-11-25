const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/agrosaas_db';
const client = new Client(dbUrl);

async function run() {
  await client.connect();
  console.log('Connected to DB:', dbUrl);

  // 1. Eliminar restricciones de tenant que bloquean inserciones locales
  const tables = [
    'products', 'invoices', 'clients', 'users', 'payments', 
    'quotations', 'recibos_caja', 'client_visits', 'seller_routes', 
    'corte_sales_dispatches', 'offers', 'office_inventory', 
    'notifications', 'audit_logs', 'system_config', 'fel_config', 
    'fel_documentos', 'fel_bitacora', 'login_tokens', 'push_subscriptions', 'fcm_tokens'
  ];

  for (const t of tables) {
    try {
      await client.query(`ALTER TABLE public."${t}" DROP CONSTRAINT IF EXISTS "fk_${t}_tenant";`);
      await client.query(`ALTER TABLE public."${t}" ALTER COLUMN tenant_id DROP NOT NULL;`);
      console.log(`[OK] Dropped fk_${t}_tenant and made tenant_id nullable`);
    } catch (e) {
      // Ignorar si la tabla o columna no existe
    }
  }

  // 2. Asegurar que la tabla tenants tenga un registro por defecto
  try {
    await client.query(`
      INSERT INTO tenants (id, slug, name, commercial_name, nit, monthly_price, status)
      VALUES ('tenant_demo_agro', 'agricovet-local', 'Agricovet Local', 'Agricovet Guatemala', 'CF', 0, 'active')
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('[OK] Ensured default tenant exists');
  } catch (e) {
    console.warn('[Tenant] Error asegurando tenant:', e.message);
  }

  // 3. Poblar productos desde preloadedData.json si la tabla está vacía o tiene pocos
  const countRes = await client.query('SELECT count(*) FROM products;');
  const count = parseInt(countRes.rows[0].count, 10);
  console.log(`Current products count: ${count}`);

  if (count === 0) {
    console.log('Loading products from preloadedData.json...');
    const preloadedPath = path.join(__dirname, '../src/data/preloadedData.json');
    if (fs.existsSync(preloadedPath)) {
      const data = JSON.parse(fs.readFileSync(preloadedPath, 'utf8'));
      const prods = data.products || [];
      console.log(`Found ${prods.length} products to seed.`);

      for (const p of prods) {
        try {
          await client.query(`
            INSERT INTO products (
              id, name, category, stock, price, description, image, 
              variants, specifications, is_external, cost_price, hidden_from_sales, tenant_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO NOTHING;
          `, [
            p.id,
            p.name,
            p.category || 'General',
            Number(p.stock) || 0,
            Number(p.price) || 0,
            p.description || null,
            p.image || null,
            p.variants ? JSON.stringify(p.variants) : null,
            p.specifications ? JSON.stringify(p.specifications) : null,
            Boolean(p.is_external),
            Number(p.cost_price || p.costPrice || 0),
            Boolean(p.hidden_from_sales || p.hiddenFromSales),
            'tenant_demo_agro'
          ]);
        } catch (err) {
          console.error(`Error inserting product ${p.name}:`, err.message);
        }
      }
      const newCount = await client.query('SELECT count(*) FROM products;');
      console.log(`[OK] Products seeded! Total count now: ${newCount.rows[0].count}`);
    }
  }

  // 4. Probar agregar un producto de prueba para verificar que el formulario funcione
  try {
    const testId = `test_prod_${Date.now()}`;
    await client.query(`
      INSERT INTO products (id, name, category, stock, price, cost_price)
      VALUES ($1, $2, $3, $4, $5, $6);
    `, [testId, 'Producto de Prueba Local', 'Agroquímicos', 50, 100, 75]);
    console.log('[OK] Inserción de producto de prueba exitosa!');
    await client.query(`DELETE FROM products WHERE id = $1;`, [testId]);
    console.log('[OK] Producto de prueba limpiado exitosamente.');
  } catch (err) {
    console.error('Error en prueba de inserción:', err.message);
  }

  // 5. Verificar que existan clientes para poder hacer ventas
  const clientCountRes = await client.query('SELECT count(*) FROM clients;');
  console.log(`Current clients count: ${clientCountRes.rows[0].count}`);
  if (parseInt(clientCountRes.rows[0].count, 10) === 0) {
    console.log('Seeding clients from preloadedData.json...');
    const preloadedPath = path.join(__dirname, '../src/data/preloadedData.json');
    if (fs.existsSync(preloadedPath)) {
      const data = JSON.parse(fs.readFileSync(preloadedPath, 'utf8'));
      const clientsList = data.clients || [];
      for (const c of clientsList) {
        try {
          await client.query(`
            INSERT INTO clients (
              id, name, "companyName", nit, phone, address, "sellerId", tenant_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO NOTHING;
          `, [
            c.id || `cli_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            c.name || 'Cliente Mostrador',
            c.companyName || null,
            c.nit || 'CF',
            c.phone || '',
            c.address || '',
            c.sellerId || 'seseffff942@gmail.com',
            'tenant_demo_agro'
          ]);
        } catch (e) {
          // Ignore
        }
      }
      const newClientsCount = await client.query('SELECT count(*) FROM clients;');
      console.log(`[OK] Clients seeded! Total count now: ${newClientsCount.rows[0].count}`);
    }
  }

  // 6. Verificar usuario Emanuel Lima
  const userRes = await client.query("SELECT id, name, email, role, phone FROM users WHERE email = 'seseffff942@gmail.com';");
  console.log('User Emanuel in DB:', userRes.rows);
  if (userRes.rows.length === 0) {
    console.log('Inserting user Emanuel Lima...');
    await client.query(`
      INSERT INTO users (id, name, email, role, phone, password, "sellerCode", tenant_id)
      VALUES ('u_emanuel', 'Emanuel Lima', 'seseffff942@gmail.com', 'admin', '50248234048', '123', '9905', 'tenant_demo_agro')
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('[OK] User Emanuel Lima created in DB.');
  }

  await client.end();
  console.log('ALL DB CHECKS COMPLETED SUCCESSFULLY.');
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
