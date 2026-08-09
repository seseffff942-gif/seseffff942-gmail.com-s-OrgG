const fs = require('fs');
let code = fs.readFileSync('src/pages/SalesPage.tsx', 'utf-8');

code = code.replace(
  "isOwed,\n            notes\n         });",
  "isOwed,\n            notes,\n            sellerId: sellerIdToUse\n         });"
);

fs.writeFileSync('src/pages/SalesPage.tsx', code);
