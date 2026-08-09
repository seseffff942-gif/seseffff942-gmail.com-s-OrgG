import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('products').select('*');
  const items = data.filter(p => p.name.toLowerCase().includes('cpf 48 ec') || p.name.toLowerCase().includes('vereta'));
  console.log(items);
}
run();
