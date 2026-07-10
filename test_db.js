import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('products').select('*');
  if (error) {
    console.error(error);
    return;
  }
  
  let totalUI = 0;
  let totalExcel = 0;
  let noIncubadoras = 0;
  
  data.forEach(p => {
    p.variants = p.variants ? (typeof p.variants === 'string' ? JSON.parse(p.variants) : p.variants) : [];
    
    // UI logic (from InventoryPage)
    if (!p.is_external) {
      const category = p.category || '';
      const isIncubadora = category.toUpperCase() === 'INCUBADORAS';
      
      if (p.variants && p.variants.length > 0) {
        p.variants.forEach(v => {
          const vStock = v.stock !== undefined ? v.stock : (p.stock || 0);
          const vPrice = v.price || p.price || 0;
          if (!isIncubadora && vStock > 0) {
            totalUI += vStock * Number(vPrice);
          }
        });
      } else {
        const pStock = p.stock || 0;
        const pPrice = p.price || 0;
        if (!isIncubadora && pStock > 0) {
          totalUI += pStock * Number(pPrice);
        }
      }
    }
    
    // Unfiltered logic
    let tempSum = 0;
    if (p.variants && p.variants.length > 0) {
      p.variants.forEach(v => {
        const vStock = v.stock !== undefined ? v.stock : (p.stock || 0);
        const vPrice = v.price || p.price || 0;
        if (vStock > 0) {
          tempSum += vStock * Number(vPrice);
        }
      });
    } else {
      const pStock = p.stock || 0;
      const pPrice = p.price || 0;
      if (pStock > 0) {
        tempSum += pStock * Number(pPrice);
      }
    }
    totalExcel += tempSum;
    if ((p.category || '').toUpperCase() !== 'INCUBADORAS') {
        noIncubadoras += tempSum;
    }
  });
  
  console.log("Total UI (excluding Incubadoras & external):", totalUI);
  console.log("Total Unfiltered:", totalExcel);
  console.log("Total excluding only Incubadoras:", noIncubadoras);
  
  // Find which ones might be making the 4,128.00 difference!
}

run();
