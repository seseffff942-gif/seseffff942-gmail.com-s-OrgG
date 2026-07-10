const fs = require('fs');
let content = fs.readFileSync('src/pages/BillingPage.tsx', 'utf8');
let ix = content.indexOf("const sellerName = seller ? seller.name : 'Vendedor';");
if(ix !== -1) {
    let start = content.lastIndexOf("loadInvoices();", ix);
    let end = content.indexOf("}}", ix) + 2;
    if (start !== -1 && end !== -1) {
        let newContent = content.substring(0, start + 15) + '\n                          ' + content.substring(end);
        fs.writeFileSync('src/pages/BillingPage.tsx', newContent);
        console.log('patched');
    }
}
