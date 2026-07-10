import http from 'http';

http.get('http://localhost:3000/api/offers', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('GET /api/offers:', data));
});

const postData = JSON.stringify({ name: 'test from curl', buyQty: 1, freeQty: 1, productId: 'p1' });
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/offers',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};
const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('POST /api/offers:', res.statusCode, data));
});
req.write(postData);
req.end();
