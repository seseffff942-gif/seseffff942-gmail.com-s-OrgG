const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkUsers() {
  const { data: users } = await supabase.from('users').select('id, name, email, role');
  console.log('--- USUARIOS EN SISTEMA ---');
  users.forEach(u => console.log(`${u.name} | ${u.email} | Rol: ${u.role}`));
}

checkUsers().catch(console.error);
