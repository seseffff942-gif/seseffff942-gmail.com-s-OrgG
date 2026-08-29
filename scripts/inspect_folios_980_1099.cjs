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
  
  const mapped = data.map(i => {
    let f = i.folio;
    if (!f && i.notes) {
      const m = i.notes.match(/\|\|\|FOLIO:(\d+)/);
      if (m) f = parseInt(m[1]);
    }
    return { id: i.id, date: i.date, folio: Number(f), sellerId: i.sellerId, status: i.status };
  });

  const filtered = mapped.filter(m => m.folio >= 980 && m.folio <= 1099);
  console.log(`Found ${filtered.length} invoices between folios 980 and 1099:`);
  console.table(filtered.map(f => ({
    folio: f.folio,
    id: f.id,
    date: f.date,
    sellerId: f.sellerId,
    status: f.status
  })));

  // Group by sellerId
  const bySeller = {};
  filtered.forEach(f => {
    bySeller[f.sellerId] = (bySeller[f.sellerId] || 0) + 1;
  });
  console.log('Count by seller between 980 and 1099:', bySeller);
}

check().catch(console.error);
