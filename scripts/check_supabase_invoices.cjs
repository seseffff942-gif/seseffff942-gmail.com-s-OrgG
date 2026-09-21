const { createClient } = require('@supabase/supabase-js');

const sbUrl = 'https://vedgedsbuajueynnyvpn.supabase.co';
const sbKey = 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';

const supabase = createClient(sbUrl, sbKey);

async function check() {
  console.log('Consultando Supabase...');
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .ilike('clientName', '%wilder%');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Facturas con Wilder en Supabase:');
  for (const inv of data) {
    console.log(`Folio: ${inv.folio} | Cliente: ${inv.clientName} | Monto: Q${inv.totalAmount} | Vendedor: ${inv.sellerId} | Fecha: ${inv.date}`);
  }

  // Also query folio 1144 or latest folios
  const { data: latest, error: lErr } = await supabase
    .from('invoices')
    .select('folio, clientName, totalAmount, sellerId, date')
    .order('date', { ascending: false })
    .limit(15);

  console.log('\nÚltimas 15 facturas en Supabase:');
  for (const inv of latest || []) {
    console.log(`Folio: ${inv.folio} | Cliente: ${inv.clientName} | Monto: Q${inv.totalAmount} | Vendedor: ${inv.sellerId} | Fecha: ${inv.date}`);
  }
}

check();
