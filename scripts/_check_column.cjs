const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkFolioColumn() {
  const { data, error } = await supabase.from('invoices').select('id, folio').limit(1);
  if (error) {
    console.log('Error seleccionando folio:', error.message);
  } else {
    console.log('La columna folio ya existe en Supabase:', data);
  }
}

checkFolioColumn().catch(console.error);
