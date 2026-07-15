
import { createClient } from '@supabase/supabase-js';

async function getProducts() {
  const envUrl = process.env.SUPABASE_URL;
  const supabaseUrl = envUrl && envUrl.startsWith('http') ? envUrl : 'https://vedgedsbuajueynnyvpn.supabase.co';
  const envKey = process.env.SUPABASE_ANON_KEY;
  const supabaseKey = envKey && envKey.length > 10 ? envKey : 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data, error, count } = await supabase
    .from('products')
    .select('name', { count: 'exact' })
    .order('name', { ascending: true });
  
  if (error) {
    console.error('Error fetching products:', error);
    return;
  }
  
  console.log(`TOTAL_PRODUCTS_COUNT:${count}`);
  console.log('--- FULL PRODUCT LIST ---');
  data.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name}`);
  });
  console.log('-------------------------');
}

getProducts();
