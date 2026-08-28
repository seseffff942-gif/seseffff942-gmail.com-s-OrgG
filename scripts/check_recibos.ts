import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vedgedsbuajueynnyvpn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  try {
    const { data, error } = await supabase.from('recibos_conformes').select('*').order('created_at', { ascending: false });
    console.log("Recibos conformes query result:");
    console.log("Error:", error);
    console.log("Count:", data?.length);
    console.log("Data:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Exception:", err);
  }
}

check();
