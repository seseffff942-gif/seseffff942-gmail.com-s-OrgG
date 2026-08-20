const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkAllNotificationsAndDeleted() {
  const { data: notifs } = await supabase.from('app_notifications').select('*').order('created_at', { ascending: false });

  console.log(`Total Notificaciones: ${notifs.length}`);

  console.log('\n--- TODAS LAS NOTIFICACIONES DE PEDIDOS, RECHAZOS Y VENTAS ---');
  (notifs || []).forEach(n => {
    const d = n.created_at || n.createdAt;
    console.log(`[${d}] (${n.type}) ${n.title} -> ${n.message} | invoiceId: ${n.invoice_id || n.invoiceId}`);
  });
}

checkAllNotificationsAndDeleted().catch(console.error);
