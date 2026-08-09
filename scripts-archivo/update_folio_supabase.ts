import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const envUrl = process.env.SUPABASE_URL;
const supabaseUrl = envUrl && envUrl.startsWith('http') ? envUrl : process.env.SUPABASE_URL;
const envKey = process.env.SUPABASE_ANON_KEY;
const supabaseKey = envKey && envKey.length > 10 ? envKey : process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateFolioConfig() {
  const config = {
    startFrom: 865,
    resetDate: "2026-06-30T01:00:00Z"
  };
  
  const { error } = await supabase
    .from('users')
    .update({ photo: JSON.stringify(config) })
    .eq('id', 'sys-folio-config');
    
  if (error) {
    console.error('Error updating supabase folio config:', error);
  } else {
    console.log('Supabase folio config updated successfully');
  }
}

updateFolioConfig();
