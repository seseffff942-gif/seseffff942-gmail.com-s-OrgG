const fs = require('fs');
let code = fs.readFileSync('src/pages/SalesPage.tsx', 'utf-8');

// 1. Add editInvoiceSellerId state
code = code.replace(
  "const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(() => localStorage.getItem('draft_edit_invoice_id') || null);",
  "const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(() => localStorage.getItem('draft_edit_invoice_id') || null);\n  const [editInvoiceSellerId, setEditInvoiceSellerId] = useState<string | null>(() => localStorage.getItem('draft_edit_invoice_sellerId') || null);"
);

// 2. Persist editInvoiceSellerId
code = code.replace(
  "      localStorage.setItem('draft_edit_invoice_id', editingInvoiceId);\n    } else {\n      localStorage.removeItem('draft_edit_invoice_id');\n    }",
  "      localStorage.setItem('draft_edit_invoice_id', editingInvoiceId);\n    } else {\n      localStorage.removeItem('draft_edit_invoice_id');\n    }\n    if (editInvoiceSellerId) {\n      localStorage.setItem('draft_edit_invoice_sellerId', editInvoiceSellerId);\n    } else {\n      localStorage.removeItem('draft_edit_invoice_sellerId');\n    }"
);

// Add dependencies to useEffect
code = code.replace(
  "customDate, invoiceType, editingInvoiceId]);",
  "customDate, invoiceType, editingInvoiceId, editInvoiceSellerId]);"
);

// 3. Load editInvoiceSellerId from localStorage edit_invoice
code = code.replace(
  "setEditingInvoiceId(inv.id);",
  "setEditingInvoiceId(inv.id);\n        setEditInvoiceSellerId(inv.sellerId || '');"
);

// 4. Change handleCheckout to always use the modal
let handleCheckoutStart = code.indexOf("const handleCheckout = async (isOwed: boolean) => {");
let handleCheckoutEnd = code.indexOf("const filteredProducts = products.filter(p => {", handleCheckoutStart);
let handleCheckoutCode = code.substring(handleCheckoutStart, handleCheckoutEnd);

let newHandleCheckout = `const handleCheckout = async (isOwed: boolean) => {
    isOwed = true; // Forzar crédito siempre
    if (isSubmitting) return;

    if (!client.trim()) {
      setErrorMsg('Por favor ingresa el nombre del cliente');
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }
    if (cart.length === 0) {
      setErrorMsg('El carrito está vacío');
      setTimeout(() => setErrorMsg(''), 5000);
      return;
    }
    
    for (const item of cart) {
      if (item.quantity <= 0) {
        setErrorMsg('La cantidad de productos en el carrito debe ser mayor a cero.');
        setTimeout(() => setErrorMsg(''), 5000);
        return;
      }
      
      let variantStock = undefined;
      if (item.variant?.id && item.product.variants) {
        variantStock = item.product.variants.find(v => v.id === item.variant?.id)?.stock;
      }
      const maxStock = variantStock !== undefined ? variantStock : item.product.stock;

      if (item.quantity > maxStock && !doesNotNeedStock(item.product)) {
        if (isTecunProduct(item.product)) {
          item.requiresAuth = true;
        } else {
          setErrorMsg(\`Stock insuficiente para "\${item.product.name}"\${item.variant ? \` (\${item.variant.color} - \${item.variant.size})\` : ''} (Disponible: \${maxStock}).\`);
          setTimeout(() => setErrorMsg(''), 5000);
          return;
        }
      }
      const itemPrice = item.overridePrice !== undefined ? item.overridePrice : item.product.price;
      if (itemPrice < 0) {
        setErrorMsg('El precio de venta de los productos no puede ser negativo.');
        setTimeout(() => setErrorMsg(''), 5000);
        return;
      }
    }

    const clientNameLower = client.toLowerCase().trim();
    const existingClient = clients.find(c => {
      const dbName = (c.name || '').toLowerCase().trim();
      const dbCompany = c.companyName ? c.companyName.toLowerCase().trim() : '';
      const combined = c.companyName ? \`\${c.name} - \${c.companyName}\`.toLowerCase().trim() : '';
      const nameWithCompany = c.companyName ? \`\${dbName} \${dbCompany}\` : dbName;
      
      return dbName === clientNameLower || 
             dbCompany === clientNameLower || 
             combined === clientNameLower ||
             nameWithCompany === clientNameLower ||
             (clientNameLower.includes(dbName) && dbName.length > 3 && (dbCompany ? clientNameLower.includes(dbCompany) : true));
    });

    if (existingClient?.isBlocked) {
      setErrorMsg(\`EL CLIENTE "\${existingClient.name}" ESTÁ BLOQUEADO. No se pueden realizar ventas a este cliente.\`);
      setTimeout(() => setErrorMsg(''), 8000);
      return;
    }

    setCheckoutIsOwed(isOwed);
    let defaultSeller = user.email || '';
    if (editingInvoiceId && editInvoiceSellerId) {
      defaultSeller = editInvoiceSellerId;
    } else if (existingClient?.sellerId) {
      defaultSeller = existingClient.sellerId;
    }
    setSelectedSellerForNewClient(defaultSeller);
    setShowNewClientSellerModal(true);
  };

  const finalizeCheckoutAfterSeller = async () => {
    setShowNewClientSellerModal(false);
    setIsSubmitting(true);
    
    if (editingInvoiceId) {
      try {
        await proceedWithCheckout(checkoutIsOwed, selectedSellerForNewClient);
      } catch (err: any) {
        setIsSubmitting(false);
        alert(\`Error al actualizar la venta: \${err.message}\`);
      }
      return;
    }

    try {
      if (debtType === 'none' || !isDebtAuthorized) {
         const type = await checkClientDebt(client, true);
         if (type !== 'none' && !isDebtAuthorized) {
           setShowDebtModal(true);
           setIsSubmitting(false);
           return;
         }
      }

      await proceedWithCheckout(checkoutIsOwed, selectedSellerForNewClient);
    } catch (err: any) {
      setIsSubmitting(false);
      alert(\`Error comprobando deuda: \${err.message}\`);
    }
  };

  `;

