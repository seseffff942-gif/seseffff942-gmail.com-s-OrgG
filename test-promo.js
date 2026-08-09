import http from 'http';
const data = JSON.stringify({ name: 'test2', buyQty: 1, freeQty: 1, productId: 'p1', price: 100, sellerPrices: { user1: 90 } });
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/offers',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};
const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('POST /api/offers:', res.statusCode, body));
});
req.write(data);
req.end();
