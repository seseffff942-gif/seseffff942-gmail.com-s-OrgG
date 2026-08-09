import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const envUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseUrl = envUrl && envUrl.startsWith('http') ? envUrl : process.env.SUPABASE_URL;
const envKey = process.env.SUPABASE_ANON_KEY;
const supabaseKey = envKey && envKey.length > 10 ? envKey : process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: admins } = await supabase.from("users").select("name, phone, role").eq("role", "admin");
  console.log("Admins:", admins);
}
run();
