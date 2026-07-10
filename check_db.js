import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://vedgedsbuajueynnyvpn.supabase.co';
const supabaseKey = 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('products').select('*');
  const items = data.filter(p => p.name.toLowerCase().includes('cpf 48 ec') || p.name.toLowerCase().includes('vereta'));
  console.log(items);
}
run();
