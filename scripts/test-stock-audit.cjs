const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || "https://vedgedsbuajueynnyvpn.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runStockAuditTest() {
  console.log('--- INICIANDO AUDITORÍA Y TEST DE STOCK ---');
  
  // 1. Consultar el producto Tilosin 25 ml
  const { data: products, error } = await supabase.from('products').select('*').ilike('name', '%Tilosin 25 ml%');
  if (error || !products || products.length === 0) {
    console.error('No se pudo encontrar Tilosin 25 ml:', error);
    return;
  }
  
  const product = products[0];
  console.log(`Producto encontrado: "${product.name}" (ID: ${product.id})`);
  console.log(`Stock actual en Supabase: ${product.stock}`);

  // Verificar si hay facturas que usen Tilosin 25 ml
  const { data: invoices } = await supabase.from('invoices').select('id, items, status, date').order('date', { ascending: false }).limit(30);
  let totalSoldRecent = 0;
  if (invoices) {
    for (const inv of invoices) {
      if (inv.status !== 'cancelled' && inv.status !== 'rejected') {
        const items = inv.items || [];
        for (const it of items) {
          if (it.productId === product.id || it.productName?.toLowerCase().includes('tilosin 25 ml')) {
            totalSoldRecent += Number(it.quantity) || 0;
            console.log(`  - Factura ${inv.id} (${inv.status}, ${inv.date}): ${it.quantity} unidades`);
          }
        }
      }
    }
  }
  console.log(`Total vendido en facturas recientes: ${totalSoldRecent}`);
  console.log('--- AUDITORÍA DE PRODUCTO COMPLETADA CON ÉXITO ---');
}

runStockAuditTest().catch(console.error);
