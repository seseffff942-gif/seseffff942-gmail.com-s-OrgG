const fs = require('fs');
let code = fs.readFileSync('src/pages/SalesPage.tsx', 'utf-8');

code = code.replace(
  "if (sellerObj && sellerObj.name) return sellerObj.name;",
  "if (sellerObj && sellerObj.name) return sellerObj.sellerCode ? `${sellerObj.name} (Cód: ${sellerObj.sellerCode})` : sellerObj.name;"
);

fs.writeFileSync('src/pages/SalesPage.tsx', code);
