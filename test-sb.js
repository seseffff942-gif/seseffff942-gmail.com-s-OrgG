import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await sb.from("invoices").insert([{
      id: "INV-TEST-999",
      sellerId: "test",
      clientName: "test",
      notes: "test",
      customerPhone: "test",
      deliveryAddress: "test",
      items: [],
      totalAmount: 10,
      paidAmount: 10,
      status: "pending",
      date: new Date().toISOString(),
      authStatus: "pending"
  }]).select();
  console.log("Error:", error?.message);
  console.log("Data:", data);
}
test();
