import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vedgedsbuajueynnyvpn.supabase.co';
const supabaseKey = 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('products').select('*');
  let extSum = 0;
  data.forEach(p => {
    if (p.is_external) {
      const pStock = p.stock || 0;
      const pPrice = p.price || 0;
      if (pStock > 0) extSum += pStock * pPrice;
    }
  });
  console.log("External sum:", extSum);
}
run();
