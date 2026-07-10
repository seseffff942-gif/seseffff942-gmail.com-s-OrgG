import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '/app/applet/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Fallback to searching the code for it
if (!supabaseUrl) {
    const envFile = fs.readFileSync('/app/applet/.env', 'utf-8');
    const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
    const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
    if (urlMatch && keyMatch) {
        process.env.VITE_SUPABASE_URL = urlMatch[1];
        process.env.VITE_SUPABASE_ANON_KEY = keyMatch[1];
    }
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

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
    
    p.variants = p.variants ? (typeof p.variants === 'string' ? JSON.parse(p.variants) : p.variants) : [];
    
    if (p.variants && p.variants.length > 0) {
      p.variants.forEach(v => {
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
        dbItems[p.name.toLowerCase()] = pStock * Number(pPrice);
      }
    }
  });
  
  // Write to a json file to be read by python
  fs.writeFileSync('db_items.json', JSON.stringify(dbItems, null, 2));
  console.log("Wrote db_items.json with", Object.keys(dbItems).length, "items");
}

run();
