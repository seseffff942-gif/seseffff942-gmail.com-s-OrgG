import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vedgedsbuajueynnyvpn.supabase.co';
const supabaseKey = 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('products').select('*');
  let negProducts = [];
  
  data.forEach(p => {
    let variants = [];
    if (typeof p.variants === 'string') {
        try { variants = JSON.parse(p.variants); } catch(e) {}
    } else if (Array.isArray(p.variants)) {
        variants = p.variants;
    }
    
    if (variants && variants.length > 0) {
      variants.forEach(v => {
        const vStock = v.stock !== undefined ? v.stock : (p.stock || 0);
        if (vStock < 0) {
            negProducts.push({ name: p.name, category: p.category, stock: vStock });
        }
      });
    } else {
      const pStock = p.stock || 0;
      if (pStock < 0) {
        negProducts.push({ name: p.name, category: p.category, stock: pStock });
      }
    }
  });
  console.log("Negative stock products:", negProducts);
}
run();
