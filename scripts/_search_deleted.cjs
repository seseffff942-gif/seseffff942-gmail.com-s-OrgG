const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function searchDeletedAndLogs() {
  console.log('--- 1. BUSCANDO EN TODAS LAS TABLAS DE SUPABASE ---');
  const tableNames = [
    'audit_logs', 'logs', 'deleted_invoices', 'trash', 'history',
    'invoice_history', 'deleted', 'notifications', 'app_notifications',
    'system_logs', 'backups', 'invoices_trash', 'events'
  ];

  for (const t of tableNames) {
    try {
      const { data, error } = await supabase.from(t).select('*').limit(20);
      if (!error && data) {
        console.log(`Tabla "${t}" encontrada con ${data.length} filas.`);
        console.log(JSON.stringify(data, null, 2));
      }
    } catch(e) {}
  }

  // Check notifications table for deleted / anulada events
  try {
    const { data: notifs } = await supabase.from('app_notifications').select('*');
    if (notifs && notifs.length > 0) {
      console.log(`\n--- NOTIFICACIONES DEL SISTEMA (${notifs.length}) ---`);
      notifs.forEach(n => {
        console.log(`[${n.created_at || n.createdAt}] ${n.title} - ${n.message}`);
      });
    }
  } catch(e) {}

  console.log('\n--- 2. BUSCANDO EN ARCHIVOS LOCALES / BACKUPS ---');
  const dir = process.cwd();
  const files = fs.readdirSync(dir);
  const jsonFiles = files.filter(f => f.endsWith('.json') || f.endsWith('.sql') || f.endsWith('.js') || f.endsWith('.cjs'));
  console.log('Archivos en raíz:', jsonFiles);
}

searchDeletedAndLogs().catch(console.error);
