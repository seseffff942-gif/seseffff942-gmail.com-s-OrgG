const fs = require('fs');
let code = fs.readFileSync('src/pages/SalesPage.tsx', 'utf-8');

const oldFunc = `  const getSellerDisplayName = (sellerVal: any) => {
    const raw = typeof sellerVal === 'string' ? sellerVal : (sellerVal?.sellerId || '');
    if (!raw) return 'Desconocido';
    const sLower = raw.toLowerCase();
    if (sLower.includes('jerickottoniel')) return 'Erick Juárez';
    const sellerObj = usersList.find((u: any) => 
      u.id === raw || 
      (u.email && u.email.toLowerCase() === sLower) || 
      (u.sellerCode && u.sellerCode.toLowerCase() === sLower)
    );
    if (sellerObj && sellerObj.name) return sellerObj.sellerCode ? \`\${sellerObj.name} (Cód: \${sellerObj.sellerCode})\` : sellerObj.name;
    return raw.includes('@') ? raw.split('@')[0] : raw;
  };`;

const newFunc = `  const getSellerDisplayName = (sellerVal: any) => {
    const raw = typeof sellerVal === 'string' ? sellerVal : (sellerVal?.sellerId || '');
    if (!raw) return 'Desconocido';
    const sLower = raw.toLowerCase();
    
    let sellerObj = usersList.find((u: any) => 
      u.id === raw || 
      (u.email && u.email.toLowerCase() === sLower) || 
      (u.sellerCode && u.sellerCode.toLowerCase() === sLower)
    );
    
    if (!sellerObj && sLower.includes('jerickottoniel')) {
       sellerObj = { name: 'Erick Juarez', sellerCode: 'E8363' } as any;
    }

    if (sellerObj && sellerObj.name) {
       const firstLetter = sellerObj.name.charAt(0).toUpperCase();
       if (sellerObj.sellerCode) {
          const codeUpper = sellerObj.sellerCode.toUpperCase();
          if (codeUpper.startsWith(firstLetter)) {
             return codeUpper;
          }
          return \`\${firstLetter}\${codeUpper}\`;
       }
       return sellerObj.name;
    }
    
    return raw.includes('@') ? raw.split('@')[0] : raw;
  };`;

code = code.replace(oldFunc, newFunc);
fs.writeFileSync('src/pages/SalesPage.tsx', code);