code = code.replace(handleCheckoutCode, newHandleCheckout);

// 5. Change the modal UI to say "Confirmar Vendedor" instead of "Cliente Nuevo Detectado"
code = code.replace(
  `<h3 className="font-black text-slate-800 text-lg">Cliente Nuevo Detectado</h3>`,
  `<h3 className="font-black text-slate-800 text-lg">Confirmar Vendedor de la Venta</h3>`
);

let newModalBody = `
            <div className="p-6 space-y-4">
              <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-semibold leading-relaxed">
                Por favor, verifica de quién es esta venta antes de registrar el folio para que la comisión se asigne correctamente.
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">
                  Vendedor Asignado
                </label>
                <select
                  value={selectedSellerForNewClient}
                  onChange={(e) => setSelectedSellerForNewClient(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500 outline-none font-bold text-slate-800 transition-all shadow-sm"
                >
                  <option value="" disabled>-- Selecciona un Vendedor --</option>
                  {usersList.map((u) => (
                    <option key={u.id || u.email} value={u.email || u.id}>
                      {u.name} ({u.sellerCode ? \`Cód: \${u.sellerCode}\` : (u.role === 'admin' ? 'Administrador' : 'Vendedor')})
                    </option>
                  ))}
                  {!usersList.some(u => (u.email === user.email || u.id === user.email)) && (
                    <option value={user.email || ''}>{user.name || user.email} (Yo)</option>
                  )}
                </select>
              </div>

              <div className="pt-2">
                <button
                  disabled={!selectedSellerForNewClient || isSubmitting}
                  onClick={finalizeCheckoutAfterSeller}
                  className="w-full py-3 bg-[#0b4d2c] hover:bg-[#07361e] text-white rounded-xl font-black transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? 'Procesando...' : 'Confirmar Vendedor y Proceder'}
                </button>
              </div>
            </div>`;

code = code.replace(
  /<div className="p-6 space-y-4">[\s\S]*?(?=<\/div>\s*<\/div>\s*<\/div>\s*\))/m,
  newModalBody + "\n          "
);

// 6. Reset editInvoiceSellerId in proceedWithCheckout
code = code.replace(
  "setEditingInvoiceId(null);",
  "setEditingInvoiceId(null);\n         setEditInvoiceSellerId(null);"
);

fs.writeFileSync('src/pages/SalesPage.tsx', code);
console.log("Patched SalesPage.tsx");
