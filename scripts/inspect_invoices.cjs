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

async function inspect() {
  const data = await req('invoices?select=id,date,notes,folio,is_archived,status&order=date.asc');
  console.log('Total returned:', data.length);
  
  const mapped = data.map(i => {
    let f = i.folio;
    if (!f && i.notes) {
      const m = i.notes.match(/\|\|\|FOLIO:(\d+)/);
      if (m) f = parseInt(m[1]);
    }
    return { id: i.id, date: i.date, folio: f, status: i.status, is_archived: i.is_archived };
  });

  console.log('Earliest 10:');
  console.table(mapped.slice(0, 10));

  console.log('Latest 10:');
  console.table(mapped.slice(-10));

  // Find min and max folio
  const validFolios = mapped.map(m => Number(m.folio)).filter(f => !isNaN(f) && f > 0);
  console.log('Min folio:', Math.min(...validFolios), 'Max folio:', Math.max(...validFolios));
  console.log('Count with valid folio:', validFolios.length);

  // Check 983 specifically
  const item983 = mapped.find(m => m.folio == 983);
  console.log('Item with folio 983:', item983);

  // Check what folios are missing or if there's a filter
  const foliosSorted = [...validFolios].sort((a,b) => a - b);
  console.log('Folios range sorted (first 20):', foliosSorted.slice(0, 20));
  console.log('Folios range sorted (last 20):', foliosSorted.slice(-20));
}

inspect().catch(console.error);
