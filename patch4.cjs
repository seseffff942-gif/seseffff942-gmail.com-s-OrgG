const fs = require('fs');

['src/pages/DailySalesPage.tsx', 'src/pages/MySalesPage.tsx', 'src/pages/BillingPage.tsx'].forEach(file => {
  if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf-8');
    code = code.replace(
      "if (u && u.name) return u.name;",
      "if (u && u.name) return u.sellerCode ? `${u.name} (Cód: ${u.sellerCode})` : u.name;"
    );
    fs.writeFileSync(file, code);
  }
});
