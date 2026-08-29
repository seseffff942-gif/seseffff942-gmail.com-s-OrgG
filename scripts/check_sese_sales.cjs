const SUPABASE_URL = 'https://vedgedsbuajueynnyvpn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';

async function req(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  return res.json();
}

async function check() {
  const data = await req('invoices?select=id,date,notes,folio,is_archived,status,sellerId&order=date.asc');
  
  const mySales = data.filter(i => 
    i.sellerId === 'seseffff942@gmail.com' || 
    i.sellerId === 'u1b' ||
    (i.sellerId || '').toLowerCase().includes('sese')
  );

  console.log(`Sales for seseffff942@gmail.com (${mySales.length} total):`);
  console.table(mySales.map(i => {
    let f = i.folio;
    if (!f && i.notes) {
      const m = i.notes.match(/\|\|\|FOLIO:(\d+)/);
      if (m) f = m[1];
    }
    return {
      id: i.id,
      date: i.date,
      folio: f,
      sellerId: i.sellerId,
      status: i.status
    };
  }));

  // Check what seller owns folio 983
  const inv983 = data.find(i => {
    let f = i.folio;
    if (!f && i.notes) {
      const m = i.notes.match(/\|\|\|FOLIO:(\d+)/);
      if (m) f = m[1];
    }
    return f == 983;
  });
  console.log('Who owns folio 983?:', inv983 ? { id: inv983.id, date: inv983.date, sellerId: inv983.sellerId } : 'Not found');
}

check().catch(console.error);
