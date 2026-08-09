import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('products').select('*');
  let negSum = 0;
  
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
        const vPrice = v.price || p.price || 0;
        if (vStock < 0) {
            negSum += vStock * Number(vPrice);
        }
      });
    } else {
      const pStock = p.stock || 0;
      const pPrice = p.price || 0;
      if (pStock < 0) {
        negSum += pStock * Number(pPrice);
      }
    }
  });
  console.log("Negative stock sum:", negSum);
}
run();
