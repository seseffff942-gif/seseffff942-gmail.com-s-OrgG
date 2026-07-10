import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://vedgedsbuajueynnyvpn.supabase.co';
const supabaseKey = 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('products').select('*');
  if (error) {
    console.error(error);
    return;
  }
  
  let dbItems = {};
  
  data.forEach(p => {
    if (p.is_external) return;
    const category = p.category || '';
    if (category.toUpperCase() === 'INCUBADORAS') return;
    
    let variants = [];
    if (typeof p.variants === 'string') {
        try {
            variants = JSON.parse(p.variants);
        } catch(e) {}
    } else if (Array.isArray(p.variants)) {
        variants = p.variants;
    }
    
    if (variants && variants.length > 0) {
      variants.forEach(v => {
        const vStock = v.stock !== undefined ? v.stock : (p.stock || 0);
        const vPrice = v.price || p.price || 0;
        if (vStock > 0) {
            const name = (p.name + " " + (v.color||"") + " " + (v.size||"")).trim();
            dbItems[name.toLowerCase()] = vStock * Number(vPrice);
        }
      });
    } else {
      const pStock = p.stock || 0;
      const pPrice = p.price || 0;
      if (pStock > 0) {
        dbItems[(p.name || '').toLowerCase()] = pStock * Number(pPrice);
      }
    }
  });
  
  fs.writeFileSync('db_items.json', JSON.stringify(dbItems, null, 2));
  console.log("Wrote db_items.json with", Object.keys(dbItems).length, "items");
}

run();
