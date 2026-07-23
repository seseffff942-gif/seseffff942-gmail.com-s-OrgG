import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://vedgedsbuajueynnyvpn.supabase.co', 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno');

async function test() {
  const { data, error } = await supabase.from('office_inventory').insert([
    {
      name: 'Test RLS',
      category: 'Test',
      quantity: 1,
      unit_price: 10,
      location: 'Test',
      status: 'good'
    }
  ]).select().single();
  console.log('Error:', error);
}
test();
