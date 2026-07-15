import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { Product, User, Offer } from '../types';
import QRCode from 'react-qr-code';
import { Search, Edit2, Upload, Plus, Image as ImageIcon, X, Tag, CheckCircle, Sparkles, Package, Users, Trash2, FileText, Info, ExternalLink, Layers, RotateCw, Filter, Stethoscope, Sprout, Wrench, Shield, AlertCircle, Globe, Download, QrCode } from 'lucide-react';
import { cn, doesNotNeedStock, isCriticalStock } from '../utils';
import { GeminiLogo, GeminiAssistant } from '../components/GeminiAssistant';
import { motion } from 'motion/react';

interface InventoryPageProps {
  user: User;
  isMobile?: boolean;
}

export function InventoryPage({ user, isMobile }: InventoryPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductQR, setSelectedProductQR] = useState<Product | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('Agroquímicos');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductStock, setNewProductStock] = useState('');
  const [newProductImage, setNewProductImage] = useState<File | null>(null);
  const [newProductVariants, setNewProductVariants] = useState<any[]>([]);
  const [newProductSpecs, setNewProductSpecs] = useState<{ key: string; value: string }[]>([]);
  const [newProductIsExternal, setNewProductIsExternal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [showSpecsModal, setShowSpecsModal] = useState(false);
  const [variantStep, setVariantStep] = useState<'colors' | 'sizes' | 'prices'>('colors');
  const [tempColors, setTempColors] = useState<string[]>([]);
  const [tempSizesMap, setTempSizesMap] = useState<Record<string, string[]>>({});
  const [activeColorForSizes, setActiveColorForSizes] = useState<string | null>(null);
  const [editingVariantsProduct, setEditingVariantsProduct] = useState<Product | null>(null);
  const [editingSpecsProduct, setEditingSpecsProduct] = useState<Product | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [tempSpecKey, setTempSpecKey] = useState('');
  const [tempSpecValue, setTempSpecValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [uploadingImageProductId, setUploadingImageProductId] = useState<string | null>(null);
  const [isGeminiOpen, setIsGeminiOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [inventoryViewMode, setInventoryViewMode] = useState<'grid' | 'list' | 'valuation'>(() => {
    return (localStorage.getItem('inventoryViewMode') as any) || 'list';
  });

  useEffect(() => {
    localStorage.setItem('inventoryViewMode', inventoryViewMode);
  }, [inventoryViewMode]);

  // Custom dialog state to replace native prompt
  const [showEditFieldModal, setShowEditFieldModal] = useState(false);
  const [isCriticalModalOpen, setIsCriticalModalOpen] = useState(false);
  const [editProductField, setEditProductField] = useState<{
    product: Product;
    field: 'name' | 'stock' | 'price' | 'image' | 'category';
    title: string;
    value: string;
  } | null>(null);

  const categories = useMemo(() => {
    const defaultCats = ['Veterinaria', 'Agroquímicos', 'Semillas', 'Herramientas', 'Otros'];
    const uniqueCats = products.map(p => p.category).filter(Boolean) as string[];
    return ['Todos', ...Array.from(new Set([...defaultCats, ...uniqueCats]))];
  }, [products]);

  const getCategoryIcon = (categoryName: string) => {
    switch (categoryName) {
      case 'Todos': return Layers;
      case 'Veterinaria': return Stethoscope;
      case 'Agroquímicos': return Shield;
      case 'Semillas': return Sprout;
      case 'Herramientas': return Wrench;
      default: return Tag;
    }
  };

  const getFallbackImage = (category: string) => {
    if (category && category.toLowerCase().includes('agro')) return '/bottle.png';
    return '/box.png';
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getProducts();
      setProducts(data.map(p => ({ ...p, stock: Number(p.stock) || 0, price: Number(p.price) || 0 })));
      const allUsers = await api.getUsers();
      setUsers(allUsers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Use a longer interval to prevent frequent race conditions and unnecessary load
    const interval = setInterval(async () => {
      // If we are currently uploading, don't poll to avoid state conflicts
      if (uploadingImageProductId) return;

      try {
        const data = await api.getProducts();
        const mappedData = data.map(p => ({ 
          ...p, 
          stock: Number(p.stock) || 0, 
          price: Number(p.price) || 0 
        }));

        setProducts(prev => {
          // Compare only if we are not in the middle of an operation that changes the state
          if (uploadingImageProductId) return prev;
          
          const hasChanged = prev.length !== mappedData.length || 
                             prev.some((p, i) => p.id !== mappedData[i].id || p.stock !== mappedData[i].stock || p.price !== mappedData[i].price || p.image !== mappedData[i].image);
          
          if (hasChanged) {
            return mappedData;
          }
          return prev;
        });
      } catch (err) {}
    }, 15000); // 15 seconds is more reasonable for a real-time-ish feel
    return () => clearInterval(interval);
  }, [uploadingImageProductId]);

  const handleOpenAddModal = () => {
    setNewProductName('');
    setNewProductCategory('Agroquímicos');
    setNewProductPrice('');
    setNewProductStock('');
    setNewProductImage(null);
    setNewProductVariants([]);
    setNewProductSpecs([]);
    setNewProductIsExternal(false);
    setShowAddModal(true);
  };

  const handleUpdateName = (product: Product) => {
    setEditProductField({
      product,
      field: 'name',
      title: 'Actualizar Nombre',
      value: product.name
    });
    setShowEditFieldModal(true);
  };

  const handleUpdateStock = (product: Product) => {
    if (product.variants && product.variants.length > 0) {
      alert("Este producto tiene variantes. Por favor use el editor de variantes para ajustar los stocks individuales.");
      handleEditVariants(product);
      return;
    }
    setEditProductField({
      product,
      field: 'stock',
      title: 'Actualizar Stock Física',
      value: product.stock.toString()
    });
    setShowEditFieldModal(true);
  };

  const handleUpdatePrice = (product: Product) => {
    if (product.variants && product.variants.length > 0) {
      alert("Este producto tiene variantes. Por favor use el editor de variantes para ajustar los precios individuales.");
      handleEditVariants(product);
      return;
    }
    setEditProductField({
      product,
      field: 'price',
      title: 'Actualizar Precio de Lista',
      value: product.price.toString()
    });
    setShowEditFieldModal(true);
  };

  const handleUpdateImageURL = (product: Product) => {
    setEditProductField({
      product,
      field: 'image',
      title: 'Actualizar URL de Foto',
      value: product.image || ''
    });
    setShowEditFieldModal(true);
  };

  const handleUpdateCategory = (product: Product) => {
    setEditProductField({
      product,
      field: 'category',
      title: 'Actualizar Categoría',
      value: product.category || ''
    });
    setShowEditFieldModal(true);
  };

  const handleToggleExternal = async (product: Product) => {
    const newState = !product.is_external;
    const msg = newState ? "¿Marcar este producto como LOTE EXTERNO (Bajo Pedido)? No se valdrá en el inventario financiero." : "¿Quitar etiqueta de Lote Externo? El producto empezará a valer en el inventario financiero.";
    if (!window.confirm(msg)) return;
    try {
      const updated = await api.updateProduct(product.id, { is_external: newState });
      setProducts(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
      if (selectedProduct?.id === product.id) {
        setSelectedProduct(prev => prev ? { ...prev, ...updated } : null);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSaveFieldEdit = async () => {
    if (!editProductField) return;
    const { product, field, value } = editProductField;
    setIsUpdating(true);
    try {
      let updatePayload: any = {};
      if (field === 'name') {
        if (!value || value.trim() === '') return;
        updatePayload.name = value.trim();
      } else if (field === 'stock') {
        const stockInt = parseInt(value, 10);
        if (isNaN(stockInt)) return;
        updatePayload.stock = stockInt;
      } else if (field === 'price') {
        const priceFloat = parseFloat(value);
        if (isNaN(priceFloat) || priceFloat < 0) return;
        updatePayload.price = priceFloat;
      } else if (field === 'image') {
        updatePayload.image = value.trim() || null;
      } else if (field === 'category') {
        if (!value || value.trim() === '') return;
        updatePayload.category = value.trim();
      }

      const updated = await api.updateProduct(product.id, updatePayload);
      setProducts(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
      if (selectedProduct?.id === product.id) {
        setSelectedProduct(prev => prev ? { ...prev, ...updatePayload } : null);
      }
      setShowEditFieldModal(false);
      setEditProductField(null);
    } catch (err: any) {
      alert(`Error actualizando: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEditVariants = (product: Product) => {
    setEditingVariantsProduct(product);
    // Extraer colores y tallas existentes
    const colors = product.variants ? Array.from(new Set(product.variants.map(v => v.color))) : [];
    
    // Crear el mapa de tallas por color
    const sizesMap: Record<string, string[]> = {};
    colors.forEach(color => {
      sizesMap[color] = product.variants ? product.variants.filter(v => v.color === color).map(v => v.size) : [];
    });

    setTempColors(colors);
    setTempSizesMap(sizesMap);
    if (colors.length > 0) setActiveColorForSizes(colors[0]);
    
    setNewProductVariants(product.variants || []);
    setVariantStep('colors');
    setShowVariantModal(true);
  };

  const handleEditSpecifications = (product: Product) => {
    setEditingSpecsProduct(product);
    setNewProductSpecs(product.specifications || []);
    setShowSpecsModal(true);
  };

  const handleSaveEditedSpecifications = async () => {
    if (!editingSpecsProduct || isUpdating) return;
    setIsUpdating(true);
    console.log("Saving specifications for product:", editingSpecsProduct.id);
    try {
      const updated = await api.updateProduct(editingSpecsProduct.id, { 
        specifications: newProductSpecs.length > 0 ? newProductSpecs : null,
        is_external: editingSpecsProduct.is_external
      });
      console.log("Update successful:", updated);
      setProducts(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
      setShowSpecsModal(false);
      setEditingSpecsProduct(null);
      alert("Se guardaron los cambios correctamente.");
    } catch (err: any) {
      console.error("Error saving specifications:", err);
      alert(`Error al guardar cambios: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveEditedVariants = async () => {
    if (!editingVariantsProduct) return;
    try {
      // Rebuild the full payload based on the dynamically selected colors and sizes
      const combinations: any[] = [];
      tempColors.forEach(color => {
        const sizes = tempSizesMap[color] || [];
        if (sizes.length > 0) {
          sizes.forEach(size => combinations.push({ color, size }));
        } else {
          combinations.push({ color, size: 'Única' });
        }
      });
      
      const vars = combinations.length > 0 ? combinations.map((comb, idx) => {
         const existing = newProductVariants.find(v => v.color === comb.color && v.size === comb.size);
         return {
           id: existing?.id || `v-${Date.now()}-${idx}`,
           color: comb.color,
           size: comb.size,
           price: existing?.price !== undefined ? parseFloat(existing.price as any) : (parseFloat(newProductPrice) || editingVariantsProduct.price || 0),
           stock: existing?.stock !== undefined ? parseInt(existing.stock as any, 10) : 0,
           isBlocked: !!existing?.isBlocked
         };
      }) : null;

      let totalStock = editingVariantsProduct.stock;
      if (vars) {
        totalStock = vars.reduce((sum, v) => sum + (v.stock !== undefined ? v.stock : 0), 0);
      }
      
      const updatePayload: any = { variants: vars };
      if (vars) {
        updatePayload.stock = totalStock;
      }
      
      const updated = await api.updateProduct(editingVariantsProduct.id, updatePayload);
      setProducts(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
      setShowVariantModal(false);
      setEditingVariantsProduct(null);
      alert("Variantes actualizadas con éxito.");
    } catch (err: any) {
      alert(`Error actualizando variantes: ${err.message}`);
    }
  };

  const handleViewDetails = (product: Product) => {
    setSelectedProduct(product);
    setShowDetailModal(true);
  };

  const handleGenerateAITechnicalInfo = async () => {
    if (!selectedProduct) return;
    setIsGeneratingAI(true);
    try {
      // 1. Intentamos usar la base de datos local (Gratis)
      const { getGenericDescription } = await import('../data/productKnowledge');
      const info = getGenericDescription(selectedProduct.name, selectedProduct.category);
      
      // Update locally
      const updatedProduct = { ...selectedProduct, description: info };
      setSelectedProduct(updatedProduct);
      
      // Update on server
      try {
        await api.updateProduct(selectedProduct.id, { description: info });
      } catch (saveErr: any) {
        console.warn("Could not save description permanently:", saveErr);
        if (user.role !== 'admin') {
           alert("Información generada. Nota: Solo los administradores pueden modificar descripciones que ya existen.");
        }
      }
      
      // Update in main list
      setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, description: info } : p));
      alert(`Información técnica aplicada desde la base de datos local de Agricovet.`);

    } catch (err: any) {
      alert(`Error generando información: ${err.message}`);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`¿Estás seguro de eliminar el producto "${product.name}"? Esta acción no se puede deshacer.`)) return;

    try {
      await api.deleteProduct(product.id);
      setProducts(prev => prev.filter(p => p.id !== product.id));
    } catch (err: any) {
      alert(`Error eliminando producto: ${err.message || 'Error desconocido'}`);
    }
  };

  const handleUploadImage = async (productId: string, file: File) => {
    try {
      setUploadingImageProductId(productId);
      const res = await api.uploadProductImage(productId, file);
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, image: res.image } : p));
      if (selectedProduct?.id === productId) {
        setSelectedProduct(prev => prev ? { ...prev, image: res.image } : null);
      }
    } catch (err: any) {
      alert(`Error subiendo imagen: ${err.message || 'Error desconocido'}`);
    } finally {
      setUploadingImageProductId(null);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName || !newProductCategory || !newProductPrice || !newProductStock) return;
    setIsAdding(true);
    try {
      const product = await api.createProduct({
        name: newProductName,
        category: newProductCategory,
        price: parseFloat(newProductPrice),
        stock: parseInt(newProductStock, 10),
        is_external: newProductIsExternal,
        variants: newProductVariants.length > 0 ? newProductVariants : undefined,
        specifications: newProductSpecs.length > 0 ? newProductSpecs : undefined
      });
      if (newProductImage) {
        const { image } = await api.uploadProductImage(product.id, newProductImage);
        product.image = image;
      }
      setProducts([product, ...products]);
      setShowAddModal(false);
      setNewProductName('');
      setNewProductCategory('Agroquímicos');
      setNewProductPrice('');
      setNewProductStock('');
      setNewProductImage(null);
      setNewProductVariants([]);
      setNewProductSpecs([]);
      setNewProductIsExternal(false);
    } catch (err: any) {
      alert("Error agregando producto: " + (err.message || 'Error desconocido'));
    } finally {
      setIsAdding(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.category || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className={`max-w-6xl mx-auto flex flex-col ${isMobile ? 'p-4 h-full space-y-6' : 'p-8 space-y-8'}`}>
      
      {/* Brand Header & Title Block */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-[#0b4d2c]/5 px-3 py-1 rounded-full text-[10px] sm:text-xs font-black text-emerald-800 tracking-wider">
            <Package size={12} className="text-[#0b4d2c]" />
            <span>SISTEMA DE CONTROL DE INVENTARIO 2026</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight leading-none">
            Catálogo e <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0b4d2c] to-emerald-700">Inventario Central</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl">
            Consulte la disponibilidad física inmediata, precios de distribución oficiales, variaciones por presentación y especificaciones técnicas oficiales para asesorar correctamente a cada productor.
          </p>
        </div>
        
        {/* Floating AI Assist Indicator */}
        <div className="hidden lg:flex items-center gap-2 bg-[#0b4d2c]/5 border border-[#0b4d2c]/10 rounded-2xl p-3.5 max-w-xs shrink-0 select-none">
          <div className="p-2 bg-emerald-100 text-[#0b4d2c] rounded-xl">
            <Sparkles size={16} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Optimizado con IA</span>
            <span className="text-xs font-bold text-[#0b4d2c] block">Asistente Técnico Gemini Integrado</span>
          </div>
        </div>
      </div>

      {/* Modern Administrative / Seller Stats Row */}
      {user.role === 'admin' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 group hover:border-[#0b4d2c] hover:shadow-md transition-all duration-300">
            <div className="w-12 h-12 bg-emerald-50/80 text-[#0b4d2c] rounded-xl flex items-center justify-center shrink-0">
              <Tag size={20} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-0.5">Catálogo Activo</span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-none"><span className="notranslate" translate="no">{products.length}</span> <span className="text-xs font-semibold text-slate-500">artículos</span></h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 group hover:border-[#0b4d2c] hover:shadow-md transition-all duration-300">
            <div className="w-12 h-12 bg-emerald-50/80 text-[#0b4d2c] rounded-xl flex items-center justify-center shrink-0">
              <Package size={20} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-0.5">Stock en Bodega</span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-none">
                <span className="notranslate" translate="no">{products.reduce((acc, p) => {
                  if (p.is_external) return acc;
                  if (p.variants && p.variants.length > 0) {
                    return acc + p.variants.reduce((vAcc, v) => vAcc + (v.stock !== undefined ? v.stock : p.stock), 0);
                  }
                  return acc + (p.stock || 0);
                }, 0).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span> <span className="text-xs font-semibold text-slate-500">unidades</span>
              </h3>
            </div>
          </div>
          <button
            onClick={() => setIsCriticalModalOpen(true)}
            className="w-full text-left bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-4 group hover:border-[#0b4d2c] hover:shadow-md transition-all duration-300 cursor-pointer"
          >
            <div className="w-12 h-12 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
              <AlertCircle size={20} />
            </div>
            <div className="flex-1">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-0.5">Stock Crítico o Agotado</span>
              <div className="flex items-center justify-between">
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-none">
                  <span className="notranslate" translate="no">{products.filter(p => !p.is_external && isCriticalStock(p)).length}</span> <span className="text-xs font-semibold text-slate-500">artículos</span>
                </h3>
                <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-1 rounded-lg font-black group-hover:bg-[#0b4d2c] group-hover:text-white transition-all uppercase tracking-wider">
                  Ver Todo
                </span>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Flotante Gemini IA Trigger */}
      <motion.button
        drag
        dragMomentum={false}
        onClick={() => setIsGeminiOpen(true)}
        className="fixed z-50 bottom-24 right-6 p-2 bg-slate-900 text-white rounded-full shadow-2xl border border-slate-800 hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all cursor-grab active:cursor-grabbing flex items-center justify-center gap-2 pr-4 pl-3"
        title="Asistente IA"
      >
        <GeminiLogo size={32} animate={false} />
        <span className="text-xs font-black uppercase tracking-widest">Preguntar a IA</span>
      </motion.button>

      <div className="flex flex-col space-y-6">
        
        {/* Search, Actions & Category Filter Panel */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 sm:space-y-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            
            {/* Search Input */}
            <div className="relative w-full lg:max-w-xs flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar insumo, marca o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-805 placeholder:text-slate-400 text-xs sm:text-sm font-semibold outline-none focus:border-[#0b4d2c] focus:bg-white transition-all shadow-inner"
              />
            </div>

            {/* Vista Toggle / View Mode Segmented Bar */}
            <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 w-full sm:w-auto justify-center">
              <button
                type="button"
                onClick={() => setInventoryViewMode('grid')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                  inventoryViewMode === 'grid' 
                    ? "bg-white text-[#0b4d2c] shadow-sm" 
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                <Layers size={13} />
                <span className="hidden xs:inline">MOSAICOS</span>
                <span className="xs:hidden">MOS.</span>
              </button>
              <button
                type="button"
                onClick={() => setInventoryViewMode('list')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                  inventoryViewMode === 'list' 
                    ? "bg-white text-[#0b4d2c] shadow-sm" 
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                <FileText size={13} />
                <span className="hidden xs:inline">LISTADO</span>
                <span className="xs:hidden">LIST.</span>
              </button>
              {user.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => setInventoryViewMode('valuation')}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                    inventoryViewMode === 'valuation' 
                      ? "bg-[#0b4d2c] text-white shadow-sm animate-pulse-once" 
                      : "text-slate-500 hover:text-slate-805"
                  )}
                >
                  <Package size={13} />
                  <span className="hidden xs:inline">VALORACIÓN</span>
                  <span className="xs:hidden">VAL.</span>
                </button>
              )}
            </div>

            {/* Refresh and Add Product Controls */}
            <div className="flex w-full lg:w-auto items-center justify-end gap-2.5">
              <button
                onClick={() => {
                  let csv = "Producto,Categoría,Stock,Precio (Q)\n";
                  let totalValuation = 0;
                  
                  filteredProducts.forEach(p => {
                    if (p.is_external) return;
                    const name = p.name ? p.name.replace(/,/g, '') : 'Sin nombre';
                    const category = p.category ? p.category.replace(/,/g, '') : '';
                    const isIncubadora = category.toUpperCase() === 'INCUBADORAS';
                    
                    if (p.variants && p.variants.length > 0) {
                      p.variants.forEach(v => {
                         const color = v.color ? v.color.replace(/,/g, '') : '';
                         const size = v.size ? v.size.replace(/,/g, '') : '';
                         const vName = `${name} - ${color} ${size}`.trim().replace(/,/g, '');
                         const vStock = v.stock !== undefined ? v.stock : (p.stock || 0);
                         const vPrice = v.price || p.price || 0;
                         csv += `${vName},${category},${vStock},${Number(vPrice).toFixed(2)}\n`;
                         if (!isIncubadora && vStock > 0) {
                           totalValuation += vStock * Number(vPrice);
                         }
                      });
                    } else {
                      const pStock = p.stock || 0;
                      const pPrice = p.price || 0;
                      csv += `${name},${category},${pStock},${Number(pPrice).toFixed(2)}\n`;
                      if (!isIncubadora && pStock > 0) {
                        totalValuation += pStock * Number(pPrice);
                      }
                    }
                  });
                  
                  csv += `GRAN TOTAL (Excluyendo Incubadoras),,,${totalValuation.toFixed(2)}\n`;

                  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.setAttribute('href', url);
                  link.setAttribute('download', `inventario_${new Date().toLocaleDateString('es-GT').replace(/\//g, '-')}.csv`);
                  link.style.visibility = 'hidden';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="flex items-center justify-center gap-1.5 h-11 px-4 border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer bg-white shrink-0"
                title="Descargar Inventario (CSV para Gemini)"
              >
                <Download size={14} />
                <span className="hidden sm:inline">CSV (IA)</span>
              </button>

              <button
                onClick={async () => {
                  try {
                    const XLSX = await import('xlsx');
                    
                    const rows: any[] = [];
                    let totalValuation = 0;
                    
                    filteredProducts.forEach(p => {
                      if (p.is_external) return;
                      const name = p.name || 'Sin nombre';
                      const category = p.category || '';
                      const isIncubadora = category.toUpperCase() === 'INCUBADORAS';
                      
                      if (p.variants && p.variants.length > 0) {
                        p.variants.forEach(v => {
                           const vName = `${name} - ${v.color || ''} ${v.size || ''}`.trim();
                           const vStock = v.stock !== undefined ? v.stock : (p.stock || 0);
                           const vPrice = v.price || p.price || 0;
                           rows.push({
                             'Producto': vName,
                             'Categoría': category,
                             'Stock': vStock,
                             'Precio (Q)': Number(vPrice)
                           });
                           if (!isIncubadora && vStock > 0) {
                             totalValuation += vStock * Number(vPrice);
                           }
                        });
                      } else {
                        const pStock = p.stock || 0;
                        const pPrice = p.price || 0;
                        rows.push({
                           'Producto': name,
                           'Categoría': category,
                           'Stock': pStock,
                           'Precio (Q)': Number(pPrice)
                        });
                        if (!isIncubadora && pStock > 0) {
                          totalValuation += pStock * Number(pPrice);
                        }
                      }
                    });
                    
                    rows.push({
                      'Producto': 'GRAN TOTAL (Excluyendo Incubadoras):',
                      'Categoría': '',
                      'Stock': '',
                      'Precio (Q)': totalValuation
                    });

                    const worksheet = XLSX.utils.json_to_sheet(rows);
                    
                    // Simple styling isn't well supported in standard xlsx without pro version, but we can set column widths
                    const wscols = [
                        {wch: 40},
                        {wch: 25},
                        {wch: 10},
                        {wch: 15}
                    ];
                    worksheet['!cols'] = wscols;

                    const workbook = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
                    
                    XLSX.writeFile(workbook, `inventario_${new Date().toLocaleDateString('es-GT').replace(/\//g, '-')}.xlsx`);
                  } catch (err) {
                    console.error("Error al generar Excel:", err);
                    alert("No se pudo generar el archivo Excel.");
                  }
                }}
                className="flex items-center justify-center gap-1.5 h-11 px-4 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer bg-white shrink-0"
                title="Descargar Inventario (Excel/CSV)"
              >
                <Download size={14} />
                <span className="hidden sm:inline">EXCEL</span>
              </button>
              
              <button
                onClick={() => loadData()}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 h-11 px-4 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer bg-white shrink-0"
                title="Actualizar datos"
              >
                <RotateCw size={14} className={cn(loading && "animate-spin text-[#0b4d2c]")} />
                <span className="hidden sm:inline">REFRESCAR</span>
              </button>

              {user.role === 'admin' && (
                <button
                  onClick={handleOpenAddModal}
                  className="flex items-center justify-center gap-1.5 h-11 px-6 bg-[#0b4d2c] hover:bg-[#083a21] text-white rounded-xl text-xs font-black tracking-wider transition-all shadow-md hover:shadow-lg shadow-emerald-950/20 active:scale-95 whitespace-nowrap cursor-pointer"
                >
                  <Plus size={16} />
                  <span>NUEVO PRODUCTO</span>
                </button>
              )}
            </div>

          </div>

          {/* Interactive Categories Bar using exact HomePage styling approach */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200 snap-x">
            {categories.map((cat) => {
              const IconComponent = getCategoryIcon(cat);
              const isActive = selectedCategory === cat;
              const countOfCat = cat === 'Todos' ? products.length : products.filter(p => p.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer whitespace-nowrap snap-start ${
                    isActive
                      ? 'bg-[#0b4d2c] border-[#0b4d2c] text-white shadow-md shadow-emerald-950/10'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-emerald-500/30 hover:bg-white'
                  }`}
                >
                  <IconComponent size={14} className={isActive ? "text-emerald-300" : "text-[#0b4d2c]"} />
                  <span>{cat}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/15 text-white' : 'bg-slate-200/70 text-slate-500'}`}>
                    {countOfCat}
                  </span>
                </button>
              );
            })}
          </div>

        </div>

        {/* Add Product Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl shadow-teal-900/10 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-slate-100">
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-black text-xl text-slate-800">Añadir Producto</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 overflow-y-auto">
                <form id="add-product-form" onSubmit={handleAddProduct} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Nombre del producto</label>
                    <input autoFocus required type="text" value={newProductName} onChange={e => setNewProductName(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 bg-slate-50/50 shadow-sm outline-none transition-all font-medium text-slate-800" placeholder="Ej. Fertilizante Triple 15" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Categoría</label>
                    <input 
                      required 
                      type="text" 
                      list="categories-datalist"
                      value={newProductCategory} 
                      onChange={e => setNewProductCategory(e.target.value)} 
                      placeholder="Escriba o elija una categoría..."
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 bg-slate-50/50 shadow-sm outline-none transition-all font-medium text-slate-800" 
                    />
                    <datalist id="categories-datalist">
                      {categories.filter(c => c !== 'Todos').map(cat => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Precio Unitario (Q)</label>
                      <input required type="number" step="0.01" min="0" value={newProductPrice} onChange={e => setNewProductPrice(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 bg-slate-50/50 shadow-sm outline-none transition-all font-medium text-slate-800" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Stock Inicial</label>
                      <input required type="number" min="0" value={newProductStock} onChange={e => setNewProductStock(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 bg-slate-50/50 shadow-sm outline-none transition-all font-medium text-slate-800" placeholder="0" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Variantes (Variante/Talla)</label>
                    <button 
                      type="button" 
                      onClick={() => {
                        setVariantStep('colors');
                        setShowVariantModal(true);
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 border border-slate-200 rounded-xl bg-orange-50/50 hover:bg-orange-50 text-orange-700 font-bold transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <Tag size={18} />
                        <span>{newProductVariants.length > 0 ? `${newProductVariants.length} variantes configuradas` : 'Configurar Variantes y Tallas'}</span>
                      </div>
                      <Plus size={18} />
                    </button>
                    {newProductVariants.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Array.from(new Set(newProductVariants.map(v => v.color))).map(c => (
                          <span key={c} className="px-2 py-0.5 bg-white border border-slate-200 text-[10px] font-bold rounded-md text-slate-600">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Foto del Producto (Opcional)</label>
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50/80 transition-colors bg-white">
                      {newProductImage ? (
                        <div className="flex flex-col items-center">
                          <img src={URL.createObjectURL(newProductImage)} alt="Preview" className="w-24 h-24 object-contain rounded-xl mb-3 border border-slate-100 bg-white shadow-sm" />
                          <button type="button" onClick={() => setNewProductImage(null)} className="text-xs text-red-500 font-bold hover:text-red-600 bg-red-50 px-3 py-1 rounded-lg transition-colors">Quitar foto</button>
                        </div>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center px-4 py-2 w-full">
                          <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center mb-3">
                            <ImageIcon size={24} className="text-teal-500" />
                          </div>
                          <span className="text-sm font-bold text-teal-600 mb-1">Haz clic para subir foto</span>
                          <span className="text-[11px] text-slate-400 font-medium">Cualquier imagen</span>
                          <input type="file" className="hidden" accept="image/*" onClick={(e) => { e.currentTarget.value = ''; }} onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setNewProductImage(e.target.files[0]);
                            }
                          }} />
                        </label>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Especificaciones (Informativas)</label>
                    <button 
                      type="button" 
                      onClick={() => setShowSpecsModal(true)}
                      className="w-full flex items-center justify-between px-4 py-3 border border-slate-200 rounded-xl bg-blue-50/50 hover:bg-blue-50 text-blue-700 font-bold transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <Info size={18} />
                        <span>{newProductSpecs.length > 0 ? `${newProductSpecs.length} especificaciones` : 'Agregar Especificaciones'}</span>
                      </div>
                      <Plus size={18} />
                    </button>
                    {newProductSpecs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {newProductSpecs.slice(0, 3).map(s => (
                          <span key={s.key} className="px-2 py-0.5 bg-white border border-slate-200 text-[10px] font-bold rounded-md text-slate-600">{s.key}</span>
                        ))}
                        {newProductSpecs.length > 3 && <span className="text-[10px] text-slate-400 font-bold ml-1">+{newProductSpecs.length - 3} más</span>}
                      </div>
                    )}
                  </div>
                </form>
              </div>
              <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-3 text-slate-500 font-bold hover:bg-slate-200/50 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button disabled={isAdding} type="submit" form="add-product-form" className="px-6 py-3 bg-gradient-to-r from-teal-400 to-emerald-500 hover:from-teal-500 hover:to-emerald-600 shadow-lg shadow-teal-500/20 disabled:shadow-none disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center gap-2 transform hover:-translate-y-0.5">
                  {isAdding ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Product Detail Modal */}
        {showDetailModal && selectedProduct && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100"
            >
              <div className="relative h-48 sm:h-64 bg-slate-50 flex items-center justify-center p-6 border-b border-slate-100 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/5 to-transparent pointer-events-none"></div>
                
                {uploadingImageProductId === selectedProduct.id ? (
                  <div className="flex flex-col items-center justify-center relative z-10">
                    <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs font-bold text-teal-700 mt-2">Subiendo imagen...</span>
                  </div>
                ) : (
                  <img 
                    src={selectedProduct.image || getFallbackImage(selectedProduct.category)} 
                    alt={selectedProduct.name} 
                    className="max-w-full max-h-full object-contain drop-shadow-xl relative z-10" 
                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getFallbackImage(selectedProduct.category); }}
                    referrerPolicy="no-referrer"
                  />
                )}

                <button 
                  onClick={() => setShowDetailModal(false)} 
                  className="absolute top-6 right-6 p-2.5 bg-white/80 hover:bg-white backdrop-blur shadow-sm rounded-full text-slate-500 hover:text-slate-800 transition-all z-20 border border-slate-200"
                >
                  <X size={20} />
                </button>

                <div 
                  onClick={() => {
                    if (user.role === 'admin') {
                      setShowDetailModal(false);
                      handleUpdateCategory(selectedProduct);
                    }
                  }}
                  className={cn(
                    "absolute top-6 left-6 px-4 py-1.5 bg-white/80 backdrop-blur shadow-sm rounded-full text-[10px] sm:text-xs font-black text-teal-700 border border-teal-100 uppercase tracking-widest z-10",
                    user.role === 'admin' ? "cursor-pointer hover:bg-teal-50 hover:border-teal-300 hover:scale-105 transition-all flex items-center gap-1.5" : ""
                  )}
                  title={user.role === 'admin' ? "Haga clic para editar categoría" : undefined}
                >
                  <span>{selectedProduct.category}</span>
                  {user.role === 'admin' && <Edit2 size={10} className="text-teal-600" />}
                </div>

                {user.role === 'admin' && uploadingImageProductId !== selectedProduct.id && (
                  <div className="absolute bottom-4 right-4 z-20 flex gap-2">
                    <label className="cursor-pointer px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md hover:scale-105 transition-all">
                      <Upload size={13} className="text-emerald-200" />
                      <span>Subir Foto</span>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onClick={(e) => { e.currentTarget.value = ''; }} 
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleUploadImage(selectedProduct.id, e.target.files[0]);
                          }
                        }} 
                      />
                    </label>
                    <button 
                      onClick={() => handleUpdateImageURL(selectedProduct)}
                      className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md hover:scale-105 transition-all"
                    >
                      <ImageIcon size={13} className="text-slate-500" />
                      <span>Pegar URL</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-10">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                  <div className="flex-1">
                    <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Detalles del Producto</p>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight notranslate" translate="no">{selectedProduct.name}</h2>
                    <p className="text-xs sm:text-sm text-slate-500 font-mono mt-1">SKU: {selectedProduct.id}</p>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-1">
                    <p className="text-sm sm:text-base font-black text-[#116858] bg-teal-50 px-4 py-1.5 rounded-xl border border-teal-100">
                      Q{selectedProduct.price.toFixed(2)}
                    </p>
                    <p 
                      onClick={() => user.role === 'admin' ? handleToggleExternal(selectedProduct) : undefined}
                      title={user.role === 'admin' ? "Clic para cambiar estado Físico / Externo" : undefined}
                      className={cn(
                      "text-[10px] sm:text-xs font-bold px-3 py-1 rounded-lg",
                      user.role === 'admin' ? "cursor-pointer hover:border-emerald-200 border border-transparent transition-all" : "",
                      doesNotNeedStock(selectedProduct) || selectedProduct.is_external ? "text-emerald-600 bg-emerald-50" : (!isCriticalStock(selectedProduct) ? "text-emerald-600 bg-emerald-50" : (selectedProduct.stock > 0 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50"))
                    )}>
                      {selectedProduct.is_external ? "Bajo Pedido (Externo) - Clic para cambiar" : (doesNotNeedStock(selectedProduct) ? `Exento de Stock (${selectedProduct.stock} en físico)` : `${selectedProduct.stock} unidades en stock`)}
                    </p>
                  </div>
                </div>

                <div className="space-y-8">
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                          <Info size={16} />
                        </div>
                        <h4 className="font-bold text-slate-800">Ficha Técnica e Información</h4>
                      </div>
                      {!selectedProduct.description && !isGeneratingAI && (
                        <button 
                          onClick={handleGenerateAITechnicalInfo}
                          className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all"
                        >
                          <Sparkles size={14} />
                          Investigar con IA
                        </button>
                      )}
                    </div>

                    <div className={cn(
                      "relative min-h-[120px] rounded-2xl p-6 transition-all border",
                      selectedProduct.description ? "bg-slate-50 border-slate-200" : "bg-slate-50/50 border-dashed border-slate-300"
                    )}>
                      {isGeneratingAI ? (
                        <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                          <GeminiLogo size={32} animate={true} />
                          <p className="text-xs font-bold text-slate-500 mt-4 animate-pulse">Consultando base de conocimientos técnica...</p>
                        </div>
                      ) : selectedProduct.description ? (
                        <div className="text-sm text-slate-600 leading-relaxed space-y-3 whitespace-pre-wrap">
                          {selectedProduct.description}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <p className="text-xs font-bold text-slate-400 mb-2">No hay descripción disponible para este producto.</p>
                          <p className="text-[10px] text-slate-400 max-w-[250px]">Utiliza el asistente de IA para obtener información técnica sobre su uso y beneficios.</p>
                        </div>
                      )}
                    </div>
                  </section>

                  {selectedProduct.specifications && selectedProduct.specifications.length > 0 && (
                    <section>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                          <Tag size={16} />
                        </div>
                        <h4 className="font-bold text-slate-800">Especificaciones</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedProduct.specifications.map((spec, idx) => (
                          <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{spec.key}</span>
                            <span className="text-sm font-bold text-slate-700">{spec.value}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                    <section>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                          <Tag size={16} />
                        </div>
                        <h4 className="font-bold text-slate-800">Variantes y Tallas</h4>
                      </div>
                      <div className="flex flex-col gap-2">
                        {selectedProduct.variants.map((variant) => (
                          <div key={variant.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-xl">
                            <div>
                                <span className="font-bold text-slate-700 text-sm">{variant.color}</span>
                                <span className="mx-2 text-slate-300">|</span>
                                <span className="text-slate-500 font-bold text-sm">{variant.size}</span>
                                {variant.isBlocked && (
                                  <span className="ml-2 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-red-50 text-red-650 border border-red-100 inline-block align-middle">
                                    🔒 Bloqueado
                                  </span>
                                )}
                            </div>
                            <div className="flex items-center gap-4 text-sm font-bold">
                                {variant.stock !== undefined && <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded textxs">Stock: {variant.stock}</span>}
                                <span className="text-teal-600">Q{variant.price.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {user.role === 'admin' && (
                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                      <button 
                        onClick={() => { setShowDetailModal(false); handleUpdateName(selectedProduct); }}
                        className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                      >
                        <Edit2 size={16} />
                        Editar Producto
                      </button>
                      <button 
                        onClick={() => { setShowDetailModal(false); handleDeleteProduct(selectedProduct); }}
                        className="flex-1 py-3.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 border border-red-100"
                      >
                        <Trash2 size={16} />
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* QR Code Modal */}
        {selectedProductQR && (
           <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               className="bg-white rounded-[2rem] p-8 shadow-2xl w-full max-w-sm flex flex-col items-center gap-6"
             >
               <h3 className="text-xl font-bold text-slate-800 text-center">QR de {selectedProductQR.name}</h3>
               <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-inner">
                 <QRCode value={selectedProductQR.id} size={200} />
               </div>
               <div className="flex gap-3 w-full">
                 <button onClick={() => setSelectedProductQR(null)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Cerrar</button>
                 <button onClick={() => window.print()} className="flex-1 px-4 py-3 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-700 transition-colors">Imprimir</button>
               </div>
             </motion.div>
           </div>
        )}

        {/* Dynamic & Beautiful Tarjetas Informativas (Product Grid) */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2rem] border border-slate-200 shadow-sm animate-pulse space-y-4">
            <div className="w-10 h-10 border-4 border-[#0b4d2c] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs sm:text-sm text-slate-400 font-bold uppercase tracking-wider">Cargando inventario centralizado...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 max-w-xl mx-auto">
            <Package size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-base font-black text-slate-800">No se encontraron productos</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Intente ajustar el filtro de categoría o reescribir su término de búsqueda.
            </p>
          </div>
        ) : inventoryViewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {filteredProducts.map((product) => {
              const isExempt = doesNotNeedStock(product);
              let gridDisplayStock = product.stock;
              if (product.variants && product.variants.length > 0) {
                 gridDisplayStock = product.variants.reduce((sum, v) => sum + (v.stock !== undefined ? v.stock : product.stock), 0);
              }
              const isOutOfStock = gridDisplayStock === 0 && !product.is_external && !isExempt;
              const isCriticalStock = gridDisplayStock > 0 && gridDisplayStock <= 5 && !product.is_external && !isExempt;
              
              return (
                <div
                  key={product.id}
                  onClick={() => handleViewDetails(product)}
                  className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-[#0b4d2c]/30 transition-all duration-300 flex flex-col group cursor-pointer relative"
                >
                  
                  {/* Card Image Area with overlays */}
                  <div className="h-48 bg-slate-50 flex items-center justify-center p-6 border-b border-slate-100 overflow-hidden relative shrink-0">
                    <img
                      src={product.image || getFallbackImage(product.category)}
                      alt={product.name}
                      className={cn(
                        "max-h-full max-w-full object-contain p-2 drop-shadow-sm group-hover:scale-105 transition-all duration-300",
                        uploadingImageProductId === product.id ? "opacity-30" : "opacity-100"
                      )}
                      onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getFallbackImage(product.category); }}
                      referrerPolicy="no-referrer"
                    />

                    {/* Stock Overlays */}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-center p-4">
                        <span className="bg-red-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg">
                          ¡AGOTADO!
                        </span>
                      </div>
                    )}

                    {/* Left overlay badge for categories */}
                    <div className="absolute top-4 left-4 bg-white/95 backdrop-blur border border-slate-100 px-3 py-1 rounded-full text-[9px] font-black text-[#0b4d2c] tracking-wider uppercase">
                      {product.category}
                    </div>

                    {/* Right overlay badge for external */}
                    {product.is_external && (
                      <div className="absolute top-4 right-4 bg-amber-500 text-white border border-amber-400 px-2.5 py-1 rounded-full text-[9px] font-black tracking-wider uppercase">
                        SOBRE PEDIDO
                      </div>
                    )}

                    {/* Upload Overlay (Hover on Desktop, Touch-Friendly on Mobile) */}
                    {user.role === 'admin' && uploadingImageProductId !== product.id && (
                      <label 
                        onClick={(e) => e.stopPropagation()}
                        className="absolute inset-x-0 bottom-0 bg-[#0b4d2c]/95 text-white py-2 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider cursor-pointer opacity-85 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200"
                        title="Subir foto del insumo"
                      >
                        <Upload size={12} className="text-emerald-300" />
                        <span>Cambiar Foto</span>
                        <input type="file" className="hidden" accept="image/*" onClick={(e) => { e.currentTarget.value = ''; }} onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleUploadImage(product.id, e.target.files[0]);
                          }
                        }} />
                      </label>
                    )}

                    {/* Upload spinner if running */}
                    {uploadingImageProductId === product.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                        <div className="w-5 h-5 border-2 border-[#0b4d2c] border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}

                  </div>

                  {/* Card Content Area */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2.5">
                        <h4 className="text-sm font-black text-slate-800 line-clamp-2 leading-tight notranslate" translate="no">
                          {product.name}
                        </h4>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-black text-[#0b4d2c] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-150 block">
                            <span className="notranslate" translate="no">Q{product.price.toFixed(2)}</span>
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-slate-400 font-bold">
                        <span>SKU: {product.id.split('-')[0]}</span>
                        {product.specifications && product.specifications.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-slate-500 font-semibold">{product.specifications[0].key}: {product.specifications[0].value}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Stock indicator and bars */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-slate-400 uppercase tracking-wider">Disponibilidad</span>
                        <span className={cn(
                          product.is_external || isExempt ? "text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-extrabold" : (gridDisplayStock > 10 ? "text-emerald-600" : (gridDisplayStock > 0 ? "text-amber-600" : "text-red-600"))
                        )}>
                          {product.is_external ? 'Ilimitado (Externo)' : (isExempt ? 'Exento de Stock' : <span className="notranslate" translate="no">{gridDisplayStock} unidades</span>)}
                        </span>
                      </div>
                      
                      {/* Stylized stock indicator progress bar */}
                      {!product.is_external && (
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              isExempt || gridDisplayStock > 10 ? "bg-emerald-500" : (gridDisplayStock > 0 ? "bg-amber-400 animate-pulse" : "bg-red-500")
                            )}
                            style={{ width: `${isExempt ? 100 : Math.min((gridDisplayStock / 30) * 100, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Administrative Controls Block (only for admins) */}
                    {user.role === 'admin' && (
                      <div className="pt-3 border-t border-slate-100 space-y-2" onClick={(e) => e.stopPropagation()}>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Controles administrativos</p>
                        <div className="grid grid-cols-4 gap-1.5">
                          
                          <button
                            onClick={() => handleUpdateStock(product)}
                            className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-200/65 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 transition-all text-[9px] font-bold gap-1 cursor-pointer"
                            title="Ajustar Stock"
                          >
                            <Edit2 size={12} />
                            <span>Stock</span>
                          </button>

                          <button
                            onClick={() => handleUpdatePrice(product)}
                            className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-200/65 text-[#0b4d2c] hover:bg-[#0b4d2c]/10 hover:text-[#0b4d2c] hover:border-emerald-300 transition-all text-[9px] font-bold gap-1 cursor-pointer"
                            title="Ajustar Precio"
                          >
                            <span className="text-xs font-black h-3 leading-none flex items-center">Q</span>
                            <span>Precio</span>
                          </button>

                          <button
                            onClick={() => handleUpdateName(product)}
                            className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-200/65 text-[#0b4d2c] hover:bg-[#0b4d2c]/10 hover:text-[#0b4d2c] hover:border-emerald-300 transition-all text-[9px] font-bold gap-1 cursor-pointer"
                            title="Editar Nombre"
                          >
                            <span className="text-xs font-black h-3 leading-none flex items-center">T</span>
                            <span>Nombre</span>
                          </button>

                          <button
                            onClick={() => handleUpdateImageURL(product)}
                            className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-200/65 text-slate-600 hover:bg-emerald-50 hover:text-emerald-805 hover:border-emerald-300 transition-all text-[9px] font-bold gap-1 cursor-pointer"
                            title="Editar Foto por URL"
                          >
                            <ImageIcon size={12} />
                            <span>URL Foto</span>
                          </button>

                          <button
                            onClick={() => handleEditVariants(product)}
                            className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-200/65 text-slate-600 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200 transition-all text-[9px] font-bold gap-1 cursor-pointer"
                            title="Configurar Presentaciones y Variaciones"
                          >
                            <Tag size={12} />
                            <span>Variantes</span>
                          </button>

                          <button
                            onClick={() => handleEditSpecifications(product)}
                            className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-200/65 text-slate-600 hover:bg-blue-50 hover:text-blue-800 hover:border-blue-200 transition-all text-[9px] font-bold gap-1 cursor-pointer"
                            title="Configurar Ficha Técnica de Especificaciones"
                          >
                            <span className="text-xs font-black h-3 leading-none flex items-center">E</span>
                            <span>Especific.</span>
                          </button>
                          
                          <button
                            onClick={() => setSelectedProductQR(product)}
                            className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-200/65 text-slate-600 hover:bg-sky-50 hover:text-sky-800 hover:border-sky-200 transition-all text-[9px] font-bold gap-1 cursor-pointer"
                            title="Generar Código QR"
                          >
                            <QrCode size={12} />
                            <span>QR</span>
                          </button>

                          <button
                            onClick={() => handleDeleteProduct(product)}
                            className="col-span-2 flex items-center justify-center p-2 rounded-xl bg-red-50 border border-red-200 text-red-650 hover:bg-red-100 hover:text-red-700 transition-all text-[10px] font-bold gap-1 cursor-pointer"
                            title="Eliminar Insumo"
                          >
                            <Trash2 size={12} />
                            <span>Eliminar</span>
                          </button>

                        </div>
                      </div>
                    )}

                    {/* Bottom Detail Link */}
                    <div className="flex justify-end pt-1">
                      <span className="text-[11px] font-black text-[#0b4d2c] group-hover:underline flex items-center gap-1.5">
                        Consultar Ficha Técnica <ExternalLink size={10} className="text-emerald-600" />
                      </span>
                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        ) : inventoryViewMode === 'list' ? (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm mb-16">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-400 uppercase tracking-widest text-[10px] font-black border-b border-slate-100">
                    <th className="px-6 py-4">Producto</th>
                    <th className="px-4 py-4 text-center">Categoría</th>
                    <th className="px-4 py-4 text-right">Precio</th>
                    <th className="px-6 py-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((product) => {
                    const isExempt = doesNotNeedStock(product);
                    let listDisplayStock = product.stock;
                    if (product.variants && product.variants.length > 0) {
                      listDisplayStock = product.variants.reduce((sum, v) => sum + (v.stock !== undefined ? v.stock : product.stock), 0);
                    }
                    const isOutOfStock = listDisplayStock === 0 && !product.is_external && !isExempt;
                    const isCriticalStock = listDisplayStock > 0 && listDisplayStock <= 5 && !product.is_external && !isExempt;

                    return (
                      <tr 
                        key={product.id}
                        onClick={() => handleViewDetails(product)}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center p-1 shrink-0 overflow-hidden relative">
                              <img 
                                src={product.image || getFallbackImage(product.category)} 
                                alt="" 
                                className="w-full h-full object-contain"
                                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getFallbackImage(product.category); }}
                              />
                              {isOutOfStock && <div className="absolute inset-0 bg-red-500/20" />}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-black text-slate-800 line-clamp-1 notranslate leading-snug" translate="no">{product.name}</h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-tighter bg-slate-100 px-1 rounded">
                                  #{product.id.split('-')[0]}
                                </span>
                                
                                <span className={cn(
                                  "text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-1",
                                  product.is_external || isExempt 
                                    ? "text-emerald-700 bg-emerald-50" 
                                    : isOutOfStock 
                                      ? "text-red-700 bg-red-50" 
                                      : isCriticalStock 
                                        ? "text-amber-700 bg-amber-50" 
                                        : "text-slate-500 bg-slate-100"
                                )}>
                                  {product.is_external ? (
                                    <>
                                      <Globe size={10} />
                                      <span>EXT</span>
                                    </>
                                  ) : isExempt ? (
                                    <>
                                      <CheckCircle size={10} />
                                      <span>EXEN</span>
                                    </>
                                  ) : (
                                    <>
                                      <Package size={10} className={cn(isOutOfStock && "animate-pulse")} />
                                      <span>{listDisplayStock} <span className="opacity-60">UDS</span></span>
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-black text-[#0b4d2c] font-mono">Q{product.price.toFixed(2)}</span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {user.role === 'admin' && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleUpdateStock(product); }}
                                className="p-1.5 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100 border border-teal-100 transition-colors"
                                title="Editar Stock"
                              >
                                <Edit2 size={12} />
                              </button>
                            )}
                            <div className="w-6 h-6 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                              <Info size={12} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Premium Inventory Valuation Breakdown Section */
          <div className="space-y-6 mb-16">
            
            {/* KPI Cards Strip */}
          {(() => {
            let totalStock = 0;
            let totalValuation = 0;
            products.forEach(p => {
              if (p.is_external) return;
              const category = p.category || '';
              const isIncubadora = category.toUpperCase() === 'INCUBADORAS';
              
              if (p.variants && p.variants.length > 0) {
                p.variants.forEach(v => {
                  const vStock = v.stock !== undefined ? v.stock : (p.stock || 0);
                  const vPrice = v.price || p.price || 0;
                  totalStock += vStock;
                  if (!isIncubadora && vStock > 0) {
                    totalValuation += vStock * Number(vPrice);
                  }
                });
              } else {
                const pStock = p.stock || 0;
                const pPrice = p.price || 0;
                totalStock += pStock;
                if (!isIncubadora && pStock > 0) {
                  totalValuation += pStock * Number(pPrice);
                }
              }
            });

            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#0b4d2c]/5 p-5 rounded-2xl border border-emerald-950/5 flex flex-col justify-between">
                  <span className="text-[10px] text-[#0b4d2c] font-extrabold uppercase tracking-wider block mb-1">Insumos Filtrados</span>
                  <p className="text-xl sm:text-2xl font-black text-slate-800 leading-none">
                    {filteredProducts.length} <span className="text-xs font-semibold text-slate-500">productos</span>
                  </p>
                </div>

                <div className="bg-emerald-50/40 p-5 rounded-2xl border border-emerald-100 flex flex-col justify-between">
                  <span className="text-[10px] text-emerald-805 font-extrabold uppercase tracking-wider block mb-1">Inventario Físico Central</span>
                  <p className="text-xl sm:text-2xl font-black text-slate-800 leading-none font-mono">
                    {totalStock.toLocaleString('es-GT')} <span className="text-xs font-semibold text-slate-500 font-sans">uds</span>
                  </p>
                </div>

                <div className="bg-emerald-500/10 p-5 rounded-2xl border border-emerald-500/15 flex flex-col justify-[#0b4d2c]">
                  <span className="text-[10px] text-emerald-900 font-extrabold uppercase tracking-wider block mb-1">Financiamiento Almacén</span>
                  <p className="text-xl sm:text-2xl font-black text-[#0b4d2c] leading-none font-mono">
                    Q{totalValuation.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            );
          })()}

            {/* Interactive Grid Valuation Table - Desktop Only */}
            <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden text-slate-705">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse table-auto">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-150 text-slate-400 uppercase tracking-widest text-[9.5px] font-black">
                      <th className="p-4 pl-6 w-28">SKU/ID</th>
                      <th className="p-4">Producto comercializado</th>
                      <th className="p-4 w-36 text-center">Categoría</th>
                      <th className="p-4 w-32 text-right">Existencia</th>
                      <th className="p-4 w-44 text-right">Precio de Catálogo c/u</th>
                      <th className="p-4 w-44 text-right pr-6">Total Financiado (Stock x Precio)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-705">
                    {filteredProducts.map((p) => {
                      const isExempt = doesNotNeedStock(p);
                      let individualTotal = 0;
                      let individualStock = 0;
                      if (!p.is_external) {
                        if (p.variants && p.variants.length > 0) {
                          p.variants.forEach(v => {
                            const vStock = v.stock !== undefined ? v.stock : p.stock;
                            individualStock += vStock;
                            individualTotal += vStock * v.price;
                          });
                        } else {
                          individualStock = p.stock;
                          individualTotal = p.stock * p.price;
                        }
                      }
                      
                      return (
                        <tr 
                          key={p.id}
                          onClick={() => handleViewDetails(p)}
                          className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                        >
                          <td className="p-4 pl-6 font-mono text-[10px] text-slate-400 font-bold whitespace-nowrap">
                            {p.id.split('-')[0].toUpperCase()}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <img 
                                src={p.image || getFallbackImage(p.category)}
                                alt={p.name}
                                className="w-8 h-8 object-contain bg-slate-50 rounded-lg p-0.5 border border-slate-100 shrink-0"
                                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getFallbackImage(p.category); }}
                                referrerPolicy="no-referrer"
                              />
                              <span className="font-extrabold text-slate-800 group-hover:text-[#0b4d2c] transition-colors line-clamp-1 notranslate" translate="no">
                                {p.name}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-flex px-2.5 py-0.5 text-[9px] font-black tracking-wider uppercase rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              {p.category}
                            </span>
                          </td>
                          <td className="p-4 text-right font-bold text-slate-900">
                            {p.is_external ? (
                              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-black">Externo</span>
                            ) : (
                              <span className={cn(
                                individualStock === 0 ? "text-red-500 font-black bg-red-50 px-1.5 py-0.5 rounded" : (isCriticalStock({ name: p.name, category: p.category, stock: individualStock }) ? "text-amber-600 font-black bg-amber-50 px-1.5 py-0.5 rounded" : "text-slate-800")
                              )}>
                                {individualStock}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-slate-500">
                            Q{p.price.toFixed(2)}
                          </td>
                          <td className="p-4 text-right pr-6 font-mono font-black text-slate-800">
                            {p.is_external ? "Q0.00" : `Q${individualTotal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Optimized High Density Card List - Mobile Only */}
            <div className="md:hidden space-y-3">
              {filteredProducts.map((p) => {
                let individualTotal = 0;
                let individualStock = 0;
                if (!p.is_external) {
                  if (p.variants && p.variants.length > 0) {
                    p.variants.forEach(v => {
                      const vStock = v.stock !== undefined ? v.stock : p.stock;
                      individualStock += vStock;
                      individualTotal += vStock * v.price;
                    });
                  } else {
                    individualStock = p.stock;
                    individualTotal = p.stock * p.price;
                  }
                }
                const isOutOfStock = individualStock === 0 && !p.is_external && !doesNotNeedStock(p);
                const isCriticalStock = individualStock > 0 && individualStock <= 5 && !p.is_external && !doesNotNeedStock(p);
                
                return (
                  <div 
                    key={p.id}
                    onClick={() => handleViewDetails(p)}
                    className="p-4.5 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col gap-3.5 hover:border-[#0b4d2c]/30 active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <img 
                        src={p.image || getFallbackImage(p.category)}
                        alt={p.name}
                        className="w-10 h-10 object-contain bg-slate-50 rounded-xl p-1 border border-slate-100 shrink-0"
                        onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getFallbackImage(p.category); }}
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] uppercase font-black tracking-widest text-[#0b4d2c] block mb-0.5">{p.category}</span>
                        <h4 className="text-xs font-black text-slate-805 line-clamp-2 notranslate leading-snug" translate="no">
                          {p.name}
                        </h4>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-slate-100 text-[10px] font-bold">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-400 uppercase text-[8px] tracking-wider font-extrabold">Existencia</span>
                        <span className={cn(
                          p.is_external ? "text-emerald-600" : (isOutOfStock ? "text-red-500" : (isCriticalStock ? "text-amber-600" : "text-slate-800")),
                          "text-xs font-black"
                        )}>
                          {p.is_external ? 'Lote Externo' : `${individualStock} uds`}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 text-right">
                        <span className="text-slate-400 uppercase text-[8px] tracking-wider font-extrabold">Precio Un.</span>
                        <span className="text-slate-600 text-xs font-black font-mono font-medium">Q{p.price.toFixed(2)}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 text-right bg-emerald-50/50 p-2 rounded-xl border border-emerald-100">
                        <span className="text-[#0b4d2c] uppercase text-[7.5px] tracking-widest font-extrabold">Suma Total</span>
                        <span className="text-[#0b4d2c] text-xs font-black font-mono">
                          Q{individualTotal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Giant Grand Total Banner at the bottom */}
            <div className="bg-gradient-to-br from-slate-900 via-[#0a3821] to-[#041a0e] rounded-[2rem] p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-800 mt-8 select-none">
              <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-5 pointer-events-none">
                <svg className="w-full h-full text-white animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                </svg>
              </div>

              <div className="space-y-2 relative z-10">
                <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-black text-emerald-400 tracking-widest uppercase mb-1">
                  <span>Balance Consolidado de Inventario 2026</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-none animate-pulse">
                  Resumen de Capital Activo
                </h3>
                <p className="text-xs font-medium text-slate-300 max-w-xl leading-normal">
                  Este valor representa el costo comercial consolidado del inventario disponible para distribución. Se actualiza en tiempo real al ajustar compras, ventas o cantidades en bodega.
                </p>
              </div>

              <div className="text-left md:text-right shrink-0 relative z-10 flex flex-col justify-center">
                <span className="text-[10px] sm:text-xs text-emerald-400 font-extrabold uppercase tracking-widest block mb-1">Gran Total Valorización comercial</span>
                <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-white font-mono tracking-tight leading-none">
                  Q{(() => {
                    let overallTotal = 0;
                    products.forEach(prod => {
                      if (!prod.is_external) {
                        const isIncubadora = (prod.category || '').toUpperCase() === 'INCUBADORAS';
                        if (!isIncubadora) {
                          if (prod.variants && prod.variants.length > 0) {
                            prod.variants.forEach(v => {
                              const vStock = v.stock !== undefined ? v.stock : prod.stock;
                              if (vStock > 0) {
                                overallTotal += vStock * (v.price || prod.price || 0);
                              }
                            });
                          } else {
                            if (prod.stock > 0) {
                              overallTotal += prod.stock * (prod.price || 0);
                            }
                          }
                        }
                      }
                    });
                    return overallTotal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  })()}
                </span>
                <span className="text-[9.5px] text-emerald-300/60 font-semibold block mt-2">
                  Balance consolidado total (excluye Incubadoras, externos y stock negativo)
                </span>
                
                {/* Filtered total if search/category filters are active */}
                {(selectedCategory !== 'Todos' || searchTerm !== '') && (
                  <div className="mt-2 pt-2 border-t border-emerald-500/10 text-slate-300 text-xs">
                    <span className="font-medium text-[10px] text-emerald-400 block uppercase tracking-wider">Costo de Selección Filtrada</span>
                    <span className="font-mono font-bold text-white">
                      Q{(() => {
                        let filteredSum = 0;
                        filteredProducts.forEach(prod => {
                          if (!prod.is_external) {
                            const isIncubadora = (prod.category || '').toUpperCase() === 'INCUBADORAS';
                            if (!isIncubadora) {
                              if (prod.variants && prod.variants.length > 0) {
                                prod.variants.forEach(v => {
                                  const vStock = v.stock !== undefined ? v.stock : prod.stock;
                                  if (vStock > 0) {
                                    filteredSum += vStock * (v.price || prod.price || 0);
                                  }
                                });
                              } else {
                                if (prod.stock > 0) {
                                  filteredSum += prod.stock * (prod.price || 0);
                                }
                              }
                            }
                          }
                        });
                        return filteredSum.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      })()}
                    </span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">
                      Sumando {filteredProducts.filter(p => !p.is_external && (p.category || '').toUpperCase() !== 'INCUBADORAS' && (p.stock > 0 || (p.variants && p.variants.some((v: any) => v.stock > 0)))).length} de {filteredProducts.length} productos mostrados
                    </span>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* Modales de Variantes (Colores -> Tallas -> Precios) */}
      {showVariantModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] border border-slate-100"
          >
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg sm:text-xl text-slate-800">
                  {variantStep === 'colors' ? 'Paso 1: Variantes' : variantStep === 'sizes' ? 'Paso 2: Tallas' : 'Paso 3: Precios'}
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider">Configuración de Variantes</p>
              </div>
              <button onClick={() => {
                setShowVariantModal(false);
                setEditingVariantsProduct(null);
              }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 sm:p-8 overflow-y-auto">
              {variantStep === 'colors' && (
                <div className="space-y-6">
                  <p className="text-sm text-slate-600 leading-relaxed">Paso Inicial: Escribe las variantes disponibles para este producto (ej. Oro, Plata, Madera).</p>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      id="color-input"
                      placeholder="Nombre de la variante..."
                      className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (e.currentTarget as HTMLInputElement).value.trim();
                          if (val && !tempColors.includes(val)) {
                            setTempColors([...tempColors, val]);
                            (e.currentTarget as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('color-input') as HTMLInputElement;
                        const val = input.value.trim();
                        if (val && !tempColors.includes(val)) {
                          setTempColors([...tempColors, val]);
                          input.value = '';
                        }
                      }}
                      className="px-4 py-3 bg-slate-800 text-white rounded-xl font-bold text-sm"
                    >
                      Añadir
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tempColors.map(c => (
                      <div key={c} className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-100 text-orange-700 rounded-xl text-sm font-bold">
                        {c}
                        <button onClick={() => {
                          setTempColors(tempColors.filter(cc => cc !== c));
                          const newMap = { ...tempSizesMap };
                          delete newMap[c];
                          setTempSizesMap(newMap);
                        }}><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                  {tempColors.length === 0 && <p className="text-center py-4 text-xs text-slate-400 italic">Agrega al menos una variante para continuar</p>}
                </div>
              )}

              {variantStep === 'sizes' && (
                <div className="space-y-6">
                  <p className="text-sm text-slate-600 leading-relaxed">Paso 2: Define qué tallas tiene cada variante.</p>
                  
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl overflow-x-auto">
                    {tempColors.map(color => (
                      <button
                        key={color}
                        onClick={() => setActiveColorForSizes(color)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                          activeColorForSizes === color ? "bg-white text-orange-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        {color}
                        <span className="ml-1 opacity-60">({tempSizesMap[color]?.length || 0})</span>
                      </button>
                    ))}
                  </div>

                  {activeColorForSizes && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pt-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Añadir tallas para {activeColorForSizes}</p>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          id={`size-input-${activeColorForSizes}`}
                          placeholder="Ej: Grande, XL, 40..."
                          className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = (e.currentTarget as HTMLInputElement).value.trim();
                              if (val) {
                                const current = tempSizesMap[activeColorForSizes] || [];
                                if (!current.includes(val)) {
                                  setTempSizesMap({ ...tempSizesMap, [activeColorForSizes]: [...current, val] });
                                  (e.currentTarget as HTMLInputElement).value = '';
                                }
                              }
                            }
                          }}
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            const input = document.getElementById(`size-input-${activeColorForSizes}`) as HTMLInputElement;
                            const val = input.value.trim();
                            if (val) {
                              const current = tempSizesMap[activeColorForSizes] || [];
                              if (!current.includes(val)) {
                                setTempSizesMap({ ...tempSizesMap, [activeColorForSizes]: [...current, val] });
                                input.value = '';
                              }
                            }
                          }}
                          className="px-4 py-3 bg-teal-600 text-white rounded-xl font-bold text-sm"
                        >
                          Añadir
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(tempSizesMap[activeColorForSizes] || []).map(s => (
                          <div key={s} className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl text-xs font-bold">
                            {s}
                            <button onClick={() => {
                              const current = tempSizesMap[activeColorForSizes] || [];
                              setTempSizesMap({ ...tempSizesMap, [activeColorForSizes]: current.filter(ss => ss !== s) });
                            }}><X size={14} /></button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {variantStep === 'prices' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 leading-relaxed">Paso Final: Define el precio para cada combinación encontrada.</p>
                  <div className="space-y-3">
                    {tempColors.flatMap(color => {
                      const variantsForColor = tempSizesMap[color] || [];
                      return variantsForColor.length > 0 
                        ? variantsForColor.map(size => ({ color, size }))
                        : [{ color, size: 'Única' }]; // Si no hay tallas, crear una genérica
                    }).map((comb, idx) => {
                       const existing = newProductVariants.find(v => v.color === comb.color && v.size === comb.size);
                       return (
                         <div key={`${comb.color}-${comb.size}-${idx}`} className="flex flex-col gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <div className="flex-1">
                            <p className="text-xs font-black text-slate-800 uppercase tracking-wide">{comb.color} - {comb.size}</p>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 w-full">
                            <div className="flex items-center gap-2 flex-1 min-w-[90px]">
                              <span className="text-slate-400 text-xs font-bold shrink-0">Stock</span>
                              <input 
                                type="number"
                                placeholder={"0"}
                                defaultValue={existing?.stock || ""}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                onChange={(e) => {
                                  const stock = e.target.value === "" ? undefined : parseInt(e.target.value) || 0;
                                  setNewProductVariants(prev => {
                                    const otherVariants = prev.filter(v => !(v.color === comb.color && v.size === comb.size));
                                    const currentVariant = prev.find(v => v.color === comb.color && v.size === comb.size) || { id: `v-${Date.now()}-${idx}`, color: comb.color, size: comb.size, price: parseFloat(newProductPrice) || 0 };
                                    return [...otherVariants, { ...currentVariant, stock }];
                                  });
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-2 flex-1 min-w-[100px]">
                              <span className="text-slate-400 text-xs font-bold shrink-0">Q</span>
                              <input 
                                type="number"
                                step="0.01"
                                placeholder={newProductPrice || "0.00"}
                                defaultValue={existing?.price || newProductPrice}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500"
                                onChange={(e) => {
                                  const price = parseFloat(e.target.value) || 0;
                                  setNewProductVariants(prev => {
                                    const otherVariants = prev.filter(v => !(v.color === comb.color && v.size === comb.size));
                                    const currentVariant = prev.find(v => v.color === comb.color && v.size === comb.size) || { id: `v-${Date.now()}-${idx}`, color: comb.color, size: comb.size, price: parseFloat(newProductPrice) || 0 };
                                    return [...otherVariants, { ...currentVariant, price }];
                                  });
                                }}
                              />
                            </div>
                            
                            <div className="flex items-center justify-center gap-1.5 select-none bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl px-3 py-2 cursor-pointer w-full xs:w-auto">
                              <input 
                                type="checkbox"
                                id={`block-${comb.color}-${comb.size}-${idx}`}
                                checked={!!existing?.isBlocked}
                                className="rounded text-red-600 focus:ring-red-500 w-4 h-4 border-slate-355 cursor-pointer"
                                onChange={(e) => {
                                  const isBlocked = e.target.checked;
                                  setNewProductVariants(prev => {
                                    const otherVariants = prev.filter(v => !(v.color === comb.color && v.size === comb.size));
                                    const currentVariant = prev.find(v => v.color === comb.color && v.size === comb.size) || { id: `v-${Date.now()}-${idx}`, color: comb.color, size: comb.size, price: parseFloat(newProductPrice) || 0 };
                                    return [...otherVariants, { ...currentVariant, isBlocked }];
                                  });
                                }}
                              />
                              <label htmlFor={`block-${comb.color}-${comb.size}-${idx}`} className="text-[10px] font-extrabold text-red-700 tracking-wide cursor-pointer uppercase select-none">
                                Bloquear
                              </label>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 sm:p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <button 
                type="button"
                onClick={() => {
                  if (variantStep === 'sizes') setVariantStep('colors');
                  if (variantStep === 'prices') setVariantStep('sizes');
                  if (variantStep === 'colors') {
                    setShowVariantModal(false);
                    setEditingVariantsProduct(null);
                  }
                }}
                className="px-5 py-3 text-slate-500 font-bold hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer text-xs sm:text-sm"
              >
                {variantStep === 'colors' ? 'Cerrar' : 'Atrás'}
              </button>
              
              <button 
                type="button"
                disabled={variantStep === 'colors' ? tempColors.length === 0 : false}
                onClick={() => {
                  if (variantStep === 'colors') {
                    setVariantStep('sizes');
                    if (!activeColorForSizes && tempColors.length > 0) setActiveColorForSizes(tempColors[0]);
                  }
                  else if (variantStep === 'sizes') {
                    // Pre-populate variants with base price if not set
                    const newVariants = tempColors.flatMap((color, cIdx) => {
                      const sizesForColor = tempSizesMap[color] || [];
                      const finalSizes = sizesForColor.length > 0 ? sizesForColor : ['Única'];
                      return finalSizes.map((size, sIdx) => {
                        const existing = newProductVariants.find(v => v.color === color && v.size === size);
                        return existing || {
                          id: `v-${Date.now()}-${cIdx}-${sIdx}`,
                          color,
                          size,
                          price: parseFloat(newProductPrice) || 0,
                          stock: undefined
                        };
                      });
                    });
                    setNewProductVariants(newVariants);
                    setVariantStep('prices');
                  }
                  else if (variantStep === 'prices') {
                    if (editingVariantsProduct) {
                      handleSaveEditedVariants();
                    } else {
                      setShowVariantModal(false);
                    }
                  }
                }}
                className="px-6 py-3 bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-all"
              >
                {variantStep === 'prices' ? 'Finalizar Configuración' : 'Siguiente'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Specifications Modal */}
      {showSpecsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] border border-slate-100"
          >
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-black text-xl text-slate-800">Especificaciones</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Información Adicional</p>
              </div>
              <button 
                onClick={() => {
                  setShowSpecsModal(false);
                  setEditingSpecsProduct(null);
                }} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Opción de Inventario Externo */}
              <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox"
                      checked={editingSpecsProduct ? (editingSpecsProduct.is_external || false) : newProductIsExternal}
                      onChange={(e) => {
                        const val = e.target.checked;
                        if (editingSpecsProduct) {
                          setEditingSpecsProduct(prev => prev ? { ...prev, is_external: val } : null);
                        } else {
                          setNewProductIsExternal(val);
                        }
                      }}
                      className="w-5 h-5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <span className="block text-sm font-black text-slate-800">Producto sobre pedido (Externo)</span>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Si se activa, no ocupará inventario físico y se podrá pedir sin límite de stock.</p>
                  </div>
                </label>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Nombre (Ej: Marca, Peso)</label>
                    <input 
                      type="text"
                      value={tempSpecKey}
                      onChange={e => setTempSpecKey(e.target.value)}
                      placeholder="Nombre..."
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Valor (Ej: Agripac, 5Kg)</label>
                    <input 
                      type="text"
                      value={tempSpecValue}
                      onChange={e => setTempSpecValue(e.target.value)}
                      placeholder="Valor..."
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    if (tempSpecKey && tempSpecValue) {
                      setNewProductSpecs([...newProductSpecs, { key: tempSpecKey, value: tempSpecValue }]);
                      setTempSpecKey('');
                      setTempSpecValue('');
                    }
                  }}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 active:scale-95 transition-all"
                >
                  Añadir Especificación
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lista de Especificaciones</p>
                  {newProductSpecs.length > 0 && (
                    <button 
                      onClick={() => setNewProductSpecs([])}
                      className="text-[10px] font-bold text-red-500 hover:text-red-600 uppercase tracking-tight"
                    >
                      Limpiar Todo
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {newProductSpecs.map((spec, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl group">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{spec.key}</span>
                        <span className="text-sm font-bold text-slate-700">{spec.value}</span>
                      </div>
                      <button 
                        onClick={() => setNewProductSpecs(newProductSpecs.filter((_, i) => i !== idx))}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  {newProductSpecs.length === 0 && (
                    <p className="text-center py-8 text-xs text-slate-400 italic">No hay especificaciones agregadas.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50">
              {editingSpecsProduct ? (
                <button 
                  onClick={handleSaveEditedSpecifications}
                  disabled={isUpdating}
                  className={cn(
                    "w-full py-4 text-white rounded-2xl font-black shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2",
                    isUpdating ? "bg-slate-400 cursor-not-allowed" : "bg-[#116858] shadow-[#116858]/20 hover:bg-[#0e5649]"
                  )}
                >
                  {isUpdating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  <span>{isUpdating ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              ) : (
                <button 
                  onClick={() => setShowSpecsModal(false)}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98]"
                >
                  Listo
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Cajón lateral / Chat interactivo del Asistente Gemini AI */}
      <GeminiAssistant isOpen={isGeminiOpen} onClose={() => setIsGeminiOpen(false)} />

      {/* Custom Edit Property Modal */}
      {showEditFieldModal && editProductField && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => { setShowEditFieldModal(false); setEditProductField(null); }}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-black text-slate-850 text-base flex items-center gap-2">
                <Edit2 size={16} className="text-[#0b4d2c]" />
                {editProductField.title}
              </h3>
              <button 
                onClick={() => { setShowEditFieldModal(false); setEditProductField(null); }}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">
                Producto: <span className="text-[#0b4d2c] font-black">{editProductField.product.name}</span>
              </p>
              
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-0.5">
                  {editProductField.field === 'name' ? 'Nuevo Nombre' : 
                   editProductField.field === 'stock' ? 'Cantidad de StockFisica' : 
                   editProductField.field === 'price' ? 'Precio Unitario (Q)' : 
                   'URL de la Imagen'}
                </label>
                
                {editProductField.field === 'stock' || editProductField.field === 'price' ? (
                  <div className="relative">
                    {editProductField.field === 'price' && (
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">Q</span>
                    )}
                    <input 
                      type="number"
                      step={editProductField.field === 'price' ? "0.01" : "1"}
                      min="0"
                      autoFocus
                      required
                      value={editProductField.value}
                      onChange={(e) => setEditProductField({ ...editProductField, value: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFieldEdit(); }}
                      className={cn(
                        "w-full py-3.5 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#0b4d2c] bg-slate-50 shadow-sm outline-none transition-all font-black text-slate-800 text-lg",
                        editProductField.field === 'price' ? "pl-10 pr-4" : "px-4"
                      )}
                    />
                  </div>
                ) : (
                  <div>
                    <input 
                      type="text"
                      autoFocus
                      required
                      list={editProductField.field === 'category' ? "categories-datalist-edit" : undefined}
                      value={editProductField.value}
                      onChange={(e) => setEditProductField({ ...editProductField, value: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFieldEdit(); }}
                      className="w-full px-4 py-3.5 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#0b4d2c] bg-slate-50 shadow-sm outline-none transition-all font-semibold text-slate-850"
                    />
                    {editProductField.field === 'category' && (
                      <datalist id="categories-datalist-edit">
                        {categories.filter(c => c !== 'Todos').map(cat => (
                          <option key={cat} value={cat} />
                        ))}
                      </datalist>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 flex gap-3 bg-slate-50/50">
              <button 
                type="button"
                onClick={() => { setShowEditFieldModal(false); setEditProductField(null); }}
                className="flex-1 py-3 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-600 font-bold rounded-2xl border border-slate-200 transition-all text-xs uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleSaveFieldEdit}
                disabled={isUpdating}
                className="flex-1 py-3 bg-[#0b4d2c] hover:bg-[#07361e] text-white font-black rounded-2xl shadow-lg shadow-[#0b4d2c]/10 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isUpdating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle size={14} />
                )}
                <span>Guardar</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Custom Critical Stock Detail Modal */}
      {isCriticalModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCriticalModalOpen(false)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-black text-slate-850 text-base flex items-center gap-2">
                <AlertCircle size={18} className="text-amber-600 animate-pulse" />
                <span>Productos en Stock Crítico</span>
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-black">
                  {products.filter(p => !p.is_external && isCriticalStock(p)).length}
                </span>
              </h3>
              <button 
                onClick={() => setIsCriticalModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
              <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
                Los siguientes productos tienen un nivel de stock bajo (5 unidades o menos). Considere reabastecerlos pronto para evitar detener las ventas.
              </p>
              
              {products.filter(p => !p.is_external && isCriticalStock(p)).length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Package size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold">¡Excelente! No hay productos con stock crítico.</p>
                </div>
              ) : (
                products.filter(p => !p.is_external && isCriticalStock(p)).map((p) => {
                  const CategoryIcon = getCategoryIcon(p.category || 'Otros');
                  const isOutOfStock = p.stock <= 0;
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => {
                        setSelectedProduct(p);
                        setShowDetailModal(true);
                        setIsCriticalModalOpen(false);
                      }}
                      className="flex items-center justify-between p-4 bg-slate-50 hover:bg-emerald-50/40 border border-slate-100 hover:border-emerald-100 rounded-2xl group transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                          {p.image ? (
                            <img 
                              src={p.image} 
                              alt={p.name} 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover rounded-xl"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = getFallbackImage(p.category || '');
                              }}
                            />
                          ) : (
                            <CategoryIcon size={16} className="text-[#0b4d2c]" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm group-hover:text-[#0b4d2c] transition-colors leading-tight">
                            {p.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                            <span className="font-bold uppercase tracking-wider">{p.category || 'Otros'}</span>
                            <span>•</span>
                            <span className="font-mono">SKU: {p.id.split('-')[0]}</span>
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right shrink-0">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-2xs",
                          isOutOfStock 
                            ? "bg-red-50 text-red-700 border border-red-100 animate-pulse" 
                            : "bg-amber-50 text-amber-700 border border-amber-100"
                        )}>
                          {isOutOfStock ? 'Agotado 0 Uds' : `${p.stock} Uds`}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button 
                type="button"
                onClick={() => setIsCriticalModalOpen(false)}
                className="px-6 py-3 bg-[#0b4d2c] hover:bg-[#07361e] text-white font-black rounded-2xl transition-all text-xs uppercase tracking-wider cursor-pointer shadow-md"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
