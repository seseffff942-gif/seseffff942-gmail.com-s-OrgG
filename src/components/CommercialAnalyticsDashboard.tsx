import React, { useState, useMemo } from 'react';
import { Invoice, Product, User } from '../types';
import { 
  Trophy, TrendingUp, AlertTriangle, Sparkles, Package, 
  ArrowUpRight, Clock, DollarSign, Share2, Tag, CheckCircle,
  Users, Layers, Flame, Award, HelpCircle
} from 'lucide-react';
import { formatMoney, isTecunProduct, cn } from '../utils';

interface CommercialAnalyticsDashboardProps {
  invoices: Invoice[];
  products: Product[];
  user: User;
}

export function CommercialAnalyticsDashboard({
  invoices,
  products,
  user
}: CommercialAnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'sellers' | 'top_products' | 'stagnant' | 'lines'>('sellers');

  const validInvoices = useMemo(() => {
    return (invoices || []).filter(i => i.status !== 'cancelled' && i.status !== 'rejected');
  }, [invoices]);

  // 1. RENDIMIENTO DE VENDEDORES
  const sellerStats = useMemo(() => {
    const map: Record<string, { name: string; email: string; totalSales: number; invoiceCount: number; paidAmount: number; pendingAmount: number }> = {};

    validInvoices.forEach(inv => {
      const sellerKey = (inv.sellerId || (inv as any).seller || 'Sin Asignar').toLowerCase().trim();
      let displayName = inv.seller || inv.sellerId || 'Vendedor';
      
      if (sellerKey.includes('herbert') || sellerKey.includes('gruasytransportesali')) {
        displayName = 'Herbert Argueta';
      } else if (sellerKey.includes('erick') || sellerKey.includes('jerickottoniel')) {
        displayName = 'Erick Juárez';
      } else if (sellerKey.includes('seseffff942') || sellerKey.includes('dueño')) {
        displayName = 'Dirección / CEO';
      }

      if (!map[displayName]) {
        map[displayName] = {
          name: displayName,
          email: inv.sellerId || '',
          totalSales: 0,
          invoiceCount: 0,
          paidAmount: 0,
          pendingAmount: 0
        };
      }

      const total = Number(inv.totalAmount) || 0;
      const paid = Number(inv.paidAmount) || 0;

      map[displayName].totalSales += total;
      map[displayName].invoiceCount += 1;
      map[displayName].paidAmount += paid;
      map[displayName].pendingAmount += (total - paid);
    });

    const list = Object.values(map).sort((a, b) => b.totalSales - a.totalSales);
    const grandTotal = list.reduce((s, x) => s + x.totalSales, 0) || 1;

    return list.map((item, idx) => ({
      ...item,
      rank: idx + 1,
      sharePercent: ((item.totalSales / grandTotal) * 100).toFixed(1)
    }));
  }, [validInvoices]);

  // 2. TOP 10 PRODUCTOS MÁS VENDIDOS
  const topSellingProducts = useMemo(() => {
    const map: Record<string, { name: string; category: string; totalQty: number; totalRevenue: number; occurrences: number }> = {};

    validInvoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        const name = item.productName || (item as any).name || 'Producto';
        const key = name.toLowerCase().trim();
        const qty = Number(item.quantity) || 0;
        const total = Number(item.total) || (qty * (Number(item.price) || 0));

        if (!map[key]) {
          const catalogProd = (products || []).find(p => (p.name || '').toLowerCase().trim() === key);
          map[key] = {
            name: name,
            category: catalogProd?.category || (isTecunProduct({ name }) ? 'TECUN' : 'General'),
            totalQty: 0,
            totalRevenue: 0,
            occurrences: 0
          };
        }

        map[key].totalQty += qty;
        map[key].totalRevenue += total;
        map[key].occurrences += 1;
      });
    });

    return Object.values(map)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10)
      .map((p, idx) => ({ ...p, rank: idx + 1 }));
  }, [validInvoices, products]);

  // 3. RADAR DE PRODUCTOS DETENIDOS (Hueso / Sin Rotación con Stock > 0)
  const stagnantProducts = useMemo(() => {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    // Track last sale date for each product
    const lastSaleDateMap: Record<string, number> = {};

    validInvoices.forEach(inv => {
      const invTime = inv.date ? new Date(inv.date).getTime() : 0;
      (inv.items || []).forEach(it => {
        const name = (it.productName || (it as any).name || '').toLowerCase().trim();
        if (!lastSaleDateMap[name] || invTime > lastSaleDateMap[name]) {
          lastSaleDateMap[name] = invTime;
        }
      });
    });

    // Find products with stock > 0 that haven't sold in 30+ days or never
    return (products || [])
      .filter(p => Number(p.stock) > 0)
      .map(p => {
        const key = (p.name || '').toLowerCase().trim();
        const lastSale = lastSaleDateMap[key] || 0;
        const daysWithoutSale = lastSale > 0 
          ? Math.floor((now - lastSale) / (1000 * 60 * 60 * 24))
          : 999; // Never sold
        const immobilizedCapital = (Number(p.stock) || 0) * (Number(p.price) || 0);

        return {
          id: p.id,
          name: p.name,
          category: p.category || 'General',
          stock: Number(p.stock),
          price: Number(p.price),
          daysWithoutSale,
          neverSold: lastSale === 0,
          immobilizedCapital,
          isTecun: isTecunProduct(p)
        };
      })
      .filter(p => p.daysWithoutSale >= 15 || p.neverSold)
      .sort((a, b) => b.immobilizedCapital - a.immobilizedCapital);
  }, [validInvoices, products]);

  // 4. DISTRIBUCIÓN POR LÍNEAS COMERCIALES
  const linesBreakdown = useMemo(() => {
    let agricolaTotal = 0;
    let veterinariaTotal = 0;
    let tecunTotal = 0;
    let generalTotal = 0;

    validInvoices.forEach(inv => {
      (inv.items || []).forEach(it => {
        const total = Number(it.total) || ((Number(it.quantity) || 0) * (Number(it.price) || 0));
        const name = it.productName || (it as any).name;
        
        if (isTecunProduct({ name })) {
          tecunTotal += total;
        } else if (inv.invoiceType === 'veterinaria' || (it as any).category?.toLowerCase().includes('vet')) {
          veterinariaTotal += total;
        } else if (inv.invoiceType === 'agricola' || (it as any).category?.toLowerCase().includes('agri')) {
          agricolaTotal += total;
        } else {
          generalTotal += total;
        }
      });
    });

    const sum = agricolaTotal + veterinariaTotal + tecunTotal + generalTotal || 1;

    return [
      { name: 'Línea Agrícola', total: agricolaTotal, percent: ((agricolaTotal / sum) * 100).toFixed(1), color: 'bg-emerald-500', textColor: 'text-emerald-700' },
      { name: 'Línea Veterinaria', total: veterinariaTotal, percent: ((veterinariaTotal / sum) * 100).toFixed(1), color: 'bg-teal-500', textColor: 'text-teal-700' },
      { name: 'Línea Tecún (Químicos)', total: tecunTotal, percent: ((tecunTotal / sum) * 100).toFixed(1), color: 'bg-purple-500', textColor: 'text-purple-700' },
      { name: 'Accesorios / Otros', total: generalTotal, percent: ((generalTotal / sum) * 100).toFixed(1), color: 'bg-amber-500', textColor: 'text-amber-700' }
    ].sort((a, b) => b.total - a.total);
  }, [validInvoices]);

  const handleShareStagnantOffer = (p: typeof stagnantProducts[0]) => {
    const text = `🔥 *OFERTA ESPECIAL AGRICOVET*\n\nDisponemos de existencias inmediatas de:\n👉 *${p.name}*\n📦 Stock disponible: ${p.stock} unidades\n💰 Precio especial: ${formatMoney(p.price)}\n\n¡Aprovecha y solicita tu pedido hoy mismo! 🐾🌾`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
      
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-emerald-100 text-[#0b4d2c] text-[10px] font-black uppercase rounded-full tracking-widest flex items-center gap-1">
              <Sparkles size={11} /> Inteligencia Comercial
            </span>
          </div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Rendimiento, Productos y Radar de Oportunidades</h3>
          <p className="text-xs text-slate-500 font-medium">Analítica en vivo de vendedores, productos más vendidos y artículos estancados para impulsar ventas.</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-2xl gap-1 shrink-0 border border-slate-200/60">
          <button
            onClick={() => setActiveTab('sellers')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === 'sellers' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Trophy size={13} className="text-amber-500" />
            <span>Vendedores</span>
          </button>

          <button
            onClick={() => setActiveTab('top_products')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === 'top_products' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Flame size={13} className="text-orange-500" />
            <span>Top 10 Vendidos</span>
          </button>

          <button
            onClick={() => setActiveTab('stagnant')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === 'stagnant' ? "bg-purple-600 text-white shadow-xs" : "text-purple-700 hover:bg-purple-50"
            )}
          >
            <Package size={13} />
            <span>Radar Detenidos ({stagnantProducts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('lines')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === 'lines' ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Layers size={13} className="text-teal-600" />
            <span>Líneas</span>
          </button>
        </div>
      </div>

      {/* TAB 1: RENDIMIENTO DE VENDEDORES */}
      {activeTab === 'sellers' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sellerStats.map((s) => (
              <div 
                key={s.name} 
                className="bg-gradient-to-br from-slate-50 to-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4 hover:border-emerald-500/30 transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shadow-xs",
                      s.rank === 1 ? "bg-amber-400 text-amber-950 ring-4 ring-amber-100" :
                      s.rank === 2 ? "bg-slate-200 text-slate-800 ring-4 ring-slate-100" :
                      "bg-emerald-100 text-emerald-900"
                    )}>
                      #{s.rank}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-base">{s.name}</h4>
                      <p className="text-xs text-slate-400 font-medium">{s.invoiceCount} pedidos facturados</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-[#0b4d2c] font-black text-xs rounded-xl">
                    {s.sharePercent}% participación
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-slate-500 uppercase tracking-wider text-[10px]">Venta Total Acumulada</span>
                    <span className="text-[#0b4d2c] font-black notranslate" translate="no">{formatMoney(s.totalSales)}</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#0b4d2c] to-teal-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Number(s.sharePercent))}%` }}
                    />
                  </div>
                </div>

                {/* Metrics Breakdown */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Cobrado</span>
                    <span className="font-black text-emerald-700 notranslate" translate="no">{formatMoney(s.paidAmount)}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Por Cobrar</span>
                    <span className="font-black text-amber-700 notranslate" translate="no">{formatMoney(s.pendingAmount)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: TOP 10 PRODUCTOS MÁS VENDIDOS */}
      {activeTab === 'top_products' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 gap-2.5">
            {topSellingProducts.map(p => (
              <div 
                key={p.name}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/70 transition gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs",
                    p.rank === 1 ? "bg-amber-400 text-amber-950 font-black ring-2 ring-amber-200" :
                    p.rank === 2 ? "bg-slate-300 text-slate-900 ring-2 ring-slate-200" :
                    p.rank === 3 ? "bg-amber-700 text-white ring-2 ring-amber-600/30" :
                    "bg-white border border-slate-200 text-slate-600"
                  )}>
                    {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`}
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-sm leading-tight notranslate" translate="no">{p.name}</h5>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{p.category} • {p.occurrences} facturas</span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 text-right">
                  <div>
                    <span className="block text-xs font-black text-slate-900">{p.totalQty} uds</span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Vendidas</span>
                  </div>
                  <div className="min-w-[100px]">
                    <span className="block text-sm font-black text-[#0b4d2c] notranslate" translate="no">{formatMoney(p.totalRevenue)}</span>
                    <span className="text-[10px] text-emerald-600 uppercase font-bold">Ingresos</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: RADAR DE PRODUCTOS DETENIDOS / SIN ROTACIÓN */}
      {activeTab === 'stagnant' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-start gap-3">
            <div className="p-2 bg-purple-600 text-white rounded-xl shadow-xs shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h4 className="text-xs font-black text-purple-950 uppercase tracking-wider">Radar de Inventario Estancado</h4>
              <p className="text-xs text-purple-900/80 mt-0.5 font-medium leading-relaxed">
                Estos productos tienen <strong>stock físico en bodega</strong> pero llevan más de 15 a 30 días sin registrar ventas. 
                Recomienda estos artículos a tus clientes en ruta o activa ofertas para liberar capital inmovilizado.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[500px] overflow-y-auto pr-1">
            {stagnantProducts.map(p => (
              <div 
                key={p.id}
                className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[9px] font-black uppercase rounded-md">
                      {p.category}
                    </span>
                    <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                      {p.neverSold ? 'Sin ventas registradas' : `${p.daysWithoutSale} días sin venta`}
                    </span>
                  </div>
                  <h5 className="font-bold text-slate-900 text-sm notranslate leading-tight mt-1" translate="no">{p.name}</h5>
                </div>

                <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-xs">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Stock Parado</span>
                    <span className="font-extrabold text-slate-800">{p.stock} uds</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Precio Unit.</span>
                    <span className="font-extrabold text-slate-800 notranslate" translate="no">{formatMoney(p.price)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-purple-700 uppercase block">Capital Inmóvil</span>
                    <span className="font-black text-purple-900 notranslate" translate="no">{formatMoney(p.immobilizedCapital)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">
                    💡 Sugerencia: Ofrecer en ruta
                  </span>
                  <button
                    onClick={() => handleShareStagnantOffer(p)}
                    className="px-3 py-1.5 bg-[#25D366] hover:bg-[#1ebd5a] text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                    title="Enviar oferta rápida a WhatsApp"
                  >
                    <Share2 size={12} />
                    <span>Ofrecer</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* TAB 4: DISTRIBUCIÓN POR LÍNEAS COMERCIALES */}
      {activeTab === 'lines' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {linesBreakdown.map(l => (
              <div key={l.name} className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex justify-between items-center">
                  <h5 className="font-bold text-slate-900 text-sm">{l.name}</h5>
                  <span className={cn("px-2.5 py-0.5 rounded-lg text-xs font-black bg-white border shadow-xs", l.textColor)}>
                    {l.percent}%
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-200/70 rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-500", l.color)}
                    style={{ width: `${l.percent}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Facturación en Línea</span>
                  <span className="font-black text-slate-900 text-base notranslate" translate="no">{formatMoney(l.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
