const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const { token } = JSON.parse(body);
      
      const start = Date.now();
      const req2 = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/invoices',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      }, res2 => {
        let body2 = '';
        res2.on('data', d => body2 += d);
        res2.on('end', () => {
          console.log('Time:', Date.now() - start, 'ms');
          console.log('Response:', res2.statusCode);
          console.log(body2);
        });
      });
      req2.write(JSON.stringify({
        client: "Test",
        items: [{ productId: "test-item-1", quantity: 1, price: 10 }]
      }));
      req2.end();
    } catch(e) {}
  });
});
req.write(JSON.stringify({ email: "admin@agricovet.com", password: "admin" }));
req.end();
