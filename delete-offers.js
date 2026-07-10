import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://vedgedsbuajueynnyvpn.supabase.co';
const supabaseKey = 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteOffers() {
  const { error } = await supabase.from('offers').delete().neq('id', 'mock_id_never_matching');
  if (error) console.error("Error clearing supabase offers:", error);
  else console.log("Supabase offers cleared");

  if (fs.existsSync('offers_extra.json')) {
    fs.unlinkSync('offers_extra.json');
    console.log("Deleted offers_extra.json");
  }
}

deleteOffers();
