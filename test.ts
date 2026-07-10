import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');
  const id = `o${Date.now()}`;
  const offer = { id, name: 'test from npx', buyQty: 1, freeQty: 1, productId: 'p1' };
  const { data, error } = await supabase.from("offers").insert([offer]).select();
  console.log({ error, data });
}

main().catch(console.error);
