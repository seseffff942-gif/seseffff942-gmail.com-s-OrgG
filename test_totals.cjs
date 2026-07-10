const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

db.all("SELECT * FROM products", [], (err, rows) => {
  if (err) {
    throw err;
  }
  let totalUI = 0;
  let totalExcel = 0;
  let excelItems = [];
  let uiItems = [];
  
  rows.forEach(p => {
    p.variants = p.variants ? JSON.parse(p.variants) : [];
    p.specifications = p.specifications ? JSON.parse(p.specifications) : [];
    p.is_external = p.is_external === 1;
    
    // UI Logic
    if (!p.is_external) {
      if (p.variants && p.variants.length > 0) {
        p.variants.forEach(v => {
          const vStock = v.stock !== undefined ? v.stock : p.stock;
          totalUI += vStock * v.price;
        });
      } else {
        totalUI += p.stock * p.price;
      }
    }

    // Excel Logic
    const category = p.category || '';
    const isIncubadora = category.toUpperCase() === 'INCUBADORAS';
    if (p.variants && p.variants.length > 0) {
        p.variants.forEach(v => {
            const vStock = v.stock || 0;
            const vPrice = v.price || p.price || 0;
            if (!isIncubadora && vStock > 0) {
                totalExcel += vStock * Number(vPrice);
            }
        });
    } else {
        const pStock = p.stock || 0;
        const pPrice = p.price || 0;
        if (!isIncubadora && pStock > 0) {
            totalExcel += pStock * Number(pPrice);
        }
    }
  });
  
  console.log("Total UI:", totalUI);
  console.log("Total Excel:", totalExcel);
  console.log("Diff:", totalUI - totalExcel);
});
