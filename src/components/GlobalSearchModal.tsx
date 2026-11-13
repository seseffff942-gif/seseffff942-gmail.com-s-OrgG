import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ArrowRight, Package, Users, Layers, Sparkles } from 'lucide-react';
import { api } from '../api';
import { cn, dispatchQuickSearch, formatMoney } from '../utils';

export interface QuickNavItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  navItems: QuickNavItem[];
  onSelectTab: (tab: string) => void;
}

interface SearchResultEntry {
  key: string;
  category: 'Módulo' | 'Cliente' | 'Producto';
  title: string;
  subtitle: string;
  badge?: string;
  tab: string;
  searchQuery?: string;
}

/**
 * Buscador rápido global (Ctrl+K / Cmd+K) para saltar entre módulos
 * y consultar clientes o productos con su stock y precio al instante.
 */
export function GlobalSearchModal({
  isOpen,
  onClose,
  navItems,
  onSelectTab,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);

    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.getClients().catch(() => []),
      api.getProducts().catch(() => []),
    ])
      .then(([clientList, productList]) => {
        if (cancelled) return;
        setClients(Array.isArray(clientList) ? clientList : []);
        setProducts(Array.isArray(productList) ? productList : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen]);

  const results = useMemo<SearchResultEntry[]>(() => {
    const q = query.trim().toLowerCase();
    const list: SearchResultEntry[] = [];

    const matchedNav = navItems
      .filter((item) => !q || item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q))
      .slice(0, q ? 6 : 8);

    for (const item of matchedNav) {
      list.push({
        key: `nav-${item.id}`,
        category: 'Módulo',
        title: item.label,
        subtitle: 'Ir directamente a esta pantalla',
        tab: item.id,
      });
    }

    if (q.length >= 1) {
      const matchedClients = clients
        .filter((c) => {
          const name = String(c?.name || '').toLowerCase();
          const nit = String(c?.nit || '').toLowerCase();
          const phone = String(c?.phone || '').toLowerCase();
          return name.includes(q) || nit.includes(q) || phone.includes(q);
        })
        .slice(0, 6);

      for (const c of matchedClients) {
        list.push({
          key: `client-${c.id || c.name}`,
          category: 'Cliente',
          title: c.name || 'Cliente sin nombre',
          subtitle: [c.nit ? `NIT: ${c.nit}` : null, c.phone ? `Tel: ${c.phone}` : null, c.address || null]
            .filter(Boolean)
            .join(' • ') || 'Ver en cartera de clientes',
          tab: 'clients',
          searchQuery: c.name || c.nit || '',
        });
      }

      const matchedProducts = products
        .filter((p) => {
          const name = String(p?.name || '').toLowerCase();
          const code = String(p?.code || p?.sku || '').toLowerCase();
          const category = String(p?.category || '').toLowerCase();
          return name.includes(q) || code.includes(q) || category.includes(q);
        })
        .slice(0, 6);

      for (const p of matchedProducts) {
        const stock = Number(p?.stock ?? 0);
        const price = Number(p?.price ?? p?.salePrice ?? 0);
        list.push({
          key: `prod-${p.id || p.name}`,
          category: 'Producto',
          title: p.name || 'Producto',
          subtitle: `${p.presentation || p.category || 'Inventario'} • Stock: ${stock}`,
          badge: price > 0 ? formatMoney(price) : undefined,
          tab: 'inventory',
          searchQuery: p.name || p.code || '',
        });
      }
    }

    return list;
  }, [query, navItems, clients, products]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleSelect = (entry: SearchResultEntry) => {
    if (entry.searchQuery) {
      dispatchQuickSearch(entry.tab, entry.searchQuery);
    }
    onClose();
    onSelectTab(entry.tab);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const target = results[activeIndex] || results[0];
      if (target) handleSelect(target);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          <Search size={18} className="text-[#00696a] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pantalla, cliente, NIT o producto..."
            className="flex-1 bg-transparent text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none"
          />
          {loading && (
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Cargando...
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Cerrar (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
          {results.length === 0 ? (
            <div className="py-10 px-6 text-center text-slate-400 text-xs font-semibold">
              No se encontraron coincidencias para "{query}".
            </div>
          ) : (
            results.map((entry, idx) => {
              const isSelected = idx === activeIndex;
              const Icon =
                entry.category === 'Producto'
                  ? Package
                  : entry.category === 'Cliente'
                  ? Users
                  : Layers;

              return (
                <button
                  key={entry.key}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => handleSelect(entry)}
                  className={cn(
                    'w-full px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer',
                    isSelected ? 'bg-teal-50/80' : 'hover:bg-slate-50'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border',
                        entry.category === 'Producto'
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                          : entry.category === 'Cliente'
                          ? 'bg-sky-50 border-sky-100 text-sky-700'
                          : 'bg-teal-50 border-teal-100 text-[#00696a]'
                      )}
                    >
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-800 truncate">
                          {entry.title}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                          {entry.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                        {entry.subtitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {entry.badge && (
                      <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">
                        {entry.badge}
                      </span>
                    )}
                    <ArrowRight
                      size={14}
                      className={cn(
                        'transition-transform',
                        isSelected ? 'text-[#00696a] translate-x-0.5' : 'text-slate-300'
                      )}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400">
          <div className="flex items-center gap-1.5">
            <Sparkles size={11} className="text-[#00696a]" />
            <span>Escribe para buscar pantallas, clientes o productos</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span>↑↓ mover</span>
            <span>•</span>
            <span>Enter abrir</span>
            <span>•</span>
            <span>Esc cerrar</span>
          </div>
        </div>
      </div>
    </div>
  );
}

