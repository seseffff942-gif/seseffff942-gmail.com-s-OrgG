const fs = require('fs');

const files = [
  'src/pages/BillingPage.tsx',
  'src/pages/DailySalesPage.tsx',
  'src/pages/MySalesPage.tsx'
];

const newFunc = `  function getSellerName(email: string) {
    if (!email) return 'Sin Vendedor';
    const eLower = email.toLowerCase();
    
    let u = users.find(user => 
      (user.email && user.email.toLowerCase() === eLower) || 
      user.id === email || 
      (user.sellerCode && user.sellerCode.toLowerCase() === eLower)
    );
    
    if (!u && eLower.includes('jerickottoniel')) {
       u = { name: 'Erick Juarez', sellerCode: 'E8363' } as any;
    }

    if (u && u.name) {
       const firstLetter = u.name.charAt(0).toUpperCase();
       if (u.sellerCode) {
          const codeUpper = u.sellerCode.toUpperCase();
          if (codeUpper.startsWith(firstLetter)) {
             return codeUpper;
          }
          return \`\${firstLetter}\${codeUpper}\`;
       }
       return u.name;
    }
    
    return email.includes('@') ? email.split('@')[0] : email;
  }`;

files.forEach(file => {
  if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf-8');
    
    // Replace the old getSellerName logic block
    // We can use a regex that matches from `function getSellerName(email: string) {` to the closing `}`
    
    const regex = /function getSellerName\(email: string\) \{[\s\S]*?^\s*\}/m;
    code = code.replace(regex, newFunc);
    
    fs.writeFileSync(file, code);
    console.log(`Patched ${file}`);
  }
});

