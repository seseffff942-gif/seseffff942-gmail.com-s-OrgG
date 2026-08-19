const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.SUPABASE_URL || 'https://vedgedsbuajueynnyvpn.supabase.co';
const key = process.env.SUPABASE_ANON_KEY || 'sb_publishable_A0p93X7JFAIueZggdpjh4w_aRv6esno';
const supabase = createClient(url, key);

async function run() {
  const { data: invoices, error } = await supabase.from('invoices').select('*');
  const { data: users } = await supabase.from('users').select('*');
  const { data: payments } = await supabase.from('payments').select('*');

  if (error) {
    console.error('Error fetching invoices:', error);
    return;
  }

  const userMap = {};
  users?.forEach(u => {
    userMap[u.id] = u.name || u.email;
    userMap[u.email] = u.name || u.email;
  });

  // Timezone adjustment Guatemala UTC-6
  const getGTDate = (dStr) => {
    const dt = new Date(dStr);
    const gtOffset = -6 * 60;
    const utcMs = dt.getTime() + (dt.getTimezoneOffset() * 60000);
    return new Date(utcMs + (gtOffset * 60000));
  };

  const days = {};

  invoices.forEach(inv => {
    if (!inv.date) return;
    const gtDate = getGTDate(inv.date);
    const dayKey = gtDate.toISOString().slice(0, 10);
    const timeStr = gtDate.toISOString().slice(11, 19);

    if (!days[dayKey]) {
      days[dayKey] = {
        total: 0,
        totalValid: 0,
        count: 0,
        validCount: 0,
        cancelledCount: 0,
        sellers: {},
        invoices: []
      };
    }

    const isCancelled = inv.status === 'cancelled' || inv.status === 'anulado';
    const amount = Number(inv.totalAmount) || 0;
    const seller = userMap[inv.sellerId] || inv.sellerId || 'Sin Vendedor';
    const client = inv.clientName || inv.client || 'Cliente Sin Nombre';

    days[dayKey].count++;
    days[dayKey].total += amount;
    if (isCancelled) {
      days[dayKey].cancelledCount++;
    } else {
      days[dayKey].validCount++;
      days[dayKey].totalValid += amount;
      if (!days[dayKey].sellers[seller]) days[dayKey].sellers[seller] = 0;
      days[dayKey].sellers[seller] += amount;
    }

    days[dayKey].invoices.push({
      id: inv.id,
      time: timeStr,
      client: client,
      amount: amount,
      status: inv.status,
      seller: seller,
      paidAmount: Number(inv.paidAmount) || 0,
      notes: inv.notes,
      items: inv.items
    });
  });

  console.log('\n======================================================');
  console.log('=== DETALLE POR DIA (Lunes 10 de Agosto al Lunes 17 de Agosto 2026) ===');
  
  const productStats = {};

  Object.keys(days).sort().forEach(day => {
    if (day >= '2026-08-10' && day <= '2026-08-17') {
      const d = days[day];
      console.log(`\n📅 FECHA: ${day} | TOTAL DÍA: Q${d.totalValid.toFixed(2)} (${d.validCount} facturas válidas${d.cancelledCount > 0 ? `, ${d.cancelledCount} anulada(s)` : ''})`);
      console.log('   Vendedores:');
      Object.entries(d.sellers).forEach(([seller, amt]) => {
        console.log(`     • ${seller}: Q${amt.toFixed(2)}`);
      });
      console.log('   Documentos:');
      d.invoices.forEach(inv => {
        const statusLabel = inv.status === 'cancelled' ? ' [ANULADA]' : '';
        console.log(`     - [${inv.time}] ${inv.id}${statusLabel} | Cliente: ${inv.client} | Monto: Q${inv.amount.toFixed(2)} | Vendedor: ${inv.seller}`);
        if (inv.status !== 'cancelled' && Array.isArray(inv.items)) {
          inv.items.forEach(item => {
            const pName = item.productName || item.name || item.productId || 'Item';
            const qty = Number(item.quantity) || 0;
            const sub = Number(item.total) || (qty * (Number(item.price) || 0));
            if (!productStats[pName]) productStats[pName] = { qty: 0, total: 0 };
            productStats[pName].qty += qty;
            productStats[pName].total += sub;
          });
        }
      });
    }
  });

  // Range totals
  let rangeTotalValid = 0;
  let rangeTotalCancelled = 0;
  let rangeValidCount = 0;
  let rangeCancelledCount = 0;
  const sellerTotals = {};
  const clientTotals = {};

  Object.keys(days).sort().forEach(day => {
    if (day >= '2026-08-10' && day <= '2026-08-17') {
      const d = days[day];
      rangeTotalValid += d.totalValid;
      rangeTotalCancelled += (d.total - d.totalValid);
      rangeValidCount += d.validCount;
      rangeCancelledCount += d.cancelledCount;

      Object.entries(d.sellers).forEach(([seller, amt]) => {
        sellerTotals[seller] = (sellerTotals[seller] || 0) + amt;
      });

      d.invoices.forEach(inv => {
        if (inv.status !== 'cancelled' && inv.status !== 'anulado') {
          clientTotals[inv.client] = (clientTotals[inv.client] || 0) + inv.amount;
        }
      });
    }
  });

  console.log('\n======================================================');
  console.log('📊 RESUMEN GENERAL (Lunes 10/08/2026 a Lunes 17/08/2026)');
  console.log(`💰 TOTAL VENDIDO (Válido): Q${rangeTotalValid.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`📄 Total de Facturas Válidas: ${rangeValidCount}`);
  console.log(`❌ Facturas Anuladas: ${rangeCancelledCount} (Q${rangeTotalCancelled.toFixed(2)})`);

  console.log('\n👤 TOTAL POR VENDEDOR:');
  Object.entries(sellerTotals).sort((a,b) => b[1] - a[1]).forEach(([seller, amt]) => {
    console.log(`  • ${seller}: Q${amt.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${((amt/rangeTotalValid)*100).toFixed(1)}%)`);
  });

  console.log('\n🏢 TOP CLIENTES:');
  Object.entries(clientTotals).sort((a,b) => b[1] - a[1]).slice(0, 15).forEach(([client, amt]) => {
    console.log(`  • ${client}: Q${amt.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  });

  console.log('\n📦 TOP PRODUCTOS MÁS VENDIDOS:');
  Object.entries(productStats).sort((a,b) => b[1].total - a[1].total).slice(0, 15).forEach(([pName, st]) => {
    console.log(`  • ${pName}: ${st.qty} unidades | Q${st.total.toFixed(2)}`);
  });
}

run();
