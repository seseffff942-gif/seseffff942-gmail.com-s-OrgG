import React, { useState, useEffect } from 'react';
import { Package, Monitor, Briefcase, Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '../types';
import { api } from '../api';
import { cn } from '../utils';

interface OfficeItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  location: string;
  status: 'excellent' | 'good' | 'needs_replacement';
}

export function OfficeInventory({ user, isMobile }: { user: User; isMobile?: boolean }) {
  const [items, setItems] = useState<OfficeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<OfficeItem | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Mobiliario');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');
  const [location, setLocation] = useState('Oficina Principal');
  const [status, setStatus] = useState<'excellent' | 'good' | 'needs_replacement'>('good');

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getOfficeInventory();
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setName('');
    setCategory('Mobiliario');
    setQuantity('1');
    setUnitPrice('0');
    setLocation('Oficina Principal');
    setStatus('good');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (item: OfficeItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setQuantity(item.quantity.toString());
    setUnitPrice(item.unitPrice.toString());
    setLocation(item.location);
    setStatus(item.status);
    setShowAddModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      if (editingItem) {
        await api.updateOfficeItem(editingItem.id, {
          name, category, quantity: Number(quantity), unitPrice: Number(unitPrice), location, status
        });
      } else {
        await api.createOfficeItem({
          name, category, quantity: Number(quantity), unitPrice: Number(unitPrice), location, status
        });
      }
      setShowAddModal(false);
      loadData();
    } catch (e: any) {
      console.error(e);
      alert('Error al guardar el artículo: ' + (e.message || 'Error desconocido'));
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar este artículo del inventario de oficina?')) {
      try {
        await api.deleteOfficeItem(id);
        loadData();
      } catch (e: any) {
        console.error(e);
        alert('Error al eliminar: ' + (e.message || 'Error desconocido'));
      }
    }
  };

  const filteredItems = items.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          i.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'Todos' || i.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const totalValue = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const categoriesList = ['Todos', ...Array.from(new Set(items.map(i => i.category)))];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-blue-800 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-xs sm:text-sm text-slate-400 font-bold uppercase tracking-wider">Cargando oficina y equipo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 group hover:border-blue-800 hover:shadow-md transition-all duration-300">
          <div className="w-12 h-12 bg-blue-50 text-blue-800 rounded-xl flex items-center justify-center shrink-0">
            <Monitor size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-0.5">Artículos Registrados</span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-none">
              {items.length} <span className="text-xs font-semibold text-slate-500">items</span>
            </h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 group hover:border-blue-800 hover:shadow-md transition-all duration-300">
          <div className="w-12 h-12 bg-blue-50 text-blue-800 rounded-xl flex items-center justify-center shrink-0">
            <Briefcase size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-0.5">Valorización Total</span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-none">
              Q{totalValue.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto flex-1">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar mobiliario o equipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-805 placeholder:text-slate-400 text-xs sm:text-sm font-semibold outline-none focus:border-blue-800 focus:bg-white transition-all shadow-inner"
              />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
              {categoriesList.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap snap-start shrink-0 border",
                    activeCategory === cat 
                      ? "bg-blue-800 text-white border-blue-800 shadow-sm" 
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-blue-300"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="w-full lg:w-auto px-5 py-2.5 bg-blue-800 hover:bg-blue-900 text-white rounded-xl font-bold transition-all shadow-sm hover:shadow active:scale-95 flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            <span>Agregar Activo</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-3 px-4 text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-wider">Artículo</th>
                <th className="py-3 px-4 text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-wider">Categoría</th>
                <th className="py-3 px-4 text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-wider">Ubicación</th>
                <th className="py-3 px-4 text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-wider text-center">Cant.</th>
                <th className="py-3 px-4 text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-wider text-right">Costo Unit.</th>
                <th className="py-3 px-4 text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-wider text-right">Total</th>
                <th className="py-3 px-4 text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-wider text-center">Estado</th>
                <th className="py-3 px-4 text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-wider text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-800 text-xs sm:text-sm">{item.name}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{item.category}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs font-medium text-slate-600">{item.location}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-xs sm:text-sm font-bold text-slate-800">{item.quantity}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-xs font-semibold text-slate-600">Q{item.unitPrice.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-xs sm:text-sm font-bold text-blue-800">Q{(item.quantity * item.unitPrice).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {item.status === 'excellent' && <span className="inline-block px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase rounded-md">Excelente</span>}
                    {item.status === 'good' && <span className="inline-block px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase rounded-md">Bueno</span>}
                    {item.status === 'needs_replacement' && <span className="inline-block px-2 py-1 bg-rose-50 text-rose-700 text-[10px] font-bold uppercase rounded-md">Requiere Cambio</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2 transition-opacity">
                      <button onClick={() => handleOpenEditModal(item)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Eliminar">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-sm font-medium">
                    No se encontraron artículos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"
          >
            <div className="p-6">
              <h3 className="text-xl font-black text-slate-800 mb-6">{editingItem ? 'Editar Artículo' : 'Nuevo Artículo de Oficina'}</h3>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nombre del Artículo</label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-800 focus:bg-white transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Categoría</label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-800 focus:bg-white transition-all"
                    >
                      <option value="Mobiliario">Mobiliario</option>
                      <option value="Equipo">Equipo (Informático)</option>
                      <option value="Útiles">Útiles y Papelería</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Estado</label>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value as any)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-800 focus:bg-white transition-all"
                    >
                      <option value="excellent">Excelente</option>
                      <option value="good">Bueno / Aceptable</option>
                      <option value="needs_replacement">Requiere Cambio</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Cantidad</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-800 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Costo Unit. (Q)</label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={unitPrice}
                      onChange={e => setUnitPrice(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-800 focus:bg-white transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ubicación</label>
                  <input
                    required
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-blue-800 focus:bg-white transition-all"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-blue-800 text-white font-bold rounded-xl hover:bg-blue-900 transition-colors shadow-sm"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
