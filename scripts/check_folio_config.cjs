const SUPABASE_URL = 'https://vedgedsbuajueynnyvpn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';
const fs = require('fs');

async function check() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.sys-folio-config&select=*`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  console.log('sys-folio-config from users table:', data);

  if (fs.existsSync('folio_config.json')) {
    console.log('folio_config.json:', fs.readFileSync('folio_config.json', 'utf8'));
  } else {
    console.log('folio_config.json does not exist');
  }
}
check().catch(console.error);
