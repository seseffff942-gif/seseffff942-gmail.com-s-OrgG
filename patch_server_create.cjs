const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace(
  "const saleOwner = req.user.email; // The person clicking execute sale gets the invoice",
  "const saleOwner = sellerId || req.user.email; // Support overriding sellerId if selected in modal"
);

fs.writeFileSync('server.ts', code);
