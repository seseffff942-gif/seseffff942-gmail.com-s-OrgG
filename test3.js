import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vedgedsbuajueynnyvpn.supabase.co';
const supabaseKey = 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('products').select('*');
  let negSum = 0;
  
  let totalVal = 0;
  let totalNoExt = 0;
  
  data.forEach(p => {
    const isIncubadora = (p.category || '').toUpperCase() === 'INCUBADORAS';
    
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
        if (vStock > 0 && !isIncubadora) {
            totalVal += vStock * Number(vPrice);
            if (!p.is_external) {
                totalNoExt += vStock * Number(vPrice);
            }
        }
      });
    } else {
      const pStock = p.stock || 0;
      const pPrice = p.price || 0;
      if (pStock > 0 && !isIncubadora) {
        totalVal += pStock * Number(pPrice);
        if (!p.is_external) {
            totalNoExt += pStock * Number(pPrice);
        }
      }
    }
  });
  console.log("Total including external:", totalVal);
  console.log("Total excluding external:", totalNoExt);
}
run();
