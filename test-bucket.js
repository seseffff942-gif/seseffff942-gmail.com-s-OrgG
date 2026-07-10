import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabaseUrl = 'https://vedgedsbuajueynnyvpn.supabase.co';
const supabaseKey = 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';
const supabase = createClient(supabaseUrl, supabaseKey);
async function test() {
  const { data, error } = await supabase.storage.createBucket('productos', { public: true });
  console.log('Create Bucket:', data, error);
}
test();
