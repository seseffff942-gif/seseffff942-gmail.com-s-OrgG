const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, res => {
  let body = ''; res.on('data', d => body += d); res.on('end', () => {
    const { token } = JSON.parse(body);
    console.log("Got token");
    const start = Date.now();
    const payload = JSON.stringify({
      sellerId: "admin", client: "TEST", items: [{ productId: "test", quantity: 1, price: 10 }], isOwed: false, invoiceType: "agricola", creditDays: 30
    });
    const req2 = http.request({
      hostname: 'localhost', port: 3000, path: '/api/invoices',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'Content-Length': Buffer.byteLength(payload) }
    }, res2 => {
      let b2 = ''; res2.on('data', d => b2 += d); res2.on('end', () => {
        console.log('Time:', Date.now() - start);
        console.log('Resp:', res2.statusCode, b2.substring(0, 50));
      });
    });
    req2.write(payload);
    req2.end();
  });
});
req.write(JSON.stringify({ email: "admin@agricovet.com", password: "admin" }));
req.end();
