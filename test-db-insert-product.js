import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const envUrl = process.env.SUPABASE_URL;
const supabaseUrl = envUrl && envUrl.startsWith('http') ? envUrl : 'https://vedgedsbuajueynnyvpn.supabase.co';
const envKey = process.env.SUPABASE_ANON_KEY;
const supabaseKey = envKey && envKey.length > 10 ? envKey : 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('products').insert([
    {
      name: 'Test',
      category: 'Test',
      price: 10,
      stock: 1
    }
  ]).select().single();
  console.log('Data:', data);
  console.log('Error:', error);
}
test();
