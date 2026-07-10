import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vedgedsbuajueynnyvpn.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno'
);

async function run() {
  const { data: users } = await supabase.from("users").select("email, password");
  console.log(users[0]);
}
run();
