const fs = require('fs');
let content = fs.readFileSync('src/pages/BillingPage.tsx', 'utf8');
let ix = content.indexOf(`const message = \`Hola *\${sellerName}*, la factura *\${invoice.id}* a nombre de *\${invoice.client}* ha sido *AUTORIZADA*. Ya puedes proceder.\`;`);

if(ix !== -1) {
    let start = content.lastIndexOf("loadInvoices();", ix);
    let end = content.indexOf("className=\"px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors\"", ix);
    if (start !== -1 && end !== -1) {
        let newContent = content.substring(0, start + 15) + '\n                          }}\n                          ' + content.substring(end);
        fs.writeFileSync('src/pages/BillingPage.tsx', newContent);
        console.log('patched');
    } else {
        console.log('could not find start or end', start, end);
    }
} else {
    console.log('could not find target content block');
}
