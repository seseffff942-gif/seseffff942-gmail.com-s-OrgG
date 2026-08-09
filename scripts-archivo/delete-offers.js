import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
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
