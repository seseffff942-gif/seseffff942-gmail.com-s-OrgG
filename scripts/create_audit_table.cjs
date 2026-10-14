const { Client } = require('pg');

async function createAuditTable() {
  const connStr = process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/postgres';
  const client = new Client({ connectionString: connStr });
  await client.connect();

  console.log('Creando tabla public.audit_logs...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      category TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      entity_name TEXT,
      description TEXT NOT NULL,
      previous_data JSONB,
      new_data JSONB,
      user_id TEXT,
      user_email TEXT,
      user_name TEXT,
      user_role TEXT,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON public.audit_logs (category);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_email ON public.audit_logs (user_email);
  `);

  console.log('✅ Tabla public.audit_logs creada exitosamente.');

  // Sembrar los primeros eventos históricos clave para que no empiece vacía (incluyendo la resolución del incidente GT-1013):
  const countRes = await client.query('SELECT count(*) FROM public.audit_logs');
  if (parseInt(countRes.rows[0].count) === 0) {
    console.log('Sembrando eventos iniciales de auditoría...');
    const initialEvents = [
      {
        id: `audit_${Date.now()}_01`,
        action: 'SECURITY_CLEANUP',
        category: 'seguridad',
        entity_type: 'client',
        entity_id: 'cli_gt_reu_13',
        entity_name: 'AGROVETERINARIA REU AGRO (GT-1013)',
        description: 'Eliminación y purga definitiva del cliente de prueba GT-1013 y desvinculación de folios robados por algoritmo difuso.',
        previous_data: JSON.stringify({ clientCode: 'GT-1013', name: 'AGROVETERINARIA REU AGRO', hijackedFolios: [887, 809, 812, 894, 811, 966, 969, 959, 955, 945, 900, 910, 871] }),
        new_data: JSON.stringify({ status: 'PURGED', foliosRestored: true }),
        user_id: 'u1b',
        user_email: 'seseffff942@gmail.com',
        user_name: 'Emanuel Lima',
        user_role: 'admin',
        created_at: new Date().toISOString()
      },
      {
        id: `audit_${Date.now() - 3600000}_02`,
        action: 'ALGORITHM_FIXED',
        category: 'sistema',
        entity_type: 'system',
        entity_id: 'server_sales_tracking',
        entity_name: 'Algoritmo de Conciliación de Folios & Clientes',
        description: 'Actualización del algoritmo de coincidencia de facturas para excluir palabras genéricas del rubro y restaurar folios a sus clientes legítimos.',
        previous_data: JSON.stringify({ matchType: 'substring_includes_any_word', errorRisk: 'HIGH' }),
        new_data: JSON.stringify({ matchType: 'distinctive_words_and_segments', errorRisk: 'ZERO' }),
        user_id: 'u1b',
        user_email: 'seseffff942@gmail.com',
        user_name: 'Emanuel Lima',
        user_role: 'admin',
        created_at: new Date(Date.now() - 3600000).toISOString()
      }
    ];

    for (const ev of initialEvents) {
      await client.query(`
        INSERT INTO public.audit_logs (
          id, action, category, entity_type, entity_id, entity_name, description, previous_data, new_data, user_id, user_email, user_name, user_role, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        ev.id, ev.action, ev.category, ev.entity_type, ev.entity_id, ev.entity_name, ev.description, ev.previous_data, ev.new_data, ev.user_id, ev.user_email, ev.user_name, ev.user_role, ev.created_at
      ]);
    }
    console.log('✅ Eventos iniciales sembrados.');
  }

  await client.query("NOTIFY pgrst, 'reload schema';");
  await client.end();
}

createAuditTable().catch(console.error);
