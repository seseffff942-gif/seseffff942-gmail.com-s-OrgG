import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://vedgedsbuajueynnyvpn.supabase.co', 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno');

async function check() {
  const { data, error } = await supabase.from('office_inventory').select('*');
  console.log('Total items:', data?.length);
  console.log(data);
}
check();
