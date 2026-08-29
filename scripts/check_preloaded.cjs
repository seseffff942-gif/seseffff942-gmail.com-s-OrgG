const path = require('path');
const preloaded = require(path.join(__dirname, '../src/data/preloadedData.json'));
console.log('Preloaded invoices count:', preloaded.invoices?.length);
if (preloaded.invoices) {
  const folios = preloaded.invoices.map(i => {
    let f = i.folio;
    if (!f && i.notes) {
      const m = i.notes.match(/\|\|\|FOLIO:(\d+)/);
      if (m) f = parseInt(m[1]);
    }
    return Number(f);
  }).filter(Boolean);
  console.log('Preloaded min folio:', Math.min(...folios), 'max folio:', Math.max(...folios));
}
