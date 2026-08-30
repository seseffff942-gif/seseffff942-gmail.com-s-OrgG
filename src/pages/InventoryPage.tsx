import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import { Product, User, Offer } from '../types';
import QRCode from 'react-qr-code';
import { Search, Edit2, Upload, Plus, Image as ImageIcon, X, Tag, CheckCircle, Sparkles, Package, Users, Trash2, FileText, Info, ExternalLink, Layers, RotateCw, Filter, Stethoscope, Sprout, Wrench, Shield, AlertCircle, Globe, Download, QrCode, Briefcase, EyeOff, Eye, CheckSquare, Square, RotateCcw, Check, ShieldAlert, AlertTriangle, Percent, TrendingUp, DollarSign, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Flame, Lightbulb, ArrowRight, ArrowDownRight, Compass, FileSpreadsheet } from 'lucide-react';
import { cn, doesNotNeedStock, isCriticalStock, isTecunProduct, calculateSlowMovingProducts, SlowMovingProduct, normalizeSearchText } from '../utils';
import { GeminiLogo, GeminiAssistant } from '../components/GeminiAssistant';
import { OfficeInventory } from '../components/OfficeInventory';
import { motion } from 'motion/react';
import { ProductImage, getFallbackImage } from '../components/ProductImage';

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
  const [inventoryViewMode, setInventoryViewMode] = useState<'grid' | 'list' | 'valuation' | 'office'>(() => {
    return (localStorage.getItem('inventoryViewMode') as any) || 'list';
  });

  useEffect(() => {
    localStorage.setItem('inventoryViewMode', inventoryViewMode);
  }, [inventoryViewMode]);

  const [newProductCostPrice, setNewProductCostPrice] = useState('');
  const [newProductHiddenFromSales, setNewProductHiddenFromSales] = useState(false);
  const [valuationFilterMode, setValuationFilterMode] = useState<'all' | 'investment' | 'sales' | 'stock'>('all');
  const [filterZeroMarginOnly, setFilterZeroMarginOnly] = useState(false);

  const isAdmin = user.role === 'admin' || user.email === 'seseffff942@gmail.com' || user.email === 'limalopez22@gmail.com';
  const isOwner = user.email === 'seseffff942@gmail.com' || user.email === 'limalopez22@gmail.com' || user.role === 'admin';

  const zeroMarginProducts = useMemo(() => {
    return products.filter(p => {
      const cost = Number(p.costPrice ?? (p as any).cost_price) || 0;
      const price = Number(p.price) || 0;
      return cost > 0 && price <= cost;
    });
  }, [products]);

  const handleToggleHiddenFromSales = async (product: Product) => {
    if (!isAdmin) return;
    const newState = !product.hiddenFromSales;
    try {
      await api.updateProduct(product.id, { hiddenFromSales: newState });
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, hiddenFromSales: newState } : p));
      if (selectedProduct && selectedProduct.id === product.id) {
        setSelectedProduct(prev => prev ? { ...prev, hiddenFromSales: newState } : null);
      }
    } catch (err: any) {
      alert(`Error actualizando visibilidad: ${err.message || 'Error desconocido'}`);
    }
  };

  const handleUpdateCostPrice = (product: Product) => {
    if (!isOwner) return;
    setEditProductField({
      product,
      field: 'costPrice',
      title: 'Actualizar Precio de Compra / Costo',
      value: ((product.costPrice !== undefined ? product.costPrice : (product as any).cost_price) || 0).toString()
    });
    setShowEditFieldModal(true);
  };

  const handleEditCostPrice = async (product: Product) => {
    handleUpdateCostPrice(product);
  };

  // Custom dialog state to replace native prompt
  const [showEditFieldModal, setShowEditFieldModal] = useState(false);
  const [isCriticalModalOpen, setIsCriticalModalOpen] = useState(false);
  const [criticalModalTab, setCriticalModalTab] = useState<'active' | 'excluded'>('active');
  const [selectedCriticalForBatch, setSelectedCriticalForBatch] = useState<string[]>([]);
  const [excludedCriticalIds, setExcludedCriticalIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('excluded_critical_product_ids');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const toggleExcludeCritical = (productId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    setExcludedCriticalIds(prev => {
      const updated = prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId];
      localStorage.setItem('excluded_critical_product_ids', JSON.stringify(updated));
      api.updateExcludedCriticalProducts(updated);
      return updated;
    });
    setSelectedCriticalForBatch(prev => prev.filter(id => id !== productId));
  };

  const excludeBatchFromCritical = () => {
    if (!isAdmin || selectedCriticalForBatch.length === 0) return;
    setExcludedCriticalIds(prev => {
      const set = new Set([...prev, ...selectedCriticalForBatch]);
      const updated = Array.from(set);
      localStorage.setItem('excluded_critical_product_ids', JSON.stringify(updated));
      api.updateExcludedCriticalProducts(updated);
      return updated;
    });
    setSelectedCriticalForBatch([]);
  };

  const restoreBatchToCritical = () => {
    if (!isAdmin || selectedCriticalForBatch.length === 0) return;
    setExcludedCriticalIds(prev => {
      const updated = prev.filter(id => !selectedCriticalForBatch.includes(id));
      localStorage.setItem('excluded_critical_product_ids', JSON.stringify(updated));
      api.updateExcludedCriticalProducts(updated);
      return updated;
    });
    setSelectedCriticalForBatch([]);
  };

  const toggleSelectCriticalBatch = (productId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    setSelectedCriticalForBatch(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const activeCriticalProducts = useMemo(() => {
    return products.filter(p => !p.is_external && !excludedCriticalIds.includes(p.id) && isCriticalStock(p));
  }, [products, excludedCriticalIds]);

  const excludedCriticalProducts = useMemo(() => {
    return isAdmin ? products.filter(p => excludedCriticalIds.includes(p.id)) : [];
  }, [products, excludedCriticalIds, isAdmin]);

  // Slow Moving / Detenidos Products State
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isSlowMovingModalOpen, setIsSlowMovingModalOpen] = useState(false);
  const [slowMovingSearchTerm, setSlowMovingSearchTerm] = useState('');
  const [slowMovingDaysThreshold, setSlowMovingDaysThreshold] = useState<number>(15);

  const slowMovingProducts = useMemo(() => {
    return calculateSlowMovingProducts(products, invoices, slowMovingDaysThreshold);
  }, [products, invoices, slowMovingDaysThreshold]);

  const filteredSlowMovingProducts = useMemo(() => {
    if (!slowMovingSearchTerm.trim()) return slowMovingProducts;
    const term = normalizeSearchText(slowMovingSearchTerm);
    return slowMovingProducts.filter(item => {
      return (
        normalizeSearchText(item.name).includes(term) ||
        normalizeSearchText(item.category || '').includes(term) ||
        normalizeSearchText(String(item.id)).includes(term)
      );
    });
  }, [slowMovingProducts, slowMovingSearchTerm]);

  const [editProductField, setEditProductField] = useState<{
    product: Product;
    field: 'name' | 'stock' | 'price' | 'costPrice' | 'image' | 'category';
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


  const loadData = async () => {
    setLoading(true);
    try {
      const [data, allUsers, serverExcluded, allInvoices] = await Promise.all([
        api.getProducts(true),
        api.getUsers(),
        api.getExcludedCriticalProducts(),
        api.getInvoices().catch(() => [])
      ]);
      setProducts(data.map(p => ({ 
        ...p, 
        costPrice: Number(p.costPrice ?? (p as any).cost_price) || 0,
        cost_price: Number(p.cost_price ?? (p as any).costPrice) || 0,
        stock: Number(p.stock) || 0, 
        price: Number(p.price) || 0 
      })));
      setUsers(allUsers);
      setInvoices(allInvoices || []);
      if (Array.isArray(serverExcluded)) {
        setExcludedCriticalIds(serverExcluded);
        localStorage.setItem('excluded_critical_product_ids', JSON.stringify(serverExcluded));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Use a longer interval to prevent frequent race conditions and unnecessary load
    const sincronizar = async () => {
      // If we are currently uploading, don't poll to avoid state conflicts
      if (uploadingImageProductId) return;

      try {
        const [data, serverExcluded] = await Promise.all([
          api.getProducts(true),
          api.getExcludedCriticalProducts()
        ]);
        const mappedData = data.map(p => ({ 
          ...p, 
          costPrice: Number(p.costPrice ?? (p as any).cost_price) || 0,
          cost_price: Number(p.cost_price ?? (p as any).costPrice) || 0,
          stock: Number(p.stock) || 0, 
          price: Number(p.price) || 0 
        }));

        setProducts(prev => {
          if (uploadingImageProductId) return prev;
          
          const hasChanged = prev.length !== mappedData.length || 
                             prev.some((p, i) => p.id !== mappedData[i].id || p.stock !== mappedData[i].stock || p.price !== mappedData[i].price || p.costPrice !== mappedData[i].costPrice || p.image !== mappedData[i].image);
          
          if (hasChanged) {
            return mappedData;
          }
          return prev;
        });

        if (Array.isArray(serverExcluded)) {
          setExcludedCriticalIds(serverExcluded);
          localStorage.setItem('excluded_critical_product_ids', JSON.stringify(serverExcluded));
        }
      } catch (err) {}
    };

    const interval = setInterval(() => {
      if (document.hidden) return; // No consumir servidor si nadie esta mirando
      sincronizar();
    }, 30000);

    const alVolver = () => { if (!document.hidden) sincronizar(); };
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', alVolver);
    };
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
    
    if (field === 'price') {
      const priceFloat = parseFloat(value);
      if (isNaN(priceFloat) || priceFloat < 0) return;
      const currentCost = Number(product.costPrice ?? (product as any).cost_price) || 0;
      if (currentCost > 0 && priceFloat <= currentCost) {
        const isExact = Math.abs(priceFloat - currentCost) < 0.001;
        const msg = isExact 
          ? `⚠️ ADVERTENCIA DE MARGEN 0%:\n\nEl precio de venta (Q${priceFloat.toFixed(2)}) es EXACTAMENTE IGUAL al precio de costo (Q${currentCost.toFixed(2)}).\nNo tendrás margen de ganancia.\n\n¿Estás seguro de que deseas guardar este precio de venta?`
          : `🚨 ALERTA DE PÉRDIDA:\n\nEl precio de venta (Q${priceFloat.toFixed(2)}) es MENOR al precio de costo (Q${currentCost.toFixed(2)}).\nSe registrará una pérdida de Q${(currentCost - priceFloat).toFixed(2)} por unidad.\n\n¿Estás seguro de que deseas guardar este precio?`;
        if (!window.confirm(msg)) {
          return;
        }
      }
    } else if (field === 'costPrice') {
      const costFloat = parseFloat(value);
      if (isNaN(costFloat) || costFloat < 0) return;
      const currentPrice = Number(product.price) || 0;
      if (currentPrice > 0 && costFloat >= currentPrice) {
        const isExact = Math.abs(costFloat - currentPrice) < 0.001;
        const msg = isExact
          ? `⚠️ ADVERTENCIA DE MARGEN 0%:\n\nEl costo de compra (Q${costFloat.toFixed(2)}) es IGUAL al precio de venta actual (Q${currentPrice.toFixed(2)}).\nEl margen de ganancia será 0%.\n\n¿Estás seguro de que deseas guardar este costo?`
          : `🚨 ALERTA DE MARGEN NEGATIVO:\n\nEl costo de compra (Q${costFloat.toFixed(2)}) es MAYOR al precio de venta actual (Q${currentPrice.toFixed(2)}).\n\n¿Deseas guardarlo de todos modos?`;
        if (!window.confirm(msg)) {
          return;
        }
      }
    }

    setIsUpdating(true);
    try {
      let updatePayload: any = {};
      if (field === 'name') {
        if (!value || value.trim() === '') return;
        updatePayload.name = value.trim();
      } else if (field === 'stock') {
        const stockNum = parseFloat(value);
        if (isNaN(stockNum) || stockNum < 0) return;
        updatePayload.stock = stockNum;
      } else if (field === 'price') {
        const priceFloat = parseFloat(value);
        if (isNaN(priceFloat) || priceFloat < 0) return;
        updatePayload.price = priceFloat;
      } else if (field === 'costPrice') {
        const costFloat = parseFloat(value);
        if (isNaN(costFloat) || costFloat < 0) return;
        updatePayload.costPrice = costFloat;
        updatePayload.cost_price = costFloat;
      } else if (field === 'image') {
        updatePayload.image = value.trim() || null;
      } else if (field === 'category') {
        if (!value || value.trim() === '') return;
        updatePayload.category = value.trim();
      }

      const updated = await api.updateProduct(product.id, updatePayload);
      setProducts(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
      if (selectedProduct?.id === product.id) {
        setSelectedProduct(prev => prev ? { ...prev, ...updatePayload, ...updated } : null);
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
    
    const priceNum = parseFloat(newProductPrice);
    const costNum = isOwner && newProductCostPrice ? parseFloat(newProductCostPrice) : 0;
    
    if (costNum > 0 && priceNum <= costNum) {
      const isExact = Math.abs(priceNum - costNum) < 0.001;
      const confirmMsg = isExact
        ? `⚠️ ADVERTENCIA DE MARGEN 0%:\n\nEl Precio de Venta (Q${priceNum.toFixed(2)}) es EXACTAMENTE IGUAL al Precio de Costo (Q${costNum.toFixed(2)}).\nNo tendrás margen de ganancia.\n\n¿Estás seguro de que deseas registrarlo con margen 0%, o prefieres cancelarlo para colocar el precio de venta correcto al público?`
        : `🚨 ALERTA DE PÉRDIDA:\n\nEl Precio de Venta (Q${priceNum.toFixed(2)}) es MENOR al Precio de Costo (Q${costNum.toFixed(2)}).\nSe registrará una pérdida de Q${(costNum - priceNum).toFixed(2)} por unidad.\n\n¿Deseas guardarlo de todos modos?`;
      if (!window.confirm(confirmMsg)) {
        return;
      }
    }
    
    setIsAdding(true);
    try {
      const product = await api.createProduct({
        name: newProductName,
        category: newProductCategory,
        price: priceNum,
        stock: parseInt(newProductStock, 10),
        is_external: newProductIsExternal,
        costPrice: isOwner && newProductCostPrice ? costNum : undefined,
        hiddenFromSales: isAdmin ? newProductHiddenFromSales : undefined,
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
      setNewProductCostPrice('');
      setNewProductHiddenFromSales(false);
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

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.category || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
      const cost = Number(p.costPrice ?? (p as any).cost_price) || 0;
      const price = Number(p.price) || 0;
      const matchesZeroMargin = !filterZeroMarginOnly || (cost > 0 && price <= cost);
      return matchesSearch && matchesCategory && matchesZeroMargin;
    });
  }, [products, searchTerm, selectedCategory, filterZeroMarginOnly]);

  // Pagination State & Optimization
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(24);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, filterZeroMarginOnly]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));

  const paginatedProducts = useMemo(() => {
    if (itemsPerPage >= filteredProducts.length) return filteredProducts;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 lg:gap-5">
          {/* Card 1: Catálogo Activo */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-3.5 group hover:border-[#0b4d2c] hover:shadow-md transition-all duration-300">
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-emerald-50/80 text-[#0b4d2c] rounded-xl flex items-center justify-center shrink-0">
              <Tag size={20} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-0.5">Catálogo Activo</span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-none"><span className="notranslate" translate="no">{products.length}</span> <span className="text-xs font-semibold text-slate-500">artículos</span></h3>
            </div>
          </div>

          {/* Card 2: Stock en Bodega */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-3.5 group hover:border-[#0b4d2c] hover:shadow-md transition-all duration-300">
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-emerald-50/80 text-[#0b4d2c] rounded-xl flex items-center justify-center shrink-0">
              <Package size={20} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-0.5">Stock en Bodega</span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-none">
                <span className="notranslate" translate="no">{products.reduce((acc, p) => {
                  if (p.is_external || doesNotNeedStock(p)) return acc;
                  if (p.variants && p.variants.length > 0) {
                    return acc + p.variants.reduce((vAcc, v) => vAcc + Math.max(0, Number(v.stock !== undefined ? v.stock : p.stock || 0)), 0);
                  }
                  return acc + Math.max(0, Number(p.stock || 0));
                }, 0).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span> <span className="text-xs font-semibold text-slate-500">unidades</span>
              </h3>
            </div>
          </div>

          {/* Card 3: Stock Crítico */}
          <button
            type="button"
            onClick={() => setIsCriticalModalOpen(true)}
            className="w-full text-left bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200/80 flex items-center gap-3.5 group hover:border-amber-400 hover:shadow-md transition-all duration-300 cursor-pointer"
          >
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
              <AlertCircle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-0.5 truncate">Stock Crítico</span>
              <div className="flex items-center justify-between gap-1">
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 leading-none">
                  <span className="notranslate" translate="no">{activeCriticalProducts.length}</span> <span className="text-xs font-semibold text-slate-500">artículos</span>
                </h3>
                <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-lg font-black group-hover:bg-[#0b4d2c] group-hover:text-white transition-all uppercase tracking-wider shrink-0">
                  Ver Todo
                </span>
              </div>
            </div>
          </button>

          {/* Card 4: Productos Sin Rotación (Detenidos) */}
          <button
            type="button"
            onClick={() => setIsSlowMovingModalOpen(true)}
            className="w-full text-left bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-white p-4 sm:p-5 rounded-2xl shadow-sm border border-amber-200/90 flex items-center gap-3.5 group hover:border-amber-400 hover:shadow-md transition-all duration-300 cursor-pointer"
          >
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-amber-200 transition-colors shadow-2xs">
              <Flame size={20} className="text-amber-600 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-amber-900/90 font-black uppercase tracking-widest block mb-0.5 truncate">Sin Rotación (Detenidos)</span>
              <div className="flex items-center justify-between gap-1">
                <h3 className="text-xl sm:text-2xl font-black text-amber-950 leading-none">
                  <span className="notranslate" translate="no">{slowMovingProducts.length}</span> <span className="text-xs font-semibold text-amber-800/80">detenidos</span>
                </h3>
                <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-lg font-black group-hover:bg-amber-600 transition-all uppercase tracking-wider shrink-0 shadow-2xs">
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
        <div className="sticky top-2 z-20 bg-white/95 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-md space-y-4 sm:space-y-5 transition-all">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            
            {/* Search Input */}
            <div className={cn("relative w-full lg:max-w-xs flex-1", inventoryViewMode === 'office' ? 'invisible hidden lg:block' : '')}>
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
                <>
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
                  <button
                    type="button"
                    onClick={() => setInventoryViewMode('office')}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                      inventoryViewMode === 'office' 
                        ? "bg-blue-800 text-white shadow-sm animate-pulse-once" 
                        : "text-slate-500 hover:text-blue-800"
                    )}
                  >
                    <Briefcase size={13} />
                    <span className="hidden xs:inline">OFICINA Y EQUIPO</span>
                    <span className="xs:hidden">OFI.</span>
                  </button>
                </>
              )}
            </div>

            {/* Refresh and Add Product Controls */}
            <div className={cn("flex w-full lg:w-auto items-center justify-end gap-2.5", inventoryViewMode === 'office' ? 'hidden' : '')}>
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
          <div className={cn("flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200 snap-x", inventoryViewMode === 'office' ? 'hidden' : '')}>
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
                  {/* Precios y Margen de Ganancia */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <DollarSign size={14} className="text-[#0b4d2c]" />
                        <span>Precios y Margen de Ganancia</span>
                      </span>
                      {isOwner && (
                        <span className="text-[9px] font-black bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md">
                          Dueño / Admin
                        </span>
                      )}
                    </div>

                    <div className={cn("grid gap-3", isOwner ? "grid-cols-2" : "grid-cols-1")}>
                      {isOwner && (
                        <div>
                          <label className="block text-[10px] font-black text-purple-950 uppercase tracking-wider mb-1">
                            1. Precio Costo / Compra (Q)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 font-black text-sm">Q</span>
                            <input 
                              type="number" 
                              step="0.01" 
                              min="0" 
                              value={newProductCostPrice} 
                              onChange={e => setNewProductCostPrice(e.target.value)} 
                              className="w-full pl-8 pr-3 py-2.5 bg-white border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-xs font-black text-purple-950" 
                              placeholder="Costo factura (0.00)" 
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-[10px] font-black text-[#0b4d2c] uppercase tracking-wider mb-1">
                          {isOwner ? "2. Precio Venta Público (Q)" : "Precio Venta al Público (Q)"}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-sm">Q</span>
                          <input 
                            required 
                            type="number" 
                            step="0.01" 
                            min="0" 
                            value={newProductPrice} 
                            onChange={e => setNewProductPrice(e.target.value)} 
                            className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none text-xs font-black text-slate-800" 
                            placeholder="PVP al cliente (0.00)" 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Quick Markup Helpers if Cost entered */}
                    {isOwner && parseFloat(newProductCostPrice) > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-200/70">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                            <TrendingUp size={11} className="text-emerald-600" />
                            <span>Aplicar margen rápido sobre costo:</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {[15, 20, 25, 30, 40, 50, 100].map(pct => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => {
                                const c = parseFloat(newProductCostPrice);
                                if (!isNaN(c) && c > 0) {
                                  setNewProductPrice((c * (1 + pct / 100)).toFixed(2));
                                }
                              }}
                              className="px-2 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 transition-all shadow-2xs cursor-pointer"
                            >
                              +{pct}%
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Live Margin Calculation Indicator */}
                    {isOwner && parseFloat(newProductCostPrice) > 0 && parseFloat(newProductPrice) > 0 && (() => {
                      const c = parseFloat(newProductCostPrice);
                      const p = parseFloat(newProductPrice);
                      const diff = p - c;
                      const marginPct = ((diff / c) * 100).toFixed(1);
                      if (diff > 0.001) {
                        return (
                          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                            <span className="font-bold text-emerald-800 flex items-center gap-1">
                              <CheckCircle size={13} />
                              <span>Margen de Ganancia:</span>
                            </span>
                            <span className="font-black text-emerald-900 font-mono">
                              +Q{diff.toFixed(2)} ({marginPct}%)
                            </span>
                          </div>
                        );
                      } else if (Math.abs(diff) < 0.001) {
                        return (
                          <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs">
                            <span className="font-black text-amber-900 flex items-center gap-1">
                              <AlertTriangle size={13} className="text-amber-700" />
                              <span>⚠️ Margen 0% (Precio Venta = Costo)</span>
                            </span>
                            <span className="text-[10px] font-black bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                              Sin Ganancia
                            </span>
                          </div>
                        );
                      } else {
                        return (
                          <div className="p-2.5 bg-red-50 border border-red-300 rounded-xl flex items-center justify-between text-xs">
                            <span className="font-black text-red-900 flex items-center gap-1">
                              <AlertTriangle size={13} className="text-red-700" />
                              <span>🚨 Pérdida de Q{Math.abs(diff).toFixed(2)}</span>
                            </span>
                            <span className="text-[10px] font-black bg-red-200 text-red-900 px-1.5 py-0.5 rounded">
                              Venta bajo costo
                            </span>
                          </div>
                        );
                      }
                    })()}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Stock Inicial</label>
                    <input required type="number" min="0" value={newProductStock} onChange={e => setNewProductStock(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 bg-slate-50/50 shadow-sm outline-none transition-all font-medium text-slate-800" placeholder="0" />
                  </div>

                  {isAdmin && (
                    <div className="p-3.5 bg-purple-50/60 border border-purple-200/80 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                          <Shield size={12} className="text-purple-700" />
                          <span>Control de Visibilidad</span>
                        </span>
                        <span className="text-[9px] font-black bg-purple-200/60 text-purple-800 px-2 py-0.5 rounded-md">Admin</span>
                      </div>

                      <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                        <input 
                          type="checkbox" 
                          checked={newProductHiddenFromSales} 
                          onChange={e => setNewProductHiddenFromSales(e.target.checked)} 
                          className="w-4 h-4 rounded text-purple-700 focus:ring-purple-500 cursor-pointer" 
                        />
                        <span className="text-xs font-extrabold text-purple-950">
                          Ocultar de la pantalla de ventas (Solo Inventario)
                        </span>
                      </label>
                    </div>
                  )}
                  
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
                  <ProductImage 
                    src={selectedProduct.image} category={selectedProduct.category} 
                    alt={selectedProduct.name} 
                    className="max-w-full max-h-full object-contain drop-shadow-xl relative z-10"
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
                  <div className="flex flex-col items-start sm:items-end gap-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm sm:text-base font-black text-[#116858] bg-teal-50 px-4 py-1.5 rounded-xl border border-teal-100" title="Precio de Venta al Público">
                        Q{selectedProduct.price.toFixed(2)} <span className="text-[9px] font-normal text-slate-400">venta</span>
                      </p>
                      {isOwner && (
                        <p 
                          onClick={() => handleEditCostPrice(selectedProduct)}
                          className="text-xs font-black text-purple-900 bg-purple-50 hover:bg-purple-100 px-3.5 py-1.5 rounded-xl border border-purple-200 cursor-pointer transition-all flex items-center gap-1.5 shadow-xs"
                          title="Haga clic para editar el Precio de Compra / Costo"
                        >
                          <Shield size={12} className="text-purple-700" />
                          <span>Costo: Q{(Number(selectedProduct.costPrice ?? (selectedProduct as any).cost_price) || 0).toFixed(2)}</span>
                          <Edit2 size={10} className="text-purple-600 ml-0.5 opacity-70" />
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <p 
                        onClick={() => user.role === 'admin' ? handleToggleExternal(selectedProduct) : undefined}
                        title={user.role === 'admin' ? "Clic para cambiar estado Físico / Externo" : undefined}
                        className={cn(
                        "text-[10px] sm:text-xs font-bold px-3 py-1 rounded-lg",
                        user.role === 'admin' ? "cursor-pointer hover:border-emerald-200 border border-transparent transition-all" : "",
                        doesNotNeedStock(selectedProduct) || selectedProduct.is_external ? "text-emerald-600 bg-emerald-50" : (!isCriticalStock(selectedProduct) ? "text-emerald-600 bg-emerald-50" : (selectedProduct.stock > 0 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50"))
                      )}>
                        {selectedProduct.is_external 
                          ? "Bajo Pedido (Externo) - Clic para cambiar" 
                          : (doesNotNeedStock(selectedProduct) 
                              ? `Exento de Stock (${selectedProduct.stock || 0} en físico)` 
                              : (isTecunProduct(selectedProduct) && (selectedProduct.stock || 0) <= 0) 
                                ? "0 unidades en stock (Autorización TECUN)" 
                                : ((selectedProduct.stock || 0) < 0 
                                    ? "0 unidades en stock (En pedido)" 
                                    : `${selectedProduct.stock} unidades en stock`))}
                      </p>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleToggleHiddenFromSales(selectedProduct)}
                          className={cn(
                            "text-[10px] font-black px-3 py-1 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer",
                            selectedProduct.hiddenFromSales 
                              ? "bg-purple-700 text-white border-purple-800 hover:bg-purple-800" 
                              : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                          )}
                          title="Cambiar visibilidad en pantalla de ventas"
                        >
                          {selectedProduct.hiddenFromSales ? (
                            <>
                              <EyeOff size={12} />
                              <span>Solo Inventario</span>
                            </>
                          ) : (
                            <>
                              <Eye size={12} />
                              <span>Visible en Ventas</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
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
        ) : inventoryViewMode === 'office' ? (
          <OfficeInventory user={user} isMobile={isMobile} />
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-200 shadow-sm p-8 max-w-xl mx-auto">
            <Package size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-base font-black text-slate-800">No se encontraron productos</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Intente ajustar el filtro de categoría o reescribir su término de búsqueda.
            </p>
          </div>
        ) : inventoryViewMode === 'grid' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {paginatedProducts.map((product) => {
              const isExempt = doesNotNeedStock(product);
              const isTecun = isTecunProduct(product);
              let gridDisplayStock = product.stock;
              if (product.variants && product.variants.length > 0) {
                 gridDisplayStock = product.variants.reduce((sum, v) => sum + (v.stock !== undefined ? v.stock : product.stock), 0);
              }
              const isOutOfStock = gridDisplayStock === 0 && !product.is_external && !isExempt && !isTecun;
              const isCriticalStockVal = gridDisplayStock > 0 && isCriticalStock({ name: product.name, category: product.category, stock: gridDisplayStock }) && !product.is_external && !isExempt && !isTecun;
              
              return (
                <div
                  key={product.id || Math.random()}
                  onClick={() => handleViewDetails(product)}
                  className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-[#0b4d2c]/30 transition-all duration-300 flex flex-col group cursor-pointer relative"
                >
                  
                  {/* Card Image Area with overlays */}
                  <div className="h-48 bg-slate-50 flex items-center justify-center p-6 border-b border-slate-100 overflow-hidden relative shrink-0">
                    <ProductImage
                      src={product.image} category={product.category}
                      alt={product.name}
                      className={cn(
                        "max-h-full max-w-full object-contain p-2 drop-shadow-sm group-hover:scale-105 transition-all duration-300",
                        uploadingImageProductId === product.id ? "opacity-30" : "opacity-100"
                      )}
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

                    {/* Right overlay badge for external or hidden from sales */}
                    {product.hiddenFromSales ? (
                      <div 
                        onClick={(e) => {
                          if (isAdmin) {
                            e.stopPropagation();
                            handleToggleHiddenFromSales(product);
                          }
                        }}
                        className={cn(
                          "absolute top-4 right-4 bg-purple-700 text-white border border-purple-500 px-2.5 py-1 rounded-full text-[9px] font-black tracking-wider uppercase flex items-center gap-1 shadow-md z-10",
                          isAdmin ? "cursor-pointer hover:scale-105" : ""
                        )}
                        title={isAdmin ? "Clic para cambiar visibilidad en ventas" : "Producto de solo inventario"}
                      >
                        <EyeOff size={10} />
                        <span>Solo Inventario</span>
                      </div>
                    ) : product.is_external ? (
                      <div className="absolute top-4 right-4 bg-amber-500 text-white border border-amber-400 px-2.5 py-1 rounded-full text-[9px] font-black tracking-wider uppercase">
                        SOBRE PEDIDO
                      </div>
                    ) : null}

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
                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <span className="text-sm font-black text-[#0b4d2c] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-150 block" title="Precio de Venta al Público">
                            <span className="notranslate" translate="no">Q{(Number(product.price) || 0).toFixed(2)}</span>
                          </span>
                          {isOwner && Number(product.costPrice ?? (product as any).cost_price) > 0 && (Number(product.price) || 0) <= Number(product.costPrice ?? (product as any).cost_price) && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleUpdatePrice(product); }}
                              className="inline-flex items-center gap-1 text-[9px] font-black text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-1.5 py-0.5 rounded-md cursor-pointer transition-all shadow-2xs"
                              title="Haga clic para corregir el precio de venta"
                            >
                              <AlertTriangle size={10} className="text-amber-700" />
                              <span>{Number(product.price) === Number(product.costPrice ?? (product as any).cost_price) ? 'Margen 0%' : 'Bajo costo'}</span>
                            </button>
                          )}
                          {isOwner && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEditCostPrice(product); }}
                              className="inline-flex items-center gap-1 text-[10px] font-black text-purple-900 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-md border border-purple-200 font-mono transition-all cursor-pointer shadow-2xs"
                              title="Haga clic para editar Precio de Compra / Costo"
                            >
                              <Shield size={10} className="text-purple-700" />
                              <span>Costo: Q{(Number(product.costPrice ?? (product as any).cost_price) || 0).toFixed(2)}</span>
                              <Edit2 size={8} className="text-purple-600 ml-0.5 opacity-70" />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-slate-400 font-bold">
                        <span>SKU: {product.id ? String(product.id).split('-')[0] : ''}</span>
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
                          product.is_external || isExempt ? "text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-extrabold" : (isTecun && gridDisplayStock <= 0) ? "text-purple-700 font-extrabold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/60" : (gridDisplayStock > 10 ? "text-emerald-600" : (gridDisplayStock > 0 ? "text-amber-600" : "text-red-600"))
                        )}>
                          {product.is_external ? 'Ilimitado (Externo)' : (isExempt ? 'Exento de Stock' : (isTecun && gridDisplayStock <= 0) ? '0 unidades (Tecún)' : (gridDisplayStock < 0 ? '0 unidades (En pedido)' : <span className="notranslate" translate="no">{gridDisplayStock} unidades</span>))}
                        </span>
                      </div>
                      
                      {/* Stylized stock indicator progress bar */}
                      {!product.is_external && (
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              isExempt || gridDisplayStock > 10 ? "bg-emerald-500" : (isTecun && gridDisplayStock <= 0) ? "bg-purple-500" : (gridDisplayStock > 0 ? "bg-amber-400 animate-pulse" : "bg-red-500")
                            )}
                            style={{ width: `${isExempt ? 100 : Math.max(0, Math.min((gridDisplayStock / 30) * 100, 100))}%` }}
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

                          {isOwner && (
                            <button
                              onClick={() => handleEditCostPrice(product)}
                              className="flex flex-col items-center justify-center p-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 hover:bg-purple-100 hover:border-purple-300 transition-all text-[9px] font-bold gap-1 cursor-pointer"
                              title="Ajustar Precio de Compra / Costo"
                            >
                              <Shield size={12} className="text-purple-700" />
                              <span>Costo</span>
                            </button>
                          )}

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

          {/* Pagination Controls Bar (Grid) */}
          {totalPages > 1 && (
            <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 select-none mb-12">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span className="font-bold text-slate-800">
                  Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, filteredProducts.length)} - {Math.min(currentPage * itemsPerPage, filteredProducts.length)} de <span className="font-extrabold text-emerald-900">{filteredProducts.length}</span> productos
                </span>
                <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500">Por página:</span>
                  {[24, 48, 96].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        setItemsPerPage(num);
                        setCurrentPage(1);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer",
                        itemsPerPage === num 
                          ? "bg-emerald-700 text-white shadow-xs" 
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      )}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setItemsPerPage(99999);
                      setCurrentPage(1);
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer",
                      itemsPerPage >= 99999 
                        ? "bg-emerald-700 text-white shadow-xs" 
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    )}
                  >
                    Todos
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                  title="Primera Página"
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  <ChevronLeft size={14} />
                  <span>Anterior</span>
                </button>

                <div className="flex items-center gap-1 px-1">
                  <span className="text-xs font-black text-slate-800 bg-slate-100 px-3 py-1.5 rounded-xl">
                    {currentPage} / {totalPages}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  <span>Siguiente</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                  title="Última Página"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
        ) : inventoryViewMode === 'list' ? (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-400 uppercase tracking-widest text-[10px] font-black border-b border-slate-100">
                    <th className="px-6 py-4">Producto</th>
                    <th className="px-4 py-4 text-center">Categoría</th>
                    {isOwner && <th className="px-4 py-4 text-right text-purple-900 font-black">P. Compra (Costo)</th>}
                    <th className="px-4 py-4 text-right">P. Venta</th>
                    <th className="px-6 py-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedProducts.map((product) => {
                    const isExempt = doesNotNeedStock(product);
                    const isTecun = isTecunProduct(product);
                    let listDisplayStock = product.stock;
                    if (product.variants && product.variants.length > 0) {
                      listDisplayStock = product.variants.reduce((sum, v) => sum + (v.stock !== undefined ? v.stock : product.stock), 0);
                    }
                    const isOutOfStock = listDisplayStock === 0 && !product.is_external && !isExempt && !isTecun;
                    const isCriticalStockVal = listDisplayStock > 0 && isCriticalStock({ name: product.name, category: product.category, stock: listDisplayStock }) && !product.is_external && !isExempt && !isTecun;

                    return (
                      <tr 
                        key={product.id}
                        onClick={() => handleViewDetails(product)}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center p-1 shrink-0 overflow-hidden relative">
                              <ProductImage 
                                src={product.image} category={product.category}
                                alt={product.name} 
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-800 group-hover:text-[#0b4d2c] transition-colors">{product.name}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                {product.is_external ? (
                                  <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">EXTERNO</span>
                                ) : isTecun ? (
                                  <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">TECÚN</span>
                                ) : isExempt ? (
                                  <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">EXENTO</span>
                                ) : (
                                  <span className={cn(
                                    "text-[10px] font-black px-1.5 py-0.2 rounded",
                                    isOutOfStock ? "bg-rose-100 text-rose-800" : isCriticalStockVal ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"
                                  )}>
                                    STOCK: {listDisplayStock}
                                  </span>
                                )}
                                {product.variants && product.variants.length > 0 && (
                                  <span className="text-[10px] text-slate-400 font-bold">{product.variants.length} var.</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{product.category}</span>
                        </td>
                        {isOwner && (
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs font-mono font-bold text-purple-900">
                              {Number(product.costPrice ?? (product as any).cost_price) > 0 
                                ? `Q${Number(product.costPrice ?? (product as any).cost_price).toFixed(2)}` 
                                : <span className="text-slate-400 italic">No asignado</span>}
                            </span>
                          </td>
                        )}
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-sm font-black text-[#0b4d2c] font-mono">Q{product.price.toFixed(2)}</span>
                          </div>
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
            {/* Pagination Controls Bar */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Página {currentPage} de {totalPages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-bold disabled:opacity-50">Anterior</button>
                  <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-bold disabled:opacity-50">Siguiente</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 mb-16">
            
            {/* Valuation Mode Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2">
                <Filter size={15} className="text-[#0b4d2c]" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Enfoque de Análisis:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setValuationFilterMode('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                    valuationFilterMode === 'all'
                      ? "bg-slate-800 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  <Layers size={13} />
                  <span>📊 Ver Todo</span>
                </button>

                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setValuationFilterMode('investment')}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                      valuationFilterMode === 'investment'
                        ? "bg-purple-800 text-white shadow-sm ring-2 ring-purple-300"
                        : "bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100"
                    )}
                  >
                    <Shield size={13} className={valuationFilterMode === 'investment' ? "text-purple-200" : "text-purple-700"} />
                    <span>💼 Total Inversión (Costo)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setValuationFilterMode('sales')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                    valuationFilterMode === 'sales'
                      ? "bg-[#0b4d2c] text-white shadow-sm ring-2 ring-emerald-300"
                      : "bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100"
                  )}
                >
                  <Tag size={13} className={valuationFilterMode === 'sales' ? "text-emerald-200" : "text-emerald-700"} />
                  <span>💰 Valor Total en Ventas</span>
                </button>

                <button
                  type="button"
                  onClick={() => setValuationFilterMode('stock')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                    valuationFilterMode === 'stock'
                      ? "bg-blue-700 text-white shadow-sm ring-2 ring-blue-300"
                      : "bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100"
                  )}
                >
                  <Package size={13} className={valuationFilterMode === 'stock' ? "text-blue-200" : "text-blue-700"} />
                  <span>📦 Total Stock / Existencias</span>
                </button>
              </div>
            </div>

            {/* KPI Cards Strip */}
          {(() => {
            let totalStock = 0;
            let totalValuation = 0;
            let totalCostValuation = 0;
            products.forEach(p => {
              if (p.is_external) return;
              const category = p.category || '';
              const isIncubadora = category.toUpperCase() === 'INCUBADORAS';
              const pCost = Number(p.costPrice ?? (p as any).cost_price) || 0;
              
              if (p.variants && p.variants.length > 0) {
                p.variants.forEach(v => {
                  const vStock = v.stock !== undefined ? v.stock : (p.stock || 0);
                  const vPrice = v.price || p.price || 0;
                  totalStock += vStock;
                  if (!isIncubadora && vStock > 0) {
                    totalValuation += vStock * Number(vPrice);
                    totalCostValuation += vStock * Number(pCost);
                  }
                });
              } else {
                const pStock = p.stock || 0;
                const pPrice = p.price || 0;
                totalStock += pStock;
                if (!isIncubadora && pStock > 0) {
                  totalValuation += pStock * Number(pPrice);
                  totalCostValuation += pStock * Number(pCost);
                }
              }
            });

            return (
              <div className={cn("grid grid-cols-1 gap-4", isOwner ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
                <div className="bg-[#0b4d2c]/5 p-5 rounded-2xl border border-emerald-950/5 flex flex-col justify-between">
                  <span className="text-[10px] text-[#0b4d2c] font-extrabold uppercase tracking-wider block mb-1">Insumos Filtrados</span>
                  <p className="text-xl sm:text-2xl font-black text-slate-800 leading-none">
                    {filteredProducts.length} <span className="text-xs font-semibold text-slate-500">productos</span>
                  </p>
                </div>

                <div className={cn(
                  "p-5 rounded-2xl border flex flex-col justify-between transition-all",
                  valuationFilterMode === 'stock'
                    ? "bg-blue-100/80 border-blue-300 ring-2 ring-blue-400 shadow-md"
                    : "bg-emerald-50/40 border-emerald-100"
                )}>
                  <span className="text-[10px] text-emerald-805 font-extrabold uppercase tracking-wider block mb-1">Inventario Físico Central</span>
                  <p className="text-xl sm:text-2xl font-black text-slate-800 leading-none font-mono">
                    {totalStock.toLocaleString('es-GT')} <span className="text-xs font-semibold text-slate-500 font-sans">uds</span>
                  </p>
                </div>

                <div className={cn(
                  "p-5 rounded-2xl border flex flex-col justify-between transition-all",
                  valuationFilterMode === 'sales'
                    ? "bg-emerald-100 border-emerald-300 ring-2 ring-emerald-400 shadow-md"
                    : "bg-emerald-500/10 border-emerald-500/15"
                )}>
                  <span className="text-[10px] text-emerald-900 font-extrabold uppercase tracking-wider block mb-1">Valor Total en Ventas</span>
                  <p className="text-xl sm:text-2xl font-black text-[#0b4d2c] leading-none font-mono">
                    Q{totalValuation.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>

                {isOwner && (
                  <div className={cn(
                    "p-5 rounded-2xl border flex flex-col justify-between transition-all",
                    valuationFilterMode === 'investment'
                      ? "bg-purple-100 border-purple-300 ring-2 ring-purple-500 shadow-md"
                      : "bg-purple-50 border-purple-200"
                  )}>
                    <span className="text-[10px] text-purple-900 font-extrabold uppercase tracking-wider block mb-1 flex items-center gap-1">
                      <Shield size={12} className="text-purple-700" />
                      <span>Inversión Real (Costo Total)</span>
                    </span>
                    <p className="text-xl sm:text-2xl font-black text-purple-950 leading-none font-mono">
                      Q{totalCostValuation.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

            {/* Interactive Grid Valuation Table - Desktop Only */}
            {(() => {
              const displayProducts = [...filteredProducts].sort((a, b) => {
                if (valuationFilterMode === 'investment') {
                  const aCost = Number(a.costPrice ?? (a as any).cost_price) || 0;
                  const bCost = Number(b.costPrice ?? (b as any).cost_price) || 0;
const aVal = (a.stock || 0) * aCost;
                  const bVal = (b.stock || 0) * bCost;
                  return bVal - aVal;
                } else if (valuationFilterMode === 'sales') {
                  const aVal = (a.stock || 0) * (a.price || 0);
                  const bVal = (b.stock || 0) * (b.price || 0);
                  return bVal - aVal;
                } else if (valuationFilterMode === 'stock') {
                  return (b.stock || 0) - (a.stock || 0);
                }
                return 0;
              });

              return (
                <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden text-slate-705">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse table-auto">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-150 text-slate-400 uppercase tracking-widest text-[9.5px] font-black">
                          <th className="p-4 pl-6 w-28">SKU/ID</th>
                          <th className="p-4">Producto comercializado</th>
                          <th className="p-4 w-36 text-center">Categoría</th>
                          <th className={cn("p-4 w-32 text-right transition-colors", valuationFilterMode === 'stock' && "bg-blue-100/60 text-blue-900 font-extrabold")}>Existencia</th>
                          {isOwner && <th className={cn("p-4 w-40 text-right text-purple-800 transition-colors", valuationFilterMode === 'investment' && "bg-purple-100 text-purple-950 font-black")}>Precio Compra c/u</th>}
                          <th className={cn("p-4 w-44 text-right transition-colors", valuationFilterMode === 'sales' && "bg-emerald-100/60 text-emerald-900 font-extrabold")}>Precio Venta c/u</th>
                          {isOwner && <th className={cn("p-4 w-44 text-right text-purple-900 transition-colors", valuationFilterMode === 'investment' && "bg-purple-100 text-purple-950 font-black")}>Inversión (Costo)</th>}
                          <th className={cn("p-4 w-44 text-right pr-6 transition-colors", valuationFilterMode === 'sales' && "bg-emerald-100/60 text-emerald-950 font-black")}>Total Venta (Stock x Precio)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-705">
                        {displayProducts.map((p) => {
                          const isExempt = doesNotNeedStock(p) || isTecunProduct(p);
                          let individualTotal = 0;
                          let individualCostTotal = 0;
                          let individualStock = 0;
                          const costPriceVal = Number(p.costPrice ?? (p as any).cost_price) || 0;
                          const priceVal = Number(p.price) || 0;

                          if (!p.is_external) {
                            if (p.variants && p.variants.length > 0) {
                              p.variants.forEach(v => {
                                const vStock = v.stock !== undefined ? (Number(v.stock) || 0) : (Number(p.stock) || 0);
                                individualStock += vStock;
                                const valStock = Math.max(0, vStock);
                                const vPrice = Number(v.price || p.price || 0);
                                individualTotal += valStock * vPrice;
                                individualCostTotal += valStock * costPriceVal;
                              });
                            } else {
                              individualStock = Number(p.stock) || 0;
                              const valStock = Math.max(0, individualStock);
                              individualTotal = valStock * priceVal;
                              individualCostTotal = valStock * costPriceVal;
                            }
                          }
                          
                          const pIdShort = p.id ? String(p.id).split('-')[0].toUpperCase() : '';

                          return (
                            <tr 
                              key={p.id || Math.random()}
                              onClick={() => handleViewDetails(p)}
                              className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                            >
                              <td className="p-4 pl-6 font-mono text-[10px] text-slate-400 font-bold whitespace-nowrap">
                                {pIdShort}
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <ProductImage 
                                    src={p.image} category={p.category}
                                    alt={p.name}
                                    className="w-8 h-8 object-contain bg-slate-50 rounded-lg p-0.5 border border-slate-100 shrink-0"
                                  />
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-slate-800 group-hover:text-[#0b4d2c] transition-colors line-clamp-1 notranslate" translate="no">
                                      {p.name}
                                    </span>
                                    {p.hiddenFromSales && (
                                      <span className="text-[9px] font-black bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded border border-purple-200 whitespace-nowrap">
                                        Solo Inv
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 text-center">
                                <span className="inline-flex px-2.5 py-0.5 text-[9px] font-black tracking-wider uppercase rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                  {p.category}
                                </span>
                              </td>
                              <td className={cn("p-4 text-right font-bold text-slate-900 transition-colors", valuationFilterMode === 'stock' && "bg-blue-50/60 font-black text-blue-950")}>
                                {p.is_external ? (
                                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-black">Externo</span>
                                ) : (isTecunProduct(p) && individualStock <= 0) ? (
                                  <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/80 font-black">
                                    0 (Tecún)
                                  </span>
                                ) : (
                                  <span className={cn(
                                    individualStock < 0 ? "text-indigo-700 font-extrabold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/80 text-[10px]" :
                                    individualStock === 0 ? "text-red-500 font-black bg-red-50 px-1.5 py-0.5 rounded" : 
                                    (isCriticalStock({ name: p.name, category: p.category, stock: individualStock }) ? "text-amber-600 font-black bg-amber-50 px-1.5 py-0.5 rounded" : "text-slate-800")
                                  )}>
                                    {individualStock < 0 ? `${individualStock} (Pedido)` : individualStock}
                                  </span>
                                )}
                              </td>
                              {isOwner && (
                                <td className={cn("p-4 text-right font-mono font-bold text-purple-900 transition-colors", valuationFilterMode === 'investment' && "bg-purple-50/60 font-black")}>
                                  Q{costPriceVal.toFixed(2)}
                                </td>
                              )}
                              <td className={cn("p-4 text-right font-mono font-bold text-slate-500 transition-colors", valuationFilterMode === 'sales' && "bg-emerald-50/60 font-black text-emerald-950")}>
                                Q{priceVal.toFixed(2)}
                              </td>
                              {isOwner && (
                                <td className={cn("p-4 text-right font-mono font-black text-purple-950 transition-colors", valuationFilterMode === 'investment' && "bg-purple-100/70 text-purple-950 text-sm font-extrabold")}>
                                  {p.is_external ? "Q0.00" : `Q${individualCostTotal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                </td>
                              )}
                              <td className={cn("p-4 text-right pr-6 font-mono font-black text-slate-800 transition-colors", valuationFilterMode === 'sales' && "bg-emerald-100/70 text-emerald-950 text-sm font-extrabold")}>
                                {p.is_external ? "Q0.00" : `Q${individualTotal.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Optimized High Density Card List - Mobile Only */}
            <div className="md:hidden space-y-3">
              {filteredProducts.map((p) => {
                let individualTotal = 0;
                let individualCostTotal = 0;
                let individualStock = 0;
                const costPriceVal = Number(p.costPrice ?? (p as any).cost_price) || 0;
                const priceVal = Number(p.price) || 0;

                if (!p.is_external) {
                  if (p.variants && p.variants.length > 0) {
                    p.variants.forEach(v => {
                      const vStock = v.stock !== undefined ? (Number(v.stock) || 0) : (Number(p.stock) || 0);
                      individualStock += vStock;
                      const valStock = Math.max(0, vStock);
                      const vPrice = Number(v.price || p.price || 0);
                      individualTotal += valStock * vPrice;
                      individualCostTotal += valStock * costPriceVal;
                    });
                  } else {
                    individualStock = Number(p.stock) || 0;
                    individualTotal = individualStock * priceVal;
                    individualCostTotal = individualStock * costPriceVal;
                  }
                }
                const isOutOfStock = individualStock === 0 && !p.is_external && !doesNotNeedStock(p) && !isTecunProduct(p);
                const isCriticalStockVal = individualStock > 0 && isCriticalStock({ name: p.name, category: p.category, stock: individualStock }) && !p.is_external && !doesNotNeedStock(p) && !isTecunProduct(p);
                
                return (
                  <div 
                    key={p.id || Math.random()}
                    onClick={() => handleViewDetails(p)}
                    className="p-4.5 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col gap-3.5 hover:border-[#0b4d2c]/30 active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <ProductImage 
                        src={p.image} category={p.category}
                        alt={p.name}
                        className="w-10 h-10 object-contain bg-slate-50 rounded-xl p-1 border border-slate-100 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] uppercase font-black tracking-widest text-[#0b4d2c] block mb-0.5">{p.category}</span>
                        <h4 className="text-xs font-black text-slate-805 line-clamp-2 notranslate leading-snug" translate="no">
                          {p.name}
                        </h4>
                      </div>
                    </div>

                    <div className={cn("grid gap-2.5 pt-3 border-t border-slate-100 text-[10px] font-bold", isOwner ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3")}>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-400 uppercase text-[8px] tracking-wider font-extrabold">Existencia</span>
                        <span className={cn(
                          p.is_external ? "text-emerald-600" : (isTecunProduct(p) && individualStock <= 0) ? "text-purple-700 font-black" : (isOutOfStock ? "text-red-500" : (isCriticalStockVal ? "text-amber-600" : "text-slate-800")),
                          "text-xs font-black"
                        )}>
                          {p.is_external ? 'Lote Externo' : (isTecunProduct(p) && individualStock <= 0) ? '0 (Tecún)' : `${individualStock} uds`}
                        </span>
                      </div>
                      {isOwner && (
                        <div className="flex flex-col gap-0.5 text-right bg-purple-50/50 p-1.5 rounded-xl border border-purple-100">
                          <span className="text-purple-900 uppercase text-[7.5px] tracking-widest font-extrabold">Costo Compra</span>
                          <span className="text-purple-950 text-xs font-black font-mono">Q{costPriceVal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex flex-col gap-0.5 text-right">
                        <span className="text-slate-400 uppercase text-[8px] tracking-wider font-extrabold">Precio Venta</span>
                        <span className="text-slate-600 text-xs font-black font-mono font-medium">Q{priceVal.toFixed(2)}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 text-right bg-emerald-50/50 p-1.5 rounded-xl border border-emerald-100">
                        <span className="text-[#0b4d2c] uppercase text-[7.5px] tracking-widest font-extrabold">Total Venta</span>
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
                   editProductField.field === 'stock' ? 'Cantidad de Stock Física' : 
                   editProductField.field === 'price' ? 'Precio de Venta (Q)' : 
                   editProductField.field === 'costPrice' ? 'Precio de Compra / Costo (Q)' :
                   editProductField.field === 'category' ? 'Categoría' :
                   'URL de la Imagen'}
                </label>
                
                {editProductField.field === 'stock' || editProductField.field === 'price' || editProductField.field === 'costPrice' ? (
                  <div className="space-y-3">
                    <div className="relative">
                      {(editProductField.field === 'price' || editProductField.field === 'costPrice') && (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">Q</span>
                      )}
                      <input 
                        type="number"
                        step={editProductField.field === 'stock' ? "1" : "0.01"}
                        min="0"
                        autoFocus
                        required
                        value={editProductField.value}
                        onChange={(e) => setEditProductField({ ...editProductField, value: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFieldEdit(); }}
                        className={cn(
                          "w-full py-3.5 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#0b4d2c] bg-slate-50 shadow-sm outline-none transition-all font-black text-slate-800 text-lg",
                          (editProductField.field === 'price' || editProductField.field === 'costPrice') ? "pl-10 pr-4" : "px-4"
                        )}
                      />
                    </div>

                    {/* If editing Price, show cost and quick markup buttons */}
                    {editProductField.field === 'price' && isOwner && (() => {
                      const cost = Number(editProductField.product.costPrice ?? (editProductField.product as any).cost_price) || 0;
                      const valPrice = parseFloat(editProductField.value) || 0;
                      return (
                        <div className="space-y-2 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-bold">Costo de compra registrado:</span>
                            <span className="font-black text-purple-950 font-mono">Q{cost.toFixed(2)}</span>
                          </div>

                          {cost > 0 && (
                            <div className="space-y-1.5 pt-1.5 border-t border-slate-200">
                              <span className="text-[10px] font-bold text-slate-500 block">Sugerir margen sobre costo:</span>
                              <div className="flex flex-wrap gap-1">
                                {[15, 20, 25, 30, 40, 50, 100].map(pct => (
                                  <button
                                    key={pct}
                                    type="button"
                                    onClick={() => {
                                      setEditProductField({
                                        ...editProductField,
                                        value: (cost * (1 + pct / 100)).toFixed(2)
                                      });
                                    }}
                                    className="px-2 py-0.5 bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 rounded-lg text-[10px] font-black text-slate-700 transition-all cursor-pointer"
                                  >
                                    +{pct}%
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {cost > 0 && valPrice > 0 && (() => {
                            const diff = valPrice - cost;
                            const marginPct = ((diff / cost) * 100).toFixed(1);
                            if (diff > 0.001) {
                              return (
                                <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50 p-2 rounded-xl flex items-center justify-between">
                                  <span>Margen resultante:</span>
                                  <span className="font-black font-mono">+Q{diff.toFixed(2)} ({marginPct}%)</span>
                                </div>
                              );
                            } else if (Math.abs(diff) < 0.001) {
                              return (
                                <div className="text-[11px] font-black text-amber-900 bg-amber-100 p-2 rounded-xl flex items-center justify-between">
                                  <span>⚠️ Margen 0%</span>
                                  <span>Precio = Costo</span>
                                </div>
                              );
                            } else {
                              return (
                                <div className="text-[11px] font-black text-red-900 bg-red-100 p-2 rounded-xl flex items-center justify-between">
                                  <span>🚨 Pérdida:</span>
                                  <span>-Q{Math.abs(diff).toFixed(2)} por unidad</span>
                                </div>
                              );
                            }
                          })()}
                        </div>
                      );
                    })()}

                    {/* If editing Cost Price, show sale price and calculated margin */}
                    {editProductField.field === 'costPrice' && isOwner && (() => {
                      const curPrice = Number(editProductField.product.price) || 0;
                      const valCost = parseFloat(editProductField.value) || 0;
                      return (
                        <div className="space-y-2 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-bold">Precio de venta actual:</span>
                            <span className="font-black text-[#0b4d2c] font-mono">Q{curPrice.toFixed(2)}</span>
                          </div>

                          {curPrice > 0 && valCost > 0 && (() => {
                            const diff = curPrice - valCost;
                            const marginPct = ((diff / valCost) * 100).toFixed(1);
                            if (diff > 0.001) {
                              return (
                                <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50 p-2 rounded-xl flex items-center justify-between">
                                  <span>Margen con este costo:</span>
                                  <span className="font-black font-mono">+Q{diff.toFixed(2)} ({marginPct}%)</span>
                                </div>
                              );
                            } else if (Math.abs(diff) < 0.001) {
                              return (
                                <div className="text-[11px] font-black text-amber-900 bg-amber-100 p-2 rounded-xl flex items-center justify-between">
                                  <span>⚠️ Margen 0%</span>
                                  <span>Costo = Precio Venta</span>
                                </div>
                              );
                            } else {
                              return (
                                <div className="text-[11px] font-black text-red-900 bg-red-100 p-2 rounded-xl flex items-center justify-between">
                                  <span>🚨 Costo superior al precio de venta</span>
                                  <span>-Q{Math.abs(diff).toFixed(2)}</span>
                                </div>
                              );
                            }
                          })()}
                        </div>
                      );
                    })()}
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
            className={cn(
              "bg-white rounded-3xl shadow-2xl border border-slate-100 w-full overflow-hidden flex flex-col max-h-[90vh]",
              isAdmin ? "max-w-2xl" : "max-w-lg"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {isAdmin ? (
              /* ADMIN MANAGEMENT VIEW */
              <>
                {/* Modal Header with Tabs */}
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
                        <AlertCircle size={20} className="animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-850 text-base">Gestión de Stock Crítico</h3>
                        <p className="text-xs text-slate-400 font-medium">Excluye productos de esta sección sin afectarlos en el inventario</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsCriticalModalOpen(false)}
                      className="p-2 rounded-full text-slate-400 hover:bg-slate-200/60 transition-colors cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Navigation Tabs */}
                  <div className="flex bg-slate-200/60 p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setCriticalModalTab('active');
                        setSelectedCriticalForBatch([]);
                      }}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer",
                        criticalModalTab === 'active'
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <AlertCircle size={14} className={criticalModalTab === 'active' ? "text-amber-600" : ""} />
                      <span>En Críticos</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-black",
                        criticalModalTab === 'active' ? "bg-amber-100 text-amber-800" : "bg-slate-300/60 text-slate-600"
                      )}>
                        {activeCriticalProducts.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCriticalModalTab('excluded');
                        setSelectedCriticalForBatch([]);
                      }}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer",
                        criticalModalTab === 'excluded'
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <EyeOff size={14} className={criticalModalTab === 'excluded' ? "text-slate-700" : ""} />
                      <span>Excluidos / Ocultos</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-black",
                        criticalModalTab === 'excluded' ? "bg-slate-800 text-white" : "bg-slate-300/60 text-slate-600"
                      )}>
                        {excludedCriticalProducts.length}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Explanatory Banner & Batch Action Bar */}
                <div className="px-6 pt-4 pb-2 bg-amber-50/40 border-b border-amber-100/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-[11px] text-amber-900/80 font-medium leading-tight">
                    {criticalModalTab === 'active' 
                      ? "Selecciona los productos que deseas eliminar de esta sección. Seguirán disponibles en tu inventario."
                      : "Productos que has quitado de la sección de críticos. Puedes volver a incluir alguno cuando desees."}
                  </p>

                  {/* Batch Action Buttons */}
                  {criticalModalTab === 'active' && activeCriticalProducts.length > 0 && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedCriticalForBatch.length === activeCriticalProducts.length) {
                            setSelectedCriticalForBatch([]);
                          } else {
                            setSelectedCriticalForBatch(activeCriticalProducts.map(p => p.id));
                          }
                        }}
                        className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 cursor-pointer shadow-2xs"
                      >
                        {selectedCriticalForBatch.length === activeCriticalProducts.length ? <CheckSquare size={13} className="text-[#0b4d2c]" /> : <Square size={13} />}
                        <span>{selectedCriticalForBatch.length === activeCriticalProducts.length ? 'Desmarcar' : 'Todos'}</span>
                      </button>

                      {selectedCriticalForBatch.length > 0 && (
                        <button
                          type="button"
                          onClick={excludeBatchFromCritical}
                          className="text-[11px] font-black bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <EyeOff size={13} />
                          <span>Quitar {selectedCriticalForBatch.length} seleccionados</span>
                        </button>
                      )}
                    </div>
                  )}

                  {criticalModalTab === 'excluded' && excludedCriticalProducts.length > 0 && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedCriticalForBatch.length === excludedCriticalProducts.length) {
                            setSelectedCriticalForBatch([]);
                          } else {
                            setSelectedCriticalForBatch(excludedCriticalProducts.map(p => p.id));
                          }
                        }}
                        className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 cursor-pointer shadow-2xs"
                      >
                        {selectedCriticalForBatch.length === excludedCriticalProducts.length ? <CheckSquare size={13} className="text-[#0b4d2c]" /> : <Square size={13} />}
                        <span>{selectedCriticalForBatch.length === excludedCriticalProducts.length ? 'Desmarcar' : 'Todos'}</span>
                      </button>

                      {selectedCriticalForBatch.length > 0 && (
                        <button
                          type="button"
                          onClick={restoreBatchToCritical}
                          className="text-[11px] font-black bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <RotateCcw size={13} />
                          <span>Restablecer {selectedCriticalForBatch.length}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Modal Body / Product List */}
                <div className="p-6 overflow-y-auto space-y-3 custom-scrollbar flex-1 min-h-[300px]">
                  {criticalModalTab === 'active' ? (
                    activeCriticalProducts.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                          <CheckCircle size={32} />
                        </div>
                        <p className="text-sm font-black text-slate-700">¡Excelente!</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs">No hay productos en stock crítico o todos han sido excluidos.</p>
                      </div>
                    ) : (
                      activeCriticalProducts.map((p) => {
                        const CategoryIcon = getCategoryIcon(p.category || 'Otros');
                        const isOutOfStock = p.stock <= 0;
                        const isSelected = selectedCriticalForBatch.includes(p.id);

                        return (
                          <div 
                            key={p.id} 
                            className={cn(
                              "flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 gap-3 group",
                              isSelected
                                ? "bg-amber-50/80 border-amber-300 shadow-xs"
                                : "bg-slate-50 hover:bg-white border-slate-200/80 hover:border-slate-300"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Selection Checkbox */}
                              <button
                                type="button"
                                onClick={(e) => toggleSelectCriticalBatch(p.id, e)}
                                className="text-slate-400 hover:text-amber-600 transition-colors cursor-pointer shrink-0"
                              >
                                {isSelected ? (
                                  <CheckSquare size={18} className="text-amber-600" />
                                ) : (
                                  <Square size={18} />
                                )}
                              </button>

                              {/* Product Image */}
                              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden text-slate-400">
                                {p.image ? (
                                  <ProductImage
                                    src={p.image}
                                    category={p.category}
                                    alt={p.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <CategoryIcon size={16} className="text-[#0b4d2c]" />
                                )}
                              </div>

                              {/* Info */}
                              <div className="min-w-0 flex-1">
                                <h4 
                                  onClick={() => {
                                    setSelectedProduct(p);
                                    setShowDetailModal(true);
                                    setIsCriticalModalOpen(false);
                                  }}
                                  className="font-bold text-slate-800 text-sm hover:text-[#0b4d2c] transition-colors leading-tight truncate cursor-pointer"
                                >
                                  {p.name}
                                </h4>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-medium">
                                  <span className="font-bold uppercase tracking-wider">{p.category || 'Otros'}</span>
                                  <span>•</span>
                                  <span className="font-mono">SKU: {p.id.split('-')[0]}</span>
                                </div>
                              </div>
                            </div>

                            {/* Stock & Single Action */}
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={cn(
                                "inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider",
                                isOutOfStock 
                                  ? "bg-red-100 text-red-800 border border-red-200 animate-pulse" 
                                  : "bg-amber-100 text-amber-800 border border-amber-200"
                              )}>
                                {isOutOfStock ? '0 Uds' : `${p.stock} Uds`}
                              </span>

                              <button
                                type="button"
                                onClick={(e) => toggleExcludeCritical(p.id, e)}
                                title="Quitar de esta sección (permanece en inventario)"
                                className="px-2.5 py-1.5 bg-slate-200/80 hover:bg-amber-100 text-slate-600 hover:text-amber-800 rounded-xl font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <EyeOff size={13} />
                                <span className="hidden sm:inline">Quitar</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )
                  ) : (
                    /* EXCLUDED TAB LIST */
                    excludedCriticalProducts.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 flex flex-col items-center">
                        <Eye size={36} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-bold text-slate-600">No hay productos excluidos</p>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs">Los productos que quites de la lista de críticos aparecerán aquí para que puedas gestionarlos.</p>
                      </div>
                    ) : (
                      excludedCriticalProducts.map((p) => {
                        const CategoryIcon = getCategoryIcon(p.category || 'Otros');
                        const isSelected = selectedCriticalForBatch.includes(p.id);

                        return (
                          <div 
                            key={p.id} 
                            className={cn(
                              "flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 gap-3",
                              isSelected
                                ? "bg-emerald-50 border-emerald-300"
                                : "bg-slate-50 border-slate-200/80 hover:bg-white"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Selection Checkbox */}
                              <button
                                type="button"
                                onClick={(e) => toggleSelectCriticalBatch(p.id, e)}
                                className="text-slate-400 hover:text-[#0b4d2c] transition-colors cursor-pointer shrink-0"
                              >
                                {isSelected ? (
                                  <CheckSquare size={18} className="text-[#0b4d2c]" />
                                ) : (
                                  <Square size={18} />
                                )}
                              </button>

                              {/* Image */}
                              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden text-slate-400 opacity-75">
                                {p.image ? (
                                  <ProductImage
                                    src={p.image}
                                    category={p.category}
                                    alt={p.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <CategoryIcon size={16} className="text-[#0b4d2c]" />
                                )}
                              </div>

                              {/* Info */}
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-slate-800 text-sm leading-tight truncate">
                                  {p.name}
                                </h4>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-medium">
                                  <span className="font-bold uppercase tracking-wider">{p.category || 'Otros'}</span>
                                  <span>•</span>
                                  <span className="font-mono">Stock actual: {p.stock} Uds</span>
                                </div>
                              </div>
                            </div>

                            {/* Restore Button */}
                            <button
                              type="button"
                              onClick={(e) => toggleExcludeCritical(p.id, e)}
                              title="Volver a incluir en la lista de stock crítico"
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
                            >
                              <RotateCcw size={13} />
                              <span>Reincluir</span>
                            </button>
                          </div>
                        );
                      })
                    )
                  )}
                </div>
                
                {/* Modal Footer */}
                <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {activeCriticalProducts.length} artículo(s) crítico(s) activos
                  </span>
                  <button 
                    type="button"
                    onClick={() => setIsCriticalModalOpen(false)}
                    className="px-6 py-2.5 bg-[#0b4d2c] hover:bg-[#07361e] text-white font-black rounded-2xl transition-all text-xs uppercase tracking-wider cursor-pointer shadow-md"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            ) : (
              /* REGULAR NON-ADMIN READ-ONLY VIEW */
              <>
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-black text-slate-850 text-base flex items-center gap-2">
                    <AlertCircle size={18} className="text-amber-600 animate-pulse" />
                    <span>Productos en Stock Crítico</span>
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-black">
                      {activeCriticalProducts.length}
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
                    Los siguientes productos tienen un nivel de stock bajo o crítico. Considere reabastecerlos pronto para evitar detener las ventas.
                  </p>
                  
                  {activeCriticalProducts.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <Package size={36} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-sm font-bold">¡Excelente! No hay productos con stock crítico.</p>
                    </div>
                  ) : (
                    activeCriticalProducts.map((p) => {
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
                                <ProductImage
                                  src={p.image}
                                  category={p.category}
                                  alt={p.name}
                                  className="w-full h-full object-cover rounded-xl"
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
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* MODAL DE PRODUCTOS SIN ROTACIÓN / DETENIDOS (ESTILO EXACTO STOCK CRÍTICO) */}
      {isSlowMovingModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-3 sm:p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-amber-200/80"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-amber-100 flex justify-between items-center bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                  <Flame size={22} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-slate-850 text-base sm:text-lg leading-tight">
                      Productos Sin Rotación
                    </h3>
                    <span className="text-xs bg-amber-500 text-white px-2.5 py-0.5 rounded-full font-black shadow-2xs">
                      {slowMovingProducts.length} detenidos
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900/80 font-medium mt-0.5">
                    Artículos con stock disponible en bodega sin registrar ventas recientes
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsSlowMovingModalOpen(false)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Subheader: Threshold Filters, Search & Summary KPIs */}
            <div className="p-4 sm:px-6 sm:py-3.5 bg-slate-50/80 border-b border-slate-150 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Threshold Switcher */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">Ventana:</span>
                {[15, 30, 45].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setSlowMovingDaysThreshold(days)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      slowMovingDaysThreshold === days
                        ? "bg-amber-500 text-white shadow-2xs font-black"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-amber-50"
                    )}
                  >
                    &ge; {days} días
                  </button>
                ))}
              </div>

              {/* Search & Excel Export */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-56">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar producto detenido..."
                    value={slowMovingSearchTerm}
                    onChange={(e) => setSlowMovingSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-amber-500 transition-colors shadow-2xs"
                  />
                  {slowMovingSearchTerm && (
                    <button onClick={() => setSlowMovingSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X size={12} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const XLSX = await import('xlsx');
                      const rows = filteredSlowMovingProducts.map(item => {
                        const fullProd = products.find(p => p.id === item.id);
                        return {
                          'SKU': item.id ? String(item.id).split('-')[0] : '',
                          'Producto': item.name,
                          'Categoría': item.category || 'Otros',
                          'Stock en Bodega': item.stock,
                          'Precio Venta (Q)': Number(item.price || 0),
                          'Costo Unitario (Q)': Number((fullProd?.costPrice !== undefined ? fullProd.costPrice : (fullProd as any)?.cost_price) || 0),
                          'Días Sin Ventas': item.neverSold || item.daysWithoutSale === null ? 'Sin ventas registradas' : item.daysWithoutSale,
                          'Última Venta': item.lastSaleDate || 'Nunca vendido',
                          'Recomendación Comercial': item.suggestedAction || item.recommendationReason
                        };
                      });

                      const ws = XLSX.utils.json_to_sheet(rows);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "Productos_Sin_Rotacion");
                      XLSX.writeFile(wb, `productos_sin_rotacion_${new Date().toISOString().split('T')[0]}.xlsx`);
                    } catch (e) {
                      alert("Error al exportar a Excel");
                    }
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                  title="Descargar lista de productos sin rotación en Excel"
                >
                  <FileSpreadsheet size={13} className="text-emerald-600" />
                  <span className="hidden sm:inline">Excel</span>
                </button>
              </div>
            </div>

            {/* Modal Body / Products List */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3 custom-scrollbar flex-1 min-h-[300px]">
              {filteredSlowMovingProducts.length === 0 ? (
                <div className="text-center py-16 text-slate-400 flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                    <CheckCircle size={28} />
                  </div>
                  <p className="text-sm font-black text-slate-700">¡Excelente rotación!</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    {slowMovingSearchTerm 
                      ? 'No hay productos detenidos que coincidan con la búsqueda.' 
                      : `No se encontraron productos con stock detenido mayor a ${slowMovingDaysThreshold} días.`}
                  </p>
                </div>
              ) : (
                filteredSlowMovingProducts.map((item) => {
                  const p = products.find(prod => prod.id === item.id) || ({
                    id: item.id,
                    name: item.name,
                    category: item.category || 'Otros',
                    price: item.price,
                    stock: item.stock,
                    image: item.image
                  } as Product);
                  const CategoryIcon = getCategoryIcon(item.category || 'Otros');

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-amber-300 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 group"
                    >
                      {/* Left: Product Image and Details */}
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden text-slate-400 group-hover:border-amber-200 transition-colors">
                          {item.image ? (
                            <ProductImage
                              src={item.image}
                              category={item.category}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <CategoryIcon size={20} className="text-[#0b4d2c]" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 
                              onClick={() => {
                                setSelectedProduct(p);
                                setShowDetailModal(true);
                                setIsSlowMovingModalOpen(false);
                              }}
                              className="font-bold text-slate-900 text-sm hover:text-[#0b4d2c] transition-colors leading-snug cursor-pointer notranslate"
                              translate="no"
                            >
                              {item.name}
                            </h4>
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              {item.category || 'General'}
                            </span>
                          </div>

                          {/* Commercial recommendation callout */}
                          <div className="mt-1.5 flex items-start gap-1.5 p-2 rounded-xl bg-amber-50/80 border border-amber-200/60 text-[11px] text-amber-950">
                            <Lightbulb size={13} className="text-amber-600 shrink-0 mt-0.5" />
                            <span className="font-medium leading-tight">
                              <strong>Estrategia:</strong> {item.suggestedAction || item.recommendationReason}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400 font-medium flex-wrap">
                            <span>SKU: <strong className="font-mono text-slate-600">{item.id ? String(item.id).split('-')[0] : ''}</strong></span>
                            <span>•</span>
                            <span>Última venta: <strong className="text-slate-600">{item.lastSaleDate || 'Sin registro previo'}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Stock, Badges & Quick Action Buttons */}
                      <div className="flex items-center sm:flex-col items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="flex items-center sm:flex-col items-end gap-1.5">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black bg-amber-100 text-amber-900 border border-amber-200 shadow-2xs whitespace-nowrap">
                            📦 {item.stock} Uds en bodega
                          </span>

                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
                            ⏱️ {item.neverSold || item.daysWithoutSale === null ? 'Sin ventas registradas' : `${item.daysWithoutSale} días sin venta`}
                          </span>

                          <span className="text-xs font-black text-[#0b4d2c] font-mono">
                            Q{Number(item.price || 0).toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProduct(p);
                              setShowDetailModal(true);
                              setIsSlowMovingModalOpen(false);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-[#0b4d2c] text-slate-700 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                            title="Ver ficha completa de este producto"
                          >
                            Ver Ficha
                          </button>

                          {user.role === 'admin' && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsSlowMovingModalOpen(false);
                                handleUpdatePrice(p);
                              }}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                              title="Ajustar precio de oferta / liquidación"
                            >
                              Precio
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Mostrando <strong>{filteredSlowMovingProducts.length}</strong> de <strong>{slowMovingProducts.length}</strong> productos detenidos
              </span>
              <button 
                type="button"
                onClick={() => setIsSlowMovingModalOpen(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black rounded-2xl transition-all text-xs uppercase tracking-wider cursor-pointer shadow-md"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
